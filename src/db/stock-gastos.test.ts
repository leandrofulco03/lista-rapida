import type { PGliteInterface } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from '../domain/config';
import { mesDe, sumarMeses } from '../domain/gastos';
import { diaDe } from '../domain/ventas';
import type { LineaTicket } from '../domain/ventas';
import { baseConMigraciones, usuarioNuevo } from '../nube/pruebas';
import {
  ajustarStock,
  anularVenta,
  archivarGasto,
  crearComercio,
  crearInvitacion,
  crearProveedor,
  dejarStock,
  guardarGasto,
  guardarGastosMes,
  guardarProducto,
  guardarSinDetalle,
  guardarVinculos,
  ingresoStock,
  leerGastos,
  listarStock,
  movimientosDeStock,
  registrarVenta,
  resultadoMeses,
  unirseConCodigo,
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
  // Vende sin IVA: la ganancia es precio − costo.
  dueno = { backend: b, comercioId: await crearComercio(b, { ...CONFIG_SUGERIDA, nombreComercio: 'Kiosco', ventaIncluyeIva: false }) };
  const e = await usuarioNuevo(pg, 'empleado@prueba.com');
  await unirseConCodigo(e, (await crearInvitacion(dueno)).codigo, 'Juan');
  empleado = { backend: e, comercioId: dueno.comercioId };
  const datos = { rubroId: null, recargoPct: null, ivaPct: 2100 };
  yerba = await guardarProducto(dueno, { ...datos, codigoInterno: 'Y', descripcion: 'Yerba 1 kg', costoActual: 300_000, precioVentaActual: 450_000 });
  queso = await guardarProducto(dueno, { ...datos, codigoInterno: 'Q', descripcion: 'Queso por kg', costoActual: 800_000, precioVentaActual: 1_200_000 });
});

const linea = (p: Producto, cantidad = 1): LineaTicket => ({ productoId: p.id, descripcion: p.descripcion, cantidad, precioUnitario: p.precioVentaActual });
const venta = (lineas: LineaTicket[]): VentaNueva => ({ id: crypto.randomUUID(), fecha: new Date().toISOString(), medioPago: 'efectivo', lineas });
const hoy = () => diaDe(new Date());

describe('stock', () => {
  it('sólo los productos que llevan stock se descuentan al vender, y vuelven al anular', async () => {
    await ajustarStock(dueno, [{ productoId: yerba.id, cantidad: 10 }]);
    const v = venta([linea(yerba, 2), linea(yerba, 1), linea(queso, 0.5)]);
    await registrarVenta(empleado, v);
    // Reintentar la venta no descuenta dos veces.
    await registrarVenta(empleado, v);
    let [y] = await listarStock(dueno);
    expect(y).toMatchObject({ descripcion: 'Yerba 1 kg', cantidad: 7, vendido28: 3, proveedor: null });
    expect(await listarStock(dueno)).toHaveLength(1);

    await anularVenta(empleado, v.id);
    [y] = await listarStock(dueno);
    expect(y!.cantidad).toBe(10);
    expect(y!.vendido28).toBe(0);
    expect((await movimientosDeStock(dueno, yerba.id)).map((m) => [m.tipo, m.cantidad])).toEqual([
      ['anulacion', 3],
      ['venta', -3],
      ['inicio', 10],
    ]);
  });

  it('llegó mercadería suma (y empieza a llevar stock); contar deja lo contado; puede quedar negativo', async () => {
    await ingresoStock(dueno, [{ productoId: queso.id, cantidad: 2.5 }], 'Remito 123');
    await ingresoStock(dueno, [{ productoId: queso.id, cantidad: 1 }]);
    await registrarVenta(empleado, venta([linea(queso, 4)]));
    expect((await listarStock(dueno))[0]!.cantidad).toBe(-0.5);
    await ajustarStock(dueno, [{ productoId: queso.id, cantidad: 0 }], 'Conteo');
    expect((await listarStock(dueno))[0]!.cantidad).toBe(0);
    expect((await movimientosDeStock(dueno, queso.id)).map((m) => [m.tipo, m.cantidad, m.nota])).toEqual([
      ['ajuste', 0.5, 'Conteo'],
      ['venta', -4, null],
      ['ingreso', 1, null],
      ['ingreso', 2.5, 'Remito 123'],
    ]);
    await dejarStock(dueno, queso.id);
    expect(await listarStock(dueno)).toEqual([]);
  });

  it('valida las cantidades y es sólo del dueño', async () => {
    await expect(ingresoStock(dueno, [{ productoId: yerba.id, cantidad: 0 }])).rejects.toThrow('no es válida');
    await expect(ingresoStock(dueno, [{ productoId: yerba.id, cantidad: -1 }])).rejects.toThrow('no es válida');
    await expect(ajustarStock(dueno, [{ productoId: crypto.randomUUID(), cantidad: 1 }])).rejects.toThrow('no es válida');
    await expect(ajustarStock(dueno, [])).rejects.toThrow('no es válida');
    await expect(listarStock(empleado)).rejects.toThrow('Sólo el dueño');
    await expect(ingresoStock(empleado, [{ productoId: yerba.id, cantidad: 1 }])).rejects.toThrow('Sólo el dueño');
  });

  it('muestra un proveedor que trae el producto', async () => {
    const { id: proveedor } = await crearProveedor(dueno, 'El Sol', false);
    await guardarVinculos(dueno, proveedor, [{ codigo: 'X', descripcion: 'Yerba', productoId: yerba.id }]);
    await ajustarStock(dueno, [{ productoId: yerba.id, cantidad: 1 }]);
    expect((await listarStock(dueno))[0]!.proveedor).toBe('El Sol');
  });
});

