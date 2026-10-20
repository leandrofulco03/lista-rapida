-- ListaMatch v2 · Fase 7: base en la nube.
-- Comercios, usuarios con rol (admin = dueño, empleado = sólo carga ventas) y la sección Precios.
--
-- Convenciones (las mismas que la app):
--   * Plata en centavos (bigint). Porcentajes en centésimos de punto (3000 = 30%).
--   * Ids uuid: la app puede crearlos sin conexión (ventas en cola) sin chocar entre dispositivos.
--   * Cada tabla lleva comercio_id. Las claves foráneas incluyen comercio_id, así una fila
--     nunca apunta a datos de otro comercio.
--   * Seguridad con RLS: el admin hace todo en su comercio; el empleado no ve costos ni proveedores.
--     Los productos los ve sólo por la vista productos_venta (sin costo ni recargo).

-- ---------------------------------------------------------------------------------------------
-- Comercios y miembros
-- ---------------------------------------------------------------------------------------------

create table public.comercios (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  creado timestamptz not null default now()
);

create table public.miembros (
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  usuario_id uuid not null references auth.users (id) on delete cascade,
  rol text not null check (rol in ('admin', 'empleado')),
  nombre text not null default '' check (char_length(nombre) <= 60),
  creado timestamptz not null default now(),
  primary key (comercio_id, usuario_id)
);
create index miembros_usuario on public.miembros (usuario_id);

-- Funciones de ayuda para las reglas. security definer: leen miembros sin pasar por su propia RLS.
create function public.es_miembro(c uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.miembros m where m.comercio_id = c and m.usuario_id = auth.uid())
$$;

create function public.es_admin(c uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.miembros m where m.comercio_id = c and m.usuario_id = auth.uid() and m.rol = 'admin')
$$;

-- Invitaciones: el admin genera un código y el empleado lo usa una vez al registrarse.
create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  -- 12 letras al azar (48 bits de un uuid v4): no se adivina dentro de los 7 días que dura.
  codigo text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  rol text not null default 'empleado' check (rol in ('admin', 'empleado')),
  creada_por uuid references auth.users (id) on delete set null default auth.uid(),
  vence timestamptz not null default now() + interval '7 days',
  usada_por uuid references auth.users (id) on delete set null,
  usada_en timestamptz
);

-- ---------------------------------------------------------------------------------------------
-- Precios (lo que en la v1 vivía en el navegador)
-- ---------------------------------------------------------------------------------------------

create table public.config_comercio (
  comercio_id uuid primary key references public.comercios (id) on delete cascade,
  recargo_general integer not null check (recargo_general between 0 and 100000),
  -- {"tipo":"multiplo","pesos":10} o {"tipo":"terminado","en":90}
  redondeo jsonb not null,
  venta_incluye_iva boolean not null,
  iva_default integer not null check (iva_default in (1050, 2100)),
  actualizado timestamptz not null default now()
);

create table public.rubros (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  recargo_pct integer check (recargo_pct between 0 and 100000),
  unique (comercio_id, id)
);
create unique index rubros_nombre on public.rubros (comercio_id, lower(nombre));

create table public.proveedores (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) between 1 and 60),
  mapeo_columnas jsonb,
  lista_incluye_iva boolean not null default false,
  descuentos_pct integer[] not null default '{}',
  creado timestamptz not null default now(),
  unique (comercio_id, id)
);
create unique index proveedores_nombre on public.proveedores (comercio_id, lower(nombre));

create table public.productos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null references public.comercios (id) on delete cascade,
  codigo_interno text not null check (char_length(codigo_interno) between 1 and 30),
  codigo_barras text check (codigo_barras ~ '^[0-9]{6,14}$'),
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 200),
  descripcion_normalizada text not null,
  rubro_id uuid,
  recargo_pct integer check (recargo_pct between 0 and 100000),
  iva_pct integer not null check (iva_pct in (1050, 2100)),
  costo_actual bigint not null default 0 check (costo_actual >= 0),
  precio_venta_actual bigint not null default 0 check (precio_venta_actual >= 0),
  actualizado timestamptz not null default now(),
  unique (comercio_id, id),
  foreign key (comercio_id, rubro_id) references public.rubros (comercio_id, id) on delete set null (rubro_id)
);
create unique index productos_codigo on public.productos (comercio_id, lower(codigo_interno));
create unique index productos_barras on public.productos (comercio_id, codigo_barras) where codigo_barras is not null;
create index productos_rubro on public.productos (comercio_id, rubro_id);

