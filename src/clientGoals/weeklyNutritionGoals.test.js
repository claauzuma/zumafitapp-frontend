import assert from "node:assert/strict";
import test from "node:test";

import {
  WEEKLY_MODE_AUTOMATIC,
  WEEKLY_MODE_PER_DAY,
  WEEKLY_MODE_TRAINING_REST,
  adjustWeeklyDayDraftValue,
  buildWeeklyGoalsPayload,
  canUseWeeklyMode,
  copyWeeklyDayToTargets,
  createWeeklyDayDrafts,
  normalizeWeeklyDayDraft,
  normalizeWeeklyMode,
  restoreWeeklyDayToBase,
  restoreWeeklyWeekToBase,
  sameWeeklyNutritionDraft,
  setWeeklyDayDraftValue,
  weeklyBaseDraft,
  weeklyDayVisualState,
  weeklyGoalsPayloadSignature,
} from "./weeklyNutritionGoals.js";

const target = { kcal: 2623, macros: { p: 172, c: 329, g: 69 } };

test("FREE solo puede seleccionar el objetivo automatico/base", () => {
  assert.equal(canUseWeeklyMode(WEEKLY_MODE_AUTOMATIC, false), true);
  assert.equal(canUseWeeklyMode(WEEKLY_MODE_PER_DAY, false), false);
  assert.equal(canUseWeeklyMode(WEEKLY_MODE_TRAINING_REST, false), false);
});

test("PRO puede seleccionar personalizacion y entrenamiento/descanso", () => {
  assert.equal(canUseWeeklyMode(WEEKLY_MODE_PER_DAY, true), true);
  assert.equal(canUseWeeklyMode(WEEKLY_MODE_TRAINING_REST, true), true);
});

test("automatico persiste un contrato lineal sin overrides diarios", () => {
  assert.deepEqual(buildWeeklyGoalsPayload(WEEKLY_MODE_AUTOMATIC, {}, ["monday"]), {
    mode: WEEKLY_MODE_AUTOMATIC,
    caloriesByDay: {},
    macrosByDay: {},
    trainingDays: [],
  });
});

test("reload reconstruye calorias y macros semanales existentes", () => {
  const drafts = createWeeklyDayDrafts(target, {
    mode: WEEKLY_MODE_PER_DAY,
    caloriesByDay: { Martes: 2450 },
    macrosByDay: { Martes: { p: 160, c: 300, g: 60 } },
  });
  assert.deepEqual(drafts.tuesday, { kcal: "2450", p: "160", c: "300", g: "60" });
  assert.deepEqual(drafts.monday, { kcal: "2623", p: "172", c: "329", g: "69" });
});

test("editar kcal o P/C/G de un dia no modifica accidentalmente otro", () => {
  const drafts = createWeeklyDayDrafts(target);
  const withKcal = setWeeklyDayDraftValue(drafts, "tuesday", "kcal", "2450");
  const changed = setWeeklyDayDraftValue(withKcal, "tuesday", "p", "160");
  assert.equal(changed.tuesday.kcal, "2577");
  assert.equal(changed.tuesday.p, "160");
  assert.deepEqual(changed.monday, drafts.monday);
  assert.notEqual(changed.monday, changed.tuesday);
});

test("editar cualquier macro recalcula las calorias del dia con la formula 4-4-9", () => {
  let drafts = createWeeklyDayDrafts(target);
  drafts = setWeeklyDayDraftValue(drafts, "saturday", "p", "174");
  assert.equal(drafts.saturday.kcal, String(174 * 4 + 329 * 4 + 69 * 9));
  drafts = setWeeklyDayDraftValue(drafts, "saturday", "g", "70");
  assert.equal(drafts.saturday.kcal, String(174 * 4 + 329 * 4 + 70 * 9));
});

test("los controles incrementales respetan cero y el paso indicado", () => {
  const drafts = createWeeklyDayDrafts(target);
  const increased = adjustWeeklyDayDraftValue(drafts, "monday", "kcal", 50);
  const clamped = adjustWeeklyDayDraftValue(increased, "monday", "g", -1000);
  assert.equal(increased.monday.kcal, "2673");
  assert.equal(clamped.monday.g, "0");
});

test("aplicar a seleccionados copia los cuatro valores solo a esos dias", () => {
  let drafts = createWeeklyDayDrafts(target);
  drafts = setWeeklyDayDraftValue(drafts, "monday", "kcal", "2450");
  drafts = setWeeklyDayDraftValue(drafts, "monday", "p", "160");
  drafts = copyWeeklyDayToTargets(drafts, "monday", ["thursday", "saturday"]);
  assert.deepEqual(drafts.thursday, drafts.monday);
  assert.deepEqual(drafts.saturday, drafts.monday);
  assert.equal(drafts.tuesday.kcal, "2623");
});

test("copiar a todos replica kcal y macros en los siete dias", () => {
  let drafts = createWeeklyDayDrafts(target);
  drafts = setWeeklyDayDraftValue(drafts, "sunday", "c", "300");
  drafts = copyWeeklyDayToTargets(drafts, "sunday", Object.keys(drafts));
  Object.values(drafts).forEach((day) => assert.deepEqual(day, drafts.sunday));
});

