import { FORMATO_RESPALDO, MARCA_RESPALDO, TABLAS_RESPALDO } from '../domain/respaldo';
import type { Respaldo } from '../domain/respaldo';
import { normalizarDescripcion } from '../domain/vinculacion';
import { ID_CONFIG } from './esquema';
import type { BaseListaRapida } from './esquema';

/**
 * F12: arma la copia de seguridad con todas las tablas y anota la fecha en la configuración
 * (la copia ya la incluye, así el recordatorio no salta después de restaurar).
 */
export async function exportarRespaldo(db: BaseListaRapida, ahora = new Date()): Promise<Respaldo> {
  const fecha = ahora.toISOString();
  return db.transaction('rw', TABLAS_RESPALDO.map((t) => db.table(t)), async () => {
    await db.config.update(ID_CONFIG, { ultimoRespaldo: fecha });
    const tablas = {} as Respaldo['tablas'];
    for (const tabla of TABLAS_RESPALDO) tablas[tabla] = await db.table(tabla).toArray();
    return { app: MARCA_RESPALDO, formato: FORMATO_RESPALDO, version: db.verno, fecha, tablas };
  });
}

/** Lleva las filas de una copia hecha con una versión anterior del esquema a la actual. */
function migrar(respaldo: Respaldo): Respaldo['tablas'] {
  const tablas = { ...respaldo.tablas };
  if (respaldo.version < 2) {
    tablas.productos = tablas.productos.map((p) => ({ ...p, descripcionNormalizada: normalizarDescripcion(String(p.descripcion ?? '')) }));
  }
  return tablas;
}

/** F12: reemplaza todos los datos de este dispositivo por los de la copia (ya revisada con leerRespaldo). */
export async function restaurarRespaldo(db: BaseListaRapida, respaldo: Respaldo): Promise<void> {
  const tablas = migrar(respaldo);
  await db.transaction('rw', TABLAS_RESPALDO.map((t) => db.table(t)), async () => {
    for (const tabla of TABLAS_RESPALDO) {
      await db.table(tabla).clear();
      await db.table(tabla).bulkAdd(tablas[tabla]);
    }
  });
}

/** Si hay algo cargado que valga la pena respaldar. */
export async function hayDatos(db: BaseListaRapida): Promise<boolean> {
  return (await db.productos.count()) > 0 || (await db.proveedores.count()) > 0;
}
