import { useEffect, useMemo, useState } from 'react';
import { crearComercio, guardarConfig, leerConfig, misComercios } from './db';
import type { MiComercio, Sesion } from './db';
import type { ConfigComercio } from './domain/config';
import type { Id } from './domain/id';
import { PantallaBienvenida } from './features/acceso/PantallaBienvenida';
import { PantallaIngreso } from './features/acceso/PantallaIngreso';
import { PantallaUnirse } from './features/acceso/PantallaUnirse';
import { PantallaAyuda } from './features/ayuda/PantallaAyuda';
import { PantallaCatalogo } from './features/catalogo/PantallaCatalogo';
import { PantallaConfig } from './features/config/PantallaConfig';
import { PantallaEmpleado } from './features/empleado/PantallaEmpleado';
import { PantallaEquipo } from './features/equipo/PantallaEquipo';
import { PantallaEtiquetas } from './features/etiquetas/PantallaEtiquetas';
import { PantallaListaPrecios } from './features/exportar/PantallaListaPrecios';
import { PantallaInicio } from './features/inicio/PantallaInicio';
import { PantallaProveedores } from './features/proveedores/PantallaProveedores';
import { PantallaRespaldo } from './features/respaldo/PantallaRespaldo';
import { PantallaSubirLista } from './features/subir/PantallaSubirLista';
import { crearBackend } from './nube';
import type { Backend, Usuario } from './nube';
import { ContextoSesion } from './sesion';
import { diaDe } from './domain/ventas';
import type { Dia } from './domain/ventas';
import { ProveedorCola } from './features/ventas/cola';
import { PantallaResumen } from './features/ventas/PantallaResumen';
import { PantallaTotalDia } from './features/ventas/PantallaTotalDia';
import { PantallaVender } from './features/ventas/PantallaVender';
import { PantallaVentasDelDia } from './features/ventas/PantallaVentasDelDia';

type Pantalla =
  | 'inicio'
  | 'config'
  | 'subir'
  | 'catalogo'
  | 'proveedores'
  | 'respaldo'
  | 'etiquetas'
  | 'lista-precios'
  | 'ayuda'
  | 'equipo'
  | 'vender'
  | 'ventas'
  | 'ventas-dia'
  | 'total-dia';

/** Pantallas del empleado: sólo vende y ve sus ventas de hoy. */
type PantallaEmpleadoNav = 'inicio' | 'vender' | 'mis-ventas';

/** Qué se muestra: depende de la conexión, de la sesión, del comercio y del rol. */
type Estado =
  | { tipo: 'cargando' }
  | { tipo: 'sin-conexion'; error: string }
  | { tipo: 'sin-sesion' }
  | { tipo: 'sin-comercio'; paso: 'elegir' | 'crear' | 'unirse' }
  | { tipo: 'empleado'; comercio: MiComercio; pantalla: PantallaEmpleadoNav }
  | { tipo: 'admin'; comercio: MiComercio; config: ConfigComercio; pantalla: Pantalla; etiquetas?: Id[]; dia?: Dia };

