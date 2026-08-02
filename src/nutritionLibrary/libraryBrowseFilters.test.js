import assert from "node:assert/strict";
import test from "node:test";

import {
  applyLibraryFacetFilters,
  nutritionFacetBucket,
} from "./libraryBrowseFilters.js";

test("crea filtros de menú únicos redondeando kcal a 100 y proteína a 10", () => {
  const source = [
    { id: "2560", kind: "menu", totales: { kcal: 2560, proteina: 154 } },
    { id: "1920", kind: "menu", totales: { kcal: 1920, proteina: 118 } },
  ];
  const result = applyLibraryFacetFilters(source, {}, { kind: "menu" });
  assert.deepEqual(result.facets.calories, [{ value: 1900, count: 1 }, { value: 2600, count: 1 }]);
  assert.deepEqual(result.facets.proteins, [{ value: 120, count: 1 }, { value: 150, count: 1 }]);
  assert.deepEqual(applyLibraryFacetFilters(source, { calorieBucket: 2600 }, { kind: "menu" }).items.map((item) => item.id), ["2560"]);
});

test("las comidas usan rangos de 50 kcal, 5 g de proteína y sólo tipos existentes", () => {
  const source = [
    { id: "500", kind: "comida", tipoComida: "almuerzo", totales: { kcal: 500, proteina: 31 } },
    { id: "360", kind: "comida", tipoComida: "snack", totales: { kcal: 360, proteina: 17 } },
  ];
  assert.equal(nutritionFacetBucket(360, { kind: "meal", field: "kcal" }), 350);
  const result = applyLibraryFacetFilters(source, { type: "snack" }, { kind: "meal" });
  assert.deepEqual(result.facets.types, [{ value: "almuerzo", count: 1 }, { value: "snack", count: 1 }]);
  assert.deepEqual(result.facets.calories, [{ value: 350, count: 1 }]);
  assert.deepEqual(result.items.map((item) => item.id), ["360"]);
});
