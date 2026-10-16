import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGeneratedMenuActivationPayload,
  generatedMenuReviewPresentation,
  generatedMenuTotals,
  replaceGeneratedPreviewMeal,
} from "./clientMenuPreview.js";

test("recalcula los totales reales de los alimentos de la preview", () => {
  const totals = generatedMenuTotals({
    comidas: [
      { items: [{ kcal: 200, proteina: 10, carbs: 30, grasas: 4 }] },
      { items: [{ kcal: 350, protein: 25, carbs: 45, fat: 8 }] },
    ],
  });
  assert.deepEqual(totals, { kcal: 550, proteina: 35, carbs: 75, grasas: 12 });
});

test("la preview mixta suma las metas reservadas sin convertirlas en alimentos", () => {
  const totals = generatedMenuTotals({
    comidas: [{ items: [{ kcal: 1500, proteina: 110, carbs: 160, grasas: 47 }] }],
    generationMeta: {
      reservedMealTargets: [{ id: "menu_target_lunch", target: { kcal: 500 } }],
      resultTotals: { kcal: 2000, proteina: 150, carbs: 210, grasas: 62 },
    },
  });

  assert.deepEqual(totals, { kcal: 2000, proteina: 150, carbs: 210, grasas: 62 });
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
  assert.equal(payload.source, "autonomous");
  assert.equal(payload.estrategiaObjetivo, "custom");
  assert.equal(payload.kcalObjetivo, 2000);
  assert.deepEqual(payload.macrosObjetivo, { proteina: 150, carbs: 220, grasas: 60 });
  assert.equal(Object.hasOwn(payload, "menuTarget"), false);
  assert.equal(Object.hasOwn(payload, "objectiveMode"), false);
  assert.equal(Object.hasOwn(payload, "foodLogs"), false);
});

test("review RECOMMENDED queda verde por contrato aunque los numeros sean extremos", () => {
  const presentation = generatedMenuReviewPresentation({
    comidas: [{
      classification: "RECOMMENDED",
      usable: true,
      nutrition: {
        status: "RECOMMENDED",
        recommended: true,
        usable: true,
        totals: { kcal: 1, proteina: 999, carbs: 0, grasas: 0 },
      },
    }],
  });

  assert.equal(presentation.classification, "RECOMMENDED");
  assert.equal(presentation.tone, "success");
  assert.equal(presentation.label, "Recomendado");
  assert.equal(presentation.usable, true);
});

test("review BEST_EFFORT es amber, usable y muestra una sola copia del warning central", () => {
  const warning = {
    code: "MEAL_NUTRITION_BEST_EFFORT",
    message: "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.",
  };
  const presentation = generatedMenuReviewPresentation({
    comidas: [
      { id: "preserved", items: [{ id: "existing" }] },
      {
        classification: "BEST_EFFORT",
        usable: true,
        nutrition: {
          status: "BEST_EFFORT",
          recommended: false,
          usable: true,
          warning,
          totals: { kcal: 772, proteina: 86.2, carbs: 76.5, grasas: 13.5 },
        },
      },
    ],
    warnings: [
      warning,
      { ...warning },
      { ...warning, message: "El mismo diagnÃ³stico con otra redacciÃ³n." },
    ],
    generationMeta: {
      trace: [
        { slotIndex: 0, status: "preserved" },
        { slotIndex: 1, status: "generated", solver: { classification: "BEST_EFFORT" } },
      ],
    },
  });

  assert.equal(presentation.classification, "BEST_EFFORT");
  assert.equal(presentation.tone, "warning");
  assert.equal(presentation.label, "Mejor opción disponible");
  assert.equal(presentation.usable, true);
  assert.equal(presentation.warnings.length, 1);
  assert.equal(presentation.warnings[0].code, "MEAL_NUTRITION_BEST_EFFORT");
});

test("warnings con el mismo codigo conservan el origen de cada comida", () => {
  const warning = (mealType, message) => ({
    code: "MEAL_NUTRITION_BEST_EFFORT",
    mealType,
    message,
  });
  const preview = {
    comidas: [
      {
        tipoComida: "desayuno",
        classification: "BEST_EFFORT",
        usable: true,
        nutrition: {
          status: "BEST_EFFORT",
          recommended: false,
          usable: true,
          warning: warning("desayuno", "Desvio del desayuno."),
        },
      },
      {
        tipoComida: "cena",
        classification: "BEST_EFFORT",
        usable: true,
        nutrition: {
          status: "BEST_EFFORT",
          recommended: false,
          usable: true,
          warning: warning("cena", "Desvio de la cena."),
        },
      },
    ],
    warnings: [
      warning("desayuno", "Desvio del desayuno."),
      warning("cena", "Desvio de la cena."),
    ],
  };

  const presentation = generatedMenuReviewPresentation(preview);
  assert.deepEqual(
    presentation.warnings.map((entry) => [entry.mealType, entry.message]),
    [
      ["desayuno", "Desvio del desayuno."],
      ["cena", "Desvio de la cena."],
    ],
  );
});

test("review NO_SOLUTION queda bloqueada y no puede construir el payload de activacion", () => {
  const preview = {
    comidas: [{
      classification: "NO_SOLUTION",
      recommended: false,
      usable: false,
      nutrition: { status: "NO_SOLUTION", recommended: false, usable: false },
    }],
  };
  const presentation = generatedMenuReviewPresentation(preview);

  assert.equal(presentation.classification, "NO_SOLUTION");
  assert.equal(presentation.tone, "danger");
  assert.equal(presentation.usable, false);
  assert.throws(
    () => buildGeneratedMenuActivationPayload(preview, { kcal: 2000 }),
    (error) => error?.code === "MENU_PREVIEW_NO_SOLUTION"
  );
});

test("preview legacy sin assessment queda neutral y conserva el CTA habilitado", () => {
  const presentation = generatedMenuReviewPresentation({
    comidas: [{ items: [{ alimentoId: "rice", cantidad: 100 }] }],
  });
  assert.equal(presentation.classification, "UNKNOWN");
  assert.equal(presentation.tone, "neutral");
  assert.equal(presentation.usable, true);
});
