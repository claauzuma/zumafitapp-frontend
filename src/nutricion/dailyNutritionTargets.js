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
      kcal: valueOrEmpty(calorieEntry.value ?? macros.kcal),
      p: valueOrEmpty(macros.p ?? macros.proteina ?? macros.protein),
      c: valueOrEmpty(macros.c ?? macros.carbs ?? macros.carbohidratos),
      g: valueOrEmpty(macros.g ?? macros.grasas ?? macros.fat),
      note: String(macros.note ?? macros.nota ?? ""),
    };
    return targets;
  }, {});
}

export function resolveNutritionWeek(nutritionDraft = {}) {
  const base = buildBaseTarget(nutritionDraft);
  const weeklyKcalTarget = hasValue(base.kcal) ? Number(base.kcal) * NUTRITION_WEEK_DAYS.length : null;

  const customized = new Map();
  NUTRITION_WEEK_DAYS.forEach((day) => {
    const override = nutritionDraft?.dailyTargets?.[day.key];
    if (!override) return;
    customized.set(day.key, buildCustomizedTarget(day, base, override));
  });

  const generalDays = NUTRITION_WEEK_DAYS.filter((day) => !customized.has(day.key));
  const customizedKcal = [...customized.values()].reduce((sum, target) => sum + toNumber(target.kcal, 0), 0);
  const adjustedKcal = weeklyKcalTarget !== null && generalDays.length
    ? Math.max(0, (weeklyKcalTarget - customizedKcal) / generalDays.length)
    : base.kcal;

  const targets = {};
  NUTRITION_WEEK_DAYS.forEach((day) => {
    targets[day.key] = customized.get(day.key) || buildGeneralTarget(day, base, adjustedKcal, customized.size > 0);
  });

  const currentWeeklyKcal = Object.values(targets).reduce((sum, target) => sum + toNumber(target.kcal, 0), 0);
  const difference = weeklyKcalTarget !== null ? Math.round(currentWeeklyKcal - weeklyKcalTarget) : null;
  const adjustedGeneralDays = Object.values(targets).filter((target) => target.adjusted).length;

  return {
    base,
    targets,
    days: NUTRITION_WEEK_DAYS.map((day) => targets[day.key]),
    summary: {
      baseDailyKcal: base.kcal,
      weeklyKcalTarget,
      currentWeeklyKcal: Math.round(currentWeeklyKcal),
      difference,
      customizedDays: customized.size,
      generalDays: generalDays.length,
      adjustedGeneralDays,
      closesWeek: difference === null || Math.abs(difference) <= 5,
    },
  };
}

export function resolveNutritionTarget(nutritionDraft = {}, dayLike) {
  const day = getNutritionWeekDay(dayLike);
  if (!day) {
    return {
      key: "",
      label: String(dayLike || "Día"),
      kcal: "",
      p: "",
      c: "",
      g: "",
      note: "",
      customized: false,
      adjusted: false,
    };
  }
  return resolveNutritionWeek(nutritionDraft).targets[day.key];
}

export function serializeDailyTargets(dailyTargets = {}) {
  return NUTRITION_WEEK_DAYS.reduce(
    (weeklyPlan, day) => {
      const target = dailyTargets?.[day.key];
      if (!target) return weeklyPlan;

      const kcal = calculateMacroKcal(target.p, target.c, target.g) ?? toNullableNumber(target.kcal);
      weeklyPlan.caloriesByDay[day.storageKey] = kcal;
      weeklyPlan.macrosByDay[day.storageKey] = {
        p: toNullableNumber(target.p),
        c: toNullableNumber(target.c),
        g: toNullableNumber(target.g),
        kcal,
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

function buildBaseTarget(nutritionDraft = {}) {
  const p = valueOrEmpty(nutritionDraft?.p);
  const c = valueOrEmpty(nutritionDraft?.c);
  const g = valueOrEmpty(nutritionDraft?.g);
  const kcal = calculateMacroKcal(p, c, g) ?? toNullableNumber(nutritionDraft?.kcal);
  return {
    key: "base",
    label: "Base",
    kcal,
    p,
    c,
    g,
    note: "",
  };
}

function buildCustomizedTarget(day, base, override = {}) {
  const wantedKcal = toNumberOrNull(override.kcal);
  const p = inheritedValue(override.p, base.p);
  const g = inheritedValue(override.g, base.g);
  let c = inheritedValue(override.c, "");

  if (!hasValue(c) && wantedKcal !== null) {
    c = valueOrEmpty(deriveCarbsForKcal(wantedKcal, p, g).carbs);
  }
  if (!hasValue(c)) c = base.c;

  const calculated = calculateMacroKcal(p, c, g);
  return {
    key: day.key,
    label: day.label,
    kcal: calculated ?? wantedKcal ?? base.kcal,
    p,
    c,
    g,
    note: String(override.note || ""),
    customized: true,
    adjusted: false,
    statusLabel: "Personalizado",
  };
}

function buildGeneralTarget(day, base, targetKcal, shouldAdjust) {
  const kcal = hasValue(targetKcal) ? Number(targetKcal) : toNumberOrNull(base.kcal);
  const derived = hasValue(kcal)
    ? deriveCarbsForKcal(kcal, base.p, base.g)
    : { protein: base.p, carbs: base.c, fat: base.g, warning: "" };
  const roundedKcal = hasValue(kcal) ? Math.round(Number(kcal)) : base.kcal;
  const adjusted = shouldAdjust && hasValue(base.kcal) && Math.abs(Number(roundedKcal) - Number(base.kcal)) > 1;

  return {
    key: day.key,
    label: day.label,
    kcal: roundedKcal,
    p: valueOrEmpty(derived.protein),
    c: valueOrEmpty(roundMacro(derived.carbs)),
    g: valueOrEmpty(roundMacro(derived.fat)),
    note: "",
    customized: false,
    adjusted,
    warning: derived.warning,
    statusLabel: adjusted ? "General ajustado" : "General",
  };
}

function deriveCarbsForKcal(kcal, protein, fat) {
  const p = toNumberOrNull(protein) ?? 0;
  let g = toNumberOrNull(fat) ?? 0;
  const total = Math.max(0, Number(kcal) || 0);
  let carbs = (total - (p * 4) - (g * 9)) / 4;
  let warning = "";

  if (carbs < 0) {
    carbs = 0;
    g = Math.max(0, (total - (p * 4)) / 9);
    warning = "Meta baja: se ajustaron grasas para sostener proteína.";
  }

  return {
    protein: p,
    carbs,
    fat: g,
    warning,
  };
}

function roundMacro(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return Math.round(number * 10) / 10;
}

function findDayEntry(source, day) {
  if (!isPlainObject(source)) return { found: false, value: undefined };
  const matchingKey = Object.keys(source).find((key) => getNutritionWeekDay(key)?.key === day.key);
  return matchingKey === undefined
    ? { found: false, value: undefined }
    : { found: true, value: source[matchingKey] };
}

function inheritedValue(overrideValue, generalValue) {
  return hasValue(overrideValue) ? overrideValue : generalValue;
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

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
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
