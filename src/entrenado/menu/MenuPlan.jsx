import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Apple,
  Calculator,
  CheckSquare2,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleAlert,
  ClipboardCheck,
  Eye,
  Lock,
  MoreHorizontal,
  MoonStar,
  Plus,
  RefreshCw,
  Search,
  Square,
  Sun,
  Sunrise,
  Target,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { apiFetch } from "../../Api.js";
import { getFoodEquivalents } from "../../menus/menusApi.js";
import { generateMealQuantities, listAlimentos } from "../../nutricion/nutricionApi.js";
import { getFoodImageUrl, placeholderForFoodCategory } from "../../nutricion/nutricionUtils.js";
import { createSavedMeal } from "../../savedMeals/savedMealsApi.js";

const EMPTY_DAYS = [];
const MENU_WEEK_CACHE_TTL_MS = 5 * 60 * 1000;
const MENU_WEEK_BACKGROUND_REFRESH_MS = 45 * 1000;
const menuWeekMemoryCache = new Map();
const MENU_EMOJI = "\u{1F37D}\uFE0F";
const MENU_BOX_EMOJI = "\u{1F371}";
const EYE_EMOJI = "\u{1F441}\uFE0F";
const TOTAL_KEYS = {
  kcal: ["kcal", "calories", "calorias", "caloriasTotales", "caloriesTotal", "kcalTotal", "cal"],
  proteina: ["proteina", "proteinas", "protein", "proteinaTotal", "proteinasTotal", "proteinTotal", "p"],
  carbs: ["carbs", "carbohidratos", "carbohydrates", "hidratos", "carbsTotal", "carbohidratosTotal", "c"],
  grasas: ["grasas", "grasa", "fat", "fats", "grasasTotal", "fatTotal", "g"],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function getMenuWeekCacheEntry(start) {
  const key = start || mondayOfWeek();
  const cached = menuWeekMemoryCache.get(key);
  if (!cached?.data) return null;
  if (Date.now() - cached.savedAt > MENU_WEEK_CACHE_TTL_MS) {
    menuWeekMemoryCache.delete(key);
    return null;
  }
  return cached;
}

function getCachedMenuWeek(start) {
  const cached = getMenuWeekCacheEntry(start);
  return cached?.data || null;
}

function shouldRefreshCachedMenuWeek(start) {
  const cached = getMenuWeekCacheEntry(start);
  if (!cached) return true;
  return Date.now() - cached.savedAt > MENU_WEEK_BACKGROUND_REFRESH_MS;
}

function setCachedMenuWeek(start, data) {
  if (!start || !data) return;
  menuWeekMemoryCache.set(start, {
    data,
    savedAt: Date.now(),
  });
}

function mondayOfWeek(value = todayIso()) {
  const date = new Date(`${value}T00:00:00.000Z`);
  const diff = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - diff);
  return date.toISOString().slice(0, 10);
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function formatNumber(value, digits = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return number.toLocaleString("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function macro(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function readMacroValue(source = {}, keys = []) {
  if (!source || typeof source !== "object") return undefined;
  const lookup = Object.entries(source).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
    const lowerKey = String(key).toLowerCase();
    if (lookup[lowerKey] !== undefined && lookup[lowerKey] !== null && lookup[lowerKey] !== "") {
      return lookup[lowerKey];
    }
  }
  return undefined;
}

function displayKcal(value) {
  return `${formatNumber(macro(value))} kcal`;
}

function displayMacros(target = {}) {
  const safeTarget = target && typeof target === "object" ? target : {};
  return `P ${formatNumber(macro(safeTarget.p ?? safeTarget.proteina), 1)} g / C ${formatNumber(macro(safeTarget.c ?? safeTarget.carbs), 1)} g / G ${formatNumber(macro(safeTarget.g ?? safeTarget.grasas), 1)} g`;
}

function displayMenuMacros(totals = {}) {
  const safeTotals = totals && typeof totals === "object" ? totals : {};
  return `P ${formatNumber(macro(safeTotals.proteina ?? safeTotals.protein), 1)} / C ${formatNumber(macro(safeTotals.carbs), 1)} / G ${formatNumber(macro(safeTotals.grasas ?? safeTotals.fat), 1)}`;
}

function signed(value, suffix = "") {
  const number = Math.round(macro(value) * 10) / 10;
  if (!number) return `0${suffix}`;
  return `${number > 0 ? "+" : ""}${formatNumber(number, 1)}${suffix}`;
}

function statusMeta(row) {
  const status = row?.tracking?.status || "pending";
  if (status === "completed") return { label: "Cumplido", tone: "green", percent: 100 };
  if (status === "in_progress") return { label: "En progreso", tone: "blue", percent: row.tracking?.adherencePercent ?? null };
  if (status === "exceeded") return { label: "Excedido", tone: "red", percent: row.tracking?.adherencePercent ?? null };
  if (status === "partial") return { label: "Parcial", tone: "amber", percent: row.tracking?.adherencePercent ?? 50 };
  if (status === "missed") return { label: "No cumplido", tone: "red", percent: 0 };
  return { label: "Pendiente", tone: "slate", percent: null };
}

function menuState(row) {
  const hasMenu = Boolean(row?.assignment?.primaryMenu);
  if (!hasMenu) return { label: "Sin menú", tone: "slate" };
  const targetKcal = macro(row?.target?.kcal);
  const menuKcal = choiceTotals(menuChoices(row)[0]).kcal;
  const proteinDiff = macro(row?.compatibility?.proteinDiff);
  const diff = menuKcal - targetKcal;
  if (targetKcal && Math.abs(diff) <= targetKcal * 0.08 && proteinDiff >= -8) return { label: "Cerca de la meta", tone: "green" };
  if (targetKcal && diff > targetKcal * 0.1) return { label: "Excede kcal", tone: "red" };
  if (targetKcal && diff < -targetKcal * 0.12) return { label: "Bajo en kcal", tone: "amber" };
  if (proteinDiff < -10) return { label: "Bajo en proteína", tone: "amber" };
  return { label: "Revisar", tone: "amber" };
}

function toneClass(tone) {
  if (tone === "green") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";
  if (tone === "red") return "border-rose-400/30 bg-rose-400/10 text-rose-100";
  if (tone === "amber") return "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]";
  if (tone === "blue") return "border-sky-400/30 bg-sky-400/10 text-sky-100";
  return "border-white/10 bg-white/[0.04] text-zinc-300";
}

function progressTone(row) {
  const state = menuState(row);
  if (state.tone === "green") return "from-emerald-400 to-lime-300";
  if (state.tone === "red") return "from-rose-400 to-orange-300";
  if (state.tone === "amber") return "from-[#D4AF37] to-orange-300";
  return "from-zinc-600 to-zinc-500";
}

function menuChoices(row) {
  const choices = [];
  const primary = row?.assignment?.primaryMenu;
  if (primary?.menuSnapshot) {
    choices.push({
      key: primary.menuId || primary.menuSnapshot.id || "primary",
      type: "primary",
      label: "Menu principal",
      snapshot: primary.menuSnapshot,
      totals: row?.menuTotals || primary.menuSnapshot.totals || primary.menuSnapshot,
    });
  }
  const alternatives = Array.isArray(row?.assignment?.alternatives) ? row.assignment.alternatives : [];
  alternatives.forEach((alternative, index) => {
    const snapshot = alternative?.menuSnapshot || {};
    if (!snapshot || !Object.keys(snapshot).length) return;
    choices.push({
      key: alternative.menuId || snapshot.id || `alternative-${index}`,
      type: "alternative",
      index,
      label: `Alternativa ${index + 1}`,
      snapshot,
      totals: snapshot.totals || {
        kcal: snapshot.kcal,
        proteina: snapshot.protein,
        carbs: snapshot.carbs,
        grasas: snapshot.fat,
      },
    });
  });
  return choices;
}

function selectedAlternativeIndex(row = {}) {
  const value = row?.tracking?.selectedAlternative?.index;
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

function isChoiceActive(row = {}, choice = {}) {
  const selectedIndex = selectedAlternativeIndex(row);
  if (choice?.type === "alternative") return selectedIndex === choice.index;
  return selectedIndex === null;
}

function choiceShortLabel(choice = {}) {
  if (choice?.type === "alternative") return `Alt ${Number(choice.index) + 1}`;
  return "Principal";
}

function choiceDisplayName(choice = {}) {
  return choice?.snapshot?.name || choice?.snapshot?.nombre || choice?.label || "Menú asignado";
}

function choiceMobileName(choice = {}) {
  const explicitName = choice?.snapshot?.name || choice?.snapshot?.nombre;
  if (explicitName && !String(explicitName).toLowerCase().includes("sin nombre")) return explicitName;
  const totals = choiceTotals(choice);
  if (totals.kcal || totals.proteina) {
    return `${formatNumber(totals.kcal, 0)} kcal / ${formatNumber(totals.proteina, 0)} g proteina`;
  }
  if (choice?.type === "primary") return "Menu principal";
  return choice?.label || "Menu asignado";
}

function choiceMeals(choice = {}) {
  return choice?.snapshot ? snapshotMeals(choice.snapshot) : [];
}

function choiceTotals(choice = {}) {
  const direct = totalFromLike(choice?.totals || choice?.snapshot || {});
  const calculated = sumTotals(choiceMeals(choice).map(mealTotals));
  return totalsWithFallback(direct, calculated);
}

function choiceStatus(row = {}, choice = {}) {
  const target = targetTotals(row);
  const totals = choiceTotals(choice);
  if (!choice?.snapshot) return { label: "Sin menú", tone: "slate" };
  const diff = totals.kcal - target.kcal;
  if (target.kcal && Math.abs(diff) <= target.kcal * 0.08) return { label: "Cerca de la meta", tone: "green" };
  if (target.kcal && diff > target.kcal * 0.1) return { label: "Excede kcal", tone: "red" };
  if (target.kcal && diff < -target.kcal * 0.12) return { label: "Bajo en kcal", tone: "amber" };
  return { label: "Revisar", tone: "amber" };
}

function menuCountTitle(row) {
  const choices = menuChoices(row);
  if (!choices.length) return "Sin menu asignado";
  if (choices.length === 1) return choices[0].snapshot?.name || "Menu asignado";
  return `Total menus (${choices.length})`;
}

function dayHeading(row) {
  if (!row) return "";
  return row.date === todayIso() ? `Hoy, ${row.dayLabel}` : row.dayLabel;
}

function snapshotMeals(snapshot = {}) {
  const safeSnapshot = snapshot && typeof snapshot === "object" ? snapshot : {};
  if (Array.isArray(safeSnapshot.meals)) return safeSnapshot.meals;
  if (Array.isArray(safeSnapshot.comidas)) return safeSnapshot.comidas;
  return [];
}

function mealName(meal = {}, index = 0) {
  const safeMeal = meal && typeof meal === "object" ? meal : {};
  return safeMeal.name || safeMeal.nombre || safeMeal.tipoComida || safeMeal.type || `Comida ${index + 1}`;
}

function mealTotals(meal = {}) {
  const safeMeal = meal && typeof meal === "object" ? meal : {};
  const direct = totalFromLike(safeMeal.totales || safeMeal.totals || safeMeal);
  const calculated = sumTotals(mealFoods(safeMeal));
  return totalsWithFallback(direct, calculated);
}

function mealId(meal = {}, index = 0) {
  return String(meal.id || meal._id || meal.nombre || meal.name || `meal-${index + 1}`);
}

function emptyTotals() {
  return { kcal: 0, proteina: 0, carbs: 0, grasas: 0 };
}

function totalFromLike(value = {}) {
  const safeValue = value && typeof value === "object" ? value : {};
  const nested =
    safeValue.totals ||
    safeValue.totales ||
    safeValue.macros ||
    safeValue.nutrition ||
    safeValue.nutricion ||
    {};
  return {
    kcal: macro(readMacroValue(nested, TOTAL_KEYS.kcal) ?? readMacroValue(safeValue, TOTAL_KEYS.kcal)),
    proteina: macro(readMacroValue(nested, TOTAL_KEYS.proteina) ?? readMacroValue(safeValue, TOTAL_KEYS.proteina)),
    carbs: macro(readMacroValue(nested, TOTAL_KEYS.carbs) ?? readMacroValue(safeValue, TOTAL_KEYS.carbs)),
    grasas: macro(readMacroValue(nested, TOTAL_KEYS.grasas) ?? readMacroValue(safeValue, TOTAL_KEYS.grasas)),
  };
}

function hasTotalValue(totals = {}) {
  const safeTotals = totalFromLike(totals);
  return ["kcal", "proteina", "carbs", "grasas"].some((key) => Math.abs(safeTotals[key]) > 0.001);
}

function totalsWithFallback(primary = {}, fallback = {}) {
  const safePrimary = totalFromLike(primary);
  const safeFallback = totalFromLike(fallback);
  if (!hasTotalValue(safePrimary)) return safeFallback;
  if (!hasTotalValue(safeFallback)) return safePrimary;
  return {
    kcal: safePrimary.kcal || safeFallback.kcal,
    proteina: safePrimary.proteina || safeFallback.proteina,
    carbs: safePrimary.carbs || safeFallback.carbs,
    grasas: safePrimary.grasas || safeFallback.grasas,
  };
}

function sumTotals(items = []) {
  return items.reduce((acc, item) => {
    const totals = totalFromLike(item?.totals || item);
    return {
      kcal: acc.kcal + totals.kcal,
      proteina: acc.proteina + totals.proteina,
      carbs: acc.carbs + totals.carbs,
      grasas: acc.grasas + totals.grasas,
    };
  }, emptyTotals());
}

function addTotals(left = {}, right = {}) {
  const a = totalFromLike(left);
  const b = totalFromLike(right);
  return {
    kcal: a.kcal + b.kcal,
    proteina: a.proteina + b.proteina,
    carbs: a.carbs + b.carbs,
    grasas: a.grasas + b.grasas,
  };
}

function subtractTotals(left = {}, right = {}) {
  const a = totalFromLike(left);
  const b = totalFromLike(right);
  return {
    kcal: a.kcal - b.kcal,
    proteina: a.proteina - b.proteina,
    carbs: a.carbs - b.carbs,
    grasas: a.grasas - b.grasas,
  };
}

function trackingChoice(row = {}) {
  const choices = menuChoices(row);
  const selectedIndex = selectedAlternativeIndex(row);
  return choices.find((choice) => choice.type === "alternative" && choice.index === selectedIndex) || choices[0] || null;
}

function completedMenuMealsTotals(row = {}) {
  const choice = trackingChoice(row);
  const meals = choice ? choiceMeals(choice) : [];
  const completed = completedMealIdSet(row);
  return sumTotals(meals.filter((meal, index) => completed.has(mealId(meal, index))).map(mealTotals));
}

function trackingListTotals(list = []) {
  return sumTotals(Array.isArray(list) ? list : []);
}

function localConsumedTotals(row = {}) {
  const tracking = row?.tracking || {};
  return sumTotals([
    completedMenuMealsTotals(row),
    trackingListTotals(tracking.manualEntries),
    trackingListTotals(tracking.generatedRemainingMeals),
    trackingListTotals(tracking.mealReplacements),
    trackingListTotals(tracking.foodReplacements),
  ]);
}

function targetTotals(row = {}) {
  return {
    kcal: macro(row?.target?.kcal),
    proteina: macro(row?.target?.p ?? row?.target?.proteina),
    carbs: macro(row?.target?.c ?? row?.target?.carbs),
    grasas: macro(row?.target?.g ?? row?.target?.grasas),
  };
}

function consumedTotals(row = {}) {
  const trackingTotals = row?.tracking?.consumedTotals;
  const backendTotals = trackingTotals ? totalFromLike(trackingTotals) : emptyTotals();
  const localTotals = localConsumedTotals(row);
  const tracking = row?.tracking || {};
  const hasLocalTrackingData = [
    tracking.completedMenuMealIds,
    tracking.manualEntries,
    tracking.generatedRemainingMeals,
    tracking.mealReplacements,
    tracking.foodReplacements,
  ].some((list) => Array.isArray(list) && list.length);
  if (hasLocalTrackingData) return localTotals;
  if (!trackingTotals) return localTotals;
  if (!hasTotalValue(localTotals)) return backendTotals;
  if (!hasTotalValue(backendTotals)) return localTotals;
  return localTotals.kcal > backendTotals.kcal + 1 ? localTotals : backendTotals;
}

function remainingTotals(row = {}) {
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  return {
    kcal: target.kcal - consumed.kcal,
    proteina: target.proteina - consumed.proteina,
    carbs: target.carbs - consumed.carbs,
    grasas: target.grasas - consumed.grasas,
  };
}

function positiveTotals(totals = {}) {
  return {
    kcal: Math.max(0, macro(totals.kcal)),
    proteina: Math.max(0, macro(totals.proteina ?? totals.protein)),
    carbs: Math.max(0, macro(totals.carbs)),
    grasas: Math.max(0, macro(totals.grasas ?? totals.fat)),
  };
}

function completedMealIdSet(row = {}) {
  return new Set(Array.isArray(row?.tracking?.completedMenuMealIds) ? row.tracking.completedMenuMealIds.map(String) : []);
}

function useIsMobileMenuLayout() {
  const query = "(max-width: 1023px)";
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener?.("change", onChange);
    return () => media.removeEventListener?.("change", onChange);
  }, []);

  return matches;
}

function compactDayLabel(row = {}) {
  return row?.dayLabel || dayHeading(row).replace(/^Hoy,\s*/i, "") || "Día";
}

function completionPercent(row = {}) {
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  if (!target.kcal) {
    const status = statusMeta(row);
    if (Number.isFinite(Number(status.percent))) {
      return Math.max(0, Math.min(100, Math.round(Number(status.percent))));
    }
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((consumed.kcal / target.kcal) * 100)));
}

function trackingLabel(row = {}) {
  const label = statusMeta(row).label;
  return label === "Cumplido" ? "Completo" : label;
}

function mealFoods(meal = {}) {
  const items = Array.isArray(meal.items)
    ? meal.items
    : Array.isArray(meal.foods)
      ? meal.foods
      : Array.isArray(meal.alimentos)
        ? meal.alimentos
        : Array.isArray(meal.ingredientes)
          ? meal.ingredientes
          : Array.isArray(meal.ingredients)
            ? meal.ingredients
            : [];
  return items.map(normalizeMealFood);
}

function normalizeMealFood(item = {}, index = 0) {
  const safeItem = item && typeof item === "object" ? item : {};
  const source =
    safeItem.alimentoSnapshot ||
    safeItem.foodSnapshot ||
    safeItem.productoSnapshot ||
    safeItem.food ||
    (safeItem.alimento && typeof safeItem.alimento === "object" ? safeItem.alimento : null) ||
    {};
  const name =
    safeItem.nombreSnapshot ||
    source.nombre ||
    source.name ||
    safeItem.name ||
    safeItem.nombre ||
    (typeof safeItem.alimento === "string" ? safeItem.alimento : "") ||
    safeItem.label ||
    `Alimento ${index + 1}`;
  const cantidad = safeItem.cantidad ?? safeItem.quantity ?? safeItem.qty ?? safeItem.gramos ?? safeItem.grams;
  const unidad = safeItem.unidad || safeItem.unit || (safeItem.gramos || safeItem.grams ? "g" : "");
  const amount = safeItem.amount || foodAmount(cantidad, unidad);
  const itemTotals = totalFromLike(safeItem);
  const sourceTotals = totalFromLike(source);
  const perUnitTotals = perUnitTotalsFromLike(safeItem, source);
  const calculatedTotals = totalsWithFallback(
    foodTotalsFromQuantity(safeItem, sourceTotals),
    foodTotalsFromQuantity({ ...safeItem, macroBasis: "perUnit" }, perUnitTotals)
  );
  const imageSource = {
    ...source,
    ...safeItem,
    name,
    nombre: name,
    category: safeItem.categoriaSnapshot || safeItem.categoria || safeItem.category || source.categoria || source.category || "",
  };
  return {
    id: String(safeItem.id || safeItem._id || safeItem.alimentoId || `${name}-${index}`),
    alimentoId: safeItem.alimentoId || safeItem.foodId || safeItem.id || null,
    name,
    amount,
    unidad,
    cantidad,
    totals: totalsWithFallback(itemTotals, calculatedTotals),
    category: safeItem.categoriaSnapshot || safeItem.categoria || safeItem.category || "",
    imagen: safeItem.imagen || source.imagen || null,
    imageUrl: safeItem.imagenUrl || source.imagenUrl || getFoodImageUrl(imageSource),
    imageAlt: safeItem.imagen?.alt || source.imagen?.alt || safeItem.imagenAlt || source.imagenAlt || name,
    raw: safeItem,
  };
}

function perUnitTotalsFromLike(item = {}, source = {}) {
  return {
    kcal: macro(item.unidadCalorica ?? item.caloriaUnidad ?? item.caloriasUnidad ?? item.kcalUnidad ?? source.unidadCalorica ?? source.caloriaUnidad ?? source.caloriasUnidad ?? source.kcalUnidad),
    proteina: macro(item.unidadProteica ?? item.proteinaUnidad ?? item.proteinasUnidad ?? item.proteinUnidad ?? source.unidadProteica ?? source.proteinaUnidad ?? source.proteinasUnidad ?? source.proteinUnidad),
    carbs: macro(item.unidadCarbo ?? item.carboUnidad ?? item.carbsUnidad ?? item.carbohidratosUnidad ?? source.unidadCarbo ?? source.carboUnidad ?? source.carbsUnidad ?? source.carbohidratosUnidad),
    grasas: macro(item.unidadGrasas ?? item.grasasUnidad ?? item.grasaUnidad ?? item.fatUnidad ?? source.unidadGrasas ?? source.grasasUnidad ?? source.grasaUnidad ?? source.fatUnidad),
  };
}

function foodTotalsFromQuantity(item = {}, sourceTotals = {}) {
  const quantity = macro(item.cantidad ?? item.quantity ?? item.qty ?? item.gramos ?? item.grams);
  const totals = totalFromLike(sourceTotals);
  if (!hasTotalValue(totals)) return emptyTotals();
  if (!quantity) return totals;
  const basis = String(item.macroBasis || item.basis || item.base || "").toLowerCase();
  const unit = String(item.unidad || item.unit || "g").toLowerCase();
  const isPerUnit = basis === "perunit" || basis === "per_unit" || basis === "unidad" || basis === "porunidad";
  const explicitPer100 = basis === "per100" || basis === "por100" || basis === "por_100";
  const gramUnit = unit === "g" || unit === "gr" || unit === "gramos";
  const looksPerGram = !basis && gramUnit && (
    (totals.kcal > 0 && totals.kcal <= 12) ||
    (!totals.kcal && Math.max(totals.proteina, totals.carbs, totals.grasas) <= 2)
  );
  const isPer100 = explicitPer100 || (gramUnit && !looksPerGram);
  const multiplier = isPerUnit || looksPerGram ? quantity : isPer100 ? quantity / 100 : quantity;
  return {
    kcal: totals.kcal * multiplier,
    proteina: totals.proteina * multiplier,
    carbs: totals.carbs * multiplier,
    grasas: totals.grasas * multiplier,
  };
}

function foodAmount(cantidad, unidad = "") {
  const value = Number(cantidad);
  if (!Number.isFinite(value) || value <= 0) return "";
  const digits = Math.abs(value - Math.round(value)) > 0.05 ? 1 : 0;
  return `${formatNumber(value, digits)} ${unidad || ""}`.trim();
}

function foodMacroLine(food = {}) {
  const totals = food.totals || totalFromLike(food);
  const pieces = [];
  if (totals.kcal) pieces.push(displayKcal(totals.kcal));
  if (totals.proteina || totals.carbs || totals.grasas) {
    pieces.push(`P ${formatNumber(totals.proteina, 0)} / C ${formatNumber(totals.carbs, 0)} / G ${formatNumber(totals.grasas, 0)}`);
  }
  return pieces.join(" · ");
}

function foodLibraryMacroLine(food = {}) {
  const totals = {
    kcal: macro(food.kcal ?? food.calorias ?? food.calories ?? food.energy ?? food.energia),
    proteina: macro(food.proteina ?? food.proteinas ?? food.protein),
    carbs: macro(food.carbs ?? food.carbohidratos ?? food.carbohydrates ?? food.hidratos),
    grasas: macro(food.grasas ?? food.grasa ?? food.fat ?? food.fats),
  };
  const basis = String(food.macroBasis || food.raw?.macroBasis || "").toLowerCase();
  const unit = food.unit || food.unidad || "g";
  const suffix = basis === "per100" ? "por 100 g" : `por ${unit}`;
  return `${displayKcal(totals.kcal)} - P ${formatNumber(totals.proteina, 0)} / C ${formatNumber(totals.carbs, 0)} / G ${formatNumber(totals.grasas, 0)} - ${suffix}`;
}

function mealIconType(meal = {}, index = 0) {
  const text = `${mealName(meal, index)} ${meal.tipoComida || meal.type || ""}`.toLowerCase();
  if (meal?.source === "manual_food" || meal?.mealType === "manual") return "manual";
  if (meal?.source === "generated_remaining_meal" || meal?.mealType === "generated") return "generated";
  if (text.includes("desayuno")) return "breakfast";
  if (text.includes("almuerzo")) return "lunch";
  if (text.includes("merienda") || text.includes("snack")) return "snack";
  if (text.includes("cena")) return "dinner";
  return "meal";
}

function savedMealTipoFromMenuMeal(meal = {}, index = 0) {
  const explicit = String(meal?.tipoComida || meal?.mealType || meal?.type || "").trim();
  const normalized = explicit.toLowerCase();
  if (["desayuno", "almuerzo", "merienda", "cena", "snack", "preentreno", "postentreno", "otro"].includes(normalized)) {
    return normalized;
  }
  const byIcon = mealIconType(meal, index);
  if (byIcon === "breakfast") return "desayuno";
  if (byIcon === "lunch") return "almuerzo";
  if (byIcon === "snack") return "merienda";
  if (byIcon === "dinner") return "cena";
  return "otro";
}

