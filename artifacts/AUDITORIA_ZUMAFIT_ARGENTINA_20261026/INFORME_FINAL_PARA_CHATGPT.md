# Auditoría nutricional externa del catálogo ZumaFit

Fecha de corte: 2026-10-26T19:59:42.212Z  
Base consultada en modo lectura: `base2.fooddatabase2`

## Alcance y advertencia metodológica

Se exportaron los 673 documentos reales de MongoDB. Esta ejecución no realizó `insertOne`, `updateOne`, `bulkWrite`, `delete`, migraciones ni ninguna otra escritura en la base.

La auditoría contiene una fila para cada documento, pero una fila no equivale automáticamente a una validación. Se consideró referencia fiable únicamente cuando pudo asociarse un alimento concreto de SARA 2, USDA FoodData Central o un rótulo/ficha oficial documentada. Los productos comerciales sin rótulo verificable, recetas genéricas, registros de encabezado y unidades sin peso se marcaron como no comparables.

Los carbohidratos de SARA son carbohidratos disponibles; USDA normalmente informa carbohidratos totales. Por eso una diferencia de carbohidratos entre ambas tablas puede ser metodológica y no un error del catálogo. La comprobación 4P + 4C + 9G (+7 kcal/g de alcohol cuando existe) se usa solo como control interno, no como prueba de exactitud.

## Resumen cuantitativo

| Indicador | Cantidad |
|---|---:|
| Documentos totales | 673 |
| Activos | 652 |
| Inactivos | 21 |
| Marcados GENERIC | 242 |
| Marcados EXPLICIT_ONLY | 115 |
| Sin clasificación de generación | 316 |
| Participan efectivamente en generación automática | 242 |
| Con los cuatro nutrientes convertibles a 100 g/ml | 481 |
| Con referencia externa concreta para los cuatro valores | 246 |
| Con diferencias relevantes (medio/alto/crítico) | 19 |
| Con unidad ambigua | 198 |
| Sin referencia externa fiable | 427 |

"Comercial" no se deduce con certeza del nombre: `EXPLICIT_ONLY` incluye productos de marca y alimentos específicos que deliberadamente no deben entrar en menús automáticos. Por eso el CSV conserva tres estados: genérico, comercial/específico y sin clasificar.

## Riesgos funcionales principales

- El backend histórico guarda `Calorias/Proteinas/Carbohidratos/Grasas` por una unidad base de 1 g, 1 ml o 1 pieza. En varias rutas `macroBasis: perUnit` es intencional incluso para `Grs`, porque la aplicación multiplica el vector legacy por la cantidad pedida.
- Otras rutas de importación interpretan `per100` y dividen por 100 para gramos/ml. Mezclar documentos o payloads entre ambos contratos puede producir errores de ×100.
- Una unidad discreta sin `pesoUnidadGramos` puede ser válida para registrar una pieza si el rótulo es por pieza, pero no permite cotejar rigurosamente contra una tabla por 100 g.
- Enlatados deben especificar si la referencia es escurrida. Cuando el nombre o la fuente no lo aclaran, la equivalencia queda aproximada.
- Crudo, hervido, asado y frito no son intercambiables: el agua y la absorción/pérdida de grasa cambian la densidad nutricional.
- Los productos comerciales pueden reformularse. Para ellos prevalece el rótulo argentino vigente del envase exacto, no el promedio de una tabla genérica.

## Cambios históricos

El archivo `CAMBIOS_HISTORICOS.csv` contiene exactamente 41 modificaciones y 43 altas de la primera migración, y 100 modificaciones (99 del snapshot principal más el addendum del durazno) y 56 altas de la segunda: 240 filas en total. 4 filas corresponden a alimentos alcanzados por ambas migraciones; el CSV lo identifica expresamente.

### Caso tira de asado

La tira de asado pasó de 475 kcal, 22 g de proteína y 43 g de grasa por 100 g a 210 kcal, 20 g de proteína y 14,4 g de grasa. El valor anterior no era aritméticamente imposible para una porción excepcionalmente grasa. La migración sustituyó esa representación por el promedio SARA de “vacuno, cortes grasos promedio, crudo”. Por lo tanto, se trata de una normalización a un promedio genérico, no de una demostración de que cualquier tira de asado argentina contenga exactamente 210 kcal.

## Discrepancias y unidades, ordenadas por gravedad

La tabla siguiente muestra las primeras 80. La tabla completa, sin recortes, está en `AUDITORIA_NUTRICIONAL_COMPLETA.csv`.