export function App() {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  // Conexión y sesión.
  useEffect(() => {
    let dejar = () => {};
    crearBackend().then(
      async (b) => {
        setBackend(b);
        dejar = b.alCambiarUsuario((u) => setUsuario((antes) => (antes?.id === u?.id ? antes : u)));
        const u = await b.usuario();
        setUsuario(u);
        if (!u) setEstado({ tipo: 'sin-sesion' });
      },
      (e: Error) => setEstado({ tipo: 'sin-conexion', error: e.message }),
    );
    return () => dejar();
  }, []);

  /** Con sesión: busca el comercio y, si es el dueño, su configuración. */
  async function cargarComercio(b: Backend, pantalla: Pantalla = 'inicio') {
    try {
      const [comercio] = await misComercios(b);
      if (!comercio) return setEstado({ tipo: 'sin-comercio', paso: 'elegir' });
      if (comercio.rol === 'empleado') return setEstado({ tipo: 'empleado', comercio, pantalla: 'inicio' });
      const config = await leerConfig({ backend: b, comercioId: comercio.id });
      if (!config) throw new Error('No pudimos leer la configuración del comercio.');
      setEstado({ tipo: 'admin', comercio, config, pantalla });
    } catch (e) {
      setEstado({ tipo: 'sin-conexion', error: (e as Error).message });
    }
  }

  useEffect(() => {
    if (!backend) return;
    if (!usuario) {
      setEstado({ tipo: 'sin-sesion' });
      return;
    }
    setEstado({ tipo: 'cargando' });
    cargarComercio(backend);
  }, [backend, usuario?.id]);

  const comercioId = estado.tipo === 'admin' || estado.tipo === 'empleado' ? estado.comercio.id : null;
  const sesion = useMemo<Sesion | null>(() => (backend && comercioId ? { backend, comercioId } : null), [backend, comercioId]);

  if (estado.tipo === 'cargando') {
    return (
      <p className="p-8 text-center text-stone-600" role="status">
        Cargando…
      </p>
    );
  }
  if (estado.tipo === 'sin-conexion') {
    return (
      <main className="mx-auto max-w-md px-4 pt-8 pb-12">
        <h1 className="text-2xl font-bold">No pudimos conectarnos</h1>
        <p className="mt-2 text-stone-700" role="alert">
          {estado.error}
        </p>
        <button type="button" onClick={() => location.reload()} className="mt-6 min-h-11 font-semibold text-green-800 underline underline-offset-4">
          Probar de nuevo
        </button>
      </main>
    );
  }
  if (!backend) return null;
  if (estado.tipo === 'sin-sesion' || !usuario) return <PantallaIngreso backend={backend} />;
  const salir = () => backend.salir();

  if (estado.tipo === 'sin-comercio') {
    if (estado.paso === 'crear') {
      return (
        <PantallaConfig
          onGuardar={async (config) => {
            await crearComercio(backend, config);
            await cargarComercio(backend);
          }}
          onCancelar={() => setEstado({ tipo: 'sin-comercio', paso: 'elegir' })}
        />
      );
    }
    if (estado.paso === 'unirse') {
      return (
        <PantallaUnirse backend={backend} onUnido={() => cargarComercio(backend)} onVolver={() => setEstado({ tipo: 'sin-comercio', paso: 'elegir' })} />
      );
    }
    return (
      <PantallaBienvenida
        email={usuario.email}
        onCrear={() => setEstado({ tipo: 'sin-comercio', paso: 'crear' })}
        onUnirse={() => setEstado({ tipo: 'sin-comercio', paso: 'unirse' })}
        onSalir={salir}
      />
    );
  }

  if (!sesion) return null;
  return (
    <ContextoSesion.Provider value={sesion}>
      <ProveedorCola>{estado.tipo === 'empleado' ? pantallaEmpleado(estado) : pantallaAdmin(estado)}</ProveedorCola>
    </ContextoSesion.Provider>
  );

  function pantallaEmpleado(e: Extract<Estado, { tipo: 'empleado' }>) {
    const ir = (pantalla: PantallaEmpleadoNav) => setEstado({ ...e, pantalla });
    if (e.pantalla === 'vender') return <PantallaVender onVolver={() => ir('inicio')} onMisVentas={() => ir('mis-ventas')} />;
    if (e.pantalla === 'mis-ventas') return <PantallaVentasDelDia esDueno={false} onVolver={() => ir('inicio')} />;
    return (
      <PantallaEmpleado
        nombreComercio={e.comercio.nombre}
        email={usuario!.email}
        onVender={() => ir('vender')}
        onMisVentas={() => ir('mis-ventas')}
        onSalir={salir}
      />
    );
  }

  function pantallaAdmin(e: Extract<Estado, { tipo: 'admin' }>) {
    const ir = (pantalla: Pantalla, dia?: Dia) => setEstado({ ...e, pantalla, etiquetas: undefined, dia });
    const recargar = (pantalla: Pantalla = 'inicio') => cargarComercio(backend!, pantalla);
    switch (e.pantalla) {
      case 'config':
        return (
          <PantallaConfig
            inicial={e.config}
            onGuardar={async (config) => {
              const guardada = await guardarConfig(sesion!, config);
              setEstado({ ...e, config: guardada, comercio: { ...e.comercio, nombre: guardada.nombreComercio }, pantalla: 'inicio' });
            }}
            onCancelar={() => ir('inicio')}
            onRestaurar={() => ir('respaldo')}
          />
        );
      case 'subir':
        return (
          <PantallaSubirLista
            config={e.config}
            onEtiquetas={(productos) => setEstado({ ...e, pantalla: 'etiquetas', etiquetas: productos })}
            onListaPrecios={() => ir('lista-precios')}
            onVolver={() => ir('inicio')}
          />
        );
      case 'lista-precios':
        return <PantallaListaPrecios nombreComercio={e.config.nombreComercio} onVolver={() => ir('inicio')} />;
      case 'etiquetas':
        return <PantallaEtiquetas preseleccion={e.etiquetas} onVolver={() => ir('inicio')} />;
      case 'catalogo':
        return <PantallaCatalogo config={e.config} onVolver={() => ir('inicio')} />;
      case 'respaldo':
        return <PantallaRespaldo nombreComercio={e.config.nombreComercio} onRestaurado={() => recargar('catalogo')} onVolver={() => ir('config')} />;
      case 'proveedores':
        return <PantallaProveedores onVolver={() => ir('inicio')} />;
      case 'equipo':
        return <PantallaEquipo onVolver={() => ir('inicio')} />;
      case 'ayuda':
        return <PantallaAyuda onIr={(p) => ir(p)} onVolver={() => ir('inicio')} />;
      case 'vender':
        return <PantallaVender onVolver={() => ir('ventas')} onMisVentas={() => ir('ventas-dia')} />;
      case 'ventas':
        return (
          <PantallaResumen
            onVender={() => ir('vender')}
            onVerTickets={(dia) => ir('ventas-dia', dia)}
            onTotalDia={(dia) => ir('total-dia', dia)}
            onVolver={() => ir('inicio')}
          />
        );
      case 'ventas-dia':
        return <PantallaVentasDelDia esDueno diaInicial={e.dia} onVolver={() => ir('ventas')} />;
      case 'total-dia':
        return <PantallaTotalDia dia={e.dia ?? diaDe(new Date())} onGuardado={() => ir('ventas')} onVolver={() => ir('ventas')} />;
      default:
        return <PantallaInicio config={e.config} email={usuario!.email} onIr={(p) => ir(p)} onSalir={salir} />;
    }
  }
}
