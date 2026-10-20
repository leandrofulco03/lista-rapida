import { useEffect, useId, useState } from 'react';
import { aplicarRevision, listarProductos, listarRubros, vinculosDeProveedor } from '../../db';
import type { Id } from '../../domain/id';
import { useSesion } from '../../sesion';
import type { Proveedor } from '../../db';
import type { ConfigComercio } from '../../domain/config';
import { formatearPesos, pesosParaEditar } from '../../domain/dinero';
import type { LineaLista } from '../../domain/lineaLista';
import { formatearPorcentaje } from '../../domain/porcentaje';
import { aprobarTodo, armarRevision, avisoPrecio, evaluarPrecioManual } from '../../domain/revision';
import type { Cambio, Decision, Revision } from '../../domain/revision';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoLista, IconoListo } from '../../ui/Iconos';

interface Props {
  proveedor: Proveedor;
  archivo: string;
  lineas: { linea: LineaLista; productoId: Id | null }[];
  listaIncluyeIva: boolean;
  config: ConfigComercio;
  onEtiquetas: (productos: Id[]) => void;
  onListaPrecios: () => void;
  onVolver: () => void;
}

interface Cargada {
  revision: Revision;
  nombres: Map<Id, string>;
}

const TEXTO_MOTIVO: Record<NonNullable<Cambio['motivo']>, string> = {
  variacion: 'Cambia más del 50%: puede ser un error de lectura o otra presentación.',
  'costo-cero': 'El costo vino en cero: puede ser un error de lectura.',
  'sin-costo-anterior': 'No tenía costo cargado para comparar.',
};

