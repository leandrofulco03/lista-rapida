import type { PGliteInterface } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { detectarColumnasCatalogo, extraerProductosCatalogo } from '../domain/catalogo';
import type { DatosProducto, ProductoArchivo } from '../domain/catalogo';
import type { MapeoColumnas } from '../domain/columnas';
import { CONFIG_SUGERIDA } from '../domain/config';
import type { ConfigComercio } from '../domain/config';
import type { Id } from '../domain/id';
import type { LineaLista } from '../domain/lineaLista';
import { armarRevision } from '../domain/revision';
import { leerRespaldo, TABLAS_RESPALDO } from '../domain/respaldo';
import { IndiceCatalogo, vincularLinea } from '../domain/vinculacion';
import type { Backend } from '../nube/backend';
import { baseConMigraciones, contar, usuarioNuevo } from '../nube/pruebas';
import { leerArchivo } from '../parsers';
import {
  actualizarProveedor,
  anularInvitacion,
  aplicarRevision,
  borrarProducto,
  borrarProveedor,
  borrarRubro,
  crearComercio,
  crearInvitacion,
  crearProveedor,
  darDeAltaDesdeLista,
  filtrarProductos,
  guardarConfig,
  guardarLecturaProveedor,
  guardarProducto,
  guardarRubro,
  guardarVinculos,
  importarCatalogo,
  importarRespaldo,
  leerConfig,
  listarEquipo,
  listarProductos,
  listarProveedores,
  listarRubros,
  misComercios,
  olvidarColumnas,
  productosUltimaRevision,
  proponerCodigo,
  quitarMiembro,
  unirseConCodigo,
  vinculosDeProveedor,
} from '.';
import type { Sesion } from '.';

/**
 * Capa de datos contra el mismo esquema de Supabase, en un Postgres embebido.
 * Cada prueba arranca con un comercio nuevo, con el dueño (admin) con sesión iniciada.
 */

const CONFIG: ConfigComercio = { ...CONFIG_SUGERIDA, nombreComercio: 'Almacén' }; // recargo 30%, redondeo a $10, venta con IVA

let base: PGliteInterface;
let pg: PGliteInterface;
let dueno: Backend;
let s: Sesion;

beforeAll(async () => {
  base = await baseConMigraciones();
}, 60_000);

beforeEach(async () => {
  pg = await base.clone();
  dueno = await usuarioNuevo(pg, 'dueno@prueba.com');
  s = { backend: dueno, comercioId: await crearComercio(dueno, CONFIG) };
});

/** Una fila de la base, sin reglas de acceso (para mirar lo que quedó guardado). */
async function fila<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
  return (await pg.query<T>(sql, params)).rows[0];
}

const yerba: DatosProducto = {
  codigoInterno: ' A1 ',
  descripcion: 'Yerba  Playadito 1 kg',
  rubroId: null,
  recargoPct: null,
  ivaPct: 2100,
  costoActual: 345_000,
  precioVentaActual: 549_000,
};

const producto = (codigoInterno: string, descripcion: string, extra: Partial<DatosProducto> = {}) =>
  guardarProducto(s, { ...yerba, codigoInterno, descripcion, ...extra });

const linea = (fila: number, codigo: string | null, descripcion: string, costo = 100_000): LineaLista => ({
  codigo,
  descripcion,
  presentacion: null,
  costo,
  ivaIncluido: null,
  filaOrigen: fila,
});

describe('comercio y configuración (F01)', () => {
  it('quien crea el comercio queda como admin, con la configuración limpia', async () => {
    expect(await misComercios(dueno)).toEqual([{ id: s.comercioId, nombre: 'Almacén', rol: 'admin' }]);
    expect(await leerConfig(s)).toEqual(CONFIG);
    await guardarConfig(s, { ...CONFIG, nombreComercio: '  Kiosco  Luli ', recargoGeneral: 4000 });
    expect(await leerConfig(s)).toEqual({ ...CONFIG, nombreComercio: 'Kiosco Luli', recargoGeneral: 4000 });
    expect(await misComercios(dueno)).toEqual([expect.objectContaining({ nombre: 'Kiosco Luli' })]);
  });

  it('no guarda una configuración inválida', async () => {
    await expect(guardarConfig(s, { ...CONFIG, nombreComercio: '' })).rejects.toThrow('Configuración inválida');
    await expect(crearComercio(dueno, { ...CONFIG, recargoGeneral: -1 })).rejects.toThrow('Configuración inválida');
    expect(await leerConfig(s)).toEqual(CONFIG);
  });
});

