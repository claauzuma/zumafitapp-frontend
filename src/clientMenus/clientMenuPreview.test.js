import assert from "node:assert/strict";
import test from "node:test";

import { buildGeneratedMenuActivationPayload, generatedMenuTotals, replaceGeneratedPreviewMeal } from "./clientMenuPreview.js";

test("recalcula los totales reales de los alimentos de la preview", () => {
  const totals = generatedMenuTotals({
    comidas: [
      { items: [{ kcal: 200, proteina: 10, carbs: 30, grasas: 4 }] },
      { items: [{ kcal: 350, protein: 25, carbs: 45, fat: 8 }] },
    ],
  });
  assert.deepEqual(totals, { kcal: 550, proteina: 35, carbs: 75, grasas: 12 });
});

test("regenerar una comida conserva intactas todas las demas", () => {
  const breakfast = { id: "breakfast", orden: 1, nombre: "Desayuno", items: [{ id: "oats" }] };
  const lunch = { id: "lunch", orden: 2, nombre: "Almuerzo", items: [{ id: "rice" }] };
  const dinner = { id: "dinner", orden: 3, nombre: "Cena", items: [{ id: "fish" }] };
  const preview = { nombre: "Dia", comidas: [breakfast, lunch, dinner] };
  const replacement = { id: "temporary", orden: 1, nombre: "Otra", items: [{ id: "chicken" }] };

  const next = replaceGeneratedPreviewMeal(preview, 1, replacement);

  assert.equal(next.comidas[0], breakfast);
  assert.equal(next.comidas[2], dinner);
  assert.deepEqual(next.comidas[1], {
    id: "lunch",
    orden: 2,
    nombre: "Almuerzo",
    items: [{ id: "chicken" }],
  });
  assert.deepEqual(preview.comidas[1], lunch);
});

test("usar el menu crea y activa el plan sin registrar consumo", () => {
  const payload = buildGeneratedMenuActivationPayload({
    nombre: "Menu automatico",
    objectiveMode: "custom",
    menuTarget: { kcal: 2000, proteina: 150, carbs: 220, grasas: 60 },
    selectedDays: ["thursday"],
    comidas: [{ nombre: "Almuerzo", items: [{ alimentoId: "rice", cantidad: 100, unidad: "g" }] }],
  });
  assert.equal(payload.activate, true);
  assert.equal(payload.estrategiaObjetivo, "custom");
  assert.equal(payload.kcalObjetivo, 2000);
  assert.deepEqual(payload.macrosObjetivo, { proteina: 150, carbs: 220, grasas: 60 });
  assert.equal(Object.hasOwn(payload, "menuTarget"), false);
  assert.equal(Object.hasOwn(payload, "objectiveMode"), false);
  assert.equal(Object.hasOwn(payload, "foodLogs"), false);
});
