import type { SupabaseClient } from '@supabase/supabase-js';
import { problemaCredenciales } from './backend';
import type { Backend, Usuario } from './backend';

/** Mensajes de Supabase (en inglés) que ve el comerciante, en castellano. */
export function traducir(mensaje: string): string {
  if (/invalid login credentials/i.test(mensaje)) return 'El email o la contraseña no son correctos.';
  if (/already registered|already exists/i.test(mensaje)) return 'Ya hay una cuenta con ese email. Ingresá con tu contraseña.';
  if (/password should be|weak password/i.test(mensaje)) return 'La contraseña es muy débil: usá al menos 6 letras o números.';
  if (/email not confirmed/i.test(mensaje)) return 'Falta confirmar el email: buscá el mensaje que te llegó.';
  if (/rate limit/i.test(mensaje)) return 'Hubo muchos intentos seguidos. Esperá unos minutos y probá de nuevo.';
  if (/failed to fetch|network/i.test(mensaje)) return 'No hay conexión con el servidor. Revisá internet y probá de nuevo.';
  return mensaje;
}

const aUsuario = (u: { id: string; email?: string } | null | undefined): Usuario | null => (u ? { id: u.id, email: u.email ?? '' } : null);

export function backendSupabase(cli: SupabaseClient): Backend {
  return {
    async rpc<T>(funcion: string, args: Record<string, unknown> = {}): Promise<T> {
      const { data, error } = await cli.rpc(funcion, args);
      if (error) throw new Error(traducir(error.message));
      return data as T;
    },

    async usuario() {
      const { data } = await cli.auth.getSession();
      return aUsuario(data.session?.user);
    },

    alCambiarUsuario(aviso) {
      const { data } = cli.auth.onAuthStateChange((_evento, sesion) => aviso(aUsuario(sesion?.user)));
      return () => data.subscription.unsubscribe();
    },

    async registrarse(email, clave) {
      const problema = problemaCredenciales(email, clave);
      if (problema) throw new Error(problema);
      const { data, error } = await cli.auth.signUp({ email: email.trim(), password: clave });
      if (error) throw new Error(traducir(error.message));
      if (!data.session) throw new Error('Te mandamos un email para confirmar la cuenta. Confirmala y después ingresá.');
    },

    async ingresar(email, clave) {
      const { error } = await cli.auth.signInWithPassword({ email: email.trim(), password: clave });
      if (error) throw new Error(traducir(error.message));
    },

    async salir() {
      await cli.auth.signOut();
    },
  };
}
