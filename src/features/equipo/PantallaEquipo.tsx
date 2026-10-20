import { useEffect, useState } from 'react';
import { anularInvitacion, codigoLegible, crearInvitacion, listarEquipo, quitarMiembro } from '../../db';
import type { Equipo, Miembro } from '../../db';
import { useSesion } from '../../sesion';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoProveedores } from '../../ui/Iconos';

interface Props {
  onVolver: () => void;
}

const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

/** Equipo del comercio: el dueño invita empleados con un código y los da de baja. */
export function PantallaEquipo({ onVolver }: Props) {
  const sesion = useSesion();
  const [equipo, setEquipo] = useState<Equipo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aQuitar, setAQuitar] = useState<Miembro | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  const cargar = () => listarEquipo(sesion).then(setEquipo, (e: Error) => setError(e.message));
  useEffect(() => {
    cargar();
  }, []);

  async function hacer(accion: () => Promise<unknown>) {
    setError(null);
    setTrabajando(true);
    try {
      await accion();
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado
        Icono={IconoProveedores}
        titulo="Equipo"
        descripcion="Los empleados sólo cargan ventas: no ven costos, proveedores ni los números del comercio."
      />

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Quiénes entran</h2>
        <ul className="mt-2 divide-y divide-stone-200 rounded-2xl border border-stone-200 bg-white shadow-sm" data-testid="miembros">
          {equipo?.miembros.map((m) => (
            <li key={m.usuarioId} className="flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-all">{m.nombre || m.email}</p>
                <p className="text-sm text-stone-600">
                  {m.rol === 'admin' ? 'Dueño' : 'Empleado'}
                  {m.nombre ? ` · ${m.email}` : ''}
                  {m.soyYo ? ' · Vos' : ''}
                </p>
              </div>
              {!m.soyYo && (
                <button type="button" onClick={() => setAQuitar(m)} className="min-h-11 px-2 font-semibold text-red-700">
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>
        {aQuitar && (
          <div className="mt-3 rounded-xl bg-red-50 p-3 text-red-950" role="alert">
            <p>
              ¿Quitar a <span className="font-semibold">{aQuitar.nombre || aQuitar.email}</span>? Ya no va a poder entrar a este comercio.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Boton type="button" variante="secundario" onClick={() => setAQuitar(null)}>
                No
              </Boton>
              <Boton
                type="button"
                variante="peligro"
                disabled={trabajando}
                onClick={() => hacer(() => quitarMiembro(sesion, aQuitar.usuarioId)).then(() => setAQuitar(null))}
              >
                Sí, quitar
              </Boton>
            </div>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Sumar un empleado</h2>
        <p className="mt-1 text-stone-600">
          Generá un código y pasáselo. Con él crea su cuenta y entra a este comercio. Sirve una vez y dura 7 días.
        </p>
        <Boton type="button" onClick={() => hacer(() => crearInvitacion(sesion))} disabled={trabajando} className="mt-3">
          Generar código
        </Boton>
        {equipo && equipo.invitaciones.length > 0 && (
          <ul className="mt-3 space-y-2" data-testid="invitaciones">
            {equipo.invitaciones.map((i) => (
              <li key={i.id} className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 p-3">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-2xl font-bold tracking-wider text-green-900" data-testid="codigo-invitacion">
                    {codigoLegible(i.codigo)}
                  </p>
                  <p className="text-sm text-green-800">Vence el {fechaCorta(i.vence)}</p>
                </div>
                <button type="button" onClick={() => hacer(() => anularInvitacion(sesion, i.id))} className="min-h-11 px-2 font-semibold text-stone-700">
                  Anular
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <p className="mt-4 text-red-700" role="alert">
          {error}
        </p>
      )}

      <Boton type="button" variante="secundario" onClick={onVolver} className="mt-8">
        Volver
      </Boton>
    </main>
  );
}
