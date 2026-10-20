import { NOMBRE_APP } from '../marca';

interface Props {
  tamano?: 'chico' | 'grande';
  /** Para fondos oscuros (el menú, el panel de ingreso). */
  claro?: boolean;
}

/** Marca de Vendia: una "V" en un cuadrado redondeado y el nombre al lado. */
export function Logo({ tamano = 'chico', claro = false }: Props) {
  const grande = tamano === 'grande';
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 64 64" aria-hidden="true" className={grande ? 'size-11' : 'size-8'}>
        <rect width="64" height="64" rx="16" fill={claro ? '#fafade' : '#31493c'} />
        <path d="M19 21 32 44 45 21" fill="none" stroke={claro ? '#31493c' : '#fafade'} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className={`font-bold tracking-tight ${grande ? 'text-3xl' : 'text-xl'} ${claro ? 'text-crema' : 'text-marca'}`}>{NOMBRE_APP}</span>
    </span>
  );
}
