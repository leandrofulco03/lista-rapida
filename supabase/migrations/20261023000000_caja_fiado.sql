-- Vendia v2 · Fase 10 (primera parte): fiado y arqueo de caja.
--
-- Fiado: una venta con medio de pago "fiado" queda a cuenta de un cliente. Cualquier miembro vende fiado (también
-- sin conexión: el cliente nuevo lo crea el dispositivo con su id); ver saldos, cobrar y poner límites es del dueño.
-- Saldo de un cliente = ventas fiadas (sin anular) − pagos (sin anular). Negativo = tiene a favor.
--
-- Caja: un arqueo por día. Se abre con lo que hay en el cajón, se anotan entradas y salidas de efectivo y al cerrar
-- se cuenta. Esperado = apertura + ventas en efectivo + pagos de fiado en efectivo + entradas − salidas.
-- El empleado abre, anota y cierra la caja de hoy, pero no ve el esperado ni la diferencia (cuenta "a ciegas").

-- ---------------------------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------------------------

create table public.clientes (
  id uuid primary key,
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) between 1 and 80),
  telefono text check (telefono is null or length(telefono) <= 30),
  -- Hasta cuánto se le fía; null = sin límite.
  limite bigint check (limite is null or limite > 0),
  nota text check (nota is null or length(nota) <= 200),
  archivado boolean not null default false,
  creado timestamptz not null default now(),
  creado_por uuid references auth.users (id) on delete set null,
  unique (comercio_id, id)
);
-- Dos clientes activos no se llaman igual (se confundirían al elegir).
create unique index clientes_nombre on public.clientes (comercio_id, lower(btrim(nombre))) where not archivado;

alter table public.ventas drop constraint ventas_medio_pago_check;
alter table public.ventas add constraint ventas_medio_pago_check
  check (medio_pago in ('efectivo', 'debito', 'credito', 'qr', 'transferencia', 'fiado'));
alter table public.ventas add column cliente_id uuid;
alter table public.ventas add constraint ventas_cliente
  foreign key (comercio_id, cliente_id) references public.clientes (comercio_id, id);
-- Fiado lleva cliente, y sólo el fiado lleva cliente.
alter table public.ventas add constraint ventas_fiado_con_cliente check ((medio_pago = 'fiado') = (cliente_id is not null));
create index ventas_cliente on public.ventas (comercio_id, cliente_id) where cliente_id is not null;

create table public.pagos_fiado (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  cliente_id uuid not null,
  fecha timestamptz not null default now(),
  dia date not null,
  monto bigint not null check (monto > 0),
  medio_pago text not null check (medio_pago in ('efectivo', 'debito', 'credito', 'qr', 'transferencia')),
  nota text check (nota is null or length(nota) <= 200),
  usuario_id uuid references auth.users (id) on delete set null,
  anulado_en timestamptz,
  anulado_por uuid references auth.users (id) on delete set null,
  foreign key (comercio_id, cliente_id) references public.clientes (comercio_id, id) on delete cascade
);
create index pagos_fiado_cliente on public.pagos_fiado (comercio_id, cliente_id);
create index pagos_fiado_dia on public.pagos_fiado (comercio_id, dia);

create table public.cajas (
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  dia date not null,
  apertura bigint not null check (apertura >= 0),
  abierta_en timestamptz not null default now(),
  abierta_por uuid references auth.users (id) on delete set null,
  -- null mientras no se cerró.
  contado bigint check (contado is null or contado >= 0),
  cerrada_en timestamptz,
  cerrada_por uuid references auth.users (id) on delete set null,
  nota text check (nota is null or length(nota) <= 200),
  primary key (comercio_id, dia)
);

create table public.movimientos_caja (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  dia date not null,
  fecha timestamptz not null default now(),
  tipo text not null check (tipo in ('entrada', 'salida')),
  monto bigint not null check (monto > 0),
  motivo text not null check (length(btrim(motivo)) between 1 and 80),
  usuario_id uuid references auth.users (id) on delete set null,
  anulado_en timestamptz,
  foreign key (comercio_id, dia) references public.cajas (comercio_id, dia) on delete cascade
);
create index movimientos_caja_dia on public.movimientos_caja (comercio_id, dia);

