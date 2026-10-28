# Revisión argentina: carnes, quesos, fiambres, grasas, frutas y masas

Fecha: 26 de octubre de 2026  
Base/colección: `base2/fooddatabase2`

## Resultado

- Catálogo antes de esta etapa: **617 alimentos**.
- Catálogo después: **673 alimentos**.
- Documentos existentes examinados o normalizados: **100**.
- Referencias nuevas: **56**.
- Altas por grupo: 18 carnes, 9 fiambres, 10 quesos, 10 aceites/presentaciones y 9 masas/tapas.
- IDs numéricos duplicados: **0**.
- Nuevos registros sin clave única: **0**.
- Nuevas unidades discretas sin peso: **0**.
- Frutas activas por unidad sin peso comestible: **0 de 19**.
- Productos de marca marcados por error como genéricos: corregidos a `EXPLICIT_ONLY`.
- Tests del backend: **442 aprobados, 0 fallidos**.

Fuentes:

- SARA 2 Argentina: https://cesni-biblioteca.org/archivos/tabla-composicion-quimica-alimentos-argentina_ennys2__.pdf
- USDA FoodData Central: https://fdc.nal.usda.gov/download-datasets
- La Salteña, catálogo oficial: https://www.molinos.com.ar/productos/la-saltena/
- Tapas criollas: https://www.lasaltena.com.ar/productos/empanadas-criollas/
- Tapas de hojaldre: https://www.lasaltena.com.ar/productos/empanadas-de-hojaldre/
- Tapas para freír: https://www.lasaltena.com.ar/productos/empanadas-para-freir/
- Tapas Balance: https://www.lasaltena.com.ar/productos/empanadas-balance/
- Pascualinas criollas: https://www.lasaltena.com.ar/productos/pascualinas-criollas/
- Pascualinas hojaldradas: https://www.lasaltena.com.ar/productos/pascualinas-hojaldradas/
- Pascualinas Balance: https://www.lasaltena.com.ar/productos/pascualinas-balance/

## Carne vacuna

Todos los valores de cortes crudos están por 100 g de porción comestible. No incluyen hueso. En cortes como vacío, asado y entraña, retirar o conservar la grasa visible puede cambiar mucho el resultado real.

### Cortes que ya existían y quedaron aceptados

| Corte | kcal | Proteína | Grasa | Resultado |
|---|---:|---:|---:|---|
| Bife angosto | 176 | 21,5 | 10 | Coherente con corte semigraso SARA |
| Bife de chorizo magro | 144,5 | 21,5 | 6,5 | Plausible como versión desgrasada; categoría corregida a proteínas |
| Bola de lomo | 131 | 21,5 | 5 | Correcto como corte magro |
| Cuadrada | 131 | 21,5 | 5 | Correcto como corte magro |
| Cuadril | 144,5 | 21,5 | 6,5 | Plausible según desgrasado |
| Peceto | 131 | 21,5 | 5 | Correcto como corte magro |
| Paleta | 135,5 | 21,5 | 5,5 | Plausible; puede subir si conserva grasa |
| Palomita | 117,5 | 21,5 | 3,5 | Versión muy magra, pero plausible |
| Churrasco magro | 158 | 21,5 | 8 | Energía corregida en la etapa anterior |
| Tapa de asado | 211 | 19 | 15 | Muy cercana al promedio de cortes grasos SARA |
| Tira de asado | 210 | 20 | 14,4 | Corregida desde 475 kcal y 43 g de grasa |

### Cortes y estados agregados

- Nalga magra.
- Tapa de nalga magra.
- Lomo vacuno.
- Roast beef.
- Tortuguita.
- Vacío.
- Matambre vacuno.
- Aguja.
- Falda.
- Carne picada común.
- Carne picada especial.
- Colita de cuadril.
- Entraña.
- Ojo de bife/bife ancho.
- Osobuco, porción comestible sin contar el hueso.
- Carne vacuna magra cocida al horno/parrilla.
- Carne vacuna semigrasa cocida al horno/parrilla.
- Carne vacuna grasa cocida al horno/parrilla.

SARA agrupa explícitamente nalga, bola de lomo, peceto y cuadrada como magros; lomo, roast beef, paleta, bife angosto, tortuguita y palomita como semigrasos; y asado, vacío, carne picada común, aguja, falda y matambre como grasos. Entraña, colita de cuadril, ojo de bife y osobuco se completaron con equivalencias USDA claramente documentadas.

El registro vacío `Milanesa de ternera:` continúa inactivo y en revisión. No se le asignó un promedio ficticio porque el empanado, la absorción de aceite y el método de cocción cambian demasiado los macros.

## Quesos

Se normalizaron los genéricos argentinos principales:

- Muzzarella: 278 kcal, 23,6 P, 2,4 C y 19,3 G.
- Provolone/provoleta: 350 kcal, 25,6 P, 2,1 C y 26,6 G.
- Cheddar: 410 kcal, 24,3 P, 2,1 C y 33,8 G.
- Queso crema entero: 245 kcal, 6,6 P, 3,9 C y 22,6 G.
- Cremoso: 310 kcal, 20,4 P, 2,5 C y 24,3 G.
- Pategrás: 332 kcal, 25,4 P, 0 C y 25,6 G.
- Sardo: 384 kcal, 31,8 P, 3,6 C y 26,9 G.
- Ricota: 169 kcal, 11,6 P, 4 C y 11,8 G.
- Ricota magra: 137 kcal, 11,4 P, 5,1 C y 7,9 G.

