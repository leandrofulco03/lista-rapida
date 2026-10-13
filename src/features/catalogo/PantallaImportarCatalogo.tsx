import { useId, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { db, importarCatalogo } from '../../db';
import type { ResultadoImportacionCatalogo } from '../../db';
import { CAMPOS_CATALOGO, NOMBRE_CAMPO_CATALOGO, detectarColumnasCatalogo, extraerProductosCatalogo } from '../../domain/catalogo';
import type { CampoCatalogo, DeteccionCatalogo, MapeoCatalogo } from '../../domain/catalogo';
import type { ConfigComercio } from '../../domain/config';
import { TEXTO_MOTIVO } from '../../domain/lectura';
import type { FilaSalteada } from '../../domain/lectura';
import { EXTENSIONES_LISTA } from '../../parsers/tabla';
import type { Tabla } from '../../parsers/tabla';
import { Boton } from '../../ui/Boton';
import { Encabezado } from '../../ui/Encabezado';
import { IconoColumnas, IconoListo, IconoSubir } from '../../ui/Iconos';
import { leerArchivoEnSegundoPlano } from '../../workers/leerArchivoEnSegundoPlano';
import { SelectorColumnas } from '../mapeo/SelectorColumnas';
import type { Seleccion } from '../mapeo/SelectorColumnas';

interface Props {
  config: ConfigComercio;
  onVolver: () => void;
}

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'leyendo' }
  | { tipo: 'columnas'; archivo: string; tabla: Tabla; deteccion: DeteccionCatalogo }
  | { tipo: 'listo'; resultado: ResultadoImportacionCatalogo; salteadas: FilaSalteada[] };