test("restaurar dia vuelve solo ese dia al objetivo base", () => {
  const base = weeklyBaseDraft(target);
  let drafts = createWeeklyDayDrafts(target);
  drafts = setWeeklyDayDraftValue(drafts, "monday", "kcal", "2450");
  drafts = setWeeklyDayDraftValue(drafts, "tuesday", "kcal", "2500");
  drafts = restoreWeeklyDayToBase(drafts, "monday", base);
  assert.deepEqual(drafts.monday, base);
  assert.equal(drafts.tuesday.kcal, "2500");
});

test("restaurar semana vuelve todos los dias al objetivo base", () => {
  const base = weeklyBaseDraft(target);
  const restored = restoreWeeklyWeekToBase(base);
  assert.equal(Object.keys(restored).length, 7);
  Object.values(restored).forEach((day) => assert.deepEqual(day, base));
});

test("dia igual a la base muestra BASE y uno modificado muestra EDITADO", () => {
  const base = weeklyBaseDraft(target);
  assert.equal(weeklyDayVisualState({ mode: WEEKLY_MODE_PER_DAY, dayKey: "monday", value: base, base }).label, "Base");
  assert.equal(weeklyDayVisualState({ mode: WEEKLY_MODE_PER_DAY, dayKey: "monday", value: { ...base, kcal: "2450" }, base }).label, "Editado");
});

test("entrenamiento y descanso derivan sus badges del grupo actual", () => {
  const base = weeklyBaseDraft(target);
  assert.equal(weeklyDayVisualState({ mode: WEEKLY_MODE_TRAINING_REST, dayKey: "monday", value: base, base, trainingDays: ["monday"] }).label, "Entreno");
  assert.equal(weeklyDayVisualState({ mode: WEEKLY_MODE_TRAINING_REST, dayKey: "sunday", value: base, base, trainingDays: ["monday"] }).label, "Descanso");
});

test("personalizacion completa serializa los targets que consume Menu", () => {
  let drafts = createWeeklyDayDrafts(target);
  drafts = setWeeklyDayDraftValue(drafts, "saturday", "kcal", "2450");
  drafts = setWeeklyDayDraftValue(drafts, "saturday", "p", "160");
  const payload = buildWeeklyGoalsPayload(WEEKLY_MODE_PER_DAY, drafts, []);
  assert.equal(payload.caloriesByDay.saturday, 2577);
  assert.equal(payload.macrosByDay.saturday.p, 160);
  assert.equal(payload.caloriesByDay.monday, 2623);
});

test("un modo desconocido vuelve al automatico seguro", () => {
  assert.equal(normalizeWeeklyMode("experimental"), WEEKLY_MODE_AUTOMATIC);
  assert.equal(canUseWeeklyMode("experimental", false), true);
});

test("el borrador base conserva ceros y deja vacios los valores ausentes", () => {
  assert.deepEqual(weeklyBaseDraft({ kcal: 0, macros: { p: 0 } }), { kcal: "0", p: "0", c: "", g: "" });
});

test("normalizar un dia distingue vacio de cero", () => {
  assert.deepEqual(normalizeWeeklyDayDraft({ kcal: "", p: "0", c: "329", g: null }), {
    kcal: null, p: 0, c: 329, g: null,
  });
});

test("la comparacion semanal acepta numeros equivalentes escritos como texto", () => {
  assert.equal(sameWeeklyNutritionDraft(
    { kcal: "2623", p: "172.0", c: 329, g: "69" },
    { kcal: 2623, p: 172, c: "329", g: 69 },
  ), true);
});

test("copiar ignora dias desconocidos y crea copias independientes", () => {
  const drafts = createWeeklyDayDrafts(target);
  const copied = copyWeeklyDayToTargets(drafts, "monday", ["tuesday", "not-a-day"]);
  assert.equal(copied["not-a-day"], undefined);
  assert.deepEqual(copied.tuesday, copied.monday);
  assert.notEqual(copied.tuesday, copied.monday);
});

test("entrenamiento filtra dias invalidos y elimina duplicados al persistir", () => {
  const drafts = createWeeklyDayDrafts(target);
  const payload = buildWeeklyGoalsPayload(WEEKLY_MODE_TRAINING_REST, drafts, ["monday", "monday", "holiday"]);
  assert.deepEqual(payload.trainingDays, ["monday"]);
});

test("la firma persistida es estable aunque cambie el orden de entrenamiento", () => {
  const drafts = createWeeklyDayDrafts(target);
  const first = buildWeeklyGoalsPayload(WEEKLY_MODE_TRAINING_REST, drafts, ["monday", "thursday"]);
  const second = buildWeeklyGoalsPayload(WEEKLY_MODE_TRAINING_REST, drafts, ["thursday", "monday"]);
  assert.equal(weeklyGoalsPayloadSignature(first), weeklyGoalsPayloadSignature(second));
});

