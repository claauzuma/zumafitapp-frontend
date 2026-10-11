import test from "node:test";
import assert from "node:assert/strict";

import {
  appendPersonalMealTargetConfig,
  buildPersonalMealTargetDayPlan,
  buildVariedPersonalMealTargetDayPlan,
  buildPersonalMealTargetConfig,
  calculateLockedMealMacros,
  editablePersonalMealTargetIds,
  editPersonalMealTargetDay,
  generationNutritionBudget,
  generationTargetAfterTracking,
  generationTrackingBreakdown,
  generationTrackingNutrition,
  manualMealTargetOverageReview,
  personalMealTargetConfigsFromPlan,
  personalMealTargetConfigsFromReconciliation,
  personalMealTargetBalancedBounds,
  personalMealTargetDistributionSignature,
  personalMealTargetDayReconciliation,
  personalMealTargetFlexiblePlan,
  personalMealTargetPlannedIds,
  personalMealTargetTotals,
  personalMealTargetsFromTrackingDay,
  replacePersonalMealTargetConfigs,
  reorderPersonalMealTargets,
  resolvePersonalMealTargetRemovals,
} from "./quickMealTargetPlan.js";

const reconciliationTarget = { kcal: 2000, proteina: 150, carbs: 200, grasas: 60 };

function reconciliationTrackingDay({
  picoteo = [],
  breakfast = [],
  lunch = [],
  dinner = [],
  confirmedLunch = false,
  confirmedDinner = false,
} = {}) {
  return {
    mealsConfig: [
      { mealId: "menu_target_breakfast", tipo: "desayuno", nombre: "Desayuno", meta: { kcal: 600, proteina: 45, carbs: 60, grasas: 18 } },
      { mealId: "menu_target_lunch", tipo: "almuerzo", nombre: "Almuerzo", meta: { kcal: 600, proteina: 45, carbs: 60, grasas: 18 }, metaConfirmed: confirmedLunch },
      { mealId: "menu_target_dinner", tipo: "cena", nombre: "Cena", meta: { kcal: 700, proteina: 52.5, carbs: 70, grasas: 21 }, metaConfirmed: confirmedDinner },
    ],
    meals: {
      picoteo,
      menu_target_breakfast: breakfast,
      menu_target_lunch: lunch,
      menu_target_dinner: dinner,
    },
  };
}

function reconcile(day, options = {}) {
  return personalMealTargetDayReconciliation({
    dailyTarget: reconciliationTarget,
    trackingDay: day,
    freeCalories: 100,
    ...options,
  });
}

test("el desglose separa consumo libre y normal sin descontar metas preservadas", () => {
  const trackingDay = {
    totals: { kcal: 9999, proteina: 999, carbs: 999, grasas: 999 },
    meals: {
      daily_target_2026_09_01: [
        { kcal: 240, proteina: 18, carbs: 30, grasas: 6 },
      ],
      picoteo: [
        { kcal: 60, proteina: 2, carbs: 8, grasas: 2 },
      ],
      menu_target_almuerzo: [
        { kcal: 180, proteina: 20, carbs: 12, grasas: 5 },
      ],
      flexible_margin: [
        { kcal: 100, proteina: 1, carbs: 22, grasas: 1 },
      ],
    },
  };
  const breakdown = generationTrackingBreakdown(trackingDay, {
    excludedMealIds: ["menu_target_almuerzo"],
  });

  assert.deepEqual(breakdown.total, { kcal: 400, proteina: 21, carbs: 60, grasas: 9 });
  assert.deepEqual(breakdown.freeEligible, { kcal: 160, proteina: 3, carbs: 30, grasas: 3 });
  assert.deepEqual(generationTargetAfterTracking(
    { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    breakdown.total
  ), { kcal: 1732, proteina: 149, carbs: 146, grasas: 61 });
});

test("un agregado legacy sólo se usa cuando no hace falta excluir una comida preservada", () => {
  const legacy = { totals: { kcal: 320, proteina: 25, carbs: 35, grasas: 9 } };
  assert.deepEqual(generationTrackingNutrition(legacy), legacy.totals);
  assert.deepEqual(generationTrackingNutrition(legacy, {
    excludedMealIds: ["menu_target_breakfast"],
  }), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
});

test("un consumo normal se resta y luego se reserva el margen libre restante", () => {
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    consumedNutrition: { kcal: 300, proteina: 20, carbs: 38, grasas: 8 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    freeCalories: 200,
    seed: "tracked-before-personal-targets",
  });

  assert.deepEqual(plan.plannedTarget, {
    kcal: 1632,
    proteina: 133.6,
    carbs: 149.7,
    grasas: 55.2,
  });
  assert.deepEqual(personalMealTargetTotals(plan.meals), plan.plannedTarget);
  assert.equal(plan.freeCalories, 200);
});

test("2132 kcal, 100 libres y Picoteo 450 no descuentan dos veces la reserva", () => {
  const tracking = generationTrackingBreakdown({
    meals: {
      picoteo: [{ kcal: 450, proteina: 30, carbs: 80, grasas: 0 }],
    },
  });
  const budget = generationNutritionBudget({
    dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    tracking,
    freeCalories: 100,
  });
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: budget.dailyTarget,
    consumedNutrition: tracking.total,
    freeEligibleNutrition: tracking.freeEligible,
    mealTypes: ["desayuno", "almuerzo", "cena"],
    freeCalories: 100,
    seed: "picoteo-450",
  });

  assert.equal(budget.initialFreeCalories, 100);
  assert.equal(budget.freeCaloriesConsumed, 100);
  assert.equal(budget.freeCaloriesRemaining, 0);
  assert.deepEqual(budget.remainingDailyTarget, {
    kcal: 1682,
    proteina: 140,
    carbs: 126,
    grasas: 70,
  });
  assert.deepEqual(budget.generationTarget, budget.remainingDailyTarget);
  assert.deepEqual(plan.plannedTarget, budget.generationTarget);
  assert.equal(personalMealTargetTotals(plan.meals).kcal, 1682);
  assert.equal(plan.freeCalories, 0);
});

for (const [picoteoKcal, expectedFreeRemaining, expectedMealKcal] of [
  [50, 50, 2032],
  [100, 0, 2032],
  [450, 0, 1682],
]) {
  test(`100 libres + Picoteo ${picoteoKcal} deja ${expectedFreeRemaining} libres`, () => {
    const budget = generationNutritionBudget({
      dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
      tracking: {
        total: { kcal: picoteoKcal },
        freeEligible: { kcal: picoteoKcal },
      },
      freeCalories: 100,
    });
    assert.equal(budget.freeCaloriesRemaining, expectedFreeRemaining);
    assert.equal(budget.generationTarget.kcal, expectedMealKcal);
    assert.equal(budget.normalConsumption.kcal, Math.max(0, picoteoKcal - 100));
  });
}

