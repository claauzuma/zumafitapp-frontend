export function cleanText(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function slugify(value = "") {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
}

export function toNumber(value, fallback = 0) {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  const text = String(value ?? "").trim().replace(/\s+/g, "");
  if (!text) return fallback;
  const hasComma = text.includes(",");
  const hasDot = text.includes(".");
  let normalized = text;

  if (hasComma && hasDot) {
    normalized =
      text.lastIndexOf(",") > text.lastIndexOf(".")
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (hasComma) {
    normalized = text.replace(",", ".");
  }

  const n = Number(normalized);
  return Number.isFinite(n) ? n : fallback;
}

export function formatNumber(value, digits = 0) {
  const n = toNumber(value, Number.NaN);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

export function normalizeFood(raw = {}) {
  const name = raw?.Alimentos || raw?.alimentos || raw?.nombre || raw?.name || "Sin nombre";
  const id = raw?.id || raw?._id || slugify(name);
  const unitRaw = String(raw?.Unidad || raw?.unidad || raw?.unit || "").trim();
  const unitLower = unitRaw.toLowerCase();
  const unit = unitLower.startsWith("gr") || unitLower === "g" ? "g" : unitRaw || "unidad";
  const kcal = toNumber(raw?.Calorias ?? raw?.calorias ?? raw?.kcal);
  const protein = toNumber(raw?.Proteinas ?? raw?.proteinas ?? raw?.proteina ?? raw?.protein);
  const carbs = toNumber(raw?.Carbohidratos ?? raw?.carbohidratos ?? raw?.carbs ?? raw?.hidratos);
  const fat = toNumber(raw?.Grasas ?? raw?.grasas ?? raw?.fat);
  const source =
    raw?.Fuente ||
    raw?.fuente ||
    raw?.Categoria ||
    raw?.categoria ||
    raw?.Categoría ||
    raw?.grupo ||
    raw?.Grupo ||
    "";
  const macroGroup = inferFoodCategory({ source, protein, carbs, fat, kcal, name });
  const normalizedSource = String(source || macroGroup).trim() || macroGroup;
  const macroBasis = inferMacroBasis(unit, raw);

  return {
    id: String(id),
    nombre: String(name || "Sin nombre").trim() || "Sin nombre",
    name: String(name || "Sin nombre").trim() || "Sin nombre",
    unidad: unit,
    unit,
    kcal,
    proteina: protein,
    protein,
    carbs,
    grasas: fat,
    fat,
    fuente: normalizedSource,
    categoria: normalizedSource,
    source: normalizedSource,
    macroGroup,
    macroBasis,
    raw,
  };
}

export function inferMacroBasis(unit = "", raw = {}) {
  const explicit = cleanText(raw?.macroBasis || raw?.baseMacro || raw?.Base || raw?.base || raw?.por || raw?.Por);
  if (explicit.includes("100")) return "per100";
  if (explicit.includes("unidad") || explicit.includes("porcion") || explicit.includes("porci")) return "perUnit";

  const normalizedUnit = normalizeUnit(unit);
  if (["g", "gr", "gramo", "gramos", "ml"].includes(normalizedUnit)) {
    return looksLikeMacroPerGram(raw) ? "perUnit" : "per100";
  }
  return "perUnit";
}

export function calculateFoodMacros(food = {}, cantidad = 100, unidad = food?.unidad || food?.unit || "g") {
  const qty = toNumber(cantidad, 0);
  const sourceUnit = normalizeUnit(unidad || food?.unidad || food?.unit);
  const basis = food?.macroBasis || inferMacroBasis(food?.unidad || food?.unit || unidad, food?.raw || food);
  const shouldScaleBy100 = basis === "per100" && ["g", "gr", "gramo", "gramos", "ml"].includes(sourceUnit);
  const factor = qty > 0 ? (shouldScaleBy100 ? qty / 100 : qty) : 0;

  return {
    kcal: roundMacro(toNumber(food?.kcal, 0) * factor),
    proteina: roundMacro(toNumber(food?.proteina ?? food?.protein, 0) * factor),
    carbs: roundMacro(toNumber(food?.carbs, 0) * factor),
    grasas: roundMacro(toNumber(food?.grasas ?? food?.fat, 0) * factor),
  };
}

export function buildMenuItemSnapshot(food = {}, cantidad = 100, unidad = food?.unidad || food?.unit || "g") {
  const normalized = food?.name || food?.nombre ? food : normalizeFood(food);
  const snapshotUnit = unidad || normalized.unidad || normalized.unit || "g";
  const macros = calculateFoodMacros(normalized, cantidad, snapshotUnit);

  return {
    alimentoId: normalized.id || normalized._id || null,
    nombreSnapshot: normalized.nombre || normalized.name || "Alimento",
    cantidad: toNumber(cantidad, 100),
    unidad: snapshotUnit,
    kcal: macros.kcal,
    proteina: macros.proteina,
    carbs: macros.carbs,
    grasas: macros.grasas,
    categoriaSnapshot: normalized.categoria || normalized.fuente || normalized.source || normalized.macroGroup || "",
  };
}

export function normalizeMeal(raw = {}, foods = []) {
  if (!raw) return null;
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const rawTotals = raw?.totales || raw?.totals || null;
  const calculatedTotals = calculateMealMacros(items, foods);
  const totals = rawTotals
    ? {
        kcal: toNumber(rawTotals.kcal, calculatedTotals.kcal),
        protein: toNumber(rawTotals.proteina ?? rawTotals.protein, calculatedTotals.protein),
        proteina: toNumber(rawTotals.proteina ?? rawTotals.protein, calculatedTotals.protein),
        carbs: toNumber(rawTotals.carbs, calculatedTotals.carbs),
        fat: toNumber(rawTotals.grasas ?? rawTotals.fat, calculatedTotals.fat),
        grasas: toNumber(rawTotals.grasas ?? rawTotals.fat, calculatedTotals.fat),
        matched: items.length,
      }
    : calculatedTotals;
  const name = raw?.nombre || raw?.name || "Comida sin nombre";
  const type = normalizeDisplayMealType(raw?.tipoComida || raw?.type || inferMealType(name));

  return {
    id: String(raw?.id || raw?._id || slugify(`${name}-${raw?.userId || ""}`)),
    userId: raw?.userId || "",
    name,
    nombre: name,
    descripcion: raw?.descripcion || raw?.description || "",
    type,
    tipoComida: normalizeMealTypeToken(raw?.tipoComida || type),
    grupoComida: raw?.grupoComida || groupFromMealType(raw?.tipoComida || type),
    items,
    totals,
    demo: !!raw?.demo,
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    visibility: raw?.visibilidad || raw?.visibility || "",
    visibilidad: raw?.visibilidad || raw?.visibility || "",
    ownerType: raw?.ownerType || "",
    ownerId: raw?.ownerId || "",
    estado: raw?.estado || raw?.status || "",
    raw,
  };
}

export function calculateMealMacros(items = [], foods = []) {
  const index = buildFoodIndex(foods);
  return items.reduce(
    (acc, item) => {
      const food = index.get(cleanText(item?.nombreSnapshot || item?.alimento || item?.nombre || item?.name));
      const qty = toNumber(item?.cantidad ?? item?.qty, 0);
      if (!food || qty <= 0) return acc;

      const macros = calculateFoodMacros(food, qty, item?.unidad || food.unit || food.unidad);
      acc.kcal += macros.kcal;
      acc.protein += macros.proteina;
      acc.carbs += macros.carbs;
      acc.fat += macros.grasas;
      acc.matched += 1;
      return acc;
    },
    { kcal: 0, protein: 0, carbs: 0, fat: 0, matched: 0 }
  );
}

export function buildFoodIndex(foods = []) {
  const index = new Map();
  foods.forEach((food) => {
    if (food?.name) index.set(cleanText(food.name), food);
    if (food?.nombre) index.set(cleanText(food.nombre), food);
    const rawName = food?.raw?.Alimentos || food?.raw?.alimentos || food?.raw?.nombre;
    if (rawName) index.set(cleanText(rawName), food);
  });
  return index;
}

export function inferFoodCategory({ source = "", protein = 0, carbs = 0, fat = 0, kcal = 0, name = "" }) {
  const haystack = `${source} ${name}`.toLowerCase();
  if (/pollo|carne|huevo|atun|atún|pescado|whey|yogur|queso|jamon|jamón|pavo/.test(haystack)) return "Proteica";
  if (/arroz|papa|fideo|pan|avena|banana|manzana|fruta|harina|cereal/.test(haystack)) return "Carbohidrato";
  if (/aceite|palta|nuez|almendra|mani|maní|manteca/.test(haystack)) return "Grasa";
  if (/verdura|tomate|lechuga|zanahoria|zapallo|brocoli|brócoli/.test(haystack)) return "Verdura";
  if (kcal <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return "Otros";

  const max = Math.max(protein, carbs, fat);
  if (max === protein && protein > 0) return "Proteica";
  if (max === carbs && carbs > 0) return "Carbohidrato";
  if (max === fat && fat > 0) return "Grasa";
  return "Otros";
}

export function inferMealType(name = "") {
  const text = cleanText(name);
  if (/desayuno|breakfast|avena|tostada/.test(text)) return "Desayuno";
  if (/almuerzo|lunch|pollo|arroz|pasta/.test(text)) return "Almuerzo";
  if (/merienda|snack|yogur|fruta/.test(text)) return "Merienda";
  if (/cena|dinner|salmon|salmón|carne/.test(text)) return "Cena";
  return "Comida";
}

export function normalizeMealTypeToken(value = "") {
  const text = slugify(value);
  if (text.includes("desayuno")) return "desayuno";
  if (text.includes("almuerzo")) return "almuerzo";
  if (text.includes("merienda")) return "merienda";
  if (text.includes("cena")) return "cena";
  if (text.includes("snack") || text.includes("colacion")) return "snack";
  return "otro";
}

export function normalizeDisplayMealType(value = "") {
  const token = normalizeMealTypeToken(value);
  const labels = {
    desayuno: "Desayuno",
    almuerzo: "Almuerzo",
    merienda: "Merienda",
    cena: "Cena",
    snack: "Snack",
    otro: "Sin clasificar",
  };
  return labels[token] || "Sin clasificar";
}

export function groupFromMealType(value = "") {
  const token = normalizeMealTypeToken(value);
  if (["desayuno", "merienda"].includes(token)) return "desayuno_merienda";
  if (["almuerzo", "cena"].includes(token)) return "almuerzo_cena";
  if (token === "snack") return "snack";
  return "otro";
}

export function filterFoods(foods = [], filters = {}) {
  const search = cleanText(filters.search);
  const category = cleanText(filters.category || "todos");

  return foods.filter((food) => {
    const matchesSearch =
      !search ||
      cleanText(food.name).includes(search) ||
      cleanText(food.nombre).includes(search) ||
      cleanText(food.source).includes(search) ||
      cleanText(food.fuente).includes(search) ||
      cleanText(food.categoria).includes(search) ||
      cleanText(food.macroGroup).includes(search);
    const matchesCategory = category === "todos" || cleanText(food.macroGroup) === category;
    return matchesSearch && matchesCategory;
  });
}

export function filterMeals(meals = [], filters = {}) {
  const search = cleanText(filters.search);
  const type = cleanText(filters.type || "todos");

  return meals.filter((meal) => {
    const itemsText = meal.items.map((item) => item?.alimento || item?.nombre || "").join(" ");
    const mealName = meal.name || meal.nombre || "";
    const matchesSearch =
      !search ||
      cleanText(mealName).includes(search) ||
      cleanText(itemsText).includes(search) ||
      cleanText(meal.type).includes(search);
    const matchesType =
      type === "todos" ||
      cleanText(meal.type) === type ||
      cleanText(meal.tipoComida) === type ||
      cleanText(meal.grupoComida) === type;
    return matchesSearch && matchesType;
  });
}

export function rangeLabel(range) {
  if (!range) return "Todos";
  if (typeof range === "string") return range;
  return `${range.min}-${range.max} kcal`;
}

export function macroLine(macros = {}) {
  return `${formatNumber(macros.protein)}P / ${formatNumber(macros.carbs)}C / ${formatNumber(macros.fat)}G`;
}

function normalizeUnit(unit = "") {
  return cleanText(unit).replace(".", "");
}

function looksLikeMacroPerGram(raw = {}) {
  if (raw?.perUnit === true || raw?.porUnidad === true) return true;

  const kcal = toNumber(raw?.Calorias ?? raw?.calorias ?? raw?.kcal ?? raw?.kcalPerUnit, 0);
  const protein = toNumber(raw?.Proteinas ?? raw?.proteinas ?? raw?.proteina ?? raw?.protein ?? raw?.proteinPerUnit, 0);
  const carbs = toNumber(raw?.Carbohidratos ?? raw?.carbohidratos ?? raw?.carbs ?? raw?.hidratos ?? raw?.carbsPerUnit, 0);
  const fat = toNumber(raw?.Grasas ?? raw?.grasas ?? raw?.fat ?? raw?.fatPerUnit, 0);

  if (kcal <= 0 && protein <= 0 && carbs <= 0 && fat <= 0) return false;
  return kcal > 0 && kcal <= 15 && protein <= 5 && carbs <= 5 && fat <= 5;
}

function roundMacro(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
