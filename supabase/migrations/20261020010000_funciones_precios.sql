-- ListaMatch v2 · Fase 7: funciones que usa la app para la sección Precios.
--
-- La app lee y escribe sólo por estas funciones (RPC). Corren con los permisos de quien llama
-- (security invoker), así que las reglas de acceso (RLS) de la migración base se aplican igual:
-- un empleado que llame a una de estas funciones no ve ni cambia nada.
-- Cada función es una transacción: si algo falla, no queda nada a medias.
--
-- Las filas viajan como JSON con los nombres de columna de la base (snake_case); la app los pasa a camelCase.
-- Los errores que ve el comerciante salen de acá con un texto en castellano.

-- ---------------------------------------------------------------------------------------------
-- Sesión y configuración
-- ---------------------------------------------------------------------------------------------

-- Los comercios de quien inició sesión, con su rol en cada uno.
create function public.mis_comercios() returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', co.id, 'nombre', co.nombre, 'rol', m.rol) order by co.creado), '[]'::jsonb)
  from public.miembros m join public.comercios co on co.id = m.comercio_id
  where m.usuario_id = auth.uid()
$$;

-- Configuración del comercio (sólo el admin la ve; para un empleado devuelve null).
create function public.leer_config(c uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select jsonb_build_object(
    'nombreComercio', co.nombre,
    'recargoGeneral', cf.recargo_general,
    'redondeo', cf.redondeo,
    'ventaIncluyeIva', cf.venta_incluye_iva,
    'ivaDefault', cf.iva_default)
  from public.comercios co join public.config_comercio cf on cf.comercio_id = co.id
  where co.id = c
$$;

create function public.guardar_config(c uuid, config jsonb) returns void
language plpgsql set search_path = ''
as $$
begin
  update public.config_comercio set
    recargo_general = (config ->> 'recargoGeneral')::integer,
    redondeo = config -> 'redondeo',
    venta_incluye_iva = (config ->> 'ventaIncluyeIva')::boolean,
    iva_default = (config ->> 'ivaDefault')::integer,
    actualizado = now()
  where comercio_id = c;
  if not found then
    raise exception 'No tenés permiso para cambiar la configuración de este comercio.';
  end if;
  update public.comercios set nombre = btrim(regexp_replace(config ->> 'nombreComercio', '\s+', ' ', 'g')) where id = c;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Rubros
-- ---------------------------------------------------------------------------------------------

create function public.listar_rubros(c uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(r) - 'comercio_id' order by lower(r.nombre)), '[]'::jsonb)
  from public.rubros r where r.comercio_id = c
$$;

create function public.guardar_rubro(c uuid, id uuid, nombre text, recargo_pct integer) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  fila public.rubros;
begin
  if guardar_rubro.id is null then
    insert into public.rubros (comercio_id, nombre, recargo_pct)
    values (c, guardar_rubro.nombre, guardar_rubro.recargo_pct) returning * into fila;
  else
    update public.rubros r set nombre = guardar_rubro.nombre, recargo_pct = guardar_rubro.recargo_pct
    where r.id = guardar_rubro.id and r.comercio_id = c returning * into fila;
    if not found then raise exception 'No encontramos el rubro.'; end if;
  end if;
  return to_jsonb(fila) - 'comercio_id';
exception when unique_violation then
  raise exception 'Ya existe el rubro %.', guardar_rubro.nombre;
end;
$$;

-- Sus productos quedan sin rubro (lo hace la clave foránea).
create function public.borrar_rubro(c uuid, id uuid) returns void
language sql set search_path = ''
as $$
  delete from public.rubros r where r.id = borrar_rubro.id and r.comercio_id = c
$$;

-- ---------------------------------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------------------------------

create function public.listar_proveedores(c uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(p) - 'comercio_id' order by lower(p.nombre)), '[]'::jsonb)
  from public.proveedores p where p.comercio_id = c
$$;

-- Si ya hay uno con el mismo nombre (sin importar mayúsculas), devuelve ese.
create function public.crear_proveedor(c uuid, nombre text, lista_incluye_iva boolean) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  fila public.proveedores;
begin
  select * into fila from public.proveedores p where p.comercio_id = c and lower(p.nombre) = lower(crear_proveedor.nombre);
  if not found then
    insert into public.proveedores (comercio_id, nombre, lista_incluye_iva)
    values (c, crear_proveedor.nombre, crear_proveedor.lista_incluye_iva) returning * into fila;
  end if;
  return to_jsonb(fila) - 'comercio_id';
end;
$$;

