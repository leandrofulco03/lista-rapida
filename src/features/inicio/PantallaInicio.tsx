import { useEffect, useState } from 'react';
import type { ComponentType, SVGProps } from 'react';
import { db, hayDatos } from '../../db';
import type { ConfigComercio } from '../../domain/config';
import { diasDesdeRespaldo, tocaRecordarRespaldo } from '../../domain/respaldo';
import { DESCRIPCION_APP, NOMBRE_APP } from '../../marca';
import {
  IconoAlerta,
  IconoCatalogo,
  IconoConfig,
  IconoEtiqueta,
  IconoLista,
  IconoProveedores,
  IconoRespaldo,
  IconoSubir,
} from '../../ui/Iconos';

type Destino = 'subir' | 'catalogo' | 'proveedores' | 'config' | 'respaldo' | 'etiquetas' | 'lista-precios';

interface Props {
  config: ConfigComercio;
  onIr: (pantalla: Destino) => void;
}

/** Accesos secundarios. El texto es el nombre accesible del botón (el ícono es decorativo). */
const SECCIONES: { destino: Destino; etiqueta: string; Icono: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { destino: 'etiquetas', etiqueta: 'Etiquetas', Icono: IconoEtiqueta },
  { destino: 'lista-precios', etiqueta: 'Lista de precios', Icono: IconoLista },
  { destino: 'catalogo', etiqueta: 'Catálogo', Icono: IconoCatalogo },
  { destino: 'proveedores', etiqueta: 'Proveedores', Icono: IconoProveedores },
  { destino: 'respaldo', etiqueta: 'Copia de seguridad', Icono: IconoRespaldo },
  { destino: 'config', etiqueta: 'Configuración', Icono: IconoConfig },
];

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
    <main className="mx-auto max-w-md px-4 pt-6 pb-12">
      <header className="relative overflow-hidden rounded-3xl bg-linear-to-br from-green-600 via-green-700 to-emerald-800 p-6 text-white shadow-xl shadow-green-900/20">
        <div aria-hidden="true" className="absolute -top-12 -right-12 size-44 rounded-full bg-white/10" />
        <div aria-hidden="true" className="absolute -bottom-16 -left-10 size-40 rounded-full bg-white/5" />

        <div className="relative flex items-center gap-2">
          <img src="/icono.svg" alt="" className="size-8 rounded-lg shadow-sm ring-1 ring-white/30" />
          <p className="text-sm font-semibold tracking-wide text-green-50">{NOMBRE_APP}</p>
        </div>
        <h1 className="relative mt-4 text-3xl font-bold">{config.nombreComercio}</h1>
        <p className="relative mt-1 text-green-50/90">{DESCRIPCION_APP}</p>

        <button
          type="button"
          onClick={() => onIr('subir')}
          className="relative mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-lg font-bold text-green-800 shadow-lg shadow-green-950/20 transition hover:bg-green-50 active:scale-[0.98]"
        >
          <IconoSubir className="size-6" />
          Subí una lista
        </button>
      </header>

      {recordar && (
        <div
          className="mt-4 flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 shadow-sm"
          role="status"
          data-testid="recordatorio-respaldo"
        >
          <IconoAlerta className="mt-0.5 size-6 shrink-0 text-amber-600" />
          <div>
            <p>
              {dias === null ? 'Todavía no guardaste una copia de tus datos.' : `Hace ${dias} días que no guardás una copia de tus datos.`} Si
              se pierde el celular, se pierden tus precios.
            </p>
            <button type="button" onClick={() => onIr('respaldo')} className="mt-1 min-h-11 font-semibold text-amber-900 underline underline-offset-4">
              Guardar una copia ahora
            </button>
          </div>
        </div>
      )}

      <nav aria-label="Secciones" className="mt-6 grid grid-cols-2 gap-3">
        {SECCIONES.map(({ destino, etiqueta, Icono }) => (
          <button
            key={destino}
            type="button"
            onClick={() => onIr(destino)}
            className="group flex min-h-28 flex-col items-start gap-4 rounded-2xl border border-stone-200 bg-white p-4 text-left text-base font-semibold text-stone-800 shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md active:scale-[0.98]"
          >
            <span className="flex size-11 items-center justify-center rounded-xl bg-green-50 text-green-700 transition group-hover:bg-green-600 group-hover:text-white">
              <Icono className="size-6" />
            </span>
            {etiqueta}
          </button>
        ))}
      </nav>
    </main>
  );
}