-- Nadie las lee ni las escribe directo: sólo por las funciones de abajo, que controlan quién llama.
alter table public.clientes enable row level security;
alter table public.pagos_fiado enable row level security;
alter table public.cajas enable row level security;
alter table public.movimientos_caja enable row level security;
revoke all on public.clientes, public.pagos_fiado, public.cajas, public.movimientos_caja from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Vender fiado
-- ---------------------------------------------------------------------------------------------

-- Saldo de un cliente (uso interno).
create function public.saldo_cliente(c uuid, cliente uuid) returns bigint
language sql stable set search_path = ''
as $$
  select coalesce((select sum(v.total) from public.ventas v
                   where v.comercio_id = c and v.cliente_id = cliente and v.anulada_en is null), 0)
       - coalesce((select sum(p.monto) from public.pagos_fiado p
                   where p.comercio_id = c and p.cliente_id = cliente and p.anulado_en is null), 0)
$$;

-- Clientes para elegir al vender fiado (cualquier miembro): sin saldo ni teléfono, sólo cuánto más se le puede fiar.
create function public.clientes_para_vender(c uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_miembro(c) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', k.id, 'nombre', k.nombre,
             'disponible', case when k.limite is not null then k.limite - public.saldo_cliente(c, k.id) end)
           order by lower(k.nombre))
    from public.clientes k where k.comercio_id = c and not k.archivado), '[]'::jsonb);
end;
$$;

-- Guarda un ticket: {id, fecha, medioPago, lineas: [...], cliente?: {id, nombre}}.
-- Con "fiado", el cliente es obligatorio. Si su id no existe se crea con ese nombre (lo pudo crear el dispositivo
-- sin conexión); si ya hay un cliente activo con ese nombre, se usa ése.
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
  return jsonb_build_object('id', nuevo_id, 'total', suma, 'dia', public.dia_argentina(momento));
end;
$$;

-- Igual que antes, con el nombre del cliente en las ventas fiadas.
create or replace function public.ventas_del_dia(c uuid, dia date) returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', v.id, 'fecha', v.fecha, 'medioPago', v.medio_pago, 'total', v.total, 'articulos', v.articulos,
           'anulada', v.anulada_en is not null,
           'vendedor', coalesce((select coalesce(nullif(m.nombre, ''), m.email) from public.miembros m
                                 where m.comercio_id = c and m.usuario_id = v.usuario_id), ''),
           'propia', v.usuario_id = auth.uid(),
           'cliente', (select k.nombre from public.clientes k where k.comercio_id = c and k.id = v.cliente_id),
           'lineas', (select coalesce(jsonb_agg(jsonb_build_object(
                        'descripcion', i.descripcion, 'cantidad', i.cantidad, 'precioUnitario', i.precio_unitario,
                        'subtotal', i.subtotal) order by i.descripcion), '[]'::jsonb)
                      from public.venta_items i where i.venta_id = v.id))
         order by v.fecha desc), '[]'::jsonb)
  from public.ventas v
  where v.comercio_id = c and v.dia = ventas_del_dia.dia and v.tipo = 'ticket'
    and (public.es_admin(c) or (v.usuario_id = auth.uid() and public.es_miembro(c)))
$$;

-- ---------------------------------------------------------------------------------------------
-- Clientes y pagos — sólo el dueño
-- ---------------------------------------------------------------------------------------------

create function public.listar_clientes(c uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño ve los clientes.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', x.id, 'nombre', x.nombre, 'telefono', x.telefono, 'limite', x.limite, 'nota', x.nota,
             'archivado', x.archivado, 'saldo', x.saldo, 'ultimoMovimiento', x.ultimo)
           order by x.archivado, x.saldo desc, lower(x.nombre))
    from (
      select k.*, public.saldo_cliente(c, k.id) as saldo,
             greatest((select max(v.fecha) from public.ventas v where v.comercio_id = c and v.cliente_id = k.id and v.anulada_en is null),
                      (select max(p.fecha) from public.pagos_fiado p where p.comercio_id = c and p.cliente_id = k.id and p.anulado_en is null)) as ultimo
      from public.clientes k where k.comercio_id = c
    ) x), '[]'::jsonb);
