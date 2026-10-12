import { FILAS_BUSCAR_ENCABEZADO, completarMapeo, ivaDesdeTitulo, textoCelda } from './columnas';
import type { MapeoColumnas, TitulosColumnas } from './columnas';
import { detectarFormatoNumeros, leerImporte } from './importe';
import type { Celda } from './importe';
import type { LineaLista } from './lineaLista';
import { normalizarTexto } from './texto';

/** Por qué una fila con algo escrito no se tomó como producto. */
export type MotivoSalteo = 'titulo' | 'sin-precio' | 'sin-descripcion' | 'encabezado' | 'total';

export const TEXTO_MOTIVO: Record<MotivoSalteo, string> = {
  titulo: 'Título o rubro, sin precio',
  'sin-precio': 'No tiene un precio que se entienda',
  'sin-descripcion': 'Tiene precio pero no descripción',
  encabezado: 'Repite los títulos de las columnas',
  total: 'Total o subtotal',
};

export interface FilaSalteada {
  /** Número de fila contando desde 1, como en Excel. */
  fila: number;
  motivo: MotivoSalteo;
  /** Lo que tenía la fila, para que el usuario la reconozca. */
  texto: string;
}

export interface ResultadoLectura {
  lineas: LineaLista[];
  salteadas: FilaSalteada[];
}

const ES_TOTAL = /^(sub ?)?total(es)?\b/;

/**
 * F04: convierte las filas del archivo en líneas de la lista según el mapeo.
 * Nunca descarta una fila con datos en silencio: si no la toma, dice por qué.
 */
export function extraerLineas(filas: readonly (readonly Celda[])[], mapeo: MapeoColumnas): ResultadoLectura {
  const inicio = mapeo.filaEncabezado === null ? 0 : mapeo.filaEncabezado + 1;
  const datos = filas.slice(inicio);
  const formato = detectarFormatoNumeros(datos.map((f) => f[mapeo.costo] ?? null));
  const encabezado = mapeo.filaEncabezado === null ? null : (filas[mapeo.filaEncabezado] ?? []);
  const ivaIncluido = encabezado ? ivaDesdeTitulo(textoCelda(encabezado[mapeo.costo])) : null;
  const tituloDescripcion = encabezado ? normalizarTexto(textoCelda(encabezado[mapeo.descripcion])) : null;
  const tituloCosto = encabezado ? normalizarTexto(textoCelda(encabezado[mapeo.costo])) : null;

  const lineas: LineaLista[] = [];
  const salteadas: FilaSalteada[] = [];

  datos.forEach((fila, i) => {
    const numero = inicio + i + 1;
    const texto = fila.map(textoCelda).filter((t) => t !== '').join(' · ');
    if (texto === '') return;
    const saltear = (motivo: MotivoSalteo) => salteadas.push({ fila: numero, motivo, texto });

    const descripcion = textoCelda(fila[mapeo.descripcion]);
    const codigo = mapeo.codigo === null ? '' : textoCelda(fila[mapeo.codigo]);
    const costoCrudo = fila[mapeo.costo] ?? null;
    const presentacion = mapeo.presentacion === null ? '' : textoCelda(fila[mapeo.presentacion]);

    if (
      tituloDescripcion !== null &&
      normalizarTexto(descripcion) === tituloDescripcion &&
      normalizarTexto(textoCelda(costoCrudo)) === tituloCosto
    ) {
      return saltear('encabezado');
    }
    if (codigo === '' && ES_TOTAL.test(normalizarTexto(descripcion))) return saltear('total');

    const costo = leerImporte(costoCrudo, formato);
    if (costo === null) {
      return saltear(textoCelda(costoCrudo) === '' && codigo === '' ? 'titulo' : 'sin-precio');
    }
    if (descripcion === '') return saltear('sin-descripcion');

    lineas.push({
      codigo: codigo === '' ? null : codigo,
      descripcion,
      presentacion: presentacion === '' ? null : presentacion,
      costo,
      ivaIncluido,
      filaOrigen: numero,
    });
  });

  return { lineas, salteadas };
}

/** Proporción de filas con datos que se leyeron como producto (sin contar títulos de rubro ni totales). */
export function proporcionLeida({ lineas, salteadas }: ResultadoLectura): number {
  const fallidas = salteadas.filter((s) => s.motivo === 'sin-precio' || s.motivo === 'sin-descripcion').length;
  const total = lineas.length + fallidas;
  return total === 0 ? 0 : lineas.length / total;
}

/** Mínimo de filas leídas para reusar un mapeo guardado sin preguntar. */
export const MINIMO_REUSO = 0.8;

/** Busca, entre las primeras filas, la que tiene los títulos guardados, y devuelve el mapeo con las posiciones nuevas. */
function reubicarPorTitulos(filas: readonly (readonly Celda[])[], titulos: TitulosColumnas): MapeoColumnas | null {
  const limite = Math.min(filas.length, FILAS_BUSCAR_ENCABEZADO);
  for (let i = 0; i < limite; i++) {
    const normalizados = (filas[i] ?? []).map((c) => normalizarTexto(textoCelda(c)));
    const columna = (titulo: string | null) => (titulo === null ? null : normalizados.indexOf(titulo));
    const posiciones = {
      codigo: columna(titulos.codigo),
      descripcion: columna(titulos.descripcion)!,
      costo: columna(titulos.costo)!,
      presentacion: columna(titulos.presentacion),
    };
    if (Object.values(posiciones).some((p) => p === -1)) continue;
    return completarMapeo(filas, { filaEncabezado: i, ...posiciones });
  }
  return null;
}

/**
 * F06: reusa el mapeo guardado del proveedor. Si la tabla se movió, la reencuentra por los títulos.
 * Devuelve null si el mapeo ya no sirve (cambió el formato de la lista): hay que volver a preguntar.
 */
export function aplicarMapeoGuardado(
  filas: readonly (readonly Celda[])[],
  guardado: MapeoColumnas,
): MapeoColumnas | null {
  const mapeo = guardado.titulos ? reubicarPorTitulos(filas, guardado.titulos) : guardado;
  if (!mapeo) return null;
  const resultado = extraerLineas(filas, mapeo);
  if (resultado.lineas.length === 0 || proporcionLeida(resultado) < MINIMO_REUSO) return null;
  return mapeo;
}
