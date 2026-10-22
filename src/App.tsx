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
import { PantallaAnalisis } from './features/analisis/PantallaAnalisis';
import { PantallaCaja } from './features/caja/PantallaCaja';
import { PantallaClientes } from './features/clientes/PantallaClientes';
import { PantallaGastos } from './features/gastos/PantallaGastos';
import { PantallaStock } from './features/stock/PantallaStock';
import { Marco } from './ui/Marco';
import type { GrupoMenu } from './ui/Marco';
import { MarcoAcceso } from './ui/MarcoAcceso';
import { Logo } from './ui/Logo';
import {
  IconoAyuda,
  IconoCaja,
  IconoCatalogo,
  IconoClientes,
  IconoConfig,
  IconoDocumento,
  IconoEquipo,
  IconoEtiqueta,
  IconoGastos,
  IconoGrafico,
  IconoInicio,
  IconoProveedores,
  IconoStock,
  IconoSubir,
  IconoTicket,
  IconoVender,
} from './ui/Iconos';

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
  | 'total-dia'
  | 'analisis'
  | 'caja'
  | 'clientes'
  | 'stock'
  | 'gastos';

/** Pantallas del empleado: vende, ve sus ventas de hoy y abre o cierra la caja de hoy. */
type PantallaEmpleadoNav = 'inicio' | 'vender' | 'mis-ventas' | 'caja';

/** Menú del dueño, agrupado por área. */
const MENU_DUENO: GrupoMenu<Pantalla>[] = [
  { items: [{ id: 'inicio', etiqueta: 'Inicio', Icono: IconoInicio }] },
  {
    titulo: 'Ventas',
    items: [
      { id: 'vender', etiqueta: 'Vender', Icono: IconoVender },
      { id: 'ventas', etiqueta: 'Ventas', Icono: IconoTicket },
      { id: 'caja', etiqueta: 'Caja', Icono: IconoCaja },
      { id: 'clientes', etiqueta: 'Clientes', Icono: IconoClientes },
      { id: 'analisis', etiqueta: 'Análisis', Icono: IconoGrafico },
      { id: 'gastos', etiqueta: 'Gastos y resultado', Icono: IconoGastos },
    ],
  },
  {
    titulo: 'Precios',
    items: [
      { id: 'subir', etiqueta: 'Subir lista', Icono: IconoSubir },
      { id: 'catalogo', etiqueta: 'Catálogo', Icono: IconoCatalogo },
      { id: 'stock', etiqueta: 'Stock', Icono: IconoStock },
      { id: 'proveedores', etiqueta: 'Proveedores', Icono: IconoProveedores },
      { id: 'etiquetas', etiqueta: 'Etiquetas', Icono: IconoEtiqueta },
      { id: 'lista-precios', etiqueta: 'Lista de precios', Icono: IconoDocumento },
    ],
  },
  {
    titulo: 'Comercio',
    items: [
      { id: 'equipo', etiqueta: 'Equipo', Icono: IconoEquipo },
      { id: 'config', etiqueta: 'Configuración', Icono: IconoConfig },
      { id: 'ayuda', etiqueta: 'Ayuda', Icono: IconoAyuda },
    ],
  },
];

/** Pantallas que cuelgan de una sección del menú: la marcan como actual. */
const SECCION_DE: Partial<Record<Pantalla, Pantalla>> = { 'ventas-dia': 'ventas', 'total-dia': 'ventas', respaldo: 'config' };

