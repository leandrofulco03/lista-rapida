import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectarColumnasCatalogo, extraerProductosCatalogo } from '../domain/catalogo';
import { detectarColumnas } from '../domain/columnas';
import { extraerLineas } from '../domain/lectura';
import { claveVinculo, IndiceCatalogo, normalizarDescripcion, vincularLinea } from '../domain/vinculacion';
import { leerArchivo } from './index';

/**
 * Piloto con datos ficticios (tests/fixtures/comercios, armados con scripts/generar-comercios.py):
 * tres comercios con su catálogo y dos proveedores cada uno, con una lista de la semana 1 y otra de la semana 2.
 * Pasa todo por el mismo camino que la app: lectura, detección de columnas y vinculación.
 */

const CARPETA = join(__dirname, '../../tests/fixtures/comercios');

interface Esperado {
  comercio: string;
  proveedor: string;
  listaIncluyeIva: boolean;
  lineas: { codigo: string | null; descripcion: string; presentacion: string | null; costo: number; producto: string | null }[];
}

async function leer(nombre: string) {
  return leerArchivo(nombre, new Uint8Array(readFileSync(join(CARPETA, nombre))));
}

async function catalogo(comercio: string) {
  const { filas } = await leer(`${comercio}-catalogo.xlsx`);
  const { mapeo } = detectarColumnasCatalogo(filas);
  const { productos } = extraerProductosCatalogo(filas, mapeo!);
  // id = posición + 1, con ceros adelante para que el orden de los ids siga el del catálogo; el código ("0001") lleva al id.
  const conId = productos.map((p, i) => ({ ...p, id: String(i + 1).padStart(4, '0'), descripcionNormalizada: normalizarDescripcion(p.descripcion) }));
  return { productos: conId, idDe: new Map(conId.map((p) => [p.codigo!, p.id])) };
}

async function lista(nombre: string) {
  const esperado = JSON.parse(readFileSync(join(CARPETA, `${nombre}.esperado.json`), 'utf-8')) as Esperado;
  const { filas } = await leer(nombre);
  const deteccion = detectarColumnas(filas);
  const { lineas } = extraerLineas(filas, deteccion.mapeo!);
  return { esperado, lineas, confianza: deteccion.confianza };
}

const ARCHIVOS: Record<string, Record<'a' | 'b', string>> = {
  kiosco: { a: 'xlsx', b: 'pdf' },
  ferreteria: { a: 'xlsx', b: 'csv' },
  almacen: { a: 'pdf', b: 'csv' },
};

/** Lo que se espera de cada lista: se lee igual que el archivo, y la vinculación no se equivoca sola. */
describe('piloto con comercios ficticios', () => {
  for (const [comercio, formatos] of Object.entries(ARCHIVOS)) {
    for (const prov of ['a', 'b'] as const) {
      const nombre = (semana: number) => `${comercio}-proveedor-${prov}-semana-${semana}.${formatos[prov]}`;

      it(`${comercio}, proveedor ${prov.toUpperCase()}: lee cada línea con su costo`, async () => {
        for (const semana of [1, 2]) {
          const { esperado, lineas, confianza } = await lista(nombre(semana));
          expect(confianza).toBe('alta');
          expect(lineas.map((l) => [l.codigo, l.descripcion, l.presentacion, l.costo])).toEqual(
            esperado.lineas.map((l) => [l.codigo, l.descripcion, l.presentacion, l.costo]),
          );
        }
      });

      it(`${comercio}, proveedor ${prov.toUpperCase()}: nunca sugiere mal y la segunda lista se vincula sola`, async () => {
        const { productos, idDe } = await catalogo(comercio);
        const indice = new IndiceCatalogo(productos);
        const correcto = (l: Esperado['lineas'][number]) => (l.producto === null ? null : idDe.get(l.producto)!);

        // Semana 1: sin vínculos. Lo que se sugiere con un toque tiene que estar bien.
        const s1 = await lista(nombre(1));
        const vinculos = new Map<string, string>();
        s1.lineas.forEach((linea, i) => {
          const esperado = correcto(s1.esperado.lineas[i]!);
          const r = vincularLinea(linea, new Map(), indice);
          if (r.estado === 'sugerida') expect(r.productoId, linea.descripcion).toBe(esperado);
          // El comerciante confirma cada línea con su producto; las que no tiene, las deja.
          if (esperado !== null) vinculos.set(claveVinculo(linea.codigo, linea.descripcion, linea.presentacion), esperado);
        });

        // Semana 2: lo que se vincula solo está bien, y es al menos el 85% de lo que ya existía.
        const s2 = await lista(nombre(2));
        let existentes = 0;
        let solas = 0;
        s2.lineas.forEach((linea, i) => {
          const esperado = correcto(s2.esperado.lineas[i]!);
          const r = vincularLinea(linea, vinculos, indice);
          if (r.estado === 'vinculada' || r.estado === 'sugerida') expect(r.productoId, linea.descripcion).toBe(esperado);
          if (esperado === null) return;
          existentes++;
          if (r.estado === 'vinculada') solas++;
        });
        expect(solas / existentes).toBeGreaterThanOrEqual(0.85);
      });
    }
  }
});
