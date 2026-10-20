import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { baseDispositivo, guardarProductosDispositivo, masVendidos, productosDelDispositivo, productosParaVender } from '../../db';
import type { ProductoVenta } from '../../db';
import { formatearPesos } from '../../domain/dinero';
import type { Id } from '../../domain/id';
import { leerImporte } from '../../domain/importe';
import { normalizarDescripcion } from '../../domain/vinculacion';
import {
  agregarProducto,
  agregarVarios,
  cambiarCantidad,
  formatearCantidad,
  leerCantidad,
  MEDIOS_PAGO,
  problemaTicket,
  subtotal,
  totalTicket,
} from '../../domain/ventas';
import type { LineaTicket, MedioPago } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { Escaner, puedeEscanear } from '../../ui/Escaner';
import { AvisoPendientes, useCola } from './cola';

interface Props {
  onVolver: () => void;
  onMisVentas: () => void;
}

const RESULTADOS = 8;

/** Busca por palabras de la descripción, código o código de barras. */
function buscar(productos: readonly ProductoVenta[], texto: string): ProductoVenta[] {
  const palabras = normalizarDescripcion(texto).split(' ').filter(Boolean);
  if (palabras.length === 0) return [];
  return productos
    .filter((p) => {
      const donde = `${p.codigoInterno.toLowerCase()} ${p.codigoBarras ?? ''} ${p.descripcionNormalizada}`;
      return palabras.every((w) => donde.includes(w));
    })
    .slice(0, RESULTADOS);
}

/** El producto con ese código exacto (de barras o interno), para agregarlo sin elegir. */
function porCodigo(productos: readonly ProductoVenta[], codigo: string): ProductoVenta | undefined {
  const c = codigo.trim().toLowerCase();
  if (!c) return undefined;
  return productos.find((p) => p.codigoBarras === c) ?? productos.find((p) => p.codigoInterno.toLowerCase() === c);
}

