import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEquivalentMealRecalculationRequest,
  buildCompletionTrackingBatch,
  equivalentMealComparison,
  equivalentMealDecisionWarning,
  equivalentMealDraftStorageKey,
  equivalentMealGenerationFeedback,
  equivalentMealRecalculationPreflight,
  equivalentLibrarySourceLabel,
  filterEquivalentLibraryMeals,
  generatedAlternativeToDrafts,
  nextGeneratedAlternativeIndex,
  resolveEquivalentMealAccess,
} from "./menuEquivalentMeal.js";
import { createTrackingFoodDraft } from "../../tracking/trackingQuantityDrafts.js";

test("completionMode persiste sólo los alimentos nuevos con el executionId existente", () => {
  const generated = [{ nombre: "Arroz", cantidad: 180, kcal: 230 }];
  const batch = buildCompletionTrackingBatch({
    date: "2026-08-20",
    trackingExecutionId: "menu_target_almuerzo",
    replacementMeal: {
      requestId: "completion-stable-request",
      mealType: "almuerzo",
      originalMealName: "Almuerzo",
      items: generated,
    },
  });
  assert.equal(batch.mealId, "menu_target_almuerzo");
  assert.equal(batch.requestId, "completion-stable-request");
  assert.deepEqual(batch.items, generated);
  assert.equal(batch.items.some((item) => item.nombre === "Pechuga ya registrada"), false);
});

test("los permisos del servidor prevalecen sobre el plan para equivalentes", () => {
  assert.deepEqual(resolveEquivalentMealAccess({
    permissions: {
      canUseMenuAlternatives: true,
      canCreateEquivalentMeals: false,
      canAutoCreateEquivalentMeals: true,
    },
    capabilities: { canUseEquivalences: true, canAutoCalculateTrackingQuantities: true },
  }), { canCreate: false, canAuto: false, canReplaceFoods: false, maxFoods: 0 });
});

test("Pro y VIP reciben limites explicitos sin cambiar la calidad del calculo", () => {
  const pro = resolveEquivalentMealAccess({
    permissions: { canCreateEquivalentMeals: true, canAutoCreateEquivalentMeals: true, equivalentMealFoodsLimit: 6 },
  });
  const vip = resolveEquivalentMealAccess({
    permissions: { canCreateEquivalentMeals: true, canAutoCreateEquivalentMeals: true, equivalentMealFoodsLimit: 10 },
  });
  assert.deepEqual(pro, { canCreate: true, canAuto: true, canReplaceFoods: true, maxFoods: 6 });
  assert.deepEqual(vip, { canCreate: true, canAuto: true, canReplaceFoods: true, maxFoods: 10 });
});

test("la comparacion legacy conserva diferencias para borradores sin evaluacion central", () => {
  const comparison = equivalentMealComparison(
    { kcal: 600, proteina: 40, carbs: 65, grasas: 20 },
    { kcal: 599, proteina: 38, carbs: 64, grasas: 21 }
  );
  assert.deepEqual(comparison.diff, { kcal: -1, proteina: -2, carbs: -1, grasas: 1 });
  assert.equal(comparison.caloriesClose, true);
  assert.equal(comparison.proteinReached, true);
});

test("el borrador queda aislado por fecha y comida", () => {
  assert.notEqual(
    equivalentMealDraftStorageKey("cliente-1", "2026-07-29", "almuerzo"),
    equivalentMealDraftStorageKey("cliente-1", "2026-07-30", "almuerzo")
  );
  assert.notEqual(
    equivalentMealDraftStorageKey("cliente-1", "2026-07-29", "almuerzo"),
    equivalentMealDraftStorageKey("cliente-1", "2026-07-29", "cena")
  );
  assert.notEqual(
    equivalentMealDraftStorageKey("cliente-1", "2026-07-29", "almuerzo"),
    equivalentMealDraftStorageKey("cliente-2", "2026-07-29", "almuerzo")
  );
  assert.equal(equivalentMealDraftStorageKey("", "2026-07-29", "almuerzo"), "");
});

