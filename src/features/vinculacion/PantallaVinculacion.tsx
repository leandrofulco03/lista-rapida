import { useEffect, useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { db, filtrarProductos, guardarVinculos, listarProductos, vinculosDeProveedor } from '../../db';
import type { Producto, Proveedor } from '../../db';
import { formatearPesos } from '../../domain/dinero';
import type { LineaLista } from '../../domain/lineaLista';
import { IndiceCatalogo, vincularLinea } from '../../domain/vinculacion';
import type { ResultadoVinculo } from '../../domain/vinculacion';
import { Boton } from '../../ui/Boton';

interface Props {
  proveedor: Proveedor;
  lineas: LineaLista[];
  /** Sigue a la revisión de precios (F09) con el producto de cada línea (null: sin vincular). */
  onSeguir: (elecciones: (number | null)[]) => void;
  onVolver: () => void;
}

interface Comparacion {
  productos: Map<number, Producto>;
  todos: Producto[];
  resultados: ResultadoVinculo[];
}

/** Producto elegido para cada línea (por posición). null: sin vincular. */
type Elecciones = (number | null)[];

/** F07: une cada línea de la lista con un producto del catálogo. Lo confirmado queda guardado para la próxima lista; después sigue la revisión de precios (F09). */
export function PantallaVinculacion({ proveedor, lineas, onSeguir, onVolver }: Props) {
  const [comparacion, setComparacion] = useState<Comparacion | null>(null);
  const [elecciones, setElecciones] = useState<Elecciones>([]);
  const [buscando, setBuscando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    Promise.all([listarProductos(db), vinculosDeProveedor(db, proveedor.id)]).then(([todos, vinculados]) => {
      const productos = new Map(todos.map((p) => [p.id, p]));
      // Un vínculo a un producto que se borró del catálogo ya no vale.
      const vigentes = new Map([...vinculados].filter(([, id]) => productos.has(id)));
      const indice = new IndiceCatalogo(todos);
      const resultados = lineas.map((l) => vincularLinea(l, vigentes, indice));
      setComparacion({ productos, todos, resultados });
      setElecciones(resultados.map((r) => r.productoId));
    });
  }, [proveedor.id, lineas]);

  const grupos = useMemo(() => {
    const porEstado = { vinculada: [] as number[], sugerida: [] as number[], dudosa: [] as number[], nueva: [] as number[] };
    comparacion?.resultados.forEach((r, i) => porEstado[r.estado].push(i));
    return porEstado;
  }, [comparacion]);

  if (comparacion === null) return null;

  const { productos, todos, resultados } = comparacion;
  /** Lo que cambia respecto de lo ya guardado: sugeridas aceptadas, dudosas y nuevas elegidas, vinculadas cambiadas. */
  const cambios = lineas.flatMap((l, i) => {
    const productoId = elecciones[i];
    if (productoId == null || productoId === (resultados[i]!.estado === 'vinculada' ? resultados[i]!.productoId : undefined)) return [];
    return [{ codigo: l.codigo, descripcion: l.descripcion, presentacion: l.presentacion, productoId }];
  });
  const elegir = (i: number, productoId: number | null) => {
    setElecciones((actuales) => actuales.map((e, j) => (j === i ? productoId : e)));
    setBuscando(null);
  };

  async function guardar() {
    setGuardando(true);
    try {
      await guardarVinculos(db, proveedor.id, cambios);
    } finally {
      setGuardando(false);
    }
    onSeguir(elecciones);
  }

  if (todos.length === 0) {
    return (
      <main className="mx-auto max-w-md px-4 pt-8 pb-12">
        <h1 className="text-2xl font-bold">Tu catálogo está vacío</h1>
        <p className="mt-2 text-lg text-stone-700">
          Para comparar la lista hace falta tu catálogo. Cargalo desde Inicio → Catálogo y volvé a subir la lista.
        </p>
        <Boton type="button" onClick={onVolver} className="mt-6">
          Volver
        </Boton>
      </main>
    );
  }

  const fila = (i: number, acciones: ReactNode) => (
    <li key={i} className="p-3" data-testid="linea-vinculo">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 break-words font-medium">{lineas[i]!.descripcion}</p>
        <p className="shrink-0 font-semibold">{formatearPesos(lineas[i]!.costo)}</p>
      </div>
      {lineas[i]!.codigo && <p className="text-sm text-stone-500">Código {lineas[i]!.codigo}</p>}
      <div className="mt-2">{acciones}</div>
      {buscando === i && <BuscarProducto productos={todos} onElegir={(id) => elegir(i, id)} onCancelar={() => setBuscando(null)} />}
    </li>
  );
  const nombre = (id: number) => productos.get(id)?.descripcion ?? '';
  const botonBuscar = (i: number, texto = 'Buscar otro') =>
    buscando !== i && (
      <button type="button" onClick={() => setBuscando(i)} className="min-h-11 rounded-lg px-2 font-semibold text-green-800 underline">
        {texto}
      </button>
    );
  const elegido = (i: number) =>
    elecciones[i] != null && (
      <p className="flex flex-wrap items-center gap-x-2 text-green-900">
        <span aria-hidden>✓</span> Va con <span className="font-semibold">{nombre(elecciones[i]!)}</span>
        <button type="button" onClick={() => elegir(i, null)} className="min-h-11 rounded-lg px-2 font-semibold text-stone-700 underline">
          {resultados[i]!.estado === 'sugerida' ? 'No es este' : 'Deshacer'}
        </button>
      </p>
    );

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <p className="text-sm font-semibold text-green-800">{proveedor.nombre}</p>
      <h1 className="mt-1 text-2xl font-bold">Comparamos con tu catálogo</h1>
      <ul className="mt-4 grid grid-cols-2 gap-2 text-center" data-testid="resumen-vinculos">
        {[
          { n: grupos.vinculada.length, texto: 'ya vinculados' },
          { n: grupos.sugerida.length, texto: 'sugeridos' },
          { n: grupos.dudosa.length, texto: 'para elegir' },
          { n: grupos.nueva.length, texto: 'no están' },
        ].map(({ n, texto }) => (
          <li key={texto} className="rounded-xl border border-stone-300 bg-white p-2">
            <span className="block text-2xl font-bold">{n}</span>
            {texto}
          </li>
        ))}
      </ul>

      {grupos.dudosa.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">¿Con cuál va? ({grupos.dudosa.length})</h2>
          <p className="text-sm text-stone-600">Se parecen a más de un producto, o el contenido no coincide.</p>
          <ul className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white" data-testid="grupo-dudosas">
            {grupos.dudosa.map((i) =>
              fila(
                i,
                elecciones[i] != null ? (
                  elegido(i)
                ) : (
                  <div className="space-y-2">
                    {resultados[i]!.opciones.map((o) => (
                      <button
                        key={o.productoId}
                        type="button"
                        onClick={() => elegir(i, o.productoId)}
                        className="min-h-11 w-full rounded-xl border border-stone-300 px-3 py-2 text-left hover:bg-stone-100"
                      >
                        {nombre(o.productoId)}
                      </button>
                    ))}
                    {botonBuscar(i)}
                  </div>
                ),
              ),
            )}
          </ul>
        </section>
      )}

      {grupos.sugerida.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Sugeridos ({grupos.sugerida.length})</h2>
          <p className="text-sm text-stone-600">Revisalos una vez; al guardar quedan vinculados para siempre.</p>
          <ul className="mt-2 divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white" data-testid="grupo-sugeridas">
            {grupos.sugerida.map((i) => fila(i, elecciones[i] != null ? elegido(i) : botonBuscar(i, 'Buscar en el catálogo')))}
          </ul>
        </section>
      )}

      {grupos.nueva.length > 0 && (
        <details className="mt-6 rounded-xl border border-stone-300 bg-white p-3" data-testid="grupo-nuevas">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            No están en tu catálogo ({grupos.nueva.length})
          </summary>
          <ul className="mt-2 divide-y divide-stone-200">
            {grupos.nueva.map((i) => fila(i, elecciones[i] != null ? elegido(i) : botonBuscar(i, 'Buscar en el catálogo')))}
          </ul>
        </details>
      )}

      {grupos.vinculada.length > 0 && (
        <details className="mt-4 rounded-xl border border-stone-300 bg-white p-3" data-testid="grupo-vinculadas">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Ya vinculados ({grupos.vinculada.length})</summary>
          <ul className="mt-2 divide-y divide-stone-200">
            {grupos.vinculada.map((i) =>
              fila(
                i,
                <p className="flex flex-wrap items-center gap-x-2 text-stone-700">
                  Va con <span className="font-semibold">{nombre(elecciones[i] ?? resultados[i]!.productoId!)}</span>
                  {botonBuscar(i, 'Cambiar')}
                </p>,
              ),
            )}
          </ul>
        </details>
      )}

      <div className="mt-6 space-y-3">
        <Boton type="button" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : cambios.length > 0 ? `Guardar ${cambios.length} ${cambios.length === 1 ? 'vínculo' : 'vínculos'} y revisar precios` : 'Revisar precios'}
        </Boton>
        <Boton type="button" variante="secundario" onClick={onVolver}>
          Volver sin guardar
        </Boton>
      </div>
    </main>
  );
}

