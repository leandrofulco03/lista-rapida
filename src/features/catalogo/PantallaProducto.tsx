import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { borrarProducto, guardarProducto, proponerCodigo } from '../../db';
import type { Id } from '../../domain/id';
import { useSesion } from '../../sesion';
import type { Producto, Rubro } from '../../db';
import { validarProducto } from '../../domain/catalogo';
import type { DatosProducto, ErroresProducto } from '../../domain/catalogo';
import type { ConfigComercio } from '../../domain/config';
import { formatearPesos, pesosParaEditar } from '../../domain/dinero';
import { leerImporte } from '../../domain/importe';
import { IVA_GENERAL, IVA_REDUCIDO, formatearPorcentaje, parsearPorcentaje } from '../../domain/porcentaje';
import { calcularPrecioVenta } from '../../domain/precio';
import { resolverRecargo } from '../../domain/recargo';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { Escaner, puedeEscanear } from '../../ui/Escaner';
import { IconoCatalogo } from '../../ui/Iconos';
import { CampoTexto } from '../../ui/CampoTexto';
import { Opciones } from '../../ui/Opciones';

interface Props {
  /** null para un producto nuevo. */
  producto: Producto | null;
  rubros: Rubro[];
  config: ConfigComercio;
  onVolver: () => void;
}

