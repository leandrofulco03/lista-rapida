import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { analisisVentas, listarProductos, listarRubros, resumenVentas, sinMovimiento } from '../../db';
import type { Producto, Rubro, SinMovimiento } from '../../db';
import { armarMapaHoras, calcularGanancia, DIAS_CORTOS, DIAS_LARGOS, fechasDeRango, preciosAtrasados, principalesYOtros, RANGOS } from '../../domain/analisis';
import type { DatosAnalisis, MotivoAtraso, RangoAnalisis } from '../../domain/analisis';
import type { ConfigComercio } from '../../domain/config';
import { formatearPesos } from '../../domain/dinero';
import { calcularKpis, diaDe, diaLegible, formatearCantidad, nombrePeriodo, periodoDe } from '../../domain/ventas';
import type { DatosResumen } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { BarrasHorizontales } from '../../ui/graficos/BarrasHorizontales';
import { GraficoDona } from '../../ui/graficos/GraficoDona';
import { GraficoLineas } from '../../ui/graficos/GraficoLineas';
import { MapaCalor } from '../../ui/graficos/MapaCalor';
import { IconoAlerta, IconoGrafico } from '../../ui/Iconos';

interface Props {
  config: ConfigComercio;
  onVolver: () => void;
}

interface Datos {
  resumen: DatosResumen;
  analisis: DatosAnalisis;
}

const DIAS_SIN_MOVIMIENTO = 30;
const MOSTRAR = 15;

const MOTIVOS: Record<MotivoAtraso, { texto: string; clase: string }> = {
  perdida: { texto: 'Vendés a pérdida', clase: 'bg-red-50 text-red-900' },
  'bajo-recargo': { texto: 'Por debajo de tu recargo', clase: 'bg-amber-50 text-amber-950' },
  'sin-actualizar': { texto: 'Hace mucho que no cambia', clase: 'bg-stone-100 text-stone-800' },
};

const porcentaje = (p: number | null) => (p === null ? '—' : `${(p * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })}%`);
const diaCorto = (dia: string) => `${Number(dia.slice(8))}/${Number(dia.slice(5, 7))}`;

