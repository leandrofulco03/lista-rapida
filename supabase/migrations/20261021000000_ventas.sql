-- ListaMatch v2 · Fase 8: ventas.
--
-- Dos formas de cargar:
--   * ticket: cada venta con sus productos (o "Varios" con un importe a mano) y su medio de pago.
--   * sin_detalle: lo que se vendió en un día sin cargar los tickets, por medio de pago (lo carga el dueño).
-- La venta total de un período es la suma de las dos. El ticket promedio y los artículos salen sólo de los tickets.
--
-- El id de la venta lo crea el dispositivo: así una venta hecha sin conexión se manda las veces que haga falta
-- y se guarda una sola vez.
-- Cada línea guarda el costo del producto en el momento de la venta (para la ganancia, Fase 9). Lo pone la base:
-- el empleado no ve costos.
-- Una venta no se borra: se anula (queda quién y cuándo).

create table public.ventas (
  id uuid primary key,
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  usuario_id uuid references auth.users (id) on delete set null,
  tipo text not null check (tipo in ('ticket', 'sin_detalle')),
  -- Cuándo se vendió (reloj del dispositivo) y el día en Argentina.
  fecha timestamptz not null,
  dia date not null,
  medio_pago text not null check (medio_pago in ('efectivo', 'debito', 'credito', 'qr', 'transferencia')),
  total bigint not null check (total >= 0),
  articulos numeric(12, 3) not null default 0,
  anulada_en timestamptz,
  anulada_por uuid references auth.users (id) on delete set null,
  creado timestamptz not null default now(),
  unique (comercio_id, id)
);
create index ventas_dia on public.ventas (comercio_id, dia);
create unique index ventas_sin_detalle on public.ventas (comercio_id, dia, medio_pago) where tipo = 'sin_detalle';

create table public.venta_items (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  venta_id uuid not null,
  -- null: "Varios" (importe a mano) o un producto que ya no está en el catálogo.
  producto_id uuid,
  descripcion text not null,
  cantidad numeric(10, 3) not null check (cantidad > 0 and cantidad <= 9999),
  precio_unitario bigint not null check (precio_unitario >= 0),
  costo_unitario bigint,
  subtotal bigint not null,
  foreign key (comercio_id, venta_id) references public.ventas (comercio_id, id) on delete cascade,
  foreign key (comercio_id, producto_id) references public.productos (comercio_id, id) on delete set null (producto_id)
);
create index venta_items_venta on public.venta_items (venta_id);
create index venta_items_producto on public.venta_items (comercio_id, producto_id);

alter table public.ventas enable row level security;
alter table public.venta_items enable row level security;

-- Se leen con reglas (el dueño todo; el empleado lo suyo) y se escriben sólo por las funciones de abajo.
revoke all on public.ventas, public.venta_items from anon, authenticated;
grant select on public.ventas, public.venta_items to authenticated;

create policy ver on public.ventas for select to authenticated
  using (public.es_admin(comercio_id) or (usuario_id = auth.uid() and public.es_miembro(comercio_id)));
create policy ver on public.venta_items for select to authenticated
  using (exists (select 1 from public.ventas v where v.id = venta_id));

-- Día de Argentina de un momento.
create function public.dia_argentina(t timestamptz) returns date
language sql stable set search_path = ''
as $$ select (t at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- ---------------------------------------------------------------------------------------------
-- Vender
-- ---------------------------------------------------------------------------------------------

-- Productos para vender: sin costo ni recargo (cualquier miembro).
create function public.productos_para_vender(c uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', p.id, 'codigoInterno', p.codigo_interno, 'codigoBarras', p.codigo_barras, 'descripcion', p.descripcion,
           'descripcionNormalizada', p.descripcion_normalizada, 'precioVentaActual', p.precio_venta_actual)
         order by p.descripcion), '[]'::jsonb)
  from public.productos_venta p where p.comercio_id = c
$$;

-- Los más vendidos de los últimos 30 días (para los botones rápidos). Cualquier miembro.
create function public.mas_vendidos(c uuid, cantidad integer default 8) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_miembro(c) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(t.id order by t.unidades desc, t.descripcion)
    from (
      select p.id, p.descripcion, sum(i.cantidad) as unidades
      from public.venta_items i
      join public.ventas v on v.id = i.venta_id
      join public.productos p on p.comercio_id = i.comercio_id and p.id = i.producto_id
      where i.comercio_id = c and v.anulada_en is null and v.dia >= public.dia_argentina(now()) - 30
      group by p.id, p.descripcion
      order by unidades desc, p.descripcion
      limit greatest(1, least(mas_vendidos.cantidad, 24))
    ) t), '[]'::jsonb);
end;
$$;

-- Guarda un ticket: {id, fecha, medioPago, lineas: [{productoId, descripcion, cantidad, precioUnitario}]}.
-- Si ya está guardado (se mandó dos veces), devuelve el guardado. Devuelve {id, total, dia}.
create function public.registrar_venta(c uuid, venta jsonb) returns jsonb
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
  -- Un reloj adelantado no deja ventas en el futuro.
  if momento > now() + interval '10 minutes' then momento := now(); end if;

  insert into public.ventas (id, comercio_id, usuario_id, tipo, fecha, dia, medio_pago, total)
  values (nuevo_id, c, auth.uid(), 'ticket', momento, public.dia_argentina(momento), medio, 0);

  insert into public.venta_items (comercio_id, venta_id, producto_id, descripcion, cantidad, precio_unitario, costo_unitario, subtotal)
  select c, nuevo_id, p.id,
         left(coalesce(nullif(btrim(l ->> 'descripcion'), ''), p.descripcion, 'Varios'), 200),
         (l ->> 'cantidad')::numeric, (l ->> 'precioUnitario')::bigint, p.costo_actual,
         round((l ->> 'precioUnitario')::numeric * (l ->> 'cantidad')::numeric)::bigint
  from jsonb_array_elements(venta -> 'lineas') l
  -- Un producto borrado mientras la venta esperaba conexión queda como línea sin producto.
  left join public.productos p on p.comercio_id = c and p.id = (l ->> 'productoId')::uuid;

  select sum(i.subtotal), sum(i.cantidad) into suma, unidades from public.venta_items i where i.venta_id = nuevo_id;
  if suma <= 0 then
    raise exception 'El total tiene que ser mayor que cero.';
  end if;
  update public.ventas set total = suma, articulos = unidades where id = nuevo_id;
  return jsonb_build_object('id', nuevo_id, 'total', suma, 'dia', public.dia_argentina(momento));
