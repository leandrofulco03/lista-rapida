import type { PGliteInterface } from '@electric-sql/pglite';
import { problemaCredenciales } from './backend';
import type { Backend, Usuario } from './backend';
import { SUPABASE_MINIMO } from './supabaseMinimo';

/**
 * Backend con Postgres embebido (PGlite): las mismas migraciones y reglas que Supabase, sin internet.
 * Lo usan las pruebas y los recorridos e2e (VITE_BACKEND=local).
 */

export interface Migracion {
  nombre: string;
  sql: string;
}

/** Corre lo que falte: lo mínimo de Supabase la primera vez y las migraciones que no se corrieron. */
export async function prepararBase(pg: PGliteInterface, migraciones: readonly Migracion[]): Promise<void> {
  const [fila] = (await pg.query<{ hay: boolean }>("select to_regclass('local.migraciones') is not null as hay")).rows;
  if (!fila?.hay) await pg.exec(SUPABASE_MINIMO);
  const hechas = new Set((await pg.query<{ nombre: string }>('select nombre from local.migraciones')).rows.map((f) => f.nombre));
  for (const m of [...migraciones].sort((a, b) => a.nombre.localeCompare(b.nombre))) {
    if (hechas.has(m.nombre)) continue;
    await pg.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.query('insert into local.migraciones (nombre) values ($1)', [m.nombre]);
    });
  }
}

/** Dónde se recuerda quién inició sesión (en el navegador, el almacenamiento local). */
export interface Recuerdo {
  leer(): string | null;
  guardar(id: string | null): void;
}

export function recuerdoEnMemoria(): Recuerdo {
  let id: string | null = null;
  return {
    leer: () => id,
    guardar: (nuevo) => {
      id = nuevo;
    },
  };
}

const NOMBRE = /^[a-z_][a-z0-9_]*$/;

export function backendLocal(pg: PGliteInterface, recuerdo: Recuerdo = recuerdoEnMemoria()): Backend {
  const avisos = new Set<(u: Usuario | null) => void>();

  async function usuario(): Promise<Usuario | null> {
    const id = recuerdo.leer();
    if (!id) return null;
    const filas = (await pg.query<Usuario>('select id, email from auth.users where id = $1', [id])).rows;
    return filas[0] ?? null;
  }

  async function avisar() {
    const u = await usuario();
    for (const aviso of avisos) aviso(u);
  }

  return {
    async rpc<T>(funcion: string, args: Record<string, unknown> = {}): Promise<T> {
      const nombres = Object.keys(args);
      if (!NOMBRE.test(funcion) || !nombres.every((k) => NOMBRE.test(k))) throw new Error(`Nombre no válido: ${funcion}`);
      const sql = `select public.${funcion}(${nombres.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as r`;
      const valores = nombres.map((n) => {
        const v = args[n];
        return v !== null && typeof v === 'object' ? JSON.stringify(v) : (v ?? null);
      });
      const id = recuerdo.leer();
      // Igual que Supabase: con sesión corre como authenticated; sin sesión, como anon.
      return pg.transaction(async (tx) => {
        await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [id ?? '']);
        await tx.exec(id ? 'set local role authenticated' : 'set local role anon');
        const filas = (await tx.query<{ r: T }>(sql, valores)).rows;
        return filas[0]!.r;
      });
    },

    usuario,

    alCambiarUsuario(aviso) {
      avisos.add(aviso);
      return () => {
        avisos.delete(aviso);
      };
    },

    async registrarse(email, clave) {
      const problema = problemaCredenciales(email, clave);
      if (problema) throw new Error(problema);
      const limpio = email.trim().toLowerCase();
      if ((await pg.query('select 1 from auth.users where email = $1', [limpio])).rows.length > 0) {
        throw new Error('Ya hay una cuenta con ese email. Ingresá con tu contraseña.');
      }
      const [fila] = (await pg.query<{ id: string }>('insert into auth.users (email, clave) values ($1, $2) returning id', [limpio, clave])).rows;
      recuerdo.guardar(fila!.id);
      await avisar();
    },

    async ingresar(email, clave) {
      const filas = (
        await pg.query<{ id: string }>('select id from auth.users where email = $1 and clave = $2', [email.trim().toLowerCase(), clave])
      ).rows;
      if (filas.length === 0) throw new Error('El email o la contraseña no son correctos.');
      recuerdo.guardar(filas[0]!.id);
      await avisar();
    },

    async salir() {
      recuerdo.guardar(null);
      await avisar();
    },
  };
}
