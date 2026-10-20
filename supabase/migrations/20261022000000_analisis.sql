-- ListaMatch v2 · Fase 9: análisis (sólo el dueño).
--
-- Ganancia: precio de venta menos lo que costó el producto. El costo del catálogo está sin IVA y el recargo se aplica
-- sobre costo + IVA cuando el comercio vende con IVA incluido (F08); por eso, en ese caso, el IVA cuenta como costo
-- (es lo que paga un monotributista, que no lo recupera). Así la ganancia coincide con el recargo del comercio.
-- Las líneas sin costo ("Varios", o productos con costo 0) no entran en la ganancia: se informan aparte.

-- Las líneas de venta guardan el costo: nadie las lee directo (el empleado podía ver costos de sus ventas).
-- Se leen sólo por funciones que eligen qué mostrar.
revoke select on public.venta_items from authenticated;

create or replace function public.ventas_del_dia(c uuid, dia date) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'fecha', v.fecha, 'medioPago', v.medio_pago, 'total', v.total, 'articulos', v.articulos,
           'anulada', v.anulada_en is not null,
           'vendedor', coalesce((select coalesce(nullif(m.nombre, ''), m.email) from public.miembros m
                                 where m.comercio_id = c and m.usuario_id = v.usuario_id), ''),
           'propia', v.usuario_id = auth.uid(),
           'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                        'descripcion', i.descripcion, 'cantidad', i.cantidad, 'precioUnitario', i.precio_unitario,
                        'subtotal', i.subtotal) order by i.descripcion), '[]'::jsonb)
                      from public.venta_items i where i.venta_id = v.id))
         order by v.fecha desc), '[]'::jsonb)
  from public.ventas v
  where v.comercio_id = c and v.dia = ventas_del_dia.dia and v.tipo = 'ticket'
    -- El dueño ve todas; el empleado, las suyas.
    and (public.es_admin(c) or (v.usuario_id = auth.uid() and public.es_miembro(c)))
$$;

-- El IVA de cada línea al momento de la venta (como el costo). Las ventas anteriores usan el del producto (o 21%).
alter table public.venta_items add column iva_pct integer;

create or replace function public.registrar_venta(c uuid, venta jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  nuevo_id uuid := (venta ->> 'id')::uuid;
  previa public.ventas;
  momento timestamptz := coalesce((venta ->> 'fecha')::timestamptz, now());
  medio text := venta ->> 'medioPago';
  suma bigint;
  unidades numeric;
begin
  if not public.es_miembro(c) then
    raise exception 'No sos parte de este comercio.';
  end if;
  select * into previa from public.ventas v where v.id = nuevo_id;
  if found then
    if previa.comercio_id <> c then raise exception 'Venta no válida.'; end if;
    return jsonb_build_object('id', previa.id, 'total', previa.total, 'dia', previa.dia);
  end if;
  if medio is null or medio not in ('efectivo', 'debito', 'credito', 'qr', 'transferencia') then
    raise exception 'Elegí cómo pagó.';
  end if;
  if jsonb_typeof(venta -> 'lineas') <> 'array' or jsonb_array_length(venta -> 'lineas') = 0 then
    raise exception 'Agregá al menos un producto.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(venta -> 'lineas') l
    where jsonb_typeof(l -> 'cantidad') <> 'number' or (l ->> 'cantidad')::numeric <= 0 or (l ->> 'cantidad')::numeric > 9999
       or (l ->> 'cantidad')::numeric <> round((l ->> 'cantidad')::numeric, 3)
       or jsonb_typeof(l -> 'precioUnitario') <> 'number' or (l ->> 'precioUnitario')::numeric < 0
       or (l ->> 'precioUnitario')::numeric <> trunc((l ->> 'precioUnitario')::numeric)
  ) then
    raise exception 'Hay una cantidad o un precio que no es válido.';
  end if;
  if momento > now() + interval '10 minutes' then momento := now(); end if;

  insert into public.ventas (id, comercio_id, usuario_id, tipo, fecha, dia, medio_pago, total)
  values (nuevo_id, c, auth.uid(), 'ticket', momento, public.dia_argentina(momento), medio, 0);

  insert into public.venta_items (comercio_id, venta_id, producto_id, descripcion, cantidad, precio_unitario, costo_unitario, iva_pct, subtotal)
  select c, nuevo_id, p.id,
         left(coalesce(nullif(btrim(l ->> 'descripcion'), ''), p.descripcion, 'Varios'), 200),
         (l ->> 'cantidad')::numeric, (l ->> 'precioUnitario')::bigint, p.costo_actual, p.iva_pct,
         round((l ->> 'precioUnitario')::numeric * (l ->> 'cantidad')::numeric)::bigint
  from jsonb_array_elements(venta -> 'lineas') l
  left join public.productos p on p.comercio_id = c and p.id = (l ->> 'productoId')::uuid;

  select sum(i.subtotal), sum(i.cantidad) into suma, unidades from public.venta_items i where i.venta_id = nuevo_id;
  if suma <= 0 then
    raise exception 'El total tiene que ser mayor que cero.';
  end if;
  update public.ventas set total = suma, articulos = unidades where id = nuevo_id;
  return jsonb_build_object('id', nuevo_id, 'total', suma, 'dia', public.dia_argentina(momento));
