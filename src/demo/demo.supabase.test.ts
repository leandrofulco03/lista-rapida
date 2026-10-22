import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { crearComercio, crearInvitacion, unirseConCodigo } from '../db';
import { backendSupabase } from '../nube/supabase';
import { cargarDemo, CONFIG_DEMO } from './demo';

/**
 * Carga el comercio demo en el Supabase real (el de .env.local). No corre con `npm test`: crea cuentas de verdad.
 * Se corre a mano con:
 *   VENDIA_CARGAR_DEMO=1 npx vitest run src/demo/demo.supabase.test.ts
 * Crea la cuenta del dueño (VENDIA_DEMO_EMAIL) y la de un empleado ("Juan"), con la contraseña VENDIA_DEMO_CLAVE
 * (o una al azar, que se muestra al final). Para borrarlo: borrar los dos usuarios desde el panel de Supabase
 * (Authentication → Users) y el comercio "Kiosco El Pibe (demo)" (Table Editor → comercios).
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

const correr = process.env.VENDIA_CARGAR_DEMO === '1';

describe.skipIf(!correr)('cargar el demo en Supabase', () => {
  it('crea el kiosco demo con su empleado', async () => {
    const { VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: clave } = env();
    if (!url || !clave) throw new Error('Falta .env.local con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
    const email = process.env.VENDIA_DEMO_EMAIL;
    if (!email) throw new Error('Falta VENDIA_DEMO_EMAIL: el email de la cuenta del dueño del demo.');
    const [usuario, dominio] = email.split('@');
    const emailEmpleado = process.env.VENDIA_DEMO_EMAIL_EMPLEADO ?? `${usuario}+empleado@${dominio}`;
    const contrasena = process.env.VENDIA_DEMO_CLAVE ?? `demo-${crypto.randomUUID().slice(0, 8)}`;

    const cliente = () => createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
    const b = backendSupabase(cliente());
    await b.registrarse(email, contrasena);
    const dueno = { backend: b, comercioId: await crearComercio(b, CONFIG_DEMO) };
    const e = backendSupabase(cliente());
    await e.registrarse(emailEmpleado, contrasena);
    await unirseConCodigo(e, (await crearInvitacion(dueno)).codigo, 'Juan');
    const empleado = { backend: e, comercioId: dueno.comercioId };

    const r = await cargarDemo(dueno, empleado, { dias: 35, diasCaja: 14, enParalelo: 6, avisar: (t) => console.log(t) });
    console.log(`\nDemo cargado.\n  Dueño:    ${email}\n  Empleado: ${emailEmpleado}\n  Contraseña (las dos): ${contrasena}\n`);
    expect(r.ventas).toBeGreaterThan(500);
  }, 1_800_000);
});
