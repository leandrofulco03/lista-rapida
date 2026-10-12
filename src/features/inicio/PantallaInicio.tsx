import type { ConfigComercio } from '../../domain/config';
import { NOMBRE_APP } from '../../marca';
import { Boton } from '../../ui/Boton';

interface Props {
  config: ConfigComercio;
  onSubirLista: () => void;
  onEditarConfig: () => void;
}

/** Inicio: por ahora lleva a subir una lista; proveedores y última lista procesada llegan en las fases siguientes. */
export function PantallaInicio({ config, onSubirLista, onEditarConfig }: Props) {
  return (
    <main className="mx-auto max-w-md px-4 pt-8 pb-12">
      <p className="text-sm font-semibold text-green-800">{NOMBRE_APP}</p>
      <h1 className="mt-1 text-3xl font-bold">{config.nombreComercio}</h1>
      <div className="mt-6 space-y-3">
        <Boton onClick={onSubirLista}>Subí una lista</Boton>
        <Boton variante="secundario" onClick={onEditarConfig}>
          Configuración
        </Boton>
      </div>
    </main>
  );
}
