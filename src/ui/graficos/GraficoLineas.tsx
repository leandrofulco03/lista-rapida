import { useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';
import { escalaRedonda, pesosCompactos, TablaDatos, Tooltip, useAncho } from './comun';

export interface PuntoLinea {
  /** Texto corto para el eje ("14/10"). */
  corto: string;
  /** Texto largo para el tooltip y la tabla ("martes 14 de octubre"). */
  largo: string;
  valor: number;
}

interface Props {
  titulo: string;
  puntos: PuntoLinea[];
  formatear: (valor: number) => string;
}

const ALTO = 200;
const M = { arriba: 16, abajo: 26, izq: 52, der: 12 };

/**
 * Una serie en el tiempo: línea de 2px con un lavado suave debajo, grilla de líneas finas, el último valor marcado.
 * Al pasar el dedo o el mouse (o con las flechas del teclado) una línea vertical busca el día y muestra el valor.
 */
export function GraficoLineas({ titulo, puntos, formatear }: Props) {
  const [ref, ancho] = useAncho<HTMLDivElement>();
  const [activo, setActivo] = useState<number | null>(null);
  const marcas = escalaRedonda(Math.max(...puntos.map((p) => p.valor), 0));
  const tope = marcas[marcas.length - 1]!;
  const anchoPlot = Math.max(0, ancho - M.izq - M.der);
  const altoPlot = ALTO - M.arriba - M.abajo;
  const x = (i: number) => M.izq + (puntos.length <= 1 ? anchoPlot / 2 : (i / (puntos.length - 1)) * anchoPlot);
  const y = (v: number) => M.arriba + altoPlot - (v / tope) * altoPlot;
  const linea = puntos.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(' ');
  const area = puntos.length > 1 ? `${linea} L${x(puntos.length - 1)},${y(0)} L${x(0)},${y(0)} Z` : '';
  // Etiquetas del eje x: la primera, la del medio y la última, para que no se pisen.
  const etiquetasX = puntos.length <= 3 ? puntos.map((_, i) => i) : [0, Math.floor((puntos.length - 1) / 2), puntos.length - 1];
  const ultimo = puntos.length - 1;

  function mover(e: PointerEvent<SVGSVGElement>) {
    const caja = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - caja.left - M.izq;
    const i = puntos.length <= 1 ? 0 : Math.round((px / anchoPlot) * (puntos.length - 1));
    setActivo(Math.min(Math.max(i, 0), ultimo));
  }
  function teclas(e: KeyboardEvent<SVGSVGElement>) {
    if (e.key === 'ArrowRight') setActivo((a) => Math.min((a ?? -1) + 1, ultimo));
    else if (e.key === 'ArrowLeft') setActivo((a) => Math.max((a ?? ultimo + 1) - 1, 0));
    else return;
    e.preventDefault();
  }

  return (
    <figure>
      <div ref={ref} className="relative w-full" style={{ height: ALTO }}>
        {ancho > 0 && puntos.length > 0 && (
          <svg
            width={ancho}
            height={ALTO}
            role="img"
            aria-label={`${titulo}. Usá las flechas para recorrer los días.`}
            tabIndex={0}
            onPointerMove={mover}
            onPointerLeave={() => setActivo(null)}
            onFocus={() => setActivo(ultimo)}
            onBlur={() => setActivo(null)}
            onKeyDown={teclas}
            className="touch-pan-y outline-none"
          >
            {marcas.map((m) => (
              <g key={m}>
                <line x1={M.izq} x2={ancho - M.der} y1={y(m)} y2={y(m)} stroke="var(--graf-grilla)" strokeWidth={1} />
                <text x={M.izq - 6} y={y(m)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--graf-texto-2)" className="tabular-nums">
                  {pesosCompactos(m)}
                </text>
              </g>
            ))}
            {etiquetasX.map((i) => (
              <text key={i} x={x(i)} y={ALTO - 8} textAnchor={i === 0 ? 'start' : i === ultimo ? 'end' : 'middle'} fontSize={11} fill="var(--graf-texto-2)">
                {puntos[i]!.corto}
              </text>
            ))}
            {area && <path d={area} fill="var(--graf-serie-1)" opacity={0.1} />}
            <path d={linea} fill="none" stroke="var(--graf-serie-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            {activo !== null && <line x1={x(activo)} x2={x(activo)} y1={M.arriba} y2={y(0)} stroke="var(--graf-eje)" strokeWidth={1} />}
            {[activo ?? ultimo].map((i) => (
              <circle key={i} cx={x(i)} cy={y(puntos[i]!.valor)} r={4} fill="var(--graf-serie-1)" stroke="var(--graf-superficie)" strokeWidth={2} />
            ))}
          </svg>
        )}
        {activo !== null && (
          <Tooltip x={x(activo)} y={y(puntos[activo]!.valor)} ancho={ancho} valor={formatear(puntos[activo]!.valor)} etiqueta={puntos[activo]!.largo} />
        )}
      </div>
      <TablaDatos titulo={titulo} columnas={['Día', 'Ventas']} filas={puntos.map((p) => [p.largo, formatear(p.valor)])} />
    </figure>
  );
}