describe('equipo', () => {
  it('el empleado entra con el código, ve el comercio pero no la configuración ni los precios', async () => {
    const invitacion = await crearInvitacion(s);
    const empleado = await usuarioNuevo(pg, 'empleado@prueba.com');
    expect(await misComercios(empleado)).toEqual([]);
    await expect(unirseConCodigo(empleado, 'ABC', 'Juan')).rejects.toThrow('12 letras');
    // Se acepta con espacios y minúsculas, como lo dicta el dueño.
    const legible = invitacion.codigo.toLowerCase().replace(/(.{4})/g, '$1 ');
    expect(await unirseConCodigo(empleado, legible, '  Juan  ')).toBe(s.comercioId);
    expect(await misComercios(empleado)).toEqual([{ id: s.comercioId, nombre: 'Almacén', rol: 'empleado' }]);

    const se = { backend: empleado, comercioId: s.comercioId };
    expect(await leerConfig(se)).toBeUndefined();
    await producto('A1', 'Yerba');
    expect(await listarProductos(se)).toEqual([]);
    await expect(producto('B1', 'Otra').then(() => guardarProducto(se, { ...yerba, codigoInterno: 'X' }))).rejects.toThrow();
    expect(await contar(pg, 'productos')).toBe(2);

    const equipo = await listarEquipo(s);
    expect(equipo.miembros.map((m) => [m.email, m.rol, m.nombre, m.soyYo])).toEqual([
      ['dueno@prueba.com', 'admin', '', true],
      ['empleado@prueba.com', 'empleado', 'Juan', false],
    ]);
    expect(equipo.invitaciones).toEqual([]);
  });

  it('el código se usa una vez y se puede anular; el admin quita empleados pero no a sí mismo', async () => {
    const a = await crearInvitacion(s);
    const b = await crearInvitacion(s);
    expect((await listarEquipo(s)).invitaciones.map((i) => i.codigo).sort()).toEqual([a.codigo, b.codigo].sort());
    await anularInvitacion(s, b.id);
    const empleado = await usuarioNuevo(pg, 'empleado@prueba.com');
    await expect(unirseConCodigo(empleado, b.codigo, '')).rejects.toThrow('no es válido');
    await unirseConCodigo(empleado, a.codigo, '');
    const otro = await usuarioNuevo(pg, 'otro@prueba.com');
    await expect(unirseConCodigo(otro, a.codigo, '')).rejects.toThrow('no es válido');

    // El empleado no genera códigos ni quita a nadie.
    const se = { backend: empleado, comercioId: s.comercioId };
    await expect(crearInvitacion(se)).rejects.toThrow();
    const yo = (await dueno.usuario())!.id;
    await expect(quitarMiembro(se, yo)).rejects.toThrow('No se pudo');
    await expect(quitarMiembro(s, yo)).rejects.toThrow('No se pudo');

    const idEmpleado = (await empleado.usuario())!.id;
    await quitarMiembro(s, idEmpleado);
    expect(await misComercios(empleado)).toEqual([]);
  });

  it('otro comercio no ve nada del primero', async () => {
    await producto('A1', 'Yerba');
    const otro = await usuarioNuevo(pg, 'otro@prueba.com');
    const so = { backend: otro, comercioId: s.comercioId };
    expect(await listarProductos(so)).toEqual([]);
    expect(await leerConfig(so)).toBeUndefined();
    await expect(crearProveedor(so, 'Intruso', false)).rejects.toThrow();
  });
});

