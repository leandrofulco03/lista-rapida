import { useEffect, useId, useRef, useState } from 'react';
import type { ComponentType, ReactNode, SVGProps } from 'react';
import { IconoCerrar, IconoMenu, IconoSalir } from './Iconos';
import { Logo } from './Logo';

export interface ItemMenu<T extends string> {
  id: T;
  etiqueta: string;
  Icono: ComponentType<SVGProps<SVGSVGElement>>;
}

export interface GrupoMenu<T extends string> {
  titulo?: string;
  items: ItemMenu<T>[];
}

interface Props<T extends string> {
  nombreComercio: string;
  rol: string;
  email: string;
  grupos: GrupoMenu<T>[];
  /** Sección marcada en el menú. */
  activo: T;
  /** Pantalla que se muestra: al cambiar, la página vuelve arriba. */
  pantalla: string;
  onIr: (id: T) => void;
  onSalir: () => void;
  children: ReactNode;
}

const ESCRITORIO = '(min-width: 1024px)';

function useEsEscritorio(): boolean {
  const [es, setEs] = useState(() => window.matchMedia(ESCRITORIO).matches);
  useEffect(() => {
    const mq = window.matchMedia(ESCRITORIO);
    const cambiar = () => setEs(mq.matches);
    mq.addEventListener('change', cambiar);
    return () => mq.removeEventListener('change', cambiar);
  }, []);
  return es;
}

/**
 * Estructura de la app con sesión: menú de secciones a la izquierda (fijo en la compu) y el contenido a la derecha.
 * En el celular el menú se esconde y se abre con el botón de arriba; se cierra al elegir una sección, con Escape
 * o tocando afuera.
 */
export function Marco<T extends string>({ nombreComercio, rol, email, grupos, activo, pantalla, onIr, onSalir, children }: Props<T>) {
  const escritorio = useEsEscritorio();
  const [abierto, setAbierto] = useState(false);
  const idMenu = useId();
  const botonMenu = useRef<HTMLButtonElement>(null);
  const botonCerrar = useRef<HTMLButtonElement>(null);
  const visible = escritorio || abierto;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [pantalla]);

  useEffect(() => {
    if (escritorio) setAbierto(false);
  }, [escritorio]);

  // Con el cajón abierto: foco adentro, Escape lo cierra y la página de atrás no se desplaza.
  useEffect(() => {
    if (!abierto) return;
    botonCerrar.current?.focus();
    const alTeclear = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar();
    };
    document.addEventListener('keydown', alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    botonMenu.current?.focus();
  }

  function ir(id: T) {
    setAbierto(false);
    onIr(id);
  }

  return (
    <div className="min-h-dvh">
      {/* Barra de arriba, sólo en el celular. */}
      <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-stone-200/80 bg-crema/90 px-3 backdrop-blur-md lg:hidden">
        <button
          ref={botonMenu}
          type="button"
          onClick={() => setAbierto(true)}
          aria-label="Abrir menú"
          aria-expanded={abierto}
          aria-controls={idMenu}
          className="flex size-11 items-center justify-center rounded-xl text-green-700 transition hover:bg-green-600/10"
        >
          <IconoMenu className="size-6" />
        </button>
        <Logo tamano="chico" />
        <p className="ml-auto min-w-0 truncate text-sm font-semibold text-stone-700">{nombreComercio}</p>
      </header>

      {abierto && <div aria-hidden="true" onClick={cerrar} className="fixed inset-0 z-30 bg-green-950/40 backdrop-blur-[2px] lg:hidden" />}

      <aside
        id={idMenu}
        aria-label="Menú"
        inert={!visible}
        {...(!escritorio && abierto ? { role: 'dialog', 'aria-modal': true } : {})}
        // Al abrir se hace visible enseguida (para poder darle el foco); al cerrar, se esconde cuando termina de salir.
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-marca text-crema shadow-2xl duration-200 ease-out lg:w-64 lg:shadow-none ${
          visible ? 'visible translate-x-0 transition-[translate]' : 'invisible -translate-x-full transition-[translate,visibility]'
        }`}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 px-5 lg:h-20">
          <Logo tamano="chico" claro />
          <button
            ref={botonCerrar}
            type="button"
            onClick={cerrar}
            aria-label="Cerrar menú"
            className="flex size-10 items-center justify-center rounded-xl text-crema/80 hover:bg-white/10 hover:text-crema lg:hidden"
          >
            <IconoCerrar className="size-5" />
          </button>
        </div>

        <div className="mx-3 rounded-2xl bg-white/[0.07] px-4 py-3 ring-1 ring-white/10">
          <p className="text-xs font-medium tracking-wide text-crema/60 uppercase">{rol}</p>
          <p className="mt-0.5 truncate font-semibold" data-testid="menu-comercio">
            {nombreComercio}
          </p>
        </div>

        <nav aria-label="Secciones" className="mt-4 flex-1 overflow-y-auto px-3 pb-4">
          {grupos.map((g, i) => (
            <div key={g.titulo ?? i} className={i > 0 ? 'mt-5' : ''}>
              {g.titulo && <p className="px-3 pb-1.5 text-xs font-semibold tracking-wider text-crema/50 uppercase">{g.titulo}</p>}
              <ul className="space-y-0.5">
                {g.items.map(({ id, etiqueta, Icono }) => {
                  const actual = id === activo;
                  return (
                    <li key={id}>
                      <button
                        type="button"
                        onClick={() => ir(id)}
                        aria-current={actual ? 'page' : undefined}
                        className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[0.95rem] transition ${
                          actual ? 'bg-crema font-semibold text-marca shadow-sm' : 'font-medium text-crema/80 hover:bg-white/10 hover:text-crema'
                        }`}
                      >
                        <Icono className="size-5 shrink-0" />
                        {etiqueta}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-3 border-t border-white/10 px-4 py-4">
          <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-crema text-sm font-bold text-marca uppercase">
            {email.charAt(0)}
          </span>
          <p className="min-w-0 flex-1 truncate text-sm text-crema/80" title={email}>
            {email}
          </p>
          <button
            type="button"
            onClick={onSalir}
            className="flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-crema/80 hover:bg-white/10 hover:text-crema"
          >
            <IconoSalir className="size-4" />
            Salir
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <div className="px-4 pt-6 pb-12 sm:px-6 lg:px-10 lg:pt-10">{children}</div>
      </div>
    </div>
  );
}
