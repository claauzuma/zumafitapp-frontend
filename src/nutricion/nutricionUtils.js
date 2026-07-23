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

export function foodImageKey(value = "") {
  return cleanText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
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
  const id = raw?.id || raw?._id || raw?.alimentoId || slugify(name);
  const unitRaw = String(raw?.Unidad || raw?.unidad || raw?.unit || raw?.unidadBase || "").trim();
  const unitLower = unitRaw.toLowerCase();
  const unit = unitLower.startsWith("gr") || unitLower === "g" ? "g" : unitRaw || "unidad";
  const kcal = toNumber(raw?.Calorias ?? raw?.calorias ?? raw?.kcal ?? raw?.kcalUnidad ?? raw?.kcal100 ?? raw?.kcal_100g_ml);
  const protein = toNumber(raw?.Proteinas ?? raw?.proteinas ?? raw?.proteina ?? raw?.protein ?? raw?.proteinaUnidad ?? raw?.proteina100 ?? raw?.proteina_100g_ml);
  const carbs = toNumber(raw?.Carbohidratos ?? raw?.carbohidratos ?? raw?.carbs ?? raw?.hidratos ?? raw?.carbohidratosUnidad ?? raw?.carbohidratos100 ?? raw?.carbohidratos_100g_ml);
  const fat = toNumber(raw?.Grasas ?? raw?.grasas ?? raw?.fat ?? raw?.grasasUnidad ?? raw?.grasas100 ?? raw?.grasas_100g_ml);
  const source =
    raw?.Fuente ||
    raw?.fuente ||
    raw?.Categoria ||
    raw?.categoria ||
    raw?.Categoría ||
    raw?.categoriaZumaFit ||
    raw?.grupo ||
    raw?.Grupo ||
    "";
  const macroGroup = inferFoodCategory({ source, protein, carbs, fat, kcal, name });
  const normalizedSource = String(source || macroGroup).trim() || macroGroup;
  const macroBasis = inferMacroBasis(unit, raw);
  const tags = arrayFrom(raw?.tags);
  const allergens = arrayFrom(raw?.alergenos);
  const image = normalizeFoodImage(raw, name, normalizedSource);
  const searchText = cleanText(`${name} ${normalizedSource} ${macroGroup} ${raw?.subcategoria || raw?.subcategoriaZumaFit || ""} ${tags.join(" ")} ${image.exactaKey} ${image.genericaKey}`);

  return {
    id: String(id),
    alimentoId: raw?.alimentoId ?? null,
    nombre: String(name || "Sin nombre").trim() || "Sin nombre",
    name: String(name || "Sin nombre").trim() || "Sin nombre",
    unidad: unit,
    unit,
    unidadBase: raw?.unidadBase || unit,
    cantidadUnidad: toNumber(raw?.cantidadUnidad, 1),
    kcal,
    proteina: protein,
    protein,
    carbs,
    grasas: fat,
    fat,
    fibra: toNumber(raw?.fibraUnidad ?? raw?.fibra ?? raw?.fibra100 ?? raw?.fibra_100g_ml),
    kcalUnidad: toNumber(raw?.kcalUnidad ?? raw?.Calorias ?? raw?.calorias ?? raw?.kcal),
    proteinaUnidad: toNumber(raw?.proteinaUnidad ?? raw?.Proteinas ?? raw?.proteinas ?? raw?.proteina ?? raw?.protein),
    carbohidratosUnidad: toNumber(raw?.carbohidratosUnidad ?? raw?.Carbohidratos ?? raw?.carbohidratos ?? raw?.carbs),
    grasasUnidad: toNumber(raw?.grasasUnidad ?? raw?.Grasas ?? raw?.grasas ?? raw?.fat),
    fibraUnidad: toNumber(raw?.fibraUnidad ?? raw?.fibra),
    kcal100: toNumber(raw?.kcal100 ?? raw?.kcal_100g_ml),
    proteina100: toNumber(raw?.proteina100 ?? raw?.proteina_100g_ml),
    carbohidratos100: toNumber(raw?.carbohidratos100 ?? raw?.carbohidratos_100g_ml),
    grasas100: toNumber(raw?.grasas100 ?? raw?.grasas_100g_ml),
    fibra100: toNumber(raw?.fibra100 ?? raw?.fibra_100g_ml),
    porcionMin: toNumber(raw?.porcionMin),
    porcionMax: toNumber(raw?.porcionMax),
    porcionSugerida: toNumber(raw?.porcionSugerida),
    multiplo: toNumber(raw?.multiplo),
    fuente: normalizedSource,
    categoria: normalizedSource,
    subcategoria: raw?.subcategoria || raw?.subcategoriaZumaFit || "",
    source: normalizedSource,
    macroGroup,
    macroBasis,
    tags,
    alergenos: allergens,
    imagen: image,
    imageUrl: image.url,
    activo: raw?.activo !== false,
    aptoDesayuno: raw?.aptoDesayuno === true,
    aptoAlmuerzo: raw?.aptoAlmuerzo === true,
    aptoMerienda: raw?.aptoMerienda === true,
    aptoCena: raw?.aptoCena === true,
    aptoPreEntreno: raw?.aptoPreEntreno === true,
    aptoPostEntreno: raw?.aptoPostEntreno === true,
    esProteinaPrincipal: raw?.esProteinaPrincipal === true,
    esCarboPrincipal: raw?.esCarboPrincipal === true,
    esGrasaPrincipal: raw?.esGrasaPrincipal === true,
    esVegetalLibre: raw?.esVegetalLibre === true,
    _searchText: searchText,
    _categoryKey: cleanText(macroGroup),
    _normalizedFood: true,
    raw,
  };
}

