import { useState } from 'react';
import type { FormEvent } from 'react';
import { DESCRIPCION_APP, NOMBRE_APP } from '../../marca';
import { LARGO_MINIMO_CLAVE, problemaCredenciales } from '../../nube';
import type { Backend } from '../../nube';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Opciones } from '../../ui/Opciones';
import { IconoCaja, IconoCatalogo, IconoGrafico, IconoSubir, IconoVender } from '../../ui/Iconos';

interface Props {
  backend: Backend;
}

/** Resumen de cómo se usa, debajo del formulario: para quien llega por primera vez. */
const PASOS = [
  { Icono: IconoCatalogo, titulo: 'Cargá tus productos', texto: 'Subí tu planilla de Excel o cargalos de a uno. Se hace una sola vez.' },
  { Icono: IconoVender, titulo: 'Vendé desde el celular o la compu', texto: 'Buscá, escribí el código o escanealo. Anda sin internet y se sube sola.' },
  { Icono: IconoCaja, titulo: 'Llevá la caja, el fiado y el stock', texto: 'Cerrá la caja contando la plata, anotá lo que te deben y sabé qué pedir.' },
  { Icono: IconoSubir, titulo: 'Actualizá precios con la lista del proveedor', texto: 'Subí su Excel o PDF: la app calcula los precios nuevos y vos los aprobás.' },
  { Icono: IconoGrafico, titulo: 'Mirá cómo te va', texto: 'Cuánto vendiste, cuánto ganaste, qué se vende más y cuánto te queda después de los gastos.' },
];

type Modo = 'ingresar' | 'registrarse';

/** Entrada a la app: con email y contraseña. Dueños y empleados entran igual; el rol lo da el comercio. */
export function PantallaIngreso({ backend }: Props) {
  const [modo, setModo] = useState<Modo>('ingresar');
  const [email, setEmail] = useState('');
  const [clave, setClave] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problema = modo === 'registrarse' ? problemaCredenciales(email, clave) : email.trim() && clave ? null : 'Completá el email y la contraseña.';
    if (problema) {
      setError(problema);
      return;
    }
    setEnviando(true);
    try {
      if (modo === 'ingresar') await backend.ingresar(email, clave);
      else await backend.registrarse(email, clave);
    } catch (err) {
      setError((err as Error).message);
      setEnviando(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-md px-4 pt-8 pb-12">
      <header>
        <h1 className="text-3xl font-bold">{modo === 'ingresar' ? `Entrá a ${NOMBRE_APP}` : 'Creá tu cuenta'}</h1>
        <p className="mt-2 text-stone-600 lg:hidden">{DESCRIPCION_APP}</p>
      </header>

      <form onSubmit={enviar} className="mt-8 space-y-5" noValidate>
        <Opciones
          legend="¿Ya tenés cuenta?"
          valor={modo}
          opciones={[
            { valor: 'ingresar' as Modo, etiqueta: 'Sí, ingresar' },
            { valor: 'registrarse' as Modo, etiqueta: 'No, crear una' },
          ]}
          onElegir={(m: Modo) => {
            setModo(m);
            setError(null);
          }}
        />
        <CampoTexto etiqueta="Email" type="email" autoComplete="email" inputMode="email" valor={email} onCambiar={setEmail} />
        <CampoTexto
          etiqueta="Contraseña"
          type="password"
          autoComplete={modo === 'ingresar' ? 'current-password' : 'new-password'}
          valor={clave}
          onCambiar={setClave}
          ayuda={modo === 'registrarse' ? `Al menos ${LARGO_MINIMO_CLAVE} letras o números.` : undefined}
        />
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" disabled={enviando}>
          {modo === 'ingresar' ? 'Ingresar' : 'Crear cuenta'}
        </Boton>
      </form>

      <p className="mt-6 text-stone-600">
        {modo === 'registrarse'
          ? 'Si sos empleado, creá tu cuenta y después escribí el código que te pasó el dueño del comercio.'
          : 'Dueños y empleados entran con su propia cuenta.'}
      </p>

      <section className="mt-12 border-t border-stone-200 pt-8" aria-labelledby="como-funciona" data-testid="como-funciona">
        <h2 id="como-funciona" className="text-lg font-semibold">
          ¿Cómo funciona?
        </h2>
        <ol className="mt-5 space-y-5">
          {PASOS.map(({ Icono, titulo, texto }) => (
            <li key={titulo} className="flex gap-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <Icono className="size-5" />
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold text-stone-900">{titulo}</h3>
                <p className="mt-0.5 text-sm text-stone-600">{texto}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-6 rounded-xl bg-white p-4 text-sm text-stone-700 shadow-xs ring-1 ring-stone-200">
          <span className="font-semibold text-stone-900">¿Trabajás con alguien?</span> Sumalo a tu equipo con un código: entra con su cuenta, carga ventas y
          no ve tus costos ni tus números.
        </p>
      </section>
    </main>
  );
}
