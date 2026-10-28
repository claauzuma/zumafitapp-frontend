# Revisión del catálogo argentino después de las correcciones

Fecha de corte: 26 de octubre de 2026  
Base: `base2`  
Colección: `fooddatabase2`

## Resultado ejecutivo

- El catálogo pasó de **574 a 617 documentos**.
- Se corrigieron **41 documentos existentes** y se agregaron **43 referencias**.
- La repetición de la migración no duplica documentos: quedaron 43 `alimentoId` y 43 `migrationKey` únicos.
- La auditoría original de 125 alimentos tenía 7 críticos, 9 altos, 11 medios, 4 no comparables y 94 correctos.
- La auditoría posterior quedó en **0 críticos, 1 alto, 10 medios, 5 no comparables y 109 correctos**.
- Los 442 tests del backend finalizaron correctamente.

Fuentes principales:

- SARA 2, Argentina (2022): https://cesni-biblioteca.org/archivos/tabla-composicion-quimica-alimentos-argentina_ennys2__.pdf
- USDA FoodData Central: https://fdc.nal.usda.gov/download-datasets
- Coca-Cola Argentina: https://www.coca-cola.com/ar/es/brands/coca-cola/original
- Sprite Argentina: https://www.coca-cola.com/ar/es/brands/sprite/productos
- Fanta Argentina: https://www.coca-cola.com/ar/es/brands/fanta/productos
- Heineken Argentina: https://www.heineken.com/ar/es/nuestros-productos/la-original/

Los valores de las tablas siguientes están expresados por 100 g o 100 ml, salvo las frutas indicadas por unidad.

## Correcciones principales

| Alimento | Antes (kcal/P/C/G) | Después (kcal/P/C/G) | Decisión |
|---|---:|---:|---|
| Aceitunas negras | 157,4 / 1 / 0,1 / 17 | 119 / 0,8 / 4,4 / 10,9 | SARA 2 |
| Aceitunas verdes | 198,8 / 1,2 / 3,5 / 20 | 130 / 1,5 / 0,5 / 13,5 | SARA 2 |
| Choclo entero | 60,5 / 2,5 / 7 / 2,5 | 97 / 3,7 / 17,8 / 1,2 | SARA 2 |
| Churrasco magro | 144,5 / 21,5 / 0 / 8 | 158 / 21,5 / 0 / 8 | Se corrigieron las kcal para cerrar con los macros existentes |
| Filet de merluza | figuraba como unidad con 1,29 kcal | 80 / 17,1 / 0 / 1,3, ahora por gramos | Se corrigió el error de escala y unidad |
| Merluza | 124,5 / 21 / 0 / 4,5 | 80 / 17,1 / 0 / 1,3 | SARA 2, cruda |
| Maní | 596,8 / 28 / 4,2 / 52 | 596 / 24,4 / 12,9 / 49,7 | SARA 2, tostado sin sal |
| Mantequilla de maní | 590 / 25 / 10 / 50 | 607 / 21,9 / 18,3 / 49,5 | SARA 2 |
| Ñoquis con papa | 218,5 / 5,9 / 44 / 2,1 | 159 / 5,8 / 27,9 / 2,6 | SARA 2, envasados crudos |
| Ricota magra | 108 / 12 / 6 / 4 | 137 / 11,4 / 5,1 / 7,9 | SARA 2, ricotta descremada |
| Sardinas | 139,5 / 18 / 0 / 7,5 | 170 / 22,1 / 0 / 9,1 | SARA 2, al natural |
| Semillas de girasol | 580,7 / 23,3 / 6 / 51,5 | 592 / 20,8 / 11,4 / 51,5 | SARA 2 |
| Semillas de lino | 539 / 23 / 15 / 43 | 459 / 18,3 / 1,6 / 42,2 | SARA 2; carbohidratos disponibles, no totales |
| Soja texturizada | 323,7 / 51 / 27 / 1,3 | 283 / 51,5 / 16,4 / 1,2 | SARA 2 |
| Tofu | 115 / 11 / 2 / 7 | 149 / 17,3 / 0,5 / 8,7 | SARA 2 |

También se corrigieron las categorías de **huevo** (ahora proteína), **papaya** (fruta) y **semillas de calabaza** (grasas/frutos secos y semillas).