export function getFoodImageUrl(food = {}) {
  const image = food?.imagen && typeof food.imagen === "object" ? food.imagen : {};
  return (
    image.url ||
    image.urlExacta ||
    image.urlGenerica ||
    food?.imageUrl ||
    food?.imagenUrl ||
    food?.imagenUrlExacta ||
    food?.imagenUrlGenerica ||
    food?.raw?.imagen?.url ||
    food?.raw?.imagenUrl ||
    buildFoodImageUrl(image.exactaKey || food?.imagenExactaKey || food?.raw?.imagenExactaKey || foodImageKey(food?.name || food?.nombre || food?.nombreSnapshot)) ||
    placeholderForFoodCategory(food?.category || food?.categoria || food?.macroGroup || food?.raw?.categoria)
  );
}

export function placeholderForFoodCategory(category = "") {
  const text = cleanText(category)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (/prote|carne|pollo|pescado|huevo|lacteo|lacteos|queso|yogur/.test(text)) return "/images/placeholders/proteinas.jpeg";
  if (/carbo|cereal|pan|arroz|pasta|fideo|papa/.test(text)) return "/images/placeholders/carbohidratos.jpeg";
  if (/grasa|aceite|fruto seco|frutos secos|palta/.test(text)) return "/images/placeholders/grasas.jpeg";
  if (/fruta/.test(text)) return "/images/placeholders/frutas.jpeg";
  if (/verdura|vegetal/.test(text)) return "/images/placeholders/verduras.jpeg";
  if (/snack|dulce|golosina/.test(text)) return "/images/placeholders/snacks.jpeg";
  return "/images/placeholders/default.jpeg";
}

function normalizeFoodImage(raw = {}, name = "", category = "") {
  const image = raw?.imagen && typeof raw.imagen === "object" ? raw.imagen : {};
  const exactaKey = image.exactaKey || raw?.imagenExactaKey || foodImageKey(name);
  const genericaKey = image.genericaKey || raw?.imagenGenericaKey || "";
  const urlExacta = image.urlExacta || raw?.imagenUrlExacta || "";
  const urlGenerica = image.urlGenerica || raw?.imagenUrlGenerica || "";
  const url = image.url || raw?.imagenUrl || urlExacta || urlGenerica || "";

  return {
    exactaKey,
    genericaKey,
    urlExacta,
    urlGenerica,
    url,
    alt: image.alt || raw?.imagenAlt || name || "Alimento",
    estado: image.estado || raw?.imagenEstado || "",
    fuente: image.fuente || raw?.imagenFuente || "",
    placeholder: placeholderForFoodCategory(category || raw?.categoria || raw?.categoriaZumaFit || raw?.Fuente),
  };
}

