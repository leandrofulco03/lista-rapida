import { FILAS_BUSCAR_ENCABEZADO, detectarColumnas, puntajeTitulo, textoCelda } from './columnas';
import type { Confianza } from './columnas';
import type { Centavos, Porcentaje } from './dinero';
import { detectarFormatoNumeros, leerImporte } from './importe';
import type { Celda } from './importe';
import type { FilaSalteada, MotivoSalteo } from './lectura';
import { ALICUOTAS_IVA, parsearPorcentaje } from './porcentaje';
import { RECARGO_MAXIMO } from './precio';
import { normalizarTexto } from './texto';

/**
 * F03: importar el catálogo propio del comercio desde un Excel o CSV.
 * Es parecido a leer la lista de un proveedor, pero con otros datos: rubro, costo y precio de venta.
 */
export type CampoCatalogo = 'codigo' | 'descripcion' | 'rubro' | 'costo' | 'precioVenta' | 'iva';

export const CAMPOS_CATALOGO: readonly CampoCatalogo[] = ['codigo', 'descripcion', 'rubro', 'costo', 'precioVenta', 'iva'];

export const NOMBRE_CAMPO_CATALOGO: Record<CampoCatalogo, string> = {
  codigo: 'Código',
  descripcion: 'Descripción',
  rubro: 'Rubro',
  costo: 'Costo',
  precioVenta: 'Precio de venta',
  iva: 'IVA',
};

export type MapeoCatalogo = { filaEncabezado: number | null } & Record<CampoCatalogo, number | null>;

export interface DeteccionCatalogo {
  mapeo: MapeoCatalogo | null;
  confianza: Confianza;
}

/** Un producto tal como viene en el archivo, antes de guardarlo. */
export interface ProductoArchivo {
  codigo: string | null;
  descripcion: string;
  rubro: string | null;
  costo: Centavos | null;
  precioVenta: Centavos | null;
  /** null si el archivo no la trae: se usa el IVA de productos nuevos de la configuración. */
  ivaPct: Porcentaje | null;
  /** Número de fila contando desde 1, como en Excel. */
  filaOrigen: number;
}

export interface ResultadoCatalogo {
  productos: ProductoArchivo[];
  salteadas: FilaSalteada[];
}

const PALABRAS: Record<'rubro' | 'costo' | 'precioVenta' | 'iva', { exactas: string[]; contiene: string[]; descartan: string[] }> = {
  rubro: {
    exactas: ['rubro', 'categoria', 'familia', 'seccion', 'linea', 'grupo', 'departamento', 'depto', 'sector'],
    contiene: ['rubro', 'categoria', 'familia', 'seccion'],
    descartan: [],
  },
  costo: {
    exactas: ['costo', 'precio costo', 'p costo', 'costo unitario', 'precio compra', 'compra', 'precio de costo', 'costo s/iva', 'costo c/iva'],
    contiene: ['costo', 'compra'],
    descartan: ['venta', 'pvp', 'publico'],
  },
  precioVenta: {
    exactas: ['precio', 'precio venta', 'p venta', 'venta', 'pvp', 'precio publico', 'precio al publico', 'precio de venta', 'precio final', 'importe', 'precio unitario', '$'],
    contiene: ['venta', 'pvp', 'publico', 'precio'],
    descartan: ['costo', 'compra', 'anterior', 'viejo', 'lista'],
  },
  iva: {
    exactas: ['iva', 'alicuota', '% iva', 'iva %', 'alic iva', 'tasa iva', 'alicuota iva'],
    contiene: ['alicuota', 'iva'],
    descartan: ['precio', 'costo', 'c/iva', 's/iva', 'con iva', 'sin iva'],
  },
};

/** Qué tan probable es (0 a 3) que un título sea un campo del catálogo. */
export function puntajeTituloCatalogo(campo: CampoCatalogo, titulo: string): number {
  if (campo === 'codigo' || campo === 'descripcion') return puntajeTitulo(campo, titulo);
  const texto = normalizarTexto(titulo);
  if (texto === '') return 0;
  const palabras = PALABRAS[campo];
  if (palabras.descartan.some((p) => texto.includes(p))) return 0;
  if (palabras.exactas.includes(texto)) return 3;
  if (palabras.contiene.some((p) => texto.includes(p))) return 2;
  return 0;
}

const vacio = (): MapeoCatalogo => ({
  filaEncabezado: null,
  codigo: null,
  descripcion: null,
  rubro: null,
  costo: null,
  precioVenta: null,
  iva: null,
});

