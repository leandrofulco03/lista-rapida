import type { Cambio, Decision } from '../domain/revision';
import type { BaseListaRapida, LineaImportacion } from './esquema';

/**
 * F09: guarda lo que el comerciante aprobó. Es el único lugar que cambia precios a partir de una lista.
 * Cada producto aprobado toma el costo nuevo y el precio decidido, y queda un registro en el historial.
 * La importación queda guardada con sus líneas, aprobadas o no.
 */
export interface DatosAplicar {
  proveedorId: number;
  archivo: string;
  totalLineas: number;
  cambios: readonly Cambio[];
  decisiones: ReadonlyMap<number, Decision>;
}

export interface ResultadoAplicar {
  importacionId: number;
  actualizados: number;
}

export async function aplicarRevision(db: BaseListaRapida, datos: DatosAplicar, ahora = new Date()): Promise<ResultadoAplicar> {
  const fecha = ahora.toISOString();
  return db.transaction('rw', [db.productos, db.historialPrecios, db.importaciones, db.lineasImportacion], async () => {
    const aprobados = datos.cambios.flatMap((c) => {
      const decision = datos.decisiones.get(c.productoId);
      return decision ? [{ cambio: c, precio: decision.precio }] : [];
    });
    for (const { cambio, precio } of aprobados) {
      await db.productos.update(cambio.productoId, { costoActual: cambio.costoNuevo, precioVentaActual: precio, actualizado: fecha });
    }
    await db.historialPrecios.bulkAdd(
      aprobados.map(({ cambio, precio }) => ({
        productoId: cambio.productoId,
        proveedorId: datos.proveedorId,
        fecha,
        costo: cambio.costoNuevo,
        precioVenta: precio,
      })),
    );
    const importacionId = await db.importaciones.add({
      proveedorId: datos.proveedorId,
      archivoNombre: datos.archivo,
      fecha,
      totalLineas: datos.totalLineas,
      vinculadas: datos.cambios.length,
      estado: 'aprobada',
    });
    const lineas: Omit<LineaImportacion, 'id'>[] = datos.cambios.map((c) => {
      const decision = datos.decisiones.get(c.productoId);
      return {
        importacionId,
        filaOrigen: c.linea.filaOrigen,
        codigo: c.linea.codigo,
        descripcion: c.linea.descripcion,
        costo: c.costoNuevo,
        productoId: c.productoId,
        costoAnterior: c.costoAnterior,
        precioSugerido: c.precioSugerido,
        precioFinal: decision ? decision.precio : null,
        variacionPct: c.variacion,
        estado: decision ? 'aprobada' : 'ignorada',
      };
    });
    await db.lineasImportacion.bulkAdd(lineas);
    return { importacionId, actualizados: aprobados.length };
  });
}

/** F10: productos a los que les cambió el precio en la última lista revisada (para imprimir sus etiquetas). */
export async function productosUltimaRevision(db: BaseListaRapida): Promise<number[]> {
  const ultima = (await db.importaciones.orderBy('fecha').reverse().toArray()).find((i) => i.estado === 'aprobada');
  if (!ultima) return [];
  const lineas = await db.lineasImportacion.where('importacionId').equals(ultima.id).toArray();
  return lineas.filter((l) => l.estado === 'aprobada' && l.productoId !== null).map((l) => l.productoId!);
}