describe('gastos y resultado', () => {
  it('cada mes tiene sus montos; se propone lo del mes anterior', async () => {
    const mes = mesDe(hoy());
    const antes = sumarMeses(mes, -1);
    const alquiler = crypto.randomUUID();
    const luz = crypto.randomUUID();
    await guardarGasto(dueno, alquiler, ' Alquiler ');
    await guardarGasto(dueno, luz, 'Luz');
    await expect(guardarGasto(dueno, crypto.randomUUID(), 'alquiler')).rejects.toThrow('Ya hay un gasto');
    await guardarGastosMes(dueno, antes, { [alquiler]: 30_000_000, [luz]: 2_000_000 });
    await guardarGastosMes(dueno, mes, { [alquiler]: 32_000_000 });

    expect(await leerGastos(dueno, mes)).toEqual([
      { id: alquiler, nombre: 'Alquiler', archivado: false, monto: 32_000_000, montoAnterior: 30_000_000 },
      { id: luz, nombre: 'Luz', archivado: false, monto: null, montoAnterior: 2_000_000 },
    ]);
    // Cero lo saca.
    await guardarGastosMes(dueno, mes, { [alquiler]: 0 });
    expect((await leerGastos(dueno, mes))[0]!.monto).toBeNull();

    // Archivado no aparece, salvo en los meses en que tuvo monto.
    await archivarGasto(dueno, luz, true);
    expect((await leerGastos(dueno, mes)).map((g) => g.nombre)).toEqual(['Alquiler']);
    expect((await leerGastos(dueno, antes)).map((g) => [g.nombre, g.archivado])).toEqual([
      ['Alquiler', false],
      ['Luz', true],
    ]);
    await expect(guardarGastosMes(dueno, mes, { [crypto.randomUUID()]: 1 })).rejects.toThrow('no es válido');
    await expect(guardarGastosMes(dueno, mes, { [alquiler]: -1 })).rejects.toThrow('no es válido');
    await expect(leerGastos(empleado, mes)).rejects.toThrow('Sólo el dueño');
  });

  it('resultado del mes: ventas, ganancia de lo vendido con costo y gastos', async () => {
    const mes = mesDe(hoy());
    // 2 yerbas: 9.000 vendido, 6.000 de costo. Un "Varios" de 1.000 y 5.000 de total del día, sin costo.
    await registrarVenta(empleado, venta([linea(yerba, 2), { productoId: null, descripcion: 'Varios', cantidad: 1, precioUnitario: 100_000 }]));
    await guardarSinDetalle(dueno, hoy(), { efectivo: 500_000 });
    const gasto = crypto.randomUUID();
    await guardarGasto(dueno, gasto, 'Luz');
    await guardarGastosMes(dueno, mes, { [gasto]: 200_000 });

    const meses = await resultadoMeses(dueno, sumarMeses(mes, -1), mes);
    expect(meses).toEqual([
      { mes: sumarMeses(mes, -1), ventas: 0, ventasConCosto: 0, costo: 0, gastos: 0 },
      { mes, ventas: 1_500_000, ventasConCosto: 900_000, costo: 600_000, gastos: 200_000 },
    ]);
    await expect(resultadoMeses(empleado, mes, mes)).rejects.toThrow('Sólo el dueño');
  });
});
