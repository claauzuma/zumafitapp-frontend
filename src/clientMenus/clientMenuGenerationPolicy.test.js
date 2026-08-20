import assert from "node:assert/strict";
import test from "node:test";

import {
  buildIncludedFoodAssignments,
  exactMealTypesMatch,
  curateGenerationFoodPool,
  foodSupportsMealType,
  generatedMealFingerprint,
  generatedMealNutritionTotals,
  isGenericGenerationFood,
  libraryMealScore,
  libraryMealVarietyPenalty,
  mealProteinWithinGenerationRange,
  validateMenuGenerationPolicy,
} from "./clientMenuGenerationPolicy.js";

function genericFood(id, mealTypes, overrides = {}) {
  return {
    id,
    generation: {
      mode: "GENERIC",
      mealTypes: Object.fromEntries(mealTypes.map((type) => [type, true])),
      roles: {},
      portionRule: {},
    },
    ...overrides,
  };
}

test("un alimento incluido mejora prioridad sin convertirse en obligatorio", () => {
  const target = { kcal: 500, proteina: 35, carbs: 55, grasas: 15 };
  const exactWithoutChicken = {
    kcal: 500,
    macrosTotales: { proteina: 35, carbs: 55, grasas: 15 },
    items: [{ alimentoId: "rice", nombre: "Arroz" }],
  };
  const nearWithChicken = {
    kcal: 505,
    macrosTotales: { proteina: 35, carbs: 55, grasas: 15 },
    items: [{ alimentoId: "chicken", nombre: "Pollo" }],
  };
  const preferredFoods = [{ id: "chicken", nombre: "Pollo" }];

  assert.ok(libraryMealScore(nearWithChicken, target, preferredFoods) < libraryMealScore(exactWithoutChicken, target, preferredFoods));
  assert.equal(libraryMealScore(exactWithoutChicken, target, preferredFoods), libraryMealScore(exactWithoutChicken, target, []));
});

test("la tolerancia cambia el peso nutricional real del scoring", () => {
  const target = { kcal: 500, proteina: 40, carbs: 50, grasas: 15 };
  const meal = { kcal: 520, macrosTotales: { proteina: 35, carbs: 55, grasas: 18 } };
  assert.ok(libraryMealScore(meal, target, [], "strict") > libraryMealScore(meal, target, [], "balanced"));
  assert.ok(libraryMealScore(meal, target, [], "balanced") > libraryMealScore(meal, target, [], "flexible"));
});

test("solo estos alimentos exige seleccion y no deriva a menu similar", () => {
  assert.throws(
    () => validateMenuGenerationPolicy({ useOnlySelectedFoods: true, foods: [] }),
    (error) => error?.code === "MENU_SELECTED_FOODS_REQUIRED"
  );
  assert.throws(
    () => validateMenuGenerationPolicy({
      generationMode: "similar_menu",
      useOnlySelectedFoods: true,
      foods: [{ id: "rice" }],
    }),
    (error) => error?.code === "MENU_SELECTED_ONLY_LIBRARY_CONFLICT"
  );
});

test("variedad alta penaliza mas ingredientes ya usados", () => {
  const meal = { items: [{ alimentoId: "rice" }, { alimentoId: "chicken" }] };
  const used = new Set(["rice"]);
  assert.equal(libraryMealVarietyPenalty(meal, used, "low"), 0);
  assert.ok(libraryMealVarietyPenalty(meal, used, "high") > libraryMealVarietyPenalty(meal, used, "medium"));
});

test("menu similar debe contener exactamente los tipos solicitados", () => {
  const valid = [
    { tipoComida: "desayuno" },
    { tipoComida: "almuerzo" },
    { tipoComida: "cena" },
  ];
  const duplicated = [
    { tipoComida: "almuerzo" },
    { tipoComida: "almuerzo" },
    { tipoComida: "cena" },
  ];
  assert.equal(exactMealTypesMatch(valid, ["desayuno", "almuerzo", "cena"]), true);
  assert.equal(exactMealTypesMatch(duplicated, ["desayuno", "almuerzo", "cena"]), false);
});

