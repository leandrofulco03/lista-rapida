import { useEffect, useState } from 'react';
import { resumenVentas } from '../../db';
import { formatearPesos } from '../../domain/dinero';
import {
  calcularKpis,
  diaDe,
  formatearCantidad,
  nombreMedio,
  nombrePeriodo,
  periodoAnterior,
  periodoDe,
  periodoSiguiente,
  textoVariacion,
  variacionKpi,
} from '../../domain/ventas';
import type { Dia, Kpis, Periodo, TipoPeriodo } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoLista } from '../../ui/Iconos';
import { AvisoPendientes } from './cola';

interface Props {
  onVender: () => void;
  onVerTickets: (dia: Dia) => void;
  onTotalDia: (dia: Dia) => void;
  onVolver: () => void;
}

const TIPOS: { tipo: TipoPeriodo; nombre: string }[] = [
  { tipo: 'dia', nombre: 'Día' },
  { tipo: 'semana', nombre: 'Semana' },
  { tipo: 'mes', nombre: 'Mes' },
];

const COMPARACION: Record<TipoPeriodo, string> = { dia: 'el día anterior', semana: 'la semana anterior', mes: 'el mes anterior' };

/** Fase 8: resumen de ventas del dueño, por día, semana o mes, contra el período anterior. */
export function PantallaResumen({ onVender, onVerTickets, onTotalDia, onVolver }: Props) {
  const sesion = useSesion();
  const hoy = diaDe(new Date());
  const [periodo, setPeriodo] = useState<Periodo>(periodoDe('dia', hoy));
  const [datos, setDatos] = useState<{ actual: Kpis; anterior: Kpis } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    setDatos(null);
    const antes = periodoAnterior(periodo);
    Promise.all([resumenVentas(sesion, periodo.desde, periodo.hasta), resumenVentas(sesion, antes.desde, antes.hasta)]).then(
      ([a, b]) => vigente && setDatos({ actual: calcularKpis(a), anterior: calcularKpis(b) }),
      (e: Error) => vigente && setError(e.message),
    );
    return () => {
      vigente = false;
    };
  }, [periodo, sesion]);

  const k = datos?.actual;
  const ant = datos?.anterior;
  const variacion = (a: number | null | undefined, b: number | null | undefined) => textoVariacion(variacionKpi(a ?? null, b ?? null));

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado Icono={IconoLista} titulo="Ventas" descripcion="Cuánto vendiste, en cuántas ventas y cómo te pagaron." />
      <AvisoPendientes />

      <Boton type="button" onClick={onVender} className="mt-4">
        Nueva venta
      </Boton>

      <div className="mt-6 grid grid-cols-3 gap-2" role="group" aria-label="Período">
        {TIPOS.map((t) => (
          <button
            key={t.tipo}
            type="button"
            aria-pressed={periodo.tipo === t.tipo}
            onClick={() => setPeriodo(periodoDe(t.tipo, hoy))}
            className={`min-h-11 rounded-xl border font-medium ${periodo.tipo === t.tipo ? 'border-green-600 bg-green-600 text-white' : 'border-stone-200 bg-white'}`}
          >
            {t.nombre}
          </button>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button type="button" aria-label="Período anterior" onClick={() => setPeriodo(periodoAnterior(periodo))} className="size-11 rounded-xl border border-stone-200 bg-white text-xl">
          ‹
        </button>
        <p className="text-center font-semibold" data-testid="periodo">
          {nombrePeriodo(periodo, hoy)}
        </p>
        <button
          type="button"
          aria-label="Período siguiente"
          disabled={periodo.hasta >= hoy}
          onClick={() => setPeriodo(periodoSiguiente(periodo))}
          className="size-11 rounded-xl border border-stone-200 bg-white text-xl disabled:opacity-40"
        >
          ›
        </button>
      </div>

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}

      {k && ant && (
        <>
          <section className="mt-4 rounded-3xl bg-linear-to-br from-green-600 to-emerald-800 p-5 text-white shadow-lg" data-testid="kpi-venta-total">
            <p className="text-green-50">Venta total</p>
            <p className="text-4xl font-bold tabular-nums">{formatearPesos(k.ventaTotal)}</p>
            <p className="mt-1 text-sm text-green-50">
              {variacion(k.ventaTotal, ant.ventaTotal)
                ? `${variacion(k.ventaTotal, ant.ventaTotal)} contra ${COMPARACION[periodo.tipo]} (${formatearPesos(ant.ventaTotal)})`
                : `Sin ventas en ${COMPARACION[periodo.tipo]} para comparar`}
            </p>
          </section>

          <dl className="mt-3 grid grid-cols-2 gap-3">
            <Tarjeta nombre="Ventas" valor={String(k.tickets)} variacion={variacion(k.tickets, ant.tickets)} testId="kpi-tickets" />
            <Tarjeta
              nombre="Ticket promedio"
              valor={k.ticketPromedio === null ? '—' : formatearPesos(k.ticketPromedio)}
              variacion={variacion(k.ticketPromedio, ant.ticketPromedio)}
              testId="kpi-ticket-promedio"
            />
            <Tarjeta nombre="Artículos vendidos" valor={formatearCantidad(k.articulos)} variacion={variacion(k.articulos, ant.articulos)} testId="kpi-articulos" />
            <Tarjeta
              nombre="Artículos por venta"
              valor={k.articulosPorTicket === null ? '—' : formatearCantidad(k.articulosPorTicket)}
              variacion={variacion(k.articulosPorTicket, ant.articulosPorTicket)}
              testId="kpi-articulos-por-venta"
            />
          </dl>

          {k.diasSinDetalle > 0 && (
            <p className="mt-3 rounded-xl bg-stone-100 p-3 text-stone-700">
              Incluye {formatearPesos(k.totalSinDetalle)} cargados como total del día ({k.diasSinDetalle === 1 ? '1 día' : `${k.diasSinDetalle} días`}). Esas ventas no
              cuentan en el ticket promedio ni en los artículos.
            </p>
          )}

          <section className="mt-6">
            <h2 className="text-lg font-semibold">Cómo te pagaron</h2>
            {k.porMedio.length === 0 ? (
              <p className="mt-1 text-stone-600">Sin ventas en este período.</p>
            ) : (
              <ul className="mt-2 space-y-2" data-testid="por-medio">
                {k.porMedio.map((m) => (
                  <li key={m.medio}>
                    <div className="flex justify-between gap-2 tabular-nums">
                      <span>{nombreMedio(m.medio)}</span>
                      <span className="font-semibold">
                        {formatearPesos(m.total)} <span className="font-normal text-stone-600">({Math.round(m.porcentaje * 100)}%)</span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-stone-200" aria-hidden="true">
                      <div className="h-2 rounded-full bg-green-600" style={{ width: `${Math.max(2, m.porcentaje * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {periodo.tipo === 'dia' && (
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Boton type="button" variante="secundario" onClick={() => onVerTickets(periodo.desde)}>
            Ver ventas
          </Boton>
          <Boton type="button" variante="secundario" onClick={() => onTotalDia(periodo.desde)}>
            Total del día
          </Boton>
        </div>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-6">
        Volver
      </Boton>
    </main>
  );
}

function Tarjeta({ nombre, valor, variacion, testId }: { nombre: string; valor: string; variacion: string | null; testId: string }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm" data-testid={testId}>
      <dt className="text-sm text-stone-600">{nombre}</dt>
      <dd className="text-xl font-bold tabular-nums">{valor}</dd>
      {variacion && <dd className="text-sm text-stone-600">{variacion}</dd>}
    </div>
  );
}
