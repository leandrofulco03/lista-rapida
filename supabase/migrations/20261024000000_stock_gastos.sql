-- Vendia v2 · Fase 10 (segunda parte): stock, sugerencia de pedido, gastos fijos y resultado neto. Todo es del dueño.
--
-- Stock opcional por producto: sólo llevan stock los productos que tienen fila en `stock`. Se descuenta al vender
-- (en la misma transacción de la venta), vuelve al anular, se suma al anotar lo que llegó y se corrige contando.
-- Puede quedar negativo (se vendió más de lo que se había contado): no se frena una venta por eso.
-- La sugerencia de pedido se calcula en la app con lo vendido en los últimos 28 días.
--
-- Gastos fijos: una lista de gastos (alquiler, luz, sueldos) con el monto de cada mes.
-- Resultado neto del mes = ganancia de las ventas (como en Análisis) − gastos del mes.

-- ---------------------------------------------------------------------------------------------
-- Stock
-- ---------------------------------------------------------------------------------------------

create table public.stock (
  comercio_id uuid not null,
  producto_id uuid not null,
  cantidad numeric(12, 3) not null,
  actualizado timestamptz not null default now(),
  primary key (comercio_id, producto_id),
  foreign key (comercio_id, producto_id) references public.productos (comercio_id, id) on delete cascade
);

create table public.movimientos_stock (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  producto_id uuid not null,
  fecha timestamptz not null default now(),
  -- inicio: empezó a llevar stock; venta y anulacion: automáticos; ingreso: llegó mercadería; ajuste: se contó.
  tipo text not null check (tipo in ('inicio', 'venta', 'anulacion', 'ingreso', 'ajuste')),
  -- Con signo: lo que sumó o restó.
  cantidad numeric(12, 3) not null,
  venta_id uuid,
  nota text check (nota is null or length(nota) <= 200),
  usuario_id uuid references auth.users (id) on delete set null,
  foreign key (comercio_id, producto_id) references public.productos (comercio_id, id) on delete cascade
);
create index movimientos_stock_producto on public.movimientos_stock (comercio_id, producto_id, fecha);

alter table public.stock enable row level security;
alter table public.movimientos_stock enable row level security;
revoke all on public.stock, public.movimientos_stock from anon, authenticated;

-- Descuenta (o devuelve, con signo −1) el stock de los productos de una venta que llevan stock. Uso interno.
create function public.mover_stock_de_venta(c uuid, venta uuid, signo integer) returns void
language sql set search_path = ''
as $$
  with lineas as (
    select i.producto_id, sum(i.cantidad) * -signo as cantidad
    from public.venta_items i
    join public.stock s on s.comercio_id = c and s.producto_id = i.producto_id
    where i.venta_id = venta and i.comercio_id = c
    group by i.producto_id
  ),
  movidos as (
    update public.stock s set cantidad = s.cantidad + l.cantidad, actualizado = now()
    from lineas l where s.comercio_id = c and s.producto_id = l.producto_id
    returning s.producto_id, l.cantidad
  )
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, venta_id, usuario_id)
  select c, m.producto_id, case when signo > 0 then 'venta' else 'anulacion' end, m.cantidad, venta, auth.uid()
  from movidos m
$$;

