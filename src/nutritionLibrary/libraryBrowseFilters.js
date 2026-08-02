const FIELD_CONFIG = {
  kcal: { aliases: ["kcal", "calorias", "calories"] },
  proteina: { aliases: ["proteina", "proteinas", "protein"] },
  carbs: { aliases: ["carbs", "carbohidratos", "carbohydrates"] },
  grasas: { aliases: ["grasas", "grasa", "fat", "fats"] },
};

function finiteNumber(value) {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function firstNumber(source = {}, aliases = []) {
  for (const key of aliases) {
    const value = finiteNumber(source?.[key]);
    if (value !== null) return value;
  }
  return null;
}

export function libraryItemTotals(item = {}) {
  const source = item.totales || item.macrosTotales || item.totalesActuales || item.macros || {};
  const totals = {};
  for (const [field, config] of Object.entries(FIELD_CONFIG)) {
    totals[field] = firstNumber(source, config.aliases);
  }
  return totals;
}

export function nutritionFacetBucket(value, { kind = "menu", field = "kcal" } = {}) {
  const parsed = finiteNumber(value);
  if (parsed === null) return null;
  const step = field === "kcal" ? kind === "meal" ? 50 : 100 : kind === "meal" ? 5 : 10;
  return Math.round(parsed / step) * step;
}

function numericFacetOptions(items = [], { kind = "menu", field = "kcal" } = {}) {
  const counts = new Map();
  for (const item of items) {
    const value = libraryItemTotals(item)[field];
    const bucket = nutritionFacetBucket(value, { kind, field });
    if (bucket === null) continue;
    counts.set(bucket, (counts.get(bucket) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left - right)
    .map(([value, count]) => ({ value, count }));
}

function typeFacetOptions(items = []) {
  const counts = new Map();
  for (const item of items) {
    const value = String(item?.tipoComida || item?.mealType || "otra").trim().toLowerCase() || "otra";
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "es"))
    .map(([value, count]) => ({ value, count }));
}

export function applyLibraryFacetFilters(items = [], filters = {}, { kind = "menu" } = {}) {
  const source = Array.isArray(items) ? items : [];
  const selectedType = kind === "meal" && filters.type && filters.type !== "todos" ? String(filters.type).toLowerCase() : "";
  const selectedKcal = finiteNumber(filters.calorieBucket);
  const selectedProtein = finiteNumber(filters.proteinBucket);
  const types = kind === "meal" ? typeFacetOptions(source) : [];
  const byType = selectedType
    ? source.filter((item) => String(item?.tipoComida || item?.mealType || "otra").trim().toLowerCase() === selectedType)
    : source;
  const calories = numericFacetOptions(byType, { kind, field: "kcal" });
  const byCalories = selectedKcal === null
    ? byType
    : byType.filter((item) => nutritionFacetBucket(libraryItemTotals(item).kcal, { kind, field: "kcal" }) === selectedKcal);
  const proteins = numericFacetOptions(byCalories, { kind, field: "proteina" });
  const filtered = selectedProtein === null
    ? byCalories
    : byCalories.filter((item) => nutritionFacetBucket(libraryItemTotals(item).proteina, { kind, field: "proteina" }) === selectedProtein);
  return {
    items: filtered,
    facets: {
      kind,
      totalAvailable: source.length,
      types,
      calories,
      proteins,
      selected: {
        type: selectedType || null,
        calorieBucket: selectedKcal,
        proteinBucket: selectedProtein,
      },
      complete: false,
    },
  };
}
