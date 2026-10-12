import { useEffect, useState } from 'react';
import { db, guardarConfig, leerConfig } from './db';
import type { ConfigComercio } from './domain/config';
import { PantallaConfig } from './features/config/PantallaConfig';
import { PantallaInicio } from './features/inicio/PantallaInicio';
import { PantallaSubirLista } from './features/subir/PantallaSubirLista';
import { PantallaCatalogo } from './features/catalogo/PantallaCatalogo';
import { PantallaProveedores } from './features/proveedores/PantallaProveedores';
import { PantallaRespaldo } from './features/respaldo/PantallaRespaldo';
import { PantallaEtiquetas } from './features/etiquetas/PantallaEtiquetas';
import { PantallaListaPrecios } from './features/exportar/PantallaListaPrecios';

type Pantalla = 'inicio' | 'config' | 'subir' | 'catalogo' | 'proveedores' | 'respaldo' | 'etiquetas' | 'lista-precios';

type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'sin-config'; restaurando?: boolean }
  | { tipo: 'listo'; config: ConfigComercio; pantalla: Pantalla; etiquetas?: number[] };

export function App() {
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  const cargar = (pantalla: Pantalla = 'inicio') =>
    leerConfig(db).then((config) => setEstado(config ? { tipo: 'listo', config, pantalla } : { tipo: 'sin-config' }));

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(config: ConfigComercio) {
    const guardada = await guardarConfig(db, config);
    setEstado({ tipo: 'listo', config: guardada, pantalla: 'inicio' });
  }

  if (estado.tipo === 'cargando') return null;
  if (estado.tipo === 'sin-config') {
    if (estado.restaurando) {
      return <PantallaRespaldo onRestaurado={() => cargar()} onVolver={() => setEstado({ tipo: 'sin-config' })} />;
    }
    return <PantallaConfig onGuardar={guardar} onRestaurar={() => setEstado({ tipo: 'sin-config', restaurando: true })} />;
  }
  const ir = (pantalla: Pantalla) => setEstado({ ...estado, pantalla, etiquetas: undefined });
  if (estado.pantalla === 'config') {
    return <PantallaConfig inicial={estado.config} onGuardar={guardar} onCancelar={() => ir('inicio')} />;
  }
  if (estado.pantalla === 'subir') {
    return (
      <PantallaSubirLista
        config={estado.config}
        onEtiquetas={(productos) => setEstado({ ...estado, pantalla: 'etiquetas', etiquetas: productos })}
        onListaPrecios={() => ir('lista-precios')}
        onVolver={() => ir('inicio')}
      />
    );
  }
  if (estado.pantalla === 'lista-precios') {
    return <PantallaListaPrecios nombreComercio={estado.config.nombreComercio} onVolver={() => ir('inicio')} />;
  }
  if (estado.pantalla === 'etiquetas') return <PantallaEtiquetas preseleccion={estado.etiquetas} onVolver={() => ir('inicio')} />;
  if (estado.pantalla === 'catalogo') return <PantallaCatalogo config={estado.config} onVolver={() => ir('inicio')} />;
  if (estado.pantalla === 'respaldo') {
    return (
      <PantallaRespaldo
        ultimoRespaldo={estado.config.ultimoRespaldo}
        onExportado={() => cargar('respaldo')}
        onRestaurado={() => cargar()}
        onVolver={() => ir('inicio')}
      />
    );
  }
  if (estado.pantalla === 'proveedores') return <PantallaProveedores onVolver={() => ir('inicio')} />;
  return <PantallaInicio config={estado.config} onIr={ir} />;
}