describe('rubros y productos (F03)', () => {
  it('los rubros no repiten nombre; al borrar uno, sus productos quedan sin rubro', async () => {
    const almacen = await guardarRubro(s, { nombre: 'Almacén', recargoPct: 3500 });
    await expect(guardarRubro(s, { nombre: 'almacen', recargoPct: null })).rejects.toThrow('Ya existe el rubro Almacén');
    await guardarRubro(s, { nombre: 'Almacén de ramos', recargoPct: null });
    expect((await guardarRubro(s, { nombre: 'Almacén ', recargoPct: 4000 }, almacen.id)).recargoPct).toBe(4000);
    const p = await guardarProducto(s, { ...yerba, rubroId: almacen.id });
    await borrarRubro(s, almacen.id);
    expect((await listarRubros(s)).map((r) => r.nombre)).toEqual(['Almacén de ramos']);
    expect((await listarProductos(s)).find((x) => x.id === p.id)?.rubroId).toBeNull();
  });

  it('guarda limpio, con la descripción normalizada, y no repite códigos', async () => {
    const guardado = await guardarProducto(s, yerba);
    expect(guardado).toMatchObject({ codigoInterno: 'A1', descripcion: 'Yerba Playadito 1 kg', descripcionNormalizada: 'yerba playadito 1000g', codigoBarras: null });
    await expect(guardarProducto(s, { ...yerba, codigoInterno: 'a1', descripcion: 'Otra' })).rejects.toThrow('El código a1 ya es de Yerba Playadito 1 kg.');
    // Editarse a sí mismo no choca con su propio código.
    await guardarProducto(s, { ...yerba, precioVentaActual: 600_000 }, guardado.id);
    expect((await listarProductos(s)).map((p) => p.precioVentaActual)).toEqual([600_000]);
  });

  it('código de barras: válido, sin repetir, y editar sin mandarlo no lo borra', async () => {
    await expect(guardarProducto(s, { ...yerba, codigoBarras: '12a' })).rejects.toThrow('de 6 a 14 números');
    const p = await guardarProducto(s, { ...yerba, codigoBarras: ' 7790387 000014 ' });
    expect(p.codigoBarras).toBe('7790387000014');
    await expect(producto('B1', 'Otra', { codigoBarras: '7790387000014' })).rejects.toThrow(
      'El código de barras 7790387000014 ya es de Yerba Playadito 1 kg.',
    );
    await guardarProducto(s, { ...yerba, precioVentaActual: 1 }, p.id);
    expect((await listarProductos(s))[0]!.codigoBarras).toBe('7790387000014');
    await guardarProducto(s, { ...yerba, codigoBarras: null }, p.id);
    expect((await listarProductos(s))[0]!.codigoBarras).toBeNull();
  });

  it('busca por palabras sueltas, código o código de barras, sin acentos', async () => {
    await guardarProducto(s, yerba);
    await producto('B7', 'Café molido 250 g', { codigoBarras: '7790001' });
    const productos = await listarProductos(s);
    expect(filtrarProductos(productos, 'cafe 250').map((p) => p.codigoInterno)).toEqual(['B7']);
    expect(filtrarProductos(productos, 'a1').map((p) => p.codigoInterno)).toEqual(['A1']);
    expect(filtrarProductos(productos, '7790001').map((p) => p.codigoInterno)).toEqual(['B7']);
    expect(filtrarProductos(productos, '')).toHaveLength(2);
  });

  it('al borrar un producto se borran sus vínculos; propone el próximo código libre', async () => {
    const p = await producto('P0001', 'Yerba');
    const { id: proveedor } = await crearProveedor(s, 'El Sol', false);
    await guardarVinculos(s, proveedor, [{ codigo: 'X', descripcion: 'Yerba', productoId: p.id }]);
    expect(await proponerCodigo(s)).toBe('P0002');
    await borrarProducto(s, p.id);
    expect(await contar(pg, 'vinculos')).toBe(0);
    expect(await contar(pg, 'productos')).toBe(0);
  });
});

