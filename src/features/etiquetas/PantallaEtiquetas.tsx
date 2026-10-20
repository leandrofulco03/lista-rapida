import { useEffect, useId, useState } from 'react';
import { filtrarProductos, listarProductos, productosUltimaRevision } from '../../db';
import type { Id } from '../../domain/id';
import { useSesion } from '../../sesion';
import type { Producto } from '../../db';
import { FORMATOS, FORMATO_INICIAL, LIMITES_FORMATO, fechaEtiqueta, medidaEtiqueta, precioEtiqueta, validarFormato } from '../../domain/etiquetas';
import type { FormatoEtiqueta } from '../../domain/etiquetas';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoEtiqueta } from '../../ui/Iconos';
import { descargar } from '../../ui/descargar';

interface Props {
  /** Productos para imprimir; si no viene, los que cambiaron de precio en la última lista revisada. */
  preseleccion?: Id[];
  onVolver: () => void;
}

const CLAVE_FORMATO = 'lista-rapida:formato-etiqueta';
const RESULTADOS = 5;

/** El formato elegido se recuerda en este dispositivo (depende de la impresora y del papel). */
function leerFormatoGuardado(): FormatoEtiqueta {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_FORMATO) ?? 'null') as FormatoEtiqueta | null;
    return guardado && validarFormato(guardado) === null ? guardado : FORMATO_INICIAL;
  } catch {
    return FORMATO_INICIAL;
  }
}

function guardarFormato(formato: FormatoEtiqueta) {
  try {
    localStorage.setItem(CLAVE_FORMATO, JSON.stringify(formato));
  } catch {
    // Sin almacenamiento (modo privado): se usa el de fábrica la próxima vez.
  }
}

const mm = (n: number) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 });

