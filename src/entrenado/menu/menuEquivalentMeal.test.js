import test from "node:test";
import assert from "node:assert/strict";

import {
  buildEquivalentMealRecalculationRequest,
  equivalentMealComparison,
  equivalentMealDecisionWarning,
  equivalentMealDraftStorageKey,
  equivalentMealGenerationFeedback,
  equivalentLibrarySourceLabel,
  filterEquivalentLibraryMeals,
  generatedAlternativeToDrafts,
  nextGeneratedAlternativeIndex,
  resolveEquivalentMealAccess,
} from "./menuEquivalentMeal.js";

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

test("la comparacion usa un techo calorico estricto y proteina neutral en cero", () => {
  const close = equivalentMealComparison(
    { kcal: 600, proteina: 40, carbs: 65, grasas: 20 },
    { kcal: 599, proteina: 38, carbs: 64, grasas: 21 }
  );
  assert.equal(close.caloriesClose, true);
  assert.equal(close.exceedsCalories, false);
  assert.equal(close.proteinReached, true);

  const neutral = equivalentMealComparison({ kcal: 500, proteina: 0 }, { kcal: 500, proteina: 0 });
  assert.equal(neutral.proteinReached, true);
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
  assert.equal(request.generateVariant, true);
  assert.equal(request.variantSeed, 7);
  assert.equal("candidateFoods" in request, false);
  assert.equal("generationStrategy" in request, false);
});

test("la advertencia prioritaria aparece solo ante diferencias nutricionales relevantes", () => {
  const target = { kcal: 776, proteina: 57.6, carbs: 94.6, grasas: 15.6 };

  assert.equal(equivalentMealDecisionWarning({
    target,
    proposal: { kcal: 775.4, proteina: 56, carbs: 92, grasas: 16.5 },
    optimization: { calorieTolerance: 1 },
  }), null);

  const calories = equivalentMealDecisionWarning({
    target,
    proposal: { kcal: 760, proteina: 58, carbs: 90, grasas: 16 },
    optimization: { calorieTolerance: 1 },
  });
  assert.deepEqual(calories.codes, ["calorie_target_not_reached"]);
  assert.match(calories.reasons[0], /16 kcal/);

  const protein = equivalentMealDecisionWarning({
    target,
    proposal: { kcal: 776, proteina: 54.6, carbs: 94.6, grasas: 15.6 },
  });
  assert.deepEqual(protein.codes, ["protein_target_not_reached"]);
  assert.match(protein.reasons[0], /3 g/);
});

test("el desbalance C/G requiere exceso proteico de al menos 6 g", () => {
  const target = { kcal: 776, proteina: 57.6, carbs: 94.6, grasas: 15.6 };
  const withoutProteinExcess = equivalentMealDecisionWarning({
    target,
    proposal: { kcal: 776, proteina: 60, carbs: 41.5, grasas: 27.5 },
  });
  assert.equal(withoutProteinExcess, null);

  const exactThreshold = equivalentMealDecisionWarning({
    target,
    proposal: { kcal: 776, proteina: 63.6, carbs: 41.5, grasas: 27.5 },
  });
  assert.deepEqual(exactThreshold.codes, ["macro_distribution_far_with_protein_excess"]);

  const strong = equivalentMealDecisionWarning({
    target,
    proposal: { kcal: 776, proteina: 90.6, carbs: 41.5, grasas: 27.5 },
  });
  assert.deepEqual(strong.codes, ["macro_distribution_far_with_protein_excess"]);
  assert.match(strong.reasons[0], /33 g/);
  assert.match(strong.reasons[0], /Carbohidratos/);
  assert.match(strong.reasons[0], /Grasas/);

  assert.equal(equivalentMealDecisionWarning({
    target: { ...target, proteina: 0 },
    proposal: { kcal: 776, proteina: 90, carbs: 41.5, grasas: 27.5 },
  }), null);
});
