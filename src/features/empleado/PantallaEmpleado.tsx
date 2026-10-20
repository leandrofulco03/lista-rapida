import { NOMBRE_APP } from '../../marca';
import { IconoListo } from '../../ui/Iconos';

interface Props {
  nombreComercio: string;
  email: string;
  onSalir: () => void;
}

/** Lo que ve el empleado. La carga de ventas llega en la Fase 8; por ahora confirma que quedó adentro. */
export function PantallaEmpleado({ nombreComercio, email, onSalir }: Props) {
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <header className="rounded-3xl bg-linear-to-br from-green-600 via-green-700 to-emerald-800 p-6 text-white shadow-xl shadow-green-900/20">
        <p className="text-sm font-semibold tracking-wide text-green-50">{NOMBRE_APP}</p>
        <h1 className="mt-2 text-3xl font-bold">{nombreComercio}</h1>
      </header>
      <section className="mt-6 flex gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-green-950" role="status">
        <IconoListo className="mt-0.5 size-6 shrink-0 text-green-700" />
        <p>Ya sos parte del equipo. Muy pronto vas a cargar las ventas desde acá.</p>
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
