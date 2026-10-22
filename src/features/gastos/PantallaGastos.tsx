import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { archivarGasto, guardarGasto, guardarGastosMes, leerGastos, resultadoMeses } from '../../db';
import type { DatosMes, GastoDelMes } from '../../db';
import { formatearPesos, pesosParaEditar } from '../../domain/dinero';
import type { Centavos } from '../../domain/dinero';
import { calcularResultado, mesDe, nombreMes, sumarMeses } from '../../domain/gastos';
import { leerImporte } from '../../domain/importe';
import { diaDe } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoGastos } from '../../ui/Iconos';

interface Props {
  onVolver: () => void;
}

const MESES_HISTORIA = 6;

/** Fase 10: gastos fijos de cada mes y resultado neto (ganancia − gastos). Sólo el dueño. */
export function PantallaGastos({ onVolver }: Props) {
  const sesion = useSesion();
  const esteMes = mesDe(diaDe(new Date()));
  const [mes, setMes] = useState(esteMes);
  const [gastos, setGastos] = useState<GastoDelMes[] | null>(null);
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [meses, setMeses] = useState<DatosMes[] | null>(null);
  const [nuevo, setNuevo] = useState('');
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(() => {
    leerGastos(sesion, mes).then(
      (g) => {
        setGastos(g);
        setTextos(Object.fromEntries(g.map((x) => [x.id, x.monto === null ? '' : pesosParaEditar(x.monto)])));
      },
      (e: Error) => setAviso({ tipo: 'error', texto: e.message }),
    );
    resultadoMeses(sesion, sumarMeses(mes, -(MESES_HISTORIA - 1)), mes).then(setMeses, () => setMeses([]));
  }, [sesion, mes]);
  useEffect(cargar, [cargar]);

  function irAMes(m: string) {
    setGastos(null);
    setMeses(null);
    setAviso(null);
    setMes(m);
  }

  const delMes = meses?.find((m) => m.mes === mes);
  const resultado = delMes ? calcularResultado(delMes) : null;
  const sinCargar = (gastos ?? []).filter((g) => !g.archivado && (textos[g.id] ?? '').trim() === '' && g.montoAnterior !== null);

  async function guardarMontos(e: FormEvent) {
    e.preventDefault();
    const montos: Record<string, Centavos | null> = {};
    for (const g of gastos ?? []) {
      const t = (textos[g.id] ?? '').trim();
      if (t === '') {
        montos[g.id] = null;
        continue;
      }
      const m = leerImporte(t, 'ar');
      if (m === null || m < 0) return setAviso({ tipo: 'error', texto: `Revisá el importe de ${g.nombre}.` });
      montos[g.id] = m;
    }
    setGuardando(true);
    try {
      await guardarGastosMes(sesion, mes, montos);
      setAviso({ tipo: 'ok', texto: `Gastos de ${nombreMes(mes).toLowerCase()} guardados.` });
      cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setGuardando(false);
    }
  }

  async function agregar(e: FormEvent) {
    e.preventDefault();
    if (!nuevo.trim() || agregando) return;
    setAgregando(true);
    try {
      await guardarGasto(sesion, crypto.randomUUID(), nuevo);
      setNuevo('');
      setAviso(null);
      // Lo escrito en los montos no se pierde: se recarga la lista y se conservan los textos.
      const g = await leerGastos(sesion, mes);
      setGastos(g);
      setTextos((antes) => Object.fromEntries(g.map((x) => [x.id, antes[x.id] ?? (x.monto === null ? '' : pesosParaEditar(x.monto))])));
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    } finally {
      setAgregando(false);
    }
  }

  async function archivar(g: GastoDelMes) {
    try {
      await archivarGasto(sesion, g.id, !g.archivado);
      cargar();
    } catch (err) {
      setAviso({ tipo: 'error', texto: (err as Error).message });
    }
  }

  return (
    <main className="mx-auto max-w-3xl">
      <Encabezado Icono={IconoGastos} titulo="Gastos y resultado" descripcion="Anotá los gastos fijos de cada mes y mirá cuánto te queda después de pagarlos." />

      <div className="mt-6 flex items-center gap-2">
        <button
          type="button"
          aria-label="Mes anterior"
          onClick={() => irAMes(sumarMeses(mes, -1))}
          className="size-11 rounded-xl border border-stone-300 bg-white text-xl font-bold"
        >
          ‹
        </button>
        <p className="min-w-0 flex-1 text-center text-lg font-semibold" data-testid="mes">
          {nombreMes(mes)}
        </p>
        <button
          type="button"
          aria-label="Mes siguiente"
          onClick={() => irAMes(sumarMeses(mes, 1))}
          disabled={mes >= esteMes}
          className="size-11 rounded-xl border border-stone-300 bg-white text-xl font-bold disabled:opacity-40"
        >
          ›
        </button>
      </div>

      <section className={`mt-4 rounded-2xl bg-marca p-5 text-crema shadow-sm ${resultado ? '' : 'opacity-60'}`} data-testid="resultado">
        <p className="text-crema/75">Resultado del mes</p>
        <p className="mt-1 text-3xl font-bold tabular-nums" data-testid="resultado-neto">
          {resultado ? formatearPesos(resultado.neto) : '…'}
        </p>
        {resultado && (
          <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-crema/75">Vendiste</dt>
              <dd className="font-semibold tabular-nums">{formatearPesos(resultado.ventas)}</dd>
            </div>
            <div>
              <dt className="text-crema/75">Ganancia</dt>
              <dd className="font-semibold tabular-nums" data-testid="resultado-ganancia">
                {formatearPesos(resultado.ganancia)}
              </dd>
            </div>
            <div>
              <dt className="text-crema/75">Gastos</dt>
              <dd className="font-semibold tabular-nums" data-testid="resultado-gastos">
                −{formatearPesos(resultado.gastos)}
              </dd>
            </div>
          </dl>
        )}
      </section>
      {resultado && resultado.sinCosto > 0 && (
        <p className="mt-2 text-sm text-stone-600">
          {formatearPesos(resultado.sinCosto)} vendidos sin costo cargado (“Varios”, total del día o productos sin costo) no entran en la ganancia: el resultado
          real puede ser mayor.
        </p>
      )}

      {aviso && (
        <p
          className={`mt-4 rounded-xl p-3 ${aviso.tipo === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}
          role={aviso.tipo === 'ok' ? 'status' : 'alert'}
          data-testid="aviso-gastos"
        >
          {aviso.texto}
        </p>
      )}

      <h2 className="mt-8 text-lg font-bold">Gastos de {nombreMes(mes).toLowerCase()}</h2>
      {gastos === null ? (
        <p className="mt-2 text-stone-600">Cargando…</p>
      ) : (
        <form onSubmit={guardarMontos} className="mt-2 space-y-3" noValidate>
          {gastos.length === 0 && (
            <p className="rounded-2xl border border-dashed border-stone-300 p-4 text-center text-stone-600">
              Todavía no cargaste gastos. Sumá los que pagás todos los meses: alquiler, luz, sueldos, internet, monotributo.
            </p>
          )}
          {sinCargar.length > 0 && (
            <button
              type="button"
              onClick={() => setTextos({ ...textos, ...Object.fromEntries(sinCargar.map((g) => [g.id, pesosParaEditar(g.montoAnterior!)])) })}
              className="min-h-11 font-semibold text-green-800 underline underline-offset-4"
            >
              Usar los montos del mes anterior
            </button>
          )}
          {gastos.length > 0 && (
            <ul className="divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="gastos">
              {gastos.map((g) => (
                <li key={g.id} className={`flex items-center gap-3 p-3 ${g.archivado ? 'opacity-60' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{g.nombre}</span>
                    <span className="block text-sm text-stone-600">
                      {g.montoAnterior !== null ? `Antes: ${formatearPesos(g.montoAnterior)}` : 'Primera vez'}
                      <button type="button" onClick={() => archivar(g)} className="ml-3 font-semibold text-stone-700 underline underline-offset-2">
                        {g.archivado ? 'Volver a usar' : 'Ya no lo pago'}
                      </button>
                    </span>
                  </span>
                  <span className="text-lg">$</span>
                  <input
                    aria-label={g.nombre}
                    value={textos[g.id] ?? ''}
                    onChange={(e) => setTextos({ ...textos, [g.id]: e.target.value })}
                    inputMode="decimal"
                    placeholder={g.montoAnterior !== null ? pesosParaEditar(g.montoAnterior) : '0'}
                    className="h-11 w-36 rounded-xl border border-stone-300 px-3 text-right text-lg tabular-nums outline-none placeholder:text-stone-400 focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
                  />
                </li>
              ))}
            </ul>
          )}
          {gastos.length > 0 && (
            <Boton type="submit" disabled={guardando}>
              Guardar gastos del mes
            </Boton>
          )}
        </form>
      )}

      <form onSubmit={agregar} className="mt-4 flex gap-2">
        <label htmlFor="nuevo-gasto" className="sr-only">
          Nuevo gasto
        </label>
        <input
          id="nuevo-gasto"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          readOnly={agregando}
          maxLength={60}
          placeholder="Nuevo gasto (ej.: Alquiler)"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-stone-300 bg-white px-3 text-base outline-none placeholder:text-stone-500 focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
        />
        <button
          type="submit"
          disabled={agregando}
          className="min-h-11 shrink-0 rounded-xl border border-stone-300 bg-white px-4 font-semibold text-stone-800 shadow-xs hover:bg-stone-50"
        >
          Agregar
        </button>
      </form>

      {meses && meses.some((m) => m.ventas > 0 || m.gastos > 0) && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">Últimos {MESES_HISTORIA} meses</h2>
          <div className="mt-2 overflow-x-auto rounded-2xl border border-stone-200 bg-white shadow-sm">
            <table className="w-full text-sm tabular-nums" data-testid="historial-resultado">
              <thead className="text-stone-600">
                <tr>
                  <th className="p-3 text-left font-semibold">Mes</th>
                  <th className="p-3 text-right font-semibold">Ganancia</th>
                  <th className="p-3 text-right font-semibold">Gastos</th>
                  <th className="p-3 text-right font-semibold">Resultado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {[...meses].reverse().map((m) => {
                  const r = calcularResultado(m);
                  return (
                    <tr key={m.mes}>
                      <td className="p-3">
                        <button type="button" onClick={() => irAMes(m.mes)} className="font-medium underline-offset-2 hover:underline">
                          {nombreMes(m.mes)}
                        </button>
                      </td>
                      <td className="p-3 text-right">{formatearPesos(r.ganancia)}</td>
                      <td className="p-3 text-right">{formatearPesos(r.gastos)}</td>
                      <td className={`p-3 text-right font-semibold ${r.neto < 0 ? 'text-red-700' : ''}`}>{formatearPesos(r.neto)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8 sm:block sm:w-auto sm:px-8">
        Volver
      </Boton>
    </main>
  );
}