test("mezcla Picoteo y comida: sólo Picoteo consume libres y ambos restan una vez del día", () => {
  const tracking = generationTrackingBreakdown({
    meals: {
      picoteo: [{ kcal: 150, proteina: 5, carbs: 25, grasas: 3 }],
      desayuno: [{ kcal: 300, proteina: 25, carbs: 35, grasas: 8 }],
    },
  });
  const budget = generationNutritionBudget({
    dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    tracking,
    freeCalories: 100,
  });

  assert.equal(budget.freeCaloriesConsumed, 100);
  assert.equal(budget.freeCaloriesRemaining, 0);
  assert.equal(budget.normalConsumption.kcal, 350);
  assert.deepEqual(budget.generationTarget, {
    kcal: 1682,
    proteina: 140,
    carbs: 146,
    grasas: 59,
  });
});

test("un registro de una meta preservada no entra en el accounting diario", () => {
  const tracking = generationTrackingBreakdown({
    meals: {
      picoteo: [{ kcal: 50, proteina: 2, carbs: 8, grasas: 1 }],
      menu_target_almuerzo: [{ kcal: 500, proteina: 40, carbs: 50, grasas: 15 }],
    },
  }, { excludedMealIds: ["menu_target_almuerzo"] });

  assert.deepEqual(tracking.total, { kcal: 50, proteina: 2, carbs: 8, grasas: 1 });
  assert.deepEqual(tracking.freeEligible, tracking.total);
});

test("Por meta Equilibrado varÃ­a sin salir de las bandas de 3, 4 y 5 comidas", () => {
  const mealTypesByCount = {
    3: ["desayuno", "almuerzo", "cena"],
    4: ["desayuno", "almuerzo", "merienda", "cena"],
    5: ["desayuno", "colacion", "almuerzo", "merienda", "cena"],
  };

  for (const count of [3, 4, 5]) {
    const bounds = personalMealTargetBalancedBounds(count);
    const signatures = new Set();
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const plan = buildPersonalMealTargetDayPlan({
        dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
        mealTypes: mealTypesByCount[count],
        distributionMode: "balanced",
        seed: `balanced-${count}-${attempt}`,
      });
      const weights = plan.distribution.weights;
      signatures.add(weights.join("|"));
      assert.ok(weights.every((weight) => weight >= bounds.min - 1e-9));
      assert.ok(weights.every((weight) => weight <= bounds.max + 1e-9));
      assert.ok(Math.abs(weights.reduce((sum, weight) => sum + weight, 0) - 1) <= 1e-9);
      assert.deepEqual(personalMealTargetTotals(plan.meals), plan.plannedTarget);
    }
    assert.ok(signatures.size >= 40, `${count} comidas debe ofrecer repartos realmente distintos`);
  }
});

test("un nuevo seed cambia calorÃ­as y macros juntos; el mismo seed es reproducible", () => {
  const options = {
    dailyTarget: { kcal: 2000, proteina: 150, carbs: 220, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    distributionMode: "balanced",
  };
  const first = buildPersonalMealTargetDayPlan({ ...options, seed: "attempt-1" });
  const repeated = buildPersonalMealTargetDayPlan({ ...options, seed: "attempt-1" });
  const next = buildPersonalMealTargetDayPlan({ ...options, seed: "attempt-2" });

  assert.deepEqual(first.meals, repeated.meals);
  assert.notDeepEqual(
    first.meals.map((meal) => meal.target),
    next.meals.map((meal) => meal.target)
  );
  first.meals.forEach((meal, index) => {
    const weight = first.distribution.weights[index];
    assert.ok(Math.abs(meal.target.kcal / first.plannedTarget.kcal - weight) <= 0.0001);
    assert.ok(Math.abs(meal.target.proteina / first.plannedTarget.proteina - weight) <= 0.001);
  });
});

test("otra combinación conserva las metas confirmadas y redistribuye las abiertas", () => {
  const options = {
    dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    freeCalories: 100,
    distributionMode: "balanced",
  };
  const first = buildPersonalMealTargetDayPlan({ ...options, seed: "preview-1" });
  const confirmed = { ...first.meals[0], confirmed: true };
  const next = buildPersonalMealTargetDayPlan({
    ...options,
    existingMeals: [confirmed],
    seed: "preview-2",
  });

  assert.deepEqual(next.meals[0], { ...confirmed, preserved: true });
  assert.notDeepEqual(
    first.meals.slice(1).map((meal) => meal.target),
    next.meals.slice(1).map((meal) => meal.target)
  );
  assert.deepEqual(personalMealTargetTotals(next.meals), next.plannedTarget);
});

test("cuatro pulsaciones de Generar evitan las variantes equilibradas recientes", () => {
  const avoidSignatures = [];
  const generated = [];
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const plan = buildVariedPersonalMealTargetDayPlan({
      dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
      mealTypes: ["desayuno", "almuerzo", "cena"],
      freeCalories: 200,
      distributionMode: "balanced",
      seed: `button-${attempt}`,
    }, { avoidSignatures });
    const signature = personalMealTargetDistributionSignature(plan);
    avoidSignatures.push(signature);
    generated.push(signature);
    assert.deepEqual(personalMealTargetTotals(plan.meals), plan.plannedTarget);
  }
  assert.equal(new Set(generated).size, 4);
});

test("las calorías y macros no asignados forman el margen libre de Por meta", () => {
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    freeCalories: 200,
    seed: "personal-free-card",
  });
  const flexible = personalMealTargetFlexiblePlan(plan.dailyTarget, plan.meals);

  assert.equal(flexible.source, "personal_target");
  assert.equal(flexible.flexibleCalories, 200);
  assert.deepEqual(flexible.planned, plan.plannedTarget);
  assert.deepEqual(flexible.macroPending, {
    protein: 15.9,
    carbs: 19.3,
    fat: 6.6,
  });
});

test("la UI sólo presenta calorías libres cuando pertenecen explícitamente a ese plan y fecha", () => {
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    freeCalories: 200,
    seed: "explicit-free-card",
  });
  const options = {
    explicitFreeCalories: 200,
    expectedPlannedTarget: plan.plannedTarget,
    planDate: "2026-08-27",
    date: "2026-08-27",
  };

  assert.equal(personalMealTargetFlexiblePlan(plan.dailyTarget, plan.meals, options)?.flexibleCalories, 200);
  assert.equal(personalMealTargetFlexiblePlan(plan.dailyTarget, plan.meals, {
    ...options,
    date: "2026-08-28",
  }), null);
  assert.equal(personalMealTargetFlexiblePlan(plan.dailyTarget, plan.meals, {
    ...options,
    expectedPlannedTarget: { ...plan.plannedTarget, kcal: 1800 },
  }), null);
});

