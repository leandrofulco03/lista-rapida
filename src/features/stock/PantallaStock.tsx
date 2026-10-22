import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ajustarStock, dejarStock, ingresoStock, listarProductos, listarStock, movimientosDeStock } from '../../db';
import type { MovimientoStock, Producto, ProductoConStock } from '../../db';
import { COBERTURAS, DIAS_HISTORIA, porProveedor, sugerirPedido, textoAlcance, textoPedido } from '../../domain/stock';
import type { Cobertura } from '../../domain/stock';
import { formatearCantidad, leerCantidad } from '../../domain/ventas';
import { normalizarDescripcion } from '../../domain/vinculacion';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Encabezado } from '../../ui/Encabezado';
import { IconoStock } from '../../ui/Iconos';

interface Props {
  nombreComercio: string;
  onVolver: () => void;
}

type Vista = 'stock' | 'pedido';
type Modo = 'ingreso' | 'conteo';

const NOMBRE_MOVIMIENTO: Record<MovimientoStock['tipo'], string> = {
  inicio: 'Empezó a llevar stock',
  venta: 'Venta',
  anulacion: 'Venta anulada',
  ingreso: 'Llegó mercadería',
  ajuste: 'Se contó',
};

const fechaYHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

function buscar<T extends { descripcion: string; codigoInterno: string }>(lista: readonly T[], texto: string): T[] {
  const palabras = normalizarDescripcion(texto).split(' ').filter(Boolean);
  if (palabras.length === 0) return [...lista];
  return lista.filter((p) => {
    const donde = `${p.codigoInterno.toLowerCase()} ${normalizarDescripcion(p.descripcion)}`;
    return palabras.every((w) => donde.includes(w));
  });
}

/**
 * Fase 10: stock opcional por producto y sugerencia de pedido (sólo el dueño).
 * Sólo llevan stock los productos que se cargaron acá; se descuentan solos al vender.
 */
