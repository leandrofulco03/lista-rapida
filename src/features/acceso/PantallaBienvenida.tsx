import { NOMBRE_APP } from '../../marca';
import { Boton } from '../../ui/Boton';

interface Props {
  email: string;
  onCrear: () => void;
  onUnirse: () => void;
  onSalir: () => void;
}

/** Con sesión pero sin comercio: el dueño crea el suyo; el empleado se une con un código. */
export function PantallaBienvenida({ email, onCrear, onUnirse, onSalir }: Props) {
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <h1 className="text-3xl font-bold">Bienvenido a {NOMBRE_APP}</h1>
      <p className="mt-2 text-lg text-stone-700">¿Cómo vas a usar la app?</p>

      <section className="mt-6 space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Soy el dueño</h2>
        <p className="text-stone-600">Cargás tu comercio, tus precios y tus proveedores, y ves las ventas y los números.</p>
        <Boton type="button" onClick={onCrear}>
          Crear mi comercio
        </Boton>
      </section>

      <section className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-semibold">Trabajo en un comercio</h2>
        <p className="text-stone-600">Cargás las ventas con el código que te pasó el dueño.</p>
        <Boton type="button" variante="secundario" onClick={onUnirse}>
          Tengo un código
        </Boton>
      </section>

      <p className="mt-8 text-stone-600">
        Entraste como <span className="font-semibold break-all">{email}</span>.{' '}
        <button type="button" onClick={onSalir} className="min-h-11 font-semibold text-green-800 underline underline-offset-4">
          Salir
        </button>
      </p>
    </main>
  );
}
