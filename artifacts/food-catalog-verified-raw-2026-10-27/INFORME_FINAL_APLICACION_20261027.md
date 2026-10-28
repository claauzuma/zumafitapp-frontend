# ZumaFit — corrección del catálogo nutricional argentino

Fecha de aplicación y verificación: 27/10/2026  
Base: `base2`  
Colección: `fooddatabase2`

## Resultado

- La corrección quedó aplicada en MongoDB.
- Se conservaron 673 documentos: 659 alimentos con `alimentoId` y 14 documentos estructurales/encabezados sin `alimentoId`.
- Hay 636 alimentos activos, 23 inactivos y 198 genéricos activos habilitados para generación automática.
- No hay `alimentoId` numéricos duplicados.
- No hay versiones cocidas conocidas ni productos de marca auditados dentro del pool automático.
- Los 198 genéricos automáticos tienen ahora una `basePesaje` explícita.
- Pasaron 44/44 pruebas del motor de cantidades, restricciones y combinaciones.

## Regla de pesaje aplicada

- Carnes, pollo, pavo, pescado, huevo y vegetales que requieren cocción: crudos, sobre parte comestible.
- Arroz, fideos, avena, polenta, harinas, legumbres secas y soja texturizada: peso seco previo a hidratación/cocción.
- Panes, quesos, yogures, fiambres, bebidas y enlatados: tal como se consumen; los enlatados dicen `escurrido` cuando corresponde.
- Los registros cocidos se conservaron, pero arroz cocido (40 y 43), pasta cocida (163) y carnes cocidas (668–670) quedaron `EXPLICIT_ONLY` y no pueden ser sugeridos automáticamente.

La base no aplica factores de merma o absorción durante la cocción. Si se cargan 150 g de pechuga, son 150 g crudos; si se cargan 100 g de arroz, son 100 g secos.

Advertencia sobre la parte comestible: en osobuco, tira de asado y otros cortes con hueso no se debe contar el peso del hueso. En pata-muslo se usa carne sin piel y sin hueso. El huevo por unidad usa 50 g comestibles, sin cáscara; la clara usa 33 g. El langostino corresponde a carne de cola, no a la pieza con caparazón.

## Cambios nutricionales principales

Valores por 100 g o 100 ml, salvo huevo y clara por unidad. Formato: kcal / proteína / carbohidratos / grasa.

