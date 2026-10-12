"""
Genera las listas de prueba en PDF de la Fase 2 (F05) en tests/fixtures/sinteticas-pdf/.

Igual que las listas Excel/CSV, son listas armadas por nosotros, no reales. Imitan los PDF que
suelen mandar los proveedores: membrete, varias páginas con títulos repetidos y número de
página, rubros, subtotales, precios alineados a la derecha, con "$" y dos columnas de precio.

Cada PDF va con un `.esperado.json` con las líneas que la app tiene que leer, calculadas acá a
partir de los datos de origen. En un PDF, `filaOrigen` es el número de renglón del documento:
se cuentan todos los renglones con texto, de arriba hacia abajo y página por página.

Uso: python3 scripts/generar-listas-pdf.py   (necesita reportlab y openpyxl)
"""

import importlib.util
import random
import sys
from pathlib import Path

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen.canvas import Canvas

sys.dont_write_bytecode = True
AQUI = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location("listas", AQUI / "generar-listas-prueba.py")
listas = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(listas)

DESTINO = AQUI.parent / "tests" / "fixtures" / "sinteticas-pdf"
pesos_ar, productos, RUBROS = listas.pesos_ar, listas.productos, listas.RUBROS


class Pdf:
    """Dibuja renglones en un PDF y acumula las líneas que la app tiene que leer."""

    def __init__(self, nombre, columnas, tamano=A4, letra=9, interlineado=14, al_cortar=None):
        self.nombre = nombre
        self.lienzo = Canvas(str(DESTINO / nombre), pagesize=tamano, invariant=1)
        self.lienzo.setTitle(nombre)
        self.ancho, self.alto = tamano
        # Cada columna: (x, alineación). En "derecha", x es el borde derecho.
        self.columnas = columnas
        self.letra = letra
        self.interlineado = interlineado
        self.al_cortar = al_cortar
        self.y = self.alto - 50
        self.renglones = 0
        self.paginas = 1
        self.esperadas = []

    def _texto(self, x, texto, alineacion="izquierda", negrita=False, palabra_por_palabra=False):
        fuente = "Helvetica-Bold" if negrita else "Helvetica"
        self.lienzo.setFont(fuente, self.letra)
        if alineacion == "derecha":
            x -= self.lienzo.stringWidth(texto, fuente, self.letra)
        elif alineacion == "centro":
            x -= self.lienzo.stringWidth(texto, fuente, self.letra) / 2
        if palabra_por_palabra:
            # Algunos programas escriben cada palabra por separado; la app tiene que volver a unirlas.
            for palabra in texto.split(" "):
                self.lienzo.drawString(x, self.y, palabra)
                x += self.lienzo.stringWidth(palabra + " ", fuente, self.letra)
        else:
            self.lienzo.drawString(x, self.y, texto)

    def _bajar(self):
        self.renglones += 1
        self.y -= self.interlineado

    def nueva_pagina(self):
        if self.al_cortar:
            self.al_cortar(self, "pie")
        self.lienzo.showPage()
        self.paginas += 1
        self.y = self.alto - 50
        if self.al_cortar:
            self.al_cortar(self, "encabezado")

    def _lugar(self):
        if self.y < 60:
            self.nueva_pagina()

    def suelto(self, texto, x=40, alineacion="izquierda", negrita=False):
        """Renglón con un solo texto (membrete, rubro, pie)."""
        self._texto(x, texto, alineacion, negrita)
        self._bajar()

    def espacio(self, puntos=10):
        self.y -= puntos

    def fila(self, *celdas, negrita=False, palabra_por_palabra=False):
        self._lugar()
        for (x, alineacion), texto in zip(self.columnas, celdas):
            if texto:
                self._texto(x, texto, alineacion, negrita, palabra_por_palabra)
        self._bajar()

    def producto(self, celdas, p, codigo=True, presentacion=True, iva=None, palabra_por_palabra=False):
        self.fila(*celdas, palabra_por_palabra=palabra_por_palabra)
        self.esperadas.append({
            "codigo": p["codigo"] if codigo else None,
            "descripcion": p["descripcion"],
            "presentacion": p["presentacion"] if presentacion else None,
            "costo": p["costo"],
            "ivaIncluido": iva,
            "filaOrigen": self.renglones,
        })

    def guardar(self):
        if self.al_cortar:
            self.al_cortar(self, "pie")
        self.lienzo.showPage()
        self.lienzo.save()
        listas.DESTINO = DESTINO
        guardado = listas.Lista()
        guardado.esperadas = self.esperadas
        listas.guardar_esperado(self.nombre, guardado)


