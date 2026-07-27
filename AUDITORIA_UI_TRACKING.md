# Auditoría explícita del rediseño de Tracking

Archivos auditados: `src/entrenado/TrackingDiario.jsx`, `src/entrenado/trackingDiario.css` y `src/tracking/ManualCompletionTracking.jsx`. También se revisó el soporte funcional en `src/tracking/trackingQuantityDrafts.js`.

## Resultado de los 30 controles

| # | Control | Resultado |
| ---: | --- | --- |
| 1 | Clases JSX existentes en CSS | PASS. Extracción AST de ambos JSX: ninguna clase estática sin selector; los estados dinámicos también tienen selector explícito. |
| 2 | Clases huérfanas/selectores viejos | PASS. No quedan clases `td-*`/`is-*` sin consumidor literal en `src`; se eliminaron los selectores del render anterior. La capa visual 2026 conserva overrides deliberados sobre la base funcional. |
| 3 | Imports nuevos | PASS por ESLint puntual. |
| 4 | Handlers/estados conectados | PASS. Los estados de búsqueda, selector, settings, metas, borradores, planner, guardado y toast tienen lectura/render o efecto. |
| 5 | Registrado/Fijo/Auto/Calculado | CORREGIDO. Los rótulos principales y del planner usan exactamente esos cuatro términos y conservan estilos diferenciados. |
| 6 | Borradores dentro de la comida | PASS. Se renderizan en la misma `td-foodList` que los alimentos registrados. |
| 7 | Proyectado/por confirmar una vez | PASS. `trackingDateDraftTotals` se calcula una vez por fecha y se deriva un único `projectedTotals`; se muestra en una sola tarjeta superior según el modo. |
| 8 | Total real antes de confirmar | PASS. `totals` excluye borradores; sólo `projectedTotals` los suma. |
| 9 | Limpieza al confirmar | PASS. Se elimina únicamente la key fecha+comida después del batch exitoso; ante error se conserva. |
| 10 | Refetch sin duplicar | PASS. La respuesta reemplaza el día en caché y la escritura batch usa `requestId` idempotente. |
| 11 | Fecha/comida aisladas | PASS y test. La key es `fecha:mealId`; cambiar fecha cierra diálogos pero conserva los borradores de cada fecha. |
| 12 | Cerrar modal conserva | PASS. Cerrar picker/planner no borra los borradores de la comida. |
| 13 | Cancelar descarta sólo temporal correspondiente | CORREGIDO. Descartar, vaciar o eliminar limpia únicamente la key de esa fecha/comida; borrar una comida ya no deja un borrador invisible en el proyectado. |
| 14 | Error no deja loading | PASS. `calculate` y confirmación restablecen loading en `finally`. |
| 15 | Recalcular reemplaza propuesta | CORREGIDO. Se vacía la propuesta anterior al iniciar y el éxito reemplaza el array completo; un error no permite aplicar datos obsoletos. |
| 16 | Selector vuelve a comida correcta | PASS. “Agregar otro alimento” captura el `mealId` antes de cerrar el planner y abre ese selector. |
| 17 | Foco y Escape | PASS. Todos los diálogos tienen foco inicial, trampa de Tab, Escape condicionado por loading y restauración al opener. |
| 18 | Nombre accesible de botones | PASS. Botones sólo icono tienen `aria-label`; el resto tiene texto visible. |
| 19 | Labels de inputs | PASS. Inputs están dentro de `label` visible o tienen `aria-label`. |
| 20 | Teclado móvil | PASS estático. Modales usan `dvh`, overflow interno, safe-area y `scroll-padding-bottom`. |
| 21 | Overflow horizontal | CORREGIDO. Contenedores usan `min-width: 0`/máximo 100%; controles de borrador hacen wrap a 430 px. |
| 22 | Disabled/loading | PASS. Botones relevantes tienen `disabled`, opacidad/cursor y spinners o texto de estado. |
| 23 | 0, 1 y 6 alimentos | PASS estructural. Hay estado vacío y listas/grillas sin límite visual dependiente del conteo; 1–6 también se cubre funcionalmente en la matriz del motor. |
| 24 | Warnings largos | PASS. Mensajes y alertas usan `overflow-wrap: anywhere` y `word-break`. |
| 25 | Kcal/gramos/unidades | PASS. Valores/unidades no se truncan; los contenedores pueden envolver sin overflow de página. |
| 26 | Acciones de 44 px mobile | PASS. Acciones, modal y controles de borrador declaran mínimo 44 px hasta 720 px. |
| 27 | `color-mix` | PASS. Cada uso tiene declaración `rgba` anterior como fallback. |
| 28 | Especificidad/duplicados | CORREGIDO. Se fusionó la regla adyacente duplicada de hint y se eliminaron todos los `!important`; los overrides restantes son la capa visual deliberada y los breakpoints. |
| 29 | Temas/layout global | PASS estático. Selectores scopeados con prefijo `td-`/`.td-page`; no se tocaron contenedores globales. |
| 30 | Build/lint | PASS para build y ESLint de todos los archivos modificados. El lint global conserva tres errores ajenos preexistentes en `AdminNavBar.jsx` y `src/MobileMenu.jsx`. |

## Bugs corregidos durante la auditoría

1. El frontend todavía podía emparejar por nombre dos respuestas con IDs distintos. Ahora usa nombre sólo cuando no hay identidad utilizable y existe un test con dos homónimos simultáneos de distinta unidad.
2. Borrar, vaciar o reducir la configuración de una comida podía dejar borradores invisibles sumándose al total proyectado. Ahora se bloquea o limpia sólo el borrador de esa comida.
3. Un recálculo fallido conservaba visualmente la propuesta previa. Ahora la propuesta anterior se retira al iniciar el nuevo cálculo.
4. Los estados usaban variantes textuales (`Manual · Fijo`, `A calcular`, `Auto · Recalcular`). Se normalizaron sin cambiar el diseño.
5. En pantallas muy angostas, badge + cantidad + modo + eliminar podían exceder el ancho. Los controles ahora envuelven y mantienen objetivos táctiles de 44 px.

No se realizó una sesión visual manual en navegador/dispositivo real; esa es la siguiente validación recomendada, no una deuda de implementación automatizada.
