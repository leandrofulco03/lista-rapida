import { useEffect, useId, useState } from 'react';
import type { FormEvent } from 'react';
import { crearProveedor, db, guardarLecturaProveedor, listarProveedores } from '../../db';
import type { Proveedor } from '../../db';
import type { ConfigComercio } from '../../domain/config';
import { detectarColumnas } from '../../domain/columnas';
import type { Deteccion, MapeoColumnas } from '../../domain/columnas';
import { aplicarMapeoGuardado, extraerLineas } from '../../domain/lectura';
import type { LineaLista } from '../../domain/lineaLista';
import type { Tabla } from '../../parsers/tabla';
import { EXTENSIONES_LISTA } from '../../parsers/tabla';
import { Boton } from '../../ui/Boton';
import { leerArchivoEnSegundoPlano } from '../../workers/leerArchivoEnSegundoPlano';
import { PantallaMapeo } from '../mapeo/PantallaMapeo';
import { PantallaRevision } from '../revision/PantallaRevision';
import { PantallaVinculacion } from '../vinculacion/PantallaVinculacion';
import { ResumenLectura } from './ResumenLectura';

interface Props {
  config: ConfigComercio;
  onVolver: () => void;
}

const NUEVO = 'nuevo';

interface Leida {
  proveedor: Proveedor;
  archivo: string;
  tabla: Tabla;
}

type Paso =
  | { tipo: 'elegir' }
  | { tipo: 'leyendo' }
  | ({ tipo: 'mapeo'; deteccion: Deteccion } & Leida)
  | ({ tipo: 'resultado'; mapeo: MapeoColumnas; automatico: boolean } & Leida)
  | { tipo: 'vinculacion'; proveedor: Proveedor; archivo: string; lineas: LineaLista[] }
  | { tipo: 'revision'; proveedor: Proveedor; archivo: string; lineas: { linea: LineaLista; productoId: number | null }[] };