describe('importarCatalogo (F03)', () => {
  const archivo = (p: Partial<ProductoArchivo>): ProductoArchivo => ({
    codigo: null,
    descripcion: 'Producto',
    rubro: null,
    costo: null,
    precioVenta: null,
    ivaPct: null,
    filaOrigen: 1,
    ...p,
  });

  it('crea rubros, calcula el precio desde el costo y da códigos a los que no traen', async () => {
    const resultado = await importarCatalogo(
      s,
      [
        archivo({ codigo: 'A1', descripcion: 'Yerba 1 kg', rubro: 'Almacén', costo: 100_000, precioVenta: 170_000 }),
        // $ 1.000 + IVA 21% + recargo 30% = $ 1.573 → redondeo a $10: $ 1.580.
        archivo({ descripcion: 'Arroz 1 kg', rubro: 'almacen', costo: 100_000 }),
        archivo({ descripcion: 'Pan', rubro: 'Panadería', ivaPct: 1050 }),
      ],
      CONFIG,
    );
    expect(resultado).toEqual({ creados: 3, actualizados: 0, rubrosCreados: 2 });
    expect((await listarProductos(s)).map((p) => [p.codigoInterno, p.descripcion, p.costoActual, p.precioVentaActual, p.ivaPct])).toEqual([
      ['P0001', 'Arroz 1 kg', 100_000, 158_000, 2100],
      ['P0002', 'Pan', 0, 0, 1050],
      ['A1', 'Yerba 1 kg', 100_000, 170_000, 2100],
    ]);
    expect((await listarRubros(s)).map((r) => r.nombre)).toEqual(['Almacén', 'Panadería']);
  });

  it('actualiza los que ya existen por código o, sin código, por descripción', async () => {
    const guardada = await guardarProducto(s, { ...yerba, recargoPct: 5000, codigoBarras: '7790001' });
    await producto('X9', 'Pan lactal');
    const resultado = await importarCatalogo(
      s,
      [archivo({ codigo: 'a1', descripcion: 'Yerba Playadito 1 kg nueva', precioVenta: 600_000 }), archivo({ descripcion: 'PAN LACTAL', precioVenta: 250_000 })],
      CONFIG,
    );
    expect(resultado).toEqual({ creados: 0, actualizados: 2, rubrosCreados: 0 });
    const productos = await listarProductos(s);
    // Se conservan el costo, el recargo propio y el código de barras, que no vinieron en el archivo.
    expect(productos.find((p) => p.id === guardada.id)).toMatchObject({
      codigoInterno: 'a1',
      descripcion: 'Yerba Playadito 1 kg nueva',
      costoActual: 345_000,
      recargoPct: 5000,
      precioVentaActual: 600_000,
      codigoBarras: '7790001',
    });
    expect(productos.find((p) => p.codigoInterno === 'X9')?.precioVentaActual).toBe(250_000);
  });

  it('carga 500 productos desde un Excel (condición de F03)', async () => {
    const carpeta = join(__dirname, '../../tests/fixtures/catalogo');
    const esperado = JSON.parse(readFileSync(join(carpeta, 'catalogo-500.xlsx.esperado.json'), 'utf-8'));
    const tabla = await leerArchivo('catalogo-500.xlsx', new Uint8Array(readFileSync(join(carpeta, 'catalogo-500.xlsx'))));
    const { mapeo, confianza } = detectarColumnasCatalogo(tabla.filas);
    expect(confianza).toBe('alta');
    const { productos, salteadas } = extraerProductosCatalogo(tabla.filas, mapeo!);
    expect(salteadas).toEqual([]);
    expect(await importarCatalogo(s, productos, CONFIG)).toEqual({ creados: esperado.productos, actualizados: 0, rubrosCreados: esperado.rubros });
    const guardados = await listarProductos(s);
    expect(guardados).toHaveLength(500);
    expect(guardados.filter((p) => /^P\d{4}$/.test(p.codigoInterno))).toHaveLength(esperado.sinCodigo);
    expect(guardados.reduce((t, p) => t + p.precioVentaActual, 0)).toBe(esperado.sumaPrecioVenta);
    expect(new Set(guardados.map((p) => p.ivaPct))).toEqual(new Set([2100, 1050]));
  });
});

