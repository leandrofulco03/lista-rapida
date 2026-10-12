import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectarColumnas } from '../domain/columnas';
import { extraerLineas } from '../domain/lectura';
import type { LineaLista } from '../domain/lineaLista';
import { leerArchivo } from './index';

/**
 * Condición de la Fase 2 (F04): leer bien el 95% de las listas Excel/CSV del set de prueba,
 * sin que el usuario toque nada. Una lista cuenta como bien leída sólo si salen exactamente
 * las líneas esperadas (código, descripción, presentación, costo, IVA y fila).
 * Las listas son sintéticas (ver tests/fixtures/sinteticas/LEEME.md).
 */
const CARPETA = join(__dirname, '../../tests/fixtures/sinteticas');
const META = 0.95;

type Esperado = { lineas: LineaLista[] } | { cantidad: number; sumaCostos: number; muestra: LineaLista[] };

const listas = readdirSync(CARPETA)
  .filter((n) => !n.endsWith('.json') && !n.endsWith('.md'))
  .sort();

async function leer(nombre: string): Promise<LineaLista[]> {
  const tabla = await leerArchivo(nombre, new Uint8Array(readFileSync(join(CARPETA, nombre))));
  const { mapeo } = detectarColumnas(tabla.filas);
  return mapeo ? extraerLineas(tabla.filas, mapeo).lineas : [];
}

function coincide(lineas: LineaLista[], esperado: Esperado): boolean {
  try {
    if ('lineas' in esperado) {
      expect(lineas).toEqual(esperado.lineas);
    } else {
      expect(lineas).toHaveLength(esperado.cantidad);
      expect(lineas.reduce((s, l) => s + l.costo, 0)).toBe(esperado.sumaCostos);
      expect(lineas.filter((_, i) => i % 50 === 0)).toEqual(esperado.muestra);
    }
    return true;
  } catch {
    return false;
  }
}

describe('F04: set de listas de prueba', () => {
  it('hay 20 listas', () => {
    expect(listas).toHaveLength(20);
  });

  const resultados = new Map<string, boolean>();

  it.each(listas)('%s', async (nombre) => {
    const esperado = JSON.parse(readFileSync(join(CARPETA, `${nombre}.esperado.json`), 'utf-8')) as Esperado;
    const lineas = await leer(nombre);
    const ok = coincide(lineas, esperado);
    resultados.set(nombre, ok);
    // Si falla, mostrar la diferencia completa.
    if (!ok && 'lineas' in esperado) expect(lineas).toEqual(esperado.lineas);
    expect(ok).toBe(true);
  });

  it(`lee bien al menos el ${META * 100}% sin ayuda`, () => {
    const bien = [...resultados.values()].filter(Boolean).length;
    expect(resultados.size).toBe(listas.length);
    expect(bien / listas.length).toBeGreaterThanOrEqual(META);
  });
});
