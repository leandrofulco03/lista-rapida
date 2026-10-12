import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { CONFIG_SUGERIDA, REGLAS_REDONDEO, mismaRegla, validarConfig } from '../../domain/config';
import type { ConfigComercio, ErroresConfig } from '../../domain/config';
import { formatearPesos } from '../../domain/dinero';
import { IVA_GENERAL, IVA_REDUCIDO, formatearPorcentaje, parsearPorcentaje } from '../../domain/porcentaje';
import { calcularPrecioVenta } from '../../domain/precio';
import { DESCRIPCION_APP, NOMBRE_APP } from '../../marca';
import { Boton } from '../../ui/Boton';

interface Props {
  inicial?: ConfigComercio;
  onGuardar: (config: ConfigComercio) => Promise<void>;
  onCancelar?: () => void;
}

const COSTO_EJEMPLO = 100_000;

/** F01: configuración inicial del comercio, en una sola pantalla. */
export function PantallaConfig({ inicial, onGuardar, onCancelar }: Props) {
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
      : calcularPrecioVenta({
          costo: COSTO_EJEMPLO,
          descuentos: [],
          ivaPct: ivaDefault,
          listaIncluyeIva: false,
          ventaIncluyeIva,
          recargo: Math.min(recargo, 100_000),
          redondeo,
        }).precio;

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
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      {primeraVez ? (
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-green-800">{NOMBRE_APP}</h1>
          <p className="mt-1 text-stone-600">{DESCRIPCION_APP}</p>
          <p className="mt-4 text-lg">Contanos de tu comercio. Lo podés cambiar cuando quieras.</p>
        </header>
      ) : (
        <h1 className="mb-6 text-2xl font-bold">Configuración</h1>
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
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg"
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
              className="min-h-11 w-28 rounded-xl border border-stone-300 bg-white px-3 text-right text-lg"
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
                    elegido ? 'border-green-700 bg-green-50 text-green-900' : 'border-stone-300 bg-white'
                  }`}
                >
                  {etiqueta}
                </button>
              );
            })}
          </div>
        </fieldset>

        {ejemplo !== null && (
          <p className="rounded-xl bg-green-50 p-3 text-green-900" data-testid="ejemplo-precio">
            Un producto que te cuesta {formatearPesos(COSTO_EJEMPLO)} + IVA lo venderías a{' '}
            <strong>{formatearPesos(ejemplo)}</strong>.
          </p>
        )}

        <details className="rounded-xl border border-stone-300 bg-white p-3">
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
                    ivaDefault === iva ? 'border-green-700 bg-green-50 text-green-900' : 'border-stone-300 bg-white'
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
        </div>
      </form>
    </main>
  );
}
