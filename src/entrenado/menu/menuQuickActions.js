export const MENU_GENERATION_MODE_SIMILAR = "similar_menu";
export const MENU_GENERATION_MODE_COMBINE = "combine_library";
export const MENU_GENERATION_MODE_SCRATCH = "from_scratch";

export const DEFAULT_MENU_GENERATION_SETTINGS = Object.freeze({
  mode: MENU_GENERATION_MODE_COMBINE,
  mealCount: 4,
  allowRepeats: false,
  distribution: "balanced",
  preferFavorites: false,
  firstMealTime: "",
});

const VALID_MODES = new Set([
  MENU_GENERATION_MODE_SIMILAR,
  MENU_GENERATION_MODE_COMBINE,
  MENU_GENERATION_MODE_SCRATCH,
]);

export function normalizeMenuGenerationSettings(value = {}) {
  const mealCount = Math.max(3, Math.min(6, Math.round(Number(value.mealCount) || 4)));
  const firstMealTime = /^\d{2}:\d{2}$/.test(String(value.firstMealTime || ""))
    ? String(value.firstMealTime)
    : "";
  return {
    mode: VALID_MODES.has(value.mode) ? value.mode : DEFAULT_MENU_GENERATION_SETTINGS.mode,
    mealCount,
    allowRepeats: value.allowRepeats === true,
    distribution: value.distribution === "equal" ? "equal" : "balanced",
    preferFavorites: value.preferFavorites === true,
    firstMealTime,
  };
}

export function menuGenerationSettingsOwner(user = {}) {
  return String(user.id || user._id || user.email || "anonymous");
}

export function menuGenerationSettingsKey(user = {}) {
  return `zumafit:menu-generation-settings:v1:${menuGenerationSettingsOwner(user)}`;
}

export function loadMenuGenerationSettings(user = {}, storage = globalThis?.localStorage) {
  if (!storage) return { ...DEFAULT_MENU_GENERATION_SETTINGS };
  try {
    const parsed = JSON.parse(storage.getItem(menuGenerationSettingsKey(user)) || "null");
    if (parsed?.version !== 1) return { ...DEFAULT_MENU_GENERATION_SETTINGS };
    return normalizeMenuGenerationSettings(parsed.settings);
  } catch {
    return { ...DEFAULT_MENU_GENERATION_SETTINGS };
  }
}

export function saveMenuGenerationSettings(user = {}, settings = {}, storage = globalThis?.localStorage) {
  const normalized = normalizeMenuGenerationSettings(settings);
  if (!storage) return normalized;
  try {
    storage.setItem(menuGenerationSettingsKey(user), JSON.stringify({
      version: 1,
      settings: normalized,
      updatedAt: new Date().toISOString(),
    }));
  } catch {
    return normalized;
  }
  return normalized;
}

export function resetMenuGenerationSettings(user = {}, storage = globalThis?.localStorage) {
  const defaults = { ...DEFAULT_MENU_GENERATION_SETTINGS };
  try { storage?.removeItem(menuGenerationSettingsKey(user)); } catch { return defaults; }
  return defaults;
}

export function generationModeLabel(mode = "") {
  if (mode === MENU_GENERATION_MODE_SIMILAR) return "Biblioteca";
  if (mode === MENU_GENERATION_MODE_SCRATCH) return "Desde cero";
  return "Combinar comidas";
}

export function mealTypesForCount(count = 4) {
  const options = {
    3: ["desayuno", "almuerzo", "cena"],
    4: ["desayuno", "almuerzo", "merienda", "cena"],
    5: ["desayuno", "almuerzo", "merienda", "cena", "snack"],
    6: ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack"],
  };
  return options[Math.max(3, Math.min(6, Math.round(Number(count) || 4)))];
}

export function dayKeyFromIsoDate(value = "") {
  const parts = String(value).split("-").map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return "monday";
  const index = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).getUTCDay();
  return ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][index];
}

export function libraryTargetPath(date = "", target = {}) {
  const params = new URLSearchParams({ tab: "admin", context: "day-menu" });
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(date))) params.set("selectedDate", String(date));
  [
    ["targetKcal", target.kcal],
    ["targetProtein", target.proteina],
    ["targetCarbs", target.carbs],
    ["targetFat", target.grasas],
  ].forEach(([key, value]) => {
    const number = Number(value);
    if (Number.isFinite(number) && number >= 0) params.set(key, String(number));
  });
  return `/app/nutricion?${params.toString()}`;
}
