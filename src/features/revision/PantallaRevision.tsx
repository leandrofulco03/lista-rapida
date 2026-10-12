import { useEffect, useState } from 'react';
import { aplicarRevision, db, listarProductos, listarRubros, vinculosDeProveedor } from '../../db';
import type { Proveedor } from '../../db';
import type { ConfigComercio } from '../../domain/config';
import { formatearPesos } from '../../domain/dinero';
import type { LineaLista } from '../../domain/lineaLista';
import { formatearPorcentaje } from '../../domain/porcentaje';
import { aprobarTodo, armarRevision } from '../../domain/revision';
import type { Cambio, Decision, Revision } from '../../domain/revision';
import { Boton } from '../../ui/Boton';

interface Props {
  proveedor: Proveedor;
  archivo: string;
  lineas: { linea: LineaLista; productoId: number | null }[];
  listaIncluyeIva: boolean;
  config: ConfigComercio;
  onVolver: () => void;
}

interface Cargada {
  revision: Revision;
  nombres: Map<number, string>;
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
export function PantallaRevision({ proveedor, archivo, lineas, listaIncluyeIva, config, onVolver }: Props) {
  const [cargada, setCargada] = useState<Cargada | null>(null);
  const [decisiones, setDecisiones] = useState<Map<number, Decision>>(new Map());
  const [guardando, setGuardando] = useState(false);
  const [actualizados, setActualizados] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([listarProductos(db), listarRubros(db), vinculosDeProveedor(db, proveedor.id)]).then(([productos, rubros, vinculos]) => {
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
        <p className="text-sm font-semibold text-green-800">{proveedor.nombre}</p>
        <h1 className="mt-1 text-2xl font-bold" data-testid="titulo-precios-guardados">
          {actualizados === 0 ? 'No cambiamos ningún precio' : `Actualizamos ${actualizados} ${actualizados === 1 ? 'precio' : 'precios'}`}
        </h1>
        <p className="mt-2 text-lg text-stone-700">Los cambios quedan en el historial de cada producto.</p>
        <Boton type="button" onClick={onVolver} className="mt-6">
          Listo
        </Boton>
      </main>
    );
  }

  const generales = aprobarTodo(cambios);
  const pendientesGenerales = [...generales.keys()].filter((id) => !decisiones.has(id)).length;
  const decidir = (productoId: number, decision: Decision | undefined) =>
    setDecisiones((actuales) => {
      const nuevas = new Map(actuales);
      if (decision === undefined) nuevas.delete(productoId);
      else nuevas.set(productoId, decision);
      return nuevas;
    });

  async function guardar() {
    setGuardando(true);
    try {
      const { actualizados: n } = await aplicarRevision(db, {
        proveedorId: proveedor.id,
        archivo,
        totalLineas: lineas.length,
        cambios,
        decisiones,
      });
      setActualizados(n);
    } finally {
      setGuardando(false);
    }
  }

  const suben = cambios.filter((c) => c.tipo === 'sube').length;
  const bajan = cambios.filter((c) => c.tipo === 'baja').length;
  const sinVincular = revision.sinVincular.length + revision.repetidas.length;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-28">
      <p className="text-sm font-semibold text-green-800">{proveedor.nombre}</p>
      <h1 className="mt-1 text-2xl font-bold">Revisá los precios</h1>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-center" data-testid="resumen-revision">
        {[
          { n: suben, texto: 'suben' },
          { n: bajan, texto: 'bajan' },
          { n: revision.sinCambios.length, texto: 'sin cambios' },
          { n: sinVincular, texto: 'sin vincular' },
        ].map(({ n, texto }) => (
          <li key={texto} className="rounded-xl border border-stone-300 bg-white p-2">
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
        <details className="mt-6 rounded-xl border border-stone-300 bg-white p-3" data-testid="grupo-sin-vincular">
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
        <details className="mt-4 rounded-xl border border-stone-300 bg-white p-3" data-testid="grupo-no-vinieron">
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
  const borde = c.individual ? 'border-red-400 bg-red-50' : c.resaltado ? 'border-amber-400 bg-amber-50' : 'border-stone-300 bg-white';
  const color = c.tipo === 'baja' ? 'text-blue-800' : 'text-stone-900';
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
        <p className="mt-2 flex flex-wrap items-center gap-x-2 text-green-900">
          <span aria-hidden>✓</span> Queda en <span className="font-semibold">{formatearPesos(decision.precio)}</span>
          <button type="button" onClick={() => onDecidir(undefined)} className="min-h-11 rounded-lg px-2 font-semibold text-stone-700 underline">
            Deshacer
          </button>
        </p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onDecidir({ precio: c.precioSugerido })}
            className="min-h-11 rounded-xl bg-green-700 px-3 font-semibold text-white"
          >
            {c.tipo === 'baja' ? 'Bajar' : 'Pasar'} a {formatearPesos(c.precioSugerido)}
          </button>
          {c.tipo === 'baja' && c.precioAnterior > 0 && (
            <button
              type="button"
              onClick={() => onDecidir({ precio: c.precioAnterior })}
              className="min-h-11 rounded-xl border border-stone-300 bg-white px-3 font-semibold"
            >
              Mantener {formatearPesos(c.precioAnterior)}
            </button>
          )}
          <span className="self-center text-sm text-stone-600">Hoy {formatearPesos(c.precioAnterior)}</span>
        </div>
      )}
    </li>
  );
}
