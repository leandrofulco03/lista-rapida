import type { Backend } from './backend';

export type { Backend, Usuario } from './backend';
export { LARGO_MINIMO_CLAVE, problemaCredenciales } from './backend';

/**
 * Backend de la app según cómo se compiló:
 * - VITE_BACKEND=local: Postgres embebido en el navegador (recorridos e2e). Los datos quedan en este navegador.
 * - si no: Supabase, con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.
 * La comparación se resuelve al compilar, así el build de producción no incluye el Postgres embebido.
 */
export async function crearBackend(): Promise<Backend> {
  if (import.meta.env.VITE_BACKEND === 'local') {
    const { backendNavegador } = await import('./localNavegador');
    return backendNavegador();
  }
  const [{ nube }, { backendSupabase }] = await Promise.all([import('./cliente'), import('./supabase')]);
  return backendSupabase(nube());
}
