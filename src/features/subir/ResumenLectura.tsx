import { formatearPesos } from '../../domain/dinero';
import { TEXTO_MOTIVO } from '../../domain/lectura';
import type { ResultadoLectura } from '../../domain/lectura';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoListo } from '../../ui/Iconos';

interface Props {
  proveedor: string;
  archivo: string;
  resultado: ResultadoLectura;
  /** Lo que dijo el usuario del proveedor; vale cuando el título del precio no lo aclara. */
  listaIncluyeIva: boolean;
  /** true si se usaron las columnas recordadas del proveedor sin preguntar. */
  automatico: boolean;
  onCorregir: () => void;
  onComparar: () => void;
  onVolver: () => void;
}

const MOSTRAR = 100;

/** F04: lo que se leyó de la lista. Desde acá se compara con el catálogo (F07); actualizar precios llega con F09. */
export function ResumenLectura({ proveedor, archivo, resultado, listaIncluyeIva, automatico, onCorregir, onComparar, onVolver }: Props) {
  const { lineas, salteadas } = resultado;
  return (
    <main className="mx-auto max-w-3xl">
      <Encabezado
        Icono={IconoListo}
        antetitulo={proveedor}
        titulo={`Leímos ${lineas.length} productos`}
        testIdTitulo="titulo-resultado"
        descripcion={archivo}
      />
      {automatico && (
        <p className="mt-4 rounded-xl bg-green-50 p-3 text-green-900" data-testid="aviso-automatico">
          Usamos las columnas que ya conocíamos de {proveedor}.
        </p>
      )}

      {salteadas.length > 0 && (
        <details className="mt-4 rounded-xl border border-stone-200 bg-white shadow-sm p-3">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            {salteadas.length} {salteadas.length === 1 ? 'fila salteada' : 'filas salteadas'}
          </summary>
          <ul className="mt-2 space-y-2 text-sm">
            {salteadas.map((s) => (
              <li key={s.fila}>
                <span className="font-medium">Fila {s.fila}:</span> {TEXTO_MOTIVO[s.motivo]}
                <span className="block break-words text-stone-500">{s.texto}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      <ul className="mt-4 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm" data-testid="lineas-leidas">
        {lineas.slice(0, MOSTRAR).map((l) => (
          <li key={l.filaOrigen} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="break-words font-medium">{l.descripcion}</p>
              <p className="text-sm text-stone-500">
                {[l.codigo, l.presentacion].filter(Boolean).join(' · ') || `Fila ${l.filaOrigen}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-semibold">{formatearPesos(l.costo)}</p>
              <p className="text-xs text-stone-500">{(l.ivaIncluido ?? listaIncluyeIva) ? 'con IVA' : '+ IVA'}</p>
            </div>
          </li>
        ))}
      </ul>
      {lineas.length > MOSTRAR && <p className="mt-2 text-sm text-stone-600">Y {lineas.length - MOSTRAR} más.</p>}

      <div className="mt-6 space-y-3">
        <Boton type="button" onClick={onComparar} disabled={lineas.length === 0}>
          Comparar con mi catálogo
        </Boton>
        <Boton type="button" variante="secundario" onClick={onCorregir}>
          Corregir columnas
        </Boton>
        <Boton type="button" variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </div>
    </main>
  );
}
