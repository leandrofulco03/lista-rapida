import 'fake-indexeddb/auto';
import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import { calcularKpis, diaDe, sumarDias } from '../domain/ventas';
import type { LineaTicket, MedioPago } from '../domain/ventas';
import type { Backend } from '../nube/backend';
import { baseConMigraciones, contar, usuarioNuevo } from '../nube/pruebas';
import {
  anularVenta,
  BaseDispositivo,
  crearComercio,
  crearInvitacion,
  encolarVenta,
  guardarProducto,
  guardarSinDetalle,
  leerSinDetalle,
  masVendidos,
  productosParaVender,
  registrarVenta,
  resumenVentas,
  sincronizar,
  unirseConCodigo,
  ventasDelDia,
  ventasPendientes,
} from '.';
import type { Producto, Sesion, VentaNueva } from '.';

let base: PGliteInterface;
let pg: PGliteInterface;
let dueno: Sesion;
let empleado: Sesion;
let yerba: Producto;
let queso: Producto;

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
  const datos = { rubroId: null, recargoPct: null, ivaPct: 2100 };
  yerba = await guardarProducto(dueno, { ...datos, codigoInterno: 'Y', codigoBarras: '7790001', descripcion: 'Yerba 1 kg', costoActual: 300_000, precioVentaActual: 450_000 });
  queso = await guardarProducto(dueno, { ...datos, codigoInterno: 'Q', descripcion: 'Queso por kg', costoActual: 800_000, precioVentaActual: 1_200_000 });
});

const linea = (p: Producto, cantidad = 1): LineaTicket => ({ productoId: p.id, descripcion: p.descripcion, cantidad, precioUnitario: p.precioVentaActual });
const venta = (lineas: LineaTicket[], medioPago: MedioPago = 'efectivo', fecha = new Date()): VentaNueva => ({
  id: crypto.randomUUID(),
  fecha: fecha.toISOString(),
  medioPago,
  lineas,
});
const hoy = () => diaDe(new Date());