create function public.actualizar_proveedor(c uuid, id uuid, nombre text, lista_incluye_iva boolean, descuentos_pct jsonb) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  fila public.proveedores;
begin
  update public.proveedores p set
    nombre = actualizar_proveedor.nombre,
    lista_incluye_iva = actualizar_proveedor.lista_incluye_iva,
    descuentos_pct = array(select jsonb_array_elements_text(actualizar_proveedor.descuentos_pct)::integer)
  where p.id = actualizar_proveedor.id and p.comercio_id = c returning * into fila;
  if not found then raise exception 'No encontramos el proveedor.'; end if;
  return to_jsonb(fila) - 'comercio_id';
exception when unique_violation then
  raise exception 'Ya existe el proveedor %.', actualizar_proveedor.nombre;
end;
$$;

-- Recuerda (o, con null, olvida) las columnas de su lista y si sus precios traen IVA.
create function public.guardar_lectura_proveedor(c uuid, id uuid, mapeo_columnas jsonb, lista_incluye_iva boolean default null) returns void
language plpgsql set search_path = ''
as $$
begin
  update public.proveedores p set
    mapeo_columnas = guardar_lectura_proveedor.mapeo_columnas,
    lista_incluye_iva = coalesce(guardar_lectura_proveedor.lista_incluye_iva, p.lista_incluye_iva)
  where p.id = guardar_lectura_proveedor.id and p.comercio_id = c;
  if not found then raise exception 'No encontramos el proveedor.'; end if;
end;
$$;

-- Se lleva sus vínculos e importaciones (claves foráneas); los productos del catálogo quedan.
create function public.borrar_proveedor(c uuid, id uuid) returns void
language sql set search_path = ''
as $$
  delete from public.proveedores p where p.id = borrar_proveedor.id and p.comercio_id = c
$$;

-- ---------------------------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------------------------

-- Todo el catálogo en un solo valor (una función que devuelve filas tiene un tope de 1000 en Supabase).
create function public.listar_productos(c uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(to_jsonb(p) - 'comercio_id' order by p.descripcion), '[]'::jsonb)
  from public.productos p where p.comercio_id = c
$$;

-- Texto para un código repetido: "El código P0001 ya es de Yerba 1 kg."
create function public.mensaje_codigo_repetido(c uuid, restriccion text, datos jsonb) returns text
language plpgsql stable set search_path = ''
as $$
declare
  otro text;
begin
  if restriccion = 'productos_barras' then
    select p.descripcion into otro from public.productos p where p.comercio_id = c and p.codigo_barras = datos ->> 'codigo_barras';
    return format('El código de barras %s ya es de %s.', datos ->> 'codigo_barras', coalesce(otro, 'otro producto'));
  end if;
  select p.descripcion into otro from public.productos p
  where p.comercio_id = c and lower(p.codigo_interno) = lower(datos ->> 'codigo_interno');
  return format('El código %s ya es de %s.', datos ->> 'codigo_interno', coalesce(otro, 'otro producto'));
end;
$$;

-- Crea (id null) o edita un producto. `datos`: las columnas del producto, sin id ni comercio.
create function public.guardar_producto(c uuid, id uuid, datos jsonb) returns jsonb
language plpgsql set search_path = ''
as $$
declare
  fila public.productos;
  nuevo public.productos := jsonb_populate_record(null::public.productos, datos);
  restriccion text;
begin
  if guardar_producto.id is null then
    insert into public.productos (comercio_id, codigo_interno, codigo_barras, descripcion, descripcion_normalizada,
                                  rubro_id, recargo_pct, iva_pct, costo_actual, precio_venta_actual)
    values (c, nuevo.codigo_interno, nuevo.codigo_barras, nuevo.descripcion, nuevo.descripcion_normalizada,
            nuevo.rubro_id, nuevo.recargo_pct, nuevo.iva_pct, nuevo.costo_actual, nuevo.precio_venta_actual)
    returning * into fila;
  else
    update public.productos p set
      codigo_interno = nuevo.codigo_interno,
      -- Si la app no manda el código de barras, queda el que tenía.
      codigo_barras = case when datos ? 'codigo_barras' then nuevo.codigo_barras else p.codigo_barras end,
      descripcion = nuevo.descripcion,
      descripcion_normalizada = nuevo.descripcion_normalizada, rubro_id = nuevo.rubro_id, recargo_pct = nuevo.recargo_pct,
      iva_pct = nuevo.iva_pct, costo_actual = nuevo.costo_actual, precio_venta_actual = nuevo.precio_venta_actual,
      actualizado = now()
    where p.id = guardar_producto.id and p.comercio_id = c returning * into fila;
    if not found then raise exception 'No encontramos el producto.'; end if;
  end if;
  return to_jsonb(fila) - 'comercio_id';
exception
  when unique_violation then
    get stacked diagnostics restriccion = constraint_name;
    raise exception '%', public.mensaje_codigo_repetido(c, restriccion, datos);
  when foreign_key_violation then
    raise exception 'No encontramos el rubro.';
end;
$$;

