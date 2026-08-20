import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MENU_GENERATION_SETTINGS,
  automaticGenerationRequiresPlan,
  buildAutonomousMenuGenerationRequest,
  dayKeyFromIsoDate,
  libraryTargetPath,
  loadMenuGenerationSettings,
  mealTypesForCount,
  normalizeMenuGenerationSettings,
  resolveAutonomousMenuActions,
  resetMenuGenerationSettings,
  saveMenuGenerationSettings,
} from "./menuQuickActions.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("normaliza opciones y conserva una unica estrategia principal", () => {
  assert.deepEqual(normalizeMenuGenerationSettings({ mode: "invalid", mealCount: 20 }), {
    ...DEFAULT_MENU_GENERATION_SETTINGS,
    mealCount: 6,
    mealTypes: ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack"],
  });
  assert.equal(normalizeMenuGenerationSettings({ mode: "from_scratch" }).mode, "from_scratch");
});

test("persiste ajustes por usuario y restablece los recomendados", () => {
  const storage = memoryStorage();
  saveMenuGenerationSettings({ id: "a" }, { mode: "similar_menu", mealCount: 5 }, storage);
  saveMenuGenerationSettings({ id: "b" }, { mode: "from_scratch", mealCount: 3 }, storage);
  assert.equal(loadMenuGenerationSettings({ id: "a" }, storage).mode, "similar_menu");
  assert.equal(loadMenuGenerationSettings({ id: "b" }, storage).mealCount, 3);
  assert.deepEqual(resetMenuGenerationSettings({ id: "a" }, storage), DEFAULT_MENU_GENERATION_SETTINGS);
  assert.deepEqual(loadMenuGenerationSettings({ id: "a" }, storage), DEFAULT_MENU_GENERATION_SETTINGS);
});

test("persiste las preferencias nuevas del asistente sin repetir alimentos", () => {
  const storage = memoryStorage();
  const saved = saveMenuGenerationSettings({ id: "wizard" }, {
    generationProfile: "custom",
    includeFoods: [{
      id: "pollo",
      nombre: "Pollo",
      kcal: 1.2,
      mustAppear: true,
      targetMealType: "almuerzo",
      generation: {
        mode: "GENERIC",
        roles: { P1: true },
        mealTypes: { lunch: true, dinner: true },
        portionRule: { unit: "g", min: 100, max: 250, step: 10, allowedValues: [] },
      },
    }, { id: "arroz", nombre: "Arroz" }, { id: "pollo", nombre: "Pollo" }],
    excludeFoods: [{ id: "fritos", nombre: "Fritos" }],
    foodPoolMode: "only",
    variety: "high",
    algorithmTolerance: "strict",
    prepTime: "normal",
    budget: "low",
  }, storage);
  assert.deepEqual(saved.includeFoods.map((food) => food.nombre), ["Pollo", "Arroz"]);
  assert.equal(saved.includeFoods[0].mustAppear, true);
  assert.equal(saved.includeFoods[0].targetMealType, "almuerzo");
  assert.equal(saved.includeFoods[0].generation.mode, "GENERIC");
  assert.deepEqual(saved.includeFoods[0].generation.portionRule, { unit: "g", min: 100, max: 250, step: 10, allowedValues: [] });
  assert.equal(saved.includeFoods[0].porcionMin, 100);
  assert.equal(saved.includeFoods[0].porcionMax, 250);
  assert.equal(saved.includeFoods[0].multiplo, 10);
  assert.equal(loadMenuGenerationSettings({ id: "wizard" }, storage).foodPoolMode, "only");
});

test("conserva los tipos de comida elegidos y alinea la cantidad", () => {
  const settings = normalizeMenuGenerationSettings({
    mealCount: 4,
    mealTypes: ["almuerzo", "merienda", "cena"],
  });
  assert.deepEqual(settings.mealTypes, ["almuerzo", "merienda", "cena"]);
  assert.equal(settings.mealCount, 3);
});

