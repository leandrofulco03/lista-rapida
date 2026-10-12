"""
Genera el catálogo de prueba de F03 en tests/fixtures/catalogo/: un Excel con 500 productos
(la condición de aceptación de F03 es poder cargar 500 productos importando un Excel).

Imita una planilla que un comercio arma a mano: título arriba, código, descripción, rubro,
costo, precio de venta e IVA (21% o 10,5%, como porcentaje de Excel). Algunos productos no
tienen código y otros no tienen costo. El resumen esperado va en `catalogo-500.xlsx.esperado.json`.

Uso: python3 scripts/generar-catalogo-prueba.py   (necesita openpyxl)
"""

import json
import random
import sys
from pathlib import Path

from openpyxl import Workbook

sys.dont_write_bytecode = True
DESTINO = Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "catalogo"
RUBROS = ["Almacén", "Bebidas", "Limpieza", "Perfumería", "Golosinas", "Lácteos", "Fiambrería", "Panadería"]
BASES = ["Yerba", "Fideos", "Arroz", "Harina", "Aceite", "Azúcar", "Galletitas", "Gaseosa", "Agua", "Jabón",
         "Shampoo", "Alfajor", "Queso", "Jamón", "Pan", "Leche", "Café", "Té", "Detergente", "Vino"]
TAMANOS = ["250 g", "500 g", "1 kg", "1 l", "1,5 l", "2 l", "x 6", "x 12", "unidad"]


def generar():
    DESTINO.mkdir(parents=True, exist_ok=True)
    azar = random.Random(500)
    libro = Workbook()
    hoja = libro.active
    hoja.title = "Productos"
    hoja.append(["Mi catálogo - Almacén Don José"])
    hoja.append([])
    hoja.append(["Código", "Descripción", "Rubro", "Costo", "Precio venta", "IVA"])
    sin_codigo = 0
    suma_venta = 0
    for i in range(500):
        codigo = None if i % 25 == 7 else f"C{i + 1:04d}"
        sin_codigo += codigo is None
        descripcion = f"{BASES[i % len(BASES)]} {azar.choice(['clásico', 'premium', 'light', 'familiar', 'común'])} {TAMANOS[i % len(TAMANOS)]} #{i + 1}"
        rubro = RUBROS[i % len(RUBROS)]
        costo = azar.randint(100, 20000) * 100 + azar.choice([0, 50])
        venta = (costo * 13 // 10 // 1000 + 1) * 1000
        suma_venta += venta
        iva = 0.105 if rubro in ("Panadería", "Lácteos") else 0.21
        hoja.append([codigo, descripcion, rubro, None if i % 40 == 3 else costo / 100, venta / 100, iva])
        hoja.cell(row=hoja.max_row, column=6).number_format = "0.0%"
    libro.save(DESTINO / "catalogo-500.xlsx")
    with open(DESTINO / "catalogo-500.xlsx.esperado.json", "w", encoding="utf-8") as f:
        json.dump({"productos": 500, "sinCodigo": sin_codigo, "rubros": len(RUBROS), "sumaPrecioVenta": suma_venta}, f)
        f.write("\n")


if __name__ == "__main__":
    generar()
    print(f"Catálogo generado en {DESTINO}")
