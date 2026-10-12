import type { ConfigComercio } from '../../domain/config';
import { NOMBRE_APP } from '../../marca';
import { Boton } from '../../ui/Boton';

interface Props {
  config: ConfigComercio;
  onIr: (pantalla: 'subir' | 'catalogo' | 'proveedores' | 'config') => void;
}

/** Inicio: la acción principal es subir una lista; desde acá también se llega al catálogo y a los proveedores. */
export function PantallaInicio({ config, onIr }: Props) {
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <p className="text-sm font-semibold text-green-800">{NOMBRE_APP}</p>
      <h1 className="mt-1 text-3xl font-bold">{config.nombreComercio}</h1>
      <div className="mt-6 space-y-3">
        <Boton onClick={() => onIr('subir')}>Subí una lista</Boton>
        <Boton variante="secundario" onClick={() => onIr('catalogo')}>
          Catálogo
        </Boton>
        <Boton variante="secundario" onClick={() => onIr('proveedores')}>
          Proveedores
        </Boton>
        <Boton variante="secundario" onClick={() => onIr('config')}>
          Configuración
        </Boton>
      </div>
    </main>
  );
}
