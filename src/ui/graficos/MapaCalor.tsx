import { useState } from 'react';
import { TablaDatos } from './comun';

interface Props {
  titulo: string;
  filas: string[];
  /** Nombre largo de cada fila, para el tooltip ("martes"). */
  filasLargas: string[];
  columnas: number[];
  /** valores[fila][columna] */
  valores: { importe: number; ventas: number }[][];
  maximo: number;
  formatear: (valor: number) => string;
}

/** Cinco pasos de un solo tono, de claro (poco) a oscuro (mucho); el gris es "sin ventas". */
const PASOS = ['var(--graf-sec-1)', 'var(--graf-sec-2)', 'var(--graf-sec-3)', 'var(--graf-sec-4)', 'var(--graf-sec-5)'];

const paso = (v: number, max: number) => (v <= 0 || max <= 0 ? -1 : Math.min(PASOS.length - 1, Math.floor((v / max) * PASOS.length)));
const hora = (h: number) => `${String(h).padStart(2, '0')} h`;

/** Mapa de día de la semana × hora: cuánto se vende en cada franja. */
export function MapaCalor({ titulo, filas, filasLargas, columnas, valores, maximo, formatear }: Props) {
  const [activa, setActiva] = useState<{ f: number; c: number } | null>(null);
  const celda = activa ? valores[activa.f]![activa.c]! : null;

  return (
    <figure>
      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-0.5 text-xs" aria-label={titulo}>
          <thead>
            <tr>
              <th />
              {columnas.map((c, i) => (
                <th key={c} scope="col" className="w-6 font-normal text-stone-600 tabular-nums">
                  {i % 2 === 0 ? c : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((nombre, f) => (
              <tr key={nombre}>
                <th scope="row" className="pr-1 text-left font-normal text-stone-600">
                  {nombre}
                </th>
                {columnas.map((c, ci) => {
                  const v = valores[f]![ci]!;
                  const p = paso(v.importe, maximo);
                  const enfocada = activa?.f === f && activa.c === ci;
                  return (
                    <td
                      key={c}
                      tabIndex={0}
                      aria-label={`${filasLargas[f]} ${hora(c)}: ${formatear(v.importe)}, ${v.ventas} ventas`}
                      onPointerEnter={() => setActiva({ f, c: ci })}
                      onPointerLeave={() => setActiva(null)}
                      onFocus={() => setActiva({ f, c: ci })}
                      onBlur={() => setActiva(null)}
                      className={`h-6 w-6 rounded-[3px] outline-none ${enfocada ? 'ring-2 ring-stone-800' : ''}`}
                      style={{ background: p < 0 ? 'var(--graf-sec-0)' : PASOS[p] }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 min-h-5 text-sm text-stone-800" role="status">
        {celda && activa
          ? `${filasLargas[activa.f]} de ${hora(columnas[activa.c]!)} a ${hora(columnas[activa.c]! + 1)}: ${formatear(celda.importe)} en ${celda.ventas} ${celda.ventas === 1 ? 'venta' : 'ventas'}`
          : 'Tocá un cuadrado para ver cuánto vendiste.'}
      </p>
      <div className="mt-1 flex items-center gap-1 text-xs text-stone-600" aria-hidden="true">
        <span>Menos</span>
        <span className="h-3 w-4 rounded-sm" style={{ background: 'var(--graf-sec-0)' }} />
        {PASOS.map((p) => (
          <span key={p} className="h-3 w-4 rounded-sm" style={{ background: p }} />
        ))}
        <span>Más</span>
      </div>
      <TablaDatos
        titulo={titulo}
        columnas={['Día', 'Hora', 'Ventas', 'Importe']}
        filas={valores.flatMap((fila, f) =>
          fila.flatMap((v, ci) => (v.ventas > 0 ? [[filasLargas[f]!, hora(columnas[ci]!), String(v.ventas), formatear(v.importe)]] : [])),
        )}
      />
    </figure>
  );
}
