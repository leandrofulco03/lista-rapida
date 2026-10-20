import { useState } from 'react';
import type { FormEvent } from 'react';
import { DESCRIPCION_APP, NOMBRE_APP } from '../../marca';
import { LARGO_MINIMO_CLAVE, problemaCredenciales } from '../../nube';
import type { Backend } from '../../nube';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Opciones } from '../../ui/Opciones';

interface Props {
  backend: Backend;
}

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
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <header className="relative overflow-hidden rounded-3xl bg-linear-to-br from-green-600 via-green-700 to-emerald-800 p-6 text-white shadow-xl shadow-green-900/20">
        <div aria-hidden="true" className="absolute -top-12 -right-12 size-44 rounded-full bg-white/10" />
        <img src="/icono.svg" alt="" className="relative size-12 rounded-xl shadow-sm ring-1 ring-white/30" />
        <h1 className="relative mt-4 text-3xl font-bold">{NOMBRE_APP}</h1>
        <p className="relative mt-1 text-green-50/90">{DESCRIPCION_APP}</p>
      </header>

      <form onSubmit={enviar} className="mt-6 space-y-5" noValidate>
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
    </main>
  );
}
