import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' | 'peligro' };

/** Botón de al menos 44 px de alto, pensado para usar con el pulgar. */
export function Boton({ variante = 'principal', className = '', ...props }: Props) {
  const estilos = {
    principal: 'bg-green-700 text-white hover:bg-green-800 disabled:bg-stone-400',
    secundario: 'bg-white text-stone-800 border border-stone-300 hover:bg-stone-100',
    peligro: 'bg-red-700 text-white hover:bg-red-800',
  }[variante];
  return (
    <button
      {...props}
      className={`min-h-11 w-full rounded-xl px-4 py-3 text-lg font-semibold ${estilos} ${className}`}
    />
  );
}
