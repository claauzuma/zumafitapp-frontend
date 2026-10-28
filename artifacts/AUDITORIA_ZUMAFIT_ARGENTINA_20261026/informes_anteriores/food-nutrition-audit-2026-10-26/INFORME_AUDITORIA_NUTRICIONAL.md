# Auditoria nutricional de alimentos genericos base

Fecha de corte: 26 de octubre de 2026. Consulta de MongoDB realizada en modo lectura sobre `fooddatabase2`.

## Resultado ejecutivo

- Coleccion completa: **574 registros**.
- Marcados `generation.mode=GENERIC`: **191**.
- Alcance solicitado (alimentos simples/reales, frutas, verduras, carnes, huevos, cereales, pastas y panes simples; sin panes lactales, marcas y ultraprocesados): **125 documentos**.
- Comparables en base comun por 100 g: **120/125**.
- Cobertura de referencia: SARA 2 **119/125**; USDA **120/125**.
- Hallazgos: **7 criticos**, **9 altos**, **11 medios**, **4 no comparables** y **94 dentro de tolerancia**.

La prioridad argentina es SARA 2. USDA Foundation Foods 2026 y SR Legacy se usan como contraste internacional. Los carbohidratos de SARA son *disponibles*; USDA suele informar carbohidratos *por diferencia* (incluye fibra), por lo que una diferencia aislada de carbohidratos en frutas, verduras, semillas o integrales no se considera automaticamente un error.

## Criterio

- Se normalizaron los registros en gramos a 100 g usando los campos `kcal100/proteina100/carbohidratos100/grasas100`.
- En variantes por unidad con peso estandar identificable se convirtio la porcion a 100 g. Cuando Mongo no guarda peso de la unidad/pote/feta, el registro queda `NO_COMPARABLE`.
- Se verifico cierre energetico con 4 kcal/g de proteina, 4 kcal/g de carbohidrato y 9 kcal/g de grasa, la misma regla declarada por SARA 2.
- Umbral orientativo: medio desde 15%, alto desde 30% y critico desde 50%, siempre exigiendo tambien una diferencia absoluta minima para no sobrerreaccionar a trazas.
- Crudo y cocido no se intercambian. Si el nombre local no declara estado, la comparacion puede señalar una ambiguedad de modelado ademas de una diferencia numerica.

## Hallazgos criticos y altos

