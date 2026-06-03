import { cleanText, formatNumber, toNumber } from "./nutricionUtils.js";

export function kcalRangeFromValue(value) {
  const kcal = toNumber(value, 0);
  if (!kcal) return "";
  const min = Math.floor(kcal / 100) * 100;
  return `${min}-${min + 100} kcal`;
}

export function proteinBandFromValue(value) {
  const protein = toNumber(value, 0);
  if (!protein) return "";
  return Math.max(20, Math.round(protein / 20) * 20);
}

export function compactMacroLine(macros = {}) {
  const kcal = toNumber(macros.kcal ?? macros.calories, 0);
  const protein = toNumber(macros.proteina ?? macros.protein, 0);
  const carbs = toNumber(macros.carbs, 0);
  const fat = toNumber(macros.grasas ?? macros.fat, 0);

  return `${formatNumber(kcal)} kcal | P ${formatNumber(protein)} | C ${formatNumber(carbs)} | G ${formatNumber(fat)}`;
}

export function mealSignature(meal = {}) {
  const totals = meal.totales || meal.totals || {};
  const items = Array.isArray(meal.items)
    ? meal.items
    : Array.isArray(meal.foods)
      ? meal.foods
      : [];

  return stableStringify({
    nombre: textKey(meal.nombre || meal.name),
    descripcion: textKey(meal.descripcion || meal.description),
    tipoComida: textKey(meal.tipoComida || meal.type),
    grupoComida: textKey(meal.grupoComida || meal.group),
    tags: normalizeTags(meal.tags),
    totals: normalizeTotals(totals),
    items: items.map(normalizeItemForSignature).sort((a, b) => stableStringify(a).localeCompare(stableStringify(b))),
  });
}

export function menuSignature(menu = {}) {
  const macros = menu.macrosObjetivo || menu.macros || {};
  const meals = Array.isArray(menu.comidas)
    ? menu.comidas
    : Array.isArray(menu.meals)
      ? menu.meals
      : [];

  return stableStringify({
    nombre: textKey(menu.nombre || menu.name),
    descripcion: textKey(menu.descripcion || menu.description),
    kcalObjetivo: numKey(menu.kcalObjetivo ?? menu.kcal ?? menu.calories),
    rangoKcal: textKey(menu.rangoKcal || menu.range?.label || kcalRangeFromValue(menu.kcalObjetivo ?? menu.kcal)),
    macrosObjetivo: {
      proteina: numKey(macros.proteina ?? macros.protein ?? menu.protein),
      carbs: numKey(macros.carbs ?? menu.carbs),
      grasas: numKey(macros.grasas ?? macros.fat ?? menu.fat),
    },
    tags: normalizeTags(menu.tags),
    visibilidad: textKey(menu.visibilidad || menu.visibility),
    comidas: meals.map((meal, index) => ({
      orden: numKey(meal.orden ?? meal.order ?? index + 1),
      signature: mealSignature(meal),
    })),
  });
}

export function findIdenticalMeal(meals = [], candidate = {}, excludeId = "") {
  const signature = mealSignature(candidate);
  const excluded = String(excludeId || "");
  return meals.find((meal) => {
    const id = String(meal.id || meal._id || "");
    if (excluded && id === excluded) return false;
    return mealSignature(meal) === signature;
  });
}

export function findIdenticalMenu(menus = [], candidate = {}, excludeId = "") {
  const signature = menuSignature(candidate);
  const excluded = String(excludeId || "");
  return menus.find((menu) => {
    const id = String(menu.id || menu._id || menu.baseId || "");
    if (excluded && id === excluded) return false;
    return menuSignature(menu) === signature;
  });
}

function normalizeItemForSignature(item = {}) {
  const amountText = item.amount || "";
  return {
    alimentoId: textKey(item.alimentoId),
    nombre: textKey(item.nombreSnapshot || item.nombre || item.name || item.alimento),
    cantidad: numKey(item.cantidad ?? parseAmountNumber(amountText)),
    unidad: textKey(item.unidad || parseAmountUnit(amountText) || item.unit),
    kcal: numKey(item.kcal ?? item.calorias ?? item.calories),
    proteina: numKey(item.proteina ?? item.protein ?? item.proteinas),
    carbs: numKey(item.carbs ?? item.carbohidratos),
    grasas: numKey(item.grasas ?? item.fat),
    categoria: textKey(item.categoriaSnapshot || item.categoria || item.category),
  };
}

function normalizeTotals(totals = {}) {
  return {
    kcal: numKey(totals.kcal),
    proteina: numKey(totals.proteina ?? totals.protein),
    carbs: numKey(totals.carbs),
    grasas: numKey(totals.grasas ?? totals.fat),
  };
}

function normalizeTags(tags = []) {
  return (Array.isArray(tags) ? tags : String(tags || "").split(","))
    .map(textKey)
    .filter(Boolean)
    .sort();
}

function textKey(value = "") {
  return cleanText(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function numKey(value) {
  return Math.round(toNumber(value, 0) * 10) / 10;
}

function stableStringify(value) {
  return JSON.stringify(value);
}

function parseAmountNumber(value = "") {
  const match = String(value || "").match(/([\d.,]+)/);
  if (!match) return 0;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseAmountUnit(value = "") {
  const text = String(value || "").trim();
  const match = text.match(/([\d.,]+)/);
  return text.replace(match?.[1] || "", "").trim();
}
