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