const MENU_EMPLEADO: GrupoMenu<PantallaEmpleadoNav>[] = [
  {
    items: [
      { id: 'inicio', etiqueta: 'Inicio', Icono: IconoInicio },
      { id: 'vender', etiqueta: 'Vender', Icono: IconoVender },
      { id: 'mis-ventas', etiqueta: 'Mis ventas', Icono: IconoTicket },
      { id: 'caja', etiqueta: 'Caja', Icono: IconoCaja },
    ],
  },
];

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
  /** Cambia cada vez que se elige una sección del menú: así la pantalla arranca de cero aunque sea la misma. */
  const [visita, setVisita] = useState(0);

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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4">
        <Logo tamano="grande" />
        <p className="text-stone-600" role="status">
          Cargando…
        </p>
      </div>
    );
  }
  if (estado.tipo === 'sin-conexion') {
    return (
      <MarcoAcceso>
        <main className="mx-auto w-full max-w-md px-4 pt-8 pb-12">
          <h1 className="text-2xl font-bold">No pudimos conectarnos</h1>
          <p className="mt-2 text-stone-700" role="alert">
            {estado.error}
          </p>
          <button type="button" onClick={() => location.reload()} className="mt-6 min-h-11 font-semibold text-green-700 underline underline-offset-4">
            Probar de nuevo
          </button>
        </main>
      </MarcoAcceso>
    );
  }
  if (!backend) return null;
  if (estado.tipo === 'sin-sesion' || !usuario) {
    return (
      <MarcoAcceso>
        <PantallaIngreso backend={backend} />
      </MarcoAcceso>
    );
  }
  const b = backend;
  const u = usuario;
  const salir = () => b.salir();

  if (estado.tipo === 'sin-comercio') return <MarcoAcceso>{pantallaSinComercio(estado.paso)}</MarcoAcceso>;

  if (!sesion) return null;
  return (
    <ContextoSesion.Provider value={sesion}>
      <ProveedorCola>{estado.tipo === 'empleado' ? pantallaEmpleado(estado) : pantallaAdmin(estado)}</ProveedorCola>
    </ContextoSesion.Provider>
  );

  function pantallaSinComercio(paso: 'elegir' | 'crear' | 'unirse') {
    if (paso === 'crear') {
      return (
        <PantallaConfig
          onGuardar={async (config) => {
            await crearComercio(b, config);
            await cargarComercio(b);
          }}
          onCancelar={() => setEstado({ tipo: 'sin-comercio', paso: 'elegir' })}
        />
      );
    }
    if (paso === 'unirse') {
      return <PantallaUnirse backend={b} onUnido={() => cargarComercio(b)} onVolver={() => setEstado({ tipo: 'sin-comercio', paso: 'elegir' })} />;
    }
    return (
      <PantallaBienvenida
        email={u.email}
        onCrear={() => setEstado({ tipo: 'sin-comercio', paso: 'crear' })}
        onUnirse={() => setEstado({ tipo: 'sin-comercio', paso: 'unirse' })}
        onSalir={salir}
      />
    );
  }

  /** Elegir una sección del menú: la pantalla se arma de nuevo aunque ya estuviera abierta. */
  function desdeMenu<T>(ir: (p: T) => void) {
    return (p: T) => {
      setVisita((v) => v + 1);
      ir(p);
    };
  }

  function pantallaEmpleado(e: Extract<Estado, { tipo: 'empleado' }>) {
    const ir = (pantalla: PantallaEmpleadoNav) => setEstado({ ...e, pantalla });
    let contenido;
    if (e.pantalla === 'vender') contenido = <PantallaVender onVolver={() => ir('inicio')} onMisVentas={() => ir('mis-ventas')} />;
    else if (e.pantalla === 'mis-ventas') contenido = <PantallaVentasDelDia esDueno={false} onVolver={() => ir('inicio')} />;
    else if (e.pantalla === 'caja') contenido = <PantallaCaja esDueno={false} onVolver={() => ir('inicio')} />;
    else
      contenido = (
        <PantallaEmpleado nombreComercio={e.comercio.nombre} onVender={() => ir('vender')} onMisVentas={() => ir('mis-ventas')} onCaja={() => ir('caja')} />
      );
    return (
      <Marco
        nombreComercio={e.comercio.nombre}
        rol="Empleado"
        email={u.email}
        grupos={MENU_EMPLEADO}
        activo={e.pantalla}
        pantalla={`${e.pantalla}-${visita}`}
        onIr={desdeMenu(ir)}
        onSalir={salir}
      >
        <div key={visita}>{contenido}</div>
      </Marco>
    );
  }

  function pantallaAdmin(e: Extract<Estado, { tipo: 'admin' }>) {
    const ir = (pantalla: Pantalla, dia?: Dia) => setEstado({ ...e, pantalla, etiquetas: undefined, dia });
    return (
      <Marco
        nombreComercio={e.comercio.nombre}
        rol="Dueño"
        email={u.email}
        grupos={MENU_DUENO}
        activo={SECCION_DE[e.pantalla] ?? e.pantalla}
        pantalla={`${e.pantalla}-${visita}`}
        onIr={desdeMenu((p: Pantalla) => ir(p))}
        onSalir={salir}
      >
        <div key={visita}>{contenidoAdmin(e, ir)}</div>
      </Marco>
    );
  }

  function contenidoAdmin(e: Extract<Estado, { tipo: 'admin' }>, ir: (pantalla: Pantalla, dia?: Dia) => void) {
    const recargar = (pantalla: Pantalla = 'inicio') => cargarComercio(b, pantalla);
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
            onAnalisis={() => ir('analisis')}
            onVolver={() => ir('inicio')}
          />
        );
      case 'analisis':
        return <PantallaAnalisis config={e.config} onVolver={() => ir('inicio')} />;
      case 'caja':
        return <PantallaCaja esDueno onVolver={() => ir('inicio')} />;
      case 'stock':
        return <PantallaStock nombreComercio={e.config.nombreComercio} onVolver={() => ir('inicio')} />;
      case 'gastos':
        return <PantallaGastos onVolver={() => ir('inicio')} />;
      case 'clientes':
        return <PantallaClientes nombreComercio={e.config.nombreComercio} onVolver={() => ir('inicio')} />;
      case 'ventas-dia':
        return <PantallaVentasDelDia esDueno diaInicial={e.dia} onVolver={() => ir('ventas')} />;
      case 'total-dia':
        return <PantallaTotalDia dia={e.dia ?? diaDe(new Date())} onGuardado={() => ir('ventas')} onVolver={() => ir('ventas')} />;
      default:
        return <PantallaInicio config={e.config} onIr={(p) => ir(p)} />;
    }
  }
}
