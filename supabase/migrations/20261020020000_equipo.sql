-- ListaMatch v2 · Fase 7: equipo del comercio (dueño y empleados).
-- La tabla de usuarios de Supabase (auth.users) no se lee desde la app, así que cada miembro guarda su email
-- al entrar al comercio, para mostrarlo en la pantalla del equipo.

alter table public.miembros add column email text not null default '';

update public.miembros m set email = coalesce(u.email, '') from auth.users u where u.id = m.usuario_id;

create or replace function public.crear_comercio(nombre text, config jsonb) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  nuevo uuid;
begin
  if auth.uid() is null then
    raise exception 'Iniciá sesión para crear el comercio.';
  end if;
  insert into public.comercios (nombre) values (btrim(regexp_replace(nombre, '\s+', ' ', 'g'))) returning id into nuevo;
  insert into public.miembros (comercio_id, usuario_id, rol, email)
  values (nuevo, auth.uid(), 'admin', coalesce((select u.email from auth.users u where u.id = auth.uid()), ''));
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

create or replace function public.unirse_con_codigo(codigo text, nombre text default '') returns uuid
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
  insert into public.miembros (comercio_id, usuario_id, rol, nombre, email)
  values (inv.comercio_id, auth.uid(), inv.rol, left(btrim(coalesce(unirse_con_codigo.nombre, '')), 60),
          coalesce((select u.email from auth.users u where u.id = auth.uid()), ''));
  update public.invitaciones set usada_por = auth.uid(), usada_en = now() where id = inv.id;
  return inv.comercio_id;
end;
$$;

-- Miembros del comercio y códigos sin usar que no vencieron (los códigos, sólo para el admin).
create function public.listar_equipo(c uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'miembros', coalesce((
      select jsonb_agg(jsonb_build_object('usuarioId', m.usuario_id, 'rol', m.rol, 'nombre', m.nombre, 'email', m.email,
                                          'soyYo', m.usuario_id = auth.uid()) order by m.rol, m.creado)
      from public.miembros m where m.comercio_id = c), '[]'::jsonb),
    'invitaciones', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'codigo', i.codigo, 'rol', i.rol, 'vence', i.vence) order by i.vence)
      from public.invitaciones i where i.comercio_id = c and i.usada_en is null and i.vence > now()), '[]'::jsonb))
$$;

create function public.crear_invitacion(c uuid, rol text default 'empleado') returns jsonb
language sql set search_path = ''
as $$
  insert into public.invitaciones (comercio_id, rol) values (c, crear_invitacion.rol)
  returning jsonb_build_object('id', id, 'codigo', codigo, 'rol', rol, 'vence', vence)
$$;

create function public.anular_invitacion(c uuid, id uuid) returns void
language sql set search_path = ''
as $$
  delete from public.invitaciones i where i.id = anular_invitacion.id and i.comercio_id = c
$$;

-- El admin da de baja a otro miembro (a sí mismo no: lo impide la regla de la tabla).
create function public.quitar_miembro(c uuid, usuario uuid) returns void
language plpgsql set search_path = ''
as $$
begin
  delete from public.miembros m where m.comercio_id = c and m.usuario_id = usuario;
  if not found then
    raise exception 'No se pudo quitar a ese miembro.';
  end if;
end;
$$;

revoke all on function public.listar_equipo(uuid) from public, anon;
revoke all on function public.crear_invitacion(uuid, text) from public, anon;
revoke all on function public.anular_invitacion(uuid, uuid) from public, anon;
revoke all on function public.quitar_miembro(uuid, uuid) from public, anon;
grant execute on function public.listar_equipo(uuid) to authenticated;
grant execute on function public.crear_invitacion(uuid, text) to authenticated;
grant execute on function public.anular_invitacion(uuid, uuid) to authenticated;
grant execute on function public.quitar_miembro(uuid, uuid) to authenticated;