describe('vender', () => {
  it('el empleado ve los productos para vender sin costo, y sus ventas guardan el costo del momento', async () => {
    const productos = await productosParaVender(empleado);
    expect(productos.map((p) => [p.descripcion, p.precioVentaActual, p.codigoBarras])).toEqual([
      ['Queso por kg', 1_200_000, null],
      ['Yerba 1 kg', 450_000, '7790001'],
    ]);
    expect(productos[0]).not.toHaveProperty('costoActual');

    const v = venta([linea(yerba, 2), linea(queso, 0.25), { productoId: null, descripcion: 'Varios', cantidad: 1, precioUnitario: 15_000 }], 'qr');
    // 2 × 4.500 + 0,25 × 12.000 + 150
    expect(await registrarVenta(empleado, v)).toEqual({ id: v.id, total: 1_215_000, dia: hoy() });
    // Reintentar (sin conexión, por ejemplo) no la duplica.
    await registrarVenta(empleado, v);
    expect(await contar(pg, 'ventas')).toBe(1);
    const items = (await pg.query('select descripcion, cantidad::float as cantidad, costo_unitario, subtotal from venta_items order by descripcion')).rows;
    expect(items).toEqual([
      { descripcion: 'Queso por kg', cantidad: 0.25, costo_unitario: 800_000, subtotal: 300_000 },
      { descripcion: 'Varios', cantidad: 1, costo_unitario: null, subtotal: 15_000 },
      { descripcion: 'Yerba 1 kg', cantidad: 2, costo_unitario: 300_000, subtotal: 900_000 },
    ]);
  });

  it('rechaza ventas vacías, sin medio, con cantidades raras o de alguien de afuera', async () => {
    await expect(registrarVenta(empleado, venta([]))).rejects.toThrow('al menos un producto');
    await expect(registrarVenta(empleado, { ...venta([linea(yerba)]), medioPago: 'bitcoin' as MedioPago })).rejects.toThrow('cómo pagó');
    await expect(registrarVenta(empleado, venta([linea(yerba, -1)]))).rejects.toThrow('no es válido');
    await expect(registrarVenta(empleado, venta([linea(yerba, 0.0001)]))).rejects.toThrow('no es válido');
    await expect(registrarVenta(empleado, venta([{ ...linea(yerba), precioUnitario: 0 }]))).rejects.toThrow('mayor que cero');
    const intruso = await usuarioNuevo(pg, 'otro@prueba.com');
    await expect(registrarVenta({ backend: intruso, comercioId: dueno.comercioId }, venta([linea(yerba)]))).rejects.toThrow('No sos parte');
    expect(await productosParaVender({ backend: intruso, comercioId: dueno.comercioId })).toEqual([]);
    expect(await contar(pg, 'ventas')).toBe(0);
  });

  it('el empleado ve sus tickets de hoy; el dueño ve todos', async () => {
    await registrarVenta(empleado, venta([linea(yerba)]));
    await registrarVenta(dueno, venta([linea(queso)], 'debito'));
    const delEmpleado = await ventasDelDia(empleado, hoy());
    expect(delEmpleado.map((t) => [t.total, t.vendedor, t.propia])).toEqual([[450_000, 'Juan', true]]);
    expect(delEmpleado[0]!.lineas).toEqual([{ descripcion: 'Yerba 1 kg', cantidad: 1, precioUnitario: 450_000, subtotal: 450_000 }]);
    expect((await ventasDelDia(dueno, hoy())).map((t) => t.vendedor).sort()).toEqual(['Juan', 'dueno@prueba.com']);
  });

  it('los más vendidos de los últimos 30 días, sin contar las anuladas', async () => {
    await registrarVenta(empleado, venta([linea(yerba, 3)]));
    const anulada = venta([linea(queso, 10)]);
    await registrarVenta(empleado, anulada);
    await registrarVenta(empleado, venta([linea(queso, 1)]));
    expect(await masVendidos(empleado)).toEqual([queso.id, yerba.id]);
    await anularVenta(empleado, anulada.id);
    expect(await masVendidos(empleado)).toEqual([yerba.id, queso.id]);
  });
});

describe('anular', () => {
  it('el empleado anula sus ventas de hoy, no las de otros ni las de otro día; el dueño, cualquiera', async () => {
    const suya = venta([linea(yerba)]);
    const delDueno = venta([linea(yerba)]);
    await registrarVenta(empleado, suya);
    await registrarVenta(dueno, delDueno);
    await expect(anularVenta(empleado, delDueno.id)).rejects.toThrow('Sólo podés anular tus ventas de hoy');
    await anularVenta(empleado, suya.id);
    await expect(anularVenta(empleado, suya.id)).rejects.toThrow('ya estaba anulada');
    expect((await ventasDelDia(empleado, hoy()))[0]!.anulada).toBe(true);

    const vieja = venta([linea(queso)], 'efectivo', new Date(Date.now() - 3 * 86_400_000));
    await registrarVenta(empleado, vieja);
    await expect(anularVenta(empleado, vieja.id)).rejects.toThrow('Sólo podés anular tus ventas de hoy');
    await anularVenta(dueno, vieja.id);
    await anularVenta(dueno, delDueno.id);
  });
});

