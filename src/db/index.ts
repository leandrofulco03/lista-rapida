import { BaseListaRapida } from './esquema';

export * from './esquema';
export * from './config';
export * from './proveedores';

/** Base única de la app en el navegador. */
export const db = new BaseListaRapida();
