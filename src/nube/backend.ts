/**
 * Lo que la app necesita del servidor: usuarios y las funciones de la base (RPC).
 * Hay dos: Supabase (producción) y un Postgres embebido (pruebas y recorridos e2e, sin internet),
 * que corren el mismo esquema y las mismas reglas de acceso (supabase/migrations).
 */
export interface Usuario {
  id: string;
  email: string;
}

export interface Backend {
  /** Llama a una función de la base. Los errores llegan con el texto para mostrar al comerciante. */
  rpc<T = unknown>(funcion: string, args?: Record<string, unknown>): Promise<T>;
  usuario(): Promise<Usuario | null>;
  /** Avisa cada vez que se entra o se sale. Devuelve cómo dejar de escuchar. */
  alCambiarUsuario(aviso: (usuario: Usuario | null) => void): () => void;
  registrarse(email: string, clave: string): Promise<void>;
  ingresar(email: string, clave: string): Promise<void>;
  salir(): Promise<void>;
}

export const LARGO_MINIMO_CLAVE = 6;

/** Revisa email y contraseña antes de mandarlos. Devuelve el problema o null. */
export function problemaCredenciales(email: string, clave: string): string | null {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Escribí un email válido.';
  if (clave.length < LARGO_MINIMO_CLAVE) return `La contraseña tiene que tener al menos ${LARGO_MINIMO_CLAVE} letras o números.`;
  return null;
}