## Fuentes proteicas

### Las que estaban bien o dentro de un rango razonable

- Pechuga de pollo sin piel: 110,5 kcal, 22 g de proteína y 2,5 g de grasa.
- Pechuga de pavo: 110,5 kcal, 22 g de proteína y 2,5 g de grasa.
- Cortes vacunos magros como bola de lomo, cuadrada, peceto y ternera magra: alrededor de 21,5 g de proteína y 5 g de grasa.
- Cerdo magro y lomo de cerdo: 21–22 g de proteína y 4–7 g de grasa.
- Hígado, claras, huevo entero, gambas, langostinos, lubina y pescado blanco: valores plausibles para el alimento y estado declarados.
- Soja texturizada, tofu y sardinas quedaron alineados con SARA 2.

### Lo que se corrigió o aisló

- Merluza: se corrigieron dos entradas; una tenía el valor por gramo rotulado como si fuera una unidad completa.
- Churrasco magro: sus macros eran plausibles, pero 144,5 kcal no cerraban con 21,5 g de proteína y 8 g de grasa. Ahora son 158 kcal.
- Atún en “pote”: los dos registros históricos no informan peso neto/escurrido. Se conservaron para selección manual, pero ya no participan automáticamente. Se agregaron versiones por gramos:
  - al natural escurrido: 86 kcal, 19,4 P, 0 C y 1 G;
  - en aceite escurrido: 190 kcal, 29,1 P, 0 C y 8,2 G.
- “Mariscos” quedó inactivo porque el nombre mezcla especies con perfiles muy diferentes. Gambas y langostinos específicos siguen disponibles.
- Se agregaron salmón rosado, caballa, trucha, carne vacuna magra promedio y huevo entero por gramos.

### Diferencias que todavía son aceptables

- Churrasco magro continúa marcado como diferencia media frente al promedio SARA porque “churrasco” no identifica un único corte ni un único nivel de desgrasado.
- Pata-muslo sin piel tiene 130 kcal, 19 P y 5 G. Está cerca de USDA, aunque resulta algo más graso que el promedio de pollo sin piel de SARA.
- Seitán queda sin comparación oficial sólida en las tablas seleccionadas; su registro cierra matemáticamente, pero depende mucho de la receta.

## Frutas

- Después de la corrección, **las 41 entradas de frutas revisadas quedaron en nivel OK**.
- Las naranjas chica, mediana y grande dejaron de tener cero macros. Se cargaron con base SARA y pesos comestibles de 96, 131 y 184 g:
  - chica: 41,28 kcal por unidad;
  - mediana: 56,33 kcal por unidad;
  - grande: 79,12 kcal por unidad.
- Banana, manzana, pera, mandarina, durazno, kiwi, frutilla, arándano, ananá, mango, melón, sandía, uva, pomelo y las demás frutas revisadas están dentro de rangos razonables.
- Papaya estaba nutricionalmente razonable, pero en la categoría incorrecta; ya figura como fruta.

## Cereales, pastas, tubérculos y panes

### Correctos o razonables

- Arroz blanco e integral, crudos y cocidos.
- Fideos secos y cocidos.
- Batata, papa, polenta y puré instantáneo.
- Choclo y ñoquis después de la corrección.
- Pan genérico y pan blanco: ambos quedan en 264,1 kcal, 7,6 P, 51 C y 3,3 G. Son muy cercanos al pan blanco comercial de USDA (aprox. 266 kcal, 8,9 P, 49,4 C y 3,3 G).
- Pan baguette y pan francés también son plausibles para panes simples.
- Pan de centeno es razonable como formulación comercial, aunque puede variar bastante según cuánta harina de centeno real contenga.

### Casos que conviene identificar mejor

- Avena instantánea: diferencia media, principalmente por proteína/grasa, pero la energía y el cierre de macros son coherentes. No se cambió sin conocer la marca o si tiene procesamiento adicional.
- Maíz: diferencia media por el tipo de carbohidrato informado y por variedad; coincide mejor con USDA que con SARA en grasa.
- Pan negro: diferencia media porque “pan negro” puede ser integral, con salvado, centeno o una mezcla comercial. No hay un único valor correcto sin receta/rótulo.

