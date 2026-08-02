import assert from "node:assert/strict";
import test from "node:test";

import { filterContextualMenusForDisplay, reconstructMenuForDisplay } from "./contextualMenuDisplayGuard.js";

const TARGET = { kcal: 2636, proteina: 165, carbs: 296, grasas: 88 };
function menu(id, totals, overrides = {}) {
  return {
    id,
    comidas: [{ items: [{ cantidad: 100, ...totals }] }],
    ...overrides,
  };
}

test("el guard visual excluye respuestas legacy de 0 y 8224 kcal", () => {
  const valid = menu("valid", { kcal: 2610, proteina: 162, carbs: 301, grasas: 87 });
  const zero = menu("zero", { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  const far = menu("far", { kcal: 8224, proteina: 401, carbs: 1549, grasas: 100 });
  assert.deepEqual(filterContextualMenusForDisplay([zero, far, valid], TARGET).map((item) => item.id), ["valid"]);
});

test("rechaza menus vacios, cantidades invalidas y elegibilidad negada por servidor", () => {
  const valid = menu("valid", { kcal: 2610, proteina: 162, carbs: 301, grasas: 87 });
  assert.equal(reconstructMenuForDisplay({ comidas: [] }), null);
  assert.equal(reconstructMenuForDisplay(menu("invalid-qty", { kcal: 100, proteina: 1, carbs: 1, grasas: 1 }, { comidas: [{ items: [{ cantidad: 0, kcal: 100, proteina: 1, carbs: 1, grasas: 1 }] }] })), null);
  assert.deepEqual(filterContextualMenusForDisplay([{ ...valid, contextualEligibility: { eligible: false } }], TARGET), []);
});

test("si hay tres coincidencias altas no mezcla el segundo nivel", () => {
  const high = [
    menu("a", { kcal: 2610, proteina: 162, carbs: 301, grasas: 87 }),
    menu("b", { kcal: 2700, proteina: 170, carbs: 290, grasas: 90 }),
    menu("c", { kcal: 2500, proteina: 150, carbs: 280, grasas: 82 }),
  ];
  const acceptable = menu("acceptable", { kcal: 3000, proteina: 190, carbs: 330, grasas: 95 });
  assert.deepEqual(filterContextualMenusForDisplay([...high, acceptable], TARGET).map((item) => item.id), ["a", "b", "c"]);
});
