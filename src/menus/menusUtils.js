import { buildMenuItemSnapshot, formatNumber, slugify, toNumber } from "../nutricion/nutricionUtils.js";

export function normalizeMenuBase(raw = {}) {
  const id = String(raw.id || raw._id || raw.menuBaseId || raw.nombre || raw.name || "");
  const nombre = raw.nombre || raw.name || "Menu sin nombre";
  const macros = raw.macrosObjetivo || raw.macros || {};
  const comidas = Array.isArray(raw.comidas) ? raw.comidas : raw.meals || [];
  const kcal = toNumber(raw.kcalObjetivo ?? raw.kcal ?? raw.calories, totalFromMeals(comidas).kcal);
  const protein = toNumber(macros.proteina ?? macros.protein, totalFromMeals(comidas).protein);
  const carbs = toNumber(macros.carbs ?? macros.carbohidratos, totalFromMeals(comidas).carbs);
  const fat = toNumber(macros.grasas ?? macros.fat, totalFromMeals(comidas).fat);
  const range = raw.rangoKcal || raw.range?.label || rangeFromKcal(kcal);

  return {
    id,
    baseId: id,
    source: raw.demo ? "demo" : "real",
    demo: !!raw.demo,
    name: nombre,
    description: raw.descripcion || raw.description || "",
    range: parseRange(range, kcal),
    kcal,
    protein,
    carbs,
    fat,
    mealsCount: toNumber(raw.cantidadComidas ?? raw.mealsCount, comidas.length),
    goals: normalizeGoals(raw.objetivo || raw.goal || raw.goals),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    visibility: raw.visibilidad || raw.visibility || "",
    ownerType: raw.ownerType || "",
    ownerId: raw.ownerId || "",
    estado: raw.estado || raw.status || "",
    meals: comidas.map(normalizeMealForDisplay),
    raw,
  };
}

export function normalizeDemoMenu(raw = {}) {
  return normalizeMenuBase({
    ...raw,
    id: raw.id,
    demo: true,
    nombre: raw.name,
    descripcion: raw.description,
    kcalObjetivo: raw.kcal,
    rangoKcal: raw.range?.label,
    macrosObjetivo: {
      proteina: raw.protein,
      carbs: raw.carbs,
      grasas: raw.fat,
    },
    objetivo: raw.goals?.[0] || "mantenimiento",
    cantidadComidas: raw.mealsCount,
    comidas: (raw.meals || []).map((meal, index) => ({
      id: `demo-meal-${raw.id}-${index}`,
      nombre: meal.name,
      orden: meal.order || index + 1,
      tipoComida: meal.name,
      totales: {
        kcal: meal.kcal,
        proteina: meal.protein,
        carbs: meal.carbs,
        grasas: meal.fat,
      },
      items: (meal.foods || []).map((food, foodIndex) => ({
        id: `demo-item-${raw.id}-${index}-${foodIndex}`,
        nombreSnapshot: food.name,
        cantidad: parseAmount(food.amount).cantidad,
        unidad: parseAmount(food.amount).unidad,
        kcal: toNumber(food.kcal, 0),
        proteina: toNumber(food.proteina ?? food.protein, 0),
        carbs: toNumber(food.carbs, 0),
        grasas: toNumber(food.grasas ?? food.fat, 0),
        categoriaSnapshot: food.categoriaSnapshot || food.category || "",
        notas: "",
      })),
    })),
  });
}

