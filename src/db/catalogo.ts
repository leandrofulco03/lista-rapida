import { normalizarProducto, planearAltas, siguienteCodigo, validarProducto } from '../domain/catalogo';
import type { DatosProducto, LineaAlta, ProductoArchivo } from '../domain/catalogo';
import type { ConfigComercio } from '../domain/config';
import type { Porcentaje } from '../domain/dinero';
import { calcularPrecioVenta, RECARGO_MAXIMO } from '../domain/precio';
import { resolverRecargo } from '../domain/recargo';
import { normalizarTexto } from '../domain/texto';
import { claveVinculo, normalizarDescripcion } from '../domain/vinculacion';
import type { BaseListaRapida, Producto, Rubro, Vinculo } from './esquema';

/**
 * F03: catálogo propio del comercio (productos y rubros).
 * La descripción normalizada (con unidades unificadas) se guarda para buscar y para vincular con las listas (F07).
 */

export const LARGO_MAXIMO_RUBRO = 40;

const clave = (texto: string) => texto.trim().toLowerCase();

export async function listarRubros(db: BaseListaRapida): Promise<Rubro[]> {
  return db.rubros.orderBy('nombre').toArray();
}

/** Crea o edita un rubro. El nombre no se repite (sin importar mayúsculas ni acentos). */
export async function guardarRubro(
  db: BaseListaRapida,
  datos: { nombre: string; recargoPct: Porcentaje | null },
  id?: number,
): Promise<Rubro> {
  const nombre = datos.nombre.replace(/\s+/g, ' ').trim();
  if (nombre === '') throw new Error('Escribí el nombre del rubro.');
  if (nombre.length > LARGO_MAXIMO_RUBRO) throw new Error(`El nombre puede tener hasta ${LARGO_MAXIMO_RUBRO} letras.`);
  if (datos.recargoPct !== null && (!Number.isSafeInteger(datos.recargoPct) || datos.recargoPct < 0 || datos.recargoPct > RECARGO_MAXIMO)) {
    throw new Error('Poné un recargo entre 0% y 1000%, o dejalo vacío.');
  }
  return db.transaction('rw', db.rubros, async () => {
    const repetido = (await db.rubros.toArray()).find((r) => r.id !== id && normalizarTexto(r.nombre) === normalizarTexto(nombre));
    if (repetido) throw new Error(`Ya existe el rubro ${repetido.nombre}.`);
    const rubro = { nombre, recargoPct: datos.recargoPct };
    if (id === undefined) return { ...rubro, id: await db.rubros.add(rubro) };
    if ((await db.rubros.update(id, rubro)) === 0 && !(await db.rubros.get(id))) throw new Error('No encontramos el rubro.');
    return { ...rubro, id };
  });
}

/** Borra el rubro; sus productos quedan sin rubro (usan el recargo general o el propio). */
export async function borrarRubro(db: BaseListaRapida, id: number): Promise<void> {
  await db.transaction('rw', db.rubros, db.productos, async () => {
    await db.productos.where('rubroId').equals(id).modify({ rubroId: null });
    await db.rubros.delete(id);
  });
}

export async function listarProductos(db: BaseListaRapida): Promise<Producto[]> {
  const productos = await db.productos.toArray();
  return productos.sort((a, b) => a.descripcion.localeCompare(b.descripcion, 'es'));
}

/** Busca por código o por palabras de la descripción ("yerba 1 kg" encuentra "Yerba mate Playadito 1 kg"). */
export function filtrarProductos(productos: readonly Producto[], busqueda: string): Producto[] {
  const palabras = normalizarDescripcion(busqueda).split(' ').filter(Boolean);
  if (palabras.length === 0) return [...productos];
  return productos.filter((p) => {
    const texto = `${p.codigoInterno.toLowerCase()} ${p.descripcionNormalizada}`;
    return palabras.every((palabra) => texto.includes(palabra));
  });
}

