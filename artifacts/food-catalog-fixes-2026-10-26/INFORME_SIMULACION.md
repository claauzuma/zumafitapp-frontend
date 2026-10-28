# Corrección y ampliación del catálogo de alimentos

Fecha: 2026-10-26T19:21:25.128Z

- Modo ejecutado: **SIMULACIÓN**
- Base/colección: `base2/fooddatabase2`
- Documentos antes: 574
- Documentos después: 574
- Documentos actualizados: 41
- Documentos insertados: 43
- Advertencias de precondición: 0

## Criterios

- SARA 2 Argentina fue la referencia primaria para alimentos genéricos locales.
- USDA se usó sólo donde SARA no ofrece suficiente desagregación.
- Coca-Cola, Sprite, Fanta y Heineken se tomaron de sus rótulos oficiales argentinos vigentes.
- Los valores de cerveza, vino y destilados incluyen energía del alcohol. Por eso no deben validarse únicamente con la fórmula 4/4/9 de proteínas, carbohidratos y grasas.
- Bebidas alcohólicas, gaseosas y productos de marca quedaron fuera de la generación automática.
- El registro ambiguo `Mariscos` quedó inactivo; se conservan o agregan especies concretas.

## Verificación de documentos tocados

| ID | Alimento | Unidad | kcal/100 | P/100 | C/100 | G/100 | Generación |
|---:|---|---|---:|---:|---:|---:|---|
| 3 | Aceitunas negras | Grs | 157.4 | 1 | 0.1 | 17 | GENERIC |
| 4 | Aceitunas verdes | Grs | 198.8 | 1.2 | 3.5000000000000004 | 20 | GENERIC |
| 46 | Atun en lomitos al aceite | Pote | — | — | — | — | — |
| 47 | Atun en lomitos al natural | Pote | — | — | — | — | GENERIC |
| 103 | Cerveza | Ml | 43 | 0 | 4 | 3 | — |
| 105 | Choclo entero | Grs | 60.5 | 2.5 | 7.000000000000001 | 2.5 | GENERIC |
| 113 | Churrasco magro | Grs | 144.5 | 21.5 | 0 | 8 | GENERIC |
| 116 | Coca cola | Grs | 44 | 0 | 11 | 0 | — |
| 165 | Filet de merluza | Unid | — | — | — | — | GENERIC |
| 224 | Huevos | Unid | — | — | — | — | GENERIC |
| 282 | Mani | Grs | 596.8 | 28.000000000000004 | 4.2 | 52 | GENERIC |
| 286 | Mantequilla de mani | Grs | 590 | 25 | 10 | 50 | GENERIC |
| 291 | Mariscos | Grs | 123 | 12 | 3 | 7.000000000000001 | GENERIC |
| 304 | Merluza | Grs | 124.50000000000001 | 21 | 0 | 4.5 | — |
| 343 | Naranja chica | Unid | — | — | — | — | GENERIC |
| 344 | Naranja grande | Unid | — | — | — | — | GENERIC |
| 345 | Naranja mediana | Unid | — | — | — | — | GENERIC |
| 353 | Ñoquis con papa | Grs | 218.5 | 5.8999999999999995 | 44 | 2.1 | GENERIC |
| 396 | Papaya | Grs | 40 | 0 | 10 | 0 | GENERIC |
| 497 | Ricota magra | Grs | 108 | 12 | 6 | 4 | — |
| 517 | Sardinas | Grs | 139.5 | 18 | 0 | 7.5 | GENERIC |
| 520 | Semillas de calabaza | Grs | 584 | 35 | 3 | 48 | GENERIC |
| 523 | Semillas de girasol | Grs | 580.7 | 23.3 | 6 | 51.5 | GENERIC |
| 524 | Semillas de lino | Grs | 539 | 23 | 15 | 43 | GENERIC |
| 528 | Soja texturizada | Grs | 323.7 | 51 | 27 | 1.3 | GENERIC |
| 531 | Sprite (Gaseosa) | Grs | 20 | 0 | 5 | 0 | — |
| 543 | tofu | Grs | 114.99999999999999 | 11 | 2 | 7.000000000000001 | GENERIC |
| 588 | Vino | Ml | 83 | 0 | 9.5 | 5 | — |
| 592 | Yogurisimo bebible | Grs | 58.599999999999994 | 2.8000000000000003 | 10.5 | 0.6 | GENERIC |
| 593 | Yogurisimo firme la serenisima (190 grs) | Pote | — | — | — | — | GENERIC |
| 594 | Yogurt activia bebible | Grs | 61.9 | 2.9000000000000004 | 9.2 | 1.5 | GENERIC |
| 595 | Yogurt bebible (Ser) | Grs | 27.6 | 3.1 | 3.8 | 0 | GENERIC |
| 596 | Yogurt bebible vida light | Grs | 30.4 | 2.9000000000000004 | 4.7 | 0 | GENERIC |
| 597 | Yogurt descremado bebible Ilolay | Grs | 34.8 | 3.6999999999999997 | 5 | 0 | GENERIC |
| 598 | Yogurt descremado bebible vida | Grs | 30.4 | 2.9000000000000004 | 4.7 | 0 | GENERIC |
| 599 | Yogurt descremado gran compra | Grs | 31.2 | 3.5999999999999996 | 4.2 | 0 | GENERIC |
| 600 | Yogurt entero bebible Ilolay | Grs | 62.1 | 3 | 10.5 | 0.8999999999999999 | GENERIC |
| 601 | Yogurt entero bebible Yogs | Grs | 36.25 | 1.5 | 7.000000000000001 | 0.25 | GENERIC |
| 602 | Yogurt entero gran compra | Grs | 53.849999999999994 | 2.5 | 9.5 | 0.65 | GENERIC |
| 603 | Yogurt light gran compra | Grs | 30.8 | 3.2 | 4.5 | 0 | GENERIC |
| 604 | Yogurt light la serenisima (Bebible) | Grs | 31.4 | 3.65 | 4.2 | 0 | GENERIC |
| 610 | Yogur natural entero | Grs | 62 | 3.5 | 4.7 | 3.3 | GENERIC |
| 611 | Yogur entero saborizado | Grs | 87 | 3.5 | 11 | 3.3 | GENERIC |
| 612 | Yogur descremado natural | Grs | 36 | 2.9 | 6 | 0 | GENERIC |
| 613 | Yogur descremado bebible | Ml | 36 | 2.9 | 6 | 0 | GENERIC |
| 614 | Yogur entero bebible saborizado | Ml | 76 | 2.9 | 12 | 1.8 | GENERIC |
| 615 | Atún al natural enlatado, escurrido | Grs | 86 | 19.4 | 0 | 1 | GENERIC |
| 616 | Atún en aceite enlatado, escurrido | Grs | 190 | 29.1 | 0 | 8.2 | GENERIC |
| 617 | Salmón rosado crudo | Grs | 122 | 20.5 | 0 | 4.4 | GENERIC |
| 618 | Caballa enlatada | Grs | 149 | 23.2 | 0 | 6.3 | GENERIC |
| 619 | Trucha cruda | Grs | 113 | 20.5 | 0 | 3.5 | GENERIC |
| 620 | Carne vacuna magra promedio, cruda | Grs | 138 | 22.2 | 0 | 5.5 | GENERIC |
| 621 | Huevo entero de gallina, crudo | Grs | 156 | 12 | 0.4 | 11.8 | GENERIC |
| 622 | Coca-Cola Sin Azúcar | Ml | 0 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 623 | Sprite Sin Azúcar | Ml | 0 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 624 | Fanta Naranja | Ml | 49.5 | 0 | 12.5 | 0 | EXPLICIT_ONLY |
| 625 | Fanta Naranja Sin Azúcar | Ml | 0 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 626 | Fanta Pomelo | Ml | 41 | 0 | 10 | 0 | EXPLICIT_ONLY |
| 627 | Gaseosa con azúcar, promedio | Ml | 40 | 0 | 10 | 0 | EXPLICIT_ONLY |
| 628 | Gaseosa sin azúcar, promedio | Ml | 0 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 629 | Bebida energizante | Ml | 45 | 0 | 11.2 | 0 | EXPLICIT_ONLY |
| 630 | Bebida deportiva isotónica | Ml | 26 | 0 | 6.5 | 0 | EXPLICIT_ONLY |
| 631 | Bebida deportiva isotónica sin azúcar | Ml | 0 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 632 | Agua saborizada con azúcar | Ml | 21 | 0 | 5.3 | 0 | EXPLICIT_ONLY |
| 633 | Agua saborizada light | Ml | 1 | 0 | 0.3 | 0 | EXPLICIT_ONLY |
| 634 | Agua mineral | Ml | 0 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 635 | Agua con gas | Ml | 0 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 636 | Cerveza light | Ml | 29 | 0.24 | 1.64 | 0 | EXPLICIT_ONLY |
| 637 | Cerveza sin alcohol | Ml | 25 | 0.4 | 5.4 | 0 | EXPLICIT_ONLY |
| 638 | Cerveza de alta graduación | Ml | 58 | 0.9 | 0.27 | 0 | EXPLICIT_ONLY |
| 639 | Heineken Original | Ml | 42 | 0 | 3.2 | 0 | EXPLICIT_ONLY |
| 640 | Vino blanco | Ml | 83 | 0.1 | 2.6 | 0 | EXPLICIT_ONLY |
| 641 | Vino rosado | Ml | 83 | 0.36 | 3.8 | 0 | EXPLICIT_ONLY |
| 642 | Champagne / vino espumante seco | Ml | 83 | 0.1 | 2.6 | 0 | EXPLICIT_ONLY |
| 643 | Vino espumante dulce tipo Frizze | Ml | 66 | 0 | 5 | 0 | EXPLICIT_ONLY |
| 644 | Fernet | Ml | 280 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 645 | Fernet con Coca-Cola (70/30) | Ml | 105 | 0 | 5.25 | 0 | EXPLICIT_ONLY |
| 646 | Fernet con Coca-Cola Sin Azúcar (70/30) | Ml | 84 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 647 | Vodka | Ml | 298 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 648 | Gin | Ml | 231 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 649 | Ron | Ml | 231 | 0 | 0 | 0 | EXPLICIT_ONLY |
| 650 | Whisky | Ml | 250 | 0 | 0.1 | 0 | EXPLICIT_ONLY |
| 651 | Aperitivo tipo Gancia | Ml | 163 | 0.2 | 13.7 | 0 | EXPLICIT_ONLY |
| 652 | Sidra | Ml | 43 | 0 | 4.3 | 0 | EXPLICIT_ONLY |

## Advertencias

- Ninguna.