test("los filtros de biblioteca exigen inclusiones y descartan exclusiones por alimento", () => {
  const meals = [
    { id: "own", items: [{ nombreSnapshot: "Pechuga de pollo" }, { nombre: "Arroz" }] },
    { id: "public", alimentos: [{ name: "Pasta" }, { nombre: "Queso" }] },
  ];
  assert.deepEqual(
    filterEquivalentLibraryMeals(meals, { include: "pollo, arroz" }).map((meal) => meal.id),
    ["own"]
  );
  assert.deepEqual(
    filterEquivalentLibraryMeals(meals, { exclude: "queso" }).map((meal) => meal.id),
    ["own"]
  );
});

test("la biblioteca explica el origen autorizado de cada comida", () => {
  assert.equal(equivalentLibrarySourceLabel({ ownerType: "cliente" }), "Mi comida");
  assert.equal(equivalentLibrarySourceLabel({ ownerType: "coach" }), "Biblioteca del coach");
  assert.equal(equivalentLibrarySourceLabel({ ownerType: "admin" }), "Biblioteca ZumaFit");
  assert.equal(equivalentLibrarySourceLabel({ assigned: true, ownerType: "coach" }), "Alternativa del coach");
});

test("la alternativa del backend se transforma en borrador y recorre opciones sin azar", () => {
  const alternative = {
    foods: [
      { foodId: "pollo", name: "Pollo", quantity: 180 },
      { foodId: "arroz", name: "Arroz", quantity: 120 },
    ],
  };
  const drafts = generatedAlternativeToDrafts(alternative, (food, index, optionIndex) => ({
    id: `${optionIndex}-${index}`,
    foodId: food.foodId,
    quantity: food.quantity,
  }), 6, 2);
  assert.deepEqual(drafts, [
    { id: "2-0", foodId: "pollo", quantity: 180 },
    { id: "2-1", foodId: "arroz", quantity: 120 },
  ]);
  assert.equal(nextGeneratedAlternativeIndex(-1, [1, 2, 3]), 0);
  assert.equal(nextGeneratedAlternativeIndex(0, [1, 2, 3]), 1);
  assert.equal(nextGeneratedAlternativeIndex(2, [1, 2, 3]), 0);
  assert.equal(nextGeneratedAlternativeIndex(0, []), -1);
});

test("los niveles de porcion producen avisos discretos y no-solution bloquea el borrador", () => {
  const strict = equivalentMealGenerationFeedback({
    status: "SUCCESS",
    recommended: true,
    relaxation: { level: "STRICT" },
    alternative: { foods: [{ foodId: "arroz" }] },
  });
  assert.equal(strict.usable, true);
  assert.equal(strict.notice, "");

  const step = equivalentMealGenerationFeedback({
    status: "SUCCESS",
    recommended: true,
    relaxation: { level: "RELAX_STEP" },
    alternative: { foods: [{ foodId: "arroz" }] },
  });
  assert.match(step.notice, /Porciones ajustadas ligeramente/);

  const min = equivalentMealGenerationFeedback({
    status: "SUCCESS",
    recommended: true,
    relaxation: { level: "RELAX_MIN" },
    alternative: { foods: [{ foodId: "arroz" }] },
  });
  assert.match(min.notice, /porciones mínimas fueron flexibilizadas/i);

  const none = equivalentMealGenerationFeedback({
    status: "NO_SOLUTION",
    code: "MEAL_TARGET_NOT_REACHABLE_WITH_PORTION_RULES",
    recommended: false,
    alternative: null,
  });
  assert.equal(none.usable, false);
  assert.match(none.error, /No se puede alcanzar esta meta/);

  const bestEffort = equivalentMealGenerationFeedback({
    status: "SUCCESS",
    alternative: {
      foods: [{ foodId: "arroz" }],
      nutrition: {
        status: "BEST_EFFORT",
        recommended: false,
        usable: true,
        warning: {
          code: "MEAL_NUTRITION_BEST_EFFORT",
          summary: "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.",
        },
      },
    },
  });
  assert.equal(bestEffort.usable, true);
  assert.equal(bestEffort.classification, "BEST_EFFORT");
  assert.equal(bestEffort.warning.summary, "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.");
});

