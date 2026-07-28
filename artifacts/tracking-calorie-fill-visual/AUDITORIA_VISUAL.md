# Auditoría visual Tracking — Completar calorías

Comparación reproducible del CSS en `HEAD` (antes) contra el working tree (después), usando la misma fixture de comida y calculadora. No es una captura autenticada de datos reales; sirve para medir layout, densidad, overflow y acciones en los viewports pedidos.

| Vista | Viewport | Antes: fila prom./máx. | Después: fila prom./máx. | Filas visibles después | Overflow después | Botón mínimo después | Scroll interno modal |
|---|---|---:|---:|---:|:---:|---:|:---:|
| Comida | 360×800 | 154.3 / 160 px | 115 / 120.9 px | 6 | no | 44 px | no |
| Calculadora | 360×800 | 154.3 / 160 px | 115 / 120.9 px | — | no | 44 px | sí |
| Comida | 390×844 | 154.3 / 160 px | 115 / 120.9 px | 6 | no | 44 px | no |
| Calculadora | 390×844 | 154.3 / 160 px | 115 / 120.9 px | — | no | 44 px | sí |
| Comida | 430×932 | 154.3 / 160 px | 115 / 120.9 px | 6 | no | 44 px | no |
| Calculadora | 430×932 | 154.3 / 160 px | 115 / 120.9 px | — | no | 44 px | sí |
| Comida | 768×1024 | 84.8 / 85 px | 85.3 / 87.9 px | 6 | no | 42 px | no |
| Calculadora | 768×1024 | 84.8 / 85 px | 85.3 / 87.9 px | — | no | 42 px | sí |
| Comida | 1440×900 | 89.5 / 99 px | 100.3 / 121.7 px | 6 | no | 42 px | no |
| Calculadora | 1440×900 | 89.5 / 99 px | 100.3 / 121.7 px | — | no | 42 px | sí |

## Capturas

### 360×800

- Comida: [antes](./before-meal-mobile-360x800.png) · [después](./after-meal-mobile-360x800.png)
- Calculadora: [antes](./before-modal-mobile-360x800.png) · [después](./after-modal-mobile-360x800.png)

### 390×844

- Comida: [antes](./before-meal-mobile-390x844.png) · [después](./after-meal-mobile-390x844.png)
- Calculadora: [antes](./before-modal-mobile-390x844.png) · [después](./after-modal-mobile-390x844.png)

### 430×932

- Comida: [antes](./before-meal-mobile-430x932.png) · [después](./after-meal-mobile-430x932.png)
- Calculadora: [antes](./before-modal-mobile-430x932.png) · [después](./after-modal-mobile-430x932.png)

### 768×1024

- Comida: [antes](./before-meal-tablet-768x1024.png) · [después](./after-meal-tablet-768x1024.png)
- Calculadora: [antes](./before-modal-tablet-768x1024.png) · [después](./after-modal-tablet-768x1024.png)

### 1440×900

- Comida: [antes](./before-meal-desktop-1440x900.png) · [después](./after-meal-desktop-1440x900.png)
- Calculadora: [antes](./before-modal-desktop-1440x900.png) · [después](./after-modal-desktop-1440x900.png)

## Alcance

La fixture incluye seis alimentos, nombres y warnings extensos, kcal/P/C/G, Auto/Fijo/Calculado/Registrado y acciones del modal. La interacción real con teclado móvil, teclado virtual y una sesión autenticada continúa siendo una prueba manual pendiente; el footer sticky, scroll interno y ausencia de overflow se verifican geométricamente aquí.