-- Se lleva sus vínculos con las listas (clave foránea).
create function public.borrar_producto(c uuid, id uuid) returns void
language sql set search_path = ''
as $$
  delete from public.productos p where p.id = borrar_producto.id and p.comercio_id = c
$$;

-- Importar el catálogo: crea los rubros nuevos y crea o actualiza los productos, todo junto.
-- La app ya decidió qué va (F03); `rubros` y `productos` son filas completas, con su id.
create function public.importar_catalogo(c uuid, rubros jsonb, productos jsonb) returns void
language plpgsql set search_path = ''
as $$
begin
  insert into public.rubros (id, comercio_id, nombre, recargo_pct)
  select r.id, c, r.nombre, r.recargo_pct
  from jsonb_populate_recordset(null::public.rubros, rubros) r;

  insert into public.productos (id, comercio_id, codigo_interno, codigo_barras, descripcion, descripcion_normalizada,
                                rubro_id, recargo_pct, iva_pct, costo_actual, precio_venta_actual, actualizado)
  select p.id, c, p.codigo_interno, p.codigo_barras, p.descripcion, p.descripcion_normalizada,
         p.rubro_id, p.recargo_pct, p.iva_pct, p.costo_actual, p.precio_venta_actual, now()
  from jsonb_populate_recordset(null::public.productos, productos) p
  on conflict (id) do update set
    codigo_interno = excluded.codigo_interno, descripcion = excluded.descripcion,
    descripcion_normalizada = excluded.descripcion_normalizada, rubro_id = excluded.rubro_id,
    iva_pct = excluded.iva_pct, costo_actual = excluded.costo_actual,
    precio_venta_actual = excluded.precio_venta_actual, actualizado = now()
  where public.productos.comercio_id = c;
exception when unique_violation then
  raise exception 'Hay un código repetido en el archivo o en el catálogo. No se importó nada.';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Vínculos con las listas de los proveedores (F07)
-- ---------------------------------------------------------------------------------------------

-- Clave de la línea → producto.
create function public.vinculos_de_proveedor(c uuid, proveedor uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_object_agg(v.codigo_proveedor, v.producto_id), '{}'::jsonb)
  from public.vinculos v where v.comercio_id = c and v.proveedor_id = proveedor and v.confirmado
$$;

-- Guarda o cambia vínculos: [{codigo_proveedor, descripcion_proveedor, producto_id}].
create function public.guardar_vinculos(c uuid, proveedor uuid, vinculos jsonb) returns void
language sql set search_path = ''
as $$
  insert into public.vinculos (comercio_id, proveedor_id, codigo_proveedor, descripcion_proveedor, producto_id, confirmado)
  select c, proveedor, v.codigo_proveedor, v.descripcion_proveedor, v.producto_id, true
  from jsonb_populate_recordset(null::public.vinculos, vinculos) v
  on conflict (proveedor_id, codigo_proveedor) do update set
    descripcion_proveedor = excluded.descripcion_proveedor, producto_id = excluded.producto_id, confirmado = true
$$;

-- Alta en el catálogo de lo que trae la lista, ya vinculado al proveedor. Todo junto.
create function public.alta_desde_lista(c uuid, proveedor uuid, productos jsonb, vinculos jsonb) returns void
language plpgsql set search_path = ''
as $$
begin
  perform public.importar_catalogo(c, '[]'::jsonb, productos);
  perform public.guardar_vinculos(c, proveedor, vinculos);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Revisión de precios (F09)
-- ---------------------------------------------------------------------------------------------

-- Guarda lo que aprobó el comerciante: el único lugar que cambia precios a partir de una lista.
-- `aprobados`: [{producto_id, costo, precio}]. `lineas`: las líneas de la importación.
-- Devuelve el id de la importación.
create function public.aplicar_revision(
  c uuid, proveedor uuid, archivo text, total_lineas integer, vinculadas integer, aprobados jsonb, lineas jsonb
) returns uuid
language plpgsql set search_path = ''
as $$
declare
  importacion uuid;
  cambiados integer;
