import assert from "node:assert/strict";
import test from "node:test";

import { buildContextualMenuDraft } from "./contextualMenuDraft.js";

const SOURCE = {
  id: "admin-1",
  nombre: "Equilibrado",
  comidas: [{ nombre: "Almuerzo", tipoComida: "almuerzo", items: [{ id: "food-1", nombre: "Pollo", cantidad: 200 }] }],
};
const TARGET = { kcal: 2636, proteina: 165, carbs: 296, grasas: 88 };

test("crea un borrador independiente sin modificar el menu maestro", () => {
  const before = structuredClone(SOURCE);
  const draft = buildContextualMenuDraft(SOURCE, TARGET, "2026-08-01");
  draft.comidas[0].items[0].cantidad = 350;
  assert.deepEqual(SOURCE, before);
  assert.equal(draft.fechaInicio, "2026-08-01");
  assert.deepEqual(draft.selectedDays, ["saturday"]);
  assert.equal(draft.objectiveMode, "current");
});

test("ajustar usa exactamente la meta contextual y conserva todas las comidas", () => {
  const source = { ...SOURCE, comidas: [...SOURCE.comidas, { nombre: "Cena", items: [{ cantidad: 100 }] }] };
  const draft = buildContextualMenuDraft(source, TARGET, "2026-08-04", { adjustToTarget: true });
  assert.equal(draft.objectiveMode, "custom");
  assert.deepEqual(draft.menuTarget, TARGET);
  assert.equal(draft.comidas.length, 2);
  assert.deepEqual(draft.selectedDays, ["tuesday"]);
});
