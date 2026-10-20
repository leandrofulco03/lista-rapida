interface Props<T> {
  legend: string;
  opciones: readonly { valor: T; etiqueta: string }[];
  valor: T;
  onElegir: (valor: T) => void;
  ayuda?: string;
}

/** Botones para elegir una opción entre pocas (Sí/No, 21%/10,5%), grandes para el pulgar. */
export function Opciones<T>({ legend, opciones, valor, onElegir, ayuda }: Props<T>) {
  return (
    <fieldset>
      <legend className="font-semibold text-stone-800">{legend}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {opciones.map((o) => (
          <button
            key={o.etiqueta}
            type="button"
            aria-pressed={o.valor === valor}
            onClick={() => onElegir(o.valor)}
            className={`min-h-11 rounded-xl border px-3 text-base font-medium transition active:scale-[0.98] ${
              o.valor === valor
                ? 'border-green-600 bg-green-600 text-crema shadow-sm'
                : 'border-stone-300 bg-white shadow-xs hover:border-green-400 hover:bg-green-50'
            }`}
          >
            {o.etiqueta}
          </button>
        ))}
      </div>
      {ayuda && <p className="mt-1 text-sm text-stone-600">{ayuda}</p>}
    </fieldset>
  );
}