end;
$$;

-- Líneas de tickets válidos del período, con su costo efectivo (con IVA si el comercio vende con IVA incluido).
-- Uso interno de analisis_ventas: la app no la puede llamar.
create function public.lineas_con_costo(c uuid, desde date, hasta date)
returns table (producto_id uuid, descripcion text, rubro_id uuid, fecha timestamptz, cantidad numeric, subtotal bigint, costo numeric)
language sql stable set search_path = ''
as $$
  select i.producto_id, i.descripcion, p.rubro_id, v.fecha, i.cantidad, i.subtotal,
         case when coalesce(i.costo_unitario, 0) > 0 then
           i.costo_unitario * i.cantidad
           * case when cf.venta_incluye_iva then 1 + coalesce(i.iva_pct, p.iva_pct, 2100) / 10000.0 else 1 end
         end as costo
  from public.venta_items i
  join public.ventas v on v.id = i.venta_id
  join public.config_comercio cf on cf.comercio_id = v.comercio_id
  left join public.productos p on p.comercio_id = i.comercio_id and p.id = i.producto_id
  where v.comercio_id = c and v.tipo = 'ticket' and v.anulada_en is null and v.dia between desde and hasta
    and public.es_admin(c)
$$;

-- Corre con los permisos de la base (lee las líneas con costo) y controla que quien llama sea el dueño.
create function public.analisis_ventas(c uuid, desde date, hasta date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then
    raise exception 'Sólo el dueño ve el análisis.';
  end if;
  if hasta < desde or hasta - desde > 366 then
    raise exception 'El período no es válido.';
  end if;
  return (
    with l as (select * from public.lineas_con_costo(c, desde, hasta))
    select jsonb_build_object(
      'ganancia', jsonb_build_object(
        'ventasConCosto', coalesce((select sum(subtotal) from l where costo is not null), 0),
        'costo', coalesce((select round(sum(costo)) from l where costo is not null), 0),
        'ventasSinCosto', coalesce((select sum(subtotal) from l where costo is null), 0)),
      -- Por producto (los 50 que más facturaron); "Varios" y productos borrados van juntos, sin id.
      'productos', coalesce((
        select jsonb_agg(jsonb_build_object('productoId', x.producto_id, 'descripcion', x.descripcion, 'unidades', x.unidades,
                                            'importe', x.importe, 'ganancia', x.ganancia) order by x.importe desc)
        from (
          select l.producto_id, case when l.producto_id is null then 'Varios' else max(l.descripcion) end as descripcion,
                 sum(l.cantidad) as unidades, sum(l.subtotal) as importe,
                 case when bool_and(l.costo is not null) then round(sum(l.subtotal) - sum(l.costo)) end as ganancia
          from l group by l.producto_id
          order by importe desc limit 50
        ) x), '[]'::jsonb),
      -- Por rubro (el de ahora del producto); null = sin rubro o "Varios".
      'rubros', coalesce((
        select jsonb_agg(jsonb_build_object('rubro', x.nombre, 'importe', x.importe) order by x.importe desc)
        from (
          select r.nombre, sum(l.subtotal) as importe
          from l left join public.rubros r on r.comercio_id = c and r.id = l.rubro_id
          group by r.nombre
        ) x), '[]'::jsonb),
      -- Día de la semana (0 = lunes) y hora, en Argentina.
      'horas', coalesce((
        select jsonb_agg(jsonb_build_object('diaSemana', x.dow, 'hora', x.hora, 'importe', x.importe, 'ventas', x.ventas))
        from (
          select (extract(isodow from v.fecha at time zone 'America/Argentina/Buenos_Aires')::int - 1) as dow,
                 extract(hour from v.fecha at time zone 'America/Argentina/Buenos_Aires')::int as hora,
                 sum(v.total) as importe, count(*) as ventas
          from public.ventas v
          where v.comercio_id = c and v.tipo = 'ticket' and v.anulada_en is null and v.dia between desde and hasta
          group by 1, 2
        ) x), '[]'::jsonb)
    ));
end;
$$;

-- Productos sin ventas en los últimos `dias` días (con la fecha de su última venta, si tuvo).
create function public.sin_movimiento(c uuid, dias integer default 30) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then
    raise exception 'Sólo el dueño ve el análisis.';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('productoId', x.id, 'descripcion', x.descripcion, 'precioVentaActual', x.precio_venta_actual,
                                        'costoActual', x.costo_actual, 'ultimaVenta', x.ultima) order by x.ultima nulls first, x.descripcion)
    from (
      select p.id, p.descripcion, p.precio_venta_actual, p.costo_actual,
             (select max(v.dia) from public.venta_items i join public.ventas v on v.id = i.venta_id
              where i.comercio_id = c and i.producto_id = p.id and v.anulada_en is null) as ultima
      from public.productos p where p.comercio_id = c
    ) x
    where x.ultima is null or x.ultima < public.dia_argentina(now()) - greatest(1, dias)
  ), '[]'::jsonb);
end;
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('analisis_ventas', 'sin_movimiento')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

revoke all on function public.lineas_con_costo(uuid, date, date) from public, anon, authenticated;