/** Fase 8: cargar una venta. La usan el dueño y los empleados; anda sin conexión. */
export function PantallaVender({ onVolver, onMisVentas }: Props) {
  const sesion = useSesion();
  const cola = useCola();
  const [productos, setProductos] = useState<ProductoVenta[] | null>(null);
  const [rapidos, setRapidos] = useState<Id[]>([]);
  const [lineas, setLineas] = useState<LineaTicket[]>([]);
  const [medio, setMedio] = useState<MedioPago | null>(null);
  const [busqueda, setBusqueda] = useState('');
  const [escaneando, setEscaneando] = useState(false);
  const [varios, setVarios] = useState<{ monto: string; descripcion: string } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [cobrando, setCobrando] = useState(false);
  const campoBusqueda = useRef<HTMLInputElement>(null);
  /** Códigos que llegaron (Enter o escáner) antes de que cargaran los productos; se agregan en orden al cargar. */
  const codigosEnEspera = useRef<string[]>([]);

  // Primero lo guardado en el dispositivo (sirve sin conexión); después lo de la base, si hay internet.
  useEffect(() => {
    const b = baseDispositivo();
    productosDelDispositivo(b, sesion.comercioId).then((g) => {
      if (g) {
        setProductos((actual) => actual ?? g.productos);
        setRapidos((actual) => (actual.length ? actual : g.masVendidos));
      }
    });
    Promise.all([productosParaVender(sesion), masVendidos(sesion)])
      .then(([p, m]) => {
        setProductos(p);
        setRapidos(m);
        return guardarProductosDispositivo(b, { comercioId: sesion.comercioId, productos: p, masVendidos: m, fecha: new Date().toISOString() });
      })
      .catch(() => setProductos((actual) => actual ?? []));
  }, [sesion]);

  const porId = useMemo(() => new Map((productos ?? []).map((p) => [p.id, p])), [productos]);
  const resultados = useMemo(() => buscar(productos ?? [], busqueda), [productos, busqueda]);
  const botonesRapidos = rapidos.map((id) => porId.get(id)).filter((p): p is ProductoVenta => !!p);
  const total = totalTicket(lineas);

  const agregar = useCallback((p: ProductoVenta) => {
    setLineas((l) => agregarProducto(l, p));
    setAviso(null);
    setBusqueda('');
  }, []);

  const leerCodigo = useCallback(
    (codigo: string) => {
      setEscaneando(false);
      if (productos === null) {
        codigosEnEspera.current.push(codigo);
        return;
      }
      const p = porCodigo(productos, codigo);
      if (p) agregar(p);
      else setAviso({ tipo: 'error', texto: `No encontramos el código ${codigo}. Buscá el producto por nombre o cargalo como "Varios".` });
    },
    [productos, agregar],
  );

  useEffect(() => {
    if (productos === null || codigosEnEspera.current.length === 0) return;
    const codigos = codigosEnEspera.current;
    codigosEnEspera.current = [];
    for (const codigo of codigos) {
      const p = porCodigo(productos, codigo);
      if (p) agregar(p);
    }
  }, [productos, agregar]);

  function alBuscar(e: FormEvent) {
    e.preventDefault();
    if (productos === null) {
      if (busqueda.trim()) codigosEnEspera.current.push(busqueda);
      setBusqueda('');
      return;
    }
    // Un lector de códigos escribe el código y "Enter"; también vale escribir el código a mano.
    const exacto = porCodigo(productos ?? [], busqueda);
    if (exacto) agregar(exacto);
    else if (resultados.length === 1) agregar(resultados[0]!);
  }

  function agregarImporte(e: FormEvent) {
    e.preventDefault();
    const monto = varios ? leerImporte(varios.monto, 'ar') : null;
    try {
      setLineas((l) => agregarVarios(l, monto ?? 0, varios?.descripcion));
      setVarios(null);
      setAviso(null);
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  }

  async function cobrar() {
    const problema = problemaTicket(lineas, medio);
    if (problema) {
      setAviso({ tipo: 'error', texto: problema });
      return;
    }
    setCobrando(true);
    try {
      const enLaBase = await cola.guardar({ id: crypto.randomUUID(), fecha: new Date().toISOString(), medioPago: medio!, lineas });
      setAviso({
        tipo: 'ok',
        texto: enLaBase
          ? `Venta guardada: ${formatearPesos(total)}.`
          : `Venta de ${formatearPesos(total)} guardada en este dispositivo. Se sube sola cuando haya internet.`,
      });
      setLineas([]);
      setMedio(null);
      campoBusqueda.current?.focus();
    } catch (err) {
      setAviso({ tipo: 'error', texto: `No se pudo guardar la venta: ${(err as Error).message}` });
    } finally {
      setCobrando(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-40">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Nueva venta</h1>
        <button type="button" onClick={onMisVentas} className="min-h-11 px-2 font-semibold text-green-800 underline underline-offset-4">
          Ventas de hoy
        </button>
      </div>
      <AvisoPendientes onVer={onMisVentas} />

      <form onSubmit={alBuscar} className="mt-4 flex gap-2" role="search">
        <label htmlFor="buscar-producto" className="sr-only">
          Buscar producto
        </label>
        <input
          id="buscar-producto"
          ref={campoBusqueda}
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscá o escribí el código"
          autoComplete="off"
          enterKeyHint="search"
          className="min-h-12 w-full rounded-xl border border-stone-200 bg-white px-3 text-lg shadow-sm outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
        />
        {puedeEscanear() && (
          <button
            type="button"
            onClick={() => setEscaneando(true)}
            className="min-h-12 shrink-0 rounded-xl bg-green-700 px-4 font-semibold text-white shadow-sm"
          >
            Escanear
          </button>
        )}
      </form>

      {productos === null && <p className="mt-3 text-stone-600">Cargando productos…</p>}

      {busqueda.trim() !== '' ? (
        <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="resultados">
          {resultados.length === 0 && <li className="p-3 text-stone-600">No hay productos con “{busqueda.trim()}”.</li>}
          {resultados.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => agregar(p)} className="flex min-h-12 w-full items-center gap-3 p-3 text-left">
                <span className="min-w-0 flex-1">{p.descripcion}</span>
                <span className="font-semibold tabular-nums">{formatearPesos(p.precioVentaActual)}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        botonesRapidos.length > 0 && (
          <section className="mt-3" aria-label="Más vendidos">
            <div className="grid grid-cols-2 gap-2">
              {botonesRapidos.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => agregar(p)}
                  className="min-h-14 rounded-xl border border-stone-200 bg-white p-2 text-left text-sm font-semibold shadow-sm active:scale-[0.98]"
                >
                  <span className="line-clamp-2">{p.descripcion}</span>
                  <span className="block font-normal text-stone-600 tabular-nums">{formatearPesos(p.precioVentaActual)}</span>
                </button>
              ))}
            </div>
          </section>
        )
      )}

      {varios ? (
        <form onSubmit={agregarImporte} className="mt-3 space-y-2 rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
          <div className="flex gap-2">
            <label className="flex-1">
              <span className="block font-semibold">Importe</span>
              <input
                value={varios.monto}
                onChange={(e) => setVarios({ ...varios, monto: e.target.value })}
                inputMode="decimal"
                autoFocus
                placeholder="$"
                className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-lg"
              />
            </label>
            <label className="flex-1">
              <span className="block font-semibold">Qué es (opcional)</span>
              <input
                value={varios.descripcion}
                onChange={(e) => setVarios({ ...varios, descripcion: e.target.value })}
                maxLength={60}
                placeholder="Varios"
                className="mt-1 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-lg"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Boton type="button" variante="secundario" onClick={() => setVarios(null)}>
              Cancelar
            </Boton>
            <Boton type="submit">Agregar</Boton>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setVarios({ monto: '', descripcion: '' })} className="mt-3 min-h-11 font-semibold text-green-800 underline underline-offset-4">
          + Varios (importe a mano)
        </button>
      )}

      <section className="mt-4" aria-label="Ticket">
        {lineas.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stone-300 p-4 text-center text-stone-600">Todavía no agregaste nada.</p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="ticket">
            {lineas.map((l, i) => (
              <LineaDelTicket key={`${l.productoId ?? 'v'}-${i}`} linea={l} onCantidad={(c) => setLineas((ls) => cambiarCantidad(ls, i, c))} />
            ))}
          </ul>
        )}
      </section>

      <fieldset className="mt-4">
        <legend className="text-lg font-semibold">¿Cómo pagó?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {MEDIOS_PAGO.map((m) => (
            <button
              key={m.id}
              type="button"
              aria-pressed={medio === m.id}
              onClick={() => setMedio(m.id)}
              className={`min-h-11 rounded-xl border px-3 text-base font-medium transition active:scale-[0.98] ${
                medio === m.id ? 'border-green-600 bg-green-600 text-white shadow-md' : 'border-stone-200 bg-white shadow-sm'
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
      </fieldset>

      {aviso && (
        <p
          className={`mt-4 rounded-xl p-3 ${aviso.tipo === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}
          role={aviso.tipo === 'ok' ? 'status' : 'alert'}
          data-testid="aviso-venta"
        >
          {aviso.texto}
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-stone-200 bg-white/95 px-4 pt-3 pb-4 backdrop-blur">
        <div className="mx-auto max-w-md space-y-2">
          <Boton type="button" onClick={cobrar} disabled={cobrando || lineas.length === 0}>
            Cobrar <span data-testid="total-ticket">{formatearPesos(total)}</span>
          </Boton>
          <Boton type="button" variante="secundario" onClick={onVolver}>
            Volver
          </Boton>
        </div>
      </div>

      {escaneando && <Escaner onCodigo={leerCodigo} onCerrar={() => setEscaneando(false)} />}
    </main>
  );
}

function LineaDelTicket({ linea, onCantidad }: { linea: LineaTicket; onCantidad: (c: number) => void }) {
  const [editando, setEditando] = useState<string | null>(null);
  const confirmar = () => {
    const c = editando === null ? null : leerCantidad(editando);
    if (c !== null) onCantidad(c);
    setEditando(null);
  };
  return (
    <li className="flex items-center gap-2 p-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{linea.descripcion}</p>
        <p className="text-sm text-stone-600 tabular-nums">
          {formatearPesos(linea.precioUnitario)} c/u · <span className="font-semibold text-stone-800">{formatearPesos(subtotal(linea))}</span>
        </p>
      </div>
      <button type="button" aria-label={`Uno menos de ${linea.descripcion}`} onClick={() => onCantidad(linea.cantidad - 1)} className="size-11 rounded-xl border border-stone-200 text-xl font-bold">
        −
      </button>
      {editando === null ? (
        <button
          type="button"
          aria-label={`Cantidad de ${linea.descripcion}`}
          onClick={() => setEditando(formatearCantidad(linea.cantidad))}
          className="min-w-12 text-center text-lg font-semibold tabular-nums"
          data-testid="cantidad"
        >
          {formatearCantidad(linea.cantidad)}
        </button>
      ) : (
        <input
          aria-label={`Cantidad de ${linea.descripcion}`}
          value={editando}
          onChange={(e) => setEditando(e.target.value)}
          onBlur={confirmar}
          onKeyDown={(e) => e.key === 'Enter' && confirmar()}
          inputMode="decimal"
          autoFocus
          className="h-11 w-16 rounded-xl border border-green-600 text-center text-lg"
        />
      )}
      <button type="button" aria-label={`Uno más de ${linea.descripcion}`} onClick={() => onCantidad(linea.cantidad + 1)} className="size-11 rounded-xl border border-stone-200 text-xl font-bold">
        +
      </button>
    </li>
  );
}