test("una meta manual se conserva y las nuevas metas reciben exactamente el restante", () => {
  const existing = {
    id: "menu_target_almuerzo_manual",
    type: "almuerzo",
    name: "Almuerzo",
    target: { kcal: 500, proteina: 40, carbs: 50, grasas: 15 },
    personalTargetOnly: true,
    confirmed: true,
  };
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    existingMeals: [existing],
    freeCalories: 200,
    seed: "continue-personal-targets",
  });

  assert.equal(plan.meals.length, 3);
  assert.equal(plan.meals[1].id, existing.id);
  assert.equal(plan.meals[1].confirmed, true);
  assert.deepEqual(personalMealTargetTotals(plan.meals), plan.plannedTarget);
  assert.deepEqual(plan.plannedTarget, { kcal: 1932, proteina: 154.1, carbs: 186.7, grasas: 63.4 });
  assert.equal(plan.meals[0].target.kcal + plan.meals[2].target.kcal, 1432);
  assert.equal(plan.meals[0].target.proteina + plan.meals[2].target.proteina, 114.1);
});

test("no inventa una card libre para metas del coach ni para un plan sin reserva", () => {
  assert.equal(personalMealTargetFlexiblePlan(
    { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
    [{ id: "menu_target_lunch", personalTargetOnly: true, target: { kcal: 500, proteina: 40, carbs: 50, grasas: 15 } }]
  ), null);
  assert.equal(personalMealTargetFlexiblePlan(
    { kcal: 2000, proteina: 150, carbs: 220, grasas: 60 },
    [{ id: "coach-breakfast", coachTargetOnly: true, target: { kcal: 500 } }]
  ), null);
  assert.equal(personalMealTargetFlexiblePlan(
    { kcal: 500, proteina: 40, carbs: 50, grasas: 15 },
    [{ id: "menu_target_breakfast", personalTargetOnly: true, target: { kcal: 500, proteina: 40, carbs: 50, grasas: 15 } }]
  ), null);
  assert.equal(personalMealTargetFlexiblePlan(
    { kcal: 500, proteina: 40, carbs: 50, grasas: 15 },
    [{ id: "menu_target_coach_like", coachTargetOnly: true, target: { kcal: 300, proteina: 20, carbs: 30, grasas: 10 } }]
  ), null);
});

test("formatear o eliminar selecciona sólo metas personales creadas por el cliente", () => {
  assert.deepEqual(editablePersonalMealTargetIds([
    { id: "menu_target_breakfast_1", personalTargetOnly: true },
    { id: "coach_target_breakfast", coachTargetOnly: true },
    { id: "menu_target_coach_like", coachTargetOnly: true },
    { id: "meal_regular", personalTargetOnly: true },
    { id: "menu_target_breakfast_1", personalTargetOnly: true },
  ]), ["menu_target_breakfast_1"]);
});

test("quitar una meta persistida exige confirmación y no confunde comidas conservadas o nuevas", () => {
  const originalMealIds = ["menu_target_breakfast_1", "menu_target_lunch_1", "menu_target_dinner_1"];
  const nextMeals = [
    { id: "menu_target_breakfast_1" },
    { id: "menu_target_dinner_1" },
    { id: "menu_target_snack_new" },
  ];
  assert.deepEqual(resolvePersonalMealTargetRemovals({ originalMealIds, nextMeals }), {
    removedMealIds: ["menu_target_lunch_1"],
    unconfirmedMealIds: ["menu_target_lunch_1"],
  });
  assert.deepEqual(resolvePersonalMealTargetRemovals({
    originalMealIds,
    nextMeals,
    confirmedRemovalIds: ["menu_target_lunch_1"],
  }), {
    removedMealIds: ["menu_target_lunch_1"],
    unconfirmedMealIds: [],
  });
});

test("reordenar metas conserva identidad, nutrición y registros asociados", () => {
  const meals = [
    { id: "breakfast", type: "desayuno", target: { kcal: 667, proteina: 53.1 } },
    { id: "lunch", type: "almuerzo", target: { kcal: 763, proteina: 60.9 } },
    { id: "snack", type: "merienda", target: { kcal: 200, proteina: 15 } },
    { id: "dinner", type: "cena", target: { kcal: 402, proteina: 33 } },
  ];
  const recordsById = { breakfast: [{ name: "Arroz", quantity: 100 }] };
  const reordered = reorderPersonalMealTargets(meals, "snack", -1);

  assert.deepEqual(reordered.map((meal) => meal.id), ["breakfast", "snack", "lunch", "dinner"]);
  assert.deepEqual(reordered.find((meal) => meal.id === "breakfast").target, meals[0].target);
  assert.deepEqual(recordsById.breakfast, [{ name: "Arroz", quantity: 100 }]);
  assert.deepEqual(meals.map((meal) => meal.id), ["breakfast", "lunch", "snack", "dinner"]);
});

test("crea una comida personal por meta y distribuye macros según las kcal del día", () => {
  const config = buildPersonalMealTargetConfig({
    type: "almuerzo",
    kcal: 600,
    dailyTarget: { kcal: 2400, proteina: 160, carbs: 280, grasas: 80 },
    existingMeals: [{ mealId: "desayuno" }],
    idSuffix: "test",
  });

  assert.deepEqual(config, {
    mealId: "menu_target_almuerzo_test",
    tipo: "almuerzo",
    nombre: "Almuerzo",
    orden: 1,
    meta: { kcal: 600, proteina: 40, carbs: 70, grasas: 20 },
    metaConfirmed: false,
  });
});

test("conserva las comidas configuradas y expone sólo las creadas por meta", () => {
  const mealsConfig = appendPersonalMealTargetConfig({
    mealsConfig: [{ mealId: "picoteo", tipo: "snack", nombre: "Picoteo", meta: null }],
  }, {
    type: "cena",
    kcal: 500,
    idSuffix: "personal",
  });

  const targets = personalMealTargetsFromTrackingDay({ mealsConfig });
  assert.equal(mealsConfig.length, 2);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].id, "menu_target_cena_personal");
  assert.equal(targets[0].target.kcal, 500);
  assert.equal(targets[0].personalTargetOnly, true);
});

test("las metas manuales de macros prevalecen sobre la distribución sugerida", () => {
  const config = buildPersonalMealTargetConfig({
    type: "merienda",
    kcal: 450,
    macros: { proteina: "35", carbs: "42.5", grasas: "12" },
    dailyTarget: { kcal: 2000, proteina: 120, carbs: 220, grasas: 70 },
    idSuffix: "macros",
  });

  assert.deepEqual(config.meta, {
    kcal: 450,
    proteina: 35,
    carbs: 42.5,
    grasas: 12,
  });
});

