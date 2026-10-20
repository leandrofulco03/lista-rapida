import { useEffect, useState } from 'react';
import { resumenVentas, ventasDelDia } from '../../db';
import type { TicketDelDia } from '../../db';
import type { ConfigComercio } from '../../domain/config';
import { formatearPesos } from '../../domain/dinero';
import { calcularKpis, diaDe, formatearCantidad, nombreMedio, periodoDe, sumarDias, textoVariacion, variacionKpi } from '../../domain/ventas';
import type { Kpis } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { IconoAyuda, IconoFlecha, IconoSubir, IconoVender } from '../../ui/Iconos';
import { AvisoPendientes } from '../ventas/cola';

type Destino = 'subir' | 'catalogo' | 'proveedores' | 'config' | 'equipo' | 'etiquetas' | 'lista-precios' | 'ayuda' | 'vender' | 'ventas' | 'analisis';

interface Props {
  config: ConfigComercio;
  onIr: (pantalla: Destino) => void;
}

interface Datos {
  hoy: Kpis;
  ayer: Kpis;
  semana: Kpis;
  tickets: TicketDelDia[];
}

const ZONA = 'America/Argentina/Buenos_Aires';
/** Cuántas ventas de hoy se muestran (llegan de la más nueva a la más vieja). */
const ULTIMAS = 6;

function saludo(ahora: Date): string {
  const hora = Number(new Intl.DateTimeFormat('es-AR', { hour: 'numeric', hourCycle: 'h23', timeZone: ZONA }).format(ahora));
  if (hora < 6 || hora >= 20) return 'Buenas noches';
  if (hora < 13) return 'Buen día';
  return 'Buenas tardes';
}

const fechaLarga = (d: Date) => new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: ZONA }).format(d);
const horaDe = (fecha: string) => new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ZONA }).format(new Date(fecha));

/**
 * Inicio del dueño: un panel con lo de hoy (cuánto se vendió, en cuántas ventas, el ticket promedio y la semana),
 * las últimas ventas y cómo pagaron. Desde acá se arranca una venta o se sube una lista.
 */