describe('total del día y resumen', () => {
  it('sólo el dueño carga el total sin detalle; se reemplaza y se lee', async () => {
    const ayer = sumarDias(hoy(), -1);
    await expect(guardarSinDetalle(empleado, ayer, { efectivo: 100 })).rejects.toThrow('Sólo el dueño');
    await expect(guardarSinDetalle(dueno, sumarDias(hoy(), 2), { efectivo: 100 })).rejects.toThrow('todavía no llegó');
    await expect(guardarSinDetalle(dueno, ayer, { efectivo: -1 })).rejects.toThrow('no es válido');
    await guardarSinDetalle(dueno, ayer, { efectivo: 5_000_000, qr: 2_000_000 });
    await guardarSinDetalle(dueno, ayer, { efectivo: 6_000_000, qr: 0 });
    expect(await leerSinDetalle(dueno, ayer)).toEqual({ efectivo: 6_000_000 });
    expect(await leerSinDetalle(empleado, ayer)).toEqual({});
  });

  it('resumen del período: tickets más lo cargado sin detalle, sin anuladas', async () => {
    const ayer = sumarDias(hoy(), -1);
    await registrarVenta(empleado, venta([linea(yerba, 2)], 'efectivo'));
    await registrarVenta(empleado, venta([linea(queso, 0.5)], 'qr'));
    const anulada = venta([linea(queso, 5)], 'qr');
    await registrarVenta(empleado, anulada);
    await anularVenta(dueno, anulada.id);
    await guardarSinDetalle(dueno, ayer, { efectivo: 1_000_000 });

    await expect(resumenVentas(empleado, ayer, hoy())).rejects.toThrow('Sólo el dueño');
    const datos = await resumenVentas(dueno, ayer, hoy());
    expect(datos).toEqual({
      totalTickets: 1_500_000,
      tickets: 2,
      articulos: 2.5,
      totalSinDetalle: 1_000_000,
      diasSinDetalle: 1,
      porMedio: [
        { medio: 'efectivo', total: 1_900_000 },
        { medio: 'qr', total: 600_000 },
      ],
      porDia: [
        { dia: ayer, total: 1_000_000 },
        { dia: hoy(), total: 1_500_000 },
      ],
    });
    expect(calcularKpis(datos)).toMatchObject({ ventaTotal: 2_500_000, ticketPromedio: 750_000, articulosPorTicket: 1.3 });
  });
});

describe('sin conexión', () => {
  /** Un backend que no llega al servidor. */
  const sinInternet = (b: Backend): Backend => ({
    ...b,
    rpc: async () => {
      throw new Error('No hay conexión con el servidor. Revisá internet y probá de nuevo.');
    },
  });

  it('las ventas quedan en el dispositivo y se mandan cuando vuelve la conexión, sin duplicarse', async () => {
    const dispositivo = new BaseDispositivo(`prueba-cola-${crypto.randomUUID()}`);
    const v1 = venta([linea(yerba)], 'efectivo', new Date(Date.now() - 60_000));
    const v2 = venta([linea(queso)]);
    await encolarVenta(dispositivo, empleado.comercioId, v2);
    await encolarVenta(dispositivo, empleado.comercioId, v1);

    const desconectado = { ...empleado, backend: sinInternet(empleado.backend) };
    expect(await sincronizar(dispositivo, desconectado)).toEqual({ enviadas: 0, pendientes: 2, conError: 0, sinConexion: true });

    expect(await sincronizar(dispositivo, empleado)).toEqual({ enviadas: 2, pendientes: 0, conError: 0, sinConexion: false });
    expect(await contar(pg, 'ventas')).toBe(2);
    // La más vieja se mandó primero.
    expect((await ventasDelDia(empleado, hoy())).map((t) => t.id)).toEqual([v2.id, v1.id]);
    await encolarVenta(dispositivo, empleado.comercioId, v1);
    await sincronizar(dispositivo, empleado);
    expect(await contar(pg, 'ventas')).toBe(2);
    await dispositivo.delete();
  });

  it('una venta que la base rechaza queda marcada con el error y no frena a las demás', async () => {
    const dispositivo = new BaseDispositivo(`prueba-cola-${crypto.randomUUID()}`);
    const mala = venta([]);
    const buena = venta([linea(yerba)]);
    await encolarVenta(dispositivo, empleado.comercioId, mala);
    await encolarVenta(dispositivo, empleado.comercioId, buena);
    expect(await sincronizar(dispositivo, empleado)).toMatchObject({ enviadas: 1, pendientes: 1, conError: 1 });
    expect((await ventasPendientes(dispositivo, empleado.comercioId))[0]).toMatchObject({ id: mala.id, error: 'Agregá al menos un producto.', intentos: 1 });
    await dispositivo.delete();
  });
});