| ID | Alimento final | Antes | Ahora | Referencia principal |
|---:|---|---:|---:|---|
| 65 | Bife de chorizo magro, crudo, sin grasa visible | 144,5 / 21,5 / 0 / 6,5 | 111 / 21 / 0 / 3 | ARGENFOODS 229 |
| 72 | Bola de lomo de novillito, cruda | 131 / 21,5 / 0 / 5 | 114 / 22 / 0 / 3,2 | ARGENFOODS 504 |
| 113 | Churrasco vacuno magro, crudo, corte magro promedio | 158 / 21,5 / 0 / 8 | 138 / 22,2 / 0 / 5,5 | SARA 2, cortes magros |
| 129 | Cuadrada vacuna magra, cruda | 131 / 21,5 / 0 / 5 | 138 / 22,2 / 0 / 5,5 | SARA 2, cortes magros; equivalencia documentada |
| 358 | Paleta de novillito, cruda | 135,5 / 21,5 / 0 / 5,5 | 125 / 19 / 0 / 5,5 | ARGENFOODS 511 |
| 360 | Palomita de novillito, cruda | 117,5 / 21,5 / 0 / 3,5 | 116 / 20 / 0 / 3,7 | ARGENFOODS 513 |
| 402 | Peceto de novillito, crudo | 131 / 21,5 / 0 / 5 | 125 / 23 / 0 / 1,9 | ARGENFOODS 514 |
| 541 | Carne vacuna magra, cruda, promedio | 131 / 21,5 / 0 / 5 | 138 / 22,2 / 0 / 5,5 | SARA 2 |
| 653 | Nalga magra de novillito, cruda | 138 / 22,2 / 0 / 5,5 | 106 / 22 / 0 / 1,7 | ARGENFOODS 510 |
| 655 | Lomo vacuno, crudo | 176 / 21,3 / 0 / 10,1 | 116 / 20 / 0 / 4 | ARGENFOODS 233 |
| 657 | Tortuguita de novillito, cruda | 176 / 21,3 / 0 / 10,1 | 154 / 22 / 0 / 7,6 | ARGENFOODS 516 |
| 658 | Vacío de novillito, crudo | 210 / 20 / 0 / 14,4 | 174 / 20 / 0 / 11 | ARGENFOODS 517 |
| 664 | Colita de cuadril de novillito, cruda | 165 / 20,6 / 0 / 8,55 | 143 / 21 / 0 / 6,7 | ARGENFOODS 506 |
| 667 | Osobuco, parte comestible cruda | 128 / 21,8 / 0 / 3,85 | 210 / 20 / 0 / 14,4 | SARA 2, osobuco crudo |
| 404 | Pechuga de pollo sin piel, cruda | 110,5 / 22 / 0 / 2,5 | 114 / 22,5 / 0 / 2,6 | SARA 2 |
| 405 | Pechuga de pollo con piel, cruda | 138 / 21 / 0 / 6 | 127 / 21,4 / 0 / 4,78 | USDA FDC 2727569 |
| 609 | Pata-muslo sin piel, carne cruda | 130 / 19 / 0 / 5 | 120 / 19,2 / 0 / 4,22 | USDA FDC 173619 |
| 403 | Pechuga de pavo sin piel, cruda | 110,5 / 22 / 0 / 2,5 | 114 / 23,3 / 0 / 2,33 | USDA FDC 174515 |
| 412 | Pescado blanco/magro de mar, crudo | 130 / 19 / 0 / 6 | 80 / 17,1 / 0 / 1,3 | SARA 2 |
| 241 | Langostino, carne de cola cruda | 67,7 / 14 / 0 / 1,3 | 96 / 22 / 0 / 0,9 | SARA 2 |
| 224 | Huevo mediano crudo, 50 g comestibles | sin base por 100 g consistente | 78 / 6 / 0,2 / 5,9 por unidad | SARA 2 |
| 115 | Clara cruda, 33 g | sin base por 100 g consistente | 16,83 / 3,83 / 0,23 / 0,07 por unidad | SARA 2 |
| 39 | Arroz blanco crudo, peso seco | 338,5 / 8 / 75,5 / 0,5 | 339 / 6,9 / 77,5 / 0,2 | SARA 2 |
| 42 | Arroz integral crudo, peso seco | 350 / 8 / 75 / 2 | 350 / 7,5 / 72,7 / 3,2 | SARA 2 |
| 49 | Avena arrollada/instantánea seca | 352 / 13 / 57 / 8 | 357 / 15,6 / 56,9 / 7,5 | SARA 2 |
| 162 | Fideos secos crudos | 338,2 / 11,3 / 71 / 1 | 352 / 13 / 71,5 / 1,5 | SARA 2 |
| 120 | Copos de maíz sin azúcar | 361,7 / 6,6 / 82,7 / 0,5 | 401 / 7,1 / 91,4 / 0,8 | SARA 2 |
| 362 | Pan genérico de panadería sin grasa | 264,1 / 7,6 / 51 / 3,3 | 268 / 8,4 / 57 / 0,7 | SARA 2 |
| 364 | Baguette / pan francés | 274,2 / 8,8 / 53 / 3 | 269 / 9,3 / 57,4 / 0,2 | ARGENFOODS 36 |
| 365 | Pan blanco tipo molde lacteado | 264,1 / 7,6 / 51 / 3,3 | 244 / 9,4 / 46,7 / 2,2 | SARA 2 |
| 369 | Pan de centeno | 259,7 / 8,5 / 49 / 3,3 | 234 / 8,5 / 42,5 / 3,3 | SARA 2 |
| 374 | Pan francés sin grasa agregada | 276,2 / 8 / 57 / 1,8 | 268 / 8,4 / 57 / 0,7 | SARA 2 |
| 376 | Pan integral / molde con salvado | 259,3 / 9,1 / 46,5 / 4,1 | 225 / 10,9 / 40,7 / 2,1 | SARA 2 |
| 247 | Leche descremada fluida genérica | 39,1 / 3 / 5,2 / 0,7 | 36 / 3 / 4,9 / 0,5 | Rótulo argentino representativo |
| 249 | Leche descremada alta en proteínas, genérica | 36,8 / 4,6 / 4,6 / 0 | 43 / 4,5 / 5,4 / 0,4 | SARA 2, leche con 50% más proteína |
| 252 | La Serenísima Menos Calorías 0% | 18,7 / 1,5 / 2,5 / 0,3 | 36 / 3 / 4,9 / 0,5 | Rótulo oficial argentino |
| 253 | Leche sin lactosa parcialmente descremada | 40,2 / 3 / 4,8 / 1 | 40 / 3 / 4,8 / 1 | Rótulo argentino |
| 258 | Leche entera fluida genérica | 60,5 / 3 / 6,5 / 2,5 | 57 / 3 / 4,5 / 3 | Argentina; corroborado por ARGENFOODS/SARA |
| 35 | Ananá | 51 / 0,5 / 10 / 1 | 50 / 0,4 / 11,7 / 0,2 | SARA 2 |
| 79 | Zucchini / zapallito italiano crudo | 28,5 / 2 / 4 / 0,5 | 16 / 1,2 / 2,1 / 0,3 | SARA 2 |
| 391 | Papa cruda | 96,3 / 1,7 / 19 / 1,5 | 79 / 2,7 / 16,9 / 0,1 | SARA 2 |
| 494 | Repollo crudo | 11,4 / 0,6 / 0 / 1 | 19 / 1,3 / 3,3 / 0,1 | SARA 2 |
| 607 | Zapallo crudo | 26,5 / 1,1 / 5,3 / 0,1 | 36 / 1 / 7,8 / 0,1 | SARA 2 |
| 548 | Tostadas clásicas | 412,4 / 12 / 74 / 7,6 | 388 / 13 / 74,5 / 4,2 | SARA 2 |
| 551 | Galletas/tostadas de arroz | 361,4 / 8 / 81 / 0,6 | 380 / 6,3 / 83,9 / 2,1 | SARA 2 |

