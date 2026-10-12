"""
Genera listas ficticias de tres comercios argentinos (kiosco, ferretería y almacén) en
tests/fixtures/comercios/, para probar la app de punta a punta como en un piloto.

Pedido de Leandro (12/10/2026): listas ficticias basadas en lo que se vende hoy en Argentina.
Cada comercio tiene su catálogo (Excel) y dos proveedores, cada uno con la lista de la semana 1 y
la de la semana 2. Las descripciones de los proveedores están escritas como las escriben ellos
(mayúsculas, abreviaturas, otra presentación), a mano y sin mirar cómo vincula la app: es un set
"a ciegas" para medir, no para calibrar. Los precios son aproximados (costos de octubre de 2026
estimados), no una lista de precios real.

Cada lista va con un `.esperado.json`: las líneas que la app tiene que leer y, para cada una, el
producto del catálogo que le corresponde (null si el comercio no lo tiene).

Uso: python3 scripts/generar-comercios.py   (necesita openpyxl y reportlab)
"""

import csv
import io
import json
import random
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Font
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen.canvas import Canvas

DESTINO = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "comercios"

# Cada producto: (descripción en el catálogo, rubro, costo en pesos sin IVA, cómo lo escribe el proveedor).
# El proveedor es "A" o "B"; None si ningún proveedor lo trae.
# "Extras" son productos que trae el proveedor y el comercio no tiene (varios muy parecidos a uno que sí tiene).