function quantityFromMenuFood(food = {}) {
  const direct = Number(food.cantidad ?? food.quantity ?? food.qty ?? food.gramos ?? food.grams);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = String(food.amount || "").replace(",", ".").match(/\d+(\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function unitFromMenuFood(food = {}) {
  const direct = food.unidad || food.unit;
  if (direct) return direct;
  const match = String(food.amount || "").match(/[a-zA-Z]+/);
  return match?.[0] || "g";
}

function savedMealItemFromMenuFood(food = {}) {
  const totals = totalFromLike(food?.totals || food);
  return {
    alimentoId: food.alimentoId || food.foodId || food.id || "",
    nombre: food.name || food.nombre || "Alimento",
    cantidad: quantityFromMenuFood(food),
    unidad: unitFromMenuFood(food),
    kcal: totals.kcal,
    proteina: totals.proteina,
    proteinas: totals.proteina,
    carbs: totals.carbs,
    carbohidratos: totals.carbs,
    grasas: totals.grasas,
    fibra: macro(food.fibra ?? food.raw?.fibra),
    categoria: food.category || food.categoria || food.raw?.categoria || "",
    imagenUrl: food.imageUrl || food.imagenUrl || "",
    imagenAlt: food.imageAlt || food.imagenAlt || food.name || food.nombre || "Alimento",
  };
}

function savedMealPayloadFromMenuMeal(meal = {}, mealIndex = 0) {
  const items = mealFoods(meal).map(savedMealItemFromMenuFood);
  const tipoComida = savedMealTipoFromMenuMeal(meal, mealIndex);
  return {
    nombre: mealName(meal, mealIndex),
    descripcion: "Guardada desde el menu diario",
    tipoComida,
    origen: "guardadaDesdeMenu",
    tags: ["menu"],
    items,
  };
}

function isGeneratedRemainingMeal(entry = {}) {
  const source = String(entry?.source || "");
  return source === "generated_remaining_meal" || source === "auto_generated_remaining";
}

function generatedRemainingMeals(row = {}) {
  return (Array.isArray(row?.tracking?.generatedRemainingMeals) ? row.tracking.generatedRemainingMeals : [])
    .filter(isGeneratedRemainingMeal);
}

function generatedDateFromId(entry = {}) {
  const text = `${entry.generationRunId || ""} ${entry.runId || ""} ${entry.id || ""}`;
  const match = text.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function generatedActiveFrom(entry = {}) {
  return entry.activeFromDate || entry.date || generatedDateFromId(entry) || entry.weekStart || "";
}

function generatedActiveUntil(entry = {}) {
  const from = generatedActiveFrom(entry);
  if (entry.activeUntilDate || entry.weekEnd || entry.date) {
    return entry.activeUntilDate || entry.weekEnd || entry.date || "";
  }
  return from ? addDays(mondayOfWeek(from), 6) : "";
}

function isGeneratedActiveForDate(entry = {}, date = "") {
  if (!isGeneratedRemainingMeal(entry)) return false;
  if (entry.isActiveReplacement === false) return false;
  const from = generatedActiveFrom(entry);
  const until = generatedActiveUntil(entry);
  if (!from && !until) return !entry.date || entry.date === date;
  return (!from || date >= from) && (!until || date <= until);
}

function isWeeklyGeneratedRemainingOverride(entry = {}) {
  const source = String(entry?.source || "");
  if (!isGeneratedRemainingMeal(entry)) return false;
  if (entry.mode && entry.mode !== "complete_pending_meals") return false;
  if (entry.scope && entry.scope !== "week") return false;
  if (source === "auto_generated_remaining" && !entry.mode && !entry.scope && !entry.generationRunId && !generatedDateFromId(entry)) {
    return false;
  }
  return true;
}

function generatedRunKey(entry = {}) {
  if (entry.generationRunId) return String(entry.generationRunId);
  if (entry.runId) return String(entry.runId);
  if (entry.createdAt) return `${entry.weekStart || entry.date || "week"}-${entry.createdAt}`;
  const id = String(entry.id || "");
  const withoutIndex = id.replace(/-\d+$/, "");
  return withoutIndex || `${entry.weekStart || entry.date || "week"}-legacy`;
}

function generatedRunTimestamp(entry = {}) {
  const text = `${entry.generationRunId || ""} ${entry.runId || ""} ${entry.id || ""}`;
  const matches = [...text.matchAll(/(\d{10,})/g)].map((match) => match[1]);
  return matches[matches.length - 1] || "";
}

function generatedRunSortValue(entries = []) {
  const sample = entries[0] || {};
  const value = sample.updatedAt || sample.createdAt || generatedRunTimestamp(sample) || sample.activeFromDate || sample.date || sample.weekStart || "";
  return `${value}-${sample.generationRunId || sample.runId || sample.id || ""}`;
}

function latestGeneratedRunEntries(entries = []) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = generatedRunKey(entry);
    groups.set(key, [...(groups.get(key) || []), entry]);
  });
  return [...groups.values()]
    .sort((a, b) => generatedRunSortValue(b).localeCompare(generatedRunSortValue(a)))[0] || [];
}

function isSameWeeklyGeneratedOverride(entry = {}, weekStart = "", weekEnd = "") {
  const entryWeekStart = entry.weekStart || mondayOfWeek(entry.activeFromDate || entry.date || generatedDateFromId(entry) || weekStart || todayIso());
  const entryWeekEnd = entry.weekEnd || addDays(entryWeekStart, 6);
  return isWeeklyGeneratedRemainingOverride(entry) &&
    entry.isActiveReplacement !== false &&
    (!weekStart || entryWeekStart === weekStart) &&
    (!weekEnd || entryWeekEnd === weekEnd);
}

function activeGeneratedRemainingMeals(row = {}, weekRows = []) {
  const date = row?.date || "";
  const entries = [
    ...generatedRemainingMeals(row),
    ...(Array.isArray(weekRows) ? weekRows.flatMap((day) => generatedRemainingMeals(day)) : []),
  ];
  const seen = new Set();
  const activeEntries = entries
    .filter((entry) => isGeneratedActiveForDate(entry, date))
    .filter(isWeeklyGeneratedRemainingOverride)
    .filter((entry, index) => {
      const key = String(entry.id || `${entry.date || "day"}-${index}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return latestGeneratedRunEntries(activeEntries);
}

function rowWithActiveGeneratedMeals(row = {}, weekRows = []) {
  const activeEntries = activeGeneratedRemainingMeals(row, weekRows);
  const existing = Array.isArray(row?.tracking?.generatedRemainingMeals) ? row.tracking.generatedRemainingMeals : [];
  const retainedEntries = existing.filter((entry) => !isGeneratedRemainingMeal(entry));
  const existingIds = new Set(retainedEntries.map((entry) => String(entry?.id || "")));
  const merged = [
    ...retainedEntries,
    ...activeEntries.filter((entry) => !existingIds.has(String(entry?.id || ""))),
  ];
  const currentIds = existing.map((entry) => String(entry?.id || "")).join("|");
  const nextIds = merged.map((entry) => String(entry?.id || "")).join("|");
  if (currentIds === nextIds) return row;
  return rowWithTracking(row, { generatedRemainingMeals: merged });
}

function normalizeReplacementToken(value = "") {
  return String(value || "").trim().toLowerCase();
}

function mealTypeToken(meal = {}, index = 0) {
  return normalizeReplacementToken(meal.tipoComida || meal.mealType || meal.type || mealIconType(meal, index));
}

function replacementMetaFromGenerated(entries = []) {
  const ids = new Set();
  const types = new Set();
  const names = new Set();
  entries.forEach((entry) => {
    if (Array.isArray(entry?.replacesMealIds)) {
      entry.replacesMealIds.forEach((value) => ids.add(String(value)));
    }
    if (Array.isArray(entry?.replacesMealTypes)) {
      entry.replacesMealTypes.forEach((value) => types.add(normalizeReplacementToken(value)));
    }
    if (Array.isArray(entry?.replacesMealNames)) {
      entry.replacesMealNames.forEach((value) => names.add(normalizeReplacementToken(value)));
    }
  });
  return { ids, types, names };
}

function mergeReplacementMeta(...metas) {
  const merged = { ids: new Set(), types: new Set(), names: new Set() };
  metas.forEach((meta = {}) => {
    meta.ids?.forEach((value) => merged.ids.add(value));
    meta.types?.forEach((value) => merged.types.add(value));
    meta.names?.forEach((value) => merged.names.add(value));
  });
  return merged;
}

function hasReplacementMeta(meta = {}) {
  return Boolean(meta.ids?.size || meta.types?.size || meta.names?.size);
}

function inferPendingReplacementMeta(row = {}, baseMeals = []) {
  const completed = completedMealIdSet(row);
  const meta = { ids: new Set(), types: new Set(), names: new Set() };
  baseMeals.forEach((meal, index) => {
    const id = mealId(meal, index);
    if (completed.has(id)) return;
    meta.ids.add(String(id));
    meta.types.add(mealTypeToken(meal, index));
    meta.names.add(normalizeReplacementToken(mealName(meal, index)));
  });
  return meta;
}

function generatedReplacementMetaForMeals(row = {}, baseMeals = [], weekRows = []) {
  const activeEntries = activeGeneratedRemainingMeals(row, weekRows);
  const meta = replacementMetaFromGenerated(activeEntries);
  if (!activeEntries.length || hasReplacementMeta(meta)) return meta;
  return inferPendingReplacementMeta(row, baseMeals);
}

function mealMatchesReplacement(meal = {}, index = 0, meta = {}) {
  return Boolean(
    meta.ids?.has(String(mealId(meal, index))) ||
    meta.types?.has(mealTypeToken(meal, index)) ||
    meta.names?.has(normalizeReplacementToken(mealName(meal, index)))
  );
}

function originalMealsForGenerated(entry = {}, baseMeals = [], row = {}) {
  const meta = replacementMetaFromGenerated([entry]);
  const effectiveMeta = hasReplacementMeta(meta) ? meta : inferPendingReplacementMeta(row, baseMeals);
  return baseMeals
    .map((meal, mealIndex) => ({ meal, mealIndex }))
    .filter((item) => mealMatchesReplacement(item.meal, item.mealIndex, effectiveMeta));
}

function generatedMealToMeal(entry = {}, index = 0) {
  const foods = Array.isArray(entry.items) ? entry.items : Array.isArray(entry.foods) ? entry.foods : [];
  return {
    id: entry.id || `generated-${index + 1}`,
    name: entry.name || "Comida generada",
    nombre: entry.name || "Comida generada",
    tipoComida: entry.mealType || "generated",
    mealType: entry.mealType || "generated",
    source: "generated_remaining_meal",
    foods,
    items: foods,
    totals: totalFromLike(entry.totals || entry),
    replacementMeta: {
      type: "generated_remaining",
      replacesMealNames: Array.isArray(entry.replacesMealNames) ? entry.replacesMealNames : [],
      replacesMealTypes: Array.isArray(entry.replacesMealTypes) ? entry.replacesMealTypes : [],
      scope: entry.scope || "week",
      activeUntilDate: generatedActiveUntil(entry),
    },
  };
}

function manualEntryToMeal(entry = {}, index = 0) {
  const foods = Array.isArray(entry.items) ? entry.items : Array.isArray(entry.foods) ? entry.foods : [];
  return {
    id: entry.id || `manual-${index + 1}`,
    name: entry.name || "Algo distinto",
    nombre: entry.name || "Algo distinto",
    tipoComida: "manual",
    mealType: "manual",
    source: "manual_food",
    foods,
    items: foods,
    totals: totalFromLike(entry.totals || entry),
    replacementMeta: {
      type: "manual_food",
    },
  };
}

function manualTrackingMeals(row = {}) {
  return (Array.isArray(row?.tracking?.manualEntries) ? row.tracking.manualEntries : [])
    .filter((entry) => entry?.source === "manual_food" || !entry?.source);
}

function manualReplacementMetaForMeals(row = {}, baseMeals = []) {
  const entries = manualTrackingMeals(row);
  const meta = replacementMetaFromGenerated(entries);
  if (!entries.length || hasReplacementMeta(meta)) return meta;
  return inferPendingReplacementMeta(row, baseMeals);
}

function countableMealEntries(entries = []) {
  return entries.filter((entry) => entry?.countsAsMenuMeal !== false);
}

function completedCountableMeals(entries = []) {
  return countableMealEntries(entries).filter((entry) => entry.done).length;
}

function effectiveMealEntriesForDay(row = {}, baseMeals = [], weekRows = []) {
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const generatedMeta = generatedReplacementMetaForMeals(displayRow, baseMeals, weekRows);
  const manualMeta = manualReplacementMetaForMeals(row, baseMeals);
  const replacementMeta = mergeReplacementMeta(generatedMeta, manualMeta);
  const completed = completedMealIdSet(row);
  const visibleBaseMeals = baseMeals
    .map((meal, index) => ({
      key: mealId(meal, index),
      meal: mealWithTrackingReplacements(row, meal, index),
      baseMeal: meal,
      mealIndex: index,
      done: completed.has(mealId(meal, index)),
      generated: false,
    }))
    .filter((entry) => !mealMatchesReplacement(entry.baseMeal, entry.mealIndex, replacementMeta));

  const generatedMeals = activeGeneratedRemainingMeals(displayRow, weekRows).map((entry, index) => {
    return {
      key: entry.id || `generated-${row?.date || "day"}-${index + 1}`,
      meal: generatedMealToMeal(entry, index),
      baseMeal: generatedMealToMeal(entry, index),
      mealIndex: baseMeals.length + index,
      done: true,
      generated: true,
      generatedEntry: entry,
      replacedOriginalMeals: originalMealsForGenerated(entry, baseMeals, row),
    };
  });

  const manualMeals = manualTrackingMeals(row).map((entry, index) => {
    const meal = manualEntryToMeal(entry, index);
    return {
      key: entry.id || `manual-${row?.date || "day"}-${index + 1}`,
      meal,
      baseMeal: meal,
      mealIndex: baseMeals.length + generatedMeals.length + index,
      done: true,
      generated: false,
      manual: true,
      countsAsMenuMeal: false,
      manualEntry: entry,
      replacedOriginalMeals: originalMealsForGenerated(entry, baseMeals, row),
    };
  });

  return [...visibleBaseMeals, ...generatedMeals, ...manualMeals];
}

function pendingBaseMealsForRemaining(row = {}, weekRows = []) {
  const choice = trackingChoice(row);
  const baseMeals = choice ? choiceMeals(choice) : [];
  const completed = completedMealIdSet(row);
  const replacementMeta = generatedReplacementMetaForMeals(row, baseMeals, weekRows);
  return baseMeals
    .map((meal, index) => {
      const id = mealId(meal, index);
      return {
        id,
        meal,
        index,
        name: mealName(meal, index),
        type: meal.tipoComida || meal.type || mealIconType(meal, index),
        totals: mealTotals(mealWithTrackingReplacements(row, meal, index)),
      };
    })
    .filter((entry) => !completed.has(entry.id) && !mealMatchesReplacement(entry.meal, entry.index, replacementMeta));
}

function splitPendingMeals(pending = [], count = 1) {
  const groups = Array.from({ length: count }, () => []);
  pending.forEach((meal, index) => {
    groups[Math.min(index, count - 1)].push(meal);
  });
  return groups;
}

function generatedTargetName(group = [], index = 0, count = 1) {
  if (group.length === 1) return group[0].name;
  if (count === 1) return "Comida generada";
  return `Comida generada ${index + 1}`;
}

function remainingGenerationTargets(row = {}, count = 1, weekRows = []) {
  const remaining = positiveTotals(remainingTotals(row));
  const targetCount = Math.min(3, Math.max(1, Number(count) || 1));
  const portions = Array.from({ length: targetCount }, () => 1 / targetCount);
  const pending = pendingBaseMealsForRemaining(row, weekRows);
  const groups = splitPendingMeals(pending, targetCount);
  return portions.map((portion, index) => {
    const group = groups[index] || [];
    const replacesMealIds = group.map((meal) => meal.id);
    const replacesMealNames = group.map((meal) => meal.name);
    const replacesMealTypes = group.map((meal) => meal.type);
    return {
      id: `remaining-${index + 1}`,
      name: generatedTargetName(group, index, targetCount),
      mealType: group.length === 1 ? group[0].type : "generated",
      replacesMealIds,
      replacesMealNames,
      replacesMealTypes,
      totals: {
        kcal: Math.round(remaining.kcal * portion),
        proteina: Math.round(remaining.proteina * portion * 10) / 10,
        carbs: Math.round(remaining.carbs * portion * 10) / 10,
        grasas: Math.round(remaining.grasas * portion * 10) / 10,
      },
    };
  });
}

function trackingPayloadBase(row = {}, overrides = {}) {
  const tracking = row.tracking || {};
  return {
    date: row.date,
    dayKey: row.dayKey,
    completedMenuMealIds: Array.isArray(tracking.completedMenuMealIds) ? tracking.completedMenuMealIds : [],
    manualEntries: Array.isArray(tracking.manualEntries) ? tracking.manualEntries : [],
    generatedRemainingMeals: Array.isArray(tracking.generatedRemainingMeals) ? tracking.generatedRemainingMeals : [],
    mealReplacements: Array.isArray(tracking.mealReplacements) ? tracking.mealReplacements : [],
    foodReplacements: Array.isArray(tracking.foodReplacements) ? tracking.foodReplacements : [],
    selectedAlternative: tracking.selectedAlternative || null,
    ...overrides,
  };
}

function rowWithTracking(row = {}, trackingOverrides = {}) {
  return {
    ...row,
    tracking: {
      ...(row?.tracking || {}),
      ...trackingOverrides,
    },
  };
}

function foodPerUnit(food = {}, key = "kcal") {
  const value = macro(
    food[key] ??
    (key === "kcal" ? food.calorias ?? food.calories ?? food.energy ?? food.energia : undefined) ??
    (key === "proteina" ? food.protein ?? food.proteinas : undefined) ??
    (key === "carbs" ? food.carbohidratos ?? food.carbohydrates ?? food.hidratos : undefined) ??
    (key === "grasas" ? food.grasa ?? food.fat ?? food.fats : 0)
  );
  const basis = String(food.macroBasis || food.raw?.macroBasis || "").toLowerCase();
  const unit = String(food.unidad || food.unit || "g").toLowerCase();
  const looksPerGram = !basis && unit === "g" && value > 0 && value <= (key === "kcal" ? 12 : 2);
  const isPer100 = basis === "per100" || (unit === "g" && !looksPerGram && basis !== "perunit");
  return isPer100 ? value / 100 : value;
}

function normalizeGeneratedFood(food = {}) {
  const normalizedImage = food.imagen || food.image || null;
  return {
    id: String(food.foodId || food.id || food.name || food.nombre || Math.random()),
    name: food.name || food.nombre || "Alimento",
    quantity: macro(food.quantity ?? food.cantidad ?? food.amount ?? food.gramos ?? food.grams),
    unit: food.unit || food.unidad || "g",
    kcal: macro(food.kcal ?? food.calorias ?? food.calories),
    proteina: macro(food.proteina ?? food.proteinas ?? food.protein),
    carbs: macro(food.carbs ?? food.carbohidratos ?? food.carbohydrates),
    grasas: macro(food.grasas ?? food.fat ?? food.fats),
    source: food.source || "",
    category: food.categoria || food.category || food.categoriaSnapshot || "",
    imagen: normalizedImage,
    imageUrl: food.imagenUrl || food.imageUrl || getFoodImageUrl({ ...food, imagen: normalizedImage }),
    fixedQuantity: food.fixedQuantity === true,
  };
}

function trackingIdPart(value = "") {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "item";
}

function mealReplacementPrefix(row = {}, mealIndex = 0) {
  return `client-meal-replacement-${row?.date || "day"}-${mealIndex}`;
}

function foodReplacementPrefix(row = {}, mealIndex = 0, foodIndex = 0) {
  return `client-food-replacement-${row?.date || "day"}-${mealIndex}-${foodIndex}`;
}

function isReplacementEntryForMeal(entry = {}, row = {}, mealIndex = 0) {
  const id = String(entry?.id || "");
  return id.startsWith(`${mealReplacementPrefix(row, mealIndex)}-`) ||
    id.startsWith(`client-food-replacement-${row?.date || "day"}-${mealIndex}-`);
}

function mealReplacementEntry(row = {}, mealIndex = 0) {
  const prefix = `${mealReplacementPrefix(row, mealIndex)}-`;
  const entries = [
    ...(Array.isArray(row?.tracking?.mealReplacements) ? row.tracking.mealReplacements : []),
    ...(Array.isArray(row?.tracking?.generatedRemainingMeals) ? row.tracking.generatedRemainingMeals : []),
  ];
  return entries.find((entry) =>
    entry?.source === "client_meal_replacement" && String(entry?.id || "").startsWith(prefix)
  ) || null;
}

function foodReplacementEntry(row = {}, mealIndex = 0, foodIndex = 0) {
  const prefix = `${foodReplacementPrefix(row, mealIndex, foodIndex)}-`;
  const entries = [
    ...(Array.isArray(row?.tracking?.foodReplacements) ? row.tracking.foodReplacements : []),
    ...(Array.isArray(row?.tracking?.generatedRemainingMeals) ? row.tracking.generatedRemainingMeals : []),
  ];
  return entries.find((entry) =>
    entry?.source === "client_food_replacement" && String(entry?.id || "").startsWith(prefix)
  ) || null;
}

function trackingFoodFromFood(food = {}, index = 0) {
  const totals = totalFromLike(food?.totals || food);
  const image = food.imagen || food.image || null;
  return {
    id: String(food.alimentoId || food.id || food.foodId || `food-${index + 1}`),
    name: food.name || food.nombre || food.nombreSnapshot || `Alimento ${index + 1}`,
    quantity: macro(food.cantidad ?? food.quantity),
    unit: food.unidad || food.unit || "g",
    kcal: totals.kcal,
    proteina: totals.proteina,
    carbs: totals.carbs,
    grasas: totals.grasas,
    category: food.category || food.categoria || food.categoriaSnapshot || "",
    imagen: image,
    imageUrl: food.imagenUrl || food.imageUrl || getFoodImageUrl({ ...food, imagen: image }),
  };
}

function mealWithTrackingReplacements(row = {}, meal = {}, mealIndex = 0) {
  const mealEntry = mealReplacementEntry(row, mealIndex);
  if (mealEntry) {
    const foods = Array.isArray(mealEntry.foods) ? mealEntry.foods : [];
    return {
      ...meal,
      id: mealId(meal, mealIndex),
      name: mealEntry.name || mealName(meal, mealIndex),
      nombre: mealEntry.name || mealName(meal, mealIndex),
      source: "client_meal_replacement",
      replacementMeta: {
        type: "meal",
        originalName: mealName(meal, mealIndex),
      },
      foods,
      items: foods,
      totals: totalsWithFallback(sumTotals(foods), addTotals(mealTotals(meal), mealEntry.totals)),
    };
  }

  const foods = mealFoods(meal).map((food, foodIndex) => {
    const entry = foodReplacementEntry(row, mealIndex, foodIndex);
    if (!entry?.foods?.[0]) return food;
    return {
      ...normalizeMealFood(entry.foods[0], foodIndex),
      replacementMeta: {
        type: "food",
        originalName: food.name,
        originalAmount: food.amount,
      },
    };
  });
  const replacementEntries = [
    ...(Array.isArray(row?.tracking?.foodReplacements) ? row.tracking.foodReplacements : []),
    ...(Array.isArray(row?.tracking?.generatedRemainingMeals) ? row.tracking.generatedRemainingMeals : []),
  ];
  const adjustment = sumTotals(replacementEntries.filter((entry) =>
    entry?.source === "client_food_replacement" && String(entry?.id || "").startsWith(`client-food-replacement-${row?.date || "day"}-${mealIndex}-`)
  ));
  if (!hasTotalValue(adjustment)) return meal;
  return {
    ...meal,
    id: mealId(meal, mealIndex),
    foods,
    items: foods,
    totals: addTotals(mealTotals(meal), adjustment),
  };
}

function buildMealReplacementEntry(row = {}, originalMeal = {}, replacementMeal = {}, mealIndex = 0) {
  const originalTotals = mealTotals(originalMeal);
  const replacementTotals = mealTotals(replacementMeal);
  const replacementName = mealName(replacementMeal, mealIndex);
  return {
    id: `${mealReplacementPrefix(row, mealIndex)}-${trackingIdPart(mealId(originalMeal, mealIndex))}`.slice(0, 100),
    name: replacementName,
    source: "client_meal_replacement",
    target: originalTotals,
    foods: mealFoods(replacementMeal).map(trackingFoodFromFood),
    totals: subtractTotals(replacementTotals, originalTotals),
  };
}

function buildFoodReplacementEntry(row = {}, meal = {}, mealIndex = 0, food = {}, foodIndex = 0, replacement = {}) {
  const originalTotals = totalFromLike(food?.totals || food);
  const replacementTotals = totalFromLike(replacement?.totals || replacement);
  return {
    id: `${foodReplacementPrefix(row, mealIndex, foodIndex)}-${trackingIdPart(food.id || food.name)}`.slice(0, 100),
    name: `${mealName(meal, mealIndex)} - reemplazo de ${food.name || "alimento"}`,
    source: "client_food_replacement",
    target: originalTotals,
    foods: [trackingFoodFromFood(replacement, 0)],
    totals: subtractTotals(replacementTotals, originalTotals),
  };
}

function mealReplacementOptions(row = {}, meal = {}, mealIndex = 0) {
  const currentChoice = trackingChoice(row);
  const originalTotals = mealTotals(meal);
  const originalType = mealIconType(meal, mealIndex);
  return menuChoices(row)
    .filter((choice) => choice?.key !== currentChoice?.key)
    .map((choice) => {
      const meals = choiceMeals(choice);
      const samePosition = meals[mealIndex] || null;
      const sameType = meals.find((candidate, index) => mealIconType(candidate, index) === originalType) || null;
      const candidate = samePosition || sameType;
      if (!candidate) return null;
      const totals = mealTotals(candidate);
      const diff = subtractTotals(totals, originalTotals);
      return {
        key: `${choice.key}-${mealIndex}`,
        choice,
        meal: candidate,
        totals,
        diff,
        badge: mealReplacementBadge(diff),
      };
    })
    .filter(Boolean)
    .filter((option, index, list) => list.findIndex((item) =>
      mealName(item.meal, mealIndex) === mealName(option.meal, mealIndex) &&
      Math.round(item.totals.kcal) === Math.round(option.totals.kcal)
    ) === index)
    .sort((a, b) => (Math.abs(a.diff.kcal) + Math.abs(a.diff.proteina) * 8) - (Math.abs(b.diff.kcal) + Math.abs(b.diff.proteina) * 8))
    .slice(0, 6);
}

function mealReplacementBadge(diff = {}) {
  if (Math.abs(diff.kcal) <= 80 && Math.abs(diff.proteina) <= 8) return "Similar";
  if (diff.proteina > 8) return "Mas proteina";
  if (diff.kcal < -100) return "Menos kcal";
  if (diff.kcal > 100) return "Mas kcal";
  return "Compatible";
}

function signedNumber(value, digits = 0) {
  const number = macro(value);
  if (!number) return "0";
  return `${number > 0 ? "+" : ""}${formatNumber(number, digits)}`;
}

function replacementOptionFromEquivalent(option = {}, originalFood = {}) {
  const totals = totalFromLike(option.totales || option.totals || option);
  const cantidad = macro(option.cantidadSugerida ?? option.quantity ?? option.cantidad);
  const unidad = option.unidadSugerida || option.unidad || option.unit || originalFood.unidad || "g";
  const food = {
    id: option.id || option.alimentoId || option.foodId || option.nombre || option.name,
    name: option.nombre || option.name || "Alimento equivalente",
    nombre: option.nombre || option.name || "Alimento equivalente",
    cantidad,
    cantidadSugerida: cantidad,
    unidad,
    unidadSugerida: unidad,
    amount: foodAmount(cantidad, unidad),
    totals,
    totales: totals,
    category: option.categoria || option.category || option.categoriaSnapshot || "",
    imagen: option.imagen || null,
    imageUrl: option.imagenUrl || option.imageUrl || getFoodImageUrl(option),
  };
  return {
    ...food,
    diff: option.diferencia ? totalFromLike(option.diferencia) : subtractTotals(totals, originalFood?.totals || originalFood),
    source: "equivalent",
  };
}

function replacementOptionFromFood(food = {}, originalFood = {}) {
  const originalTotals = totalFromLike(originalFood?.totals || originalFood);
  const kcalPerUnit = foodPerUnit(food, "kcal");
  const proteinPerUnit = foodPerUnit(food, "proteina");
  const quantity = originalTotals.kcal && kcalPerUnit
    ? Math.max(1, Math.round((originalTotals.kcal / kcalPerUnit) / 5) * 5)
    : macro(originalFood.cantidad || 100);
  const unit = food.unidad || food.unit || "g";
  const totals = {
    kcal: kcalPerUnit * quantity,
    proteina: proteinPerUnit * quantity,
    carbs: foodPerUnit(food, "carbs") * quantity,
    grasas: foodPerUnit(food, "grasas") * quantity,
  };
  return {
    id: food.id,
    name: food.name || food.nombre,
    nombre: food.name || food.nombre,
    cantidad: quantity,
    cantidadSugerida: quantity,
    unidad: unit,
    unidadSugerida: unit,
    amount: foodAmount(quantity, unit),
    totals,
    totales: totals,
    category: food.categoria || food.category || food.macroGroup || "",
    imagen: food.imagen || null,
    imageUrl: food.imagenUrl || food.imageUrl || getFoodImageUrl(food),
    diff: subtractTotals(totals, originalTotals),
    source: "search",
  };
}

function friendlyEquivalentError(message = "") {
  const text = String(message || "");
  const lower = text.toLowerCase();
  if (lower.includes("perfil") || lower.includes("profesional") || lower.includes("acceso") || lower.includes("men")) {
    return "No encontramos equivalencias automaticas. Podes buscar un alimento manualmente.";
  }
  return text || "No se pudieron buscar equivalencias.";
}

async function getMenuTrackingWeek(start) {
  const qs = start ? `?start=${encodeURIComponent(start)}` : "";
  return await apiFetch(`/api/usuarios/me/menu-tracking/week${qs}`, {
    method: "GET",
    timeoutMs: 12000,
  });
}

async function saveMenuTrackingDay(payload) {
  return await apiFetch("/api/usuarios/me/menu-tracking/day", {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });
}

export default function MenuPlan() {
  const initialWeek = useMemo(() => {
    const start = mondayOfWeek();
    return { start, data: getCachedMenuWeek(start) };
  }, []);
  const [weekStart, setWeekStart] = useState(initialWeek.start);
  const [weekData, setWeekData] = useState(initialWeek.data);
  const [loading, setLoading] = useState(() => !initialWeek.data);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [mobileView, setMobileView] = useState("overview");
  const [mobileDetailChoiceKey, setMobileDetailChoiceKey] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [remainingDraft, setRemainingDraft] = useState(null);
  const [mealDrawer, setMealDrawer] = useState(null);
  const [foodDrawer, setFoodDrawer] = useState(null);
  const [menuOptionsDrawerOpen, setMenuOptionsDrawerOpen] = useState(false);
  const [mealToggleConfirm, setMealToggleConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");
  const isMobileLayout = useIsMobileMenuLayout();

  async function loadWeek(start = weekStart, options = {}) {
    const silent = !!options.silent;
    const cached = getCachedMenuWeek(start);
    const hydrateFromCache = !silent && cached;
    const canUseFreshCacheOnly = hydrateFromCache && !shouldRefreshCachedMenuWeek(start);
    if (hydrateFromCache) {
      setWeekData(cached);
      setLoading(false);
      setError("");
      if (canUseFreshCacheOnly) {
        setRefreshing(false);
        return cached;
      }
      setRefreshing(true);
    } else if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError("");
    }
    try {
      const data = await getMenuTrackingWeek(start);
      setCachedMenuWeek(start, data);
      setWeekData(data);
      setDetailRow((current) => current ? (data?.days || []).find((day) => day.date === current.date) || current : current);
      setMealDrawer((current) => {
        if (!current) return current;
        const freshRow = (data?.days || []).find((day) => day.date === current.row?.date) || current.row;
        const freshChoice = trackingChoice(freshRow);
        const freshBaseMeal = choiceMeals(freshChoice)[current.mealIndex] || current.baseMeal || current.meal;
        return {
          ...current,
          row: freshRow,
          baseMeal: freshBaseMeal,
          meal: mealWithTrackingReplacements(freshRow, freshBaseMeal, current.mealIndex),
        };
      });
      const dates = new Set((data?.days || []).map((day) => day.date));
      if (!dates.has(selectedDate)) {
        setSelectedDate(dates.has(todayIso()) ? todayIso() : data?.days?.[0]?.date || start);
      }
    } catch (err) {
      if (silent) throw err;
      if (hydrateFromCache) {
        console.warn("[MenuPlan] background refresh failed", err);
        return;
      }
      setError(err?.message || "No se pudo cargar tu menú.");
    } finally {
      if (silent || hydrateFromCache) setRefreshing(false);
      else setLoading(false);
    }
  }

  useEffect(() => {
    loadWeek(weekStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  const days = Array.isArray(weekData?.days) ? weekData.days : EMPTY_DAYS;
  const todayRow = useMemo(
    () => days.find((day) => day.date === todayIso()) || days[0] || null,
    [days]
  );
  const selectedRow = useMemo(
    () => days.find((day) => day.date === selectedDate) || todayRow,
    [days, selectedDate, todayRow]
  );
  const selectedDisplayRow = useMemo(
    () => rowWithActiveGeneratedMeals(selectedRow, days),
    [selectedRow, days]
  );
  const permissions = weekData?.permissions || {};
  const canMarkMeals = permissions.canMarkMenuMealsCompleted !== false;
  const canAutoCompleteRemaining = permissions.canAutoCompleteRemainingMeals !== false;
  const canUseMenuAlternatives = permissions.canUseMenuAlternatives !== false;
  const canTrackFoods = permissions.canTrackFoods !== false;

  function moveSelectedDay(amount) {
    const baseDate = selectedRow?.date || todayRow?.date || todayIso();
    const nextDate = addDays(baseDate, amount);
    setSelectedDate(nextDate);
    const nextWeek = mondayOfWeek(nextDate);
    if (nextWeek !== weekStart) setWeekStart(nextWeek);
  }

  async function submitTracking(payload, message = "Registro guardado.") {
    if (!payload?.date) return;
    setSaving(true);
    try {
      await saveMenuTrackingDay(payload);
      await loadWeek(weekStart, { silent: true });
      setToast(message);
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  function toggleMenuMeal(row, meal, index) {
    const id = mealId(meal, index);
    const completed = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String)).has(id);
    setMealToggleConfirm({
      row,
      meal,
      index,
      completed,
    });
  }

  function performToggleMenuMeal(payload = mealToggleConfirm) {
    const row = payload?.row;
    const meal = payload?.meal;
    const index = payload?.index;
    if (!row || !meal || index === undefined || saving) return;
    const id = mealId(meal, index);
    const ids = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
    setMealToggleConfirm(null);
    const optimisticRow = rowWithTracking(row, {
      completedMenuMealIds: [...ids],
    });
    setWeekData((currentData) => currentData ? {
      ...currentData,
      days: (currentData.days || []).map((day) => day.date === optimisticRow.date ? optimisticRow : day),
    } : currentData);
    setDetailRow((current) => current?.date === optimisticRow.date ? optimisticRow : current);
    setMealDrawer((current) => current?.row?.date === optimisticRow.date ? {
      ...current,
      row: optimisticRow,
    } : current);
    submitTracking(
      trackingPayloadBase(row, {
        completedMenuMealIds: [...ids],
      }),
      ids.has(id) ? "Comida marcada como cumplida." : "Comida desmarcada."
    );
  }

  function useAlternative(row, index) {
    submitTracking(
      trackingPayloadBase(row, {
        selectedAlternative: { index },
      }),
      "Alternativa marcada para hoy."
    );
  }

  function selectMenuChoice(row, choice) {
    submitTracking(
      trackingPayloadBase(row, {
        selectedAlternative: choice?.type === "alternative" ? { index: choice.index } : null,
      }),
      choice?.type === "alternative" ? "Alternativa marcada para hoy." : "Menú principal marcado para hoy."
    );
  }

  async function saveMenuMealAsSavedMeal(meal, mealIndex = 0) {
    if (!meal || saving) return;
    const payload = savedMealPayloadFromMenuMeal(meal, mealIndex);
    if (!payload.items.length) {
      setToast("Esta comida no tiene alimentos para guardar.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    setSaving(true);
    try {
      await createSavedMeal(payload);
      setToast("Comida guardada en Mis comidas.");
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo guardar esta comida.");
    } finally {
      setSaving(false);
    }
  }

  async function saveGeneratedRemaining(row, generatedMeals) {
    if (!row?.date) return;
    const activeDate = row.date;
    const activeWeekStart = mondayOfWeek(activeDate);
    const activeWeekEnd = addDays(activeWeekStart, 6);
    const nextRows = days.map((day) => {
      const current = Array.isArray(day?.tracking?.generatedRemainingMeals) ? day.tracking.generatedRemainingMeals : [];
      const filtered = current.filter((entry) =>
        !isSameWeeklyGeneratedOverride(entry, activeWeekStart, activeWeekEnd)
      );
      const nextGeneratedMeals = day.date === row.date ? [...filtered, ...generatedMeals] : filtered;
      return rowWithTracking(day, { generatedRemainingMeals: nextGeneratedMeals });
    });
    setWeekData((currentData) => currentData ? { ...currentData, days: nextRows } : currentData);
    setDetailRow((currentRow) => currentRow ? nextRows.find((day) => day.date === currentRow.date) || currentRow : currentRow);
    setRemainingDraft(null);
    setSaving(true);
    try {
      const rowsToSave = nextRows.filter((day) => {
        const original = days.find((item) => item.date === day.date);
        const originalIds = (original?.tracking?.generatedRemainingMeals || []).map((entry) => String(entry?.id || "")).join("|");
        const nextIds = (day?.tracking?.generatedRemainingMeals || []).map((entry) => String(entry?.id || "")).join("|");
        return day.date === row.date || originalIds !== nextIds;
      });
      await Promise.all(rowsToSave.map((day) =>
        saveMenuTrackingDay(trackingPayloadBase(day, {
          generatedRemainingMeals: day.tracking.generatedRemainingMeals,
        }))
      ));
      await loadWeek(weekStart, { silent: true });
      setToast("Comidas restantes guardadas.");
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudieron guardar las comidas generadas.");
    } finally {
      setSaving(false);
    }
  }

  async function saveManualRemaining(row, manualEntries) {
    if (!row?.date || !Array.isArray(manualEntries) || !manualEntries.length) return;
    const currentManualEntries = Array.isArray(row?.tracking?.manualEntries) ? row.tracking.manualEntries : [];
    const nextManualEntries = [...currentManualEntries, ...manualEntries];
    const optimisticRow = rowWithTracking(row, { manualEntries: nextManualEntries });
    setWeekData((currentData) => currentData ? {
      ...currentData,
      days: (currentData.days || []).map((day) => day.date === row.date ? optimisticRow : day),
    } : currentData);
    setDetailRow((currentRow) => currentRow?.date === row.date ? optimisticRow : currentRow);
    setRemainingDraft(null);
    setSaving(true);
    try {
      await saveMenuTrackingDay(trackingPayloadBase(optimisticRow, {
        manualEntries: nextManualEntries,
      }));
      await loadWeek(weekStart, { silent: true });
      setToast("Registro guardado.");
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo guardar el registro.");
    } finally {
      setSaving(false);
    }
  }

  async function updateManualEntries(row, manualEntries, successMessage = "Registro actualizado.") {
    if (!row?.date) return;
    const nextManualEntries = Array.isArray(manualEntries) ? manualEntries : [];
    const optimisticRow = rowWithTracking(row, { manualEntries: nextManualEntries });
    setWeekData((currentData) => currentData ? {
      ...currentData,
      days: (currentData.days || []).map((day) => day.date === row.date ? optimisticRow : day),
    } : currentData);
    setDetailRow((currentRow) => currentRow?.date === row.date ? optimisticRow : currentRow);
    setMealDrawer((current) => current?.row?.date === row.date ? null : current);
    setSaving(true);
    try {
      await saveMenuTrackingDay(trackingPayloadBase(optimisticRow, {
        manualEntries: nextManualEntries,
      }));
      await loadWeek(weekStart, { silent: true });
      setToast(successMessage);
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo actualizar el registro.");
    } finally {
      setSaving(false);
    }
  }

  function deleteManualEntry(row, manualEntry = {}) {
    const manualId = String(manualEntry?.id || "");
    const current = Array.isArray(row?.tracking?.manualEntries) ? row.tracking.manualEntries : [];
    const next = manualId
      ? current.filter((entry) => String(entry?.id || "") !== manualId)
      : current.slice(0, -1);
    updateManualEntries(row, next, "Registro manual eliminado.");
  }

  function restoreManualEntries(row) {
    updateManualEntries(row, [], "Comidas originales restauradas.");
  }

  async function restoreGeneratedRemaining(row, generatedEntry = {}) {
    const generatedId = String(generatedEntry?.id || "");
    const runId = String(generatedEntry?.generationRunId || generatedEntry?.runId || "");
    const activeWeekStart = generatedEntry.weekStart || mondayOfWeek(row?.date || generatedEntry.date || todayIso());
    const activeWeekEnd = generatedEntry.weekEnd || addDays(activeWeekStart, 6);
    if (!generatedId && !runId) return;
    const nextRows = days.map((day) => {
      const current = Array.isArray(day?.tracking?.generatedRemainingMeals) ? day.tracking.generatedRemainingMeals : [];
      const nextGeneratedMeals = current.filter((entry) => {
        const sameId = generatedId && String(entry?.id || "") === generatedId;
        const sameRun = runId && String(entry?.generationRunId || entry?.runId || "") === runId;
        const sameLegacyActiveWeek = !runId && isSameWeeklyGeneratedOverride(entry, activeWeekStart, activeWeekEnd);
        return !(sameId || sameRun || sameLegacyActiveWeek);
      });
      return rowWithTracking(day, { generatedRemainingMeals: nextGeneratedMeals });
    });
    setWeekData((currentData) => currentData ? { ...currentData, days: nextRows } : currentData);
    setDetailRow((currentRow) => currentRow ? nextRows.find((day) => day.date === currentRow.date) || currentRow : currentRow);
    setSaving(true);
    try {
      const rowsToSave = nextRows.filter((day) => {
        const original = days.find((item) => item.date === day.date);
        const originalIds = (original?.tracking?.generatedRemainingMeals || []).map((entry) => String(entry?.id || "")).join("|");
        const nextIds = (day?.tracking?.generatedRemainingMeals || []).map((entry) => String(entry?.id || "")).join("|");
        return originalIds !== nextIds;
      });
      await Promise.all(rowsToSave.map((day) =>
        saveMenuTrackingDay(trackingPayloadBase(day, {
          generatedRemainingMeals: day.tracking.generatedRemainingMeals,
        }))
      ));
      await loadWeek(weekStart, { silent: true });
      setToast("Menu base restaurado para esta semana.");
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo restaurar el menu base.");
    } finally {
      setSaving(false);
    }
  }

  function applyMealReplacement({ row, originalMeal, replacementMeal, mealIndex }) {
    const replacementEntry = buildMealReplacementEntry(row, originalMeal, replacementMeal, mealIndex);
    const completedIds = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String));
    completedIds.add(mealId(originalMeal, mealIndex));
    const currentMealReplacements = Array.isArray(row?.tracking?.mealReplacements) ? row.tracking.mealReplacements : [];
    const currentFoodReplacements = Array.isArray(row?.tracking?.foodReplacements) ? row.tracking.foodReplacements : [];
    const nextMealReplacements = [
      ...currentMealReplacements.filter((entry) => !isReplacementEntryForMeal(entry, row, mealIndex)),
      replacementEntry,
    ];
    const nextFoodReplacements = currentFoodReplacements.filter((entry) => !isReplacementEntryForMeal(entry, row, mealIndex));
    const optimisticRow = rowWithTracking(row, {
      completedMenuMealIds: [...completedIds],
      mealReplacements: nextMealReplacements,
      foodReplacements: nextFoodReplacements,
    });
    const effectiveMeal = mealWithTrackingReplacements(optimisticRow, originalMeal, mealIndex);
    setWeekData((currentData) => currentData ? {
      ...currentData,
      days: (currentData.days || []).map((day) => day.date === optimisticRow.date ? optimisticRow : day),
    } : currentData);
    setMealDrawer((current) => current ? {
      ...current,
      row: optimisticRow,
      baseMeal: originalMeal,
      meal: effectiveMeal,
    } : current);
    return submitTracking(
      trackingPayloadBase(row, {
        completedMenuMealIds: [...completedIds],
        mealReplacements: nextMealReplacements,
        foodReplacements: nextFoodReplacements,
      }),
      "Reemplazo de comida guardado."
    );
  }

  function applyFoodReplacement({ row, meal, mealIndex, food, originalFood, foodIndex, replacement }) {
    const sourceFood = originalFood || food;
    const replacementEntry = buildFoodReplacementEntry(row, meal, mealIndex, sourceFood, foodIndex, replacement);
    const completedIds = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String));
    completedIds.add(mealId(meal, mealIndex));
    const current = Array.isArray(row?.tracking?.foodReplacements) ? row.tracking.foodReplacements : [];
    const prefix = `${foodReplacementPrefix(row, mealIndex, foodIndex)}-`;
    const nextFoodReplacements = [
      ...current.filter((entry) => String(entry?.id || "").startsWith(prefix) ? false : true),
      replacementEntry,
    ];
    const optimisticRow = rowWithTracking(row, {
      completedMenuMealIds: [...completedIds],
      foodReplacements: nextFoodReplacements,
    });
    const effectiveMeal = mealWithTrackingReplacements(optimisticRow, meal, mealIndex);
    setFoodDrawer(null);
    setWeekData((currentData) => currentData ? {
      ...currentData,
      days: (currentData.days || []).map((day) => day.date === optimisticRow.date ? optimisticRow : day),
    } : currentData);
    setMealDrawer((current) => current ? {
      ...current,
      row: optimisticRow,
      baseMeal: meal,
      meal: effectiveMeal,
    } : {
      row: optimisticRow,
      baseMeal: meal,
      meal: effectiveMeal,
      mealIndex,
    });
    return submitTracking(
      trackingPayloadBase(row, {
        completedMenuMealIds: [...completedIds],
        foodReplacements: nextFoodReplacements,
      }),
      "Reemplazo de alimento guardado."
    );
  }

  function markDayMissed(row) {
    submitTracking(
      trackingPayloadBase(row, {
        status: "missed",
        completedMenuMealIds: [],
        manualEntries: [],
        generatedRemainingMeals: [],
        mealReplacements: [],
        foodReplacements: [],
      }),
      "Día marcado como no cumplido."
    );
  }

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-[#070707] px-0 pb-10 pt-3 text-zinc-100 sm:px-6 sm:pb-12 sm:pt-5"
      style={{ background: "#070707", color: "#f4f4f5", minHeight: "60vh" }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-3 sm:gap-5">
        {toast ? (
          <div className="fixed right-4 top-4 z-50 max-w-sm rounded-3xl border border-[#D4AF37]/35 bg-[#11151c] px-4 py-3 text-sm font-bold text-[#FFE8A3] shadow-2xl">
            {toast}
          </div>
        ) : null}

        {(saving || refreshing) && weekData ? <MenuSyncIndicator /> : null}

        {mealToggleConfirm ? (
          <MealCompletionConfirmModal
            payload={mealToggleConfirm}
            saving={saving}
            onCancel={() => setMealToggleConfirm(null)}
            onConfirm={() => performToggleMenuMeal()}
          />
        ) : null}

        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={() => loadWeek(weekStart)} /> : null}

        {!loading && !error && weekData ? (
          isMobileLayout ? (
            mobileView === "detail" ? (
              <MobileDayDetailView
                row={selectedRow}
                weekRows={days}
                detailChoiceKey={mobileDetailChoiceKey}
                onBack={() => setMobileView("overview")}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onToggleMeal={toggleMenuMeal}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onRestoreGenerated={restoreGeneratedRemaining}
                onRestoreManual={restoreManualEntries}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                saving={saving}
              />
            ) : mobileView === "alternatives" ? (
              <MobileAlternativesView
                row={selectedRow}
                onBack={() => setMobileView("overview")}
                onViewDetail={(choice) => {
                  setMobileDetailChoiceKey(choice?.key || "");
                  setMobileView("detail");
                }}
                onUseAlternative={useAlternative}
                saving={saving}
              />
            ) : (
              <MobileDayMenu
                row={selectedRow}
                weekRows={days}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onOpenMenuOptions={() => setMenuOptionsDrawerOpen(true)}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                onToggleMeal={toggleMenuMeal}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onRestoreGenerated={restoreGeneratedRemaining}
                onRestoreManual={restoreManualEntries}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                saving={saving}
              />
            )
          ) : (
            <>
              <TodayHero
                row={selectedDisplayRow}
                weekRows={days}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onView={() => setDetailRow(selectedDisplayRow)}
                onToggleMeal={toggleMenuMeal}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onOpenRemaining={() => setRemainingDraft(selectedDisplayRow)}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                saving={saving}
              />

              <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                <div className="grid gap-4">
                  <WeeklySelector
                    days={days}
                    selectedDate={selectedRow?.date}
                    onSelect={(row) => setSelectedDate(row.date)}
                    onView={setDetailRow}
                  />
                </div>

                <div>
                  <DayDetail
                    row={selectedDisplayRow}
                    weekRows={days}
                    onMarkMissed={markDayMissed}
                    onToggleMeal={toggleMenuMeal}
                    onOpenMeal={(payload) => setMealDrawer(payload)}
                    onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                    onOpenRemaining={() => setRemainingDraft(selectedDisplayRow)}
                    onRestoreGenerated={restoreGeneratedRemaining}
                    onRestoreManual={restoreManualEntries}
                    onDeleteManual={deleteManualEntry}
                    canMarkMeals={canMarkMeals}
                    canAutoCompleteRemaining={canAutoCompleteRemaining}
                    onUseAlternative={useAlternative}
                    saving={saving}
                  />
                </div>
              </section>
            </>
          )
        ) : null}
      </div>

      {detailRow && !isMobileLayout ? (
        <DayDetailDrawer
          row={rowWithActiveGeneratedMeals(detailRow, days)}
          onClose={() => setDetailRow(null)}
          onMarkMissed={markDayMissed}
          onToggleMeal={toggleMenuMeal}
          onOpenMeal={(payload) => setMealDrawer(payload)}
          onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
          onOpenRemaining={() => setRemainingDraft(rowWithActiveGeneratedMeals(detailRow, days))}
          onRestoreGenerated={restoreGeneratedRemaining}
          onRestoreManual={restoreManualEntries}
          onDeleteManual={deleteManualEntry}
          canMarkMeals={canMarkMeals}
          canAutoCompleteRemaining={canAutoCompleteRemaining}
          onUseAlternative={useAlternative}
          weekRows={days}
          saving={saving}
        />
      ) : null}

      {remainingDraft ? (
        <RemainingMealsDrawerV2
          row={remainingDraft}
          weekRows={days}
          saving={saving}
          onClose={() => setRemainingDraft(null)}
          onSave={(generatedMeals) => saveGeneratedRemaining(remainingDraft, generatedMeals)}
          onSaveManual={(manualEntries) => saveManualRemaining(remainingDraft, manualEntries)}
        />
      ) : null}

      {mealDrawer ? (
        <MobileMealDetailDrawer
          context={mealDrawer}
          onToggleMeal={toggleMenuMeal}
          onOpenFood={(payload) => setFoodDrawer(payload)}
          onClose={() => setMealDrawer(null)}
          canMarkMeals={canMarkMeals}
          canReplaceMeals={canUseMenuAlternatives}
          canReplaceFoods={canTrackFoods}
          onApplyMealReplacement={applyMealReplacement}
          onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
          onDeleteManual={deleteManualEntry}
          saving={saving}
        />
      ) : null}

      {foodDrawer ? (
        <FoodActionDrawer
          context={foodDrawer}
          canReplaceFoods={canTrackFoods}
          saving={saving}
          onApplyReplacement={applyFoodReplacement}
          onClose={() => setFoodDrawer(null)}
        />
      ) : null}

      {menuOptionsDrawerOpen && isMobileLayout ? (
        <MobileMenuOptionsDrawer
          row={selectedRow}
          saving={saving}
          onClose={() => setMenuOptionsDrawerOpen(false)}
          onSelectChoice={(row, choice) => {
            setMenuOptionsDrawerOpen(false);
            selectMenuChoice(row, choice);
          }}
        />
      ) : null}

    </div>
  );
}

function MenuSyncIndicator() {
  return (
    <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] right-4 z-50 grid h-11 w-11 place-items-center rounded-2xl border border-[#D4AF37]/35 bg-[#11151c]/90 text-[#FFE8A3] shadow-[0_18px_45px_rgba(0,0,0,0.45)] backdrop-blur-md" aria-live="polite">
      <RefreshCw size={18} className="animate-spin" />
      <span className="sr-only">Actualizando menu</span>
    </div>
  );
}

function MealCompletionConfirmModal({ payload, saving, onCancel, onConfirm }) {
  const meal = payload?.meal || {};
  const index = payload?.index || 0;
  const completed = !!payload?.completed;
  const totals = mealTotals(meal);
  const title = completed ? "Volver a pendiente" : "Confirmar comida realizada";
  const question = completed
    ? "¿Querés volver a dejar esta comida como pendiente?"
    : "¿Confirmás que realizaste esta comida?";
  const detail = completed
    ? "Se descontará de tu resumen de menú y volverá a figurar como pendiente."
    : "Se sumará al resumen del día con sus calorías y macros planificados.";

  return (
    <section className="fixed inset-0 z-[120] flex items-center justify-center bg-black/78 px-4 py-6 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="meal-confirm-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onCancel} aria-label="Cerrar confirmacion" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_18%_0,rgba(212,175,55,.18),transparent_34%),radial-gradient(circle_at_100%_8%,rgba(16,185,129,.14),transparent_30%),linear-gradient(180deg,#111a25,#080d13)] p-4 shadow-[0_28px_90px_rgba(0,0,0,.68)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${completed ? "border-amber-200/30 bg-amber-300/10 text-[#FFE8A3]" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"}`}>
              {completed ? <Square size={22} /> : <CheckCircle2 size={23} />}
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#FFE8A3]">{title}</span>
              <h3 id="meal-confirm-title" className="mt-1 text-xl font-black leading-tight text-white">{question}</h3>
            </div>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-zinc-100 disabled:opacity-50" aria-label="Cancelar">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-3xl border border-white/10 bg-black/22 p-3">
          <div className="flex min-w-0 items-center gap-3">
            <MealTypeIcon meal={meal} index={index} done={!completed} />
            <div className="min-w-0">
              <strong className="block truncate text-base font-black text-white">{mealName(meal, index)}</strong>
              <span className="mt-1 block text-xs font-bold leading-relaxed text-zinc-400">{detail}</span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-2">
            <ConfirmMacroPill label="Kcal" value={formatNumber(totals.kcal, 0)} tone="gold" />
            <ConfirmMacroPill label="P" value={`${formatNumber(totals.proteina, 0)}g`} />
            <ConfirmMacroPill label="C" value={`${formatNumber(totals.carbs, 0)}g`} />
            <ConfirmMacroPill label="G" value={`${formatNumber(totals.grasas, 0)}g`} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[0.85fr_1.15fr]">
          <button type="button" onClick={onCancel} disabled={saving} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-black text-zinc-200 transition active:scale-[0.99] disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className={`min-h-12 rounded-2xl px-4 text-sm font-black text-[#070707] shadow-[0_14px_30px_rgba(212,175,55,.20)] transition active:scale-[0.99] disabled:opacity-60 ${completed ? "bg-gradient-to-r from-[#FFE8A3] to-[#D4AF37]" : "bg-gradient-to-r from-emerald-200 to-[#D4AF37]"}`}
          >
            {saving ? "Guardando..." : completed ? "Dejar pendiente" : "Si, la realice"}
          </button>
        </div>
      </div>
    </section>
  );
}

function ConfirmMacroPill({ label, value, tone = "neutral" }) {
  return (
    <span className={`rounded-2xl border px-2 py-2 text-center ${tone === "gold" ? "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFE8A3]" : "border-white/10 bg-white/[0.045] text-zinc-200"}`}>
      <small className="block text-[9px] font-black uppercase tracking-wide opacity-75">{label}</small>
      <strong className="mt-0.5 block text-xs font-black">{value}</strong>
    </span>
  );
}

function LoadingState() {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/25 bg-[#11151c] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3 text-[#FFE8A3]">
        <RefreshCw size={20} className="animate-spin" />
        <strong>Cargando tu menú semanal...</strong>
      </div>
      <p className="mt-2 text-sm font-semibold text-zinc-400">
        Estoy buscando metas diarias, menú asignado y tracking guardado.
      </p>
      <div className="mt-4 grid gap-3">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-16 animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]" />
        ))}
      </div>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-3xl border border-rose-400/25 bg-rose-400/10 p-5">
      <div className="flex items-center gap-3 text-rose-100">
        <AlertTriangle size={20} />
        <strong>{message}</strong>
      </div>
      <button type="button" onClick={onRetry} className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-black text-black">
        Reintentar
      </button>
    </div>
  );
}