export function menuToBasePayload(menu = {}) {
  const normalized = menu.demo ? normalizeDemoMenu(menu.raw || menu) : normalizeMenuBase(menu.raw || menu);
  return {
    nombre: normalized.name,
    descripcion: normalized.description,
    kcalObjetivo: normalized.kcal,
    rangoKcal: normalized.range.label,
    macrosObjetivo: {
      proteina: normalized.protein,
      carbs: normalized.carbs,
      grasas: normalized.fat,
    },
    objetivo: normalizeObjective(normalized.goals?.[0]),
    cantidadComidas: normalized.mealsCount || normalized.meals.length,
    tags: normalized.tags || [],
    visibilidad: "privada",
    estado: "activo",
    comidas: normalized.meals.map((meal, mealIndex) => ({
      id: meal.id || `meal-${mealIndex + 1}`,
      nombre: meal.name,
      orden: meal.order || mealIndex + 1,
      tipoComida: normalizeMealType(meal.type || meal.name),
      items: (meal.foods || []).map((food, foodIndex) => ({
        id: food.id || `item-${mealIndex + 1}-${foodIndex + 1}`,
        alimentoId: food.alimentoId || null,
        nombreSnapshot: food.name,
        cantidad: food.cantidad ?? parseAmount(food.amount).cantidad,
        unidad: food.unidad || parseAmount(food.amount).unidad,
        kcal: toNumber(food.kcal, 0),
        proteina: toNumber(food.proteina ?? food.protein, 0),
        carbs: toNumber(food.carbs, 0),
        grasas: toNumber(food.grasas ?? food.fat, 0),
        categoriaSnapshot: food.categoriaSnapshot || food.category || "",
        notas: food.notas || "",
      })),
    })),
  };
}

export function normalizeAssignedMenu(raw = {}) {
  if (!raw) return null;
  return {
    ...raw,
    id: String(raw.id || raw._id || ""),
    comidas: (Array.isArray(raw.comidas) ? raw.comidas : []).map((meal, index) => ({
      id: String(meal.id || meal._id || `meal-${index + 1}`),
      nombre: meal.nombre || meal.name || `Comida ${index + 1}`,
      orden: toNumber(meal.orden, index + 1),
      tipoComida: meal.tipoComida || "otro",
      totales: normalizeTotals(meal.totales),
      items: (Array.isArray(meal.items) ? meal.items : []).map((item, itemIndex) => ({
        id: String(item.id || item._id || `item-${index + 1}-${itemIndex + 1}`),
        alimentoId: item.alimentoId || null,
        nombreSnapshot: item.nombreSnapshot || item.nombre || item.name || `Alimento ${itemIndex + 1}`,
        cantidad: toNumber(item.cantidad, 0),
        unidad: item.unidad || "g",
        kcal: toNumber(item.kcal, 0),
        proteina: toNumber(item.proteina ?? item.protein, 0),
        carbs: toNumber(item.carbs, 0),
        grasas: toNumber(item.grasas ?? item.fat, 0),
        categoriaSnapshot: item.categoriaSnapshot || item.categoria || "",
        locked: !!item.locked,
        reemplazoDe: item.reemplazoDe || null,
        notas: item.notas || "",
        _macroBase: buildMacroBase(item),
      })),
    })),
  };
}

export function recalcAssignedMenu(menu = {}) {
  const comidas = (menu.comidas || []).map((meal, index) => {
    const items = (meal.items || []).map((item) => ({
      ...item,
      cantidad: toNumber(item.cantidad, 0),
      kcal: toNumber(item.kcal, 0),
      proteina: toNumber(item.proteina, 0),
      carbs: toNumber(item.carbs, 0),
      grasas: toNumber(item.grasas, 0),
    }));
    return {
      ...meal,
      orden: toNumber(meal.orden, index + 1),
      items,
      totales: totalsFromItems(items),
    };
  });

  return {
    ...menu,
    comidas,
    totalesActuales: totalFromMeals(comidas),
  };
}

export function itemFromFood(food = {}) {
  const unit = food.unit || food.unidad || "g";
  const defaultQuantity = isWeightUnit(unit) ? 100 : 1;
  const snapshot = buildMenuItemSnapshot(food, defaultQuantity, unit);
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ...snapshot,
    locked: false,
    reemplazoDe: null,
    notas: "",
    _macroBase: buildMacroBase(snapshot),
  };
}

