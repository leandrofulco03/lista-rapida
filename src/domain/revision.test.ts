import { describe, expect, it } from 'vitest';
import { CONFIG_SUGERIDA } from './config';
import type { LineaLista } from './lineaLista';
import { aprobarTodo, armarRevision, avisoPrecio, costoNeto, decisionValida, evaluarPrecioManual, piso, variacion } from './revision';
import type { DatosRevision, ProductoRevision } from './revision';

const config = { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén' }; // recargo 30%, redondeo a $10, venta con IVA

const linea = (fila: number, costo: number, extra: Partial<LineaLista> = {}): LineaLista => ({
  codigo: `C${fila}`,
  descripcion: `Producto ${fila}`,
  presentacion: null,
  costo,
  ivaIncluido: null,
  filaOrigen: fila,
  ...extra,
});

const producto = (id: number, costoActual: number, extra: Partial<ProductoRevision> = {}): ProductoRevision => ({
  id,
  descripcion: `Producto ${id}`,
  rubroId: null,
  recargoPct: null,
  ivaPct: 2100,
  costoActual,
  precioVentaActual: 0,
  ...extra,
});

function revisar(lineas: { linea: LineaLista; productoId: number | null }[], productos: ProductoRevision[], extra: Partial<DatosRevision> = {}) {
  return armarRevision({
    lineas,
    productos: new Map(productos.map((p) => [p.id, p])),
    recargosRubro: new Map(),
    vinculadosAntes: new Set(),
    listaIncluyeIva: false,
    descuentos: [],
    config,
    ...extra,
  });
}

describe('costoNeto', () => {
  it('aplica descuentos en cascada y saca el IVA si la lista lo incluye', () => {
    expect(costoNeto(100_000, [], false, 2100)).toBe(100_000);
    expect(costoNeto(100_000, [1000, 500], false, 2100)).toBe(85_500);
    expect(costoNeto(121_000, [], true, 2100)).toBe(100_000);
    expect(costoNeto(100_000, [], true, 2100)).toBe(82_645); // 826,446… → redondeado
  });
});

describe('variacion', () => {
  it('en centésimos de punto, con signo', () => {
    expect(variacion(100_000, 115_000)).toBe(1500);
    expect(variacion(100_000, 90_000)).toBe(-1000);
    expect(variacion(300, 400)).toBe(3333);
    expect(variacion(0, 100)).toBeNull();
  });
});

describe('armarRevision', () => {
  it('calcula el precio sugerido con F08 y separa los que no cambian', () => {
    const r = revisar(
      [
        { linea: linea(1, 110_000), productoId: 1 },
        { linea: linea(2, 50_000), productoId: 2 },
      ],
      [producto(1, 100_000, { precioVentaActual: 157_300 }), producto(2, 50_000)],
    );
    // 1100 · 1,21 · 1,30 = 1730,30 → $1740
    expect(r.cambios).toEqual([
      expect.objectContaining({ productoId: 1, costoNuevo: 110_000, precioSugerido: 174_000, precioAnterior: 157_300, variacion: 1000, tipo: 'sube', resaltado: false, individual: false }),
    ]);
    expect(r.sinCambios.map((c) => c.productoId)).toEqual([2]);
  });

  it('usa el recargo del producto, si no el del rubro, si no el general', () => {
    const r = revisar(
      [
        { linea: linea(1, 100_000), productoId: 1 },
        { linea: linea(2, 100_000), productoId: 2 },
      ],
      [producto(1, 90_000, { recargoPct: 5000 }), producto(2, 90_000, { rubroId: 7 })],
      { recargosRubro: new Map([[7, 1000]]) },
    );
    expect(r.cambios.map((c) => c.precioSugerido)).toEqual([182_000, 134_000]); // 1815 → 1820; 1331 → 1340
  });

  it('el IVA del título del precio manda sobre lo que se dijo del proveedor', () => {
    const r = revisar([{ linea: linea(1, 121_000, { ivaIncluido: true }), productoId: 1 }], [producto(1, 90_000)]);
    expect(r.cambios[0]).toMatchObject({ costoNuevo: 100_000, precioSugerido: 158_000 }); // 1210 · 1,30 = 1573 → $1580
  });

  it('resalta más del 15%, deja afuera de "aprobar todo" más del 50% y el costo cero, y ordena por variación', () => {
    const r = revisar(
      [
        { linea: linea(1, 105_000), productoId: 1 }, // +5%
        { linea: linea(2, 120_000), productoId: 2 }, // +20%
        { linea: linea(3, 160_000), productoId: 3 }, // +60%
        { linea: linea(4, 0), productoId: 4 }, // costo cero
        { linea: linea(5, 80_000), productoId: 5 }, // -20%
        { linea: linea(6, 100_000), productoId: 6 }, // sin costo anterior
      ],
      [1, 2, 3, 4, 5].map((id) => producto(id, 100_000)).concat(producto(6, 0)),
    );
    expect(r.cambios.map((c) => [c.productoId, c.variacion, c.resaltado, c.individual, c.motivo])).toEqual([
      [6, null, true, true, 'sin-costo-anterior'],
      [4, -10000, true, true, 'costo-cero'],
      [3, 6000, true, true, 'variacion'],
      [2, 2000, true, false, null],
      [5, -2000, true, false, null],
      [1, 500, false, false, null],
    ]);
    expect(r.cambios.find((c) => c.productoId === 5)?.tipo).toBe('baja');
    expect([...aprobarTodo(r.cambios).keys()].sort()).toEqual([1, 2, 5]);
  });

  it('un costo cero que ya era cero igual se revisa de a uno', () => {
    const r = revisar([{ linea: linea(1, 0), productoId: 1 }], [producto(1, 0)]);
    expect(r.sinCambios).toEqual([]);
    expect(r.cambios[0]).toMatchObject({ individual: true, motivo: 'costo-cero' });
  });

  it('separa sin vincular, repetidas y los productos del proveedor que no vinieron', () => {
    const r = revisar(
      [
        { linea: linea(1, 100_000), productoId: 1 },
        { linea: linea(2, 100_000), productoId: null },
        { linea: linea(3, 120_000), productoId: 1 },
        { linea: linea(4, 100_000), productoId: 99 }, // producto borrado
      ],
      [producto(1, 90_000), producto(2, 1), producto(3, 1)],
      { vinculadosAntes: new Set([1, 2, 3, 99]) },
    );
    expect(r.cambios.map((c) => c.linea.filaOrigen)).toEqual([1]);
    expect(r.sinVincular.map((l) => l.filaOrigen)).toEqual([2, 4]);
    expect(r.repetidas.map((l) => l.filaOrigen)).toEqual([3]);
    expect(r.noVinieron).toEqual([2, 3]);
  });
});

describe('piso (lo que cuesta, medido como el precio de venta)', () => {
  it('suma el IVA sólo si F08 lo suma, con descuentos, redondeando hacia arriba', () => {
    expect(piso(100_000, [], 2100)).toBe(121_000);
    expect(piso(100_000, [1000], 0)).toBe(90_000);
    expect(piso(333, [], 1050)).toBe(368); // 367,965 → 368
  });

  it('armarRevision lo calcula con el IVA de la lista y de la venta', () => {
    const sinIva = revisar([{ linea: linea(1, 100_000), productoId: 1 }], [producto(1, 80_000)], { descuentos: [1000] });
    expect(sinIva.cambios[0]!.piso).toBe(108_900); // 1000 − 10% + 21%
    // Lista con IVA: el IVA ya está en el costo.
    const conIva = revisar([{ linea: linea(1, 121_000), productoId: 1 }], [producto(1, 90_000)], { listaIncluyeIva: true });
    expect(conIva.cambios[0]!.piso).toBe(121_000);
    // Vende sin IVA y la lista no lo trae: el piso es el costo.
    const ventaSinIva = revisar([{ linea: linea(1, 100_000), productoId: 1 }], [producto(1, 90_000)], {
      config: { ...config, ventaIncluyeIva: false },
    });
    expect(ventaSinIva.cambios[0]!.piso).toBe(100_000);
  });
});

describe('evaluarPrecioManual (F09: precio escrito a mano)', () => {
  const cambio = { piso: 121_000 };

  it('lee el precio como lo escribe un comerciante', () => {
    expect(evaluarPrecioManual('1.580', cambio)).toEqual({ precio: 158_000, aviso: null });
    expect(evaluarPrecioManual('1580,50', cambio)).toEqual({ precio: 158_050, aviso: null });
    expect(evaluarPrecioManual('$ 1.580', cambio)).toEqual({ precio: 158_000, aviso: null });
    expect(evaluarPrecioManual('1210', cambio)).toEqual({ precio: 121_000, aviso: null });
  });

  it('tiene que ser mayor que cero y un número', () => {
    expect(evaluarPrecioManual('', cambio)).toEqual({ error: 'Escribí el precio.' });
    expect(evaluarPrecioManual('0', cambio)).toEqual({ error: 'El precio tiene que ser mayor que cero.' });
    expect(evaluarPrecioManual('0,00', cambio)).toEqual({ error: 'El precio tiene que ser mayor que cero.' });
    expect(evaluarPrecioManual('-100', cambio)).toHaveProperty('error');
    expect(evaluarPrecioManual('mil', cambio)).toHaveProperty('error');
    expect(evaluarPrecioManual('1.000.000.000', cambio)).toHaveProperty('error');
  });

  it('por debajo del costo se acepta, con aviso', () => {
    expect(evaluarPrecioManual('1.209,99', cambio)).toEqual({ precio: 120_999, aviso: 'Queda por debajo del costo: vendés a pérdida.' });
    expect(avisoPrecio(120_999, cambio)).not.toBeNull();
    expect(avisoPrecio(121_000, cambio)).toBeNull();
  });

  it('decisionValida: sólo precios enteros mayores que cero', () => {
    expect(decisionValida(null)).toBe(true);
    expect(decisionValida({ precio: 1 })).toBe(true);
    expect(decisionValida({ precio: 0 })).toBe(false);
    expect(decisionValida({ precio: 10.5 })).toBe(false);
    expect(decisionValida({ precio: -100 })).toBe(false);
  });
});
