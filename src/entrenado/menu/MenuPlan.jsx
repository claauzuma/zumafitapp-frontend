import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Apple,
  Calculator,
  CalendarDays,
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
  Minus,
  MoreHorizontal,
  MoonStar,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
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
import {
  assignmentFlexibleCalories,
  assignmentMacroPending,
  getMenuDayCompatibility,
} from "../../menus/menuAssignmentCompatibility.js";
import {
  FLEXIBLE_MARGIN_LABEL,
  FLEXIBLE_MARGIN_SLOT_TYPE,
  FLEXIBLE_MARGIN_SOURCE,
  flexibleMarginEntries,
  flexibleMarginMacroRemaining,
  flexibleMarginRemaining,
  flexibleMarginTotals,
  isFlexibleMarginCompleted,
  replaceFlexibleMarginEntries,
} from "../../menus/flexibleMarginTracking.js";
import { generateMealQuantities, listAlimentos } from "../../nutricion/nutricionApi.js";
import { buildMenuItemSnapshot, getFoodImageUrl, placeholderForFoodCategory } from "../../nutricion/nutricionUtils.js";
import { getClientMenu, updateClientMenu } from "../../clientMenus/clientMenusApi.js";
import { createNavigationPrefetchHandlers } from "../../routes/routePrefetch.js";
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

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateKeyFromSearch(search = "") {
  try {
    const value = new URLSearchParams(search).get("date") || "";
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  } catch {
    return "";
  }
}

function canUseFlexibleMarginCalculation(permissions = {}) {
  // Strict capability: canAutoCompleteRemainingMeals is a different flow and must not unlock flexible-margin quantities.
  return permissions?.canUseFlexibleMarginRecommendations === true;
}

