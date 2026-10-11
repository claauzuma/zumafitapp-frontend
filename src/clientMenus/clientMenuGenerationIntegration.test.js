import assert from "node:assert/strict";
import test from "node:test";

import { generateClientMenuPreview } from "./clientMenuGeneration.js";

function responseFor(payload, { totals = payload.target } = {}) {
  const ids = payload.requiredFoodIds.length ? payload.requiredFoodIds : ["generic-protein", "generic-carb"];
  const foods = ids.map((id) => ({
    foodId: id,
    name: id,
    quantity: Math.max(1, Number(payload.target.kcal) / ids.length),
    unit: "unidad",
    kcal: Number(totals.kcal) / ids.length,
    proteina: Number(totals.proteina) / ids.length,
    carbs: Number(totals.carbs) / ids.length,
    grasas: Number(totals.grasas) / ids.length,
  }));
  return {
    status: "SUCCESS",
    recommended: true,
    relaxation: { level: "STRICT", portionRulesRelaxed: false },
    alternative: {
      status: "TARGET_REACHED",
      foods,
      totals,
      target: payload.target,
      difference: {
        kcal: Number(totals.kcal) - Number(payload.target.kcal),
        proteina: Number(totals.proteina) - Number(payload.target.proteina),
        carbs: Number(totals.carbs) - Number(payload.target.carbs),
        grasas: Number(totals.grasas) - Number(payload.target.grasas),
      },
      structure: "P1+C1",
      optimization: { policy: "meal_generation_balanced_v1" },
      warnings: [],
    },
    alternatives: [],
    meta: { combinationCandidatesEvaluated: 1 },
  };
}

function fixedMeal() {
  return {
    id: "fixed-breakfast",
    nombre: "Desayuno existente",
    tipoComida: "desayuno",
    target: { kcal: 500, proteina: 30, carbs: 50, grasas: 15 },
    items: [{
      id: "fixed-food",
      alimentoId: "fixed-food",
      nombreSnapshot: "Desayuno real",
      cantidad: 1,
      unidad: "unidad",
      kcal: 550,
      proteina: 35,
      carbs: 60,
      grasas: 18,
    }],
  };
}

test("día parcial conserva la comida exacta y genera sólo los tres slots faltantes", async () => {
  const breakfast = fixedMeal();
  const snapshot = structuredClone(breakfast);
  const requests = [];
  const preview = await generateClientMenuPreview({
    target: { kcal: 2300, proteina: 170, carbs: 248, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "merienda", "cena"],
    plannedMeals: [breakfast],
    calorieDistributionMode: "custom",
    calorieDistributionPercents: { desayuno: 25, almuerzo: 35, merienda: 15, cena: 25 },
    variantSeed: "partial-day",
    automaticMealGenerator: async (request) => {
      requests.push(request);
      return responseFor(request);
    },
  });

  assert.equal(requests.length, 3);
  assert.equal(requests[0].diversityContext.previousMeals[0].fingerprint, "fixed-food");
  assert.strictEqual(preview.comidas[0], breakfast);
  assert.deepEqual(breakfast, snapshot);
  assert.deepEqual(preview.generationMeta.fixedTotals, { kcal: 550, proteina: 35, carbs: 60, grasas: 18 });
  assert.deepEqual(preview.generationMeta.trace.map((entry) => entry.status), [
    "preserved", "generated", "generated", "generated",
  ]);
  assert.equal(preview.generationMeta.generatedMealCount, 3);
});

test("una comida Por meta se descuenta y sólo genera alimentos para los slots restantes", async () => {
  const reserved = {
    id: "menu_target_almuerzo_manual",
    type: "almuerzo",
    name: "Almuerzo",
    target: { kcal: 500, proteina: 40, carbs: 50, grasas: 15 },
    personalTargetOnly: true,
  };
  const requests = [];
  const preview = await generateClientMenuPreview({
    target: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    reservedMealTargets: [reserved],
    variantSeed: "reserved-personal-target",
    automaticMealGenerator: async (request) => {
      requests.push(request);
      return responseFor(request);
    },
  });

  assert.equal(requests.length, 2);
  assert.deepEqual(preview.comidas.map((meal) => meal.tipoComida), ["desayuno", "cena"]);
  assert.deepEqual(preview.generationMeta.reservedTotals, reserved.target);
  assert.deepEqual(preview.generationMeta.resultTotals, preview.plannedTarget);
  assert.equal(preview.generationMeta.reservedMealTargets[0].id, reserved.id);
  assert.deepEqual(preview.generationMeta.trace.map((entry) => entry.status), [
    "generated", "reserved_target", "generated",
  ]);
});

