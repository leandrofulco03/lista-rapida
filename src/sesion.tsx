import { createContext, useContext } from 'react';
import type { Sesion } from './db';

/** Con quién y en qué comercio se trabaja. Lo pone App cuando hay sesión y comercio elegido. */
export const ContextoSesion = createContext<Sesion | null>(null);

export function useSesion(): Sesion {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error('useSesion se usa dentro de un comercio con sesión iniciada.');
  return sesion;
}