COMERCIOS = {
    "kiosco": {
        "nombre": "Kiosco El Pibe",
        "productos": [
            ("Alfajor Jorgito chocolate", "Golosinas", 520, "A", "ALFAJOR JORGITO CHOCOLATE X 55 GR"),
            ("Alfajor Guaymallén blanco", "Golosinas", 260, "A", "ALF. GUAYMALLEN BLANCO 38G"),
            ("Alfajor Havanna chocolate", "Golosinas", 1450, "A", "ALFAJOR HAVANNA CHOC. 50 GR"),
            ("Alfajor Capitán del Espacio negro", "Golosinas", 780, "A", "ALFAJOR CAPITAN DEL ESPACIO NEGRO 70G"),
            ("Chocolate Milka con leche 55 g", "Golosinas", 1350, "A", "CHOCOLATE MILKA LECHE 55 GRS"),
            ("Chocolate Cofler Block 38 g", "Golosinas", 980, "A", "COFLER BLOCK 38G"),
            ("Bon o Bon leche", "Golosinas", 310, "A", "BON O BON LECHE X 15 G"),
            ("Turrón Arcor", "Golosinas", 290, "A", "TURRON ARCOR 25G"),
            ("Chicles Beldent menta", "Golosinas", 650, "A", "BELDENT MENTA X 10 U"),
            ("Pastillas Halls mentol", "Golosinas", 720, "A", "HALLS MENTHOL LYPTUS 28 G"),
            ("Mantecol 110 g", "Golosinas", 1900, "A", "MANTECOL X 110 GR"),
            ("Gomitas Mogul ositos 30 g", "Golosinas", 450, "A", "MOGUL OSITOS 30G"),
            ("Chupetín Pico Dulce", "Golosinas", 180, "A", "CHUPETIN PICO DULCE"),
            ("Rocklets 40 g", "Golosinas", 990, "A", "ROCKLETS CONFITES CHOC 40 GR"),
            ("Oreo 118 g", "Galletitas y snacks", 1300, "A", "GALL. OREO 118G"),
            ("Galletitas Pepitos 119 g", "Galletitas y snacks", 1250, "A", "GALLETITAS PEPITOS 119 G"),
            ("Papas fritas Lays clásicas 85 g", "Galletitas y snacks", 2100, "A", "PAPAS LAYS CLASICAS 85G"),
            ("Palitos salados Pehuamar 100 g", "Galletitas y snacks", 1500, "A", "PALITOS PEHUAMAR X 100GR"),
            ("Maní Pehuamar salado 120 g", "Galletitas y snacks", 1400, "A", "MANI PEHUAMAR 120 GRS"),
            ("Tita", "Galletitas y snacks", 290, "A", "GALLETITA TITA 36G"),
            ("Rhodesia", "Galletitas y snacks", 290, "A", "RHODESIA 22G"),
            ("Coca-Cola 500 ml", "Bebidas", 1100, "B", "Coca Cola Sabor Original 500cc"),
            ("Coca-Cola 2,25 l", "Bebidas", 2900, "B", "Coca Cola Sabor Original 2,25 Lts"),
            ("Coca-Cola Zero 500 ml", "Bebidas", 1100, "B", "Coca Cola Zero 500cc"),
            ("Sprite 500 ml", "Bebidas", 1000, "B", "Sprite Lima Limón 500cc"),
            ("Agua Villavicencio 500 ml", "Bebidas", 650, "B", "Agua Villavicencio s/gas 500cc"),
            ("Agua Villa del Sur 2 l", "Bebidas", 1100, "B", "Agua Villa del Sur s/gas 2 lts"),
            ("Speed 250 ml", "Bebidas", 1300, "B", "Energizante Speed Lata 250cc"),
            ("Monster 473 ml", "Bebidas", 2400, "B", "Monster Energy Lata 473cc"),
            ("Gatorade manzana 500 ml", "Bebidas", 1500, "B", "Gatorade Manzana 500cc"),
            ("Cerveza Quilmes lata 473 ml", "Bebidas", 1300, "B", "Cerveza Quilmes Clásica Lata 473cc"),
            ("Cerveza Brahma lata 473 ml", "Bebidas", 1200, "B", "Cerveza Brahma Lata 473cc"),
            ("Levité pomelo 1,5 l", "Bebidas", 1600, "B", "Levite Pomelo 1500cc"),
            ("Cepita naranja 1 l", "Bebidas", 1700, "B", "Jugo Cepita Naranja 1 Lt"),
            ("Encendedor Bic", "Varios", 900, None, None),
            ("Pilas Duracell AA x 2", "Varios", 3800, None, None),
        ],
        "extras": {
            "A": [
                ("ALF. FANTOCHE TRIPLE 85G", 700),
                ("CHOCOLATE AGUILA 150 G", 3900),
                ("GOMITAS FIZZ 400G", 3100),
                ("CHICLES TOPLINE STRONG", 600),
                ("ALFAJOR JORGITO DULCE DE LECHE X 55 GR", 520),
                ("ALFAJOR HAVANNA CHOC. X 6 UN", 8200),
            ],
            "B": [
                ("Coca Cola Sabor Original 1,5 Lts", 2300),
                ("Fanta Naranja 500cc", 1000),
                ("Cerveza Stella Artois Lata 473cc", 1700),
                ("Agua Villavicencio s/gas 1,5 lts", 1200),
                ("Pepsi 500cc", 950),
            ],
        },
        "proveedores": {
            "A": {"nombre": "Golosinas Mayorista Norte", "formato": "xlsx", "codigo": "GMN-{:04d}", "iva": False},
            "B": {"nombre": "Distribuidora de Bebidas del Sur", "formato": "pdf", "codigo": None, "iva": True},
        },
    },
    "ferreteria": {
        "nombre": "Ferretería San Martín",
        "productos": [
            ("Tornillo autoperforante 8 x 1/2 (caja x 100)", "Tornillería", 3200, "A", "TORNILLO AUTOPERF. CAB. HEX. 8X1/2 X100"),
            ("Tornillo autoperforante 10 x 3/4 (caja x 100)", "Tornillería", 4100, "A", "TORNILLO AUTOPERF. CAB. HEX. 10X3/4 X100"),
            ("Tarugo Fischer 6 mm (x 100)", "Tornillería", 2800, "A", "TARUGO FISCHER S6 X 100 UNID"),
            ("Tarugo Fischer 8 mm (x 100)", "Tornillería", 3900, "A", "TARUGO FISCHER S8 X 100 UNID"),
            ('Clavo punta París 2" (1 kg)', "Tornillería", 3500, "A", 'CLAVO P/PARIS 2" X KG'),
            ("Cinta aisladora 3M 20 m", "Electricidad", 1900, "A", "CINTA AISLADORA 3M TEMFLEX 20MTS NEGRA"),
            ("Lámpara LED 9 W luz fría", "Electricidad", 1600, "A", "LAMPARA LED 9W E27 LUZ FRIA"),
            ("Lámpara LED 12 W luz cálida", "Electricidad", 2200, "A", "LAMPARA LED 12W E27 LUZ CALIDA"),
            ("Toma corriente doble Jeluz", "Electricidad", 3900, "A", "TOMA DOBLE 10A JELUZ VERONA"),
            ("Zapatilla 4 tomas con cable 1,5 m", "Electricidad", 8500, "A", "ZAPATILLA 4 TOMAS C/CABLE 1,5MTS"),
            ("Cable unipolar 2,5 mm (rollo 100 m)", "Electricidad", 78000, "A", "CABLE UNIPOLAR 2.5MM ROLLO X 100MTS"),
            ("Teflón 3/4 x 10 m", "Plomería", 450, "A", "CINTA TEFLON 3/4 X 10MTS"),
            ("Llave térmica 2 x 20 A", "Electricidad", 14500, "A", "TERMICA BIPOLAR 2X20A SICA"),
            ("Silicona transparente 280 ml", "Plomería", 4200, "A", "SELLADOR SILICONA TRANSP. 280ML"),
            ("Destornillador Phillips 1/4", "Herramientas", 3600, "A", 'DESTORNILLADOR PHILLIPS 1/4 X 4"'),
            ("Martillo carpintero 27 mm", "Herramientas", 11500, "A", "MARTILLO CARPINTERO MANGO MADERA 27MM"),
            ("Mecha para hormigón 6 mm", "Herramientas", 1700, "A", "MECHA WIDIA HORMIGON 6MM"),
            ("Mecha para hormigón 8 mm", "Herramientas", 2300, "A", "MECHA WIDIA HORMIGON 8MM"),
            ("Lija al agua grano 120", "Herramientas", 650, "A", "LIJA AL AGUA GR. 120"),
            ("Candado 40 mm", "Herramientas", 6900, "A", "CANDADO BRONCE 40MM"),
            ("Látex interior Alba 4 l", "Pinturería", 28000, "B", "Latex Interior Albalatex Blanco|4 Lts"),
            ("Látex interior Alba 20 l", "Pinturería", 118000, "B", "Latex Interior Albalatex Blanco|20 Lts"),
            ("Esmalte sintético Alba blanco 1 l", "Pinturería", 16500, "B", "Esmalte Sintetico Albalux Blanco Brillante|1 Lt"),
            ("Esmalte sintético Alba negro 1 l", "Pinturería", 16500, "B", "Esmalte Sintetico Albalux Negro Brillante|1 Lt"),
            ("Aguarrás 1 l", "Pinturería", 4200, "B", "Aguarras Mineral|1 Lt"),
            ("Thinner 1 l", "Pinturería", 4800, "B", "Thinner Standard|1 Lt"),
            ("Rodillo lana 22 cm", "Pinturería", 6200, "B", "Rodillo Lana Natural 22cm|"),
            ("Pincel N° 20", "Pinturería", 2100, "B", "Pincel Virola N°20|"),
            ("Enduido interior 4 kg", "Pinturería", 9000, "B", "Enduido Plástico Interior|4 Kg"),
            ("Cinta de papel 24 mm x 50 m", "Pinturería", 1900, "B", "Cinta Papel Enmascarar 24mm|50 mts"),
            ("Guantes de trabajo", "Varios", 3500, None, None),
            ("Pegamento Poxipol 10 min", "Varios", 4300, None, None),
        ],
        "extras": {
            "A": [
                ("TORNILLO AUTOPERF. CAB. HEX. 8X1 X100", 3600),
                ("MECHA WIDIA HORMIGON 10MM", 3100),
                ("LAMPARA LED 9W E27 LUZ CALIDA", 1600),
                ("CANDADO BRONCE 50MM", 9100),
                ("TARUGO FISCHER S10 X 100 UNID", 5600),
            ],
            "B": [
                ("Esmalte Sintetico Albalux Blanco Brillante|4 Lts", 59000),
                ("Latex Exterior Albalatex Blanco|4 Lts", 34000),
                ("Antióxido Rojo|1 Lt", 12500),
                ("Pincel Virola N°10|", 1300),
            ],
        },
        "proveedores": {
            "A": {"nombre": "Mayorista Ferretero del Litoral", "formato": "xlsx", "codigo": "FL{:05d}", "iva": False},
            "B": {"nombre": "Pinturería Distribuidora Centro", "formato": "csv", "codigo": None, "iva": False},
        },
    },
    "almacen": {
        "nombre": "Almacén Doña Rosa",
        "productos": [
            ("Yerba Playadito 1 kg", "Almacén", 4300, "A", "YERBA PLAYADITO C/P 1KG"),
            ("Yerba Taragüí 500 g", "Almacén", 2200, "A", "YERBA TARAGUI C/PALO 500G"),
            ("Yerba Rosamonte 1 kg", "Almacén", 4000, "A", "YERBA ROSAMONTE SUAVE 1 KG"),
            ("Fideos Lucchetti tirabuzón 500 g", "Almacén", 1100, "A", "FIDEOS LUCCHETTI TIRABUZON 500G"),
            ("Fideos Matarazzo spaghetti 500 g", "Almacén", 1500, "A", "FIDEOS MATARAZZO SPAGHETTI N°7 500G"),
            ("Arroz Gallo Oro 1 kg", "Almacén", 1900, "A", "ARROZ GALLO ORO LARGO FINO 1KG"),
            ("Harina Blancaflor 1 kg", "Almacén", 1400, "A", "HARINA BLANCAFLOR LEUDANTE 1KG"),
            ("Harina 000 Cañuelas 1 kg", "Almacén", 900, "A", "HARINA CAÑUELAS 000 1KG"),
            ("Aceite Cocinero girasol 1,5 l", "Almacén", 4600, "A", "ACEITE COCINERO GIRASOL 1.5LT"),
            ("Aceite Natura 900 ml", "Almacén", 2900, "A", "ACEITE NATURA GIRASOL 900ML"),
            ("Azúcar Ledesma 1 kg", "Almacén", 1300, "A", "AZUCAR LEDESMA CLASICA 1KG"),
            ("Sal Dos Anclas fina 500 g", "Almacén", 700, "A", "SAL FINA DOS ANCLAS 500G"),
            ("Puré de tomate Arcor 520 g", "Almacén", 900, "A", "PURE DE TOMATE ARCOR TETRA 520G"),
            ("Arvejas Inca 300 g", "Almacén", 800, "A", "ARVEJAS INCA 300G"),
            ("Atún La Campagnola 170 g", "Almacén", 2600, "A", "ATUN LA CAMPAGNOLA LOMITOS AL ACEITE 170G"),
            ("Mayonesa Natura 500 g", "Almacén", 1900, "A", "MAYONESA NATURA DOYPACK 500G"),
            ("Café La Virginia 250 g", "Almacén", 5200, "A", "CAFE LA VIRGINIA MOLIDO 250G"),
            ("Mate cocido Taragüí x 25", "Almacén", 1300, "A", "MATE COCIDO TARAGUI X25 SAQ"),
            ("Galletitas Criollitas 300 g", "Almacén", 1400, "A", "GALLETITAS CRIOLLITAS TRIPACK 300G"),
            ("Lavandina Ayudín 1 l", "Limpieza", 900, "A", "LAVANDINA AYUDIN 1LT"),
            ("Detergente Magistral 500 ml", "Limpieza", 1700, "A", "DETERGENTE MAGISTRAL LIMON 500ML"),
            ("Papel higiénico Higienol 4 rollos", "Limpieza", 2300, "A", "PAPEL HIG. HIGIENOL 4X30MTS"),
            ("Leche La Serenísima entera 1 l", "Lácteos y fiambres", 1400, "B", "LECHE ENTERA LS SACHET 1L"),
            ("Leche La Serenísima descremada 1 l", "Lácteos y fiambres", 1400, "B", "LECHE DESCREMADA LS SACHET 1L"),
            ("Yogur bebible Ser frutilla 900 g", "Lácteos y fiambres", 2600, "B", "YOGUR BEBIBLE SER FRUTILLA 900GR"),
            ("Manteca La Serenísima 200 g", "Lácteos y fiambres", 2700, "B", "MANTECA LA SERENISIMA 200G"),
            ("Queso cremoso (kg)", "Lácteos y fiambres", 8500, "B", "QUESO CREMOSO X KG"),
            ("Jamón cocido (kg)", "Lácteos y fiambres", 12500, "B", "JAMON COCIDO NATURAL X KG"),
            ("Dulce de leche La Serenísima 400 g", "Lácteos y fiambres", 2300, "B", "DULCE DE LECHE LS CLASICO 400G"),
            ("Crema de leche La Serenísima 200 ml", "Lácteos y fiambres", 2100, "B", "CREMA DE LECHE LS 200CC"),
            ("Huevos blancos (maple x 30)", "Lácteos y fiambres", 7500, "B", "HUEVO BLANCO MAPLE X 30"),
            ("Salame Milán (kg)", "Lácteos y fiambres", 14000, "B", "SALAME TIPO MILAN X KG"),
            ("Pan lactal Bimbo", "Almacén", 3200, None, None),
            ("Velas de cumpleaños", "Varios", 900, None, None),
        ],
        "extras": {
            "A": [
                ("YERBA PLAYADITO C/P 500G", 2300),
                ("YERBA ROSAMONTE SUAVE 500 GR", 2100),
                ("FIDEOS LUCCHETTI MOSTACHOL 500G", 1100),
                ("ACEITE COCINERO GIRASOL 900ML", 2900),
                ("SAL GRUESA DOS ANCLAS 1KG", 1000),
            ],
            "B": [
                ("DULCE DE LECHE LS CLASICO 1KG", 5100),
                ("QUESO TYBO X KG", 9800),
                ("YOGUR BEBIBLE SER VAINILLA 900GR", 2600),
                ("MANTECA SANCOR 200G", 2500),
            ],
        },
        "proveedores": {
            "A": {"nombre": "Mayorista La Económica", "formato": "pdf", "codigo": "{:05d}", "iva": False},
            "B": {"nombre": "Lácteos y Fiambres Don Pedro", "formato": "csv", "codigo": None, "iva": True},
        },
    },
}


