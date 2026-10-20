import { describe, expect, it } from 'vitest';
import { armarMapaHoras, calcularGanancia, fechasDeRango, preciosAtrasados, principalesYOtros } from './analisis';
import { CONFIG_SUGERIDA } from './config';

describe('rangos', () => {
  it('7, 30 y 90 días incluyen hoy; el mes en curso y el pasado', () => {
    expect(fechasDeRango('7d', '2026-10-22')).toEqual({ desde: '2026-10-16', hasta: '2026-10-22' });
    expect(fechasDeRango('30d', '2026-10-22').desde).toBe('2026-09-23');
    expect(fechasDeRango('mes', '2026-10-22')).toEqual({ desde: '2026-10-01', hasta: '2026-10-22' });
    expect(fechasDeRango('mes-anterior', '2026-03-05')).toEqual({ desde: '2026-02-01', hasta: '2026-02-28' });
  });
});

it('ganancia y margen; sin ventas con costo no hay margen', () => {
  expect(calcularGanancia({ ventasConCosto: 1000, costo: 750, ventasSinCosto: 50 })).toEqual({ ventas: 1000, ganancia: 250, margen: 0.25, sinCosto: 50 });
  expect(calcularGanancia({ ventasConCosto: 0, costo: 0, ventasSinCosto: 50 }).margen).toBeNull();
});

it('los 5 principales y "Otros" con el resto del total', () => {
  const items = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((n, i) => ({ n, v: 70 - i * 10 }));
  const p = principalesYOtros(items, (x) => x.v, (x) => x.n, 300);
  expect(p.map((x) => [x.nombre, x.valor, x.resto])).toEqual([
    ['a', 70, false],
    ['b', 60, false],
    ['c', 50, false],
    ['d', 40, false],
    ['e', 30, false],
    ['Otros', 50, true],
  ]);
  expect(p.reduce((s, x) => s + x.parte, 0)).toBeCloseTo(1);
  expect(principalesYOtros(items.slice(0, 2), (x) => x.v, (x) => x.n, 130).map((x) => x.nombre)).toEqual(['a', 'b']);
});

it('mapa de horas: de la primera a la última hora con ventas', () => {
  const m = armarMapaHoras([
    { diaSemana: 0, hora: 9, importe: 100, ventas: 1 },
    { diaSemana: 5, hora: 12, importe: 400, ventas: 3 },
  ])!;
  expect(m.horas).toEqual([9, 10, 11, 12]);
  expect(m.celdas[0]![0]).toEqual({ importe: 100, ventas: 1 });
  expect(m.celdas[5]![3]).toEqual({ importe: 400, ventas: 3 });
  expect(m.celdas[3]![1]).toEqual({ importe: 0, ventas: 0 });
  expect(m.maximo).toBe(400);
  expect(armarMapaHoras([])).toBeNull();
});

describe('precios atrasados', () => {
  // Recargo 30%, redondeo a $10, venta con IVA: costo $1.000 → sugerido $1.580; lo que cuesta con IVA: $1.210.
  const config = { ...CONFIG_SUGERIDA, nombreComercio: 'X' };
  const ahora = new Date('2026-10-22T12:00:00Z');
  const producto = (id: string, precio: number, extra: object = {}) => ({
    id,
    descripcion: id,
    rubroId: null,
    recargoPct: null,
    ivaPct: 2100,
    costoActual: 100_000,
    precioVentaActual: precio,
    actualizado: '2026-10-20T00:00:00Z',
    ...extra,
  });

  it('marca pérdida, precio bajo el recargo y mucho tiempo sin actualizar; los más graves primero', () => {
    const lista = preciosAtrasados(
      [
        producto('bien', 158_000),
        producto('casi', 155_000), // 1,9% abajo: dentro de la tolerancia
        producto('bajo', 140_000),
        producto('perdida', 120_000),
        producto('viejo', 158_000, { actualizado: '2026-08-01T00:00:00Z' }),
        producto('sin costo', 1, { costoActual: 0 }),
      ],
      new Map(),
      config,
      ahora,
    );
    expect(lista.map((p) => [p.id, p.motivo, p.sugerido])).toEqual([
      ['perdida', 'perdida', 158_000],
      ['bajo', 'bajo-recargo', 158_000],
      ['viejo', 'sin-actualizar', 158_000],
    ]);
    expect(lista[1]!.falta).toBeCloseTo(0.1139, 3);
    expect(lista[2]!.diasSinActualizar).toBe(82);
  });

  it('usa el recargo del rubro', () => {
    const lista = preciosAtrasados([producto('p', 158_000, { rubroId: 'r' })], new Map([['r', 5000]]), config, ahora);
    // 1.210 × 1,5 = 1.815 → $1.820
    expect(lista).toEqual([expect.objectContaining({ id: 'p', motivo: 'bajo-recargo', sugerido: 182_000 })]);
  });
});