-- Igual que en la Fase 10 (fiado), y además descuenta el stock.
create or replace function public.registrar_venta(c uuid, venta jsonb) returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  nuevo_id uuid := (venta ->> 'id')::uuid;
  previa public.ventas;
  momento timestamptz := coalesce((venta ->> 'fecha')::timestamptz, now());
  medio text := venta ->> 'medioPago';
  cliente uuid;
  nombre_cliente text := left(btrim(regexp_replace(coalesce(venta #>> '{cliente,nombre}', ''), '\s+', ' ', 'g')), 80);
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
  if medio is null or medio not in ('efectivo', 'debito', 'credito', 'qr', 'transferencia', 'fiado') then
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

  if medio = 'fiado' then
    cliente := (venta #>> '{cliente,id}')::uuid;
    if cliente is null then raise exception 'Elegí a quién se le fía.'; end if;
    if not exists (select 1 from public.clientes k where k.comercio_id = c and k.id = cliente) then
      if exists (select 1 from public.clientes k where k.id = cliente) then raise exception 'Cliente no válido.'; end if;
      if nombre_cliente = '' then raise exception 'Elegí a quién se le fía.'; end if;
      select k.id into cliente from public.clientes k
      where k.comercio_id = c and not k.archivado and lower(btrim(k.nombre)) = lower(nombre_cliente);
      if not found then
        cliente := (venta #>> '{cliente,id}')::uuid;
        insert into public.clientes (id, comercio_id, nombre, creado_por) values (cliente, c, nombre_cliente, auth.uid());
      end if;
    end if;
  end if;

  if momento > now() + interval '10 minutes' then momento := now(); end if;

  insert into public.ventas (id, comercio_id, usuario_id, tipo, fecha, dia, medio_pago, total, cliente_id)
  values (nuevo_id, c, auth.uid(), 'ticket', momento, public.dia_argentina(momento), medio, 0, cliente);

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
  perform public.mover_stock_de_venta(c, nuevo_id, 1);
  return jsonb_build_object('id', nuevo_id, 'total', suma, 'dia', public.dia_argentina(momento));
end;
$$;

-- Igual que en la Fase 8, y además devuelve el stock.
create or replace function public.anular_venta(c uuid, id uuid) returns void
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
  perform public.mover_stock_de_venta(c, v.id, -1);
end;
$$;

-- Productos que llevan stock, con lo vendido en los últimos 28 días y un proveedor que lo trae (para el pedido).
create function public.listar_stock(c uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño ve el stock.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'productoId', p.id, 'codigoInterno', p.codigo_interno, 'descripcion', p.descripcion, 'cantidad', s.cantidad,
             'actualizado', s.actualizado,
             'vendido28', coalesce((
               select sum(i.cantidad) from public.venta_items i join public.ventas v on v.id = i.venta_id
               where i.comercio_id = c and i.producto_id = p.id and v.anulada_en is null
                 and v.dia > public.dia_argentina(now()) - 28), 0),
             -- Si varios proveedores lo traen, el primero por nombre.
             'proveedor', (select pr.nombre from public.vinculos vi join public.proveedores pr on pr.id = vi.proveedor_id
                           where vi.comercio_id = c and vi.producto_id = p.id order by pr.nombre limit 1))
           order by p.descripcion)
    from public.stock s join public.productos p on p.comercio_id = s.comercio_id and p.id = s.producto_id
    where s.comercio_id = c), '[]'::jsonb);
end;
$$;

-- Valida [{productoId, cantidad}] (uso interno).
create function public.items_stock_validos(c uuid, items jsonb, permite_cero boolean) returns boolean
language sql stable set search_path = ''
as $$
  select jsonb_typeof(items) = 'array' and jsonb_array_length(items) > 0
     and not exists (
       select 1 from jsonb_array_elements(items) x
       where jsonb_typeof(x -> 'cantidad') <> 'number'
          or (x ->> 'cantidad')::numeric < 0 or (not permite_cero and (x ->> 'cantidad')::numeric = 0)
          or (x ->> 'cantidad')::numeric > 999999
          or (x ->> 'cantidad')::numeric <> round((x ->> 'cantidad')::numeric, 3)
          or not exists (select 1 from public.productos p where p.comercio_id = c and p.id = (x ->> 'productoId')::uuid))
$$;

-- Llegó mercadería: suma a cada producto. Un producto que no llevaba stock empieza a llevarlo con esa cantidad.
create function public.ingreso_stock(c uuid, items jsonb, nota text default null) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño carga el stock.'; end if;
  if not public.items_stock_validos(c, items, false) then raise exception 'Hay una cantidad que no es válida.'; end if;
  insert into public.stock as s (comercio_id, producto_id, cantidad)
  select c, (x ->> 'productoId')::uuid, sum((x ->> 'cantidad')::numeric) from jsonb_array_elements(items) x group by 2
  on conflict (comercio_id, producto_id) do update set cantidad = s.cantidad + excluded.cantidad, actualizado = now();
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, nota, usuario_id)
  select c, (x ->> 'productoId')::uuid, 'ingreso', (x ->> 'cantidad')::numeric, nullif(btrim(left(coalesce(nota, ''), 200)), ''), auth.uid()
  from jsonb_array_elements(items) x;
end;
$$;

-- Se contó: deja cada producto con la cantidad contada (y empieza a llevar stock si no lo llevaba).
create function public.ajustar_stock(c uuid, items jsonb, nota text default null) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño carga el stock.'; end if;
  if not public.items_stock_validos(c, items, true) then raise exception 'Hay una cantidad que no es válida.'; end if;
  insert into public.movimientos_stock (comercio_id, producto_id, tipo, cantidad, nota, usuario_id)
  select c, x.producto_id, case when s.producto_id is null then 'inicio' else 'ajuste' end,
         x.cantidad - coalesce(s.cantidad, 0), nullif(btrim(left(coalesce(nota, ''), 200)), ''), auth.uid()
  from (select distinct on ((y ->> 'productoId')::uuid) (y ->> 'productoId')::uuid as producto_id, (y ->> 'cantidad')::numeric as cantidad
        from jsonb_array_elements(items) y) x
  left join public.stock s on s.comercio_id = c and s.producto_id = x.producto_id;
  insert into public.stock as s (comercio_id, producto_id, cantidad)
  select distinct on ((y ->> 'productoId')::uuid) c, (y ->> 'productoId')::uuid, (y ->> 'cantidad')::numeric
  from jsonb_array_elements(items) y
  on conflict (comercio_id, producto_id) do update set cantidad = excluded.cantidad, actualizado = now();
end;
$$;

-- Deja de llevar stock de un producto (los movimientos quedan).
create function public.dejar_stock(c uuid, producto uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño carga el stock.'; end if;
  delete from public.stock s where s.comercio_id = c and s.producto_id = producto;
end;
$$;

create function public.movimientos_de_stock(c uuid, producto uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño ve el stock.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('fecha', m.fecha, 'tipo', m.tipo, 'cantidad', m.cantidad, 'nota', m.nota) order by m.fecha desc)
    from (select * from public.movimientos_stock x where x.comercio_id = c and x.producto_id = producto
          order by x.fecha desc limit 100) m), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Gastos fijos y resultado neto
-- ---------------------------------------------------------------------------------------------

create table public.gastos (
  id uuid primary key,
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 60),
  archivado boolean not null default false,
  creado timestamptz not null default now(),
  unique (comercio_id, id)
);
create unique index gastos_nombre on public.gastos (comercio_id, lower(btrim(nombre))) where not archivado;

create table public.gastos_mes (
  comercio_id uuid not null,
  gasto_id uuid not null,
  -- Primer día del mes.
  mes date not null check (extract(day from mes) = 1),
  monto bigint not null check (monto > 0),
  primary key (gasto_id, mes),
  foreign key (comercio_id, gasto_id) references public.gastos (comercio_id, id) on delete cascade
);
create index gastos_mes_mes on public.gastos_mes (comercio_id, mes);

alter table public.gastos enable row level security;
alter table public.gastos_mes enable row level security;
revoke all on public.gastos, public.gastos_mes from anon, authenticated;

-- Gastos de un mes: los activos y los archivados que tienen monto ese mes, con lo del último mes anterior cargado.
create function public.leer_gastos(c uuid, mes date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  m date := date_trunc('month', mes)::date;
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño ve los gastos.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', g.id, 'nombre', g.nombre, 'archivado', g.archivado,
             'monto', (select x.monto from public.gastos_mes x where x.gasto_id = g.id and x.mes = m),
             'montoAnterior', (select x.monto from public.gastos_mes x where x.gasto_id = g.id and x.mes < m order by x.mes desc limit 1))
           order by g.archivado, lower(g.nombre))
    from public.gastos g
    where g.comercio_id = c
      and (not g.archivado or exists (select 1 from public.gastos_mes x where x.gasto_id = g.id and x.mes = m))), '[]'::jsonb);
