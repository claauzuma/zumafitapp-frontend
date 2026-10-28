import assert from "node:assert/strict";
import test from "node:test";

import {
  confirmPersonalMealTargetConsumption,
  editPersonalMealTargetDay,
  personalMealTargetCompletionState,
  personalMealTargetConsumedComposition,
  personalMealTargetsFromTrackingDay,
  reopenPersonalMealTargetConsumption,
  updateCoachMealTargetExecution,
} from "./quickMealTargetPlan.js";

const DAILY = { kcal: 2000, proteina: 150, carbs: 220, grasas: 60 };
const IDS = {
  breakfast: "menu_target_breakfast",
  lunch: "menu_target_lunch",
  snack: "menu_target_snack",
  dinner: "menu_target_dinner",
};

function config(mealId, kcal, proteina, carbs, grasas, metaConfirmed = false) {
  return {
    mealId,
    tipo: "otra",
    nombre: mealId,
    meta: { kcal, proteina, carbs, grasas },
    metaConfirmed,
    targetOrigin: "auto",
  };
}

function food(kcal, proteina = 35, carbs = 55, grasas = 14, id = "food-1") {
  return { id, nombre: "Alimento consumido", kcal, proteina, carbs, grasas, cantidad: 100 };
}

function baseDay({ meals = {}, configs = null } = {}) {
  return {
    date: "2026-10-12",
    mealsConfig: configs || [
      config(IDS.breakfast, 700, 45, 80, 20),
      config(IDS.lunch, 600, 45, 70, 18),
      config(IDS.snack, 300, 25, 30, 8),
      config(IDS.dinner, 400, 35, 40, 14),
    ],
    meals,
    totals: { kcal: 0, proteina: 0, carbs: 0, grasas: 0 },
  };
}

function dayWithBreakfast(kcal = 500, macros = {}) {
  return baseDay({
    meals: {
      [IDS.breakfast]: [food(
        kcal,
        macros.proteina ?? 35,
        macros.carbs ?? 55,
        macros.grasas ?? 14
      )],
    },
  });
}

function closeTarget(trackingDay = dayWithBreakfast(), overrides = {}) {
  return confirmPersonalMealTargetConsumption({
    trackingDay,
    mealId: IDS.breakfast,
    dailyTarget: DAILY,
    ...overrides,
  });
}

function targetOf(result, mealId) {
  return result.mealsConfig.find((meal) => meal.mealId === mealId)?.meta;
}

function completion(kcal, options = {}) {
  return personalMealTargetCompletionState({
    target: options.target || { kcal: 700, proteina: 45, carbs: 80, grasas: 20 },
    consumed: options.consumed || { kcal, proteina: 1, carbs: 1, grasas: 1 },
    trackedItemsCount: options.trackedItemsCount ?? 1,
    metaConfirmed: options.metaConfirmed,
    confirmation: options.confirmation,
  });
}

test("1. una comida vacía no se puede cerrar", () => {
  assert.throws(() => closeTarget(baseDay()), /Registrá al menos un alimento/);
});

test("2. 690 kcal para una meta de 700 se completa automáticamente", () => {
  assert.equal(completion(690).automatic, true);
});

test("3. 700 kcal para una meta de 700 se completa automáticamente", () => {
  assert.equal(completion(700).automatic, true);
});

test("4. 710 kcal para una meta de 700 se completa automáticamente", () => {
  assert.equal(completion(710).automatic, true);
});

test("5. los límites exteriores 689 y 711 no se completan automáticamente", () => {
  assert.equal(completion(689).automatic, false);
  assert.equal(completion(711).automatic, false);
});

test("6. los macros no intervienen en el cierre automático", () => {
  assert.equal(completion(700, {
    consumed: { kcal: 700, proteina: 0, carbs: 175, grasas: 0 },
  }).automatic, true);
});

test("6b. un cierre automático vigente no se puede reabrir manualmente", () => {
  const state = completion(700);
  assert.equal(state.completed, true);
  assert.equal(state.canReopen, false);
  assert.equal(state.canManuallyConfirm, false);
});

test("7. sin FoodLogs no hay cierre automático aunque las kcal coincidan", () => {
  assert.equal(completion(700, { trackedItemsCount: 0 }).automatic, false);
});

test("8. el cierre automático no persiste ni modifica configuraciones", () => {
  const day = dayWithBreakfast(700);
  const snapshot = structuredClone(day.mealsConfig);
  assert.equal(completion(700).completed, true);
  assert.deepEqual(day.mealsConfig, snapshot);
});