function buildFoodImageUrl(key = "") {
  const normalized = foodImageKey(key);
  return normalized ? `/images/foods/${normalized}.jpeg` : "";
}

function arrayFrom(value) {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
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
    imagen: normalized.imagen || normalizeFoodImage(normalized, normalized.nombre || normalized.name, normalized.categoria),
    imagenUrl: getFoodImageUrl(normalized),
  };
}

export function normalizeMeal(raw = {}, foodsOrIndex = []) {
  if (!raw) return null;
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const rawTotals = raw?.totales || raw?.totals || null;
  const shouldCalculateTotals = !hasUsableMealTotals(rawTotals, items);
  const calculatedTotals = shouldCalculateTotals
    ? calculateMealMacros(items, foodsOrIndex)
    : null;
  const totals = rawTotals
    ? {
        kcal: toNumber(rawTotals.kcal, calculatedTotals?.kcal ?? 0),
        protein: toNumber(rawTotals.proteina ?? rawTotals.protein, calculatedTotals?.protein ?? 0),
        proteina: toNumber(rawTotals.proteina ?? rawTotals.protein, calculatedTotals?.protein ?? 0),
        carbs: toNumber(rawTotals.carbs, calculatedTotals?.carbs ?? 0),
        fat: toNumber(rawTotals.grasas ?? rawTotals.fat, calculatedTotals?.fat ?? 0),
        grasas: toNumber(rawTotals.grasas ?? rawTotals.fat, calculatedTotals?.fat ?? 0),
        matched: items.length,
      }
    : calculatedTotals || { kcal: 0, protein: 0, carbs: 0, fat: 0, matched: 0 };
  const name = raw?.nombre || raw?.name || "Comida sin nombre";
  const type = normalizeDisplayMealType(raw?.tipoComida || raw?.type || inferMealType(name));
  const tagsText = Array.isArray(raw?.tags) ? raw.tags.join(" ") : String(raw?.tags || "");
  const searchText = cleanText(
    `${name} ${type} ${raw?.grupoComida || ""} ${tagsText} ${items
      .map((item) => item?.nombreSnapshot || item?.alimento || item?.nombre || item?.name || "")
      .join(" ")}`
  );

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
    sourceType: raw?.sourceType || raw?.templateSource || raw?.source || "",
    templateTier: raw?.templateTier || raw?.libraryTier || "",
    estado: raw?.estado || raw?.status || "",
    _searchText: searchText,
    raw,
  };
}

export function calculateMealMacros(items = [], foodsOrIndex = []) {
  const index = foodsOrIndex instanceof Map ? foodsOrIndex : buildFoodIndex(foodsOrIndex);
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
  if (!search && category === "todos") return foods;

  return foods.filter((food) => {
    const matchesSearch =
      !search ||
      (food._searchText || cleanText(
        `${food.name || ""} ${food.nombre || ""} ${food.source || ""} ${food.fuente || ""} ${food.categoria || ""} ${food.macroGroup || ""}`
      )).includes(search);
    const matchesCategory = category === "todos" || (food._categoryKey || cleanText(food.macroGroup)) === category;
    return matchesSearch && matchesCategory;
  });
}

export function filterMeals(meals = [], filters = {}) {
  const search = cleanText(filters.search);
  const type = cleanText(filters.type || "todos");
  if (!search && type === "todos") return meals;

  return meals.filter((meal) => {
    const matchesSearch =
      !search ||
      (meal._searchText || cleanText(
        `${meal.name || meal.nombre || ""} ${meal.type || ""} ${(meal.items || [])
          .map((item) => item?.nombreSnapshot || item?.alimento || item?.nombre || item?.name || "")
          .join(" ")}`
      )).includes(search);
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

function hasUsableMealTotals(totals = null, items = []) {
  if (!totals || typeof totals !== "object") return false;
  const fields = [
    totals.kcal,
    totals.proteina ?? totals.protein,
    totals.carbs,
    totals.grasas ?? totals.fat,
  ];
  const complete = fields.every((value) => Number.isFinite(toNumber(value, Number.NaN)));
  if (!complete) return false;
  if (!(items || []).length) return true;
  return fields.some((value) => toNumber(value, 0) > 0);
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
