import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import { diaDe, sumarDias } from '../domain/ventas';
import type { LineaTicket, MedioVenta } from '../domain/ventas';
import { baseConMigraciones, contar, usuarioNuevo } from '../nube/pruebas';
import {
  abrirCaja,
  anularMovimientoCaja,
  anularPago,
  anularVenta,
  archivarCliente,
  cerrarCaja,
  clientesParaVender,
  crearComercio,
  crearInvitacion,
  guardarCliente,
  guardarSinDetalle,
  historialCajas,
  leerCaja,
  listarClientes,
  movimientoCaja,
  movimientosCliente,
  reabrirCaja,
  registrarPago,
  registrarVenta,
  resumenVentas,
  unirseConCodigo,
  ventasDelDia,
} from '.';
import type { Sesion, VentaNueva } from '.';

let base: PGliteInterface;
let pg: PGliteInterface;
let dueno: Sesion;
let empleado: Sesion;
let otro: Sesion;

beforeAll(async () => {
  base = await baseConMigraciones();
}, 60_000);

beforeEach(async () => {
  pg = await base.clone();
  const b = await usuarioNuevo(pg, 'dueno@prueba.com');
  dueno = { backend: b, comercioId: await crearComercio(b, { ...CONFIG_SUGERIDA, nombreComercio: 'Kiosco' }) };
  const e = await usuarioNuevo(pg, 'empleado@prueba.com');
  await unirseConCodigo(e, (await crearInvitacion(dueno)).codigo, 'Juan');
  empleado = { backend: e, comercioId: dueno.comercioId };
  const o = await usuarioNuevo(pg, 'otro@prueba.com');
  otro = { backend: o, comercioId: await crearComercio(o, { ...CONFIG_SUGERIDA, nombreComercio: 'Otro' }) };
});

const varios = (monto: number): LineaTicket => ({ productoId: null, descripcion: 'Varios', cantidad: 1, precioUnitario: monto });
const venta = (monto: number, medioPago: MedioVenta = 'efectivo', cliente?: { id: string; nombre: string }): VentaNueva => ({
  id: crypto.randomUUID(),
  fecha: new Date().toISOString(),
  medioPago,
  lineas: [varios(monto)],
  cliente,
});
const hoy = () => diaDe(new Date());
const nuevoCliente = (nombre: string, limite: number | null = null) => ({ id: crypto.randomUUID(), nombre, telefono: null, limite, nota: null });

