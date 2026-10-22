import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import {
  abrirCaja,
  ajustarStock,
  anularVenta,
  cerrarCaja,
  crearProveedor,
  guardarCliente,
  guardarGasto,
  guardarGastosMes,
  guardarSinDetalle,
  guardarVinculos,
  importarCatalogo,
  leerCaja,
  listarProductos,
  movimientoCaja,
  registrarPago,
  registrarVenta,
} from '../db';
import type { Producto, Sesion } from '../db';
import type { ConfigComercio } from '../domain/config';
import type { ProductoArchivo } from '../domain/catalogo';
import type { Centavos } from '../domain/dinero';
import { mesDe, sumarMeses } from '../domain/gastos';
import { diaDe, sumarDias } from '../domain/ventas';
import type { Dia, LineaTicket, MedioVenta } from '../domain/ventas';

/**
 * Comercio de ejemplo para mirar la app con datos: el kiosco ficticio de tests/fixtures/comercios
 * (mismo catálogo y mismos proveedores, así se le pueden subir las listas de la semana 2), con semanas de ventas,
 * clientes con fiado, cajas cerradas, stock y gastos. Todo inventado; se carga con las mismas funciones que la app.
 */

export const CONFIG_DEMO: ConfigComercio = {
  nombreComercio: 'Kiosco El Pibe (demo)',
  // Es el recargo con el que están hechos los precios del catálogo ficticio (alrededor de 40% sobre costo con IVA).
  recargoGeneral: 4000,
  redondeo: { tipo: 'multiplo', pesos: 10 },
  ventaIncluyeIva: true,
  ivaDefault: 2100,
};

const FIXTURES = new URL('../../tests/fixtures/comercios/', import.meta.url);

export interface OpcionesDemo {
  /** Días de ventas hacia atrás, sin contar hoy. */
  dias: number;
  /** Días (de los últimos) con la caja abierta y cerrada. */
  diasCaja: number;
  ahora?: Date;
  semilla?: number;
  /** Ventas que se mandan a la vez. */
  enParalelo?: number;
  avisar?: (texto: string) => void;
}

export interface ResumenDemo {
  productos: number;
  ventas: number;
  anuladas: number;
  clientes: number;
}

/** Números al azar repetibles (mulberry32). */
function azar(semilla: number) {
  let s = semilla >>> 0;
  const siguiente = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    numero: siguiente,
    entero: (min: number, max: number) => min + Math.floor(siguiente() * (max - min + 1)),
    elegir<T>(items: readonly T[], peso: (t: T) => number = () => 1): T {
      const total = items.reduce((s, i) => s + peso(i), 0);
      let r = siguiente() * total;
      for (const i of items) {
        r -= peso(i);
        if (r <= 0) return i;
      }
      return items[items.length - 1]!;
    },
  };
}

/** Lo que más se vende en un kiosco: bebidas, alfajores y golosinas baratas. */
function popularidad(descripcion: string): number {
  const d = descripcion.toLowerCase();
  if (/coca-cola 500|agua villavicencio|cerveza|alfajor jorgito|alfajor guaymall|chicles|tita|rhodesia/.test(d)) return 10;
  if (/coca-cola|sprite|speed|bon o bon|turr|pico dulce|papas|gatorade/.test(d)) return 6;
  if (/pilas|mantecol|havanna|monster|levit|cepita/.test(d)) return 2;
  return 4;
}

const MEDIOS: { medio: MedioVenta; peso: number }[] = [
  { medio: 'efectivo', peso: 45 },
  { medio: 'qr', peso: 26 },
  { medio: 'debito', peso: 15 },
  { medio: 'transferencia', peso: 5 },
  { medio: 'credito', peso: 3 },
  { medio: 'fiado', peso: 6 },
];

/** Hora de una venta: más al mediodía y a la salida del trabajo y del colegio. */
const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];
const PESO_HORA: Record<number, number> = { 8: 3, 9: 4, 10: 5, 11: 6, 12: 9, 13: 9, 14: 5, 15: 4, 16: 6, 17: 8, 18: 10, 19: 10, 20: 8, 21: 5 };

const CLIENTES = [
  { nombre: 'Doña Rosa', telefono: '11 5555 0101', limite: 3_000_000 },
  { nombre: 'Marcelo del taller', telefono: '11 5555 0102', limite: null },
  { nombre: 'Sofía (2° B)', telefono: null, limite: 1_000_000 },
  { nombre: 'Don Héctor', telefono: '11 5555 0104', limite: null },
  { nombre: 'Carla Méndez', telefono: '11 5555 0105', limite: 2_000_000 },
];

const GASTOS: { nombre: string; montos: [number, number, number] }[] = [
  // Del mes de hace dos meses al de este mes, en pesos.
  { nombre: 'Alquiler', montos: [420_000, 420_000, 450_000] },
  { nombre: 'Luz', montos: [58_000, 64_000, 71_000] },
  { nombre: 'Internet', montos: [25_000, 25_000, 27_500] },
  { nombre: 'Monotributo', montos: [42_000, 42_000, 42_000] },
  { nombre: 'Sueldo de Juan', montos: [380_000, 380_000, 400_000] },
];