export function PantallaInicio({ config, onIr }: Props) {
  const sesion = useSesion();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);
  const ahora = new Date();
  const hoy = diaDe(ahora);

  useEffect(() => {
    let vigente = true;
    const semana = periodoDe('semana', hoy);
    Promise.all([
      resumenVentas(sesion, hoy, hoy),
      resumenVentas(sesion, sumarDias(hoy, -1), sumarDias(hoy, -1)),
      resumenVentas(sesion, semana.desde, semana.hasta),
      ventasDelDia(sesion, hoy),
    ]).then(
      ([h, a, s, t]) => vigente && setDatos({ hoy: calcularKpis(h), ayer: calcularKpis(a), semana: calcularKpis(s), tickets: t }),
      () => vigente && setError(true),
    );
    return () => {
      vigente = false;
    };
  }, [sesion, hoy]);

  const k = datos?.hoy;
  const variacion = k && datos ? textoVariacion(variacionKpi(k.ventaTotal, datos.ayer.ventaTotal)) : null;
  const ultimas = (datos?.tickets ?? []).filter((t) => !t.anulada).slice(0, ULTIMAS);

  return (
    <main className="mx-auto max-w-6xl">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-green-700">{saludo(ahora)}</p>
          <h1 className="mt-1 text-3xl leading-tight font-bold lg:text-4xl">{config.nombreComercio}</h1>
          <p className="mt-1 text-stone-600 first-letter:uppercase">{fechaLarga(ahora)}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0">
          <button
            type="button"
            onClick={() => onIr('vender')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-600 px-5 font-semibold text-crema shadow-sm shadow-green-900/20 transition hover:bg-green-700 active:scale-[0.99]"
          >
            <IconoVender className="size-5" />
            Nueva venta
          </button>
          <button
            type="button"
            onClick={() => onIr('subir')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-5 font-semibold text-stone-800 shadow-xs transition hover:border-stone-400 hover:bg-stone-50 active:scale-[0.99]"
          >
            <IconoSubir className="size-5" />
            Subí una lista
          </button>
        </div>
      </header>

      <AvisoPendientes onVer={() => onIr('ventas')} />

      {error && (
        <p className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 text-stone-700" role="status">
          No pudimos traer las ventas de hoy. Revisá la conexión.
        </p>
      )}

      <section aria-label="Hoy" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <div className="col-span-2 rounded-2xl bg-marca p-5 text-crema shadow-sm lg:col-span-1" data-testid="inicio-vendido-hoy">
          <p className="text-sm font-medium text-crema/75">Vendido hoy</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{k ? formatearPesos(k.ventaTotal) : '—'}</p>
          <p className="mt-1 text-sm text-crema/75">{variacion ? `${variacion} contra ayer` : 'Ayer no hubo ventas para comparar'}</p>
        </div>
        <Tarjeta nombre="Ventas de hoy" valor={k ? String(k.tickets) : '—'} detalle={k ? `${formatearCantidad(k.articulos)} artículos` : undefined} />
        <Tarjeta nombre="Ticket promedio" valor={k?.ticketPromedio != null ? formatearPesos(k.ticketPromedio) : '—'} />
        <Tarjeta
          nombre="Esta semana"
          valor={datos ? formatearPesos(datos.semana.ventaTotal) : '—'}
          detalle={datos ? `${datos.semana.tickets} ${datos.semana.tickets === 1 ? 'venta' : 'ventas'}` : undefined}
          className="col-span-2 lg:col-span-1"
        />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs lg:col-span-2" aria-labelledby="titulo-ultimas">
          <div className="flex items-center justify-between gap-3">
            <h2 id="titulo-ultimas" className="text-lg font-bold">
              Últimas ventas de hoy
            </h2>
            <button
              type="button"
              onClick={() => onIr('ventas')}
              aria-label="Ver todas las ventas"
              className="flex min-h-10 shrink-0 items-center gap-1 text-sm font-semibold whitespace-nowrap text-green-700 hover:underline"
            >
              Ver todas
              <IconoFlecha className="size-4" />
            </button>
          </div>
          {datos && ultimas.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-stone-300 p-6 text-center">
              <p className="font-semibold text-stone-800">Todavía no hay ventas hoy</p>
              <p className="mt-1 text-sm text-stone-600">Tocá “Nueva venta” para cargar la primera.</p>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-stone-200" data-testid="inicio-ultimas">
              {ultimas.map((t) => (
                <li key={t.id} className="flex items-center gap-3 py-3">
                  <span className="w-12 shrink-0 text-sm text-stone-600 tabular-nums">{horaDe(t.fecha)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{t.lineas.map((l) => l.descripcion).join(', ') || 'Venta'}</span>
                    <span className="block text-sm text-stone-600">
                      {nombreMedio(t.medioPago)} · {t.vendedor}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold tabular-nums">{formatearPesos(t.total)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs" aria-labelledby="titulo-medios">
            <h2 id="titulo-medios" className="text-lg font-bold">
              Cómo te pagaron hoy
            </h2>
            {k && k.porMedio.length > 0 ? (
              <ul className="mt-3 space-y-3">
                {k.porMedio.map((m) => (
                  <li key={m.medio}>
                    <div className="flex justify-between gap-2 text-sm tabular-nums">
                      <span>{nombreMedio(m.medio)}</span>
                      <span className="font-semibold">{formatearPesos(m.total)}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-stone-100" aria-hidden="true">
                      <div className="h-2 rounded-full bg-green-600" style={{ width: `${Math.max(2, m.porcentaje * 100)}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-stone-600">Sin ventas todavía.</p>
            )}
          </section>

          {/* El texto no repite el nombre de ninguna sección del menú: las pruebas buscan esos botones por su nombre. */}
          <button
            type="button"
            onClick={() => onIr('ayuda')}
            className="group flex w-full items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-left transition hover:border-green-300"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-green-700 shadow-xs">
              <IconoAyuda className="size-6" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-green-900">¿Cómo se usa?</span>
              <span className="block text-sm text-green-800">Guía paso a paso y preguntas frecuentes</span>
            </span>
            <IconoFlecha className="size-5 shrink-0 text-green-700 transition group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </main>
  );
}

function Tarjeta({ nombre, valor, detalle, className = '' }: { nombre: string; valor: string; detalle?: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-stone-200 bg-white p-5 shadow-xs ${className}`}>
      <p className="text-sm font-medium text-stone-600">{nombre}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="mt-1 text-sm text-stone-600">{detalle}</p>}
    </div>
  );
}
