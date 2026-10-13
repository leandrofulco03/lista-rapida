import { useId } from 'react';
import type { InputHTMLAttributes } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'onChange'> & {
  etiqueta: string;
  valor: string;
  onCambiar: (valor: string) => void;
  error?: string;
  ayuda?: string;
  /** Texto pegado a la derecha del campo ("%"). */
  sufijo?: string;
};

/** Campo de texto con etiqueta, ayuda y error, de al menos 44 px de alto. */
export function CampoTexto({ etiqueta, valor, onCambiar, error, ayuda, sufijo, className = '', ...props }: Props) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="block text-lg font-semibold">
        {etiqueta}
      </label>
      <div className="mt-2 flex items-center gap-2">
        <input
          {...props}
          id={id}
          value={valor}
          onChange={(e) => onCambiar(e.target.value)}
          aria-invalid={error ? true : undefined}
          className={`min-h-11 rounded-xl border border-stone-200 bg-white px-3 text-lg shadow-sm transition outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15 aria-invalid:border-red-500 ${sufijo ? 'w-32 text-right' : 'w-full'} ${className}`}
        />
        {sufijo && <span className="text-lg">{sufijo}</span>}
      </div>
      {ayuda && <p className="mt-1 text-sm text-stone-600">{ayuda}</p>}
      {error && <p className="mt-1 text-red-700">{error}</p>}
    </div>
  );
}