/** El catálogo del kiosco ficticio (Excel con pesos): código, descripción, rubro, costo, precio, IVA. */
function catalogoKiosco(): ProductoArchivo[] {
  const libro = XLSX.read(readFileSync(new URL('kiosco-catalogo.xlsx', FIXTURES)));
  const filas = XLSX.utils.sheet_to_json<(string | number)[]>(libro.Sheets[libro.SheetNames[0]!]!, { header: 1 }).slice(1);
  return filas
    .filter((f) => f[1])
    .map((f, i) => ({
      codigo: String(f[0]),
      descripcion: String(f[1]),
      rubro: String(f[2]),
      costo: Math.round(Number(f[3]) * 100),
      precioVenta: Math.round(Number(f[4]) * 100),
      ivaPct: Math.round(Number(f[5]) * 100),
      filaOrigen: i + 2,
    }));
}

interface Linea {
  codigo: string | null;
  descripcion: string;
  presentacion: string | null;
  producto: string | null;
}

function lineasSemana1(archivo: string): { proveedor: string; listaIncluyeIva: boolean; lineas: Linea[] } {
  return JSON.parse(readFileSync(new URL(`${archivo}.esperado.json`, FIXTURES), 'utf8'));
}

/** Momento de un día de Argentina a una hora y minuto. */
const momento = (dia: Dia, hora: number, minuto: number) => new Date(`${dia}T${String(hora).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00-03:00`);

async function enTandas<T>(items: readonly T[], tanda: number, hacer: (t: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += tanda) await Promise.all(items.slice(i, i + tanda).map(hacer));
}

/**
 * Carga el demo en un comercio recién creado con CONFIG_DEMO. `empleado` (opcional) carga parte de las ventas
 * y abre la caja de hoy.
 */
