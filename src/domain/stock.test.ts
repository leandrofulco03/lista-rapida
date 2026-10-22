import { describe, expect, it } from 'vitest';
import { calcularResultado, mesDe, nombreMes, sumarMeses } from './gastos';
import { porProveedor, sugerirPedido, textoAlcance, textoPedido } from './stock';

const p = (descripcion: string, cantidad: number, vendido28: number, proveedor: string | null = null) => ({
  productoId: descripcion,
  descripcion,
  cantidad,
  vendido28,
  proveedor,
});

describe('sugerencia de pedido', () => {
  it('pide lo que falta para cubrir los días elegidos, del que se acaba antes al que dura más', () => {
    const lista = sugerirPedido(
      [
        p('Yerba', 4, 28), // 1 por día: para 7 días faltan 3
        p('Coca', 0, 56), // 2 por día, se terminó: 14
        p('Fernet', 10, 14), // 0,5 por día: alcanza
        p('Pilas', 0, 0), // no se vende: no hay con qué calcular
        p('Queso', -1, 7), // negativo cuenta como cero: 0,25 × 7 = 1,75 → 2
      ],
      7,
    );
    expect(lista.map((s) => [s.descripcion, s.pedir])).toEqual([
      ['Coca', 14],
      ['Queso', 2],
      ['Yerba', 3],
    ]);
    expect(sugerirPedido([p('Fernet', 10, 14)], 30)[0]!.pedir).toBe(5);
  });

  it('agrupa por proveedor (sin proveedor al final) y arma el texto del pedido', () => {
    const grupos = porProveedor([p('A', 0, 1, 'Zeta'), p('B', 0, 1, null), p('C', 0, 1, 'Alfa'), p('D', 0, 1, 'Zeta')]);
    expect(grupos.map((g) => [g.proveedor, g.items.map((i) => i.descripcion)])).toEqual([
      ['Alfa', ['C']],
      ['Zeta', ['A', 'D']],
      [null, ['B']],
    ]);
    expect(textoPedido('Kiosco', [{ descripcion: 'Yerba', pedir: 3 }])).toBe('Hola, te paso el pedido de Kiosco:\n- 3 × Yerba\n¡Gracias!');
  });

  it('cuánto alcanza', () => {
    expect(textoAlcance(0, 1)).toBe('Se terminó');
    expect(textoAlcance(5, 0)).toBe('Sin ventas en 4 semanas');
    expect(textoAlcance(0.5, 1)).toBe('Alcanza para menos de un día');
    expect(textoAlcance(1.5, 1)).toBe('Alcanza para 1 día');
    expect(textoAlcance(10, 2)).toBe('Alcanza para 5 días');
  });
});

describe('resultado del mes', () => {
  it('neto = ganancia de lo vendido con costo − gastos; lo vendido sin costo se informa aparte', () => {
    expect(calcularResultado({ ventas: 1_500_000, ventasConCosto: 900_000, costo: 600_000, gastos: 200_000 })).toEqual({
      ventas: 1_500_000,
      ganancia: 300_000,
      gastos: 200_000,
      neto: 100_000,
      sinCosto: 600_000,
    });
  });

  it('meses', () => {
    expect(mesDe('2026-10-22')).toBe('2026-10-01');
    expect(sumarMeses('2026-01-01', -1)).toBe('2025-12-01');
    expect(sumarMeses('2026-11-01', 3)).toBe('2027-02-01');
    expect(nombreMes('2026-10-01')).toBe('Octubre de 2026');
    expect(nombreMes('2026-10-01', true)).toBe('oct');
  });
});