export function rescaleMenuItem(item = {}, nextCantidad = item.cantidad, nextUnidad = item.unidad || "g") {
  const base = item._macroBase || buildMacroBase(item);
  const baseQty = toNumber(base.cantidad, 0);
  const quantity = toNumber(nextCantidad, toNumber(item.cantidad, 0));
  const factor = baseQty > 0 ? quantity / baseQty : 1;

  return {
    ...item,
    cantidad: quantity,
    unidad: nextUnidad || item.unidad || "g",
    kcal: round(toNumber(base.kcal, item.kcal) * factor),
    proteina: round(toNumber(base.proteina, item.proteina) * factor),
    carbs: round(toNumber(base.carbs, item.carbs) * factor),
    grasas: round(toNumber(base.grasas, item.grasas) * factor),
    _macroBase: base,
  };
}

export function itemFromEquivalent(eq = {}, original = {}) {
  return {
    id: original.id || `item-${Date.now()}`,
    alimentoId: eq.alimentoId || eq.id || null,
    nombreSnapshot: eq.nombre || "Reemplazo",
    cantidad: toNumber(eq.cantidadSugerida, 100),
    unidad: eq.unidadSugerida || eq.unidad || "g",
    kcal: toNumber(eq.totales?.kcal, eq.kcal),
    proteina: toNumber(eq.totales?.proteina, eq.proteina),
    carbs: toNumber(eq.totales?.carbs, eq.carbs),
    grasas: toNumber(eq.totales?.grasas, eq.grasas),
    categoriaSnapshot: eq.categoria || "",
    locked: !!original.locked,
    reemplazoDe: original.nombreSnapshot || original.nombre || null,
    notas: original.notas || "",
    _macroBase: buildMacroBase({
      cantidad: toNumber(eq.cantidadSugerida, 100),
      kcal: toNumber(eq.totales?.kcal, eq.kcal),
      proteina: toNumber(eq.totales?.proteina, eq.proteina),
      carbs: toNumber(eq.totales?.carbs, eq.carbs),
      grasas: toNumber(eq.totales?.grasas, eq.grasas),
    }),
  };
}

export function macroDiff(current = {}, target = {}) {
  return {
    kcal: toNumber(current.kcal, 0) - toNumber(target.kcalObjetivo ?? target.kcal, 0),
    proteina: toNumber(current.proteina, 0) - toNumber(target.macrosObjetivo?.proteina ?? target.proteina, 0),
    carbs: toNumber(current.carbs, 0) - toNumber(target.macrosObjetivo?.carbs ?? target.carbs, 0),
    grasas: toNumber(current.grasas, 0) - toNumber(target.macrosObjetivo?.grasas ?? target.grasas, 0),
  };
}

export function formatMacroDiff(value, suffix = "") {
  const n = toNumber(value, 0);
  if (!n) return "0";
  return `${n > 0 ? "+" : ""}${formatNumber(n, 1)}${suffix}`;
}

function normalizeMealForDisplay(raw = {}, index = 0) {
  const totals = normalizeTotals(raw.totales || raw.totals);
  const items = Array.isArray(raw.items) ? raw.items : raw.foods || [];
  return {
    id: String(raw.id || raw._id || `meal-${index + 1}`),
    name: raw.nombre || raw.name || `Comida ${index + 1}`,
    order: toNumber(raw.orden ?? raw.order, index + 1),
    type: raw.tipoComida || raw.type || "otro",
    kcal: totals.kcal,
    protein: totals.proteina,
    carbs: totals.carbs,
    fat: totals.grasas,
    foods: items.map((item, itemIndex) => ({
      id: String(item.id || item._id || `food-${itemIndex + 1}`),
      alimentoId: item.alimentoId || null,
      name: item.nombreSnapshot || item.nombre || item.name || item.alimento || `Alimento ${itemIndex + 1}`,
      amount: item.amount || `${item.cantidad ?? ""} ${item.unidad || ""}`.trim(),
      cantidad: item.cantidad,
      unidad: item.unidad,
      kcal: item.kcal,
      protein: item.proteina ?? item.protein,
      carbs: item.carbs,
      fat: item.grasas ?? item.fat,
      category: item.categoriaSnapshot || item.categoria,
    })),
  };
}

function normalizeTotals(raw = {}) {
  return {
    kcal: toNumber(raw.kcal, 0),
    proteina: toNumber(raw.proteina ?? raw.protein, 0),
    carbs: toNumber(raw.carbs, 0),
    grasas: toNumber(raw.grasas ?? raw.fat, 0),
  };
}

