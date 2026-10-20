import { TablaDatos } from './comun';

export interface FilaBarra {
  nombre: string;
  valor: number;
  /** Texto chico debajo del nombre ("12 unidades · ganancia $3.400"). */
  detalle?: string;
}

interface Props {
  titulo: string;
  filas: FilaBarra[];
  formatear: (valor: number) => string;
  /** Columnas extra para la tabla de datos. */
  tabla?: { columnas: string[]; filas: string[][] };
}

/**
 * Comparar cantidades entre cosas sin orden propio (productos, rubros): barras horizontales de un solo color,
 * finas, con el valor escrito en la punta. Ordenadas de mayor a menor.
 */
export function BarrasHorizontales({ titulo, filas, formatear, tabla }: Props) {
  const maximo = Math.max(...filas.map((f) => f.valor), 1);
  return (
    <figure>
      <ul className="space-y-3" aria-label={titulo}>
        {filas.map((f) => (
          <li key={f.nombre}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate text-stone-800">{f.nombre}</span>
              <span className="shrink-0 font-semibold text-stone-900 tabular-nums">{formatear(f.valor)}</span>
            </div>
            <div className="mt-1 h-3" aria-hidden="true">
              <div className="h-3 rounded-r" style={{ width: `${Math.max(1, (f.valor / maximo) * 100)}%`, background: 'var(--graf-unica)' }} />
            </div>
            {f.detalle && <p className="mt-0.5 text-xs text-stone-600">{f.detalle}</p>}
          </li>
        ))}
      </ul>
      <TablaDatos
        titulo={titulo}
        columnas={tabla?.columnas ?? ['', 'Valor']}
        filas={tabla?.filas ?? filas.map((f) => [f.nombre, formatear(f.valor)])}
      />
    </figure>
  );
}
