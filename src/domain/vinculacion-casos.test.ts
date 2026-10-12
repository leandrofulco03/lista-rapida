import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { IndiceCatalogo, normalizarDescripcion, vincularLinea } from './vinculacion';

/**
 * F07: calibración con el set de prueba (tests/fixtures/vinculacion/casos.json).
 * Primera lista de un proveedor (sin vínculos guardados):
 * - ninguna línea se sugiere con el producto equivocado (eso cambiaría un precio que no es);
 * - al menos el 80% de las que existen en el catálogo salen sugeridas con el producto correcto;
 * - los productos que el comercio no tiene nunca se sugieren con otro.
 */
const casos = JSON.parse(readFileSync(join(__dirname, '../../tests/fixtures/vinculacion/casos.json'), 'utf-8')) as {
  catalogo: string[];
  lineas: { descripcion: string; esperado: number | null }[];
};

describe('F07: set de vinculación', () => {
  const indice = new IndiceCatalogo(casos.catalogo.map((d, id) => ({ id, descripcionNormalizada: normalizarDescripcion(d) })));
  const resultados = casos.lineas.map((l) => ({ ...l, resultado: vincularLinea({ codigo: null, descripcion: l.descripcion }, new Map(), indice) }));

  it('nunca sugiere un producto equivocado', () => {
    const equivocadas = resultados.filter((r) => r.resultado.estado === 'sugerida' && r.resultado.productoId !== r.esperado);
    expect(equivocadas.map((r) => r.descripcion)).toEqual([]);
  });

  it('sugiere el producto correcto en al menos el 80% de las que existen', () => {
    const existen = resultados.filter((r) => r.esperado !== null);
    const bien = existen.filter((r) => r.resultado.estado === 'sugerida' && r.resultado.productoId === r.esperado);
    if (process.env.VER_VINCULOS) {
      writeFileSync(process.env.VER_VINCULOS, JSON.stringify(resultados.map((r) => [r.descripcion, r.esperado, r.resultado]), null, 1));
    }
    expect(bien.length / existen.length).toBeGreaterThanOrEqual(0.8);
  });

  it('las dudosas muestran el producto correcto entre las opciones', () => {
    const dudosas = resultados.filter((r) => r.resultado.estado === 'dudosa' && r.esperado !== null);
    for (const r of dudosas) expect(r.resultado.opciones.map((o) => o.productoId)).toContain(r.esperado);
  });
});