test("9. el cierre manual fija kcal y macros exactamente al consumo real", () => {
  const result = closeTarget(dayWithBreakfast(492.3, {
    proteina: 41.4,
    carbs: 60.4,
    grasas: 5.4,
  }));
  assert.deepEqual(targetOf(result, IDS.breakfast), {
    kcal: 492.3,
    proteina: 41.4,
    carbs: 60.4,
    grasas: 5.4,
  });
});

test("9b. permite cerrar una meta personal que conservó el ID estable del almuerzo", () => {
  const stableId = "almuerzo";
  const day = baseDay({
    configs: [
      { ...config(stableId, 700, 45, 80, 20), personalTarget: true },
      config(IDS.breakfast, 400, 30, 40, 12),
      config(IDS.snack, 300, 25, 30, 8),
      config(IDS.dinner, 600, 50, 70, 20),
    ],
    meals: {
      [stableId]: [food(500, 35, 55, 14)],
    },
  });

  const result = confirmPersonalMealTargetConsumption({
    trackingDay: day,
    mealId: stableId,
    dailyTarget: DAILY,
  });
  const saved = result.mealsConfig.find((meal) => meal.mealId === stableId);

  assert.deepEqual(saved.meta, {
    kcal: 500,
    proteina: 35,
    carbs: 55,
    grasas: 14,
  });
  assert.equal(saved.metaConfirmed, true);
  assert.equal(saved.metaConfirmation.mode, "manual_consumption");
});

test("10. dentro de ±10 no permite crear un falso cierre manual", () => {
  assert.throws(() => closeTarget(dayWithBreakfast(690)), /automáticamente/);
  assert.throws(() => closeTarget(dayWithBreakfast(710)), /automáticamente/);
});

test("11. el cierre manual conserva la meta previa para reabrir", () => {
  const result = closeTarget();
  const saved = result.mealsConfig.find((meal) => meal.mealId === IDS.breakfast);
  assert.equal(saved.metaConfirmed, true);
  assert.equal(saved.metaConfirmation.mode, "manual_consumption");
  assert.deepEqual(saved.metaConfirmation.previousMeta, {
    kcal: 700,
    proteina: 45,
    carbs: 80,
    grasas: 20,
  });
});

test("12. cerrar no crea, elimina ni duplica FoodLogs", () => {
  const day = dayWithBreakfast();
  const snapshot = structuredClone(day.meals);
  closeTarget(day);
  assert.deepEqual(day.meals, snapshot);
  assert.equal(day.meals[IDS.breakfast].length, 1);
});

test("13. la diferencia liberada se redistribuye mediante el reconciliador", () => {
  const result = closeTarget();
  const recipients = [IDS.lunch, IDS.snack, IDS.dinner]
    .reduce((sum, id) => sum + targetOf(result, id).kcal, 0);
  assert.equal(recipients, 1500);
});

test("13b. un exceso manual ajusta la meta y reduce las metas elegibles", () => {
  const result = closeTarget(dayWithBreakfast(800, {
    proteina: 55,
    carbs: 95,
    grasas: 23,
  }));
  assert.deepEqual(targetOf(result, IDS.breakfast), {
    kcal: 800,
    proteina: 55,
    carbs: 95,
    grasas: 23,
  });
  const recipients = [IDS.lunch, IDS.snack, IDS.dinner]
    .reduce((sum, id) => sum + targetOf(result, id).kcal, 0);
  assert.equal(recipients, 1200);
});

test("14. una comida con Tracking permanece protegida al redistribuir", () => {
  const day = dayWithBreakfast();
  day.meals[IDS.lunch] = [food(100, 10, 10, 2, "lunch-food")];
  const result = closeTarget(day);
  assert.deepEqual(targetOf(result, IDS.lunch), day.mealsConfig[1].meta);
});

test("15. una meta ya confirmada permanece protegida al redistribuir", () => {
  const day = dayWithBreakfast();
  day.mealsConfig = day.mealsConfig.map((meal) => (
    meal.mealId === IDS.lunch ? { ...meal, metaConfirmed: true } : meal
  ));
  const result = closeTarget(day);
  assert.deepEqual(targetOf(result, IDS.lunch), day.mealsConfig[1].meta);
});

test("16. confirmar dos veces es idempotente", () => {
  const day = dayWithBreakfast();
  const first = closeTarget(day);
  const second = closeTarget({ ...day, mealsConfig: first.mealsConfig });
  assert.equal(second.alreadyConfirmed, true);
  assert.deepEqual(second.mealsConfig, first.mealsConfig);
});

