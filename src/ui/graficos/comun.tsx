import { useEffect, useRef, useState } from 'react';
import type { ReactNode, RefObject } from 'react';

/** Piezas comunes de los gráficos: ancho del contenedor, tooltip, tabla de datos y escala de ejes. */

export const SERIES = ['var(--graf-serie-1)', 'var(--graf-serie-2)', 'var(--graf-serie-3)', 'var(--graf-serie-4)', 'var(--graf-serie-5)'];

/** Ancho en px del elemento, actualizado al cambiar el tamaño de la pantalla. */
export function useAncho<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [ancho, setAncho] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setAncho(el.clientWidth);
    if (typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([e]) => setAncho(Math.round(e!.contentRect.width)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, ancho];
}

/** Tooltip: el valor primero y fuerte; la etiqueta después. Se ubica dentro del contenedor (position: relative). */
export function Tooltip({ x, y, ancho, valor, etiqueta, clave }: { x: number; y: number; ancho: number; valor: string; etiqueta: string; clave?: string }) {
  const izquierda = Math.min(Math.max(x, 70), Math.max(70, ancho - 70));
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-sm whitespace-nowrap shadow-md"
      style={{ left: izquierda, top: y - 8 }}
    >
      <p className="flex items-center gap-1.5 font-semibold text-stone-900">
        {clave && <span aria-hidden="true" className="inline-block h-0.5 w-3 rounded" style={{ background: clave }} />}
        {valor}
      </p>
      <p className="text-stone-600">{etiqueta}</p>
    </div>
  );
}

/** La tabla con los mismos datos del gráfico (para leer sin el gráfico y con lector de pantalla). */
export function TablaDatos({ titulo, columnas, filas }: { titulo: string; columnas: string[]; filas: ReactNode[][] }) {
  return (
    <details className="mt-2 text-sm">
      <summary className="min-h-11 cursor-pointer py-2 font-semibold text-green-800">Ver los datos</summary>
      <table className="mt-1 w-full border-collapse tabular-nums">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr>
            {columnas.map((c, i) => (
              <th key={c} scope="col" className={`border-b border-stone-200 py-1 font-semibold text-stone-600 ${i === 0 ? 'text-left' : 'text-right'}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i}>
              {f.map((celda, j) => (
                <td key={j} className={`border-b border-stone-100 py-1 ${j === 0 ? 'text-left' : 'text-right'}`}>
                  {celda}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Máximo "redondo" para el eje (1, 2, 2,5 o 5 por potencia de 10) y sus marcas. */
export function escalaRedonda(maximo: number, marcas = 4): number[] {
  if (maximo <= 0) return [0, 1];
  const paso0 = maximo / marcas;
  const potencia = 10 ** Math.floor(Math.log10(paso0));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= paso0)!;
  return Array.from({ length: Math.ceil(maximo / paso) + 1 }, (_, i) => i * paso);
}

/** Pesos compactos para ejes: $0, $500, $1,2 mil, $15 mil, $1,5 M (el monto viene en centavos). */
export function pesosCompactos(centavos: number): string {
  const pesos = centavos / 100;
  if (pesos >= 1_000_000) return `$${(pesos / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} M`;
  if (pesos >= 1_000) return `$${(pesos / 1_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })} mil`;
  return `$${pesos.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`;
}
