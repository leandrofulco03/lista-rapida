import type { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variante?: 'principal' | 'secundario' | 'peligro' };

/** Botón de al menos 44 px de alto, cómodo para el pulgar y para el mouse. */
export function Boton({ variante = 'principal', className = '', ...props }: Props) {
  const estilos = {
    principal: 'bg-green-600 text-crema shadow-sm shadow-green-900/15 hover:bg-green-700 disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none',
    secundario: 'border border-stone-300 bg-white text-stone-800 shadow-xs hover:border-stone-400 hover:bg-stone-50 disabled:text-stone-500',
    peligro: 'bg-red-700 text-white shadow-sm shadow-red-900/15 hover:bg-red-800 disabled:bg-stone-300 disabled:text-stone-600 disabled:shadow-none',
  }[variante];
  return (
    <button
      {...props}
      className={`min-h-11 w-full rounded-xl px-4 py-2.5 text-base font-semibold transition duration-150 active:scale-[0.99] disabled:cursor-not-allowed disabled:active:scale-100 ${estilos} ${className}`}
    />
  );
}
