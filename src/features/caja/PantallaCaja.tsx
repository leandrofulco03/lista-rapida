import { useCallback, useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { abrirCaja, anularMovimientoCaja, cerrarCaja, historialCajas, leerCaja, movimientoCaja, reabrirCaja } from '../../db';
import type { Caja, CajaDelHistorial } from '../../db';
import { textoDiferencia, tonoDiferencia } from '../../domain/caja';
import { formatearPesos, pesosParaEditar } from '../../domain/dinero';
import type { Centavos } from '../../domain/dinero';
import { leerImporte } from '../../domain/importe';
import { diaDe, nombrePeriodo, periodoDe, sumarDias } from '../../domain/ventas';
import type { Dia } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Encabezado } from '../../ui/Encabezado';
import { IconoCaja } from '../../ui/Iconos';
import { useCola } from '../ventas/cola';

interface Props {
  esDueno: boolean;
  onVolver: () => void;
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

const COLOR_TONO = { justo: 'text-green-700', sobra: 'text-amber-800', falta: 'text-red-700' } as const;

/** Lee un importe escrito; null si no es válido. Vacío vale cero sólo si se pide. */
function importe(texto: string, vacioEsCero = false): Centavos | null {
  if (texto.trim() === '') return vacioEsCero ? 0 : null;
  const m = leerImporte(texto, 'ar');
  return m !== null && m >= 0 ? m : null;
}

/**
 * Fase 10: arqueo de caja, uno por día. Se abre con lo que hay, se anotan entradas y salidas de efectivo y se cierra
 * contando. El dueño ve lo que debería haber y la diferencia; el empleado cuenta sin verlo.
 */
export function PantallaCaja({ esDueno, onVolver }: Props) {
  const sesion = useSesion();
  const cola = useCola();
  const hoy = diaDe(new Date());
  const [dia, setDia] = useState<Dia>(hoy);
  const [caja, setCaja] = useState<Caja | null>(null);
  const [historial, setHistorial] = useState<CajaDelHistorial[] | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    leerCaja(sesion, dia).then(setCaja, (e: Error) => setAviso({ tipo: 'error', texto: e.message }));
    if (esDueno) historialCajas(sesion, sumarDias(hoy, -13), hoy).then(setHistorial, () => setHistorial([]));
  }, [sesion, dia, esDueno, hoy]);
  useEffect(cargar, [cargar]);

  async function hacer(accion: () => Promise<unknown>, ok: string) {
    setOcupado(true);
    setAviso(null);
    try {
      await accion();
      setAviso({ tipo: 'ok', texto: ok });
      cargar();
      return true;
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  const puedeTocar = esDueno || !caja?.cerrada;
  const pendientesHoy = cola.pendientes.filter((p) => diaDe(new Date(p.venta.fecha)) === dia).length;

  return (
    <main className="mx-auto max-w-3xl">
      <Encabezado
        Icono={IconoCaja}
        titulo="Caja"
        descripcion={esDueno ? 'Abrí con lo que hay, anotá lo que entra y sale en efectivo y cerrá contando.' : 'Abrí la caja, anotá lo que sale en efectivo y cerrá contando la plata.'}
      />

      {esDueno && (
        <label className="mt-6 block">
          <span className="block font-semibold">Día</span>
          <input
            type="date"
            value={dia}
            max={hoy}
            onChange={(e) => {
              if (!e.target.value) return;
              setCaja(null);
              setAviso(null);
              setDia(e.target.value);
            }}
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15 sm:w-64"
          />
          <span className="mt-1 block text-sm text-stone-600">{nombrePeriodo(periodoDe('dia', dia), hoy)}</span>
        </label>
      )}

      {pendientesHoy > 0 && (
        <p className="mt-4 rounded-xl bg-amber-50 p-3 text-amber-950" role="status">
          {pendientesHoy === 1 ? 'Hay 1 venta' : `Hay ${pendientesHoy} ventas`} de este día sin subir. Hasta que se suban, no cuentan en la caja.
        </p>
      )}

      {aviso && (
        <p
          className={`mt-4 rounded-xl p-3 ${aviso.tipo === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`}
          role={aviso.tipo === 'ok' ? 'status' : 'alert'}
          data-testid="aviso-caja"
        >
          {aviso.texto}
        </p>
      )}

      {caja === null ? (
        <p className="mt-6 text-stone-600">Cargando…</p>
      ) : !caja.abierta ? (
        <Abrir caja={caja} ocupado={ocupado} onAbrir={(monto) => hacer(() => abrirCaja(sesion, dia, monto), `Caja abierta con ${formatearPesos(monto)}.`)} />
      ) : (
        <>
          <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" data-testid="caja">
            <Fila etiqueta="Abrió con" valor={formatearPesos(caja.apertura ?? 0)} />
            {caja.movimientos.length > 0 && (
              <ul className="mt-3 space-y-2 border-t border-stone-200 pt-3" data-testid="movimientos-caja">
                {caja.movimientos.map((m) => (
                  <li key={m.id} className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{m.motivo}</p>
                      <p className="text-sm text-stone-600">
                        {hora(m.fecha)}
                        {esDueno && m.quien ? ` · ${m.quien}` : ''}
                        {(esDueno || (m.propio && !caja.cerrada)) && (
                          <button
                            type="button"
                            onClick={() => hacer(() => anularMovimientoCaja(sesion, m.id), 'Movimiento sacado.')}
                            disabled={ocupado}
                            className="ml-3 font-semibold text-red-700"
                          >
                            Sacar
                          </button>
                        )}
                      </p>
                    </div>
                    <span className={`font-semibold tabular-nums ${m.tipo === 'entrada' ? 'text-green-700' : 'text-red-700'}`}>
                      {m.tipo === 'entrada' ? '+' : '−'}
                      {formatearPesos(m.monto)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {caja.esperado && (
              <div className="mt-3 space-y-1 border-t border-stone-200 pt-3 text-stone-700" data-testid="esperado">
                <Fila etiqueta="Ventas en efectivo" valor={`+${formatearPesos(caja.esperado.ventasEfectivo)}`} chico />
                {caja.esperado.pagosFiadoEfectivo > 0 && <Fila etiqueta="Pagos de fiado en efectivo" valor={`+${formatearPesos(caja.esperado.pagosFiadoEfectivo)}`} chico />}
                {caja.esperado.entradas > 0 && <Fila etiqueta="Entradas" valor={`+${formatearPesos(caja.esperado.entradas)}`} chico />}
                {caja.esperado.salidas > 0 && <Fila etiqueta="Salidas" valor={`−${formatearPesos(caja.esperado.salidas)}`} chico />}
                <Fila etiqueta="Debería haber" valor={formatearPesos(caja.esperado.esperado)} fuerte testId="debe-haber" />
              </div>
            )}
            {caja.cerrada && (
              <div className="mt-3 border-t border-stone-200 pt-3">
                <Fila etiqueta="Se contó" valor={formatearPesos(caja.contado ?? 0)} fuerte testId="contado" />
                <p className="mt-1 text-sm text-stone-600">
                  Cerrada{caja.cerradaEn ? ` a las ${hora(caja.cerradaEn)}` : ''}
                  {caja.cerradaPor ? ` por ${caja.cerradaPor}` : ''}
                  {caja.nota ? ` · ${caja.nota}` : ''}
                </p>
                {caja.diferencia !== null && (
                  <p className={`mt-3 text-2xl font-bold ${COLOR_TONO[tonoDiferencia(caja.diferencia)]}`} data-testid="diferencia">
                    {textoDiferencia(caja.diferencia)}
                  </p>
                )}
                {!esDueno && <p className="mt-2 text-stone-700">Listo. El dueño ve si la caja cerró bien.</p>}
              </div>
            )}
          </section>

          {puedeTocar && !caja.cerrada && (
            <>
              <AnotarMovimiento
                ocupado={ocupado}
                onAnotar={(mov) =>
                  hacer(() => movimientoCaja(sesion, dia, mov), `${mov.tipo === 'salida' ? 'Salida' : 'Entrada'} de ${formatearPesos(mov.monto)} anotada.`)
                }
              />
              <Cerrar ocupado={ocupado} onCerrar={(contado, nota) => hacer(() => cerrarCaja(sesion, dia, contado, nota), 'Caja cerrada.')} />
            </>
          )}
          {esDueno && caja.cerrada && (
            <Boton type="button" variante="secundario" disabled={ocupado} onClick={() => hacer(() => reabrirCaja(sesion, dia), 'Caja abierta de nuevo.')} className="mt-4 sm:w-auto sm:px-8">
              Reabrir caja
            </Boton>
          )}
        </>
      )}

      {esDueno && historial && historial.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-bold">Últimas dos semanas</h2>
          <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="historial-caja">
            {historial.map((h) => (
              <li key={h.dia}>
                <button type="button" onClick={() => setDia(h.dia)} className="flex min-h-12 w-full items-center gap-3 p-3 text-left hover:bg-stone-50">
                  <span className="flex-1 font-medium">{nombrePeriodo(periodoDe('dia', h.dia), hoy)}</span>
                  {h.diferencia === null ? (
                    <span className="text-stone-600">Sin cerrar</span>
                  ) : (
                    <span className={`font-semibold ${COLOR_TONO[tonoDiferencia(h.diferencia)]}`}>{textoDiferencia(h.diferencia)}</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8 sm:block sm:w-auto sm:px-8">
        Volver
      </Boton>
    </main>
  );
}

function Fila({ etiqueta, valor, chico, fuerte, testId }: { etiqueta: ReactNode; valor: string; chico?: boolean; fuerte?: boolean; testId?: string }) {
  return (
    <p className={`flex justify-between gap-3 ${chico ? 'text-sm' : ''} ${fuerte ? 'text-lg font-bold text-stone-900' : ''}`}>
      <span>{etiqueta}</span>
      <span className="tabular-nums" data-testid={testId}>
        {valor}
      </span>
    </p>
  );
}

function Abrir({ caja, ocupado, onAbrir }: { caja: Caja; ocupado: boolean; onAbrir: (monto: Centavos) => void }) {
  const [texto, setTexto] = useState(caja.aperturaSugerida !== null ? pesosParaEditar(caja.aperturaSugerida) : '');
  const [error, setError] = useState<string | null>(null);
  function enviar(e: FormEvent) {
    e.preventDefault();
    const monto = importe(texto, true);
    if (monto === null) return setError('Escribí cuánto hay en la caja.');
    setError(null);
    onAbrir(monto);
  }
  return (
    <form onSubmit={enviar} className="mt-6 space-y-4 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" noValidate>
      <CampoTexto
        etiqueta="¿Con cuánto efectivo empieza la caja?"
        valor={texto}
        onCambiar={setTexto}
        inputMode="decimal"
        placeholder="0"
        error={error ?? undefined}
        ayuda={caja.aperturaSugerida !== null ? `Al último cierre quedaron ${formatearPesos(caja.aperturaSugerida)}.` : 'El cambio que hay en el cajón para empezar.'}
      />
      <Boton type="submit" disabled={ocupado}>
        Abrir caja
      </Boton>
    </form>
  );
}

function AnotarMovimiento({ ocupado, onAnotar }: { ocupado: boolean; onAnotar: (m: { tipo: 'entrada' | 'salida'; monto: Centavos; motivo: string }) => Promise<boolean> }) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<'entrada' | 'salida'>('salida');
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className="mt-4 min-h-11 font-semibold text-green-800 underline underline-offset-4">
        + Anotar salida o entrada de plata
      </button>
    );
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const m = importe(monto);
    if (m === null || m <= 0) return setError('Escribí un importe mayor que cero.');
    if (!motivo.trim()) return setError('Escribí el motivo (por ejemplo, "pago a proveedor").');
    setError(null);
    if (await onAnotar({ tipo, monto: m, motivo })) {
      setMonto('');
      setMotivo('');
      setAbierto(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-4 space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" noValidate>
      <fieldset>
        <legend className="font-semibold text-stone-800">¿Sale o entra plata?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(['salida', 'entrada'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tipo === t}
              onClick={() => setTipo(t)}
              className={`min-h-11 rounded-xl border px-3 font-medium ${tipo === t ? 'border-green-600 bg-green-600 text-crema' : 'border-stone-300 bg-white'}`}
            >
              {t === 'salida' ? 'Sale' : 'Entra'}
            </button>
          ))}
        </div>
      </fieldset>
      <CampoTexto etiqueta="Importe" valor={monto} onCambiar={setMonto} inputMode="decimal" placeholder="$" />
      <CampoTexto
        etiqueta="Motivo"
        valor={motivo}
        onCambiar={setMotivo}
        maxLength={80}
        placeholder={tipo === 'salida' ? 'Pago a proveedor, retiro…' : 'Cambio, aporte…'}
      />
      {error && (
        <p className="text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Boton type="button" variante="secundario" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={ocupado}>
          Anotar
        </Boton>
      </div>
    </form>
  );
}

function Cerrar({ ocupado, onCerrar }: { ocupado: boolean; onCerrar: (contado: Centavos, nota: string) => void }) {
  const [contado, setContado] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);
  function enviar(e: FormEvent) {
    e.preventDefault();
    const m = importe(contado);
    if (m === null) return setError('Escribí cuánto contaste.');
    setError(null);
    onCerrar(m, nota);
  }
  return (
    <form onSubmit={enviar} className="mt-6 space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" noValidate>
      <h2 className="text-lg font-bold">Cerrar la caja</h2>
      <CampoTexto
        etiqueta="Contá el efectivo: ¿cuánto hay?"
        valor={contado}
        onCambiar={setContado}
        inputMode="decimal"
        placeholder="$"
        error={error ?? undefined}
      />
      <CampoTexto etiqueta="Nota (opcional)" valor={nota} onCambiar={setNota} maxLength={200} />
      <Boton type="submit" disabled={ocupado}>
        Cerrar caja
      </Boton>
    </form>
  );
}