test("un macro bloqueado queda fijo y los abiertos completan las calorías objetivo", () => {
  const result = calculateLockedMealMacros({
    kcal: 700,
    macros: { proteina: 60, carbs: 0, grasas: 0 },
    locks: { proteina: true, carbs: false, grasas: false },
    dailyTarget: { proteina: 170, carbs: 206, grasas: 70 },
  });

  assert.equal(result.macros.proteina, 60);
  assert.ok(Math.abs(result.actualKcal - 700) <= 1);
  assert.equal(result.overConstrained, false);
  assert.ok(result.macros.carbs > 0);
  assert.ok(result.macros.grasas > 0);
});

test("dos macros con candado dejan que el tercero complete la meta calórica", () => {
  const result = calculateLockedMealMacros({
    kcal: 645.4,
    macros: { proteina: 51.5, carbs: 62.2, grasas: 0 },
    locks: { proteina: true, carbs: true, grasas: false },
    dailyTarget: { proteina: 170, carbs: 206, grasas: 70 },
  });

  assert.equal(result.macros.proteina, 51.5);
  assert.equal(result.macros.carbs, 62.2);
  assert.equal(result.macros.grasas, 21.2);
  assert.ok(Math.abs(result.actualKcal - 645.4) <= 1);
});

test("sin candados todos los macros se recalculan proporcionalmente al cambiar kcal", () => {
  const result = calculateLockedMealMacros({
    kcal: 800,
    macros: { proteina: 1, carbs: 1, grasas: 1 },
    locks: { proteina: false, carbs: false, grasas: false },
    dailyTarget: { proteina: 170, carbs: 206, grasas: 70 },
  });

  assert.ok(Math.abs(result.actualKcal - 800) <= 1);
  assert.ok(result.macros.proteina > 1);
  assert.ok(result.macros.carbs > 1);
  assert.ok(result.macros.grasas > 1);
});

test("informa cuando los macros bloqueados ya superan la meta calórica", () => {
  const result = calculateLockedMealMacros({
    kcal: 500,
    macros: { proteina: 150, carbs: 20, grasas: 10 },
    locks: { proteina: true, carbs: true, grasas: true },
  });

  assert.equal(result.actualKcal, 770);
  assert.equal(result.differenceKcal, 270);
  assert.equal(result.overConstrained, true);
});

for (const mealTypes of [
  ["desayuno", "almuerzo", "cena"],
  ["desayuno", "almuerzo", "merienda", "cena"],
  ["desayuno", "colacion", "almuerzo", "merienda", "cena"],
  ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack"],
]) {
  test(`crea ${mealTypes.length} metas vacías y conserva exactamente el total planificado`, () => {
    const plan = buildPersonalMealTargetDayPlan({
      dailyTarget: { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 },
      mealTypes,
      freeCalories: 200,
      seed: `case-${mealTypes.length}`,
    });
    assert.equal(plan.meals.length, mealTypes.length);
    assert.deepEqual(personalMealTargetTotals(plan.meals), plan.plannedTarget);
    assert.deepEqual(plan.plannedTarget, {
      kcal: 1932,
      proteina: 154.1,
      carbs: 186.7,
      grasas: 63.4,
    });
    assert.equal(plan.freeCalories, 200);
    assert.ok(plan.meals.every((meal) => meal.personalTargetOnly && !meal.foods));
    assert.ok(plan.meals.every((meal) => Number.isInteger(meal.target.kcal)));
    assert.equal(
      plan.meals.reduce((total, meal) => total + meal.target.kcal, 0),
      1932
    );
  });
}

test("el editor puede conservar 1 o 2 metas sin ampliar el flujo normal de creación", () => {
  assert.throws(() => buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 1200, proteina: 90, carbs: 130, grasas: 40 },
    mealTypes: ["desayuno", "cena"],
  }), /entre 3 y 6 comidas/);

  const editedPlan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 1200, proteina: 90, carbs: 130, grasas: 40 },
    mealTypes: ["desayuno", "cena"],
    minimumMealCount: 1,
    seed: "edit-two-targets",
  });
  assert.equal(editedPlan.meals.length, 2);
  assert.deepEqual(personalMealTargetTotals(editedPlan.meals), editedPlan.plannedTarget);
  assert.ok(editedPlan.meals.every((meal) => meal.target.kcal >= 100));
});

test("la distribución personalizada respeta los porcentajes y los macros proporcionales", () => {
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 2000, proteina: 150, carbs: 225, grasas: 55 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    distributionMode: "custom",
    distributionPercentages: { desayuno: 20, almuerzo: 40, cena: 40 },
    freeCalories: 0,
  });
  assert.deepEqual(plan.meals.map((meal) => meal.target.kcal), [400, 800, 800]);
  assert.deepEqual(plan.meals.map((meal) => meal.target.proteina), [30, 60, 60]);
});

test("editar y redistribuir conserva los totales del día sin metas negativas", () => {
  const meals = [
    { id: "a", name: "Desayuno", target: { kcal: 500, proteina: 40, carbs: 50, grasas: 15 } },
    { id: "b", name: "Almuerzo", target: { kcal: 750, proteina: 55, carbs: 75, grasas: 25 } },
    { id: "c", name: "Cena", target: { kcal: 482, proteina: 40, carbs: 48, grasas: 14 } },
  ];
  const result = editPersonalMealTargetDay({
    meals,
    mealId: "a",
    target: { kcal: 600, proteina: 45, carbs: 65, grasas: 18 },
    mode: "redistribute",
    maximumKcal: 2132,
  });
  assert.deepEqual(result.totals, personalMealTargetTotals(meals));
  assert.equal(result.meals[0].target.kcal, 600);
  assert.ok(result.meals.slice(1).every((meal) => Object.values(meal.target).every((value) => value >= 0)));
});