| Nivel | ID | Alimento | BD por 100 g (kcal/P/C/G) | SARA 2 (kcal/P/C/G) | USDA (kcal/P/C/G) | Diagnostico |
|---|---:|---|---|---|---|---|
| CRITICO | 3 | Aceitunas negras | 157.4/1/0.1/17 | 119/0.8/4.4/10.9 | 116/0.8/6/10.9 | Diferencia relevante vs SARA 2: kcal +32.3%, carbs -86%, fat +56%. |
| CRITICO | 105 | Choclo entero | 60.5/2.5/7/2.5 | 97/3.7/17.8/1.2 | 84.6/2.8/14.7/1.6 | Diferencia relevante vs USDA: kcal -28.5%, carbs -52.4%, fat +43.5%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| CRITICO | 165 | Filet de merluza | —/—/—/— | 80/17.1/0/1.3 | 74/16.3/0/0.5 | La unidad dice Unid, pero 1.29 kcal y 0.21 g de proteina son claramente valores por gramo; error de escala/unidad. No se puede convertir a 100 g: falta el peso neto/comestible de la unidad, feta o pote. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| CRITICO | 343 | Naranja chica | —/—/—/— | 43/0.9/9.4/0.1 | 47/0.9/11.8/0.1 | Registro de naranja por unidad con todos los macros en cero; esta inactivo pero sigue marcado GENERIC. No se puede convertir a 100 g: falta el peso neto/comestible de la unidad, feta o pote. |
| CRITICO | 344 | Naranja grande | —/—/—/— | 43/0.9/9.4/0.1 | 47/0.9/11.8/0.1 | Registro de naranja por unidad con todos los macros en cero; esta inactivo pero sigue marcado GENERIC. No se puede convertir a 100 g: falta el peso neto/comestible de la unidad, feta o pote. |
| CRITICO | 345 | Naranja mediana | —/—/—/— | 43/0.9/9.4/0.1 | 47/0.9/11.8/0.1 | Registro de naranja por unidad con todos los macros en cero; esta inactivo pero sigue marcado GENERIC. No se puede convertir a 100 g: falta el peso neto/comestible de la unidad, feta o pote. |
| CRITICO | 353 | Ñoquis con papa | 218.5/5.9/44/2.1 | 159/5.8/27.9/2.6 | — | Diferencia relevante vs SARA 2: kcal +37.4%, carbs +57.7%, fat -19.2%. |
| ALTO | 4 | Aceitunas verdes | 198.8/1.2/3.5/20 | 130/1.5/0.5/13.5 | 145/1/3.8/15.3 | Diferencia relevante vs USDA: kcal +37.1%, fat +30.7%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| ALTO | 96 | Castañas de caju | 558.5/22/17.5/44.5 | — | 565/17.4/36.3/38.9 | Diferencia relevante vs USDA: protein +26.4%, carbs -51.8%. |
| ALTO | 282 | Mani | 596.8/28/4.2/52 | 596/24.4/12.9/49.7 | 567/25.8/16.1/49.2 | Diferencia relevante vs SARA 2: carbs -67.4%. |
| ALTO | 286 | Mantequilla de mani | 590/25/10/50 | 607/21.9/18.3/49.5 | 598/22.2/22.3/51.4 | Diferencia relevante vs SARA 2: carbs -45.4%. |
| ALTO | 291 | Mariscos | 123/12/3/7 | 96/22/0/0.9 | 71/13.6/0.9/1 | Diferencia relevante vs USDA: kcal +73.2%, carbs +41.8%, fat +299.5%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. 'Mariscos' mezcla especies con perfiles muy distintos; hace falta especificar especie y estado de coccion. |
| ALTO | 523 | Semillas de girasol | 580.7/23.3/6/51.5 | 592/20.8/11.4/51.5 | 584/20.8/20/51.5 | Diferencia relevante vs SARA 2: carbs -47.4%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| ALTO | 524 | Semillas de lino | 539/23/15/43 | 459/18.3/1.6/42.2 | 534/18.3/28.9/42.2 | Diferencia relevante vs USDA: protein +25.7%, carbs -48.1%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| ALTO | 528 | Soja texturizada | 323.7/51/27/1.3 | 283/51.5/16.4/1.2 | — | Diferencia relevante vs SARA 2: carbs +64.6%. |
| ALTO | 543 | tofu | 115/11/2/7 | 149/17.3/0.5/8.7 | 144/17.3/2.8/8.7 | Diferencia relevante vs SARA 2: kcal -22.8%, protein -36.4%, carbs +30%, fat -19.5%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |

## Diferencias medias

| ID | Alimento | BD (kcal/P/C/G) | SARA 2 | USDA | Diagnostico |
|---:|---|---|---|---|---|
| 48 | Avellanas | 656/16/4/64 | 631/12.7/8/60.9 | 641/13.5/26.5/53.5 | Diferencia relevante vs SARA 2: protein +26%, carbs -50%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| 49 | Avena instantanea | 352/13/57/8 | 357/15.6/56.9/7.5 | 379/13.2/67.7/6.5 | Diferencia relevante vs USDA: carbs -15.8%, fat +22.7%. |
| 113 | Churrasco magro | 144.5/21.5/0/8 | 176/21.3/0/10.1 | 145/22.7/0/5.3 | Las kcal difieren -9.3% del calculo 4P+4C+9G. Diferencia relevante vs SARA 2: kcal -17.9%, fat -20.8%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| 273 | Maiz | 318.9/9.6/60/4.5 | 317/9.5/67.6/0.9 | 365/9.4/74.3/4.7 | Diferencia relevante vs USDA: carbs -19.2%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| 381 | Pan negro | 259.3/9.1/46.5/4.1 | 228/12.5/36.7/3.5 | 252/12.4/42.7/3.5 | Diferencia relevante vs USDA: protein -26.6%, fat +17.1%. |
| 609 | Pata muslo de pollo sin piel | 130/19/0/5 | 106/20.3/0/2.7 | 120/19.2/0/4.2 | Las kcal difieren 6.9% del calculo 4P+4C+9G. Diferencia relevante vs USDA: fat +18.5%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| 415 | Pistachos | 615/25/14/51 | 566/21.1/17.3/45.8 | 598/20.5/27.7/45 | Diferencia relevante vs SARA 2: protein +18.5%, carbs -19.1%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| 460 | Queso cremoso light | 237/21/0/17 | 310/20.4/2.5/24.3 | 298/23.7/4.4/20.4 | Diferencia relevante vs USDA: kcal -20.5%, carbs -88.8%, fat -16.7%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| 461 | Queso cremoso port salut | 309/20/1/25 | 225/26.3/1/12.9 | 352/23.8/0.6/28.2 | Diferencia relevante vs USDA: protein -16%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |
| 517 | Sardinas | 139.5/18/0/7.5 | 170/22.1/0/9.1 | 208/24.6/0/11.4 | Diferencia relevante vs SARA 2: kcal -17.9%, protein -18.6%, fat -17.6%. |
| 520 | Semillas de calabaza | 584/35/3/48 | 581/30.2/4.7/49.1 | 446/18.6/53.8/19.4 | Diferencia relevante vs SARA 2: protein +15.9%, carbs -34%. SARA 2 y USDA divergen >=30%; revisar variedad, corte, crudo/cocido o carbohidrato disponible vs total. |

