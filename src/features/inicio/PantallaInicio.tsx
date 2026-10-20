import type { ComponentType, SVGProps } from 'react';
import type { ConfigComercio } from '../../domain/config';
import { DESCRIPCION_APP, NOMBRE_APP } from '../../marca';
import { AvisoPendientes } from '../ventas/cola';
import {
  IconoAyuda,
  IconoCatalogo,
  IconoConfig,
  IconoEtiqueta,
  IconoFlecha,
  IconoGrafico,
  IconoLista,
  IconoProveedores,
  IconoSubir,
} from '../../ui/Iconos';

type Destino = 'subir' | 'catalogo' | 'proveedores' | 'config' | 'equipo' | 'etiquetas' | 'lista-precios' | 'ayuda' | 'vender' | 'ventas' | 'analisis';

interface Props {
  config: ConfigComercio;
  /** Cuenta con la que se entró. */
  email: string;
  onIr: (pantalla: Destino) => void;
  onSalir: () => void;
}

/** Accesos secundarios. El texto es el nombre accesible del botón (el ícono es decorativo). */
const SECCIONES: { destino: Destino; etiqueta: string; Icono: ComponentType<SVGProps<SVGSVGElement>> }[] = [
  { destino: 'analisis', etiqueta: 'Análisis', Icono: IconoGrafico },
  { destino: 'etiquetas', etiqueta: 'Etiquetas', Icono: IconoEtiqueta },
  { destino: 'lista-precios', etiqueta: 'Lista de precios', Icono: IconoLista },
  { destino: 'catalogo', etiqueta: 'Catálogo', Icono: IconoCatalogo },
  { destino: 'proveedores', etiqueta: 'Proveedores', Icono: IconoProveedores },
  { destino: 'equipo', etiqueta: 'Equipo', Icono: IconoProveedores },
  { destino: 'config', etiqueta: 'Configuración', Icono: IconoConfig },
];

/**
 * Inicio del dueño: lo principal es vender; desde acá también se llega al resumen de ventas, a subir una lista,
 * al catálogo, a los proveedores, al equipo y a la configuración.
 */
export function PantallaInicio({ config, email, onIr, onSalir }: Props) {
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
          onClick={() => onIr('vender')}
          className="relative mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 text-lg font-bold text-green-800 shadow-lg shadow-green-950/20 transition hover:bg-green-50 active:scale-[0.98]"
        >
          Nueva venta
        </button>
        <div className="relative mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onIr('ventas')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-3 font-semibold text-white transition hover:bg-white/20 active:scale-[0.98]"
          >
            <IconoLista className="size-5" />
            Ventas
          </button>
          <button
            type="button"
            onClick={() => onIr('subir')}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/40 bg-white/10 px-3 font-semibold text-white transition hover:bg-white/20 active:scale-[0.98]"
          >
            <IconoSubir className="size-5" />
            Subí una lista
          </button>
        </div>
      </header>

      <AvisoPendientes onVer={() => onIr('ventas')} />

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

      {/* El texto no repite el nombre de ninguna sección de arriba: las pruebas buscan esos botones por su nombre. */}
      <button
        type="button"
        onClick={() => onIr('ayuda')}
        className="group mt-3 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-green-300 hover:shadow-md active:scale-[0.98]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white text-green-700 shadow-sm transition group-hover:bg-green-600 group-hover:text-white">
          <IconoAyuda className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-green-900">¿Cómo se usa?</span>
          <span className="block text-sm text-green-800">Guía paso a paso y preguntas frecuentes</span>
        </span>
        <IconoFlecha className="size-5 shrink-0 text-green-700" />
      </button>

      <p className="mt-8 text-stone-600">
        Entraste como <span className="font-semibold break-all">{email}</span>.{' '}
        <button type="button" onClick={onSalir} className="min-h-11 font-semibold text-green-800 underline underline-offset-4">
          Salir
        </button>
      </p>
    </main>
  );
}