test("17. al recargar un cierre manual no se confunde con automático", () => {
  const day = dayWithBreakfast();
  const result = closeTarget(day);
  const restored = personalMealTargetsFromTrackingDay({ mealsConfig: result.mealsConfig });
  const meal = restored.find((entry) => entry.id === IDS.breakfast);
  const state = personalMealTargetCompletionState({
    target: meal.target,
    consumed: personalMealTargetConsumedComposition(day, IDS.breakfast).totals,
    trackedItemsCount: 1,
    metaConfirmed: meal.metaConfirmed,
    confirmation: meal.metaConfirmation,
  });
  assert.equal(state.manual, true);
  assert.equal(state.automatic, false);
  assert.equal(state.completed, true);
});

test("18. reabrir restaura exactamente la meta anterior", () => {
  const day = dayWithBreakfast();
  const closed = closeTarget(day);
  const reopened = reopenPersonalMealTargetConsumption({
    trackingDay: { ...day, mealsConfig: closed.mealsConfig },
    mealId: IDS.breakfast,
    dailyTarget: DAILY,
  });
  assert.deepEqual(targetOf(reopened, IDS.breakfast), {
    kcal: 700,
    proteina: 45,
    carbs: 80,
    grasas: 20,
  });
  const saved = reopened.mealsConfig.find((meal) => meal.mealId === IDS.breakfast);
  assert.equal(saved.metaConfirmed, false);
  assert.equal(saved.metaConfirmation, null);
});

test("19. reabrir reconcilia el resto sin restaurar snapshots ajenos", () => {
  const day = dayWithBreakfast();
  const closed = closeTarget(day);
  const closedDay = { ...day, mealsConfig: closed.mealsConfig };
  const reopened = reopenPersonalMealTargetConsumption({
    trackingDay: closedDay,
    mealId: IDS.breakfast,
    dailyTarget: DAILY,
  });
  const total = reopened.mealsConfig.reduce((sum, meal) => sum + meal.meta.kcal, 0);
  assert.equal(total, 2000);
  assert.equal(day.meals[IDS.breakfast].length, 1);
});

test("19b. reabrir conserva cambios posteriores en comidas protegidas", () => {
  const day = dayWithBreakfast();
  const closed = closeTarget(day);
  const changedConfigs = closed.mealsConfig.map((meal) => (
    meal.mealId === IDS.lunch
      ? { ...meal, meta: { kcal: 777, proteina: 50, carbs: 90, grasas: 20 }, metaConfirmed: true }
      : meal
  ));
  const reopened = reopenPersonalMealTargetConsumption({
    trackingDay: { ...day, mealsConfig: changedConfigs },
    mealId: IDS.breakfast,
    dailyTarget: DAILY,
  });
  assert.deepEqual(targetOf(reopened, IDS.lunch), {
    kcal: 777,
    proteina: 50,
    carbs: 90,
    grasas: 20,
  });
  assert.deepEqual(targetOf(reopened, IDS.breakfast), {
    kcal: 700,
    proteina: 45,
    carbs: 80,
    grasas: 20,
  });
});

test("20. editar consumo tras un cierre manual marca el cierre como desactualizado", () => {
  const confirmation = {
    mode: "manual_consumption",
    previousMeta: { kcal: 700, proteina: 45, carbs: 80, grasas: 20 },
    consumedMeta: { kcal: 500, proteina: 35, carbs: 55, grasas: 14 },
  };
  const state = completion(520, {
    target: { kcal: 500, proteina: 35, carbs: 55, grasas: 14 },
    consumed: { kcal: 520, proteina: 37, carbs: 58, grasas: 14 },
    metaConfirmed: true,
    confirmation,
  });
  assert.equal(state.manualStale, true);
  assert.equal(state.completed, false);
  assert.equal(state.canReopen, true);
});

test("21. borrar el consumo tras un cierre manual también exige reapertura", () => {
  const state = completion(0, {
    target: { kcal: 500, proteina: 35, carbs: 55, grasas: 14 },
    consumed: { kcal: 0, proteina: 0, carbs: 0, grasas: 0 },
    trackedItemsCount: 0,
    metaConfirmed: true,
    confirmation: {
      mode: "manual_consumption",
      previousMeta: { kcal: 700, proteina: 45, carbs: 80, grasas: 20 },
      consumedMeta: { kcal: 500, proteina: 35, carbs: 55, grasas: 14 },
    },
  });
  assert.equal(state.manualStale, true);
  assert.equal(state.completed, false);
});