end;
$$;

-- Alta o cambio: {id, nombre, telefono, limite, nota}.
create function public.guardar_cliente(c uuid, cliente jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  k_id uuid := (cliente ->> 'id')::uuid;
  k_nombre text := left(btrim(regexp_replace(coalesce(cliente ->> 'nombre', ''), '\s+', ' ', 'g')), 80);
  k_limite bigint;
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño carga clientes.'; end if;
  if k_id is null then raise exception 'Cliente no válido.'; end if;
  if k_nombre = '' then raise exception 'Escribí el nombre del cliente.'; end if;
  if cliente -> 'limite' is not null and jsonb_typeof(cliente -> 'limite') <> 'null' then
    if jsonb_typeof(cliente -> 'limite') <> 'number' or (cliente ->> 'limite')::numeric <= 0
       or (cliente ->> 'limite')::numeric <> trunc((cliente ->> 'limite')::numeric) then
      raise exception 'El límite tiene que ser un importe mayor que cero.';
    end if;
    k_limite := (cliente ->> 'limite')::bigint;
  end if;
  if exists (select 1 from public.clientes k where k.id = k_id and k.comercio_id <> c) then
    raise exception 'Cliente no válido.';
  end if;
  if exists (select 1 from public.clientes k where k.comercio_id = c and k.id <> k_id and not k.archivado
             and lower(btrim(k.nombre)) = lower(k_nombre)) then
    raise exception 'Ya hay un cliente que se llama %.', k_nombre;
  end if;
  insert into public.clientes (id, comercio_id, nombre, telefono, limite, nota, creado_por)
  values (k_id, c, k_nombre, nullif(btrim(left(coalesce(cliente ->> 'telefono', ''), 30)), ''), k_limite,
          nullif(btrim(left(coalesce(cliente ->> 'nota', ''), 200)), ''), auth.uid())
  on conflict (id) do update set nombre = excluded.nombre, telefono = excluded.telefono, limite = excluded.limite, nota = excluded.nota;
end;
$$;

-- Archivar saca al cliente de la lista para vender. Con deuda no se archiva.
create function public.archivar_cliente(c uuid, id uuid, archivado boolean) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  k public.clientes;
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño archiva clientes.'; end if;
  select * into k from public.clientes x where x.comercio_id = c and x.id = archivar_cliente.id;
  if not found then raise exception 'No encontramos ese cliente.'; end if;
  if archivado and public.saldo_cliente(c, k.id) > 0 then
    raise exception 'Tiene deuda: cobrala antes de archivarlo.';
  end if;
  if not archivado and exists (select 1 from public.clientes x where x.comercio_id = c and x.id <> k.id and not x.archivado
                               and lower(btrim(x.nombre)) = lower(btrim(k.nombre))) then
    raise exception 'Ya hay otro cliente que se llama %.', k.nombre;
  end if;
  update public.clientes set archivado = archivar_cliente.archivado where clientes.id = k.id;
end;
$$;

-- Ventas fiadas y pagos de un cliente, de lo más nuevo a lo más viejo (los últimos 200).
create function public.movimientos_cliente(c uuid, cliente uuid) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño ve los clientes.'; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.fecha desc)
    from (
      (select 'venta' as tipo, v.id, v.fecha, v.total as monto, null::text as "medioPago", v.anulada_en is not null as anulado,
              (select string_agg(i.descripcion, ', ' order by i.descripcion) from public.venta_items i where i.venta_id = v.id) as detalle
       from public.ventas v where v.comercio_id = c and v.cliente_id = cliente
       order by v.fecha desc limit 200)
      union all
      (select 'pago', p.id, p.fecha, p.monto, p.medio_pago, p.anulado_en is not null, p.nota
       from public.pagos_fiado p where p.comercio_id = c and p.cliente_id = cliente
       order by p.fecha desc limit 200)
    ) x), '[]'::jsonb);
