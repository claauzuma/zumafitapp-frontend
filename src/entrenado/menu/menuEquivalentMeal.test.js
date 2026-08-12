import test from "node:test";
import assert from "node:assert/strict";

import {
  equivalentMealComparison,
  equivalentMealDraftStorageKey,
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