| Gravedad | ID | Alimento | Unidad | Equivalencia | Hallazgo |
|---|---:|---|---|---|---|
| ALTO | 270 | Lomo de cerdo magro | Grs | APROXIMADA | Δ kcal -41.75%; P 15.38%; C 0%; G -72.97% |
| ALTO | 291 | Mariscos | Grs | APROXIMADA | Δ kcal 28.13%; P -45.45%; C %; G 677.78% |
| ALTO | 405 | Pechuga de pollo con piel | Grs | APROXIMADA | Δ kcal -33.65%; P 22.81%; C -100%; G -61.29% |
| ALTO | 412 | Pescado blanco | Grs | APROXIMADA_ESTADO_DISTINTO | Δ kcal 62.5%; P 11.11%; C 0%; G 361.54% |
| ALTO | 461 | Queso cremoso port salut | Grs | APROXIMADA | Δ kcal 37.33%; P -23.95%; C 0%; G 93.8% |
| MEDIO | 49 | Avena instantanea | Grs | APROXIMADA | Δ kcal -1.4%; P -16.67%; C 0.18%; G 6.67% |
| MEDIO | 88 | Carne de cerdo magro | Grs | APROXIMADA | Δ kcal -26.7%; P 20.88%; C 0%; G -52.7% |
| MEDIO | 199 | Gambas | Grs | APROXIMADA | Δ kcal -23.96%; P -31.82%; C %; G 11.11% |
| MEDIO | 241 | Langostinos | Grs | APROXIMADA | Δ kcal -29.48%; P -36.36%; C 0%; G 44.44% |
| MEDIO | 273 | Maiz | Grs | APROXIMADA | Δ kcal 0.6%; P 1.05%; C -11.24%; G 400% |
| MEDIO | 361 | Palta | Grs | EXACTA_O_MISMO_RÓTULO | Δ kcal -15.89%; P 5.26%; C 133.33%; G -23.08% |
| MEDIO | 362 | Pan | Grs | APROXIMADA | Δ kcal -1.46%; P -9.52%; C -10.53%; G 371.43% |
| MEDIO | 364 | Pan baguette | Grs | APROXIMADA | Δ kcal 2.31%; P 4.76%; C -7.02%; G 328.57% |
| MEDIO | 365 | Pan blanco | Grs | APROXIMADA | Δ kcal -1.46%; P -9.52%; C -10.53%; G 371.43% |
| MEDIO | 369 | Pan de centeno | Grs | EXACTA_O_MISMO_RÓTULO | Δ kcal 10.98%; P 0%; C 15.29%; G 0% |
| MEDIO | 381 | Pan negro | Grs | APROXIMADA | Δ kcal 13.73%; P -27.2%; C 26.7%; G 17.14% |
| MEDIO | 609 | Pata muslo de pollo sin piel | Grs | APROXIMADA | Δ kcal 22.64%; P -6.4%; C 0%; G 85.19% |
| MEDIO | 419 | Polenta | Grs | APROXIMADA | Δ kcal 14.14%; P -6.59%; C 17.05%; G 14.29% |
| MEDIO | 460 | Queso cremoso light | Grs | APROXIMADA | Δ kcal -23.55%; P 2.94%; C -100%; G -30.04% |
| UNIDAD_AMBIGUA | 6 | Alfajor blanco jorgito | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 8 | Alfajor bon o bon | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 9 | Alfajor de almendras | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 10 | Alfajor de chocolate jorgito | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 11 | Alfajor fulbito | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 12 | Alfajor glaceado jorgito | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 14 | Alfajor guaymallen | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 15 | Alfajor havanna 70 | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 16 | Alfajor jorgelin | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 18 | Alfajor jorgito | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 19 | Alfajor Oreo Trilogia | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 20 | Alfajor pepitos | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 21 | Alfajor pepitos triple | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 22 | Alfajor Shot | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 23 | Alfajor shot triple | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 24 | Alfajor tatin | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 25 | Alfajor terrabusi clasico | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 26 | Alfajor terrabusi doble | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 27 | Alfajor terrabusi grande | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 28 | Alfajor terrabusi triple | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 29 | Alfajor tofi | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 30 | Alfajor triple tatin | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 31 | Alfajor triple terrabusi | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 32 | Alfajor vauquita | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 37 | Arrocitas paquete amarillo | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 38 | Arrocitas paquete verde | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 46 | Atun en lomitos al aceite | Pote | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 47 | Atun en lomitos al natural | Pote | APROXIMADA | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 55 | Barra de cereal | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 56 | Barra de cereal frutilla Cereal Mix | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 57 | Bastoncitos de merluza (Granja del sol) | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA |  | Batido proteico: |  | NO_COMPARABLE | unidad ausente; unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA |  | Batido: |  | NO_COMPARABLE | unidad ausente; unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 61 | Bay biscuit | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 66 | Biscuits | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 67 | Bizcochos agridulces 9 de oro | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 68 | Bizcochos dulces | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 69 | Bizcochos light 9 de oro | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 70 | Bizcochos salados | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 74 | Bondiola (Lario) | Fetas | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 76 | Bondiola feteada (Carrefour) | Fetas | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 87 | Caramelos sugus | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 101 | Cerealitas | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 638 | Cerveza de alta graduación | Ml | EXACTA_O_MISMO_RÓTULO | fuente USDA por 100 g aplicada a ml sin densidad documentada |
| UNIDAD_AMBIGUA | 636 | Cerveza light | Ml | EXACTA_O_MISMO_RÓTULO | fuente USDA por 100 g aplicada a ml sin densidad documentada |
| UNIDAD_AMBIGUA | 106 | Chocolate aguila semiamargo | Barra | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 108 | Chocolate cofler aireado (Leche) | Cuad | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 112 | Chupetin pico dulce arcor | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 115 | Claras de huevos | Unid | APROXIMADA | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 121 | Crackers Smams (Sin tac) | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 126 | Criollitas | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 127 | Criollitas grandes | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 128 | Criollitas sin sal | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 133 | Danette dulce de leche | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA |  | Dulce de leche (Coto) |  | NO_COMPARABLE | unidad ausente; unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 152 | Empanada de carne el noble | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 153 | Empanada de jamon y queso el noblre | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 154 | Empanadas de carne : | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 155 | Empanadas de jamon y queso : | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA | 156 | Empanadas de pollo : | Unid | NO_COMPARABLE | unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |
| UNIDAD_AMBIGUA |  | Empanadas: |  | NO_COMPARABLE | unidad ausente; unidad discreta sin peso comestible/neto; no convertible de forma verificable a 100 g/ml |