describe('proveedores (F02, F06)', () => {
  const MAPEO: MapeoColumnas = {
    filaEncabezado: 3,
    codigo: 0,
    descripcion: 1,
    costo: 3,
    presentacion: 2,
    titulos: { codigo: 'codigo', descripcion: 'descripcion', costo: 'precio', presentacion: 'presentacion' },
  } as MapeoColumnas;

  it('crea sin duplicar nombres y lista por nombre', async () => {
    const a = await crearProveedor(s, '  Mayorista   Norte ', false);
    await crearProveedor(s, 'Distribuidora El Sol', true);
    expect((await crearProveedor(s, 'mayorista norte', true)).id).toBe(a.id);
    const lista = await listarProveedores(s);
    expect(lista.map((p) => p.nombre)).toEqual(['Distribuidora El Sol', 'Mayorista Norte']);
    expect(lista[1]).toMatchObject({ mapeoColumnas: null, listaIncluyeIva: false, descuentosPct: [] });
    await expect(crearProveedor(s, '   ', false)).rejects.toThrow('Escribí el nombre');
    await expect(crearProveedor(s, 'x'.repeat(61), false)).rejects.toThrow('hasta 60');
  });

  it('recuerda y olvida las columnas; edita la ficha sin repetir nombres', async () => {
    const { id } = await crearProveedor(s, 'El Sol', false);
    await crearProveedor(s, 'Norte', false);
    await guardarLecturaProveedor(s, id, MAPEO, true);
    expect((await listarProveedores(s))[0]).toMatchObject({ mapeoColumnas: MAPEO, listaIncluyeIva: true });
    await expect(guardarLecturaProveedor(s, crypto.randomUUID(), MAPEO, true)).rejects.toThrow('No encontramos');
    await olvidarColumnas(s, id);
    expect((await listarProveedores(s))[0]).toMatchObject({ mapeoColumnas: null, listaIncluyeIva: true });

    const editado = await actualizarProveedor(s, id, { nombre: ' El Sol S.A. ', listaIncluyeIva: false, descuentosPct: [1000, 500] });
    expect(editado).toMatchObject({ nombre: 'El Sol S.A.', listaIncluyeIva: false, descuentosPct: [1000, 500] });
    await expect(actualizarProveedor(s, id, { nombre: 'norte', listaIncluyeIva: true, descuentosPct: [] })).rejects.toThrow('Ya existe el proveedor norte');
    await expect(actualizarProveedor(s, id, { nombre: 'El Sol', listaIncluyeIva: true, descuentosPct: [10_000] })).rejects.toThrow('entre 0% y 100%');
  });
});

describe('vínculos (F07)', () => {
  it('guarda por código o por descripción, los cambia sin duplicar, y se borran con el proveedor', async () => {
    const [p1, p2, p3, p4, p5] = await Promise.all(['1', '2', '3', '4', '5'].map((n) => producto(`C${n}`, `Producto ${n}`)));
    const sol = await crearProveedor(s, 'El Sol', false);
    const luna = await crearProveedor(s, 'La Luna', false);
    await guardarVinculos(s, sol.id, [
      { codigo: 'AB-1', descripcion: 'Yerba', productoId: p1!.id },
      { codigo: null, descripcion: 'Aceite 1 LT', productoId: p2!.id },
    ]);
    await guardarVinculos(s, sol.id, [
      { codigo: 'ab-1', descripcion: 'Yerba nueva', productoId: p3!.id },
      { codigo: 'C', descripcion: 'x', productoId: p4!.id },
      { codigo: 'C', descripcion: 'x', productoId: p5!.id },
    ]);
    await guardarVinculos(s, luna.id, [{ codigo: 'A', descripcion: 'a', productoId: p1!.id }]);
    expect(await vinculosDeProveedor(s, sol.id)).toEqual(
      new Map([
        ['ab-1', p3!.id],
        ['c', p5!.id],
        ['desc:aceite 1000ml', p2!.id],
      ]),
    );
    await borrarProveedor(s, sol.id);
    expect(await vinculosDeProveedor(s, sol.id)).toEqual(new Map());
    expect(await vinculosDeProveedor(s, luna.id)).toEqual(new Map([['a', p1!.id]]));
  });

  it('desde la segunda lista, el 85% se vincula solo (con y sin códigos)', async () => {
    const casos = JSON.parse(readFileSync(join(__dirname, '../../tests/fixtures/vinculacion/casos.json'), 'utf-8')) as {
      catalogo: string[];
      lineas: { descripcion: string; esperado: number | null }[];
    };
    await importarCatalogo(
      s,
      casos.catalogo.map((descripcion, i) => ({ codigo: `P${i}`, descripcion, rubro: null, costo: 100_00, precioVenta: 150_00, ivaPct: null, filaOrigen: i + 2 })),
      CONFIG,
    );
    const productos = await listarProductos(s);
    const porCodigo = new Map(productos.map((p) => [p.codigoInterno, p.id]));
    const idDe = (posicion: number) => porCodigo.get(`P${posicion}`)!;

    for (const conCodigo of [true, false]) {
      const { id } = await crearProveedor(s, conCodigo ? 'Con códigos' : 'Sin códigos', false);
      await guardarVinculos(
        s,
        id,
        casos.lineas.flatMap((l, i) =>
          l.esperado === null ? [] : [{ codigo: conCodigo ? `C${i}` : null, descripcion: l.descripcion, productoId: idDe(l.esperado) }],
        ),
      );
      const segunda = [
        ...casos.lineas.slice(3).map((l, i) => ({ codigo: conCodigo ? `C${i + 3}` : null, descripcion: l.descripcion })),
        { codigo: conCodigo ? 'N1' : null, descripcion: 'Fernet Branca 750 cc' },
        { codigo: conCodigo ? 'N2' : null, descripcion: 'Yerba Playadito Suave 1 kg' },
        { codigo: conCodigo ? 'N3' : null, descripcion: 'Arroz Gallo Oro 500 g' },
        { codigo: conCodigo ? 'N4' : null, descripcion: 'Pan rallado Preferido 500 g' },
      ];
      const vinculados = await vinculosDeProveedor(s, id);
      const indice = new IndiceCatalogo(productos);
      const solas = segunda.map((l) => vincularLinea(l, vinculados, indice)).filter((r) => r.estado === 'vinculada').length;
      // Las que el comercio tiene: todas menos las 9 que no tiene y las 4 nuevas.
      expect(solas / (segunda.length - 9 - 4)).toBeGreaterThanOrEqual(0.85);
    }
  });
});