/** Crea o edita un producto. Lanza un error con el primer problema si no es válido o el código ya existe. */
export async function guardarProducto(
  db: BaseListaRapida,
  datos: DatosProducto,
  id?: number,
  ahora = new Date(),
): Promise<Producto> {
  const limpio = normalizarProducto(datos);
  const errores = Object.values(validarProducto(limpio));
  if (errores.length > 0) throw new Error(errores[0]);
  return db.transaction('rw', db.productos, db.rubros, async () => {
    const repetido = await db.productos
      .filter((p) => p.id !== id && clave(p.codigoInterno) === clave(limpio.codigoInterno))
      .first();
    if (repetido) throw new Error(`El código ${limpio.codigoInterno} ya es de ${repetido.descripcion}.`);
    if (limpio.rubroId !== null && !(await db.rubros.get(limpio.rubroId))) throw new Error('No encontramos el rubro.');
    const producto = {
      ...limpio,
      descripcionNormalizada: normalizarDescripcion(limpio.descripcion),
      actualizado: ahora.toISOString(),
    };
    if (id === undefined) return { ...producto, id: await db.productos.add(producto) };
    if ((await db.productos.update(id, producto)) === 0 && !(await db.productos.get(id))) {
      throw new Error('No encontramos el producto.');
    }
    return { ...producto, id };
  });
}

/** Borra el producto y sus vínculos con las listas de los proveedores. */
export async function borrarProducto(db: BaseListaRapida, id: number): Promise<void> {
  await db.transaction('rw', db.productos, db.vinculos, async () => {
    await db.vinculos.where('productoId').equals(id).delete();
    await db.productos.delete(id);
  });
}

/** Próximo código automático libre para un producto nuevo. */
export async function proponerCodigo(db: BaseListaRapida): Promise<string> {
  const usados = new Set((await db.productos.toArray()).map((p) => clave(p.codigoInterno)));
  return siguienteCodigo(usados).codigo;
}

export interface ResultadoImportacionCatalogo {
  creados: number;
  actualizados: number;
  rubrosCreados: number;
}

/**
 * F03: guarda los productos leídos del archivo en el catálogo.
 * - Un producto que ya existe (mismo código o, si el archivo no trae código, misma descripción) se actualiza.
 * - Los rubros que no existen se crean.
 * - Sin precio de venta en el archivo, se calcula desde el costo con el recargo y el redondeo del
 *   comercio (el costo del catálogo se toma sin IVA); sin costo ni precio, queda en cero.
 * - Sin código, se le da uno automático (P0001, P0002…).
 */
export async function importarCatalogo(
  db: BaseListaRapida,
  productos: readonly ProductoArchivo[],
  config: ConfigComercio,
  ahora = new Date(),
): Promise<ResultadoImportacionCatalogo> {
  return db.transaction('rw', db.productos, db.rubros, async () => {
    const rubros = new Map((await db.rubros.toArray()).map((r) => [normalizarTexto(r.nombre), r]));
    const existentes = await db.productos.toArray();
    const porCodigo = new Map(existentes.map((p) => [clave(p.codigoInterno), p]));
    const porDescripcion = new Map(existentes.map((p) => [p.descripcionNormalizada, p]));
    const usados = new Set([...porCodigo.keys(), ...productos.flatMap((p) => (p.codigo ? [clave(p.codigo)] : []))]);
    let proximoNumero = 1;
    const fecha = ahora.toISOString();

    // Primero los rubros nuevos, de una vez; después los productos sin más esperas.
    const limpiarRubro = (nombre: string) => nombre.replace(/\s+/g, ' ').trim().slice(0, LARGO_MAXIMO_RUBRO);
    const faltantes = new Map<string, string>();
    for (const p of productos) {
      if (!p.rubro) continue;
      const nombre = limpiarRubro(p.rubro);
      const k = normalizarTexto(nombre);
      if (!rubros.has(k) && !faltantes.has(k)) faltantes.set(k, nombre);
    }
    const nuevosRubros = [...faltantes.values()].map((nombre) => ({ nombre, recargoPct: null }));
    const ids = await db.rubros.bulkAdd(nuevosRubros as Rubro[], { allKeys: true });
    nuevosRubros.forEach((r, i) => rubros.set(normalizarTexto(r.nombre), { ...r, id: ids[i]! }));
    const rubroPara = (nombre: string) => rubros.get(normalizarTexto(limpiarRubro(nombre)))!;
    const recargoDeRubro = new Map([...rubros.values()].map((r) => [r.id, r.recargoPct]));

    const guardar: Producto[] = [];
    const nuevos: Omit<Producto, 'id'>[] = [];
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

      const datos = {
        codigoInterno,
        descripcion: p.descripcion,
        descripcionNormalizada,
        rubroId,
        recargoPct: existente?.recargoPct ?? null,
        ivaPct,
        costoActual,
        precioVentaActual,
        actualizado: fecha,
      };
      if (existente) guardar.push({ ...datos, id: existente.id });
      else nuevos.push(datos);
    }
    await db.productos.bulkPut(guardar);
    await db.productos.bulkAdd(nuevos as Producto[]);
    return { creados: nuevos.length, actualizados: guardar.length, rubrosCreados: nuevosRubros.length };
  });
}

