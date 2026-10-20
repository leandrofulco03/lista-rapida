/**
 * Lo mínimo de Supabase para correr las migraciones en un Postgres embebido (PGlite):
 * el esquema auth con auth.uid() y los roles anon y authenticated.
 * La tabla de usuarios guarda la contraseña en claro: es sólo para pruebas en el propio dispositivo.
 */
export const SUPABASE_MINIMO = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text unique, clave text);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  create schema local;
  create table local.migraciones (nombre text primary key);
`;