describe('alta desde la lista (F07/F03)', () => {
  it('crea los productos sin costo ni precio, vinculados a la línea del proveedor', async () => {
    await producto('E2', 'Otro');
    const { id: proveedorId } = await crearProveedor(s, 'El Sol', false);
    const lineas = [linea(2, 'E1', 'Fernet Branca 750 cc'), linea(3, 'E2', 'Gancia 950 cc'), linea(4, null, 'Pan rallado Preferido 500 g')];
    const creados = await darDeAltaDesdeLista(s, proveedorId, lineas, 1050);
    expect(creados.map((p) => [p.codigoInterno, p.descripcion, p.costoActual, p.precioVentaActual, p.ivaPct, p.rubroId])).toEqual([
      ['E1', 'Fernet Branca 750 cc', 0, 0, 1050, null],
      ['P0001', 'Gancia 950 cc', 0, 0, 1050, null], // "E2" ya era de otro producto
      ['P0002', 'Pan rallado Preferido 500 g', 0, 0, 1050, null],
    ]);
    expect(await contar(pg, 'productos')).toBe(4);
    expect(await contar(pg, 'historial_precios')).toBe(0);
    const vinculados = await vinculosDeProveedor(s, proveedorId);
    const indice = new IndiceCatalogo(await listarProductos(s));
    expect(lineas.map((l) => vincularLinea(l, vinculados, indice))).toEqual(creados.map((p) => ({ estado: 'vinculada', productoId: p.id, opciones: [] })));
  });

  it('una línea repetida crea un solo producto; deshacer borra el producto y su vínculo', async () => {
    const { id: proveedorId } = await crearProveedor(s, 'El Sol', false);
    const creados = await darDeAltaDesdeLista(s, proveedorId, [linea(2, null, 'Yerba 1 kg'), linea(3, null, 'YERBA 1000 GRS')], 2100);
    expect(creados[0]!.id).toBe(creados[1]!.id);
    expect(await contar(pg, 'productos')).toBe(1);
    expect(await contar(pg, 'vinculos')).toBe(1);
    await borrarProducto(s, creados[0]!.id);
    expect(await vinculosDeProveedor(s, proveedorId)).toEqual(new Map());
  });
});

