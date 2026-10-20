import type { ConfigComercio } from '../domain/config';
import type { Id } from '../domain/id';
import type { Backend } from '../nube/backend';
import { configValida } from './config';
import type { Rol, Sesion } from './tipos';

/** Comercios y equipo: quién es dueño (admin) y quién empleado. */

export interface MiComercio {
  id: Id;
  nombre: string;
  rol: Rol;
}

/** Los comercios del usuario que inició sesión. */
export async function misComercios(backend: Backend): Promise<MiComercio[]> {
  return backend.rpc<MiComercio[]>('mis_comercios');
}

/** Crea el comercio con su configuración; quien lo crea queda como admin. */
export async function crearComercio(backend: Backend, config: ConfigComercio): Promise<Id> {
  const limpia = configValida(config);
  return backend.rpc<Id>('crear_comercio', { nombre: limpia.nombreComercio, config: limpia });
}

/** El código que pasó el dueño: 12 letras y números. Se aceptan espacios y guiones al escribirlo. */
export const limpiarCodigo = (codigo: string) => codigo.replace(/[\s-]/g, '').toUpperCase();

export async function unirseConCodigo(backend: Backend, codigo: string, nombre: string): Promise<Id> {
  const limpio = limpiarCodigo(codigo);
  if (!/^[0-9A-F]{12}$/.test(limpio)) throw new Error('El código tiene 12 letras y números. Revisalo.');
  return backend.rpc<Id>('unirse_con_codigo', { codigo: limpio, nombre: nombre.replace(/\s+/g, ' ').trim() });
}

export interface Miembro {
  usuarioId: Id;
  rol: Rol;
  nombre: string;
  email: string;
  soyYo: boolean;
}

export interface Invitacion {
  id: Id;
  codigo: string;
  rol: Rol;
  vence: string;
}

export interface Equipo {
  miembros: Miembro[];
  invitaciones: Invitacion[];
}

export async function listarEquipo(s: Sesion): Promise<Equipo> {
  return s.backend.rpc<Equipo>('listar_equipo', { c: s.comercioId });
}

export async function crearInvitacion(s: Sesion, rol: Rol = 'empleado'): Promise<Invitacion> {
  return s.backend.rpc<Invitacion>('crear_invitacion', { c: s.comercioId, rol });
}

export async function anularInvitacion(s: Sesion, id: Id): Promise<void> {
  await s.backend.rpc('anular_invitacion', { c: s.comercioId, id });
}

export async function quitarMiembro(s: Sesion, usuarioId: Id): Promise<void> {
  await s.backend.rpc('quitar_miembro', { c: s.comercioId, usuario: usuarioId });
}

/** El código en grupos de 4 para dictarlo o copiarlo: "041C 24D4 2B33". */
export const codigoLegible = (codigo: string) => codigo.replace(/(.{4})(?=.)/g, '$1 ');