/** F03: alta y edición de un producto del catálogo. */
export function PantallaProducto({ producto, rubros, config, onVolver }: Props) {
  const sesion = useSesion();
  const [codigo, setCodigo] = useState(producto?.codigoInterno ?? '');
  const [barras, setBarras] = useState(producto?.codigoBarras ?? '');
  const [escaneando, setEscaneando] = useState(false);
  const [descripcion, setDescripcion] = useState(producto?.descripcion ?? '');
  const [rubroId, setRubroId] = useState<Id | null>(producto?.rubroId ?? null);
  const [recargoTexto, setRecargoTexto] = useState(producto?.recargoPct != null ? formatearPorcentaje(producto.recargoPct) : '');
  const [ivaPct, setIvaPct] = useState(producto?.ivaPct ?? config.ivaDefault);
  const [costoTexto, setCostoTexto] = useState(producto ? pesosParaEditar(producto.costoActual) : '');
  const [precioTexto, setPrecioTexto] = useState(producto ? pesosParaEditar(producto.precioVentaActual) : '');
  const [errores, setErrores] = useState<ErroresProducto>({});
  const [error, setError] = useState<string | null>(null);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const idRubro = useId();

  useEffect(() => {
    if (!producto) proponerCodigo(sesion).then((c) => setCodigo((actual) => actual || c));
  }, [producto]);

  const vacioOCero = (texto: string) => (texto.trim() === '' ? 0 : leerImporte(texto, 'ar'));
  const costo = vacioOCero(costoTexto);
  const recargoPropio = recargoTexto.trim() === '' ? null : parsearPorcentaje(recargoTexto);
  const rubro = rubros.find((r) => r.id === rubroId) ?? null;
  const recargo = resolverRecargo({ producto: recargoPropio, rubro: rubro?.recargoPct, general: config.recargoGeneral });
  const heredado = resolverRecargo({ rubro: rubro?.recargoPct, general: config.recargoGeneral });
  const sugerido =
    costo !== null && costo > 0 && (recargoTexto.trim() === '' || recargoPropio !== null)
      ? calcularPrecioVenta({
          costo,
          descuentos: [],
          ivaPct,
          listaIncluyeIva: false,
          ventaIncluyeIva: config.ventaIncluyeIva,
          recargo: Math.min(recargo.recargo, 100_000),
          redondeo: config.redondeo,
        }).precio
      : null;
  const origenHeredado = heredado.origen === 'rubro' ? `del rubro ${rubro?.nombre ?? ''}` : 'general';

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const precio = vacioOCero(precioTexto);
    const datos: DatosProducto = {
      codigoInterno: codigo,
      codigoBarras: barras.trim() === '' ? null : barras,
      descripcion,
      rubroId,
      recargoPct: recargoTexto.trim() === '' ? null : (recargoPropio ?? -1),
      ivaPct,
      costoActual: costo ?? -1,
      precioVentaActual: precio ?? -1,
    };
    const encontrados = validarProducto(datos);
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;
    try {
      await guardarProducto(sesion, datos, producto?.id);
      onVolver();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function borrar() {
    if (!producto) return;
    await borrarProducto(sesion, producto.id);
    onVolver();
  }

  return (
    <main className="mx-auto max-w-2xl">
      <Encabezado Icono={IconoCatalogo} titulo={producto ? 'Editar producto' : 'Producto nuevo'} />

      <form onSubmit={guardar} noValidate className="mt-6 space-y-6">
        <CampoTexto etiqueta="Descripción" valor={descripcion} onCambiar={setDescripcion} placeholder="Ej.: Yerba Playadito 1 kg" error={errores.descripcion} />
        <CampoTexto etiqueta="Código" valor={codigo} onCambiar={setCodigo} error={errores.codigoInterno} ayuda="El de tu sistema o uno automático." />
        <div>
          <CampoTexto
            etiqueta="Código de barras"
            valor={barras}
            onCambiar={setBarras}
            inputMode="numeric"
            error={errores.codigoBarras}
            ayuda="El del envase, para vender escaneando. Opcional."
          />
          {puedeEscanear() && (
            <button type="button" onClick={() => setEscaneando(true)} className="mt-1 min-h-11 font-semibold text-green-800 underline underline-offset-4">
              Escanear con la cámara
            </button>
          )}
          {escaneando && (
            <Escaner
              onCodigo={(c) => {
                setBarras(c);
                setEscaneando(false);
              }}
              onCerrar={() => setEscaneando(false)}
            />
          )}
        </div>

        <div>
          <label htmlFor={idRubro} className="block text-lg font-semibold">
            Rubro
          </label>
          <select
            id={idRubro}
            value={rubroId ?? ''}
            onChange={(e) => setRubroId(e.target.value === '' ? null : e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white shadow-xs px-3 text-lg outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/15"
          >
            <option value="">Sin rubro</option>
            {rubros.map((r) => (
              <option key={r.id} value={r.id}>
                {r.nombre}
              </option>
            ))}
          </select>
        </div>

        <CampoTexto etiqueta="Costo" valor={costoTexto} onCambiar={setCostoTexto} inputMode="decimal" placeholder="$ 0,00" error={errores.costoActual} ayuda="Sin IVA." />

        <CampoTexto
          etiqueta="Recargo propio"
          valor={recargoTexto}
          onCambiar={setRecargoTexto}
          sufijo="%"
          inputMode="decimal"
          placeholder={formatearPorcentaje(heredado.recargo)}
          error={errores.recargoPct}
          ayuda={`Vacío: usa el recargo ${origenHeredado} (${formatearPorcentaje(heredado.recargo)}%).`}
        />

        <Opciones
          legend="IVA"
          opciones={[
            { valor: IVA_GENERAL, etiqueta: '21%' },
            { valor: IVA_REDUCIDO, etiqueta: '10,5%' },
          ]}
          valor={ivaPct}
          onElegir={setIvaPct}
        />

        <div>
          <CampoTexto etiqueta="Precio de venta" valor={precioTexto} onCambiar={setPrecioTexto} inputMode="decimal" placeholder="$ 0,00" error={errores.precioVentaActual} />
          {sugerido !== null && (
            <p className="mt-2 flex flex-wrap items-center gap-2 text-stone-700" data-testid="precio-sugerido">
              Con el recargo daría {formatearPesos(sugerido)}.
              <button type="button" onClick={() => setPrecioTexto(pesosParaEditar(sugerido))} className="min-h-11 rounded-lg px-2 font-semibold text-green-800 underline">
                Usar ese precio
              </button>
            </p>
          )}
        </div>

        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-3">
          <Boton type="submit">{producto ? 'Guardar cambios' : 'Agregar al catálogo'}</Boton>
          <Boton type="button" variante="secundario" onClick={onVolver}>
            Volver
          </Boton>
        </div>
      </form>

      {producto && (
        <section className="mt-10 border-t border-stone-300 pt-6">
          {confirmarBorrado ? (
            <div className="rounded-xl bg-red-50 p-3" role="alert">
              <p className="text-red-900">Se borra {producto.descripcion} del catálogo.</p>
              <div className="mt-3 space-y-3">
                <Boton type="button" variante="peligro" onClick={borrar}>
                  Sí, borrar
                </Boton>
                <Boton type="button" variante="secundario" onClick={() => setConfirmarBorrado(false)}>
                  No, dejarlo
                </Boton>
              </div>
            </div>
          ) : (
            <Boton type="button" variante="secundario" onClick={() => setConfirmarBorrado(true)}>
              Borrar producto
            </Boton>
          )}
        </section>
      )}
    </main>
  );
}
