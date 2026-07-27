import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTrackingDraftProposals,
  createTrackingFoodDraft,
  hasTrackingDraftQuantity,
  isTrackingDraftAutomatic,
  isTrackingDraftCalculated,
  markTrackingDraftAutomatic,
  markTrackingDraftManual,
  trackingDraftCalculationPayload,
  trackingDateDrafts,
  trackingDateDraftTotals,
  trackingDraftKey,
  trackingDraftsNutritionTotals,
  trackingDraftProposals,
  trackingDraftsReadyToConfirm,
  updateTrackingFoodDraftQuantity,
} from "./trackingQuantityDrafts.js";

const rice = { id: "rice", nombre: "Arroz", unidad: "g", kcal: 340, proteina: 7, carbs: 76, grasas: 1 };
const chicken = { id: "chicken", nombre: "Pollo", unidad: "g", kcal: 165, proteina: 31, carbs: 0, grasas: 3.6 };
const banana = { id: "banana", nombre: "Banana", unidad: "g", kcal: 89, proteina: 1.1, carbs: 23, grasas: 0.3 };

test("separa cantidades fijas y alimentos pendientes para el motor existente", () => {
  const drafts = [
    createTrackingFoodDraft(rice, 100, "draft-rice"),
    createTrackingFoodDraft(chicken, "", "draft-chicken"),
    createTrackingFoodDraft(banana, "", "draft-banana"),
  ];
  const payload = trackingDraftCalculationPayload(drafts);

  assert.equal(payload.fixedFoods.length, 1);
  assert.equal(payload.fixedFoods[0].foodId, "rice");
  assert.equal(payload.fixedFoods[0].quantity, 100);
  assert.equal(payload.fixedFoods[0].kcal, 340);
  assert.deepEqual(payload.pendingFoods.map((food) => food.foodId), ["chicken", "banana"]);
  assert.equal(payload.fixedTotals.kcal, 340);
});

test("un alimento pendiente no tiene nutricion ni queda listo para confirmar", () => {
  const pending = createTrackingFoodDraft(chicken, "", "draft-chicken");
  assert.equal(hasTrackingDraftQuantity(pending), false);
  assert.equal(isTrackingDraftAutomatic(pending), true);
  assert.equal(trackingDraftsReadyToConfirm([pending]), false);

  const manual = updateTrackingFoodDraftQuantity(pending, 150);
  assert.equal(manual.status, "manual");
  assert.equal(isTrackingDraftAutomatic(manual), false);
  assert.equal(hasTrackingDraftQuantity(manual), true);
  assert.equal(trackingDraftsReadyToConfirm([manual]), true);
});

test("permite alternar una cantidad existente entre fija y automatica", () => {
  const manual = createTrackingFoodDraft(rice, 100, "draft-rice");
  const automatic = markTrackingDraftAutomatic(manual);
  const payload = trackingDraftCalculationPayload([automatic]);

  assert.equal(isTrackingDraftAutomatic(automatic), true);
  assert.equal(payload.fixedFoods.length, 0);
  assert.equal(payload.pendingFoods.length, 1);
  assert.equal(payload.pendingFoods[0].currentQuantity, 100);
  assert.equal(trackingDraftsNutritionTotals([automatic]).kcal, 0);
  assert.equal(trackingDraftsReadyToConfirm([automatic]), false);
  assert.equal(markTrackingDraftManual(automatic).mode, "manual");
});

test("combina la cantidad fija con las propuestas calculadas sin duplicarla", () => {
  const drafts = [
    createTrackingFoodDraft(rice, 100, "draft-rice"),
    createTrackingFoodDraft(chicken, "", "draft-chicken"),
    createTrackingFoodDraft(banana, "", "draft-banana"),
  ];
  const proposals = trackingDraftProposals(drafts, [
    { foodId: "chicken", nombre: "Pollo", quantity: 80, unit: "g", kcal: 132 },
    { foodId: "banana", nombre: "Banana", quantity: 45, unit: "g", kcal: 40 },
  ]);

  assert.equal(proposals.length, 3);
  assert.equal(proposals.filter((proposal) => proposal.food.id === "rice").length, 1);
  assert.equal(proposals.find((proposal) => proposal.food.id === "rice").quantity, 100);
  assert.equal(proposals.find((proposal) => proposal.food.id === "chicken").quantity, 80);
  assert.equal(proposals.find((proposal) => proposal.food.id === "banana").quantity, 45);
});

