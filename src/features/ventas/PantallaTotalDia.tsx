import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { guardarSinDetalle, leerSinDetalle } from '../../db';
import type { MontosPorMedio } from '../../db';
import { formatearPesos, pesosParaEditar } from '../../domain/dinero';
import { leerImporte } from '../../domain/importe';
import { diaDe, MEDIOS_PAGO, nombrePeriodo, periodoDe } from '../../domain/ventas';
import type { Dia, MedioPago } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoLista } from '../../ui/Iconos';

interface Props {
  dia: Dia;
  onGuardado: () => void;
  onVolver: () => void;
}

/**
 * Fase 8: lo vendido en un día sin cargar los tickets, por medio de pago. Suma a la venta total.
 * Si ese día también se cargaron tickets, acá va sólo lo que no se cargó por ticket.
 */
export function PantallaTotalDia({ dia: diaInicial, onGuardado, onVolver }: Props) {
  const sesion = useSesion();
  const hoy = diaDe(new Date());
  const [dia, setDia] = useState(diaInicial);
  const [textos, setTextos] = useState<Partial<Record<MedioPago, string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setTextos({});
    // Lo que se escribió mientras cargaba no se pisa con lo guardado.
    leerSinDetalle(sesion, dia).then((m) =>
      setTextos((escrito) => ({
        ...Object.fromEntries(Object.entries(m).map(([medio, monto]) => [medio, pesosParaEditar(monto as number)])),
        ...escrito,
      })),
    );
  }, [dia, sesion]);

  const montos: MontosPorMedio = {};
  let invalido = false;
  for (const m of MEDIOS_PAGO) {
    const texto = textos[m.id]?.trim() ?? '';
    if (texto === '') continue;
    const monto = leerImporte(texto, 'ar');
    if (monto === null) invalido = true;
    else montos[m.id] = monto;
  }
  const total = Object.values(montos).reduce((s, m) => s + (m ?? 0), 0);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (invalido) {
      setError('Hay un importe que no es válido.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      // Los medios que quedaron vacíos se mandan en cero, así se borran si antes tenían algo.
      await guardarSinDetalle(sesion, dia, Object.fromEntries(MEDIOS_PAGO.map((m) => [m.id, montos[m.id] ?? 0])));
      onGuardado();
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <Encabezado
        Icono={IconoLista}
        titulo="Total del día"
        descripcion="Si no cargás cada venta, anotá acá cuánto vendiste en el día. Si cargaste algunas ventas, poné sólo lo que falta."
      />
      <form onSubmit={guardar} className="mt-6 space-y-4" noValidate>
        <label className="block">
          <span className="block text-lg font-semibold">Día</span>
          <input
            type="date"
            value={dia}
            max={hoy}
            onChange={(e) => e.target.value && setDia(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
          />
          <span className="mt-1 block text-sm text-stone-600">{nombrePeriodo(periodoDe('dia', dia), hoy)}</span>
        </label>
        {MEDIOS_PAGO.map((m) => (
          <label key={m.id} className="flex items-center gap-3">
            <span className="flex-1 text-lg">{m.nombre}</span>
            <span className="text-lg">$</span>
            <input
              aria-label={m.nombre}
              value={textos[m.id] ?? ''}
              onChange={(e) => setTextos({ ...textos, [m.id]: e.target.value })}
              inputMode="decimal"
              placeholder="0"
              className="min-h-11 w-40 rounded-xl border border-stone-300 bg-white px-3 text-right text-lg tabular-nums outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
            />
          </label>
        ))}
        <p className="border-t border-stone-200 pt-3 text-xl font-bold tabular-nums" data-testid="total-sin-detalle">
          Total {formatearPesos(total)}
        </p>
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        <Boton type="submit" disabled={guardando}>
          Guardar
        </Boton>
        <Boton type="button" variante="secundario" onClick={onVolver}>
          Volver
        </Boton>
      </form>
    </main>
  );
}