test("redistribuir una reducción suma el faltante a las comidas restantes", () => {
  const meals = [
    { id: "a", name: "Desayuno", target: { kcal: 600, proteina: 40, carbs: 75, grasas: 16 } },
    { id: "b", name: "Almuerzo", target: { kcal: 700, proteina: 50, carbs: 75, grasas: 22 } },
    { id: "c", name: "Cena", target: { kcal: 600, proteina: 40, carbs: 65, grasas: 20 } },
  ];
  const result = editPersonalMealTargetDay({
    meals,
    mealId: "a",
    target: { kcal: 500, proteina: 35, carbs: 60, grasas: 13 },
    mode: "redistribute",
    maximumKcal: 2000,
  });
  assert.equal(result.totals.kcal, 1900);
  assert.equal(result.meals[0].target.kcal, 500);
  assert.equal(result.meals[1].target.kcal + result.meals[2].target.kcal, 1400);
  assert.deepEqual(result.residual, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
});

test("mantener conserva exactamente las otras comidas y cambia sólo la elegida", () => {
  const meals = [
    { id: "a", name: "Desayuno", target: { kcal: 500, proteina: 35, carbs: 60, grasas: 13 } },
    { id: "b", name: "Cena", target: { kcal: 700, proteina: 45, carbs: 80, grasas: 22 } },
  ];
  const result = editPersonalMealTargetDay({
    meals,
    mealId: "a",
    target: { kcal: 550, proteina: 40, carbs: 60, grasas: 16 },
    mode: "keep",
    maximumKcal: 1400,
  });
  assert.deepEqual(result.meals[1], meals[1]);
  assert.equal(result.totals.kcal, 1250);
});

test("redistribuir no modifica un slot excluido porque ya tiene alimentos", () => {
  const meals = [
    { id: "a", name: "Desayuno", target: { kcal: 500, proteina: 35, carbs: 60, grasas: 13 } },
    { id: "b", name: "Almuerzo armado", target: { kcal: 700, proteina: 45, carbs: 80, grasas: 22 } },
    { id: "c", name: "Cena vacía", target: { kcal: 500, proteina: 35, carbs: 60, grasas: 13 } },
  ];
  const result = editPersonalMealTargetDay({
    meals,
    mealId: "a",
    target: { kcal: 600, proteina: 40, carbs: 70, grasas: 18 },
    mode: "redistribute",
    editableMealIds: ["c"],
    maximumKcal: 1800,
  });
  assert.deepEqual(result.meals[1], meals[1]);
  assert.equal(result.meals[2].target.kcal, 400);
});

test("rechaza macros negativos pero permite una diferencia energética manual informativa", () => {
  const meals = [{ id: "a", name: "Desayuno", target: { kcal: 500, proteina: 35, carbs: 60, grasas: 13 } }];
  assert.throws(() => editPersonalMealTargetDay({
    meals,
    mealId: "a",
    target: { kcal: 500, proteina: -1, carbs: 60, grasas: 13 },
  }), /no pueden ser negativas/);
  const result = editPersonalMealTargetDay({
    meals,
    mealId: "a",
    target: { kcal: 500, proteina: 100, carbs: 100, grasas: 20 },
  });
  assert.equal(result.macroKcal, 980);
  assert.equal(result.totals.kcal, 500);
});

test("mantener las demás metas bloquea superar las calorías diarias", () => {
  const meals = [
    { id: "a", name: "Desayuno", target: { kcal: 600, proteina: 40, carbs: 70, grasas: 15 } },
    { id: "b", name: "Cena", target: { kcal: 700, proteina: 45, carbs: 80, grasas: 20 } },
  ];
  assert.throws(() => editPersonalMealTargetDay({
    meals,
    mealId: "a",
    target: { kcal: 1000, proteina: 40, carbs: 70, grasas: 15 },
    mode: "keep",
    maximumKcal: 1500,
  }), /superan el presupuesto calórico/);
});

test("si no hay capacidad para compensar deja las restantes en cero e informa el residual", () => {
  const result = editPersonalMealTargetDay({
    meals: [
      { id: "a", name: "Desayuno", target: { kcal: 500, proteina: 40, carbs: 50, grasas: 15 } },
      { id: "b", name: "Cena", target: { kcal: 100, proteina: 10, carbs: 10, grasas: 2 } },
    ],
    mealId: "a",
    target: { kcal: 650, proteina: 55, carbs: 65, grasas: 19 },
    mode: "redistribute",
    maximumKcal: 700,
  });
  assert.equal(result.meals[1].target.kcal, 0);
  assert.equal(result.residual.kcal, 50);
  assert.ok(Object.values(result.meals[1].target).every((value) => value >= 0));
});

test("bloquea el excedente si las metas posteriores abiertas ya llegaron al mínimo de 100 kcal", () => {
  const meals = [
    { id: "a", target: { kcal: 300, proteina: 25, carbs: 30, grasas: 9 } },
    { id: "b", target: { kcal: 300, proteina: 25, carbs: 30, grasas: 9 } },
    { id: "c", confirmed: true, target: { kcal: 300, proteina: 25, carbs: 30, grasas: 9 } },
    { id: "d", target: { kcal: 300, proteina: 25, carbs: 30, grasas: 9 } },
  ];
  assert.throws(() => editPersonalMealTargetDay({
    meals,
    mealId: "b",
    target: { kcal: 700, proteina: 70, carbs: 59, grasas: 80 },
    mode: "redistribute",
    onlySubsequent: true,
    minimumRecipientKcal: 100,
    maximumKcal: 1200,
  }), /superan el presupuesto calórico/);
});

test("la última meta no acepta macros reales que exceden el menú planificado", () => {
  const calculation = calculateLockedMealMacros({
    kcal: 590,
    macros: { proteina: 90.8, carbs: 63.5, grasas: 100 },
    locks: { proteina: true, carbs: true, grasas: true },
  });
  assert.equal(calculation.actualKcal, 1517.2);

  assert.throws(() => editPersonalMealTargetDay({
    meals: [
      { id: "desayuno", target: { kcal: 645, proteina: 33.4, carbs: 74.6, grasas: 0 } },
      { id: "almuerzo", target: { kcal: 697, proteina: 70, carbs: 59, grasas: 0 } },
      { id: "cena", target: { kcal: 590, proteina: 39.2, carbs: 60.4, grasas: 0 } },
    ],
    mealId: "cena",
    target: { kcal: calculation.actualKcal, ...calculation.macros },
    mode: "redistribute",
    onlySubsequent: true,
    minimumRecipientKcal: 100,
    maximumKcal: 1932,
  }), /superan el presupuesto calórico/);
});

test("acepta macros forzados cuando las metas siguientes pueden absorberlos sin bajar de 100 kcal", () => {
  const result = editPersonalMealTargetDay({
    meals: [
      { id: "desayuno", target: { kcal: 500, proteina: 30, carbs: 55, grasas: 18 } },
      { id: "almuerzo", target: { kcal: 700, proteina: 45, carbs: 75, grasas: 24 } },
      { id: "cena", target: { kcal: 700, proteina: 45, carbs: 75, grasas: 24 } },
    ],
    mealId: "desayuno",
    target: { kcal: 900, proteina: 70, carbs: 80, grasas: 33.3 },
    mode: "redistribute",
    onlySubsequent: true,
    minimumRecipientKcal: 100,
    maximumKcal: 1900,
  });

  assert.equal(result.totals.kcal, 1900);
  assert.equal(result.meals[0].target.kcal, 900);
  assert.ok(result.meals.slice(1).every((meal) => meal.target.kcal >= 100));
});

test("persiste y recarga el candado de confirmación de cada meta", () => {
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 1800, proteina: 120, carbs: 200, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
  });
  plan.meals[1].confirmed = true;
  const configs = personalMealTargetConfigsFromPlan(plan, { idSuffix: "locks" });
  const restored = personalMealTargetsFromTrackingDay({ mealsConfig: configs });

  assert.deepEqual(configs.map((meal) => meal.metaConfirmed), [false, true, false]);
  assert.deepEqual(restored.map((meal) => meal.confirmed), [false, true, false]);
});