test("aplica la propuesta al borrador sin registrar ni modificar cantidades fijas", () => {
  const drafts = [
    createTrackingFoodDraft(rice, 100, "draft-rice"),
    createTrackingFoodDraft(chicken, "", "draft-chicken"),
  ];
  const proposals = trackingDraftProposals(drafts, [
    { foodId: "chicken", nombre: "Pollo", quantity: 80, unit: "g", kcal: 132 },
  ]);
  const applied = applyTrackingDraftProposals(drafts, proposals);

  assert.equal(applied[0], drafts[0]);
  assert.equal(applied[0].quantity, 100);
  assert.equal(applied[0].status, "manual");
  assert.equal(applied[1].quantity, 80);
  assert.equal(applied[1].status, "calculated");
  assert.equal(isTrackingDraftAutomatic(applied[1]), true);
  assert.equal(isTrackingDraftCalculated(applied[1]), true);
  assert.equal(trackingDraftsReadyToConfirm(applied), true);
  assert.equal(trackingDraftsNutritionTotals(applied).kcal, 472);
  const finalProposals = trackingDraftProposals(applied, []);
  assert.equal(finalProposals.length, 2);
  assert.equal(finalProposals.find((proposal) => proposal.food.id === "chicken").quantity, 80);
  assert.equal(finalProposals.find((proposal) => proposal.food.id === "chicken").fixed, false);
});

test("conserva la unidad original del alimento al preparar el snapshot final", () => {
  const egg = { id: "egg", nombre: "Huevo", unidad: "unidad", kcal: 78, proteina: 6, carbs: 0.6, grasas: 5 };
  const proposals = trackingDraftProposals(
    [createTrackingFoodDraft(egg, "", "draft-egg")],
    [{ foodId: "egg", nombre: "Huevo", quantity: 2, unit: "g", kcal: 156 }]
  );

  assert.equal(proposals.length, 1);
  assert.equal(proposals[0].quantity, 2);
  assert.equal(proposals[0].unit, "unidad");
});

test("dos homónimos simultáneos se emparejan por ID y nunca por conveniencia de nombre", () => {
  const byUnit = { id: "same-unit", nombre: "Tostadita igual", unidad: "Unid", kcal: 10 };
  const byGrams = { id: "same-grams", nombre: "Tostadita igual", unidad: "Grs", kcal: 2 };
  const drafts = [
    createTrackingFoodDraft(byUnit, "", "draft-unit"),
    createTrackingFoodDraft(byGrams, "", "draft-grams"),
  ];
  const proposals = trackingDraftProposals(drafts, [
    { foodId: "same-grams", nombre: "Tostadita igual", quantity: 20, unit: "Grs" },
    { foodId: "same-unit", nombre: "Tostadita igual", quantity: 2, unit: "Unid" },
  ]);

  assert.equal(proposals.length, 2);
  assert.equal(proposals[0].food.id, "same-unit");
  assert.equal(proposals[0].quantity, 2);
  assert.equal(proposals[0].unit, "Unid");
  assert.equal(proposals[1].food.id, "same-grams");
  assert.equal(proposals[1].quantity, 20);
  assert.equal(proposals[1].unit, "Grs");

  const mismatched = trackingDraftProposals(
    [createTrackingFoodDraft(byUnit, "", "draft-mismatch")],
    [{ foodId: "different-id", nombre: "Tostadita igual", quantity: 99, unit: "Unid" }]
  );
  assert.deepEqual(mismatched, []);
});

test("conserva la precisión real de macros por unidad en el payload de cálculo", () => {
  const almonds = {
    id: "almonds",
    nombre: "Almendras",
    unidad: "Unid",
    macroBasis: "perUnit",
    kcal: 7.15,
    proteina: 0.26,
    carbs: 0.155,
    grasas: 0.61,
    porcionMin: 1,
    porcionMax: 3,
    multiplo: 1,
  };
  const payload = trackingDraftCalculationPayload([
    createTrackingFoodDraft(almonds, "", "draft-almonds"),
  ]);

  assert.deepEqual(payload.pendingFoods[0], {
    foodId: "almonds",
    name: "Almendras",
    unit: "Unid",
    source: "pending",
    currentQuantity: null,
    kcalPerUnitOrGram: 7.15,
    proteinPerUnitOrGram: 0.26,
    carbsPerUnitOrGram: 0.155,
    fatPerUnitOrGram: 0.61,
    categoria: "",
    minGramos: 1,
    maxGramos: 3,
    stepGramos: 1,
  });
});

test("aísla borradores por fecha y comida y calcula el proyectado una sola vez", () => {
  const firstDate = "2026-07-26";
  const secondDate = "2026-07-27";
  const breakfastRice = createTrackingFoodDraft(rice, 100, "rice-breakfast");
  const dinnerChicken = createTrackingFoodDraft(chicken, 100, "chicken-dinner");
  const tomorrowBanana = createTrackingFoodDraft(banana, 100, "banana-tomorrow");
  const draftsByMeal = {
    [trackingDraftKey(firstDate, "breakfast")]: [breakfastRice],
    [trackingDraftKey(firstDate, "dinner")]: [dinnerChicken],
    [trackingDraftKey(secondDate, "breakfast")]: [tomorrowBanana],
  };

  assert.deepEqual(trackingDateDrafts(draftsByMeal, firstDate), [breakfastRice, dinnerChicken]);
  assert.deepEqual(trackingDateDraftTotals(draftsByMeal, firstDate), {
    kcal: 505,
    proteina: 38,
    carbs: 76,
    grasas: 4.6,
  });
  assert.equal(trackingDateDraftTotals(draftsByMeal, secondDate).kcal, 89);
  assert.equal(trackingDateDraftTotals(draftsByMeal, "2026-07-28").kcal, 0);
});