function totalsFromItems(items = []) {
  return items.reduce(
    (acc, item) => ({
      kcal: round(acc.kcal + toNumber(item.kcal, 0)),
      proteina: round(acc.proteina + toNumber(item.proteina, 0)),
      carbs: round(acc.carbs + toNumber(item.carbs, 0)),
      grasas: round(acc.grasas + toNumber(item.grasas, 0)),
    }),
    { kcal: 0, proteina: 0, carbs: 0, grasas: 0 }
  );
}

function totalFromMeals(meals = []) {
  return meals.reduce(
    (acc, meal) => {
      const totals = meal.totales || meal.totals || {
        kcal: meal.kcal,
        proteina: meal.proteina ?? meal.protein,
        carbs: meal.carbs,
        grasas: meal.grasas ?? meal.fat,
      };
      return {
        kcal: round(acc.kcal + toNumber(totals.kcal, 0)),
        proteina: round(acc.proteina + toNumber(totals.proteina ?? totals.protein, 0)),
        protein: round(acc.protein + toNumber(totals.proteina ?? totals.protein, 0)),
        carbs: round(acc.carbs + toNumber(totals.carbs, 0)),
        grasas: round(acc.grasas + toNumber(totals.grasas ?? totals.fat, 0)),
        fat: round(acc.fat + toNumber(totals.grasas ?? totals.fat, 0)),
      };
    },
    { kcal: 0, proteina: 0, protein: 0, carbs: 0, grasas: 0, fat: 0 }
  );
}

function parseRange(range, kcal) {
  if (range && typeof range === "object") return range;
  const label = String(range || rangeFromKcal(kcal));
  const match = label.match(/(\d+)\D+(\d+)/);
  return {
    label,
    min: match ? Number(match[1]) : Math.max(0, Math.floor(toNumber(kcal, 0) / 100) * 100),
    max: match ? Number(match[2]) : Math.max(0, Math.floor(toNumber(kcal, 0) / 100) * 100 + 100),
  };
}

function rangeFromKcal(kcal) {
  const n = toNumber(kcal, 0);
  if (!n) return "Sin rango";
  const min = Math.floor(n / 100) * 100;
  return `${min}-${min + 100} kcal`;
}

function normalizeGoals(goal) {
  if (Array.isArray(goal)) return goal.filter(Boolean);
  const text = String(goal || "mantenimiento").trim();
  return [text || "mantenimiento"];
}

function normalizeObjective(goal = "") {
  const text = slugify(goal);
  if (text.includes("defin")) return "definicion";
  if (text.includes("recomp")) return "recomposicion";
  if (text.includes("volumen")) return "volumen";
  if (text.includes("rend")) return "rendimiento";
  if (text.includes("salud")) return "salud";
  return "mantenimiento";
}

function normalizeMealType(value = "") {
  const text = slugify(value);
  if (text.includes("desayuno")) return "desayuno";
  if (text.includes("almuerzo")) return "almuerzo";
  if (text.includes("merienda")) return "merienda";
  if (text.includes("cena")) return "cena";
  if (text.includes("snack")) return "snack";
  return "otro";
}

function parseAmount(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/([\d.,]+)/);
  const cantidad = match ? Number(match[1].replace(",", ".")) : 0;
  const unidad = text.replace(match?.[1] || "", "").trim() || "g";
  return { cantidad: Number.isFinite(cantidad) ? cantidad : 0, unidad };
}

function buildMacroBase(item = {}) {
  return {
    cantidad: toNumber(item.cantidad, 0),
    kcal: toNumber(item.kcal, 0),
    proteina: toNumber(item.proteina ?? item.protein, 0),
    carbs: toNumber(item.carbs, 0),
    grasas: toNumber(item.grasas ?? item.fat, 0),
  };
}

function isWeightUnit(unit = "") {
  const text = String(unit || "").trim().toLowerCase().replace(".", "");
  return ["g", "gr", "gramo", "gramos", "ml"].includes(text);
}

function round(value) {
  return Math.round(Number(value || 0) * 10) / 10;
}
