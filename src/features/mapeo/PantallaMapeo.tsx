import { useMemo, useState } from 'react';
import { CAMPOS, completarMapeo } from '../../domain/columnas';
import type { Campo, Confianza, MapeoColumnas } from '../../domain/columnas';
import type { Celda } from '../../domain/importe';
import { extraerLineas } from '../../domain/lectura';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoColumnas } from '../../ui/Iconos';
import { SelectorColumnas } from './SelectorColumnas';
import type { Seleccion } from './SelectorColumnas';

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

/** F06: el usuario confirma o corrige qué columna es cada dato. Queda guardado para ese proveedor. */
export function PantallaMapeo({ filas, nombreArchivo, inicial, confianza, onConfirmar, onCancelar }: Props) {
  const [seleccion, setSeleccion] = useState<Seleccion<Campo>>(() => ({
    filaEncabezado: inicial?.filaEncabezado ?? null,
    codigo: inicial?.codigo ?? null,
    descripcion: inicial?.descripcion ?? null,
    costo: inicial?.costo ?? null,
    presentacion: inicial?.presentacion ?? null,
  }));

  const mapeo = useMemo<MapeoColumnas | null>(() => {
    const { descripcion, costo } = seleccion;
    if (descripcion === null || costo === null) return null;
    return completarMapeo(filas, { ...seleccion, descripcion, costo });
  }, [filas, seleccion]);
  const resultado = useMemo(() => (mapeo ? extraerLineas(filas, mapeo) : null), [filas, mapeo]);

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-12">
      <Encabezado Icono={IconoColumnas} titulo="¿Qué columna es cada dato?" descripcion={nombreArchivo} />
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

      <SelectorColumnas filas={filas} campos={CAMPOS} nombres={NOMBRE_CAMPO} seleccion={seleccion} onCambiar={setSeleccion} />

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