end;
$$;

-- Registra un pago {clienteId, monto, medioPago, nota}. Devuelve el saldo que queda.
create function public.registrar_pago(c uuid, pago jsonb) returns bigint
language plpgsql security definer set search_path = ''
as $$
declare
  cliente uuid := (pago ->> 'clienteId')::uuid;
  medio text := pago ->> 'medioPago';
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño cobra el fiado.'; end if;
  if not exists (select 1 from public.clientes k where k.comercio_id = c and k.id = cliente) then
    raise exception 'No encontramos ese cliente.';
  end if;
  if jsonb_typeof(pago -> 'monto') <> 'number' or (pago ->> 'monto')::numeric <= 0
     or (pago ->> 'monto')::numeric <> trunc((pago ->> 'monto')::numeric) then
    raise exception 'Escribí un importe mayor que cero.';
  end if;
  if medio is null or medio not in ('efectivo', 'debito', 'credito', 'qr', 'transferencia') then
    raise exception 'Elegí cómo pagó.';
  end if;
  insert into public.pagos_fiado (comercio_id, cliente_id, dia, monto, medio_pago, nota, usuario_id)
  values (c, cliente, public.dia_argentina(now()), (pago ->> 'monto')::bigint, medio,
          nullif(btrim(left(coalesce(pago ->> 'nota', ''), 200)), ''), auth.uid());
  return public.saldo_cliente(c, cliente);
end;
$$;

create function public.anular_pago(c uuid, id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño anula pagos.'; end if;
  update public.pagos_fiado p set anulado_en = now(), anulado_por = auth.uid()
  where p.comercio_id = c and p.id = anular_pago.id and p.anulado_en is null;
  if not found then raise exception 'No encontramos ese pago, o ya estaba anulado.'; end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Caja
-- ---------------------------------------------------------------------------------------------

-- Quién puede tocar la caja de un día: el dueño, cualquiera; el empleado, la de hoy.
create function public.puede_tocar_caja(c uuid, dia date) returns boolean
language sql stable set search_path = ''
as $$
  select public.es_admin(c) or (public.es_miembro(c) and dia = public.dia_argentina(now()))
$$;

-- Componentes del esperado (uso interno).
create function public.esperado_caja(c uuid, dia date) returns jsonb
language sql stable set search_path = ''
as $$
  with x as (
    select
      coalesce((select k.apertura from public.cajas k where k.comercio_id = c and k.dia = esperado_caja.dia), 0) as apertura,
      coalesce((select sum(v.total) from public.ventas v where v.comercio_id = c and v.dia = esperado_caja.dia
                and v.medio_pago = 'efectivo' and v.anulada_en is null), 0) as ventas,
      coalesce((select sum(p.monto) from public.pagos_fiado p where p.comercio_id = c and p.dia = esperado_caja.dia
                and p.medio_pago = 'efectivo' and p.anulado_en is null), 0) as pagos,
      coalesce((select sum(m.monto) from public.movimientos_caja m where m.comercio_id = c and m.dia = esperado_caja.dia
                and m.tipo = 'entrada' and m.anulado_en is null), 0) as entradas,
      coalesce((select sum(m.monto) from public.movimientos_caja m where m.comercio_id = c and m.dia = esperado_caja.dia
                and m.tipo = 'salida' and m.anulado_en is null), 0) as salidas
  )
  select jsonb_build_object('apertura', apertura, 'ventasEfectivo', ventas, 'pagosFiadoEfectivo', pagos,
                            'entradas', entradas, 'salidas', salidas,
                            'esperado', apertura + ventas + pagos + entradas - salidas)
  from x
$$;

-- La caja de un día. El esperado y la diferencia, sólo para el dueño.
create function public.leer_caja(c uuid, dia date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  k public.cajas;
  admin boolean := public.es_admin(c);
  esperado jsonb;
begin
  if not public.puede_tocar_caja(c, dia) then raise exception 'Sólo el dueño ve la caja de otros días.'; end if;
  select * into k from public.cajas x where x.comercio_id = c and x.dia = leer_caja.dia;
  if admin then esperado := public.esperado_caja(c, dia); end if;
  return jsonb_build_object(
    'dia', dia,
    'abierta', k.dia is not null,
    'apertura', k.apertura,
    -- Para abrir: lo que se contó al cerrar el último día anterior.
    'aperturaSugerida', (select x.contado from public.cajas x where x.comercio_id = c and x.dia < leer_caja.dia
                         and x.contado is not null order by x.dia desc limit 1),
    'cerrada', k.contado is not null,
    'contado', k.contado,
    'nota', k.nota,
    'cerradaEn', k.cerrada_en,
    'cerradaPor', (select coalesce(nullif(m.nombre, ''), m.email) from public.miembros m
                   where m.comercio_id = c and m.usuario_id = k.cerrada_por),
    'movimientos', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'fecha', m.fecha, 'tipo', m.tipo, 'monto', m.monto, 'motivo', m.motivo,
                                          'propio', m.usuario_id = auth.uid(),
                                          'quien', (select coalesce(nullif(x.nombre, ''), x.email) from public.miembros x
                                                    where x.comercio_id = c and x.usuario_id = m.usuario_id))
                       order by m.fecha)
      from public.movimientos_caja m where m.comercio_id = c and m.dia = leer_caja.dia and m.anulado_en is null), '[]'::jsonb),
    'esperado', esperado,
    'diferencia', case when admin and k.contado is not null then k.contado - (esperado ->> 'esperado')::bigint end
  );