function MobileTopBar({ title, onBack }) {
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
      <button
        type="button"
        onClick={onBack}
        disabled={!onBack}
        className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-100 disabled:opacity-70"
        aria-label={onBack ? "Volver" : "Menú"}
      >
        {onBack ? <ChevronLeft size={20} /> : <MoreHorizontal size={20} />}
      </button>
      <h1 className="truncate text-center text-lg font-black text-white">{title}</h1>
      <span className="h-11 w-11" aria-hidden="true" />
    </div>
  );
}

function MobileDayPicker({ row, onPrevious, onNext }) {
  return (
    <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2 rounded-[1.2rem] border border-white/10 bg-[#101824] p-2">
      <button
        type="button"
        onClick={onPrevious}
        className="grid h-10 w-10 place-items-center rounded-2xl border border-white/10 bg-black/20 text-zinc-100"
        aria-label="Día anterior"
      >
        <ChevronLeft size={19} />
      </button>
      <div className="min-w-0 text-center">
        <div className="truncate text-base font-black text-white">{compactDayLabel(row)}</div>
        <div className="mt-0.5 text-[11px] font-bold uppercase tracking-wide text-zinc-500">{formatDate(row?.date)}</div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="grid h-10 w-10 place-items-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]"
        aria-label="Día siguiente"
      >
        <ChevronRight size={19} />
      </button>
    </div>
  );
}

function MobileCalculateButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[1.05rem] border border-[#D4AF37]/45 bg-[linear-gradient(135deg,rgba(245,215,110,.14),rgba(255,255,255,.045))] px-4 text-left text-[#FFE8A3] shadow-[0_12px_28px_rgba(0,0,0,.32)] transition active:scale-[0.99] disabled:opacity-45"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Calculator size={20} className="shrink-0" />
        <span className="min-w-0 truncate text-sm font-black">Calcular lo que falta</span>
      </span>
      <ChevronRight size={20} className="shrink-0" />
    </button>
  );
}

