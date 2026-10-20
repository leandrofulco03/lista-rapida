import { describe, expect, it } from 'vitest';
import {
  agregarProducto,
  agregarVarios,
  articulos,
  calcularKpis,
  cambiarCantidad,
  diaDe,
  leerCantidad,
  nombrePeriodo,
  periodoAnterior,
  periodoDe,
  periodoSiguiente,
  problemaTicket,
  sumarDias,
  textoVariacion,
  totalTicket,
  variacionKpi,
} from './ventas';

const yerba = { id: 'y', descripcion: 'Yerba 1 kg', precioVentaActual: 450_000 };
const queso = { id: 'q', descripcion: 'Queso por kg', precioVentaActual: 1_200_000 };

describe('ticket', () => {
  it('suma productos, repite sumando unidades, y calcula el total con cantidades con decimales', () => {
    let t = agregarProducto([], yerba);
    t = agregarProducto(t, yerba);
    t = agregarProducto(t, queso);
    t = cambiarCantidad(t, 1, 0.35);
    t = agregarVarios(t, 50_000, '  ');
    expect(t.map((l) => [l.descripcion, l.cantidad])).toEqual([
      ['Yerba 1 kg', 2],
      ['Queso por kg', 0.35],
      ['Varios', 1],
    ]);
    // 2 × 4.500 + 0,35 × 12.000 + 500 = 9.000 + 4.200 + 500
    expect(totalTicket(t)).toBe(1_370_000);
    expect(articulos(t)).toBe(3.35);
    expect(cambiarCantidad(t, 0, 0)).toHaveLength(2);
    expect(() => agregarVarios(t, 0)).toThrow('mayor que cero');
  });

  it('lee cantidades escritas a mano', () => {
    expect(leerCantidad('2')).toBe(2);
    expect(leerCantidad('0,5')).toBe(0.5);
    expect(leerCantidad('1.250')).toBe(1.25);
    expect(leerCantidad('0,0001')).toBeNull();
    expect(leerCantidad('-1')).toBeNull();
    expect(leerCantidad('0')).toBeNull();
    expect(leerCantidad('abc')).toBeNull();
  });

  it('no se cobra vacío, en cero ni sin medio de pago', () => {
    expect(problemaTicket([], 'efectivo')).toBe('Agregá al menos un producto.');
    expect(problemaTicket(agregarProducto([], yerba), null)).toBe('Elegí cómo pagó.');
    expect(problemaTicket(agregarProducto([], { ...yerba, precioVentaActual: 0 }), 'efectivo')).toBe('El total tiene que ser mayor que cero.');
    expect(problemaTicket(agregarProducto([], yerba), 'qr')).toBeNull();
  });
});

describe('días y períodos (Argentina)', () => {
  it('el día es el de Argentina, no el de UTC', () => {
    expect(diaDe(new Date('2026-10-21T02:30:00Z'))).toBe('2026-10-20'); // 23:30 del 20 en Argentina
    expect(diaDe(new Date('2026-10-21T03:30:00Z'))).toBe('2026-10-21');
  });

  it('semana de lunes a domingo, mes completo, y anterior y siguiente', () => {
    expect(periodoDe('semana', '2026-10-22')).toEqual({ tipo: 'semana', desde: '2026-10-19', hasta: '2026-10-25' });
    expect(periodoDe('semana', '2026-10-19').desde).toBe('2026-10-19');
    expect(periodoDe('semana', '2026-10-25').desde).toBe('2026-10-19');
    expect(periodoDe('mes', '2026-02-10')).toEqual({ tipo: 'mes', desde: '2026-02-01', hasta: '2026-02-28' });
    expect(periodoAnterior(periodoDe('mes', '2026-01-15'))).toEqual({ tipo: 'mes', desde: '2025-12-01', hasta: '2025-12-31' });
    expect(periodoSiguiente(periodoDe('dia', '2026-12-31'))).toEqual({ tipo: 'dia', desde: '2027-01-01', hasta: '2027-01-01' });
    expect(sumarDias('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('nombres de los períodos', () => {
    const hoy = '2026-10-22';
    expect(nombrePeriodo(periodoDe('dia', hoy), hoy)).toBe('Hoy');
    expect(nombrePeriodo(periodoDe('dia', '2026-10-21'), hoy)).toBe('Ayer');
    expect(nombrePeriodo(periodoDe('dia', '2026-10-14'), hoy)).toBe('miércoles 14 de octubre');
    expect(nombrePeriodo(periodoDe('semana', hoy), hoy)).toBe('Semana del 19 al 25 de octubre');
    expect(nombrePeriodo(periodoDe('semana', '2026-10-01'), hoy)).toBe('Semana del 28 de septiembre al 4 de octubre');
    expect(nombrePeriodo(periodoDe('mes', hoy), hoy)).toBe('Octubre de 2026');
  });
});

describe('KPIs', () => {
  it('venta total con y sin detalle; promedio y artículos sólo con tickets', () => {
    const k = calcularKpis({
      totalTickets: 300_000,
      tickets: 4,
      articulos: 10,
      totalSinDetalle: 100_000,
      diasSinDetalle: 1,
      porMedio: [
        { medio: 'efectivo', total: 100_000 },
        { medio: 'qr', total: 300_000 },
        { medio: 'debito', total: 0 },
      ],
      porDia: [],
    });
    expect(k).toMatchObject({ ventaTotal: 400_000, tickets: 4, ticketPromedio: 75_000, articulos: 10, articulosPorTicket: 2.5 });
    expect(k.porMedio).toEqual([
      { medio: 'qr', total: 300_000, porcentaje: 0.75 },
      { medio: 'efectivo', total: 100_000, porcentaje: 0.25 },
    ]);
    const vacio = calcularKpis({ totalTickets: 0, tickets: 0, articulos: 0, totalSinDetalle: 0, diasSinDetalle: 0, porMedio: [], porDia: [] });
    expect(vacio).toMatchObject({ ventaTotal: 0, ticketPromedio: null, articulosPorTicket: null });
  });

  it('variación contra el período anterior', () => {
    expect(textoVariacion(variacionKpi(112, 100))).toBe('+12%');
    expect(textoVariacion(variacionKpi(97, 100))).toBe('−3%');
    expect(textoVariacion(variacionKpi(100, 100))).toBe('igual');
    expect(variacionKpi(100, 0)).toBeNull();
    expect(variacionKpi(null, 10)).toBeNull();
  });
});
