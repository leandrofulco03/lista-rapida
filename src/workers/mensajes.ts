import type { Tabla } from '../parsers/tabla';

export interface PedidoLectura {
  nombre: string;
  datos: ArrayBuffer;
}

export type RespuestaLectura = { ok: true; tabla: Tabla } | { ok: false; mensaje: string };
