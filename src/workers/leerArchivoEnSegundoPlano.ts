import type { Tabla } from '../parsers/tabla';
import type { PedidoLectura, RespuestaLectura } from './mensajes';

/** Lee un archivo de lista en un Web Worker. Rechaza con un mensaje para mostrar al usuario. */
export async function leerArchivoEnSegundoPlano(archivo: File): Promise<Tabla> {
  const datos = await archivo.arrayBuffer();
  const worker = new Worker(new URL('./lectura.worker.ts', import.meta.url), { type: 'module' });
  try {
    return await new Promise<Tabla>((resolver, rechazar) => {
      worker.onmessage = (evento: MessageEvent<RespuestaLectura>) => {
        if (evento.data.ok) resolver(evento.data.tabla);
        else rechazar(new Error(evento.data.mensaje));
      };
      worker.onerror = () => rechazar(new Error('No pudimos leer el archivo.'));
      const pedido: PedidoLectura = { nombre: archivo.name, datos };
      worker.postMessage(pedido, [datos]);
    });
  } finally {
    worker.terminate();
  }
}