function MobileDayMenu({
  row,
  weekRows = [],
  onPrevious,
  onNext,
  onOpenMenuOptions,
  onOpenRemaining,
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onRestoreGenerated,
  onRestoreManual,
  onDeleteManual,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  const [isGoalExpanded, setIsGoalExpanded] = useState(false);

  if (!row) return null;
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const choices = menuChoices(row);
  const primary = choices[0] || null;
  const activeChoice = trackingChoice(row) || primary;
  const activeMeals = activeChoice ? choiceMeals(activeChoice) : [];
  const effectiveMeals = effectiveMealEntriesForDay(displayRow, activeMeals, weekRows);
  const generatedEntries = effectiveMeals.filter((entry) => entry.generated);
  const manualEntries = effectiveMeals.filter((entry) => entry.manual);
  const countableMeals = countableMealEntries(effectiveMeals);
  const completedCount = completedCountableMeals(effectiveMeals);
  const target = targetTotals(displayRow);
  const consumed = consumedTotals(displayRow);
  const remaining = remainingTotals(displayRow);
  const percent = completionPercent(displayRow);
  const activeMenuStatus = activeChoice ? choiceStatus(row, activeChoice) : menuState(row);
  const canCalculateRemaining = positiveTotals(remaining).kcal > 40 && canAutoCompleteRemaining;

  return (
    <section className="mx-auto w-full max-w-[760px] overflow-x-hidden px-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <MobileDayPicker row={row} onPrevious={onPrevious} onNext={onNext} />

      {activeChoice?.snapshot ? (
        <MobileActiveMenuLine
          choice={activeChoice}
          choicesCount={choices.length}
          onOpenOptions={onOpenMenuOptions}
        />
      ) : null}

      <MobileGoalAccordion
        expanded={isGoalExpanded}
        onToggle={() => setIsGoalExpanded((current) => !current)}
        target={target}
        consumed={consumed}
        remaining={remaining}
        percent={percent}
        activeMenuStatus={activeMenuStatus}
        trackingTone={statusMeta(row).tone}
        trackingLabelText={trackingLabel(row)}
        completedCount={completedCount}
        mealsCount={countableMeals.length || 0}
      />

      {/*
            <p className="mt-1 text-sm font-bold leading-tight text-zinc-400">
              P {formatNumber(target.proteina, 0)} g · C {formatNumber(target.carbs, 0)} g · G {formatNumber(target.grasas, 0)} g
            </p>
          </div>
          <MobileProgressRing percent={percent} />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <MobileMetric
            label="Consumido"
            value={displayKcal(consumed.kcal)}
            detail={`P ${formatNumber(consumed.proteina, 0)} / C ${formatNumber(consumed.carbs, 0)} / G ${formatNumber(consumed.grasas, 0)}`}
            tone="green"
            progress={target.kcal ? (consumed.kcal / target.kcal) * 100 : 0}
          />
          <MobileMetric label="Faltante" value={displayKcal(remaining.kcal)} detail={`P ${formatNumber(remaining.proteina, 0)} / C ${formatNumber(remaining.carbs, 0)} / G ${formatNumber(remaining.grasas, 0)}`} tone={remaining.kcal < -20 ? "red" : "blue"} />
          <MobileMetric label="Comidas" value={`${completedCount} / ${countableMeals.length || 0}`} detail="completadas" tone="gold" />
        </div>
      */}

      {!primary?.snapshot ? (
        <div className="mt-4">
          <MobileEmptyCard
            title="Todavía no tenés menú para este día."
            text="Cuando tu coach lo asigne, lo vas a ver acá."
          />
        </div>
      ) : null}

      {activeChoice?.snapshot ? (
        <section className="mt-4 grid gap-2.5">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-base font-black text-white">Comidas</h3>
            <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-black text-[#FFE8A3]">
              {completedCount} / {countableMeals.length || 0} completas
            </span>
          </div>
          {effectiveMeals.length ? (
            effectiveMeals.map((entry) => (
              <MobileMealCard
                key={entry.key}
                row={displayRow}
                meal={entry.meal}
                baseMeal={entry.baseMeal}
                mealIndex={entry.mealIndex}
                done={entry.done}
                generated={entry.generated}
                generatedEntry={entry.generatedEntry}
                manualEntry={entry.manualEntry}
                saving={saving}
                canMarkMeals={canMarkMeals}
                onToggleMeal={onToggleMeal}
                onOpenMeal={onOpenMeal}
                onSaveAsSavedMeal={onSaveAsSavedMeal}
                onDeleteManual={onDeleteManual}
              />
            ))
          ) : (
            <MobileEmptyCard
              title="Este menú no tiene comidas cargadas."
              text="Podés revisar otros días o avisarle a tu coach."
            />
          )}
          <GeneratedWeeklyActions
            row={displayRow}
            generatedEntries={generatedEntries}
            onRestoreGenerated={onRestoreGenerated}
            manualEntries={manualEntries}
            onRestoreManual={onRestoreManual}
            onDeleteManual={onDeleteManual}
          />
        </section>
      ) : null}

      <div className="mt-4">
        <MobileCalculateButton onClick={onOpenRemaining} disabled={!canCalculateRemaining || saving} />
      </div>
    </section>
  );
}

function MobileGoalAccordion({
  expanded,
  onToggle,
  target = {},
  consumed = {},
  remaining = {},
  percent = 0,
  activeMenuStatus = {},
  trackingTone = "slate",
  trackingLabelText = "Pendiente",
  completedCount = 0,
  mealsCount = 0,
}) {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const detailId = "mobile-goal-day-detail";
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;
  const macroSummary = `P${formatNumber(target.proteina, 0)} / C${formatNumber(target.carbs, 0)} / G${formatNumber(target.grasas, 0)}`;

  return (
    <section className="mt-2 overflow-hidden rounded-[1.2rem] border border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(212,175,55,.12),transparent_30%),radial-gradient(circle_at_0_0,rgba(45,212,191,.10),transparent_36%),linear-gradient(145deg,#101923,#080d13)] shadow-[0_14px_34px_rgba(0,0,0,.30)]">
      <button
        type="button"
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 text-left"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
          <Target size={18} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-white">Meta del dÃ­a</span>
          <span className="mt-0.5 block text-base font-black leading-tight text-[#FFD76B]">{displayKcal(target.kcal)}</span>
          <span className="mt-0.5 block truncate text-[11px] font-black text-sky-200">{macroSummary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="grid h-[54px] w-[54px] place-items-center rounded-full p-[4px]" style={{ background: `conic-gradient(#D4AF37 ${safePercent * 3.6}deg, rgba(255,255,255,.12) 0deg)` }}>
            <span className="grid h-full w-full place-items-center rounded-full bg-[#0b1119] text-center shadow-inner">
              <span>
                <strong className="block text-sm font-black text-white">{safePercent}%</strong>
                <span className="block text-[8px] font-bold leading-none text-zinc-500">cumplimiento</span>
              </span>
            </span>
          </span>
          <span className="grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/20 text-zinc-300">
            <ChevronIcon size={16} strokeWidth={2.4} aria-hidden="true" />
          </span>
        </span>
      </button>

      {expanded ? (
        <div id={detailId} className="border-t border-white/10 px-3 pb-3 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black ${toneClass(activeMenuStatus.tone)}`}>
                  <Target size={13} />
                  {activeMenuStatus.label}
                </span>
                <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black ${toneClass(trackingTone)}`}>
                  {trackingLabelText}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-black leading-tight text-white">
                Meta <span className="text-[#FFD76B]">{displayKcal(target.kcal)}</span>
              </h2>
              <p className="mt-1 text-sm font-bold leading-tight text-zinc-400">
                P {formatNumber(target.proteina, 0)} g · C {formatNumber(target.carbs, 0)} g · G {formatNumber(target.grasas, 0)} g
              </p>
            </div>
            <MobileProgressRing percent={percent} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MobileMetric
              label="Consumido"
              value={displayKcal(consumed.kcal)}
              detail={`P ${formatNumber(consumed.proteina, 0)} / C ${formatNumber(consumed.carbs, 0)} / G ${formatNumber(consumed.grasas, 0)}`}
              tone="green"
              progress={target.kcal ? (consumed.kcal / target.kcal) * 100 : 0}
            />
            <MobileMetric label="Faltante" value={displayKcal(remaining.kcal)} detail={`P ${formatNumber(remaining.proteina, 0)} / C ${formatNumber(remaining.carbs, 0)} / G ${formatNumber(remaining.grasas, 0)}`} tone={remaining.kcal < -20 ? "red" : "blue"} />
            <MobileMetric label="Comidas" value={`${completedCount} / ${mealsCount}`} detail="completadas" tone="gold" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MobileProgressRing({ percent = 0 }) {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  return (
    <div
      className="grid h-[70px] w-[70px] shrink-0 place-items-center rounded-full p-[5px]"
      style={{ background: `conic-gradient(#D4AF37 ${safePercent * 3.6}deg, rgba(255,255,255,.12) 0deg)` }}
      aria-label={`${safePercent}% de cumplimiento`}
    >
      <div className="grid h-full w-full place-items-center rounded-full bg-[#0b1119] text-center shadow-inner">
        <div>
          <strong className="block text-lg font-black text-white">{safePercent}%</strong>
          <span className="block text-[9px] font-bold text-zinc-500">cumplimiento</span>
        </div>
      </div>
    </div>
  );
}

function MobileActiveMenuLine({ choice, choicesCount = 0, onOpenOptions }) {
  const menuName = choiceMobileName(choice);
  const optionLabel = choicesCount > 1 ? "Cambiar menu" : "Opciones";
  return (
    <section className="mt-2 flex min-h-11 min-w-0 items-center gap-2 rounded-[0.95rem] border border-white/10 bg-[linear-gradient(180deg,#101923,#0b121b)] px-3 shadow-[0_10px_24px_rgba(0,0,0,.18)]">
      <Utensils size={18} className="shrink-0 text-[#D4AF37]" />
      <div className="min-w-0 flex-1 truncate text-[13px] font-black text-zinc-100" title={menuName}>
        {menuName}
      </div>
      <button
        type="button"
        onClick={onOpenOptions}
        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-1 text-[11px] font-black text-[#FFD76B] active:scale-[0.98]"
        aria-label="Ver opciones de menu"
      >
        <RefreshCw size={13} />
        {optionLabel}
      </button>
    </section>
  );
}

function MobileMenuOptionsDrawer({ row, saving, onClose, onSelectChoice }) {
  const choices = menuChoices(row);
  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label="Cambiar menu">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar opciones de menu"
      />
      <section className="absolute inset-x-0 bottom-0 max-h-[82dvh] overflow-hidden rounded-t-[1.7rem] border border-white/10 bg-[#080d12] shadow-[0_-18px_54px_rgba(0,0,0,.55)]">
        <div className="mx-auto mt-3 h-1.5 w-12 rounded-full bg-white/20" />
        <header className="flex items-center justify-between gap-3 px-4 pb-3 pt-4">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-black text-white">Cambiar menu</h3>
            <p className="mt-0.5 text-xs font-bold text-zinc-500">
              {choices.length} opcion{choices.length === 1 ? "" : "es"} disponible{choices.length === 1 ? "" : "s"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[calc(82dvh-92px)] overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {choices.length ? (
            <div className="grid gap-2.5">
              {choices.map((choice) => (
                <MobileMenuOptionRow
                  key={choice.key}
                  row={row}
                  choice={choice}
                  saving={saving}
                  onClose={onClose}
                  onSelectChoice={onSelectChoice}
                />
              ))}
              <button
                type="button"
                disabled
                className="mt-1 flex min-h-12 items-center justify-center gap-2 rounded-[1.05rem] border border-dashed border-sky-300/20 bg-sky-300/[0.035] px-4 text-sm font-black text-sky-200 disabled:opacity-70"
              >
                <Plus size={17} />
                Buscar alternativa
              </button>
            </div>
          ) : (
            <MobileEmptyCard
              title="No hay menus disponibles."
              text="Cuando tu coach asigne un menu, va a aparecer aca."
            />
          )}
        </div>
      </section>
    </div>
  );
}

function MobileMenuOptionRow({ row, choice, saving, onClose, onSelectChoice }) {
  const totals = choiceTotals(choice);
  const meals = choiceMeals(choice);
  const active = isChoiceActive(row, choice);
  const status = active ? "Activo" : choice?.type === "primary" ? "Principal" : choiceShortLabel(choice);
  const optionLabel = choice?.type === "primary" ? "Principal" : "Alternativa";

  return (
    <button
      type="button"
      disabled={saving}
      onClick={() => active ? onClose() : onSelectChoice(row, choice)}
      className={`flex w-full min-w-0 items-center gap-3 rounded-[1.2rem] border p-3 text-left transition active:scale-[0.99] disabled:opacity-55 ${
        active
          ? "border-emerald-400/35 bg-[linear-gradient(135deg,rgba(16,185,129,.13),rgba(212,175,55,.08))]"
          : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#FFE8A3]"}`}>
        {active ? <CheckSquare2 size={21} /> : <Utensils size={21} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-base font-black text-white">{choiceDisplayName(choice)}</span>
          <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black ${active ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-white/10 bg-white/[0.06] text-zinc-300"}`}>
            {status}
          </span>
        </span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-bold text-zinc-400">
          <span>{optionLabel}</span>
          <span className="text-[#FFE8A3]">{displayKcal(totals.kcal)}</span>
          <span>P {formatNumber(totals.proteina, 0)} g</span>
          <span>{meals.length} comida{meals.length === 1 ? "" : "s"}</span>
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-zinc-500" />
    </button>
  );
}

function MobileChoiceSelector({ row, choices = [], saving, onSelectChoice, onOpenAlternatives }) {
  if (!choices.length) return null;
  const visibleChoices = choices.slice(0, 4);
  const hiddenCount = Math.max(0, choices.length - visibleChoices.length);
  return (
    <section className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <span className="text-sm font-black text-zinc-400">
          {choices.length} menú{choices.length === 1 ? "" : "s"} disponible{choices.length === 1 ? "" : "s"}
        </span>
        {hiddenCount ? (
          <button type="button" onClick={onOpenAlternatives} className="text-xs font-black text-[#FFE8A3]">
            Ver todos
          </button>
        ) : null}
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleChoices.map((choice) => {
          const active = isChoiceActive(row, choice);
          return (
            <button
              key={choice.key}
              type="button"
              disabled={saving || active}
              onClick={() => onSelectChoice(row, choice)}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black transition active:scale-[0.98] disabled:opacity-100 ${
                active
                  ? "border-[#D4AF37]/70 bg-[#D4AF37]/15 text-[#FFE8A3]"
                  : "border-white/10 bg-white/[0.035] text-zinc-300"
              }`}
            >
              {active ? <CheckSquare2 size={16} /> : null}
              {choiceShortLabel(choice)}
            </button>
          );
        })}
        {hiddenCount ? (
          <button
            type="button"
            onClick={onOpenAlternatives}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-sm font-black text-zinc-300"
          >
            +{hiddenCount}
          </button>
        ) : null}
      </div>
    </section>
  );
}

function MobileActiveMenuCard({ row, choice, onViewDetail }) {
  const totals = choiceTotals(choice);
  const meals = choiceMeals(choice);
  const activeStatus = choiceStatus(row, choice);
  return (
    <article className="mt-3 rounded-[1.25rem] border border-white/10 bg-[linear-gradient(135deg,rgba(212,175,55,.10),rgba(16,24,36,.82))] p-3.5 shadow-[0_12px_28px_rgba(0,0,0,.25)]">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]">
          <Utensils size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black text-white">{choiceDisplayName(choice)}</div>
          <div className="mt-1 truncate text-sm font-bold text-zinc-400">
            {displayKcal(totals.kcal)} · {meals.length} comida{meals.length === 1 ? "" : "s"}
          </div>
          <span className={`mt-2 inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black ${toneClass(activeStatus.tone)}`}>
            {choice.type === "alternative" ? "Elegido" : "Asignado"}
          </span>
        </div>
        <button
          type="button"
          onClick={onViewDetail}
          className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border border-[#D4AF37]/45 bg-black/20 px-3 text-xs font-black text-[#FFE8A3]"
        >
          Detalle
          <ChevronRight size={16} />
        </button>
      </div>
    </article>
  );
}

function MobileDayDetailView({
  row,
  weekRows = [],
  detailChoiceKey = "",
  onBack,
  onPrevious,
  onNext,
  onToggleMeal,
  onOpenRemaining,
  onOpenMeal,
  onSaveAsSavedMeal,
  onRestoreGenerated,
  onRestoreManual,
  onDeleteManual,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const tracking = statusMeta(displayRow);
  const choices = menuChoices(row);
  const detailChoice = choices.find((choice) => choice.key === detailChoiceKey) || choices[0] || null;
  const snapshot = detailChoice?.snapshot || null;
  const meals = detailChoice ? choiceMeals(detailChoice) : [];
  const effectiveMeals = effectiveMealEntriesForDay(displayRow, meals, weekRows);
  const generatedEntries = effectiveMeals.filter((entry) => entry.generated);
  const manualEntries = effectiveMeals.filter((entry) => entry.manual);
  const detailStatus = detailChoice ? choiceStatus(row, detailChoice) : menuState(row);
  const target = targetTotals(displayRow);
  const consumed = consumedTotals(displayRow);
  const remaining = remainingTotals(displayRow);
  const percent = completionPercent(displayRow);
  const canCalculateRemaining = positiveTotals(remaining).kcal > 40 && canAutoCompleteRemaining;

  return (
    <section className="mx-auto w-full max-w-[760px] px-1 pb-3">
      <MobileTopBar title={detailChoice?.type === "alternative" ? detailChoice.label : "Menú del día"} onBack={onBack} />
      <MobileDayPicker row={row} onPrevious={onPrevious} onNext={onNext} />

      <header className="mt-3 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0,rgba(59,130,246,.16),transparent_34%),linear-gradient(180deg,#101824,#07101a)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.28)]">
        <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-center text-sm font-bold text-zinc-300">
          <span>Meta <strong className="text-[#FFD76B]">{displayKcal(target.kcal)}</strong></span>
          <span>P <strong className="text-[#FFD76B]">{formatNumber(target.proteina, 0)} g</strong></span>
          <span>C <strong className="text-[#FFD76B]">{formatNumber(target.carbs, 0)} g</strong></span>
          <span>G <strong className="text-[#FFD76B]">{formatNumber(target.grasas, 0)} g</strong></span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-black ${toneClass(detailStatus.tone)}`}>
            <Target size={14} />
            {detailStatus.label}
          </span>
          <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black ${toneClass(tracking.tone)}`}>
            {trackingLabel(row)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <MobileMetric
            label="Consumido"
            value={displayKcal(consumed.kcal)}
            detail={`P ${formatNumber(consumed.proteina, 0)} / C ${formatNumber(consumed.carbs, 0)} / G ${formatNumber(consumed.grasas, 0)}`}
            tone="green"
            progress={target.kcal ? (consumed.kcal / target.kcal) * 100 : 0}
          />
          <MobileMetric label="Faltante" value={displayKcal(remaining.kcal)} detail={`P ${formatNumber(remaining.proteina, 0)} / C ${formatNumber(remaining.carbs, 0)} / G ${formatNumber(remaining.grasas, 0)}`} tone={remaining.kcal < -20 ? "red" : "blue"} />
          <MobileMetric label="Cumplimiento" value={`${percent}%`} detail="del día" tone="gold" />
        </div>
      </header>

      <div className="mt-4 grid gap-3">
        <h3 className="px-1 text-lg font-black text-white">Comidas</h3>
        {!snapshot ? (
          <MobileEmptyCard
            title="Todavía no tenés menú para este día."
            text="Cuando tu coach lo asigne, lo vas a ver acá."
          />
        ) : !effectiveMeals.length ? (
          <MobileEmptyCard
            title="Este menú no tiene comidas cargadas."
            text="Podés revisar otros días o avisarle a tu coach."
          />
        ) : (
          effectiveMeals.map((entry) => (
            <MobileMealCard
              key={entry.key}
              row={displayRow}
              meal={entry.meal}
              baseMeal={entry.baseMeal}
              mealIndex={entry.mealIndex}
              done={entry.done}
              generated={entry.generated}
              generatedEntry={entry.generatedEntry}
              manualEntry={entry.manualEntry}
              saving={saving}
              canMarkMeals={canMarkMeals}
              onToggleMeal={onToggleMeal}
              onOpenMeal={onOpenMeal}
              onSaveAsSavedMeal={onSaveAsSavedMeal}
              onDeleteManual={onDeleteManual}
            />
          ))
        )}
        <GeneratedWeeklyActions
          row={displayRow}
          generatedEntries={generatedEntries}
          manualEntries={manualEntries}
          onRestoreGenerated={onRestoreGenerated}
          onRestoreManual={onRestoreManual}
          onDeleteManual={onDeleteManual}
        />
      </div>

      <div className="mt-5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
        <MobileCalculateButton onClick={onOpenRemaining} disabled={!canCalculateRemaining || saving} />
      </div>
    </section>
  );
}

function MobileAlternativesView({
  row,
  onBack,
  onViewDetail,
  onUseAlternative,
  saving,
}) {
  if (!row) return null;
  const choices = menuChoices(row);
  const selectedIndex = selectedAlternativeIndex(row);

  return (
    <section className="mx-auto w-full max-w-[760px] px-1 pb-3">
      <MobileTopBar title="Alternativas del día" onBack={onBack} />

      <div className="mt-4 grid gap-3">
        {choices.length ? (
          choices.map((choice) => {
            const isPrimary = choice.type === "primary";
            const isSelectedAlternative = choice.type === "alternative" && selectedIndex === choice.index;
            return (
              <article
                key={choice.key}
                className={`rounded-[1.3rem] border bg-[#101824] p-4 ${isPrimary || isSelectedAlternative ? "border-[#D4AF37]/28" : "border-white/10"}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <MealTypeIcon meal={{ name: choice?.snapshot?.name || choice.label }} index={0} done={isPrimary || isSelectedAlternative} />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate text-base font-black text-white">
                          {isPrimary ? "Menú Principal" : choice.label}
                        </h3>
                        <span className="rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[10px] font-black text-zinc-200">
                          {isPrimary ? "Asignado" : isSelectedAlternative ? "Elegido" : "Alternativa"}
                        </span>
                      </div>
                      <p className="mt-1 text-sm font-bold text-zinc-400">
                        {displayKcal(choiceTotals(choice).kcal)} · {choiceMeals(choice).length} comida{choiceMeals(choice).length === 1 ? "" : "s"}
                      </p>
                      <span className={`mt-2 inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black ${toneClass(choiceStatus(row, choice).tone)}`}>
                        {choiceStatus(row, choice).label}
                      </span>
                    </div>
                  </div>
                  {(isPrimary || isSelectedAlternative) ? (
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]">
                      <CheckSquare2 size={18} />
                    </span>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {!isPrimary ? (
                    <button
                      type="button"
                      disabled={saving || isSelectedAlternative}
                      onClick={() => onUseAlternative(row, choice.index)}
                      className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3] disabled:opacity-50"
                    >
                      <CheckSquare2 size={15} />
                      Usar como principal
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => onViewDetail(choice)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 text-xs font-black text-zinc-100"
                  >
                    Ver detalle
                    <Eye size={15} />
                  </button>
                </div>
              </article>
            );
          })
        ) : (
          <MobileEmptyCard
            title="No hay alternativas para este día."
            text="Cuando haya más menús disponibles, van a aparecer acá."
          />
        )}

        <button
          type="button"
          disabled
          className="flex min-h-14 items-center justify-center gap-2 rounded-[1.2rem] border border-dashed border-sky-300/25 bg-sky-300/[0.04] px-4 text-sm font-black text-sky-200 disabled:opacity-70"
        >
          <Plus size={18} />
          Buscar más alternativas
        </button>
      </div>
    </section>
  );
}

function MobileMetric({ label, value, detail, tone = "blue", progress = null }) {
  const toneMap = {
    blue: "text-[#6DB7FF]",
    gold: "text-[#FFD76B]",
    green: "text-emerald-300",
    red: "text-rose-200",
  };
  const fillMap = {
    blue: "bg-sky-400/12",
    gold: "bg-[#D4AF37]/12",
    green: "bg-emerald-400/14",
    red: "bg-rose-400/12",
  };
  const safeProgress = progress === null ? null : Math.max(0, Math.min(100, Number(progress) || 0));
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[0.9rem] border border-white/10 bg-black/20 p-2">
      {safeProgress !== null ? (
        <span
          className={`pointer-events-none absolute inset-y-0 left-0 transition-[width] duration-300 ${fillMap[tone] || fillMap.blue}`}
          style={{ width: `${safeProgress}%` }}
          aria-hidden="true"
        />
      ) : null}
      <div className="relative z-10">
        <div className={`truncate text-[9px] font-black uppercase ${toneMap[tone] || toneMap.blue}`}>{label}</div>
        <div className="mt-1 truncate text-[15px] font-black leading-tight text-white">{value}</div>
        <div className={`mt-1 truncate text-[9.5px] font-bold leading-tight ${toneMap[tone] || toneMap.blue}`}>{detail}</div>
        {safeProgress !== null ? (
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-emerald-300 to-[#D4AF37] transition-[width] duration-300"
              style={{ width: `${safeProgress}%` }}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MobileEmptyCard({ title, text }) {
  return (
    <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-[#101824] p-4">
      <div className="flex items-center gap-3 text-zinc-100">
        <CircleAlert size={19} className="text-[#FFD76B]" />
        <strong className="text-base font-black">{title}</strong>
      </div>
      {text ? <p className="mt-2 text-sm font-bold text-zinc-400">{text}</p> : null}
    </div>
  );
}

function MobileMealCard({
  row,
  meal,
  baseMeal,
  mealIndex,
  done,
  generated = false,
  generatedEntry = null,
  manualEntry = null,
  saving,
  canMarkMeals,
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onDeleteManual,
}) {
  const trackingMeal = baseMeal || meal;
  const foods = mealFoods(meal);
  const totals = mealTotals(meal);
  const manual = meal?.source === "manual_food";
  const visual = mealVisualStyle(meal, mealIndex, { done, generated, manual });
  const completedVisual = done || generated;
  const statusLabel = manual ? "Registrado" : generated ? "Generada" : done ? "Hecha" : "Pendiente";
  const StatusIcon = manual ? Utensils : generated ? Calculator : done ? CheckCircle2 : Square;
  const statusClass = manual
    ? visual.status
    : completedVisual
      ? "border-emerald-300/45 bg-emerald-300/14 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,.22)]"
      : "border-white/10 bg-black/30 text-zinc-500";
  const [isExpanded, setIsExpanded] = useState(false);
  const detailPayload = { row, meal, baseMeal: trackingMeal, mealIndex, generated, manual };

  function toggleExpanded() {
    setIsExpanded((value) => !value);
  }

  function handlePrimaryAction(event) {
    event.stopPropagation();
    if (manual) {
      onDeleteManual?.(row, manualEntry);
      return;
    }
    if (generated) return;
    onToggleMeal(row, trackingMeal, mealIndex);
  }

  function openMealDetail(event) {
    event.stopPropagation();
    onOpenMeal(detailPayload);
  }

  function saveAsMeal(event) {
    event.stopPropagation();
    onSaveAsSavedMeal?.(meal, mealIndex);
  }

  return (
    <article className={`relative overflow-hidden rounded-[1.05rem] border p-[1px] shadow-[0_16px_34px_rgba(0,0,0,.28)] ${visual.frame} ${completedVisual ? "ring-1 ring-emerald-300/30" : "ring-1 ring-white/[0.035]"}`}>
      <div className={`relative overflow-hidden rounded-[calc(1.05rem-1px)] p-3 ${visual.card}`}>
        <span className={`pointer-events-none absolute inset-0 ${visual.haze}`} aria-hidden="true" />
        {completedVisual ? <span className="pointer-events-none absolute inset-0 bg-emerald-300/[0.045]" aria-hidden="true" /> : null}
        <span className={`pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full ${completedVisual ? "bg-gradient-to-b from-emerald-200 to-emerald-500 shadow-[0_0_18px_rgba(16,185,129,.55)]" : visual.rail}`} aria-hidden="true" />
        <div className="relative z-10 flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={isExpanded}
            className="grid min-w-0 flex-1 grid-cols-[52px_minmax(0,1fr)] items-center gap-3 text-left active:scale-[0.995]"
          >
            <MealTypeIcon meal={meal} index={mealIndex} done={completedVisual} size="lg" />
            <span className="min-w-0">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="min-w-0 truncate text-[17px] font-black leading-tight text-white">{mealName(meal, mealIndex)}</span>
                <span className={`shrink-0 text-xs font-black ${visual.kcalText}`}>{displayKcal(totals.kcal)}</span>
              </span>
              <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                <span className={`inline-flex min-h-5 items-center gap-1 rounded-full border px-1.5 text-[9px] font-black ${statusClass}`}>
                  <StatusIcon size={10} />
                  {statusLabel}
                </span>
              </span>
              {!isExpanded ? (
                <span className="mt-2 flex min-h-[30px] items-center">
                  <MobileFoodThumbStack foods={foods} compact maxVisible={5} />
                </span>
              ) : null}
              {generatedEntry?.replacesMealNames?.length && isExpanded ? (
                <span className="mt-1 block truncate text-[11px] font-black text-emerald-200/90">
                  Reemplaza {generatedEntry.replacesMealNames.join(" + ")}
                </span>
              ) : null}
            </span>
          </button>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              disabled={manual ? saving : generated || !canMarkMeals || saving}
              onClick={handlePrimaryAction}
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border text-xs font-black transition active:scale-[0.96] disabled:opacity-50 ${
                manual
                  ? "border-rose-300/35 bg-rose-400/10 text-rose-100"
                  : completedVisual
                    ? `${visual.doneButton}`
                    : "border-white/15 bg-black/35 text-zinc-500"
              }`}
              aria-pressed={manual ? undefined : done}
              aria-label={manual ? "Eliminar registro manual" : generated ? "Comida generada para esta semana" : done ? "Comida completa" : "Marcar comida completa"}
            >
              {manual ? <Trash2 size={18} /> : generated ? <Calculator size={18} /> : done ? <CheckCircle2 size={20} /> : <Square size={18} />}
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleExpanded();
              }}
              className="grid h-9 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-black/20 text-zinc-400 transition active:scale-[0.96]"
              aria-label={isExpanded ? "Contraer comida" : "Expandir comida"}
              aria-expanded={isExpanded}
            >
              {isExpanded ? <ChevronLeft size={18} className="rotate-90" /> : <ChevronRight size={18} className="rotate-90" />}
            </button>
          </div>
        </div>

        {isExpanded ? (
          <div className="relative z-10 mt-3 overflow-hidden rounded-[0.95rem] border border-white/10 bg-black/20 p-3 opacity-100 transition-[max-height,opacity] duration-200 ease-out">
            <div className="flex flex-wrap items-center gap-1.5">
              <MobileMealMacroChip label="P" value={totals.proteina} />
              <MobileMealMacroChip label="C" value={totals.carbs} />
              <MobileMealMacroChip label="G" value={totals.grasas} />
            </div>

            <div className="mt-3 grid gap-1.5">
              {foods.length ? foods.map((food, foodIndex) => {
                const macroDetail = foodMacroLine(food);
                return (
                  <div key={`${food.id}-${foodIndex}`} className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-2">
                    <FoodThumb food={food} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12px] font-black text-zinc-100">{food.name}</span>
                      {macroDetail ? (
                        <span className="mt-0.5 block truncate text-[11px] font-bold text-zinc-500">{macroDetail}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-1 text-[11px] font-black text-[#FFE8A3]">
                      {food.amount || "s/d"}
                    </span>
                  </div>
                );
              }) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-3 text-sm font-bold text-zinc-500">
                  Sin alimentos cargados.
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={openMealDetail}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.055] px-3 text-xs font-black text-zinc-100"
              >
                Detalle de comida
                <Eye size={15} />
              </button>
              {onSaveAsSavedMeal ? (
                <button
                  type="button"
                  onClick={saveAsMeal}
                  disabled={saving || !foods.length}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3] disabled:opacity-55"
                >
                  Guardar en Mis comidas
                  <Plus size={15} />
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
        </div>
    </article>
  );
}

function MobileMealMacroChip({ label, value }) {
  return (
    <span className="inline-flex min-h-7 min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.055] px-2.5 text-[11px] font-black text-white">
      <span className="text-[#FFE8A3]">{label}</span>
      <span>{formatNumber(value, 0)} g</span>
    </span>
  );
}

function GeneratedWeeklyActions({
  row,
  generatedEntries = [],
  manualEntries = [],
  onRestoreGenerated,
  onRestoreManual,
}) {
  const [showOriginals, setShowOriginals] = useState(false);
  if (!generatedEntries.length && !manualEntries.length) return null;

  const primaryEntry = generatedEntries[0]?.generatedEntry || {};
  const primaryManualEntry = manualEntries[0]?.manualEntry || {};
  const names = [...new Set([...generatedEntries, ...manualEntries].flatMap((entry) =>
    Array.isArray(entry?.generatedEntry?.replacesMealNames)
      ? entry.generatedEntry.replacesMealNames
      : Array.isArray(entry?.manualEntry?.replacesMealNames)
        ? entry.manualEntry.replacesMealNames
        : []
  ).filter(Boolean))];
  const originalMealMap = new Map();
  [...generatedEntries, ...manualEntries].forEach((entry) => {
    (entry.replacedOriginalMeals || []).forEach((item) => {
      originalMealMap.set(mealId(item.meal, item.mealIndex), item);
    });
  });
  const originalMeals = [...originalMealMap.values()];
  const drawerEntry = {
    ...(generatedEntries.length ? primaryEntry : primaryManualEntry),
    replacesMealNames: names.length ? names : primaryEntry.replacesMealNames || primaryManualEntry.replacesMealNames,
  };
  const handleRestore = () => {
    setShowOriginals(false);
    if (generatedEntries.length) onRestoreGenerated?.(row, primaryEntry);
    if (manualEntries.length) onRestoreManual?.(row);
  };
  const hasManualOnly = manualEntries.length && !generatedEntries.length;

  return (
    <div className={`mt-1 grid gap-2 rounded-[1rem] border p-2 sm:grid-cols-2 ${hasManualOnly ? "border-sky-300/15 bg-sky-300/[0.035]" : "border-emerald-300/15 bg-emerald-300/[0.035]"}`}>
      <button
        type="button"
        onClick={() => setShowOriginals(true)}
        className="flex min-h-11 items-center justify-center gap-2 rounded-[0.85rem] border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-zinc-100 active:scale-[0.99]"
      >
        <Eye size={15} className="text-emerald-200" />
        Ver comidas originales
      </button>
      <button
        type="button"
        onClick={handleRestore}
        className="flex min-h-11 items-center justify-center gap-2 rounded-[0.85rem] border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3] active:scale-[0.99]"
      >
        <RefreshCw size={15} />
        Volver al menu base
      </button>
      {showOriginals ? (
        <OriginalMealsDrawer
          generatedEntry={drawerEntry}
          originalMeals={originalMeals}
          mode={hasManualOnly ? "manual" : "generated"}
          onClose={() => setShowOriginals(false)}
          onRestore={handleRestore}
        />
      ) : null}
    </div>
  );
}

function OriginalMealsDrawer({ generatedEntry = {}, originalMeals = [], mode = "generated", onClose, onRestore }) {
  const names = generatedEntry.replacesMealNames || [];
  const manualMode = mode === "manual";
  return (
    <section className="fixed inset-0 z-[90] flex items-end bg-black/70 px-3 pb-3 pt-10 backdrop-blur-sm" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Cerrar comidas originales" />
      <div className="relative mx-auto max-h-[78dvh] w-full max-w-lg overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#0b121b] shadow-[0_24px_70px_rgba(0,0,0,.6)]">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <h3 className="text-lg font-black text-white">Comidas originales</h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              {manualMode
                ? "Estas comidas fueron reemplazadas por un registro manual de hoy."
                : "Estas comidas fueron reemplazadas por una comida generada para esta semana."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200" aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="max-h-[48dvh] overflow-y-auto p-4">
          <div className="grid gap-2">
            {originalMeals.length ? originalMeals.map(({ meal, mealIndex }) => {
              const foods = mealFoods(meal);
              return (
                <div key={mealId(meal, mealIndex)} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <MealTypeIcon meal={meal} index={mealIndex} />
                    <div className="min-w-0">
                      <strong className="block truncate text-sm font-black text-white">{mealName(meal, mealIndex)}</strong>
                      <span className="mt-1 block truncate text-xs font-bold text-zinc-400">
                        {displayKcal(mealTotals(meal).kcal)} / {displayMenuMacros(mealTotals(meal))}
                      </span>
                    </div>
                  </div>
                  {foods.length ? (
                    <div className="mt-3 grid gap-1.5">
                      {foods.slice(0, 4).map((food, foodIndex) => (
                        <div key={`${food.id}-${foodIndex}`} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-black/20 px-2.5 py-2 text-xs font-bold">
                          <span className="min-w-0 truncate text-zinc-100">{food.name}</span>
                          <span className="shrink-0 text-[#FFE8A3]">{food.amount || foodMacroLine(food) || "s/d"}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            }) : (
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm font-bold text-zinc-400">
                {names.length ? names.join(" + ") : "No se encontraron comidas originales para mostrar."}
              </div>
            )}
          </div>
        </div>
        <footer className="grid gap-2 border-t border-white/10 p-4">
          <button type="button" onClick={onRestore} className="min-h-12 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-sm font-black text-[#FFE8A3]">
            Restaurar comidas originales
          </button>
          <button type="button" onClick={onClose} className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-sm font-black text-zinc-200">
            {manualMode ? "Mantener registro manual" : "Mantener comida generada"}
          </button>
        </footer>
      </div>
    </section>
  );
}

function MobileFoodPreviewLine({ foods = [] }) {
  if (!foods.length) {
    return <span className="block truncate text-xs font-bold text-zinc-500">Sin alimentos cargados</span>;
  }
  return (
    <span className="grid min-w-0 gap-[3px]">
      {foods.map((food, index) => (
        <span key={`${food.id}-${index}`} className="flex min-w-0 items-center gap-1.5 text-[11px] font-bold leading-tight text-zinc-400">
          <span className="min-w-0 truncate">{food.name}</span>
          {food.amount ? <span className="shrink-0 text-[10.5px] font-black text-[#FFE8A3]/95">{food.amount}</span> : null}
        </span>
      ))}
    </span>
  );
}

function foodPreviewImageSrc(food = {}) {
  const src =
    food.imageUrl ||
    food.imagenUrl ||
    food.imagen?.url ||
    food.imagen?.urlExacta ||
    food.imagen?.urlGenerica ||
    getFoodImageUrl(food);
  if (!src) return placeholderForFoodCategory(food.category || food.categoria || food.raw?.categoria);
  return src;
}

function MobileFoodThumbStack({ foods = [], compact = false, maxVisible = compact ? 5 : 3 }) {
  const candidates = foods
    .map((food, index) => ({
      food,
      index,
      src: foodPreviewImageSrc(food),
      fallback: placeholderForFoodCategory(food.category || food.categoria || food.raw?.categoriaSnapshot),
      key: `${food.id || food.name || "food"}-${index}`,
    }))
    .filter((item) => item.src);
  const candidateKey = candidates.map((item) => `${item.key}:${item.src}`).join("|");
  const [failed, setFailed] = useState(() => new Set());

  useEffect(() => {
    setFailed(new Set());
  }, [candidateKey]);

  const visible = candidates.filter((item) => !failed.has(item.key)).slice(0, maxVisible);
  const hiddenCount = Math.max(0, foods.length - visible.length);
  if (!visible.length && !hiddenCount) return null;
  const sizeClass = compact ? "h-[30px] w-[30px]" : "h-9 w-9";

  return (
    <span className={`flex ${compact ? "h-[30px]" : "h-9"} shrink-0 items-center justify-start -space-x-2`} aria-hidden="true">
      {visible.map((item) => (
        <img
          key={item.key}
          src={item.src}
          alt=""
          width={compact ? 30 : 36}
          height={compact ? 30 : 36}
          loading="lazy"
          decoding="async"
          className={`${sizeClass} rounded-full border border-[#D4AF37]/35 bg-black/30 object-cover shadow-[0_8px_20px_rgba(0,0,0,.35)] ring-1 ring-black/60`}
          onError={(event) => {
            if (item.fallback && event.currentTarget.src !== item.fallback && !event.currentTarget.src.endsWith(item.fallback)) {
              event.currentTarget.src = item.fallback;
              return;
            }
            setFailed((current) => {
              const next = new Set(current);
              next.add(item.key);
              return next;
            });
          }}
        />
      ))}
      {hiddenCount ? (
        <span className={`${sizeClass} grid place-items-center rounded-full border border-[#D4AF37]/35 bg-[#11151c] text-[10px] font-black text-[#FFE8A3] shadow-[0_8px_20px_rgba(0,0,0,.32)] ring-1 ring-black/60`}>
          +{hiddenCount}
        </span>
      ) : null}
    </span>
  );
}

function mealVisualStyle(meal = {}, index = 0, state = {}) {
  const iconType = mealIconType(meal, index);
  const base = {
    breakfast: {
      frame: "border-emerald-300/35 shadow-[0_0_28px_rgba(20,184,166,.18),0_16px_34px_rgba(0,0,0,.34)]",
      card: "bg-[radial-gradient(circle_at_9%_18%,rgba(45,212,191,.28),transparent_34%),linear-gradient(135deg,#071f1b,#081015_60%,#07110f)]",
      haze: "bg-[linear-gradient(90deg,rgba(45,212,191,.08),transparent_48%)]",
      rail: "bg-gradient-to-b from-emerald-300 to-teal-500",
      icon: "border-emerald-300/35 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,107,.18),transparent_55%),rgba(45,212,191,.10)] text-[#FFD76B] shadow-[0_0_24px_rgba(45,212,191,.24)]",
      status: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
      kcalText: "text-[#FFD76B]",
      doneButton: "border-emerald-300/60 bg-emerald-400/15 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,.28)]",
      pendingButton: "border-emerald-300/35 bg-black/25 text-emerald-200",
    },
    lunch: {
      frame: "border-[#D4AF37]/38 shadow-[0_0_28px_rgba(212,175,55,.18),0_16px_34px_rgba(0,0,0,.34)]",
      card: "bg-[radial-gradient(circle_at_9%_20%,rgba(212,175,55,.25),transparent_34%),linear-gradient(135deg,#1d1a08,#0f1208_62%,#080b0b)]",
      haze: "bg-[linear-gradient(90deg,rgba(212,175,55,.08),transparent_48%)]",
      rail: "bg-gradient-to-b from-[#FFD76B] to-[#D4AF37]",
      icon: "border-[#D4AF37]/40 bg-[radial-gradient(circle_at_50%_50%,rgba(255,215,107,.20),transparent_55%),rgba(212,175,55,.09)] text-[#FFD76B] shadow-[0_0_24px_rgba(212,175,55,.26)]",
      status: "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFE8A3]",
      kcalText: "text-[#FFD76B]",
      doneButton: "border-[#D4AF37]/60 bg-[#D4AF37]/14 text-[#FFE8A3] shadow-[0_0_22px_rgba(212,175,55,.24)]",
      pendingButton: "border-[#D4AF37]/35 bg-black/25 text-[#FFE8A3]",
    },
    snack: {
      frame: "border-rose-300/38 shadow-[0_0_28px_rgba(244,114,182,.18),0_16px_34px_rgba(0,0,0,.34)]",
      card: "bg-[radial-gradient(circle_at_9%_20%,rgba(244,114,182,.24),transparent_34%),linear-gradient(135deg,#23101a,#120d13_62%,#080b0f)]",
      haze: "bg-[linear-gradient(90deg,rgba(244,114,182,.08),transparent_48%)]",
      rail: "bg-gradient-to-b from-rose-300 to-pink-500",
      icon: "border-rose-300/40 bg-[radial-gradient(circle_at_50%_50%,rgba(244,114,182,.18),transparent_55%),rgba(244,114,182,.09)] text-rose-200 shadow-[0_0_24px_rgba(244,114,182,.24)]",
      status: "border-rose-300/30 bg-rose-400/10 text-rose-100",
      kcalText: "text-[#FFD76B]",
      doneButton: "border-rose-300/60 bg-rose-400/14 text-rose-100 shadow-[0_0_22px_rgba(244,114,182,.22)]",
      pendingButton: "border-rose-300/35 bg-black/25 text-rose-100",
    },
    dinner: {
      frame: "border-indigo-300/38 shadow-[0_0_28px_rgba(129,140,248,.18),0_16px_34px_rgba(0,0,0,.34)]",
      card: "bg-[radial-gradient(circle_at_9%_20%,rgba(129,140,248,.24),transparent_34%),linear-gradient(135deg,#0e1530,#090f1f_62%,#06090f)]",
      haze: "bg-[linear-gradient(90deg,rgba(129,140,248,.08),transparent_48%)]",
      rail: "bg-gradient-to-b from-indigo-300 to-blue-500",
      icon: "border-indigo-300/40 bg-[radial-gradient(circle_at_50%_50%,rgba(129,140,248,.18),transparent_55%),rgba(129,140,248,.09)] text-indigo-100 shadow-[0_0_24px_rgba(129,140,248,.24)]",
      status: "border-indigo-300/30 bg-indigo-400/10 text-indigo-100",
      kcalText: "text-[#FFD76B]",
      doneButton: "border-indigo-300/60 bg-indigo-400/14 text-indigo-100 shadow-[0_0_22px_rgba(129,140,248,.22)]",
      pendingButton: "border-indigo-300/35 bg-black/25 text-indigo-100",
    },
    generated: {
      frame: "border-emerald-300/35 shadow-[0_0_28px_rgba(16,185,129,.18),0_16px_34px_rgba(0,0,0,.34)]",
      card: "bg-[radial-gradient(circle_at_9%_20%,rgba(16,185,129,.22),transparent_34%),linear-gradient(135deg,#0c211c,#081116_62%,#070b0f)]",
      haze: "bg-[linear-gradient(90deg,rgba(16,185,129,.08),transparent_48%)]",
      rail: "bg-gradient-to-b from-emerald-300 to-[#D4AF37]",
      icon: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,.22)]",
      status: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
      kcalText: "text-[#FFD76B]",
      doneButton: "border-emerald-300/60 bg-emerald-400/15 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,.28)]",
      pendingButton: "border-emerald-300/35 bg-black/25 text-emerald-200",
    },
    manual: {
      frame: "border-sky-300/35 shadow-[0_0_28px_rgba(56,189,248,.16),0_16px_34px_rgba(0,0,0,.34)]",
      card: "bg-[radial-gradient(circle_at_9%_20%,rgba(56,189,248,.20),transparent_34%),linear-gradient(135deg,#0c1d25,#081116_62%,#070b0f)]",
      haze: "bg-[linear-gradient(90deg,rgba(56,189,248,.08),transparent_48%)]",
      rail: "bg-gradient-to-b from-sky-300 to-[#D4AF37]",
      icon: "border-sky-300/35 bg-sky-300/10 text-sky-100 shadow-[0_0_24px_rgba(56,189,248,.22)]",
      status: "border-sky-300/30 bg-sky-300/10 text-sky-100",
      kcalText: "text-[#FFD76B]",
      doneButton: "border-sky-300/60 bg-sky-400/15 text-sky-100 shadow-[0_0_22px_rgba(56,189,248,.24)]",
      pendingButton: "border-sky-300/35 bg-black/25 text-sky-100",
    },
    meal: {
      frame: "border-white/10 shadow-[0_16px_34px_rgba(0,0,0,.34)]",
      card: "bg-[linear-gradient(135deg,#101824,#090f17)]",
      haze: "bg-[linear-gradient(90deg,rgba(255,255,255,.035),transparent_48%)]",
      rail: "bg-gradient-to-b from-[#D4AF37] to-zinc-600",
      icon: "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFD76B] shadow-[0_0_20px_rgba(212,175,55,.18)]",
      status: "border-white/10 bg-white/[0.055] text-zinc-300",
      kcalText: "text-[#FFD76B]",
      doneButton: "border-emerald-300/55 bg-emerald-400/15 text-emerald-200 shadow-[0_0_22px_rgba(16,185,129,.22)]",
      pendingButton: "border-white/18 bg-black/25 text-zinc-300",
    },
  };

  if (state.manual) return base.manual;
  if (state.generated) return base.generated;
  if (state.done && iconType === "meal") return { ...base.meal, status: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100" };
  return base[iconType] || base.meal;
}

function MealTypeIcon({ meal, index, done, size = "md" }) {
  const iconType = mealIconType(meal, index);
  const visual = mealVisualStyle(meal, index, { done });
  const icons = {
    breakfast: Sunrise,
    lunch: Sun,
    snack: Apple,
    dinner: MoonStar,
    generated: Calculator,
    manual: Utensils,
    meal: Utensils,
  };
  const Icon = icons[iconType] || Utensils;
  const sizeClass = size === "lg" ? "h-[58px] w-[58px] rounded-[1.05rem]" : "h-12 w-12 rounded-2xl";
  const iconSize = size === "lg" ? 31 : 23;
  return (
    <span className={`grid shrink-0 place-items-center border ${sizeClass} ${visual.icon} ${done ? "ring-1 ring-white/20" : ""}`}>
      <Icon size={iconSize} strokeWidth={1.7} />
    </span>
  );
}

function FoodThumb({ food = {}, size = "md" }) {
  const [failed, setFailed] = useState(false);
  const src = food.imageUrl || getFoodImageUrl(food);
  const alt = food.imageAlt || food.imagen?.alt || food.name || "Alimento";
  const fallback = placeholderForFoodCategory(food.category || food.categoria || food.raw?.categoriaSnapshot);
  const sizeClass = size === "sm" ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl sm:h-16 sm:w-16";
  const initial = String(food.name || "?").trim().charAt(0).toUpperCase() || "?";

  if (failed || !src) {
    return (
      <span className={`grid shrink-0 place-items-center border border-[#D4AF37]/25 bg-[radial-gradient(circle_at_30%_20%,rgba(212,175,55,.18),transparent_55%),rgba(255,255,255,.04)] text-sm font-black text-[#FFE8A3] ${sizeClass}`} aria-hidden="true">
        {initial}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={size === "sm" ? 40 : 64}
      height={size === "sm" ? 40 : 64}
      loading="lazy"
      decoding="async"
      className={`shrink-0 border border-white/10 bg-white/[0.04] object-cover shadow-[0_10px_24px_rgba(0,0,0,.22)] ${sizeClass}`}
      onError={(event) => {
        if (event.currentTarget.src.endsWith(fallback)) {
          setFailed(true);
          return;
        }
        event.currentTarget.src = fallback;
      }}
    />
  );
}

function MobileFoodRow({ meal, mealIndex, food, foodIndex, onOpenFood, canReplaceFoods = true }) {
  const replaced = food.replacementMeta?.type === "food";
  const originalFood = mealFoods(meal)[foodIndex] || food;
  const macroDetail = foodMacroLine(food);
  return (
    <div className={`flex min-h-[76px] items-center justify-between gap-3 px-4 py-3.5 ${replaced ? "bg-emerald-300/[0.045]" : ""}`}>
      <FoodThumb food={food} />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="min-w-0 truncate text-[15px] font-black text-zinc-100">{food.name}</div>
          {replaced ? (
            <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-[10px] font-black text-emerald-200">
              Reemplazado
            </span>
          ) : null}
        </div>
        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
          {food.amount ? (
            <span className="inline-flex min-h-7 shrink-0 items-center rounded-full border border-[#D4AF37]/35 bg-[linear-gradient(135deg,rgba(212,175,55,.18),rgba(212,175,55,.07))] px-3 text-[12px] font-black text-[#FFE8A3] shadow-[0_0_0_1px_rgba(212,175,55,.08)]">
              {food.amount}
            </span>
          ) : null}
          {macroDetail ? (
            <span className="min-w-0 truncate rounded-full border border-white/[0.06] bg-black/15 px-2 py-1 text-[10.5px] font-bold text-zinc-400">
              {macroDetail}
            </span>
          ) : null}
          {food.category ? (
            <span className="min-w-0 truncate rounded-full border border-sky-300/15 bg-sky-300/10 px-2 py-1 text-[10.5px] font-black text-sky-100/80">
              {food.category}
            </span>
          ) : null}
        </div>
        {replaced ? (
          <div className="mt-1 truncate text-[11px] font-bold text-zinc-500">
            Antes: {food.replacementMeta.originalName}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={!canReplaceFoods}
        onClick={() => onOpenFood({ meal, mealIndex, food, originalFood, foodIndex })}
        className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/[0.055] text-[#FFD76B] shadow-[0_8px_20px_rgba(0,0,0,.22)] transition active:scale-[0.96] disabled:border-white/10 disabled:bg-white/[0.025] disabled:text-zinc-600"
        aria-label={canReplaceFoods ? `Buscar equivalencias para ${food.name}` : "Reemplazos no habilitados"}
      >
        <Search size={18} />
      </button>
    </div>
  );
}

function TodayHero({
  row,
  weekRows = [],
  onPrevious,
  onNext,
  onView,
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onOpenRemaining,
  onDeleteManual,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const state = menuState(row);
  const tracking = statusMeta(row);
  const choices = menuChoices(row);
  const activeChoice = trackingChoice(row) || choices[0] || null;
  const activeTotals = choiceTotals(activeChoice);
  const snapshot = activeChoice?.snapshot || null;
  const baseMeals = activeChoice ? choiceMeals(activeChoice) : [];
  const effectiveMeals = effectiveMealEntriesForDay(row, baseMeals, weekRows);
  const countableMeals = countableMealEntries(effectiveMeals);
  const completedCount = completedCountableMeals(effectiveMeals);
  const targetKcal = macro(row?.target?.kcal);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const menuKcal = activeTotals.kcal;
  const pct = targetKcal ? Math.min(135, Math.round((consumed.kcal / targetKcal) * 100)) : 0;
  const canCalculateRemaining = positiveTotals(remaining).kcal > 40;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-[#D4AF37]/25 bg-gradient-to-br from-[#141a23] via-[#0c1118] to-[#090b0f] p-3 shadow-[0_14px_45px_rgba(0,0,0,0.38)] sm:rounded-[2rem] sm:p-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrevious}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-zinc-100"
          aria-label="Día anterior"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(state.tone)}`}>{state.label}</span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(tracking.tone)}`}>{tracking.label}</span>
          </div>
          <h2 className="mt-2 truncate text-2xl font-black leading-tight text-white sm:text-3xl">{dayHeading(row)}</h2>
          <p className="text-xs font-bold text-zinc-500">{formatDate(row.date)}</p>
        </div>
        <button
          type="button"
          onClick={onNext}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-zinc-100"
          aria-label="Día siguiente"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      <button
        type="button"
        onClick={onView}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-black/25 p-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-xl" aria-hidden="true">
            {choices.length > 1 ? MENU_BOX_EMOJI : MENU_EMOJI}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black uppercase tracking-wide text-zinc-300">
              {menuCountTitle(row)}
            </span>
            <span className="mt-1 block text-xl font-black text-[#FFE8A3]">{displayKcal(menuKcal)}</span>
            <span className="block truncate text-sm font-bold text-zinc-300">
              {snapshot ? displayMenuMacros(activeTotals) : "Toca para ver el detalle cuando haya menú"}
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-100">
          <span aria-hidden="true">{EYE_EMOJI}</span>
          <Eye size={15} />
        </span>
      </button>

      <div className="mt-3 grid gap-2 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3">
        <div className="grid grid-cols-3 gap-2">
          <TrackingMiniPanel label="Meta" totals={targetTotals(row)} tone="gold" />
          <TrackingMiniPanel label="Consumido" totals={consumed} tone="green" />
          <TrackingMiniPanel label="Faltante" totals={remaining} tone={remaining.kcal < -20 ? "red" : "blue"} />
        </div>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/10">
          <span className={`block h-full rounded-full bg-gradient-to-r ${progressTone(row)}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
        <div className="mt-2 text-xs font-bold text-zinc-400">
          Consumido: {displayKcal(consumed.kcal)} / faltan {signed(remaining.kcal, " kcal")} / comidas {completedCount}/{countableMeals.length || 0}
        </div>
      </div>

      {snapshot ? (
        <div className="mt-3 rounded-[1.2rem] border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-400">Vista rapida</span>
            <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
              {completedCount} / {countableMeals.length || 0} completas
            </span>
          </div>
          <DesktopMealsGrid
            row={row}
            effectiveMeals={effectiveMeals}
                onToggleMeal={onToggleMeal}
                onOpenMeal={onOpenMeal}
                onSaveAsSavedMeal={onSaveAsSavedMeal}
                onDeleteManual={onDeleteManual}
                canMarkMeals={canMarkMeals}
            saving={saving}
            compact
          />
        </div>
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onView} className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-3 text-xs font-black text-sky-100">
          Ver menu completo
        </button>
        <button
          type="button"
          onClick={onOpenRemaining}
          disabled={!canCalculateRemaining || !canAutoCompleteRemaining || saving}
          className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-3 text-xs font-black text-[#FFE8A3] disabled:opacity-45"
        >
          Calcular lo que falta
        </button>
      </div>
    </section>
  );
}

function TrackingMiniPanel({ label, totals, tone = "blue" }) {
  const toneMap = {
    gold: "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]",
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
    red: "border-rose-400/25 bg-rose-400/10 text-rose-100",
    blue: "border-sky-400/25 bg-sky-400/10 text-sky-100",
  };
  return (
    <div className={`min-w-0 rounded-2xl border p-2 ${toneMap[tone] || toneMap.blue}`}>
      <div className="truncate text-[10px] font-black uppercase tracking-wide opacity-80">{label}</div>
      <div className="mt-1 truncate text-sm font-black">{displayKcal(totals?.kcal)}</div>
      <div className="truncate text-[11px] font-bold opacity-85">
        P {formatNumber(macro(totals?.proteina), 0)} / C {formatNumber(macro(totals?.carbs), 0)} / G {formatNumber(macro(totals?.grasas), 0)}
      </div>
    </div>
  );
}

function DesktopMealsSection({
  row,
  weekRows = [],
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onRestoreGenerated,
  onRestoreManual,
  onDeleteManual,
  canMarkMeals,
  saving,
}) {
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const choice = trackingChoice(displayRow);
  const baseMeals = choice ? choiceMeals(choice) : [];
  const effectiveMeals = effectiveMealEntriesForDay(displayRow, baseMeals, weekRows);
  const generatedEntries = effectiveMeals.filter((entry) => entry.generated);
  const manualEntries = effectiveMeals.filter((entry) => entry.manual);
  const countableMeals = countableMealEntries(effectiveMeals);
  const completedCount = completedCountableMeals(effectiveMeals);

  return (
    <section className="grid gap-3 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Comidas del menu</span>
          <h4 className="mt-1 text-lg font-black text-white">Detalle visible del dia</h4>
        </div>
        <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-black text-[#FFE8A3]">
          {completedCount} / {countableMeals.length || 0} completas
        </span>
      </div>

      {effectiveMeals.length ? (
        <>
          <DesktopMealsGrid
            row={displayRow}
            effectiveMeals={effectiveMeals}
            onToggleMeal={onToggleMeal}
            onOpenMeal={onOpenMeal}
            onSaveAsSavedMeal={onSaveAsSavedMeal}
            onDeleteManual={onDeleteManual}
            canMarkMeals={canMarkMeals}
            saving={saving}
          />
          <GeneratedWeeklyActions
            row={displayRow}
            generatedEntries={generatedEntries}
            manualEntries={manualEntries}
            onRestoreGenerated={onRestoreGenerated}
            onRestoreManual={onRestoreManual}
            onDeleteManual={onDeleteManual}
          />
        </>
      ) : (
        <MobileEmptyCard
          title="Este menu no tiene comidas cargadas."
          text="Cuando tu coach cargue comidas, las vas a ver aca con alimentos y cantidades."
        />
      )}
    </section>
  );
}

function DesktopMealsGrid({
  row,
  effectiveMeals = [],
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onDeleteManual,
  canMarkMeals,
  saving,
  compact = false,
}) {
  if (!effectiveMeals.length) return null;
  return (
    <div className={`grid gap-3 ${compact ? "" : "xl:grid-cols-2"}`}>
      {effectiveMeals.map((entry) => (
        <DesktopMealCard
          key={entry.key}
          row={row}
          entry={entry}
          onToggleMeal={onToggleMeal}
          onOpenMeal={onOpenMeal}
          onSaveAsSavedMeal={onSaveAsSavedMeal}
          onDeleteManual={onDeleteManual}
          canMarkMeals={canMarkMeals}
          saving={saving}
          compact={compact}
        />
      ))}
    </div>
  );
}

function DesktopMealCard({
  row,
  entry,
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onDeleteManual,
  canMarkMeals,
  saving,
  compact = false,
}) {
  const { meal, baseMeal, mealIndex, done, generated, generatedEntry, manual } = entry;
  const trackingMeal = baseMeal || meal;
  const totals = mealTotals(meal);
  const foods = mealFoods(meal);
  const visibleFoods = compact ? foods.slice(0, 3) : foods.slice(0, 5);
  const hiddenCount = Math.max(0, foods.length - visibleFoods.length);
  const [isExpanded, setIsExpanded] = useState(false);
  const completedVisual = done || generated;
  const replacementNames = (generatedEntry?.replacesMealNames?.length
    ? generatedEntry.replacesMealNames
    : (entry.replacedOriginalMeals || []).map((item) => mealName(item.meal, item.mealIndex)))
    || meal.replacementMeta?.replacesMealNames
    || [];
  const statusLabel = manual ? "Registrado" : generated ? "Generada" : done ? "Hecha" : "Pendiente";
  const StatusIcon = manual ? Utensils : generated ? Calculator : done ? CheckCircle2 : Square;
  const detailPayload = { row, meal, baseMeal: trackingMeal, mealIndex, generated, manual };

  function toggleExpanded() {
    setIsExpanded((value) => !value);
  }

  function handlePrimaryAction(event) {
    event.stopPropagation();
    if (manual) {
      onDeleteManual?.(row, entry.manualEntry);
      return;
    }
    if (generated) return;
    onToggleMeal(row, trackingMeal, mealIndex);
  }

  function openMealDetail(event) {
    event.stopPropagation();
    onOpenMeal?.(detailPayload);
  }

  function saveAsMeal(event) {
    event.stopPropagation();
    onSaveAsSavedMeal?.(meal, mealIndex);
  }

  return (
    <article className={`relative overflow-hidden rounded-3xl border p-4 shadow-[0_16px_34px_rgba(0,0,0,.24)] ${
      manual
        ? "border-sky-300/30 bg-[radial-gradient(circle_at_0_0,rgba(56,189,248,.16),transparent_34%),linear-gradient(135deg,#0d1c24,#0b121b)]"
        : generated
        ? "border-emerald-300/30 bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,.18),transparent_34%),linear-gradient(135deg,#10211f,#0b121b)]"
        : done
          ? "border-emerald-300/35 bg-[radial-gradient(circle_at_0_0,rgba(16,185,129,.16),transparent_34%),linear-gradient(135deg,#101f1d,#0b121b)]"
          : "border-white/10 bg-[linear-gradient(135deg,#101824,#090f17)]"
    }`}>
      {done || generated || manual ? (
        <span className={`pointer-events-none absolute inset-y-4 left-0 w-1 rounded-r-full bg-gradient-to-b ${manual ? "from-sky-300 to-[#D4AF37]" : "from-emerald-300 to-[#D4AF37]"}`} aria-hidden="true" />
      ) : null}

      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={toggleExpanded}
          aria-expanded={isExpanded}
          className="flex min-w-0 flex-1 items-start gap-3 text-left active:scale-[0.995]"
        >
          <MealTypeIcon meal={meal} index={mealIndex} done={completedVisual} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-lg font-black text-white">{mealName(meal, mealIndex)}</span>
              <span className="shrink-0 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-xs font-black text-[#FFE8A3]">
                {displayKcal(totals.kcal)}
              </span>
            </span>
            <span className="mt-2 flex min-w-0 flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-black ${
                manual
                  ? "border-sky-300/25 bg-sky-300/10 text-sky-100"
                  : completedVisual
                    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                    : "border-white/10 bg-black/20 text-zinc-400"
              }`}>
                <StatusIcon size={12} />
                {statusLabel}
              </span>
              {!isExpanded ? <MobileFoodThumbStack foods={foods} compact maxVisible={5} /> : null}
            </span>
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={manual ? saving : generated || !canMarkMeals || saving}
            onClick={handlePrimaryAction}
            className={`grid h-10 w-10 place-items-center rounded-full border text-xs font-black disabled:opacity-50 ${
              manual
                ? "border-rose-300/35 bg-rose-400/10 text-rose-100"
                : completedVisual
                  ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-100"
                  : "border-white/10 bg-white/[0.04] text-zinc-400"
            }`}
            aria-pressed={manual ? undefined : done}
            aria-label={manual ? "Eliminar registro manual" : generated ? "Comida generada" : done ? "Comida completa" : "Marcar comida completa"}
          >
            {manual ? <Trash2 size={17} /> : generated ? <Calculator size={17} /> : done ? <CheckCircle2 size={18} /> : <Square size={17} />}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              toggleExpanded();
            }}
            className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/20 text-zinc-400"
            aria-label={isExpanded ? "Contraer comida" : "Expandir comida"}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronLeft size={18} className="rotate-90" /> : <ChevronRight size={18} className="rotate-90" />}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-3 transition-[max-height,opacity] duration-200 ease-out">
          <div className="flex flex-wrap items-center gap-1.5">
            <MobileMealMacroChip label="P" value={totals.proteina} />
            <MobileMealMacroChip label="C" value={totals.carbs} />
            <MobileMealMacroChip label="G" value={totals.grasas} />
          </div>
          {generated && replacementNames.length ? (
            <div className="mt-3 truncate text-xs font-black text-emerald-200/90">
              Reemplaza: {replacementNames.join(" + ")}
            </div>
          ) : null}
          <div className="mt-3 grid gap-1.5">
            {visibleFoods.length ? visibleFoods.map((food, index) => (
              <div key={`${food.id}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <FoodThumb food={food} size="sm" />
                  <span className="min-w-0 truncate font-bold text-zinc-100">{food.name}</span>
                </span>
                <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-xs font-black text-[#FFE8A3]">
                  {food.amount || foodMacroLine(food) || "s/d"}
                </span>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-3 text-sm font-bold text-zinc-500">
                Sin alimentos cargados.
              </div>
            )}
            {hiddenCount ? (
              <div className="px-1 text-xs font-black text-[#FFE8A3]">+{hiddenCount} alimentos mas</div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={openMealDetail}
              className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-zinc-100"
            >
              Detalle de comida
              <Eye size={15} />
            </button>
            {onSaveAsSavedMeal ? (
              <button
                type="button"
                onClick={saveAsMeal}
                disabled={saving || !foods.length}
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3] disabled:opacity-55"
              >
                Guardar en Mis comidas
                <Plus size={15} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}

function WeeklySelector({ days, selectedDate, onSelect, onView }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {days.map((row) => {
        const selected = row.date === selectedDate;
        const state = statusMeta(row);
        const menu = menuState(row);
        const targetKcal = macro(row?.target?.kcal);
        const menuKcal = choiceTotals(menuChoices(row)[0]).kcal;
        const pct = targetKcal ? Math.min(135, Math.round((menuKcal / targetKcal) * 100)) : 0;
        const alternatives = row?.assignment?.alternatives?.length || 0;
        const title = menuCountTitle(row);
        return (
          <button
            key={row.date}
            type="button"
            onClick={() => onSelect(row)}
            className={`rounded-3xl border p-4 text-left transition ${selected ? "border-[#D4AF37]/45 bg-[#D4AF37]/10" : "border-white/10 bg-[#0d121a]"} ${row?.assignment?.primaryMenu ? "shadow-[0_0_0_1px_rgba(34,197,94,0.12)]" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-lg font-black text-white">{row.dayLabel}</div>
                <div className="text-xs font-bold text-zinc-500">{formatDate(row.date)}</div>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${toneClass(state.tone)}`}>{state.label}</span>
            </div>
            <div className="mt-3 text-sm font-black text-[#FFE8A3]">{displayKcal(row?.target?.kcal)}</div>
            <div className="mt-1 truncate text-sm font-bold text-zinc-300">
              {title}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <span className={`block h-full rounded-full bg-gradient-to-r ${progressTone(row)}`} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-xs font-bold text-zinc-400">
              <span>{menu.label}</span>
              <span>{alternatives ? `${alternatives} alt.` : "Sin alt."}</span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                onView(row);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onView(row);
                }
              }}
              className="mt-3 inline-flex rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-200"
            >
              Ver detalle
            </span>
          </button>
        );
      })}
    </section>
  );
}

function DayDetailDrawer({
  row,
  weekRows = [],
  onClose,
  onMarkMissed,
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onOpenRemaining,
  onRestoreGenerated,
  canMarkMeals,
  canAutoCompleteRemaining,
  onUseAlternative,
  saving,
}) {
  return (
    <section className="fixed inset-0 z-40 bg-black/70 p-1 backdrop-blur-sm sm:p-3" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090d13] shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Detalle del día</span>
            <h3 className="text-2xl font-black text-white">{row?.dayLabel}</h3>
          </div>
          <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <DayDetail
            row={row}
            weekRows={weekRows}
            onMarkMissed={onMarkMissed}
            onToggleMeal={onToggleMeal}
            onOpenMeal={onOpenMeal}
            onSaveAsSavedMeal={onSaveAsSavedMeal}
            onOpenRemaining={onOpenRemaining}
            onRestoreGenerated={onRestoreGenerated}
            canMarkMeals={canMarkMeals}
            canAutoCompleteRemaining={canAutoCompleteRemaining}
            onUseAlternative={onUseAlternative}
            saving={saving}
          />
        </div>
      </div>
    </section>
  );
}

function DayDetail({
  row,
  weekRows = [],
  onMarkMissed,
  onToggleMeal,
  onOpenMeal,
  onSaveAsSavedMeal,
  onOpenRemaining,
  onRestoreGenerated,
  canMarkMeals,
  canAutoCompleteRemaining,
  onUseAlternative,
  saving,
}) {
  if (!row) return null;
  const choices = menuChoices(row);
  const selectedAlternative = row?.tracking?.selectedAlternative;

  return (
    <section className="grid gap-4 rounded-3xl border border-white/10 bg-[#0d121a] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClass(menuState(row).tone)}`}>{menuState(row).label}</span>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${toneClass(statusMeta(row).tone)}`}>{statusMeta(row).label}</span>
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">{row.dayLabel}</h3>
          <p className="mt-1 text-sm font-bold text-zinc-400">
            Meta {displayKcal(row?.target?.kcal)} / {displayMacros(row?.target)}
          </p>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onOpenRemaining}
            disabled={!canAutoCompleteRemaining}
            className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#FFE8A3] disabled:opacity-45"
          >
            Calcular lo que falta
          </button>
          <button
            type="button"
            onClick={() => onMarkMissed(row)}
            disabled={!canMarkMeals}
            className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-45"
          >
            Día no cumplido
          </button>
        </div>
      </div>

      <div className="grid gap-2 rounded-3xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
        <TrackingMiniPanel label="Meta" totals={targetTotals(row)} tone="gold" />
        <TrackingMiniPanel label="Consumido" totals={consumedTotals(row)} tone="green" />
        <TrackingMiniPanel label="Faltante" totals={remainingTotals(row)} tone={remainingTotals(row).kcal < -20 ? "red" : "blue"} />
      </div>

      {selectedAlternative ? (
        <div className="rounded-3xl border border-sky-400/25 bg-sky-400/10 p-4 text-sm font-bold text-sky-100">
          Hoy elegiste alternativa: {selectedAlternative.name}
        </div>
      ) : null}

      {choices.length ? (
        <MenuChoicesBlock row={row} choices={choices} onUseAlternative={onUseAlternative} />
      ) : (
        <EmptyMenu row={row} />
      )}

      <DesktopMealsSection
        row={row}
        weekRows={weekRows}
        onToggleMeal={onToggleMeal}
        onOpenMeal={onOpenMeal}
        onSaveAsSavedMeal={onSaveAsSavedMeal}
        onRestoreGenerated={onRestoreGenerated}
        canMarkMeals={canMarkMeals}
        saving={saving}
      />

    </section>
  );
}

function MenuChoicesBlock({ row, choices, onUseAlternative }) {
  return (
    <div className="rounded-3xl border border-[#D4AF37]/20 bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Menús del día</span>
          <h4 className="mt-1 text-lg font-black text-white">
            {choices.length === 1 ? choices[0].snapshot?.name || "Menu asignado" : `Total menus (${choices.length})`}
          </h4>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-xl" aria-hidden="true">
          {MENU_BOX_EMOJI}
        </span>
      </div>
      <div className="grid gap-2">
        {choices.map((choice) => {
          const totals = choiceTotals(choice);
          return (
            <article
              key={choice.key}
              className={`rounded-2xl border p-3 ${choice.type === "primary" ? "border-[#D4AF37]/30 bg-[#D4AF37]/10" : "border-sky-400/20 bg-sky-400/10"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
                    {choice.type === "primary" ? "Menu principal" : choice.label}
                  </span>
                  <h5 className="mt-1 truncate text-base font-black text-white">{choice.snapshot?.name || "Menu"}</h5>
                  <p className="mt-1 text-xs font-bold text-zinc-300">
                    {displayKcal(totals.kcal)} / {displayMenuMacros(totals)}
                  </p>
                </div>
                {choice.type === "alternative" ? (
                  <button
                    type="button"
                    onClick={() => onUseAlternative(row, choice.index)}
                    className="shrink-0 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-2 text-xs font-black text-sky-100"
                  >
                    Usar hoy
                  </button>
                ) : (
                  <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-black/20 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
                    Actual
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function EmptyMenu({ row }) {
  return (
    <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.03] p-5">
      <div className="flex items-center gap-3 text-zinc-200">
        <CircleAlert size={20} className="text-[#FFE8A3]" />
        <strong>Sin menú asignado para {row?.dayLabel}</strong>
      </div>
      <p className="mt-2 text-sm font-semibold text-zinc-400">
        Organiza tu alimentacion a tu manera: crea un menu propio, explora la biblioteca ZumaFit o registra libremente en Tracking.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/app/nutricion" className="inline-flex rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-2 text-sm font-black text-[#FFE8A3]">
          Crear mi menu
        </a>
        <a href="/app/nutricion" className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-zinc-100">
          Explorar ZumaFit
        </a>
        <a href="/app/tracking" className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-zinc-100">
          Ir a Tracking
        </a>
      </div>
    </div>
  );
}

function MobileMealDetailDrawer({
  context,
  onToggleMeal,
  onOpenFood,
  onClose,
  canMarkMeals,
  canReplaceMeals,
  canReplaceFoods,
  onApplyMealReplacement,
  onSaveAsSavedMeal,
  saving,
}) {
  const row = useMemo(() => context?.row || {}, [context?.row]);
  const meal = context?.meal || {};
  const baseMeal = context?.baseMeal || meal;
  const mealIndex = context?.mealIndex || 0;
  const manual = !!context?.manual || meal?.source === "manual_food";
  const generated = !!context?.generated || meal?.source === "generated_remaining_meal";
  const [replaceOpen, setReplaceOpen] = useState(false);
  const done = completedMealIdSet(row).has(mealId(baseMeal, mealIndex));
  const foods = mealFoods(meal);
  const totals = mealTotals(meal);
  const replacementOptions = useMemo(() => mealReplacementOptions(row, baseMeal, mealIndex), [row, baseMeal, mealIndex]);

  return (
    <section className="fixed inset-0 z-50 flex items-center bg-black/75 px-3 py-5 backdrop-blur-md" role="dialog" aria-modal="true">
      <div className="mx-auto flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_18%_0,rgba(45,212,191,.13),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(212,175,55,.15),transparent_30%),linear-gradient(180deg,#111a25,#080d13)] shadow-[0_24px_80px_rgba(0,0,0,.62)]">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 bg-white/[0.025] p-4">
          <div className="flex min-w-0 items-center gap-3">
            <MealTypeIcon meal={meal} index={mealIndex} done={done} />
            <div className="min-w-0">
              <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Comida</span>
              <h3 className="mt-1 truncate text-2xl font-black text-white">{mealName(meal, mealIndex)}</h3>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
                  {displayKcal(totals.kcal)}
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-zinc-300">
                  P {formatNumber(totals.proteina, 0)} g
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-zinc-300">
                  C {formatNumber(totals.carbs, 0)} g
                </span>
                <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-bold text-zinc-300">
                  G {formatNumber(totals.grasas, 0)} g
                </span>
              </div>
              {meal.replacementMeta?.type === "meal" ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-200">
                    Comida reemplazada
                  </span>
                  <span className="text-[11px] font-bold text-zinc-500">
                    Original: {meal.replacementMeta.originalName}
                  </span>
                </div>
              ) : null}
            </div>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-zinc-100 shadow-[0_8px_22px_rgba(0,0,0,.24)]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {generated || manual ? (
            <div className={`mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-black shadow-[0_10px_24px_rgba(0,0,0,.20)] ${manual ? "border-sky-300/35 bg-sky-300/10 text-sky-100" : "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"}`}>
              <span>{manual ? "Registro manual sumado al dia" : "Generada y guardada para esta semana"}</span>
              {manual ? <Utensils size={20} /> : <CheckSquare2 size={20} />}
            </div>
          ) : (
            <button
              type="button"
              disabled={!canMarkMeals || saving}
              onClick={() => {
                onToggleMeal(row, baseMeal, mealIndex);
                onClose();
              }}
              className={`mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-black shadow-[0_10px_24px_rgba(0,0,0,.20)] transition active:scale-[0.99] disabled:opacity-50 ${done ? "border-emerald-300/45 bg-[linear-gradient(135deg,rgba(16,185,129,.22),rgba(212,175,55,.08))] text-emerald-50" : "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#FFE8A3]"}`}
              aria-pressed={done}
            >
              <span>{done ? "Comida completa" : "Marcar completo"}</span>
              {done ? <CheckSquare2 size={20} /> : <Square size={20} />}
            </button>
          )}

          <button
            type="button"
            disabled={saving || !foods.length}
            onClick={() => onSaveAsSavedMeal?.(meal, mealIndex)}
            className="mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-sm font-black text-[#FFE8A3] shadow-[0_10px_24px_rgba(0,0,0,.18)] transition active:scale-[0.99] disabled:opacity-55"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Plus size={17} className="shrink-0" />
              <span className="truncate">Guardar en Mis comidas</span>
            </span>
            {saving ? <RefreshCw size={18} className="shrink-0 animate-spin" /> : <ChevronRight size={18} className="shrink-0" />}
          </button>

          {!generated && !manual ? (
            <button
              type="button"
              disabled={!canReplaceMeals || saving}
              onClick={() => setReplaceOpen((value) => !value)}
              className={`mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl border px-4 text-sm font-black shadow-[0_10px_24px_rgba(0,0,0,.18)] transition active:scale-[0.99] disabled:opacity-55 ${
                canReplaceMeals
                  ? "border-white/10 bg-white/[0.055] text-zinc-100"
                  : "border-white/10 bg-white/[0.025] text-zinc-500"
              }`}
            >
              <span className="flex min-w-0 items-center gap-2">
                <RefreshCw size={17} className="shrink-0 text-[#FFD76B]" />
                <span className="truncate">{canReplaceMeals ? "Cambiar comida" : "Tu coach no habilito cambios"}</span>
              </span>
              <ChevronRight size={18} className={`shrink-0 transition ${replaceOpen ? "rotate-90" : ""}`} />
            </button>
          ) : null}

          {replaceOpen ? (
            <MobileMealReplacementPanel
              row={row}
              meal={baseMeal}
              mealIndex={mealIndex}
              options={replacementOptions}
              saving={saving}
              onApply={onApplyMealReplacement}
            />
          ) : null}

          <div className="overflow-hidden rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))] shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_14px_32px_rgba(0,0,0,.22)]">
            {foods.length ? (
              <div className="divide-y divide-white/[0.07]">
                {foods.map((food, foodIndex) => (
                  <MobileFoodRow
                    key={`${food.id}-${foodIndex}`}
                    meal={baseMeal}
                    mealIndex={mealIndex}
                    food={food}
                    foodIndex={foodIndex}
                    onOpenFood={onOpenFood}
                    canReplaceFoods={!manual && canReplaceFoods}
                  />
                ))}
              </div>
            ) : (
              <div className="p-4 text-sm font-bold text-zinc-500">Sin alimentos cargados.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function MobileMealReplacementPanel({ row, meal, mealIndex, options = [], saving, onApply }) {
  const [selected, setSelected] = useState(null);
  const originalTotals = mealTotals(meal);

  return (
    <section className="mb-3 rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Alternativas</div>
          <p className="mt-1 text-xs font-bold text-zinc-400">
            Elegi una opcion compatible antes de confirmar.
          </p>
        </div>
        <span className="rounded-full border border-white/10 bg-black/20 px-2 py-1 text-[10px] font-black text-zinc-300">
          {options.length} opciones
        </span>
      </div>

      {options.length ? (
        <div className="mt-3 grid gap-2">
          {options.map((option) => {
            const active = selected?.key === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setSelected(option)}
                className={`rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  active ? "border-[#D4AF37]/45 bg-[#D4AF37]/10" : "border-white/10 bg-black/20"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <strong className="block truncate text-sm font-black text-white">{mealName(option.meal, mealIndex)}</strong>
                    <span className="mt-1 block text-xs font-bold text-zinc-400">
                      {displayKcal(option.totals.kcal)} · P {formatNumber(option.totals.proteina, 0)} g · {mealFoods(option.meal).length} alimentos
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-200">
                    {option.badge}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-bold text-zinc-500">
                  Dif. {signedNumber(option.diff.kcal)} kcal · P {signedNumber(option.diff.proteina)} g
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-zinc-500">
          No hay comidas alternativas compatibles para este horario.
        </div>
      )}

      {selected ? (
        <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3">
          <p className="text-sm font-black text-white">
            Usar {mealName(selected.meal, mealIndex)} en lugar de {mealName(meal, mealIndex)}?
          </p>
          <p className="mt-1 text-xs font-bold text-zinc-400">
            Se guarda como ajuste de tracking. Meta original: {displayKcal(originalTotals.kcal)}.
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => onApply?.({ row, originalMeal: meal, replacementMeal: selected.meal, mealIndex })}
            className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 text-sm font-black text-[#03140c] disabled:opacity-60"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={17} />}
            Confirmar cambio
          </button>
        </div>
      ) : null}
    </section>
  );
}

function FoodActionDrawer({ context, canReplaceFoods, saving, onApplyReplacement, onClose }) {
  const food = useMemo(() => context?.food || {}, [context?.food]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");
  const [equivalents, setEquivalents] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    let active = true;
    if (!food?.name) return undefined;
    setLoading(true);
    setError("");
    setEquivalents([]);
    getFoodEquivalents({
      alimentoOriginal: {
        ...food.raw,
        alimentoId: food.alimentoId,
        nombreSnapshot: food.name,
        cantidad: food.cantidad,
        unidad: food.unidad,
        kcal: food.totals?.kcal,
        proteina: food.totals?.proteina,
        carbs: food.totals?.carbs,
        grasas: food.totals?.grasas,
      },
      cantidad: food.cantidad,
      unidad: food.unidad,
    })
      .then((data) => {
        if (!active) return;
        setEquivalents((Array.isArray(data?.equivalentes) ? data.equivalentes : []).map((option) =>
          replacementOptionFromEquivalent(option, food)
        ));
      })
      .catch((err) => {
        if (!active) return;
        setError(friendlyEquivalentError(err?.message));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [food]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setSearchResults([]);
      return undefined;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      listAlimentos({ search: term })
        .then((data) => {
          if (!active) return;
          setSearchResults((data?.alimentos || []).slice(0, 6).map((item) =>
            replacementOptionFromFood(item, food)
          ));
        })
        .catch((err) => {
          if (active) setError(err?.message || "No se pudo buscar alimentos.");
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 260);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, food]);

  return (
    <section className="fixed inset-0 z-[60] flex items-center bg-black/70 px-3 py-5 backdrop-blur-sm" role="dialog" aria-modal="true">
      <div className="mx-auto flex max-h-[82dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[1.6rem] border border-white/10 bg-[#0b121b] shadow-[0_24px_80px_rgba(0,0,0,.62)]">
        <header className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
          <div className="min-w-0">
            <span className="inline-flex min-h-7 items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3]">
              Reemplazar alimento
            </span>
            <h3 className="mt-3 truncate text-2xl font-black text-white">{food.name || "Alimento"}</h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              {[food.amount, foodMacroLine(food)].filter(Boolean).join(" · ") || "Sin detalle cargado"}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <section className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Alimento actual</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <FoodDetailStat label="Cantidad" value={food.amount || "-"} />
              <FoodDetailStat label="Calorías" value={displayKcal(food.totals?.kcal)} />
              <FoodDetailStat label="Proteína" value={`${formatNumber(food.totals?.proteina, 1)} g`} />
              <FoodDetailStat label="Carbs" value={`${formatNumber(food.totals?.carbs, 1)} g`} />
            </div>
          </section>

          {!canReplaceFoods ? (
            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm font-bold text-zinc-500">
              Tu coach no habilito reemplazos de alimentos.
            </div>
          ) : null}

          <section className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-wide text-sky-200">Buscar equivalente</div>
                <p className="mt-1 text-xs font-bold text-zinc-500">Elegi una opcion y confirmala antes de aplicar.</p>
              </div>
              {loading ? <RefreshCw size={17} className="shrink-0 animate-spin text-sky-200" /> : null}
            </div>

            <label className="mt-3 flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3">
              <Search size={16} className="shrink-0 text-[#FFD76B]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={!canReplaceFoods}
                placeholder="Buscar alimento equivalente"
                className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500 disabled:opacity-50"
              />
              {searchLoading ? <RefreshCw size={15} className="shrink-0 animate-spin text-zinc-400" /> : null}
            </label>

            {error ? (
              <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">
                {error}
              </div>
            ) : null}

            {!loading && !error && equivalents.length ? (
              <div className="mt-3 grid gap-2">
                {equivalents.slice(0, 6).map((option, index) => (
                  <button
                    type="button"
                    disabled={!canReplaceFoods}
                    onClick={() => setSelected(option)}
                    key={`${option.id || option.name || index}`}
                    className={`rounded-2xl border p-3 text-left disabled:opacity-50 ${
                      selected?.id === option.id && selected?.source === option.source
                        ? "border-[#D4AF37]/45 bg-[#D4AF37]/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block truncate text-sm text-white">{option.nombre || option.name || "Equivalente"}</strong>
                        <span className="mt-1 block text-xs font-bold text-zinc-400">
                          {formatNumber(option.cantidadSugerida, 1)} {option.unidadSugerida || option.unidad || "g"} · {displayKcal(option.totales?.kcal ?? option.kcal)}
                        </span>
                      </div>
                      <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
                        Revisar
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {searchResults.length ? (
              <div className="mt-3 grid gap-2">
                <div className="text-[11px] font-black uppercase tracking-wide text-zinc-500">Resultados</div>
                {searchResults.map((option, index) => (
                  <button
                    type="button"
                    disabled={!canReplaceFoods}
                    onClick={() => setSelected(option)}
                    key={`${option.id || option.name}-search-${index}`}
                    className={`rounded-2xl border p-3 text-left disabled:opacity-50 ${
                      selected?.id === option.id && selected?.source === option.source
                        ? "border-[#D4AF37]/45 bg-[#D4AF37]/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <strong className="block truncate text-sm text-white">{option.name || "Alimento"}</strong>
                    <span className="mt-1 block text-xs font-bold text-zinc-400">
                      {option.amount || `${formatNumber(option.cantidad, 1)} ${option.unidad || "g"}`} · {displayKcal(option.totals?.kcal)}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {!loading && !error && !equivalents.length ? (
              <div className="mt-3 rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-zinc-500">
                No encontramos equivalencias automaticas. Podes buscar un alimento manualmente.
              </div>
            ) : null}
          </section>
        </div>

        <footer className="border-t border-white/10 p-4">
          {selected ? (
            <div className="mb-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3">
              <p className="text-sm font-black text-white">
                Reemplazar {food.amount || "este alimento"} de {food.name || "alimento"} por {selected.amount || `${formatNumber(selected.cantidad, 1)} ${selected.unidad || "g"}`} de {selected.name}.
              </p>
              <p className="mt-1 text-xs font-bold text-zinc-400">
                Dif. {signedNumber(selected.diff?.kcal)} kcal · P {signedNumber(selected.diff?.proteina, 1)} · C {signedNumber(selected.diff?.carbs, 1)} · G {signedNumber(selected.diff?.grasas, 1)}
              </p>
            </div>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-black text-zinc-200">
              Cancelar
            </button>
            <button
              type="button"
              disabled={!selected || !canReplaceFoods || saving}
              onClick={() => onApplyReplacement?.({ ...context, replacement: selected })}
              className="rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-3 text-sm font-black text-[#FFE8A3] disabled:opacity-45"
            >
              {saving ? "Guardando..." : "Aplicar reemplazo"}
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}

function FoodDetailStat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
      <span className="block truncate text-[10px] font-black uppercase tracking-wide text-zinc-500">{label}</span>
      <strong className="mt-1 block truncate text-sm font-black text-white">{value}</strong>
    </div>
  );
}

function RemainingMealsDrawer({ row, saving, onClose, onSave }) {
  const [count, setCount] = useState(2);
  const [foods, setFoods] = useState([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeMeal, setActiveMeal] = useState(0);
  const [selectedFoods, setSelectedFoods] = useState({});
  const [results, setResults] = useState({});
  const [loadingMeal, setLoadingMeal] = useState(null);
  const [error, setError] = useState("");
  const remaining = positiveTotals(remainingTotals(row));
  const distributions = {
    1: [1],
    2: [0.35, 0.65],
    3: [0.28, 0.34, 0.38],
  };
  const names = count === 1 ? ["Comida restante"] : count === 2 ? ["Merienda", "Cena"] : ["Snack", "Merienda", "Cena"];
  const targets = (distributions[count] || distributions[2]).map((portion, index) => ({
    id: `remaining-${index + 1}`,
    name: names[index] || `Comida ${index + 1}`,
    totals: {
      kcal: Math.round(remaining.kcal * portion),
      proteina: Math.round(remaining.proteina * portion * 10) / 10,
      carbs: Math.round(remaining.carbs * portion * 10) / 10,
      grasas: Math.round(remaining.grasas * portion * 10) / 10,
    },
  }));

  useEffect(() => {
    let alive = true;
    setFoodsLoading(true);
    listAlimentos({})
      .then((data) => {
        if (!alive) return;
        setFoods(data?.all || data?.alimentos || []);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "No se pudieron cargar alimentos.");
      })
      .finally(() => {
        if (alive) setFoodsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredFoods = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term || term.length < 2) return [];
    return foods
      .filter((food) => (food._searchText || `${food.name} ${food.nombre} ${food.categoria}`).toLowerCase().includes(term))
      .slice(0, 8);
  }, [foods, search]);

  function addFood(food) {
    setSelectedFoods((current) => {
      const list = current[activeMeal] || [];
      if (list.some((item) => item.id === food.id)) return current;
      return { ...current, [activeMeal]: [...list, food] };
    });
    setSearch("");
    setResults((current) => ({ ...current, [activeMeal]: null }));
  }

  function removeFood(mealIndex, foodId) {
    setSelectedFoods((current) => ({
      ...current,
      [mealIndex]: (current[mealIndex] || []).filter((food) => food.id !== foodId),
    }));
    setResults((current) => ({ ...current, [mealIndex]: null }));
  }

  async function calculateMeal(mealIndex) {
    const target = targets[mealIndex];
    const selected = selectedFoods[mealIndex] || [];
    if (!selected.length) {
      setError("Agregá alimentos para calcular cantidades.");
      return;
    }
    if (!target?.totals?.kcal) {
      setError("No hay macros pendientes para esta comida.");
      return;
    }
    try {
      setError("");
      setLoadingMeal(mealIndex);
      const payload = {
        target: {
          kcal: target.totals.kcal,
          proteina: target.totals.proteina,
          carbs: target.totals.carbs,
          grasas: target.totals.grasas,
        },
        mode: target.totals.carbs || target.totals.grasas ? "full" : "kcalProteina",
        generationType: "selectedOnly",
        fixedFoods: [],
        pendingFoods: selected.map((food) => ({
          foodId: food.id,
          name: food.name || food.nombre,
          unit: food.unidad || food.unit || "g",
          source: "pending",
          kcalPerUnitOrGram: foodPerUnit(food, "kcal"),
          proteinPerUnitOrGram: foodPerUnit(food, "proteina"),
          carbsPerUnitOrGram: foodPerUnit(food, "carbs"),
          fatPerUnitOrGram: foodPerUnit(food, "grasas"),
        })),
        options: {
          redondear: true,
          usarMinMax: true,
        },
      };
      const response = await generateMealQuantities(payload);
      if (response?.status === "error" || !Array.isArray(response?.foods) || !response.foods.length) {
        throw new Error(response?.message || "No se pudo calcular una combinación razonable.");
      }
      setResults((current) => ({ ...current, [mealIndex]: response }));
    } catch (err) {
      setError(err?.message || "No se pudieron generar cantidades.");
    } finally {
      setLoadingMeal(null);
    }
  }

  function resultTotals(result = {}) {
    if (result.totals) return totalFromLike(result.totals);
    return sumTotals((result.foods || []).map(normalizeGeneratedFood));
  }

  function saveGenerated() {
    const generated = targets
      .map((target, index) => {
        const result = results[index];
        if (!result?.foods?.length) return null;
        const foodsFromResult = result.foods.map(normalizeGeneratedFood);
        return {
          id: `generated-${row.date}-${index + 1}-${Date.now()}`,
          name: target.name,
          source: "auto_generated_remaining",
          target: target.totals,
          foods: foodsFromResult,
          totals: resultTotals(result),
        };
      })
      .filter(Boolean);
    if (!generated.length) {
      setError("Generá al menos una comida antes de guardar.");
      return;
    }
    onSave(generated);
  }

  return (
    <section className="fixed inset-0 z-50 bg-black/70 p-1 backdrop-blur-sm sm:p-3" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#090d13] shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-center justify-between border-b border-white/10 p-4">
          <div>
            <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Tracking flexible</span>
            <h3 className="text-2xl font-black text-white">Calcular lo que falta</h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              Faltan {displayKcal(remaining.kcal)} / P {formatNumber(remaining.proteina, 1)} / C {formatNumber(remaining.carbs, 1)} / G {formatNumber(remaining.grasas, 1)}
            </p>
          </div>
          <button type="button" onClick={onClose} className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[0.04]" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setCount(value);
                    setActiveMeal(0);
                    setResults({});
                  }}
                  className={`rounded-2xl border px-3 py-3 text-sm font-black ${count === value ? "border-[#D4AF37]/45 bg-[#D4AF37]/10 text-[#FFE8A3]" : "border-white/10 bg-white/[0.03] text-zinc-200"}`}
                >
                  {value} comida{value > 1 ? "s" : ""}
                </button>
              ))}
            </div>

            <div className="grid gap-3 lg:grid-cols-[0.85fr_1.15fr]">
              <div className="grid gap-2">
                {targets.map((target, index) => (
                  <button
                    key={target.id}
                    type="button"
                    onClick={() => setActiveMeal(index)}
                    className={`rounded-2xl border p-3 text-left ${activeMeal === index ? "border-[#D4AF37]/40 bg-[#D4AF37]/10" : "border-white/10 bg-black/20"}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <strong className="text-sm text-white">{target.name}</strong>
                      {results[index] ? <CheckCircle2 size={16} className="text-emerald-300" /> : null}
                    </div>
                    <p className="mt-1 text-xs font-bold text-zinc-400">
                      {displayKcal(target.totals.kcal)} / {displayMenuMacros(target.totals)}
                    </p>
                    <p className="mt-1 text-[11px] font-bold text-zinc-500">
                      {(selectedFoods[index] || []).length} alimentos
                    </p>
                  </button>
                ))}
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Alimentos</span>
                    <h4 className="text-lg font-black text-white">{targets[activeMeal]?.name}</h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => calculateMeal(activeMeal)}
                    disabled={loadingMeal === activeMeal}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#FFE8A3] disabled:opacity-60"
                  >
                    {loadingMeal === activeMeal ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
                    Generar
                  </button>
                </div>

                <label className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#0d121a] px-3 py-2">
                  <Search size={16} className="text-zinc-500" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={foodsLoading ? "Cargando alimentos..." : "Buscar alimento"}
                    className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500"
                  />
                </label>

                {filteredFoods.length ? (
                  <div className="mt-2 grid gap-1.5">
                    {filteredFoods.map((food) => (
                      <button
                        key={food.id}
                        type="button"
                        onClick={() => addFood(food)}
                        className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-3 py-2 text-left text-xs font-bold text-zinc-200"
                      >
                        <span className="min-w-0 truncate">{food.name || food.nombre}</span>
                        <Plus size={14} className="shrink-0 text-[#FFE8A3]" />
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {(selectedFoods[activeMeal] || []).map((food) => (
                    <div key={food.id} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2">
                      <span className="min-w-0 truncate text-sm font-bold text-white">{food.name || food.nombre}</span>
                      <button type="button" onClick={() => removeFood(activeMeal, food.id)} className="grid h-8 w-8 place-items-center rounded-xl border border-rose-400/25 bg-rose-400/10 text-rose-100">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {!(selectedFoods[activeMeal] || []).length ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-zinc-500">
                      Elegí alimentos y después generá cantidades.
                    </div>
                  ) : null}
                </div>

                {results[activeMeal] ? (
                  <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-100">
                      Resultado {results[activeMeal].quality ? `/${results[activeMeal].quality}` : ""}
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      {results[activeMeal].foods.map((food, index) => {
                        const item = normalizeGeneratedFood(food);
                        return (
                          <div key={item.id || index} className="flex items-center justify-between gap-2 text-sm font-bold text-zinc-100">
                            <span className="min-w-0 truncate">{item.name}</span>
                            <span className="shrink-0 text-[#FFE8A3]">{formatNumber(item.quantity, 1)} {item.unit}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="grid gap-2 border-t border-white/10 p-4 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-black text-zinc-100">
            Cancelar
          </button>
          <button type="button" disabled={saving} onClick={saveGenerated} className="rounded-2xl bg-[#D4AF37] px-4 py-4 text-sm font-black text-black disabled:opacity-60">
            {saving ? "Guardando..." : "Guardar comidas calculadas"}
          </button>
        </footer>
      </div>
    </section>
  );
}

function RemainingMealsDrawerV2({ row, weekRows = [], saving, onClose, onSave, onSaveManual }) {
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const initialCount = Math.min(3, Math.max(1, pendingBaseMealsForRemaining(displayRow, weekRows).length || 1));
  const [count, setCount] = useState(initialCount);
  const [mode, setMode] = useState("complete");
  const [foods, setFoods] = useState([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [activeMeal, setActiveMeal] = useState(0);
  const [selectedFoods, setSelectedFoods] = useState({});
  const [results, setResults] = useState({});
  const [loadingMeal, setLoadingMeal] = useState(null);
  const [error, setError] = useState("");
  const rawRemaining = remainingTotals(displayRow);
  const remaining = positiveTotals(rawRemaining);
  const consumed = consumedTotals(displayRow);
  const baseMeals = choiceMeals(trackingChoice(displayRow));
  const completedCount = effectiveMealEntriesForDay(displayRow, baseMeals, weekRows).filter((entry) => entry.done).length;
  const exceeded = consumed.kcal > targetTotals(displayRow).kcal && rawRemaining.kcal <= 0;
  const targets = useMemo(() => remainingGenerationTargets(displayRow, count, weekRows), [displayRow, count, weekRows]);
  const activeTarget = targets[activeMeal] || targets[0] || null;
  const isManualMode = mode === "manual";
  const activeSelectedFoods = selectedFoods[activeMeal] || [];
  const activeManualCount = activeSelectedFoods.filter(hasManualQuantity).length;
  const showNoFoodResults = search.trim().length >= 2 && !foodsLoading && !foods.length;

  useEffect(() => {
    if (activeMeal >= targets.length) setActiveMeal(0);
  }, [activeMeal, targets.length]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setFoods([]);
      setFoodsLoading(false);
      return undefined;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setFoodsLoading(true);
      listAlimentos({ search: term, limit: 12 })
        .then((data) => {
          if (!alive) return;
          setFoods((data?.alimentos || data?.all || []).slice(0, 12));
        })
        .catch((err) => {
          if (alive) setError(err?.message || "No se pudieron buscar alimentos.");
        })
        .finally(() => {
          if (alive) setFoodsLoading(false);
        });
    }, 260);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  function normalizeSelectableFood(food = {}) {
    return {
      ...food,
      id: String(food.id || food._id || food.alimentoId || food.nombre || food.name),
      name: food.name || food.nombre || "Alimento",
      manualQuantity: food.manualQuantity ?? "",
    };
  }

  function manualQuantityOf(food = {}) {
    return macro(food.manualQuantity);
  }

  function hasManualQuantity(food = {}) {
    return manualQuantityOf(food) > 0;
  }

  function addFood(food) {
    const normalized = normalizeSelectableFood(food);
    setSelectedFoods((current) => {
      const list = current[activeMeal] || [];
      if (list.some((item) => item.id === normalized.id)) return current;
      return { ...current, [activeMeal]: [...list, normalized] };
    });
    setSearch("");
    setFoods([]);
    setResults((current) => ({ ...current, [activeMeal]: null }));
  }

  function updateFoodQuantity(mealIndex, foodId, value) {
    setSelectedFoods((current) => ({
      ...current,
      [mealIndex]: (current[mealIndex] || []).map((food) =>
        food.id === foodId ? { ...food, manualQuantity: value } : food
      ),
    }));
    setResults((current) => ({ ...current, [mealIndex]: null }));
  }

  function removeFood(mealIndex, foodId) {
    setSelectedFoods((current) => ({
      ...current,
      [mealIndex]: (current[mealIndex] || []).filter((food) => food.id !== foodId),
    }));
    setResults((current) => ({ ...current, [mealIndex]: null }));
  }

  function fixedFoodPayload(food = {}) {
    const quantity = manualQuantityOf(food);
    const totals = {
      kcal: foodPerUnit(food, "kcal") * quantity,
      proteina: foodPerUnit(food, "proteina") * quantity,
      carbs: foodPerUnit(food, "carbs") * quantity,
      grasas: foodPerUnit(food, "grasas") * quantity,
    };
    return {
      foodId: food.id,
      name: food.name || food.nombre,
      unit: food.unidad || food.unit || "g",
      quantity,
      kcal: totals.kcal,
      protein: totals.proteina,
      proteina: totals.proteina,
      carbs: totals.carbs,
      fat: totals.grasas,
      grasas: totals.grasas,
      source: "manual",
    };
  }

  function pendingFoodPayload(food = {}) {
    return {
      foodId: food.id,
      name: food.name || food.nombre,
      unit: food.unidad || food.unit || "g",
      source: "pending",
      kcalPerUnitOrGram: foodPerUnit(food, "kcal"),
      proteinPerUnitOrGram: foodPerUnit(food, "proteina"),
      carbsPerUnitOrGram: foodPerUnit(food, "carbs"),
      fatPerUnitOrGram: foodPerUnit(food, "grasas"),
    };
  }

  function manualOnlyResult(selected = [], target = {}) {
    const foods = selected.map((food) => {
      const fixed = fixedFoodPayload(food);
      return {
        foodId: fixed.foodId,
        name: fixed.name,
        nombre: fixed.name,
        quantity: fixed.quantity,
        cantidad: fixed.quantity,
        unit: fixed.unit,
        unidad: fixed.unit,
        source: "fixed",
        kcal: fixed.kcal,
        proteina: fixed.proteina,
        protein: fixed.proteina,
        carbs: fixed.carbs,
        grasas: fixed.grasas,
        fat: fixed.grasas,
        fixedQuantity: true,
      };
    });
    const totals = sumTotals(foods.map(normalizeGeneratedFood));
    return {
      status: "ok",
      quality: "manual",
      message: "Totales calculados con cantidades manuales.",
      foods,
      totals,
      target: target.totals,
      diff: {
        kcal: totals.kcal - target.totals.kcal,
        proteina: totals.proteina - target.totals.proteina,
        carbs: totals.carbs - target.totals.carbs,
        grasas: totals.grasas - target.totals.grasas,
      },
    };
  }

  async function calculateMeal(mealIndex) {
    const target = targets[mealIndex];
    const selected = selectedFoods[mealIndex] || [];
    if (exceeded || !remaining.kcal) {
      setError("Ya superaste la meta. Podes guardar el registro, pero no hay macros restantes para generar comidas.");
      return;
    }
    if (!selected.length) {
      setError("Elegi alimentos para calcular cantidades.");
      return;
    }
    if (!target?.totals?.kcal) {
      setError("No hay macros pendientes para esta comida.");
      return;
    }
    try {
      setError("");
      setLoadingMeal(mealIndex);
      const fixedFoods = selected.filter(hasManualQuantity).map(fixedFoodPayload);
      const pendingFoods = selected.filter((food) => !hasManualQuantity(food)).map(pendingFoodPayload);

      if (!pendingFoods.length) {
        setResults((current) => ({ ...current, [mealIndex]: manualOnlyResult(selected, target) }));
        return;
      }

      const payload = {
        target: {
          kcal: target.totals.kcal,
          proteina: target.totals.proteina,
          carbs: target.totals.carbs,
          grasas: target.totals.grasas,
        },
        mode: target.totals.carbs || target.totals.grasas ? "full" : "kcalProteina",
        generationType: "selectedOnly",
        fixedFoods,
        pendingFoods,
        options: {
          redondear: true,
          usarMinMax: true,
        },
      };
      const response = await generateMealQuantities(payload);
      if (response?.status === "error" || !Array.isArray(response?.foods) || !response.foods.length) {
        throw new Error(response?.message || "No se pudo calcular una combinacion razonable.");
      }
      setResults((current) => ({ ...current, [mealIndex]: response }));
    } catch (err) {
      setError(err?.message || "No se pudieron generar cantidades.");
    } finally {
      setLoadingMeal(null);
    }
  }

  function resultTotals(result = {}) {
    if (result.totals) return totalFromLike(result.totals);
    return sumTotals((result.foods || []).map(normalizeGeneratedFood));
  }

  function resultDiff(result = {}, target = {}) {
    const totals = resultTotals(result);
    const goal = target?.totals || {};
    const explicit = result.diff || result.diferencia || {};
    return {
      kcal: macro(explicit.kcal ?? explicit.calorias ?? (totals.kcal - macro(goal.kcal))),
      proteina: macro(explicit.proteina ?? explicit.protein ?? (totals.proteina - macro(goal.proteina))),
      carbs: macro(explicit.carbs ?? explicit.carbohidratos ?? (totals.carbs - macro(goal.carbs))),
      grasas: macro(explicit.grasas ?? explicit.fat ?? (totals.grasas - macro(goal.grasas))),
    };
  }

  function signedMacro(value, digits = 0) {
    const n = macro(value);
    return `${n > 0 ? "+" : ""}${formatNumber(n, digits)}`;
  }

  function generatedFoodPayload(food = {}) {
    const normalized = normalizeGeneratedFood(food);
    return {
      ...normalized,
      alimentoId: normalized.id,
      nombre: normalized.name,
      cantidad: normalized.quantity,
      unidad: normalized.unit,
      source: normalized.fixedQuantity ? "manual_fixed" : "auto_calculated",
      fixedQuantity: normalized.fixedQuantity,
    };
  }

  function manualEntryFoodPayload(food = {}) {
    const fixed = fixedFoodPayload(food);
    return {
      id: fixed.foodId,
      alimentoId: fixed.foodId,
      name: fixed.name,
      nombre: fixed.name,
      quantity: fixed.quantity,
      cantidad: fixed.quantity,
      unit: fixed.unit,
      unidad: fixed.unit,
      kcal: fixed.kcal,
      proteina: fixed.proteina,
      carbs: fixed.carbs,
      grasas: fixed.grasas,
      source: "manual_food",
    };
  }

  function saveManual() {
    const selected = activeSelectedFoods;
    if (!selected.length) {
      setError("Elegí alimentos para registrar.");
      return;
    }
    const missingQuantity = selected.find((food) => !hasManualQuantity(food));
    if (missingQuantity) {
      setError("Para registrar algo distinto, indicá la cantidad de cada alimento.");
      return;
    }
    const now = new Date().toISOString();
    const foodsFromManual = selected.map(manualEntryFoodPayload);
    const totals = sumTotals(foodsFromManual.map(normalizeGeneratedFood));
    const replacedMeals = pendingBaseMealsForRemaining(displayRow, weekRows);
    const currentRemaining = remainingTotals(displayRow);
    const nextRemaining = subtractTotals(currentRemaining, totals);
    const proteinCaloriesNeeded = Math.max(0, nextRemaining.proteina) * 4;
    if (nextRemaining.kcal < -5) {
      setError("No conviene guardar esos alimentos: te pasás de las calorías pendientes. Ajustá la cantidad o elegí otra opción.");
      return;
    }
    if (nextRemaining.proteina > 5 && nextRemaining.kcal < proteinCaloriesNeeded - 5) {
      setError("No conviene guardar esos alimentos: te dejan sin calorías suficientes para cubrir la proteína pendiente.");
      return;
    }
    onSaveManual?.([{
      id: `manual-food-${row.date}-${Date.now()}`,
      date: row.date,
      dayKey: row.dayKey,
      name: "Registro manual",
      source: "manual_food",
      mode: "ate_something_else",
      scope: "day",
      activeFromDate: row.date,
      activeUntilDate: row.date,
      isActiveReplacement: true,
      replacesMealIds: replacedMeals.map((meal) => meal.id),
      replacesMealTypes: replacedMeals.map((meal) => meal.type),
      replacesMealNames: replacedMeals.map((meal) => meal.name),
      foods: foodsFromManual,
      items: foodsFromManual,
      totals,
      createdAt: now,
      updatedAt: now,
    }]);
  }

  function saveGenerated() {
    const now = new Date().toISOString();
    const activeWeekStart = mondayOfWeek(row.date);
    const activeWeekEnd = addDays(activeWeekStart, 6);
    const generationRunId = `generated-run-${row.date}-${Date.now()}`;
    const generated = targets
      .map((target, index) => {
        const result = results[index];
        if (!result?.foods?.length) return null;
        const foodsFromResult = result.foods.map(generatedFoodPayload);
        return {
          id: `${generationRunId}-${index + 1}`,
          generationRunId,
          date: row.date,
          dayKey: row.dayKey,
          source: "generated_remaining_meal",
          mode: "complete_pending_meals",
          scope: "week",
          weekStart: activeWeekStart,
          weekEnd: activeWeekEnd,
          activeFromDate: row.date,
          activeUntilDate: activeWeekEnd,
          isActiveReplacement: true,
          replacesMealIds: target.replacesMealIds,
          replacesMealTypes: target.replacesMealTypes,
          replacesMealNames: target.replacesMealNames,
          name: target.name,
          mealType: target.mealType || "generated",
          target: target.totals,
          items: foodsFromResult,
          foods: foodsFromResult,
          totals: resultTotals(result),
          createdAt: now,
          updatedAt: now,
        };
      })
      .filter(Boolean);
    if (!generated.length) {
      setError("Genera al menos una comida antes de guardar.");
      return;
    }
    onSave(generated);
  }

  return (
    <section className="fixed inset-0 z-50 bg-black/75 p-0 backdrop-blur-md sm:p-3" role="dialog" aria-modal="true">
      <div className="mx-auto flex h-full max-w-3xl flex-col overflow-hidden border border-white/10 bg-[radial-gradient(circle_at_20%_0,rgba(45,212,191,.12),transparent_32%),radial-gradient(circle_at_100%_10%,rgba(212,175,55,.14),transparent_30%),linear-gradient(180deg,#0d141d,#070a0f)] shadow-2xl sm:rounded-[2rem]">
        <header className="flex items-start justify-between border-b border-white/10 p-4">
          <div className="min-w-0">
            <h3 className="text-2xl font-black text-white">Calcular lo que falta</h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">Completa el resto del dia sin modificar tu menu base.</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-zinc-100" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3">
            <section className="overflow-hidden rounded-[1.35rem] border border-emerald-300/30 bg-[radial-gradient(circle_at_12%_50%,rgba(45,212,191,.22),transparent_30%),linear-gradient(135deg,rgba(15,31,31,.94),rgba(13,18,23,.94))] p-4 shadow-[0_16px_38px_rgba(0,0,0,.28)]">
              <div className="flex items-center gap-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border-[10px] border-emerald-300/20 bg-black/20 text-[#FFD76B] shadow-[inset_0_0_0_1px_rgba(255,255,255,.08)]">
                  <Calculator size={28} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-black text-zinc-200">Restante del dia</div>
                  <div className="mt-1 text-2xl font-black leading-tight text-white">
                    Faltan <span className="text-emerald-300">{formatNumber(remaining.kcal, 0)}</span> kcal
                  </div>
                  <div className="mt-1 text-sm font-black text-zinc-300">
                    <span className="text-emerald-300">P</span> {formatNumber(remaining.proteina, 0)} g / <span className="text-emerald-300">C</span> {formatNumber(remaining.carbs, 0)} g / <span className="text-emerald-300">G</span> {formatNumber(remaining.grasas, 0)} g
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-black text-zinc-300">
                    <span className="inline-flex items-center gap-1 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2.5 py-1 text-[#FFE8A3]">
                      <CheckCircle2 size={13} />
                      {completedCount} de {baseMeals.length || 0} comidas
                    </span>
                    <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-emerald-100">
                      Para esta semana
                    </span>
                  </div>
                </div>
              </div>
            </section>

            <div className="grid grid-cols-2 gap-2">
              <RemainingModeCard
                active={mode === "complete"}
                icon={<ClipboardCheck size={24} />}
                title="Completar comidas pendientes"
                text="Elegi alimentos y ZumaFit calcula cantidades para lo que te falta."
                onClick={() => {
                  setMode("complete");
                  setActiveMeal(0);
                  setResults({});
                  setSearch("");
                  setFoods([]);
                }}
              />
              <RemainingModeCard
                active={mode === "manual"}
                icon={<Calculator size={24} />}
                title="Registrar algo distinto"
                text="Cargá lo que comiste y recalculamos el resto."
                onClick={() => {
                  setMode("manual");
                  setActiveMeal(0);
                  setResults({});
                  setSearch("");
                  setFoods([]);
                }}
              />
            </div>

            {exceeded ? (
              <div className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-3 text-sm font-bold text-[#FFE8A3]">
                Ya superaste la meta. Podes guardar el registro, pero no hay macros restantes para generar comidas.
              </div>
            ) : null}

            {!isManualMode ? (
              <>
                <section>
                  <h4 className="px-1 text-base font-black text-white">En cuantas comidas queres dividirlo?</h4>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[1, 2, 3].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setCount(value);
                          setActiveMeal(0);
                          setResults({});
                        }}
                        className={`min-h-12 rounded-2xl border px-3 text-sm font-black transition active:scale-[0.99] ${count === value ? "border-[#D4AF37]/60 bg-[#D4AF37]/12 text-[#FFE8A3]" : "border-white/10 bg-white/[0.035] text-zinc-300"}`}
                      >
                        {value} comida{value > 1 ? "s" : ""}
                      </button>
                    ))}
                  </div>
                </section>

                <div className="grid gap-2">
                  {targets.map((target, index) => (
                    <RemainingTargetCard
                      key={target.id}
                      target={target}
                      active={activeMeal === index}
                      ready={Boolean(results[index])}
                      selectedCount={(selectedFoods[index] || []).length}
                      onClick={() => setActiveMeal(index)}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-[1.2rem] border border-sky-300/20 bg-sky-300/[0.055] p-3 text-sm font-bold text-sky-100">
                Registrá alimentos con cantidad real. Se suma al consumido del día y no modifica tu menú base.
              </div>
            )}

            <section className="rounded-[1.25rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.02))] p-3 shadow-[0_14px_32px_rgba(0,0,0,.24)]">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">
                    {isManualMode ? "Registrar" : "Alimentos para"}
                  </div>
                  <h4 className="truncate text-lg font-black text-white">
                    {isManualMode ? "Algo distinto" : activeTarget?.name || "Comida generada"}
                  </h4>
                </div>
                {!isManualMode ? (
                  <button
                    type="button"
                    onClick={() => calculateMeal(activeMeal)}
                    disabled={exceeded || loadingMeal === activeMeal}
                    className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-3 text-xs font-black text-emerald-200 disabled:opacity-50"
                  >
                    {loadingMeal === activeMeal ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
                    Generar
                  </button>
                ) : null}
              </div>

              <label className="mt-3 flex min-h-12 items-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3">
                <Search size={17} className="shrink-0 text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar alimento"
                  className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500"
                />
                {foodsLoading ? <RefreshCw size={15} className="shrink-0 animate-spin text-zinc-400" /> : null}
              </label>

              {foods.length ? (
                <div className="mt-2 grid gap-1.5">
                  {foods.map((food) => {
                    const normalized = normalizeSelectableFood(food);
                    return (
                      <button
                        key={normalized.id}
                        type="button"
                        onClick={() => addFood(normalized)}
                        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-left text-sm font-bold text-zinc-100 transition hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                      >
                        <span className="min-w-0">
                          <span className="block truncate">{normalized.name}</span>
                          <span className="mt-0.5 block truncate text-[11px] font-bold text-zinc-500">{foodLibraryMacroLine(normalized)}</span>
                        </span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]">
                          <Plus size={16} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {showNoFoodResults ? (
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm font-bold text-zinc-500">
                  No encontramos alimentos para esa busqueda.
                </div>
              ) : null}

              <div className="mt-3 grid gap-2">
                {activeSelectedFoods.map((food) => (
                  <div key={food.id} className="grid gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm font-black text-zinc-100 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <div className="min-w-0">
                      <span className="block truncate">{food.name || food.nombre}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-emerald-100/70">{foodLibraryMacroLine(food)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-2 sm:w-28 sm:flex-none">
                        <input
                          value={food.manualQuantity ?? ""}
                          onChange={(event) => updateFoodQuantity(activeMeal, food.id, event.target.value)}
                          inputMode="decimal"
                          placeholder={isManualMode ? "0" : "auto"}
                          className="min-w-0 flex-1 bg-transparent text-right text-sm font-black text-white outline-none placeholder:text-[#FFE8A3]"
                          aria-label={`Cantidad de ${food.name || food.nombre}`}
                        />
                        <span className="shrink-0 text-xs font-black text-zinc-500">g</span>
                      </label>
                      <button type="button" onClick={() => removeFood(activeMeal, food.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-black/20 text-zinc-300" aria-label={`Quitar ${food.name || food.nombre}`}>
                        <X size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                {!activeSelectedFoods.length ? (
                  <div className="w-full rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-zinc-500">
                    Elegi alimentos y despues genera cantidades.
                  </div>
                ) : null}
              </div>

              {activeManualCount ? (
                <div className="mt-2 inline-flex w-fit items-center gap-2 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1 text-[11px] font-black text-[#FFE8A3]">
                  {activeManualCount} cantidad{activeManualCount === 1 ? "" : "es"} fija{activeManualCount === 1 ? "" : "s"}
                </div>
              ) : null}

              {results[activeMeal] ? (
                <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-black uppercase tracking-wide text-emerald-100">
                      Resultado {results[activeMeal].quality ? `/${results[activeMeal].quality}` : ""}
                    </div>
                    <div className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-black text-zinc-300">
                      Meta {displayKcal(activeTarget?.totals?.kcal)} · P {formatNumber(activeTarget?.totals?.proteina, 0)} / C {formatNumber(activeTarget?.totals?.carbs, 0)} / G {formatNumber(activeTarget?.totals?.grasas, 0)}
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1.5">
                    {results[activeMeal].foods.map((food, index) => {
                      const item = normalizeGeneratedFood(food);
                      return (
                        <div key={item.id || index} className="grid gap-1 rounded-xl bg-black/15 px-2.5 py-2 text-sm font-bold text-zinc-100 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                          <span className="min-w-0">
                            <span className="block truncate">{item.name}</span>
                            <span className="mt-0.5 block text-[11px] font-bold text-zinc-500">P {formatNumber(item.proteina, 1)} / C {formatNumber(item.carbs, 1)} / G {formatNumber(item.grasas, 1)}</span>
                          </span>
                          <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-0.5 text-xs font-black text-[#FFE8A3]">
                            {item.fixedQuantity ? <Lock size={11} /> : null}
                            {formatNumber(item.quantity, 1)} {item.unit} · {displayKcal(item.kcal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {(() => {
                    const totals = resultTotals(results[activeMeal]);
                    const diff = resultDiff(results[activeMeal], activeTarget);
                    return (
                      <div className="mt-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-zinc-300">
                        <div>Total {displayKcal(totals.kcal)} · P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}</div>
                        <div className="mt-1 text-zinc-500">Diferencia {signedMacro(diff.kcal, 0)} kcal / P {signedMacro(diff.proteina, 1)} / C {signedMacro(diff.carbs, 1)} / G {signedMacro(diff.grasas, 1)}</div>
                      </div>
                    );
                  })()}
                </div>
              ) : null}
            </section>

            {error ? (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="grid gap-2 border-t border-white/10 bg-black/15 p-4 sm:grid-cols-2">
          <button type="button" onClick={onClose} className="min-h-[52px] rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-4 text-sm font-black text-zinc-100">
            Cancelar
          </button>
          <button type="button" disabled={saving} onClick={isManualMode ? saveManual : saveGenerated} className="min-h-[52px] rounded-2xl bg-[#D4AF37] px-4 py-4 text-sm font-black text-black shadow-[0_14px_30px_rgba(212,175,55,.22)] disabled:opacity-60">
            {saving ? "Guardando..." : isManualMode ? "Guardar registro" : "Guardar comidas de la semana"}
          </button>
        </footer>
      </div>
    </section>
  );
}

function RemainingModeCard({ active, disabled = false, icon, title, text, onClick }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`relative min-h-[136px] rounded-[1.25rem] border p-3 text-left transition active:scale-[0.99] disabled:opacity-65 ${
        active ? "border-[#D4AF37]/70 bg-[#D4AF37]/10" : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <span className={`grid h-10 w-10 place-items-center rounded-2xl border ${active ? "border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFE8A3]" : "border-white/10 bg-black/20 text-zinc-300"}`}>
        {icon}
      </span>
      <strong className="mt-3 block text-sm font-black leading-tight text-white">{title}</strong>
      <span className="mt-1 block text-xs font-bold leading-snug text-zinc-400">{text}</span>
      {active ? <CheckCircle2 size={18} className="absolute right-3 top-3 text-[#FFD76B]" /> : null}
    </button>
  );
}

function RemainingTargetCard({ target, active, ready, selectedCount, onClick }) {
  const replaceText = target.replacesMealNames?.length ? target.replacesMealNames.join(" + ") : "bloque del dia";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 items-center gap-3 rounded-[1.2rem] border p-3 text-left transition active:scale-[0.99] ${
        active ? "border-[#D4AF37]/45 bg-[#D4AF37]/10" : "border-white/10 bg-white/[0.035]"
      }`}
    >
      <MealTypeIcon meal={{ name: target.name, tipoComida: target.mealType }} index={0} done={ready} />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <strong className="min-w-0 truncate text-lg font-black text-white">{target.name}</strong>
          <span className="shrink-0 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 py-0.5 text-[10px] font-black text-[#FFE8A3]">
            {target.replacesMealNames?.length ? "Pendiente del menu" : "Reemplazo semanal"}
          </span>
        </span>
        <span className="mt-1 block truncate text-sm font-bold text-zinc-400">
          {displayKcal(target.totals.kcal)} / {displayMenuMacros(target.totals)}
        </span>
        <span className="mt-1 block truncate text-xs font-bold text-zinc-500">
          Reemplaza: {replaceText} - {selectedCount} alimento{selectedCount === 1 ? "" : "s"}
        </span>
      </span>
      {ready ? <CheckCircle2 size={19} className="shrink-0 text-emerald-300" /> : <ChevronRight size={19} className="shrink-0 text-zinc-500" />}
    </button>
  );
}
