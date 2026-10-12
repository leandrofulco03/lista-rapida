import { useEffect, useState } from 'react';
import { db, guardarConfig, leerConfig } from './db';
import type { ConfigComercio } from './domain/config';
import { PantallaConfig } from './features/config/PantallaConfig';
import { PantallaInicio } from './features/inicio/PantallaInicio';
import { PantallaSubirLista } from './features/subir/PantallaSubirLista';
import { PantallaCatalogo } from './features/catalogo/PantallaCatalogo';
import { PantallaProveedores } from './features/proveedores/PantallaProveedores';

type Pantalla = 'inicio' | 'config' | 'subir' | 'catalogo' | 'proveedores';

type Estado = { tipo: 'cargando' } | { tipo: 'sin-config' } | { tipo: 'listo'; config: ConfigComercio; pantalla: Pantalla };

export function App() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    leerConfig(db).then((config) => setEstado(config ? { tipo: 'listo', config, pantalla: 'inicio' } : { tipo: 'sin-config' }));
  }, []);

  async function guardar(config: ConfigComercio) {
    const guardada = await guardarConfig(db, config);
    setEstado({ tipo: 'listo', config: guardada, pantalla: 'inicio' });
  }

  if (estado.tipo === 'cargando') return null;
  if (estado.tipo === 'sin-config') return <PantallaConfig onGuardar={guardar} />;
  const ir = (pantalla: Pantalla) => setEstado({ ...estado, pantalla });
  if (estado.pantalla === 'config') {
    return <PantallaConfig inicial={estado.config} onGuardar={guardar} onCancelar={() => ir('inicio')} />;
  }
  if (estado.pantalla === 'subir') return <PantallaSubirLista config={estado.config} onVolver={() => ir('inicio')} />;
  if (estado.pantalla === 'catalogo') return <PantallaCatalogo config={estado.config} onVolver={() => ir('inicio')} />;
  if (estado.pantalla === 'proveedores') return <PantallaProveedores onVolver={() => ir('inicio')} />;
  return <PantallaInicio config={estado.config} onIr={ir} />;
}