end;
$$;

-- Anula un ticket. El empleado, sólo los suyos de hoy; el dueño, cualquiera.
create function public.anular_venta(c uuid, id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v public.ventas;
begin
  select * into v from public.ventas x where x.id = anular_venta.id and x.comercio_id = c for update;
  if not found or v.tipo <> 'ticket' then raise exception 'No encontramos esa venta.'; end if;
  if v.anulada_en is not null then raise exception 'Esa venta ya estaba anulada.'; end if;
  if not public.es_admin(c) and not (
    public.es_miembro(c) and v.usuario_id = auth.uid() and v.dia = public.dia_argentina(now())
  ) then
    raise exception 'Sólo podés anular tus ventas de hoy. Para otras, pedíselo al dueño.';
  end if;
  update public.ventas set anulada_en = now(), anulada_por = auth.uid() where ventas.id = v.id;
end;
$$;

-- Tickets de un día, con sus líneas, de más nuevo a más viejo. El empleado ve los suyos; el dueño, todos.
create function public.ventas_del_dia(c uuid, dia date) returns jsonb
language sql stable set search_path = ''
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
$$;

-- ---------------------------------------------------------------------------------------------
-- Ventas sin detalle (total del día) — sólo el dueño
-- ---------------------------------------------------------------------------------------------

-- {medio: monto} de un día.
create function public.leer_sin_detalle(c uuid, dia date) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(v.medio_pago, v.total), '{}'::jsonb)
  from public.ventas v
  where v.comercio_id = c and v.dia = leer_sin_detalle.dia and v.tipo = 'sin_detalle' and public.es_admin(c)
$$;

-- Reemplaza lo cargado sin detalle de un día: {medio: monto}. Un monto en cero lo saca.
create function public.guardar_sin_detalle(c uuid, dia date, montos jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then
    raise exception 'Sólo el dueño carga el total del día.';
  end if;
  if dia > public.dia_argentina(now()) then
    raise exception 'No se puede cargar un día que todavía no llegó.';
  end if;
  if exists (
    select 1 from jsonb_each(montos) m
    where m.key not in ('efectivo', 'debito', 'credito', 'qr', 'transferencia')
       or jsonb_typeof(m.value) <> 'number' or (m.value #>> '{}')::numeric < 0
       or (m.value #>> '{}')::numeric <> trunc((m.value #>> '{}')::numeric)
  ) then
    raise exception 'Hay un importe que no es válido.';
  end if;
  delete from public.ventas v where v.comercio_id = c and v.dia = guardar_sin_detalle.dia and v.tipo = 'sin_detalle';
  insert into public.ventas (id, comercio_id, usuario_id, tipo, fecha, dia, medio_pago, total)
  select gen_random_uuid(), c, auth.uid(), 'sin_detalle',
         (guardar_sin_detalle.dia::timestamp + interval '12 hours') at time zone 'America/Argentina/Buenos_Aires',
         guardar_sin_detalle.dia, m.key, (m.value #>> '{}')::bigint
  from jsonb_each(montos) m
  where (m.value #>> '{}')::bigint > 0;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Resumen (KPIs) — sólo el dueño
-- ---------------------------------------------------------------------------------------------

create function public.resumen_ventas(c uuid, desde date, hasta date) returns jsonb
language plpgsql stable set search_path = ''
as $$
begin
  if not public.es_admin(c) then
    raise exception 'Sólo el dueño ve el resumen de ventas.';
  end if;
  if hasta < desde or hasta - desde > 366 then
    raise exception 'El período no es válido.';
  end if;
  return (
    with v as (
      select * from public.ventas x
      where x.comercio_id = c and x.dia between desde and hasta and x.anulada_en is null
    )
    select jsonb_build_object(
      'totalTickets', coalesce((select sum(total) from v where tipo = 'ticket'), 0),
      'tickets', (select count(*) from v where tipo = 'ticket'),
      'articulos', coalesce((select sum(articulos) from v where tipo = 'ticket'), 0),
      'totalSinDetalle', coalesce((select sum(total) from v where tipo = 'sin_detalle'), 0),
      'diasSinDetalle', (select count(distinct dia) from v where tipo = 'sin_detalle'),
      'porMedio', coalesce((select jsonb_agg(jsonb_build_object('medio', medio_pago, 'total', t) order by t desc)
                            from (select medio_pago, sum(total) as t from v group by medio_pago) m), '[]'::jsonb),
      'porDia', (select jsonb_agg(jsonb_build_object('dia', d::date, 'total', coalesce((select sum(total) from v where v.dia = d::date), 0)) order by d)
                 from generate_series(desde::timestamp, hasta::timestamp, interval '1 day') d)
    ));
end;
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('dia_argentina', 'productos_para_vender', 'mas_vendidos', 'registrar_venta', 'anular_venta',
        'ventas_del_dia', 'leer_sin_detalle', 'guardar_sin_detalle', 'resumen_ventas')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
