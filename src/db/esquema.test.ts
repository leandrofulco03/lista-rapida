import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { expect, it } from 'vitest';
import { BaseListaRapida } from './esquema';

it('al actualizar a la versión 2, recalcula la descripción normalizada con unidades unificadas', async () => {
  const vieja = new Dexie('prueba-esquema-v1');
  vieja.version(1).stores({ productos: '++id, codigoInterno, descripcionNormalizada, rubroId' });
  await vieja.table('productos').add({ codigoInterno: 'A1', descripcion: 'Aceite Natura 1,5 Lt', descripcionNormalizada: 'aceite natura 1 5 lt' });
  vieja.close();

  const db = new BaseListaRapida('prueba-esquema-v1');
  const [producto] = await db.productos.toArray();
  expect(producto?.descripcionNormalizada).toBe('aceite natura 1500ml');
  await db.delete();
});
