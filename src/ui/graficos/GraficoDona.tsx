import { useState } from 'react';
import { SERIES, TablaDatos } from './comun';

export interface PorcionDona {
  nombre: string;
  valor: number;
  /** Parte del total, 0–1. */
  parte: number;
  /** "Otros": va en gris. */
  resto: boolean;
}

interface Props {
  titulo: string;
  porciones: PorcionDona[];
  formatear: (valor: number) => string;
}

const TAM = 168;
const R = 76;
const GROSOR = 26;

const porcentaje = (p: number) => `${Math.round(p * 100)}%`;

/** Punto del círculo para un ángulo (0 = arriba, sentido horario). */
function punto(angulo: number, radio: number): [number, number] {
  return [TAM / 2 + radio * Math.sin(angulo), TAM / 2 - radio * Math.cos(angulo)];
}

function arco(desde: number, hasta: number): string {
  const r1 = R;
  const r0 = R - GROSOR;
  const grande = hasta - desde > Math.PI ? 1 : 0;
  const [x1, y1] = punto(desde, r1);
  const [x2, y2] = punto(hasta, r1);
  const [x3, y3] = punto(hasta, r0);
  const [x4, y4] = punto(desde, r0);
  return `M${x1},${y1} A${r1},${r1} 0 ${grande} 1 ${x2},${y2} L${x3},${y3} A${r0},${r0} 0 ${grande} 0 ${x4},${y4} Z`;
}

/**
 * Parte de un todo con pocas porciones (hasta 5 y "Otros"). Cada porción tiene su color en orden fijo y una
 * separación del color del fondo; la leyenda de al lado dice nombre, valor y porcentaje (el color nunca va solo).
 */
export function GraficoDona({ titulo, porciones, formatear }: Props) {
  const [activa, setActiva] = useState<number | null>(null);
  const color = (i: number) => (porciones[i]!.resto ? 'var(--graf-otros)' : SERIES[i % SERIES.length]!);
  let angulo = 0;
  const arcos = porciones.map((p) => {
    const desde = angulo;
    angulo += p.parte * 2 * Math.PI;
    // Una sola porción es el círculo entero (un arco de 360° no se dibuja).
    return p.parte >= 0.9999 ? arco(0, 2 * Math.PI - 0.0001) : arco(desde, angulo);
  });
  const centro = activa === null ? null : porciones[activa]!;

  return (
    <figure>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <svg width={TAM} height={TAM} role="img" aria-label={titulo} className="shrink-0">
          {arcos.map((d, i) => (
            <path
              key={i}
              d={d}
              fill={color(i)}
              stroke="var(--graf-superficie)"
              strokeWidth={2}
              opacity={activa === null || activa === i ? 1 : 0.45}
              tabIndex={0}
              aria-label={`${porciones[i]!.nombre}: ${formatear(porciones[i]!.valor)}, ${porcentaje(porciones[i]!.parte)}`}
              onPointerEnter={() => setActiva(i)}
              onPointerLeave={() => setActiva(null)}
              onFocus={() => setActiva(i)}
              onBlur={() => setActiva(null)}
              className="cursor-default outline-none"
            />
          ))}
          {centro && (
            <>
              <text x={TAM / 2} y={TAM / 2 - 4} textAnchor="middle" fontSize={16} fontWeight={700} fill="var(--graf-texto)">
                {porcentaje(centro.parte)}
              </text>
              <text x={TAM / 2} y={TAM / 2 + 14} textAnchor="middle" fontSize={11} fill="var(--graf-texto-2)">
                {centro.nombre.length > 14 ? `${centro.nombre.slice(0, 13)}…` : centro.nombre}
              </text>
            </>
          )}
        </svg>
        <ul className="w-full space-y-1.5" aria-label="Leyenda">
          {porciones.map((p, i) => (
            <li
              key={p.nombre}
              className={`flex items-center gap-2 rounded-lg px-1 text-sm ${activa === i ? 'bg-stone-100' : ''}`}
              onPointerEnter={() => setActiva(i)}
              onPointerLeave={() => setActiva(null)}
            >
              <span aria-hidden="true" className="size-3 shrink-0 rounded-sm" style={{ background: color(i) }} />
              <span className="min-w-0 flex-1 truncate text-stone-800">{p.nombre}</span>
              <span className="font-semibold text-stone-900 tabular-nums">{formatear(p.valor)}</span>
              <span className="w-10 text-right text-stone-600 tabular-nums">{porcentaje(p.parte)}</span>
            </li>
          ))}
        </ul>
      </div>
      <TablaDatos titulo={titulo} columnas={['', 'Valor', '%']} filas={porciones.map((p) => [p.nombre, formatear(p.valor), porcentaje(p.parte)])} />
    </figure>
  );
}