function canUseRemainingMealCalculation(permissions = {}) {
  // Strict capability: missing data must not unlock automatic remaining-meal generation.
  return permissions?.canAutoCompleteRemainingMeals === true;
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

const FLEXIBLE_MARGIN_COMPLETE_TOLERANCE_KCAL = 50;
const FLEXIBLE_MARGIN_AUTO_COMPLETE_TOLERANCE_KCAL = 40;

function flexibleMarginCompletionState(plan = {}, rowOrEntries = {}) {
  const target = macro(plan?.flexibleCalories);
  const totals = flexibleMarginTotals(rowOrEntries);
  const remaining = target - totals.kcal;
  const missing = Math.max(0, remaining);
  const over = Math.max(0, -remaining);
  const hasEntries = totals.kcal > 0.5;
  const isOver = remaining < -0.5;
  const canComplete =
    target > 0 &&
    hasEntries &&
    !isOver &&
    missing <= FLEXIBLE_MARGIN_COMPLETE_TOLERANCE_KCAL;
  const autoComplete =
    canComplete &&
    missing <= FLEXIBLE_MARGIN_AUTO_COMPLETE_TOLERANCE_KCAL;
  return {
    target,
    totals,
    remaining,
    missing,
    over,
    hasEntries,
    isOver,
    canComplete,
    autoComplete,
    kcalToComplete: Math.max(0, missing - FLEXIBLE_MARGIN_COMPLETE_TOLERANCE_KCAL),
  };
}

function flexibleMarginCompletionBlockMessage(state = {}) {
  if (!state.hasEntries) return "Agrega al menos un alimento para marcar el margen como hecho.";
  if (state.isOver) return `Te pasaste por ${displayKcal(state.over)}. Baja la cantidad para marcarlo como hecho.`;
  return `Para marcarlo como hecho te tienen que quedar ${displayKcal(FLEXIBLE_MARGIN_COMPLETE_TOLERANCE_KCAL)} o menos. Todavia faltan ${displayKcal(state.kcalToComplete)}.`;
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
  const hasTarget = hasConfiguredTarget(row);
  if (!hasTarget) return { label: "Meta pendiente", tone: "amber" };
  const compatibility = getMenuDayCompatibility(choiceTotals(menuChoices(row)[0]), targetTotals(row));
  if (compatibility.flexibleCalories > 0 && compatibility.canAssign) return { label: "Margen flexible", tone: "green" };
  if (compatibility.key === "compatible") return { label: "Cerca de la meta", tone: "green" };
  if (compatibility.key === "surplus_blocked") return { label: "Excede kcal", tone: "red" };
  if (compatibility.key === "deficit_excessive") return { label: "Bajo en kcal", tone: "amber" };
  if (compatibility.proteinLow) return { label: "Proteina baja", tone: "amber" };
  if (compatibility.key === "surplus_warning") return { label: "Exceso leve", tone: "amber" };
  return { label: compatibility.canAssign ? "Compatible" : "Revisar", tone: compatibility.canAssign ? "green" : "amber" };
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
      assignment: primary,
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
      assignment: alternative,
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
  if (!hasTotalValue(target)) return { label: "Meta pendiente", tone: "amber" };
  const compatibility = getMenuDayCompatibility(totals, target);
  if (compatibility.flexibleCalories > 0 && compatibility.canAssign) return { label: "Margen flexible", tone: "green" };
  if (compatibility.key === "compatible") return { label: "Cerca de la meta", tone: "green" };
  if (compatibility.key === "surplus_blocked") return { label: "Excede kcal", tone: "red" };
  if (compatibility.key === "deficit_excessive") return { label: "Bajo en kcal", tone: "amber" };
  if (compatibility.proteinLow) return { label: "Proteina baja", tone: "amber" };
  if (compatibility.key === "surplus_warning") return { label: "Exceso leve", tone: "amber" };
  return { label: compatibility.canAssign ? "Compatible" : "Revisar", tone: compatibility.canAssign ? "green" : "amber" };
}

function flexiblePlanForChoice(row = {}, choice = {}, activePlanSource = "none") {
  if (menuSourceMeta(activePlanSource).key !== "coach" || !choice?.snapshot) return null;
  const totals = choiceTotals(choice);
  const target = targetTotals(row);
  const assignment = choice.assignment || row?.assignment?.primaryMenu || {};
  const flexibleCalories = assignmentFlexibleCalories(assignment, target, totals);
  if (flexibleCalories <= 0) return null;
  return {
    flexibleCalories,
    target,
    planned: totals,
    macroPending: assignmentMacroPending(assignment, target, totals),
  };
}

function menuCountTitle(row) {
  const choices = menuChoices(row);
  if (!choices.length) return "Sin menu asignado";
  if (choices.length === 1) return choices[0].snapshot?.name || "Menu asignado";
  return `Total menus (${choices.length})`;
}

function menuSourceMeta(source = "") {
  const key = String(source || "none").toLowerCase();
  if (key === "own") {
    return {
      key,
      label: "Mi menu",
      descriptor: "Planificacion propia",
      pillClass: "border-[#D4AF37]/35 bg-[#D4AF37]/12 text-[#FFE8A3]",
    };
  }
  if (key === "coach") {
    return {
      key,
      label: "Coach",
      descriptor: "Plan asignado",
      pillClass: "border-sky-300/30 bg-sky-300/10 text-sky-100",
    };
  }
  return {
    key: "none",
    label: "Menu",
    descriptor: "Planificacion",
    pillClass: "border-white/10 bg-white/[0.055] text-zinc-300",
  };
}

function normalizeMenuNameText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isGenericMenuName(value = "") {
  const normalized = normalizeMenuNameText(value);
  return !normalized || ["mi menu", "menu", "menu principal", "menu asignado", "sin nombre"].includes(normalized);
}

function activeMenuIdFrom(row = {}, activePlan = {}) {
  const primary = row?.assignment?.primaryMenu || {};
  const snapshot = primary.menuSnapshot || {};
  return String(
    activePlan?.menuId ||
      primary.menuId ||
      snapshot.baseId ||
      snapshot.id ||
      snapshot._id ||
      ""
  );
}

function activeMenuDisplayName(choice = {}, activePlan = {}, source = "none") {
  const snapshot = choice?.snapshot || {};
  const raw =
    activePlan?.name ||
    activePlan?.nombre ||
    snapshot.name ||
    snapshot.nombre ||
    choiceDisplayName(choice);
  if (!isGenericMenuName(raw)) return raw;
  return menuSourceMeta(source).key === "coach" ? "Menu asignado" : "Mi menu diario";
}

function activeMenuSummary(choice = {}, source = "none") {
  const parts = activeMenuSummaryParts(choice, source);
  return `${parts.primary} - ${parts.secondary}`;
}

function activeMenuSummaryParts(choice = {}, source = "none") {
  const totals = choiceTotals(choice);
  const meals = choiceMeals(choice);
  const sourceKey = menuSourceMeta(source).key;
  const dayLabel = sourceKey === "own" ? "Dia base" : sourceKey === "coach" ? "Asignado" : "Dia";
  const contentCount = meals.filter(mealHasContent).length;
  const blocksLabel = `${meals.length || 0} bloque${meals.length === 1 ? "" : "s"}`;
  const mealsLabel = contentCount
    ? `${contentCount}/${meals.length || contentCount} con alimentos`
    : meals.length
      ? `${blocksLabel} - sin alimentos`
      : "sin comidas cargadas";
  return {
    primary: hasTotalValue(totals) ? `${dayLabel} - ${displayKcal(totals.kcal)}` : `${dayLabel} - menu vacio`,
    secondary: mealsLabel,
  };
}

function completedMealsLabel(completed = 0, total = 0) {
  const completedNumber = Number(completed) || 0;
  const totalNumber = Number(total) || 0;
  const noun = totalNumber === 1 ? "completada" : "completadas";
  return `${completedNumber} / ${totalNumber} ${noun}`;
}

function emptyMenuCopy(source = "none") {
  const key = menuSourceMeta(source).key;
  if (key === "coach") {
    return {
      title: "Todavia no tenes menu para este dia.",
      text: "Cuando tu coach lo asigne, lo vas a ver aca.",
      emptyMealsText: "Podés revisar otros dias o avisarle a tu coach.",
    };
  }
  if (key === "own") {
    return {
      title: "Todavia no tenes menu propio para este dia.",
      text: "Edita o activa tu menu propio para verlo aca con comidas y cantidades.",
      emptyMealsText: "Edita tu menu propio para agregar comidas y alimentos.",
    };
  }
  return {
    title: "Todavia no tenes menu para este dia.",
    text: "Crea tu propio menu, explora la biblioteca ZumaFit o registra libremente en Tracking.",
    emptyMealsText: "Crea tu menu o usa Tracking mientras lo armas.",
  };
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
  const proteina = macro(row?.target?.p ?? row?.target?.proteina);
  const carbs = macro(row?.target?.c ?? row?.target?.carbs);
  const grasas = macro(row?.target?.g ?? row?.target?.grasas);
  const explicitKcal = macro(row?.target?.kcal);
  const derivedKcal = hasTotalValue({ proteina, carbs, grasas }) ? (proteina * 4) + (carbs * 4) + (grasas * 9) : 0;
  return {
    kcal: explicitKcal || derivedKcal,
    proteina,
    carbs,
    grasas,
  };
}

function hasConfiguredTarget(row = {}) {
  return hasTotalValue(targetTotals(row));
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

function mealHasContent(meal = {}) {
  return mealFoods(meal).length > 0 || hasTotalValue(mealTotals(meal));
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
  return pieces.join(" - ");
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

function defaultQuickFoodQuantity(unit = "") {
  const normalized = String(unit || "").toLowerCase();
  return ["unidad", "u", "porcion"].some((part) => normalized.includes(part)) ? 1 : 100;
}

function foodDisplayName(food = {}) {
  return food.nombre || food.name || food.Alimentos || food.alimentos || "Alimento";
}

function foodDisplayUnit(food = {}) {
  return food.unidad || food.unit || food.Unidad || food.unidadBase || "g";
}

function suggestedQuickFoodQuantity(food = {}) {
  const raw = food.porcionSugerida ?? food.raw?.porcionSugerida ?? food.cantidadSugerida ?? food.raw?.cantidadSugerida;
  const parsed = Number(raw);
  if (Number.isFinite(parsed) && parsed > 0) return parsed;
  return defaultQuickFoodQuantity(foodDisplayUnit(food));
}

function normalizeFoodSearchResults(payload) {
  if (Array.isArray(payload)) return payload.filter(Boolean);
  if (Array.isArray(payload?.alimentos)) return payload.alimentos.filter(Boolean);
  if (Array.isArray(payload?.items)) return payload.items.filter(Boolean);
  if (Array.isArray(payload?.data)) return payload.data.filter(Boolean);
  if (Array.isArray(payload?.rows)) return payload.rows.filter(Boolean);
  if (Array.isArray(payload?.results)) return payload.results.filter(Boolean);
  if (Array.isArray(payload?.all)) return payload.all.filter(Boolean);
  return [];
}

function normalizeQuickMenuItem(item = {}, index = 0) {
  const normalized = normalizeMealFood(item, index);
  const totals = totalFromLike(item?.totals || item?.totales || item);
  const fallbackTotals = normalized.totals || emptyTotals();
  return {
    ...item,
    id: item.id || uid("item"),
    alimentoId: item.alimentoId || item.foodId || normalized.alimentoId || normalized.id || null,
    nombreSnapshot: item.nombreSnapshot || item.nombre || item.name || normalized.name,
    nombre: item.nombre || item.nombreSnapshot || item.name || normalized.name,
    cantidad: quantityFromMenuFood(item) || quantityFromMenuFood(normalized),
    unidad: unitFromMenuFood(item) || unitFromMenuFood(normalized),
    kcal: macro(item.kcal ?? item.calorias ?? totals.kcal ?? fallbackTotals.kcal),
    proteina: macro(item.proteina ?? item.proteinas ?? item.protein ?? totals.proteina ?? fallbackTotals.proteina),
    carbs: macro(item.carbs ?? item.carbohidratos ?? item.carbohydrates ?? totals.carbs ?? fallbackTotals.carbs),
    grasas: macro(item.grasas ?? item.grasa ?? item.fat ?? totals.grasas ?? fallbackTotals.grasas),
    fibra: macro(item.fibra ?? item.fiber),
    categoriaSnapshot: item.categoriaSnapshot || item.categoria || item.category || normalized.category || "",
    imagen: item.imagen || normalized.imagen || null,
    imagenUrl: item.imagenUrl || item.imageUrl || normalized.imageUrl || "",
    imagenAlt: item.imagenAlt || item.imageAlt || normalized.imageAlt || normalized.name,
  };
}

function normalizeQuickMeal(meal = {}, index = 0) {
  const items = Array.isArray(meal.items)
    ? meal.items
    : Array.isArray(meal.alimentos)
      ? meal.alimentos
      : Array.isArray(meal.foods)
        ? meal.foods
        : [];
  return {
    ...meal,
    id: meal.id || meal._id || uid("meal"),
    nombre: meal.nombre || meal.name || mealName(meal, index),
    tipoComida: meal.tipoComida || meal.type || savedMealTipoFromMenuMeal(meal, index),
    orden: Number(meal.orden ?? meal.order ?? index + 1) || index + 1,
    items: items.map(normalizeQuickMenuItem),
  };
}

function normalizeClientMenuForQuickEdit(menu = {}, fallbackChoice = {}, activePlan = {}) {
  const dayKeys = Object.keys(menu?.dias || {}).filter(Boolean);
  const fallbackMeals = choiceMeals(fallbackChoice);
  const sourceMeals = Array.isArray(menu?.comidas) && menu.comidas.length
    ? menu.comidas
    : dayKeys.length
      ? menu.dias[dayKeys[0]]?.comidas || []
      : fallbackMeals;
  const selectedDays =
    (Array.isArray(menu.selectedDays) && menu.selectedDays.length ? menu.selectedDays : null) ||
    (Array.isArray(menu.diasActivos) && menu.diasActivos.length ? menu.diasActivos : null) ||
    (dayKeys.length ? dayKeys : null) ||
    ["monday"];

  return {
    id: menu.id || menu._id || activePlan?.menuId || fallbackChoice?.key || "",
    nombre: menu.nombre || menu.name || activePlan?.nombre || activePlan?.name || fallbackChoice?.snapshot?.name || "Mi menu",
    descripcion: menu.descripcion || menu.description || "",
    selectedDays: selectedDays.slice(0, 7),
    comidas: (Array.isArray(sourceMeals) ? sourceMeals : []).map(normalizeQuickMeal),
  };
}

function findQuickMealIndex(draft = {}, baseMeal = {}, fallbackIndex = 0) {
  const wanted = mealId(baseMeal, fallbackIndex);
  const exact = (draft.comidas || []).findIndex((meal, index) =>
    mealId(meal, index) === wanted ||
    String(meal.id || "") === String(baseMeal.id || baseMeal._id || "")
  );
  if (exact >= 0) return exact;
  return (draft.comidas || [])[fallbackIndex] ? fallbackIndex : 0;
}

function quickMenuPayload(draft = {}, nextComidas = []) {
  return {
    nombre: draft.nombre || "Mi menu",
    descripcion: draft.descripcion || "",
    selectedDays: Array.isArray(draft.selectedDays) && draft.selectedDays.length ? draft.selectedDays : ["monday"],
    comidas: nextComidas.map((meal, index) => ({
      id: meal.id || uid("meal"),
      nombre: meal.nombre || mealName(meal, index),
      tipoComida: meal.tipoComida || "otra",
      orden: Number(meal.orden ?? index + 1) || index + 1,
      items: (meal.items || []).map(normalizeQuickMenuItem),
    })),
    activate: true,
  };
}

function buildQuickMenuItemFromFood(food = {}, quantity = 100, unit = "g") {
  return {
    ...buildMenuItemSnapshot(food, quantity, unit),
    id: uid("item"),
  };
}

function rescaleQuickMenuItem(item = {}, nextCantidad = item.cantidad) {
  const currentQty = Math.max(Number(item.cantidad) || 0, 0.0001);
  const nextQty = Math.max(Number(nextCantidad) || 0, 0);
  const factor = nextQty / currentQty;
  return {
    ...item,
    cantidad: nextQty,
    kcal: Math.round(macro(item.kcal) * factor * 10) / 10,
    proteina: Math.round(macro(item.proteina ?? item.proteinas) * factor * 10) / 10,
    carbs: Math.round(macro(item.carbs ?? item.carbohidratos) * factor * 10) / 10,
    grasas: Math.round(macro(item.grasas ?? item.fat) * factor * 10) / 10,
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
    flexibleMarginCompleted: isFlexibleMarginCompleted(row),
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

function roundMacro(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(macro(value) * factor) / factor;
}

function flexibleChoiceAssignment(row = {}, choice = {}) {
  return choice?.assignment || row?.assignment?.primaryMenu || {};
}

function flexibleChoiceMenuId(row = {}, choice = {}) {
  const assignment = flexibleChoiceAssignment(row, choice);
  const snapshot = choice?.snapshot || assignment?.menuSnapshot || {};
  return String(
    assignment.menuId ||
      assignment.menu_id ||
      snapshot.baseId ||
      snapshot.id ||
      snapshot._id ||
      choice?.key ||
      ""
  );
}

function flexibleAssignmentId(row = {}, choice = {}) {
  const assignment = flexibleChoiceAssignment(row, choice);
  return String(
    assignment.assignmentId ||
      assignment.assignment_id ||
      assignment.id ||
      assignment._id ||
      row?.assignment?.id ||
      row?.assignment?._id ||
      ""
  );
}

function flexibleMarginEntryFood(entry = {}) {
  const foods = Array.isArray(entry.foods) ? entry.foods : Array.isArray(entry.items) ? entry.items : [];
  return foods[0] || entry;
}

function flexiblePerUnitFromFood(food = {}) {
  const explicit = {
    kcal: macro(food.kcalPerUnitOrGram ?? food.kcalPerUnit ?? food.caloriesPerUnit ?? food.raw?.kcalPerUnitOrGram),
    proteina: macro(food.proteinPerUnitOrGram ?? food.proteinaPerUnitOrGram ?? food.proteinPerUnit ?? food.raw?.proteinPerUnitOrGram),
    carbs: macro(food.carbsPerUnitOrGram ?? food.carbsPerUnit ?? food.raw?.carbsPerUnitOrGram),
    grasas: macro(food.fatPerUnitOrGram ?? food.grasasPerUnitOrGram ?? food.fatPerUnit ?? food.raw?.fatPerUnitOrGram),
  };
  if (hasTotalValue(explicit)) return explicit;

  const sourceQuantity = macro(food.quantity ?? food.cantidad ?? food.gramos ?? food.grams);
  const directTotals = totalFromLike(food.totals || food);
  const source = String(food.source || "").toLowerCase();
  const isGeneratedOrFlexible = food.flexibleMargin === true ||
    food.fixedQuantity !== undefined ||
    ["fixed", "manual_fixed", "auto_calculated", FLEXIBLE_MARGIN_SOURCE].includes(source);
  if (sourceQuantity > 0 && hasTotalValue(directTotals) && isGeneratedOrFlexible) {
    return {
      kcal: directTotals.kcal / sourceQuantity,
      proteina: directTotals.proteina / sourceQuantity,
      carbs: directTotals.carbs / sourceQuantity,
      grasas: directTotals.grasas / sourceQuantity,
    };
  }

  return {
    kcal: foodPerUnit(food, "kcal"),
    proteina: foodPerUnit(food, "proteina"),
    carbs: foodPerUnit(food, "carbs"),
    grasas: foodPerUnit(food, "grasas"),
  };
}

function flexibleTotalsFromFood(food = {}, quantity = 0) {
  const amount = macro(quantity);
  const perUnit = flexiblePerUnitFromFood(food, amount);
  return {
    perUnit,
    totals: {
      kcal: roundMacro(perUnit.kcal * amount, 1),
      proteina: roundMacro(perUnit.proteina * amount, 1),
      carbs: roundMacro(perUnit.carbs * amount, 1),
      grasas: roundMacro(perUnit.grasas * amount, 1),
    },
  };
}

function flexibleMarginEntryFromFood(row = {}, plan = {}, food = {}, quantityValue, unitValue, choice = {}, options = {}) {
  const quantity = Math.max(0, roundMacro(quantityValue ?? food.quantity ?? food.cantidad ?? suggestedQuickFoodQuantity(food), 2));
  const unit = unitValue || food.unit || food.unidad || foodDisplayUnit(food);
  const name = food.name || food.nombre || food.nombreSnapshot || food.foodName || "Alimento";
  const foodId = String(food.foodId || food.alimentoId || food.id || food._id || name);
  const { perUnit, totals } = flexibleTotalsFromFood(food, quantity);
  const now = new Date().toISOString();
  const item = {
    id: foodId,
    alimentoId: foodId,
    foodId,
    name,
    nombre: name,
    quantity,
    cantidad: quantity,
    unit,
    unidad: unit,
    amount: foodAmount(quantity, unit),
    kcal: totals.kcal,
    proteina: totals.proteina,
    protein: totals.proteina,
    carbs: totals.carbs,
    grasas: totals.grasas,
    fat: totals.grasas,
    totals,
    kcalPerUnitOrGram: perUnit.kcal,
    proteinPerUnitOrGram: perUnit.proteina,
    carbsPerUnitOrGram: perUnit.carbs,
    fatPerUnitOrGram: perUnit.grasas,
    category: food.category || food.categoria || food.categoriaSnapshot || "",
    imagen: food.imagen || null,
    imageUrl: food.imagenUrl || food.imageUrl || getFoodImageUrl(food),
    source: options.itemSource || food.source || "manual",
    flexibleMargin: true,
  };
  return {
    id: options.id || `flexible-margin-${row?.date || "day"}-${trackingIdPart(foodId || name)}-${Date.now()}`,
    date: row?.date || "",
    dayKey: row?.dayKey || "",
    source: FLEXIBLE_MARGIN_SOURCE,
    mode: options.mode || "manual",
    scope: "day",
    activeFromDate: row?.date || "",
    activeUntilDate: row?.date || "",
    mealSlotType: FLEXIBLE_MARGIN_SLOT_TYPE,
    label: FLEXIBLE_MARGIN_LABEL,
    name,
    foodId,
    foodName: name,
    assignmentId: flexibleAssignmentId(row, choice),
    menuId: flexibleChoiceMenuId(row, choice),
    targetCalories: plan?.target?.kcal || 0,
    plannedCalories: plan?.planned?.kcal || 0,
    flexibleCalories: plan?.flexibleCalories || 0,
    macroPending: plan?.macroPending || {},
    quantity,
    cantidad: quantity,
    unit,
    unidad: unit,
    kcal: totals.kcal,
    proteina: totals.proteina,
    protein: totals.proteina,
    carbs: totals.carbs,
    grasas: totals.grasas,
    fat: totals.grasas,
    totals,
    foods: [item],
    items: [item],
    countsAsMenuMeal: false,
    createdAt: options.createdAt || now,
    updatedAt: now,
  };
}

function rescaleFlexibleMarginEntry(entry = {}, row = {}, plan = {}, quantityValue, unitValue, choice = {}) {
  const food = flexibleMarginEntryFood(entry);
  return flexibleMarginEntryFromFood(
    row,
    plan,
    { ...food, flexibleMargin: true, source: FLEXIBLE_MARGIN_SOURCE },
    quantityValue,
    unitValue || food.unit || food.unidad || entry.unit || entry.unidad,
    choice,
    { id: entry.id, createdAt: entry.createdAt, mode: entry.mode || "manual", itemSource: food.source || "manual" }
  );
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
  const navigate = useNavigate();
  const location = useLocation();
  const requestedDate = useMemo(() => dateKeyFromSearch(location.search), [location.search]);
  const initialSelectedDate = requestedDate || todayIso();
  const initialWeek = useMemo(() => {
    const start = mondayOfWeek(initialSelectedDate);
    return { start, data: getCachedMenuWeek(start) };
  }, [initialSelectedDate]);
  const [weekStart, setWeekStart] = useState(initialWeek.start);
  const [weekData, setWeekData] = useState(initialWeek.data);
  const [loading, setLoading] = useState(() => !initialWeek.data);
  const [error, setError] = useState("");
  const [selectedDate, setSelectedDate] = useState(initialSelectedDate);
  const [mobileView, setMobileView] = useState("overview");
  const [mobileDetailChoiceKey, setMobileDetailChoiceKey] = useState("");
  const [detailRow, setDetailRow] = useState(null);
  const [remainingDraft, setRemainingDraft] = useState(null);
  const [flexibleMarginEditor, setFlexibleMarginEditor] = useState(null);
  const [mealDrawer, setMealDrawer] = useState(null);
  const [foodDrawer, setFoodDrawer] = useState(null);
  const [quickMealEditor, setQuickMealEditor] = useState(null);
  const [menuOptionsDrawerOpen, setMenuOptionsDrawerOpen] = useState(false);
  const [trackingOnlyConfirmOpen, setTrackingOnlyConfirmOpen] = useState(false);
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

  useEffect(() => {
    if (!requestedDate) return;
    const nextWeek = mondayOfWeek(requestedDate);
    if (nextWeek !== weekStart) setWeekStart(nextWeek);
    if (selectedDate !== requestedDate) setSelectedDate(requestedDate);
    setMobileView("overview");
  }, [requestedDate, selectedDate, weekStart]);

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
  const activePlan = weekData?.activePlan || {};
  const activePlanSource = activePlan?.source || "none";
  const canQuickEditActiveMenu = menuSourceMeta(activePlanSource).key === "own";
  const canMarkMeals = permissions.canMarkMenuMealsCompleted !== false;
  const canAutoCompleteRemaining = canUseRemainingMealCalculation(permissions);
  const canUseMenuAlternatives = permissions.canUseMenuAlternatives !== false;
  const canTrackFoods = permissions.canTrackFoods !== false;
  const canUseFlexibleRecommendations = canUseFlexibleMarginCalculation(permissions);

  function openActiveMenuEditor(row = selectedRow, options = {}) {
    if (menuSourceMeta(activePlanSource).key !== "own") return;
    const id = activeMenuIdFrom(row, activePlan);
    if (!id) {
      setToast("No pudimos abrir el editor de este menu.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    navigate("/app/menu/nuevo", {
      state: {
        from: "/app/menu",
        editMenuId: id,
        editToken: `${id}-${Date.now()}`,
        focus: options.focus || "",
      },
    });
  }

  async function renameActiveMenuFromOptions(nextName) {
    if (saving || menuSourceMeta(activePlanSource).key !== "own") return;
    const cleanName = String(nextName || "").trim();
    if (!cleanName) {
      setToast("Escribi un nombre para el menu.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    const menuId = activeMenuIdFrom(selectedRow, activePlan);
    if (!menuId) {
      setToast("No pudimos identificar tu menu activo.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    setSaving(true);
    try {
      const menu = await getClientMenu(menuId);
      const draft = normalizeClientMenuForQuickEdit(menu || {}, trackingChoice(selectedRow), activePlan);
      const payload = {
        ...quickMenuPayload({ ...draft, nombre: cleanName }, draft.comidas || []),
        nombre: cleanName,
        name: cleanName,
        activate: true,
      };
      await updateClientMenu(menuId, payload);
      await loadWeek(weekStart, { silent: true });
      setMenuOptionsDrawerOpen(false);
      setToast("Nombre del menu actualizado.");
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo renombrar el menu.");
      window.setTimeout(() => setToast(""), 2600);
    } finally {
      setSaving(false);
    }
  }

  function requestDeactivateOwnMenuFromDay() {
    if (saving || menuSourceMeta(activePlanSource).key !== "own") return;
    setTrackingOnlyConfirmOpen(true);
  }

  async function deactivateOwnMenuFromDay() {
    if (saving) return;
    setSaving(true);
    try {
      await apiFetch("/api/clientes/me/menus/deactivate", {
        method: "POST",
        timeoutMs: 12000,
      });
      await loadWeek(weekStart, { silent: true });
      setMenuOptionsDrawerOpen(false);
      setTrackingOnlyConfirmOpen(false);
      setToast("Menu desactivado.");
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo desactivar el menu.");
      window.setTimeout(() => setToast(""), 2600);
    } finally {
      setSaving(false);
    }
  }

  async function openQuickMealEditor(context = {}) {
    if (!canQuickEditActiveMenu || saving) return;
    const row = context.row || selectedRow;
    const baseMeal = context.baseMeal || context.meal || {};
    const mealIndex = Number(context.mealIndex) || 0;
    const menuId = activeMenuIdFrom(row, activePlan);
    if (!menuId) {
      setToast("No pudimos identificar tu menu activo.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }

    const loadingContext = {
      loading: true,
      menuId,
      row,
      baseMeal,
      mealIndex,
      title: mealName(baseMeal, mealIndex),
    };
    setQuickMealEditor(loadingContext);

    try {
      const menu = await getClientMenu(menuId);
      const choice = trackingChoice(row);
      const draft = normalizeClientMenuForQuickEdit(menu || {}, choice, activePlan);
      const resolvedMealIndex = findQuickMealIndex(draft, baseMeal, mealIndex);
      const mealDraft = draft.comidas[resolvedMealIndex] || normalizeQuickMeal(baseMeal, mealIndex);
      setQuickMealEditor({
        ...loadingContext,
        loading: false,
        draft,
        mealDraft,
        mealIndex: resolvedMealIndex,
        token: `${menuId}-${resolvedMealIndex}-${Date.now()}`,
      });
    } catch (err) {
      setQuickMealEditor({
        ...loadingContext,
        loading: false,
        error: err?.message || "No pudimos abrir la edicion rapida.",
      });
    }
  }

  async function saveQuickMealChanges(nextMeal) {
    if (!quickMealEditor?.menuId || !quickMealEditor?.draft || saving) return;
    const draft = quickMealEditor.draft;
    const mealIndex = quickMealEditor.mealIndex;
    const nextComidas = (draft.comidas || []).map((meal, index) =>
      index === mealIndex
        ? normalizeQuickMeal({ ...meal, ...nextMeal, items: nextMeal.items || [] }, index)
        : normalizeQuickMeal(meal, index)
    );
    const payload = quickMenuPayload(draft, nextComidas);
    setSaving(true);
    try {
      await updateClientMenu(quickMealEditor.menuId, payload);
      await loadWeek(weekStart, { silent: true });
      setQuickMealEditor(null);
      setToast("Alimentos del menu actualizados.");
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudieron guardar los cambios.");
      window.setTimeout(() => setToast(""), 2600);
    } finally {
      setSaving(false);
    }
  }

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

  function openFlexibleMargin(row, mode = "manual") {
    const baseRow = row?.date ? (days.find((day) => day.date === row.date) || row) : selectedRow;
    const displayRow = rowWithActiveGeneratedMeals(baseRow, days);
    const choice = trackingChoice(displayRow);
    const plan = flexiblePlanForChoice(displayRow, choice, activePlanSource);
    if (!plan) {
      setToast("Este dia no tiene margen flexible.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    if (mode === "calculate" && isFlexibleMarginCompleted(displayRow)) {
      setToast("Este margen ya esta marcado como completado.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    if (mode === "calculate" && !canUseFlexibleRecommendations) {
      setToast("Calcular cantidades esta disponible en Pro.");
      window.setTimeout(() => setToast(""), 2600);
      return;
    }
    setFlexibleMarginEditor({
      row: displayRow,
      mode,
      token: `${displayRow.date}-${mode}-${Date.now()}`,
    });
  }

  async function saveFlexibleMarginEntries(row, entries, completed, successMessage = "") {
    if (!row?.date) return;
    const currentRow = days.find((day) => day.date === row.date) || row;
    const plan = flexiblePlanForChoice(currentRow, trackingChoice(currentRow), activePlanSource);
    const completionState = plan ? flexibleMarginCompletionState(plan, entries) : null;
    if (completed && completionState && !completionState.canComplete) {
      setToast(flexibleMarginCompletionBlockMessage(completionState));
      window.setTimeout(() => setToast(""), 3200);
      return;
    }
    const nextManualEntries = replaceFlexibleMarginEntries(currentRow, entries, completed);
    const optimisticRow = rowWithTracking(currentRow, {
      manualEntries: nextManualEntries,
      flexibleMarginCompleted: completed === true,
    });
    const remaining = plan ? flexibleMarginRemaining(plan, nextManualEntries) : 0;
    const message = successMessage ||
      (completed
        ? "Margen flexible marcado como hecho."
        : remaining < -5
          ? `Calorias libres guardadas. Te pasaste por ${displayKcal(Math.abs(remaining))}.`
          : remaining > 5
            ? `Calorias libres guardadas. Quedan ${displayKcal(remaining)} disponibles.`
            : "Calorias libres guardadas.");

    setWeekData((currentData) => currentData ? {
      ...currentData,
      days: (currentData.days || []).map((day) => day.date === optimisticRow.date ? optimisticRow : day),
    } : currentData);
    setDetailRow((currentRow) => currentRow?.date === optimisticRow.date ? optimisticRow : currentRow);
    setRemainingDraft((current) => current?.date === optimisticRow.date ? optimisticRow : current);
    setMealDrawer((current) => current?.row?.date === optimisticRow.date ? { ...current, row: optimisticRow } : current);
    setFlexibleMarginEditor(null);
    setSaving(true);
    try {
      await saveMenuTrackingDay(trackingPayloadBase(optimisticRow, {
        manualEntries: nextManualEntries,
        flexibleMarginCompleted: completed === true,
      }));
      await loadWeek(weekStart, { silent: true });
      setToast(message);
      window.setTimeout(() => setToast(""), 2600);
    } catch (err) {
      setToast(err?.message || "No se pudo guardar el margen flexible.");
    } finally {
      setSaving(false);
    }
  }

  function toggleFlexibleMarginCompleted(row) {
    if (!row?.date || saving) return;
    const currentRow = days.find((day) => day.date === row.date) || row;
    const nextCompleted = !isFlexibleMarginCompleted(currentRow);
    if (nextCompleted) {
      const displayRow = rowWithActiveGeneratedMeals(currentRow, days);
      const plan = flexiblePlanForChoice(displayRow, trackingChoice(displayRow), activePlanSource);
      const completionState = plan ? flexibleMarginCompletionState(plan, currentRow) : null;
      if (!completionState?.canComplete) {
        setToast(flexibleMarginCompletionBlockMessage(completionState || {}));
        window.setTimeout(() => setToast(""), 3200);
        return;
      }
    }
    saveFlexibleMarginEntries(
      currentRow,
      flexibleMarginEntries(currentRow),
      nextCompleted,
      nextCompleted ? "Margen flexible marcado como hecho." : "Margen flexible reabierto."
    );
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
                activePlan={activePlan}
                activePlanSource={activePlanSource}
                detailChoiceKey={mobileDetailChoiceKey}
                onBack={() => setMobileView("overview")}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onToggleMeal={toggleMenuMeal}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                onOpenFlexibleMargin={openFlexibleMargin}
                onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                onQuickEditMeal={openQuickMealEditor}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onRestoreGenerated={restoreGeneratedRemaining}
                onRestoreManual={restoreManualEntries}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                canUseFlexibleRecommendations={canUseFlexibleRecommendations}
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
                activePlan={activePlan}
                activePlanSource={activePlanSource}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onOpenMenuOptions={() => setMenuOptionsDrawerOpen(true)}
                onEditActiveMenu={(options) => openActiveMenuEditor(selectedRow, options)}
                onOpenRemaining={() => setRemainingDraft(selectedRow)}
                onOpenFlexibleMargin={openFlexibleMargin}
                onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                onToggleMeal={toggleMenuMeal}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                onQuickEditMeal={openQuickMealEditor}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onRestoreGenerated={restoreGeneratedRemaining}
                onRestoreManual={restoreManualEntries}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                canUseFlexibleRecommendations={canUseFlexibleRecommendations}
                saving={saving}
              />
            )
          ) : (
            <>
              <TodayHero
                row={selectedDisplayRow}
                weekRows={days}
                activePlan={activePlan}
                activePlanSource={activePlanSource}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onView={() => setDetailRow(selectedDisplayRow)}
                onOpenMenuOptions={() => setMenuOptionsDrawerOpen(true)}
                onEditActiveMenu={(options) => openActiveMenuEditor(selectedDisplayRow, options)}
                onToggleMeal={toggleMenuMeal}
                onOpenMeal={(payload) => setMealDrawer(payload)}
                onQuickEditMeal={openQuickMealEditor}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onOpenRemaining={() => setRemainingDraft(selectedDisplayRow)}
                onOpenFlexibleMargin={openFlexibleMargin}
                onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canAutoCompleteRemaining={canAutoCompleteRemaining}
                canUseFlexibleRecommendations={canUseFlexibleRecommendations}
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
                    activePlanSource={activePlanSource}
                    onMarkMissed={markDayMissed}
                    onToggleMeal={toggleMenuMeal}
                    onOpenMeal={(payload) => setMealDrawer(payload)}
                    onQuickEditMeal={openQuickMealEditor}
                    onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                    onOpenRemaining={() => setRemainingDraft(selectedDisplayRow)}
                    onOpenFlexibleMargin={openFlexibleMargin}
                    onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                    onRestoreGenerated={restoreGeneratedRemaining}
                    onRestoreManual={restoreManualEntries}
                    onDeleteManual={deleteManualEntry}
                    canMarkMeals={canMarkMeals}
                    canAutoCompleteRemaining={canAutoCompleteRemaining}
                    canUseFlexibleRecommendations={canUseFlexibleRecommendations}
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
          activePlanSource={activePlanSource}
          onClose={() => setDetailRow(null)}
          onMarkMissed={markDayMissed}
          onToggleMeal={toggleMenuMeal}
          onOpenMeal={(payload) => setMealDrawer(payload)}
          onQuickEditMeal={openQuickMealEditor}
          onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
          onOpenRemaining={() => setRemainingDraft(rowWithActiveGeneratedMeals(detailRow, days))}
          onOpenFlexibleMargin={openFlexibleMargin}
          onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
          onRestoreGenerated={restoreGeneratedRemaining}
          onRestoreManual={restoreManualEntries}
          onDeleteManual={deleteManualEntry}
          canMarkMeals={canMarkMeals}
          canAutoCompleteRemaining={canAutoCompleteRemaining}
          canUseFlexibleRecommendations={canUseFlexibleRecommendations}
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

      {flexibleMarginEditor ? (
        <FlexibleMarginEditor
          key={flexibleMarginEditor.token}
          row={flexibleMarginEditor.row}
          activePlanSource={activePlanSource}
          initialMode={flexibleMarginEditor.mode}
          canRecommend={canUseFlexibleRecommendations}
          saving={saving}
          onClose={() => setFlexibleMarginEditor(null)}
          onSave={(entries, completed, successMessage) => saveFlexibleMarginEntries(flexibleMarginEditor.row, entries, completed, successMessage)}
        />
      ) : null}

      {mealDrawer ? (
        <MobileMealDetailDrawer
          context={mealDrawer}
          onToggleMeal={toggleMenuMeal}
          onOpenFood={(payload) => setFoodDrawer(payload)}
          onClose={() => setMealDrawer(null)}
          canEditOwnMenuMeal={canQuickEditActiveMenu}
          onQuickEditMeal={(payload) => {
            setMealDrawer(null);
            openQuickMealEditor(payload);
          }}
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

      {quickMealEditor ? (
        <QuickMealEditorDrawer
          context={quickMealEditor}
          saving={saving}
          onClose={() => {
            if (!saving) setQuickMealEditor(null);
          }}
          onRetry={() => openQuickMealEditor(quickMealEditor)}
          onSave={saveQuickMealChanges}
        />
      ) : null}

      {menuOptionsDrawerOpen ? (
        <MobileMenuOptionsDrawer
          row={selectedRow}
          activePlan={activePlan}
          activePlanSource={activePlanSource}
          saving={saving}
          onClose={() => setMenuOptionsDrawerOpen(false)}
          onRenameMenu={renameActiveMenuFromOptions}
          onUseTrackingOnly={requestDeactivateOwnMenuFromDay}
          onSelectChoice={(row, choice) => {
            setMenuOptionsDrawerOpen(false);
            selectMenuChoice(row, choice);
          }}
        />
      ) : null}

      {trackingOnlyConfirmOpen ? (
        <TrackingOnlyConfirmModal
          saving={saving}
          onCancel={() => setTrackingOnlyConfirmOpen(false)}
          onConfirm={deactivateOwnMenuFromDay}
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

function TrackingOnlyConfirmModal({ saving, onCancel, onConfirm }) {
  const cancelRef = useRef(null);
  const openerRef = useRef(null);

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onCancel?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [onCancel, saving]);

  return (
    <section className="fixed inset-0 z-[125] flex items-end justify-center bg-black/78 px-3 pb-3 pt-8 backdrop-blur-md sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="tracking-only-confirm-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onCancel} aria-label="Cerrar confirmacion" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.7rem] border border-amber-300/18 bg-[radial-gradient(circle_at_18%_0,rgba(245,158,11,.18),transparent_34%),linear-gradient(180deg,#111922,#080d12)] p-4 shadow-[0_28px_90px_rgba(0,0,0,.72)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-[#FFE8A3]">
              <Utensils size={22} />
            </span>
            <div className="min-w-0">
              <span className="text-[11px] font-black uppercase tracking-wide text-[#FFE8A3]">Planificacion activa</span>
              <h3 id="tracking-only-confirm-title" className="mt-1 text-xl font-black leading-tight text-white">Usar solo Tracking</h3>
              <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-300">
                Tu menu seguira guardado, pero dejara de mostrarse como planificacion activa. Podras volver a activarlo mas adelante.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200 disabled:opacity-60"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 grid gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-xs font-bold text-zinc-300">
          <span>No elimina el menu.</span>
          <span>No borra comidas ni alimentos.</span>
          <span>No borra historial ni Tracking.</span>
        </div>

        <footer className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            disabled={saving}
            className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-black text-zinc-100 disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="min-h-12 rounded-2xl border border-amber-300/35 bg-amber-300/15 px-4 text-sm font-black text-[#FFE8A3] disabled:opacity-60"
          >
            {saving ? "Desactivando..." : "Usar solo Tracking"}
          </button>
        </footer>
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
    <div className="flex items-center justify-between gap-3 px-0.5">
      <div className="flex min-w-0 items-center gap-2">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-100"
            aria-label="Volver"
          >
            <ChevronLeft size={18} />
          </button>
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center text-zinc-100" aria-hidden="true">
            <Utensils size={18} strokeWidth={2.2} />
          </span>
        )}
        <h1 className="truncate text-base font-black text-white">{title}</h1>
      </div>
      {onBack ? (
        <span className="h-9 w-9 shrink-0" aria-hidden="true" />
      ) : (
        <button
          type="button"
          disabled
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 disabled:opacity-80"
          aria-label="Opciones"
          title="Opciones"
        >
          <MoreHorizontal size={18} />
        </button>
      )}
    </div>
  );
}

function MobileDayPicker({ row, onPrevious, onNext }) {
  return (
    <div className="mt-2 grid grid-cols-[38px_minmax(0,1fr)_38px] items-center gap-1.5 rounded-[1rem] border border-white/10 bg-[#101824] p-1.5 shadow-[0_10px_26px_rgba(0,0,0,.22)]">
      <button
        type="button"
        onClick={onPrevious}
        className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/20 text-zinc-100"
        aria-label="Día anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-0 text-center">
        <div className="flex min-w-0 items-center justify-center gap-1.5">
          <CalendarDays size={13} className="shrink-0 text-zinc-400" />
          <span className="truncate text-sm font-black text-white">{compactDayLabel(row)}</span>
        </div>
        <div className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-500">{formatDate(row?.date)}</div>
      </div>
      <button
        type="button"
        onClick={onNext}
        className="grid h-9 w-9 place-items-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]"
        aria-label="Día siguiente"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function MobileCalculateButton({ onClick, disabled = false, locked = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[1.05rem] border border-[#D4AF37]/45 bg-[linear-gradient(135deg,rgba(245,215,110,.14),rgba(255,255,255,.045))] px-4 text-left text-[#FFE8A3] shadow-[0_12px_28px_rgba(0,0,0,.32)] transition active:scale-[0.99] disabled:opacity-45"
    >
      <span className="flex min-w-0 items-center gap-3">
        {locked ? <Lock size={20} className="shrink-0" /> : <Calculator size={20} className="shrink-0" />}
        <span className="grid min-w-0 leading-tight">
          <span className="min-w-0 truncate text-sm font-black">Calcular lo que falta</span>
          {locked ? <span className="truncate text-[10px] font-black text-[#FFE8A3]/70">Disponible en Pro</span> : null}
        </span>
      </span>
      <ChevronRight size={20} className="shrink-0" />
    </button>
  );
}

function FlexibleMarginSlotCard({
  row,
  plan,
  saving = false,
  canRecommend = false,
  onEdit,
  onCalculate,
  onToggleCompleted,
  compact = false,
}) {
  const [expanded, setExpanded] = useState(false);
  if (!plan?.flexibleCalories) return null;
  const entries = flexibleMarginEntries(row);
  const totals = flexibleMarginTotals(row);
  const remaining = flexibleMarginRemaining(plan, row);
  const macroRemaining = flexibleMarginMacroRemaining(plan, row);
  const completed = isFlexibleMarginCompleted(row);
  const hasEntries = entries.length > 0;
  const exceeded = remaining < -5;
  const completionState = flexibleMarginCompletionState(plan, row);
  const canMarkComplete = completionState.canComplete;
  const autoReady = !completed && completionState.autoComplete;
  const canCalculate = !completed && canRecommend && remaining > 5;
  const toggleLabel = expanded ? "Ocultar detalle" : "Ver detalle";
  const badgeLabel = completed ? "Hecho" : autoReady ? "Listo" : canMarkComplete ? "Cerca" : "Flexible";
  const macroReferenceParts = [
    macroRemaining.proteina > 0 ? `P ${formatNumber(macroRemaining.proteina, 0)}g` : "",
    macroRemaining.carbs > 0 ? `C ${formatNumber(macroRemaining.carbs, 0)}g` : "",
    macroRemaining.grasas > 0 ? `G ${formatNumber(macroRemaining.grasas, 0)}g` : "",
  ].filter(Boolean);
  const macroReference = macroReferenceParts.length ? macroReferenceParts.join(" - ") : "Sin referencia";
  const registeredLine = `${formatNumber(totals.kcal, 0)} / ${displayKcal(plan.flexibleCalories)} registradas`;
  const Icon = completed || autoReady ? CheckCircle2 : exceeded ? CircleAlert : Apple;
  const mainLine = completed && !hasEntries
    ? `${displayKcal(plan.flexibleCalories)} cerradas`
    : hasEntries
      ? registeredLine
      : `${displayKcal(plan.flexibleCalories)} libres`;
  const progressLine = completed
    ? "Margen flexible completado"
    : autoReady
      ? "Se marcara como hecho al guardar"
      : canMarkComplete
        ? "Listo para marcar como hecho"
        : exceeded
          ? `Te pasaste por ${displayKcal(Math.abs(remaining))}`
          : hasEntries
            ? `Restan ${displayKcal(Math.max(0, remaining))}`
            : `0 / ${displayKcal(plan.flexibleCalories)} registradas`;
  const remainingLine = completed
    ? ""
    : exceeded
      ? ""
      : hasEntries
        ? ""
        : `Restan ${displayKcal(Math.max(0, remaining))}`;
  const previewNames = entries
    .slice(0, 2)
    .map((entry) => {
      const food = flexibleMarginEntryFood(entry);
      return food.name || food.nombre || entry.foodName || entry.name || "";
    })
    .filter(Boolean);
  const foodsPreview = previewNames.length
    ? `${previewNames.join(", ")}${entries.length > 2 ? ` +${entries.length - 2}` : ""}`
    : "";
  const palette = completed
    ? {
      shell: "border-emerald-300/30 bg-[radial-gradient(circle_at_8%_0,rgba(34,197,94,.18),transparent_34%),linear-gradient(145deg,rgba(8,28,19,.97),rgba(7,13,11,.97))]",
      icon: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
      badge: "border-emerald-300/30 bg-emerald-300/10 text-emerald-100",
      value: "text-emerald-300",
      status: "text-emerald-100",
      primary: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
    }
    : autoReady
      ? {
        shell: "border-emerald-300/28 bg-[radial-gradient(circle_at_8%_0,rgba(16,185,129,.20),transparent_34%),radial-gradient(circle_at_100%_0,rgba(56,189,248,.13),transparent_36%),linear-gradient(145deg,rgba(7,27,22,.98),rgba(6,14,17,.98))]",
        icon: "border-emerald-300/40 bg-emerald-300/12 text-emerald-100",
        badge: "border-emerald-300/35 bg-emerald-300/12 text-emerald-100",
        value: "text-emerald-300",
        status: "text-emerald-100",
        primary: "border-emerald-300/35 bg-emerald-300/12 text-emerald-100",
      }
    : exceeded
      ? {
        shell: "border-orange-400/30 bg-[radial-gradient(circle_at_8%_0,rgba(249,115,22,.17),transparent_34%),linear-gradient(145deg,rgba(34,17,13,.97),rgba(13,10,9,.97))]",
        icon: "border-orange-300/35 bg-orange-300/10 text-orange-100",
        badge: "border-orange-300/25 bg-orange-300/10 text-orange-100",
        value: "text-orange-300",
        status: "text-orange-200",
        primary: "border-orange-300/35 bg-orange-300/10 text-orange-100",
      }
      : hasEntries
        ? {
          shell: "border-emerald-300/24 bg-[radial-gradient(circle_at_8%_0,rgba(45,212,191,.15),transparent_34%),linear-gradient(145deg,rgba(8,26,23,.97),rgba(7,13,17,.97))]",
          icon: "border-teal-300/35 bg-teal-300/10 text-teal-100",
          badge: "border-teal-300/28 bg-teal-300/10 text-teal-100",
          value: "text-teal-300",
          status: "text-zinc-200",
          primary: "border-teal-300/35 bg-teal-300/10 text-teal-100",
        }
        : {
          shell: "border-sky-300/24 bg-[radial-gradient(circle_at_8%_0,rgba(14,165,233,.16),transparent_34%),radial-gradient(circle_at_100%_0,rgba(212,175,55,.10),transparent_35%),linear-gradient(145deg,rgba(8,19,30,.98),rgba(7,11,17,.98))]",
          icon: "border-sky-300/30 bg-sky-300/10 text-sky-100",
          badge: "border-sky-300/28 bg-sky-300/10 text-sky-100",
          value: "text-[#FFD76B]",
          status: "text-zinc-100",
          primary: "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]",
        };
  const completionTitle = completed
    ? "Margen cerrado"
    : autoReady
      ? "Listo automatico"
      : canMarkComplete
        ? "Ya podes cerrarlo"
        : exceeded
          ? "Primero baja el exceso"
          : "Todavia falta margen";
  const completionText = completed
    ? "Este margen flexible ya quedo marcado como hecho."
    : autoReady
      ? `Quedan ${displayKcal(completionState.missing)}. Al guardar se va a marcar como hecho.`
      : canMarkComplete
        ? `Quedan ${displayKcal(completionState.missing)}. Estas dentro del margen de ${displayKcal(FLEXIBLE_MARGIN_COMPLETE_TOLERANCE_KCAL)}.`
        : exceeded
          ? `Te pasaste por ${displayKcal(completionState.over)}. Baja la cantidad antes de cerrarlo.`
          : `Te faltan ${displayKcal(completionState.kcalToComplete)} para poder marcarlo como hecho.`;
  const completionPanelClass = completed || canMarkComplete
    ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
    : exceeded
      ? "border-orange-300/25 bg-orange-300/10 text-orange-100"
      : "border-white/10 bg-white/[0.035] text-zinc-300";
  const completeActionLabel = completed
    ? "Reabrir"
    : canMarkComplete
      ? "Marcar hecho"
      : "Aun falta";

  const handleCardClick = (event) => {
    if (event.target?.closest?.("button,a,input,select,textarea")) return;
    setExpanded((current) => !current);
  };

  return (
    <section
      className={`mt-2 cursor-pointer overflow-hidden rounded-[1.05rem] border shadow-[0_10px_26px_rgba(0,0,0,.24)] ${palette.shell} ${compact ? "p-2" : "p-2.5"}`}
      onClick={handleCardClick}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${palette.icon}`}>
          <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h4 className="truncate text-[15px] font-black leading-tight text-white">Calorias libres</h4>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wide ${palette.badge}`}>
              {badgeLabel}
            </span>
          </div>
          <p className={`mt-0.5 text-[16px] font-black leading-tight ${palette.value}`}>{mainLine}</p>
          <p className={`mt-0.5 text-[11px] font-black leading-snug ${palette.status}`}>
            {progressLine}
          </p>
          {remainingLine ? (
            <p className="mt-0.5 text-[11px] font-bold leading-snug text-zinc-400">{remainingLine}</p>
          ) : null}
          {foodsPreview ? (
            <p className="mt-0.5 truncate text-[11px] font-bold text-zinc-400">{foodsPreview}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-200"
          aria-expanded={expanded}
          aria-label={toggleLabel}
          title={toggleLabel}
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {completed ? (
        <div className="mt-1.5">
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className={`inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-black ${palette.primary}`}
            aria-expanded={expanded}
          >
            {expanded ? "Ocultar detalle" : "Ver detalle"}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      ) : (
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onEdit}
            disabled={saving}
            className={`inline-flex min-h-8 flex-1 items-center justify-center gap-2 rounded-full border px-3 text-xs font-black disabled:opacity-50 sm:flex-none ${palette.primary}`}
          >
            {hasEntries ? <PencilLine size={14} /> : <Plus size={14} />}
            {hasEntries ? "Editar alimentos" : "Agregar alimentos"}
          </button>
          {canMarkComplete ? (
            <button
              type="button"
              onClick={onToggleCompleted}
              disabled={saving}
              className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 text-xs font-black text-emerald-100 disabled:opacity-50"
              aria-label="Marcar calorias libres como hecho"
            >
              <CheckCircle2 size={14} />
              Hecho
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 text-xs font-black text-zinc-300"
            aria-expanded={expanded}
          >
            {expanded ? "Ocultar" : "Detalle"}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}

      {expanded ? (
        <div className="mt-3 border-t border-white/10 pt-3">
          <p className="text-xs font-bold leading-relaxed text-zinc-300">
            Tu coach dejo este margen para completar durante el dia. Podes registrarlo en Tracking o consumirlo fuera del menu.
          </p>

          <div className="mt-3 grid grid-cols-3 gap-2 rounded-[1rem] border border-white/10 bg-black/20 p-2.5 text-[12px] font-bold text-zinc-200">
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-500">Registrado</span>
              <strong className="mt-0.5 block text-white">{displayKcal(totals.kcal)}</strong>
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-500">{exceeded ? "Excedido" : "Restante"}</span>
              <strong className={`mt-0.5 block ${exceeded ? "text-amber-100" : "text-sky-100"}`}>{displayKcal(Math.abs(remaining))}</strong>
            </div>
            <div>
              <span className="block text-[10px] font-black uppercase tracking-wide text-zinc-500">Referencia</span>
              <strong className="mt-0.5 block text-sky-100">{macroReference}</strong>
            </div>
          </div>

          <div className={`mt-3 rounded-[1rem] border p-3 ${completionPanelClass}`}>
            <div className="flex items-start gap-2">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-current/25 bg-black/15">
                {completed || canMarkComplete ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}
              </span>
              <span className="min-w-0">
                <strong className="block text-sm font-black leading-tight">{completionTitle}</strong>
                <span className="mt-1 block text-xs font-bold leading-relaxed opacity-80">{completionText}</span>
              </span>
            </div>
          </div>

          {hasEntries ? (
            <div className="mt-3 grid gap-1.5">
              {entries.map((entry, index) => {
                const food = flexibleMarginEntryFood(entry);
                const entryTotals = totalFromLike(entry.totals || food);
                const quantity = macro(food.quantity ?? food.cantidad ?? entry.quantity ?? entry.cantidad);
                const unit = food.unit || food.unidad || entry.unit || entry.unidad || "g";
                return (
                  <div key={entry.id || `${food.name}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2 text-sm">
                    <span className="min-w-0 truncate font-bold text-zinc-100">{food.name || food.nombre || entry.foodName || entry.name}</span>
                    <span className="shrink-0 text-xs font-black text-[#FFE8A3]">
                      {formatNumber(quantity, quantity % 1 ? 1 : 0)} {unit} - {displayKcal(entryTotals.kcal)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 py-2 text-sm font-bold text-zinc-500">
              Todavia no registraste alimentos para este margen.
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <button
              type="button"
              onClick={onEdit}
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3] disabled:opacity-50"
            >
              {hasEntries ? <PencilLine size={15} /> : <Plus size={15} />}
              {hasEntries ? "Editar alimentos" : "Agregar alimentos"}
            </button>
            <button
              type="button"
              onClick={onCalculate}
              disabled={saving || !canCalculate}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black disabled:opacity-45 ${
                canRecommend
                  ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                  : "border-white/10 bg-white/[0.035] text-zinc-400"
              }`}
            >
              {canRecommend ? <Calculator size={15} /> : <Lock size={15} />}
              {canRecommend ? "Calcular" : "Disponible en Pro"}
            </button>
            <Link
              to="/app/tracking"
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-sky-300/25 bg-sky-300/10 px-3 text-xs font-black text-sky-100"
            >
              Tracking
              <ChevronRight size={15} />
            </Link>
            <button
              type="button"
              onClick={onToggleCompleted}
              disabled={saving || (!completed && !canMarkComplete)}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border px-3 text-xs font-black disabled:opacity-50 ${
                completed
                  ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                  : canMarkComplete
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                    : "border-white/10 bg-white/[0.045] text-zinc-400"
              }`}
              aria-pressed={completed}
            >
              {completed || canMarkComplete ? <CheckCircle2 size={15} /> : <Square size={15} />}
              {completeActionLabel}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MobileDayMenu({
  row,
  weekRows = [],
  activePlan = {},
  activePlanSource = "none",
  onPrevious,
  onNext,
  onOpenMenuOptions,
  onEditActiveMenu,
  onOpenRemaining,
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onToggleMeal,
  onOpenMeal,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onRestoreGenerated,
  onRestoreManual,
  onDeleteManual,
  canMarkMeals,
  canAutoCompleteRemaining,
  canUseFlexibleRecommendations,
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
  const hasTarget = hasConfiguredTarget(displayRow);
  const consumed = consumedTotals(displayRow);
  const remaining = remainingTotals(displayRow);
  const percent = completionPercent(displayRow);
  const activeMenuStatus = activeChoice ? choiceStatus(row, activeChoice) : menuState(row);
  const canCalculateRemaining = hasTarget && positiveTotals(remaining).kcal > 40 && canAutoCompleteRemaining;
  const canQuickEditMeals = menuSourceMeta(activePlanSource).key === "own";
  const emptyCopy = emptyMenuCopy(activePlanSource);
  const flexiblePlan = flexiblePlanForChoice(displayRow, activeChoice, activePlanSource);

  return (
    <section className="mx-auto w-full max-w-[760px] overflow-x-hidden px-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <MobileDayPicker row={row} onPrevious={onPrevious} onNext={onNext} />

      {activeChoice?.snapshot ? (
        <MobileActiveMenuLine
          choice={activeChoice}
          activePlan={activePlan}
          choicesCount={choices.length}
          activePlanSource={activePlanSource}
          onOpenOptions={onOpenMenuOptions}
          onEditMenu={onEditActiveMenu}
        />
      ) : null}

      <MobileGoalAccordion
        expanded={isGoalExpanded}
        onToggle={() => setIsGoalExpanded((current) => !current)}
        target={target}
        consumed={consumed}
        remaining={remaining}
        percent={percent}
        hasTarget={hasTarget}
        activeMenuStatus={activeMenuStatus}
        trackingTone={statusMeta(row).tone}
        trackingLabelText={trackingLabel(row)}
        completedCount={completedCount}
        mealsCount={countableMeals.length || 0}
      />

      {/*
            <p className="mt-1 text-sm font-bold leading-tight text-zinc-400">
              P {formatNumber(target.proteina, 0)} g - C {formatNumber(target.carbs, 0)} g - G {formatNumber(target.grasas, 0)} g
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
          <MobileEmptyCard title={emptyCopy.title} text={emptyCopy.text} />
        </div>
      ) : null}

      {activeChoice?.snapshot ? (
        <FlexibleMarginSlotCard
          row={displayRow}
          plan={flexiblePlan}
          saving={saving}
          canRecommend={canUseFlexibleRecommendations}
          onEdit={() => onOpenFlexibleMargin?.(displayRow, "manual")}
          onCalculate={() => onOpenFlexibleMargin?.(displayRow, "calculate")}
          onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(displayRow)}
        />
      ) : null}

      {activeChoice?.snapshot ? (
        <section className="mt-3 grid gap-2.5">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-base font-black text-white">Comidas del dia</h3>
            <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-black text-[#FFE8A3]">
              {completedMealsLabel(completedCount, countableMeals.length || 0)}
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
                canQuickEdit={canQuickEditMeals}
                onQuickEditMeal={onQuickEditMeal}
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
        <MobileCalculateButton onClick={onOpenRemaining} disabled={!canCalculateRemaining || saving} locked={!canAutoCompleteRemaining} />
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
  hasTarget = true,
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

  if (!hasTarget) {
    return (
      <section className="mt-2 overflow-hidden rounded-[1.05rem] border border-[#D4AF37]/20 bg-[radial-gradient(circle_at_88%_12%,rgba(212,175,55,.12),transparent_30%),linear-gradient(145deg,#101923,#080d13)] p-2.5 shadow-[0_10px_26px_rgba(0,0,0,.26)]">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]">
            <Target size={17} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <span className="block text-sm font-black text-white">Meta diaria pendiente</span>
            <p className="mt-1 text-xs font-bold leading-snug text-zinc-400">
              Todavia no configuraste kcal/macros. No mostramos 0 kcal como meta real.
            </p>
            <Link
              to="/app/objetivos"
              className="mt-2 inline-flex min-h-8 items-center justify-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 text-xs font-black text-[#FFE8A3]"
            >
              Configurar objetivos
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mt-2 overflow-hidden rounded-[1.05rem] border border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(212,175,55,.12),transparent_30%),radial-gradient(circle_at_0_0,rgba(45,212,191,.10),transparent_36%),linear-gradient(145deg,#101923,#080d13)] shadow-[0_10px_26px_rgba(0,0,0,.26)]">
      <button
        type="button"
        className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 px-2.5 py-2.5 text-left"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-emerald-300/25 bg-emerald-300/10 text-emerald-200">
          <Target size={17} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-white">Meta del día</span>
          <span className="mt-0.5 block text-[17px] font-black leading-tight text-[#FFD76B]">{displayKcal(target.kcal)}</span>
          <span className="mt-0.5 block truncate text-[10.5px] font-black text-sky-200">{macroSummary}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="min-w-[42px] text-right leading-tight">
            <strong className="block text-sm font-black text-emerald-300">{safePercent}%</strong>
            <span className="block text-[8.5px] font-bold text-zinc-500">cumplido</span>
          </span>
          <span className="grid h-7 w-7 place-items-center rounded-full border border-white/10 bg-black/20 text-zinc-300">
            <ChevronIcon size={15} strokeWidth={2.4} aria-hidden="true" />
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
                P {formatNumber(target.proteina, 0)} g - C {formatNumber(target.carbs, 0)} g - G {formatNumber(target.grasas, 0)} g
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

function MobileActiveMenuLine({ choice, activePlan = {}, choicesCount = 0, activePlanSource = "none", onOpenOptions, onEditMenu }) {
  const sourceMeta = menuSourceMeta(activePlanSource);
  const menuName = activeMenuDisplayName(choice, activePlan, activePlanSource);
  const summaryParts = activeMenuSummaryParts(choice, activePlanSource);
  const summary = `${summaryParts.primary} · ${summaryParts.secondary}`;
  const isOwn = sourceMeta.key === "own";
  const isCoach = sourceMeta.key === "coach";
  return (
    <section className="mt-2 overflow-hidden rounded-[1.05rem] border border-[#D4AF37]/20 bg-[radial-gradient(circle_at_100%_0,rgba(212,175,55,.10),transparent_34%),linear-gradient(145deg,#101923,#090f16)] p-2.5 shadow-[0_10px_26px_rgba(0,0,0,.22)]">
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={`inline-flex min-h-5 items-center rounded-full border px-2 text-[9px] font-black uppercase tracking-wide ${sourceMeta.pillClass}`}>
          {sourceMeta.label}
        </span>
        {isCoach ? (
          <span className="inline-flex min-h-5 items-center gap-1 rounded-full border border-white/10 bg-white/[0.045] px-2 text-[9px] font-black text-zinc-300">
            <Lock size={11} />
            Solo lectura
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2.5">
        <div className="min-w-0">
          <h2 className="line-clamp-2 text-[17px] font-black leading-tight text-white" title={menuName}>
            {menuName}
          </h2>
          <p className="mt-0.5 text-[11.5px] font-bold leading-snug text-zinc-400" title={summary}>
            <span className="block sm:inline">{summaryParts.primary}</span>
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">{summaryParts.secondary}</span>
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isOwn ? (
            <button
              type="button"
              onClick={() => onEditMenu?.()}
              className="grid h-9 w-9 place-items-center rounded-xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3] shadow-[0_8px_20px_rgba(0,0,0,.18)] active:scale-[0.98]"
              aria-label={`Editar menu ${menuName}`}
              title="Editar menu"
            >
              <PencilLine size={16} />
            </button>
          ) : null}
          <button
            type="button"
            onClick={onOpenOptions}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-black/25 text-zinc-200 shadow-[0_8px_20px_rgba(0,0,0,.16)] active:scale-[0.98]"
            aria-label={choicesCount > 1 ? "Cambiar menu u opciones" : "Ver opciones de menu"}
            title="Opciones"
          >
            <MoreHorizontal size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function MobileMenuOptionsDrawer({
  row,
  activePlan = {},
  activePlanSource = "none",
  saving,
  onClose,
  onRenameMenu,
  onUseTrackingOnly,
  onSelectChoice,
}) {
  const [infoOpen, setInfoOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const closeButtonRef = useRef(null);
  const openerRef = useRef(null);
  const choices = menuChoices(row);
  const sourceMeta = menuSourceMeta(activePlanSource);
  const activeChoice = trackingChoice(row) || choices[0] || null;
  const menuName = activeChoice ? activeMenuDisplayName(activeChoice, activePlan, activePlanSource) : "Menu";
  const summaryParts = activeChoice ? activeMenuSummaryParts(activeChoice, activePlanSource) : null;
  const summary = activeChoice ? activeMenuSummary(activeChoice, activePlanSource) : "";
  const isOwn = sourceMeta.key === "own";
  const isCoach = sourceMeta.key === "coach";
  const showChoiceSelector = choices.length > 1;
  const drawerTitle = showChoiceSelector ? "Cambiar menu" : "Opciones del menu";

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [onClose, saving]);

  useEffect(() => {
    if (renaming) setRenameValue(menuName);
  }, [menuName, renaming]);

  const submitRename = (event) => {
    event.preventDefault();
    const cleanName = renameValue.trim();
    if (!cleanName || cleanName === menuName || saving) return;
    onRenameMenu?.(cleanName);
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-label={drawerTitle}>
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
            <h3 className="truncate text-lg font-black text-white">{drawerTitle}</h3>
            <p className="mt-0.5 text-xs font-bold text-zinc-500">
              {menuName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            ref={closeButtonRef}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="max-h-[calc(82dvh-92px)] overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="mb-3 rounded-[1.1rem] border border-white/10 bg-white/[0.035] p-3">
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-black uppercase tracking-wide ${sourceMeta.pillClass}`}>
                {sourceMeta.label}
              </span>
              {isCoach ? (
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.045] px-2.5 text-[10px] font-black text-zinc-300">
                  <Lock size={12} />
                  Solo lectura
                </span>
              ) : null}
            </div>
            <strong className="mt-2 block truncate text-sm font-black text-white">{menuName}</strong>
            {summaryParts ? (
              <span className="mt-1 block text-xs font-bold leading-snug text-zinc-500" title={summary}>
                <span className="block sm:inline">{summaryParts.primary}</span>
                <span className="hidden sm:inline"> · </span>
                <span className="block sm:inline">{summaryParts.secondary}</span>
              </span>
            ) : null}
          </div>

          <div className="mb-3 grid gap-2">
            {isOwn ? (
              <>
                {renaming ? (
                  <form onSubmit={submitRename} className="grid gap-2 rounded-[1.05rem] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3">
                    <label className="text-[11px] font-black uppercase tracking-wide text-[#FFE8A3]" htmlFor="menu-quick-rename">
                      Renombrar menu
                    </label>
                    <input
                      id="menu-quick-rename"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      disabled={saving}
                      autoFocus
                      maxLength={80}
                      className="min-h-12 rounded-2xl border border-white/10 bg-black/30 px-3 text-sm font-black text-white outline-none ring-[#D4AF37]/0 transition focus:border-[#D4AF37]/45 focus:ring-4 focus:ring-[#D4AF37]/10 disabled:opacity-60"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRenaming(false)}
                        disabled={saving}
                        className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-xs font-black text-zinc-200 disabled:opacity-60"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !renameValue.trim() || renameValue.trim() === menuName}
                        className="min-h-11 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/15 px-3 text-xs font-black text-[#FFE8A3] disabled:opacity-50"
                      >
                        Guardar
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    onClick={() => setRenaming(true)}
                    className="flex min-h-12 items-center justify-between rounded-[1.05rem] border border-white/10 bg-white/[0.045] px-4 text-sm font-black text-zinc-100 focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/15"
                  >
                    <span className="inline-flex items-center gap-2"><PencilLine size={17} /> Renombrar</span>
                    <ChevronRight size={17} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setInfoOpen((value) => !value)}
                  className="flex min-h-12 items-center justify-between rounded-[1.05rem] border border-white/10 bg-white/[0.035] px-4 text-sm font-black text-zinc-100 focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/15"
                  aria-expanded={infoOpen}
                >
                  <span className="inline-flex items-center gap-2"><CircleAlert size={17} /> Informacion del menu</span>
                  <ChevronRight size={17} className={infoOpen ? "rotate-90" : ""} />
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={onUseTrackingOnly}
                  className="mt-1 flex min-h-12 items-center justify-between rounded-[1.05rem] border border-amber-300/25 bg-amber-300/[0.075] px-4 text-sm font-black text-amber-100 disabled:opacity-60 focus:outline-none focus:ring-4 focus:ring-amber-300/15"
                >
                  <span className="inline-flex items-center gap-2"><Utensils size={17} /> Usar solo Tracking</span>
                  <ChevronRight size={17} />
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => setInfoOpen((value) => !value)}
                className="flex min-h-12 items-center justify-between rounded-[1.05rem] border border-white/10 bg-white/[0.035] px-4 text-sm font-black text-zinc-100 focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/15"
                aria-expanded={infoOpen}
              >
                <span className="inline-flex items-center gap-2"><CircleAlert size={17} /> Informacion del menu</span>
                <ChevronRight size={17} className={infoOpen ? "rotate-90" : ""} />
              </button>
            )}
            {infoOpen ? (
              <div className="rounded-[1.05rem] border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3 text-xs font-bold leading-relaxed text-zinc-300">
                {isOwn
                  ? "Este menu es tuyo. El dia base se reutiliza y podes editarlo cuando quieras; el cumplimiento diario se registra aparte."
                  : isCoach
                    ? "Este menu fue asignado por tu coach. Lo podes consultar y marcar como realizado, pero no modificar desde tu cliente."
                    : "Este menu se muestra como referencia para el dia seleccionado."}
              </div>
            ) : null}
          </div>

          {showChoiceSelector ? (
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
            </div>
          ) : !activeChoice ? (
            <MobileEmptyCard
              title="No hay menus disponibles."
              text="Cuando tu coach asigne un menu, va a aparecer aca."
            />
          ) : null}
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
            {displayKcal(totals.kcal)} - {meals.length} comida{meals.length === 1 ? "" : "s"}
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
  activePlanSource = "none",
  detailChoiceKey = "",
  onBack,
  onPrevious,
  onNext,
  onToggleMeal,
  onOpenRemaining,
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onOpenMeal,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onRestoreGenerated,
  onRestoreManual,
  onDeleteManual,
  canMarkMeals,
  canAutoCompleteRemaining,
  canUseFlexibleRecommendations,
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
  const hasTarget = hasConfiguredTarget(displayRow);
  const consumed = consumedTotals(displayRow);
  const remaining = remainingTotals(displayRow);
  const percent = completionPercent(displayRow);
  const canCalculateRemaining = hasTarget && positiveTotals(remaining).kcal > 40 && canAutoCompleteRemaining;
  const canQuickEditMeals = menuSourceMeta(activePlanSource).key === "own";
  const emptyCopy = emptyMenuCopy(activePlanSource);
  const flexiblePlan = flexiblePlanForChoice(displayRow, detailChoice, activePlanSource);

  return (
    <section className="mx-auto w-full max-w-[760px] px-1 pb-3">
      <MobileTopBar title={detailChoice?.type === "alternative" ? detailChoice.label : "Menú del día"} onBack={onBack} />
      <MobileDayPicker row={row} onPrevious={onPrevious} onNext={onNext} />

      <header className="mt-3 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[radial-gradient(circle_at_50%_0,rgba(59,130,246,.16),transparent_34%),linear-gradient(180deg,#101824,#07101a)] p-3 shadow-[0_14px_34px_rgba(0,0,0,.28)]">
        {hasTarget ? (
          <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-center text-sm font-bold text-zinc-300">
            <span>Meta <strong className="text-[#FFD76B]">{displayKcal(target.kcal)}</strong></span>
            <span>P <strong className="text-[#FFD76B]">{formatNumber(target.proteina, 0)} g</strong></span>
            <span>C <strong className="text-[#FFD76B]">{formatNumber(target.carbs, 0)} g</strong></span>
            <span>G <strong className="text-[#FFD76B]">{formatNumber(target.grasas, 0)} g</strong></span>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-3 text-center">
            <strong className="block text-sm font-black text-[#FFE8A3]">Meta diaria pendiente</strong>
            <p className="mt-1 text-xs font-bold text-zinc-400">Configura tus objetivos para comparar menu, consumo y faltante.</p>
            <Link to="/app/objetivos" className="mt-3 inline-flex min-h-9 items-center rounded-2xl border border-[#D4AF37]/30 px-3 text-xs font-black text-[#FFE8A3]">
              Ir a Objetivos
            </Link>
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <span className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-black ${toneClass(detailStatus.tone)}`}>
            <Target size={14} />
            {detailStatus.label}
          </span>
          <span className={`inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-black ${toneClass(tracking.tone)}`}>
            {trackingLabel(row)}
          </span>
        </div>

        {hasTarget ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MobileMetric
              label="Consumido"
              value={displayKcal(consumed.kcal)}
              detail={`P ${formatNumber(consumed.proteina, 0)} / C ${formatNumber(consumed.carbs, 0)} / G ${formatNumber(consumed.grasas, 0)}`}
              tone="green"
              progress={target.kcal ? (consumed.kcal / target.kcal) * 100 : 0}
            />
            <MobileMetric label="Faltante" value={displayKcal(remaining.kcal)} detail={`P ${formatNumber(remaining.proteina, 0)} / C ${formatNumber(remaining.carbs, 0)} / G ${formatNumber(remaining.grasas, 0)}`} tone={remaining.kcal < -20 ? "red" : "blue"} />
            <MobileMetric label="Cumplimiento" value={`${percent}%`} detail="del dia" tone="gold" />
          </div>
        ) : null}
      </header>

      <FlexibleMarginSlotCard
        row={displayRow}
        plan={flexiblePlan}
        saving={saving}
        canRecommend={canUseFlexibleRecommendations}
        onEdit={() => onOpenFlexibleMargin?.(displayRow, "manual")}
        onCalculate={() => onOpenFlexibleMargin?.(displayRow, "calculate")}
        onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(displayRow)}
      />

      <div className="mt-4 grid gap-3">
        <h3 className="px-1 text-lg font-black text-white">Comidas del dia</h3>
        {!snapshot ? (
          <MobileEmptyCard title={emptyCopy.title} text={emptyCopy.text} />
        ) : !effectiveMeals.length ? (
          <MobileEmptyCard
            title="Este menu no tiene comidas cargadas."
            text={canQuickEditMeals ? "Agrega alimentos desde Editar menu." : emptyCopy.emptyMealsText}
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
              canQuickEdit={canQuickEditMeals}
              onQuickEditMeal={onQuickEditMeal}
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
        <MobileCalculateButton onClick={onOpenRemaining} disabled={!canCalculateRemaining || saving} locked={!canAutoCompleteRemaining} />
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
                        {displayKcal(choiceTotals(choice).kcal)} - {choiceMeals(choice).length} comida{choiceMeals(choice).length === 1 ? "" : "s"}
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
  const joined = `${title || ""} ${text || ""}`.toLowerCase();
  const isMissingAssignedMenuCopy = joined.includes("coach lo asigne") || joined.includes("coach asigne") || joined.includes("avisarle a tu coach");
  const genericCopy = emptyMenuCopy("none");
  const displayTitle = isMissingAssignedMenuCopy ? genericCopy.title : title;
  const displayText = isMissingAssignedMenuCopy
    ? genericCopy.text
    : text;
  return (
    <div className="rounded-[1.3rem] border border-dashed border-white/15 bg-[#101824] p-4">
      <div className="flex items-center gap-3 text-zinc-100">
        <CircleAlert size={19} className="text-[#FFD76B]" />
        <strong className="text-base font-black">{displayTitle}</strong>
      </div>
      {displayText ? <p className="mt-2 text-sm font-bold text-zinc-400">{displayText}</p> : null}
      {isMissingAssignedMenuCopy ? (
        <>
          <div className="mx-auto mt-5 grid h-28 w-28 place-items-center rounded-full border border-[#D4AF37]/20 bg-[radial-gradient(circle,rgba(212,175,55,.18),rgba(255,255,255,.03)_58%,transparent_70%)] text-[#FFE8A3]">
            <div className="grid place-items-center gap-1">
              <Apple size={34} strokeWidth={1.8} />
              <Utensils size={28} strokeWidth={1.8} />
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2">
            <Link
              to="/app/menu/nuevo"
              state={{ from: "/app/menu" }}
              className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-r from-[#facc15] to-[#f5d76e] px-3 text-sm font-black text-[#080808]"
              {...createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false })}
            >
              Crear mi menu
            </Link>
            <a href="/app/tracking" className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-black text-zinc-100">
              Ir a Tracking
            </a>
          </div>
        </>
      ) : null}
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
  canQuickEdit = false,
  onQuickEditMeal,
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
  const canEditThisMeal = canQuickEdit && !manual && !generated;

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

  function quickEditMeal(event) {
    event.stopPropagation();
    onQuickEditMeal?.(detailPayload);
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
                  Todavia no agregaste alimentos.
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {canEditThisMeal ? (
                <button
                  type="button"
                  onClick={quickEditMeal}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs font-black text-emerald-100 disabled:opacity-55"
                >
                  {foods.length ? <PencilLine size={15} /> : <Plus size={15} />}
                  {foods.length ? "Editar alimentos" : "Agregar alimentos"}
                </button>
              ) : null}
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
  activePlan = {},
  activePlanSource = "none",
  onPrevious,
  onNext,
  onView,
  onOpenMenuOptions,
  onEditActiveMenu,
  onToggleMeal,
  onOpenMeal,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onOpenRemaining,
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onDeleteManual,
  canMarkMeals,
  canAutoCompleteRemaining,
  canUseFlexibleRecommendations,
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
  const targetKcal = targetTotals(row).kcal;
  const hasTarget = hasConfiguredTarget(row);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const menuKcal = activeTotals.kcal;
  const pct = hasTarget && targetKcal ? Math.min(135, Math.round((consumed.kcal / targetKcal) * 100)) : 0;
  const canCalculateRemaining = hasTarget && positiveTotals(remaining).kcal > 40;
  const sourceMeta = menuSourceMeta(activePlanSource);
  const menuName = activeChoice ? activeMenuDisplayName(activeChoice, activePlan, activePlanSource) : "Menu del dia";
  const menuSummary = activeChoice ? activeMenuSummary(activeChoice, activePlanSource) : "";
  const isOwnMenu = sourceMeta.key === "own";
  const isCoachMenu = sourceMeta.key === "coach";
  const flexiblePlan = flexiblePlanForChoice(row, activeChoice, activePlanSource);

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

      <section className="mt-3 flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-white/10 bg-black/25 p-3 text-left">
        <span className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-xl" aria-hidden="true">
            {choices.length > 1 ? MENU_BOX_EMOJI : MENU_EMOJI}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-xl font-black text-white" title={menuName}>
              {snapshot ? menuName : menuCountTitle(row)}
            </span>
            {snapshot ? (
              <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wide ${sourceMeta.pillClass}`}>
                {sourceMeta.label}
              </span>
            ) : null}
            <span className="mt-1 block text-sm font-bold text-zinc-400">{snapshot ? menuSummary : displayKcal(menuKcal)}</span>
            <span className="block truncate text-sm font-bold text-zinc-300">
              {snapshot ? displayMenuMacros(activeTotals) : "Toca para ver el detalle cuando haya menú"}
            </span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-2">
          {isOwnMenu ? (
            <button
              type="button"
              onClick={onEditActiveMenu}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]"
              aria-label={`Editar menu ${menuName}`}
              title="Editar menu"
            >
              <PencilLine size={18} />
            </button>
          ) : isCoachMenu ? (
            <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-zinc-300" title="Solo lectura">
              <Lock size={17} />
            </span>
          ) : null}
          <button
            type="button"
            onClick={onOpenMenuOptions || onView}
            className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200"
            aria-label={choices.length > 1 ? "Cambiar menu u opciones" : "Ver opciones de menu"}
            title="Opciones"
          >
            <MoreHorizontal size={20} />
          </button>
          <button
            type="button"
            onClick={onView}
            className="inline-flex h-11 items-center gap-1 rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 text-xs font-black text-sky-100"
            aria-label="Ver detalle del menu"
          >
            <span aria-hidden="true">{EYE_EMOJI}</span>
            <Eye size={15} />
          </button>
        </span>
      </section>

      <div className="mt-3 grid gap-2 rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-3">
        {hasTarget ? (
          <>
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
          </>
        ) : (
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-3 text-sm font-bold text-[#FFE8A3]">
            Meta diaria pendiente. Configura tus objetivos para comparar este menu contra kcal y macros reales.
            <Link to="/app/objetivos" className="ml-2 underline underline-offset-4">Ir a Objetivos</Link>
          </div>
        )}
      </div>

      {snapshot ? (
        <div className="mt-3 rounded-[1.2rem] border border-white/10 bg-black/20 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-black uppercase tracking-wide text-zinc-400">Vista rapida</span>
            <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
              {completedMealsLabel(completedCount, countableMeals.length || 0)}
            </span>
          </div>
          <FlexibleMarginSlotCard
            row={row}
            plan={flexiblePlan}
            saving={saving}
            canRecommend={canUseFlexibleRecommendations}
            onEdit={() => onOpenFlexibleMargin?.(row, "manual")}
            onCalculate={() => onOpenFlexibleMargin?.(row, "calculate")}
            onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(row)}
            compact
          />
          <DesktopMealsGrid
            row={row}
            effectiveMeals={effectiveMeals}
            onToggleMeal={onToggleMeal}
            onOpenMeal={onOpenMeal}
            canQuickEditMeals={isOwnMenu}
            onQuickEditMeal={onQuickEditMeal}
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
          <span className="grid leading-tight">
            <span>Calcular lo que falta</span>
            {!canAutoCompleteRemaining ? <span className="text-[10px] text-[#FFE8A3]/70">Disponible en Pro</span> : null}
          </span>
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
  canQuickEditMeals = false,
  onQuickEditMeal,
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
          <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Comidas del dia</span>
          <h4 className="mt-1 text-lg font-black text-white">Detalle visible del dia</h4>
        </div>
        <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-black text-[#FFE8A3]">
          {completedMealsLabel(completedCount, countableMeals.length || 0)}
        </span>
      </div>

      {effectiveMeals.length ? (
        <>
          <DesktopMealsGrid
            row={displayRow}
            effectiveMeals={effectiveMeals}
            onToggleMeal={onToggleMeal}
            onOpenMeal={onOpenMeal}
            canQuickEditMeals={canQuickEditMeals}
            onQuickEditMeal={onQuickEditMeal}
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
  canQuickEditMeals = false,
  onQuickEditMeal,
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
          canQuickEdit={canQuickEditMeals}
          onQuickEditMeal={onQuickEditMeal}
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
  canQuickEdit = false,
  onQuickEditMeal,
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
  const canEditThisMeal = canQuickEdit && !manual && !generated;

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

  function quickEditMeal(event) {
    event.stopPropagation();
    onQuickEditMeal?.(detailPayload);
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
                Todavia no agregaste alimentos.
              </div>
            )}
            {hiddenCount ? (
              <div className="px-1 text-xs font-black text-[#FFE8A3]">+{hiddenCount} alimentos mas</div>
            ) : null}
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {canEditThisMeal ? (
              <button
                type="button"
                onClick={quickEditMeal}
                disabled={saving}
                className="inline-flex min-h-10 items-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs font-black text-emerald-100 disabled:opacity-55"
              >
                {foods.length ? <PencilLine size={15} /> : <Plus size={15} />}
                {foods.length ? "Editar alimentos" : "Agregar alimentos"}
              </button>
            ) : null}
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
        const targetKcal = targetTotals(row).kcal;
        const hasTarget = hasConfiguredTarget(row);
        const menuKcal = choiceTotals(menuChoices(row)[0]).kcal;
        const pct = hasTarget && targetKcal ? Math.min(135, Math.round((menuKcal / targetKcal) * 100)) : 0;
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
            <div className="mt-3 text-sm font-black text-[#FFE8A3]">{hasTarget ? displayKcal(targetTotals(row).kcal) : "Meta pendiente"}</div>
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
  activePlanSource = "none",
  onClose,
  onMarkMissed,
  onToggleMeal,
  onOpenMeal,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onOpenRemaining,
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onRestoreGenerated,
  canMarkMeals,
  canAutoCompleteRemaining,
  canUseFlexibleRecommendations,
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
            activePlanSource={activePlanSource}
            onMarkMissed={onMarkMissed}
            onToggleMeal={onToggleMeal}
            onOpenMeal={onOpenMeal}
            onQuickEditMeal={onQuickEditMeal}
            onSaveAsSavedMeal={onSaveAsSavedMeal}
            onOpenRemaining={onOpenRemaining}
            onOpenFlexibleMargin={onOpenFlexibleMargin}
            onToggleFlexibleMarginCompleted={onToggleFlexibleMarginCompleted}
            onRestoreGenerated={onRestoreGenerated}
            canMarkMeals={canMarkMeals}
            canAutoCompleteRemaining={canAutoCompleteRemaining}
            canUseFlexibleRecommendations={canUseFlexibleRecommendations}
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
  activePlanSource = "none",
  onMarkMissed,
  onToggleMeal,
  onOpenMeal,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onOpenRemaining,
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onRestoreGenerated,
  canMarkMeals,
  canAutoCompleteRemaining,
  canUseFlexibleRecommendations,
  onUseAlternative,
  saving,
}) {
  if (!row) return null;
  const choices = menuChoices(row);
  const selectedAlternative = row?.tracking?.selectedAlternative;
  const canQuickEditMeals = menuSourceMeta(activePlanSource).key === "own";
  const hasTarget = hasConfiguredTarget(row);
  const activeChoice = trackingChoice(row) || choices[0] || null;
  const flexiblePlan = flexiblePlanForChoice(row, activeChoice, activePlanSource);

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
            {hasTarget ? `Meta ${displayKcal(targetTotals(row).kcal)} / ${displayMacros(targetTotals(row))}` : "Meta diaria pendiente"}
          </p>
        </div>
        <div className="grid gap-2">
          <button
            type="button"
            onClick={onOpenRemaining}
            disabled={!hasTarget || !canAutoCompleteRemaining}
            className="rounded-2xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-2 text-xs font-black text-[#FFE8A3] disabled:opacity-45"
          >
            <span className="grid leading-tight">
              <span>Calcular lo que falta</span>
              {!canAutoCompleteRemaining ? <span className="text-[10px] text-[#FFE8A3]/70">Disponible en Pro</span> : null}
            </span>
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

      {hasTarget ? (
        <div className="grid gap-2 rounded-3xl border border-white/10 bg-black/20 p-3 sm:grid-cols-3">
          <TrackingMiniPanel label="Meta" totals={targetTotals(row)} tone="gold" />
          <TrackingMiniPanel label="Consumido" totals={consumedTotals(row)} tone="green" />
          <TrackingMiniPanel label="Faltante" totals={remainingTotals(row)} tone={remainingTotals(row).kcal < -20 ? "red" : "blue"} />
        </div>
      ) : (
        <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/10 p-4 text-sm font-bold text-[#FFE8A3]">
          Todavia no configuraste una meta diaria.
          <Link to="/app/objetivos" className="ml-2 underline underline-offset-4">Configurar objetivos</Link>
        </div>
      )}

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

      <FlexibleMarginSlotCard
        row={row}
        plan={flexiblePlan}
        saving={saving}
        canRecommend={canUseFlexibleRecommendations}
        onEdit={() => onOpenFlexibleMargin?.(row, "manual")}
        onCalculate={() => onOpenFlexibleMargin?.(row, "calculate")}
        onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(row)}
      />

      <DesktopMealsSection
        row={row}
        weekRows={weekRows}
        onToggleMeal={onToggleMeal}
        onOpenMeal={onOpenMeal}
        canQuickEditMeals={canQuickEditMeals}
        onQuickEditMeal={onQuickEditMeal}
        onSaveAsSavedMeal={onSaveAsSavedMeal}
        onRestoreGenerated={onRestoreGenerated}
        canMarkMeals={canMarkMeals}
        saving={saving}
      />

    </section>
  );
}

function FlexibleMarginEditor({
  row,
  activePlanSource = "none",
  initialMode = "manual",
  canRecommend = false,
  saving = false,
  onClose,
  onSave,
}) {
  const choice = trackingChoice(row);
  const plan = flexiblePlanForChoice(row, choice, activePlanSource);
  const [mode, setMode] = useState(canRecommend && initialMode === "calculate" ? "calculate" : "manual");
  const [draftEntries, setDraftEntries] = useState(() => flexibleMarginEntries(row));
  const [completed, setCompleted] = useState(() => isFlexibleMarginCompleted(row));
  const [search, setSearch] = useState("");
  const [foods, setFoods] = useState([]);
  const [foodsLoading, setFoodsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [foodPicker, setFoodPicker] = useState(null);
  const [calcFoods, setCalcFoods] = useState([]);
  const [calcResult, setCalcResult] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const titleId = "flexible-margin-editor-title";

  useEffect(() => {
    if (!canRecommend && mode === "calculate") {
      setMode("manual");
      setCalcFoods([]);
      setCalcResult(null);
    }
  }, [canRecommend, mode]);

  const totals = useMemo(() => flexibleMarginTotals(draftEntries), [draftEntries]);
  const remaining = plan ? flexibleMarginRemaining(plan, draftEntries) : 0;
  const macroRemaining = plan ? flexibleMarginMacroRemaining(plan, draftEntries) : emptyTotals();
  const exceeded = remaining < -5;
  const completionState = plan ? flexibleMarginCompletionState(plan, draftEntries) : flexibleMarginCompletionState({}, draftEntries);
  const completionChecked = completed || completionState.autoComplete;
  const showNoFoodResults = searched && search.trim().length >= 2 && !foodsLoading && !foods.length;

  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape" && !saving) onClose?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, saving]);

  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setFoods([]);
      setFoodsLoading(false);
      setSearched(false);
      return undefined;
    }
    let alive = true;
    const timer = window.setTimeout(() => {
      setFoodsLoading(true);
      setSearched(true);
      listAlimentos({ search: term, limit: 12 })
        .then((data) => {
          if (!alive) return;
          setFoods(normalizeFoodSearchResults(data).slice(0, 12));
        })
        .catch((err) => {
          if (alive) {
            setError(err?.message || "No pudimos buscar alimentos.");
            setFoods([]);
          }
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

  function parseQuantity(value) {
    const number = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(number) ? number : 0;
  }

  function quantityStep(unit = "g") {
    const normalized = String(unit || "").toLowerCase();
    return normalized === "g" || normalized === "gr" || normalized === "gramos" ? 10 : 1;
  }

  function clampQuantity(value) {
    return Math.max(0.01, roundMacro(parseQuantity(value), 2));
  }

  function clearSearch() {
    setSearch("");
    setFoods([]);
    setSearched(false);
    setFoodPicker(null);
  }

  function openFoodPicker(food = {}) {
    const quantity = suggestedQuickFoodQuantity(food) || 100;
    setFoodPicker({
      food,
      quantity: String(quantity),
      useMode: canRecommend && mode === "calculate" ? "calculate" : "manual",
    });
    setError("");
  }

  function updateFoodPicker(patch = {}) {
    setFoodPicker((current) => current ? { ...current, ...patch } : current);
  }

  function adjustFoodPickerQuantity(delta = 0) {
    setError("");
    setFoodPicker((current) => {
      if (!current) return current;
      return { ...current, quantity: String(clampQuantity(parseQuantity(current.quantity) + delta)) };
    });
  }

  function normalizeCalcFood(food = {}) {
    const id = String(food.id || food._id || food.alimentoId || food.foodId || foodDisplayName(food));
    return {
      ...food,
      id,
      name: food.name || food.nombre || foodDisplayName(food),
      manualQuantity: food.manualQuantity ?? "",
    };
  }

  function addManualFood(food = {}, quantityValue = suggestedQuickFoodQuantity(food)) {
    if (!plan) return;
    const unit = foodDisplayUnit(food);
    const quantity = clampQuantity(quantityValue);
    if (!(quantity > 0)) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }
    const entry = flexibleMarginEntryFromFood(row, plan, food, quantity, unit, choice, { mode: "manual", itemSource: "manual" });
    const nextEntries = [...draftEntries, entry];
    if (!validateFlexibleLimit(nextEntries, "Ese alimento supera el margen flexible")) return;
    setDraftEntries(nextEntries);
    setError("");
    clearSearch();
  }

  function addCalcFood(food = {}, quantityValue = "") {
    if (!canRecommend) {
      setError("Las recomendaciones automaticas no estan disponibles para este acceso.");
      return;
    }
    const quantity = parseQuantity(quantityValue);
    const normalized = {
      ...normalizeCalcFood(food),
      manualQuantity: quantity > 0 ? String(roundMacro(quantity, 2)) : "",
    };
    setCalcFoods((current) =>
      current.some((item) => item.id === normalized.id)
        ? current.map((item) => item.id === normalized.id ? normalized : item)
        : [...current, normalized]
    );
    setMode("calculate");
    setCalcResult(null);
    setError("");
    clearSearch();
  }

  function commitFoodPicker() {
    if (!foodPicker?.food) return;
    const quantity = clampQuantity(foodPicker.quantity);
    if (!(quantity > 0)) {
      setError("La cantidad debe ser mayor a 0.");
      return;
    }
    if (foodPicker.useMode === "calculate") {
      if (!canRecommend) {
        setError("Las recomendaciones automaticas no estan disponibles para este acceso.");
        return;
      }
      addCalcFood(foodPicker.food, quantity);
      return;
    }
    addManualFood(foodPicker.food, quantity);
  }

  function updateEntryQuantity(entryId, value) {
    const quantity = parseQuantity(value);
    const nextEntries = draftEntries.map((entry) =>
      entry.id === entryId ? rescaleFlexibleMarginEntry(entry, row, plan, quantity, undefined, choice) : entry
    );
    setDraftEntries(nextEntries);
    setError("");
  }

  function validateFlexibleLimit(nextEntries = [], title = "Ese cambio supera el margen flexible") {
    const limit = macro(plan?.flexibleCalories);
    if (!limit) return true;
    const currentKcal = totals.kcal;
    const nextKcal = flexibleMarginTotals(nextEntries).kcal;
    const excess = nextKcal - limit;
    const isReducingExistingExcess = currentKcal > limit + 0.5 && nextKcal < currentKcal - 0.5;
    if (excess > 0.5 && !isReducingExistingExcess) {
      setError(`${title}: te pasarias por ${displayKcal(excess)}. Baja la cantidad o elegi otro alimento.`);
      return false;
    }
    return true;
  }

  function adjustEntryQuantity(entryId, currentValue, unit, direction = 1) {
    const next = clampQuantity(parseQuantity(currentValue) + (quantityStep(unit) * direction));
    updateEntryQuantity(entryId, next);
  }

  function removeEntry(entryId) {
    setDraftEntries((current) => current.filter((entry) => entry.id !== entryId));
  }

  function updateCompleted(nextCompleted) {
    if (nextCompleted && !completionState.canComplete) {
      setError(flexibleMarginCompletionBlockMessage(completionState));
      return;
    }
    setCompleted(nextCompleted);
    setError("");
  }

  function updateCalcFoodQuantity(foodId, value) {
    setCalcFoods((current) => current.map((food) => food.id === foodId ? { ...food, manualQuantity: value } : food));
    setCalcResult(null);
  }

  function removeCalcFood(foodId) {
    setCalcFoods((current) => current.filter((food) => food.id !== foodId));
    setCalcResult(null);
  }

  function calcManualQuantity(food = {}) {
    return parseQuantity(food.manualQuantity);
  }

  function hasCalcManualQuantity(food = {}) {
    return calcManualQuantity(food) > 0;
  }

  function fixedFoodPayload(food = {}) {
    const quantity = calcManualQuantity(food);
    const totalsFromFood = flexibleTotalsFromFood(food, quantity).totals;
    return {
      foodId: food.id,
      name: food.name || food.nombre,
      unit: food.unidad || food.unit || "g",
      quantity,
      kcal: totalsFromFood.kcal,
      protein: totalsFromFood.proteina,
      proteina: totalsFromFood.proteina,
      carbs: totalsFromFood.carbs,
      fat: totalsFromFood.grasas,
      grasas: totalsFromFood.grasas,
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

  function manualOnlyResult(selected = []) {
    const foodsFromManual = selected.map((food) => {
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
    const resultTotals = sumTotals(foodsFromManual.map(normalizeGeneratedFood));
    return {
      status: "ok",
      quality: "manual",
      message: "Totales calculados con cantidades manuales.",
      foods: foodsFromManual,
      totals: resultTotals,
      target: macroRemaining,
      diff: subtractTotals(resultTotals, macroRemaining),
    };
  }

  async function calculateSuggestions() {
    if (!canRecommend) {
      setError("Las recomendaciones automaticas no estan disponibles para este acceso.");
      return;
    }
    if (completed) {
      setError("Este margen ya esta marcado como completado.");
      return;
    }
    if (macroRemaining.kcal <= 5) {
      setError("No quedan calorias suficientes para calcular cantidades.");
      return;
    }
    if (!calcFoods.length) {
      setError("Elegi alimentos para calcular cantidades.");
      return;
    }
    try {
      setError("");
      setCalculating(true);
      const fixedFoods = calcFoods.filter(hasCalcManualQuantity).map(fixedFoodPayload);
      const pendingFoods = calcFoods.filter((food) => !hasCalcManualQuantity(food)).map(pendingFoodPayload);
      if (!pendingFoods.length) {
        setCalcResult(manualOnlyResult(calcFoods));
        return;
      }
      const payload = {
        target: {
          kcal: macroRemaining.kcal,
          proteina: macroRemaining.proteina,
          carbs: macroRemaining.carbs,
          grasas: macroRemaining.grasas,
        },
        mode: macroRemaining.carbs || macroRemaining.grasas ? "full" : "kcalProteina",
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
      setCalcResult(response);
    } catch (err) {
      setError(err?.message || "No se pudieron generar cantidades.");
    } finally {
      setCalculating(false);
    }
  }

  function suggestionTotals(result = {}) {
    if (result.totals) return totalFromLike(result.totals);
    return sumTotals((result.foods || []).map(normalizeGeneratedFood));
  }

  function suggestionWarning(result = {}) {
    const high = (result.foods || [])
      .map(normalizeGeneratedFood)
      .find((food) => {
        const unit = String(food.unit || "").toLowerCase();
        return (unit === "g" || unit === "gr" || unit === "gramos") ? food.quantity > 350 : food.quantity > 5;
      });
    return high ? "La cantidad sugerida es alta. Elegi otro alimento o combina varios." : "";
  }

  function applySuggestion() {
    if (!calcResult?.foods?.length || !plan) {
      setError("Genera una sugerencia antes de agregarla al margen.");
      return;
    }
    const generatedEntries = calcResult.foods.map((food) => {
      const normalized = normalizeGeneratedFood(food);
      return flexibleMarginEntryFromFood(
        row,
        plan,
        { ...normalized, source: normalized.fixedQuantity ? "manual_fixed" : "auto_calculated", flexibleMargin: true },
        normalized.quantity,
        normalized.unit,
        choice,
        { mode: "auto_calculated", itemSource: normalized.fixedQuantity ? "manual_fixed" : "auto_calculated" }
      );
    });
    setDraftEntries((current) => [...current, ...generatedEntries]);
    setCalcFoods([]);
    setCalcResult(null);
    setMode("manual");
    setError("");
  }

  function save() {
    const invalid = draftEntries.some((entry) => {
      const food = flexibleMarginEntryFood(entry);
      return !(parseQuantity(food.quantity ?? food.cantidad ?? entry.quantity ?? entry.cantidad) > 0);
    });
    if (invalid) {
      setError("Todas las cantidades deben ser mayores a 0.");
      return;
    }
    if (exceeded) {
      setError(`Este margen flexible era de ${displayKcal(plan.flexibleCalories)}. Estas registrando ${displayKcal(totals.kcal)} y te pasas por ${displayKcal(Math.abs(remaining))}. Baja la cantidad para guardar.`);
      return;
    }
    if (completed && !completionState.canComplete) {
      setError(flexibleMarginCompletionBlockMessage(completionState));
      return;
    }
    const finalCompleted = completed || completionState.autoComplete;
    const successMessage = finalCompleted && !completed
      ? "Calorias libres guardadas y marcadas como hecho."
      : "";
    onSave?.(draftEntries, finalCompleted, successMessage);
  }

  if (!plan) return null;

  const remainingAmount = Math.max(0, remaining);
  const overAmount = Math.abs(remaining);
  const progressPercent = completed
    ? 100
    : Math.max(0, Math.min(100, plan.flexibleCalories ? Math.round((totals.kcal / plan.flexibleCalories) * 100) : 0));
  const registeredSummary = `${displayKcal(totals.kcal)} / ${displayKcal(plan.flexibleCalories)} registradas`;
  const headerSummary = `${registeredSummary} - ${exceeded ? `exceso ${displayKcal(overAmount)}` : `restan ${displayKcal(remainingAmount)}`}`;
  const summaryVisual = completed
    ? {
      border: "border-emerald-300/35",
      card: "bg-emerald-300/[0.07]",
      dot: "border-emerald-200 bg-emerald-300",
      value: "text-emerald-200",
      fill: "from-emerald-300 to-emerald-500",
    }
    : exceeded
      ? {
        border: "border-orange-300/40",
        card: "bg-orange-300/[0.075]",
        dot: "border-orange-200 bg-orange-300",
        value: "text-orange-200",
        fill: "from-orange-300 to-rose-400",
      }
      : {
        border: "border-[#D4AF37]/35",
        card: "bg-[#D4AF37]/[0.065]",
        dot: "border-sky-200 bg-sky-300/30",
        value: "text-[#FFD76B]",
        fill: "from-[#D4AF37] to-sky-300",
      };
  const compactSummaryLine = completed
    ? `${displayKcal(plan.flexibleCalories)} cerradas`
    : exceeded
      ? `Exceso ${displayKcal(overAmount)}`
      : `Restan ${displayKcal(remainingAmount)}`;
  const searchModeIsCalculate = mode === "calculate";
  const searchHeading = searchModeIsCalculate ? "Elegir alimentos para calcular" : "Buscar alimento";
  const searchHelp = searchModeIsCalculate
    ? "Selecciona alimentos para que el sistema sugiera cantidades."
    : "Agrega alimentos al margen flexible y ajusta sus cantidades.";
  const calculateActionText = completed
    ? "Margen marcado como hecho."
    : canRecommend
      ? macroRemaining.kcal > 5
        ? calcFoods.length
          ? `${calcFoods.length} alimento${calcFoods.length === 1 ? "" : "s"} seleccionado${calcFoods.length === 1 ? "" : "s"} para calcular.`
          : `Ajustar cantidades para completar las ${displayKcal(macroRemaining.kcal)} restantes.`
            : "No quedan calorias suficientes para calcular."
      : "Disponible en Pro. Podes ajustar la cantidad manualmente.";
  const completionActionText = completed
    ? "Ya esta marcado como hecho. Podes reabrirlo si necesitas corregir cantidades."
    : completionState.autoComplete
      ? `Quedan ${displayKcal(completionState.missing)}. Al guardar se marcara como hecho automaticamente.`
      : completionState.canComplete
        ? `Quedan ${displayKcal(completionState.missing)}. Ya podes marcarlo como hecho.`
        : flexibleMarginCompletionBlockMessage(completionState);
  const pickerFood = foodPicker?.food || null;
  const pickerUnit = pickerFood ? foodDisplayUnit(pickerFood) : "g";
  const pickerQuantity = parseQuantity(foodPicker?.quantity);
  const pickerTotals = pickerFood && pickerQuantity > 0 ? flexibleTotalsFromFood(pickerFood, pickerQuantity).totals : emptyTotals();
  const pickerStep = quantityStep(pickerUnit);

  return (
    <section className="fixed inset-0 z-[95] flex items-end bg-black/80 px-0 pt-5 backdrop-blur-md sm:items-center sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onClose} aria-label="Cerrar calorias libres" />
      <div className="relative mx-auto flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.7rem] border border-white/10 bg-[linear-gradient(145deg,#101821_0%,#07111b_48%,#05080d_100%)] shadow-[0_30px_110px_rgba(0,0,0,.78)] sm:max-h-[92dvh] sm:rounded-[1.8rem]" style={{ maxWidth: "896px" }}>
        <div className="mx-auto mt-3 h-1.5 w-20 shrink-0 rounded-full bg-white/20" aria-hidden="true" />
        <header className="flex shrink-0 items-start justify-between gap-4 px-4 pb-3 pt-5 sm:px-6 sm:pb-4 sm:pt-6">
          <div className="min-w-0 flex-1">
            <span className="inline-flex min-h-8 items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-3 text-[11px] font-black uppercase tracking-[0.16em] text-sky-200 shadow-[inset_0_0_18px_rgba(56,189,248,.08)]">
              <Apple size={16} />
              Tracking flexible
            </span>
            <h3 id={titleId} className="mt-4 text-[2rem] font-black leading-[1.05] text-white sm:text-4xl">Editar calorias libres</h3>
            <p className="mt-2 text-sm font-bold leading-snug text-slate-400 sm:text-base">{headerSummary}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#D4AF37]/30 bg-white/[0.055] text-white shadow-[inset_0_0_22px_rgba(212,175,55,.06)] disabled:opacity-50 sm:h-14 sm:w-14" aria-label="Cerrar">
            <X size={24} strokeWidth={2.4} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="grid gap-4 sm:gap-5">
            <section className={`rounded-[1.05rem] border p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] ${summaryVisual.border} ${summaryVisual.card}`}>
              <div className="flex min-w-0 items-center justify-between gap-3">
                <div className="min-w-0">
                  <strong className={`block truncate text-lg font-black leading-tight sm:text-xl ${summaryVisual.value}`}>{registeredSummary}</strong>
                  <p className="mt-0.5 flex min-w-0 items-center gap-2 truncate text-xs font-black leading-tight text-slate-300 sm:text-sm">
                    <span className={`h-2 w-2 shrink-0 rounded-full border ${summaryVisual.dot}`} />
                    {compactSummaryLine}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-right text-sm font-black text-slate-200">{progressPercent}%</span>
              </div>
              <div className="mt-2 flex items-center gap-3">
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full border border-white/10 bg-sky-200/10">
                  <span className={`block h-full rounded-full bg-gradient-to-r ${summaryVisual.fill}`} style={{ width: `${progressPercent}%` }} />
                </div>
              </div>
            </section>

            <section className="rounded-[1.15rem] border border-white/10 bg-black/20 p-3 sm:p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h4 className="text-xl font-black text-white">{searchHeading}</h4>
                  <p className="mt-1 text-xs font-bold text-slate-500">{searchHelp}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${searchModeIsCalculate ? "border-sky-300/25 bg-sky-300/10 text-sky-200" : "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]"}`}>
                  {searchModeIsCalculate ? "Modo calcular" : "Agregar al margen"}
                </span>
              </div>
              <label className="mt-3 flex min-h-13 items-center gap-3 rounded-2xl border border-white/10 bg-[#050a0f] px-3">
                <Search size={22} className="shrink-0 text-slate-500" strokeWidth={1.8} />
                <input
                  value={search}
                  onChange={(event) => {
                    setSearch(event.target.value);
                    setFoodPicker(null);
                    setError("");
                  }}
                  placeholder="Buscar alimento"
                  className="min-w-0 flex-1 bg-transparent text-base font-black text-white outline-none placeholder:text-slate-600"
                />
              </label>
              {pickerFood ? (
                <div className="mt-3 rounded-[1.05rem] border border-[#D4AF37]/25 bg-[#D4AF37]/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,.06)]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FoodThumb food={{ ...pickerFood, name: foodDisplayName(pickerFood) }} size="sm" />
                      <div className="min-w-0">
                        <span className="text-[10px] font-black uppercase tracking-wide text-[#FFE8A3]">Agregar alimento al margen</span>
                        <strong className="mt-0.5 block truncate text-sm font-black text-white">{foodDisplayName(pickerFood)}</strong>
                        <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-400">
                          {foodLibraryMacroLine(pickerFood)}
                        </span>
                      </div>
                    </div>
                    <button type="button" onClick={() => setFoodPicker(null)} className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-slate-300" aria-label="Cancelar seleccion">
                      <X size={15} />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-end">
                    <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Cantidad
                      <span className="grid h-10 grid-cols-[38px_minmax(0,1fr)_38px] overflow-hidden rounded-xl border border-white/10 bg-[#050a0f]">
                        <button type="button" onClick={() => adjustFoodPickerQuantity(-pickerStep)} className="grid place-items-center border-r border-white/10 text-slate-300" aria-label="Restar cantidad">
                          <Minus size={15} />
                        </button>
                        <span className="flex min-w-0 items-center">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={foodPicker.quantity}
                            onChange={(event) => {
                              updateFoodPicker({ quantity: event.target.value });
                              setError("");
                            }}
                            className="min-w-0 flex-1 bg-transparent px-2 text-center text-sm font-black text-white outline-none"
                            aria-label={`Cantidad para ${foodDisplayName(pickerFood)}`}
                          />
                          <span className="shrink-0 pr-2 text-xs font-black text-[#FFE8A3]">{pickerUnit}</span>
                        </span>
                        <button type="button" onClick={() => adjustFoodPickerQuantity(pickerStep)} className="grid place-items-center border-l border-white/10 text-slate-300" aria-label="Sumar cantidad">
                          <Plus size={15} />
                        </button>
                      </span>
                    </label>
                    <span className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-slate-300">
                      {pickerQuantity > 0 ? `${formatNumber(pickerQuantity, 1)} ${pickerUnit} - ${displayKcal(pickerTotals.kcal)}` : "Defini una cantidad"}
                    </span>
                  </div>

                  {canRecommend ? (
                    <fieldset className="mt-3 grid gap-2" aria-label="Modo de uso del alimento">
                      <label className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 text-xs font-black ${foodPicker.useMode === "manual" ? "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]" : "border-white/10 bg-black/15 text-slate-300"}`}>
                        <input
                          type="radio"
                          name="flexible-food-use-mode"
                          checked={foodPicker.useMode === "manual"}
                          onChange={() => updateFoodPicker({ useMode: "manual" })}
                          className="h-4 w-4 accent-[#D4AF37]"
                        />
                        Agregar y trackear manualmente
                      </label>
                      <label className={`flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border px-3 text-xs font-black ${foodPicker.useMode === "calculate" ? "border-sky-300/35 bg-sky-300/10 text-sky-100" : "border-white/10 bg-black/15 text-slate-300"}`}>
                        <input
                          type="radio"
                          name="flexible-food-use-mode"
                          checked={foodPicker.useMode === "calculate"}
                          onChange={() => updateFoodPicker({ useMode: "calculate" })}
                          className="h-4 w-4 accent-sky-300"
                        />
                        Usarlo para calcular cantidades despues
                      </label>
                    </fieldset>
                  ) : (
                    <p className="mt-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2 text-xs font-bold leading-relaxed text-slate-500">
                      Podes ajustar la cantidad manualmente. El calculo automatico esta disponible en Pro.
                    </p>
                  )}

                  {error ? (
                    <div className="mt-3 rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-bold leading-relaxed text-rose-100" role="alert">
                      {error}
                    </div>
                  ) : null}

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => setFoodPicker(null)} className="min-h-10 rounded-xl border border-white/10 bg-black/20 px-3 text-xs font-black text-slate-300">
                      Cancelar
                    </button>
                    <button type="button" onClick={commitFoodPicker} className="min-h-10 rounded-xl bg-[#D4AF37] px-3 text-xs font-black text-black">
                      Agregar
                    </button>
                  </div>
                </div>
              ) : null}
              {foods.length && !foodPicker ? (
                <div className="mt-3 grid gap-2">
                  {foods.map((food, index) => {
                    const id = String(food.id || food._id || food.alimentoId || foodDisplayName(food) || index);
                    return (
                      <button
                        key={`${id}-${index}`}
                        type="button"
                        onClick={() => openFoodPicker(food)}
                        className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-3 text-left text-sm font-bold text-zinc-100 transition hover:border-[#D4AF37]/30 hover:bg-[#D4AF37]/10"
                      >
                        <span className="flex min-w-0 items-center gap-3">
                          <FoodThumb food={{ ...food, name: foodDisplayName(food) }} size="sm" />
                          <span className="min-w-0">
                            <span className="block truncate">{foodDisplayName(food)}</span>
                            <span className="mt-0.5 block truncate text-[11px] font-bold text-zinc-500">{foodLibraryMacroLine(food)}</span>
                          </span>
                        </span>
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]">
                          <Plus size={16} />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}
              {search.trim().length > 0 && search.trim().length < 2 ? (
                <div className="mt-2 rounded-2xl border border-dashed border-white/10 p-3 text-sm font-bold text-zinc-500">Escribi al menos 2 caracteres para buscar.</div>
              ) : null}
              {showNoFoodResults ? (
                <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-sm font-bold text-zinc-500">
                  No encontramos alimentos para esa busqueda.
                </div>
              ) : null}
              {foodsLoading ? <RefreshCw size={16} className="mt-3 animate-spin text-slate-400" /> : null}
            </section>

            <section>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h4 className="text-xl font-black text-white">Alimentos registrados</h4>
                <span className="text-sm font-black text-sky-200">
                  {draftEntries.length} alimento{draftEntries.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {draftEntries.map((entry) => {
                  const food = flexibleMarginEntryFood(entry);
                  const entryTotals = totalFromLike(entry.totals || food);
                  const quantity = food.quantity ?? food.cantidad ?? entry.quantity ?? entry.cantidad ?? "";
                  const unit = food.unit || food.unidad || entry.unit || entry.unidad || "g";
                  const name = food.name || food.nombre || entry.foodName || entry.name || "Alimento";
                  return (
                    <article key={entry.id} className="rounded-[0.95rem] border border-white/10 bg-white/[0.035] p-2">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5">
                        <FoodThumb food={{ ...food, name }} size="sm" />
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center justify-between gap-2">
                            <strong className="truncate text-sm font-black text-white">{name}</strong>
                            <span className="shrink-0 text-xs font-black text-[#FFE8A3]">{displayKcal(entryTotals.kcal)}</span>
                          </div>
                          <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-500">
                            {formatNumber(quantity, 1)} {unit} - P {formatNumber(entryTotals.proteina, 1)} / C {formatNumber(entryTotals.carbs, 1)} / G {formatNumber(entryTotals.grasas, 1)}
                          </span>
                        </div>
                        <button type="button" onClick={() => removeEntry(entry.id)} disabled={saving} className="grid h-8 w-8 place-items-center rounded-lg border border-rose-300/25 bg-rose-400/10 text-rose-100 disabled:opacity-50" aria-label={`Eliminar ${name}`}>
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="grid h-8 min-w-0 flex-1 grid-cols-[32px_minmax(0,1fr)_32px] overflow-hidden rounded-lg border border-white/10 bg-[#060b10]">
                          <button type="button" onClick={() => adjustEntryQuantity(entry.id, quantity, unit, -1)} disabled={saving} className="grid place-items-center border-r border-white/10 text-slate-300 disabled:opacity-50" aria-label={`Restar cantidad de ${name}`}>
                            <Minus size={15} />
                          </button>
                          <span className="flex min-w-0 items-center justify-center">
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={quantity}
                              onChange={(event) => updateEntryQuantity(entry.id, event.target.value)}
                              className="min-w-0 flex-1 bg-transparent px-2 text-center text-xs font-black text-white outline-none"
                              aria-label={`Cantidad de ${name}`}
                            />
                            <span className="shrink-0 pr-2 text-[11px] font-black text-[#FFE8A3]">{unit}</span>
                          </span>
                          <button type="button" onClick={() => adjustEntryQuantity(entry.id, quantity, unit, 1)} disabled={saving} className="grid place-items-center border-l border-white/10 text-slate-300 disabled:opacity-50" aria-label={`Sumar cantidad de ${name}`}>
                            <Plus size={15} />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!draftEntries.length ? (
                  <div className="rounded-[1.05rem] border border-dashed border-white/15 bg-white/[0.02] p-4 text-sm font-bold text-slate-500">
                    Todavia no agregaste alimentos a este margen.
                  </div>
                ) : null}
              </div>
              <p className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold leading-relaxed text-slate-500">
                Se guardara como Tracking del margen flexible del dia seleccionado.
              </p>
            </section>

            <section className="rounded-[1.05rem] border border-white/10 bg-white/[0.03] p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <h4 className="text-base font-black text-white">Acciones secundarias</h4>
                  <p className="mt-1 text-xs font-bold leading-relaxed text-slate-500">{calculateActionText}</p>
                  <p className={`mt-2 rounded-xl border px-3 py-2 text-xs font-black leading-relaxed ${
                    completionChecked
                      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-100"
                      : completionState.canComplete
                        ? "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]"
                        : "border-white/10 bg-black/15 text-slate-500"
                  }`}>
                    {completionActionText}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={completed || !canRecommend}
                    onClick={() => {
                      if (!completed && canRecommend) {
                        setMode((current) => current === "calculate" ? "manual" : "calculate");
                        setError("");
                        clearSearch();
                      }
                    }}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-black transition disabled:opacity-50 ${mode === "calculate" ? "border-sky-300/35 bg-sky-300/12 text-sky-100" : "border-white/10 bg-black/20 text-slate-300 hover:border-sky-300/25"}`}
                  >
                    {canRecommend ? <Calculator size={15} /> : <Lock size={15} />}
                    <span className="grid text-left leading-tight">
                      <span>Calcular cantidades</span>
                      {!canRecommend ? <span className="text-[10px] font-black text-slate-500">Disponible en Pro</span> : null}
                    </span>
                  </button>
                  <label className={`inline-flex min-h-10 items-center gap-2 rounded-2xl border px-3 text-xs font-black transition ${
                    completionChecked
                      ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"
                      : completionState.canComplete
                        ? "cursor-pointer border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFE8A3] hover:border-[#D4AF37]/45"
                        : "border-white/10 bg-black/20 text-slate-500"
                  }`}>
                    <input
                      type="checkbox"
                      checked={completionChecked}
                      disabled={!completed && (completionState.autoComplete || !completionState.canComplete)}
                      onChange={(event) => updateCompleted(event.target.checked)}
                      className="h-4 w-4 accent-emerald-300 disabled:opacity-60"
                    />
                    {completionChecked ? "Hecho" : "Marcar como hecho"}
                  </label>
                </div>
              </div>
            </section>

            {mode === "calculate" && canRecommend ? (
              <section className="rounded-[1.15rem] border border-sky-300/20 bg-sky-300/[0.055] p-3 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-black uppercase tracking-wide text-sky-200">Sugerencia automatica</span>
                    <h4 className="mt-1 text-lg font-black text-white">Restante del margen: {displayKcal(macroRemaining.kcal)}</h4>
                    <p className="mt-1 text-sm font-bold text-slate-400">
                      P {formatNumber(macroRemaining.proteina, 1)} / C {formatNumber(macroRemaining.carbs, 1)} / G {formatNumber(macroRemaining.grasas, 1)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={calculateSuggestions}
                    disabled={!canRecommend || completed || calculating || macroRemaining.kcal <= 5}
                    className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-sky-300/30 bg-sky-300/10 px-4 text-xs font-black text-sky-100 disabled:opacity-50"
                  >
                    {calculating ? <RefreshCw size={14} className="animate-spin" /> : <Calculator size={14} />}
                    Calcular cantidades
                  </button>
                </div>

                {!canRecommend ? (
                  <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm font-bold text-zinc-400">
                    Recomendaciones automaticas disponibles en Pro.
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2">
                  {calcFoods.map((food) => (
                    <div key={food.id} className="grid gap-3 rounded-2xl border border-sky-300/20 bg-black/20 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div className="flex min-w-0 items-center gap-3">
                        <FoodThumb food={food} size="sm" />
                        <span className="min-w-0">
                          <strong className="block truncate text-sm font-black text-white">{food.name || food.nombre}</strong>
                          <span className="mt-1 block truncate text-xs font-bold text-sky-100/70">{foodLibraryMacroLine(food)}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="flex h-10 min-w-0 flex-1 items-center gap-1 rounded-xl border border-white/10 bg-black/20 px-2 sm:w-28 sm:flex-none">
                          <input
                            value={food.manualQuantity ?? ""}
                            onChange={(event) => updateCalcFoodQuantity(food.id, event.target.value)}
                            inputMode="decimal"
                            placeholder="auto"
                            className="min-w-0 flex-1 bg-transparent text-right text-sm font-black text-white outline-none placeholder:text-[#FFE8A3]"
                            aria-label={`Cantidad fija de ${food.name || food.nombre}`}
                          />
                          <span className="shrink-0 text-xs font-black text-zinc-500">g</span>
                        </label>
                        <button type="button" onClick={() => removeCalcFood(food.id)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-black/20 text-zinc-300" aria-label={`Quitar ${food.name || food.nombre}`}>
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                  {!calcFoods.length ? (
                    <div className="rounded-2xl border border-dashed border-white/15 p-4 text-sm font-bold text-slate-500">
                      Agrega uno o mas alimentos desde el buscador para calcular cantidades.
                    </div>
                  ) : null}
                </div>

                {calcResult ? (
                  <div className="mt-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black uppercase tracking-wide text-emerald-100">Resultado</span>
                      <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[11px] font-black text-zinc-300">
                        Total {displayKcal(suggestionTotals(calcResult).kcal)}
                      </span>
                    </div>
                    <div className="mt-2 grid gap-1.5">
                      {calcResult.foods.map((food, index) => {
                        const item = normalizeGeneratedFood(food);
                        return (
                          <div key={item.id || index} className="grid gap-1 rounded-xl bg-black/15 px-2.5 py-2 text-sm font-bold text-zinc-100 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                            <span className="min-w-0">
                              <span className="block truncate">{item.name}</span>
                              <span className="mt-0.5 block text-[11px] font-bold text-zinc-500">
                                P {formatNumber(item.proteina, 1)} / C {formatNumber(item.carbs, 1)} / G {formatNumber(item.grasas, 1)}
                              </span>
                            </span>
                            <span className="inline-flex w-fit shrink-0 items-center gap-1 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-0.5 text-xs font-black text-[#FFE8A3]">
                              {formatNumber(item.quantity, 1)} {item.unit} - {displayKcal(item.kcal)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    {suggestionWarning(calcResult) ? (
                      <div className="mt-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-2 text-xs font-black text-[#FFE8A3]">
                        {suggestionWarning(calcResult)}
                      </div>
                    ) : null}
                    <button type="button" onClick={applySuggestion} className="mt-3 min-h-11 w-full rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-3 text-sm font-black text-emerald-100">
                      Usar cantidades sugeridas
                    </button>
                  </div>
                ) : null}
              </section>
            ) : null}

            {error && !pickerFood ? (
              <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100" role="alert">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <footer className="shrink-0 border-t border-white/10 bg-[#070b10]/95 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-6">
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-[52px] rounded-[1.1rem] border border-white/20 bg-white/[0.045] px-4 text-sm font-black text-slate-400 disabled:opacity-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => save(false)}
              disabled={saving}
              className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-[1.1rem] bg-gradient-to-r from-[#facc15] to-[#f5d76e] px-4 text-sm font-black text-[#080808] shadow-[0_16px_36px_rgba(212,175,55,.22)] disabled:opacity-60"
            >
              {!saving ? <Sparkles size={17} fill="currentColor" strokeWidth={1.8} /> : null}
              {saving ? "Guardando..." : completionState.autoComplete && !completed ? "Guardar y marcar hecho" : "Guardar asi"}
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
}

function QuickMealEditorDrawer({ context = {}, saving, onClose, onRetry, onSave }) {
  const [draftMeal, setDraftMeal] = useState(() => context.mealDraft || null);
  const [picker, setPicker] = useState(null);
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraftMeal(context.mealDraft || null);
    setPicker(null);
    setLocalError("");
  }, [context.token, context.mealDraft]);

  const title = draftMeal?.nombre || context.title || "Comida";
  const items = draftMeal?.items || [];
  const totals = sumTotals(items);
  const titleId = "quick-meal-editor-title";

  function updateItem(itemId, patch) {
    setDraftMeal((current) => ({
      ...(current || {}),
      items: (current?.items || []).map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  }

  function removeItem(itemId) {
    setDraftMeal((current) => ({
      ...(current || {}),
      items: (current?.items || []).filter((item) => item.id !== itemId),
    }));
  }

  function applyPickedFood(food, quantity, unit) {
    const nextItem = buildQuickMenuItemFromFood(food, quantity, unit);
    setDraftMeal((current) => {
      const currentItems = current?.items || [];
      if (picker?.mode === "replace") {
        return {
          ...(current || {}),
          items: currentItems.map((item) => (item.id === picker.itemId ? nextItem : item)),
        };
      }
      return {
        ...(current || {}),
        items: [...currentItems, nextItem],
      };
    });
    setPicker(null);
  }

  function save() {
    if (!draftMeal || saving) return;
    const invalid = (draftMeal.items || []).some((item) => !(Number(item.cantidad) > 0));
    if (invalid) {
      setLocalError("Todas las cantidades deben ser mayores a 0.");
      return;
    }
    onSave?.({
      ...draftMeal,
      items: (draftMeal.items || []).map(normalizeQuickMenuItem),
    });
  }

  return (
    <section className="fixed inset-0 z-[95] flex items-end bg-black/72 px-2 pt-8 backdrop-blur-md sm:items-center sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onClose} aria-label="Cerrar edicion rapida" />
      <div className="relative mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.7rem] border border-white/10 bg-[radial-gradient(circle_at_15%_0,rgba(45,212,191,.14),transparent_34%),radial-gradient(circle_at_100%_8%,rgba(212,175,55,.16),transparent_30%),linear-gradient(180deg,#101923,#070b10)] shadow-[0_28px_90px_rgba(0,0,0,.72)] sm:rounded-[1.7rem]">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-white/[0.025] p-4">
          <div className="min-w-0">
            <span className="inline-flex min-h-7 items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 text-[11px] font-black uppercase tracking-wide text-[#FFE8A3]">
              <PencilLine size={14} />
              Editar alimentos
            </span>
            <h3 id={titleId} className="mt-3 truncate text-2xl font-black leading-tight text-white">Editar {title}</h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              {displayKcal(totals.kcal)} - P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-zinc-100 disabled:opacity-50" aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {context.loading ? (
            <div className="flex min-h-36 items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/[0.035] text-sm font-black text-zinc-300">
              <RefreshCw size={18} className="animate-spin text-[#FFE8A3]" />
              Cargando menu...
            </div>
          ) : context.error ? (
            <div className="rounded-3xl border border-rose-400/25 bg-rose-400/10 p-4 text-sm font-bold text-rose-100">
              <strong className="block text-base font-black">No pudimos abrir esta comida.</strong>
              <span className="mt-1 block">{context.error}</span>
              <button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-2xl border border-rose-200/30 bg-rose-200/10 px-4 text-xs font-black text-rose-50">
                Reintentar
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3 text-xs font-bold leading-relaxed text-zinc-300">
                <strong className="block text-[#FFE8A3]">Estas editando tu dia base.</strong>
                Los cambios se veran durante toda la semana. El cumplimiento continuara siendo independiente por fecha.
              </div>

              {items.length ? (
                <div className="grid gap-2">
                  {items.map((item) => {
                    const normalized = normalizeMealFood(item);
                    return (
                      <article key={item.id} className="rounded-[1.15rem] border border-white/10 bg-white/[0.035] p-3">
                        <div className="flex min-w-0 items-start gap-3">
                          <FoodThumb food={normalized} size="sm" />
                          <div className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-black text-white">{item.nombreSnapshot || item.nombre || normalized.name}</strong>
                            <span className="mt-1 block text-xs font-bold text-zinc-500">
                              {displayKcal(item.kcal)} - P {formatNumber(item.proteina, 1)} / C {formatNumber(item.carbs, 1)} / G {formatNumber(item.grasas, 1)}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
                          <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
                            Cantidad
                            <span className="flex min-h-11 items-center overflow-hidden rounded-2xl border border-white/10 bg-black/24">
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={item.cantidad}
                                onChange={(event) => {
                                  setLocalError("");
                                  updateItem(item.id, rescaleQuickMenuItem(item, event.target.value));
                                }}
                                className="min-w-0 flex-1 bg-transparent px-3 text-sm font-black text-white outline-none"
                                aria-label={`Cantidad de ${item.nombreSnapshot || item.nombre || normalized.name}`}
                              />
                              <span className="shrink-0 border-l border-white/10 px-3 text-xs font-black normal-case text-[#FFE8A3]">{item.unidad || "g"}</span>
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setPicker({ mode: "replace", itemId: item.id, label: item.nombreSnapshot || item.nombre || normalized.name })}
                            className="min-h-11 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-3 text-xs font-black text-sky-100"
                          >
                            Reemplazar
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="min-h-11 rounded-2xl border border-rose-300/25 bg-rose-400/10 px-3 text-xs font-black text-rose-100"
                          >
                            Eliminar
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-4 text-sm font-bold text-zinc-400">
                  <strong className="block text-base font-black text-white">Todavia no agregaste alimentos.</strong>
                  <span className="mt-1 block">Agrega el primero para armar esta comida dentro de tu menu activo.</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => setPicker({ mode: "add" })}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-sm font-black text-[#FFE8A3]"
              >
                <Plus size={17} />
                Agregar alimento
              </button>

              {picker ? (
                <QuickFoodPicker
                  mode={picker.mode}
                  label={picker.label}
                  mealName={title}
                  onPick={applyPickedFood}
                  onCancel={() => setPicker(null)}
                />
              ) : null}

              {localError ? (
                <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100" role="alert">
                  {localError}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <footer className="grid shrink-0 gap-2 border-t border-white/10 bg-[#080d12]/96 p-4 sm:grid-cols-2">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-black text-zinc-200 disabled:opacity-50">
            Cancelar
          </button>
          <button
            type="button"
            onClick={save}
            disabled={saving || context.loading || !!context.error || !draftMeal}
            className="min-h-12 rounded-2xl bg-gradient-to-r from-[#facc15] to-[#f5d76e] px-4 text-sm font-black text-[#080808] shadow-[0_14px_30px_rgba(212,175,55,.20)] disabled:opacity-60"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </footer>
      </div>
    </section>
  );
}

function QuickFoodPicker({ mode = "add", label = "", mealName = "comida", onPick, onCancel }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const [selectedFood, setSelectedFood] = useState(null);
  const [quantity, setQuantity] = useState("100");
  const [unit, setUnit] = useState("g");
  const [servings, setServings] = useState("1");
  const [selectionError, setSelectionError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (selectedFood) return undefined;
    const term = debouncedSearch.trim();
    if (term.length < 2) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      setError("");
      return undefined;
    }

    let alive = true;
    setLoading(true);
    setSearched(true);
    setError("");

    listAlimentos({ search: term, limit: 12 })
      .then((data) => {
        if (!alive) return;
        setResults(normalizeFoodSearchResults(data).slice(0, 12));
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || "No pudimos buscar alimentos.");
        setResults([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [debouncedSearch, retryKey, selectedFood]);

  function selectFood(food) {
    const nextUnit = foodDisplayUnit(food);
    const nextQuantity = suggestedQuickFoodQuantity(food);
    setSelectedFood(food);
    setUnit(nextUnit);
    setQuantity(String(nextQuantity));
    setServings("1");
    setSelectionError("");
  }

  function submitFood() {
    const baseQuantity = Number(quantity);
    const portions = Number(servings);
    if (!selectedFood || !Number.isFinite(baseQuantity) || baseQuantity <= 0 || !Number.isFinite(portions) || portions <= 0) {
      setSelectionError("Ingresa una cantidad y porciones validas.");
      return;
    }
    const finalUnit = unit.trim();
    if (!finalUnit) {
      setSelectionError("La unidad no puede quedar vacia.");
      return;
    }
    onPick?.(selectedFood, Math.round(baseQuantity * portions * 100) / 100, finalUnit);
  }

  if (selectedFood) {
    const effectiveQuantity = Math.max(Number(quantity) || 0, 0) * Math.max(Number(servings) || 0, 0);
    const preview = buildMenuItemSnapshot(selectedFood, effectiveQuantity, unit || foodDisplayUnit(selectedFood));
    return (
      <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.055] p-3">
        <button type="button" onClick={() => setSelectedFood(null)} className="mb-3 inline-flex min-h-9 items-center gap-2 rounded-full border border-white/10 bg-black/20 px-3 text-xs font-black text-zinc-100">
          <ChevronLeft size={15} />
          Volver a resultados
        </button>
        <div className="grid gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wide text-emerald-200">{mode === "replace" ? "Reemplazo seleccionado" : "Alimento seleccionado"}</span>
            <strong className="mt-1 block text-base font-black text-white">{foodDisplayName(selectedFood)}</strong>
            <span className="text-xs font-bold text-zinc-500">{mealName ? `Para ${mealName}` : null}</span>
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
              Cantidad
              <input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-black text-white outline-none" />
            </label>
            <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
              Unidad
              <input value={unit} onChange={(event) => setUnit(event.target.value.slice(0, 18))} className="min-h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-black text-white outline-none" />
            </label>
            <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">
              Porciones
              <input type="number" min="0.01" step="0.01" value={servings} onChange={(event) => setServings(event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-black/24 px-3 text-sm font-black text-white outline-none" />
            </label>
          </div>
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <strong className="block text-lg font-black text-[#FFE8A3]">{displayKcal(preview.kcal)}</strong>
            <span className="mt-1 block text-sm font-bold text-zinc-300">
              P {formatNumber(preview.proteina, 1)} / C {formatNumber(preview.carbs, 1)} / G {formatNumber(preview.grasas, 1)}
            </span>
          </div>
          {selectionError ? <div className="rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">{selectionError}</div> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => setSelectedFood(null)} className="min-h-11 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-black text-zinc-200">Cancelar</button>
            <button type="button" onClick={submitFood} className="min-h-11 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-sm font-black text-[#FFE8A3]">
              {mode === "replace" ? "Reemplazar alimento" : "Agregar alimento"}
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-white/10 bg-black/20 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wide text-[#FFE8A3]">{mode === "replace" ? "Buscar reemplazo" : "Buscar alimento"}</span>
          {label ? <p className="mt-1 text-xs font-bold text-zinc-500">Reemplazando {label}</p> : null}
        </div>
        <button type="button" onClick={onCancel} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.045] text-zinc-200" aria-label="Cerrar buscador">
          <X size={16} />
        </button>
      </div>
      <label className="flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#080d12] px-3">
        <Search size={16} className="shrink-0 text-[#FFD76B]" />
        <input
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setError("");
          }}
          placeholder="Buscar alimento"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-500"
        />
        {loading ? <RefreshCw size={15} className="shrink-0 animate-spin text-zinc-400" /> : null}
      </label>

      {search.trim().length < 2 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-3 text-sm font-bold text-zinc-500">Escribi al menos 2 caracteres para buscar.</div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-sm font-bold text-rose-100">
          <span>{error}</span>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="mt-2 min-h-9 rounded-xl border border-rose-200/30 px-3 text-xs font-black">Reintentar</button>
        </div>
      ) : null}

      {!loading && !error && results.length ? (
        <div className="mt-3 grid gap-2">
          {results.map((food, index) => {
            const id = String(food.id || food._id || food.alimentoId || foodDisplayName(food) || index);
            const unitLabel = foodDisplayUnit(food);
            const qty = suggestedQuickFoodQuantity(food);
            const preview = buildMenuItemSnapshot(food, qty, unitLabel);
            return (
              <button key={`${id}-${index}`} type="button" onClick={() => selectFood(food)} className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-left active:scale-[0.99]">
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-black text-white">{foodDisplayName(food)}</strong>
                  <span className="mt-1 block truncate text-xs font-bold text-zinc-500">{formatNumber(qty, 0)} {unitLabel} - {displayKcal(preview.kcal)}</span>
                </span>
                <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2.5 py-1 text-[11px] font-black text-[#FFE8A3]">
                  P {formatNumber(preview.proteina, 0)}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && searched && debouncedSearch.length >= 2 && !results.length ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/10 p-3 text-sm font-bold text-zinc-500">No encontramos alimentos para "{debouncedSearch}".</div>
      ) : null}
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
        <strong>Todavia no tenes menu para {row?.dayLabel}</strong>
      </div>
      <p className="mt-2 text-sm font-semibold text-zinc-400">
        Organiza tu alimentacion a tu manera: crea un menu propio, explora la biblioteca ZumaFit o registra libremente en Tracking.
      </p>
      <div className="mx-auto mt-5 grid h-32 w-32 place-items-center rounded-full border border-[#D4AF37]/20 bg-[radial-gradient(circle,rgba(212,175,55,.18),rgba(255,255,255,.03)_58%,transparent_70%)] text-[#FFE8A3]">
        <div className="grid place-items-center gap-1">
          <Apple size={40} strokeWidth={1.8} />
          <Utensils size={32} strokeWidth={1.8} />
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          to="/app/menu/nuevo"
          state={{ from: "/app/menu" }}
          className="inline-flex rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-r from-[#facc15] to-[#f5d76e] px-4 py-2 text-sm font-black text-[#080808]"
          {...createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false })}
        >
          Crear mi menu
        </Link>
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
  canEditOwnMenuMeal = false,
  onQuickEditMeal,
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
  const canEditThisMeal = canEditOwnMenuMeal && !manual && !generated;

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

          {canEditThisMeal ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => onQuickEditMeal?.({ ...context, row, meal, baseMeal, mealIndex })}
              className="mb-3 flex min-h-12 w-full items-center justify-between rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-4 text-sm font-black text-emerald-100 shadow-[0_10px_24px_rgba(0,0,0,.18)] transition active:scale-[0.99] disabled:opacity-55"
            >
              <span className="flex min-w-0 items-center gap-2">
                {foods.length ? <PencilLine size={17} className="shrink-0" /> : <Plus size={17} className="shrink-0" />}
                <span className="truncate">{foods.length ? "Editar alimentos del menu" : "Agregar alimentos al menu"}</span>
              </span>
              <ChevronRight size={18} className="shrink-0" />
            </button>
          ) : null}

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
                      {displayKcal(option.totals.kcal)} - P {formatNumber(option.totals.proteina, 0)} g - {mealFoods(option.meal).length} alimentos
                    </span>
                  </div>
                  <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-200">
                    {option.badge}
                  </span>
                </div>
                <div className="mt-2 text-[11px] font-bold text-zinc-500">
                  Dif. {signedNumber(option.diff.kcal)} kcal - P {signedNumber(option.diff.proteina)} g
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
              {[food.amount, foodMacroLine(food)].filter(Boolean).join(" - ") || "Sin detalle cargado"}
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
                          {formatNumber(option.cantidadSugerida, 1)} {option.unidadSugerida || option.unidad || "g"} - {displayKcal(option.totales?.kcal ?? option.kcal)}
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
                      {option.amount || `${formatNumber(option.cantidad, 1)} ${option.unidad || "g"}`} - {displayKcal(option.totals?.kcal)}
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
                Dif. {signedNumber(selected.diff?.kcal)} kcal - P {signedNumber(selected.diff?.proteina, 1)} - C {signedNumber(selected.diff?.carbs, 1)} - G {signedNumber(selected.diff?.grasas, 1)}
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
                      Meta {displayKcal(activeTarget?.totals?.kcal)} - P {formatNumber(activeTarget?.totals?.proteina, 0)} / C {formatNumber(activeTarget?.totals?.carbs, 0)} / G {formatNumber(activeTarget?.totals?.grasas, 0)}
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
                            {formatNumber(item.quantity, 1)} {item.unit} - {displayKcal(item.kcal)}
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
                        <div>Total {displayKcal(totals.kcal)} - P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}</div>
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
