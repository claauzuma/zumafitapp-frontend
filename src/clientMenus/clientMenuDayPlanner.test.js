import assert from "node:assert/strict";
import test from "node:test";

import {
  balancedMealDistribution,
  buildDayDistribution,
  buildDayMealSlots,
  generateSequentialMenuDay,
  mealHasPlannedContent,
  nextSequentialMealTarget,
  plannedMealNutrition,
  proteinFeasibility,
} from "./clientMenuDayPlanner.js";

const MEAL_TYPES = {
  3: ["desayuno", "almuerzo", "cena"],
  4: ["desayuno", "almuerzo", "merienda", "cena"],
  5: ["desayuno", "almuerzo", "merienda", "cena", "snack"],
  6: ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack"],
};

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function generatedMeal(type, totals, suffix = "") {
  return {
    id: `meal-${type}${suffix}`,
    tipoComida: type,
    nombre: type,
    items: [{
      id: `food-${type}${suffix}`,
      alimentoId: `food-${type}${suffix}`,
      nombreSnapshot: `Alimento ${type}`,
      cantidad: 1,
      unidad: "unidad",
      ...totals,
    }],
  };
}

test("Equilibrado respeta límites y suma 100% en 500 seeds por cada cantidad", () => {
  const bounds = {
    3: [0.2, 0.4],
    4: [0.2, 0.4],
    5: [0.15, 0.4],
    6: [0.15, 0.25],
  };
  for (const count of [3, 4, 5, 6]) {
    const signatures = new Set();
    for (let seed = 0; seed < 500; seed += 1) {
      const values = balancedMealDistribution(count, { seed: `${count}:${seed}` });
      signatures.add(values.join("|"));
      assert.equal(values.length, count);
      assert.ok(values.every(Number.isFinite));
      assert.ok(values.every((value) => value >= bounds[count][0] - 1e-9));
      assert.ok(values.every((value) => value <= bounds[count][1] + 1e-9));
      assert.ok(Math.abs(sum(values) - 1) <= 1e-9);
    }
    assert.ok(signatures.size > 450, `${count} comidas debe variar entre seeds`);
  }
});

test("el mismo seed reproduce la distribución y otro seed produce variación", () => {
  const first = balancedMealDistribution(4, { seed: "run-42" });
  assert.deepEqual(first, balancedMealDistribution(4, { seed: "run-42" }));
  assert.notDeepEqual(first, balancedMealDistribution(4, { seed: "run-43" }));
});

test("distribución manual conserva la relación configurada", () => {
  const result = buildDayDistribution({
    mealTypes: MEAL_TYPES[4],
    mode: "custom",
    percentages: { desayuno: 25, almuerzo: 35, merienda: 15, cena: 25 },
  });
  assert.deepEqual(result.weights, [0.25, 0.35, 0.15, 0.25]);
  assert.equal(result.source, "custom");
});

test("slot vacío o sólo con meta no cuenta; una cantidad física sí cuenta", () => {
  assert.equal(mealHasPlannedContent({ target: { kcal: 600 }, items: [] }), false);
  assert.equal(mealHasPlannedContent({ items: [{ alimentoId: "arroz", cantidad: 0 }] }), false);
  assert.equal(mealHasPlannedContent({ items: [{ alimentoId: "arroz", cantidad: 100 }] }), true);
});

test("cantidad total incompatible no borra comidas y falla con detalle", () => {
  const plannedMeals = ["a", "b", "c", "d"].map((id, index) => generatedMeal(
    index === 0 ? "desayuno" : `slot-${index}`,
    { kcal: 400, proteina: 30, carbs: 40, grasas: 10 },
    id
  ));
  assert.throws(
    () => buildDayMealSlots({ mealTypes: MEAL_TYPES[3], plannedMeals }),
    (error) => error?.code === "MENU_MEAL_COUNT_CONFLICT" && error.details.fixedMealCount === 4
  );
  assert.equal(plannedMeals.length, 4);
});

test("0/1/2/3/4 existentes sobre 4 generan exactamente el faltante sin mutarlas", async () => {
  const target = { kcal: 2300, proteina: 170, carbs: 248, grasas: 70 };
  for (let existingCount = 0; existingCount <= 4; existingCount += 1) {
    const fixed = MEAL_TYPES[4].slice(0, existingCount).map((type, index) => generatedMeal(
      type,
      { kcal: 400 + index * 10, proteina: 25, carbs: 40, grasas: 12 },
      `-fixed-${index}`
    ));
    const snapshot = structuredClone(fixed);
    let calls = 0;
    const result = await generateSequentialMenuDay({
      dailyTarget: target,
      mealTypes: MEAL_TYPES[4],
      plannedMeals: fixed,
      seed: `partial-${existingCount}`,
      generateMeal: async ({ slot, target: mealTarget }) => {
        calls += 1;
        return generatedMeal(slot.type, mealTarget, `-generated-${calls}`);
      },
    });
    assert.equal(calls, 4 - existingCount);
    assert.equal(result.meals.length, 4);
    assert.equal(result.generatedCount, 4 - existingCount);
    assert.deepEqual(fixed, snapshot);
    for (let index = 0; index < existingCount; index += 1) {
      assert.strictEqual(result.meals[index], fixed[index]);
    }
  }
});

