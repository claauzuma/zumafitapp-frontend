export const NUTRITION_WEEK_DAYS = [
  { key: "monday", label: "Lunes", storageKey: "Lunes", aliases: ["lunes", "monday"] },
  { key: "tuesday", label: "Martes", storageKey: "Martes", aliases: ["martes", "tuesday"] },
  { key: "wednesday", label: "Miércoles", storageKey: "Miercoles", aliases: ["miercoles", "miércoles", "wednesday"] },
  { key: "thursday", label: "Jueves", storageKey: "Jueves", aliases: ["jueves", "thursday"] },
  { key: "friday", label: "Viernes", storageKey: "Viernes", aliases: ["viernes", "friday"] },
  { key: "saturday", label: "Sábado", storageKey: "Sabado", aliases: ["sabado", "sábado", "saturday"] },
  { key: "sunday", label: "Domingo", storageKey: "Domingo", aliases: ["domingo", "sunday"] },
];

export function createDailyTargetsDraft(client) {
  const weeklyPlan = client?.menu?.weeklyPlan || {};
  const caloriesByDay = weeklyPlan?.caloriesByDay || {};
  const macrosByDay = weeklyPlan?.macrosByDay || {};

  return NUTRITION_WEEK_DAYS.reduce((targets, day) => {
    const calorieEntry = findDayEntry(caloriesByDay, day);
    const macroEntry = findDayEntry(macrosByDay, day);
    if (!calorieEntry.found && !macroEntry.found) return targets;

    const macros = isPlainObject(macroEntry.value) ? macroEntry.value : {};
    targets[day.key] = {
      kcal: valueOrEmpty(calorieEntry.value),
      p: valueOrEmpty(macros.p ?? macros.proteina ?? macros.protein),
      c: valueOrEmpty(macros.c ?? macros.carbs ?? macros.carbohidratos),
      g: valueOrEmpty(macros.g ?? macros.grasas ?? macros.fat),
      note: String(macros.note ?? macros.nota ?? ""),
    };
    return targets;
  }, {});
}

export function resolveNutritionTarget(nutritionDraft = {}, dayLike) {
  const day = getNutritionWeekDay(dayLike);
  const override = day ? nutritionDraft?.dailyTargets?.[day.key] : null;
  const p = inheritedValue(override?.p, nutritionDraft?.p);
  const c = inheritedValue(override?.c, nutritionDraft?.c);
  const g = inheritedValue(override?.g, nutritionDraft?.g);
  const calculatedKcal = calculateMacroKcal(p, c, g);

  return {
    key: day?.key || "",
    label: day?.label || String(dayLike || "Día"),
    kcal: calculatedKcal ?? inheritedValue(override?.kcal, nutritionDraft?.kcal),
    p,
    c,
    g,
    note: String(override?.note || ""),
    customized: Boolean(override),
  };
}

export function serializeDailyTargets(dailyTargets = {}) {
  return NUTRITION_WEEK_DAYS.reduce(
    (weeklyPlan, day) => {
      const target = dailyTargets?.[day.key];
      if (!target) return weeklyPlan;

      weeklyPlan.caloriesByDay[day.storageKey] = calculateMacroKcal(target.p, target.c, target.g) ?? toNullableNumber(target.kcal);
      weeklyPlan.macrosByDay[day.storageKey] = {
        p: toNullableNumber(target.p),
        c: toNullableNumber(target.c),
        g: toNullableNumber(target.g),
        note: String(target.note || "").trim(),
        customized: true,
      };
      return weeklyPlan;
    },
    { caloriesByDay: {}, macrosByDay: {} }
  );
}

export function calculateMacroKcal(protein, carbs, fat) {
  const p = toNumberOrNull(protein);
  const c = toNumberOrNull(carbs);
  const g = toNumberOrNull(fat);
  if (p === null || c === null || g === null) return null;
  return Math.round((p * 4) + (c * 4) + (g * 9));
}

export function getNutritionWeekDay(dayLike) {
  const normalized = normalizeDayName(dayLike);
  return NUTRITION_WEEK_DAYS.find((day) => (
    day.key === normalized ||
    normalizeDayName(day.label) === normalized ||
    normalizeDayName(day.storageKey) === normalized ||
    day.aliases.some((alias) => normalizeDayName(alias) === normalized)
  )) || null;
}

function findDayEntry(source, day) {
  if (!isPlainObject(source)) return { found: false, value: undefined };
  const matchingKey = Object.keys(source).find((key) => getNutritionWeekDay(key)?.key === day.key);
  return matchingKey === undefined
    ? { found: false, value: undefined }
    : { found: true, value: source[matchingKey] };
}

function inheritedValue(overriDíalue, generalValue) {
  return hasValue(overriDíalue) ? overriDíalue : generalValue;
}

function hasValue(value) {
  return value !== "" && value !== null && value !== undefined;
}

function valueOrEmpty(value) {
  return value === null || value === undefined ? "" : String(value);
}

function toNullableNumber(value) {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toNumberOrNull(value) {
  if (!hasValue(value)) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeDayName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

