import { useEffect, useState } from 'react';
import { db, hayDatos } from '../../db';
import type { ConfigComercio } from '../../domain/config';
import { diasDesdeRespaldo, tocaRecordarRespaldo } from '../../domain/respaldo';
import { NOMBRE_APP } from '../../marca';
import { Boton } from '../../ui/Boton';

interface Props {
  config: ConfigComercio;
  onIr: (pantalla: 'subir' | 'catalogo' | 'proveedores' | 'config' | 'respaldo' | 'etiquetas' | 'lista-precios') => void;
}

/**
 * Inicio: la acción principal es subir una lista; desde acá también se llega al catálogo, a los proveedores
 * y a la copia de seguridad, que se recuerda cada 7 días (F12).
 */
export function PantallaInicio({ config, onIr }: Props) {
  const [recordar, setRecordar] = useState(false);
  useEffect(() => {
    hayDatos(db).then((hay) => setRecordar(tocaRecordarRespaldo(config.ultimoRespaldo, hay, new Date())));
  }, [config.ultimoRespaldo]);
  const dias = diasDesdeRespaldo(config.ultimoRespaldo, new Date());

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <p className="text-sm font-semibold text-green-800">{NOMBRE_APP}</p>
      <h1 className="mt-1 text-3xl font-bold">{config.nombreComercio}</h1>
      {recordar && (
        <div className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-950" role="status" data-testid="recordatorio-respaldo">
          <p>
            {dias === null ? 'Todavía no guardaste una copia de tus datos.' : `Hace ${dias} días que no guardás una copia de tus datos.`} Si se
            pierde el celular, se pierden tus precios.
          </p>
          <button type="button" onClick={() => onIr('respaldo')} className="mt-1 min-h-11 font-semibold underline">
            Guardar una copia ahora
          </button>
        </div>
      )}
      <div className="mt-6 space-y-3">
        <Boton onClick={() => onIr('subir')}>Subí una lista</Boton>
        <Boton variante="secundario" onClick={() => onIr('etiquetas')}>
          Etiquetas
        </Boton>
        <Boton variante="secundario" onClick={() => onIr('lista-precios')}>
          Lista de precios
        </Boton>
        <Boton variante="secundario" onClick={() => onIr('catalogo')}>
          Catálogo
        </Boton>
        <Boton variante="secundario" onClick={() => onIr('proveedores')}>
          Proveedores
        </Boton>
        <Boton variante="secundario" onClick={() => onIr('respaldo')}>
          Copia de seguridad
        </Boton>
        <Boton variante="secundario" onClick={() => onIr('config')}>
          Configuración
        </Boton>
      </div>
    </main>
  );
}
