import { normalizarConfig, validarConfig } from '../domain/config';
import type { ConfigComercio } from '../domain/config';
import type { Sesion } from './tipos';

/** F01: configuración del comercio; undefined si no se puede leer (un empleado no la ve). */
export async function leerConfig(s: Sesion): Promise<ConfigComercio | undefined> {
  return (await s.backend.rpc<ConfigComercio | null>('leer_config', { c: s.comercioId })) ?? undefined;
}

/** Revisa la configuración; lanza un error con los problemas si no es válida. */
export function configValida(config: ConfigComercio): ConfigComercio {
  const limpia = normalizarConfig(config);
  const errores = validarConfig(limpia);
  if (Object.keys(errores).length > 0) {
    throw new Error(`Configuración inválida: ${Object.values(errores).join(' ')}`);
  }
  return limpia;
}

/** F01: valida y guarda la configuración (sólo el admin). */
export async function guardarConfig(s: Sesion, config: ConfigComercio): Promise<ConfigComercio> {
  const limpia = configValida(config);
  await s.backend.rpc('guardar_config', { c: s.comercioId, config: limpia });
  return limpia;
}