/** F10: PDF A4 con etiquetas de precio (descripción, precio y fecha) para imprimir en una impresora común. */
export function PantallaEtiquetas({ preseleccion, onVolver }: Props) {
  const sesion = useSesion();
  const [productos, setProductos] = useState<Map<Id, Producto> | null>(null);
  const [seleccion, setSeleccion] = useState<Id[]>([]);
  const [formato, setFormato] = useState<FormatoEtiqueta>(leerFormatoGuardado);
  const [busqueda, setBusqueda] = useState('');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { buscar: useId(), columnas: useId(), filas: useId(), margen: useId() };

  useEffect(() => {
    Promise.all([listarProductos(sesion), preseleccion ? Promise.resolve(preseleccion) : productosUltimaRevision(sesion)]).then(([lista, elegidos]) => {
      const porId = new Map(lista.map((p) => [p.id, p]));
      setProductos(porId);
      setSeleccion([...new Set(elegidos)].filter((id) => porId.has(id)));
    });
  }, [preseleccion]);

  if (productos === null) return null;

  const errorFormato = validarFormato(formato);
  const elegirFormato = (nuevo: FormatoEtiqueta) => {
    setFormato(nuevo);
    if (validarFormato(nuevo) === null) guardarFormato(nuevo);
  };
  const porHoja = formato.columnas * formato.filas;
  const hojas = errorFormato ? 0 : Math.ceil(seleccion.length / porHoja);
  const medida = medidaEtiqueta(formato);
  const encontrados =
    busqueda.trim() === '' ? [] : filtrarProductos([...productos.values()], busqueda).filter((p) => !seleccion.includes(p.id)).slice(0, RESULTADOS);

  async function bajarPdf() {
    setError(null);
    setGenerando(true);
    try {
      const { generarEtiquetasPdf } = await import('../../salidas/etiquetasPdf');
      const hoy = new Date();
      const bytes = await generarEtiquetasPdf(
        seleccion.map((id) => ({ descripcion: productos!.get(id)!.descripcion, precio: productos!.get(id)!.precioVentaActual })),
        formato,
        fechaEtiqueta(hoy),
      );
      descargar(`etiquetas-${hoy.toISOString().slice(0, 10)}.pdf`, new Uint8Array(bytes), 'application/pdf');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerando(false);
    }
  }

  const campoNumero = (id: string, etiqueta: string, valor: number, cambiar: (n: number) => void, limites: readonly [number, number]) => (
    <div>
      <label htmlFor={id} className="block font-medium">
        {etiqueta}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={limites[0]}
        max={limites[1]}
        value={Number.isNaN(valor) ? '' : valor}
        onChange={(e) => cambiar(e.target.valueAsNumber)}
        className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white shadow-sm px-3 text-lg"
      />
    </div>
  );

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado Icono={IconoEtiqueta} titulo="Etiquetas" descripcion="Un PDF A4 con descripción, precio y fecha de cada producto." />

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Tamaño</h2>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {FORMATOS.map((f) => {
            const elegido = f.formato.columnas === formato.columnas && f.formato.filas === formato.filas && f.formato.margen === formato.margen;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={elegido}
                onClick={() => elegirFormato(f.formato)}
                className={`min-h-11 rounded-xl border px-3 text-base font-medium ${elegido ? 'border-green-600 bg-green-600 text-white shadow-md shadow-green-800/20' : 'border-stone-200 bg-white shadow-sm hover:border-green-300 hover:bg-green-50'}`}
              >
                {f.nombre}
              </button>
            );
          })}
        </div>
        <details className="mt-3 rounded-xl border border-stone-200 bg-white shadow-sm p-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Medidas a mano</summary>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {campoNumero(ids.columnas, 'Columnas', formato.columnas, (n) => elegirFormato({ ...formato, columnas: n }), LIMITES_FORMATO.columnas)}
            {campoNumero(ids.filas, 'Filas', formato.filas, (n) => elegirFormato({ ...formato, filas: n }), LIMITES_FORMATO.filas)}
            {campoNumero(ids.margen, 'Margen (mm)', formato.margen, (n) => elegirFormato({ ...formato, margen: n }), LIMITES_FORMATO.margen)}
          </div>
          <p className="mt-2 text-sm text-stone-600">Para hojas autoadhesivas que llegan al borde, margen 0.</p>
        </details>
        {errorFormato ? (
          <p className="mt-2 text-red-700" role="alert">
            {errorFormato}
          </p>
        ) : (
          <p className="mt-2 text-stone-700" data-testid="medida-etiqueta">
            Cada etiqueta mide {mm(medida.ancho)} × {mm(medida.alto)} mm.
          </p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Productos ({seleccion.length})</h2>
        {seleccion.length === 0 && <p className="mt-1 text-stone-600">Buscá los productos o revisá una lista: los que cambian de precio aparecen acá.</p>}
        <ul className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm empty:hidden" data-testid="productos-etiquetas">
          {seleccion.map((id) => {
            const p = productos.get(id)!;
            return (
              <li key={id} className="flex items-center justify-between gap-3 p-2 pl-3">
                <span className="min-w-0 break-words">{p.descripcion}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="font-semibold">{precioEtiqueta(p.precioVentaActual)}</span>
                  <button
                    type="button"
                    aria-label={`Sacar ${p.descripcion}`}
                    onClick={() => setSeleccion((s) => s.filter((x) => x !== id))}
                    className="min-h-11 min-w-11 rounded-lg text-xl text-stone-500"
                  >
                    ×
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
        <label htmlFor={ids.buscar} className="mt-3 block font-medium">
          Agregar del catálogo
        </label>
        <input
          id={ids.buscar}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Código o palabras"
          className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 bg-white shadow-sm px-3 text-lg"
        />
        <ul className="mt-2 space-y-1">
          {encontrados.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSeleccion((s) => [...s, p.id])}
                className="min-h-11 w-full rounded-xl border border-stone-200 bg-white shadow-sm px-3 py-2 text-left"
              >
                + {p.descripcion} <span className="text-sm text-stone-500">{p.codigoInterno}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        <Boton type="button" onClick={bajarPdf} disabled={generando || seleccion.length === 0 || errorFormato !== null}>
          {generando ? 'Armando el PDF…' : `Bajar PDF (${seleccion.length} ${seleccion.length === 1 ? 'etiqueta' : 'etiquetas'}, ${hojas} ${hojas === 1 ? 'hoja' : 'hojas'})`}
        </Boton>
        <p className="text-sm text-stone-600">Al imprimir, elegí tamaño real o 100% (no "ajustar a la página"), así las etiquetas quedan alineadas.</p>
        <Boton type="button" variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </div>
    </main>
  );
}
