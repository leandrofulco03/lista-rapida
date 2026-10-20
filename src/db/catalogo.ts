import { normalizarProducto, planearAltas, siguienteCodigo, validarProducto } from '../domain/catalogo';
import type { DatosProducto, LineaAlta, ProductoArchivo } from '../domain/catalogo';
import type { ConfigComercio } from '../domain/config';
import type { Porcentaje } from '../domain/dinero';
import type { Id } from '../domain/id';
import { calcularPrecioVenta, RECARGO_MAXIMO } from '../domain/precio';
import { resolverRecargo } from '../domain/recargo';
import { normalizarTexto } from '../domain/texto';
import { claveVinculo, normalizarDescripcion } from '../domain/vinculacion';
import { aFila, deFila, deFilas } from './filas';
import type { Producto, Rubro, Sesion } from './tipos';

/**
 * F03: catálogo propio del comercio (productos y rubros).
 * La descripción normalizada (con unidades unificadas) se guarda para buscar y para vincular con las listas (F07).
 */

export const LARGO_MAXIMO_RUBRO = 40;

const clave = (texto: string) => texto.trim().toLowerCase();
const nuevoId = (): Id => crypto.randomUUID();

export async function listarRubros(s: Sesion): Promise<Rubro[]> {
  return deFilas<Rubro>(await s.backend.rpc('listar_rubros', { c: s.comercioId }));
}

/** Crea o edita un rubro. El nombre no se repite (sin importar mayúsculas ni acentos). */
export async function guardarRubro(s: Sesion, datos: { nombre: string; recargoPct: Porcentaje | null }, id?: Id): Promise<Rubro> {
  const nombre = datos.nombre.replace(/\s+/g, ' ').trim();
  if (nombre === '') throw new Error('Escribí el nombre del rubro.');
  if (nombre.length > LARGO_MAXIMO_RUBRO) throw new Error(`El nombre puede tener hasta ${LARGO_MAXIMO_RUBRO} letras.`);
  if (datos.recargoPct !== null && (!Number.isSafeInteger(datos.recargoPct) || datos.recargoPct < 0 || datos.recargoPct > RECARGO_MAXIMO)) {
    throw new Error('Poné un recargo entre 0% y 1000%, o dejalo vacío.');
  }
  const repetido = (await listarRubros(s)).find((r) => r.id !== id && normalizarTexto(r.nombre) === normalizarTexto(nombre));
  if (repetido) throw new Error(`Ya existe el rubro ${repetido.nombre}.`);
  const fila = await s.backend.rpc<Record<string, unknown>>('guardar_rubro', {
    c: s.comercioId,
    id: id ?? null,
    nombre,
    recargo_pct: datos.recargoPct,
  });
  return deFila<Rubro>(fila);
}

/** Borra el rubro; sus productos quedan sin rubro (usan el recargo general o el propio). */
export async function borrarRubro(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('borrar_rubro', { c: s.comercioId, id });
}

export async function listarProductos(s: Sesion): Promise<Producto[]> {
  const productos = deFilas<Producto>(await s.backend.rpc('listar_productos', { c: s.comercioId }));
  return productos.sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
}

/** Busca por código o por palabras de la descripción ("yerba 1 kg" encuentra "Yerba mate Playadito 1 kg"). */
export function filtrarProductos(productos: readonly Producto[], busqueda: string): Producto[] {
  const palabras = normalizarDescripcion(busqueda).split(' ').filter(Boolean);
  if (palabras.length === 0) return [...productos];
  return productos.filter((p) => {
    const texto = `${p.codigoInterno.toLowerCase()} ${p.codigoBarras ?? ''} ${p.descripcionNormalizada}`;
    return palabras.every((palabra) => texto.includes(palabra));
  });
}

/** Lo que se manda a la base de un producto (sin id, comercio ni fecha). */
function filaProducto(datos: DatosProducto): Record<string, unknown> {
  const { codigoBarras, ...resto } = datos;
  const fila = aFila({ ...resto, descripcionNormalizada: normalizarDescripcion(datos.descripcion) });
  // Sin código de barras en los datos, la base deja el que tenía.
  if (codigoBarras !== undefined) fila.codigo_barras = codigoBarras;
  return fila;
}