## Por qué no se cambiaron alimentos

No se cambió ninguno porque la consigna fue exclusivamente de lectura. Además, no sería responsable corregir automáticamente:

- productos comerciales sin foto o rótulo argentino vigente;
- unidades como feta, pote, barra, porción o pieza sin peso neto/comestible;
- recetas variables como empanadas, milanesas, ensaladas y preparaciones caseras;
- cortes de carne cuyo nivel de grasa visible o estado de cocción no coincide exactamente con la referencia;
- diferencias explicables por carbohidratos disponibles versus totales, fibra, alcohol, redondeo reglamentario o rendimiento de cocción.

## Fuentes utilizadas

- [SARA 2 – Tabla de composición química de alimentos para Argentina](https://cesni-biblioteca.org/archivos/tabla-composicion-quimica-alimentos-argentina_ennys2__.pdf).
- [ARGENFOODS en el directorio FAO/INFOODS](https://www.fao.org/infoods/infoods/tablas-y-bases-de-datos/america-latina/es/).
- [USDA FoodData Central – descargas y documentación](https://fdc.nal.usda.gov/download-datasets/). Los FDC ID concretos están en el CSV cuando estaban disponibles.
- [ANMAT – rotulado nutricional de alimentos envasados](https://www.anmat.gob.ar/portafolio_educativo/Capitulo10.asp).
- Fichas oficiales de fabricante documentadas en `referenciaNutricional.sourceUrl` para productos comerciales.

## Archivos para revisión independiente

- `CATALOGO_COMPLETO_673.csv`: vista normalizada de los 673 documentos.
- `CATALOGO_COMPLETO_RAW.json`: documentos completos, sin credenciales.
- `AUDITORIA_NUTRICIONAL_COMPLETA.csv`: comparación por alimento y estado de comparabilidad.
- `CAMBIOS_HISTORICOS.csv`: trazabilidad de ambas migraciones.
- `documentacion/INTERPRETACION_BACKEND.md`: explicación de cómo las rutas del backend escalan macros.
- `informes_anteriores/`: evidencia previa, snapshots y reportes originales.
- `migraciones/`: scripts exactos usados anteriormente; se incluyen solo para inspección, no fueron ejecutados por esta exportación.