end;
$$;

-- Abre la caja con lo que hay en el cajón, o corrige la apertura mientras no se cerró (el dueño, siempre).
create function public.abrir_caja(c uuid, dia date, apertura bigint) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  k public.cajas;
begin
  if not public.puede_tocar_caja(c, dia) then raise exception 'Sólo el dueño toca la caja de otros días.'; end if;
  if dia > public.dia_argentina(now()) then raise exception 'No se puede abrir un día que todavía no llegó.'; end if;
  if apertura is null or apertura < 0 then raise exception 'Escribí cuánto hay en la caja.'; end if;
  select * into k from public.cajas x where x.comercio_id = c and x.dia = abrir_caja.dia for update;
  if not found then
    insert into public.cajas (comercio_id, dia, apertura, abierta_por) values (c, dia, apertura, auth.uid());
  elsif k.contado is not null and not public.es_admin(c) then
    raise exception 'La caja ya está cerrada. Para cambiarla, pedíselo al dueño.';
  else
    update public.cajas x set apertura = abrir_caja.apertura where x.comercio_id = c and x.dia = abrir_caja.dia;
  end if;
end;
$$;

-- Anota una entrada o salida de efectivo: {tipo, monto, motivo}.
create function public.movimiento_caja(c uuid, dia date, movimiento jsonb) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  k public.cajas;
  tipo text := movimiento ->> 'tipo';
  motivo text := left(btrim(regexp_replace(coalesce(movimiento ->> 'motivo', ''), '\s+', ' ', 'g')), 80);
begin
  if not public.puede_tocar_caja(c, dia) then raise exception 'Sólo el dueño toca la caja de otros días.'; end if;
  select * into k from public.cajas x where x.comercio_id = c and x.dia = movimiento_caja.dia;
  if not found then raise exception 'Primero abrí la caja.'; end if;
  if k.contado is not null and not public.es_admin(c) then
    raise exception 'La caja ya está cerrada. Para cambiarla, pedíselo al dueño.';
  end if;
  if tipo is null or tipo not in ('entrada', 'salida') then raise exception 'Elegí si entra o sale plata.'; end if;
  if jsonb_typeof(movimiento -> 'monto') <> 'number' or (movimiento ->> 'monto')::numeric <= 0
     or (movimiento ->> 'monto')::numeric <> trunc((movimiento ->> 'monto')::numeric) then
    raise exception 'Escribí un importe mayor que cero.';
  end if;
  if motivo = '' then raise exception 'Escribí el motivo (por ejemplo, "pago a proveedor").'; end if;
  insert into public.movimientos_caja (comercio_id, dia, tipo, monto, motivo, usuario_id)
  values (c, dia, tipo, (movimiento ->> 'monto')::bigint, motivo, auth.uid());
