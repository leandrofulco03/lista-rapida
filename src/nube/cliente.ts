import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Conexión con Supabase (base de datos y usuarios). La URL y la clave pública salen de las
 * variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).
 * La clave es pública a propósito: lo que cada usuario puede ver o cambiar lo deciden las reglas
 * de la base (supabase/migrations), no la app.
 */
export function crearCliente(url: string | undefined, clave: string | undefined): SupabaseClient {
  if (!url || !clave) {
    throw new Error('Falta configurar Supabase: completá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (ver .env.example).');
  }
  return createClient(url, clave, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
}

let cliente: SupabaseClient | undefined;

/** Cliente único de la app; se crea la primera vez que se usa. */
export function nube(): SupabaseClient {
  cliente ??= crearCliente(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  return cliente;
}