## No comparables de forma segura

| ID | Alimento | Motivo |
|---:|---|---|
| 47 | Atun en lomitos al natural | No se puede convertir a 100 g: falta el peso neto/comestible de la unidad, feta o pote. |
| 94 | Castañas | No hay una referencia suficientemente especifica en las fuentes seleccionadas. |
| 519 | Seitan | No hay una referencia suficientemente especifica en las fuentes seleccionadas. |
| 587 | Verduras | 'Verduras' no define una composicion reproducible; debe reemplazarse por ingredientes o una receta estandar. |

## Resumen por categoria

| Categoria | Auditados | Con observacion |
|---|---:|---:|
| Carbohidratos | 22 | 5 |
| Frutas | 41 | 3 |
| Grasas | 17 | 10 |
| Lácteos | 6 | 2 |
| Proteínas | 26 | 9 |
| Verduras | 13 | 2 |

## Problemas de estructura que afectan la exactitud

1. **Unidad sin peso**: un valor por `Unid`, `Pote`, `Feta` o `Reb` no es trazable si no existe `gramWeight`/peso comestible. La energia puede cerrar internamente y aun asi estar cien veces fuera de escala.
2. **Estado de preparacion ausente**: carne, pollo, pescado, papa, maiz y pastas cambian mucho por agua al cocinarse. Nombres como “churrasco”, “pescado blanco” o “verduras” no alcanzan para fijar una composicion.
3. **Duplicados semanticos**: varios cortes vacunos comparten exactamente 131 kcal, 21,5 g P y 5 g G; eso parece un valor generico replicado, no datos especificos de cada corte.
4. **Categoria incorrecta**: papaya figura en Carbohidratos; semillas de calabaza figuran en Verduras; huevo figura en Grasas. No cambia las kcal, pero si afecta filtros y generacion automatica.
5. **Carbohidrato disponible vs total**: la aplicacion debe declarar cual guarda. Mezclar rotulado argentino/SARA (disponible) con USDA (por diferencia) produce discrepancias sistematicas en alimentos con fibra.

## Inventario excluido

Se excluyeron del cotejo numerico **66 registros GENERIC** por ser de marca, panes lactales/de molde de marca, yogures comerciales, fiambres, suplementos, galletitas, tostadas industriales, pastas de marca o duplicados comerciales. No significa que esten correctos: quedaron fuera porque el pedido delimito alimentos base y no esos productos.

## Archivos

- `comparacion-completa.csv`: una fila por documento, con valores de Mongo, SARA 2, USDA, diferencias porcentuales y diagnostico.
- `comparacion-completa.json`: misma evidencia con precision completa y metadatos.
- `inventario-alcance.json`: IDs incluidos y conteos de la coleccion.

## Fuentes y limites

- Ministerio de Salud de la Nacion, **SARA 2: Tabla de composicion quimica de alimentos para Argentina**, 2022. Nutrientes por 100 g de porcion comestible; energia calculada con 4/4/9 y 7 kcal/g para alcohol.
- USDA **FoodData Central Foundation Foods**, abril de 2026, y **SR Legacy**, abril de 2018.
- SARA 2 es una compilacion para ENNyS 2; prioriza datos argentinos pero tambien integra USDA, tabla inglesa, alemana, FNDDS y rotulos. Una coincidencia no equivale necesariamente a analisis de laboratorio argentino del alimento concreto.
- Los valores naturales varian por cultivar, corte, grasa recortada, madurez, marca y coccion. Esta auditoria identifica incompatibilidades de catalogo; no reemplaza una ficha tecnica o analisis bromatologico del producto real.
