import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' | 'peligro' };

/** Botón de al menos 44 px de alto, pensado para usar con el pulgar. */
export function Boton({ variante = 'principal', className = '', ...props }: Props) {
  const estilos = {
    principal:
      'bg-linear-to-b from-green-600 to-green-700 text-white shadow-md shadow-green-800/20 hover:from-green-700 hover:to-green-800 disabled:bg-none disabled:bg-stone-300 disabled:text-stone-500 disabled:shadow-none',
    secundario:
      'bg-white text-stone-800 border border-stone-200 shadow-sm hover:border-green-300 hover:bg-green-50 disabled:text-stone-400',
    peligro: 'bg-red-600 text-white shadow-md shadow-red-800/20 hover:bg-red-700 disabled:bg-stone-300 disabled:shadow-none',
  }[variante];
  return (
    <button
      {...props}
      className={`min-h-11 w-full rounded-2xl px-4 py-3 text-lg font-semibold transition duration-150 active:scale-[0.98] disabled:cursor-not-allowed disabled:active:scale-100 ${estilos} ${className}`}
    />
  );
}