/** Fase 9: análisis del dueño: ganancia, ingresos por día, más vendidos, rubros, horarios y precios para revisar. */
export function PantallaAnalisis({ config, onVolver }: Props) {
  const sesion = useSesion();
  const hoy = diaDe(new Date());
  const [rango, setRango] = useState<RangoAnalisis>('30d');
  const [datos, setDatos] = useState<Datos | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [masVendidosPor, setMasVendidosPor] = useState<'importe' | 'unidades'>('importe');
  const [catalogo, setCatalogo] = useState<{ productos: Producto[]; rubros: Rubro[] } | null>(null);
  const [quietos, setQuietos] = useState<SinMovimiento[] | null>(null);
  const { desde, hasta } = fechasDeRango(rango, hoy);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    Promise.all([resumenVentas(sesion, desde, hasta), analisisVentas(sesion, desde, hasta)]).then(
      ([resumen, analisis]) => {
        if (!vigente) return;
        setDatos({ resumen, analisis });
        setCargando(false);
        setError(null);
      },
      (e: Error) => vigente && (setError(e.message), setCargando(false)),
    );
    return () => {
      vigente = false;
    };
  }, [sesion, desde, hasta]);

  // No dependen del rango: se piden una vez.
  useEffect(() => {
    Promise.all([listarProductos(sesion), listarRubros(sesion)]).then(([productos, rubros]) => setCatalogo({ productos, rubros }));
    sinMovimiento(sesion, DIAS_SIN_MOVIMIENTO).then(setQuietos);
  }, [sesion]);

  const atrasados = useMemo(
    () => (catalogo ? preciosAtrasados(catalogo.productos, new Map(catalogo.rubros.map((r) => [r.id, r.recargoPct])), config, new Date()) : null),
    [catalogo, config],
  );

  const kpis = datos ? calcularKpis(datos.resumen) : null;
  const ganancia = datos ? calcularGanancia(datos.analisis.ganancia) : null;
  const mapa = datos ? armarMapaHoras(datos.analisis.horas) : null;
  const sinVentas = kpis !== null && kpis.ventaTotal === 0;

  return (
    <main className="mx-auto max-w-6xl">
      <Encabezado Icono={IconoGrafico} titulo="Análisis" descripcion="Cuánto ganás, qué se vende y qué precios conviene revisar." />

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Período">
        {RANGOS.map((r) => (
          <button
            key={r.id}
            type="button"
            aria-pressed={rango === r.id}
            onClick={() => setRango(r.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 font-medium ${rango === r.id ? 'border-green-600 bg-green-600 text-crema' : 'border-stone-300 bg-white hover:bg-stone-50'}`}
          >
            {r.nombre}
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-stone-600" data-testid="rango">
        Del {diaLegible(desde)} al {diaLegible(hasta)}
        {hasta === hoy ? ' (hoy)' : ''}
      </p>

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}

      {/* Al cambiar el período, lo anterior queda a la vista, atenuado, hasta que llegan los datos nuevos. */}
      <div className={`transition-opacity ${cargando ? 'opacity-50' : ''}`} aria-busy={cargando}>
        {kpis && ganancia && datos && (
          <>
            <div className="mt-4 grid gap-3 lg:grid-cols-3 lg:gap-4">
              <section className="rounded-2xl bg-marca p-6 text-crema shadow-sm" data-testid="analisis-ventas">
                <p className="text-crema/75">Ventas</p>
                <p className="mt-1 text-4xl font-bold tabular-nums lg:text-5xl">{formatearPesos(kpis.ventaTotal)}</p>
                <p className="mt-1 text-sm text-crema/75">
                  {kpis.tickets} {kpis.tickets === 1 ? 'venta' : 'ventas'}
                  {kpis.ticketPromedio !== null && ` · ticket promedio ${formatearPesos(kpis.ticketPromedio)}`}
                </p>
              </section>
              <dl className="grid grid-cols-2 gap-3 lg:col-span-2 lg:gap-4">
                <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs" data-testid="analisis-ganancia">
                  <dt className="text-sm font-medium text-stone-600">Ganancia</dt>
                  <dd className="mt-2 text-2xl font-bold tabular-nums lg:text-3xl">{formatearPesos(ganancia.ganancia)}</dd>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-xs" data-testid="analisis-margen">
                  <dt className="text-sm font-medium text-stone-600">Margen</dt>
                  <dd className="mt-2 text-2xl font-bold tabular-nums lg:text-3xl">{porcentaje(ganancia.margen)}</dd>
                </div>
              </dl>
            </div>
            <p className="mt-2 text-sm text-stone-600">
              Ganancia = lo que cobraste menos lo que te costó{config.ventaIncluyeIva ? ' (con IVA)' : ''}.
              {ganancia.sinCosto > 0 && ` No incluye ${formatearPesos(ganancia.sinCosto)} vendidos sin costo cargado ("Varios" o productos sin costo).`}
              {kpis.totalSinDetalle > 0 && ` Tampoco los ${formatearPesos(kpis.totalSinDetalle)} cargados como total del día.`}
            </p>

            {sinVentas ? (
              <p className="mt-6 rounded-2xl border border-dashed border-stone-300 p-6 text-center text-stone-600">
                No hay ventas en este período. Cargá ventas para ver los gráficos.
              </p>
            ) : (
              <>
                <Tarjeta titulo="Ingresos por día">
                  <GraficoLineas
                    titulo="Ingresos por día"
                    puntos={datos.resumen.porDia.map((d) => ({ corto: diaCorto(d.dia), largo: nombrePeriodo(periodoDe('dia', d.dia), hoy), valor: d.total }))}
                    formatear={formatearPesos}
                  />
                </Tarjeta>

                <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
                  <Tarjeta
                    titulo="Productos más vendidos"
                    accion={
                      <div className="flex rounded-full border border-stone-300 bg-white p-0.5 text-sm" role="group" aria-label="Medir por">
                        {(['importe', 'unidades'] as const).map((m) => (
                          <button
                            key={m}
                            type="button"
                            aria-pressed={masVendidosPor === m}
                            onClick={() => setMasVendidosPor(m)}
                            className={`min-h-9 rounded-full px-3 ${masVendidosPor === m ? 'bg-green-600 text-crema' : ''}`}
                          >
                            {m === 'importe' ? 'Plata' : 'Unidades'}
                          </button>
                        ))}
                      </div>
                    }
                  >
                    <GraficoDona
                      titulo="Productos más vendidos"
                      porciones={principalesYOtros(
                        datos.analisis.productos,
                        (p) => (masVendidosPor === 'importe' ? p.importe : p.unidades),
                        (p) => p.descripcion,
                        masVendidosPor === 'importe' ? datos.resumen.totalTickets : datos.resumen.articulos,
                      )}
                      formatear={masVendidosPor === 'importe' ? formatearPesos : (v) => `${formatearCantidad(v)} u.`}
                    />
                    <h3 className="mt-5 font-semibold">Los {Math.min(10, datos.analisis.productos.length)} que más facturaron</h3>
                    <div className="mt-2">
                      <BarrasHorizontales
                        titulo="Los que más facturaron"
                        filas={datos.analisis.productos.slice(0, 10).map((p) => ({
                          nombre: p.descripcion,
                          valor: p.importe,
                          detalle: `${formatearCantidad(p.unidades)} u.${p.ganancia !== null ? ` · ganancia ${formatearPesos(p.ganancia)}` : ''}`,
                        }))}
                        formatear={formatearPesos}
                        tabla={{
                          columnas: ['Producto', 'Unidades', 'Ventas', 'Ganancia'],
                          filas: datos.analisis.productos.map((p) => [
                            p.descripcion,
                            formatearCantidad(p.unidades),
                            formatearPesos(p.importe),
                            p.ganancia === null ? '—' : formatearPesos(p.ganancia),
                          ]),
                        }}
                      />
                    </div>
                  </Tarjeta>

                  <Tarjeta titulo="Ventas por rubro">
                    <BarrasHorizontales
                      titulo="Ventas por rubro"
                      filas={datos.analisis.rubros.map((r) => ({ nombre: r.rubro ?? 'Sin rubro / Varios', valor: r.importe }))}
                      formatear={formatearPesos}
                    />
                  </Tarjeta>
                </div>

                {mapa && (
                  <Tarjeta titulo="Cuándo vendés más">
                    <MapaCalor
                      titulo="Ventas por día de la semana y hora"
                      filas={DIAS_CORTOS}
                      filasLargas={DIAS_LARGOS}
                      columnas={mapa.horas}
                      valores={mapa.celdas}
                      maximo={mapa.maximo}
                      formatear={formatearPesos}
                    />
                  </Tarjeta>
                )}
              </>
            )}
          </>
        )}
      </div>

      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
        <Tarjeta titulo="Precios para revisar">
          {atrasados === null ? (
            <p className="text-stone-600">Cargando…</p>
          ) : atrasados.length === 0 ? (
            <p className="text-stone-600">Todos tus precios están al día con tu recargo.</p>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                {atrasados.length === 1 ? '1 producto' : `${atrasados.length} productos`} con el precio por debajo de lo que da tu recargo, o sin cambios hace
                más de 45 días. Revisalos en el catálogo.
              </p>
              <ul className="mt-3 divide-y divide-stone-100" data-testid="precios-atrasados">
                {atrasados.slice(0, MOSTRAR).map((p) => (
                  <li key={p.id} className="py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">{p.descripcion}</span>
                      <span className="shrink-0 text-sm tabular-nums">
                        {formatearPesos(p.precio)} → <span className="font-semibold">{formatearPesos(p.sugerido)}</span>
                      </span>
                    </div>
                    <span className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium ${MOTIVOS[p.motivo].clase}`}>
                      {p.motivo !== 'sin-actualizar' && <IconoAlerta className="size-3.5" />}
                      {MOTIVOS[p.motivo].texto}
                      {p.motivo === 'sin-actualizar' ? ` (${p.diasSinActualizar} días)` : p.falta > 0 ? ` (−${Math.round(p.falta * 100)}%)` : ''}
                    </span>
                  </li>
                ))}
              </ul>
              {atrasados.length > MOSTRAR && <p className="mt-2 text-sm text-stone-600">Y {atrasados.length - MOSTRAR} más.</p>}
            </>
          )}
        </Tarjeta>

        <Tarjeta titulo={`Sin ventas en los últimos ${DIAS_SIN_MOVIMIENTO} días`}>
          {quietos === null ? (
            <p className="text-stone-600">Cargando…</p>
          ) : quietos.length === 0 ? (
            <p className="text-stone-600">Todos tus productos se vendieron en este tiempo.</p>
          ) : (
            <>
              <p className="text-sm text-stone-600">
                {quietos.length === 1 ? '1 producto' : `${quietos.length} productos`}: plata quieta en la góndola. Pensá en una promo o en no reponerlos.
              </p>
              <ul className="mt-3 divide-y divide-stone-100" data-testid="sin-movimiento">
                {quietos.slice(0, MOSTRAR).map((p) => (
                  <li key={p.productoId} className="flex items-baseline justify-between gap-2 py-2">
                    <span className="min-w-0 truncate">{p.descripcion}</span>
                    <span className="shrink-0 text-sm text-stone-600">
                      {p.ultimaVenta ? `última: ${nombrePeriodo(periodoDe('dia', p.ultimaVenta), hoy)}` : 'nunca se vendió'}
                    </span>
                  </li>
                ))}
              </ul>
              {quietos.length > MOSTRAR && <p className="mt-2 text-sm text-stone-600">Y {quietos.length - MOSTRAR} más.</p>}
            </>
          )}
        </Tarjeta>
      </div>

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8 sm:block sm:w-auto sm:px-8">
        Volver
      </Boton>
    </main>
  );
}

function Tarjeta({ titulo, accion, children }: { titulo: string; accion?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs lg:p-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{titulo}</h2>
        {accion}
      </div>
      {children}
    </section>
  );
}