/** Crea o edita un producto. Lanza un error con el primer problema si no es válido o el código ya existe. */
export async function guardarProducto(s: Sesion, datos: DatosProducto, id?: Id): Promise<Producto> {
  const limpio = normalizarProducto(datos);
  const errores = Object.values(validarProducto(limpio));
  if (errores.length > 0) throw new Error(errores[0]);
  const fila = await s.backend.rpc<Record<string, unknown>>('guardar_producto', {
    c: s.comercioId,
    id: id ?? null,
    datos: filaProducto(limpio),
  });
  return deFila<Producto>(fila);
}

/** Borra el producto y sus vínculos con las listas de los proveedores. */
export async function borrarProducto(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('borrar_producto', { c: s.comercioId, id });
}

/** Próximo código automático libre para un producto nuevo. */
export async function proponerCodigo(s: Sesion): Promise<string> {
  const usados = new Set((await listarProductos(s)).map((p) => clave(p.codigoInterno)));
  return siguienteCodigo(usados).codigo;
}

export interface ResultadoImportacionCatalogo {
  creados: number;
  actualizados: number;
  rubrosCreados: number;
}

/**
 * F03: guarda los productos leídos del archivo en el catálogo, todo junto (si algo falla, no se guarda nada).
 * - Un producto que ya existe (mismo código o, si el archivo no trae código, misma descripción) se actualiza.
 * - Los rubros que no existen se crean.
 * - Sin precio de venta en el archivo, se calcula desde el costo con el recargo y el redondeo del
 *   comercio (el costo del catálogo se toma sin IVA); sin costo ni precio, queda en cero.
 * - Sin código, se le da uno automático (P0001, P0002…).
 */
export async function importarCatalogo(
  s: Sesion,
  productos: readonly ProductoArchivo[],
  config: ConfigComercio,
): Promise<ResultadoImportacionCatalogo> {
  const [rubrosActuales, existentes] = await Promise.all([listarRubros(s), listarProductos(s)]);
  const rubros = new Map(rubrosActuales.map((r) => [normalizarTexto(r.nombre), r]));
  const porCodigo = new Map(existentes.map((p) => [clave(p.codigoInterno), p]));
  const porDescripcion = new Map(existentes.map((p) => [p.descripcionNormalizada, p]));
  const usados = new Set([...porCodigo.keys(), ...productos.flatMap((p) => (p.codigo ? [clave(p.codigo)] : []))]);
  let proximoNumero = 1;

  const limpiarRubro = (nombre: string) => nombre.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO_RUBRO);
  const nuevosRubros: Rubro[] = [];
  for (const p of productos) {
    if (!p.rubro) continue;
    const nombre = limpiarRubro(p.rubro);
    const k = normalizarTexto(nombre);
    if (!rubros.has(k)) {
      const rubro = { id: nuevoId(), nombre, recargoPct: null };
      rubros.set(k, rubro);
      nuevosRubros.push(rubro);
    }
  }
  const rubroPara = (nombre: string) => rubros.get(normalizarTexto(limpiarRubro(nombre)))!;
  const recargoDeRubro = new Map([...rubros.values()].map((r) => [r.id, r.recargoPct]));

  const filas: Record<string, unknown>[] = [];
  let actualizados = 0;
  // Un producto del catálogo que aparece dos veces en el archivo se guarda una vez: vale la última.
  const porId = new Map<Id, number>();
  for (const p of productos) {
    const descripcionNormalizada = normalizarDescripcion(p.descripcion);
    const existente = p.codigo ? porCodigo.get(clave(p.codigo)) : porDescripcion.get(descripcionNormalizada);
    const rubroId = p.rubro ? rubroPara(p.rubro).id : (existente?.rubroId ?? null);
    const recargoRubro = rubroId === null ? null : (recargoDeRubro.get(rubroId) ?? null);
    const ivaPct = p.ivaPct ?? existente?.ivaPct ?? config.ivaDefault;
    const costoActual = p.costo ?? existente?.costoActual ?? 0;
    const precioVentaActual =
      p.precioVenta ??
      (p.costo !== null
        ? calcularPrecioVenta({
            costo: p.costo,
            descuentos: [],
            ivaPct,
            listaIncluyeIva: false,
            ventaIncluyeIva: config.ventaIncluyeIva,
            recargo: resolverRecargo({ producto: existente?.recargoPct, rubro: recargoRubro, general: config.recargoGeneral }).recargo,
            redondeo: config.redondeo,
          }).precio
        : (existente?.precioVentaActual ?? 0));

    let codigoInterno = p.codigo ?? existente?.codigoInterno;
    if (!codigoInterno) {
      const siguiente = siguienteCodigo(usados, proximoNumero);
      codigoInterno = siguiente.codigo;
      proximoNumero = siguiente.numero + 1;
      usados.add(clave(codigoInterno));
    }

    const id = existente?.id ?? nuevoId();
    const fila = aFila({
      id,
      codigoInterno,
      codigoBarras: existente?.codigoBarras ?? null,
      descripcion: p.descripcion,
      descripcionNormalizada,
      rubroId,
      recargoPct: existente?.recargoPct ?? null,
      ivaPct,
      costoActual,
      precioVentaActual,
    });
    if (existente) actualizados++;
    const previa = porId.get(id);
    if (previa === undefined) {
      porId.set(id, filas.length);
      filas.push(fila);
    } else {
      filas[previa] = fila;
    }
  }
  await s.backend.rpc('importar_catalogo', { c: s.comercioId, rubros: nuevosRubros.map((r) => aFila(r)), productos: filas });
  return { creados: productos.length - actualizados, actualizados, rubrosCreados: nuevosRubros.length };
}

