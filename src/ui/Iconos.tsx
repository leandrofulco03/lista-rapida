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

export const IconoInicio = (p: Props) => (
  <Icono {...p}>
    <rect x="3" y="3" width="7" height="9" rx="1.5" />
    <rect x="14" y="3" width="7" height="5" rx="1.5" />
    <rect x="14" y="12" width="7" height="9" rx="1.5" />
    <rect x="3" y="16" width="7" height="5" rx="1.5" />
  </Icono>
);

export const IconoVender = (p: Props) => (
  <Icono {...p}>
    <path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
    <circle cx="9" cy="20" r="1.3" />
    <circle cx="17" cy="20" r="1.3" />
  </Icono>
);

export const IconoTicket = (p: Props) => (
  <Icono {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M9 8h6M9 12h6M9 16h3" />
  </Icono>
);

export const IconoEquipo = (p: Props) => (
  <Icono {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18.5 14a6.5 6.5 0 0 1 3 6" />
  </Icono>
);

export const IconoDocumento = (p: Props) => (
  <Icono {...p}>
    <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icono>
);

/** Ícono del botón que abre el menú lateral en el celular. */
export const IconoMenu = (p: Props) => (
  <Icono {...p}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </Icono>
);

export const IconoCerrar = (p: Props) => (
  <Icono {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Icono>
);

export const IconoSalir = (p: Props) => (
  <Icono {...p}>
    <path d="M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3" />
    <path d="M10 8l-4 4 4 4M6 12h10" />
  </Icono>
);

export const IconoCaja = (p: Props) => (
  <Icono {...p}>
    <rect x="3" y="7" width="18" height="12" rx="2" />
    <circle cx="12" cy="13" r="2.5" />
    <path d="M6 10h.01M18 16h.01M7 4h10" />
  </Icono>
);

export const IconoClientes = (p: Props) => (
  <Icono {...p}>
    <circle cx="10" cy="8" r="3.5" />
    <path d="M3.5 20a6.5 6.5 0 0 1 10.4-5.2" />
    <path d="M18 13v8M15.5 15.5c0-.8.9-1.5 2.5-1.5s2.5.6 2.5 1.4-1 1.2-2.5 1.6-2.5.8-2.5 1.6.9 1.4 2.5 1.4 2.5-.7 2.5-1.5" />
  </Icono>
);

export const IconoStock = (p: Props) => (
  <Icono {...p}>
    <path d="M3 9h18v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
    <path d="M3 9l2-5h14l2 5M9 13h6" />
  </Icono>
);

export const IconoGastos = (p: Props) => (
  <Icono {...p}>
    <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
    <path d="M14.5 8.5c0-.8-1.1-1.5-2.5-1.5s-2.5.6-2.5 1.5 1 1.3 2.5 1.6 2.5.8 2.5 1.6-1.1 1.6-2.5 1.6-2.5-.7-2.5-1.5M12 5.5V7M12 13.3v1.5" />
  </Icono>
);
