import { PGlite } from '@electric-sql/pglite';
import type { PGliteInterface } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { backendLocal, prepararBase, recuerdoEnMemoria } from './local';
import type { Backend } from './backend';

/**
 * Para las pruebas: una base con las migraciones (se arma una vez y se copia para cada prueba)
 * y backends de distintos usuarios sobre la misma base.
 */
const MIGRACIONES = new URL('../../supabase/migrations/', import.meta.url);

export async function baseConMigraciones(): Promise<PGlite> {
  const pg = new PGlite();
  const migraciones = readdirSync(MIGRACIONES)
    .filter((a) => a.endsWith('.sql'))
    .map((nombre) => ({ nombre, sql: readFileSync(new URL(nombre, MIGRACIONES), 'utf8') }));
  await prepararBase(pg, migraciones);
  return pg;
}

/** Un backend con un usuario nuevo ya registrado y con sesión iniciada. */
export async function usuarioNuevo(pg: PGliteInterface, email: string): Promise<Backend> {
  const backend = backendLocal(pg, recuerdoEnMemoria());
  await backend.registrarse(email, 'clave-de-prueba');
  return backend;
}

/** Cuántas filas tiene una tabla (mirando la base entera, sin reglas de acceso). */
export async function contar(pg: PGliteInterface, tabla: string): Promise<number> {
  if (!/^[a-z_]+$/.test(tabla)) throw new Error(tabla);
  const [fila] = (await pg.query<{ n: number }>(`select count(*)::int as n from public.${tabla}`)).rows;
  return fila!.n;
}