test("el pool desde cero usa compatibilidad real y completa roles sin exceder el limite", () => {
  const chicken = genericFood("chicken", ["lunch"], { esProteinaPrincipal: true });
  const oats = genericFood("oats", ["breakfast"], { esCarboPrincipal: true });
  const rice = genericFood("rice", ["lunch"], { esCarboPrincipal: true });
  const oil = genericFood("oil", ["lunch"], { esGrasaPrincipal: true });
  const vegetables = genericFood("vegetables", ["lunch"], { esVegetalLibre: true });
  assert.equal(foodSupportsMealType(chicken, "desayuno"), false);
  assert.equal(foodSupportsMealType(oats, "desayuno"), true);
  const pool = curateGenerationFoodPool({
    foods: [chicken, oats, rice, oil, vegetables],
    preferredFoods: [chicken],
    mealType: "almuerzo",
    limit: 4,
  });
  assert.deepEqual(pool.map((food) => food.id), ["chicken", "rice", "oil", "vegetables"]);
  assert.equal(pool.includes(oats), false);
});

test("la generacion automatica acepta solo GENERIC y respeta sus momentos", () => {
  const chicken = genericFood("chicken", ["lunch", "dinner"]);
  const explicit = { id: "legacy", generation: { mode: "EXPLICIT_ONLY", mealTypes: { lunch: true } } };
  assert.equal(isGenericGenerationFood(chicken), true);
  assert.equal(foodSupportsMealType(chicken, "almuerzo"), true);
  assert.equal(foodSupportsMealType(chicken, "desayuno"), false);
  assert.equal(foodSupportsMealType(explicit, "almuerzo"), false);
  assert.deepEqual(curateGenerationFoodPool({ foods: [chicken, explicit], mealType: "almuerzo" }).map((food) => food.id), ["chicken"]);
});

test("Debe aparecer se asigna una vez y una comida concreta no se filtra a las demas", () => {
  const any = genericFood("yogurt", ["breakfast", "snack"], { mustAppear: true, targetMealType: "any" });
  const lunch = genericFood("chicken", ["lunch", "dinner"], { mustAppear: true, targetMealType: "almuerzo" });
  const optional = genericFood("rice", ["lunch", "dinner"], { mustAppear: false, targetMealType: "any" });
  const assignments = buildIncludedFoodAssignments([any, lunch, optional], ["desayuno", "almuerzo", "merienda", "cena"]);

  assert.deepEqual(assignments.desayuno.required.map((food) => food.id), ["yogurt"]);
  assert.deepEqual(assignments.almuerzo.required.map((food) => food.id), ["chicken"]);
  assert.equal(assignments.cena.allowed.some((food) => food.id === "chicken"), false);
  assert.equal(assignments.cena.preferred.some((food) => food.id === "rice"), true);
});

test("la validacion proteica usa los totales reales y el rango inclusivo 15 a 65", () => {
  const minimum = { items: [{ kcal: 100, proteina: 15, carbs: 5, grasas: 2 }] };
  const maximum = { items: [{ kcal: 500, protein: 65, carbs: 40, fat: 12 }] };
  const below = { items: [{ proteina: 14.9 }] };
  const above = { items: [{ proteina: 65.1 }] };
  assert.deepEqual(generatedMealNutritionTotals(minimum), { kcal: 100, proteina: 15, carbs: 5, grasas: 2 });
  assert.equal(mealProteinWithinGenerationRange(minimum), true);
  assert.equal(mealProteinWithinGenerationRange(maximum), true);
  assert.equal(mealProteinWithinGenerationRange(below), false);
  assert.equal(mealProteinWithinGenerationRange(above), false);
});

test("la huella de comida distingue cantidades pero no el orden de los items", () => {
  const first = { items: [
    { alimentoId: "rice", cantidad: 80, unidad: "g" },
    { alimentoId: "chicken", cantidad: 150, unidad: "g" },
  ] };
  const same = { items: [...first.items].reverse() };
  const differentQuantity = { items: [
    { alimentoId: "rice", cantidad: 100, unidad: "g" },
    { alimentoId: "chicken", cantidad: 150, unidad: "g" },
  ] };
  assert.equal(generatedMealFingerprint(first), generatedMealFingerprint(same));
  assert.notEqual(generatedMealFingerprint(first), generatedMealFingerprint(differentQuantity));
});