describe('revisión de precios (F09)', () => {
  async function preparar() {
    const { id: proveedorId } = await crearProveedor(s, 'El Sol', false);
    const datos = { rubroId: null, recargoPct: null, ivaPct: 2100, precioVentaActual: 160_000, costoActual: 100_000 };
    const y = await guardarProducto(s, { ...datos, codigoInterno: 'Y', descripcion: 'Yerba' });
    const a = await guardarProducto(s, { ...datos, codigoInterno: 'A', descripcion: 'Aceite' });
    const productos = await listarProductos(s);
    const { cambios } = armarRevision({
      lineas: [
        { linea: linea(1, null, 'L1', 110_000), productoId: y.id },
        { linea: linea(2, null, 'L2', 90_000), productoId: a.id },
      ],
      productos: new Map(productos.map((p) => [p.id, p])),
      recargosRubro: new Map(),
      vinculadosAntes: new Set(),
      listaIncluyeIva: false,
      descuentos: [],
      config: CONFIG,
    });
    return { proveedorId, y, a, cambios };
  }

  it('guarda sólo lo aprobado, con historial, y deja la importación con todas sus líneas', async () => {
    const { proveedorId, y, a, cambios } = await preparar();
    expect(cambios.find((c) => c.productoId === y.id)!.precioSugerido).toBe(174_000);
    // El precio elegido se guarda aunque quede bajo el costo (lo decide el comerciante).
    const decisiones = new Map<Id, { precio: number }>([[y.id, { precio: 129_999 }]]);
    const resultado = await aplicarRevision(s, { proveedorId, archivo: 'el-sol.xlsx', totalLineas: 2, cambios, decisiones });
    expect(resultado.actualizados).toBe(1);
    const productos = await listarProductos(s);
    expect(productos.find((p) => p.id === y.id)).toMatchObject({ costoActual: 110_000, precioVentaActual: 129_999 });
    expect(productos.find((p) => p.id === a.id)).toMatchObject({ costoActual: 100_000, precioVentaActual: 160_000 });
    expect(await fila('select producto_id, proveedor_id, costo, precio_venta from historial_precios')).toEqual({
      producto_id: y.id,
      proveedor_id: proveedorId,
      costo: 110_000,
      precio_venta: 129_999,
    });
    expect(await fila('select archivo_nombre, total_lineas, estado from importaciones where id = $1', [resultado.importacionId])).toEqual({
      archivo_nombre: 'el-sol.xlsx',
      total_lineas: 2,
      estado: 'aprobada',
    });
    const lineas = (await pg.query('select producto_id, estado, precio_sugerido, precio_final, variacion_pct from lineas_importacion order by fila_origen')).rows;
    expect(lineas).toEqual([
      { producto_id: y.id, estado: 'aprobada', precio_sugerido: 174_000, precio_final: 129_999, variacion_pct: 1000 },
      { producto_id: a.id, estado: 'ignorada', precio_sugerido: cambios.find((c) => c.productoId === a.id)!.precioSugerido, precio_final: null, variacion_pct: -1000 },
    ]);
    expect(await productosUltimaRevision(s)).toEqual([y.id]);
  });

  it('un precio en cero o con fracción de centavo no se guarda: no cambia nada', async () => {
    const { proveedorId, y, cambios } = await preparar();
    for (const precio of [0, -10, 100.5]) {
      await expect(
        aplicarRevision(s, { proveedorId, archivo: 'x.csv', totalLineas: 1, cambios, decisiones: new Map([[y.id, { precio }]]) }),
      ).rejects.toThrow('no es válido');
    }
    // Aunque la app se saltee su control, la base tampoco lo acepta.
    await expect(
      dueno.rpc('aplicar_revision', {
        c: s.comercioId,
        proveedor: proveedorId,
        archivo: 'x',
        total_lineas: 1,
        vinculadas: 1,
        aprobados: [{ producto_id: y.id, costo: 1, precio: 0 }],
        lineas: [],
      }),
    ).rejects.toThrow('no es válido');
    expect((await listarProductos(s)).find((p) => p.id === y.id)).toMatchObject({ costoActual: 100_000, precioVentaActual: 160_000 });
    expect(await contar(pg, 'historial_precios')).toBe(0);
    expect(await contar(pg, 'importaciones')).toBe(0);
    expect(await productosUltimaRevision(s)).toEqual([]);
  });
});

