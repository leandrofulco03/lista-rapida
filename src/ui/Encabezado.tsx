import type { ComponentType, ReactNode, SVGProps } from 'react';

interface Props {
  titulo: ReactNode;
  /** Texto chico sobre el título (por ejemplo, el proveedor). */
  antetitulo?: ReactNode;
  descripcion?: ReactNode;
  Icono?: ComponentType<SVGProps<SVGSVGElement>>;
  testIdTitulo?: string;
  testIdDescripcion?: string;
  className?: string;
}

/** Encabezado de pantalla: ícono verde de la sección, título y una línea de contexto. */
export function Encabezado({ titulo, antetitulo, descripcion, Icono, testIdTitulo, testIdDescripcion, className = '' }: Props) {
  return (
    <header className={`flex items-start gap-4 ${className}`}>
      {Icono && (
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-green-600 to-emerald-700 text-white shadow-md shadow-green-900/20">
          <Icono className="size-6" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {antetitulo && <p className="text-sm font-semibold text-green-700">{antetitulo}</p>}
        <h1 className={`text-2xl leading-tight font-bold ${antetitulo ? 'mt-0.5' : Icono && !descripcion ? 'mt-2' : ''}`} data-testid={testIdTitulo}>
          {titulo}
        </h1>
        {descripcion && (
          <p className="mt-1 break-words text-stone-600" data-testid={testIdDescripcion}>
            {descripcion}
          </p>
        )}
      </div>
    </header>
  );
}
