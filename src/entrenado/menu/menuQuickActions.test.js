import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MENU_GENERATION_SETTINGS,
  dayKeyFromIsoDate,
  libraryTargetPath,
  loadMenuGenerationSettings,
  mealTypesForCount,
  normalizeMenuGenerationSettings,
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