/** F04 + F06 + F07 + F09: subir la lista de un proveedor, leerla, unirla con el catálogo y revisar los precios nuevos. */
export function PantallaSubirLista({ config, onVolver }: Props) {
  const [proveedores, setProveedores] = useState<Proveedor[] | null>(null);
  const [elegido, setElegido] = useState<string>(NUEVO);
  const [nombreNuevo, setNombreNuevo] = useState('');
  const [conIva, setConIva] = useState(false);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paso, setPaso] = useState<Paso>({ tipo: 'elegir' });
  const ids = { proveedor: useId(), nombre: useId(), archivo: useId() };

  useEffect(() => {
    listarProveedores(db).then((lista) => {
      setProveedores(lista);
      const primero = lista[0];
      if (primero) {
        setElegido(String(primero.id));
        setConIva(primero.listaIncluyeIva);
      }
    });
  }, []);

  function elegirProveedor(valor: string) {
    setElegido(valor);
    const proveedor = proveedores?.find((p) => String(p.id) === valor);
    setConIva(proveedor?.listaIncluyeIva ?? false);
  }

  async function leer(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!archivo) return setError('Elegí el archivo de la lista.');
    let proveedor: Proveedor;
    try {
      proveedor =
        elegido === NUEVO
          ? await crearProveedor(db, nombreNuevo, conIva)
          : proveedores!.find((p) => String(p.id) === elegido)!;
    } catch (err) {
      return setError((err as Error).message);
    }
    setPaso({ tipo: 'leyendo' });
    try {
      const tabla = await leerArchivoEnSegundoPlano(archivo);
      const leida = { proveedor, archivo: archivo.name, tabla };
      const reusado = proveedor.mapeoColumnas ? aplicarMapeoGuardado(tabla.filas, proveedor.mapeoColumnas) : null;
      if (reusado) {
        await guardarLecturaProveedor(db, proveedor.id, reusado, conIva);
        setPaso({ tipo: 'resultado', mapeo: reusado, automatico: true, ...leida });
      } else {
        setPaso({ tipo: 'mapeo', deteccion: detectarColumnas(tabla.filas), ...leida });
      }
    } catch (err) {
      setError((err as Error).message);
      setPaso({ tipo: 'elegir' });
    }
  }

  async function confirmarMapeo(leida: Leida, mapeo: MapeoColumnas) {
    await guardarLecturaProveedor(db, leida.proveedor.id, mapeo, conIva);
    setPaso({ proveedor: leida.proveedor, archivo: leida.archivo, tabla: leida.tabla, tipo: 'resultado', mapeo, automatico: false });
  }

  if (paso.tipo === 'mapeo') {
    return (
      <PantallaMapeo
        filas={paso.tabla.filas}
        nombreArchivo={paso.archivo}
        inicial={paso.deteccion.mapeo}
        confianza={paso.deteccion.confianza}
        onConfirmar={(mapeo) => confirmarMapeo(paso, mapeo)}
        onCancelar={() => setPaso({ tipo: 'elegir' })}
      />
    );
  }

  if (paso.tipo === 'vinculacion') {
    return (
      <PantallaVinculacion
        proveedor={paso.proveedor}
        lineas={paso.lineas}
        onSeguir={(elecciones) =>
          setPaso({
            tipo: 'revision',
            proveedor: paso.proveedor,
            archivo: paso.archivo,
            lineas: paso.lineas.map((linea, i) => ({ linea, productoId: elecciones[i] ?? null })),
          })
        }
        onVolver={onVolver}
      />
    );
  }

  if (paso.tipo === 'revision') {
    return (
      <PantallaRevision
        proveedor={paso.proveedor}
        archivo={paso.archivo}
        lineas={paso.lineas}
        listaIncluyeIva={conIva}
        config={config}
        onVolver={onVolver}
      />
    );
  }

  if (paso.tipo === 'resultado') {
    const resultado = extraerLineas(paso.tabla.filas, paso.mapeo);
    return (
      <ResumenLectura
        proveedor={paso.proveedor.nombre}
        archivo={paso.archivo}
        resultado={resultado}
        listaIncluyeIva={conIva}
        automatico={paso.automatico}
        onCorregir={() =>
          setPaso({
            tipo: 'mapeo',
            proveedor: paso.proveedor,
            archivo: paso.archivo,
            tabla: paso.tabla,
            deteccion: { mapeo: paso.mapeo, confianza: 'alta' },
          })
        }
        onComparar={() => setPaso({ tipo: 'vinculacion', proveedor: paso.proveedor, archivo: paso.archivo, lineas: resultado.lineas })}
        onVolver={onVolver}
      />
    );
  }

  if (proveedores === null) return null;

  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <h1 className="text-2xl font-bold">Subí una lista</h1>
      <p className="mt-1 text-stone-600">Excel, CSV o PDF. Los precios no cambian hasta que los revises.</p>

      <form onSubmit={leer} noValidate className="mt-6 space-y-6">
        <div>
          <label htmlFor={ids.proveedor} className="block text-lg font-semibold">
            Proveedor
          </label>
          <select
            id={ids.proveedor}
            value={elegido}
            onChange={(e) => elegirProveedor(e.target.value)}
            className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg"
          >
            {proveedores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
            <option value={NUEVO}>+ Proveedor nuevo</option>
          </select>
          {elegido === NUEVO && (
            <>
              <label htmlFor={ids.nombre} className="mt-3 block font-medium">
                Nombre del proveedor
              </label>
              <input
                id={ids.nombre}
                value={nombreNuevo}
                onChange={(e) => setNombreNuevo(e.target.value)}
                placeholder="Ej.: Distribuidora El Sol"
                className="mt-2 min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-lg"
              />
            </>
          )}
        </div>

        <fieldset>
          <legend className="text-lg font-semibold">¿Los precios de la lista incluyen IVA?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {[
              { valor: false, etiqueta: 'No, son + IVA' },
              { valor: true, etiqueta: 'Sí, con IVA' },
            ].map(({ valor, etiqueta }) => (
              <button
                key={etiqueta}
                type="button"
                aria-pressed={conIva === valor}
                onClick={() => setConIva(valor)}
                className={`min-h-11 rounded-xl border px-3 text-base font-medium ${
                  conIva === valor ? 'border-green-700 bg-green-50 text-green-900' : 'border-stone-300 bg-white'
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <p className="mt-1 text-sm text-stone-600">Si el título del precio dice "c/IVA" o "s/IVA", se usa eso.</p>
        </fieldset>

        <div>
          <label htmlFor={ids.archivo} className="block text-lg font-semibold">
            Archivo de la lista
          </label>
          <input
            id={ids.archivo}
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
            {paso.tipo === 'leyendo' ? 'Leyendo la lista…' : 'Leer lista'}
          </Boton>
          <Boton type="button" variante="secundario" onClick={onVolver}>
            Volver
          </Boton>
        </div>
      </form>
    </main>
  );
}
