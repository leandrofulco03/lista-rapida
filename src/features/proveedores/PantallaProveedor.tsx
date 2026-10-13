import { useState } from 'react';
import type { FormEvent } from 'react';
import { actualizarProveedor, borrarProveedor, db, olvidarColumnas } from '../../db';
import type { Proveedor } from '../../db';
import { descuentoEfectivo, formatearDescuentos, parsearDescuentos } from '../../domain/proveedor';
import { formatearPorcentaje } from '../../domain/porcentaje';
import { NOMBRE_CAMPO } from '../mapeo/PantallaMapeo';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoProveedores } from '../../ui/Iconos';
import { CampoTexto } from '../../ui/CampoTexto';
import { Opciones } from '../../ui/Opciones';

interface Props {
  proveedor: Proveedor;
  onVolver: () => void;
}

/** F02: ficha del proveedor: nombre, si su lista trae IVA, descuentos y columnas recordadas. */
export function PantallaProveedor({ proveedor, onVolver }: Props) {
  const [nombre, setNombre] = useState(proveedor.nombre);
  const [conIva, setConIva] = useState(proveedor.listaIncluyeIva);
  const [descuentosTexto, setDescuentosTexto] = useState(formatearDescuentos(proveedor.descuentosPct));
  const [columnas, setColumnas] = useState(proveedor.mapeoColumnas);
  const [error, setError] = useState<string | null>(null);
  const [confirmarBaja, setConfirmarBaja] = useState(false);

  const descuentos = parsearDescuentos(descuentosTexto);
  const titulos = columnas?.titulos;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (descuentos === null) return setError('Escribí los descuentos como "10" o "10 + 5".');
    try {
      await actualizarProveedor(db, proveedor.id, { nombre, listaIncluyeIva: conIva, descuentosPct: descuentos });
      onVolver();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function olvidar() {
    await olvidarColumnas(db, proveedor.id);
    setColumnas(null);
  }

  async function darDeBaja() {
    await borrarProveedor(db, proveedor.id);
    onVolver();
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado Icono={IconoProveedores} antetitulo="Proveedor" titulo={proveedor.nombre} />

      <form onSubmit={guardar} noValidate className="mt-6 space-y-6">
        <CampoTexto etiqueta="Nombre" valor={nombre} onCambiar={setNombre} />

        <Opciones
          legend="¿Los precios de su lista incluyen IVA?"
          opciones={[
            { valor: false, etiqueta: 'No, son + IVA' },
            { valor: true, etiqueta: 'Sí, con IVA' },
          ]}
          valor={conIva}
          onElegir={setConIva}
          ayuda='Si el título del precio dice "c/IVA" o "s/IVA", se usa eso.'
        />

        <CampoTexto
          etiqueta="Descuentos"
          valor={descuentosTexto}
          onCambiar={setDescuentosTexto}
          sufijo="%"
          inputMode="decimal"
          placeholder="Ninguno"
          ayuda={
            descuentos && descuentos.length > 1
              ? `Se aplican uno después del otro: en total ${formatearPorcentaje(descuentoEfectivo(descuentos))}%.`
              : 'Bonificación sobre su lista. Si son varios, escribilos así: 10 + 5.'
          }
        />

        <section className="rounded-xl border border-stone-200 bg-white shadow-sm p-3" data-testid="columnas-recordadas">
          <h2 className="font-semibold">Columnas de su lista</h2>
          {columnas ? (
            <>
              <p className="mt-1 text-sm text-stone-600">
                {titulos
                  ? (Object.entries(titulos) as [keyof typeof NOMBRE_CAMPO, string | null][])
                      .filter(([, t]) => t !== null)
                      .map(([campo, t]) => `${NOMBRE_CAMPO[campo]}: "${t}"`)
                      .join(' · ')
                  : 'Recordadas por posición (la lista no tiene títulos).'}
              </p>
              <Boton type="button" variante="secundario" onClick={olvidar} className="mt-3">
                Olvidar columnas
              </Boton>
            </>
          ) : (
            <p className="mt-1 text-sm text-stone-600">Se aprenden con la próxima lista que subas.</p>
          )}
        </section>

        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <Boton type="submit">Guardar cambios</Boton>
          <Boton type="button" variante="secundario" onClick={onVolver}>
            Volver
          </Boton>
        </div>
      </form>

      <section className="mt-10 border-t border-stone-300 pt-6">
        {confirmarBaja ? (
          <div className="rounded-xl bg-red-50 p-3" role="alert">
            <p className="text-red-900">
              Se borra {proveedor.nombre} con sus columnas y vínculos. Los productos de tu catálogo quedan.
            </p>
            <div className="mt-3 space-y-3">
              <Boton type="button" variante="peligro" onClick={darDeBaja}>
                Sí, dar de baja
              </Boton>
              <Boton type="button" variante="secundario" onClick={() => setConfirmarBaja(false)}>
                No, dejarlo
              </Boton>
            </div>
          </div>
        ) : (
          <Boton type="button" variante="secundario" onClick={() => setConfirmarBaja(true)}>
            Dar de baja
          </Boton>
        )}
      </section>
    </main>
  );
}