/** F07: vínculos confirmados de un proveedor, como clave de la línea → producto. */
export async function vinculosDeProveedor(s: Sesion, proveedorId: Id): Promise<Map<string, Id>> {
  const vinculos = await s.backend.rpc<Record<string, Id>>('vinculos_de_proveedor', { c: s.comercioId, proveedor: proveedorId });
  return new Map(Object.entries(vinculos));
}

export interface VinculoNuevo {
  codigo: string | null;
  descripcion: string;
  presentacion?: string | null;
  productoId: Id;
}

/** Filas de vínculo para la base; si la lista repite una línea, vale la última elección. */
function filasVinculos(vinculos: readonly VinculoNuevo[]): Record<string, unknown>[] {
  const porClave = new Map(vinculos.map((v) => [claveVinculo(v.codigo, v.descripcion, v.presentacion), v]));
  return [...porClave].map(([codigoProveedor, v]) =>
    aFila({ codigoProveedor, descripcionProveedor: v.descripcion, productoId: v.productoId }),
  );
}

/** F07: guarda (o cambia) los vínculos que confirmó el comerciante. La próxima lista los usa solos. */
export async function guardarVinculos(s: Sesion, proveedorId: Id, vinculos: readonly VinculoNuevo[]): Promise<void> {
  await s.backend.rpc('guardar_vinculos', { c: s.comercioId, proveedor: proveedorId, vinculos: filasVinculos(vinculos) });
}

/**
 * F07/F03: da de alta en el catálogo las líneas de la lista que el comercio no tiene, y las deja vinculadas
 * a este proveedor (la próxima lista las reconoce solas). Todo junto.
 * Los productos quedan sin costo ni precio: no se guarda ningún precio fuera de la revisión (F09), donde
 * aparecen como "sin costo anterior" y se aprueban de a uno.
 * Devuelve el producto creado para cada línea, en el mismo orden (una línea repetida va con el mismo producto).
 */
export async function darDeAltaDesdeLista(s: Sesion, proveedorId: Id, lineas: readonly LineaAlta[], ivaPct: Porcentaje): Promise<Producto[]> {
  const usados = new Set((await listarProductos(s)).map((p) => clave(p.codigoInterno)));
  const altas = planearAltas(lineas, usados, ivaPct);
  const ahora = new Date().toISOString();
  const creados: Producto[] = altas.map(({ datos }) => {
    const limpio = normalizarProducto(datos);
    const errores = Object.values(validarProducto(limpio));
    if (errores.length > 0) throw new Error(`${limpio.descripcion || 'Una línea'}: ${errores[0]}`);
    return {
      ...limpio,
      id: nuevoId(),
      codigoBarras: null,
      descripcionNormalizada: normalizarDescripcion(limpio.descripcion),
      actualizado: ahora,
    };
  });
  const vinculos = altas.flatMap((alta, i) => alta.lineas.map((n) => ({ ...lineas[n]!, productoId: creados[i]!.id })));
  await s.backend.rpc('alta_desde_lista', {
    c: s.comercioId,
    proveedor: proveedorId,
    productos: creados.map(({ actualizado: _a, ...p }) => aFila(p)),
    vinculos: filasVinculos(vinculos),
  });
  const porLinea: Producto[] = [];
  altas.forEach((alta, i) => alta.lineas.forEach((n) => (porLinea[n] = creados[i]!)));
  return porLinea;
}
