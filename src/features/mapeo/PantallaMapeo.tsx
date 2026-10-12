import { useId, useMemo, useState } from 'react';
import { CAMPOS, FILAS_BUSCAR_ENCABEZADO, completarMapeo, textoCelda } from '../../domain/columnas';
import type { Campo, Confianza, MapeoColumnas } from '../../domain/columnas';
import type { Celda } from '../../domain/importe';
import { extraerLineas } from '../../domain/lectura';
import { Boton } from '../../ui/Boton';

interface Props {
  filas: Celda[][];
  nombreArchivo: string;
  /** Lo que adivinó la app (o el mapeo anterior); null si no encontró nada. */
  inicial: MapeoColumnas | null;
  confianza: Confianza;
  onConfirmar: (mapeo: MapeoColumnas) => void;
  onCancelar: () => void;
}

export const NOMBRE_CAMPO: Record<Campo, string> = {
  codigo: 'Código',
  descripcion: 'Descripción',
  costo: 'Precio',
  presentacion: 'Presentación',
};

type Seleccion = { filaEncabezado: number | null } & Record<Campo, number | null>;

const FILAS_VISTA_PREVIA = 6;

/** A, B, …, Z, AA, AB: como las columnas de Excel. */
export function letraColumna(indice: number): string {
  let letra = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  }
  return letra;
}

/** F06: el usuario confirma o corrige qué columna es cada dato. Queda guardado para ese proveedor. */
export function PantallaMapeo({ filas, nombreArchivo, inicial, confianza, onConfirmar, onCancelar }: Props) {
  const [seleccion, setSeleccion] = useState<Seleccion>(() => ({
    filaEncabezado: inicial?.filaEncabezado ?? null,
    codigo: inicial?.codigo ?? null,
    descripcion: inicial?.descripcion ?? null,
    costo: inicial?.costo ?? null,
    presentacion: inicial?.presentacion ?? null,
  }));
  const idFila = useId();

  const ancho = Math.max(1, ...filas.slice(0, 200).map((f) => f.length));
  const inicio = seleccion.filaEncabezado === null ? 0 : seleccion.filaEncabezado + 1;
  const encabezado = seleccion.filaEncabezado === null ? null : (filas[seleccion.filaEncabezado] ?? []);
  const vistaPrevia = filas.slice(inicio).filter((f) => f.length > 0).slice(0, FILAS_VISTA_PREVIA);

  const mapeo = useMemo<MapeoColumnas | null>(() => {
    const { descripcion, costo } = seleccion;
    if (descripcion === null || costo === null) return null;
    return completarMapeo(filas, { ...seleccion, descripcion, costo });
  }, [filas, seleccion]);
  const resultado = useMemo(() => (mapeo ? extraerLineas(filas, mapeo) : null), [filas, mapeo]);

  function campoDe(columna: number): Campo | '' {
    return CAMPOS.find((c) => seleccion[c] === columna) ?? '';
  }

  function asignar(columna: number, campo: Campo | '') {
    setSeleccion((anterior) => {
      const nueva = { ...anterior };
      // Cada columna es un solo dato y cada dato está en una sola columna.
      for (const c of CAMPOS) if (nueva[c] === columna) nueva[c] = null;
      if (campo !== '') nueva[campo] = columna;
      return nueva;
    });
  }

  const opcionesFila = filas.slice(0, FILAS_BUSCAR_ENCABEZADO).map((fila, i) => {
    const texto = fila.map(textoCelda).filter((t) => t !== '').join(' · ');
    return { valor: i, texto: texto.length > 50 ? `${texto.slice(0, 50)}…` : texto };
  });

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-12">
      <h1 className="text-2xl font-bold">¿Qué columna es cada dato?</h1>
      <p className="mt-1 break-words text-stone-600">{nombreArchivo}</p>
      <p
        className={`mt-4 rounded-xl p-3 ${confianza === 'alta' ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}
        data-testid="aviso-mapeo"
      >
        {inicial === null
          ? 'No pudimos reconocer las columnas. Elegí cuál es la descripción y cuál el precio.'
          : confianza === 'alta'
            ? 'Encontramos las columnas. Revisalas y confirmá: la próxima lista de este proveedor se lee sola.'
            : 'No estamos seguros de las columnas. Revisalas antes de seguir.'}
      </p>

      <label htmlFor={idFila} className="mt-6 block text-lg font-semibold">
        Fila con los títulos
      </label>
      <select
        id={idFila}
        value={seleccion.filaEncabezado ?? ''}
        onChange={(e) =>
          setSeleccion((s) => ({ ...s, filaEncabezado: e.target.value === '' ? null : Number(e.target.value) }))
        }
        className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base"
      >
        <option value="">La lista no tiene títulos</option>
        {opcionesFila.map(({ valor, texto }) => (
          <option key={valor} value={valor}>
            Fila {valor + 1}{texto ? `: ${texto}` : ' (vacía)'}
          </option>
        ))}
      </select>

      <div className="mt-6 overflow-x-auto rounded-xl border border-stone-300 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-stone-100">
            <tr>
              {Array.from({ length: ancho }, (_, columna) => (
                <th key={columna} className="min-w-36 p-2 align-top font-normal">
                  <select
                    aria-label={`Columna ${letraColumna(columna)}`}
                    value={campoDe(columna)}
                    onChange={(e) => asignar(columna, e.target.value as Campo | '')}
                    className={`min-h-11 w-full rounded-lg border px-2 text-base ${
                      campoDe(columna) ? 'border-green-700 bg-green-50 font-semibold text-green-900' : 'border-stone-300 bg-white'
                    }`}
                  >
                    <option value="">No usar</option>
                    {CAMPOS.map((c) => (
                      <option key={c} value={c}>
                        {NOMBRE_CAMPO[c]}
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

      <p className="mt-4 text-lg" data-testid="resumen-mapeo" aria-live="polite">
        {resultado
          ? `Se leen ${resultado.lineas.length} productos${resultado.salteadas.length ? ` y se saltean ${resultado.salteadas.length} filas` : ''}.`
          : 'Elegí al menos la descripción y el precio.'}
      </p>

      <div className="mt-6 space-y-3">
        <Boton
          type="button"
          disabled={!mapeo || !resultado || resultado.lineas.length === 0}
          onClick={() => mapeo && onConfirmar(mapeo)}
        >
          Usar estas columnas
        </Boton>
        <Boton type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </main>
  );
}
