import { normalizarConfig, validarConfig } from '../domain/config';
import type { ConfigComercio } from '../domain/config';
import { ID_CONFIG } from './esquema';
import type { BaseListaRapida } from './esquema';

/** F01: devuelve la configuración guardada o undefined si el comercio todavía no se configuró. */
export async function leerConfig(db: BaseListaRapida): Promise<ConfigComercio | undefined> {
  const fila = await db.config.get(ID_CONFIG);
  if (!fila) return undefined;
  const { id: _id, ...config } = fila;
  return config;
}

/** F01: valida y guarda la configuración. Lanza un error si no es válida. */
export async function guardarConfig(db: BaseListaRapida, config: ConfigComercio): Promise<ConfigComercio> {
  const limpia = normalizarConfig(config);
  const errores = validarConfig(limpia);
  if (Object.keys(errores).length > 0) {
    throw new Error(`Configuración inválida: ${Object.values(errores).join(' ')}`);
  }
  await db.config.put({ ...limpia, id: ID_CONFIG });
  return limpia;
}