describe('fiado', () => {
  it('el empleado vende fiado a un cliente nuevo (creado en el dispositivo) y el dueño ve el saldo', async () => {
    const id = crypto.randomUUID();
    const v = venta(150_000, 'fiado', { id, nombre: '  Doña   Rosa ' });
    await registrarVenta(empleado, v);
    // Reintentar no duplica la venta ni el cliente.
    await registrarVenta(empleado, v);
    expect(await contar(pg, 'clientes')).toBe(1);

    const [rosa] = await listarClientes(dueno);
    expect(rosa).toMatchObject({ id, nombre: 'Doña Rosa', saldo: 150_000, limite: null, archivado: false });
    expect(await clientesParaVender(empleado)).toEqual([{ id, nombre: 'Doña Rosa', disponible: null }]);
    expect((await ventasDelDia(empleado, hoy()))[0]).toMatchObject({ medioPago: 'fiado', cliente: 'Doña Rosa' });
  });

  it('un cliente nuevo con el nombre de otro que ya existe se suma al que existe', async () => {
    const rosa = nuevoCliente('Doña Rosa');
    await guardarCliente(dueno, rosa);
    await registrarVenta(empleado, venta(10_000, 'fiado', { id: crypto.randomUUID(), nombre: 'doña rosa' }));
    expect(await contar(pg, 'clientes')).toBe(1);
    expect((await listarClientes(dueno))[0]!.saldo).toBe(10_000);
  });

  it('fiado pide cliente, y el cliente tiene que ser del comercio', async () => {
    await expect(registrarVenta(empleado, venta(10_000, 'fiado'))).rejects.toThrow('a quién se le fía');
    await expect(registrarVenta(empleado, venta(10_000, 'fiado', { id: crypto.randomUUID(), nombre: ' ' }))).rejects.toThrow('a quién se le fía');
    const ajeno = nuevoCliente('Ajeno');
    await guardarCliente(otro, ajeno);
    await expect(registrarVenta(empleado, venta(10_000, 'fiado', ajeno))).rejects.toThrow('Cliente no válido');
    // Con otro medio, el cliente no se guarda.
    await registrarVenta(empleado, venta(10_000, 'efectivo', nuevoCliente('Nadie')));
    expect(await contar(pg, 'clientes')).toBe(1);
  });

  it('pagos: bajan el saldo, se anulan, y anular la venta fiada también baja el saldo', async () => {
    const pepe = nuevoCliente('Pepe', 100_000);
    await guardarCliente(dueno, pepe);
    const v1 = venta(60_000, 'fiado', pepe);
    await registrarVenta(empleado, v1);
    await registrarVenta(empleado, venta(30_000, 'fiado', pepe));
    expect(await clientesParaVender(empleado)).toEqual([{ id: pepe.id, nombre: 'Pepe', disponible: 10_000 }]);

    expect(await registrarPago(dueno, { clienteId: pepe.id, monto: 50_000, medioPago: 'efectivo', nota: 'a cuenta' })).toBe(40_000);
    await anularVenta(dueno, v1.id);
    expect((await listarClientes(dueno))[0]!.saldo).toBe(-20_000);

    const movs = await movimientosCliente(dueno, pepe.id);
    expect(movs.map((m) => [m.tipo, m.monto, m.anulado])).toEqual([
      ['pago', 50_000, false],
      ['venta', 30_000, false],
      ['venta', 60_000, true],
    ]);
    await anularPago(dueno, movs[0]!.id);
    expect((await listarClientes(dueno))[0]!.saldo).toBe(30_000);
    await expect(anularPago(dueno, movs[0]!.id)).rejects.toThrow('ya estaba anulado');
  });

  it('el empleado no ve saldos ni cobra; nadie de afuera ve los clientes', async () => {
    const pepe = nuevoCliente('Pepe');
    await guardarCliente(dueno, pepe);
    await expect(listarClientes(empleado)).rejects.toThrow('Sólo el dueño');
    await expect(registrarPago(empleado, { clienteId: pepe.id, monto: 1_000, medioPago: 'efectivo' })).rejects.toThrow('Sólo el dueño');
    await expect(guardarCliente(empleado, nuevoCliente('Otro'))).rejects.toThrow('Sólo el dueño');
    expect(await clientesParaVender({ ...otro, comercioId: dueno.comercioId })).toEqual([]);
    await expect(movimientosCliente({ ...otro, comercioId: dueno.comercioId }, pepe.id)).rejects.toThrow('Sólo el dueño');
    // Directo a las tablas, nada.
    await expect(empleado.backend.rpc('saldo_cliente', { c: dueno.comercioId, cliente: pepe.id })).rejects.toThrow();
  });

  it('validaciones de clientes: nombre, límite, nombres repetidos y archivar con deuda', async () => {
    await expect(guardarCliente(dueno, nuevoCliente(' '))).rejects.toThrow('nombre');
    await expect(guardarCliente(dueno, nuevoCliente('Pepe', -5))).rejects.toThrow('límite');
    const pepe = nuevoCliente('Pepe');
    await guardarCliente(dueno, pepe);
    await expect(guardarCliente(dueno, nuevoCliente('PEPE'))).rejects.toThrow('Ya hay un cliente');
    await guardarCliente(dueno, { ...pepe, telefono: '11 5555-1234', limite: 200_000 });
    expect((await listarClientes(dueno))[0]).toMatchObject({ telefono: '11 5555-1234', limite: 200_000 });

    await registrarVenta(empleado, venta(10_000, 'fiado', pepe));
    await expect(archivarCliente(dueno, pepe.id, true)).rejects.toThrow('Tiene deuda');
    await registrarPago(dueno, { clienteId: pepe.id, monto: 10_000, medioPago: 'qr' });
    await archivarCliente(dueno, pepe.id, true);
    expect(await clientesParaVender(empleado)).toEqual([]);
    // Archivado, su nombre queda libre.
    await guardarCliente(dueno, nuevoCliente('Pepe'));
    await expect(archivarCliente(dueno, pepe.id, false)).rejects.toThrow('otro cliente');
  });

  it('el fiado cuenta como venta en el resumen', async () => {
    const pepe = nuevoCliente('Pepe');
    await registrarVenta(empleado, venta(10_000, 'fiado', pepe));
    await registrarVenta(empleado, venta(5_000, 'efectivo'));
    const r = await resumenVentas(dueno, hoy(), hoy());
    expect(r.totalTickets).toBe(15_000);
    expect(r.porMedio).toEqual([
      { medio: 'fiado', total: 10_000 },
      { medio: 'efectivo', total: 5_000 },
    ]);
  });
});

