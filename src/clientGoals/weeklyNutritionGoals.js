import { createDailyTargetsDraft } from "../nutricion/dailyNutritionTargets.js";

export const WEEKLY_NUTRITION_DAYS = [
  { key: "monday", short: "Lun", label: "Lunes" },
  { key: "tuesday", short: "Mar", label: "Martes" },
  { key: "wednesday", short: "Mie", label: "Miercoles" },
  { key: "thursday", short: "Jue", label: "Jueves" },
  { key: "friday", short: "Vie", label: "Viernes" },
  { key: "saturday", short: "Sab", label: "Sabado" },
  { key: "sunday", short: "Dom", label: "Domingo" },
];

export const WEEKLY_MODE_AUTOMATIC = "same_all_days";
export const WEEKLY_MODE_PER_DAY = "per_day";
export const WEEKLY_MODE_TRAINING_REST = "training_rest";
// Legacy: the first version stored balance as a standalone mode.
export const WEEKLY_MODE_UNRESTRICTED = "unrestricted";

const WEEKLY_MODES = new Set([
  WEEKLY_MODE_AUTOMATIC,
  WEEKLY_MODE_PER_DAY,
  WEEKLY_MODE_TRAINING_REST,
]);

const FIELDS = ["kcal", "p", "c", "g"];
const MACRO_FIELDS = new Set(["p", "c", "g"]);

function valueOrEmpty(value) {
  return value === null || value === undefined ? "" : String(value);
}

function maybeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function normalizeWeeklyMode(mode) {
  if (mode === WEEKLY_MODE_UNRESTRICTED) return WEEKLY_MODE_AUTOMATIC;
  return WEEKLY_MODES.has(mode) ? mode : WEEKLY_MODE_AUTOMATIC;
}

export function weeklyBalanceEnabled(weeklyPlan = {}) {
  return weeklyPlan?.balanceEnabled === true || weeklyPlan?.mode === WEEKLY_MODE_UNRESTRICTED;
}

export function weeklyBaseDraft(target = {}) {
  return {
    kcal: valueOrEmpty(target?.kcal),
    p: valueOrEmpty(target?.macros?.p),
    c: valueOrEmpty(target?.macros?.c),
    g: valueOrEmpty(target?.macros?.g),
  };
}

export function createWeeklyDayDrafts(target = {}, weeklyPlan = {}) {
  const base = weeklyBaseDraft(target);
  const storedByDay = createDailyTargetsDraft({ menu: { weeklyPlan } });
  return WEEKLY_NUTRITION_DAYS.reduce((drafts, day) => {
    const stored = storedByDay[day.key] || {};
    drafts[day.key] = FIELDS.reduce((entry, field) => {
      entry[field] = stored[field] !== undefined && stored[field] !== ""
        ? String(stored[field])
        : base[field];
      return entry;
    }, {});
    return drafts;
  }, {});
}

export function normalizeWeeklyDayDraft(draft = {}) {
  return FIELDS.reduce((values, field) => {
    values[field] = maybeNumber(draft[field]);
    return values;
  }, {});
}

export function sameWeeklyNutritionDraft(left = {}, right = {}) {
  const a = normalizeWeeklyDayDraft(left);
  const b = normalizeWeeklyDayDraft(right);
  return FIELDS.every((field) => a[field] === b[field]);
}

