import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Apple,
  Calculator,
  CheckSquare2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Eye,
  MoreHorizontal,
  Moon,
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

const EMPTY_DAYS = [];
const MENU_EMOJI = "\u{1F37D}\uFE0F";
const MENU_BOX_EMOJI = "\u{1F371}";
const EYE_EMOJI = "\u{1F441}\uFE0F";
const TOTAL_KEYS = {
  kcal: ["kcal", "calories", "calorias", "cal"],
  proteina: ["proteina", "proteinas", "protein", "p"],
  carbs: ["carbs", "carbohidratos", "carbohydrates", "hidratos", "c"],
  grasas: ["grasas", "grasa", "fat", "fats", "g"],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
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
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
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

function menuSnapshot(row) {
  return row?.assignment?.primaryMenu?.menuSnapshot || null;
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
  const status = statusMeta(row);
  if (Number.isFinite(Number(status.percent))) {
    return Math.max(0, Math.min(100, Math.round(Number(status.percent))));
  }
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  if (!target.kcal) return 0;
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
  const cantidad = safeItem.cantidad ?? safeItem.quantity ?? safeItem.qty;
  const unidad = safeItem.unidad || safeItem.unit || "";
  const amount = safeItem.amount || foodAmount(cantidad, unidad);
  const itemTotals = totalFromLike(safeItem);
  const sourceTotals = totalFromLike(source);
  const perUnitTotals = perUnitTotalsFromLike(safeItem, source);
  const calculatedTotals = totalsWithFallback(
    foodTotalsFromQuantity(safeItem, sourceTotals),
    foodTotalsFromQuantity({ ...safeItem, macroBasis: "perUnit" }, perUnitTotals)
  );
  return {
    id: String(safeItem.id || safeItem._id || safeItem.alimentoId || `${name}-${index}`),
    alimentoId: safeItem.alimentoId || safeItem.foodId || safeItem.id || null,
    name,
    amount,
    unidad,
    cantidad,
    totals: totalsWithFallback(itemTotals, calculatedTotals),
    category: safeItem.categoriaSnapshot || safeItem.categoria || safeItem.category || "",
    raw: safeItem,
  };
}

function perUnitTotalsFromLike(item = {}, source = {}) {
  return {
    kcal: macro(item.unidadCalorica ?? item.caloriaUnidad ?? item.kcalUnidad ?? source.unidadCalorica ?? source.caloriaUnidad ?? source.kcalUnidad),
    proteina: macro(item.unidadProteica ?? item.proteinaUnidad ?? item.proteinUnidad ?? source.unidadProteica ?? source.proteinaUnidad ?? source.proteinUnidad),
    carbs: macro(item.unidadCarbo ?? item.carboUnidad ?? item.carbsUnidad ?? source.unidadCarbo ?? source.carboUnidad ?? source.carbsUnidad),
    grasas: macro(item.unidadGrasas ?? item.grasasUnidad ?? item.fatUnidad ?? source.unidadGrasas ?? source.grasasUnidad ?? source.fatUnidad),
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
  const isPer100 = basis === "per100" || basis === "por100" || basis === "por_100" || unit === "g" || unit === "gr" || unit === "gramos";
  const multiplier = isPerUnit ? quantity : isPer100 ? quantity / 100 : quantity;
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

function mealIconType(meal = {}, index = 0) {
  const text = `${mealName(meal, index)} ${meal.tipoComida || meal.type || ""}`.toLowerCase();
  if (text.includes("desayuno")) return "breakfast";
  if (text.includes("almuerzo")) return "lunch";
  if (text.includes("merienda") || text.includes("snack")) return "snack";
  if (text.includes("cena")) return "dinner";
  return "meal";
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
  const value = macro(food[key] ?? (key === "proteina" ? food.protein : key === "grasas" ? food.fat : 0));
  const basis = food.macroBasis || food.raw?.macroBasis || "";
  const unit = String(food.unidad || food.unit || "g").toLowerCase();
  const isPer100 = basis === "per100" || (unit === "g" && basis !== "perUnit");
  return isPer100 ? value / 100 : value;
}

function normalizeGeneratedFood(food = {}) {
  return {
    id: String(food.foodId || food.id || food.name || food.nombre || Math.random()),
    name: food.name || food.nombre || "Alimento",
    quantity: macro(food.quantity ?? food.cantidad),
    unit: food.unit || food.unidad || "g",
    kcal: macro(food.kcal),
    proteina: macro(food.proteina ?? food.protein),
    carbs: macro(food.carbs),
    grasas: macro(food.grasas ?? food.fat),
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
  return {
    id: String(food.alimentoId || food.id || food.foodId || `food-${index + 1}`),
    name: food.name || food.nombre || food.nombreSnapshot || `Alimento ${index + 1}`,
    quantity: macro(food.cantidad ?? food.quantity),
    unit: food.unidad || food.unit || "g",
    kcal: totals.kcal,
    proteina: totals.proteina,
    carbs: totals.carbs,
    grasas: totals.grasas,
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
  const [weekStart, setWeekStart] = useState(() => mondayOfWeek());
  const [weekData, setWeekData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [mobileView, setMobileView] = useState("overview");
  const [mobileDetailChoiceKey, setMobileDetailChoiceKey] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [remainingDraft, setRemainingDraft] = useState(null);
  const [mealDrawer, setMealDrawer] = useState(null);
  const [foodDrawer, setFoodDrawer] = useState(null);
  const [menuOptionsDrawerOpen, setMenuOptionsDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const isMobileLayout = useIsMobileMenuLayout();

  async function loadWeek(start = weekStart) {
    setLoading(true);
    setError("");
    try {
      const data = await getMenuTrackingWeek(start);
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
      setError(err?.message || "No se pudo cargar tu menú.");
    } finally {
      setLoading(false);
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
      await loadWeek(weekStart);
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
    const ids = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String));
    if (ids.has(id)) ids.delete(id);
    else ids.add(id);
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

  function saveGeneratedRemaining(row, generatedMeals) {
    const current = Array.isArray(row?.tracking?.generatedRemainingMeals) ? row.tracking.generatedRemainingMeals : [];
    submitTracking(
      trackingPayloadBase(row, {
        generatedRemainingMeals: [...current, ...generatedMeals],
      }),
      "Comidas restantes guardadas."
    );
    setRemainingDraft(null);
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

        {loading ? <LoadingState /> : null}
        {error ? <ErrorState message={error} onRetry={() => loadWeek(weekStart)} /> : null}

        {!loading && !error && weekData ? (
          isMobileLayout ? (
            mobileView === "detail" ? (
              <MobileDayDetailView
                row={selectedRow}
                detailChoiceKey={mobileDetailChoiceKey}
                onBack={() => setMobileView("overview")}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onToggleMeal={toggleMenuMeal}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                onOpenMeal={(payload) => setMealDrawer(payload)}
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
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onOpenMenuOptions={() => setMenuOptionsDrawerOpen(true)}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                onToggleMeal={toggleMenuMeal}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                saving={saving}
              />
            )
          ) : (
            <>
              <TodayHero
                row={selectedRow}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onView={() => setDetailRow(selectedRow)}
                onToggleMeal={toggleMenuMeal}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
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
                    row={selectedRow}
                    onMarkMissed={markDayMissed}
                    onToggleMeal={toggleMenuMeal}
                    onOpenRemaining={() => setRemainingDraft(selectedRow)}
                    canMarkMeals={canMarkMeals}
                    canAutoCompleteRemaining={canAutoCompleteRemaining}
                    onUseAlternative={useAlternative}
                  />
                </div>
              </section>
            </>
          )
        ) : null}
      </div>

      {detailRow && !isMobileLayout ? (
        <DayDetailDrawer
          row={detailRow}
          onClose={() => setDetailRow(null)}
          onMarkMissed={markDayMissed}
          onToggleMeal={toggleMenuMeal}
          onOpenRemaining={() => setRemainingDraft(detailRow)}
          canMarkMeals={canMarkMeals}
          canAutoCompleteRemaining={canAutoCompleteRemaining}
          onUseAlternative={useAlternative}
        />
      ) : null}

      {remainingDraft ? (
        <RemainingMealsDrawer
          row={remainingDraft}
          saving={saving}
          onClose={() => setRemainingDraft(null)}
          onSave={(generatedMeals) => saveGeneratedRemaining(remainingDraft, generatedMeals)}
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
  onPrevious,
  onNext,
  onOpenMenuOptions,
  onOpenRemaining,
  onToggleMeal,
  onOpenMeal,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const choices = menuChoices(row);
  const primary = choices[0] || null;
  const activeChoice = trackingChoice(row) || primary;
  const activeMeals = activeChoice ? choiceMeals(activeChoice) : [];
  const completed = completedMealIdSet(row);
  const completedCount = activeMeals.filter((meal, index) => completed.has(mealId(meal, index))).length;
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const percent = completionPercent(row);
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

      <section className="mt-2 overflow-hidden rounded-[1.2rem] border border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(212,175,55,.14),transparent_30%),radial-gradient(circle_at_0_0,rgba(45,212,191,.09),transparent_36%),linear-gradient(145deg,#101923,#080d13)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.30)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black ${toneClass(activeMenuStatus.tone)}`}>
                <Target size={13} />
                {activeMenuStatus.label}
              </span>
              <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black ${toneClass(statusMeta(row).tone)}`}>
                {trackingLabel(row)}
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
          <MobileMetric label="Comidas" value={`${completedCount} / ${activeMeals.length || 0}`} detail="completadas" tone="gold" />
        </div>
      </section>

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
              {completedCount} / {activeMeals.length || 0} completas
            </span>
          </div>
          {activeMeals.length ? (
            activeMeals.map((meal, index) => {
              const displayMeal = mealWithTrackingReplacements(row, meal, index);
              return (
                <MobileMealCard
                  key={mealId(meal, index)}
                  row={row}
                  meal={displayMeal}
                  baseMeal={meal}
                  mealIndex={index}
                  done={completed.has(mealId(meal, index))}
                  saving={saving}
                  canMarkMeals={canMarkMeals}
                  onToggleMeal={onToggleMeal}
                  onOpenMeal={onOpenMeal}
                />
              );
            })
          ) : (
            <MobileEmptyCard
              title="Este menú no tiene comidas cargadas."
              text="Podés revisar otros días o avisarle a tu coach."
            />
          )}
        </section>
      ) : null}

      <div className="mt-4">
        <MobileCalculateButton onClick={onOpenRemaining} disabled={!canCalculateRemaining || saving} />
      </div>
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
  detailChoiceKey = "",
  onBack,
  onPrevious,
  onNext,
  onToggleMeal,
  onOpenRemaining,
  onOpenMeal,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const tracking = statusMeta(row);
  const choices = menuChoices(row);
  const detailChoice = choices.find((choice) => choice.key === detailChoiceKey) || choices[0] || null;
  const snapshot = detailChoice?.snapshot || null;
  const meals = detailChoice ? choiceMeals(detailChoice) : [];
  const detailStatus = detailChoice ? choiceStatus(row, detailChoice) : menuState(row);
  const target = targetTotals(row);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const percent = completionPercent(row);
  const completed = completedMealIdSet(row);
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
        ) : !meals.length ? (
          <MobileEmptyCard
            title="Este menú no tiene comidas cargadas."
            text="Podés revisar otros días o avisarle a tu coach."
          />
        ) : (
          meals.map((meal, index) => {
            const displayMeal = mealWithTrackingReplacements(row, meal, index);
            return (
              <MobileMealCard
                key={mealId(meal, index)}
                row={row}
                meal={displayMeal}
                baseMeal={meal}
                mealIndex={index}
                done={completed.has(mealId(meal, index))}
                saving={saving}
                canMarkMeals={canMarkMeals}
                onToggleMeal={onToggleMeal}
                onOpenMeal={onOpenMeal}
              />
            );
          })
        )}
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
  saving,
  canMarkMeals,
  onToggleMeal,
  onOpenMeal,
}) {
  const trackingMeal = baseMeal || meal;
  const foods = mealFoods(meal);
  const totals = mealTotals(meal);
  const previewFoods = foods.slice(0, 3);

  return (
    <article className={`relative overflow-hidden rounded-[1.05rem] border shadow-[0_12px_28px_rgba(0,0,0,.20)] ${
      done
        ? "border-emerald-300/45 bg-[radial-gradient(circle_at_12%_12%,rgba(16,185,129,.20),transparent_34%),radial-gradient(circle_at_100%_0,rgba(212,175,55,.16),transparent_30%),linear-gradient(135deg,#102321,#09131c)] shadow-[0_0_0_1px_rgba(16,185,129,.15),0_16px_34px_rgba(0,0,0,.32)]"
        : "border-white/10 bg-[linear-gradient(135deg,#101824,#090f17)]"
    }`}>
      {done ? (
        <span className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-gradient-to-b from-emerald-300 to-[#D4AF37]" aria-hidden="true" />
      ) : null}
      <div className="flex items-center gap-2.5 p-3">
        <button type="button" onClick={() => onOpenMeal({ row, meal, baseMeal: trackingMeal, mealIndex })} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <MealTypeIcon meal={meal} index={mealIndex} done={done} />
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="min-w-0 truncate text-[17px] font-black leading-tight text-white">{mealName(meal, mealIndex)}</span>
              <span className="shrink-0 text-xs font-black text-[#FFD76B]">{displayKcal(totals.kcal)}</span>
              {done ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-1.5 py-0.5 text-[9px] font-black text-emerald-100">
                  <CheckCircle2 size={10} />
                  Hecha
                </span>
              ) : null}
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] font-bold text-zinc-500">
              <span>P {formatNumber(totals.proteina, 0)} g</span>
              <span>C {formatNumber(totals.carbs, 0)} g</span>
              <span>G {formatNumber(totals.grasas, 0)} g</span>
            </span>
            <MobileFoodPreviewLine foods={previewFoods} />
          </span>
        </button>
        <button
          type="button"
          disabled={!canMarkMeals || saving}
          onClick={() => onToggleMeal(row, trackingMeal, mealIndex)}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border text-xs font-black disabled:opacity-50 ${
            done
              ? "border-emerald-300/55 bg-emerald-400 text-[#03140c] shadow-[0_0_0_4px_rgba(16,185,129,.12)]"
              : "border-white/20 bg-black/20 text-zinc-400"
          }`}
          aria-pressed={done}
          aria-label={done ? "Comida completa" : "Marcar comida completa"}
        >
          {done ? <CheckCircle2 size={21} /> : <Square size={20} />}
        </button>
        <button
          type="button"
          onClick={() => onOpenMeal({ row, meal, baseMeal: trackingMeal, mealIndex })}
          className="grid h-8 w-6 shrink-0 place-items-center text-zinc-500"
          aria-label="Ver detalle de comida"
        >
          <ChevronRight size={20} />
        </button>
      </div>

    </article>
  );
}

function MobileFoodPreviewLine({ foods = [] }) {
  if (!foods.length) {
    return <span className="mt-1 block truncate text-sm font-bold text-zinc-500">Sin alimentos cargados</span>;
  }
  return (
    <span className="mt-1.5 grid gap-0.5">
      {foods.map((food, index) => (
        <span key={`${food.id}-${index}`} className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-zinc-400">
          <span className="min-w-0 truncate">{food.name}</span>
          {food.amount ? <span className="shrink-0 text-[11px] font-black text-[#FFE8A3]/90">{food.amount}</span> : null}
        </span>
      ))}
    </span>
  );
}

function MealTypeIcon({ meal, index, done }) {
  const iconType = mealIconType(meal, index);
  const styleMap = {
    breakfast: "border-sky-300/15 bg-[linear-gradient(135deg,rgba(59,130,246,.20),rgba(212,175,55,.10))] text-[#FFD76B]",
    lunch: "border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#FFD76B]",
    snack: "border-rose-300/20 bg-rose-400/10 text-rose-300",
    dinner: "border-indigo-300/20 bg-indigo-400/10 text-indigo-200",
    meal: "border-[#D4AF37]/20 bg-[#D4AF37]/10 text-[#FFD76B]",
  };
  const icons = {
    breakfast: Sunrise,
    lunch: Sun,
    snack: Apple,
    dinner: Moon,
    meal: Utensils,
  };
  const Icon = icons[iconType] || Utensils;
  return (
    <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl border ${styleMap[iconType] || styleMap.meal} ${done ? "ring-1 ring-emerald-300/25" : ""}`}>
      <Icon size={23} />
    </span>
  );
}

function MobileFoodRow({ meal, mealIndex, food, foodIndex, onOpenFood, canReplaceFoods = true }) {
  const replaced = food.replacementMeta?.type === "food";
  const originalFood = mealFoods(meal)[foodIndex] || food;
  const macroDetail = foodMacroLine(food);
  return (
    <div className={`flex min-h-[76px] items-center justify-between gap-3 px-4 py-3.5 ${replaced ? "bg-emerald-300/[0.045]" : ""}`}>
      <div className="min-w-0">
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
  onPrevious,
  onNext,
  onView,
  onToggleMeal,
  onOpenRemaining,
  canMarkMeals,
  canAutoCompleteRemaining,
  saving,
}) {
  if (!row) return null;
  const state = menuState(row);
  const tracking = statusMeta(row);
  const choices = menuChoices(row);
  const primaryTotals = choiceTotals(choices[0]);
  const snapshot = choices[0]?.snapshot || null;
  const meals = snapshot ? snapshotMeals(snapshot) : [];
  const targetKcal = macro(row?.target?.kcal);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const menuKcal = primaryTotals.kcal;
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
              {snapshot ? displayMenuMacros(primaryTotals) : "Toca para ver el detalle cuando haya menú"}
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
          Consumido: {displayKcal(consumed.kcal)} / faltan {signed(remaining.kcal, " kcal")} / proteína {signed(remaining.proteina, " g")}
        </div>
      </div>

      {meals.length && canMarkMeals ? (
        <MealChecklist row={row} meals={meals} onToggleMeal={onToggleMeal} saving={saving} compact />
      ) : null}

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={onView} className="rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-3 text-xs font-black text-sky-100">
          Ver detalle
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

function MealChecklist({ row, meals, onToggleMeal, saving, compact = false }) {
  const completed = completedMealIdSet(row);
  return (
    <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
      {meals.map((meal, index) => {
        const id = mealId(meal, index);
        const done = completed.has(id);
        const totals = mealTotals(meal);
        return (
          <button
            key={id}
            type="button"
            disabled={saving}
            onClick={() => onToggleMeal(row, meal, index)}
            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition disabled:opacity-60 ${done ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/10 bg-black/20"}`}
          >
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${done ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-100" : "border-white/15 bg-white/[0.03] text-zinc-400"}`}>
              {done ? <CheckCircle2 size={18} /> : <ClipboardCheck size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-black text-white">{mealName(meal, index)}</span>
              <span className="block truncate text-xs font-bold text-zinc-400">
                {displayKcal(totals.kcal)} / {displayMenuMacros(totals)}
              </span>
            </span>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${done ? toneClass("green") : toneClass("slate")}`}>
              {done ? "Cumplida" : "Pendiente"}
            </span>
          </button>
        );
      })}
    </div>
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
  onClose,
  onMarkMissed,
  onToggleMeal,
  onOpenRemaining,
  canMarkMeals,
  canAutoCompleteRemaining,
  onUseAlternative,
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
            onMarkMissed={onMarkMissed}
            onToggleMeal={onToggleMeal}
            onOpenRemaining={onOpenRemaining}
            canMarkMeals={canMarkMeals}
            canAutoCompleteRemaining={canAutoCompleteRemaining}
            onUseAlternative={onUseAlternative}
          />
        </div>
      </div>
    </section>
  );
}

function DayDetail({
  row,
  onMarkMissed,
  onToggleMeal,
  onOpenRemaining,
  canMarkMeals,
  canAutoCompleteRemaining,
  onUseAlternative,
}) {
  if (!row) return null;
  const snapshot = menuSnapshot(row);
  const meals = snapshot ? snapshotMeals(snapshot) : [];
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

      {meals.length && canMarkMeals ? (
        <MealChecklist row={row} meals={meals} onToggleMeal={onToggleMeal} />
      ) : null}

      <GeneratedMealsBlock meals={(row?.tracking?.generatedRemainingMeals || []).filter((entry) => !String(entry?.source || "").includes("replacement"))} />

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
        Si tenés coach, va a aparecer cuando te asigne un menú. Si estás autogestionado, podés seguir usando el tracking detallado.
      </p>
      <a href="/app/tracking" className="mt-4 inline-flex rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-4 py-2 text-sm font-black text-[#FFE8A3]">
        Ir al tracking detallado
      </a>
    </div>
  );
}

function GeneratedMealsBlock({ meals = [] }) {
  if (!meals.length) return null;
  return (
    <section className="grid gap-3 rounded-3xl border border-emerald-400/20 bg-emerald-400/10 p-4">
      <div>
        <span className="text-xs font-black uppercase tracking-wide text-emerald-100">Tracking agregado</span>
        <h4 className="mt-1 text-lg font-black text-white">Comidas calculadas para completar</h4>
      </div>
      {meals.map((meal, index) => {
        const totals = totalFromLike(meal.totals || meal);
        const foods = Array.isArray(meal.foods) ? meal.foods : [];
        return (
          <article key={meal.id || index} className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate text-sm text-white">{meal.name || `Comida ${index + 1}`}</strong>
                <p className="text-xs font-bold text-zinc-300">{displayKcal(totals.kcal)} / {displayMenuMacros(totals)}</p>
              </div>
              <span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-black text-emerald-100">
                Auto
              </span>
            </div>
            {foods.length ? (
              <div className="mt-2 grid gap-1.5">
                {foods.map((food, foodIndex) => (
                  <div key={food.id || foodIndex} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.04] px-2.5 py-2 text-xs font-bold">
                    <span className="min-w-0 truncate text-zinc-100">{food.name}</span>
                    <span className="shrink-0 text-[#FFE8A3]">{formatNumber(food.quantity, 1)} {food.unit || "g"}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
    </section>
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
  saving,
}) {
  const row = useMemo(() => context?.row || {}, [context?.row]);
  const meal = context?.meal || {};
  const baseMeal = context?.baseMeal || meal;
  const mealIndex = context?.mealIndex || 0;
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
                    canReplaceFoods={canReplaceFoods}
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
