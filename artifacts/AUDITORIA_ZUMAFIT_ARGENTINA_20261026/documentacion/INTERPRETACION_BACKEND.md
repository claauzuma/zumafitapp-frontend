# Interpretación de cantidades y macros en el backend

## Contrato persistido

En `fooddatabase2`, los campos legacy `Calorias`, `Proteinas`, `Carbohidratos` y `Grasas` suelen representar el aporte por una unidad base: 1 g, 1 ml o 1 unidad discreta. Los campos `kcal100`, `proteina100`, `carbohidratos100` y `grasas100` son la vista normalizada por 100 g/ml cuando existen.

## Rutas relevantes

- `servicio/alimentos.js`: el optimizador normaliza unidades de masa como `perGram` y multiplica el vector por la cantidad.
- `servicio/foodLogs.js`: respeta `macroBasis`; con `per100` divide la cantidad de g/ml por 100, y con `perUnit` multiplica directamente.
- `servicio/comidasGuardadas.js`: tiene heurísticas legacy para distinguir vectores por gramo de valores por 100 g.
- `servicio/comidasGuardadasExcelImport.js`: escala por 100 cuando el alimento importado declara `per100` y usa g/ml.

La coexistencia de estos contratos explica por qué no debe asumirse que `macroBasis: perUnit` significa siempre “una fruta” o “una feta”: en documentos históricos también significa una unidad base de 1 gramo o 1 mililitro. Los CSV exportan ambos juegos de campos y explicitan la base calculada.

## Reproducción segura

El script `exportExternalNutritionAudit20261026.mjs` solo usa `find({}).sort(...).toArray()` sobre MongoDB. No contiene llamadas de escritura. La creación de CSV, JSON, Markdown y ZIP ocurre en el sistema de archivos local.