test("un registro previo reduce exactamente una vez el presupuesto del menú automático", async () => {
  const consumedBaseline = { kcal: 300, proteina: 20, carbs: 38, grasas: 8 };
  const requests = [];
  const preview = await generateClientMenuPreview({
    target: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    consumedBaseline,
    freeCalories: 200,
    variantSeed: "tracked-before-automatic-menu",
    automaticMealGenerator: async (request) => {
      requests.push(request);
      return responseFor(request);
    },
  });

  const generatedTotals = requests.reduce((totals, request) => ({
    kcal: Math.round((totals.kcal + request.target.kcal) * 10) / 10,
    proteina: Math.round((totals.proteina + request.target.proteina) * 10) / 10,
    carbs: Math.round((totals.carbs + request.target.carbs) * 10) / 10,
    grasas: Math.round((totals.grasas + request.target.grasas) * 10) / 10,
  }), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });

  assert.equal(requests.length, 3);
  assert.deepEqual(preview.generationMeta.consumedBaselineTotals, consumedBaseline);
  assert.deepEqual(preview.generationMeta.resultTotals, preview.plannedTarget);
  for (const key of ["kcal", "proteina", "carbs", "grasas"]) {
    assert.ok(Math.abs(generatedTotals[key] - preview.plannedTarget[key]) <= 0.11);
  }
});

test("Picoteo que agota las libres genera sobre 1682 kcal y conserva el accounting", async () => {
  const consumedBaseline = { kcal: 450, proteina: 30, carbs: 80, grasas: 0 };
  const accounting = {
    initialFreeCalories: 100,
    freeCaloriesConsumed: 100,
    freeCaloriesRemaining: 0,
  };
  const preview = await generateClientMenuPreview({
    target: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    consumedBaseline,
    freeCalories: 0,
    generationAccounting: accounting,
    variantSeed: "picoteo-consumes-free-calories",
    automaticMealGenerator: async (request) => responseFor(request),
  });

  assert.deepEqual(preview.plannedTarget, {
    kcal: 1682,
    proteina: 140,
    carbs: 126,
    grasas: 70,
  });
  assert.equal(preview.generationMeta.initialFreeCalories, 100);
  assert.equal(preview.generationMeta.freeCaloriesConsumed, 100);
  assert.equal(preview.generationMeta.freeCaloriesRemaining, 0);
  assert.deepEqual(preview.generationMeta.resultTotals, preview.plannedTarget);
});

