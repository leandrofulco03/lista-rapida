import { NOMBRE_APP } from '../../marca';
import { IconoLista } from '../../ui/Iconos';
import { AvisoPendientes } from '../ventas/cola';

interface Props {
  nombreComercio: string;
  email: string;
  onVender: () => void;
  onMisVentas: () => void;
  onSalir: () => void;
}

/** Inicio del empleado: cargar ventas y ver las suyas de hoy. No ve precios de costo ni números del comercio. */
export function PantallaEmpleado({ nombreComercio, email, onVender, onMisVentas, onSalir }: Props) {
  return (
    <main className="mx-auto max-w-md px-4 pt-6 pb-12">
      <header className="relative overflow-hidden rounded-3xl bg-linear-to-br from-green-600 via-green-700 to-emerald-800 p-6 text-white shadow-xl shadow-green-900/20">
        <div aria-hidden="true" className="absolute -top-12 -right-12 size-44 rounded-full bg-white/10" />
        <p className="relative text-sm font-semibold tracking-wide text-green-50">{NOMBRE_APP}</p>
        <h1 className="relative mt-2 text-3xl font-bold">{nombreComercio}</h1>
        <button
          type="button"
          onClick={onVender}
          className="relative mt-6 flex min-h-14 w-full items-center justify-center rounded-2xl bg-white px-4 text-lg font-bold text-green-800 shadow-lg shadow-green-950/20 active:scale-[0.98]"
        >
          Nueva venta
        </button>
      </header>
      <AvisoPendientes onVer={onMisVentas} />
      <button
        type="button"
        onClick={onMisVentas}
        className="mt-4 flex min-h-16 w-full items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 text-left font-semibold shadow-sm"
      >
        <span className="flex size-11 items-center justify-center rounded-xl bg-green-50 text-green-700">
          <IconoLista className="size-6" />
        </span>
        Mis ventas de hoy
      </button>
      <p className="mt-8 text-stone-600">
        Entraste como <span className="font-semibold break-all">{email}</span>.{' '}
        <button type="button" onClick={onSalir} className="min-h-11 font-semibold text-green-800 underline underline-offset-4">
          Salir
        </button>
      </p>
    </main>
  );
}