interface PropsBuscar {
  productos: Producto[];
  onElegir: (productoId: number) => void;
  onCancelar: () => void;
}

const RESULTADOS = 5;

/** Buscador del catálogo para elegir a mano el producto de una línea. */
function BuscarProducto({ productos, onElegir, onCancelar }: PropsBuscar) {
  const [busqueda, setBusqueda] = useState('');
  const id = useId();
  const encontrados = busqueda.trim() === '' ? [] : filtrarProductos(productos, busqueda).slice(0, RESULTADOS);
  return (
    <div className="mt-2 rounded-xl bg-stone-50 p-2">
      <label htmlFor={id} className="block font-medium">
        Buscar en el catálogo
      </label>
      <input
        id={id}
        autoFocus
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Código o palabras"
        className="mt-1 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg"
      />
      <ul className="mt-2 space-y-1">
        {encontrados.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onElegir(p.id)} className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-left">
              {p.descripcion} <span className="text-sm text-stone-500">{p.codigoInterno}</span>
            </button>
          </li>
        ))}
      </ul>
      {busqueda.trim() !== '' && encontrados.length === 0 && <p className="mt-1 text-stone-600">No encontramos productos con eso.</p>}
      <button type="button" onClick={onCancelar} className="min-h-11 rounded-lg px-2 font-semibold text-stone-700 underline">
        Cancelar
      </button>
    </div>
  );
}
