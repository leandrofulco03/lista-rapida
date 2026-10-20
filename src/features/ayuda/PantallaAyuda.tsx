import { useState } from 'react';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoAyuda, IconoFlecha } from '../../ui/Iconos';
import { PASOS_GUIA, PREGUNTAS } from './contenido';
import type { DestinoAyuda } from './contenido';

interface Props {
  onIr: (pantalla: DestinoAyuda) => void;
  onVolver: () => void;
}

type Vista = 'guia' | 'preguntas';

const VISTAS: { valor: Vista; etiqueta: string }[] = [
  { valor: 'guia', etiqueta: 'Paso a paso' },
  { valor: 'preguntas', etiqueta: 'Preguntas frecuentes' },
];

/** Ayuda: una guía paso a paso del recorrido completo y las preguntas frecuentes. Los textos están en contenido.ts. */
export function PantallaAyuda({ onIr, onVolver }: Props) {
  const [vista, setVista] = useState<Vista>('guia');

  return (
    <main className="mx-auto max-w-3xl">
      <Encabezado Icono={IconoAyuda} titulo="Ayuda" descripcion="Cómo usar la app, paso a paso, y las dudas más comunes." />

      <div className="mt-6 grid grid-cols-2 gap-2" role="group" aria-label="Qué querés ver">
        {VISTAS.map((v) => (
          <button
            key={v.valor}
            type="button"
            aria-pressed={vista === v.valor}
            onClick={() => setVista(v.valor)}
            className={`min-h-11 rounded-xl border px-2 text-sm font-semibold whitespace-nowrap transition active:scale-[0.98] ${
              vista === v.valor
                ? 'border-green-600 bg-green-600 text-white shadow-md shadow-green-800/20'
                : 'border-stone-200 bg-white shadow-sm hover:border-green-300 hover:bg-green-50'
            }`}
          >
            {v.etiqueta}
          </button>
        ))}
      </div>

      {vista === 'guia' ? (
        <section className="mt-6" aria-label="Guía paso a paso" data-testid="guia-pasos">
          <p className="text-stone-700">El recorrido completo, desde cargar tus productos hasta imprimir las etiquetas.</p>
          <ol className="mt-4 space-y-3">
            {PASOS_GUIA.map((paso, i) => (
              <li key={paso.titulo} className="flex gap-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full bg-green-600 font-bold text-crema shadow-sm"
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="pt-1 text-lg leading-tight font-semibold">
                    <span className="sr-only">Paso {i + 1}: </span>
                    {paso.titulo}
                  </h2>
                  <p className="mt-1 text-stone-700">{paso.texto}</p>
                  {paso.detalles && (
                    <ul className="mt-2 space-y-1.5 text-sm text-stone-600">
                      {paso.detalles.map((d) => (
                        <li key={d} className="flex gap-2">
                          <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-green-600" />
                          <span>{d}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {paso.accion && (
                    <button
                      type="button"
                      onClick={() => onIr(paso.accion!.destino)}
                      className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-xl bg-green-50 px-3 font-semibold text-green-800 transition hover:bg-green-100 active:scale-[0.98]"
                    >
                      {paso.accion.etiqueta}
                      <IconoFlecha className="size-5" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ) : (
        <section className="mt-6" aria-label="Preguntas frecuentes" data-testid="preguntas-frecuentes">
          {PREGUNTAS.map((tema) => (
            <div key={tema.tema} className="mt-6 first:mt-0">
              <h2 className="text-sm font-semibold tracking-wide text-green-700 uppercase">{tema.tema}</h2>
              <div className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm">
                {tema.preguntas.map((p) => (
                  <details key={p.pregunta} className="group px-4">
                    <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 font-semibold [&::-webkit-details-marker]:hidden">
                      <span>{p.pregunta}</span>
                      <IconoFlecha className="size-5 shrink-0 text-green-700 transition group-open:rotate-90" />
                    </summary>
                    <div className="space-y-2 pb-4 text-stone-700">
                      {p.respuesta.map((parrafo) => (
                        <p key={parrafo}>{parrafo}</p>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8 sm:block sm:w-auto sm:px-8">
        Volver
      </Boton>
    </main>
  );
}