test("una meta personal reservada ocupa su slot y el solver recibe sólo el restante diario", async () => {
  const reserved = {
    id: "menu_target_almuerzo_manual",
    type: "almuerzo",
    name: "Almuerzo",
    target: { kcal: 500, proteina: 40, carbs: 50, grasas: 15 },
    personalTargetOnly: true,
  };
  const calls = [];
  const result = await generateSequentialMenuDay({
    dailyTarget: { kcal: 2000, proteina: 150, carbs: 210, grasas: 62 },
    mealTypes: MEAL_TYPES[3],
    reservedMealTargets: [reserved],
    seed: "reserved-target",
    generateMeal: async ({ slot, target }) => {
      calls.push({ type: slot.type, target });
      return generatedMeal(slot.type, target, `-${calls.length}`);
    },
  });

  assert.equal(calls.length, 2);
  assert.deepEqual(calls.map((call) => call.type), ["desayuno", "cena"]);
  assert.deepEqual(result.reservedTotals, reserved.target);
  assert.deepEqual(result.totals, { kcal: 2000, proteina: 150, carbs: 210, grasas: 62 });
  assert.equal(result.trace.find((entry) => entry.status === "reserved_target")?.mealId, reserved.id);
  assert.equal(result.meals.length, 2);
});

test("los alimentos ya registrados forman una base diaria y el solver cubre sólo kcal y macros restantes", async () => {
  const consumedBaseline = { kcal: 300, proteina: 20, carbs: 38, grasas: 8 };
  const calls = [];
  const result = await generateSequentialMenuDay({
    dailyTarget: { kcal: 1800, proteina: 140, carbs: 190, grasas: 55 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    consumedBaseline,
    seed: "tracked-before-generation",
    generateMeal: async ({ slot, target, remainingBefore }) => {
      calls.push({ slot: slot.type, target, remainingBefore });
      return generatedMeal(slot.type, target, `-${calls.length}`);
    },
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(calls[0].remainingBefore, {
    kcal: 1500,
    proteina: 120,
    carbs: 152,
    grasas: 47,
  });
  assert.deepEqual(result.consumedBaselineTotals, consumedBaseline);
  assert.deepEqual(result.totals, { kcal: 1800, proteina: 140, carbs: 190, grasas: 55 });
  assert.deepEqual(result.rawRemaining, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  assert.equal(result.meals.length, 3);
});

test("cada slot recibe preservadas, propuesta anterior y composiciones ya generadas", async () => {
  const fixed = generatedMeal("desayuno", { kcal: 400, proteina: 25, carbs: 40, grasas: 12 }, "-fixed");
  const priorPreview = generatedMeal("cena", { kcal: 500, proteina: 35, carbs: 50, grasas: 15 }, "-prior");
  const contexts = [];
  await generateSequentialMenuDay({
    dailyTarget: { kcal: 1800, proteina: 120, carbs: 200, grasas: 50 },
    mealTypes: MEAL_TYPES[3],
    plannedMeals: [fixed],
    diversityMeals: [priorPreview],
    seed: "diversity-context",
    generateMeal: async ({ slot, target, previousMeals }) => {
      contexts.push(previousMeals);
      return generatedMeal(slot.type, target, `-${contexts.length}`);
    },
  });

  assert.deepEqual(contexts[0], [priorPreview, fixed]);
  assert.equal(contexts[1][0], priorPreview);
  assert.equal(contexts[1][1], fixed);
  assert.equal(contexts[1][2].tipoComida, "almuerzo");
});

test("día vacío genera exactamente 3, 4, 5 o 6 comidas y cierra el objetivo", async () => {
  const cases = [
    [3, { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 }],
    [4, { kcal: 2300, proteina: 170, carbs: 248, grasas: 70 }],
    [5, { kcal: 2500, proteina: 180, carbs: 290, grasas: 70 }],
    [6, { kcal: 2700, proteina: 210, carbs: 315, grasas: 75 }],
  ];
  for (const [count, target] of cases) {
    const receivedTargets = [];
    const result = await generateSequentialMenuDay({
      dailyTarget: target,
      mealTypes: MEAL_TYPES[count],
      seed: `full-day-${count}`,
      generateMeal: async ({ slot, target: mealTarget }) => {
        receivedTargets.push(mealTarget);
        return generatedMeal(slot.type, mealTarget, `-${count}-${slot.index}`);
      },
    });

    assert.equal(result.meals.length, count);
    assert.equal(result.generatedCount, count);
    assert.equal(result.fixedMeals.length, 0);
    assert.ok(receivedTargets.every((mealTarget) => (
      mealTarget.proteina >= 10 && mealTarget.proteina <= 70
    )));
    assert.ok(receivedTargets.every((mealTarget) => mealTarget.carbs > mealTarget.grasas));
    for (const key of ["kcal", "proteina", "carbs", "grasas"]) {
      assert.ok(Math.abs(result.difference[key]) <= 0.02, `${count} comidas: diferencia ${key}`);
    }
  }
});

test("dos existentes con total cinco generan tres", async () => {
  const fixed = [
    generatedMeal("desayuno", { kcal: 500, proteina: 35, carbs: 55, grasas: 15 }, "-fixed"),
    generatedMeal("almuerzo", { kcal: 600, proteina: 40, carbs: 65, grasas: 18 }, "-fixed"),
  ];
  let calls = 0;
  const result = await generateSequentialMenuDay({
    dailyTarget: { kcal: 2600, proteina: 180, carbs: 300, grasas: 75 },
    mealTypes: MEAL_TYPES[5],
    plannedMeals: fixed,
    seed: "five-partial",
    generateMeal: async ({ slot, target }) => {
      calls += 1;
      return generatedMeal(slot.type, target, `-${calls}`);
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.generatedCount, 3);
});

test("una comida fija se resta por contenido real, no por su target", async () => {
  const breakfast = generatedMeal(
    "desayuno",
    { kcal: 550, proteina: 35, carbs: 60, grasas: 18 },
    "-fixed"
  );
  breakfast.target = { kcal: 500, proteina: 30, carbs: 50, grasas: 15 };
  const calls = [];
  const result = await generateSequentialMenuDay({
    dailyTarget: { kcal: 2300, proteina: 170, carbs: 248, grasas: 70 },
    mealTypes: MEAL_TYPES[4],
    plannedMeals: [breakfast],
    distributionMode: "custom",
    distributionPercentages: { desayuno: 25, almuerzo: 35, merienda: 15, cena: 25 },
    generateMeal: async (context) => {
      calls.push(context);
      return generatedMeal(context.slot.type, context.target, `-${calls.length}`);
    },
  });
  assert.deepEqual(result.fixedTotals, { kcal: 550, proteina: 35, carbs: 60, grasas: 18 });
  assert.deepEqual(calls[0].remainingBefore, { kcal: 1750, proteina: 135, carbs: 188, grasas: 52 });
  assert.equal(calls.length, 3);
  assert.ok(Math.abs(calls[0].target.kcal - 816.67) < 0.02);
  assert.strictEqual(result.meals[0], breakfast);
});

test("faltantes y excesos reales se arrastran recalculando desde el restante", async () => {
  const seen = [];
  const actuals = [
    { kcal: 575, proteina: 41, carbs: 68, grasas: 15 },
    { kcal: 615, proteina: 46, carbs: 70, grasas: 17 },
    { kcal: 910, proteina: 63, carbs: 102, grasas: 28 },
  ];
  const result = await generateSequentialMenuDay({
    dailyTarget: { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 },
    mealTypes: MEAL_TYPES[3],
    distributionMode: "custom",
    distributionPercentages: { desayuno: 30, almuerzo: 30, cena: 40 },
    generateMeal: async (context) => {
      seen.push(context);
      return generatedMeal(context.slot.type, actuals[seen.length - 1], `-${seen.length}`);
    },
  });
  assert.deepEqual(seen[1].remainingBefore, { kcal: 1525, proteina: 109, carbs: 172, grasas: 45 });
  assert.deepEqual(seen[2].remainingBefore, { kcal: 910, proteina: 63, carbs: 102, grasas: 28 });
  assert.deepEqual(seen[2].target, { kcal: 910, proteina: 63, carbs: 102, grasas: 28 });
  assert.deepEqual(result.difference, { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
});

test("la diferencia diaria queda informativa y no crea una segunda clasificación nutricional", async () => {
  const result = await generateSequentialMenuDay({
    dailyTarget: { kcal: 2100, proteina: 150, carbs: 240, grasas: 60 },
    mealTypes: MEAL_TYPES[3],
    seed: "macro-best-effort",
    generateMeal: async ({ slot }) => generatedMeal(
      slot.type,
      { kcal: 700, proteina: 50, carbs: 70, grasas: 15 },
      `-${slot.index}`
    ),
  });
  assert.deepEqual(result.difference, { kcal: 0, proteina: 0, carbs: -30, grasas: -15 });
  assert.equal(result.warnings.some((entry) => (
    entry.code === "MENU_GLOBAL_KCAL_TOLERANCE_NOT_REACHED" ||
    entry.code === "MENU_GLOBAL_MACRO_TARGET_NOT_REACHED"
  )), false);
});

test("targets factibles conservan macros, P 10-70 y C mayor que G", () => {
  for (let seed = 0; seed < 300; seed += 1) {
    let remaining = { kcal: 2300, proteina: 170, carbs: 248, grasas: 70 };
    let weights = balancedMealDistribution(4, { seed });
    const targets = [];
    for (let index = 0; index < 4; index += 1) {
      const result = nextSequentialMealTarget({
        rawRemaining: remaining,
        remainingSlotWeights: weights.slice(index),
      });
      targets.push(result.target);
      remaining = {
        kcal: remaining.kcal - result.target.kcal,
        proteina: remaining.proteina - result.target.proteina,
        carbs: remaining.carbs - result.target.carbs,
        grasas: remaining.grasas - result.target.grasas,
      };
    }
    assert.ok(targets.every((target) => target.proteina >= 10 && target.proteina <= 70));
    assert.ok(targets.every((target) => target.carbs > target.grasas));
    assert.ok(Math.abs(sum(targets.map((target) => target.proteina)) - 170) <= 0.05);
    assert.ok(Math.abs(sum(targets.map((target) => target.carbs)) - 248) <= 0.05);
    assert.ok(Math.abs(sum(targets.map((target) => target.grasas)) - 70) <= 0.05);
  }
});

test("proteína imposible se diagnostica sin asignar más de 70 silenciosamente", () => {
  const high = proteinFeasibility(300, 4);
  const low = proteinFeasibility(20, 4);
  assert.equal(high.feasible, false);
  assert.equal(high.warning.code, "MENU_PROTEIN_ABOVE_FEASIBLE_RANGE");
  assert.equal(low.feasible, false);
  assert.equal(low.warning.code, "MENU_PROTEIN_BELOW_FEASIBLE_RANGE");
  const first = nextSequentialMealTarget({
    rawRemaining: { kcal: 2400, proteina: 300, carbs: 250, grasas: 70 },
    remainingSlotWeights: [0.25, 0.25, 0.25, 0.25],
  });
  assert.equal(first.target.proteina, 70);
});

test("plannedMealNutrition ignora la meta declarada cuando hay resultado físico", () => {
  const meal = generatedMeal("almuerzo", { kcal: 638, proteina: 47, carbs: 67, grasas: 19 });
  meal.target = { kcal: 650, proteina: 45, carbs: 70, grasas: 20 };
  assert.deepEqual(plannedMealNutrition(meal), { kcal: 638, proteina: 47, carbs: 67, grasas: 19 });
});

test("plannedMealNutrition conserva ceros físicos en vez de reemplazarlos por la meta declarada", () => {
  const meal = {
    target: { kcal: 300, proteina: 25, carbs: 40, grasas: 8 },
    items: [{
      alimentoId: "protein-only",
      cantidad: 100,
      unidad: "g",
      kcal: 165,
      proteina: 31,
      carbs: 0,
      grasas: 0,
    }],
  };

  assert.deepEqual(plannedMealNutrition(meal), {
    kcal: 165,
    proteina: 31,
    carbs: 0,
    grasas: 0,
  });
});

test("plannedMealNutrition distingue un nutriente ausente de un total real agregado", () => {
  const target = { kcal: 300, proteina: 25, carbs: 40, grasas: 8 };
  const itemNutritionOnly = {
    target,
    items: [{ alimentoId: "legacy", cantidad: 100, unidad: "g", kcal: 165, proteina: 31 }],
  };
  const aggregateNutrition = {
    target,
    totals: { kcal: 165, proteina: 31, carbs: 0, grasas: 0 },
    items: [{ alimentoId: "legacy", cantidad: 100, unidad: "g" }],
  };

  assert.deepEqual(plannedMealNutrition(itemNutritionOnly), {
    kcal: 165,
    proteina: 31,
    carbs: 0,
    grasas: 0,
  });
  assert.deepEqual(plannedMealNutrition(aggregateNutrition), {
    kcal: 165,
    proteina: 31,
    carbs: 0,
    grasas: 0,
  });
});
