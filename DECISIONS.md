# Decisiones

Registro de qué se eligió, qué se descartó y por qué. Lo más nuevo arriba.

## 12/10/2026 · F08: porcentajes en centésimos de punto

- **Elegido:** todo porcentaje es un entero en centésimos de punto (21% = 2100; 10,5% = 1050; 33,33% = 3333).
- **Descartado:** guardar porcentajes como decimales (0.105). Mezclar decimales con centavos enteros reintroduce los errores de redondeo que los centavos evitan.
- **Por qué:** con montos y porcentajes enteros, el cálculo completo es exacto.

## 12/10/2026 · F08: cálculo exacto y un solo redondeo al final

- **Elegido:** `P = redondeo(C · (1 − d) · (1 + i) · (1 + m))` se calcula como fracción exacta con BigInt y se redondea una sola vez, siempre hacia arriba.
- **Descartado:** redondear a centavos en cada paso (acumula diferencias de centavos contra el cálculo manual).
- **Por qué:** la condición de la Fase 1 es coincidir al centavo con el cálculo a mano; redondear hacia arriba garantiza no vender por debajo del costo.
- Costo cero devuelve precio cero (con "terminado en 90" daría $ 90, que es engañoso); la revisión (F09) lo marca como probable error.

## 12/10/2026 · F08: "terminado en 90 / 99"

- **Elegido:** el próximo precio en pesos enteros, hacia arriba, cuya terminación sea 90 o 99 (1.234 → 1.290 / 1.299; 1.290 queda igual; 1.290,01 → 1.390).
- **Descartado:** terminación en la decena (1.234 → 1.239).
- **Por qué:** decisión de Leandro (pregunta 4 del arranque).

## 12/10/2026 · F02/F08: descuentos del proveedor en cascada

- **Elegido:** el proveedor guarda una lista de descuentos que se aplican uno tras otro (10% + 5% = 14,5% efectivo).
- **Descartado:** un solo `descuento_pct`, como dice la spec.
- **Por qué:** las bonificaciones en cascada son habituales en Argentina y migrar de un número a una lista después es caro. Decisión de Leandro (pregunta 3). **Desvío de la spec:** la tabla `proveedores` tendrá `descuentos_pct` (lista) en lugar de `descuento_pct`.

## 12/10/2026 · F08: alícuotas de IVA

- **Elegido:** IVA por producto, 21% por defecto y 10,5% disponible.
- **Descartado:** sólo 21% (deja mal calculados alimentos básicos y otros productos al 10,5%); sumar 27% (rara vez lo vende un comercio chico).
- **Por qué:** decisión de Leandro (pregunta 5). El dominio acepta cualquier alícuota; la limitación a 21/10,5 va en la interfaz.

## 12/10/2026 · Se saltea la Fase 0 (validación)

- **Elegido:** arrancar directo con la Fase 1, sin visitas ni listas reales.
- **Descartado:** validar primero (lo que pide la spec) o hacerlo en paralelo (lo recomendado).
- **Por qué:** decisión de Leandro (pregunta 1).
- **Consecuencias:**
  - La condición de la Fase 1 ("F08 coincide con 20 precios calculados a mano por comerciantes") se reemplaza por 20 casos calculados a mano por Leandro, sin mirar el resultado del código.
  - Las condiciones de la Fase 2 (95% de listas Excel/CSV y 85% de PDF leídas bien) necesitan listas reales en `tests/fixtures/`; sin ellas no se pueden medir.
  - Quedan abiertas las preguntas que respondía la Fase 0, entre ellas si los comercios remarcan por recargo sobre costo o por margen sobre precio. La spec usa recargo.
