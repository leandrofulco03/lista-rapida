import { formatearPesos } from '../../domain/dinero';
import { TEXTO_MOTIVO } from '../../domain/lectura';
import type { ResultadoLectura } from '../../domain/lectura';
import { Boton } from '../../ui/Boton';

interface Props {
  proveedor: string;
  archivo: string;
  resultado: ResultadoLectura;
  /** Lo que dijo el usuario del proveedor; vale cuando el título del precio no lo aclara. */
  listaIncluyeIva: boolean;
  /** true si se usaron las columnas recordadas del proveedor sin preguntar. */
  automatico: boolean;
  onCorregir: () => void;
  onVolver: () => void;
}

const MOSTRAR = 100;

/** F04: lo que se leyó de la lista. Comparar con el catálogo y actualizar precios llega con F07 y F09. */
export function ResumenLectura({ proveedor, archivo, resultado, listaIncluyeIva, automatico, onCorregir, onVolver }: Props) {
  const { lineas, salteadas } = resultado;
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <p className="text-sm font-semibold text-green-800">{proveedor}</p>
      <h1 className="mt-1 text-2xl font-bold" data-testid="titulo-resultado">
        Leímos {lineas.length} productos
      </h1>
      <p className="mt-1 break-words text-stone-600">{archivo}</p>
      {automatico && (
        <p className="mt-4 rounded-xl bg-green-50 p-3 text-green-900" data-testid="aviso-automatico">
          Usamos las columnas que ya conocíamos de {proveedor}.
        </p>
      )}

      {salteadas.length > 0 && (
        <details className="mt-4 rounded-xl border border-stone-300 bg-white p-3">
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

      <ul className="mt-4 divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white" data-testid="lineas-leidas">
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

      <p className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-4 text-stone-600">
        Pronto vas a poder comparar esta lista con tu catálogo y actualizar los precios.
      </p>

      <div className="mt-6 space-y-3">
        <Boton type="button" onClick={onVolver}>
          Listo
        </Boton>
        <Boton type="button" variante="secundario" onClick={onCorregir}>
          Corregir columnas
        </Boton>
      </div>
    </main>
  );
}