create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  proveedor_id uuid not null,
  -- Código de la línea en minúsculas, o "desc:" + la descripción normalizada si la lista no trae códigos.
  codigo_proveedor text not null,
  descripcion_proveedor text not null,
  producto_id uuid not null,
  confirmado boolean not null default true,
  unique (proveedor_id, codigo_proveedor),
  foreign key (comercio_id, proveedor_id) references public.proveedores (comercio_id, id) on delete cascade,
  foreign key (comercio_id, producto_id) references public.productos (comercio_id, id) on delete cascade
);
create index vinculos_producto on public.vinculos (producto_id);

create table public.importaciones (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  proveedor_id uuid not null,
  archivo_nombre text not null,
  fecha timestamptz not null default now(),
  total_lineas integer not null,
  vinculadas integer not null,
  estado text not null check (estado in ('borrador', 'aprobada', 'descartada')),
  unique (comercio_id, id),
  foreign key (comercio_id, proveedor_id) references public.proveedores (comercio_id, id) on delete cascade
);
create index importaciones_fecha on public.importaciones (comercio_id, fecha desc);

create table public.lineas_importacion (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  importacion_id uuid not null,
  fila_origen integer not null,
  codigo text,
  descripcion text not null,
  costo bigint not null,
  producto_id uuid,
  costo_anterior bigint,
  precio_sugerido bigint,
  precio_final bigint,
  variacion_pct integer,
  estado text not null check (estado in ('vinculada', 'dudosa', 'nueva', 'ignorada', 'aprobada')),
  foreign key (comercio_id, importacion_id) references public.importaciones (comercio_id, id) on delete cascade,
  foreign key (comercio_id, producto_id) references public.productos (comercio_id, id) on delete set null (producto_id)
);
create index lineas_por_importacion on public.lineas_importacion (importacion_id);

create table public.historial_precios (
  id uuid primary key default gen_random_uuid(),
  comercio_id uuid not null,
  producto_id uuid not null,
  proveedor_id uuid,
  fecha timestamptz not null default now(),
  costo bigint not null,
  precio_venta bigint not null,
  foreign key (comercio_id, producto_id) references public.productos (comercio_id, id) on delete cascade,
  foreign key (comercio_id, proveedor_id) references public.proveedores (comercio_id, id) on delete set null (proveedor_id)
);
create index historial_producto on public.historial_precios (producto_id, fecha desc);

-- ---------------------------------------------------------------------------------------------
-- Reglas de acceso (RLS)
-- ---------------------------------------------------------------------------------------------

alter table public.comercios enable row level security;
alter table public.miembros enable row level security;
alter table public.invitaciones enable row level security;
alter table public.config_comercio enable row level security;
alter table public.rubros enable row level security;
alter table public.proveedores enable row level security;
alter table public.productos enable row level security;
alter table public.vinculos enable row level security;
alter table public.importaciones enable row level security;
alter table public.lineas_importacion enable row level security;
alter table public.historial_precios enable row level security;

-- Nadie sin sesión toca nada. Los comercios y los miembros se crean sólo por las funciones de abajo.
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
grant select, update on public.comercios to authenticated;
grant select, delete on public.miembros to authenticated;
grant update (rol, nombre) on public.miembros to authenticated;
grant select, insert, delete on public.invitaciones to authenticated;
grant select, insert, update, delete on
  public.config_comercio, public.rubros, public.proveedores, public.productos, public.vinculos,
  public.importaciones, public.lineas_importacion, public.historial_precios
  to authenticated;

create policy ver on public.comercios for select to authenticated using (public.es_miembro(id));
create policy editar on public.comercios for update to authenticated using (public.es_admin(id)) with check (public.es_admin(id));

