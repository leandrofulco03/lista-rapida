import { describe, expect, it } from 'vitest';
import {
  IndiceCatalogo,
  claveVinculo,
  contenidoDe,
  contenidoDistinto,
  normalizarDescripcion,
  similitud,
  variedadDistinta,
  vincularLinea,
} from './vinculacion';

describe('normalizarDescripcion', () => {
  it.each([
    ['Aceite 1 lt', 'aceite 1000ml'],
    ['Aceite 1l', 'aceite 1000ml'],
    ['Aceite 1.000 ml', 'aceite 1000ml'],
    ['Aceite 1,5 Lts', 'aceite 1500ml'],
    ['Gaseosa 2.25 LTS', 'gaseosa 2250ml'],
    ['Detergente 750cc', 'detergente 750ml'],
    ['Yerba 1 KG', 'yerba 1000g'],
    ['Yerba 500grs', 'yerba 500g'],
    ['Galletitas 3x101g', 'galletitas 3 x 101g'],
    ['Alfajor x 6', 'alfajor x6'],
    ['Alfajor pack 6', 'alfajor x6'],
    ['Alfajor 6 un', 'alfajor x6'],
    ['Papel 4 x 30 mts', 'papel 4 x 30m'],
    ['Té Taragüí', 'te taragui'],
    ["Mayonesa Hellmann's", 'mayonesa hellmanns'],
    ['Agua s/gas', 'agua s gas'],
    ['Mecha para hormigón 6 mm', 'mecha para hormigon 6mm'],
    ['Térmica 2 x 20 A', 'termica 2 x 20a'],
    ['Lámpara LED 9 W 220 V', 'lampara led 9w 220v'],
  ])('%s → %s', (texto, esperado) => {
    expect(normalizarDescripcion(texto)).toBe(esperado);
  });
});

describe('contenido', () => {
  it('lee medida y pack', () => {
    expect(contenidoDe('alfajor jorgito x6')).toEqual({ medida: null, pack: '6' });
    expect(contenidoDe('yerba 500g')).toEqual({ medida: '500g', pack: null });
  });

  it('500 g contra 1 kg es distinto; si uno no dice contenido, no', () => {
    expect(contenidoDistinto(contenidoDe('yerba 500g'), contenidoDe('yerba 1000g'))).toBe(true);
    expect(contenidoDistinto(contenidoDe('yerba 1000g'), contenidoDe('yerba 1000g'))).toBe(false);
    expect(contenidoDistinto(contenidoDe('yerba'), contenidoDe('yerba 1000g'))).toBe(false);
    expect(contenidoDistinto(contenidoDe('alfajor x6'), contenidoDe('alfajor x12'))).toBe(true);
  });
});

describe('similitud', () => {
  it('es 1 con las mismas palabras y 0 sin ninguna en común', () => {
    expect(similitud('yerba playadito 1000g', 'yerba playadito 1000g')).toBe(1);
    expect(similitud('yerba playadito', 'aceite natura')).toBe(0);
  });

  it('acepta abreviaturas y una letra de diferencia', () => {
    expect(similitud('leche entera', 'leche ent')).toBeGreaterThan(0.8);
    expect(similitud('fideos tirabuzon', 'fideos tirabuson')).toBeGreaterThan(0.8);
  });

  it('no cuenta palabras vacías', () => {
    expect(similitud('dulce de leche', 'dulce leche')).toBe(1);
  });
});

describe('variedadDistinta', () => {
  const n = normalizarDescripcion;
  it('una palabra de más de cada lado, o light/zero de un solo lado', () => {
    expect(variedadDistinta(n('Yogur Ser vainilla'), n('Yogur Ser frutilla'))).toBe(true);
    expect(variedadDistinta(n('Coca Cola Zero 500cc'), n('Coca-Cola 500 ml'))).toBe(true);
    expect(variedadDistinta(n('Coca Cola sabor original 500cc'), n('Coca-Cola 500 ml'))).toBe(false);
    expect(variedadDistinta(n('Yerba Playadito 1 kg'), n('Yerba mate Playadito 1 kg'))).toBe(false);
    expect(variedadDistinta(n('YERBA TARAGUI C/PALO 1KG'), n('Yerba mate Taragüí con palo 1 kg'))).toBe(false);
  });
});

