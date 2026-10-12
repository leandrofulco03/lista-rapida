import type { ConfigComercio } from '../../domain/config';
import { NOMBRE_APP } from '../../marca';
import { Boton } from '../../ui/Boton';

interface Props {
  config: ConfigComercio;
  onEditarConfig: () => void;
}

/** Inicio: por ahora sólo saluda; proveedores y última lista llegan en las fases siguientes. */
export function PantallaInicio({ config, onEditarConfig }: Props) {
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <p className="text-sm font-semibold text-green-800">{NOMBRE_APP}</p>
      <h1 className="mt-1 text-3xl font-bold">{config.nombreComercio}</h1>
      <p className="mt-6 rounded-xl border border-dashed border-stone-300 bg-white p-4 text-stone-600">
        Pronto vas a poder subir la lista de un proveedor desde acá.
      </p>
      <div className="mt-6">
        <Boton variante="secundario" onClick={onEditarConfig}>
          Configuración
        </Boton>
      </div>
    </main>
  );
}
