import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./AdminAlimentos.jsx", import.meta.url), "utf8");
const api = readFileSync(new URL("./adminFoodsApi.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../nutricion/nutricion.css", import.meta.url), "utf8");

test("Column picker abre y puede cerrarse por boton, click exterior o Escape", () => {
  assert.match(component, /setColumnPickerOpen\(\(value\) => !value\)/);
  assert.match(component, /event\.key === "Escape"/);
  assert.match(component, /onClose=\{\(\) => setColumnPickerOpen\(false\)\}/);
});

test("Restablecer columnas recupera exactamente el layout inicial", () => {
  assert.match(component, /Restablecer columnas/);
  assert.match(component, /onChange\(\[\.\.\.DEFAULT_ADMIN_FOOD_COLUMNS\]\)/);
});

test("los controles inline solo cambian draft y el PATCH vive dentro de Guardar", () => {
  assert.match(component, /const setValue = \(path, value\) => \{ setDraft/);
  assert.match(component, /const save = async \(\) =>/);
  assert.match(component, /await mutation\.mutateAsync\(\{ foodId, generation: validation\.generation \}\)/);
  assert.doesNotMatch(component, /onChange=\{[^}]*mutateAsync/);
});

test("Generador presenta los cinco momentos juntos y cada toggle edita mealTypes", () => {
  assert.match(component, /className="nf-inlineMealTypes"/);
  assert.match(component, /GENERATION_MEAL_TYPES\.map\(\(\[key, label\]\)/);
  assert.match(component, /setValue\(\["mealTypes", key\], event\.target\.checked\)/);
  assert.match(component, /role="group" aria-label=\{`Momentos permitidos para/);
  assert.match(css, /\.nf-inlineMealTypes\s*\{[^}]*grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/s);
});

test("el PATCH existente conserva ruta y contrato Admin generation", () => {
  assert.match(api, /\/api\/admin\/alimentos\/\$\{encodeURIComponent\(foodId\)\}\/generation/);
  assert.match(api, /method: "PATCH"/);
  assert.match(api, /body: \{ generation \}/);
});

test("fallar al guardar muestra error sin borrar el draft", () => {
  const catchBlock = component.match(/catch \(saveError\) \{([^}]+)\}/)?.[1] || "";
  assert.match(catchBlock, /setError/);
  assert.doesNotMatch(catchBlock, /setDraft|setBaseDraft/);
});

test("Alimento y Guardar son sticky en extremos opuestos", () => {
  assert.match(component, /column === "food" \? "sticky-left"/);
  assert.match(component, /column === "save" \? "sticky-right"/);
  assert.match(css, /\.nf-adminFoodTable \.sticky-left\s*\{[^}]*left:0/s);
  assert.match(css, /\.nf-adminFoodTable \.sticky-right\s*\{[^}]*right:0/s);
});

test("drawer y cards mobile permanecen, mientras la tabla avanzada se oculta en mobile", () => {
  assert.match(component, /<AdminFoodEditor/);
  assert.match(component, /nf-cardGrid nf-mobileCards/);
  assert.match(component, /nf-table nf-foodDesktop nf-adminFoodTable/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.nf-foodDesktop\s*\{[^}]*display:none/s);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*\.nf-mobileCards\s*\{[^}]*display:grid/s);
});
