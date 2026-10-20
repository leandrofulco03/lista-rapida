interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  /** "local": Postgres embebido en el navegador, para los recorridos e2e. */
  readonly VITE_BACKEND?: string;
}
