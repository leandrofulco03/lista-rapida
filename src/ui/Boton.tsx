import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' };

/** Botón de al menos 44 px de alto, pensado para usar con el pulgar. */
export function Boton({ variante = 'principal', className = '', ...props }: Props) {
  const estilos =
    variante === 'principal'
      ? 'bg-green-700 text-white hover:bg-green-800 disabled:bg-stone-400'
      : 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-100';
  return (
    <button
      {...props}
      className={`min-h-11 w-full rounded-xl px-4 py-3 text-lg font-semibold ${estilos} ${className}`}
    />
  );
}
