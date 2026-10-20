import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CONFIG_SUGERIDA, REGLAS_REDONDEO, mismaRegla, validarConfig } from '../../domain/config';
import type { ConfigComercio, ErroresConfig } from '../../domain/config';
import { formatearPesos } from '../../domain/dinero';
import { IVA_GENERAL, IVA_REDUCIDO, formatearPorcentaje, parsearPorcentaje } from '../../domain/porcentaje';
import { desglosarPrecio } from '../../domain/desglose';
import type { DesglosePrecio } from '../../domain/desglose';
import { NOMBRE_APP } from '../../marca';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoConfig } from '../../ui/Iconos';

interface Props {
  inicial?: ConfigComercio;
  onGuardar: (config: ConfigComercio) => Promise<void>;
  onCancelar?: () => void;
  /** Traer los datos de la versión anterior (su copia de seguridad). */
  onRestaurar?: () => void;
}

const COSTO_EJEMPLO = 100_000;

/** F01: configuración inicial del comercio, en una sola pantalla. */
export function PantallaConfig({ inicial, onGuardar, onCancelar, onRestaurar }: Props) {
  const primeraVez = !inicial;
  const base = inicial ?? CONFIG_SUGERIDA;
  const [nombre, setNombre] = useState(base.nombreComercio);
  const [recargoTexto, setRecargoTexto] = useState(formatearPorcentaje(base.recargoGeneral));
  const [redondeo, setRedondeo] = useState(base.redondeo);
  const [ventaIncluyeIva, setVentaIncluyeIva] = useState(base.ventaIncluyeIva);
  const [ivaDefault, setIvaDefault] = useState(base.ivaDefault);
  const [errores, setErrores] = useState<ErroresConfig>({});
  const [guardando, setGuardando] = useState(false);
  const ids = { nombre: useId(), recargo: useId() };

  const recargo = parsearPorcentaje(recargoTexto);
  const ejemplo =
    recargo === null
      ? null
      : desglosarPrecio({
          costo: COSTO_EJEMPLO,
          descuentos: [],
          ivaPct: ivaDefault,
          listaIncluyeIva: false,
          ventaIncluyeIva,
          recargo: Math.min(recargo, 100_000),
          redondeo,
        });
  const etiquetaRedondeo = REGLAS_REDONDEO.find((r) => mismaRegla(r.regla, redondeo))?.etiqueta ?? '';

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const config: ConfigComercio = {
      ...base,
      nombreComercio: nombre,
      recargoGeneral: recargo ?? -1,
      redondeo,
      ventaIncluyeIva,
      ivaDefault,
    };
    const encontrados = validarConfig(config);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    setGuardando(true);
    try {
      await onGuardar(config);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className={primeraVez ? 'mx-auto w-full max-w-xl px-4 pt-8 pb-12' : 'mx-auto max-w-2xl'}>
      {primeraVez ? (
        <Encabezado
          antetitulo={`Bienvenido a ${NOMBRE_APP}`}
          titulo="Creá tu comercio"
          descripcion="Contanos de tu comercio. Lo podés cambiar cuando quieras."
          className="mb-8"
        />
      ) : (
        <Encabezado Icono={IconoConfig} titulo="Configuración" descripcion="Datos del comercio y cómo se calculan tus precios." className="mb-6" />
      )}

      <form onSubmit={enviar} noValidate className="space-y-6">
        <div>
          <label htmlFor={ids.nombre} className="block text-lg font-semibold">
            Nombre del comercio
          </label>
          <input
            id={ids.nombre}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej.: Almacén Don José"
            autoComplete="organization"
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white shadow-xs px-3 text-lg outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
          />
          {errores.nombreComercio && <p className="mt-1 text-red-700">{errores.nombreComercio}</p>}
        </div>

        <div>
          <label htmlFor={ids.recargo} className="block text-lg font-semibold">
            Recargo general
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              id={ids.recargo}
              value={recargoTexto}
              onChange={(e) => setRecargoTexto(e.target.value)}
              inputMode="decimal"
              className="min-h-11 w-28 rounded-xl border border-stone-300 bg-white shadow-xs px-3 text-right text-lg outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
            />
            <span className="text-lg">%</span>
          </div>
          <p className="mt-1 text-sm text-stone-600">
            Es recargo sobre el costo: 30% sobre $ 1.000 da $ 1.300. Se usa cuando el producto o el rubro no tienen uno propio.
          </p>
          {errores.recargoGeneral && <p className="mt-1 text-red-700">{errores.recargoGeneral}</p>}
        </div>

        <fieldset>
          <legend className="text-lg font-semibold">Redondeo de precios</legend>
          <p className="text-sm text-stone-600">Siempre hacia arriba.</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {REGLAS_REDONDEO.map(({ regla, etiqueta }) => {
              const elegido = mismaRegla(regla, redondeo);
              return (
                <button
                  key={etiqueta}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() => setRedondeo(regla)}
                  className={`min-h-11 rounded-xl border px-3 text-base font-medium ${
                    elegido ? 'border-green-600 bg-green-600 text-white shadow-md shadow-green-800/20' : 'border-stone-200 bg-white shadow-sm hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  {etiqueta}
                </button>
              );
            })}
          </div>
        </fieldset>

        {ejemplo !== null && <EjemploPrecio desglose={ejemplo} etiquetaRedondeo={etiquetaRedondeo} />}

        <details className="rounded-xl border border-stone-200 bg-white shadow-sm p-3">
          <summary className="min-h-11 cursor-pointer content-center text-base font-semibold">Opciones avanzadas</summary>
          <label className="mt-3 flex min-h-11 items-center gap-3">
            <input
              type="checkbox"
              checked={ventaIncluyeIva}
              onChange={(e) => setVentaIncluyeIva(e.target.checked)}
              className="size-6 accent-green-700"
            />
            <span>Mis precios de venta incluyen IVA</span>
          </label>
          <fieldset className="mt-3">
            <legend className="font-medium">IVA de los productos nuevos</legend>
            <div className="mt-2 flex gap-2">
              {[IVA_GENERAL, IVA_REDUCIDO].map((iva) => (
                <button
                  key={iva}
                  type="button"
                  aria-pressed={ivaDefault === iva}
                  onClick={() => setIvaDefault(iva)}
                  className={`min-h-11 flex-1 rounded-xl border px-3 ${
                    ivaDefault === iva ? 'border-green-600 bg-green-600 text-white shadow-md shadow-green-800/20' : 'border-stone-200 bg-white shadow-sm hover:border-green-300 hover:bg-green-50'
                  }`}
                >
                  {formatearPorcentaje(iva)}%
                </button>
              ))}
            </div>
          </fieldset>
        </details>

        <div className="space-y-3">
          <Boton type="submit" disabled={guardando}>
            {primeraVez ? 'Guardar y empezar' : 'Guardar cambios'}
          </Boton>
          {onCancelar && (
            <Boton type="button" variante="secundario" onClick={onCancelar}>
              Cancelar
            </Boton>
          )}
          {onRestaurar && (
            <Boton type="button" variante="secundario" onClick={onRestaurar}>
              Traer datos de la versión anterior
            </Boton>
          )}
        </div>
      </form>
    </main>
  );
}

/**
 * Ejemplo vivo del cálculo, paso a paso en $ y %: cada línea muestra cuánto suma y cómo queda el precio.
 * Cambia con el recargo, el IVA y el redondeo elegidos.
 */
function EjemploPrecio({ desglose: d, etiquetaRedondeo }: { desglose: DesglosePrecio; etiquetaRedondeo: string }) {
  const pasos: { concepto: string; monto: number; total: number }[] = [
    {
      concepto: d.iva.aplicado ? `+ IVA ${formatearPorcentaje(d.iva.pct)}%` : '+ IVA (vendés sin IVA)',
      monto: d.iva.monto,
      total: d.conIva,
    },
    { concepto: `+ Recargo ${formatearPorcentaje(d.recargo.pct)}%`, monto: d.recargo.monto, total: d.sinRedondeo },
    { concepto: `+ Redondeo (${etiquetaRedondeo.toLowerCase()})`, monto: d.redondeo, total: d.precio },
  ];
  return (
    <section className="rounded-xl bg-green-50 p-3 text-green-900" data-testid="ejemplo-precio">
      <h2 className="font-semibold">Ejemplo con un producto que te cuesta <span className="whitespace-nowrap">{formatearPesos(d.costo)} + IVA</span></h2>
      <ul className="mt-2 space-y-1 tabular-nums">
        <li data-testid="ejemplo-paso">Costo {formatearPesos(d.costo)}</li>
        {pasos.map(({ concepto, monto, total }) => (
          <li key={concepto} data-testid="ejemplo-paso">
            {concepto}: {formatearPesos(monto)} → {formatearPesos(total)}
          </li>
        ))}
      </ul>
      <p className="mt-2 border-t border-green-700/30 pt-1 text-lg font-bold">
        Lo venderías a <span data-testid="ejemplo-precio-final">{formatearPesos(d.precio)}</span>
      </p>
    </section>
  );
}