test("construye el request con exactamente los tipos y alimentos elegidos", () => {
  const request = buildAutonomousMenuGenerationRequest({
    settings: {
      generationProfile: "custom",
      mode: "from_scratch",
      mealTypes: ["almuerzo", "merienda", "cena"],
      includeFoods: [{ id: "pollo", nombre: "Pollo" }, { id: "arroz", nombre: "Arroz" }],
      excludeFoods: [{ id: "pescado", nombre: "Pescado" }],
      foodPoolMode: "only",
      distribution: "equal",
    },
    target: { kcal: 2100, proteina: 150, carbs: 230, grasas: 65 },
    selectedDate: "2026-08-20",
  });

  assert.deepEqual(request.mealTypes, ["almuerzo", "merienda", "cena"]);
  assert.equal(request.sourceMode, "foods");
  assert.equal(request.useOnlySelectedFoods, true);
  assert.deepEqual(request.foods.map((food) => food.nombre), ["Pollo", "Arroz"]);
  assert.deepEqual(request.excludedFoods.map((food) => food.nombre), ["Pescado"]);
  assert.equal(request.distribution, "equal");
  assert.deepEqual(request.selectedDays, ["thursday"]);
});

test("las metas por comida del coach reemplazan la distribucion autonoma", () => {
  const coachMealTargets = [
    { type: "desayuno", target: { kcal: 450 } },
    { type: "almuerzo", target: { kcal: 800 } },
    { type: "cena", target: { kcal: 650 } },
  ];
  const request = buildAutonomousMenuGenerationRequest({
    settings: { mealTypes: ["almuerzo", "merienda", "cena"] },
    target: { kcal: 1900 },
    coachMealTargets,
  });
  assert.deepEqual(request.mealTypes, ["desayuno", "almuerzo", "cena"]);
  assert.equal(request.mealTargets, coachMealTargets);
});

test("storage bloqueado no rompe la pantalla ni mezcla configuraciones", () => {
  const blocked = {
    getItem: () => { throw new Error("blocked"); },
    setItem: () => { throw new Error("blocked"); },
    removeItem: () => { throw new Error("blocked"); },
  };
  assert.deepEqual(loadMenuGenerationSettings({ id: "a" }, blocked), DEFAULT_MENU_GENERATION_SETTINGS);
  assert.equal(saveMenuGenerationSettings({ id: "a" }, { mode: "similar_menu" }, blocked).mode, "similar_menu");
  assert.deepEqual(resetMenuGenerationSettings({ id: "a" }, blocked), DEFAULT_MENU_GENERATION_SETTINGS);
});

test("deriva comidas, dia y biblioteca desde la fecha y objetivo elegidos", () => {
  assert.deepEqual(mealTypesForCount(3), ["desayuno", "almuerzo", "cena"]);
  assert.equal(mealTypesForCount(6).length, 6);
  assert.equal(dayKeyFromIsoDate("2026-08-01"), "saturday");
  const path = libraryTargetPath("2026-08-01", { kcal: 2636, proteina: 165, carbs: 296, grasas: 88 });
  assert.match(path, /context=day-menu/);
  assert.match(path, /selectedDate=2026-08-01/);
  assert.match(path, /targetKcal=2636/);
  assert.match(path, /targetProtein=165/);
  assert.match(path, /targetFat=88/);
});

test("acciones autonomas dependen de capabilities aun cuando existe coach", () => {
  assert.deepEqual(resolveAutonomousMenuActions({
    hasCoach: true,
    canUseGlobalLibrary: true,
    canCreateOwnMenu: true,
    canGenerateAutomaticMenu: true,
    canEditMenuPreferences: true,
  }), {
    library: true,
    create: true,
    automatic: true,
    settings: true,
    visible: true,
  });
  assert.deepEqual(resolveAutonomousMenuActions({ hasCoach: true }), {
    library: false,
    create: false,
    automatic: false,
    settings: false,
    visible: false,
  });
});

test("solo un rechazo real del servidor deriva la generacion automatica a planes", () => {
  assert.equal(automaticGenerationRequiresPlan({
    status: 403,
    code: "PLAN_CAPABILITY_REQUIRED",
  }), true);
  assert.equal(automaticGenerationRequiresPlan({
    status: 403,
    code: "CLIENT_MENU_FORBIDDEN",
  }), false);
  assert.equal(automaticGenerationRequiresPlan({
    status: 0,
    message: "No se pudo conectar con el servidor",
  }), false);
});
