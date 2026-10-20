import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SUPABASE_MINIMO } from '../../src/nube/supabaseMinimo';

/**
 * Prueba las migraciones y las reglas de acceso en un Postgres embebido (PGlite), sin Docker.
 * Imita lo mínimo de Supabase (src/nube/supabaseMinimo.ts).
 */

const MIGRACIONES = new URL('../migrations/', import.meta.url);


const DUENO = '00000000-0000-0000-0000-00000000000a';
const EMPLEADO = '00000000-0000-0000-0000-00000000000b';
const OTRO = '00000000-0000-0000-0000-00000000000c';

const CONFIG = { recargoGeneral: 3000, redondeo: { tipo: 'multiplo', pesos: 10 }, ventaIncluyeIva: true, ivaDefault: 2100 };

let base: PGlite;
let pg: PGlite;

/** Corre la consulta como el usuario (con su sesión), igual que llega desde la app. */
async function como<T = Record<string, unknown>>(usuario: string | null, sql: string, params: unknown[] = []): Promise<T[]> {
  await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '${usuario ?? ''}', false);`);
  await pg.exec(usuario ? 'set role authenticated' : 'set role anon');
  try {
    return (await pg.query<T>(sql, params)).rows;
  } finally {
    await pg.exec('reset role');
  }
}

async function crearComercio(usuario: string, nombre: string): Promise<string> {
  const [fila] = await como<{ id: string }>(usuario, 'select public.crear_comercio($1, $2) as id', [nombre, CONFIG]);
  return fila.id;
}

// Se arma una vez y cada prueba arranca de una copia limpia.
beforeAll(async () => {
  base = new PGlite();
  await base.exec(SUPABASE_MINIMO);
  for (const archivo of readdirSync(MIGRACIONES).filter((a) => a.endsWith('.sql')).sort()) {
    await base.exec(readFileSync(new URL(archivo, MIGRACIONES), 'utf8'));
  }
  await base.exec(`insert into auth.users (id) values ('${DUENO}'), ('${EMPLEADO}'), ('${OTRO}')`);
}, 60_000);

beforeEach(async () => {
  pg = await base.clone();
});

describe('comercio y equipo', () => {
  it('quien crea el comercio queda como admin, con su configuración', async () => {
    const id = await crearComercio(DUENO, '  Almacén   Don Pepe ');
    expect(await como(DUENO, 'select nombre from comercios')).toEqual([{ nombre: 'Almacén Don Pepe' }]);
    expect(await como(DUENO, 'select rol from miembros where comercio_id = $1', [id])).toEqual([{ rol: 'admin' }]);
    expect(await como(DUENO, 'select recargo_general, iva_default from config_comercio')).toEqual([
      { recargo_general: 3000, iva_default: 2100 },
    ]);
  });

  it('sin sesión no se crea nada ni se ve nada', async () => {
    await expect(como(null, 'select public.crear_comercio($1, $2)', ['X', CONFIG])).rejects.toThrow();
    await crearComercio(DUENO, 'Kiosco');
    await expect(como(null, 'select * from comercios')).rejects.toThrow(/permission denied/);
    await expect(como(null, 'select * from productos_venta')).rejects.toThrow(/permission denied/);
  });

  it('el empleado entra con el código una sola vez, y el código vencido no sirve', async () => {
    const id = await crearComercio(DUENO, 'Kiosco');
    const [{ codigo }] = await como<{ codigo: string }>(DUENO, 'insert into invitaciones (comercio_id) values ($1) returning codigo', [id]);
    expect(codigo).toMatch(/^[0-9A-F]{12}$/);

    expect(await como(EMPLEADO, 'select public.unirse_con_codigo($1, $2) as id', [` ${codigo.toLowerCase()} `, 'Juan'])).toEqual([{ id }]);
    expect(await como(EMPLEADO, 'select rol, nombre from miembros where usuario_id = $1', [EMPLEADO])).toEqual([
      { rol: 'empleado', nombre: 'Juan' },
    ]);
    await expect(como(OTRO, 'select public.unirse_con_codigo($1)', [codigo])).rejects.toThrow(/no es válido/);

    const [vencida] = await como<{ codigo: string }>(
      DUENO,
      "insert into invitaciones (comercio_id, vence) values ($1, now() - interval '1 minute') returning codigo",
      [id],
    );
    await expect(como(OTRO, 'select public.unirse_con_codigo($1)', [vencida.codigo])).rejects.toThrow(/no es válido/);
  });

  it('el empleado no genera códigos ni cambia roles; el admin no se puede sacar a sí mismo', async () => {
    const id = await crearComercio(DUENO, 'Kiosco');
    const [{ codigo }] = await como<{ codigo: string }>(DUENO, 'insert into invitaciones (comercio_id) values ($1) returning codigo', [id]);
    await como(EMPLEADO, 'select public.unirse_con_codigo($1)', [codigo]);

    await expect(como(EMPLEADO, 'insert into invitaciones (comercio_id) values ($1)', [id])).rejects.toThrow(/row-level security/);
    await como(EMPLEADO, "update miembros set rol = 'admin' where usuario_id = $1", [EMPLEADO]);
    expect(await como(DUENO, 'select rol from miembros where usuario_id = $1', [EMPLEADO])).toEqual([{ rol: 'empleado' }]);

    await como(DUENO, 'delete from miembros where usuario_id = $1', [DUENO]);
    expect(await como(DUENO, 'select count(*)::int as n from miembros')).toEqual([{ n: 2 }]);
    await como(DUENO, 'delete from miembros where usuario_id = $1', [EMPLEADO]);
    expect(await como(DUENO, 'select count(*)::int as n from miembros')).toEqual([{ n: 1 }]);
  });
});

describe('precios', () => {
  async function comercioConEmpleado() {
    const id = await crearComercio(DUENO, 'Almacén');
    const [{ codigo }] = await como<{ codigo: string }>(DUENO, 'insert into invitaciones (comercio_id) values ($1) returning codigo', [id]);
    await como(EMPLEADO, 'select public.unirse_con_codigo($1)', [codigo]);
    await como(
      DUENO,
      `insert into productos (comercio_id, codigo_interno, codigo_barras, descripcion, descripcion_normalizada, iva_pct, costo_actual, precio_venta_actual)
       values ($1, 'P0001', '7790895000997', 'Coca Cola 2,25 l', 'coca cola 2250ml', 2100, 150000, 250000)`,
      [id],
    );
    return id;
  }

  it('el empleado ve los productos para vender, sin costo, y no los puede cambiar', async () => {
    const id = await comercioConEmpleado();
    expect(await como(EMPLEADO, 'select * from productos')).toEqual([]);
    const venta = await como(EMPLEADO, 'select * from productos_venta');
    expect(venta).toHaveLength(1);
    expect(venta[0]).toMatchObject({ descripcion: 'Coca Cola 2,25 l', precio_venta_actual: 250000 });
    expect(venta[0]).not.toHaveProperty('costo_actual');

    await expect(como(EMPLEADO, 'update productos_venta set precio_venta_actual = 1')).rejects.toThrow(/permission denied/);
    await como(EMPLEADO, 'update productos set precio_venta_actual = 1');
    await expect(
      como(EMPLEADO, `insert into proveedores (comercio_id, nombre) values ($1, 'Mayorista')`, [id]),
    ).rejects.toThrow(/row-level security/);
    expect(await como(DUENO, 'select precio_venta_actual from productos')).toEqual([{ precio_venta_actual: 250000 }]);
  });

  it('otro comercio no ve ni toca nada, ni puede apuntar a filas ajenas', async () => {
    const id = await comercioConEmpleado();
    const otro = await crearComercio(OTRO, 'Kiosco de enfrente');
    expect(await como(OTRO, 'select * from productos_venta')).toEqual([]);
    expect(await como(OTRO, 'select * from comercios where id = $1', [id])).toEqual([]);
    await expect(
      como(OTRO, `insert into rubros (comercio_id, nombre) values ($1, 'Bebidas')`, [id]),
    ).rejects.toThrow(/row-level security/);

    // Un rubro de su comercio no se puede poner en un producto del otro (las claves incluyen comercio_id).
    const [rubro] = await como<{ id: string }>(DUENO, `insert into rubros (comercio_id, nombre) values ($1, 'Bebidas') returning id`, [id]);
    await expect(
      como(
        OTRO,
        `insert into productos (comercio_id, codigo_interno, descripcion, descripcion_normalizada, iva_pct, rubro_id)
         values ($1, 'P1', 'X', 'x', 2100, $2)`,
        [otro, rubro.id],
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it('borrar un rubro deja sus productos sin rubro; borrar un proveedor se lleva sus vínculos', async () => {
    const id = await comercioConEmpleado();
    const [rubro] = await como<{ id: string }>(DUENO, `insert into rubros (comercio_id, nombre) values ($1, 'Bebidas') returning id`, [id]);
    await como(DUENO, 'update productos set rubro_id = $1', [rubro.id]);
    const [prov] = await como<{ id: string }>(DUENO, `insert into proveedores (comercio_id, nombre) values ($1, 'Mayorista') returning id`, [id]);
    await como(
      DUENO,
      `insert into vinculos (comercio_id, proveedor_id, codigo_proveedor, descripcion_proveedor, producto_id)
       select $1, $2, 'a1', 'Coca 2.25', id from productos`,
      [id, prov.id],
    );

    await como(DUENO, 'delete from rubros where id = $1', [rubro.id]);
    expect(await como(DUENO, 'select rubro_id from productos')).toEqual([{ rubro_id: null }]);
    await como(DUENO, 'delete from proveedores where id = $1', [prov.id]);
    expect(await como(DUENO, 'select count(*)::int as n from vinculos')).toEqual([{ n: 0 }]);
  });

  it('no se repiten el código interno ni el código de barras dentro del comercio', async () => {
    const id = await comercioConEmpleado();
    await expect(
      como(DUENO, `insert into productos (comercio_id, codigo_interno, descripcion, descripcion_normalizada, iva_pct) values ($1, 'p0001', 'Otra', 'otra', 2100)`, [id]),
    ).rejects.toThrow(/duplicate key/);
    await expect(
      como(
        DUENO,
        `insert into productos (comercio_id, codigo_interno, codigo_barras, descripcion, descripcion_normalizada, iva_pct) values ($1, 'P2', '7790895000997', 'Otra', 'otra', 2100)`,
        [id],
      ),
    ).rejects.toThrow(/duplicate key/);
  });
});
