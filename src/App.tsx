import { useEffect, useState } from 'react';
import { db, guardarConfig, leerConfig } from './db';
import type { ConfigComercio } from './domain/config';
import { PantallaConfig } from './features/config/PantallaConfig';
import { PantallaInicio } from './features/inicio/PantallaInicio';

type Estado = { tipo: 'cargando' } | { tipo: 'sin-config' } | { tipo: 'listo'; config: ConfigComercio; editando: boolean };

export function App() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    leerConfig(db).then((config) => setEstado(config ? { tipo: 'listo', config, editando: false } : { tipo: 'sin-config' }));
  }, []);

  async function guardar(config: ConfigComercio) {
    const guardada = await guardarConfig(db, config);
    setEstado({ tipo: 'listo', config: guardada, editando: false });
  }

  if (estado.tipo === 'cargando') return null;
  if (estado.tipo === 'sin-config') return <PantallaConfig onGuardar={guardar} />;
  if (estado.editando) {
    return (
      <PantallaConfig
        inicial={estado.config}
        onGuardar={guardar}
        onCancelar={() => setEstado({ ...estado, editando: false })}
      />
    );
  }
  return <PantallaInicio config={estado.config} onEditarConfig={() => setEstado({ ...estado, editando: true })} />;
}
