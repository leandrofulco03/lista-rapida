import { useEffect, useState } from 'react';
import { db, listarProductos, listarRubros, productosUltimaRevision } from '../../db';
import type { Producto } from '../../db';
import { fechaEtiqueta } from '../../domain/etiquetas';
import { agruparPorRubro, armarCsvCaja } from '../../domain/exportar';
import { Boton } from '../../ui/Boton';
import { descargar } from '../../ui/descargar';
import { Opciones } from '../../ui/Opciones';

interface Props {
  nombreComercio: string;
  onVolver: () => void;
}

type Alcance = 'todos' | 'cambiados';

interface Datos {
  productos: Producto[];
  rubros: Map<number, string>;
  cambiados: Set<number>;
}

/** F11: lista de precios para el mostrador (PDF) y CSV para el sistema de caja. */
export function PantallaListaPrecios({ nombreComercio, onVolver }: Props) {
  const [datos, setDatos] = useState<Datos | null>(null);
  const [alcance, setAlcance] = useState<Alcance>('todos');
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listarProductos(db), listarRubros(db), productosUltimaRevision(db)]).then(([productos, rubros, cambiados]) =>
      setDatos({ productos, rubros: new Map(rubros.map((r) => [r.id, r.nombre])), cambiados: new Set(cambiados) }),
    );
  }, []);

  if (datos === null) return null;

  const conPrecio = datos.productos.filter((p) => p.precioVentaActual > 0);
  const sinPrecio = datos.productos.length - conPrecio.length;
  const cambiados = conPrecio.filter((p) => datos.cambiados.has(p.id));
  const elegidos = alcance === 'todos' ? conPrecio : cambiados;
  const hoy = new Date();
  const sufijo = hoy.toISOString().slice(0, 10);

  async function bajarPdf() {
    setError(null);
    setGenerando(true);
    try {
      const { generarListaPreciosPdf } = await import('../../salidas/listaPreciosPdf');
      const bytes = await generarListaPreciosPdf(agruparPorRubro(elegidos, datos!.rubros), nombreComercio, fechaEtiqueta(hoy));
      descargar(`lista-de-precios-${sufijo}.pdf`, new Uint8Array(bytes), 'application/pdf');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerando(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <h1 className="text-2xl font-bold">Lista de precios</h1>
      <p className="mt-1 text-stone-600">La lista para el mostrador en PDF, y un CSV para pasar los precios al sistema de caja.</p>

      <div className="mt-6">
        <Opciones
          legend="¿Qué productos?"
          opciones={[
            { valor: 'todos' as Alcance, etiqueta: `Todos (${conPrecio.length})` },
            { valor: 'cambiados' as Alcance, etiqueta: `Los de la última lista (${cambiados.length})` },
          ]}
          valor={alcance}
          onElegir={setAlcance}
        />
        {sinPrecio > 0 && (
          <p className="mt-2 text-sm text-stone-600">
            {sinPrecio} {sinPrecio === 1 ? 'producto sin precio no se incluye' : 'productos sin precio no se incluyen'}.
          </p>
        )}
      </div>

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 space-y-3">
        <Boton type="button" onClick={bajarPdf} disabled={generando || elegidos.length === 0}>
          {generando ? 'Armando el PDF…' : 'Bajar lista en PDF'}
        </Boton>
        <Boton
          type="button"
          variante="secundario"
          disabled={elegidos.length === 0}
          onClick={() => descargar(`precios-para-la-caja-${sufijo}.csv`, armarCsvCaja(elegidos, datos.rubros), 'text/csv;charset=utf-8')}
        >
          Bajar CSV para la caja
        </Boton>
        <p className="text-sm text-stone-600">El CSV trae código, descripción, rubro, precio, IVA y fecha; se abre con Excel.</p>
        <Boton type="button" variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </div>
    </main>
  );
}