end;
$$;

-- Alta o cambio de nombre de un gasto.
create function public.guardar_gasto(c uuid, id uuid, nombre text) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  limpio text := left(btrim(regexp_replace(coalesce(nombre, ''), '\s+', ' ', 'g')), 60);
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño carga gastos.'; end if;
  if id is null then raise exception 'Gasto no válido.'; end if;
  if limpio = '' then raise exception 'Escribí el nombre del gasto.'; end if;
  if exists (select 1 from public.gastos g where g.id = guardar_gasto.id and g.comercio_id <> c) then raise exception 'Gasto no válido.'; end if;
  if exists (select 1 from public.gastos g where g.comercio_id = c and g.id <> guardar_gasto.id and not g.archivado
             and lower(btrim(g.nombre)) = lower(limpio)) then
    raise exception 'Ya hay un gasto que se llama %.', limpio;
  end if;
  insert into public.gastos (id, comercio_id, nombre) values (guardar_gasto.id, c, limpio)
  on conflict on constraint gastos_pkey do update set nombre = excluded.nombre;
end;
$$;

create function public.archivar_gasto(c uuid, id uuid, archivado boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  g public.gastos;
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño carga gastos.'; end if;
  select * into g from public.gastos x where x.comercio_id = c and x.id = archivar_gasto.id;
  if not found then raise exception 'No encontramos ese gasto.'; end if;
  if not archivado and exists (select 1 from public.gastos x where x.comercio_id = c and x.id <> g.id and not x.archivado
                               and lower(btrim(x.nombre)) = lower(btrim(g.nombre))) then
    raise exception 'Ya hay otro gasto que se llama %.', g.nombre;
  end if;
  update public.gastos x set archivado = archivar_gasto.archivado where x.id = g.id;
end;
$$;

-- Reemplaza los montos de un mes: {gastoId: monto}. Un monto en cero (o null) lo saca.
create function public.guardar_gastos_mes(c uuid, mes date, montos jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  m date := date_trunc('month', mes)::date;
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño carga gastos.'; end if;
  if jsonb_typeof(montos) <> 'object' or exists (
    select 1 from jsonb_each(montos) x
    where not exists (select 1 from public.gastos g where g.comercio_id = c and g.id::text = x.key)
       or (jsonb_typeof(x.value) <> 'null' and (jsonb_typeof(x.value) <> 'number' or (x.value #>> '{}')::numeric < 0
           or (x.value #>> '{}')::numeric <> trunc((x.value #>> '{}')::numeric)))
  ) then
    raise exception 'Hay un importe que no es válido.';
  end if;
  delete from public.gastos_mes x where x.comercio_id = c and x.mes = m and x.gasto_id::text in (select key from jsonb_each(montos));
  insert into public.gastos_mes (comercio_id, gasto_id, mes, monto)
  select c, x.key::uuid, m, (x.value #>> '{}')::bigint
  from jsonb_each(montos) x where jsonb_typeof(x.value) = 'number' and (x.value #>> '{}')::bigint > 0;
end;
$$;

-- Resultado de cada mes entre `desde` y `hasta` (meses): ventas, ganancia de lo vendido con costo y gastos.
create function public.resultado_meses(c uuid, desde date, hasta date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  d date := date_trunc('month', desde)::date;
  h date := date_trunc('month', hasta)::date;
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño ve el resultado.'; end if;
  if h < d or h > d + interval '24 months' then raise exception 'El período no es válido.'; end if;
  return (
    select jsonb_agg(jsonb_build_object(
             'mes', m.mes,
             'ventas', coalesce((select sum(v.total) from public.ventas v where v.comercio_id = c and v.anulada_en is null
                                 and v.dia >= m.mes and v.dia < (m.mes + interval '1 month')::date), 0),
             'ventasConCosto', coalesce((select sum(l.subtotal) from public.lineas_con_costo(c, m.mes, (m.mes + interval '1 month - 1 day')::date) l
                                         where l.costo is not null), 0),
             'costo', coalesce((select round(sum(l.costo)) from public.lineas_con_costo(c, m.mes, (m.mes + interval '1 month - 1 day')::date) l
                                where l.costo is not null), 0),
             'gastos', coalesce((select sum(x.monto) from public.gastos_mes x where x.comercio_id = c and x.mes = m.mes), 0))
           order by m.mes)
    from (select g::date as mes from generate_series(d::timestamp, h::timestamp, interval '1 month') g) m);
end;
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('registrar_venta', 'anular_venta', 'listar_stock', 'ingreso_stock', 'ajustar_stock', 'dejar_stock',
        'movimientos_de_stock', 'leer_gastos', 'guardar_gasto', 'archivar_gasto', 'guardar_gastos_mes', 'resultado_meses')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Uso interno: la app no las llama.
revoke all on function public.mover_stock_de_venta(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.items_stock_validos(uuid, jsonb, boolean) from public, anon, authenticated;
