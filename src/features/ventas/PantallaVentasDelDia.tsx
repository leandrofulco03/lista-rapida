import { useEffect, useState } from 'react';
import { anularVenta, baseDispositivo, descartarPendiente, ventasDelDia } from '../../db';
import type { TicketDelDia } from '../../db';
import { formatearPesos } from '../../domain/dinero';
import { diaDe, formatearCantidad, nombreMedio, nombrePeriodo, periodoDe, sumarDias, totalTicket } from '../../domain/ventas';
import type { Dia } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { useCola } from './cola';

interface Props {
  /** El dueño puede ver otros días y los tickets de todos; el empleado, sólo los suyos de hoy. */
  esDueno: boolean;
  diaInicial?: Dia;
  onVolver: () => void;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Tickets de un día, con su detalle; se anulan desde acá. Arriba, lo que todavía no se subió. */
export function PantallaVentasDelDia({ esDueno, diaInicial, onVolver }: Props) {
  const sesion = useSesion();
  const cola = useCola();
  const hoy = diaDe(new Date());
  const [dia, setDia] = useState<Dia>(diaInicial ?? hoy);
  const [tickets, setTickets] = useState<TicketDelDia[] | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [aAnular, setAAnular] = useState<TicketDelDia | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = () =>
    ventasDelDia(sesion, dia).then(
      (t) => {
        setTickets(t);
        setError(null);
      },
      (e: Error) => {
        setTickets([]);
        setError(e.message);
      },
    );
  useEffect(() => {
    setTickets(null);
    cargar();
    cola.actualizar();
  }, [dia]);

  async function anular(t: TicketDelDia) {
    setError(null);
    try {
      await anularVenta(sesion, t.id);
      setAAnular(null);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const validos = (tickets ?? []).filter((t) => !t.anulada);
  const total = validos.reduce((s, t) => s + t.total, 0);
  const pendientesDelDia = cola.pendientes.filter((p) => diaDe(new Date(p.venta.fecha)) === dia);

  return (
    <main className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold">{esDueno ? 'Ventas del día' : 'Mis ventas de hoy'}</h1>
      {esDueno && (
        <div className="mt-3 flex items-center justify-between gap-2">
          <button type="button" aria-label="Día anterior" onClick={() => setDia(sumarDias(dia, -1))} className="size-11 rounded-xl border border-stone-200 bg-white text-xl">
            ‹
          </button>
          <p className="font-semibold" data-testid="dia-elegido">
            {nombrePeriodo(periodoDe('dia', dia), hoy)}
          </p>
          <button
            type="button"
            aria-label="Día siguiente"
            disabled={dia >= hoy}
            onClick={() => setDia(sumarDias(dia, 1))}
            className="size-11 rounded-xl border border-stone-200 bg-white text-xl disabled:opacity-40"
          >
            ›
          </button>
        </div>
      )}

      <section className="mt-4 rounded-2xl bg-green-50 p-4 text-green-950">
        <p className="text-sm">{validos.length === 1 ? '1 venta' : `${validos.length} ventas`}</p>
        <p className="text-3xl font-bold tabular-nums" data-testid="total-dia">
          {formatearPesos(total)}
        </p>
        {pendientesDelDia.length > 0 && (
          <p className="mt-1 text-sm">
            Más {formatearPesos(pendientesDelDia.reduce((s, p) => s + totalTicket(p.venta.lineas), 0))} sin subir todavía.
          </p>
        )}
      </section>

      {cola.pendientes.length > 0 && (
        <section className="mt-4">
          <h2 className="text-lg font-semibold">Sin subir</h2>
          <p className="text-stone-600">Están guardadas en este dispositivo y se suben solas cuando haya internet.</p>
          <ul className="mt-2 space-y-2" data-testid="pendientes">
            {cola.pendientes.map((p) => (
              <li key={p.id} className={`rounded-xl border p-3 ${p.error ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                <p className="font-semibold tabular-nums">
                  {hora(p.venta.fecha)} · {formatearPesos(totalTicket(p.venta.lineas))} · {nombreMedio(p.venta.medioPago)}
                </p>
                {p.error && (
                  <>
                    <p className="text-red-900">{p.error}</p>
                    <button
                      type="button"
                      onClick={() => descartarPendiente(baseDispositivo(), p.id).then(cola.actualizar)}
                      className="min-h-11 font-semibold text-red-800 underline underline-offset-4"
                    >
                      Descartar esta venta
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
          <Boton type="button" variante="secundario" onClick={() => cola.reintentar()} className="mt-2">
            Subir ahora
          </Boton>
        </section>
      )}

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}

      <ul className="mt-4 space-y-2" data-testid="tickets">
        {tickets?.length === 0 && <li className="text-stone-600">No hay ventas cargadas este día.</li>}
        {tickets?.map((t) => (
          <li key={t.id} className={`rounded-2xl border bg-white shadow-sm ${t.anulada ? 'border-stone-200 opacity-60' : 'border-stone-200'}`}>
            <button type="button" onClick={() => setAbierto(abierto === t.id ? null : t.id)} className="flex min-h-12 w-full items-center gap-3 p-3 text-left">
              <span className="min-w-0 flex-1">
                <span className="block font-semibold tabular-nums">
                  {hora(t.fecha)} · {nombreMedio(t.medioPago)}
                  {t.anulada && <span className="ml-2 rounded bg-stone-200 px-1.5 text-sm">Anulada</span>}
                </span>
                <span className="block text-sm text-stone-600">
                  {formatearCantidad(t.articulos)} {t.articulos === 1 ? 'artículo' : 'artículos'}
                  {esDueno && t.vendedor ? ` · ${t.vendedor}` : ''}
                </span>
              </span>
              <span className={`text-lg font-bold tabular-nums ${t.anulada ? 'line-through' : ''}`}>{formatearPesos(t.total)}</span>
            </button>
            {abierto === t.id && (
              <div className="border-t border-stone-200 p-3">
                <ul className="space-y-1 text-stone-700">
                  {t.lineas.map((l, i) => (
                    <li key={i} className="flex gap-2 tabular-nums">
                      <span className="flex-1">
                        {formatearCantidad(l.cantidad)} × {l.descripcion}
                      </span>
                      <span>{formatearPesos(l.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                {!t.anulada && (esDueno || (t.propia && dia === hoy)) && (
                  <button type="button" onClick={() => setAAnular(t)} className="mt-2 min-h-11 font-semibold text-red-700">
                    Anular venta
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {aAnular && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-red-950" role="alert">
          <p>
            ¿Anular la venta de las {hora(aAnular.fecha)} por {formatearPesos(aAnular.total)}? Deja de contar en las ventas.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton type="button" variante="secundario" onClick={() => setAAnular(null)}>
              No
            </Boton>
            <Boton type="button" variante="peligro" onClick={() => anular(aAnular)}>
              Sí, anular
            </Boton>
          </div>
        </div>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8 sm:block sm:w-auto sm:px-8">
        Volver
      </Boton>
    </main>
  );
}