export async function cargarDemo(dueno: Sesion, empleado: Sesion | null, o: OpcionesDemo): Promise<ResumenDemo> {
  const r = azar(o.semilla ?? 20261022);
  const ahora = o.ahora ?? new Date();
  const hoy = diaDe(ahora);
  const avisar = o.avisar ?? (() => {});
  const tanda = o.enParalelo ?? 4;

  // Catálogo y proveedores (como si ya se hubiera procesado la lista de la semana 1 de cada uno).
  await importarCatalogo(dueno, catalogoKiosco(), CONFIG_DEMO);
  const productos = await listarProductos(dueno);
  const porCodigo = new Map(productos.map((p) => [p.codigoInterno, p]));
  for (const archivo of ['kiosco-proveedor-a-semana-1.xlsx', 'kiosco-proveedor-b-semana-1.pdf']) {
    const lista = lineasSemana1(archivo);
    const { id } = await crearProveedor(dueno, lista.proveedor, lista.listaIncluyeIva);
    await guardarVinculos(
      dueno,
      id,
      lista.lineas
        .filter((l) => l.producto && porCodigo.has(l.producto))
        .map((l) => ({ codigo: l.codigo, descripcion: l.descripcion, presentacion: l.presentacion, productoId: porCodigo.get(l.producto!)!.id })),
    );
  }
  avisar(`Catálogo: ${productos.length} productos y 2 proveedores.`);

  // Clientes con fiado.
  const clientes = CLIENTES.map((k) => ({ id: crypto.randomUUID(), nombre: k.nombre, telefono: k.telefono, limite: k.limite, nota: null }));
  for (const k of clientes) await guardarCliente(dueno, k);

  const venta = (dia: Dia, hora: number) => {
    const lineas: LineaTicket[] = [];
    if (r.numero() < 0.04) {
      lineas.push({ productoId: null, descripcion: 'Carga SUBE', cantidad: 1, precioUnitario: r.elegir([200_000, 300_000, 500_000]) });
    }
    const cuantos = r.elegir([1, 1, 1, 2, 2, 3, 4]);
    const elegidos = new Set<Producto>();
    while (elegidos.size < cuantos) elegidos.add(r.elegir(productos, (p) => popularidad(p.descripcion)));
    for (const p of elegidos) {
      const cantidad = /coca|agua|cerveza|sprite|speed|gatorade|monster/i.test(p.descripcion) || r.numero() < 0.15 ? r.elegir([1, 1, 2]) : 1;
      lineas.push({ productoId: p.id, descripcion: p.descripcion, cantidad, precioUnitario: p.precioVentaActual });
    }
    const medio = r.elegir(MEDIOS, (m) => m.peso).medio;
    const cliente = medio === 'fiado' ? r.elegir(clientes) : null;
    return {
      id: crypto.randomUUID(),
      fecha: momento(dia, hora, r.entero(0, 59)).toISOString(),
      medioPago: medio,
      lineas,
      ...(cliente && { cliente: { id: cliente.id, nombre: cliente.nombre } }),
    };
  };

  let ventas = 0;
  let anuladas = 0;
  // Un domingo de hace unas semanas se anotó sólo el total del día.
  const sinDetalle = (() => {
    let d = sumarDias(hoy, -Math.min(o.dias, 18));
    while (new Date(`${d}T12:00:00Z`).getUTCDay() !== 0 && d < hoy) d = sumarDias(d, 1);
    return d < hoy ? d : null;
  })();

  for (let atras = o.dias; atras >= 0; atras--) {
    const dia = sumarDias(hoy, -atras);
    const semana = new Date(`${dia}T12:00:00Z`).getUTCDay();
    const conCaja = atras <= o.diasCaja;
    if (dia === sinDetalle) {
      await guardarSinDetalle(dueno, dia, { efectivo: 18_500_000, qr: 9_200_000, debito: 3_100_000 });
      continue;
    }
    if (conCaja) await abrirCaja(atras === 0 && empleado ? empleado : dueno, dia, 2_000_000);

    const base = semana === 6 ? 40 : semana === 0 ? 22 : 30;
    let horas = HORAS;
    if (atras === 0) horas = HORAS.filter((h) => momento(dia, h, 59) <= ahora);
    const cantidad = horas.length === 0 ? 0 : Math.round((base + r.entero(-5, 5)) * (horas.length / HORAS.length));
    const delDia = Array.from({ length: cantidad }, () => venta(dia, r.elegir(horas, (h) => PESO_HORA[h]!)));
    // No se cargan ventas en el futuro (hoy, después de la hora actual).
    const validas = delDia.filter((v) => new Date(v.fecha) <= ahora);
    await enTandas(validas, tanda, async (v) => {
      // El empleado carga casi la mitad (si hay); el dueño, el resto.
      await registrarVenta(empleado && r.numero() < 0.45 ? empleado : dueno, v);
    });
    ventas += validas.length;
    for (const v of validas) {
      if (r.numero() < 0.01) {
        await anularVenta(dueno, v.id);
        anuladas++;
      }
    }

    if (conCaja && atras > 0) {
      if (semana === 2 || semana === 5) {
        await movimientoCaja(dueno, dia, { tipo: 'salida', monto: r.entero(4, 9) * 1_000_000, motivo: 'Pago a Golosinas Mayorista Norte' });
      }
      // El dueño se lleva la plata y deja $ 20.000 de cambio; al contar, casi siempre da justo.
      const { esperado } = await leerCaja(dueno, dia);
      const retiro = (esperado?.esperado ?? 0) - 2_000_000;
      if (retiro > 0) await movimientoCaja(dueno, dia, { tipo: 'salida', monto: retiro, motivo: 'Retiro del dueño' });
      const diferencia = r.elegir([0, 0, 0, 0, 0, 0, -50_000, 20_000, -150_000]);
      await cerrarCaja(dueno, dia, 2_000_000 + diferencia, diferencia < -100_000 ? 'Faltó plata, revisar' : '');
    }
    avisar(`${dia}: ${validas.length} ventas.`);
  }

  // Hoy pagaron algunos clientes.
  await registrarPago(dueno, { clienteId: clientes[0]!.id, monto: 1_500_000, medioPago: 'efectivo', nota: 'A cuenta' });
  await registrarPago(dueno, { clienteId: clientes[3]!.id, monto: 800_000, medioPago: 'transferencia' });

  // Stock de lo que más rota: algunos quedan cortos, para que haya algo para pedir.
  const conStock: [string, number][] = [
    ['Coca-Cola 500 ml', 6],
    ['Coca-Cola 2,25 l', 9],
    ['Agua Villavicencio 500 ml', 4],
    ['Cerveza Quilmes lata 473 ml', 24],
    ['Cerveza Brahma lata 473 ml', 3],
    ['Speed 250 ml', 12],
    ['Alfajor Jorgito chocolate', 10],
    ['Alfajor Guaymallén blanco', 40],
    ['Chicles Beldent menta', 2],
    ['Tita', 18],
    ['Rhodesia', 5],
    ['Papas fritas Lays clásicas 85 g', 7],
    ['Pilas Duracell AA x 2', 6],
  ];
  const porNombre = new Map(productos.map((p) => [p.descripcion, p]));
  await ajustarStock(
    dueno,
    conStock.filter(([d]) => porNombre.has(d)).map(([d, cantidad]) => ({ productoId: porNombre.get(d)!.id, cantidad })),
    'Conteo inicial',
  );

  // Gastos fijos de los últimos tres meses.
  const mes = mesDe(hoy);
  const gastos = GASTOS.map((g) => ({ ...g, id: crypto.randomUUID() }));
  for (const g of gastos) await guardarGasto(dueno, g.id, g.nombre);
  for (let i = 0; i < 3; i++) {
    const m = sumarMeses(mes, i - 2);
    await guardarGastosMes(dueno, m, Object.fromEntries(gastos.map((g) => [g.id, g.montos[i]! * 100 as Centavos])));
  }

  avisar(`Listo: ${ventas} ventas (${anuladas} anuladas), ${clientes.length} clientes.`);
  return { productos: productos.length, ventas, anuladas, clientes: clientes.length };
}
