import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { PDFFont, PDFPage } from 'pdf-lib';
import { formatearPesos } from '../domain/dinero';
import { ALTO_A4, ANCHO_A4, partirEnRenglones } from '../domain/etiquetas';
import type { GrupoRubro } from '../domain/exportar';
import { textoParaPdf } from './etiquetasPdf';

/** F11: lista de precios para el mostrador, en A4, agrupada por rubro. */

const PT_POR_MM = 72 / 25.4;
const ANCHO = ANCHO_A4 * PT_POR_MM;
const ALTO = ALTO_A4 * PT_POR_MM;
const MARGEN = 15 * PT_POR_MM;
const TAM = 10.5;
const RENGLON = TAM * 1.55;
const TAM_RUBRO = 12;

export async function generarListaPreciosPdf(grupos: readonly GrupoRubro[], comercio: string, fecha: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Lista de precios ${textoParaPdf(comercio)}`);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrita = await pdf.embedFont(StandardFonts.HelveticaBold);
  const paginas: PDFPage[] = [];
  let pagina!: PDFPage;
  let y = 0;

  const nuevaPagina = () => {
    pagina = pdf.addPage([ANCHO, ALTO]);
    paginas.push(pagina);
    y = ALTO - MARGEN;
    pagina.drawText(textoParaPdf(comercio), { x: MARGEN, y: y - 14, size: 14, font: negrita });
    const subtitulo = `Lista de precios · ${fecha}`;
    pagina.drawText(subtitulo, { x: ANCHO - MARGEN - normal.widthOfTextAtSize(subtitulo, 9), y: y - 13, size: 9, font: normal, color: rgb(0.35, 0.35, 0.35) });
    y -= 26;
    pagina.drawLine({ start: { x: MARGEN, y }, end: { x: ANCHO - MARGEN, y }, thickness: 0.6, color: rgb(0.6, 0.6, 0.6) });
    y -= 8;
  };
  const queda = (alto: number) => y - alto >= MARGEN + 14;

  nuevaPagina();
  const anchoPrecio = 70;
  const anchoDescripcion = ANCHO - 2 * MARGEN - anchoPrecio - 8;
  let par = false;
  for (const grupo of grupos) {
    // Un rubro no empieza al pie de la hoja: título y al menos un producto juntos.
    if (!queda(TAM_RUBRO * 2 + RENGLON)) nuevaPagina();
    y -= TAM_RUBRO * 1.6;
    pagina.drawText(textoParaPdf(grupo.rubro ?? 'Sin rubro'), { x: MARGEN, y, size: TAM_RUBRO, font: negrita, color: rgb(0.08, 0.5, 0.24) });
    y -= 6;
    par = false;
    for (const producto of grupo.productos) {
      const renglones = partirEnRenglones(textoParaPdf(producto.descripcion), anchoDescripcion, 2, (t) => normal.widthOfTextAtSize(t, TAM));
      const alto = RENGLON * renglones.length;
      if (!queda(alto)) {
        nuevaPagina();
        par = false;
      }
      if (par) pagina.drawRectangle({ x: MARGEN - 3, y: y - alto, width: ANCHO - 2 * MARGEN + 6, height: alto, color: rgb(0.95, 0.95, 0.94) });
      renglones.forEach((r, i) => pagina.drawText(r, { x: MARGEN, y: y - RENGLON * (i + 1) + RENGLON * 0.32, size: TAM, font: normal }));
      const precio = formatearPesos(producto.precioVentaActual);
      pagina.drawText(precio, { x: ANCHO - MARGEN - negrita.widthOfTextAtSize(precio, TAM), y: y - RENGLON + RENGLON * 0.32, size: TAM, font: negrita });
      y -= alto;
      par = !par;
    }
  }

  paginas.forEach((p, i) => numerar(p, `Página ${i + 1} de ${paginas.length}`, normal));
  return pdf.save();
}

function numerar(pagina: PDFPage, texto: string, fuente: PDFFont) {
  pagina.drawText(texto, { x: ANCHO - MARGEN - fuente.widthOfTextAtSize(texto, 8), y: MARGEN - 12, size: 8, font: fuente, color: rgb(0.45, 0.45, 0.45) });
}
