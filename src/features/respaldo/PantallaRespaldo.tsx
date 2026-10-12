import { useId, useState } from 'react';
import { db, exportarRespaldo, restaurarRespaldo } from '../../db';
import { diasDesdeRespaldo, leerRespaldo, nombreArchivoRespaldo } from '../../domain/respaldo';
import type { Respaldo } from '../../domain/respaldo';
import { Boton } from '../../ui/Boton';
import { descargar } from '../../ui/descargar';

interface Props {
  /** Fecha del último respaldo; undefined si el comercio todavía no se configuró (primera vez en este dispositivo). */
  ultimoRespaldo?: string | null;
  /** Después de guardar una copia (cambia la fecha del último respaldo). */
  onExportado?: () => void;
  onRestaurado: () => void;
  onVolver: () => void;
}

function textoUltimo(ultimo: string | null): string {
  const dias = diasDesdeRespaldo(ultimo, new Date());
  if (dias === null) return 'Todavía no hiciste ninguna copia.';
  if (dias === 0) return 'La última copia es de hoy.';
  return `La última copia es de hace ${dias} ${dias === 1 ? 'día' : 'días'}.`;
}

const fechaLegible = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

/** F12: guardar todos los datos en un archivo y restaurarlos en este u otro dispositivo. */
export function PantallaRespaldo({ ultimoRespaldo, onExportado, onRestaurado, onVolver }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [aRestaurar, setARestaurar] = useState<Respaldo | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [exportado, setExportado] = useState(false);
  const idArchivo = useId();
  const configurado = ultimoRespaldo !== undefined;

  async function guardarCopia() {
    setError(null);
    setTrabajando(true);
    try {
      const respaldo = await exportarRespaldo(db);
      descargar(nombreArchivoRespaldo(new Date(respaldo.fecha)), JSON.stringify(respaldo), 'application/json');
      setExportado(true);
      onExportado?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  async function elegirArchivo(archivo: File | undefined) {
    setError(null);
    setARestaurar(null);
    if (!archivo) return;
    const lectura = leerRespaldo(await archivo.text(), db.verno);
    if (lectura.ok) setARestaurar(lectura.respaldo);
    else setError(lectura.error);
  }

  async function restaurar() {
    if (!aRestaurar) return;
    setTrabajando(true);
    try {
      await restaurarRespaldo(db, aRestaurar);
      onRestaurado();
    } catch (err) {
      setError(`No pudimos restaurar la copia: ${(err as Error).message}`);
      setTrabajando(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <h1 className="text-2xl font-bold">Copia de seguridad</h1>
      <p className="mt-1 text-stone-600">
        Tus datos están sólo en este dispositivo. Guardá una copia para no perderlos y para pasarlos a otro celular o computadora.
      </p>

      {configurado && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Guardar una copia</h2>
          <p className="mt-1 text-stone-700" data-testid="ultimo-respaldo">
            {textoUltimo(ultimoRespaldo)}
          </p>
          <Boton type="button" onClick={guardarCopia} disabled={trabajando} className="mt-3">
            Guardar copia en un archivo
          </Boton>
          {exportado && (
            <p className="mt-2 rounded-xl bg-green-50 p-3 text-green-900" role="status">
              Listo. Guardá el archivo en un lugar seguro: tu correo, Google Drive o un pendrive.
            </p>
          )}
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Restaurar una copia</h2>
        <label htmlFor={idArchivo} className="mt-1 block text-stone-700">
          Archivo de la copia
        </label>
        <input
          id={idArchivo}
          type="file"
          accept=".json,application/json"
          onChange={(e) => elegirArchivo(e.target.files?.[0])}
          className="mt-2 block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-stone-300 file:bg-white file:px-4 file:font-semibold"
        />
        {aRestaurar && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950" role="alert" data-testid="confirmar-restaurar">
            <p>
              Copia del {fechaLegible(aRestaurar.fecha)}, con {aRestaurar.tablas.productos.length} productos y{' '}
              {aRestaurar.tablas.proveedores.length} proveedores.
            </p>
            {configurado && <p className="mt-1 font-semibold">Se reemplaza todo lo que hay en este dispositivo.</p>}
            <Boton type="button" variante={configurado ? 'peligro' : 'principal'} onClick={restaurar} disabled={trabajando} className="mt-3">
              Restaurar esta copia
            </Boton>
          </div>
        )}
      </section>

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8">
        Volver
      </Boton>
    </main>
  );
}
