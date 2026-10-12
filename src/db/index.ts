import { BaseListaRapida } from './esquema';

export * from './esquema';
export * from './config';
export * from './proveedores';
export * from './catalogo';
export * from './revision';
export * from './respaldo';

/** Base única de la app en el navegador. */
export const db = new BaseListaRapida();