Se agregaron queso azul, blanco descremado untable, cuartirolo, queso de máquina, parmesano, pasta blanda descremado, Port Salut light sin sal, reggianito, roquefort y queso untable promedio.

Los quesos con marca —Cremón, Cremac, Punta del Agua, Carrefour, La Paulina, Finlandia y otros— conservan su rótulo histórico pero quedaron como selección manual. No se usarán como si fueran una composición genérica estable.

## Jamones, fiambres y embutidos

Valores genéricos corregidos con SARA, por 100 g:

| Producto | kcal | P | C | G |
|---|---:|---:|---:|---:|
| Jamón cocido | 107 | 18,4 | 1 | 3,3 |
| Jamón crudo | 319 | 28,8 | 0,2 | 22,6 |
| Mortadela | 306 | 16,4 | 3,1 | 25,4 |
| Panceta | 389 | 13,7 | 0 | 37,1 |
| Salame | 372 | 21,1 | 0,7 | 31,7 |

Se agregaron bondiola fiambre, matambre fiambre, paleta fiambre, pastrón, cantimpalo, fiambre de cerdo, salchicha de Viena, Viena light y salchicha parrillera cruda.

La bondiola Lario por gramos tenía un error de escala x10: aparecía con 2810 kcal/100 g. Se corrigió a 281 kcal, pero quedó en revisión y selección manual porque el cálculo por 100 g depende de inferir una feta de 10 g a partir del registro hermano. Los fiambres de marca por feta también quedaron manuales: la unidad es válida para registrar “una feta”, pero no se inventó un peso universal porque cambia según el corte de máquina.

## Aceites, almendras, frutos secos y semillas

- Aceite de oliva y coco quedaron exactamente en 900 kcal y 100 g de grasa/100 g.
- Se agregaron mezcla, canola, girasol, girasol alto oleico, maíz, sésamo, soja y uva.
- Se agregaron aceite de oliva y girasol por cucharada de 14 g: 126 kcal y 14 g de grasa por unidad.
- Almendra: 570 kcal, 21,2 P, 9,1 C y 49,9 G/100 g. La unidad pesa 1,2 g y aporta 6,84 kcal.
- Avellana, castaña de cajú, nuez, pistacho, semillas de calabaza, chía y sésamo fueron corregidos.
- Maní, mantequilla de maní, girasol y lino ya habían sido corregidos en la etapa anterior.

En chía, lino y otras semillas hay diferencias grandes entre tablas si una informa carbohidratos disponibles y la otra carbohidratos totales incluyendo fibra. El catálogo sigue SARA para mantener una convención argentina consistente y guarda la fuente en cada documento.

## Frutas y unidades

Las 19 frutas activas expresadas por unidad ahora tienen `pesoUnidadGramos`:

- Banana: 101 g chica, 118 g mediana y 136 g grande.
- Durazno: 130 g chico, 150 g mediano y 175 g grande.
- Kiwi mediano: 69 g.
- Mandarina: 76 g chica, 88 g mediana y 120 g grande.
- Manzana: 149 g chica, 182 g mediana y 227 g grande.
- Naranja: 96 g chica, 131 g mediana y 184 g grande.
- Pera: 148 g chica, 178 g mediana y 230 g grande.

También se corrigió un decimal desplazado en la proteína de los duraznos por unidad. Los valores por unidad ahora se calculan desde SARA: 58,5 kcal el chico, 67,5 el mediano y 78,75 el grande.

## Tapas de empanadas, pascualinas y prepizzas

### La Salteña, por unidad real

| Producto | Peso de la unidad | kcal | P | C | G |
|---|---:|---:|---:|---:|---:|
| Tapa criolla | 28 g | 76 | 1,6 | 12 | 2,4 |
| Tapa hojaldrada | 28 g | 76 | 1,6 | 12 | 2,4 |
| Tapa para freír | 28 g | 75 | 1,6 | 12 | 2,4 |
| Tapa Balance | 30 g | 77 | 1,9 | 14 | 1,5 |
| Pascualina criolla | 200 g por disco | 526,67 | 13,33 | 80 | 17,33 |
| Pascualina hojaldrada | 200 g por disco | 526,67 | 13,33 | 80 | 17,33 |
| Pascualina Balance | 200 g por disco | 546,67 | 13,33 | 100 | 10,67 |

Para las pascualinas, el sitio oficial declara un paquete de 400 g y el catálogo comercial de la marca indica dos tapas; por eso se usa 200 g por disco. Los macros se escalaron desde la porción oficial de 30 g.

### Masas genéricas

Se agregaron, por gramos:

- Masa de tarta o empanada regular: 337 kcal/100 g.
- Integral: 325 kcal/100 g.
- Light: 268 kcal/100 g.
- Masa de tarta sin TACC: 283 kcal/100 g.

La masa de prepizza existente se corrigió a 241 kcal, 6,9 P, 45,9 C y 3,3 G/100 g. Las dos entradas antiguas “Porción de prepizza” siguen visibles manualmente pero están en revisión, porque no declaran el peso de esa porción. `Prepizza (Carrefour)` también quedó manual por depender del rótulo y tamaño concreto.

Las masas y tapas de marca no se agregan automáticamente a menús; deben seleccionarse de forma explícita junto con su relleno o cobertura.

## Archivos de control

- `snapshot-before.json`: respaldo de los documentos incluidos antes de la primera escritura.
- `snapshot-before-addendum-durazno.json`: respaldo del durazno genérico añadido al alcance en la revisión final.
- `migration-plan.json`: plan reproducible.
- `verification-after.json`: lectura final posterior desde MongoDB.
