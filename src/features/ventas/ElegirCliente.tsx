import { useId, useState } from 'react';
import type { ClienteVenta } from '../../db';
import { formatearPesos } from '../../domain/dinero';
import { buscarClientes, limpiarNombreCliente, mismoNombre, superaLimite } from '../../domain/clientes';
import type { Centavos } from '../../domain/dinero';

/** El cliente elegido para fiar. `nuevo`: se crea al guardar la venta (también sin conexión). */
export interface ClienteElegido extends ClienteVenta {
  nuevo: boolean;
}

interface Props {
  clientes: readonly ClienteVenta[];
  elegido: ClienteElegido | null;
  total: Centavos;
  onElegir: (cliente: ClienteElegido | null) => void;
}

const MOSTRAR = 6;

/** Fase 10: a quién se le fía. Se busca por nombre o se escribe uno nuevo. */
export function ElegirCliente({ clientes, elegido, total, onElegir }: Props) {
  const [texto, setTexto] = useState('');
  const id = useId();

  if (elegido) {
    const supera = superaLimite(elegido.disponible, total);
    return (
      <div className="mt-3 space-y-2">
        <div className="flex items-center gap-3 rounded-xl border border-green-600 bg-green-50 p-3">
          <p className="min-w-0 flex-1">
            <span className="block text-sm text-stone-600">Fiado a</span>
            <span className="block font-semibold" data-testid="cliente-elegido">
              {elegido.nombre}
              {elegido.nuevo && <span className="ml-2 rounded bg-white px-1.5 text-sm font-medium text-green-800">nuevo</span>}
            </span>
          </p>
          <button type="button" onClick={() => onElegir(null)} className="min-h-11 shrink-0 px-2 font-semibold text-green-800 underline underline-offset-4">
            Cambiar
          </button>
        </div>
        {supera && (
          <p className="rounded-xl bg-amber-50 p-3 text-amber-950" role="status" data-testid="aviso-limite">
            Con esta venta pasa su límite de fiado: le quedan {formatearPesos(Math.max(0, elegido.disponible ?? 0))}. Consultalo antes de fiarle.
          </p>
        )}
      </div>
    );
  }

  const limpio = limpiarNombreCliente(texto);
  const encontrados = buscarClientes(clientes, texto).slice(0, MOSTRAR);
  const existe = clientes.some((c) => mismoNombre(c.nombre, limpio));

  return (
    <div className="mt-3 rounded-2xl border border-stone-200 bg-white p-3 shadow-xs">
      <label htmlFor={id} className="block font-semibold">
        ¿A quién se le fía?
      </label>
      <input
        id={id}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        maxLength={80}
        autoComplete="off"
        placeholder="Buscá el cliente o escribí uno nuevo"
        className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base outline-none placeholder:text-stone-500 focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
      />
      <ul className="mt-2 space-y-1" data-testid="clientes-encontrados">
        {encontrados.map((c) => (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onElegir({ ...c, nuevo: false })}
              className="flex min-h-11 w-full items-center rounded-xl px-3 text-left hover:bg-green-50"
            >
              {c.nombre}
            </button>
          </li>
        ))}
        {limpio !== '' && !existe && (
          <li>
            <button
              type="button"
              onClick={() => onElegir({ id: crypto.randomUUID(), nombre: limpio, disponible: null, nuevo: true })}
              className="flex min-h-11 w-full items-center rounded-xl px-3 text-left font-semibold text-green-800 hover:bg-green-50"
            >
              + Cliente nuevo: “{limpio}”
            </button>
          </li>
        )}
        {clientes.length === 0 && limpio === '' && <li className="px-3 py-2 text-stone-600">Todavía no hay clientes. Escribí el nombre para crear uno.</li>}
      </ul>
    </div>
  );
}
