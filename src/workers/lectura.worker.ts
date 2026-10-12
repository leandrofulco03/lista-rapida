/// <reference lib="webworker" />
import { leerArchivo, ErrorLectura } from '../parsers';
import type { PedidoLectura, RespuestaLectura } from './mensajes';

/** F04/F05: lee el archivo en segundo plano para no trabar la pantalla con listas grandes. */
self.onmessage = async (evento: MessageEvent<PedidoLectura>) => {
  const { nombre, datos } = evento.data;
  let respuesta: RespuestaLectura;
  try {
    respuesta = { ok: true, tabla: await leerArchivo(nombre, new Uint8Array(datos)) };
  } catch (error) {
    const mensaje = error instanceof ErrorLectura ? error.message : 'No pudimos leer el archivo.';
    respuesta = { ok: false, mensaje };
  }
  self.postMessage(respuesta);
};
