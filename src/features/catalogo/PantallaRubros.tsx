import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { borrarRubro, db, guardarRubro, listarRubros } from '../../db';
import type { Rubro } from '../../db';
import { formatearPorcentaje, parsearPorcentaje } from '../../domain/porcentaje';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoCatalogo } from '../../ui/Iconos';
import { CampoTexto } from '../../ui/CampoTexto';

interface Props {
  onVolver: () => void;
}

/** F03: rubros del catálogo, cada uno con un recargo propio opcional. */
export function PantallaRubros({ onVolver }: Props) {
  const [rubros, setRubros] = useState<Rubro[] | null>(null);
  const [editando, setEditando] = useState<Rubro | null>(null);
  const [nombre, setNombre] = useState('');
  const [recargoTexto, setRecargoTexto] = useState('');
  const [error, setError] = useState<string | null>(null);

  const cargar = () => listarRubros(db).then(setRubros);
  useEffect(() => {
    cargar();
  }, []);

  function editar(rubro: Rubro | null) {
    setEditando(rubro);
    setNombre(rubro?.nombre ?? '');
    setRecargoTexto(rubro?.recargoPct != null ? formatearPorcentaje(rubro.recargoPct) : '');
    setError(null);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const recargoPct = recargoTexto.trim() === '' ? null : parsearPorcentaje(recargoTexto);
    if (recargoTexto.trim() !== '' && recargoPct === null) return setError('Escribí el recargo como "35" o "12,5", o dejalo vacío.');
    try {
      await guardarRubro(db, { nombre, recargoPct }, editando?.id);
      editar(null);
      await cargar();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function borrar() {
    if (!editando) return;
    await borrarRubro(db, editando.id);
    editar(null);
    await cargar();
  }

  if (rubros === null) return null;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado
        Icono={IconoCatalogo}
        titulo="Rubros"
        descripcion="Un rubro puede tener su propio recargo. Si no tiene, sus productos usan el general."
      />

      {rubros.length > 0 && (
        <ul className="mt-6 divide-y divide-stone-200 rounded-xl border border-stone-200 bg-white shadow-sm" data-testid="lista-rubros">
          {rubros.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => editar(r)} className="flex min-h-11 w-full items-center justify-between p-3 text-left">
                <span className="font-medium">{r.nombre}</span>
                <span className="text-stone-600">{r.recargoPct != null ? `${formatearPorcentaje(r.recargoPct)}%` : 'Recargo general'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={guardar} noValidate className="mt-6 space-y-4 rounded-xl border border-stone-200 bg-white shadow-sm p-3">
        <h2 className="text-lg font-semibold">{editando ? `Editar ${editando.nombre}` : 'Rubro nuevo'}</h2>
        <CampoTexto etiqueta="Nombre del rubro" valor={nombre} onCambiar={setNombre} placeholder="Ej.: Almacén" />
        <CampoTexto etiqueta="Recargo del rubro" valor={recargoTexto} onCambiar={setRecargoTexto} sufijo="%" inputMode="decimal" placeholder="General" />
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit">{editando ? 'Guardar rubro' : 'Agregar rubro'}</Boton>
        {editando && (
          <>
            <Boton type="button" variante="secundario" onClick={() => editar(null)}>
              Cancelar
            </Boton>
            <Boton type="button" variante="peligro" onClick={borrar}>
              Borrar rubro
            </Boton>
            <p className="text-sm text-stone-600">Al borrarlo, sus productos quedan sin rubro.</p>
          </>
        )}
      </form>

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-6">
        Volver
      </Boton>
    </main>
  );
}
