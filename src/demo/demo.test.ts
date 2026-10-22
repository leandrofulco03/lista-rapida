import { describe, expect, it } from 'vitest';
import { crearComercio, crearInvitacion, historialCajas, leerGastos, listarClientes, listarStock, resumenVentas, unirseConCodigo } from '../db';
import { diaDe, sumarDias } from '../domain/ventas';
import { baseConMigraciones, usuarioNuevo } from '../nube/pruebas';
import { cargarDemo, CONFIG_DEMO } from './demo';

describe('comercio demo', () => {
  it('carga catálogo, ventas, clientes, cajas, stock y gastos con las funciones de la app', async () => {
    const pg = await baseConMigraciones();
    const b = await usuarioNuevo(pg, 'demo@prueba.com');
    const dueno = { backend: b, comercioId: await crearComercio(b, CONFIG_DEMO) };
    const e = await usuarioNuevo(pg, 'juan@prueba.com');
    await unirseConCodigo(e, (await crearInvitacion(dueno)).codigo, 'Juan');
    const empleado = { backend: e, comercioId: dueno.comercioId };

    // A las 15 de hoy, para que haya ventas a la mañana.
    const hoy = diaDe(new Date());
    const ahora = new Date(`${hoy}T15:00:00-03:00`);
    const r = await cargarDemo(dueno, empleado, { dias: 3, diasCaja: 2, ahora });
    expect(r.productos).toBeGreaterThan(30);
    expect(r.ventas).toBeGreaterThan(40);

    const resumen = await resumenVentas(dueno, sumarDias(hoy, -3), hoy);
    expect(resumen.tickets).toBe(r.ventas - r.anuladas);
    expect((await listarClientes(dueno)).length).toBe(5);
    expect((await listarStock(dueno)).length).toBe(13);
    expect((await leerGastos(dueno, `${hoy.slice(0, 7)}-01`)).every((g) => g.monto !== null)).toBe(true);
    // Las cajas de los días anteriores quedan cerradas.
    const cajas = await historialCajas(dueno, sumarDias(hoy, -2), hoy);
    expect(cajas.filter((k) => k.dia < hoy).every((k) => k.contado !== null)).toBe(true);
    expect(cajas.find((k) => k.dia === hoy)?.contado).toBeNull();
  }, 240_000);
});
