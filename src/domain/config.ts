import type { Porcentaje } from './dinero';
import { ALICUOTAS_IVA, IVA_GENERAL } from './porcentaje';
import { RECARGO_MAXIMO } from './precio';
import type { ReglaRedondeo } from './precio';

/** F01: configuración del comercio. */
export interface ConfigComercio {
  nombreComercio: string;
  /** Recargo sobre costo que se usa si el producto y el rubro no tienen uno propio. */
  recargoGeneral: Porcentaje;
  redondeo: ReglaRedondeo;
  /** El comercio muestra los precios de venta con IVA incluido. */
  ventaIncluyeIva: boolean;
  /** IVA que se asigna a los productos nuevos. */
  ivaDefault: Porcentaje;
}

export const LARGO_MAXIMO_NOMBRE = 60;

/** Valores con los que arranca la pantalla de F01 (decisiones de Leandro del 12/10/2026). */
export const CONFIG_SUGERIDA: ConfigComercio = {
  nombreComercio: '',
  recargoGeneral: 3000,
  redondeo: { tipo: 'multiplo', pesos: 10 },
  ventaIncluyeIva: true,
  ivaDefault: IVA_GENERAL,
};

export const REGLAS_REDONDEO: readonly { regla: ReglaRedondeo; etiqueta: string }[] = [
  { regla: { tipo: 'multiplo', pesos: 10 }, etiqueta: 'A $10' },
  { regla: { tipo: 'multiplo', pesos: 50 }, etiqueta: 'A $50' },
  { regla: { tipo: 'multiplo', pesos: 100 }, etiqueta: 'A $100' },
  { regla: { tipo: 'terminado', en: 90 }, etiqueta: 'Termina en 90' },
  { regla: { tipo: 'terminado', en: 99 }, etiqueta: 'Termina en 99' },
];

export function mismaRegla(a: ReglaRedondeo, b: ReglaRedondeo): boolean {
  return a.tipo === 'multiplo' ? b.tipo === 'multiplo' && a.pesos === b.pesos : b.tipo === 'terminado' && a.en === b.en;
}

export type ErroresConfig = Partial<Record<'nombreComercio' | 'recargoGeneral' | 'redondeo' | 'ivaDefault', string>>;

/** Devuelve un mensaje por campo con problemas; vacío si la configuración es válida. */
export function validarConfig(config: ConfigComercio): ErroresConfig {
  const errores: ErroresConfig = {};
  const nombre = config.nombreComercio.trim();
  if (nombre === '') errores.nombreComercio = 'Escribí el nombre de tu comercio.';
  else if (nombre.length > LARGO_MAXIMO_NOMBRE) errores.nombreComercio = `Usá hasta ${LARGO_MAXIMO_NOMBRE} letras.`;

  if (!Number.isSafeInteger(config.recargoGeneral) || config.recargoGeneral < 0 || config.recargoGeneral > RECARGO_MAXIMO) {
    errores.recargoGeneral = 'Poné un recargo entre 0% y 1000%.';
  }
  if (!REGLAS_REDONDEO.some((r) => mismaRegla(r.regla, config.redondeo))) errores.redondeo = 'Elegí cómo redondear.';
  if (!ALICUOTAS_IVA.includes(config.ivaDefault)) errores.ivaDefault = 'Elegí 21% o 10,5%.';
  return errores;
}

/** Limpia lo que escribió el usuario antes de guardar. */
export function normalizarConfig(config: ConfigComercio): ConfigComercio {
  return { ...config, nombreComercio: config.nombreComercio.trim().replace(/\s+/g, ' ') };
}