/** Busca la fila de títulos entre las primeras filas y asigna cada campo a la columna con más puntaje. */
function detectarPorTitulos(filas: readonly (readonly Celda[])[]): DeteccionCatalogo | null {
  let mejor: { mapeo: MapeoCatalogo; puntaje: number; seguro: boolean } | null = null;
  const limite = Math.min(filas.length, FILAS_BUSCAR_ENCABEZADO);
  for (let i = 0; i < limite; i++) {
    const fila = filas[i] ?? [];
    const candidatos: { campo: CampoCatalogo; columna: number; puntaje: number }[] = [];
    fila.forEach((celda, columna) => {
      const titulo = textoCelda(celda);
      for (const campo of CAMPOS_CATALOGO) {
        const puntaje = puntajeTituloCatalogo(campo, titulo);
        if (puntaje > 0) candidatos.push({ campo, columna, puntaje });
      }
    });
    candidatos.sort((a, b) => b.puntaje - a.puntaje || a.columna - b.columna);
    const mapeo = { ...vacio(), filaEncabezado: i };
    const usadas = new Set<number>();
    let puntaje = 0;
    for (const c of candidatos) {
      if (mapeo[c.campo] !== null || usadas.has(c.columna)) continue;
      mapeo[c.campo] = c.columna;
      usadas.add(c.columna);
      puntaje += c.puntaje;
    }
    if (mapeo.descripcion === null) continue;
    if (!mejor || puntaje > mejor.puntaje) {
      const titulo = (campo: CampoCatalogo) => (mapeo[campo] === null ? 0 : puntajeTituloCatalogo(campo, textoCelda(fila[mapeo[campo]!])));
      const seguro = titulo('descripcion') >= 2 && Math.max(titulo('precioVenta'), titulo('costo')) >= 2;
      mejor = { mapeo, puntaje, seguro };
    }
  }
  return mejor && { mapeo: mejor.mapeo, confianza: mejor.seguro ? 'alta' : 'baja' };
}

/**
 * F03: adivina qué columna es cada dato del catálogo. Sin títulos, usa la misma detección que las
 * listas de proveedores y toma su precio como precio de venta (es el catálogo del comercio).
 */
export function detectarColumnasCatalogo(filas: readonly (readonly Celda[])[]): DeteccionCatalogo {
  const porTitulos = detectarPorTitulos(filas);
  if (porTitulos) return porTitulos;
  const { mapeo } = detectarColumnas(filas);
  if (!mapeo) return { mapeo: null, confianza: 'baja' };
  return {
    mapeo: { ...vacio(), filaEncabezado: mapeo.filaEncabezado, codigo: mapeo.codigo, descripcion: mapeo.descripcion, precioVenta: mapeo.costo },
    confianza: 'baja',
  };
}

/** "21", "21%", "10,5", 21, 0.21 o 0.105 → alícuota; null si no es una de las que maneja la app. */
export function leerAlicuota(celda: Celda): Porcentaje | null {
  if (celda === null) return null;
  let valor: Porcentaje | null;
  if (typeof celda === 'number') {
    // Excel guarda "21%" como 0,21.
    valor = Math.round((celda < 1 ? celda * 100 : celda) * 100);
  } else {
    valor = parsearPorcentaje(celda.replace(/^iva\s*/i, ''));
  }
  return valor !== null && ALICUOTAS_IVA.includes(valor) ? valor : null;
}

const ES_TOTAL = /^(sub ?)?total(es)?\b/;

/**
 * F03: convierte las filas del archivo en productos del catálogo.
 * Un renglón con un solo texto y sin precios es un título de rubro: si el archivo no tiene
 * columna de rubro, los productos de abajo quedan en ese rubro. Nunca descarta una fila en silencio.
 */