test("recalcular envia una seleccion cerrada, cantidades actuales y candados sin candidatos", () => {
  const request = buildEquivalentMealRecalculationRequest({
    menuId: "menu-1",
    mealId: "meal-1",
    mealType: "almuerzo",
    target: { calories: 775, protein: 58, carbs: 99, fat: 16 },
    drafts: [
      { foodId: "pollo", quantity: 250 },
      { foodId: "arroz", quantity: 100 },
      { foodId: "banana", quantity: 180 },
    ],
    fixedFoods: [{ foodId: "pollo", quantity: 250 }],
    variantSeed: 7,
  });

  assert.deepEqual(request.selectedFoodIds, ["pollo", "arroz", "banana"]);
  assert.deepEqual(request.currentFoods, [
    { foodId: "pollo", quantity: 250 },
    { foodId: "arroz", quantity: 100 },
    { foodId: "banana", quantity: 180 },
  ]);
  assert.deepEqual(request.fixedFoods, [{ foodId: "pollo", quantity: 250 }]);
  assert.deepEqual(request.target, { kcal: 775, proteina: 58, carbs: 99, grasas: 16 });
  assert.equal(request.generateVariant, false);
  assert.equal(request.variantSeed, 7);
  assert.equal("candidateFoods" in request, false);
  assert.equal("generationStrategy" in request, false);
});

test("todos los alimentos con candado cerrado siguen habilitando la evaluacion central", () => {
  const drafts = [
    createTrackingFoodDraft({
      id: "pollo",
      nombre: "Pollo",
      unidad: "unidad",
      macroBasis: "perUnit",
      kcal: 400,
      proteina: 60,
      carbs: 0,
      grasas: 16,
    }, 1, "locked-chicken"),
    createTrackingFoodDraft({
      id: "arroz",
      nombre: "Arroz",
      unidad: "unidad",
      macroBasis: "perUnit",
      kcal: 300,
      proteina: 6,
      carbs: 65,
      grasas: 2,
    }, 1, "locked-rice"),
  ];
  const preflight = equivalentMealRecalculationPreflight({ canAuto: true, drafts });

  assert.equal(preflight.allowed, true);
  assert.deepEqual(preflight.input.pendingFoods, []);
  assert.deepEqual(preflight.input.fixedFoods.map((food) => [food.foodId, food.quantity]), [
    ["pollo", 1],
    ["arroz", 1],
  ]);
  assert.equal(preflight.input.fixedTotals.kcal, 700);

  const request = buildEquivalentMealRecalculationRequest({
    menuId: "menu-locked",
    mealId: "almuerzo-locked",
    mealType: "almuerzo",
    target: { kcal: 600, proteina: 50, carbs: 60, grasas: 15 },
    drafts,
    fixedFoods: preflight.input.fixedFoods,
  });
  assert.equal(request.fixedFoods.length, request.selectedFoodIds.length);
  assert.equal(preflight.input.fixedTotals.kcal > request.target.kcal, true);
});

test("preflight de recalculo conserva solamente los bloqueos de permiso y seleccion vacia", () => {
  assert.equal(equivalentMealRecalculationPreflight({ canAuto: false, drafts: [{}] }).allowed, false);
  assert.equal(equivalentMealRecalculationPreflight({ canAuto: true, drafts: [] }).allowed, false);
});

test("la advertencia de equivalencia reproduce BEST_EFFORT del backend sin umbrales locales", () => {
  const warning = equivalentMealDecisionWarning({
    response: {
      nutrition: {
        status: "BEST_EFFORT",
        usable: true,
        recommended: false,
        target: { kcal: 776, proteina: 57.6, carbs: 94.6, grasas: 15.6 },
        totals: { kcal: 772, proteina: 86.2, carbs: 76.5, grasas: 13.5 },
        warning: {
          code: "MEAL_NUTRITION_BEST_EFFORT",
          title: "Revisá esta alternativa",
          summary: "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.",
          reasons: ["Proteína: sobran 28,6 g"],
          reasonCodes: ["PROTEIN_ABOVE_REASONABLE_RANGE"],
        },
      },
    },
  });

  assert.equal(warning.summary, "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.");
  assert.deepEqual(warning.codes, [
    "MEAL_NUTRITION_BEST_EFFORT",
    "PROTEIN_ABOVE_REASONABLE_RANGE",
  ]);
  assert.equal(warning.proposal.proteina, 86.2);

  assert.equal(equivalentMealDecisionWarning({
    response: {
      nutrition: {
        status: "RECOMMENDED",
        usable: true,
        recommended: true,
        target: { kcal: 1 },
        totals: { kcal: 999, proteina: 999 },
      },
    },
  }), null);
});
