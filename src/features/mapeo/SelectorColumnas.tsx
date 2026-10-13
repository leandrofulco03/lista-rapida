import { useId } from 'react';
import { FILAS_BUSCAR_ENCABEZADO, textoCelda } from '../../domain/columnas';
import type { Celda } from '../../domain/importe';

/** A, B, …, Z, AA, AB: como las columnas de Excel. */
export function letraColumna(indice: number): string {
  let letra = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  }
  return letra;
}

export type Seleccion<C extends string> = { filaEncabezado: number | null } & Record<C, number | null>;

interface Props<C extends string> {
  filas: Celda[][];
  campos: readonly C[];
  nombres: Record<C, string>;
  seleccion: Seleccion<C>;
  onCambiar: (seleccion: Seleccion<C>) => void;
}

const FILAS_VISTA_PREVIA = 6;

/**
 * F03/F06: elegir la fila de títulos y qué columna es cada dato, viendo las primeras filas del archivo.
 * Cada columna es un solo dato y cada dato está en una sola columna.
 */
export function SelectorColumnas<C extends string>({ filas, campos, nombres, seleccion, onCambiar }: Props<C>) {
  const idFila = useId();
  const ancho = Math.max(1, ...filas.slice(0, 200).map((f) => f.length));
  const inicio = seleccion.filaEncabezado === null ? 0 : seleccion.filaEncabezado + 1;
  const encabezado = seleccion.filaEncabezado === null ? null : (filas[seleccion.filaEncabezado] ?? []);
  const vistaPrevia = filas.slice(inicio).filter((f) => f.length > 0).slice(0, FILAS_VISTA_PREVIA);

  const campoDe = (columna: number): C | '' => campos.find((c) => seleccion[c] === columna) ?? '';

  function asignar(columna: number, campo: C | '') {
    const nueva = { ...seleccion };
    for (const c of campos) if (nueva[c] === columna) nueva[c] = null as Seleccion<C>[C];
    if (campo !== '') nueva[campo] = columna as Seleccion<C>[C];
    onCambiar(nueva);
  }

  const opcionesFila = filas.slice(0, FILAS_BUSCAR_ENCABEZADO).map((fila, i) => {
    const texto = fila.map(textoCelda).filter((t) => t !== '').join(' · ');
    return { valor: i, texto: texto.length > 50 ? `${texto.slice(0, 50)}…` : texto };
  });

  return (
    <>
      <label htmlFor={idFila} className="mt-6 block text-lg font-semibold">
        Fila con los títulos
      </label>
      <select
        id={idFila}
        value={seleccion.filaEncabezado ?? ''}
        onChange={(e) => onCambiar({ ...seleccion, filaEncabezado: e.target.value === '' ? null : Number(e.target.value) })}
        className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-white shadow-sm px-3 text-base"
      >
        <option value="">El archivo no tiene títulos</option>
        {opcionesFila.map(({ valor, texto }) => (
          <option key={valor} value={valor}>
            Fila {valor + 1}
            {texto ? `: ${texto}` : ' (vacía)'}
          </option>
        ))}
      </select>

      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              {Array.from({ length: ancho }, (_, columna) => (
                <th key={columna} className="min-w-36 p-2 align-top font-normal">
                  <select
                    aria-label={`Columna ${letraColumna(columna)}`}
                    value={campoDe(columna)}
                    onChange={(e) => asignar(columna, e.target.value as C | '')}
                    className={`min-h-11 w-full rounded-lg border px-2 text-base ${
                      campoDe(columna) ? 'border-green-700 bg-green-50 font-semibold text-green-900' : 'border-stone-300 bg-white'
                    }`}
                  >
                    <option value="">No usar</option>
                    {campos.map((c) => (
                      <option key={c} value={c}>
                        {nombres[c]}
                      </option>
                    ))}
                  </select>
                  <div className="mt-1 text-xs text-stone-500">
                    {letraColumna(columna)}
                    {encabezado && textoCelda(encabezado[columna]) ? ` · ${textoCelda(encabezado[columna])}` : ''}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {vistaPrevia.map((fila, i) => (
              <tr key={i} className="border-t border-stone-200">
                {Array.from({ length: ancho }, (_, columna) => (
                  <td key={columna} className="p-2 whitespace-nowrap">
                    {textoCelda(fila[columna])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