/** F07: vínculos confirmados de un proveedor, como clave de la línea → producto. */
export async function vinculosDeProveedor(db: BaseListaRapida, proveedorId: number): Promise<Map<string, number>> {
  const vinculos = await db.vinculos.where('[proveedorId+codigoProveedor]').between([proveedorId, ''], [proveedorId, '￿']).toArray();
  return new Map(vinculos.map((v) => [v.codigoProveedor, v.productoId]));
}

export interface VinculoNuevo {
  codigo: string | null;
  descripcion: string;
  presentacion?: string | null;
  productoId: number;
}

/** F07: guarda (o cambia) los vínculos que confirmó el comerciante. La próxima lista los usa solos. */
export async function guardarVinculos(db: BaseListaRapida, proveedorId: number, vinculos: readonly VinculoNuevo[]): Promise<void> {
  await db.transaction('rw', db.vinculos, async () => {
    const existentes = await db.vinculos.where('[proveedorId+codigoProveedor]').between([proveedorId, ''], [proveedorId, '￿']).toArray();
    const porClave = new Map(existentes.map((v) => [v.codigoProveedor, v.id]));
    // Si la lista repite una línea, vale la última elección.
    const porClaveNueva = new Map(vinculos.map((v) => [claveVinculo(v.codigo, v.descripcion, v.presentacion), v]));
    const filas = [...porClaveNueva].map(([codigoProveedor, v]) => {
      const id = porClave.get(codigoProveedor);
      const fila = { proveedorId, codigoProveedor, descripcionProveedor: v.descripcion, productoId: v.productoId, confirmado: true };
      return id === undefined ? fila : { ...fila, id };
    });
    await db.vinculos.bulkPut(filas as Vinculo[]);
  });
}

/**
 * F07/F03: da de alta en el catálogo las líneas de la lista que el comercio no tiene, y las deja vinculadas
 * a este proveedor (la próxima lista las reconoce solas). Todo en una transacción.
 * Los productos quedan sin costo ni precio: no se guarda ningún precio fuera de la revisión (F09), donde
 * aparecen como "sin costo anterior" y se aprueban de a uno.
 * Devuelve el producto creado para cada línea, en el mismo orden (una línea repetida va con el mismo producto).
 */
export async function darDeAltaDesdeLista(
  db: BaseListaRapida,
  proveedorId: number,
  lineas: readonly LineaAlta[],
  ivaPct: Porcentaje,
  ahora = new Date(),
): Promise<Producto[]> {
  return db.transaction('rw', db.productos, db.vinculos, async () => {
    const usados = new Set((await db.productos.toArray()).map((p) => clave(p.codigoInterno)));
    const altas = planearAltas(lineas, usados, ivaPct);
    const productos = altas.map(({ datos }) => {
      const limpio = normalizarProducto(datos);
      const errores = Object.values(validarProducto(limpio));
      if (errores.length > 0) throw new Error(`${limpio.descripcion || 'Una línea'}: ${errores[0]}`);
      return { ...limpio, descripcionNormalizada: normalizarDescripcion(limpio.descripcion), actualizado: ahora.toISOString() };
    });
    const ids = await db.productos.bulkAdd(productos as Producto[], { allKeys: true });
    const creados = productos.map((p, i) => ({ ...p, id: ids[i]! }));
    await guardarVinculos(
      db,
      proveedorId,
      altas.flatMap((alta, i) => alta.lineas.map((n) => ({ ...lineas[n]!, productoId: creados[i]!.id }))),
    );
    const porLinea: Producto[] = [];
    altas.forEach((alta, i) => alta.lineas.forEach((n) => (porLinea[n] = creados[i]!)));
    return porLinea;
  });
}
