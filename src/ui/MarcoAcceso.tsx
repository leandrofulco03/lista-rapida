import type { ReactNode } from 'react';
import { DESCRIPCION_APP } from '../marca';
import { IconoGrafico, IconoTicket, IconoEtiqueta } from './Iconos';
import { Logo } from './Logo';

const PUNTOS = [
  { Icono: IconoTicket, texto: 'Cargá ventas en segundos, con o sin internet.' },
  { Icono: IconoEtiqueta, texto: 'Precios al día con las listas de tus proveedores.' },
  { Icono: IconoGrafico, texto: 'Ganancia, más vendidos y horarios fuertes.' },
];

/**
 * Pantallas antes de entrar al comercio (ingreso, bienvenida, crear o unirse): en la compu, la marca a la izquierda
 * y el formulario a la derecha; en el celular, el logo arriba del formulario.
 */
export function MarcoAcceso({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden overflow-hidden bg-marca p-12 text-crema lg:flex lg:flex-col">
        <div aria-hidden="true" className="absolute -right-24 -bottom-24 size-96 rounded-full border-[48px] border-white/[0.04]" />
        <div aria-hidden="true" className="absolute top-1/3 -left-16 size-56 rounded-full bg-white/[0.03]" />
        <Logo tamano="grande" claro />
        <div className="relative mt-auto max-w-md">
          <p className="text-4xl leading-tight font-bold tracking-tight">Tu comercio, claro y ordenado.</p>
          <p className="mt-4 text-lg text-crema/75">{DESCRIPCION_APP}</p>
          <ul className="mt-10 space-y-4">
            {PUNTOS.map(({ Icono, texto }) => (
              <li key={texto} className="flex items-center gap-3 text-crema/90">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icono className="size-5" />
                </span>
                {texto}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex flex-col">
        <div className="px-4 pt-6 lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 flex-col justify-center lg:py-12">{children}</div>
      </div>
    </div>
  );
}
