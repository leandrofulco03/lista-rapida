import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectarColumnas } from '../domain/columnas';
import { extraerLineas } from '../domain/lectura';
import type { LineaLista } from '../domain/lineaLista';
import { leerArchivo } from './index';
import { ErrorLectura } from './tabla';

/**
 * Condición de la Fase 2 (F05): leer bien el 85% de los PDF con texto del set de prueba,
 * sin que el usuario toque nada. Igual que en F04, una lista cuenta como bien leída sólo si
 * salen exactamente las líneas esperadas. Los PDF son sintéticos (scripts/generar-listas-pdf.py).
 */
const FIXTURES = join(__dirname, '../../tests/fixtures');
const CARPETA = join(FIXTURES, 'sinteticas-pdf');
const META = 0.85;

type Esperado = { lineas: LineaLista[] } | { cantidad: number; sumaCostos: number; muestra: LineaLista[] };

const listas = readdirSync(CARPETA)
  .filter((n) => n.endsWith('.pdf'))
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

describe('F05: set de listas PDF de prueba', () => {
  it('hay 12 listas', () => {
    expect(listas).toHaveLength(12);
  });

  const resultados = new Map<string, boolean>();

  it.each(listas)('%s', async (nombre) => {
    const esperado = JSON.parse(readFileSync(join(CARPETA, `${nombre}.esperado.json`), 'utf-8')) as Esperado;
    const lineas = await leer(nombre);
    const ok = coincide(lineas, esperado);
    resultados.set(nombre, ok);
    if (!ok && 'lineas' in esperado) expect(lineas).toEqual(esperado.lineas);
    expect(ok).toBe(true);
  });

  it(`lee bien al menos el ${META * 100}% sin ayuda`, () => {
    const bien = [...resultados.values()].filter(Boolean).length;
    expect(resultados.size).toBe(listas.length);
    expect(bien / listas.length).toBeGreaterThanOrEqual(META);
  });
});

describe('F05: PDF que no se pueden leer', () => {
  it('un PDF escaneado (sin texto) avisa que es una imagen', async () => {
    const datos = new Uint8Array(readFileSync(join(FIXTURES, 'pdf-escaneado.pdf')));
    await expect(leerArchivo('lista.pdf', datos)).rejects.toThrow(/no tiene texto/);
  });

  it('un PDF roto avisa que no se pudo abrir', async () => {
    const datos = new TextEncoder().encode('%PDF-1.4 roto');
    await expect(leerArchivo('lista.pdf', datos)).rejects.toBeInstanceOf(ErrorLectura);
  });
});