test("Solo elegidos usa exclusivamente los explícitos y un slot vacío vuelve a GENERIC", async () => {
  const requests = [];
  const preview = await generateClientMenuPreview({
    target: { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    foods: [
      { id: "arroz", nombre: "Arroz", targetMealType: "desayuno", mustAppear: true },
      { id: "yogur", nombre: "Yogur", targetMealType: "desayuno", mustAppear: true },
      { id: "banana", nombre: "Banana", targetMealType: "desayuno", mustAppear: true },
    ],
    useOnlySelectedFoods: true,
    variantSeed: "selected-only",
    automaticMealGenerator: async (request) => {
      requests.push(request);
      return responseFor(request);
    },
  });

  assert.equal(requests[0].strategy, "selected_only");
  assert.deepEqual(requests[0].requiredFoodIds.sort(), ["arroz", "banana", "yogur"]);
  assert.equal(requests[1].strategy, "assisted_food_addition");
  assert.deepEqual(requests[1].requiredFoodIds, []);
  assert.deepEqual(preview.comidas[0].items.map((item) => item.alimentoId).sort(), ["arroz", "banana", "yogur"]);
});

test("Combinar con otros envía los elegidos como required", async () => {
  const requests = [];
  await generateClientMenuPreview({
    target: { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    foods: [
      { id: "arroz", nombre: "Arroz", targetMealType: "desayuno", mustAppear: true },
      { id: "yogur", nombre: "Yogur", targetMealType: "desayuno", mustAppear: true },
    ],
    useOnlySelectedFoods: false,
    variantSeed: "assisted",
    automaticMealGenerator: async (request) => {
      requests.push(request);
      const response = responseFor(request);
      if (request.requiredFoodIds.length) {
        response.alternative.foods.push({
          foodId: "generic-fruit",
          name: "Fruta genérica",
          quantity: 1,
          unit: "unidad",
          kcal: 0,
          proteina: 0,
          carbs: 0,
          grasas: 0,
        });
      }
      return response;
    },
  });
  assert.equal(requests[0].strategy, "assisted_food_addition");
  assert.deepEqual(requests[0].requiredFoodIds.sort(), ["arroz", "yogur"]);
});

test("el resultado real de una comida modifica el target enviado a la siguiente", async () => {
  const requests = [];
  const actuals = [
    { kcal: 575, proteina: 41, carbs: 68, grasas: 15 },
    { kcal: 615, proteina: 46, carbs: 70, grasas: 17 },
    { kcal: 910, proteina: 63, carbs: 102, grasas: 28 },
  ];
  const preview = await generateClientMenuPreview({
    target: { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    calorieDistributionMode: "custom",
    calorieDistributionPercents: { desayuno: 30, almuerzo: 30, cena: 40 },
    variantSeed: "carry",
    automaticMealGenerator: async (request) => {
      const actual = actuals[requests.length];
      requests.push(request);
      return responseFor(request, { totals: actual });
    },
  });
  assert.deepEqual(requests[2].target, { kcal: 910, proteina: 63, carbs: 102, grasas: 28 });
  assert.deepEqual(preview.generationMeta.difference, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
});

test("calorias libres reservan kcal y macros en la misma proporcion energetica", async () => {
  const requests = [];
  const preview = await generateClientMenuPreview({
    target: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    freeCalories: 200,
    mealTypes: ["desayuno", "almuerzo", "cena"],
    calorieDistributionMode: "balanced",
    variantSeed: "free-calories-2132",
    automaticMealGenerator: async (request) => {
      requests.push(request);
      return responseFor(request);
    },
  });

  assert.equal(requests.length, 3);
  assert.deepEqual(preview.plannedTarget, {
    kcal: 1932,
    proteina: 154.1,
    carbs: 186.7,
    grasas: 63.4,
  });
  assert.equal(preview.flexibleCalories, 200);
  assert.deepEqual(preview.generationMeta.resultTotals, preview.plannedTarget);
  assert.deepEqual(preview.generationMeta.difference, {
    kcal: 0,
    proteina: 0,
    carbs: 0,
    grasas: 0,
  });
});

test("BEST_EFFORT central sigue siendo usable sin reclasificar P/C/G en frontend", async () => {
  const preview = await generateClientMenuPreview({
    target: { kcal: 700, proteina: 60, carbs: 70, grasas: 20 },
    mealTypes: ["almuerzo"],
    variantSeed: "best-effort-central",
    automaticMealGenerator: async (request) => {
      const totals = { kcal: 696, proteina: 86.2, carbs: 20, grasas: 40 };
      const response = responseFor(request, { totals });
      const warning = {
        code: "MEAL_NUTRITION_BEST_EFFORT",
        category: "nutrition",
        severity: "warning",
        title: "Revisá esta alternativa",
        summary: "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.",
        message: "Las calorías están alineadas, pero el reparto de macros queda desbalanceado.",
        reasons: ["Proteína: sobran 26,2 g"],
        reasonCodes: ["PROTEIN_ABOVE_REASONABLE_RANGE"],
      };
      response.recommended = false;
      response.nutrition = {
        policy: "meal_generation_balanced_v1",
        status: "BEST_EFFORT",
        recommended: false,
        usable: true,
        target: request.target,
        totals,
        difference: { kcal: -4, proteina: 26.2, carbs: -50, grasas: 20 },
        warning,
      };
      response.alternative.status = "BEST_EFFORT";
      response.alternative.classification = "BEST_EFFORT";
      response.alternative.recommended = false;
      response.alternative.usable = true;
      response.alternative.warnings = [warning, warning];
      return response;
    },
  });

  const meal = preview.comidas[0];
  assert.equal(meal.classification, "BEST_EFFORT");
  assert.equal(meal.usable, true);
  assert.equal(meal.nutrition.status, "BEST_EFFORT");
  assert.equal(meal.items.reduce((sum, item) => sum + item.proteina, 0), 86.2);
  assert.equal(preview.warnings.filter((warning) => (
    warning.code === "MEAL_NUTRITION_BEST_EFFORT"
  )).length, 1);
  assert.equal(preview.warnings.length, 1);
  assert.equal(preview.generationMeta.trace[0].solver.classification, "BEST_EFFORT");
});

test("NO_SOLUTION central bloquea el slot aunque el envelope no traiga alternativa", async () => {
  await assert.rejects(() => generateClientMenuPreview({
    target: { kcal: 700, proteina: 60, carbs: 80, grasas: 20 },
    mealTypes: ["almuerzo"],
    variantSeed: "no-solution-central",
    automaticMealGenerator: async () => ({
      status: "NO_SOLUTION",
      code: "MEAL_TARGET_NOT_REACHABLE_WITH_PORTION_RULES",
      recommended: false,
      usable: false,
      nutrition: {
        status: "NO_SOLUTION",
        recommended: false,
        usable: false,
      },
      alternative: null,
      alternatives: [],
    }),
  }), (error) => error.code === "MEAL_TARGET_NOT_REACHABLE_WITH_PORTION_RULES");
});

test("una repetición inevitable no bloquea el día y cada request recibe contexto semántico", async () => {
  const requests = [];
  const duplicateResponse = (payload) => {
    requests.push(payload);
    const repeatWarning = payload.diversityContext?.previousMeals?.length ? [{
      code: "MEAL_COMPOSITION_REPEAT_UNAVOIDABLE",
      category: "diversity",
      severity: "info",
      message: "No había otra composición nutricionalmente razonable.",
    }] : [];
    return ({
    status: "SUCCESS",
    recommended: true,
    relaxation: { level: "STRICT", portionRulesRelaxed: false },
    alternative: {
      status: "TARGET_REACHED",
      foods: [{
        foodId: "same-food",
        name: "Misma comida",
        quantity: 1,
        unit: "unidad",
        ...payload.target,
      }],
      totals: payload.target,
      target: payload.target,
      difference: { kcal: 0, proteina: 0, carbs: 0, grasas: 0 },
      warnings: repeatWarning,
    },
    alternatives: [],
    });
  };

  const preview = await generateClientMenuPreview({
    target: { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    calorieDistributionMode: "custom",
    calorieDistributionPercents: { desayuno: 1, almuerzo: 1, cena: 1 },
    variantSeed: "no-repeat",
    allowRepeats: false,
    automaticMealGenerator: duplicateResponse,
  });
  assert.equal(preview.comidas.length, 3);
  assert.equal(requests[0].diversityContext, undefined);
  assert.equal(requests[1].diversityContext.previousMeals[0].fingerprint, "same-food");
  assert.equal(requests[2].diversityContext.previousMeals.length, 2);
  assert.equal(preview.warnings.some((warning) => (
    warning.code === "MEAL_COMPOSITION_REPEAT_UNAVOIDABLE"
  )), true);

  requests.length = 0;
  const repeated = await generateClientMenuPreview({
    target: { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    calorieDistributionMode: "custom",
    calorieDistributionPercents: { desayuno: 1, almuerzo: 1, cena: 1 },
    variantSeed: "repeat-allowed",
    allowRepeats: true,
    automaticMealGenerator: duplicateResponse,
  });
  assert.equal(repeated.comidas.length, 3);
  assert.ok(requests.every((request) => request.diversityContext === undefined));
});