begin
  if exists (
    select 1 from jsonb_array_elements(aprobados) a
    where jsonb_typeof(a -> 'precio') <> 'number' or (a ->> 'precio')::numeric <= 0
       or (a ->> 'precio')::numeric <> trunc((a ->> 'precio')::numeric)
  ) then
    raise exception 'Hay un precio que no es válido. Revisalo antes de guardar.';
  end if;

  update public.productos p set costo_actual = (a ->> 'costo')::bigint, precio_venta_actual = (a ->> 'precio')::bigint, actualizado = now()
  from jsonb_array_elements(aprobados) a
  where p.comercio_id = c and p.id = (a ->> 'producto_id')::uuid;
  get diagnostics cambiados = row_count;
  if cambiados <> jsonb_array_length(aprobados) then
    raise exception 'Algún producto ya no está en el catálogo. Volvé a subir la lista.';
  end if;

  insert into public.historial_precios (comercio_id, producto_id, proveedor_id, costo, precio_venta)
  select c, (a ->> 'producto_id')::uuid, proveedor, (a ->> 'costo')::bigint, (a ->> 'precio')::bigint
  from jsonb_array_elements(aprobados) a;

  insert into public.importaciones (comercio_id, proveedor_id, archivo_nombre, total_lineas, vinculadas, estado)
  values (c, proveedor, archivo, total_lineas, vinculadas, 'aprobada') returning id into importacion;

  insert into public.lineas_importacion (comercio_id, importacion_id, fila_origen, codigo, descripcion, costo, producto_id,
                                         costo_anterior, precio_sugerido, precio_final, variacion_pct, estado)
  select c, importacion, l.fila_origen, l.codigo, l.descripcion, l.costo, l.producto_id,
         l.costo_anterior, l.precio_sugerido, l.precio_final, l.variacion_pct, l.estado
  from jsonb_populate_recordset(null::public.lineas_importacion, lineas) l;

  return importacion;
end;
$$;

-- Productos a los que les cambió el precio en la última lista revisada (para sus etiquetas).
create function public.productos_ultima_revision(c uuid) returns jsonb
language sql stable set search_path = ''
as $$
  select coalesce(jsonb_agg(l.producto_id order by l.fila_origen), '[]'::jsonb)
  from public.lineas_importacion l
  where l.estado = 'aprobada' and l.producto_id is not null
    and l.importacion_id = (
      select i.id from public.importaciones i
      where i.comercio_id = c and i.estado = 'aprobada'
      order by i.fecha desc limit 1)
$$;

-- ---------------------------------------------------------------------------------------------
-- Datos de la versión anterior (copia de seguridad de la v1)
-- ---------------------------------------------------------------------------------------------

-- Reemplaza la sección Precios del comercio por lo que trae la copia (la app ya pasó los ids a uuid).
-- `datos`: {config, rubros, proveedores, productos, vinculos, importaciones, lineas_importacion, historial_precios}.
create function public.importar_respaldo(c uuid, datos jsonb) returns void
language plpgsql set search_path = ''
as $$
begin
  if not public.es_admin(c) then
    raise exception 'Sólo el dueño del comercio puede traer los datos de la versión anterior.';
  end if;
  delete from public.proveedores where comercio_id = c;
  delete from public.productos where comercio_id = c;
  delete from public.rubros where comercio_id = c;

  perform public.guardar_config(c, datos -> 'config');

  insert into public.rubros
  select (jsonb_populate_record(null::public.rubros, e || jsonb_build_object('comercio_id', c))).*
  from jsonb_array_elements(datos -> 'rubros') e;
  insert into public.proveedores
  select (jsonb_populate_record(null::public.proveedores, e || jsonb_build_object('comercio_id', c))).*
  from jsonb_array_elements(datos -> 'proveedores') e;
  insert into public.productos
  select (jsonb_populate_record(null::public.productos, e || jsonb_build_object('comercio_id', c))).*
  from jsonb_array_elements(datos -> 'productos') e;
  insert into public.vinculos
  select (jsonb_populate_record(null::public.vinculos, e || jsonb_build_object('comercio_id', c))).*
  from jsonb_array_elements(datos -> 'vinculos') e;
  insert into public.importaciones
  select (jsonb_populate_record(null::public.importaciones, e || jsonb_build_object('comercio_id', c))).*
  from jsonb_array_elements(datos -> 'importaciones') e;
  insert into public.lineas_importacion
  select (jsonb_populate_record(null::public.lineas_importacion, e || jsonb_build_object('comercio_id', c))).*
  from jsonb_array_elements(datos -> 'lineas_importacion') e;
  insert into public.historial_precios
  select (jsonb_populate_record(null::public.historial_precios, e || jsonb_build_object('comercio_id', c))).*
  from jsonb_array_elements(datos -> 'historial_precios') e;
end;
$$;

-- Sólo con sesión.
do $$
declare
  f regprocedure;
begin
  for f in
    select p.oid::regprocedure from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('mis_comercios', 'leer_config', 'guardar_config', 'listar_rubros', 'guardar_rubro', 'borrar_rubro',
        'listar_proveedores', 'crear_proveedor', 'actualizar_proveedor', 'guardar_lectura_proveedor', 'borrar_proveedor',
        'listar_productos', 'mensaje_codigo_repetido', 'guardar_producto', 'borrar_producto', 'importar_catalogo',
        'vinculos_de_proveedor', 'guardar_vinculos', 'alta_desde_lista', 'aplicar_revision', 'productos_ultima_revision',
        'importar_respaldo')
  loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end;
$$;
