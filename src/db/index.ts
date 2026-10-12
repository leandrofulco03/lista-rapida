import { BaseListaRapida } from './esquema';

export * from './esquema';
export * from './config';

/** Base única de la app en el navegador. */
export const db = new BaseListaRapida();
