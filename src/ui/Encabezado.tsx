import type { ComponentType, ReactNode, SVGProps } from 'react';

interface Props {
  titulo: ReactNode;
  /** Texto chico sobre el título (por ejemplo, el proveedor). */
  antetitulo?: ReactNode;
  descripcion?: ReactNode;
  Icono?: ComponentType<SVGProps<SVGSVGElement>>;
  testIdTitulo?: string;
  testIdDescripcion?: string;
  /** Botones a la derecha del título (en el celular quedan abajo). */
  acciones?: ReactNode;
  className?: string;
}

/** Encabezado de pantalla: ícono de la sección, título, una línea de contexto y acciones opcionales. */
export function Encabezado({ titulo, antetitulo, descripcion, Icono, testIdTitulo, testIdDescripcion, acciones, className = '' }: Props) {
  return (
    <header className={`flex flex-col gap-4 sm:flex-row sm:items-start ${className}`}>
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {Icono && (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-green-600 text-crema shadow-sm shadow-green-900/20">
            <Icono className="size-6" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          {antetitulo && <p className="text-sm font-semibold text-green-700">{antetitulo}</p>}
          <h1
            className={`text-2xl leading-tight font-bold text-stone-900 lg:text-3xl ${antetitulo ? 'mt-0.5' : Icono && !descripcion ? 'mt-2' : ''}`}
            data-testid={testIdTitulo}
          >
            {titulo}
          </h1>
          {descripcion && (
            <p className="mt-1 break-words text-stone-600" data-testid={testIdDescripcion}>
              {descripcion}
            </p>
          )}
        </div>
      </div>
      {acciones && <div className="flex shrink-0 flex-wrap gap-2">{acciones}</div>}
    </header>
  );
}