/** Variación con signo y un decimal como máximo: 1534 → "+15,3%". */
function textoVariacion(v: number | null): string {
  if (v === null) return 'nuevo costo';
  const redondeada = Math.round(Math.abs(v) / 10) * 10;
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${formatearPorcentaje(redondeada)}%`;
}

/** F09: revisión de los precios nuevos antes de guardarlos. Ningún precio cambia sin pasar por acá. */
export function PantallaRevision({ proveedor, archivo, lineas, listaIncluyeIva, config, onEtiquetas, onListaPrecios, onVolver }: Props) {
  const sesion = useSesion();
  const [cargada, setCargada] = useState<Cargada | null>(null);
  const [decisiones, setDecisiones] = useState<Map<Id, Decision>>(new Map());
  const [guardando, setGuardando] = useState(false);
  const [actualizados, setActualizados] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarProductos(sesion), listarRubros(sesion), vinculosDeProveedor(sesion, proveedor.id)]).then(([productos, rubros, vinculos]) => {
      const revision = armarRevision({
        lineas,
        productos: new Map(productos.map((p) => [p.id, p])),
        recargosRubro: new Map(rubros.map((r) => [r.id, r.recargoPct])),
        vinculadosAntes: new Set(vinculos.values()),
        listaIncluyeIva,
        descuentos: proveedor.descuentosPct,
        config,
      });
      setCargada({ revision, nombres: new Map(productos.map((p) => [p.id, p.descripcion])) });
    });
  }, [proveedor, lineas, listaIncluyeIva, config]);

  if (cargada === null) return null;
  const { revision, nombres } = cargada;
  const { cambios } = revision;

  if (actualizados !== null) {
    return (
      <main className="mx-auto max-w-md px-4 pt-8 pb-12">
        <Encabezado
          Icono={IconoListo}
          antetitulo={proveedor.nombre}
          titulo={actualizados === 0 ? 'No cambiamos ningún precio' : `Actualizamos ${actualizados} ${actualizados === 1 ? 'precio' : 'precios'}`}
          testIdTitulo="titulo-precios-guardados"
          descripcion="Los cambios quedan en el historial de cada producto."
        />
        <div className="mt-6 space-y-3">
          {actualizados > 0 && (
            <Boton type="button" onClick={() => onEtiquetas([...decisiones.keys()])}>
              Imprimir {actualizados === 1 ? 'su etiqueta' : `sus ${actualizados} etiquetas`}
            </Boton>
          )}
          {actualizados > 0 && (
            <Boton type="button" variante="secundario" onClick={onListaPrecios}>
              Lista de precios y CSV para la caja
            </Boton>
          )}
          <Boton type="button" variante={actualizados > 0 ? 'secundario' : 'principal'} onClick={onVolver}>
            Listo
          </Boton>
        </div>
      </main>
    );
  }

  const generales = aprobarTodo(cambios);
  const pendientesGenerales = [...generales.keys()].filter((id) => !decisiones.has(id)).length;
  const decidir = (productoId: Id, decision: Decision | undefined) =>
    setDecisiones((actuales) => {
      const nuevas = new Map(actuales);
      if (decision === undefined) nuevas.delete(productoId);
      else nuevas.set(productoId, decision);
      return nuevas;
    });

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      const { actualizados: n } = await aplicarRevision(sesion, {
        proveedorId: proveedor.id,
        archivo,
        totalLineas: lineas.length,
        cambios,
        decisiones,
      });
      setActualizados(n);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pudimos guardar los precios.');
    } finally {
      setGuardando(false);
    }
  }

  const suben = cambios.filter((c) => c.tipo === 'sube').length;
  const bajan = cambios.filter((c) => c.tipo === 'baja').length;
  const sinVincular = revision.sinVincular.length + revision.repetidas.length;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-28">
      <Encabezado Icono={IconoLista} antetitulo={proveedor.nombre} titulo="Revisá los precios" />
      <ul className="mt-4 grid grid-cols-2 gap-2 text-center" data-testid="resumen-revision">
        {[
          { n: suben, texto: 'suben' },
          { n: bajan, texto: 'bajan' },
          { n: revision.sinCambios.length, texto: 'sin cambios' },
          { n: sinVincular, texto: 'sin vincular' },
        ].map(({ n, texto }) => (
          <li key={texto} className="rounded-xl border border-stone-200 bg-white shadow-sm p-2">
            <span className="block text-2xl font-bold">{n}</span>
            {texto}
          </li>
        ))}
      </ul>

      {generales.size > 0 && (
        <div className="mt-4">
          <Boton type="button" variante="secundario" disabled={pendientesGenerales === 0} onClick={() => setDecisiones((actuales) => new Map([...generales, ...actuales]))}>
            {pendientesGenerales === 0 ? 'Todo aprobado' : `Aprobar todo (${pendientesGenerales})`}
          </Boton>
          {cambios.length > generales.size && (
            <p className="mt-1 text-sm text-stone-600">Los marcados en rojo no entran: se aprueban de a uno.</p>
          )}
        </div>
      )}

      {cambios.length === 0 && <p className="mt-6 text-lg text-stone-700">Ningún costo cambió en esta lista.</p>}

      <ul className="mt-4 space-y-3" data-testid="lista-cambios">
        {cambios.map((c) => (
          <TarjetaCambio key={c.productoId} cambio={c} decision={decisiones.get(c.productoId)} onDecidir={(d) => decidir(c.productoId, d)} />
        ))}
      </ul>

      {sinVincular > 0 && (
        <details className="mt-6 rounded-xl border border-stone-200 bg-white shadow-sm p-3" data-testid="grupo-sin-vincular">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Sin vincular ({sinVincular})</summary>
          <p className="text-sm text-stone-600">No se cambia nada de estas líneas.</p>
          <ul className="mt-2 space-y-1">
            {revision.sinVincular.map((l) => (
              <li key={l.filaOrigen} className="break-words">
                {l.descripcion} <span className="text-stone-500">{formatearPesos(l.costo)}</span>
              </li>
            ))}
            {revision.repetidas.map((l) => (
              <li key={l.filaOrigen} className="break-words">
                {l.descripcion} <span className="text-stone-500">· repetida en la lista (vale la primera)</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {revision.noVinieron.length > 0 && (
        <details className="mt-4 rounded-xl border border-stone-200 bg-white shadow-sm p-3" data-testid="grupo-no-vinieron">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">No vinieron en esta lista ({revision.noVinieron.length})</summary>
          <p className="text-sm text-stone-600">Son de {proveedor.nombre} pero no están en esta lista. No se cambian.</p>
          <ul className="mt-2 space-y-1">
            {revision.noVinieron.map((id) => (
              <li key={id} className="break-words">
                {nombres.get(id)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-300 bg-stone-50 px-4 py-3">
        {error && (
          <p role="alert" className="mx-auto mb-2 max-w-md text-red-700">
            {error}
          </p>
        )}
        <div className="mx-auto flex max-w-md gap-3">
          <Boton type="button" variante="secundario" onClick={onVolver} className="basis-1/3">
            Salir
          </Boton>
          <Boton type="button" onClick={guardar} disabled={guardando || decisiones.size === 0}>
            {guardando ? 'Guardando…' : `Guardar ${decisiones.size} ${decisiones.size === 1 ? 'precio' : 'precios'}`}
          </Boton>
        </div>
      </div>
    </main>
  );
}

interface PropsTarjeta {
  cambio: Cambio;
  decision: Decision | undefined;
  onDecidir: (decision: Decision | undefined) => void;
}

function TarjetaCambio({ cambio: c, decision, onDecidir }: PropsTarjeta) {
  const [aMano, setAMano] = useState<string | null>(null);
  const idPrecio = useId();
  const borde = c.individual ? 'border-red-400 bg-red-50' : c.resaltado ? 'border-amber-400 bg-amber-50' : 'border-stone-300 bg-white';
  const color = c.tipo === 'baja' ? 'text-blue-800' : 'text-stone-900';
  const manual = aMano === null ? null : evaluarPrecioManual(aMano, c);
  const avisoDecidido = decision ? avisoPrecio(decision.precio, c) : null;
  const aprobarAMano = () => {
    if (manual && 'precio' in manual) {
      onDecidir({ precio: manual.precio });
      setAMano(null);
    }
  };
  return (
    <li className={`rounded-xl border p-3 ${borde}`} data-testid="cambio">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words font-medium">{c.descripcion}</p>
        <p className={`shrink-0 font-semibold ${color}`}>{textoVariacion(c.variacion)}</p>
      </div>
      <p className="text-sm text-stone-600">
        Costo {formatearPesos(c.costoAnterior)} → {formatearPesos(c.costoNuevo)}
      </p>
      {c.motivo && <p className="mt-1 text-sm font-medium text-red-800">{TEXTO_MOTIVO[c.motivo]}</p>}
      {c.tipo === 'baja' && !c.motivo && <p className="mt-1 text-sm font-medium text-blue-800">Bajó el costo: decidí si bajás el precio o lo mantenés.</p>}

      {decision ? (
        <>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-green-900">
            <span aria-hidden>✓</span> Queda en <span className="font-semibold">{formatearPesos(decision.precio)}</span>
            <button type="button" onClick={() => onDecidir(undefined)} className="min-h-11 rounded-lg px-2 font-semibold text-stone-700 underline">
              Deshacer
            </button>
          </p>
          {avisoDecidido && <p className="text-sm font-medium text-red-700">{avisoDecidido}</p>}
        </>
      ) : aMano !== null ? (
        <form
          className="mt-2 rounded-xl bg-white/70 p-2"
          onSubmit={(e) => {
            e.preventDefault();
            aprobarAMano();
          }}
        >
          <label htmlFor={idPrecio} className="block font-medium">
            Precio de venta
          </label>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-lg">$</span>
            <input
              id={idPrecio}
              autoFocus
              inputMode="decimal"
              value={aMano}
              onChange={(e) => setAMano(e.target.value)}
              aria-invalid={manual && 'error' in manual && aMano.trim() !== '' ? true : undefined}
              className="min-h-11 w-40 rounded-xl border border-stone-200 bg-white shadow-sm px-3 text-right text-lg"
            />
          </div>
          <p className="mt-1 text-sm text-stone-600">
            {c.precioSugerido > 0 && `Sugerido ${formatearPesos(c.precioSugerido)} · `}Te cuesta {formatearPesos(c.piso)}
          </p>
          {manual && 'error' in manual && aMano.trim() !== '' && <p className="mt-1 text-red-700">{manual.error}</p>}
          {manual && 'precio' in manual && manual.aviso && <p className="mt-1 font-medium text-red-700">{manual.aviso}</p>}
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="submit" disabled={!manual || !('precio' in manual)} className="min-h-11 rounded-xl bg-green-700 px-3 font-semibold text-white disabled:opacity-50">
              {manual && 'precio' in manual ? `Aprobar ${formatearPesos(manual.precio)}` : 'Aprobar'}
            </button>
            <button type="button" onClick={() => setAMano(null)} className="min-h-11 rounded-lg px-2 font-semibold text-stone-700 underline">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          {c.precioSugerido > 0 && (
            <button
              type="button"
              onClick={() => onDecidir({ precio: c.precioSugerido })}
              className="min-h-11 rounded-xl bg-green-700 px-3 font-semibold text-white"
            >
              {c.tipo === 'baja' ? 'Bajar' : 'Pasar'} a {formatearPesos(c.precioSugerido)}
            </button>
          )}
          {c.tipo === 'baja' && c.precioAnterior > 0 && (
            <button
              type="button"
              onClick={() => onDecidir({ precio: c.precioAnterior })}
              className="min-h-11 rounded-xl border border-stone-200 bg-white shadow-sm px-3 font-semibold"
            >
              Mantener {formatearPesos(c.precioAnterior)}
            </button>
          )}
          <button
            type="button"
            onClick={() => setAMano(c.precioSugerido > 0 ? pesosParaEditar(c.precioSugerido) : '')}
            className="min-h-11 rounded-xl border border-stone-200 bg-white shadow-sm px-3 font-semibold"
          >
            Otro precio
          </button>
          <span className="self-center text-sm text-stone-600">Hoy {formatearPesos(c.precioAnterior)}</span>
        </div>
      )}
    </li>
  );
}
