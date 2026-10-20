import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  crearComercio,
  crearInvitacion,
  crearProveedor,
  guardarProducto,
  leerConfig,
  listarEquipo,
  listarProductos,
  analisisVentas,
  misComercios,
  productosParaVender,
  registrarVenta,
  resumenVentas,
  unirseConCodigo,
  ventasDelDia,
} from '../db';
import { diaDe } from '../domain/ventas';
import { CONFIG_SUGERIDA } from '../domain/config';
import { backendSupabase } from './supabase';

/**
 * Prueba contra el proyecto real de Supabase (el de .env.local), para ver que las migraciones están cargadas.
 * No corre con `npm test`: crea usuarios de verdad. Se corre a mano con:
 *   LISTAMATCH_PROBAR_SUPABASE=1 npx vitest run src/nube/supabase.integracion.test.ts
 * Deja dos usuarios "listamatch.prueba…@gmail.com" y un "Comercio de prueba" (con una venta): se borran desde el panel de Supabase.
 */

function env(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync('.env.local', 'utf8')
        .split(/\r?\n/)
        .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
        .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
    );
  } catch {
    return {};
  }
}

const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: clave } = env();
const correr = process.env.LISTAMATCH_PROBAR_SUPABASE === '1' && url && clave;

describe.skipIf(!correr)('Supabase real', () => {
  const nuevo = () => backendSupabase(createClient(url!, clave!, { auth: { persistSession: false } }));
  const marca = Date.now();

  it('dueño y empleado, de punta a punta', async () => {
    const dueno = nuevo();
    await dueno.registrarse(`listamatch.prueba.dueno.${marca}@gmail.com`, `Prueba-${marca}`);
    const comercioId = await crearComercio(dueno, { ...CONFIG_SUGERIDA, nombreComercio: 'Comercio de prueba' });
    const s = { backend: dueno, comercioId };
    expect(await leerConfig(s)).toMatchObject({ nombreComercio: 'Comercio de prueba' });
    await crearProveedor(s, 'Proveedor de prueba', false);
    await guardarProducto(s, {
      codigoInterno: 'P1',
      codigoBarras: '7790001000016',
      descripcion: 'Yerba 1 kg',
      rubroId: null,
      recargoPct: null,
      ivaPct: 2100,
      costoActual: 100_000,
      precioVentaActual: 160_000,
    });
    expect(await listarProductos(s)).toHaveLength(1);

    const { codigo } = await crearInvitacion(s);
    const empleado = nuevo();
    await empleado.registrarse(`listamatch.prueba.empleado.${marca}@gmail.com`, `Prueba-${marca}`);
    await unirseConCodigo(empleado, codigo, 'Empleado de prueba');
    expect(await misComercios(empleado)).toEqual([{ id: comercioId, nombre: 'Comercio de prueba', rol: 'empleado' }]);
    const se = { backend: empleado, comercioId };
    expect(await listarProductos(se)).toEqual([]);
    expect(await leerConfig(se)).toBeUndefined();
    expect((await listarEquipo(s)).miembros).toHaveLength(2);

    // Ventas (Fase 8): el empleado vende y el dueño ve el resumen.
    const [producto] = await productosParaVender(se);
    const venta = { id: crypto.randomUUID(), fecha: new Date().toISOString(), medioPago: 'efectivo' as const, lineas: [
      { productoId: producto!.id, descripcion: producto!.descripcion, cantidad: 2, precioUnitario: producto!.precioVentaActual },
    ] };
    expect((await registrarVenta(se, venta)).total).toBe(320_000);
    await registrarVenta(se, venta);
    expect(await ventasDelDia(se, diaDe(new Date()))).toHaveLength(1);
    const hoy = diaDe(new Date());
    expect(await resumenVentas(s, hoy, hoy)).toMatchObject({ totalTickets: 320_000, tickets: 1, articulos: 2 });

    // Análisis (Fase 9): ganancia sólo para el dueño; el empleado no lee las líneas con costo.
    const analisis = await analisisVentas(s, hoy, hoy);
    expect(analisis.ganancia.ventasConCosto).toBe(320_000);
    expect(analisis.productos).toHaveLength(1);
    await expect(analisisVentas(se, hoy, hoy)).rejects.toThrow();
    const { error } = await createClient(url!, clave!).from('venta_items').select('costo_unitario');
    expect(error).not.toBeNull();
  });
});