end;
$$;

-- Saca un movimiento: el empleado, los suyos de hoy con la caja abierta; el dueño, cualquiera.
create function public.anular_movimiento_caja(c uuid, id uuid) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  m public.movimientos_caja;
  k public.cajas;
begin
  select * into m from public.movimientos_caja x where x.comercio_id = c and x.id = anular_movimiento_caja.id and x.anulado_en is null;
  if not found then raise exception 'No encontramos ese movimiento.'; end if;
  select * into k from public.cajas x where x.comercio_id = c and x.dia = m.dia;
  if not public.es_admin(c) and not (
    public.puede_tocar_caja(c, m.dia) and m.usuario_id = auth.uid() and k.contado is null
  ) then
    raise exception 'Sólo podés sacar tus movimientos de hoy, con la caja abierta.';
  end if;
  update public.movimientos_caja x set anulado_en = now() where x.id = m.id;
end;
$$;

-- Cierra la caja con lo que se contó. Una caja cerrada sólo la vuelve a cerrar el dueño.
create function public.cerrar_caja(c uuid, dia date, contado bigint, nota text default null) returns void
language plpgsql security definer set search_path = ''
as $$
declare
  k public.cajas;
begin
  if not public.puede_tocar_caja(c, dia) then raise exception 'Sólo el dueño toca la caja de otros días.'; end if;
  if contado is null or contado < 0 then raise exception 'Escribí cuánto contaste.'; end if;
  select * into k from public.cajas x where x.comercio_id = c and x.dia = cerrar_caja.dia for update;
  if not found then raise exception 'Primero abrí la caja.'; end if;
  if k.contado is not null and not public.es_admin(c) then
    raise exception 'La caja ya está cerrada. Para cambiarla, pedíselo al dueño.';
  end if;
  update public.cajas x set contado = cerrar_caja.contado, cerrada_en = now(), cerrada_por = auth.uid(),
                             nota = nullif(btrim(left(coalesce(cerrar_caja.nota, ''), 200)), '')
  where x.comercio_id = c and x.dia = cerrar_caja.dia;
end;
$$;

-- Vuelve a abrir una caja cerrada (para anotar algo que faltó). Sólo el dueño.
create function public.reabrir_caja(c uuid, dia date) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño reabre la caja.'; end if;
  update public.cajas x set contado = null, cerrada_en = null, cerrada_por = null
  where x.comercio_id = c and x.dia = reabrir_caja.dia;
end;
$$;

-- Cajas de un período, para ver cómo vienen cerrando. Sólo el dueño.
create function public.historial_cajas(c uuid, desde date, hasta date) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.es_admin(c) then raise exception 'Sólo el dueño ve el historial de caja.'; end if;
  if hasta < desde or hasta - desde > 366 then raise exception 'El período no es válido.'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'dia', k.dia, 'apertura', k.apertura, 'contado', k.contado,
             'esperado', (public.esperado_caja(c, k.dia) ->> 'esperado')::bigint,
             'diferencia', case when k.contado is not null then k.contado - (public.esperado_caja(c, k.dia) ->> 'esperado')::bigint end)
           order by k.dia desc)
    from public.cajas k where k.comercio_id = c and k.dia between desde and hasta), '[]'::jsonb);
end;
$$;

do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('clientes_para_vender', 'registrar_venta', 'ventas_del_dia', 'listar_clientes', 'guardar_cliente',
        'archivar_cliente', 'movimientos_cliente', 'registrar_pago', 'anular_pago', 'leer_caja', 'abrir_caja',
        'movimiento_caja', 'anular_movimiento_caja', 'cerrar_caja', 'reabrir_caja', 'historial_cajas')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;

-- Uso interno: la app no las llama.
revoke all on function public.saldo_cliente(uuid, uuid) from public, anon, authenticated;
revoke all on function public.esperado_caja(uuid, date) from public, anon, authenticated;
revoke all on function public.puede_tocar_caja(uuid, date) from public, anon, authenticated;