El detalle completo de campos anteriores y posteriores está en `CAMBIOS_APLICADOS.csv`. El ajuste final de la leche alta en proteínas está documentado aparte en `followup-high-protein-milk-after.ejson`.

## Fuentes proteicas: conclusión

Quedaron con equivalencia argentina específica y estado crudo claramente documentado: bife de chorizo magro, bola de lomo, paleta, palomita, peceto, nalga, lomo, tortuguita, vacío y colita de cuadril. Churrasco se definió expresamente como “corte magro promedio” porque es una forma de corte, no una pieza anatómica única. Osobuco usa el valor exacto SARA de parte comestible cruda.

Tira de asado conserva 210 / 20 / 0 / 14,4 por 100 g de parte comestible cruda. Es una estimación SARA de cortes grasos que incluye asado; no es un valor del peso total con hueso. Tapa de asado quedó fuera de la autogeneración: el valor actual es plausible, pero falta una medición argentina primaria específica con nivel de desgrasado definido.

Pechuga sin piel, pechuga con piel, pata-muslo sin piel y pavo quedaron diferenciados. Pescado blanco, langostino, huevo y clara fueron corregidos. Atunes y sardinas enlatados conservan la presentación lista para consumo/escurrida.

Los principales quesos genéricos, ricotas, yogures y fiambres que ya coincidían con SARA 2 no se alteraron: muzzarella, cremoso, Port Salut normal, Pategrás, sardo, parmesano, reggianito, cuartirolo, queso azul, ricota, ricota magra, jamón cocido, jamón crudo, mortadela y salame. “Queso cremoso light” sigue marcado para confirmar el tipo/SKU, porque el valor es plausible pero “light” no define una formulación única.

## Frutas, cereales, aceites y frutos secos