export function PantallaStock({ nombreComercio, onVolver }: Props) {
  const sesion = useSesion();
  const [vista, setVista] = useState<Vista>('stock');
  const [stock, setStock] = useState<ProductoConStock[] | null>(null);
  const [carga, setCarga] = useState<{ modo: Modo; productos: Producto[] | null; inicial?: ProductoConStock } | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);

  const cargar = useCallback(() => {
    listarStock(sesion).then(setStock, (e: Error) => setAviso({ tipo: 'error', texto: e.message }));
  }, [sesion]);
  useEffect(cargar, [cargar]);

  function abrirCarga(modo: Modo, inicial?: ProductoConStock) {
    setAviso(null);
    setCarga({ modo, productos: null, inicial });
    listarProductos(sesion).then(
      (productos) => setCarga((c) => c && { ...c, productos }),
      (e: Error) => setAviso({ tipo: 'error', texto: e.message }),
    );
  }

  if (carga) {
    return (
      <CargarStock
        modo={carga.modo}
        productos={carga.productos}
        stock={stock ?? []}
        inicial={carga.inicial}
        onListo={(texto) => {
          setCarga(null);
          setAviso({ tipo: 'ok', texto });
          cargar();
        }}
        onVolver={() => setCarga(null)}
      />
    );
  }

  return (
    <main className="mx-auto max-w-3xl">
      <Encabezado
        Icono={IconoStock}
        titulo="Stock"
        descripcion="Cargá los productos que querés controlar: se descuentan solos al vender y te avisa qué pedir."
        acciones={
          <>
            <Boton type="button" onClick={() => abrirCarga('ingreso')} className="sm:w-auto">
              Llegó mercadería
            </Boton>
            <Boton type="button" variante="secundario" onClick={() => abrirCarga('conteo')} className="sm:w-auto">
              Contar stock
            </Boton>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-2 sm:max-w-md" role="group" aria-label="Qué ver">
        {(
          [
            ['stock', 'Stock'],
            ['pedido', 'Para pedir'],
          ] as const
        ).map(([v, etiqueta]) => (
          <button
            key={v}
            type="button"
            aria-pressed={vista === v}
            onClick={() => setVista(v)}
            className={`min-h-11 rounded-xl border px-2 font-semibold ${vista === v ? 'border-green-600 bg-green-600 text-crema' : 'border-stone-300 bg-white'}`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {aviso && (
        <p
          className={`mt-4 rounded-xl p-3 ${aviso.tipo === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}
          role={aviso.tipo === 'ok' ? 'status' : 'alert'}
          data-testid="aviso-stock"
        >
          {aviso.texto}
        </p>
      )}

      {stock === null ? (
        <p className="mt-6 text-stone-600">Cargando…</p>
      ) : stock.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-stone-300 p-4 text-center text-stone-600">
          Todavía no controlás el stock de ningún producto. Tocá “Contar stock” para cargar lo que tenés, o “Llegó mercadería” cuando entre algo.
        </p>
      ) : vista === 'stock' ? (
        <ListaStock stock={stock} onContar={(p) => abrirCarga('conteo', p)} onCambio={cargar} onAviso={setAviso} />
      ) : (
        <Pedido stock={stock} nombreComercio={nombreComercio} />
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8 sm:block sm:w-auto sm:px-8">
        Volver
      </Boton>
    </main>
  );
}

function ListaStock({
  stock,
  onContar,
  onCambio,
  onAviso,
}: {
  stock: ProductoConStock[];
  onContar: (p: ProductoConStock) => void;
  onCambio: () => void;
  onAviso: (a: { tipo: 'ok' | 'error'; texto: string }) => void;
}) {
  const sesion = useSesion();
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<string | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoStock[] | null>(null);
  const mostrados = buscar(stock, busqueda);

  function abrir(id: string) {
    if (abierto === id) return setAbierto(null);
    setAbierto(id);
    setMovimientos(null);
    movimientosDeStock(sesion, id).then(setMovimientos, () => setMovimientos([]));
  }

  return (
    <>
      <label htmlFor="buscar-stock" className="sr-only">
        Buscar producto
      </label>
      <input
        id="buscar-stock"
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar producto"
        autoComplete="off"
        className="mt-4 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base shadow-xs outline-none placeholder:text-stone-500 focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
      />
      <ul className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="lista-stock">
        {mostrados.length === 0 && <li className="p-3 text-stone-600">No hay productos con “{busqueda.trim()}”.</li>}
        {mostrados.map((p) => {
          const porDia = p.vendido28 / DIAS_HISTORIA;
          const alcance = textoAlcance(p.cantidad, porDia);
          const poco = p.cantidad <= 0 || (porDia > 0 && p.cantidad / porDia < 7);
          return (
            <li key={p.productoId}>
              <button type="button" onClick={() => abrir(p.productoId)} aria-expanded={abierto === p.productoId} className="flex min-h-14 w-full items-center gap-3 p-3 text-left hover:bg-stone-50">
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.descripcion}</span>
                  <span className={`block text-sm ${poco ? 'font-semibold text-red-700' : 'text-stone-600'}`}>{alcance}</span>
                </span>
                <span className={`text-lg font-bold tabular-nums ${p.cantidad < 0 ? 'text-red-700' : ''}`}>{formatearCantidad(p.cantidad)}</span>
              </button>
              {abierto === p.productoId && (
                <div className="border-t border-stone-200 bg-stone-50 p-3">
                  <p className="text-sm text-stone-600">
                    Vendido en 4 semanas: {formatearCantidad(p.vendido28)}
                    {p.proveedor ? ` · Lo trae ${p.proveedor}` : ''}
                  </p>
                  {p.cantidad < 0 && <p className="mt-1 text-sm text-red-800">Quedó en negativo: se vendió más de lo que había cargado. Contalo de nuevo.</p>}
                  <ul className="mt-2 space-y-1 text-sm">
                    {movimientos === null && <li className="text-stone-600">Cargando…</li>}
                    {movimientos?.slice(0, 10).map((m, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="flex-1">
                          {NOMBRE_MOVIMIENTO[m.tipo]} · {fechaYHora(m.fecha)}
                          {m.nota ? ` · ${m.nota}` : ''}
                        </span>
                        <span className="tabular-nums">
                          {m.cantidad > 0 ? '+' : ''}
                          {formatearCantidad(m.cantidad)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button type="button" onClick={() => onContar(p)} className="min-h-11 font-semibold text-green-800 underline underline-offset-4">
                      Contar
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        dejarStock(sesion, p.productoId).then(
                          () => {
                            onAviso({ tipo: 'ok', texto: `Ya no se controla el stock de ${p.descripcion}.` });
                            onCambio();
                          },
                          (e: Error) => onAviso({ tipo: 'error', texto: e.message }),
                        )
                      }
                      className="min-h-11 font-semibold text-red-700"
                    >
                      Dejar de controlar
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

function Pedido({ stock, nombreComercio }: { stock: ProductoConStock[]; nombreComercio: string }) {
  const [dias, setDias] = useState<Cobertura>(7);
  const [copiado, setCopiado] = useState<string | null>(null);
  const grupos = useMemo(() => porProveedor(sugerirPedido(stock, dias)), [stock, dias]);

  async function copiar(clave: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(clave);
    } catch {
      setCopiado(null);
    }
  }

  return (
    <section className="mt-4" aria-label="Para pedir">
      <fieldset>
        <legend className="font-semibold">¿Para cuántos días querés tener?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2 sm:max-w-md">
          {COBERTURAS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={dias === d}
              onClick={() => setDias(d)}
              className={`min-h-11 rounded-xl border px-2 font-medium ${dias === d ? 'border-green-600 bg-green-600 text-crema' : 'border-stone-300 bg-white'}`}
            >
              {d} días
            </button>
          ))}
        </div>
        <p className="mt-1 text-sm text-stone-600">Se calcula con lo que vendiste en las últimas 4 semanas y lo que tenés ahora.</p>
      </fieldset>

      {grupos.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-stone-300 p-4 text-center text-stone-600" data-testid="nada-para-pedir">
          Con lo que tenés te alcanza para {dias} días. No hace falta pedir nada.
        </p>
      ) : (
        <div className="mt-4 space-y-4" data-testid="pedido">
          {grupos.map((g) => {
            const clave = g.proveedor ?? '';
            const texto = textoPedido(nombreComercio, g.items);
            return (
              <div key={clave} className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <h3 className="font-bold">{g.proveedor ?? 'Sin proveedor vinculado'}</h3>
                <ul className="mt-2 divide-y divide-stone-100">
                  {g.items.map((i) => (
                    <li key={i.productoId} className="flex items-center gap-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block">{i.descripcion}</span>
                        <span className="block text-sm text-stone-600">
                          Hay {formatearCantidad(i.cantidad)} · {textoAlcance(i.cantidad, i.porDia)}
                        </span>
                      </span>
                      <span className="font-bold tabular-nums">Pedir {formatearCantidad(i.pedir)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Boton type="button" variante="secundario" onClick={() => copiar(clave, texto)} className="sm:w-auto">
                    {copiado === clave ? 'Copiado' : 'Copiar pedido'}
                  </Boton>
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 font-semibold text-stone-800 shadow-xs hover:bg-stone-50"
                  >
                    Mandar por WhatsApp
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface Renglon {
  productoId: string;
  descripcion: string;
  texto: string;
}

/** Cargar varias cantidades de una vez: lo que llegó (suma) o lo que se contó (reemplaza). */
function CargarStock({
  modo,
  productos,
  stock,
  inicial,
  onListo,
  onVolver,
}: {
  modo: Modo;
  productos: Producto[] | null;
  stock: ProductoConStock[];
  inicial?: ProductoConStock;
  onListo: (texto: string) => void;
  onVolver: () => void;
}) {
  const sesion = useSesion();
  const [renglones, setRenglones] = useState<Renglon[]>(
    inicial ? [{ productoId: inicial.productoId, descripcion: inicial.descripcion, texto: modo === 'conteo' ? formatearCantidad(Math.max(0, inicial.cantidad)) : '' }] : [],
  );
  const [busqueda, setBusqueda] = useState('');
  /** Código escrito con Enter antes de que cargaran los productos: se agrega al cargar. */
  const [enEspera, setEnEspera] = useState<string | null>(null);
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const enStock = useMemo(() => new Map(stock.map((s) => [s.productoId, s])), [stock]);
  const elegidos = new Set(renglones.map((r) => r.productoId));
  const encontrados = busqueda.trim() ? buscar(productos ?? [], busqueda).filter((p) => !elegidos.has(p.id)).slice(0, 8) : [];

  /** Enter: el producto con ese código exacto o, si la búsqueda da uno solo, ése. */
  function agregarConEnter(texto: string) {
    if (productos === null) {
      setEnEspera(texto);
      return;
    }
    const codigo = texto.trim().toLowerCase();
    const exacto = productos.find((p) => !elegidos.has(p.id) && (p.codigoInterno.toLowerCase() === codigo || p.codigoBarras === codigo));
    const lista = buscar(productos, texto).filter((p) => !elegidos.has(p.id));
    if (exacto) agregar(exacto);
    else if (lista.length === 1) agregar(lista[0]!);
  }

  useEffect(() => {
    if (productos === null || enEspera === null) return;
    setEnEspera(null);
    agregarConEnter(enEspera);
  }, [productos, enEspera]);

  function agregar(p: Producto) {
    const actual = enStock.get(p.id);
    setRenglones((r) => [...r, { productoId: p.id, descripcion: p.descripcion, texto: modo === 'conteo' && actual ? formatearCantidad(Math.max(0, actual.cantidad)) : '' }]);
    setBusqueda('');
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const items = [];
    for (const r of renglones) {
      const cantidad = r.texto.trim() === '0' && modo === 'conteo' ? 0 : leerCantidad(r.texto);
      if (cantidad === null) return setError(`Revisá la cantidad de ${r.descripcion}.`);
      items.push({ productoId: r.productoId, cantidad });
    }
    if (items.length === 0) return setError('Agregá al menos un producto.');
    setGuardando(true);
    setError(null);
    try {
      if (modo === 'ingreso') await ingresoStock(sesion, items, nota);
      else await ajustarStock(sesion, items, nota);
      const n = items.length === 1 ? '1 producto' : `${items.length} productos`;
      onListo(modo === 'ingreso' ? `Listo: se sumó lo que llegó de ${n}.` : `Listo: se guardó el conteo de ${n}.`);
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <Encabezado
        Icono={IconoStock}
        titulo={modo === 'ingreso' ? 'Llegó mercadería' : 'Contar stock'}
        descripcion={
          modo === 'ingreso'
            ? 'Buscá cada producto que llegó y escribí cuántos. Se suma a lo que había.'
            : 'Buscá cada producto, contalo y escribí cuántos hay. Reemplaza lo que había cargado.'
        }
      />
      <form onSubmit={guardar} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="buscar-carga" className="block font-semibold">
            Agregar producto
          </label>
          <input
            id="buscar-carga"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                agregarConEnter(busqueda);
              }
            }}
            placeholder={productos === null ? 'Cargando productos…' : 'Buscá por nombre o código'}
            autoComplete="off"
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base outline-none placeholder:text-stone-500 focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
          />
          {busqueda.trim() !== '' && (
            <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="productos-encontrados">
              {encontrados.length === 0 && <li className="p-3 text-stone-600">No hay productos con “{busqueda.trim()}”.</li>}
              {encontrados.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => agregar(p)} className="flex min-h-11 w-full items-center gap-3 p-3 text-left hover:bg-green-50">
                    <span className="flex-1">{p.descripcion}</span>
                    {enStock.has(p.id) && <span className="text-sm text-stone-600">hay {formatearCantidad(enStock.get(p.id)!.cantidad)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {renglones.length > 0 && (
          <ul className="space-y-2" data-testid="renglones-stock">
            {renglones.map((r, i) => (
              <li key={r.productoId} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white p-3">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.descripcion}</span>
                  {enStock.has(r.productoId) ? (
                    <span className="block text-sm text-stone-600">Había {formatearCantidad(enStock.get(r.productoId)!.cantidad)}</span>
                  ) : (
                    <span className="block text-sm text-stone-600">Empieza a llevar stock</span>
                  )}
                </span>
                <input
                  aria-label={`${modo === 'ingreso' ? 'Llegaron' : 'Hay'} de ${r.descripcion}`}
                  value={r.texto}
                  onChange={(e) => setRenglones((rs) => rs.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                  inputMode="decimal"
                  placeholder="0"
                  className="h-11 w-24 rounded-xl border border-stone-300 px-2 text-right text-lg tabular-nums outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
                />
                <button
                  type="button"
                  aria-label={`Sacar ${r.descripcion}`}
                  onClick={() => setRenglones((rs) => rs.filter((_, j) => j !== i))}
                  className="size-11 shrink-0 rounded-xl text-xl text-stone-600 hover:bg-stone-100"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}

        <CampoTexto etiqueta="Nota (opcional)" valor={nota} onCambiar={setNota} maxLength={200} placeholder={modo === 'ingreso' ? 'Remito, proveedor…' : ''} />
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" disabled={guardando || renglones.length === 0}>
          Guardar
        </Boton>
        <Boton type="button" variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </form>
    </main>
  );
}