def pesos_ar(centavos):
    entera = f"{centavos // 100:,}".replace(",", ".")
    return f"{entera},{centavos % 100:02d}"


def redondear_10(centavos):
    return -(-centavos // 1000) * 1000


def con_iva(centavos):
    return (centavos * 121 + 50) // 100


def armar_lineas(comercio, letra, semana, azar):
    """Líneas de la lista de un proveedor: (código, descripción, presentación, costo sin IVA en centavos, producto)."""
    datos = COMERCIOS[comercio]
    prov = datos["proveedores"][letra]
    filas = []
    n = 0
    for i, (_, _, costo, quien, texto) in enumerate(datos["productos"]):
        if quien != letra:
            continue
        n += 1
        filas.append([n, texto, costo * 100, i])
    for texto, costo in datos["extras"][letra]:
        n += 1
        filas.append([n, texto, costo * 100, None])

    # Semana 1: precios entre 0% y 8% arriba de lo que el comercio tiene cargado.
    for f in filas:
        f[2] = round(f[2] * (1 + azar.randint(0, 8) / 100))

    if semana == 2:
        azar2 = random.Random(f"{comercio}-{letra}-2")
        con_producto = [f for f in filas if f[3] is not None]
        # Sale de la lista: el último con producto y el último extra.
        filas.remove(con_producto[-1])
        filas.remove([f for f in filas if f[3] is None][-1])
        for k, f in enumerate([f for f in filas if f[3] is not None]):
            if k == 0:
                f[2] = round(f[2] * 1.65)  # salto raro: probable error del proveedor
            elif k in (1, 2):
                f[2] = round(f[2] * 0.95)  # baja
            elif k == 3:
                pass  # sin cambio
            else:
                f[2] = round(f[2] * (1 + azar2.randint(2, 7) / 100))
        for f in filas:
            if f[3] is None:
                f[2] = round(f[2] * 1.04)
        # Productos nuevos del proveedor esta semana.
        nuevos = {
            "kiosco": {"A": ["ALFAJOR TERRABUSI TRIPLE CHOC 70G", "CARAMELOS MASTICABLES SUGUS X 150 U"], "B": ["Coca Cola Light 500cc", "Agua Saborizada Aquarius Pomelo 1,5 Lts"]},
            "ferreteria": {"A": ["PRECINTO PLASTICO 200MM X100", "DISCO CORTE METAL 115MM"], "B": ["Barniz Marino Brillante|1 Lt", "Espátula Acero 6cm|"]},
            "almacen": {"A": ["POLENTA PRESTO PRONTA 500G", "VINAGRE DE ALCOHOL MENOYO 1LT"], "B": ["RICOTA LS 500G", "MORTADELA X KG"]},
        }[comercio][letra]
        for texto in nuevos:
            n += 1
            filas.append([n, texto, azar2.randint(800, 9000) * 100, None])

    lineas = []
    for numero, texto, costo, producto in filas:
        descripcion, _, presentacion = texto.partition("|")
        codigo = prov["codigo"].format(numero * 7 + 100) if prov["codigo"] else None
        lineas.append({"codigo": codigo, "descripcion": descripcion, "presentacion": presentacion or None, "costoSinIva": costo, "producto": producto})
    return lineas


def precio_escrito(linea, prov):
    return con_iva(linea["costoSinIva"]) if prov["iva"] else linea["costoSinIva"]


def escribir_xlsx(ruta, prov, lineas, semana):
    libro = Workbook()
    hoja = libro.active
    hoja.title = "Lista"
    hoja.append([prov["nombre"].upper()])
    hoja["A1"].font = Font(bold=True, size=14)
    hoja.append([f"Lista de precios N° {40 + semana} - Precios sin IVA - Vigencia 7 días"])
    hoja.append([])
    hoja.append(["Cód.", "Artículo", "Precio s/IVA"])
    for l in lineas:
        hoja.append([l["codigo"], l["descripcion"], precio_escrito(l, prov) / 100])
    hoja.append([])
    hoja.append(["", "Pedidos por WhatsApp. Precios sujetos a cambio sin previo aviso.", ""])
    libro.save(ruta)


def escribir_csv(ruta, prov, lineas, semana):
    salida = io.StringIO()
    escritor = csv.writer(salida, delimiter=";", lineterminator="\r\n")
    escritor.writerow([prov["nombre"]])
    escritor.writerow([f"Lista semana {semana}"])
    titulo_precio = "Precio c/IVA" if prov["iva"] else "Precio + IVA"
    con_presentacion = any(l["presentacion"] for l in lineas)
    escritor.writerow(["Descripción", "Presentación", titulo_precio] if con_presentacion else ["Producto", titulo_precio])
    for l in lineas:
        precio = pesos_ar(precio_escrito(l, prov))
        escritor.writerow([l["descripcion"], l["presentacion"] or "", precio] if con_presentacion else [l["descripcion"], precio])
    ruta.write_bytes(salida.getvalue().encode("utf-8"))


def escribir_pdf(ruta, prov, lineas, semana):
    lienzo = Canvas(str(ruta), pagesize=A4, invariant=1)
    ancho, alto = A4
    con_codigo = lineas[0]["codigo"] is not None
    titulo_precio = "Precio c/IVA" if prov["iva"] else "Precio s/IVA"

    def encabezado():
        lienzo.setFont("Helvetica-Bold", 13)
        lienzo.drawString(40, alto - 50, prov["nombre"].upper())
        lienzo.setFont("Helvetica", 9)
        lienzo.drawString(40, alto - 66, f"Lista de precios - semana {semana}")
        lienzo.setFont("Helvetica-Bold", 9)
        y = alto - 95
        if con_codigo:
            lienzo.drawString(40, y, "Código")
        lienzo.drawString(100, y, "Descripción")
        lienzo.drawRightString(ancho - 40, y, titulo_precio)
        return y - 16

    y = encabezado()
    lienzo.setFont("Helvetica", 9)
    for l in lineas:
        if y < 60:
            lienzo.showPage()
            y = encabezado()
            lienzo.setFont("Helvetica", 9)
        if con_codigo:
            lienzo.drawString(40, y, l["codigo"])
        lienzo.drawString(100, y, l["descripcion"] + (f" {l['presentacion']}" if l["presentacion"] else ""))
        lienzo.drawRightString(ancho - 40, y, "$ " + pesos_ar(precio_escrito(l, prov)))
        y -= 14
    lienzo.save()


def escribir_catalogo(ruta, comercio):
    datos = COMERCIOS[comercio]
    libro = Workbook()
    hoja = libro.active
    hoja.append(["Código", "Descripción", "Rubro", "Costo", "Precio venta", "IVA"])
    for i, (descripcion, rubro, costo, _, _) in enumerate(datos["productos"]):
        costo_c = costo * 100
        venta = redondear_10(round(costo_c * 1.21 * 1.4))
        hoja.append([f"{i + 1:04d}", descripcion, rubro, costo_c / 100, venta / 100, 21])
    libro.save(ruta)


def main():
    DESTINO.mkdir(parents=True, exist_ok=True)
    for comercio, datos in COMERCIOS.items():
        escribir_catalogo(DESTINO / f"{comercio}-catalogo.xlsx", comercio)
        for letra, prov in datos["proveedores"].items():
            azar = random.Random(f"{comercio}-{letra}")
            for semana in (1, 2):
                lineas = armar_lineas(comercio, letra, semana, random.Random(f"{comercio}-{letra}"))
                nombre = f"{comercio}-proveedor-{letra.lower()}-semana-{semana}.{prov['formato']}"
                {"xlsx": escribir_xlsx, "csv": escribir_csv, "pdf": escribir_pdf}[prov["formato"]](DESTINO / nombre, prov, lineas, semana)
                esperado = {
                    "comercio": datos["nombre"],
                    "proveedor": prov["nombre"],
                    "listaIncluyeIva": prov["iva"],
                    "lineas": [
                        {
                            "codigo": l["codigo"],
                            "descripcion": l["descripcion"],
                            "presentacion": l["presentacion"],
                            "costo": precio_escrito(l, prov),
                            "producto": None if l["producto"] is None else f"{l['producto'] + 1:04d}",
                        }
                        for l in lineas
                    ],
                }
                (DESTINO / f"{nombre}.esperado.json").write_text(json.dumps(esperado, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
                print(nombre, len(lineas), "líneas")


if __name__ == "__main__":
    main()