describe('caja', () => {
  it('esperado = apertura + ventas en efectivo + pagos de fiado en efectivo + entradas − salidas', async () => {
    const pepe = nuevoCliente('Pepe');
    await guardarCliente(dueno, pepe);
    await registrarVenta(empleado, venta(80_000, 'fiado', pepe));

    await abrirCaja(empleado, hoy(), 500_000);
    await registrarVenta(empleado, venta(120_000, 'efectivo'));
    await registrarVenta(empleado, venta(90_000, 'debito'));
    const anulada = venta(70_000, 'efectivo');
    await registrarVenta(empleado, anulada);
    await anularVenta(empleado, anulada.id);
    await guardarSinDetalle(dueno, hoy(), { efectivo: 30_000, qr: 40_000 });
    await registrarPago(dueno, { clienteId: pepe.id, monto: 50_000, medioPago: 'efectivo' });
    await registrarPago(dueno, { clienteId: pepe.id, monto: 10_000, medioPago: 'transferencia' });
    await movimientoCaja(empleado, hoy(), { tipo: 'salida', monto: 200_000, motivo: 'Pago al de la soda' });
    await movimientoCaja(dueno, hoy(), { tipo: 'entrada', monto: 20_000, motivo: 'Cambio' });

    const caja = await leerCaja(dueno, hoy());
    expect(caja.esperado).toEqual({
      apertura: 500_000,
      ventasEfectivo: 150_000,
      pagosFiadoEfectivo: 50_000,
      entradas: 20_000,
      salidas: 200_000,
      esperado: 520_000,
    });
    expect(caja.movimientos.map((m) => [m.tipo, m.monto, m.motivo, m.quien])).toEqual([
      ['salida', 200_000, 'Pago al de la soda', 'Juan'],
      ['entrada', 20_000, 'Cambio', 'dueno@prueba.com'],
    ]);

    // El empleado cierra a ciegas: no ve el esperado ni la diferencia.
    await cerrarCaja(empleado, hoy(), 515_000, 'faltó cambio');
    const vistaEmpleado = await leerCaja(empleado, hoy());
    expect(vistaEmpleado).toMatchObject({ cerrada: true, contado: 515_000, esperado: null, diferencia: null, cerradaPor: 'Juan', nota: 'faltó cambio' });
    expect((await leerCaja(dueno, hoy())).diferencia).toBe(-5_000);
  });

  it('caja cerrada: el empleado no la cambia; el dueño la reabre o la vuelve a cerrar', async () => {
    await expect(movimientoCaja(empleado, hoy(), { tipo: 'salida', monto: 1_000, motivo: 'x' })).rejects.toThrow('Primero abrí la caja');
    await abrirCaja(empleado, hoy(), 100_000);
    await movimientoCaja(empleado, hoy(), { tipo: 'salida', monto: 1_000, motivo: 'Hielo' });
    await cerrarCaja(empleado, hoy(), 99_000);
    await expect(cerrarCaja(empleado, hoy(), 1)).rejects.toThrow('ya está cerrada');
    await expect(abrirCaja(empleado, hoy(), 1)).rejects.toThrow('ya está cerrada');
    await expect(movimientoCaja(empleado, hoy(), { tipo: 'entrada', monto: 1_000, motivo: 'x' })).rejects.toThrow('ya está cerrada');
    const [mov] = (await leerCaja(empleado, hoy())).movimientos;
    await expect(anularMovimientoCaja(empleado, mov!.id)).rejects.toThrow('caja abierta');

    await reabrirCaja(dueno, hoy());
    await anularMovimientoCaja(empleado, mov!.id);
    await cerrarCaja(empleado, hoy(), 100_000);
    expect((await leerCaja(dueno, hoy())).diferencia).toBe(0);
    await expect(reabrirCaja(empleado, hoy())).rejects.toThrow('Sólo el dueño');
  });

  it('el empleado sólo toca la caja de hoy; la apertura sugerida es lo que se contó el último día', async () => {
    const ayer = sumarDias(hoy(), -1);
    await expect(abrirCaja(empleado, ayer, 1_000)).rejects.toThrow('otros días');
    await expect(leerCaja(empleado, ayer)).rejects.toThrow('otros días');
    await expect(abrirCaja(dueno, sumarDias(hoy(), 1), 1_000)).rejects.toThrow('todavía no llegó');
    await abrirCaja(dueno, sumarDias(hoy(), -3), 10_000);
    await cerrarCaja(dueno, sumarDias(hoy(), -3), 45_000);
    await abrirCaja(dueno, ayer, 45_000);
    expect(await leerCaja(empleado, hoy())).toMatchObject({ abierta: false, aperturaSugerida: 45_000, movimientos: [] });

    const historial = await historialCajas(dueno, sumarDias(hoy(), -7), hoy());
    expect(historial).toEqual([
      { dia: ayer, apertura: 45_000, contado: null, esperado: 45_000, diferencia: null },
      { dia: sumarDias(hoy(), -3), apertura: 10_000, contado: 45_000, esperado: 10_000, diferencia: 35_000 },
    ]);
    await expect(historialCajas(empleado, ayer, hoy())).rejects.toThrow('Sólo el dueño');
  });

  it('nadie de afuera toca la caja', async () => {
    const intruso = { ...otro, comercioId: dueno.comercioId };
    await expect(leerCaja(intruso, hoy())).rejects.toThrow();
    await expect(abrirCaja(intruso, hoy(), 1)).rejects.toThrow();
    await expect(cerrarCaja(intruso, hoy(), 1)).rejects.toThrow();
    await expect(dueno.backend.rpc('esperado_caja', { c: dueno.comercioId, dia: hoy() })).rejects.toThrow();
  });
});