test("22. sin comidas elegibles el reconciliador informa residual", () => {
  const day = dayWithBreakfast();
  day.mealsConfig = day.mealsConfig.map((meal) => (
    meal.mealId === IDS.breakfast ? meal : { ...meal, metaConfirmed: true }
  ));
  assert.notEqual(closeTarget(day).residual.kcal, 0);
});

test("23. una meta confirmada exige reapertura antes de editarla", () => {
  assert.throws(() => editPersonalMealTargetDay({
    meals: [{ id: IDS.breakfast, confirmed: true, target: { kcal: 500 } }],
    mealId: IDS.breakfast,
    target: { kcal: 600 },
  }), /Reabrí la comida/);
});

test("24. reemplazos planificados nunca cuentan como consumo Por meta", () => {
  const day = {
    ...baseDay(),
    tracking: { mealReplacements: [{
      id: "planned-breakfast",
      originalMealId: IDS.breakfast,
      foods: [food(650)],
    }] },
  };
  const consumed = personalMealTargetConsumedComposition(day, IDS.breakfast);
  const state = personalMealTargetCompletionState({
    target: { kcal: 700 },
    consumed: consumed.totals,
    trackedItemsCount: consumed.items.length,
  });
  assert.equal(consumed.totals.kcal, 0);
  assert.equal(state.completed, false);
});

test("25. cerrar una meta del coach crea un overlay y redistribuye sin mutar el plan", () => {
  const coachMeals = [
    { id: "coach-breakfast", name: "Desayuno", type: "breakfast", target: { kcal: 700, proteina: 45, carbs: 80, grasas: 20 } },
    { id: "coach-lunch", name: "Almuerzo", type: "lunch", target: { kcal: 600, proteina: 45, carbs: 70, grasas: 18 } },
    { id: "coach-snack", name: "Merienda", type: "snack", target: { kcal: 300, proteina: 25, carbs: 30, grasas: 8 } },
    { id: "coach-dinner", name: "Cena", type: "dinner", target: { kcal: 400, proteina: 35, carbs: 40, grasas: 14 } },
  ];
  const original = structuredClone(coachMeals);
  const result = updateCoachMealTargetExecution({
    trackingDay: {
      mealsConfig: [],
      meals: { "coach-lunch": [food(500, 40, 55, 13)] },
    },
    coachMeals,
    mealId: "coach-lunch",
  });
  const overlay = result.mealsConfig.find((meal) => meal.mealId === "coach-lunch");
  assert.equal(overlay.meta.kcal, 500);
  assert.equal(overlay.metaConfirmed, true);
  assert.equal(overlay.coachTargetExecution, true);
  assert.equal(overlay.personalTarget, false);
  assert.equal(result.mealsConfig.reduce((sum, meal) => sum + meal.meta.kcal, 0), 2000);
  assert.deepEqual(coachMeals, original);
});

test("26. reabrir una meta del coach restaura su objetivo y vuelve a repartir", () => {
  const coachMeals = [
    { id: "coach-breakfast", type: "breakfast", target: { kcal: 700, proteina: 45, carbs: 80, grasas: 20 } },
    { id: "coach-lunch", type: "lunch", target: { kcal: 600, proteina: 45, carbs: 70, grasas: 18 } },
    { id: "coach-dinner", type: "dinner", target: { kcal: 700, proteina: 60, carbs: 70, grasas: 22 } },
  ];
  const trackingDay = {
    mealsConfig: [],
    meals: { "coach-lunch": [food(500, 40, 55, 13)] },
  };
  const closed = updateCoachMealTargetExecution({ trackingDay, coachMeals, mealId: "coach-lunch" });
  const reopened = updateCoachMealTargetExecution({
    trackingDay: { ...trackingDay, mealsConfig: closed.mealsConfig },
    coachMeals: coachMeals.map((meal) => {
      const overlay = closed.mealsConfig.find((config) => config.mealId === meal.id);
      return { ...meal, target: overlay.meta, metaConfirmed: overlay.metaConfirmed, metaConfirmation: overlay.metaConfirmation };
    }),
    mealId: "coach-lunch",
    reopen: true,
  });
  const lunch = reopened.mealsConfig.find((meal) => meal.mealId === "coach-lunch");
  assert.equal(lunch.meta.kcal, 600);
  assert.equal(lunch.metaConfirmed, false);
  assert.equal(lunch.metaConfirmation, null);
  assert.equal(reopened.mealsConfig.reduce((sum, meal) => sum + meal.meta.kcal, 0), 2000);
});