test("persistencia reemplaza sólo metas personales vacías y conserva otras comidas", () => {
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget: { kcal: 1800, proteina: 120, carbs: 200, grasas: 60 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
  });
  const configs = personalMealTargetConfigsFromPlan(plan, { idSuffix: "20260826" });
  const replaced = replacePersonalMealTargetConfigs({ mealsConfig: [
    { mealId: "picoteo", tipo: "snack", nombre: "Picoteo", meta: null },
    { mealId: "menu_target_cena_old", tipo: "cena", nombre: "Cena", meta: { kcal: 400 } },
  ] }, configs);
  assert.equal(replaced.length, 4);
  assert.equal(replaced[0].mealId, "picoteo");
  assert.ok(replaced.slice(1).every((meal) => meal.mealId.includes("20260826")));
  assert.deepEqual(personalMealTargetTotals(personalMealTargetsFromTrackingDay({ mealsConfig: replaced })), plan.plannedTarget);
});

test("reconciliación: Picoteo menor, igual o mayor que las libres se deriva sin doble descuento", () => {
  const cases = [
    { food: { kcal: 50, proteina: 3.75, carbs: 5, grasas: 1.5 }, free: 50, difference: 0 },
    { food: { kcal: 100, proteina: 7.5, carbs: 10, grasas: 3 }, free: 0, difference: 0 },
    { food: { kcal: 450, proteina: 30, carbs: 80, grasas: 0 }, free: 0, difference: 350 },
  ];
  cases.forEach(({ food, free, difference }) => {
    const result = reconcile(reconciliationTrackingDay({ picoteo: [food] }));
    assert.equal(result.accounting.freeCaloriesRemaining, free);
    assert.equal(result.difference.kcal, difference);
    assert.equal(result.accounting.remainingDailyTarget.kcal, 2000 - food.kcal);
  });
});

test("reconciliación: agregar y eliminar Picoteo recalcula desde el snapshot y restaura libres", () => {
  const with450 = reconcile(reconciliationTrackingDay({
    picoteo: [{ id: "a", cantidad: 1, kcal: 450, proteina: 30, carbs: 80, grasas: 0 }],
  }));
  const afterDelete = reconcile(reconciliationTrackingDay({
    picoteo: [{ id: "a", cantidad: 0.55, kcal: 250, proteina: 16.7, carbs: 44.4, grasas: 0 }],
  }));
  const emptyAgain = reconcile(reconciliationTrackingDay());

  assert.equal(with450.difference.kcal, 350);
  assert.equal(afterDelete.difference.kcal, 150);
  assert.equal(emptyAgain.difference.kcal, 0);
  assert.equal(emptyAgain.accounting.freeCaloriesRemaining, 100);
  assert.notEqual(with450.signature, afterDelete.signature);
});

test("reconciliación: Picoteo 70 y luego 150 consume primero el buffer sin acumular deltas", () => {
  const first = reconcile(reconciliationTrackingDay({
    picoteo: [{ id: "a", kcal: 70, proteina: 5.25, carbs: 7, grasas: 2.1 }],
  }));
  const second = reconcile(reconciliationTrackingDay({
    picoteo: [
      { id: "a", kcal: 70, proteina: 5.25, carbs: 7, grasas: 2.1 },
      { id: "b", kcal: 80, proteina: 6, carbs: 8, grasas: 2.4 },
    ],
  }));

  assert.equal(first.accounting.freeCaloriesRemaining, 30);
  assert.equal(first.difference.kcal, 0);
  assert.equal(second.accounting.freeCaloriesRemaining, 0);
  assert.equal(second.difference.kcal, 50);
});

test("reconciliación: un exceso de comida usa primero el buffer libre y conserva macros reales", () => {
  const result = reconcile(reconciliationTrackingDay({
    picoteo: [{ kcal: 70, proteina: 2, carbs: 15, grasas: 0 }],
    breakfast: [{ kcal: 680, proteina: 50, carbs: 80, grasas: 18 }],
  }));

  assert.equal(result.accounting.freeCaloriesRemainingBeforeMealBuffer, 30);
  assert.equal(result.accounting.mealExcessBuffered, 30);
  assert.equal(result.accounting.freeCaloriesRemaining, 0);
  assert.equal(result.difference.kcal, 50);
  assert.deepEqual(result.trackedDifference, { kcal: 80, proteina: 5, carbs: 20, grasas: 0 });
  assert.deepEqual(result.accounting.consumed, { kcal: 750, proteina: 52, carbs: 95, grasas: 18 });
});

test("reconciliación: exceso sin libres y déficit son simétricos", () => {
  const options = {
    dailyTarget: { kcal: 1900, proteina: 142.5, carbs: 190, grasas: 57 },
    freeCalories: 0,
  };
  const excess = personalMealTargetDayReconciliation({
    ...options,
    trackingDay: reconciliationTrackingDay({
      breakfast: [{ kcal: 680, proteina: 50, carbs: 80, grasas: 18 }],
    }),
  });
  const deficit = personalMealTargetDayReconciliation({
    ...options,
    completedMealIds: ["menu_target_breakfast"],
    trackingDay: reconciliationTrackingDay({
      breakfast: [{ kcal: 500, proteina: 40, carbs: 50, grasas: 16 }],
    }),
  });

  assert.equal(excess.difference.kcal, 80);
  assert.equal(deficit.difference.kcal, -100);
  assert.equal(excess.residual.kcal, 0);
  assert.equal(deficit.residual.kcal, 0);
  assert.ok(excess.adjustedMeals.find((meal) => meal.id === "menu_target_lunch").target.kcal < 600);
  assert.ok(deficit.adjustedMeals.find((meal) => meal.id === "menu_target_lunch").target.kcal > 600);
});