-- Los miembros ven a su equipo; el admin cambia roles y da de baja, pero no a sí mismo
-- (así un comercio nunca se queda sin dueño por error).
create policy ver on public.miembros for select to authenticated using (public.es_miembro(comercio_id));
create policy editar on public.miembros for update to authenticated
  using (public.es_admin(comercio_id) and usuario_id <> auth.uid())
  with check (public.es_admin(comercio_id) and usuario_id <> auth.uid());
create policy borrar on public.miembros for delete to authenticated
  using (public.es_admin(comercio_id) and usuario_id <> auth.uid());

create policy admin on public.invitaciones for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));

-- Sección Precios: sólo el admin.
create policy admin on public.config_comercio for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
create policy admin on public.rubros for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
create policy admin on public.proveedores for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
create policy admin on public.productos for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
create policy admin on public.vinculos for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
create policy admin on public.importaciones for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
create policy admin on public.lineas_importacion for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));
create policy admin on public.historial_precios for all to authenticated
  using (public.es_admin(comercio_id)) with check (public.es_admin(comercio_id));

-- Lo que cualquier miembro necesita para vender: sin costo, recargo ni proveedor.
-- La vista corre con los permisos de su dueño (saltea la RLS de productos) y filtra por miembro.
create view public.productos_venta with (security_barrier = true) as
  select p.id, p.comercio_id, p.codigo_interno, p.codigo_barras, p.descripcion, p.descripcion_normalizada,
         p.rubro_id, p.precio_venta_actual
  from public.productos p
  where public.es_miembro(p.comercio_id);
-- Sólo lectura: una vista simple acepta escrituras, y por ella un empleado podría cambiar precios.
revoke all on public.productos_venta from public, anon, authenticated;
grant select on public.productos_venta to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Funciones que la app llama (RPC)
-- ---------------------------------------------------------------------------------------------

-- Alta de un comercio nuevo: quien lo crea queda como admin, con su configuración.
create function public.crear_comercio(nombre text, config jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  nuevo uuid;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para crear el comercio.';
  end if;
  insert into public.comercios (nombre) values (btrim(regexp_replace(nombre, '\s+', ' ', 'g'))) returning id into nuevo;
  insert into public.miembros (comercio_id, usuario_id, rol) values (nuevo, auth.uid(), 'admin');
  insert into public.config_comercio (comercio_id, recargo_general, redondeo, venta_incluye_iva, iva_default)
  values (
    nuevo,
    (config ->> 'recargoGeneral')::integer,
    config -> 'redondeo',
    (config ->> 'ventaIncluyeIva')::boolean,
    (config ->> 'ivaDefault')::integer
  );
  return nuevo;
end;
$$;

-- Un usuario entra a un comercio con el código que le pasó el admin.
create function public.unirse_con_codigo(codigo text, nombre text default '') returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  inv public.invitaciones;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para usar el código.';
  end if;
  select * into inv from public.invitaciones i
  where i.codigo = upper(btrim(unirse_con_codigo.codigo))
  for update;
  if not found or inv.usada_en is not null or inv.vence < now() then
    raise exception 'El código no es válido o ya venció. Pedile uno nuevo al dueño del comercio.';
  end if;
  if exists (select 1 from public.miembros m where m.comercio_id = inv.comercio_id and m.usuario_id = auth.uid()) then
    raise exception 'Ya sos parte de este comercio.';
  end if;
  insert into public.miembros (comercio_id, usuario_id, rol, nombre)
  values (inv.comercio_id, auth.uid(), inv.rol, left(btrim(coalesce(unirse_con_codigo.nombre, '')), 60));
  update public.invitaciones set usada_por = auth.uid(), usada_en = now() where id = inv.id;
  return inv.comercio_id;
end;
$$;

revoke all on function public.crear_comercio(text, jsonb) from public, anon;
revoke all on function public.unirse_con_codigo(text, text) from public, anon;
grant execute on function public.crear_comercio(text, jsonb) to authenticated;
grant execute on function public.unirse_con_codigo(text, text) to authenticated;
grant execute on function public.es_miembro(uuid) to authenticated;
grant execute on function public.es_admin(uuid) to authenticated;
