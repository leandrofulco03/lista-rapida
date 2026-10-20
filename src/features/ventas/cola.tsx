import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { baseDispositivo, encolarVenta, sincronizar, ventasPendientes } from '../../db';
import type { VentaNueva, VentaPendiente } from '../../db';
import { useSesion } from '../../sesion';

/**
 * Cola de ventas del dispositivo: guarda la venta acá primero y la manda a la base.
 * Reintenta al volver internet y cada 30 segundos.
 */

interface EstadoCola {
  pendientes: VentaPendiente[];
  /** Guarda la venta en el dispositivo y prueba mandarla. true si ya quedó en la base. */
  guardar: (venta: VentaNueva) => Promise<boolean>;
  reintentar: () => Promise<void>;
  actualizar: () => Promise<void>;
}

const Contexto = createContext<EstadoCola | null>(null);

export function useCola(): EstadoCola {
  const cola = useContext(Contexto);
  if (!cola) throw new Error('useCola se usa dentro de ProveedorCola.');
  return cola;
}

const CADA = 30_000;

export function ProveedorCola({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  const [pendientes, setPendientes] = useState<VentaPendiente[]>([]);
  const enCurso = useRef<Promise<void> | null>(null);

  const actualizar = useCallback(async () => {
    setPendientes(await ventasPendientes(baseDispositivo(), sesion.comercioId));
  }, [sesion]);

  /** Una sola sincronización a la vez. */
  const reintentar = useCallback(() => {
    enCurso.current ??= sincronizar(baseDispositivo(), sesion)
      .then(() => undefined, () => undefined)
      .then(actualizar)
      .finally(() => {
        enCurso.current = null;
      });
    return enCurso.current;
  }, [sesion, actualizar]);

  const guardar = useCallback(
    async (venta: VentaNueva) => {
      await encolarVenta(baseDispositivo(), sesion.comercioId, venta);
      await (enCurso.current ?? Promise.resolve());
      await reintentar();
      return !(await ventasPendientes(baseDispositivo(), sesion.comercioId)).some((p) => p.id === venta.id);
    },
    [sesion, reintentar],
  );

  useEffect(() => {
    reintentar();
    const cada = setInterval(reintentar, CADA);
    window.addEventListener('online', reintentar);
    return () => {
      clearInterval(cada);
      window.removeEventListener('online', reintentar);
    };
  }, [reintentar]);

  const valor = useMemo(() => ({ pendientes, guardar, reintentar, actualizar }), [pendientes, guardar, reintentar, actualizar]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Aviso chico de ventas sin subir. */
export function AvisoPendientes({ onVer }: { onVer?: () => void }) {
  const { pendientes } = useCola();
  if (pendientes.length === 0) return null;
  const conError = pendientes.filter((p) => p.error).length;
  const texto =
    conError > 0
      ? `${conError === 1 ? 'Una venta no se pudo guardar' : `${conError} ventas no se pudieron guardar`}. Revisalas.`
      : `${pendientes.length === 1 ? '1 venta' : `${pendientes.length} ventas`} sin subir: se suben solas cuando haya internet.`;
  return (
    <button
      type="button"
      onClick={onVer}
      data-testid="aviso-pendientes"
      className={`mt-4 w-full rounded-2xl border p-3 text-left font-medium ${conError ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}
    >
      {texto}
    </button>
  );
}