/** F03: carga el catálogo del comercio desde un Excel, CSV o PDF. Los productos que ya están se actualizan. */
export function PantallaImportarCatalogo({ config, onVolver }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' });
  const idArchivo = useId();

  async function leer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!archivo) return setError('Elegí el archivo del catálogo.');
    setPaso({ tipo: 'leyendo' });
    try {
      const tabla = await leerArchivoEnSegundoPlano(archivo);
      setPaso({ tipo: 'columnas', archivo: archivo.name, tabla, deteccion: detectarColumnasCatalogo(tabla.filas) });
    } catch (err) {
      setError((err as Error).message);
      setPaso({ tipo: 'elegir' });
    }
  }

  if (paso.tipo === 'columnas') {
    return (
      <ElegirColumnasCatalogo
        {...paso}
        onConfirmar={async (mapeo) => {
          const { productos, salteadas } = extraerProductosCatalogo(paso.tabla.filas, mapeo);
          const resultado = await importarCatalogo(db, productos, config);
          setPaso({ tipo: 'listo', resultado, salteadas });
        }}
        onCancelar={() => setPaso({ tipo: 'elegir' })}
      />
    );
  }

  if (paso.tipo === 'listo') {
    const { creados, actualizados, rubrosCreados } = paso.resultado;
    return (
      <main className="mx-auto max-w-md px-4 pt-8 pb-12">
        <Encabezado Icono={IconoListo} titulo={`Importamos ${creados + actualizados} productos`} testIdTitulo="titulo-importacion" />
        <ul className="mt-4 space-y-1 text-lg" data-testid="resumen-importacion">
          <li>{creados} nuevos</li>
          <li>{actualizados} actualizados</li>
          {rubrosCreados > 0 && <li>{rubrosCreados} rubros nuevos</li>}
        </ul>
        {paso.salteadas.length > 0 && (
          <details className="mt-4 rounded-xl border border-stone-200 bg-white shadow-sm p-3">
            <summary className="min-h-11 cursor-pointer content-center font-semibold">
              {paso.salteadas.length} {paso.salteadas.length === 1 ? 'fila salteada' : 'filas salteadas'}
            </summary>
            <ul className="mt-2 space-y-2 text-sm">
              {paso.salteadas.map((s) => (
                <li key={s.fila}>
                  <span className="font-medium">Fila {s.fila}:</span> {s.motivo === 'titulo' ? 'Título o rubro' : TEXTO_MOTIVO[s.motivo]}
                  <span className="block break-words text-stone-500">{s.texto}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
        <Boton type="button" onClick={onVolver} className="mt-6">
          Ver el catálogo
        </Boton>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <Encabezado
        Icono={IconoSubir}
        titulo="Importar catálogo"
        descripcion="Subí la planilla con tus productos: descripción y, si los tenés, código, rubro, costo, precio de venta e IVA. Los productos que ya están (mismo código) se actualizan."
      />
      <form onSubmit={leer} noValidate className="mt-6 space-y-6">
        <div>
          <label htmlFor={idArchivo} className="block text-lg font-semibold">
            Archivo del catálogo
          </label>
          <input
            id={idArchivo}
            type="file"
            accept={EXTENSIONES_LISTA.join(',')}
            onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-base file:mr-3 file:min-h-11 file:rounded-xl file:border file:border-stone-300 file:bg-white file:px-4 file:font-semibold"
          />
        </div>
        {error && (
          <p className="text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="space-y-3">
          <Boton type="submit" disabled={paso.tipo === 'leyendo'}>
            {paso.tipo === 'leyendo' ? 'Leyendo el archivo…' : 'Leer archivo'}
          </Boton>
          <Boton type="button" variante="secundario" onClick={onVolver}>
            Volver
          </Boton>
        </div>
      </form>
    </main>
  );
}

interface PropsColumnas {
  archivo: string;
  tabla: Tabla;
  deteccion: DeteccionCatalogo;
  onConfirmar: (mapeo: MapeoCatalogo) => Promise<void>;
  onCancelar: () => void;
}

/** F03: confirmar o corregir qué columna es cada dato del catálogo. */
function ElegirColumnasCatalogo({ archivo, tabla, deteccion, onConfirmar, onCancelar }: PropsColumnas) {
  const [seleccion, setSeleccion] = useState<Seleccion<CampoCatalogo>>(
    () =>
      deteccion.mapeo ?? { filaEncabezado: null, codigo: null, descripcion: null, rubro: null, costo: null, precioVenta: null, iva: null },
  );
  const [importando, setImportando] = useState(false);
  const resultado = useMemo(
    () => (seleccion.descripcion === null ? null : extraerProductosCatalogo(tabla.filas, seleccion)),
    [tabla, seleccion],
  );

  async function confirmar() {
    setImportando(true);
    try {
      await onConfirmar(seleccion);
    } finally {
      setImportando(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-8 pb-12">
      <Encabezado Icono={IconoColumnas} titulo="¿Qué columna es cada dato?" descripcion={archivo} />
      <p
        className={`mt-4 rounded-xl p-3 ${deteccion.confianza === 'alta' ? 'bg-green-50 text-green-900' : 'bg-amber-50 text-amber-900'}`}
        data-testid="aviso-mapeo"
      >
        {deteccion.mapeo === null
          ? 'No pudimos reconocer las columnas. Elegí al menos cuál es la descripción.'
          : deteccion.confianza === 'alta'
            ? 'Encontramos las columnas. Revisalas y confirmá.'
            : 'No estamos seguros de las columnas. Revisalas antes de seguir.'}
      </p>

      <SelectorColumnas filas={tabla.filas} campos={CAMPOS_CATALOGO} nombres={NOMBRE_CAMPO_CATALOGO} seleccion={seleccion} onCambiar={setSeleccion} />

      <p className="mt-4 text-lg" data-testid="resumen-mapeo" aria-live="polite">
        {resultado
          ? `Se leen ${resultado.productos.length} productos${resultado.salteadas.length ? ` y se saltean ${resultado.salteadas.length} filas` : ''}.`
          : 'Elegí al menos la descripción.'}
      </p>
      <p className="mt-1 text-sm text-stone-600">
        Si falta el precio de venta, se calcula desde el costo con tu recargo y redondeo. El costo se toma sin IVA.
      </p>

      <div className="mt-6 space-y-3">
        <Boton type="button" disabled={!resultado || resultado.productos.length === 0 || importando} onClick={confirmar}>
          {importando ? 'Importando…' : 'Importar productos'}
        </Boton>
        <Boton type="button" variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
      </div>
    </main>
  );
}