export function extraerProductosCatalogo(filas: readonly (readonly Celda[])[], mapeo: MapeoCatalogo): ResultadoCatalogo {
  const columna = (campo: CampoCatalogo, fila: readonly Celda[]) => (mapeo[campo] === null ? null : (fila[mapeo[campo]!] ?? null));
  const texto = (campo: CampoCatalogo, fila: readonly Celda[]) => textoCelda(columna(campo, fila) ?? undefined);
  const inicio = mapeo.filaEncabezado === null ? 0 : mapeo.filaEncabezado + 1;
  const datos = filas.slice(inicio);
  const formatoCosto = detectarFormatoNumeros(datos.map((f) => columna('costo', f)));
  const formatoVenta = detectarFormatoNumeros(datos.map((f) => columna('precioVenta', f)));
  const encabezado = mapeo.filaEncabezado === null ? null : (filas[mapeo.filaEncabezado] ?? []);
  const tituloDescripcion = encabezado ? normalizarTexto(texto('descripcion', encabezado)) : null;

  const productos: ProductoArchivo[] = [];
  const salteadas: FilaSalteada[] = [];
  const codigosVistos = new Set<string>();
  let rubroActual: string | null = null;

  datos.forEach((fila, i) => {
    const numero = inicio + i + 1;
    const textos = fila.map(textoCelda).filter((t) => t !== '');
    if (textos.length === 0) return;
    const saltear = (motivo: MotivoSalteo) => salteadas.push({ fila: numero, motivo, texto: textos.join(' · ') });

    const descripcion = texto('descripcion', fila);
    const codigo = texto('codigo', fila);
    const costo = leerImporte(columna('costo', fila), formatoCosto);
    const precioVenta = leerImporte(columna('precioVenta', fila), formatoVenta);

    if (tituloDescripcion !== null && normalizarTexto(descripcion) === tituloDescripcion) return saltear('encabezado');
    if (codigo === '' && ES_TOTAL.test(normalizarTexto(descripcion))) return saltear('total');
    // Un solo texto sin precios: título de rubro, esté en la columna que esté.
    if (textos.length === 1 && costo === null && precioVenta === null) {
      if (mapeo.rubro === null) rubroActual = textos[0]!;
      return saltear('titulo');
    }
    if (descripcion === '') return saltear('sin-descripcion');
    if (codigo !== '') {
      const clave = codigo.toLowerCase();
      if (codigosVistos.has(clave)) return saltear('repetido');
      codigosVistos.add(clave);
    }

    const rubro = mapeo.rubro === null ? rubroActual : texto('rubro', fila) || null;
    productos.push({
      codigo: codigo === '' ? null : codigo,
      descripcion,
      rubro,
      costo,
      precioVenta,
      ivaPct: leerAlicuota(columna('iva', fila)),
      filaOrigen: numero,
    });
  });

  return { productos, salteadas };
}

/** Datos de un producto que carga o edita el comerciante (F03). */
export interface DatosProducto {
  codigoInterno: string;
  descripcion: string;
  rubroId: number | null;
  /** Recargo propio; null si usa el del rubro o el general. */
  recargoPct: Porcentaje | null;
  ivaPct: Porcentaje;
  costoActual: Centavos;
  precioVentaActual: Centavos;
}

export const LARGO_MAXIMO_CODIGO = 30;
export const LARGO_MAXIMO_DESCRIPCION = 120;

export type ErroresProducto = Partial<Record<'codigoInterno' | 'descripcion' | 'recargoPct' | 'ivaPct' | 'costoActual' | 'precioVentaActual', string>>;

/** Un mensaje por campo con problemas; vacío si el producto es válido. La unicidad del código la controla la base. */
export function validarProducto(datos: DatosProducto): ErroresProducto {
  const errores: ErroresProducto = {};
  const codigo = datos.codigoInterno.trim();
  if (codigo === '') errores.codigoInterno = 'Escribí un código.';
  else if (codigo.length > LARGO_MAXIMO_CODIGO) errores.codigoInterno = `Usá hasta ${LARGO_MAXIMO_CODIGO} letras.`;
  const descripcion = datos.descripcion.trim();
  if (descripcion === '') errores.descripcion = 'Escribí la descripción.';
  else if (descripcion.length > LARGO_MAXIMO_DESCRIPCION) errores.descripcion = `Usá hasta ${LARGO_MAXIMO_DESCRIPCION} letras.`;
  if (datos.recargoPct !== null && (!Number.isSafeInteger(datos.recargoPct) || datos.recargoPct < 0 || datos.recargoPct > RECARGO_MAXIMO)) {
    errores.recargoPct = 'Poné un recargo entre 0% y 1000%, o dejalo vacío.';
  }
  if (!ALICUOTAS_IVA.includes(datos.ivaPct)) errores.ivaPct = 'Elegí 21% o 10,5%.';
  if (!Number.isSafeInteger(datos.costoActual) || datos.costoActual < 0) errores.costoActual = 'Poné un costo válido.';
  if (!Number.isSafeInteger(datos.precioVentaActual) || datos.precioVentaActual < 0) {
    errores.precioVentaActual = 'Poné un precio válido.';
  }
  return errores;
}

/** Limpia espacios de más antes de guardar. */
export function normalizarProducto(datos: DatosProducto): DatosProducto {
  const limpiar = (t: string) => t.replace(/\s+/g, ' ').trim();
  return { ...datos, codigoInterno: limpiar(datos.codigoInterno), descripcion: limpiar(datos.descripcion) };
}

/** Próximo código automático libre ("P0001", "P0002"…) para productos que no traen código. */
export function siguienteCodigo(usados: ReadonlySet<string>, desde = 1): { codigo: string; numero: number } {
  for (let n = desde; ; n++) {
    const codigo = `P${String(n).padStart(4, '0')}`;
    if (!usados.has(codigo.toLowerCase())) return { codigo, numero: n };
  }
}
