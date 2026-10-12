import type { Centavos, Porcentaje } from './dinero';
import { formatearPorcentaje } from './porcentaje';

/**
 * F11: lista de precios para el mostrador (PDF) y CSV para el sistema de caja.
 */

export interface ProductoExportar {
  codigoInterno: string;
  descripcion: string;
  rubroId: number | null;
  ivaPct: Porcentaje;
  precioVentaActual: Centavos;
  actualizado: string;
}

export interface GrupoRubro {
  /** null: productos sin rubro (van al final). */
  rubro: string | null;
  productos: ProductoExportar[];
}

const comparar = new Intl.Collator('es', { sensitivity: 'base', numeric: true }).compare;

/** Productos agrupados por rubro (en orden alfabético, "sin rubro" al final) y ordenados por descripción. */
export function agruparPorRubro(productos: readonly ProductoExportar[], rubros: ReadonlyMap<number, string>): GrupoRubro[] {
  const grupos = new Map<string | null, ProductoExportar[]>();
  for (const p of productos) {
    const rubro = p.rubroId === null ? null : (rubros.get(p.rubroId) ?? null);
    const lista = grupos.get(rubro) ?? [];
    lista.push(p);
    grupos.set(rubro, lista);
  }
  return [...grupos]
    .sort(([a], [b]) => (a === null ? 1 : b === null ? -1 : comparar(a, b)))
    .map(([rubro, lista]) => ({ rubro, productos: lista.sort((x, y) => comparar(x.descripcion, y.descripcion)) }));
}

/** 158050 → "1580,50": número que Excel en castellano lee como número (sin separador de miles). */
export function importeCsv(centavos: Centavos): string {
  return `${Math.floor(centavos / 100)},${String(centavos % 100).padStart(2, '0')}`;
}

/**
 * Un campo de CSV: entre comillas si tiene ; " o saltos de línea. Si empieza con = + - @ se le antepone
 * un apóstrofo, para que Excel no lo tome como fórmula.
 */
export function campoCsv(valor: string): string {
  let v = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
  if (/[;"\r\n]/.test(v)) v = `"${v.replace(/"/g, '""')}"`;
  return v;
}

const fechaCorta = (iso: string) => {
  const f = new Date(iso);
  const dos = (n: number) => String(n).padStart(2, '0');
  return `${dos(f.getDate())}/${dos(f.getMonth() + 1)}/${f.getFullYear()}`;
};

export const COLUMNAS_CSV = ['Código', 'Descripción', 'Rubro', 'Precio', 'IVA %', 'Actualizado'] as const;

/**
 * CSV para el sistema de caja, pensado para abrirse bien en Excel en castellano: UTF-8 con BOM
 * (así se ven los acentos), separado por punto y coma y con coma decimal.
 */
export function armarCsvCaja(productos: readonly ProductoExportar[], rubros: ReadonlyMap<number, string>): string {
  const filas = agruparPorRubro(productos, rubros).flatMap((g) =>
    g.productos.map((p) =>
      [p.codigoInterno, p.descripcion, g.rubro ?? '', importeCsv(p.precioVentaActual), formatearPorcentaje(p.ivaPct), fechaCorta(p.actualizado)]
        .map(campoCsv)
        .join(';'),
    ),
  );
  return `﻿${[COLUMNAS_CSV.join(';'), ...filas].join('\r\n')}\r\n`;
}