export function buildWeeklyGoalsPayload(mode, dayDrafts = {}, trainingDays = [], balanceEnabled = false) {
  const normalizedMode = normalizeWeeklyMode(mode);
  if (normalizedMode === WEEKLY_MODE_AUTOMATIC) {
    return {
      mode: normalizedMode,
      caloriesByDay: {},
      macrosByDay: {},
      trainingDays: [],
      ...(balanceEnabled ? { balanceEnabled: true } : {}),
    };
  }

  const caloriesByDay = {};
  const macrosByDay = {};
  WEEKLY_NUTRITION_DAYS.forEach((day) => {
    const values = normalizeWeeklyDayDraft(dayDrafts[day.key]);
    if (values.kcal !== null) caloriesByDay[day.key] = values.kcal;
    if (values.p !== null || values.c !== null || values.g !== null) {
      macrosByDay[day.key] = {
        ...(values.p !== null ? { p: values.p } : {}),
        ...(values.c !== null ? { c: values.c } : {}),
        ...(values.g !== null ? { g: values.g } : {}),
      };
    }
  });

  return {
    mode: normalizedMode,
    caloriesByDay,
    macrosByDay,
    trainingDays: normalizedMode === WEEKLY_MODE_TRAINING_REST
      ? [...new Set(trainingDays)].filter((day) => WEEKLY_NUTRITION_DAYS.some((entry) => entry.key === day))
      : [],
    ...(balanceEnabled ? { balanceEnabled: true } : {}),
  };
}

export function weeklyGoalsPayloadSignature(payload = {}) {
  return JSON.stringify({
    mode: normalizeWeeklyMode(payload.mode),
    caloriesByDay: payload.caloriesByDay || {},
    macrosByDay: payload.macrosByDay || {},
    trainingDays: [...new Set(Array.isArray(payload.trainingDays) ? payload.trainingDays : [])].sort(),
    balanceEnabled: weeklyBalanceEnabled(payload),
  });
}

export function canUseWeeklyMode(mode, hasAdvancedAccess) {
  return normalizeWeeklyMode(mode) === WEEKLY_MODE_AUTOMATIC || hasAdvancedAccess === true;
}

export function weeklyDayVisualState({ mode, dayKey, value, base, trainingDays = [] } = {}) {
  const normalizedMode = normalizeWeeklyMode(mode);
  if (normalizedMode === WEEKLY_MODE_TRAINING_REST) {
    return trainingDays.includes(dayKey)
      ? { key: "training", label: "Entreno" }
      : { key: "rest", label: "Descanso" };
  }
  if (normalizedMode === WEEKLY_MODE_PER_DAY && !sameWeeklyNutritionDraft(value, base)) {
    return { key: "edited", label: "Editado" };
  }
  return { key: "base", label: "Base" };
}

export function setWeeklyDayDraftValue(dayDrafts = {}, dayKey, field, value) {
  if (!FIELDS.includes(field)) return { ...dayDrafts };
  const nextDay = { ...(dayDrafts[dayKey] || {}), [field]: value };
  if (MACRO_FIELDS.has(field)) {
    const p = maybeNumber(nextDay.p);
    const c = maybeNumber(nextDay.c);
    const g = maybeNumber(nextDay.g);
    if (p !== null && c !== null && g !== null) {
      nextDay.kcal = String(Math.round(p * 4 + c * 4 + g * 9));
    }
  }
  return {
    ...dayDrafts,
    [dayKey]: nextDay,
  };
}

export function adjustWeeklyDayDraftValue(dayDrafts = {}, dayKey, field, delta) {
  if (!FIELDS.includes(field)) return { ...dayDrafts };
  const current = maybeNumber(dayDrafts?.[dayKey]?.[field]) || 0;
  const next = String(Math.max(0, Math.round((current + Number(delta || 0)) * 10) / 10));
  return setWeeklyDayDraftValue(dayDrafts, dayKey, field, next);
}

export function copyWeeklyDayToTargets(dayDrafts = {}, sourceDayKey, targetDayKeys = []) {
  const source = { ...(dayDrafts[sourceDayKey] || {}) };
  const allowed = new Set(WEEKLY_NUTRITION_DAYS.map((day) => day.key));
  return [...new Set(targetDayKeys)].reduce((next, dayKey) => {
    if (allowed.has(dayKey)) next[dayKey] = { ...source };
    return next;
  }, { ...dayDrafts });
}

export function restoreWeeklyDayToBase(dayDrafts = {}, dayKey, base = {}) {
  return { ...dayDrafts, [dayKey]: { ...base } };
}

export function restoreWeeklyWeekToBase(base = {}) {
  return WEEKLY_NUTRITION_DAYS.reduce((drafts, day) => {
    drafts[day.key] = { ...base };
    return drafts;
  }, {});
}