## Yogures

Los 13 yogures de marca existentes no tenían un error matemático claro. El problema era tratarlos como genéricos aunque el rótulo puede cambiar por marca, sabor y versión. Se conservaron sus datos, pero quedaron como **EXPLICIT_ONLY**.

Se agregaron cinco referencias genéricas SARA:

| Yogur | kcal | P | C | G |
|---|---:|---:|---:|---:|
| Natural entero | 62 | 3,5 | 4,7 | 3,3 |
| Entero saborizado | 87 | 3,5 | 11 | 3,3 |
| Descremado natural | 36 | 2,9 | 6 | 0 |
| Descremado bebible | 36 | 2,9 | 6 | 0 |
| Entero bebible saborizado | 76 | 2,9 | 12 | 1,8 |

## Coca-Cola, Sprite, Fanta y otras bebidas sin alcohol

- Coca-Cola Sabor Original Argentina se actualizó de 44 kcal y 11 g C a **30 kcal y 7,5 g C por 100 ml**, según el rótulo argentino vigente.
- Sprite se actualizó de 20 kcal y 5 g C a **29,5 kcal y 7,5 g C por 100 ml**.
- Se agregaron Coca-Cola Sin Azúcar, Sprite Sin Azúcar, Fanta Naranja, Fanta Naranja Sin Azúcar y Fanta Pomelo.
- También se agregaron gaseosa genérica con y sin azúcar, bebida energizante, isotónica común y sin azúcar, agua saborizada común y light, agua mineral y agua con gas.
- Todas estas bebidas son de selección explícita y no se incorporan solas a un menú.

## Vino, cerveza, fernet y otras bebidas alcohólicas

- La cerveza histórica tenía 3 g de grasa/100 ml, lo cual era incorrecto. Ahora “Cerveza regular” tiene 43 kcal, 0,5 P, 3,6 C, 0 G y 3,9 g de alcohol.
- El vino histórico tenía 9,5 C y 5 G. Ahora “Vino tinto” tiene 84 kcal, 0,1 P, 2,7 C, 0 G y 10,4 g de alcohol.
- Se agregaron cerveza light, sin alcohol, de alta graduación y Heineken Original.
- Se agregaron vino blanco, rosado, champagne/espumante seco y espumante dulce tipo Frizze.
- Se agregaron fernet, fernet con Coca-Cola 70/30, fernet con Coca-Cola Sin Azúcar 70/30, vodka, gin, ron, whisky, aperitivo tipo Gancia y sidra.
- En alcohol, las kcal no deben “cerrar” sólo con 4P + 4C + 9G: el alcohol aporta aproximadamente 7 kcal/g y está guardado por separado en `alcohol100`.

No se crearon registros llamados IPA, stout o roja con un número único, porque esos estilos varían mucho en graduación y carbohidratos. Para una cerveza artesanal específica conviene usar el rótulo o la ficha técnica de esa cerveza; la entrada “cerveza de alta graduación” funciona como promedio genérico.

## Diferencias pendientes, no necesariamente errores

- **Castañas de cajú**: única alerta alta restante. Sus macros cierran exactamente con las kcal cargadas, pero difieren de USDA, sobre todo en carbohidratos totales. Puede ser una diferencia de carbohidratos disponibles versus totales o del tipo/procesamiento; no se sobrescribió sin una referencia argentina equivalente inequívoca.
- Diferencias medias: avellanas, avena instantánea, churrasco, maíz, pan negro, pata-muslo, pistachos, dos quesos y semillas de calabaza. En general responden a variedad, formulación comercial, corte/desgrasado o convención analítica.
- “Verduras” genérico sigue siendo demasiado amplio para representar una composición reproducible. Conviene usar cada verdura concreta o una receta estandarizada.
- Castañas y seitán no tuvieron una coincidencia oficial suficientemente sólida para declarar correcto o incorrecto el número.

## Archivos de control

- `snapshot-before.json`: copia íntegra de todos los documentos que podían modificarse antes de la primera escritura.
- `migration-plan.json`: plan reproducible de cambios.
- `verification-after.json`: lectura posterior desde MongoDB.
- Auditoría poscorrección: `../food-nutrition-audit-post-fix-2026-10-26/`.
