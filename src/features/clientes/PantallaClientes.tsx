import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { anularPago, archivarCliente, guardarCliente, listarClientes, movimientosCliente, registrarPago } from '../../db';
import type { Cliente, MovimientoCliente } from '../../db';
import { buscarClientes, enlaceWhatsapp, limpiarNombreCliente, mensajeSaldo, numeroWhatsapp, textoSaldo } from '../../domain/clientes';
import { formatearPesos, pesosParaEditar } from '../../domain/dinero';
import { leerImporte } from '../../domain/importe';
import { MEDIOS_PAGO, nombreMedio } from '../../domain/ventas';
import type { MedioPago } from '../../domain/ventas';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { CampoTexto } from '../../ui/CampoTexto';
import { Encabezado } from '../../ui/Encabezado';
import { IconoClientes, IconoFlecha } from '../../ui/Iconos';

interface Props {
  nombreComercio: string;
  onVolver: () => void;
}

type Vista = { tipo: 'lista' } | { tipo: 'cliente'; id: string } | { tipo: 'editar'; cliente: Cliente | null };

const fechaCorta = (iso: string) =>
  new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'America/Argentina/Buenos_Aires' });
const fechaYHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' });

/** Fase 10: clientes con fiado (sólo el dueño). Saldos, pagos, límites y recordatorio por WhatsApp. */
export function PantallaClientes({ nombreComercio, onVolver }: Props) {
  const sesion = useSesion();
  const [clientes, setClientes] = useState<Cliente[] | null>(null);
  const [vista, setVista] = useState<Vista>({ tipo: 'lista' });
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    listarClientes(sesion).then(setClientes, (e: Error) => setError(e.message));
  }, [sesion]);
  useEffect(cargar, [cargar]);

  if (vista.tipo === 'editar') {
    return (
      <FormularioCliente
        cliente={vista.cliente}
        onGuardado={(id) => {
          cargar();
          setVista({ tipo: 'cliente', id });
        }}
        onVolver={() => setVista(vista.cliente ? { tipo: 'cliente', id: vista.cliente.id } : { tipo: 'lista' })}
      />
    );
  }
  if (vista.tipo === 'cliente') {
    const cliente = clientes?.find((c) => c.id === vista.id);
    if (cliente) {
      return (
        <DetalleCliente
          key={cliente.id}
          cliente={cliente}
          nombreComercio={nombreComercio}
          onCambio={cargar}
          onEditar={() => setVista({ tipo: 'editar', cliente })}
          onVolver={() => setVista({ tipo: 'lista' })}
        />
      );
    }
  }
  return <ListaClientes clientes={clientes} error={error} onElegir={(id) => setVista({ tipo: 'cliente', id })} onNuevo={() => setVista({ tipo: 'editar', cliente: null })} onVolver={onVolver} />;
}