test("reconciliacion: un alimento parcial en una meta no cierra la comida ni muestra un falso desbalance", () => {
  const dailyTarget = { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 };
  const plan = buildPersonalMealTargetDayPlan({
    dailyTarget,
    mealTypes: ["desayuno", "almuerzo", "cena"],
    freeCalories: 100,
    seed: "arroz-parcial",
  });
  const mealsConfig = personalMealTargetConfigsFromPlan(plan, { idSuffix: "arroz-parcial" });
  const breakfastId = mealsConfig.find((meal) => meal.tipo === "desayuno").mealId;
  const result = personalMealTargetDayReconciliation({
    dailyTarget,
    freeCalories: 100,
    trackingDay: {
      mealsConfig,
      meals: {
        [breakfastId]: [
          { id: "arroz", cantidad: 100, kcal: 338.5, proteina: 8, carbs: 75.5, grasas: 0.5 },
        ],
      },
    },
  });

  assert.deepEqual(result.inProgressMealIds, [breakfastId]);
  assert.deepEqual(result.trackedMealIds, []);
  assert.deepEqual(result.difference, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  assert.equal(result.hasDifference, false);
  assert.equal(result.canAdjust, false);
  assert.equal(result.accounting.freeCaloriesRemaining, 100);
});

test("Tracking manual tolera diferencias chicas y nunca bloquea el registro real", () => {
  const target = { kcal: 667, proteina: 53.1, carbs: 64.2, grasas: 21.9 };
  const review = manualMealTargetOverageReview({
    target,
    consumed: { kcal: 667, proteina: 63.1, carbs: 69.2, grasas: 26.9 },
  });

  assert.equal(review.kind, "within_tolerance");
  assert.equal(review.hasNotice, false);
  assert.equal(review.canContinue, true);
  assert.deepEqual(review.exceededKeys, []);
});

test("Tracking manual informa C/G sobre 5 g o proteína sobre 10 g sin bloquear", () => {
  const target = { kcal: 667, proteina: 53.1, carbs: 64.2, grasas: 21.9 };
  const review = manualMealTargetOverageReview({
    target,
    consumed: { kcal: 660, proteina: 64.2, carbs: 75.5, grasas: 28 },
  });

  assert.equal(review.kind, "informational_overage");
  assert.equal(review.severity, "info");
  assert.equal(review.canContinue, true);
  assert.deepEqual(review.exceededKeys, ["proteina", "carbs", "grasas"]);
  assert.deepEqual(review.excess, { kcal: 0, proteina: 11.1, carbs: 11.3, grasas: 6.1 });
});

test("100 g de arroz sobre la meta de la captura informa sólo carbohidratos", () => {
  const review = manualMealTargetOverageReview({
    target: { kcal: 667, proteina: 53.1, carbs: 64.2, grasas: 21.9 },
    consumed: { kcal: 338.5, proteina: 8, carbs: 75.5, grasas: 0.5 },
  });

  assert.equal(review.canContinue, true);
  assert.equal(review.hasNotice, true);
  assert.deepEqual(review.exceededKeys, ["carbs"]);
  assert.equal(review.excess.carbs, 11.3);
  assert.equal(review.excess.kcal, 0);
});

test("reconciliación: mantener es puro y ajustar conserva la proporción 60/40", () => {
  const day = {
    mealsConfig: [
      { mealId: "menu_target_lunch", tipo: "almuerzo", meta: { kcal: 600, proteina: 60, carbs: 60, grasas: 20 } },
      { mealId: "menu_target_dinner", tipo: "cena", meta: { kcal: 400, proteina: 40, carbs: 40, grasas: 10 } },
    ],
    meals: { picoteo: [{ kcal: 150, proteina: 10, carbs: 20, grasas: 3 }] },
  };
  const snapshot = structuredClone(day);
  const result = personalMealTargetDayReconciliation({
    dailyTarget: { kcal: 1100, proteina: 110, carbs: 120, grasas: 33 },
    trackingDay: day,
    freeCalories: 100,
  });

  assert.deepEqual(day, snapshot);
  assert.deepEqual(result.meals.map((meal) => meal.target.kcal), [600, 400]);
  assert.deepEqual(result.adjustedMeals.map((meal) => meal.target.kcal), [570, 380]);
  assert.equal(result.residual.kcal, 0);
});

test("reconciliación: el mínimo de 100 kcal deja residual y nunca crea valores negativos", () => {
  const result = personalMealTargetDayReconciliation({
    dailyTarget: { kcal: 400, proteina: 40, carbs: 40, grasas: 10 },
    freeCalories: 0,
    trackingDay: {
      mealsConfig: [
        { mealId: "menu_target_lunch", tipo: "almuerzo", meta: { kcal: 200, proteina: 20, carbs: 20, grasas: 5 } },
        { mealId: "menu_target_dinner", tipo: "cena", meta: { kcal: 200, proteina: 20, carbs: 20, grasas: 5 } },
      ],
      meals: { picoteo: [{ kcal: 300, proteina: 50, carbs: 50, grasas: 20 }] },
    },
  });

  assert.deepEqual(result.adjustedMeals.map((meal) => meal.target.kcal), [100, 100]);
  assert.equal(result.residual.kcal, 100);
  assert.equal(result.hasResidual, true);
  result.adjustedMeals.forEach((meal) => {
    assert.ok(Object.values(meal.target).every((value) => value >= 0));
  });
  assert.deepEqual(result.adjustedMeals.map((meal) => meal.target.proteina), [0, 0]);
});

test("reconciliación: comidas con consumo y metas confirmadas quedan preservadas", () => {
  const result = reconcile(reconciliationTrackingDay({
    breakfast: [{ kcal: 680, proteina: 50, carbs: 80, grasas: 18 }],
    confirmedLunch: true,
  }), { freeCalories: 0 });
  const byId = new Map(result.adjustedMeals.map((meal) => [meal.id, meal.target]));

  assert.deepEqual(byId.get("menu_target_breakfast"), { kcal: 600, proteina: 45, carbs: 60, grasas: 18 });
  assert.deepEqual(byId.get("menu_target_lunch"), { kcal: 600, proteina: 45, carbs: 60, grasas: 18 });
  assert.deepEqual(result.eligibleMealIds, ["menu_target_dinner"]);
  assert.deepEqual(result.fixedMealIds, ["menu_target_lunch"]);
});

test("reconciliación: una meta con composición planificada se preserva y ajusta sólo las vacías", () => {
  const day = reconciliationTrackingDay({
    picoteo: [{ id: "snack", cantidad: 150, kcal: 150, proteina: 0, carbs: 30, grasas: 3 }],
  });
  const originalBreakfast = structuredClone(day.mealsConfig[0].meta);
  const result = reconcile(day, {
    preservedMealIds: ["menu_target_breakfast"],
  });
  const adjustedById = new Map(result.adjustedMeals.map((meal) => [meal.id, meal.target]));

  assert.deepEqual(adjustedById.get("menu_target_breakfast"), originalBreakfast);
  assert.deepEqual(result.preservedMealIds, ["menu_target_breakfast"]);
  assert.deepEqual(result.eligibleMealIds, ["menu_target_lunch", "menu_target_dinner"]);
  assert.equal(day.meals.menu_target_breakfast.length, 0);
});

test("la planificación identifica composiciones activas por mealId y descarta reemplazos inactivos", () => {
  const ids = personalMealTargetPlannedIds({
    tracking: {
      mealReplacements: [
        {
          originalMealId: "menu_target_breakfast",
          replacesMealIds: ["menu_target_breakfast"],
          foods: [{ id: "rice" }],
          isActiveReplacement: true,
        },
        {
          originalMealId: "menu_target_lunch",
          replacesMealIds: ["menu_target_lunch"],
          foods: [{ id: "chicken" }],
          isActiveReplacement: false,
        },
      ],
      foodReplacements: [
        {
          originalMealId: "menu_target_dinner",
          foods: [{ id: "potato" }],
        },
      ],
    },
  });

  assert.deepEqual(ids, ["menu_target_breakfast", "menu_target_dinner"]);
});

test("reconciliación: si sólo queda una meta vacía, las armadas no cambian", () => {
  const day = reconciliationTrackingDay({
    picoteo: [{ id: "snack", cantidad: 250, kcal: 250, proteina: 5, carbs: 40, grasas: 8 }],
  });
  const original = day.mealsConfig.map((meal) => structuredClone(meal.meta));
  const result = reconcile(day, {
    preservedMealIds: ["menu_target_breakfast", "menu_target_lunch"],
  });

  assert.deepEqual(result.eligibleMealIds, ["menu_target_dinner"]);
  assert.deepEqual(result.adjustedMeals[0].target, original[0]);
  assert.deepEqual(result.adjustedMeals[1].target, original[1]);
  assert.notDeepEqual(result.adjustedMeals[2].target, original[2]);
});

test("reconciliación: sin metas vacías elegibles informa residual sin modificar las armadas", () => {
  const day = reconciliationTrackingDay({
    picoteo: [{ id: "snack", cantidad: 450, kcal: 450, proteina: 30, carbs: 80, grasas: 0 }],
  });
  const original = day.mealsConfig.map((meal) => structuredClone(meal.meta));
  const result = reconcile(day, {
    preservedMealIds: [
      "menu_target_breakfast",
      "menu_target_lunch",
      "menu_target_dinner",
    ],
  });

  assert.deepEqual(result.eligibleMealIds, []);
  assert.equal(result.canAdjust, false);
  assert.equal(result.hasResidual, true);
  assert.deepEqual(result.adjustedMeals.map((meal) => meal.target), original);
});

test("editar consumo y agregar o quitar Picoteo recalcula desde el snapshot sin deltas", () => {
  const configs = [
    { mealId: "menu_target_breakfast", tipo: "desayuno", meta: { kcal: 500, proteina: 40, carbs: 60, grasas: 12 } },
    { mealId: "menu_target_lunch", tipo: "almuerzo", meta: { kcal: 700, proteina: 55, carbs: 70, grasas: 22 } },
    { mealId: "menu_target_dinner", tipo: "cena", meta: { kcal: 700, proteina: 55, carbs: 70, grasas: 22 } },
  ];
  const rice = (quantity) => ({
    id: "rice",
    cantidad: quantity,
    kcal: 338.5 * quantity / 100,
    proteina: 8 * quantity / 100,
    carbs: 75.5 * quantity / 100,
    grasas: 0.5 * quantity / 100,
  });
  const run = (quantity, picoteoKcal) => personalMealTargetDayReconciliation({
    dailyTarget: { kcal: 2000, proteina: 150, carbs: 200, grasas: 56 },
    freeCalories: 100,
    completedMealIds: ["menu_target_breakfast"],
    preservedMealIds: ["menu_target_lunch"],
    trackingDay: {
      mealsConfig: configs,
      meals: {
        menu_target_breakfast: [rice(quantity)],
        menu_target_lunch: [],
        menu_target_dinner: [],
        picoteo: picoteoKcal > 0
          ? [{ id: "snack", cantidad: picoteoKcal, kcal: picoteoKcal, carbs: picoteoKcal / 5 }]
          : [],
      },
    },
  });

  const beforeEdit = run(100, 150);
  const afterEdit = run(120, 150);
  const sameSnapshot = run(120, 150);
  const afterPicoteoDelete = run(120, 0);

  assert.deepEqual(afterEdit.eligibleMealIds, ["menu_target_dinner"]);
  assert.deepEqual(afterEdit.adjustedMeals.slice(0, 2).map((meal) => meal.target), configs.slice(0, 2).map((meal) => meal.meta));
  assert.deepEqual(afterEdit.adjustedMeals, sameSnapshot.adjustedMeals);
  assert.equal(beforeEdit.adjustedMeals[2].target.kcal, 812);
  assert.equal(afterEdit.adjustedMeals[2].target.kcal, 744);
  assert.equal(afterPicoteoDelete.adjustedMeals[2].target.kcal, 794);
  assert.equal(afterEdit.accounting.freeCaloriesRemaining, 0);
  assert.equal(afterPicoteoDelete.accounting.freeCaloriesRemaining, 100);
});

test("reconciliación: sin metas elegibles entrega forecast pero no ofrece ajustar", () => {
  const result = reconcile(reconciliationTrackingDay({
    picoteo: [{ kcal: 450, proteina: 30, carbs: 80, grasas: 0 }],
    confirmedLunch: true,
    confirmedDinner: true,
    breakfast: [{ kcal: 600, proteina: 45, carbs: 60, grasas: 18 }],
  }));

  assert.equal(result.hasDifference, true);
  assert.equal(result.canAdjust, false);
  assert.deepEqual(result.eligibleMealIds, []);
  assert.deepEqual(result.adjustedMeals, result.meals);
});

test("reconciliación: cambios consecutivos iguales no generan drift", () => {
  const day = reconciliationTrackingDay({
    picoteo: [{ id: "snack", cantidad: 100, kcal: 450, proteina: 30, carbs: 80, grasas: 0 }],
  });
  const first = reconcile(day);
  const second = reconcile(structuredClone(day));

  assert.deepEqual(second.adjustedMeals, first.adjustedMeals);
  assert.deepEqual(second.residual, first.residual);
  assert.equal(second.signature, first.signature);
});

test("reconciliación: persistir reemplaza sólo metas elegibles y conserva configuración ajena", () => {
  const day = reconciliationTrackingDay({
    breakfast: [{ kcal: 680, proteina: 50, carbs: 80, grasas: 18 }],
    confirmedLunch: true,
  });
  day.mealsConfig.push({ mealId: "coach_slot", tipo: "merienda", meta: { kcal: 300 }, owner: "coach" });
  const original = structuredClone(day.mealsConfig);
  const result = reconcile(day, { freeCalories: 0 });
  const configs = personalMealTargetConfigsFromReconciliation(day, result);

  assert.deepEqual(day.mealsConfig, original);
  assert.deepEqual(configs[0], original[0]);
  assert.deepEqual(configs[1], original[1]);
  assert.notDeepEqual(configs[2].meta, original[2].meta);
  assert.deepEqual(configs[3], original[3]);
});