# Columnas habituales: código, descripción, presentación, precio (alineado a la derecha).
CUATRO = [(40, "izquierda"), (100, "izquierda"), (350, "izquierda"), (540, "derecha")]
TRES = [(40, "izquierda"), (100, "izquierda"), (540, "derecha")]


def generar():
    DESTINO.mkdir(parents=True, exist_ok=True)
    for viejo in DESTINO.glob("*"):
        if viejo.name != "LEEME.md":
            viejo.unlink()

    # 01 · Tabla simple de una página
    d = Pdf("01-almacen-basico.pdf", CUATRO)
    d.fila("Código", "Descripción", "Presentación", "Precio", negrita=True)
    for p in productos(30, 101):
        d.producto([p["codigo"], p["descripcion"], p["presentacion"], pesos_ar(p["costo"])], p)
    d.guardar()

    # 02 · Membrete del proveedor arriba y precios sin IVA
    d = Pdf("02-distribuidora-con-membrete.pdf", CUATRO)
    d.suelto("DISTRIBUIDORA EL SOL S.A.", negrita=True)
    d.suelto("Av. Siempreviva 742 - CUIT 30-00000000-0 - Tel. 11-5555-5555")
    d.suelto("Lista de precios N° 41 - Vigencia desde 01/10/2026", x=555, alineacion="derecha")
    d.espacio()
    d.fila("Cód. Art.", "Descripción", "Presentación", "Precio s/IVA", negrita=True)
    for p in productos(35, 102):
        d.producto([p["codigo"], p["descripcion"], p["presentacion"], pesos_ar(p["costo"])], p, iva=False)
    d.guardar()

    # 03 · Varias páginas, con títulos repetidos y número de página
    total_paginas = 3

    def cortar_03(doc, donde):
        if donde == "encabezado":
            doc.fila("Código", "Descripción", "Presentación", "Precio", negrita=True)
        else:
            doc.y = 35
            doc.suelto(f"Página {doc.paginas} de {total_paginas}", x=doc.ancho / 2, alineacion="centro")

    d = Pdf("03-varias-paginas.pdf", CUATRO, al_cortar=cortar_03)
    cortar_03(d, "encabezado")
    for p in productos(130, 103, "E"):
        d.producto([p["codigo"], p["descripcion"], p["presentacion"], pesos_ar(p["costo"])], p)
    assert d.paginas == total_paginas, d.paginas
    d.guardar()

    # 04 · Rubros en negrita entre los productos
    d = Pdf("04-con-rubros.pdf", CUATRO)
    d.fila("Código", "Artículo", "Contenido", "P. Lista", negrita=True)
    todos = productos(40, 104, "B")
    for i, rubro in enumerate(RUBROS[:4]):
        d.espacio(6)
        d.suelto(rubro, negrita=True)
        for p in todos[i * 10:(i + 1) * 10]:
            d.producto([p["codigo"], p["descripcion"], p["presentacion"], pesos_ar(p["costo"])], p)
    d.guardar()

    # 05 · Precios con signo $
    d = Pdf("05-precios-con-signo.pdf", TRES)
    d.fila("Código", "Descripción", "Precio", negrita=True)
    for p in productos(30, 105, "L"):
        d.producto([p["codigo"], p["descripcion"], pesos_ar(p["costo"], con_signo=True)], p, presentacion=False)
    d.guardar()

    # 06 · Dietética: sin código, precio por kilo
    d = Pdf("06-dietetica-sin-codigo.pdf", [(40, "izquierda"), (400, "derecha")])
    d.suelto("DIETÉTICA LA HUERTA - Lista mayorista", negrita=True)
    d.espacio()
    d.fila("Producto", "Precio x kg", negrita=True)
    for p in [p for p in productos(45, 106) if p["presentacion"] == "kg"]:
        d.producto([p["descripcion"], pesos_ar(p["costo"])], p, codigo=False, presentacion=False)
    d.guardar()

    # 07 · Precio de lista y precio sugerido
    d = Pdf("07-precio-lista-y-sugerido.pdf", [(40, "izquierda"), (100, "izquierda"), (420, "derecha"), (490, "derecha"), (555, "derecha")])
    d.fila("Artículo", "Detalle", "Precio sugerido", "Precio lista", "PVP", negrita=True)
    for p in productos(30, 107, "C"):
        d.producto([p["codigo"], p["descripcion"], pesos_ar(round(p["costo"] * 1.6)), pesos_ar(p["costo"]),
                    pesos_ar(round(p["costo"] * 1.8))], p, presentacion=False)
    d.guardar()

    # 08 · Precios con IVA incluido
    d = Pdf("08-precios-con-iva.pdf", TRES)
    d.fila("Código", "Producto", "Precio c/IVA", negrita=True)
    for p in productos(30, 108, "D"):
        d.producto([p["codigo"], p["descripcion"], pesos_ar(p["costo"])], p, presentacion=False, iva=True)
    d.guardar()

    # 09 · Subtotales por rubro y total general
    d = Pdf("09-subtotales.pdf", TRES)
    d.fila("Código", "Descripción", "Importe", negrita=True)
    total_general = 0
    todos = productos(36, 109, "F")
    for i, rubro in enumerate(RUBROS[:3]):
        d.fila("", rubro, negrita=True)
        subtotal = 0
        for p in todos[i * 12:(i + 1) * 12]:
            d.producto([p["codigo"], p["descripcion"], pesos_ar(p["costo"])], p, presentacion=False)
            subtotal += p["costo"]
        d.fila("", f"Subtotal {rubro.lower()}", pesos_ar(subtotal), negrita=True)
        total_general += subtotal
    d.espacio()
    d.fila("", "TOTAL GENERAL", pesos_ar(total_general), negrita=True)
    d.guardar()

    # 10 · Cada palabra escrita por separado
    d = Pdf("10-palabras-sueltas.pdf", CUATRO)
    d.fila("Código", "Descripción", "Presentación", "Precio", negrita=True)
    for p in productos(30, 110, "G"):
        d.producto([p["codigo"], p["descripcion"], p["presentacion"], pesos_ar(p["costo"])], p, palabra_por_palabra=True)
    d.guardar()

    # 11 · Ferretería apaisada con muchas columnas
    columnas = [(30, "izquierda"), (85, "izquierda"), (175, "izquierda"), (430, "izquierda"), (500, "izquierda"),
                (580, "derecha"), (630, "derecha"), (710, "derecha"), (800, "derecha")]
    d = Pdf("11-ferreteria-muchas-columnas.pdf", columnas, tamano=landscape(A4), letra=8, interlineado=12)
    d.fila("Código", "Código de barras", "Descripción", "Marca", "Unidad", "Stock", "Bonif. %", "Precio Neto", "Precio Final", negrita=True)
    azar = random.Random(111)
    for p in productos(30, 111, "M"):
        d.producto([p["codigo"], str(7790000000000 + azar.randint(0, 999999)), p["descripcion"], "Genérica", p["presentacion"],
                    str(azar.randint(0, 50)), "10", pesos_ar(p["costo"]), pesos_ar(round(p["costo"] * 1.21))], p, iva=False)
    d.guardar()

    # 12 · Lista grande: 1.500 productos en varias páginas con rubros
    def cortar_12(doc, donde):
        if donde == "encabezado":
            doc.fila("Código", "Descripción", "Presentación", "Precio", negrita=True)

    d = Pdf("12-grande-1500.pdf", CUATRO, al_cortar=cortar_12)
    d.suelto("Lista general", negrita=True)
    cortar_12(d, "encabezado")
    todos = productos(1500, 112, "Z")
    for i, rubro in enumerate(RUBROS):
        d.fila(rubro, negrita=True)
        for p in todos[i * 300:(i + 1) * 300]:
            d.producto([p["codigo"], p["descripcion"], p["presentacion"], pesos_ar(p["costo"])], p)
    d.guardar()

    # Aparte del set: PDF escaneado (sin texto, sólo una imagen). La app tiene que avisar que no lo puede leer.
    lienzo = Canvas(str(DESTINO.parent / "pdf-escaneado.pdf"), pagesize=A4, invariant=1)
    for i in range(30):
        lienzo.rect(40, 780 - i * 20, 500, 12, fill=1, stroke=0)
    lienzo.showPage()
    lienzo.save()


if __name__ == "__main__":
    generar()
    print(f"Listas generadas en {DESTINO}")