function ListaClientes({
  clientes,
  error,
  onElegir,
  onNuevo,
  onVolver,
}: {
  clientes: Cliente[] | null;
  error: string | null;
  onElegir: (id: string) => void;
  onNuevo: () => void;
  onVolver: () => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [verArchivados, setVerArchivados] = useState(false);
  const activos = (clientes ?? []).filter((c) => !c.archivado);
  const archivados = (clientes ?? []).filter((c) => c.archivado);
  const conDeuda = activos.filter((c) => c.saldo > 0);
  const deuda = conDeuda.reduce((s, c) => s + c.saldo, 0);
  const mostrados = buscarClientes(activos, busqueda);

  return (
    <main className="mx-auto max-w-3xl">
      <Encabezado
        Icono={IconoClientes}
        titulo="Clientes"
        descripcion="Lo que te deben por fiado. Las ventas fiadas se cargan al vender, eligiendo “Fiado”."
        acciones={
          <Boton type="button" onClick={onNuevo} className="sm:w-auto">
            Nuevo cliente
          </Boton>
        }
      />

      {clientes !== null && activos.length > 0 && (
        <section className="mt-6 rounded-2xl bg-marca p-5 text-crema shadow-sm" data-testid="total-fiado">
          <p className="text-crema/75">Te deben</p>
          <p className="mt-1 text-3xl font-bold tabular-nums">{formatearPesos(deuda)}</p>
          <p className="mt-1 text-sm text-crema/75">
            {conDeuda.length === 0 ? 'Nadie debe nada.' : conDeuda.length === 1 ? '1 cliente con deuda' : `${conDeuda.length} clientes con deuda`}
          </p>
        </section>
      )}

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}
      {clientes === null && !error && <p className="mt-6 text-stone-600">Cargando…</p>}
      {clientes !== null && activos.length === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-stone-300 p-4 text-center text-stone-600">
          Todavía no hay clientes. Se crean al vender fiado o con “Nuevo cliente”.
        </p>
      )}

      {activos.length > 0 && (
        <>
          <label htmlFor="buscar-cliente" className="sr-only">
            Buscar cliente
          </label>
          <input
            id="buscar-cliente"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente"
            autoComplete="off"
            className="mt-6 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base shadow-xs outline-none placeholder:text-stone-500 focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
          />
          <ul className="mt-3 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="clientes">
            {mostrados.length === 0 && <li className="p-3 text-stone-600">No hay clientes con “{busqueda.trim()}”.</li>}
            {mostrados.map((c) => (
              <FilaCliente key={c.id} cliente={c} onElegir={onElegir} />
            ))}
          </ul>
        </>
      )}

      {archivados.length > 0 && (
        <section className="mt-6">
          <button type="button" onClick={() => setVerArchivados(!verArchivados)} className="min-h-11 font-semibold text-green-800" aria-expanded={verArchivados}>
            {verArchivados ? 'Ocultar' : 'Ver'} archivados ({archivados.length})
          </button>
          {verArchivados && (
            <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white opacity-80 shadow-sm">
              {archivados.map((c) => (
                <FilaCliente key={c.id} cliente={c} onElegir={onElegir} />
              ))}
            </ul>
          )}
        </section>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8 sm:block sm:w-auto sm:px-8">
        Volver
      </Boton>
    </main>
  );
}

function FilaCliente({ cliente: c, onElegir }: { cliente: Cliente; onElegir: (id: string) => void }) {
  const pasado = c.limite !== null && c.saldo > c.limite;
  return (
    <li>
      <button type="button" onClick={() => onElegir(c.id)} className="flex min-h-14 w-full items-center gap-3 p-3 text-left hover:bg-stone-50">
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{c.nombre}</span>
          <span className="block text-sm text-stone-600">
            {c.ultimoMovimiento ? `Último movimiento: ${fechaCorta(c.ultimoMovimiento)}` : 'Sin movimientos'}
            {pasado && <span className="ml-2 font-semibold text-red-700">Pasó su límite</span>}
          </span>
        </span>
        <span className={`font-bold tabular-nums ${c.saldo > 0 ? 'text-stone-900' : 'text-green-700'}`}>{textoSaldo(c.saldo)}</span>
        <IconoFlecha className="size-5 shrink-0 text-stone-500" />
      </button>
    </li>
  );
}

function DetalleCliente({
  cliente,
  nombreComercio,
  onCambio,
  onEditar,
  onVolver,
}: {
  cliente: Cliente;
  nombreComercio: string;
  onCambio: () => void;
  onEditar: () => void;
  onVolver: () => void;
}) {
  const sesion = useSesion();
  const [movimientos, setMovimientos] = useState<MovimientoCliente[] | null>(null);
  const [pago, setPago] = useState<{ monto: string; medio: MedioPago; nota: string } | null>(null);
  const [aAnular, setAAnular] = useState<MovimientoCliente | null>(null);
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'error'; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const cargar = useCallback(() => {
    movimientosCliente(sesion, cliente.id).then(setMovimientos, (e: Error) => setAviso({ tipo: 'error', texto: e.message }));
  }, [sesion, cliente.id]);
  useEffect(cargar, [cargar, cliente.saldo]);

  async function hacer(accion: () => Promise<string>) {
    setOcupado(true);
    setAviso(null);
    try {
      const texto = await accion();
      setAviso({ tipo: 'ok', texto });
      onCambio();
      cargar();
    } catch (e) {
      setAviso({ tipo: 'error', texto: (e as Error).message });
    } finally {
      setOcupado(false);
    }
  }

  function cobrar(e: FormEvent) {
    e.preventDefault();
    if (!pago) return;
    const monto = leerImporte(pago.monto, 'ar');
    if (monto === null || monto <= 0) {
      setAviso({ tipo: 'error', texto: 'Escribí un importe mayor que cero.' });
      return;
    }
    hacer(async () => {
      const saldo = await registrarPago(sesion, { clienteId: cliente.id, monto, medioPago: pago.medio, nota: pago.nota });
      setPago(null);
      return `Pago de ${formatearPesos(monto)} guardado. ${textoSaldo(saldo)}.`;
    });
  }

  const whatsapp = numeroWhatsapp(cliente.telefono);
  const pasado = cliente.limite !== null && cliente.saldo > cliente.limite;

  return (
    <main className="mx-auto max-w-3xl">
      <Encabezado
        Icono={IconoClientes}
        antetitulo="Cliente"
        titulo={cliente.nombre}
        descripcion={[cliente.telefono, cliente.nota].filter(Boolean).join(' · ') || undefined}
        acciones={
          <Boton type="button" variante="secundario" onClick={onEditar} className="sm:w-auto">
            Editar
          </Boton>
        }
      />

      <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
        <p className="text-stone-600">{cliente.saldo < 0 ? 'Tiene a favor' : 'Debe'}</p>
        <p className="mt-1 text-3xl font-bold tabular-nums" data-testid="saldo-cliente">
          {formatearPesos(Math.abs(cliente.saldo))}
        </p>
        <p className={`mt-1 text-sm ${pasado ? 'font-semibold text-red-700' : 'text-stone-600'}`}>
          {cliente.limite === null ? 'Sin límite de fiado' : `Límite: ${formatearPesos(cliente.limite)}${pasado ? ' (lo pasó)' : ''}`}
        </p>
        {cliente.archivado && <p className="mt-2 text-sm font-semibold text-stone-700">Archivado: no aparece al vender.</p>}

        {pago ? (
          <form onSubmit={cobrar} className="mt-4 space-y-3 border-t border-stone-200 pt-4">
            <CampoTexto etiqueta="¿Cuánto pagó?" valor={pago.monto} onCambiar={(monto) => setPago({ ...pago, monto })} inputMode="decimal" placeholder="$" autoFocus />
            <fieldset>
              <legend className="font-semibold text-stone-800">¿Cómo pagó?</legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {MEDIOS_PAGO.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    aria-pressed={pago.medio === m.id}
                    onClick={() => setPago({ ...pago, medio: m.id })}
                    className={`min-h-11 rounded-xl border px-3 font-medium ${pago.medio === m.id ? 'border-green-600 bg-green-600 text-crema' : 'border-stone-300 bg-white'}`}
                  >
                    {m.nombre}
                  </button>
                ))}
              </div>
            </fieldset>
            <CampoTexto etiqueta="Nota (opcional)" valor={pago.nota} onCambiar={(nota) => setPago({ ...pago, nota })} maxLength={200} />
            <div className="grid grid-cols-2 gap-2">
              <Boton type="button" variante="secundario" onClick={() => setPago(null)}>
                Cancelar
              </Boton>
              <Boton type="submit" disabled={ocupado}>
                Guardar pago
              </Boton>
            </div>
          </form>
        ) : (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Boton type="button" onClick={() => setPago({ monto: cliente.saldo > 0 ? pesosParaEditar(cliente.saldo) : '', medio: 'efectivo', nota: '' })}>
              Registrar pago
            </Boton>
            {whatsapp && cliente.saldo > 0 && (
              <a
                href={enlaceWhatsapp(whatsapp, mensajeSaldo(nombreComercio, cliente.nombre, cliente.saldo))}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-center rounded-xl border border-stone-300 bg-white px-4 font-semibold text-stone-800 shadow-xs hover:bg-stone-50"
              >
                Recordar por WhatsApp
              </a>
            )}
          </div>
        )}
      </section>

      {aviso && (
        <p className={`mt-4 rounded-xl p-3 ${aviso.tipo === 'ok' ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'}`} role={aviso.tipo === 'ok' ? 'status' : 'alert'}>
          {aviso.texto}
        </p>
      )}

      <h2 className="mt-8 text-lg font-bold">Movimientos</h2>
      {movimientos === null && <p className="mt-2 text-stone-600">Cargando…</p>}
      {movimientos?.length === 0 && <p className="mt-2 text-stone-600">Sin movimientos.</p>}
      <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm empty:hidden" data-testid="movimientos-cliente">
        {movimientos?.map((m) => (
          <li key={m.id} className={`flex items-start gap-3 p-3 ${m.anulado ? 'opacity-60' : ''}`}>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {m.tipo === 'venta' ? 'Fiado' : `Pagó (${nombreMedio(m.medioPago ?? '')})`}
                {m.anulado && <span className="ml-2 rounded bg-stone-200 px-1.5 text-sm font-medium">Anulado</span>}
              </p>
              <p className="text-sm text-stone-600">
                {fechaYHora(m.fecha)}
                {m.detalle ? ` · ${m.detalle}` : ''}
              </p>
              {m.tipo === 'pago' && !m.anulado && (
                <button type="button" onClick={() => setAAnular(m)} className="mt-1 min-h-9 text-sm font-semibold text-red-700">
                  Anular pago
                </button>
              )}
            </div>
            <span className={`font-bold tabular-nums ${m.anulado ? 'line-through' : ''} ${m.tipo === 'pago' ? 'text-green-700' : ''}`}>
              {m.tipo === 'pago' ? '−' : '+'}
              {formatearPesos(m.monto)}
            </span>
          </li>
        ))}
      </ul>

      {aAnular && (
        <div className="mt-4 rounded-xl bg-red-50 p-3 text-red-950" role="alert">
          <p>¿Anular el pago de {formatearPesos(aAnular.monto)}? Vuelve a sumar a la deuda.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Boton type="button" variante="secundario" onClick={() => setAAnular(null)}>
              No
            </Boton>
            <Boton
              type="button"
              variante="peligro"
              disabled={ocupado}
              onClick={() =>
                hacer(async () => {
                  await anularPago(sesion, aAnular.id);
                  setAAnular(null);
                  return 'Pago anulado.';
                })
              }
            >
              Sí, anular
            </Boton>
          </div>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Boton type="button" variante="secundario" onClick={onVolver} className="sm:w-auto sm:px-8">
          Volver a clientes
        </Boton>
        <Boton
          type="button"
          variante="secundario"
          disabled={ocupado}
          onClick={() =>
            hacer(async () => {
              await archivarCliente(sesion, cliente.id, !cliente.archivado);
              return cliente.archivado ? 'Cliente activo de nuevo.' : 'Cliente archivado: ya no aparece al vender.';
            })
          }
          className="sm:w-auto sm:px-8"
        >
          {cliente.archivado ? 'Desarchivar' : 'Archivar'}
        </Boton>
      </div>
    </main>
  );
}

function FormularioCliente({ cliente, onGuardado, onVolver }: { cliente: Cliente | null; onGuardado: (id: string) => void; onVolver: () => void }) {
  const sesion = useSesion();
  const [nombre, setNombre] = useState(cliente?.nombre ?? '');
  const [telefono, setTelefono] = useState(cliente?.telefono ?? '');
  const [limite, setLimite] = useState(cliente?.limite ? pesosParaEditar(cliente.limite) : '');
  const [nota, setNota] = useState(cliente?.nota ?? '');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    const limpio = limpiarNombreCliente(nombre);
    if (!limpio) return setError('Escribí el nombre del cliente.');
    const tope = limite.trim() === '' ? null : leerImporte(limite, 'ar');
    if (tope !== null && tope <= 0) return setError('El límite tiene que ser un importe mayor que cero.');
    if (limite.trim() !== '' && tope === null) return setError('El límite no es un importe válido.');
    setGuardando(true);
    setError(null);
    const id = cliente?.id ?? crypto.randomUUID();
    try {
      await guardarCliente(sesion, { id, nombre: limpio, telefono: telefono.trim() || null, limite: tope, nota: nota.trim() || null });
      onGuardado(id);
    } catch (err) {
      setError((err as Error).message);
      setGuardando(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl">
      <Encabezado Icono={IconoClientes} titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'} />
      <form onSubmit={guardar} className="mt-6 space-y-4" noValidate>
        <CampoTexto etiqueta="Nombre" valor={nombre} onCambiar={setNombre} maxLength={80} autoFocus />
        <CampoTexto
          etiqueta="Celular (opcional)"
          valor={telefono}
          onCambiar={setTelefono}
          maxLength={30}
          inputMode="tel"
          ayuda="Con el celular, le podés recordar el saldo por WhatsApp. Ej.: 11 5555 1234."
        />
        <CampoTexto
          etiqueta="Límite de fiado (opcional)"
          valor={limite}
          onCambiar={setLimite}
          inputMode="decimal"
          placeholder="Sin límite"
          ayuda="Al vender, se avisa si una venta lo pasa."
        />
        <CampoTexto etiqueta="Nota (opcional)" valor={nota} onCambiar={setNota} maxLength={200} />
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
