import { useEffect, useMemo, useState } from 'react';
import { filtrarProductos, listarProductos, listarRubros } from '../../db';
import { useSesion } from '../../sesion';
import type { Producto, Rubro } from '../../db';
import type { ConfigComercio } from '../../domain/config';
import { formatearPesos } from '../../domain/dinero';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoCatalogo } from '../../ui/Iconos';
import { PantallaImportarCatalogo } from './PantallaImportarCatalogo';
import { PantallaProducto } from './PantallaProducto';
import { PantallaRubros } from './PantallaRubros';

interface Props {
  config: ConfigComercio;
  onVolver: () => void;
}

type Vista = { tipo: 'lista' } | { tipo: 'producto'; producto: Producto | null } | { tipo: 'rubros' } | { tipo: 'importar' };

/** Cuántos productos se muestran a la vez; con la búsqueda se llega al resto. */
const MOSTRAR = 100;

/** F03: catálogo propio del comercio, con búsqueda. */
export function PantallaCatalogo({ config, onVolver }: Props) {
  const sesion = useSesion();
  const [productos, setProductos] = useState<Producto[] | null>(null);
  const [rubros, setRubros] = useState<Rubro[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });

  async function cargar() {
    const [p, r] = await Promise.all([listarProductos(sesion), listarRubros(sesion)]);
    setProductos(p);
    setRubros(r);
  }
  useEffect(() => {
    cargar();
  }, []);

  const filtrados = useMemo(() => (productos ? filtrarProductos(productos, busqueda) : []), [productos, busqueda]);
  const nombreRubro = useMemo(() => new Map(rubros.map((r) => [r.id, r.nombre])), [rubros]);

  const volverALista = () => {
    setVista({ tipo: 'lista' });
    cargar();
  };
  if (vista.tipo === 'producto') {
    return <PantallaProducto producto={vista.producto} rubros={rubros} config={config} onVolver={volverALista} />;
  }
  if (vista.tipo === 'rubros') return <PantallaRubros onVolver={volverALista} />;
  if (vista.tipo === 'importar') return <PantallaImportarCatalogo config={config} onVolver={volverALista} />;
  if (productos === null) return null;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado
        Icono={IconoCatalogo}
        titulo="Catálogo"
        descripcion={productos.length === 1 ? '1 producto' : `${productos.length} productos`}
        testIdDescripcion="cantidad-productos"
      />

      <div className="mt-4 space-y-3">
        <Boton type="button" onClick={() => setVista({ tipo: 'producto', producto: null })}>
          Agregar producto
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => setVista({ tipo: 'importar' })}>
          Importar desde Excel
        </Boton>
        <Boton type="button" variante="secundario" onClick={() => setVista({ tipo: 'rubros' })}>
          Rubros
        </Boton>
      </div>

      {productos.length > 0 && (
        <>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por descripción o código"
            aria-label="Buscar producto"
            className="mt-6 min-h-11 w-full rounded-xl border border-stone-200 bg-white shadow-sm px-3 text-lg"
          />
          <ul className="mt-3 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm" data-testid="lista-productos">
            {filtrados.slice(0, MOSTRAR).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setVista({ tipo: 'producto', producto: p })}
                  className="flex min-h-11 w-full items-start justify-between gap-3 p-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block break-words font-medium">{p.descripcion}</span>
                    <span className="block text-sm text-stone-500">
                      {[p.codigoInterno, p.rubroId !== null ? nombreRubro.get(p.rubroId) : null].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 font-semibold">{p.precioVentaActual > 0 ? formatearPesos(p.precioVentaActual) : 'Sin precio'}</span>
                </button>
              </li>
            ))}
          </ul>
          {filtrados.length === 0 && <p className="mt-3 text-stone-600">No hay productos que coincidan.</p>}
          {filtrados.length > MOSTRAR && (
            <p className="mt-3 text-sm text-stone-600">
              Se muestran {MOSTRAR} de {filtrados.length}. Buscá para encontrar el resto.
            </p>
          )}
        </>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-6">
        Volver
      </Boton>
    </main>
  );
}