- La corrección confirmada importante en frutas fue ananá. El resto de las frutas principales se mantuvo porque sus valores son razonables para la variedad y convención de carbohidratos usada.
- Palta y pomelo permanecen marcados para revisión por variación de variedad y carbohidrato disponible frente a total; no se sustituyeron automáticamente.
- Arroz, avena y fideos quedaron en seco/crudo. Pan francés, pan genérico, pan blanco de molde, integral y centeno quedaron como listos para consumo.
- Batata quedó identificada como cruda y soja texturizada como seca antes de hidratar.
- Almendra, avellana, castaña de cajú, pistacho, nuez, maní y semillas mantienen valores plausibles ya respaldados.
- Los aceites continúan en 900 kcal y 100 g de grasa por 100 g. Las cucharadas de aceite son de 14 g: 126 kcal y 14 g de grasa.

## Gaseosas y alcohol

Los valores vigentes revisados no necesitaron cambio:

- Coca-Cola Sabor Original: 30 kcal y 7,5 g de carbohidratos por 100 ml.
- Sprite: 29,5 kcal y 7,5 g de carbohidratos por 100 ml.
- Fanta Naranja: 49,5 kcal y 12,5 g de carbohidratos por 100 ml.
- Fanta Pomelo: 41 kcal y 10 g de carbohidratos por 100 ml.
- Versiones sin azúcar: 0 kcal y 0 g de macronutrientes declarados.
- Cerveza regular: 43 kcal; cerveza sin alcohol: 25 kcal; vino tinto: 84 kcal; vino blanco: 83 kcal; fernet: 280 kcal por 100 ml.

En bebidas alcohólicas las calorías no deben reconstruirse solo con 4P + 4C + 9G, porque el alcohol aporta energía.

## Pendientes reales

Hay 75 documentos marcados para revisión:

- 10 activos y todavía genéricos automáticos: Bondiola de cerdo (75), Carne de cerdo magro (88), Galletitas de agua (179), Lomo de cerdo magro (270), Palta (361), Polenta (419), Pomelo (424), Queso cremoso light (460), Entraña (665) y Ojo de bife/bife ancho (666). Sus valores actuales son plausibles; no existe evidencia suficiente para reemplazarlos por otro perfil argentino exacto.
- 42 activos `EXPLICIT_ONLY`: principalmente marcas/SKU, unidades sin peso, preparaciones ambiguas y Tapa de asado. No aparecen espontáneamente en el generador.
- 23 inactivos: no tienen impacto en generación ni registro normal.

La lista completa, con motivo individual, está en `PENDIENTES_CONFIRMACION_ACTUALES.csv`.

## Verificación técnica y reversibilidad

- Muestra viva: 100 g de arroz blanco crudo = 339 kcal, 6,9 g P, 77,5 g C y 0,2 g G.
- Muestra viva: 150 g de pechuga de pollo sin piel cruda = 171 kcal, 33,75 g P y 3,9 g G.
- Muestra viva: un huevo mediano = 78 kcal, 6 g P, 0,2 g C y 5,9 g G.
- 44/44 tests del motor aprobaron después de todos los cambios.
- Los tres snapshots tienen checksum SHA-256 coincidente.
- La migración principal y la normalización de base de pesaje incluyen rollback con precondiciones. El ajuste puntual de leche alta en proteínas también conserva snapshot y rollback.

## Referencias primarias

- SARA 2, Ministerio de Salud de la Nación / ENNYS 2: https://cesni-biblioteca.org/wp-content/uploads/2022/09/tabla-composicion-quimica-alimentos-argentina_ennys2.pdf
- ARGENFOODS, Universidad Nacional de Luján, carnes: https://www.argenfood.unlu.edu.ar/Tablas/Grupo/Carnes.pdf
- ARGENFOODS, cereales: https://www.argenfood.unlu.edu.ar/Tablas/Grupo/Cereales.pdf
- USDA FoodData Central, datasets Foundation/SR Legacy: https://fdc.nal.usda.gov/download-datasets/
- La Serenísima, información oficial: https://www.laserenisima.com.ar/
- Coca-Cola Argentina, Coca-Cola Original: https://www.coca-cola.com/ar/es/brands/coca-cola/original
- Coca-Cola Argentina, Sprite: https://www.coca-cola.com/ar/es/brands/sprite/productos
- Coca-Cola Argentina, Fanta: https://www.coca-cola.com/ar/es/brands/fanta/productos
