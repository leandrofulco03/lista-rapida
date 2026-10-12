import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { crearProveedor, db, listarProveedores } from '../../db';
import type { Proveedor } from '../../db';
import { formatearDescuentos } from '../../domain/proveedor';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { PantallaProveedor } from './PantallaProveedor';

interface Props {
  onVolver: () => void;
}

/** F02: lista de proveedores; desde acá se crean y se abre la ficha de cada uno. */
export function PantallaProveedores({ onVolver }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [abierto, setAbierto] = useState<Proveedor | null>(null);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cargar = () => listarProveedores(db).then(setProveedores);
  useEffect(() => {
    cargar();
  }, []);

  async function crear(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const proveedor = await crearProveedor(db, nombreNuevo, false);
      setNombreNuevo('');
      await cargar();
      setAbierto(proveedor);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (abierto) {
    return (
      <PantallaProveedor
        proveedor={abierto}
        onVolver={() => {
          setAbierto(null);
          cargar();
        }}
      />
    );
  }
  if (proveedores === null) return null;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <h1 className="text-2xl font-bold">Proveedores</h1>
      <p className="mt-1 text-stone-600">Cada proveedor recuerda cómo viene su lista.</p>

      {proveedores.length === 0 ? (
        <p className="mt-6 rounded-xl bg-stone-100 p-3">Todavía no cargaste proveedores. También se crean al subir una lista.</p>
      ) : (
        <ul className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-300 bg-white" data-testid="lista-proveedores">
          {proveedores.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setAbierto(p)} className="flex min-h-11 w-full flex-col items-start p-3 text-left">
                <span className="font-semibold">{p.nombre}</span>
                <span className="text-sm text-stone-500">
                  {[
                    p.listaIncluyeIva ? 'Lista con IVA' : 'Lista + IVA',
                    p.descuentosPct.length ? `Descuento ${formatearDescuentos(p.descuentosPct)}%` : null,
                    p.mapeoColumnas ? 'Columnas recordadas' : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={crear} noValidate className="mt-6 space-y-3">
        <CampoTexto etiqueta="Proveedor nuevo" valor={nombreNuevo} onCambiar={setNombreNuevo} placeholder="Ej.: Distribuidora El Sol" error={error ?? undefined} />
        <Boton type="submit">Agregar proveedor</Boton>
      </form>

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-3">
        Volver
      </Boton>
    </main>
  );
}
