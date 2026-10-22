import { IconoCaja, IconoFlecha, IconoTicket, IconoVender } from '../../ui/Iconos';
import { AvisoPendientes } from '../ventas/cola';

interface Props {
  nombreComercio: string;
  onVender: () => void;
  onMisVentas: () => void;
  onCaja: () => void;
}

/** Inicio del empleado: cargar ventas, ver las suyas de hoy y la caja. No ve precios de costo ni números del comercio. */
export function PantallaEmpleado({ nombreComercio, onVender, onMisVentas, onCaja }: Props) {
  return (
    <main className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold text-green-700">Hola</p>
      <h1 className="mt-1 text-3xl leading-tight font-bold lg:text-4xl">{nombreComercio}</h1>
      <AvisoPendientes onVer={onMisVentas} />

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onVender}
          className="flex min-h-36 flex-col justify-between rounded-2xl bg-marca p-5 text-left text-crema shadow-sm transition hover:bg-green-700 active:scale-[0.99]"
        >
          <span className="flex size-12 items-center justify-center rounded-xl bg-white/10">
            <IconoVender className="size-6" />
          </span>
          <span className="text-xl font-bold">Nueva venta</span>
        </button>
        <button
          type="button"
          onClick={onMisVentas}
          className="flex min-h-36 flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-xs transition hover:border-stone-300 active:scale-[0.99]"
        >
          <span className="flex w-full items-center justify-between">
            <span className="flex size-12 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <IconoTicket className="size-6" />
            </span>
            <IconoFlecha className="size-5 text-stone-500" />
          </span>
          <span className="text-xl font-bold">Mis ventas de hoy</span>
        </button>
        <button
          type="button"
          onClick={onCaja}
          className="flex min-h-36 flex-col justify-between rounded-2xl border border-stone-200 bg-white p-5 text-left shadow-xs transition hover:border-stone-300 active:scale-[0.99]"
        >
          <span className="flex w-full items-center justify-between">
            <span className="flex size-12 items-center justify-center rounded-xl bg-green-50 text-green-700">
              <IconoCaja className="size-6" />
            </span>
            <IconoFlecha className="size-5 text-stone-500" />
          </span>
          <span className="text-xl font-bold">Caja</span>
        </button>
      </div>
    </main>
  );
}
