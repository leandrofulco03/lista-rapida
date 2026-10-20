import { useId, useState } from 'react';
import { importarRespaldo, resumirRespaldo } from '../../db';
import { leerRespaldo } from '../../domain/respaldo';
import type { Respaldo } from '../../domain/respaldo';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoRespaldo } from '../../ui/Iconos';

interface Props {
  nombreComercio: string;
  onRestaurado: () => void;
  onVolver: () => void;
}

const fechaLegible = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' });

/**
 * Traer los datos de la versión anterior: la v1 guardaba todo en el navegador y hacía copias en un archivo.
 * Ahora los datos viven en la nube, así que no hace falta hacer más copias.
 */
export function PantallaRespaldo({ nombreComercio, onRestaurado, onVolver }: Props) {
  const sesion = useSesion();
  const [error, setError] = useState<string | null>(null);
  const [aTraer, setATraer] = useState<Respaldo | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const idArchivo = useId();

  async function elegirArchivo(archivo: File | undefined) {
    setError(null);
    setATraer(null);
    if (!archivo) return;
    const lectura = leerRespaldo(await archivo.text());
    if (lectura.ok) setATraer(lectura.respaldo);
    else setError(lectura.error);
  }

  async function traer() {
    if (!aTraer) return;
    setTrabajando(true);
    try {
      await importarRespaldo(sesion, aTraer, nombreComercio);
      onRestaurado();
    } catch (err) {
      setError(`No pudimos traer los datos: ${(err as Error).message}`);
      setTrabajando(false);
    }
  }

  const resumen = aTraer ? resumirRespaldo(aTraer) : null;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado
        Icono={IconoRespaldo}
        titulo="Datos de la versión anterior"
        descripcion="Si usabas ListaMatch antes, traé tu catálogo, tus proveedores y tus precios con el archivo de la copia de seguridad que guardaste."
      />

      <section className="mt-6">
        <label htmlFor={idArchivo} className="block text-lg font-semibold">
          Archivo de la copia
        </label>
        <p className="text-stone-600">Se llama listamatch-respaldo-… o lista-rapida-respaldo-… y termina en .json.</p>
        <input
          id={idArchivo}
          type="file"
          accept=".json,application/json"
          onChange={(e) => elegirArchivo(e.target.files?.[0])}
          className="mt-2 block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-stone-300 file:bg-white file:px-4 file:font-semibold"
        />
        {aTraer && resumen && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 text-amber-950" role="alert" data-testid="confirmar-restaurar">
            <p>
              Copia del {fechaLegible(aTraer.fecha)}, con {resumen.productos} productos y {resumen.proveedores} proveedores.
            </p>
            <p className="mt-1 font-semibold">Reemplaza el catálogo, los rubros y los proveedores que cargaste en este comercio.</p>
            <Boton type="button" variante="peligro" onClick={traer} disabled={trabajando} className="mt-3">
              Traer estos datos
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