describe('datos de la versión anterior', () => {
  /** Una copia de la v1 como la generaba la app (ids numéricos). */
  const copiaV1 = {
    app: 'lista-rapida',
    formato: 1,
    version: 2,
    fecha: '2026-10-12T12:00:00.000Z',
    tablas: {
      config: [{ id: 'comercio', nombreComercio: 'Almacén viejo', recargoGeneral: 4000, redondeo: { tipo: 'terminado', en: 90 }, ventaIncluyeIva: true, ivaDefault: 2100, ultimoRespaldo: null }],
      rubros: [{ id: 1, nombre: 'Almacén', recargoPct: 3500 }],
      proveedores: [{ id: 1, nombre: 'El Sol', mapeoColumnas: null, listaIncluyeIva: true, descuentosPct: [1000], creado: '2026-10-01T00:00:00.000Z' }],
      productos: [
        { id: 1, codigoInterno: 'Y1', descripcion: 'Yerba 1 kg', descripcionNormalizada: 'x', rubroId: 1, recargoPct: null, ivaPct: 2100, costoActual: 100_000, precioVentaActual: 170_000, actualizado: '2026-10-10T00:00:00.000Z' },
        { id: 2, codigoInterno: 'A1', descripcion: 'Aceite 1,5 Lt', descripcionNormalizada: 'x', rubroId: null, recargoPct: 2000, ivaPct: 2100, costoActual: 200_000, precioVentaActual: 290_000, actualizado: '2026-10-10T00:00:00.000Z' },
      ],
      vinculos: [
        { id: 1, proveedorId: 1, codigoProveedor: 'ab-1', descripcionProveedor: 'YERBA 1KG', productoId: 1, confirmado: true },
        { id: 2, proveedorId: 1, codigoProveedor: 'zz', descripcionProveedor: 'Borrado', productoId: 99, confirmado: true },
      ],
      importaciones: [{ id: 1, proveedorId: 1, archivoNombre: 'sol.xlsx', fecha: '2026-10-10T00:00:00.000Z', totalLineas: 1, vinculadas: 1, estado: 'aprobada' }],
      lineasImportacion: [
        { id: 1, importacionId: 1, filaOrigen: 2, codigo: 'AB-1', descripcion: 'YERBA 1KG', costo: 100_000, productoId: 1, costoAnterior: 90_000, precioSugerido: 170_000, precioFinal: 170_000, variacionPct: 1111, estado: 'aprobada' },
      ],
      historialPrecios: [{ id: 1, productoId: 1, proveedorId: 1, fecha: '2026-10-10T00:00:00.000Z', costo: 100_000, precioVenta: 170_000 }],
    },
  };

  it('reemplaza la sección Precios por la copia, con ids nuevos y las referencias en su lugar', async () => {
    await producto('VIEJO', 'Se va');
    const lectura = leerRespaldo(JSON.stringify(copiaV1));
    expect(lectura.ok).toBe(true);
    if (!lectura.ok) return;
    await importarRespaldo(s, lectura.respaldo, 'Almacén');

    // Se queda con el nombre de ahora; trae el resto de la configuración.
    expect(await leerConfig(s)).toEqual({ nombreComercio: 'Almacén', recargoGeneral: 4000, redondeo: { tipo: 'terminado', en: 90 }, ventaIncluyeIva: true, ivaDefault: 2100 });
    const productos = await listarProductos(s);
    expect(productos.map((p) => [p.codigoInterno, p.descripcionNormalizada])).toEqual([
      ['A1', 'aceite 1500ml'],
      ['Y1', 'yerba 1000g'],
    ]);
    const [rubro] = await listarRubros(s);
    expect(productos.find((p) => p.codigoInterno === 'Y1')?.rubroId).toBe(rubro!.id);
    const [proveedor] = await listarProveedores(s);
    expect(proveedor).toMatchObject({ nombre: 'El Sol', listaIncluyeIva: true, descuentosPct: [1000] });
    // El vínculo a un producto que ya no existía se deja afuera.
    expect(await vinculosDeProveedor(s, proveedor!.id)).toEqual(new Map([['ab-1', productos.find((p) => p.codigoInterno === 'Y1')!.id]]));
    expect(await productosUltimaRevision(s)).toEqual([productos.find((p) => p.codigoInterno === 'Y1')!.id]);
    expect(await contar(pg, 'historial_precios')).toBe(1);
  });

  it('un empleado no puede traer la copia', async () => {
    const lectura = leerRespaldo(JSON.stringify(copiaV1));
    if (!lectura.ok) throw new Error(lectura.error);
    const invitacion = await crearInvitacion(s);
    const empleado = await usuarioNuevo(pg, 'empleado@prueba.com');
    await unirseConCodigo(empleado, invitacion.codigo, '');
    await expect(importarRespaldo({ backend: empleado, comercioId: s.comercioId }, lectura.respaldo, 'X')).rejects.toThrow('Sólo el dueño');
  });

  it('todas las tablas de la copia se llevan', () => {
    expect(Object.keys(copiaV1.tablas).sort()).toEqual([...TABLAS_RESPALDO].sort());
  });
});