describe('vincularLinea', () => {
  const indice = new IndiceCatalogo(
    [
      'Yerba mate Playadito 1 kg',
      'Yerba mate Playadito 500 g',
      'Aceite Natura girasol 900 ml',
      'Aceite Cocinero girasol 900 ml',
    ].map((d, id) => ({ id: id + 1, descripcionNormalizada: normalizarDescripcion(d) })),
  );

  it('una línea ya vinculada por código va sola, aunque cambie la descripción', () => {
    const vinculados = new Map([['ab-12', 2]]);
    expect(vincularLinea({ codigo: ' AB-12 ', descripcion: 'cualquier cosa' }, vinculados, indice)).toEqual({
      estado: 'vinculada',
      productoId: 2,
      opciones: [],
    });
  });

  it('sin códigos, recuerda por la descripción normalizada', () => {
    const vinculados = new Map([[claveVinculo(null, 'YERBA PLAYADITO 1 KG'), 1]]);
    expect(vincularLinea({ codigo: null, descripcion: 'Yerba Playadito 1kg' }, vinculados, indice).estado).toBe('vinculada');
  });

  it('sin códigos, la presentación es parte de lo que se recuerda', () => {
    const vinculados = new Map([[claveVinculo(null, 'Látex Alba', '4 l'), 1]]);
    expect(vincularLinea({ codigo: null, descripcion: 'Latex Alba', presentacion: '4 lts' }, vinculados, indice).estado).toBe('vinculada');
    expect(vincularLinea({ codigo: null, descripcion: 'Latex Alba', presentacion: '20 lts' }, vinculados, indice).estado).not.toBe('vinculada');
    // Si la lista no tiene presentación aparte, la clave no cambia con lo que había antes.
    expect(claveVinculo(null, 'Yerba 1 kg', null)).toBe(claveVinculo(null, 'Yerba 1 kg'));
  });

  it('otra variedad del mismo producto no se sugiere sola', () => {
    const lacteos = new IndiceCatalogo(
      ['Yogur bebible Ser frutilla 900 g', 'Coca-Cola 500 ml'].map((d, id) => ({ id: id + 1, descripcionNormalizada: normalizarDescripcion(d) })),
    );
    expect(vincularLinea({ codigo: null, descripcion: 'YOGUR BEBIBLE SER VAINILLA 900GR' }, new Map(), lacteos).estado).toBe('dudosa');
    expect(vincularLinea({ codigo: null, descripcion: 'Coca Cola Light 500cc' }, new Map(), lacteos).estado).toBe('dudosa');
    expect(vincularLinea({ codigo: null, descripcion: 'COCA COLA 500CC' }, new Map(), lacteos)).toMatchObject({ estado: 'sugerida', productoId: 2 });
  });

  it('sugiere cuando se parece mucho y el contenido coincide', () => {
    const r = vincularLinea({ codigo: 'X1', descripcion: 'YERBA PLAYADITO X 1 KG' }, new Map(), indice);
    expect(r).toMatchObject({ estado: 'sugerida', productoId: 1 });
  });

  it('usa la presentación de su columna', () => {
    const r = vincularLinea({ codigo: null, descripcion: 'Yerba Playadito', presentacion: '500 grs' }, new Map(), indice);
    expect(r).toMatchObject({ estado: 'sugerida', productoId: 2 });
  });

  it('con otro contenido no sugiere: queda dudosa con opciones', () => {
    const r = vincularLinea({ codigo: null, descripcion: 'Yerba mate Playadito 2 kg' }, new Map(), indice);
    expect(r.estado).toBe('dudosa');
    expect(r.productoId).toBeNull();
    expect(r.opciones.map((o) => o.productoId)).toEqual(expect.arrayContaining([1, 2]));
  });

  it('si dos productos empatan, que elija el comerciante', () => {
    const r = vincularLinea({ codigo: null, descripcion: 'Aceite girasol 900 cc' }, new Map(), indice);
    expect(r.estado).toBe('dudosa');
    expect(r.opciones).toHaveLength(2);
  });

  it('sin parecido es nueva', () => {
    expect(vincularLinea({ codigo: null, descripcion: 'Vino Toro tinto 1 l' }, new Map(), indice)).toEqual({
      estado: 'nueva',
      productoId: null,
      opciones: [],
    });
  });
});
