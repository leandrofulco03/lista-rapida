import { PGlite } from '@electric-sql/pglite';
import { backendLocal, prepararBase } from './local';
import type { Backend } from './backend';

const CLAVE_USUARIO = 'listamatch-local-usuario';

const archivos = import.meta.glob('../../supabase/migrations/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

/** Postgres embebido en el navegador, guardado en este navegador (IndexedDB). */
export async function backendNavegador(): Promise<Backend> {
  const pg = new PGlite('idb://listamatch-local');
  const migraciones = Object.entries(archivos).map(([ruta, sql]) => ({ nombre: ruta.split('/').pop()!, sql }));
  await prepararBase(pg, migraciones);
  return backendLocal(pg, {
    leer: () => {
      try {
        return localStorage.getItem(CLAVE_USUARIO);
      } catch {
        return null;
      }
    },
    guardar: (id) => {
      try {
        if (id) localStorage.setItem(CLAVE_USUARIO, id);
        else localStorage.removeItem(CLAVE_USUARIO);
      } catch {
        // Sin almacenamiento, la sesión dura hasta recargar.
      }
    },
  });
}
