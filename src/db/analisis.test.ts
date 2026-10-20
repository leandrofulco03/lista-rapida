import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { calcularGanancia } from '../domain/analisis';
import { CONFIG_SUGERIDA } from '../domain/config';
import { diaDe, sumarDias } from '../domain/ventas';
import type { LineaTicket } from '../domain/ventas';
import { baseConMigraciones, usuarioNuevo } from '../nube/pruebas';
import {
  analisisVentas,
  anularVenta,
  crearComercio,
  crearInvitacion,
  guardarProducto,
  guardarRubro,
  registrarVenta,
  sinMovimiento,
  unirseConCodigo,
  ventasDelDia,
} from '.';
import type { Producto, Sesion } from '.';

let base: PGliteInterface;
let pg: PGliteInterface;
let dueno: Sesion;
let empleado: Sesion;
let yerba: Producto;
let coca: Producto;
let chicle: Producto;

beforeAll(async () => {
  base = await baseConMigraciones();
}, 60_000);

beforeEach(async () => {
  pg = await base.clone();
  const b = await usuarioNuevo(pg, 'dueno@prueba.com');
  // Vende con IVA incluido (como un monotributista): el IVA cuenta como costo.
  dueno = { backend: b, comercioId: await crearComercio(b, { ...CONFIG_SUGERIDA, nombreComercio: 'Kiosco', ventaIncluyeIva: true }) };
  const e = await usuarioNuevo(pg, 'empleado@prueba.com');
  await unirseConCodigo(e, (await crearInvitacion(dueno)).codigo, '');
  empleado = { backend: e, comercioId: dueno.comercioId };
  const almacen = await guardarRubro(dueno, { nombre: 'Almacén', recargoPct: null });
  const bebidas = await guardarRubro(dueno, { nombre: 'Bebidas', recargoPct: null });
  const datos = { recargoPct: null, ivaPct: 2100 };
  // Costo $1.000 + IVA 21% = $1.210; precio $1.573 → ganancia $363 (23,08%, el recargo de 30%).
  yerba = await guardarProducto(dueno, { ...datos, rubroId: almacen.id, codigoInterno: 'Y', descripcion: 'Yerba', costoActual: 100_000, precioVentaActual: 157_300 });
  coca = await guardarProducto(dueno, { ...datos, rubroId: bebidas.id, codigoInterno: 'C', descripcion: 'Coca', costoActual: 100_000, precioVentaActual: 157_300 });
  chicle = await guardarProducto(dueno, { ...datos, rubroId: null, codigoInterno: 'X', descripcion: 'Chicle', costoActual: 0, precioVentaActual: 10_000 });
});

const linea = (p: Producto, cantidad = 1): LineaTicket => ({ productoId: p.id, descripcion: p.descripcion, cantidad, precioUnitario: p.precioVentaActual });
const vender = (s: Sesion, lineas: LineaTicket[], fecha = new Date()) =>
  registrarVenta(s, { id: crypto.randomUUID(), fecha: fecha.toISOString(), medioPago: 'efectivo', lineas });
const hoy = () => diaDe(new Date());

describe('análisis de ventas', () => {
  it('ganancia con el IVA como costo, más vendidos, rubros y horas', async () => {
    await vender(empleado, [linea(yerba, 2), linea(chicle, 3)]);
    await vender(empleado, [linea(coca), { productoId: null, descripcion: 'Varios', cantidad: 1, precioUnitario: 5_000 }]);
    const anulada = await vender(empleado, [linea(coca, 10)]);
    await anularVenta(dueno, anulada.id);

    const d = await analisisVentas(dueno, sumarDias(hoy(), -6), hoy());
    // Con costo: 3 × 1.573 = 4.719; costo 3 × 1.210 = 3.630. Sin costo: chicles 300 + varios 50.
    expect(d.ganancia).toEqual({ ventasConCosto: 471_900, costo: 363_000, ventasSinCosto: 35_000 });
    const g = calcularGanancia(d.ganancia);
    expect(g.ganancia).toBe(108_900);
    expect(g.margen).toBeCloseTo(0.2308, 4);

    expect(d.productos.map((p) => [p.descripcion, p.unidades, p.importe, p.ganancia])).toEqual([
      ['Yerba', 2, 314_600, 72_600],
      ['Coca', 1, 157_300, 36_300],
      ['Chicle', 3, 30_000, null],
      ['Varios', 1, 5_000, null],
    ]);
    expect(d.rubros).toEqual([
      { rubro: 'Almacén', importe: 314_600 },
      { rubro: 'Bebidas', importe: 157_300 },
      { rubro: null, importe: 35_000 },
    ]);
    const ahora = new Date();
    const horaAr = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Argentina/Buenos_Aires', hour: '2-digit', hourCycle: 'h23' }).format(ahora));
    expect(d.horas).toEqual([{ diaSemana: expect.any(Number), hora: horaAr, importe: 506_900, ventas: 2 }]);
  });

  it('los costos de las ventas no se ven fuera del análisis, que es sólo del dueño', async () => {
    await vender(empleado, [linea(yerba)]);
    await expect(analisisVentas(empleado, hoy(), hoy())).rejects.toThrow('Sólo el dueño');
    await expect(sinMovimiento(empleado)).rejects.toThrow('Sólo el dueño');
    // Ni leyendo la tabla directo ni con la función interna.
    await expect(empleado.backend.rpc('lineas_con_costo', { c: dueno.comercioId, desde: hoy(), hasta: hoy() })).rejects.toThrow(/permission denied/);
    await expect(dueno.backend.rpc('lineas_con_costo', { c: dueno.comercioId, desde: hoy(), hasta: hoy() })).rejects.toThrow(/permission denied/);
    const id = (await empleado.backend.usuario())!.id;
    await pg.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id}', false);`);
    await expect(pg.query('select costo_unitario from public.venta_items')).rejects.toThrow(/permission denied/);
    await pg.exec('reset role');
    // Sus ventas del día las sigue viendo.
    expect(await ventasDelDia(empleado, hoy())).toHaveLength(1);
  });

  it('productos sin movimiento: nunca vendidos o sin ventas en los últimos días', async () => {
    await vender(empleado, [linea(yerba)]);
    await vender(empleado, [linea(coca)], new Date(Date.now() - 40 * 86_400_000));
    const lista = await sinMovimiento(dueno, 30);
    expect(lista.map((p) => [p.descripcion, p.ultimaVenta])).toEqual([
      ['Chicle', null],
      ['Coca', sumarDias(hoy(), -40)],
    ]);
  });
});
