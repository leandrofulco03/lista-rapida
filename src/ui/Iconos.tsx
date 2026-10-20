import type { ReactNode, SVGProps } from 'react';

type Props = SVGProps<SVGSVGElement>;

/** Base de los íconos: trazo simple de 24×24 que toma el color del texto. Son decorativos (aria-hidden). */
function Icono({ children, className = 'size-6', ...props }: Props & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconoSubir = (p: Props) => (
  <Icono {...p}>
    <path d="M12 15V4M7 9l5-5 5 5" />
    <path d="M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
  </Icono>
);

export const IconoEtiqueta = (p: Props) => (
  <Icono {...p}>
    <path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </Icono>
);

export const IconoLista = (p: Props) => (
  <Icono {...p}>
    <path d="M9 6h12M9 12h12M9 18h12" />
    <path d="M4 6h.01M4 12h.01M4 18h.01" />
  </Icono>
);

export const IconoCatalogo = (p: Props) => (
  <Icono {...p}>
    <path d="M21 8 12 3 3 8l9 5z" />
    <path d="M3 8v8l9 5 9-5V8M12 13v8" />
  </Icono>
);

export const IconoProveedores = (p: Props) => (
  <Icono {...p}>
    <path d="M2 6h12v10H2zM14 10h4l3 3v3h-7" />
    <circle cx="6.5" cy="18" r="2" />
    <circle cx="17" cy="18" r="2" />
  </Icono>
);

export const IconoRespaldo = (p: Props) => (
  <Icono {...p}>
    <path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z" />
    <path d="m9 12 2 2 4-4" />
  </Icono>
);

export const IconoConfig = (p: Props) => (
  <Icono {...p}>
    <path d="M4 6h10M4 12h4M12 12h8M4 18h12" />
    <circle cx="17" cy="6" r="2" />
    <circle cx="10" cy="12" r="2" />
    <circle cx="19" cy="18" r="2" />
  </Icono>
);

export const IconoListo = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m8 12 3 3 5-6" />
  </Icono>
);

export const IconoColumnas = (p: Props) => (
  <Icono {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16" />
  </Icono>
);

export const IconoVincular = (p: Props) => (
  <Icono {...p}>
    <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" />
  </Icono>
);

export const IconoAyuda = (p: Props) => (
  <Icono {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.4M12 17h.01" />
  </Icono>
);

export const IconoFlecha = (p: Props) => (
  <Icono {...p}>
    <path d="m9 6 6 6-6 6" />
  </Icono>
);

export const IconoAlerta = (p: Props) => (
  <Icono {...p}>
    <path d="M10.3 3.9 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
    <path d="M12 9v4M12 17h.01" />
  </Icono>
);

export const IconoGrafico = (p: Props) => (
  <Icono {...p}>
    <path d="M4 20V4" />
    <path d="M4 20h16" />
    <path d="M7 15l4-4 3 3 5-6" />
  </Icono>
);
