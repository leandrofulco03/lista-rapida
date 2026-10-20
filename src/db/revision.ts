import type { Id } from '../domain/id';
import { decisionValida } from '../domain/revision';
import type { Cambio, Decision } from '../domain/revision';
import { aFila } from './filas';
import type { EstadoLinea, Sesion } from './tipos';

/**
 * F09: guarda lo que el comerciante aprobó. Es el único lugar que cambia precios a partir de una lista.
 * Cada producto aprobado toma el costo nuevo y el precio decidido, y queda un registro en el historial.
 * La importación queda guardada con sus líneas, aprobadas o no. Todo junto: si algo falla, no cambia nada.
 * El precio decidido puede ser el sugerido, el de antes o uno escrito a mano; tiene que ser mayor que cero.
 */
export interface DatosAplicar {
  proveedorId: Id;
  archivo: string;
  totalLineas: number;
  cambios: readonly Cambio[];
  decisiones: ReadonlyMap<Id, Decision>;
}

export interface ResultadoAplicar {
  importacionId: Id;
  actualizados: number;
}

export async function aplicarRevision(s: Sesion, datos: DatosAplicar): Promise<ResultadoAplicar> {
  for (const decision of datos.decisiones.values()) {
    if (!decisionValida(decision)) throw new Error('Hay un precio que no es válido. Revisalo antes de guardar.');
  }
  const aprobados = datos.cambios.flatMap((c) => {
    const decision = datos.decisiones.get(c.productoId);
    return decision ? [{ producto_id: c.productoId, costo: c.costoNuevo, precio: decision.precio }] : [];
  });
  const lineas = datos.cambios.map((c) => {
    const decision = datos.decisiones.get(c.productoId);
    const estado: EstadoLinea = decision ? 'aprobada' : 'ignorada';
    return aFila({
      filaOrigen: c.linea.filaOrigen,
      codigo: c.linea.codigo,
      descripcion: c.linea.descripcion,
      costo: c.costoNuevo,
      productoId: c.productoId,
      costoAnterior: c.costoAnterior,
      precioSugerido: c.precioSugerido,
      precioFinal: decision ? decision.precio : null,
      variacionPct: c.variacion,
      estado,
    });
  });
  const importacionId = await s.backend.rpc<Id>('aplicar_revision', {
    c: s.comercioId,
    proveedor: datos.proveedorId,
    archivo: datos.archivo,
    total_lineas: datos.totalLineas,
    vinculadas: datos.cambios.length,
    aprobados,
    lineas,
  });
  return { importacionId, actualizados: aprobados.length };
}

/** F10: productos a los que les cambió el precio en la última lista revisada (para imprimir sus etiquetas). */
export async function productosUltimaRevision(s: Sesion): Promise<Id[]> {
  return s.backend.rpc<Id[]>('productos_ultima_revision', { c: s.comercioId });
}
