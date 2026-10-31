import React, { useEffect, useMemo, useRef, useState } from "react";
import MealTargetTrackingPanel from "../../tracking/MealTargetTrackingPanel.jsx";
import { useQuery } from "@tanstack/react-query";
import QuickTrackingFoodDrawer from "../../tracking/QuickTrackingFoodDrawer.jsx";

import {
  useDeleteFoodLog,
  useTrackingDay,
} from "../../tracking/trackingQueries.js";


import { Link, useLocation, useNavigate } from "react-router-dom";
import BrandLogo from "../../ui/BrandLogo.jsx";
import {
  AlertTriangle,
  Apple,
  BookOpen,
  ClipboardPlus,
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
  Heart,
  Lock,
  LockOpen,
  Layers3,
  Minus,
  MoreHorizontal,
  MoonStar,
  PencilLine,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  SlidersHorizontal,
  Soup,
  Square,
  Sun,
  Sunrise,
  Target,
  Trash2,
  Utensils,
  WandSparkles,
  X,
} from "lucide-react";

import "./menuPlan.css";

import { apiFetch } from "../../Api.js";
import { getCachedUser } from "../../authCache.js";
import { queryClient, queryKeys } from "../../queryClient.js";
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
import {
  createCustomFood,
  deleteCustomFood,
  generateMealQuantities,
  listAlimentos,
  listCustomFoods,
  updateCustomFood,
} from "../../nutricion/nutricionApi.js";
import { buildMenuItemSnapshot, getFoodImageUrl, placeholderForFoodCategory } from "../../nutricion/nutricionUtils.js";
import { authorizeClientMenuGeneration, createClientMenu, deleteClientMenu, getClientMenu, updateClientMenu } from "../../clientMenus/clientMenusApi.js";
import { generateClientMenuPreview } from "../../clientMenus/clientMenuGeneration.js";
import { MEAL_NUTRITION_POLICY } from "../../nutricion/mealNutritionResult.js";
import {
  CLIENT_PLAN_CAPABILITIES_STALE_TIME,
  clientPlanCapabilitiesKey,
  fetchClientPlanCapabilities,
} from "../../clientPlans/clientPlanQueries.js";
import {
  resolveSelectedMenuDate,
  useCurrentLocalDate,
} from "../../hooks/useCurrentLocalDate.js";
import { createNavigationPrefetchHandlers } from "../../routes/routePrefetch.js";
import { createSavedMeal, listSavedMeals } from "../../savedMeals/savedMealsApi.js";
import { createDayFavorite } from "./dayFavoritesApi.js";
import {
  addFoodLogsBatch,
  getTrackingDay,
  saveMenuTrackingDay,
  updateTrackingMealsConfig,
  updateManualDayCompletion,
} from "../../tracking/trackingApi.js";
import { calculateManualDayProgress } from "../../tracking/manualDayCompletion.js";
import {
  ManualDayCompletionAction,
  ManualDayCompletionDialog,
} from "./ManualDayCompletion.jsx";
import EquivalentMealBuilder from "./EquivalentMealBuilder.jsx";
import MenuGenerationSettingsWizard from "./MenuGenerationSettingsWizard.jsx";
import { buildCompletionTrackingBatch, resolveEquivalentMealAccess } from "./menuEquivalentMeal.js";
import {
  activateMealReplacement,
  mealReplacementSelectionKey,
  mealReplacementSlot,
  replaceClientGeneratedSlot,
  replacementBelongsToMeal,
} from "./mealAlternativeSelection.js";
import { menuWeekCacheKey, menuWeekCacheOwner } from "./menuWeekCache.js";
import {
  isMealTargetCalorieComplete,
  MEAL_TARGET_KCAL_TOLERANCE,
} from "./mealTargetCompletion.js";
import {
  appendPersonalMealTargetConfig,
  assertPersonalMealTargetNotBelowConsumed,
  buildPersonalMealTargetDayPlan,
  buildVariedPersonalMealTargetDayPlan,
  calculateLockedMealMacros,
  combineConsumedMealsByType,
  consumedMealsWithoutPersonalTarget,
  confirmPersonalMealTargetConsumption,
  editablePersonalMealTargetIds,
  editPersonalMealTargetDay,
  generationNutritionBudget,
  generationTrackingBreakdown,
  isPersonalMealTargetConfig,
  manualMealTargetOverageReview,
  personalMealTargetConfigsFromPlan,
  personalMealTargetConfigsFromReconciliation,
  personalMealTargetDayReconciliation,
  personalMealTargetDistributionSignature,
  personalMealTargetFlexiblePlan,
  personalMealTargetConfirmationReview,
  personalMealTargetCompletionState,
  personalMealTargetCanRegenerate,
  personalMealTargetConsumedComposition,
  personalMealTargetAutomaticSpecs,
  personalMealTargetOrigin,
  plannedMealCompositionOrigin,
  plannedMealCompositionOrigins,
  reconcilePlannedMealsWithPersonalTargets,
  removePersonalMealTargetFromTrackingDay,
  personalMealTargetTotalFitsBudget,
  personalMealTargetTotals,
  personalMealTargetsFromTrackingDay,
  mergeConsumedMealsIntoPersonalTargetPlan,
  PERSONAL_MEAL_TARGET_ORIGIN,
  reopenPersonalMealTargetConsumption,
  replacePersonalMealTargetConfigs,
  resolvePersonalMealTargetRemovals,
  updateCoachMealTargetExecution,
} from "./quickMealTargetPlan.js";
import {
  buildNativeMealTargetDrawerContext,
  mealTargetExecutionSeed,
  resolveMealTargetPlanEntry,
} from "./mealTargetIdentity.js";
import {
  loadTrackingDraftState,
  saveTrackingDraftState,
  trackingDraftKey,
  trackingDraftStorageOwner,
} from "../../tracking/trackingQuantityDrafts.js";
import { trackingDayRevision } from "../../tracking/trackingDayRevision.js";
import {
  DEFAULT_MENU_GENERATION_SETTINGS,
  automaticGenerationRequiresPlan,
  buildAutonomousMenuGenerationRequest,
  dayKeyFromIsoDate,
  generationActionForSettings,
  generationModeLabel,
  libraryTargetPath,
  loadMenuGenerationSettings,
  resolveAutonomousMenuActions,
  saveMenuGenerationSettings,
  shouldRegenerateBalancedTargetPlan,
} from "./menuQuickActions.js";

const EMPTY_DAYS = [];
const MENU_WEEK_CACHE_TTL_MS = 5 * 60 * 1000;
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
const MenuAutonomousActionsContext = React.createContext(null);
const MealChoiceActionsContext = React.createContext(null);

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function todayIso() {
  const now = new Date();
  const localTime = new Date(now.getTime() - (now.getTimezoneOffset() * 60_000));
  return localTime.toISOString().slice(0, 10);
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

function getMenuWeekCacheEntry(start, owner) {
  const key = menuWeekCacheKey(start || mondayOfWeek(), owner);
  const cached = menuWeekMemoryCache.get(key);
  if (!cached?.data) return null;
  if (Date.now() - cached.savedAt > MENU_WEEK_CACHE_TTL_MS) {
    menuWeekMemoryCache.delete(key);
    return null;
  }
  return cached;
}

function getCachedMenuWeek(start, owner) {
  const cached = getMenuWeekCacheEntry(start, owner);
  return cached?.data || null;
}

function setCachedMenuWeek(start, owner, data) {
  if (!start || !data) return;
  menuWeekMemoryCache.set(menuWeekCacheKey(start, owner), {
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
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function formatLongDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  const label = date.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
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
    primary.menuId ||
      snapshot.baseId ||
      activePlan?.menuId ||
      snapshot.id ||
      snapshot._id ||
      ""
  );
}

function isDateScopedOwnMenuChoice(choice = {}, date = "") {
  const assignment = choice?.assignment || {};
  const snapshot = choice?.snapshot || assignment?.menuSnapshot || {};
  const snapshotId = String(snapshot.id || snapshot._id || "");
  const explicitDate = String(assignment.activationDate || "").slice(0, 10);
  const inferredDate = date && snapshot.baseId && snapshotId.endsWith(`-${date}`) ? date : "";
  const activationDate = explicitDate || inferredDate;
  const source = String(assignment.source || snapshot.source || "").trim().toLowerCase();
  const editableDailySource = ["manual", "autonomous", "automatic"].includes(source);
  return Boolean(
    activationDate &&
    (!date || activationDate === date) &&
    editableDailySource &&
    (assignment.menuId || snapshot.baseId)
  );
}

function canQuickEditMenuChoice(choice = {}, activePlanSource = "none", date = "") {
  return menuSourceMeta(activePlanSource).key === "own" || isDateScopedOwnMenuChoice(choice, date);
}

function isFreePlannedMenuMeal(row = {}) {
  const choice = trackingChoice(row);
  return isDateScopedOwnMenuChoice(choice, row?.date) &&
    String(choice?.assignment?.source || choice?.snapshot?.source || "").trim().toLowerCase() === "manual";
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
      title: "Todavía no tenés menú para este día.",
      text: "Cuando tu coach lo asigne, lo vas a ver acá.",
      emptyMealsText: "Podés revisar otros días o avisarle a tu coach.",
    };
  }
  if (key === "own") {
    return {
      title: "Todavía no tenés menú propio para este día.",
      text: "Editá o activá tu menú propio para verlo acá con comidas y cantidades.",
      emptyMealsText: "Editá tu menú propio para agregar comidas y alimentos.",
    };
  }
return {
  title: "Todavía no tenés menú para este día.",
  text: "Podés crear uno o registrar algo que ya comiste.",
  emptyMealsText: "Creá tu menú o usá Tracking mientras lo armás.",
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

function normalizeMenuTargetMealType(value = "") {
  const text = String(value || "")
    .trim()
    .toLowerCase();

  if (text.includes("desay")) return "desayuno";
  if (text.includes("almuer")) return "almuerzo";
  if (text.includes("meriend")) return "merienda";
  if (text.includes("cena")) return "cena";
  if (text.includes("snack")) return "snack";

  return "otra";
}

function menuTargetMealTypeLabel(type = "") {
  if (type === "desayuno") return "Desayuno";
  if (type === "almuerzo") return "Almuerzo";
  if (type === "merienda") return "Merienda";
  if (type === "cena") return "Cena";
  if (type === "snack") return "Snack";

  return "Comida";
}

function safeMenuTargetId(value = "") {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    // Debe coincidir con normalizeMealId (80) menos "menu_target_" (12).
    .slice(0, 68);
}

function menuTargetPlanMeal(row = {}, baseMeal = {}, mealIndex = 0) {
  return resolveMealTargetPlanEntry(row, baseMeal, mealIndex);
}

function menuTargetExecutionContext(
  row = {},
  meal = {},
  baseMeal = {},
  mealIndex = 0
) {
  const planned = menuTargetPlanMeal(
    row,
    baseMeal,
    mealIndex
  );

  const plannedTarget =
    planned?.target ||
    baseMeal?.target ||
    meal?.target ||
    {};

  const hasPlannedTarget = Boolean(
    Number(plannedTarget.kcal) ||
    Number(
      plannedTarget.p ??
      plannedTarget.proteina
    ) ||
    Number(
      plannedTarget.c ??
      plannedTarget.carbs
    ) ||
    Number(
      plannedTarget.g ??
      plannedTarget.grasas
    )
  );

  const target = hasPlannedTarget
    ? {
        kcal:
          macro(
            plannedTarget.kcal
          ),

        proteina:
          macro(
            plannedTarget.p ??
            plannedTarget.proteina
          ),

        carbs:
          macro(
            plannedTarget.c ??
            plannedTarget.carbs
          ),

        grasas:
          macro(
            plannedTarget.g ??
            plannedTarget.grasas
          ),
      }
    : mealTotals(meal);


  const type =
    normalizeMenuTargetMealType(
      planned?.type ||
      planned?.tipo ||
      baseMeal?.type ||
      baseMeal?.tipo ||
      baseMeal?.tipoComida ||
      mealName(
        baseMeal,
        mealIndex
      )
    );


  const label =
    planned?.label ||
    planned?.name ||
    planned?.nombre ||
    menuTargetMealTypeLabel(type);


  /*
   * =====================================================
   * ID ÚNICO COMPARTIDO CON TRACKING
   * =====================================================
   *
   * La prioridad tiene que ser el ID REAL de la comida
   * original del menú.
   *
   * Ej:
   *
   * demo-meal-demo-menu-2200-2300-180-0-3
   *
   * Tracking guarda los FoodLogs como:
   *
   * menu_target_demo-meal-demo-menu-2200-2300-180-0-3
   *
   * Menú debe consultar EXACTAMENTE ese mismo mealId.
   */

  const idSeed = mealTargetExecutionSeed({ baseMeal, meal, planned, mealIndex });


  const safeIdSeed = safeMenuTargetId(idSeed);

  return {
    id: safeIdSeed.startsWith("menu_target_")
      ? safeIdSeed
      : `menu_target_${safeIdSeed}`,

    label,
    type,
    target,
  };
}

function trackingItemsForExecution(
  trackingDay = null,
  executionId = ""
) {
  if (!executionId) return [];

  const meals =
    trackingDay?.meals || {};

  return Array.isArray(
    meals?.[executionId]
  )
    ? meals[executionId]
    : [];
}

function menuTargetCompletionState(
  row = {},
  meal = {},
  baseMeal = {},
  mealIndex = 0,
  trackingDay = null
) {
  const execution = menuTargetExecutionContext(row, meal, baseMeal, mealIndex);
  const trackedItems = trackingItemsForExecution(trackingDay, execution.id);
  const trackedTotals = sumTotals(trackedItems);

  return isMealTargetCalorieComplete({
    targetKcal: execution.target?.kcal,
    consumedKcal: trackedTotals.kcal,
    trackedItemsCount: trackedItems.length,
  });
}

function dailyTargetTrackingItems(row = {}, trackingDay = null) {
  if (
    !row?.date ||
    !hasConfiguredTarget(row) ||
    menuChoices(row).length ||
    plannedMealTargets(row).length
  ) {
    return [];
  }

  return trackingItemsForExecution(
    trackingDay,
    `daily_target_${row.date}`
  );
}


function standaloneTrackingMealLabel(
  mealId = "",
  items = []
) {
  const first =
    Array.isArray(items)
      ? items[0]
      : null;

  const explicit =
    first?.mealName ||
    first?.savedMealName ||
    first?.meal?.name ||
    first?.meal?.nombre ||
    "";

  if (explicit) {
    return explicit;
  }

  const itemType = String(first?.mealType || first?.tipoComida || "").trim().toLowerCase();
  const itemTypeLabel = menuTargetMealTypeLabel(normalizeMenuTargetMealType(itemType));
  if (itemType && itemTypeLabel && itemTypeLabel !== "Comida") {
    return itemTypeLabel;
  }

  const key =
    String(mealId || "")
      .trim()
      .toLowerCase();

  if (key === "picoteo") {
    return "Picoteo";
  }

  if (key === "desayuno") {
    return "Desayuno";
  }

  if (key === "almuerzo") {
    return "Almuerzo";
  }

  if (key === "merienda") {
    return "Merienda";
  }

  if (key === "cena") {
    return "Cena";
  }

  if (key === "snack") {
    return "Snack";
  }

  return "Comida";
}


function standaloneTrackingGroups(
  trackingDay = null
) {
  const meals =
    trackingDay?.meals || {};
  const activeTargetIds = new Set(
    (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [])
      .filter(isPersonalMealTargetConfig)
      .flatMap((meal) => [
        meal?.mealId || meal?.id,
        ...(Array.isArray(meal?.consumptionSourceMealIds) ? meal.consumptionSourceMealIds : []),
      ])
      .map(String)
      .filter(Boolean)
  );

  return Object.entries(meals)
    .filter(([mealId, items]) => {
      if (!Array.isArray(items)) {
        return false;
      }

      if (!items.length) {
        return false;
      }

      const key =
        String(mealId || "");

      /*
       * Estos pertenecen a otros flujos:
       *
       * - Por meta
       * - Meta diaria vieja
       * - márgenes/flexible
       *
       * No queremos duplicarlos acá.
       */
      if (
        activeTargetIds.has(key) ||
        key.startsWith("daily_target_") ||
        key.startsWith("flexible_")
      ) {
        return false;
      }

      return true;
    })
    .map(([mealId, items]) => {
      const savedMealIds = [...new Set(items.map((item) => String(item?.savedMealId || "")).filter(Boolean))];
      const entirelyFromSavedMeal = savedMealIds.length === 1
        && items.every((item) => String(item?.savedMealId || "") === savedMealIds[0]);

      return {
        id: mealId,
        label: standaloneTrackingMealLabel(mealId, items),
        mealType: String(items[0]?.mealType || items[0]?.tipoComida || mealId || "otra"),
        items,
        totals: sumTotals(items),
        entirelyFromSavedMeal,
        savedMealName: entirelyFromSavedMeal
          ? String(items[0]?.savedMealName || "").trim()
          : "",
      };
    });
}


function trackingFoodName(
  item = {}
) {
  return (
    item?.food?.nombre ||
    item?.food?.name ||
    item?.nombreSnapshot ||
    item?.nombre ||
    item?.name ||
    "Alimento"
  );
}


function trackingFoodQuantity(
  item = {}
) {
  const quantity =
    Number(
      item?.cantidad ??
      item?.quantity
    );

  if (
    !Number.isFinite(quantity)
  ) {
    return "";
  }

  const unit =
    item?.unidad ||
    item?.unit ||
    item?.food?.unidad ||
    item?.food?.unit ||
    "g";

  return `${formatNumber(
    quantity,
    quantity % 1 ? 1 : 0
  )} ${unit}`;
}


function trackingFoodImage(
  item = {}
) {
  return getFoodImageUrl(
    item?.food ||
    item
  );
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
  const completedIds = completedMealIdSet(row);
  const consumedReplacements = (entries = []) => (Array.isArray(entries) ? entries : [])
    .filter((entry) => {
      const replacedIds = Array.isArray(entry?.replacesMealIds) ? entry.replacesMealIds.map(String) : [];
      return !replacedIds.length || replacedIds.some((id) => completedIds.has(id));
    });
  return sumTotals([
    completedMenuMealsTotals(row),
    trackingListTotals(tracking.manualEntries),
    trackingListTotals(tracking.generatedRemainingMeals),
    trackingListTotals(consumedReplacements(tracking.mealReplacements)),
    trackingListTotals(consumedReplacements(tracking.foodReplacements)),
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

function plannedMealTargets(row = {}, trackingDay = null) {
  const plan = row?.mealTargetPlan;
  const executionConfigs = new Map(
    (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [])
      .filter((config) => config?.coachTargetExecution === true)
      .map((config) => [String(config.mealId || config.id || ""), config])
  );
  const coachTargets = plan?.mode === "per_meal" && Array.isArray(plan.meals)
    ? plan.meals.map((meal, index) => ({
    id: String(meal.id || `planned-meal-${index + 1}`),
    name: meal.label || meal.name || `Comida ${index + 1}`,
    nombre: meal.label || meal.name || `Comida ${index + 1}`,
    type: meal.type || "snack",
    tipo: meal.type || "snack",
    target: {
      kcal: macro(meal.target?.kcal),
      proteina: macro(meal.target?.p ?? meal.target?.proteina),
      carbs: macro(meal.target?.c ?? meal.target?.carbs),
      grasas: macro(meal.target?.g ?? meal.target?.grasas),
    },
    totals: {
      kcal: macro(meal.target?.kcal),
      proteina: macro(meal.target?.p ?? meal.target?.proteina),
      carbs: macro(meal.target?.c ?? meal.target?.carbs),
      grasas: macro(meal.target?.g ?? meal.target?.grasas),
    },
    foods: [],
    coachTargetOnly: true,
  })).map((meal) => {
    const execution = executionConfigs.get(String(meal.id));
    if (!execution) return meal;
    const executionTarget = totalFromLike(execution.meta || execution.target || {});
    return {
      ...meal,
      target: executionTarget,
      totals: executionTarget,
      metaConfirmed: execution.metaConfirmed === true,
      metaConfirmation: execution.metaConfirmation || null,
      coachTargetExecution: true,
      consumptionSourceMealIds: execution.consumptionSourceMealIds || [meal.id],
    };
  })
    : [];
  const knownIds = new Set(coachTargets.map((meal) => String(meal.id)));
  const personalTargets = personalMealTargetsFromTrackingDay(trackingDay)
    .filter((meal) => !knownIds.has(String(meal.id)));
  return [...coachTargets, ...personalTargets];
}

function plannedCompositionsByTarget(row = {}, targetMeals = [], plannedMeals = []) {
  const targetsById = new Map(
    (Array.isArray(targetMeals) ? targetMeals : [])
      .map((target) => [String(target?.id || target?.mealId || ""), target])
      .filter(([id]) => id)
  );
  const matches = new Map();

  (Array.isArray(plannedMeals) ? plannedMeals : []).forEach((meal, mealIndex) => {
    if (!mealHasContent(meal) || plannedMealCompositionOrigin(meal) === "auto") return;
    const executionId = menuTargetExecutionContext(row, meal, meal, mealIndex).id;
    const target = targetsById.get(String(executionId));
    if (!target) return;
    matches.set(String(target.id || target.mealId), {
      meal,
      mealIndex,
      executionId: String(executionId),
      baseMealId: mealId(meal, mealIndex),
    });
  });

  return matches;
}

function menuConsumedTotals(row = {}) {
  const tracking =
    row?.tracking || {};


  /*
   * =========================================
   * CONSUMO DEL MENÚ
   * =========================================
   *
   * Ej:
   * - comidas marcadas como Hechas
   * - reemplazos
   * - entradas propias del MenuPlan
   */

  const backendMenuTotals =
    tracking?.consumedTotals
      ? totalFromLike(
          tracking.consumedTotals
        )
      : emptyTotals();


  const localMenuTotals =
    localConsumedTotals(row);


  const hasLocalTrackingData = [
    tracking.completedMenuMealIds,
    tracking.manualEntries,
    tracking.generatedRemainingMeals,
    tracking.mealReplacements,
    tracking.foodReplacements,
  ].some(
    (list) =>
      Array.isArray(list) &&
      list.length
  );


  /*
   * Conservamos la lógica anterior:
   *
   * si hay cambios locales/optimistas del menú,
   * usamos esos.
   *
   * Si no, usamos lo que vino del backend.
   */

  let resolvedMenuTotals =
    emptyTotals();


  if (hasLocalTrackingData) {
    resolvedMenuTotals =
      localMenuTotals;
  } else if (
    hasTotalValue(
      backendMenuTotals
    )
  ) {
    resolvedMenuTotals =
      backendMenuTotals;
  } else {
    resolvedMenuTotals =
      localMenuTotals;
  }


  /*
   * =========================================
   * TRACKING REAL / FOODLOGS
   * =========================================
   *
   * Acá entran:
   *
   * - daily_target_<fecha>
   * - menu_target_<id>
   * - registros manuales de Tracking
   *
   * Esto es lo que antes Meta del día
   * NO estaba contando.
   */

  return resolvedMenuTotals;
}

function consumedTotals(row = {}) {
  const tracking = row?.tracking || {};
  const normalizedConsumed = totalFromLike(
    tracking?.normalizedConsumedTotals || tracking?.normalizedConsumption?.totals || {}
  );
  if (tracking?.normalizedConsumedTotals || tracking?.normalizedConsumption?.totals) {
    return normalizedConsumed;
  }
  const resolvedMenuTotals = menuConsumedTotals(row);
  const manualTrackingTotals =
    tracking?.manualTrackingTotals
      ? totalFromLike(
          tracking.manualTrackingTotals
        )
      : emptyTotals();


  /*
   * Caso normal:
   *
   * consumo menú
   * +
   * FoodLogs reales
   */

  if (
    hasTotalValue(
      manualTrackingTotals
    )
  ) {
    return addTotals(
      resolvedMenuTotals,
      manualTrackingTotals
    );
  }


  /*
   * Fallback:
   *
   * versiones/backend que ya manden
   * directamente el total combinado.
   */

  if (
    tracking?.totalConsumedTotals
  ) {
    const total =
      totalFromLike(
        tracking.totalConsumedTotals
      );

    if (
      hasTotalValue(total)
    ) {
      return total;
    }
  }


  return resolvedMenuTotals;
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
    source: safeItem.source || source.source || "",
    quantityMode: safeItem.quantityMode || safeItem.mode || safeItem.status || source.quantityMode || "manual",
    suggested: safeItem.suggested === true || safeItem.source === "addedCandidate" || source.suggested === true,
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
  if (["desayuno", "almuerzo", "merienda", "cena", "picoteo", "snack", "preentreno", "postentreno", "otro"].includes(normalized)) {
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
  const raw = food?.raw || {};
  const direct = Number(
    food.cantidad ??
    food.quantity ??
    food.qty ??
    food.gramos ??
    food.grams ??
    raw.cantidad ??
    raw.quantity ??
    raw.qty ??
    raw.gramos ??
    raw.grams
  );
  if (Number.isFinite(direct) && direct > 0) return direct;
  const match = String(food.amount || "").replace(",", ".").match(/\d+(\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function unitFromMenuFood(food = {}) {
  const raw = food?.raw || {};
  const nested = raw?.food || raw?.alimentoSnapshot || raw?.foodSnapshot || {};
  const direct = food.unidad || food.unit || raw.unidad || raw.unit || nested.unidad || nested.unit;
  if (direct) return direct;
  const match = String(food.amount || "").match(/[a-zA-Z]+/);
  return match?.[0] || "g";
}

function savedMealItemFromMenuFood(food = {}) {
  const raw = food?.raw || food || {};
  const nested = raw?.food || raw?.alimentoSnapshot || raw?.foodSnapshot || {};
  const totals = totalFromLike(food?.totals || food);
  const name =
    food.name ||
    food.nombre ||
    raw.nombreSnapshot ||
    raw.nombre ||
    raw.name ||
    nested.nombre ||
    nested.name ||
    "Alimento";
  return {
    alimentoId:
      raw.alimentoId ||
      raw.foodId ||
      nested.alimentoId ||
      nested.id ||
      nested._id ||
      food.alimentoId ||
      food.foodId ||
      "",
    nombre: name,
    cantidad: quantityFromMenuFood(food),
    unidad: unitFromMenuFood(food),
    kcal: totals.kcal,
    proteina: totals.proteina,
    proteinas: totals.proteina,
    carbs: totals.carbs,
    carbohidratos: totals.carbs,
    grasas: totals.grasas,
    fibra: macro(food.fibra ?? raw.fibra ?? nested.fibra),
    categoria: food.category || food.categoria || raw.categoriaSnapshot || raw.categoria || nested.categoria || "",
    imagenUrl: food.imageUrl || food.imagenUrl || raw.imagenUrl || nested.imagenUrl || getFoodImageUrl(nested),
    imagenAlt: food.imageAlt || food.imagenAlt || raw.imagenAlt || nested.imagenAlt || name,
  };
}

function savedMealSourceMeta(meal = {}, options = {}) {
  const explicit = String(options.sourceKind || "").trim().toLowerCase();
  const sourceText = `${meal?.compositionOrigin || ""} ${meal?.source || ""} ${meal?.mealType || ""}`.toLowerCase();
  const kind = explicit || (
    meal?.personalTargetOnly
      ? "target"
      : sourceText.includes("coach") || options.menuSource === "coach"
        ? "coach"
        : sourceText.includes("auto") || sourceText.includes("generated")
          ? "automatic"
          : sourceText.includes("manual")
            ? "manual"
            : "menu"
  );
  const labels = {
    target: "comida Por meta",
    coach: "menú del coach",
    automatic: "menú automático",
    manual: "planificación manual",
    picoteo: "Picoteo de Tracking",
    tracking: "Tracking",
    menu: "menú diario",
  };
  return { kind, label: labels[kind] || "menú diario" };
}

function savedMealPayloadFromMenuMeal(meal = {}, mealIndex = 0, options = {}) {
  const items = mealFoods(meal).map(savedMealItemFromMenuFood);
  const tipoComida = savedMealTipoFromMenuMeal(meal, mealIndex);
  const source = savedMealSourceMeta(meal, options);
  return {
    nombre: mealName(meal, mealIndex),
    descripcion: `Guardada desde ${source.label}`,
    tipoComida,
    origen: ["tracking", "picoteo", "target"].includes(source.kind)
      ? "guardadaDesdeTracking"
      : "guardadaDesdeMenu",
    tags: [...new Set(["menu", source.kind, ...(Array.isArray(options.tags) ? options.tags : [])])],
    items,
    favorita: options.favorite === true,
    ...(options.equivalenceReference ? { equivalenceReference: options.equivalenceReference } : {}),
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
    source: menu.source || menu.generationSource || fallbackChoice?.snapshot?.source || "manual",
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
    source: draft.source || "manual",
    selectedDays: Array.isArray(draft.selectedDays) && draft.selectedDays.length ? draft.selectedDays : ["monday"],
    comidas: nextComidas.map((meal, index) => ({
      id: meal.id || uid("meal"),
      nombre: meal.nombre || mealName(meal, index),
      tipoComida: meal.tipoComida || "otra",
      orden: Number(meal.orden ?? index + 1) || index + 1,
      target: meal.target || null,
      targetMealId: meal.targetMealId || null,
      targetOrigin: meal.targetOrigin || null,
      compositionOrigin: meal.compositionOrigin || "manual",
      generationSource: meal.generationSource || "",
      plannerSlotIndex: Number.isInteger(Number(meal.plannerSlotIndex))
        ? Number(meal.plannerSlotIndex)
        : null,
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

function effectiveMealEntriesForDay(row = {}, baseMeals = [], weekRows = [], trackingDay = null) {
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
      done:
        completed.has(mealId(meal, index)) ||
        menuTargetCompletionState(
          displayRow,
          mealWithTrackingReplacements(row, meal, index),
          meal,
          index,
          trackingDay
        ),
      generated: false,
      mealChoices: mealChoiceOptions(row, meal, index),
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



function trackingPayloadBase(
  row = {},
  overrides = {}
) {
  const tracking =
    row.tracking || {};

  return {
    date:
      row.date,

    dayKey:
      row.dayKey,

    completedMenuMealIds:
      Array.isArray(
        tracking.completedMenuMealIds
      )
        ? tracking.completedMenuMealIds
        : [],

    /*
     * IMPORTANTE:
     *
     * Conservamos siempre las comidas
     * que están en modo 🎯 Por meta.
     *
     * Así, por ejemplo, marcar otra
     * comida como Hecha no hace que
     * Almuerzo vuelva accidentalmente
     * a Pendiente.
     */
    targetMealIds:
      Array.isArray(
        tracking.targetMealIds
      )
        ? tracking.targetMealIds
        : [],

    suppressedMenuMealIds:
      Array.isArray(tracking.suppressedMenuMealIds)
        ? tracking.suppressedMenuMealIds
        : [],

    manualEntries:
      Array.isArray(
        tracking.manualEntries
      )
        ? tracking.manualEntries
        : [],

    generatedRemainingMeals:
      Array.isArray(
        tracking.generatedRemainingMeals
      )
        ? tracking.generatedRemainingMeals
        : [],

    mealReplacements:
      Array.isArray(
        tracking.mealReplacements
      )
        ? tracking.mealReplacements
        : [],

    foodReplacements:
      Array.isArray(
        tracking.foodReplacements
      )
        ? tracking.foodReplacements
        : [],

    selectedAlternative:
      tracking.selectedAlternative ||
      null,

    flexibleMarginCompleted:
      isFlexibleMarginCompleted(row),

    ...overrides,
  };
}




function targetMealIdSet(row = {}) {
  return new Set(
    (
      Array.isArray(row?.tracking?.targetMealIds)
        ? row.tracking.targetMealIds
        : []
    ).map(String)
  );
}

function suppressedMenuMealIds(row = {}) {
  return [...new Set(
    (Array.isArray(row?.tracking?.suppressedMenuMealIds)
      ? row.tracking.suppressedMenuMealIds
      : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  )];
}

function isMealTargetMode(row = {}, meal = {}, mealIndex = 0) {
  const id = mealId(meal, mealIndex);

  return targetMealIdSet(row).has(
    String(id)
  );
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
    entry?.source === "client_meal_replacement" &&
    entry?.isActiveReplacement !== false &&
    String(entry?.id || "").startsWith(prefix)
  ) || null;
}

function mealReplacementEntries(row = {}, meal = {}, mealIndex = 0) {
  return (Array.isArray(row?.tracking?.mealReplacements) ? row.tracking.mealReplacements : [])
    .filter((entry) => entry?.source === "client_meal_replacement" && replacementBelongsToMeal(entry, {
      date: row?.date,
      mealIndex,
      originalMealId: mealId(meal, mealIndex),
    }));
}

function mealFromReplacementEntry(originalMeal = {}, entry = {}, mealIndex = 0) {
  const foods = Array.isArray(entry.foods) ? entry.foods : [];
  return {
    ...originalMeal,
    id: mealId(originalMeal, mealIndex),
    name: entry.name || mealName(originalMeal, mealIndex),
    nombre: entry.name || mealName(originalMeal, mealIndex),
    source: "client_meal_replacement",
    replacementMeta: {
      type: "meal",
      slot: mealReplacementSlot(entry),
      originalName: mealName(originalMeal, mealIndex),
      approvalStatus: entry.approvalStatus || "approved",
      approvalReason: entry.approvalReason || "",
    },
    foods,
    items: foods,
    totals: totalsWithFallback(sumTotals(foods), addTotals(mealTotals(originalMeal), entry.totals)),
  };
}

function mealChoiceOptions(row = {}, meal = {}, mealIndex = 0) {
  const replacements = mealReplacementEntries(row, meal, mealIndex);
  const options = [{
    key: "original",
    label: "Original del coach",
    kind: "original",
    meal,
    active: !replacements.some((entry) => entry.isActiveReplacement !== false),
  }];
  replacements.forEach((entry) => {
    const slot = mealReplacementSlot(entry);
    options.push({
      key: mealReplacementSelectionKey(entry),
      label: slot === "client_generated" ? "Mi alternativa" : "Alternativa del coach",
      kind: slot,
      entry,
      meal: mealFromReplacementEntry(meal, entry, mealIndex),
      active: entry.isActiveReplacement !== false,
    });
  });
  mealReplacementOptions(row, meal, mealIndex).forEach((candidate) => {
    const candidateTotals = mealTotals(candidate.meal);
    const duplicate = options.some((option) => {
      const totals = mealTotals(option.meal);
      return mealName(option.meal, mealIndex) === mealName(candidate.meal, mealIndex) &&
        Math.round(totals.kcal) === Math.round(candidateTotals.kcal);
    });
    if (duplicate) return;
    options.push({
      key: `coach-candidate-${candidate.key}`,
      label: "Alternativa del coach",
      kind: "coach_assigned",
      candidate: true,
      meal: candidate.meal,
      active: false,
    });
  });
  return options;
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
    source: food.source || "",
    quantityMode: food.quantityMode || food.mode || food.status || "manual",
    suggested: food.suggested === true || food.source === "addedCandidate",
  };
}

function equivalentBuilderSeedFood(food = {}, index = 0) {
  const quantity = quantityFromMenuFood(food);
  const totals = totalFromLike(food?.totals || food);
  const divisor = quantity > 0 ? quantity : 1;
  return {
    ...food,
    id: String(food.alimentoId || food.foodId || food.id || `food-${index + 1}`),
    alimentoId: food.alimentoId || food.foodId || food.id || null,
    nombre: food.name || food.nombre || food.nombreSnapshot || `Alimento ${index + 1}`,
    unidad: unitFromMenuFood(food),
    cantidad: quantity,
    macroBasis: "perUnit",
    kcal: totals.kcal / divisor,
    proteina: totals.proteina / divisor,
    carbs: totals.carbs / divisor,
    grasas: totals.grasas / divisor,
    quantityMode: food.quantityMode || food.mode || food.status || "manual",
    suggested: food.suggested === true || food.source === "addedCandidate",
  };
}

function mealWithTrackingReplacements(row = {}, meal = {}, mealIndex = 0) {
  const mealEntry = mealReplacementEntry(row, mealIndex);
  if (mealEntry) {
    return mealFromReplacementEntry(meal, mealEntry, mealIndex);
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
  const replacementSlot = replacementMeal?.replacementSlot || (replacementMeal?.replacementMode === "custom_equivalent" ? "client_generated" : "coach_assigned");
  const replacementIdentity = replacementMeal?.replacementIdentity || (replacementSlot === "client_generated"
    ? mealId(originalMeal, mealIndex)
    : mealId(replacementMeal, mealIndex));
  return {
    id: `${mealReplacementPrefix(row, mealIndex)}-${trackingIdPart(replacementIdentity)}`.slice(0, 100),
    name: replacementName,
    source: "client_meal_replacement",
    replacementSlot,
    selectionKey: `${replacementSlot}:${trackingIdPart(replacementIdentity)}`.slice(0, 160),
    isActiveReplacement: true,
    mode: replacementMeal?.replacementMode || null,
    creationType: replacementMeal?.creationType || "full_meal_equivalent",
    strategy: replacementMeal?.strategy || "selected_only",
    requestId: replacementMeal?.requestId || null,
    menuId: replacementMeal?.menuId || null,
    menuVersion: replacementMeal?.menuVersion || null,
    originalMealId: replacementMeal?.originalMealId || mealId(originalMeal, mealIndex),
    originalMealName: replacementMeal?.originalMealName || mealName(originalMeal, mealIndex),
    warnings: replacementMeal?.warnings || [],
    favoriteOriginId: replacementMeal?.favoriteOriginId || null,
    date: row?.date || null,
    replacesMealIds: [mealId(originalMeal, mealIndex)],
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
    creationType: "food_equivalent",
    strategy: "selected_only",
    date: row?.date || null,
    originalMealId: mealId(meal, mealIndex),
    originalMealName: mealName(meal, mealIndex),
    originalFoodId: String(food.alimentoId || food.id || food.foodId || ""),
    originalFoodIndex: foodIndex,
    replacesMealIds: [mealId(meal, mealIndex)],
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




function manualCompletionSummaryForRow(row, enabled = true, trackingDay = null, legacyTargetMeals = []) {
  const choice = trackingChoice(row);
  const completedIds = completedMealIdSet(row);
  const menuMeals = trackingDay
    ? reconcilePlannedMealsWithPersonalTargets({
        plannedMeals: choiceMeals(choice),
        trackingDay,
        completedMealIds: [...completedIds],
        suppressedMealIds: suppressedMenuMealIds(row),
        legacyTargetMeals,
        menuSource: choice?.snapshot?.source,
      }).meals
    : choiceMeals(choice);
  const completed = menuMeals.reduce(
    (count, meal, index) => count + (completedIds.has(mealId(meal, index)) ? 1 : 0),
    0
  );
  const total = menuMeals.length;
  const active = row?.tracking?.dayCompletionMode === "manual_completion";
  const status = row?.tracking?.status || "pending";
  const show =
    enabled &&
    Boolean(row?.date && choice && total > 0) &&
    row.date <= todayIso() &&
    (active || (completed < total && status !== "missed"));

  return { row, choice, completed, total, active, show };
}

export default function MenuPlan() {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = useMemo(() => getCachedUser() || {}, []);
  const menuCacheOwner = useMemo(() => menuWeekCacheOwner(currentUser), [currentUser]);
  const [quickSettings, setQuickSettings] = useState(() => loadMenuGenerationSettings(currentUser));
  const targetDistributionHistoryRef = useRef([]);
  const quickGenerationInFlightRef = useRef(false);
  const legacyRetirementMigrationRef = useRef(new Set());
  const [quickSettingsOpen, setQuickSettingsOpen] = useState(false);
  const [quickWizardPurpose, setQuickWizardPurpose] = useState("settings");
  const [targetDayEditContext, setTargetDayEditContext] = useState(null);
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [quickCreatingTargets, setQuickCreatingTargets] = useState(false);
  const [quickGenerationError, setQuickGenerationError] = useState("");
  const [quickTopUpOffer, setQuickTopUpOffer] = useState(null);
  const [personalTargetEditor, setPersonalTargetEditor] = useState(null);
  const [personalTargetPlanAction, setPersonalTargetPlanAction] = useState(null);
  const [automaticMenuPlanAction, setAutomaticMenuPlanAction] = useState(null);
  const [dismissedReconciliationSignature, setDismissedReconciliationSignature] = useState("");

  useEffect(() => {
    if (location.state?.openGenerationSettings !== true) return;
    setQuickWizardPurpose("generate");
    setQuickSettingsOpen(true);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
  }, [location.pathname, location.search, location.state, navigate]);
  useEffect(() => {
    if (!location.state?.dayFavoriteApplied) return;
    const extra = Number(location.state.extraFreeCalories) || 0;
    setToast(extra > 0.5
      ? `“${location.state.dayFavoriteApplied}” aplicado. Quedan ${Math.round(extra)} kcal libres.`
      : `“${location.state.dayFavoriteApplied}” aplicado a este día.`);
    const timer = window.setTimeout(() => setToast(""), 4200);
    navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search, location.state, navigate]);
  const requestedDate = useMemo(() => dateKeyFromSearch(location.search), [location.search]);
  const currentDate = useCurrentLocalDate();
  const initialSelectedDate = requestedDate || currentDate;
  const initialWeek = useMemo(() => {
    const start = mondayOfWeek(initialSelectedDate);
    return { start, data: getCachedMenuWeek(start, menuCacheOwner) };
  }, [initialSelectedDate, menuCacheOwner]);
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
  const [equivalentMealBuilder, setEquivalentMealBuilder] = useState(null);

const [menuOptionsDrawerOpen, setMenuOptionsDrawerOpen] = useState(false);

const [quickTrackingOpen, setQuickTrackingOpen] = useState(false);

const [
  quickTrackingDestination,
  setQuickTrackingDestination,
] = useState("picoteo");
const [quickTrackingDestinationLocked, setQuickTrackingDestinationLocked] = useState(false);


/* PLANIFICAR COMIDA */
const [
  quickPlanMealOpen,
  setQuickPlanMealOpen,
] = useState(false);

const [
  quickPlanMealType,
  setQuickPlanMealType,
] = useState("almuerzo");

const [
  quickPlanMealStep,
  setQuickPlanMealStep,
] = useState("mode");

const [
  quickPlanMealMode,
  setQuickPlanMealMode,
] = useState("target");

const [
  quickPlanMealKcal,
  setQuickPlanMealKcal,
] = useState("");
const [quickPlanMealMacros, setQuickPlanMealMacros] = useState({
  proteina: "",
  carbs: "",
  grasas: "",
});
const [quickPlanMealMacroLocks, setQuickPlanMealMacroLocks] = useState({
  proteina: false,
  carbs: false,
  grasas: false,
});
const [trackingOnlyConfirmOpen, setTrackingOnlyConfirmOpen] = useState(false);

  const [manualCompletionPrompt, setManualCompletionPrompt] = useState(null);
  const [mealToggleConfirm, setMealToggleConfirm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState("");
  const [saveDayFavoriteDraft, setSaveDayFavoriteDraft] = useState(null);
  const [saveMealDraft, setSaveMealDraft] = useState(null);
  const isMobileLayout = useIsMobileMenuLayout();
  const dateContextRef = useRef({ currentDate, requestedDate });

async function loadWeek(start = weekStart, options = {}) {
  const silent = !!options.silent;

  const cached =
    getCachedMenuWeek(
      start,
      menuCacheOwner
    );

  const hydrateFromCache =
    !silent && cached;


  /*
   * Mostramos el cache inmediatamente
   * para no generar parpadeos.
   *
   * PERO siempre refrescamos desde backend.
   *
   * Esto es importante porque Tracking puede
   * haber cambiado aunque el menú en sí no
   * haya cambiado.
   */

  if (hydrateFromCache) {
    setWeekData(cached);
    setLoading(false);
    setError("");
    setRefreshing(true);
  } else if (silent) {
    setRefreshing(true);
  } else {
    setLoading(true);
    setError("");
  }
    try {
      const data = await getMenuTrackingWeek(start);
      setCachedMenuWeek(start, menuCacheOwner, data);
      setWeekData(data);
      setDetailRow((current) => current ? (data?.days || []).find((day) => day.date === current.date) || current : current);
      setMealDrawer((current) => {
        if (!current) return current;
        const freshRow = (data?.days || []).find((day) => day.date === current.row?.date) || current.row;
        const freshChoice = trackingChoice(freshRow);
        // Una meta nativa no pertenece necesariamente al menu asignado. Si al
        // refrescar la semana tomamos el mismo indice de `freshChoice`, el
        // drawer puede saltar a otra comida y cambiar su mealId mientras se
        // confirma Tracking. Conservamos la identidad de la meta abierta.
        const freshBaseMeal = current.nativeTarget
          ? current.baseMeal || current.meal
          : choiceMeals(freshChoice)[current.mealIndex] || current.baseMeal || current.meal;
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
    let lastRefreshAt = 0;
    const refreshVisibleWeek = () => {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRefreshAt < 1000) return;
      lastRefreshAt = now;
      void loadWeek(weekStart, { silent: true }).catch(() => {});
    };

    window.addEventListener("focus", refreshVisibleWeek);
    window.addEventListener("pageshow", refreshVisibleWeek);
    document.addEventListener("visibilitychange", refreshVisibleWeek);
    return () => {
      window.removeEventListener("focus", refreshVisibleWeek);
      window.removeEventListener("pageshow", refreshVisibleWeek);
      document.removeEventListener("visibilitychange", refreshVisibleWeek);
    };
    // Revalida asignaciones del coach al volver a la pestaña del cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, selectedDate, menuCacheOwner]);

  useEffect(() => {
    const previousContext = dateContextRef.current;
    const nextDate = resolveSelectedMenuDate({
      currentDate,
      previousCurrentDate: previousContext.currentDate,
      selectedDate,
      requestedDate,
      previousRequestedDate: previousContext.requestedDate,
    });
    dateContextRef.current = { currentDate, requestedDate };

    if (nextDate === selectedDate) return;
    const nextWeek = mondayOfWeek(nextDate);
    setSelectedDate(nextDate);
    setMobileView("overview");
    setManualCompletionPrompt(null);
    if (nextWeek !== weekStart) {
      setWeekStart(nextWeek);
    }
  }, [currentDate, requestedDate, selectedDate, weekStart]);

  const days = Array.isArray(weekData?.days) ? weekData.days : EMPTY_DAYS;
  const todayRow = useMemo(
    () => days.find((day) => day.date === currentDate) || days[0] || null,
    [currentDate, days]
  );
  const selectedRow = useMemo(
    () => days.find((day) => day.date === selectedDate) || todayRow,
    [days, selectedDate, todayRow]
  );
  const selectedTrackingQuery = useTrackingDay(selectedRow?.date || "");

  useEffect(() => {
    if (selectedRow?.date) {
      void selectedTrackingQuery.refetch();
    }
    // La semana puede venir de cache; el detalle de consumo siempre se revalida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRow?.date]);

  const selectedDailyTargetItems = useMemo(
    () => dailyTargetTrackingItems(selectedRow, selectedTrackingQuery.data),
    [selectedRow, selectedTrackingQuery.data]
  );
  const selectedDisplayRow = useMemo(
    () => rowWithActiveGeneratedMeals(selectedRow, days),
    [selectedRow, days]
  );
  const permissions = useMemo(() => weekData?.permissions || {}, [weekData?.permissions]);
  const activePlan = weekData?.activePlan || {};
  const activePlanSource = activePlan?.source || "none";
  const selectedMenuChoice = trackingChoice(selectedDisplayRow || selectedRow || {});
  const canQuickEditActiveMenu = canQuickEditMenuChoice(
    selectedMenuChoice,
    activePlanSource,
    (selectedDisplayRow || selectedRow)?.date
  );
  const canMarkMeals = permissions.canMarkMenuMealsCompleted !== false;
  const canUseMenuAlternatives = permissions.canUseMenuAlternatives !== false;
  const canUseFlexibleRecommendations = canUseFlexibleMarginCalculation(permissions);
  const canUseManualDayCompletion = permissions.canUseManualDayCompletion !== false;
  const canPlanRemainingIntake = permissions.canPlanRemainingIntake === true;
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: CLIENT_PLAN_CAPABILITIES_STALE_TIME,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const equivalentMealAccess = useMemo(() => resolveEquivalentMealAccess({
    permissions,
    capabilities: capabilitiesQuery.data || {},
  }), [capabilitiesQuery.data, permissions]);
  const trackingHistoryDays = Number(capabilitiesQuery.data?.limits?.trackingHistoryDays);
  const historyOldestDate = Number.isFinite(trackingHistoryDays) && trackingHistoryDays > 0
    ? addDays(currentDate, -(trackingHistoryDays - 1))
    : "";


/*
 * =====================================================
 * CONTEXTO DEL DÍA PARA GENERACIÓN AUTOMÁTICA
 * =====================================================
 *
 * Todo lo que genere Automático debe salir de la MISMA
 * fila:
 *
 * - fecha
 * - calorías
 * - macros
 * - targets por comida si existen
 *
 * Los ajustes guardados sólo contienen reglas.
 */

const selectedGenerationRow =
  selectedDisplayRow ||
  selectedRow ||
  null;

const selectedQuickDate =
  selectedGenerationRow?.date ||
  selectedRow?.date ||
  currentDate;

const selectedQuickTarget =
  targetTotals(
    selectedGenerationRow || {}
  );

const selectedPersonalMealTargets = personalMealTargetsFromTrackingDay(
  selectedTrackingQuery.data
);

  function openSaveDayFavorite() {
    const row = selectedDisplayRow || selectedRow || {};
    const choice = trackingChoice(row);
    const targetIds = new Set(selectedPersonalMealTargets.map((meal) => String(meal.id)));
    const suppressedIds = new Set(suppressedMenuMealIds(row).map(String));
    const physicalMeals = choiceMeals(choice).filter((meal, index) => {
      const id = String(mealId(meal, index));
      return !targetIds.has(id) && !suppressedIds.has(id) && mealFoods(meal).length > 0;
    }).map((meal, index) => ({
      ...meal,
      id: mealId(meal, index),
      items: mealFoods(meal),
      totals: mealTotals(meal),
    }));
    const targetMeals = selectedPersonalMealTargets.map((meal, index) => ({
      id: meal.id,
      name: meal.name || meal.nombre || menuTargetMealTypeLabel(meal.type),
      type: meal.type,
      order: index,
      target: totalFromLike(meal.target || meal.meta),
      targetOrigin: meal.targetOrigin,
    }));
    if (!physicalMeals.length && !targetMeals.length) {
      setToast("Primero armá una planificación para guardar el día.");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }
    const physicalTotals = sumTotals(physicalMeals.map((meal) => meal.totals));
    const targetMealTotals = sumTotals(targetMeals.map((meal) => meal.target));
    const plannedTotals = sumTotals([physicalTotals, targetMealTotals]);
    const sourceType = targetMeals.length && physicalMeals.length
      ? "mixed"
      : targetMeals.length
        ? "target"
        : activePlanSource === "coach"
          ? "coach"
          : plannedMealCompositionOrigins(physicalMeals, { menuSource: choice?.snapshot?.source }).some((origin) => origin === "auto")
            ? "automatic"
            : "manual";
    setSaveDayFavoriteDraft({
      name: `Mi día · ${Math.round(plannedTotals.kcal)} kcal`,
      originalDate: row.date,
      sourceType,
      dailyTarget: selectedQuickTarget,
      plannedTotals,
      physicalMeals,
      targetMeals,
    });
  }

  async function saveDayFavorite(draft) {
    setSaving(true);
    try {
      const result = await createDayFavorite(draft);
      setSaveDayFavoriteDraft(null);
      setToast(`“${result?.favorite?.name || draft.name}” quedó guardado para repetirlo.`);
      window.setTimeout(() => setToast(""), 3500);
    } catch (saveError) {
      setToast(saveError?.message || "No pudimos guardar este día.");
      window.setTimeout(() => setToast(""), 3500);
    } finally {
      setSaving(false);
    }
  }
const selectedTargetGenerationContext = useMemo(() => {
  const trackingDay = selectedTrackingQuery.data || {};
  const targetMeals = personalMealTargetsFromTrackingDay(trackingDay);
  const consumedMeals = combineConsumedMealsByType(consumedMealsWithoutPersonalTarget(trackingDay));
  const minimumTargetsByMealId = Object.fromEntries([
    ...targetMeals.map((meal) => [
      meal.id,
      personalMealTargetConsumedComposition(trackingDay, meal.id).totals,
    ]),
    ...consumedMeals.map((meal) => [meal.id, meal.consumed]),
  ]);
  const preservedMealIds = targetMeals
    .filter((meal) => !personalMealTargetCanRegenerate(meal, trackingDay))
    .map((meal) => meal.id);

  return {
    targetMeals,
    consumedMeals,
    minimumTargetsByMealId,
    preservedMealIds,
    protectedMealTypes: targetMeals
      .filter((meal) => preservedMealIds.includes(meal.id))
      .map((meal) => meal.type),
  };
}, [selectedTrackingQuery.data]);
const selectedQuickTrackingDestinations = useMemo(() => {
  const configured = (Array.isArray(selectedTrackingQuery.data?.mealsConfig)
    ? selectedTrackingQuery.data.mealsConfig
    : []).map((meal) => ({
      mealId: String(meal?.mealId || meal?.id || ""),
      mealType: meal?.tipo || meal?.type || meal?.mealType || "otra",
      mealName: meal?.nombre || meal?.name || "Comida",
    }));
  const choice = trackingChoice(selectedDisplayRow || {});
  const planned = choice ? choiceMeals(choice).map((meal, index) => ({
    mealId: menuTargetExecutionContext(
      selectedDisplayRow || {},
      meal,
      meal,
      index
    ).id,
    mealType: meal?.tipoComida || meal?.type || normalizeMenuTargetMealType(mealName(meal, index)),
    mealName: mealName(meal, index),
  })) : [];
  return [...configured, ...planned].filter((meal) => meal.mealId);
}, [selectedDisplayRow, selectedTrackingQuery.data]);
const selectedGenerationTrackingBreakdown = generationTrackingBreakdown(
  selectedTrackingQuery.data,
  { excludedMealIds: selectedPersonalMealTargets.flatMap((meal) => (
    Array.isArray(meal?.consumptionSourceMealIds) && meal.consumptionSourceMealIds.length
      ? meal.consumptionSourceMealIds
      : [meal.id]
  )) }
);
const selectedPersonalFlexiblePlan = personalMealTargetFlexiblePlan(
  selectedQuickTarget,
  selectedPersonalMealTargets,
  {
    explicitFreeCalories: quickSettings.targetPlanDate === selectedQuickDate
      ? quickSettings.targetFreeCalories
      : null,
    expectedPlannedTarget: quickSettings.targetPlanDate === selectedQuickDate
      ? quickSettings.targetPlannedTarget
      : null,
    consumedNutrition: selectedGenerationTrackingBreakdown.total,
    planDate: quickSettings.targetPlanDate,
    date: selectedQuickDate,
  }
);
const selectedPersonalTargetReconciliation = personalMealTargetDayReconciliation({
  dailyTarget: selectedQuickTarget,
  trackingDay: selectedTrackingQuery.data,
  freeCalories: selectedPersonalFlexiblePlan?.flexibleCalories || 0,
  minimumMealKcal: 100,
});
const visiblePersonalTargetReconciliation = selectedPersonalTargetReconciliation?.hasDifference
  && selectedPersonalTargetReconciliation.signature !== dismissedReconciliationSignature
  ? selectedPersonalTargetReconciliation
  : null;
const quickPlanMealCalculation = calculateLockedMealMacros({
  kcal: quickPlanMealKcal,
  macros: quickPlanMealMacros,
  locks: quickPlanMealMacroLocks,
  dailyTarget: selectedQuickTarget,
});


  const resolvedCapabilities = capabilitiesQuery.data || {};
  const quickActionAccess = resolveAutonomousMenuActions(resolvedCapabilities);
  const coachOwnActivationBlocked =
    menuSourceMeta(activePlanSource).key === "coach" &&
    resolvedCapabilities.canActivateOwnMenuOverCoachPlan !== true;
  const canUseAutonomousLibrary = quickActionAccess.library;
  const canCreateAutonomousMenu = quickActionAccess.create && !coachOwnActivationBlocked;
  const canGenerateAutonomousMenu = quickActionAccess.automatic && !coachOwnActivationBlocked;
  const canEditAutonomousSettings = quickActionAccess.settings && !coachOwnActivationBlocked;
  const showAutonomousQuickActions = Boolean(capabilitiesQuery.data) && (
    canUseAutonomousLibrary ||
    canCreateAutonomousMenu ||
    canGenerateAutonomousMenu ||
    canEditAutonomousSettings
  );
  const canCreatePersonalMealTarget =
    resolvedCapabilities.canTrack === true &&
    resolvedCapabilities.canUseMealTargets === true &&
    resolvedCapabilities.primaryAuthority !== "coach" &&
    permissions.canCreateMealTargets === true &&
    permissions.canCreateTrackingMealTargets === true;



function openQuickLibrary() {
  navigate(
    libraryTargetPath(
      selectedQuickDate,
      selectedQuickTarget
    ),
    {
      state: {
        from:
          `${location.pathname}${location.search}`,
      },
    }
  );
}



  async function openMenuOptions() {
    setMenuOptionsDrawerOpen(true);
    try {
      await loadWeek(weekStart, { silent: true });
    } catch (err) {
      setToast(err?.message || "No se pudieron actualizar las opciones del menu.");
      window.setTimeout(() => setToast(""), 2600);
    }
  }

function openQuickCreateMenu() {
  navigate("/app/menu/nuevo", {
    state: {
      from:
        `${location.pathname}${location.search}`,

      selectedDate:
        selectedQuickDate,

      dailyTarget:
        selectedQuickTarget,
    },
  });
}




function openQuickTracking(
  destinationKey = "picoteo",
  options = {}
) {
  setQuickTrackingDestination(
    destinationKey || "picoteo"
  );
  setQuickTrackingDestinationLocked(options?.lockDestination === true);

  setQuickTrackingOpen(true);
}


  function persistQuickSettings(nextSettings, { close = true, notify = true } = {}) {
    const saved = saveMenuGenerationSettings(currentUser, nextSettings);
    setQuickSettings(saved);
    if (close) setQuickSettingsOpen(false);
    setQuickGenerationError("");
    setQuickTopUpOffer(null);
    if (notify) {
      setToast(saved.generationProfile === "target" ? "Ajustes por meta guardados." : "Ajustes automáticos guardados.");
      window.setTimeout(() => setToast(""), 2200);
    }
    return saved;
  }

  function saveQuickSettings(nextSettings) {
    persistQuickSettings(nextSettings);
  }

  function restoreQuickSettings() {
    setQuickGenerationError("");
    return { ...DEFAULT_MENU_GENERATION_SETTINGS };
  }

async function runQuickAutomatic({
  allowCalorieTopUp = false,
  settingsOverride = null,
} = {}) {
  if (quickGenerating || quickGenerationInFlightRef.current) return;

  /*
   * ==========================================
   * SNAPSHOT DEL DÍA ACTUAL
   * ==========================================
   *
   * La generación usa SIEMPRE el día que está
   * seleccionado al momento de tocar Automático.
   */

  const generationRow =
    selectedDisplayRow ||
    selectedRow ||
    null;

  const generationDate =
    generationRow?.date ||
    selectedRow?.date ||
    currentDate;

  const generationTarget =
    targetTotals(
      generationRow || {}
    );

  const generationSettings =
    settingsOverride ||
    quickSettings;


  if (!generationTarget.kcal) {
    setQuickGenerationError(
      "Primero necesitas configurar el objetivo nutricional de este día."
    );

    return;
  }


  quickGenerationInFlightRef.current = true;
  setQuickGenerating(true);

  setQuickGenerationError("");

  if (!allowCalorieTopUp) {
    setQuickTopUpOffer(null);
  }


  try {
    const authorization =
      await authorizeClientMenuGeneration();


    if (
      authorization?.policy !==
        MEAL_NUTRITION_POLICY ||
      authorization?.previewOnly !== true
    ) {
      throw new Error(
        "GENERATION_NOT_AUTHORIZED"
      );
    }


    /*
     * Si este día ya tiene targets específicos
     * por comida, los obtenemos DEL MISMO DÍA.
     */
    const coachTargets =
      generationRow
        ?.mealTargetPlan
        ?.mode === "per_meal" &&
      Array.isArray(
        generationRow
          ?.mealTargetPlan
          ?.meals
      )
        ? generationRow
            .mealTargetPlan
            .meals
        : [];

    const generationTrackingDay = selectedTrackingQuery.data?.date === generationDate
      ? selectedTrackingQuery.data
      : await getTrackingDay(generationDate);
    const personalTargetSpecs = personalMealTargetAutomaticSpecs(generationTrackingDay);
    const completedMealIds = new Set(
      (generationRow?.tracking?.completedMenuMealIds || []).map(String)
    );

    // Planificación a conservar: snapshot/equivalencias del menú, nunca logs
    // consumidos de Tracking. Un slot con sólo target y sin alimentos queda
    // afuera porque todavía no es contenido planificado.
    const currentPlanningChoice = trackingChoice(generationRow || {});
    const plannedMealEntries = currentPlanningChoice
      ? choiceMeals(currentPlanningChoice)
          .map((baseMeal, index) => {
            const meal = mealWithTrackingReplacements(generationRow || {}, baseMeal, index);
            return {
              meal,
              executionId: menuTargetExecutionContext(
                generationRow || {},
                meal,
                baseMeal,
                index
              ).id,
              baseId: mealId(baseMeal, index),
            };
          })
          .filter((entry) => mealHasContent(entry.meal))
      : [];
    const plannedCompositionOrigins = plannedMealCompositionOrigins(
      plannedMealEntries.map((entry) => entry.meal),
      {
        menuSource: currentPlanningChoice?.snapshot?.source,
        targetMeals: personalTargetSpecs,
        trackingDay: generationTrackingDay,
      }
    );
    const occupiedGenerationTypes = new Set([
      ...personalTargetSpecs.map((meal) => String(meal.type || meal.tipo || "").toLowerCase()),
      ...plannedMealEntries
        .filter((entry, index) => (
          plannedCompositionOrigins[index] !== "auto"
          || completedMealIds.has(String(entry.executionId))
          || completedMealIds.has(String(entry.baseId))
        ))
        .map((entry) => String(
          entry.meal?.tipoComida || entry.meal?.mealType || entry.meal?.type || ""
        ).toLowerCase()),
    ].filter(Boolean));
    const consumedMealReservations = consumedMealsWithoutPersonalTarget(generationTrackingDay)
      .filter((meal) => {
        const type = String(meal.type || "").toLowerCase();
        if (!type || occupiedGenerationTypes.has(type)) return false;
        occupiedGenerationTypes.add(type);
        return true;
      })
      .map((meal) => ({
        id: meal.id,
        mealId: meal.id,
        type: meal.type,
        name: meal.name,
        target: meal.consumed,
        consumed: meal.consumed,
        remainingTarget: emptyTotals(),
        targetOrigin: "tracking",
        completed: true,
        preserved: true,
        derivedFromConsumption: true,
      }));
    const automaticPartialSpecs = plannedMealEntries.flatMap((entry, index) => {
      const compositionOrigin = plannedCompositionOrigins[index];
      const logs = Array.isArray(generationTrackingDay?.meals?.[entry.executionId])
        ? generationTrackingDay.meals[entry.executionId]
        : [];
      const done = completedMealIds.has(String(entry.executionId))
        || completedMealIds.has(String(entry.baseId));
      if (compositionOrigin !== "auto" || done || !logs.length) return [];
      const target = totalFromLike(entry.meal?.target || mealTotals(entry.meal));
      const consumed = sumTotals(logs);
      return [{
        id: entry.executionId,
        mealId: entry.executionId,
        type: entry.meal?.tipoComida || entry.meal?.type || "otro",
        name: mealName(entry.meal),
        target,
        consumed,
        remainingTarget: Object.fromEntries(["kcal", "proteina", "carbs", "grasas"].map((key) => [
          key,
          Math.max(0, Number(target[key]) - Number(consumed[key])),
        ])),
        targetOrigin: "auto",
        completed: false,
      }];
    });
    const targetTypes = new Set(personalTargetSpecs.map((meal) => String(meal.type)));
    const reservedMealTargets = [
      ...personalTargetSpecs,
      ...automaticPartialSpecs.filter((meal) => !targetTypes.has(String(meal.type))),
      ...consumedMealReservations,
    ];
    const plannedMeals = plannedMealEntries
      .filter((entry, index) => {
        const compositionOrigin = plannedCompositionOrigins[index];
        const done = completedMealIds.has(String(entry.executionId))
          || completedMealIds.has(String(entry.baseId));
        return compositionOrigin !== "auto" || done;
      })
      .map((entry) => {
        const done = completedMealIds.has(String(entry.executionId))
          || completedMealIds.has(String(entry.baseId));
        if (!done) return entry.meal;
        const logs = Array.isArray(generationTrackingDay?.meals?.[entry.executionId])
          ? generationTrackingDay.meals[entry.executionId]
          : [];
        return {
          ...entry.meal,
          consumptionAccountingTotals: logs.length ? sumTotals(logs) : mealTotals(entry.meal),
        };
      });
    const trackingBreakdown = generationTrackingBreakdown(generationTrackingDay, {
      excludedMealIds: [
        ...reservedMealTargets.map((meal) => meal.id),
        ...plannedMealEntries
          .filter((entry) => plannedMeals.some((meal) => (
            String(mealId(meal)) === String(mealId(entry.meal))
          )))
          .map((entry) => entry.executionId),
      ],
    });
    const completedPlannedTotals = plannedMealEntries
      .filter((entry) => (
        completedMealIds.has(String(entry.executionId))
        || completedMealIds.has(String(entry.baseId))
      ))
      .reduce((totals, entry) => {
        const logs = Array.isArray(generationTrackingDay?.meals?.[entry.executionId])
          ? generationTrackingDay.meals[entry.executionId]
          : [];
        return addTotals(totals, logs.length ? sumTotals(logs) : mealTotals(entry.meal));
      }, emptyTotals());
    const completedTargetTotals = reservedMealTargets
      .filter((meal) => meal.completed === true)
      .reduce((totals, meal) => addTotals(totals, meal.consumed), emptyTotals());
    const actualConsumed = addTotals(
      trackingBreakdown.total,
      addTotals(completedPlannedTotals, completedTargetTotals)
    );
    const hasOpenTarget = personalTargetSpecs.some((meal) => meal.completed !== true);
    const allPhysicalMealsDone = plannedMealEntries.length > 0 && plannedMealEntries.every((entry) => (
      completedMealIds.has(String(entry.executionId)) || completedMealIds.has(String(entry.baseId))
    ));
    if (!hasOpenTarget && (
      allPhysicalMealsDone
      || Number(actualConsumed.kcal) >= Number(generationTarget.kcal) - 10
    )) {
      setToast("El día ya está completo. No hay planificación pendiente para generar.");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }


    const generationRequest = buildAutonomousMenuGenerationRequest({
          /*
           * MUY IMPORTANTE:
           *
           * target NO viene de settings.
           * Viene del día actualmente seleccionado.
           */
          target:
            generationTarget,

          settings:
            generationSettings,

          selectedDate:
            generationDate,

          coachMealTargets:
            coachTargets,

          plannedMeals,

          allowCalorieTopUp,

          name:
            `Menu ${formatDate(
              generationDate
            )}`,
        });
    const nutritionBudget = generationNutritionBudget({
      dailyTarget: generationTarget,
      tracking: trackingBreakdown,
      freeCalories: generationRequest.freeCalories,
    });
    const preview = await generateClientMenuPreview({
      ...generationRequest,
      reservedMealTargets,
      freeCalories: nutritionBudget.freeCaloriesRemaining,
      consumedBaseline: nutritionBudget.consumed,
      generationAccounting: nutritionBudget,
    });


    setQuickTopUpOffer(null);


    navigate("/app/menu/nuevo", {
      state: {
        from:
          `${location.pathname}${location.search}`,

        /*
         * Siempre misma fecha usada arriba.
         */
        selectedDate:
          generationDate,

        /*
         * Siempre target dinámico de ese día.
         */
        dailyTarget:
          generationTarget,

        generationSettings,

        generatedDraft: {
          ...preview,

          generationMeta: {
            ...(preview?.generationMeta || {}),
            trackingRevision: trackingDayRevision(generationTrackingDay),
          },

          fechaInicio:
            generationDate,

          objectiveMode:
            "custom",

          /*
           * Meta diaria COMPLETA.
           *
           * Ej:
           * lunes 2132
           * martes 2500
           */
          menuTarget:
            generationTarget,
        },

        activeMenuComparison:
          trackingChoice(
            generationRow
          )
            ? {
                current:
                  choiceTotals(
                    trackingChoice(
                      generationRow
                    )
                  ),

                proposed:
                  preview.comidas?.reduce(
                    (
                      totals,
                      meal
                    ) =>
                      addTotals(
                        totals,
                        mealTotals(
                          meal
                        )
                      ),

                    {
                      kcal: 0,
                      proteina: 0,
                      carbs: 0,
                      grasas: 0,
                    }
                  ),
              }
            : null,
      },
    });
  } catch (generationError) {
    if (
      automaticGenerationRequiresPlan(
        generationError
      )
    ) {
      navigate("/app/planes");
    } else if (
      generationError?.code ===
      "MENU_CALORIE_TOP_UP_CONFIRMATION_REQUIRED"
    ) {
      setQuickTopUpOffer(
        generationError.details ||
        null
      );

      setQuickGenerationError("");
    } else if (
      [
        "MENU_NO_CALORIE_MATCH",
        "MENU_NO_PROTEIN_MATCH",
      ].includes(
        generationError?.code
      )
    ) {
      setQuickGenerationError(
        generationError.message
      );
    } else if (
      [
        "MENU_SELECTED_FOODS_REQUIRED",
        "MENU_SELECTED_ONLY_LIBRARY_CONFLICT",
        "MENU_SELECTED_ONLY_INCOMPATIBLE",
        "MENU_MEAL_GENERATION_FAILED",
        "MENU_REPEATED_MEAL_UNAVAILABLE",
        "MENU_NON_GENERIC_FOOD",
        "MENU_REQUIRED_FOOD_MISSING",
        "MENU_INVALID_GENERATED_QUANTITY",
        "MENU_MEAL_PROTEIN_RANGE",
        "MENU_DAILY_PROTEIN_RANGE",
        "MENU_COACH_MEAL_PROTEIN_RANGE",
        "MENU_MEAL_COUNT_CONFLICT",
        "MENU_RESERVED_TARGET_OVERAGE",
        "MENU_FOOD_CONSTRAINT_CONFLICT",
        "TARGET_NOT_REACHABLE_WITH_SELECTED_FOODS",
        "NO_COMPATIBLE_FOOD_COMBINATION",
        "MEAL_TARGET_NOT_REACHABLE_WITH_PORTION_RULES",
      ].includes(
        generationError?.code
      )
    ) {
      setQuickGenerationError(
        generationError.message
      );
    } else {
      setQuickGenerationError(
        "No pudimos preparar el menú. Revisá tu conexión e intentá nuevamente."
      );
    }
  } finally {
    quickGenerationInFlightRef.current = false;
    setQuickGenerating(false);
  }
}



  function generateFromWizard(nextSettings) {
    const saved = persistQuickSettings(nextSettings, { close: true, notify: false });
    void runQuickAutomatic({ settingsOverride: saved });
  }

async function createTargetsFromWizard(nextSettings = {}, {
  freshBalanced = false,
  variantSeed = "",
} = {}) {
  const date = selectedQuickDate;
  if (!date || saving || quickCreatingTargets) return;
  if (!canCreatePersonalMealTarget) {
    setToast("Tu acceso actual no permite crear comidas por meta.");
    window.setTimeout(() => setToast(""), 3000);
    return;
  }
  if (!(selectedQuickTarget.kcal > 0)) {
    setToast("Primero configurá tu objetivo nutricional diario.");
    window.setTimeout(() => setToast(""), 3000);
    return;
  }

  setQuickGenerationError("");
  setSaving(true);
  setQuickCreatingTargets(true);
  try {
    // La generación debe partir siempre del snapshot canónico más reciente.
    // Una meta eliminada puede seguir presente unos milisegundos en el cache,
    // mientras sus FoodLogs continúan siendo consumo real en el servidor.
    const trackingDay = await getTrackingDay(date);
    const existingPersonalTargets = personalMealTargetsFromTrackingDay(trackingDay);
    let protectedPersonalTargets = existingPersonalTargets.filter((meal) => (
      !personalMealTargetCanRegenerate(meal, trackingDay)
    ));
    let protectedTypes = new Set(protectedPersonalTargets.map((meal) => String(meal.type)));
    const planningRow = selectedDisplayRow || selectedRow || {};
    const planningChoice = trackingChoice(planningRow);
    let planningMeals = planningChoice ? choiceMeals(planningChoice) : [];
    let planningMenuSource = planningChoice?.snapshot?.source || "";
    if (planningChoice?.snapshot && menuSourceMeta(activePlanSource).key === "own") {
      const activeMenuId = activeMenuIdFrom(planningRow, activePlan);
      if (!activeMenuId) {
        throw new Error("No pudimos identificar el menú automático que querés convertir.");
      }
      const activeMenu = await getClientMenu(activeMenuId);
      const normalizedActiveMenu = normalizeClientMenuForQuickEdit(activeMenu || {}, planningChoice, activePlan);
      planningMeals = normalizedActiveMenu.comidas;
      planningMenuSource = normalizedActiveMenu.source;
    }
    const planningCompositionOrigins = plannedMealCompositionOrigins(planningMeals, {
      menuSource: planningMenuSource,
      targetMeals: existingPersonalTargets,
      trackingDay,
    });
    const legacyAutomaticPlanning = planningMeals.flatMap((meal, index) => {
      const wasStoredAsManual = plannedMealCompositionOrigin(meal) === "manual";
      if (planningCompositionOrigins[index] !== "auto" || !wasStoredAsManual) return [];
      const baseId = String(mealId(meal, index));
      const executionId = String(menuTargetExecutionContext(
        planningRow,
        meal,
        meal,
        index
      ).id);
      return [{
        baseId,
        executionId,
        type: String(meal?.tipoComida || meal?.type || normalizeMenuTargetMealType(mealName(meal, index))),
        totals: mealTotals(meal),
      }];
    });
    if (legacyAutomaticPlanning.length) {
      protectedPersonalTargets = protectedPersonalTargets.filter((targetMeal) => {
        if (
          personalMealTargetOrigin(targetMeal) !== PERSONAL_MEAL_TARGET_ORIGIN.MANUAL
          || targetMeal.confirmed === true
          || targetMeal.targetLocked === true
          || (Array.isArray(trackingDay?.meals?.[targetMeal.id]) && trackingDay.meals[targetMeal.id].length)
        ) return true;
        const legacyMatch = legacyAutomaticPlanning.find((entry) => (
          entry.baseId === String(targetMeal.id)
          || entry.executionId === String(targetMeal.id)
          || entry.type === String(targetMeal.type)
        ));
        if (!legacyMatch) return true;
        const sameAsLegacyComposition = ["kcal", "proteina", "carbs", "grasas"].every((key) => (
          Math.abs(Number(targetMeal.target?.[key] || 0) - Number(legacyMatch.totals?.[key] || 0)) <= 0.11
        ));
        return !sameAsLegacyComposition;
      });
      protectedTypes = new Set(protectedPersonalTargets.map((meal) => String(meal.type)));
    }
    const completedPlanningIds = completedMealIdSet(planningRow);
    const completedAutomaticPlanning = planningMeals.flatMap((meal, index) => {
      if (planningCompositionOrigins[index] !== "auto") return [];
      const baseId = mealId(meal, index);
      const executionId = menuTargetExecutionContext(
        planningRow,
        meal,
        meal,
        index
      ).id;
      if (!completedPlanningIds.has(String(baseId)) && !completedPlanningIds.has(String(executionId))) {
        return [];
      }
      return [{
        meal,
        baseId: String(baseId),
        executionId: String(executionId),
        type: String(meal?.tipoComida || meal?.type || normalizeMenuTargetMealType(mealName(meal, index))),
      }];
    });
    const completedAutomaticIds = new Set(completedAutomaticPlanning.flatMap((entry) => [
      entry.baseId,
      entry.executionId,
    ]));
    const retiredAutomaticMealIds = planningMeals.flatMap((meal, index) => {
      if (planningCompositionOrigins[index] !== "auto") return [];
      const baseId = String(mealId(meal, index));
      const executionId = String(menuTargetExecutionContext(
        planningRow,
        meal,
        meal,
        index
      ).id);
      return completedPlanningIds.has(baseId) || completedPlanningIds.has(executionId)
        ? []
        : [baseId];
    });
    const completedAutomaticTypes = new Set(completedAutomaticPlanning.map((entry) => entry.type));
    const targetMealTypes = (Array.isArray(nextSettings.mealTypes) ? nextSettings.mealTypes : [])
      .filter((type) => !completedAutomaticTypes.has(String(type)));
    const manualPlanningTargets = planningMeals
      .map((meal, index) => {
        if (!mealHasContent(meal) || planningCompositionOrigins[index] !== "manual") return null;
        const type = String(meal?.tipoComida || meal?.type || normalizeMenuTargetMealType(mealName(meal, index)));
        if (protectedTypes.has(type)) return null;
        const id = menuTargetExecutionContext(
          selectedDisplayRow || selectedRow || {},
          meal,
          meal,
          index
        ).id;
        const planned = mealTotals(meal);
        const consumed = sumTotals(Array.isArray(trackingDay?.meals?.[id]) ? trackingDay.meals[id] : []);
        return {
          id,
          type,
          name: mealName(meal, index),
          target: Object.fromEntries(["kcal", "proteina", "carbs", "grasas"].map((key) => [
            key,
            Math.max(Number(planned[key]) || 0, Number(consumed[key]) || 0),
          ])),
          targetOrigin: PERSONAL_MEAL_TARGET_ORIGIN.MANUAL,
          personalTargetOnly: true,
          preserved: true,
        };
      })
      .filter(Boolean);
    const manualPlanningIds = new Set(manualPlanningTargets.map((meal) => String(meal.id)));
    const preservedPersonalTargets = [...protectedPersonalTargets, ...manualPlanningTargets];
    const consumedWithoutTarget = consumedMealsWithoutPersonalTarget(trackingDay)
      .filter((meal) => (
        !manualPlanningIds.has(String(meal.id))
        && !completedAutomaticIds.has(String(meal.id))
      ));
    const trackingBreakdown = generationTrackingBreakdown(trackingDay, {
      excludedMealIds: preservedPersonalTargets.flatMap((meal) => (
        Array.isArray(meal?.consumptionSourceMealIds) && meal.consumptionSourceMealIds.length
          ? meal.consumptionSourceMealIds
          : [meal.id]
      )),
    });
    const completedLegacyFallback = completedAutomaticPlanning.reduce((totals, entry) => {
      const executionLogs = Array.isArray(trackingDay?.meals?.[entry.executionId])
        ? trackingDay.meals[entry.executionId]
        : [];
      const baseLogs = entry.baseId !== entry.executionId && Array.isArray(trackingDay?.meals?.[entry.baseId])
        ? trackingDay.meals[entry.baseId]
        : [];
      return executionLogs.length || baseLogs.length
        ? totals
        : addTotals(totals, mealTotals(entry.meal));
    }, emptyTotals());
    const consumedBaseline = addTotals(trackingBreakdown.total, completedLegacyFallback);
    const realConsumedToday = addTotals(
      generationTrackingBreakdown(trackingDay).total,
      completedLegacyFallback
    );
    const existingTargetStates = personalMealTargetAutomaticSpecs(trackingDay);
    const allExistingTargetsDone = existingTargetStates.length > 0
      && existingTargetStates.every((meal) => meal.completed === true);

    if (allExistingTargetsDone || Number(realConsumedToday.kcal) >= Number(selectedQuickTarget.kcal) - 0.05) {
      setToast("El día ya está completo. Conservamos todo lo consumido.");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }

    if (completedAutomaticPlanning.length && !targetMealTypes.length) {
      setToast("El día ya tiene todas sus comidas hechas. Conservamos el consumo registrado.");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }

    const shouldVaryBalancedPlan = shouldRegenerateBalancedTargetPlan(
      nextSettings,
      freshBalanced
    );
    const basePlan = !preservedPersonalTargets.length
      && !shouldVaryBalancedPlan
      && !hasTotalValue(consumedBaseline)
      && !completedAutomaticPlanning.length
      && Array.isArray(nextSettings.targetMeals)
      && nextSettings.targetMeals.length
      ? { meals: nextSettings.targetMeals }
      : (shouldVaryBalancedPlan ? buildVariedPersonalMealTargetDayPlan : buildPersonalMealTargetDayPlan)({
          dailyTarget: selectedQuickTarget,
          consumedNutrition: consumedBaseline,
          freeEligibleNutrition: trackingBreakdown.freeEligible,
          mealTypes: targetMealTypes,
          existingMeals: preservedPersonalTargets,
          distributionMode: nextSettings.calorieDistributionMode,
          distributionPercentages: nextSettings.calorieDistributionPercents,
          freeCalories: nextSettings.freeCalories,
          seed: variantSeed || `${date}:personal-targets`,
          minimumMealCount: completedAutomaticPlanning.length ? 1 : 3,
        }, shouldVaryBalancedPlan ? {
          avoidSignatures: [
            personalMealTargetDistributionSignature(nextSettings.targetMeals),
            ...targetDistributionHistoryRef.current,
          ],
        } : undefined);
    const plan = consumedWithoutTarget.length
      ? mergeConsumedMealsIntoPersonalTargetPlan(basePlan, consumedWithoutTarget)
      : basePlan;
    if (shouldVaryBalancedPlan) {
      const generatedSignature = personalMealTargetDistributionSignature(plan);
      targetDistributionHistoryRef.current = [
        ...targetDistributionHistoryRef.current,
        generatedSignature,
      ].filter(Boolean).slice(-12);
    }
    const freeCalories = Math.max(0, Number(plan.freeCalories ?? nextSettings.targetFreeCalories ?? nextSettings.freeCalories) || 0);
    const plannedKcal = Number(plan.plannedTarget?.kcal)
      || Math.max(0, selectedQuickTarget.kcal - freeCalories - consumedBaseline.kcal);
    const planTotals = personalMealTargetTotals(plan.meals);
    if (!personalMealTargetTotalFitsBudget(planTotals.kcal, plannedKcal)) {
      throw new Error(`Las metas suman ${formatNumber(planTotals.kcal, 1)} kcal y superan las ${formatNumber(plannedKcal, 1)} kcal disponibles para el menú. Las ${formatNumber(freeCalories, 1)} kcal libres permanecen reservadas.`);
    }
    const targetConfigs = personalMealTargetConfigsFromPlan(plan, { idSuffix: date.replaceAll("-", "") });
    const mealsConfig = replacePersonalMealTargetConfigs(trackingDay, targetConfigs);
    await updateTrackingMealsConfig({ date, mealsConfig });
    if (retiredAutomaticMealIds.length && planningRow?.date) {
      const nextSuppressedMealIds = [...new Set([
        ...suppressedMenuMealIds(planningRow),
        ...retiredAutomaticMealIds,
      ])];
      try {
        const savedRetirement = await saveMenuTrackingDay(trackingPayloadBase(planningRow, {
          suppressedMenuMealIds: nextSuppressedMealIds,
        }));
        const persistedRetiredIds = suppressedMenuMealIds(savedRetirement?.record || {});
        if (!nextSuppressedMealIds.every((id) => persistedRetiredIds.includes(id))) {
          throw new Error("No pudimos confirmar el retiro de las comidas anteriores.");
        }
      } catch (retirementError) {
        try {
          await updateTrackingMealsConfig({
            date,
            mealsConfig: Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [],
          });
        } catch {
          // El refetch posterior vuelve a mostrar el estado real si el rollback falla.
        }
        throw retirementError;
      }
    }
    await Promise.all([
      selectedTrackingQuery.refetch(),
      loadWeek(weekStart, { silent: true }),
    ]);
    const saved = saveMenuGenerationSettings(currentUser, {
      ...nextSettings,
      targetMeals: plan.meals,
      targetPlannedTarget: plan.plannedTarget || nextSettings.targetPlannedTarget,
      targetFreeCalories: plan.freeCalories ?? nextSettings.targetFreeCalories ?? nextSettings.freeCalories,
      targetPlanDate: date,
      targetPlanCustomized: shouldVaryBalancedPlan ? false : nextSettings.targetPlanCustomized === true,
    });
    setQuickSettings(saved);
    setQuickSettingsOpen(false);
    setQuickGenerationError("");
    const generatedCount = plan.meals.filter((meal) => (
      meal?.preserved !== true || meal?.derivedFromConsumption === true
    )).length;
    setToast(generatedCount
      ? `${generatedCount} metas creadas. Conservamos tus decisiones y tu consumo.`
      : "Tus comidas ya están planificadas. No modificamos ninguna meta.");
    window.setTimeout(() => setToast(""), 3200);
  } catch (creationError) {
    const message = creationError?.message || "No se pudieron crear las metas del día.";
    setQuickGenerationError(message);
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
  } finally {
    setSaving(false);
    setQuickCreatingTargets(false);
  }
}

async function savePersonalTargetEdit({ mealId, target, mode }) {
  const date = selectedQuickDate;
  if (!date || saving) return;
  setSaving(true);
  try {
    const trackingDay = selectedTrackingQuery.data || await getTrackingDay(date);
    const personalMeals = personalMealTargetsFromTrackingDay(trackingDay);
    const editableMealIds = personalMeals
      .filter((meal) => (
        personalMealTargetOrigin(meal) === PERSONAL_MEAL_TARGET_ORIGIN.AUTO
        && !meal.confirmed
        && personalMealTargetConsumedComposition(trackingDay, meal.id).items.length === 0
      ))
      .map((meal) => meal.id);
    const plannedMealKcal = personalMealTargetTotals(personalMeals).kcal;
    const result = editPersonalMealTargetDay({
      meals: personalMeals,
      mealId,
      target,
      mode,
      editableMealIds,
      maximumKcal: plannedMealKcal,
      onlySubsequent: false,
      minimumRecipientKcal: 100,
      consumedMinimum: personalMealTargetConsumedComposition(trackingDay, mealId).totals,
    });
    const mealsById = new Map(result.meals.map((meal) => [meal.id, meal]));
    const mealsConfig = (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : []).map((config) => (
      mealsById.has(config.mealId)
        ? {
            ...config,
            meta: mealsById.get(config.mealId).target,
            targetOrigin: personalMealTargetOrigin(mealsById.get(config.mealId)),
            personalTarget: true,
          }
        : config
    ));
    await updateTrackingMealsConfig({ date, mealsConfig });
    if (quickSettings.targetPlanDate === date) {
      const saved = saveMenuGenerationSettings(currentUser, {
        ...quickSettings,
        targetMeals: result.meals,
        targetPlannedTarget: result.totals,
        targetPlanCustomized: true,
      });
      setQuickSettings(saved);
    }
    await Promise.all([
      selectedTrackingQuery.refetch(),
      loadWeek(weekStart, { silent: true }),
    ]);
    setPersonalTargetEditor(null);
    const pendingResidual = Object.values(result.residual || {}).some((value) => Math.abs(Number(value) || 0) > 0.05);
    setToast(mode === "redistribute"
      ? pendingResidual
        ? `Se ajustó lo posible. Quedaron ${formatNumber(result.residual.kcal, 1)} kcal fuera del objetivo planificado.`
        : "Meta editada y día redistribuido."
      : "Meta editada.");
    window.setTimeout(() => setToast(""), 2600);
  } finally {
    setSaving(false);
  }
}

function openPersonalTargetDayEditor(row = null, meals = []) {
  if (!canCreatePersonalMealTarget) {
    setToast("Tu acceso actual no permite editar estas metas.");
    window.setTimeout(() => setToast(""), 3000);
    return;
  }
  const personalMeals = (Array.isArray(meals) ? meals : [])
    .filter((meal) => meal?.personalTargetOnly === true)
    .map((meal) => ({ ...meal, preserved: true }));
  if (!personalMeals.length) return;
  const trackingDay = selectedTrackingQuery.data || {};
  const minimumTargetsByMealId = Object.fromEntries(personalMeals.map((meal) => [
    meal.id,
    personalMealTargetConsumedComposition(trackingDay, meal.id).totals,
  ]));
  const mealRecordsById = Object.fromEntries(personalMeals.map((meal) => [
    meal.id,
    personalMealTargetConsumedComposition(trackingDay, meal.id).items.map((entry, index) => {
      const source = entry?.snapshot || entry?.food || entry?.alimento || entry || {};
      const quantity = Number(entry?.cantidad ?? entry?.quantity ?? source?.cantidad ?? source?.quantity);
      const unit = String(entry?.unidad || entry?.unit || source?.unidad || source?.unit || "").trim();
      return {
        id: String(entry?.id || entry?._id || `${meal.id}-${index}`),
        name: String(source?.nombre || source?.name || source?.foodName || entry?.foodName || `Registro ${index + 1}`),
        detail: Number.isFinite(quantity) && quantity > 0 ? `${formatNumber(quantity, 1)} ${unit}`.trim() : "",
      };
    }),
  ]));
  const protectedMealTypes = personalMeals
    .filter((meal) => Number(minimumTargetsByMealId[meal.id]?.kcal) > 0)
    .map((meal) => meal.type);
  const freeCalories = Math.max(0, Number(
    selectedPersonalFlexiblePlan?.flexibleCalories
      ?? quickSettings.targetFreeCalories
      ?? quickSettings.freeCalories
  ) || 0);
  const editSettings = {
    ...quickSettings,
    generationProfile: "target",
    mealCount: personalMeals.length,
    mealTypes: personalMeals.map((meal) => meal.type),
    targetMeals: personalMeals,
    targetPlannedTarget: personalMealTargetTotals(personalMeals),
    targetFreeCalories: freeCalories,
    freeCalories,
    targetPlanDate: row?.date || selectedQuickDate,
    targetPlanSignature: "",
    targetPlanCustomized: true,
  };
  setTargetDayEditContext({
    date: row?.date || selectedQuickDate,
    settings: editSettings,
    minimumTargetsByMealId,
    mealRecordsById,
    protectedMealTypes,
    originalMealIds: personalMeals.map((meal) => meal.id),
  });
  setQuickGenerationError("");
  setQuickWizardPurpose("edit_targets");
  setQuickSettingsOpen(true);
}

async function savePersonalTargetDayEdits(nextSettings = {}) {
  const context = targetDayEditContext;
  const date = context?.date || selectedQuickDate;
  if (!date || saving || quickCreatingTargets) return;
  if (!canCreatePersonalMealTarget) {
    setQuickGenerationError("Tu acceso actual no permite editar estas metas.");
    return;
  }
  setSaving(true);
  setQuickCreatingTargets(true);
  try {
    const trackingDay = await getTrackingDay(date);
    const currentPersonalMeals = personalMealTargetsFromTrackingDay(trackingDay);
    const currentPersonalById = new Map(currentPersonalMeals.map((meal) => [String(meal.id), meal]));
    const nextMeals = (Array.isArray(nextSettings.targetMeals) ? nextSettings.targetMeals : [])
      .map((meal) => {
        const target = totalFromLike(meal.target || meal.meta);
        const current = currentPersonalById.get(String(meal.id || meal.mealId || ""));
        const previous = totalFromLike(current?.target || {});
        const manuallyChanged = current && ["kcal", "proteina", "carbs", "grasas"]
          .some((key) => Math.abs(Number(target[key]) - Number(previous[key])) > 0.000001);
        return {
          ...meal,
          target,
          targetOrigin: manuallyChanged
            ? PERSONAL_MEAL_TARGET_ORIGIN.MANUAL
            : personalMealTargetOrigin(current || meal),
          targetEdited: manuallyChanged || meal?.targetEdited === true,
        };
      });

    const nextMealsById = new Map(nextMeals.map((meal) => [String(meal.id || meal.mealId || ""), meal]));
    const changedLockedTarget = currentPersonalMeals.find((meal) => {
      if (
        meal?.targetLocked !== true
        && personalMealTargetOrigin(meal) !== PERSONAL_MEAL_TARGET_ORIGIN.COACH
      ) return false;
      const next = nextMealsById.get(String(meal.id));
      if (!next) return true;
      const currentTarget = totalFromLike(meal.target);
      const nextTarget = totalFromLike(next.target);
      return ["kcal", "proteina", "carbs", "grasas"].some((key) => (
        Math.abs(Number(currentTarget[key]) - Number(nextTarget[key])) > 0.000001
      ));
    });
    if (changedLockedTarget) {
      throw new Error(`${changedLockedTarget.name}: esta meta está bloqueada y debe conservarse.`);
    }

    const removalPlan = resolvePersonalMealTargetRemovals({
      originalMealIds: context?.originalMealIds,
      nextMeals,
      confirmedRemovalIds: nextSettings.targetRemovedMealIds,
    });
    const removedMealIds = removalPlan.removedMealIds;
    if (removalPlan.unconfirmedMealIds.length) {
      throw new Error("Confirmá la eliminación de cada comida antes de guardar.");
    }
    const changedRemoval = removedMealIds.find((mealId) => {
      const currentRecords = personalMealTargetConsumedComposition(trackingDay, mealId).items;
      const reviewedRecords = Array.isArray(context?.mealRecordsById?.[mealId]) ? context.mealRecordsById[mealId] : [];
      const currentIds = currentRecords
        .map((entry, index) => String(entry?.id || entry?._id || `${mealId}-${index}`))
        .sort();
      const reviewedIds = reviewedRecords
        .map((entry, index) => String(entry?.id || `${mealId}-${index}`))
        .sort();
      return currentIds.length !== reviewedIds.length
        || currentIds.some((recordId, index) => recordId !== reviewedIds[index]);
    });
    if (changedRemoval) {
      throw new Error("Los registros de una comida cambiaron mientras editabas. Cerrá y volvé a abrir para revisarlos antes de eliminar.");
    }
    for (const meal of nextMeals) {
      const consumed = personalMealTargetConsumedComposition(trackingDay, meal.id).totals;
      const target = totalFromLike(meal.target);
      try {
        assertPersonalMealTargetNotBelowConsumed(target, consumed);
      } catch (error) {
        throw new Error(`${meal.name}: ${error.message}`);
      }
    }

    const excludedIds = [...new Set([
      ...currentPersonalMeals.flatMap((meal) => meal.consumptionSourceMealIds || [meal.id]),
      ...nextMeals.flatMap((meal) => meal.consumptionSourceMealIds || [meal.id]),
    ])];
    const nonTargetTracking = generationTrackingBreakdown(trackingDay, { excludedMealIds: excludedIds });
    const freeCalories = Math.max(0, Number(nextSettings.targetFreeCalories ?? nextSettings.freeCalories) || 0);
    const budget = generationNutritionBudget({
      dailyTarget: selectedQuickTarget,
      tracking: nonTargetTracking,
      freeCalories,
    });
    const totals = personalMealTargetTotals(nextMeals);
    const exceededBudget = [
      ["kcal", "calorías"],
      ["proteina", "proteína"],
      ["carbs", "carbohidratos"],
      ["grasas", "grasas"],
    ].find(([key]) => Number(totals[key]) > Number(budget.generationTarget[key]) + 0.05);
    if (exceededBudget) {
      throw new Error(`Las metas superan el presupuesto disponible de ${exceededBudget[1]} para este día.`);
    }

    const targetConfigs = personalMealTargetConfigsFromPlan({ meals: nextMeals }, {
      idSuffix: date.replaceAll("-", ""),
    });
    let persistenceDay = trackingDay;
    if (removedMealIds.length) {
      const removedSet = new Set(removedMealIds.map(String));
      persistenceDay = {
        ...trackingDay,
        mealsConfig: (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [])
          .filter((meal) => !removedSet.has(String(meal?.mealId || meal?.id || ""))),
      };
      clearPersonalTargetDrafts(date, removedMealIds);
    }
    const mealsConfig = replacePersonalMealTargetConfigs(persistenceDay, targetConfigs);
    await updateTrackingMealsConfig({ date, mealsConfig });
    const cleanNextSettings = { ...nextSettings };
    delete cleanNextSettings.targetRemovedMealIds;
    const saved = saveMenuGenerationSettings(currentUser, {
      ...quickSettings,
      ...cleanNextSettings,
      targetMeals: nextMeals,
      targetPlannedTarget: totals,
      targetFreeCalories: freeCalories,
      freeCalories,
      targetPlanDate: date,
      targetPlanCustomized: true,
    });
    setQuickSettings(saved);
    setTargetDayEditContext(null);
    setQuickSettingsOpen(false);
    setQuickWizardPurpose("settings");
    await Promise.all([
      selectedTrackingQuery.refetch(),
      loadWeek(weekStart, { silent: true }),
    ]);
    setToast("Metas del día actualizadas.");
    window.setTimeout(() => setToast(""), 2800);
  } catch (editError) {
    setQuickGenerationError(editError?.message || "No pudimos guardar las metas del día.");
  } finally {
    setSaving(false);
    setQuickCreatingTargets(false);
  }
}

async function adjustPersonalTargetsToCurrentTracking() {
  const date = selectedQuickDate;
  if (!date || saving) return;
  setSaving(true);
  try {
    const trackingDay = await getTrackingDay(date);
    const personalMeals = personalMealTargetsFromTrackingDay(trackingDay);
    const nonTargetTracking = generationTrackingBreakdown(trackingDay, {
      excludedMealIds: personalMeals.flatMap((meal) => meal.consumptionSourceMealIds || [meal.id]),
    });
    const flexiblePlan = personalMealTargetFlexiblePlan(selectedQuickTarget, personalMeals, {
      explicitFreeCalories: quickSettings.targetPlanDate === date
        ? quickSettings.targetFreeCalories
        : null,
      expectedPlannedTarget: quickSettings.targetPlanDate === date
        ? quickSettings.targetPlannedTarget
        : null,
      consumedNutrition: nonTargetTracking.total,
      planDate: quickSettings.targetPlanDate,
      date,
    });
    const reconciliation = personalMealTargetDayReconciliation({
      dailyTarget: selectedQuickTarget,
      trackingDay,
      freeCalories: flexiblePlan?.flexibleCalories || 0,
      minimumMealKcal: 100,
    });
    if (!reconciliation?.canAdjust) {
      setDismissedReconciliationSignature(reconciliation?.signature || "");
      return;
    }

    const mealsConfig = personalMealTargetConfigsFromReconciliation(
      trackingDay,
      reconciliation
    );

    const updatedTrackingDay = await updateTrackingMealsConfig({ date, mealsConfig });
    const plannedTarget = personalMealTargetTotals(reconciliation.adjustedMeals);
    const saved = saveMenuGenerationSettings(currentUser, {
      ...quickSettings,
      targetMeals: reconciliation.adjustedMeals,
      targetPlannedTarget: plannedTarget,
      targetFreeCalories: reconciliation.accounting.initialFreeCalories,
      targetPlanDate: date,
      targetPlanCustomized: true,
    });
    setQuickSettings(saved);
    // La decisión ya fue aplicada. Si quedó un residual no compensable, no
    // mantenemos una tarjeta grande sin acciones útiles: el toast lo informa
    // una vez. Un cambio posterior en Tracking genera otra firma y vuelve a
    // mostrar la conciliación cuando realmente haya algo nuevo que revisar.
    const appliedReconciliation = personalMealTargetDayReconciliation({
      dailyTarget: selectedQuickTarget,
      trackingDay: updatedTrackingDay || { ...trackingDay, mealsConfig },
      freeCalories: reconciliation.accounting.initialFreeCalories,
      minimumMealKcal: 100,
    });
    setDismissedReconciliationSignature(appliedReconciliation?.signature || reconciliation.signature);
    await Promise.all([
      selectedTrackingQuery.refetch(),
      loadWeek(weekStart, { silent: true }),
    ]);
    setToast(reconciliation.hasResidual
      ? "Ajustamos lo posible. Quedó una diferencia no compensable en el forecast."
      : "Metas pendientes ajustadas al Tracking real.");
    window.setTimeout(() => setToast(""), 3200);
  } catch (reconciliationError) {
    setToast(reconciliationError?.message || "No pudimos ajustar las metas pendientes.");
    window.setTimeout(() => setToast(""), 3600);
  } finally {
    setSaving(false);
  }
}

async function togglePersonalTargetConfirmed(meal) {
  const date = selectedQuickDate || selectedDisplayRow?.date || selectedRow?.date;
  const selectedMealId = String(meal?.id || meal?.mealId || "").trim();
  if (!date || !selectedMealId) {
    const message = "No pudimos identificar la fecha o la comida que querés confirmar.";
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
    return { ok: false, error: message };
  }
  setSaving(true);
  try {
    const trackingDay = await getTrackingDay(date);
    const currentMeals = personalMealTargetsFromTrackingDay(trackingDay);
    const currentMeal = currentMeals.find((entry) => String(entry.id) === selectedMealId);
    if (!currentMeal) throw new Error("No encontramos la comida que querés actualizar.");
    const nonTargetTracking = generationTrackingBreakdown(trackingDay, {
      excludedMealIds: currentMeals.map((entry) => entry.id),
    });
    const flexiblePlan = personalMealTargetFlexiblePlan(selectedQuickTarget, currentMeals, {
      explicitFreeCalories: quickSettings.targetPlanDate === date
        ? quickSettings.targetFreeCalories
        : null,
      expectedPlannedTarget: quickSettings.targetPlanDate === date
        ? quickSettings.targetPlannedTarget
        : null,
      consumedNutrition: nonTargetTracking.total,
      planDate: quickSettings.targetPlanDate,
      date,
    });
    const sharedOptions = {
      trackingDay,
      mealId: currentMeal.id,
      dailyTarget: selectedQuickTarget,
      freeCalories: flexiblePlan?.flexibleCalories || 0,
      minimumMealKcal: 100,
    };
    const reopening = currentMeal.manualConsumptionConfirmed === true;
    const confirmation = reopening
      ? reopenPersonalMealTargetConsumption(sharedOptions)
      : confirmPersonalMealTargetConsumption(sharedOptions);
    const mealsConfig = confirmation.mealsConfig;

    const updatedTrackingDay = await updateTrackingMealsConfig({ date, mealsConfig });
    const savedMeals = personalMealTargetsFromTrackingDay(updatedTrackingDay);
    const savedMeal = savedMeals.find((entry) => String(entry.id) === String(currentMeal.id));
    const expectedMeal = personalMealTargetsFromTrackingDay({ mealsConfig })
      .find((entry) => String(entry.id) === String(currentMeal.id));
    const persistedTarget = savedMeal?.target || {};
    const expectedTarget = expectedMeal?.target || {};
    const targetWasPersisted = ["kcal", "proteina", "carbs", "grasas"].every((key) => (
      Math.abs((Number(persistedTarget[key]) || 0) - (Number(expectedTarget[key]) || 0)) < 0.11
    ));
    const confirmationWasPersisted = reopening
      ? savedMeal?.manualConsumptionConfirmed !== true
      : savedMeal?.manualConsumptionConfirmed === true;
    if (!savedMeal || !targetWasPersisted || !confirmationWasPersisted) {
      throw new Error("El servidor no guardó el cierre de la comida. Actualizá el backend e intentá nuevamente.");
    }

    // La respuesta del PATCH ya es el snapshot canónico. Aplicarla de inmediato
    // evita que un refetch simultáneo vuelva a pintar por unos instantes la meta
    // anterior y hace visible el cierre antes de refrescar el resumen semanal.
    queryClient.setQueryData(queryKeys.trackingDay(date), updatedTrackingDay);
    if (quickSettings.targetPlanDate === date) {
      const saved = saveMenuGenerationSettings(currentUser, {
        ...quickSettings,
        targetMeals: savedMeals,
        targetPlannedTarget: personalMealTargetTotals(savedMeals),
        targetPlanCustomized: true,
      });
      setQuickSettings(saved);
    }
    await loadWeek(weekStart, { silent: true });
    setToast(!reopening
      ? confirmation?.reconciliation?.hasResidual
        ? `${meal.name || "Meta"} cerrada con tu consumo. Quedó una diferencia diaria no compensable.`
        : `${meal.name || "Meta"} marcada como hecha y metas pendientes redistribuidas.`
      : `${meal.name || "Meta"} reabierta con su meta anterior.`);
    window.setTimeout(() => setToast(""), 2800);
    return { ok: true };
  } catch (confirmationError) {
    const message = confirmationError?.message || "No pudimos actualizar el estado de la comida.";
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
    return { ok: false, error: message };
  } finally {
    setSaving(false);
  }
}

async function toggleCoachTargetConfirmed(meal, row = selectedDisplayRow) {
  const date = row?.date || selectedQuickDate || selectedRow?.date;
  const selectedMealId = String(meal?.id || meal?.mealId || "").trim();
  if (!date || !selectedMealId) {
    const message = "No pudimos identificar la fecha o la comida asignada.";
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
    return { ok: false, error: message };
  }

  setSaving(true);
  try {
    const trackingDay = await getTrackingDay(date);
    const coachMeals = plannedMealTargets(row, trackingDay)
      .filter((entry) => entry.coachTargetOnly === true);
    const currentMeal = coachMeals.find((entry) => String(entry.id) === selectedMealId);
    if (!currentMeal) throw new Error("No encontramos la meta asignada por tu coach.");
    const reopening = currentMeal.metaConfirmed === true
      && currentMeal.metaConfirmation?.mode === "manual_consumption";
    const execution = updateCoachMealTargetExecution({
      trackingDay,
      coachMeals,
      mealId: selectedMealId,
      reopen: reopening,
    });
    const updatedTrackingDay = await updateTrackingMealsConfig({
      date,
      mealsConfig: execution.mealsConfig,
    });
    const persistedConfig = (updatedTrackingDay?.mealsConfig || [])
      .find((config) => String(config?.mealId || config?.id || "") === selectedMealId);
    const persisted = persistedConfig?.coachTargetExecution === true && (
      reopening
        ? persistedConfig.metaConfirmed !== true
        : persistedConfig.metaConfirmed === true
    );
    if (!persisted) {
      throw new Error("El servidor no guardÃ³ el cierre de la comida. ActualizÃ¡ el backend e intentÃ¡ nuevamente.");
    }

    queryClient.setQueryData(queryKeys.trackingDay(date), updatedTrackingDay);
    await loadWeek(weekStart, { silent: true });
    const hasResidual = Object.values(execution.residual || {})
      .some((value) => Math.abs(Number(value) || 0) > 0.11);
    setToast(reopening
      ? `${meal.name || "Meta"} reabierta. La planificaciÃ³n restante fue recalculada.`
      : hasResidual
        ? `${meal.name || "Meta"} cerrada. La diferencia no pudo compensarse por completo.`
        : `${meal.name || "Meta"} cerrada y lo restante se redistribuyÃ³.`);
    window.setTimeout(() => setToast(""), 3200);
    return { ok: true };
  } catch (confirmationError) {
    const message = confirmationError?.message || "No pudimos actualizar la comida asignada.";
    setToast(message);
    window.setTimeout(() => setToast(""), 3600);
    return { ok: false, error: message };
  } finally {
    setSaving(false);
  }
}

function clearPersonalTargetDrafts(date, mealIds = []) {
  try {
    const storage = globalThis.window?.localStorage;
    const owner = trackingDraftStorageOwner(currentUser);
    const state = loadTrackingDraftState(storage, owner);
    const draftsByMeal = { ...(state.draftsByMeal || {}) };
    const feedbackByMeal = { ...(state.feedbackByMeal || {}) };
    mealIds.forEach((mealId) => {
      const key = trackingDraftKey(date, mealId);
      delete draftsByMeal[key];
      delete feedbackByMeal[key];
    });
    saveTrackingDraftState(storage, owner, { draftsByMeal, feedbackByMeal });
  } catch {
    // Los borradores locales nunca deben bloquear la limpieza persistente.
  }
}

async function clearPersonalTargetFlexibleMargin(date) {
  const currentRow = days.find((day) => day.date === date) || selectedRow;
  if (!currentRow?.date) return;
  if (!flexibleMarginEntries(currentRow).length && !isFlexibleMarginCompleted(currentRow)) return;
  const nextManualEntries = replaceFlexibleMarginEntries(currentRow, [], false);
  await saveMenuTrackingDay(trackingPayloadBase(currentRow, {
    manualEntries: nextManualEntries,
    flexibleMarginCompleted: false,
  }));
}

async function applyPersonalTargetPlanAction(removalMode = "keep") {
  const action = personalTargetPlanAction;
  if (!action || saving) return;
  const date = action.date || selectedQuickDate;
  const allowedIds = new Set((action.mealIds || []).map(String));
  setSaving(true);
  try {
    const trackingDay = selectedTrackingQuery.data?.date === date
      ? selectedTrackingQuery.data
      : await getTrackingDay(date);
    const personalConfigs = (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [])
      .filter((meal) => allowedIds.has(String(meal?.mealId || meal?.id || "")));
    if (!personalConfigs.length) {
      throw new Error("No encontramos metas personales para modificar.");
    }
    const personalMealIds = action.kind === "delete_one"
      ? [String(action.mealIds?.[0] || "")].filter(Boolean)
      : personalConfigs
        .filter((meal) => {
          if (action.kind !== "format") return true;
          const id = String(meal?.mealId || meal?.id || "");
          const targetMeal = personalMealTargetsFromTrackingDay({ mealsConfig: [meal] })[0];
          const logs = Array.isArray(trackingDay?.meals?.[id]) ? trackingDay.meals[id] : [];
          return targetMeal && personalMealTargetCanRegenerate(targetMeal, trackingDay) && logs.length === 0;
        })
        .map((meal) => String(meal?.mealId || meal?.id || ""));
    if (action.kind === "format" && !personalMealIds.length) {
      throw new Error("No hay metas automáticas pendientes para regenerar.");
    }
    const removedSet = new Set(personalMealIds);
    const redistributionRequested = action.kind === "delete_one" && removalMode === "redistribute";
    const removalResult = action.kind === "delete_one"
      ? removePersonalMealTargetFromTrackingDay(trackingDay, personalMealIds[0], {
          redistribute: redistributionRequested,
        })
      : null;
    const mealsConfig = removalResult
      ? removalResult.mealsConfig
      : (Array.isArray(trackingDay?.mealsConfig) ? trackingDay.mealsConfig : [])
        .filter((meal) => !removedSet.has(String(meal?.mealId || meal?.id || "")));
    if (action.kind === "delete" || action.kind === "delete_one") {
      const planningRow = days.find((day) => day.date === date) || selectedDisplayRow || selectedRow || {};
      const choice = trackingChoice(planningRow);
      const planningMeals = choice ? choiceMeals(choice) : [];
      const compositionOrigins = plannedMealCompositionOrigins(planningMeals, {
        menuSource: choice?.snapshot?.source,
        targetMeals: personalMealTargetsFromTrackingDay(trackingDay),
        trackingDay,
      });
      const completedIds = completedMealIdSet(planningRow);
      const retiredIds = planningMeals.flatMap((meal, index) => {
        if (compositionOrigins[index] !== "auto") return [];
        const id = String(mealId(meal, index));
        const executionId = String(menuTargetExecutionContext(
          planningRow,
          meal,
          meal,
          index
        ).id);
        return completedIds.has(id) || completedIds.has(executionId) ? [] : [id];
      });
      if (retiredIds.length && planningRow?.date) {
        const nextSuppressedMealIds = [...new Set([
          ...suppressedMenuMealIds(planningRow),
          ...retiredIds,
        ])];
        const savedRetirement = await saveMenuTrackingDay(trackingPayloadBase(planningRow, {
          suppressedMenuMealIds: nextSuppressedMealIds,
        }));
        const persistedRetiredIds = suppressedMenuMealIds(savedRetirement?.record || {});
        if (!nextSuppressedMealIds.every((id) => persistedRetiredIds.includes(id))) {
          throw new Error("No pudimos confirmar el retiro de las comidas anteriores.");
        }
      }
    }
    const deletedTrackingDay = await updateTrackingMealsConfig({ date, mealsConfig });

    if (action.kind === "delete") await clearPersonalTargetFlexibleMargin(date);
    clearPersonalTargetDrafts(date, personalMealIds);
    if (action.kind === "delete_one" && quickSettings.targetPlanDate === date) {
      const remainingTargets = personalMealTargetsFromTrackingDay({ ...trackingDay, mealsConfig });
      const saved = saveMenuGenerationSettings(currentUser, {
        ...quickSettings,
        targetMeals: remainingTargets,
        targetPlannedTarget: personalMealTargetTotals(remainingTargets),
        targetPlanCustomized: true,
      });
      setQuickSettings(saved);
    } else if (action.kind === "delete" && quickSettings.targetPlanDate === date) {
      const saved = saveMenuGenerationSettings(currentUser, {
        ...quickSettings,
        targetMeals: [],
        targetPlannedTarget: null,
        targetPlanDate: "",
        targetPlanCustomized: false,
      });
      setQuickSettings(saved);
    }
    setMealDrawer(null);
    setPersonalTargetEditor(null);
    setPersonalTargetPlanAction(null);
    if (deletedTrackingDay) {
      queryClient.setQueryData(queryKeys.trackingDay(date), deletedTrackingDay);
      await loadWeek(weekStart, { silent: true });
    } else {
      await Promise.all([
        selectedTrackingQuery.refetch(),
        loadWeek(weekStart, { silent: true }),
      ]);
    }
    setToast(action.kind === "format"
      ? "Liberamos las metas automáticas pendientes. Tu consumo y tus metas manuales siguen intactos."
      : action.kind === "delete_one"
        ? redistributionRequested
          ? `Eliminamos ${String(action.mealName || "esta comida").toLowerCase()} y redistribuimos su parte pendiente. Todo lo consumido sigue en Tracking.`
          : `Eliminamos la meta de ${String(action.mealName || "esta comida").toLowerCase()}. Todo lo consumido sigue en Tracking.`
        : "Eliminamos las metas personales. Todo lo consumido sigue en Tracking.");
    window.setTimeout(() => setToast(""), 3200);
  } catch (actionError) {
    setToast(actionError?.message || "No pudimos modificar esta planificación.");
    window.setTimeout(() => setToast(""), 3600);
  } finally {
    setSaving(false);
  }
}

async function refreshQuickTracking() {
  await Promise.all([
    selectedTrackingQuery.refetch(),

    loadWeek(
      weekStart,
      {
        silent: true,
      }
    ),
  ]);
}

async function createQuickPlannedMeal() {
  const date = selectedRow?.date || selectedQuickDate;
  const kcal = Number(quickPlanMealKcal);

  if (!date || saving) return;
  if (!canCreatePersonalMealTarget) {
    setToast("Tu acceso actual no permite crear comidas por meta.");
    window.setTimeout(() => setToast(""), 3000);
    return;
  }
  if (!Number.isFinite(kcal) || kcal <= 0) {
    setToast("Ingresá una meta de calorías válida.");
    window.setTimeout(() => setToast(""), 2600);
    return;
  }
  if (quickPlanMealCalculation.invalidLockedMacros.length || quickPlanMealCalculation.cannotMatchTarget) {
    setToast("Revisá los macros fijos: con esos candados no se puede alcanzar la meta calórica.");
    window.setTimeout(() => setToast(""), 3200);
    return;
  }

  setSaving(true);
  try {
    const trackingDay = selectedTrackingQuery.data || await getTrackingDay(date);
    const mealsConfig = appendPersonalMealTargetConfig(trackingDay, {
      type: quickPlanMealType,
      kcal,
      macros: quickPlanMealMacros,
      locks: quickPlanMealMacroLocks,
      dailyTarget: selectedQuickTarget,
    });
    const createdMeal = personalMealTargetsFromTrackingDay({ mealsConfig }).at(-1);

    await updateTrackingMealsConfig({ date, mealsConfig });
    const refreshedTracking = await selectedTrackingQuery.refetch();
    await loadWeek(weekStart, { silent: true });

    setQuickPlanMealOpen(false);
    setQuickPlanMealStep("mode");
    setQuickPlanMealMode("target");
    setQuickPlanMealKcal("");
    setQuickPlanMealMacros({ proteina: "", carbs: "", grasas: "" });
    setQuickPlanMealMacroLocks({ proteina: false, carbs: false, grasas: false });
    setToast(`${createdMeal?.name || "Comida"} creada por meta.`);
    window.setTimeout(() => setToast(""), 2600);

    if (createdMeal) {
      const freshMeal = personalMealTargetsFromTrackingDay(refreshedTracking.data)
        .find((meal) => meal.id === createdMeal.id) || createdMeal;
      setMealDrawer({
        row: selectedDisplayRow || selectedRow,
        meal: freshMeal,
        baseMeal: freshMeal,
        mealIndex: 0,
        nativeTarget: true,
        initialView: "target",
      });
    }
  } catch (creationError) {
    setToast(creationError?.message || "No se pudo crear la comida por meta.");
    window.setTimeout(() => setToast(""), 3200);
  } finally {
    setSaving(false);
  }
}

function openQuickFreeMealEditor() {
  const date = selectedRow?.date || selectedQuickDate;
  if (!date || saving) return;
  if (!canCreateAutonomousMenu) {
    setToast("Tu acceso actual no permite crear comidas libres.");
    window.setTimeout(() => setToast(""), 3000);
    return;
  }

  const typeLabels = {
    desayuno: "Desayuno",
    almuerzo: "Almuerzo",
    merienda: "Merienda",
    cena: "Cena",
    picoteo: "Picoteo",
    snack: "Snack",
  };
  const title = typeLabels[quickPlanMealType] || "Comida";
  const currentChoice = trackingChoice(selectedDisplayRow || selectedRow || {});
  const baseMeals = choiceMeals(currentChoice)
    .filter(mealHasContent)
    .map(normalizeQuickMeal);

  setQuickPlanMealOpen(false);
  setQuickPlanMealStep("mode");
  setQuickMealEditor({
    mode: "create-free",
    date,
    title,
    mealType: quickPlanMealType,
    baseMeals,
    requireFood: true,
    mealDraft: normalizeQuickMeal({
      id: uid("meal"),
      nombre: title,
      tipoComida: quickPlanMealType,
      orden: baseMeals.length + 1,
      target: null,
      compositionOrigin: "manual",
      generationSource: "",
      items: [],
    }, baseMeals.length),
    token: `free-${date}-${quickPlanMealType}-${Date.now()}`,
  });
}


async function registerPlannedTargetComposition({
  row,
  targetMeal,
  targetExecution,
  plannedMeal,
  mealIndex = 0,
} = {}) {
  const date = row?.date || selectedQuickDate;
  const execution = targetExecution || menuTargetExecutionContext(
    row || {},
    targetMeal || {},
    targetMeal || {},
    mealIndex
  );
  const sourceItems = Array.isArray(plannedMeal?.items)
    ? plannedMeal.items
    : Array.isArray(plannedMeal?.foods)
      ? plannedMeal.foods
      : Array.isArray(plannedMeal?.alimentos)
        ? plannedMeal.alimentos
        : [];

  if (!date || !execution?.id || !sourceItems.length || saving) return false;

  const items = sourceItems.map((item, index) => ({
    ...normalizeQuickMenuItem(item, index),
    // Un ID visual sintetizado no debe llegar al backend como si fuera ObjectId.
    alimentoId: item?.alimentoId || item?.foodId || item?.alimentoObjectId || null,
    quantitySource: "manual",
  }));
  const compositionId = String(
    plannedMeal?.id || plannedMeal?._id || mealId(plannedMeal, mealIndex)
  );
  const requestId = [
    "planned",
    date,
    safeMenuTargetId(execution.id),
    safeMenuTargetId(compositionId),
  ].filter(Boolean).join("-").slice(0, 120);
  const batch = buildCompletionTrackingBatch({
    date,
    trackingExecutionId: execution.id,
    replacementMeal: {
      requestId,
      mealType: execution.type || plannedMeal?.tipoComida || plannedMeal?.type || "otra",
      originalMealName: execution.label || mealName(targetMeal || plannedMeal, mealIndex),
      items,
    },
  });

  if (!batch) {
    setToast("No se pudo preparar la comida planificada para Tracking.");
    window.setTimeout(() => setToast(""), 3200);
    return false;
  }

  setSaving(true);
  try {
    const updatedTracking = await addFoodLogsBatch(batch);
    if (updatedTracking) {
      queryClient.setQueryData(queryKeys.trackingDay(date), updatedTracking);
    }
    await Promise.all([
      selectedTrackingQuery.refetch(),
      loadWeek(weekStart, { silent: true }),
    ]);
    setToast(`${execution.label || "Comida"} registrada como consumida.`);
    window.setTimeout(() => setToast(""), 3000);
    return true;
  } catch (error) {
    setToast(error?.message || "No se pudo registrar la comida planificada.");
    window.setTimeout(() => setToast(""), 3600);
    return false;
  } finally {
    setSaving(false);
  }
}


  const autonomousActions = {
    visible: showAutonomousQuickActions,
    canUseLibrary: canUseAutonomousLibrary,
    canCreate: canCreateAutonomousMenu,
    canGenerate: canGenerateAutonomousMenu,
    canPlanMeal: canCreatePersonalMealTarget || canCreateAutonomousMenu,
    canEditSettings: canEditAutonomousSettings,
    settings: quickSettings,
    targetDayEditContext,
    targetGenerationContext: selectedTargetGenerationContext,
    onTrackingChanged:
  refreshQuickTracking,
    settingsOpen: quickSettingsOpen,
    wizardPurpose: quickWizardPurpose,
    generating: quickGenerating || quickCreatingTargets,
    creatingTargets: quickCreatingTargets,
    generationAction: generationActionForSettings(quickSettings),
    error: quickGenerationError,
    topUpOffer: quickTopUpOffer,
    hasTarget: selectedQuickTarget.kcal > 0,
    target: selectedQuickTarget,
    trackingBreakdown: selectedGenerationTrackingBreakdown,
    hasMenu: Boolean(trackingChoice(selectedRow)?.snapshot),
    canSaveDay: Boolean(
      selectedPersonalMealTargets.length ||
      choiceMeals(trackingChoice(selectedDisplayRow || selectedRow || {})).some((meal) => mealFoods(meal).length > 0)
    ),
    onSaveDay: openSaveDayFavorite,
    onSaveMeal: saveMenuMealAsSavedMeal,
    onRegisterPlannedTargetComposition: registerPlannedTargetComposition,
    onOpenSavedDays: () => navigate("/app/menu/favoritas"),
    hasAutomaticMenuPlanning: canQuickEditActiveMenu && (() => {
      const choice = trackingChoice(selectedDisplayRow || selectedRow || {});
      return plannedMealCompositionOrigins(choiceMeals(choice), {
        menuSource: choice?.snapshot?.source,
        targetMeals: selectedPersonalMealTargets,
        trackingDay: selectedTrackingQuery.data,
      }).some((origin) => origin === "auto");
    })(),
    onLibrary: openQuickLibrary,
    onCreate: openQuickCreateMenu,

onPlanMeal: () => {
  setQuickPlanMealType(
    "almuerzo"
  );

  setQuickPlanMealStep(
    "mode"
  );

  setQuickPlanMealMode("target");

  setQuickPlanMealKcal("");
  setQuickPlanMealMacros({ proteina: "", carbs: "", grasas: "" });
  setQuickPlanMealMacroLocks({ proteina: false, carbs: false, grasas: false });

  setQuickPlanMealOpen(true);
},


onAutomatic: () => {
  if (generationActionForSettings(quickSettings) === "create_targets") {
    setQuickGenerationError("");
    setQuickTopUpOffer(null);
    if (!canCreatePersonalMealTarget) {
      setQuickGenerationError("Tu acceso actual no permite crear comidas por meta.");
      return;
    }
    setQuickWizardPurpose("generate");
    setQuickSettingsOpen(true);
    return;
  }

  if (!canGenerateAutonomousMenu) {
    navigate("/app/planes");
    return;
  }

  setQuickGenerationError("");
  setQuickTopUpOffer(null);
  setQuickSettingsOpen(false);

  void runQuickAutomatic();
},

    onAcceptTopUp: () => runQuickAutomatic({ allowCalorieTopUp: true }),
    onRejectTopUp: () => setQuickTopUpOffer(null),
    onTracking: openQuickTracking,
    onToggleSettings: () => {
      setQuickGenerationError("");
      setQuickWizardPurpose("settings");
      setQuickSettingsOpen((current) => !current);
    },
    onCloseSettings: () => {
      setQuickSettingsOpen(false);
      if (quickWizardPurpose === "edit_targets") {
        setTargetDayEditContext(null);
        setQuickWizardPurpose("settings");
        setQuickGenerationError("");
      }
    },
    onSaveSettings: saveQuickSettings,
    onGenerateFromSettings: generateFromWizard,
    onCreateTargetsFromSettings: createTargetsFromWizard,
    onDeleteAutomaticMenuMeal: requestDeleteAutomaticMenuMeal,
    onDeleteAutomaticMenuMeals: requestDeleteAutomaticMenuMeals,
    onEditPersonalTarget: (meal) => setPersonalTargetEditor({ meal }),
    onEditPersonalTargetDay: openPersonalTargetDayEditor,
    onUpdatePersonalTargetDay: savePersonalTargetDayEdits,
    onTogglePersonalTargetConfirmed: togglePersonalTargetConfirmed,
    onToggleCoachTargetConfirmed: toggleCoachTargetConfirmed,
    personalTargetReconciliation: visiblePersonalTargetReconciliation,
    onMaintainPersonalTargetPlanning: () => setDismissedReconciliationSignature(
      selectedPersonalTargetReconciliation?.signature || ""
    ),
    onAdjustPersonalTargetsToTracking: adjustPersonalTargetsToCurrentTracking,
    onFormatPersonalTargets: (row, meals = []) => setPersonalTargetPlanAction({
      kind: "format",
      date: row?.date || selectedQuickDate,
      mealIds: editablePersonalMealTargetIds(meals),
    }),
    onDeletePersonalTargets: (row, meals = []) => setPersonalTargetPlanAction({
      kind: "delete",
      date: row?.date || selectedQuickDate,
      mealIds: editablePersonalMealTargetIds(meals),
    }),
    onDeletePersonalTarget: (row, meal, context = {}) => {
      const mealIds = editablePersonalMealTargetIds([meal]);
      if (!mealIds.length) {
        setToast("Esta meta está bloqueada y no se puede eliminar.");
        window.setTimeout(() => setToast(""), 3000);
        return;
      }
      setPersonalTargetPlanAction({
        kind: "delete_one",
        date: row?.date || selectedQuickDate,
        mealIds,
        mealName: context.mealName || meal?.name || meal?.nombre || "esta comida",
        hasFoodLogs: context.hasFoodLogs === true,
        wasClosed: context.wasClosed === true,
        canRedistribute: personalMealTargetsFromTrackingDay(selectedTrackingQuery.data)
          .some((candidate) => (
            String(candidate.id) !== String(mealIds[0])
            && candidate.confirmed !== true
            && candidate.targetLocked !== true
            && personalMealTargetOrigin(candidate) === PERSONAL_MEAL_TARGET_ORIGIN.AUTO
          )),
      });
    },
    personalTargetFlexibleSettings: {
      explicitFreeCalories: quickSettings.targetFreeCalories,
      expectedPlannedTarget: quickSettings.targetPlannedTarget,
      planDate: quickSettings.targetPlanDate,
    },
    legacyTargetPlanDate: quickSettings.targetPlanDate,
    legacyTargetMeals: Array.isArray(quickSettings.targetMeals) ? quickSettings.targetMeals : [],
    onRestoreSettings: restoreQuickSettings,
    onOpenObjectives: () => navigate("/app/objetivos"),
  };

  function canNavigateToMenuDate(date = "") {
    if (!date || !historyOldestDate) return true;
    // The menu endpoint loads a complete week, so the whole requested range must remain available.
    return mondayOfWeek(date) >= historyOldestDate;
  }

  const previousDayDisabled = selectedRow?.date
    ? !canNavigateToMenuDate(addDays(selectedRow.date, -1))
    : false;
  const manualCompletionSummary = useMemo(
    () => manualCompletionSummaryForRow(
      selectedDisplayRow,
      canUseManualDayCompletion,
      selectedTrackingQuery.data,
      quickSettings.targetPlanDate === selectedQuickDate ? quickSettings.targetMeals : []
    ),
    [
      canUseManualDayCompletion,
      quickSettings.targetMeals,
      quickSettings.targetPlanDate,
      selectedDisplayRow,
      selectedQuickDate,
      selectedTrackingQuery.data,
    ]
  );
  const loadWeekLatestRef = useRef(loadWeek);
  loadWeekLatestRef.current = loadWeek;

  useEffect(() => {
    const date = selectedQuickDate;
    const rememberedTargets = quickSettings.targetPlanDate === date
      && Array.isArray(quickSettings.targetMeals)
      ? quickSettings.targetMeals
      : [];
    const row = selectedDisplayRow || selectedRow || null;
    if (
      !date
      || !row?.date
      || row.date !== date
      || selectedPersonalMealTargets.length
      || suppressedMenuMealIds(row).length
    ) return;
    const choice = trackingChoice(row);
    if (!choice?.snapshot) return;
    const plannedMeals = choiceMeals(choice);
    const source = String(choice?.snapshot?.source || "").trim().toLowerCase();
    const sourceDeclaresAutomatic = /^(auto|generat)/.test(source) || source === "autonomous";
    const identifiableLegacyAutomaticMeals = plannedMeals.filter((meal) => (
      plannedMealCompositionOrigin(meal) === "auto"
    ));
    const deletedLegacyTargetPlan = quickSettings.generationProfile === "target"
      && Boolean(quickSettings.targetPlanSignature)
      && Boolean(row?.tracking?.updatedAt || selectedTrackingQuery.data?.updatedAt)
      && identifiableLegacyAutomaticMeals.length >= 3;
    const legacyTargets = rememberedTargets.length >= 3
      ? rememberedTargets
      : quickSettings.generationProfile === "target"
        && (sourceDeclaresAutomatic || deletedLegacyTargetPlan)
        ? identifiableLegacyAutomaticMeals.map((meal, index) => ({
            id: String(mealId(meal, index)),
            type: String(meal?.tipoComida || meal?.mealType || meal?.type || meal?.tipo || ""),
          }))
        : [];
    if (legacyTargets.length < 3) return;
    const reconciliation = reconcilePlannedMealsWithPersonalTargets({
      plannedMeals,
      trackingDay: selectedTrackingQuery.data,
      completedMealIds: row?.tracking?.completedMenuMealIds,
      legacyTargetMeals: legacyTargets,
      menuSource: choice?.snapshot?.source,
    });
    const retiredIds = reconciliation.supersededMeals
      .map((meal, index) => String(mealId(meal, index)))
      .filter(Boolean);
    if (retiredIds.length < 3) return;
    const migrationKey = `${date}:${retiredIds.sort().join("|")}`;
    if (legacyRetirementMigrationRef.current.has(migrationKey)) return;
    legacyRetirementMigrationRef.current.add(migrationKey);

    void (async () => {
      try {
        const savedTrackingDay = await saveMenuTrackingDay(trackingPayloadBase(row, {
          suppressedMenuMealIds: retiredIds,
        }));
        const persistedRetiredIds = suppressedMenuMealIds(savedTrackingDay?.record || {});
        if (!retiredIds.every((id) => persistedRetiredIds.includes(id))) {
          throw new Error("El backend aun no confirmo el retiro de las comidas anteriores.");
        }
        await Promise.all([
          selectedTrackingQuery.refetch(),
          loadWeekLatestRef.current(weekStart, { silent: true }),
        ]);
        const saved = saveMenuGenerationSettings(currentUser, {
          ...quickSettings,
          targetMeals: [],
          targetPlannedTarget: null,
          targetPlanDate: "",
          targetPlanCustomized: false,
        });
        setQuickSettings(saved);
      } catch (migrationError) {
        legacyRetirementMigrationRef.current.delete(migrationKey);
        setToast(migrationError?.message || "No pudimos terminar de retirar la planificación automática anterior.");
        window.setTimeout(() => setToast(""), 3600);
      }
    })();
  }, [
    currentUser,
    days,
    quickSettings,
    selectedDisplayRow,
    selectedPersonalMealTargets,
    selectedQuickDate,
    selectedRow,
    selectedTrackingQuery,
    weekStart,
  ]);

  async function loadManualCompletionPreview(summary = manualCompletionSummary) {
    if (!summary?.row?.date || saving) return;
    setManualCompletionPrompt({
      row: summary.row,
      completed: summary.completed,
      total: summary.total,
      loading: true,
      error: "",
      progress: null,
    });
    try {
      const trackingDay = await getTrackingDay(summary.row.date);
      const target = hasConfiguredTarget(summary.row)
        ? summary.row.target
        : trackingDay?.objetivo;
      const progress = calculateManualDayProgress({
        target,
        menuConsumed: menuConsumedTotals(summary.row),
        trackedConsumed:
          summary.row?.tracking?.manualTrackingTotals ||
          trackingDay?.totals ||
          {},
      });
      setManualCompletionPrompt((current) => current?.row?.date === summary.row.date
        ? { ...current, loading: false, error: "", progress }
        : current);
    } catch (previewError) {
      setManualCompletionPrompt((current) => current?.row?.date === summary.row.date
        ? {
            ...current,
            loading: false,
            progress: null,
            error: previewError?.message || "Revisá tu conexión e intentá nuevamente.",
          }
        : current);
    }
  }

  async function confirmManualDayCompletion() {
    const prompt = manualCompletionPrompt;
    if (!prompt?.row?.date || !prompt?.progress || prompt.loading || saving) return;
    setSaving(true);
    try {
      await updateManualDayCompletion(prompt.row.date, {
        dayCompletionMode: "manual_completion",
        selectedAlternative: prompt.row?.tracking?.selectedAlternative || null,
      });
      setManualCompletionPrompt(null);
      menuWeekMemoryCache.delete(mondayOfWeek(prompt.row.date));
      navigate(`/app/tracking?date=${encodeURIComponent(prompt.row.date)}`);
    } catch (completionError) {
      setManualCompletionPrompt((current) => current
        ? {
            ...current,
            error: completionError?.message || "No se pudo cambiar el modo del día.",
          }
        : current);
    } finally {
      setSaving(false);
    }
  }

  function renderManualCompletionAction(summary = manualCompletionSummary) {
    if (!summary?.show) return null;
    return (
      <ManualDayCompletionAction
        active={summary.active}
        completed={summary.completed}
        total={summary.total}
        disabled={saving}
        canPlan={canPlanRemainingIntake}
        coachMenu={menuSourceMeta(activePlanSource).key === "coach"}
        onStart={() => loadManualCompletionPreview(summary)}
        onOpenTracking={() => navigate(`/app/tracking?date=${encodeURIComponent(summary.row.date)}`)}
      />
    );
  }

function openMealAction(payload = {}) {

  if (payload.action === "native_target") {
  setMealDrawer({
    ...payload,

    /*
     * Esta comida YA nació como meta.
     * No hay que tocar targetMealIds.
     */
    nativeTarget: true,

    initialView: "target",
  });

  return;
}


if (payload.action === "target") {
  const targetMeal =
    payload.baseMeal ||
    payload.meal;

  void setMealTargetMode({
    row: payload.row,
    meal: targetMeal,
    mealIndex:
      Number(payload.mealIndex) || 0,
    active: true,
  });

  setMealDrawer({
    ...payload,
    initialView: "target",
  });

  return;
}

if (payload.action === "native_target_complete") {
  if (equivalentMealAccess.canCreate) {
    setMealDrawer(null);

    setEquivalentMealBuilder({
      ...payload,

  completionMode:
  payload.completionMode === true,
      nativeTarget: true,

      initialSection: "library",
    });

    return;
  }

  setToast(
    "La generación automática no está habilitada para este acceso."
  );

  window.setTimeout(
    () => setToast(""),
    3000
  );

  return;
}


  if (payload.action === "settings") {
    if (equivalentMealAccess.canCreate) {
      setEquivalentMealBuilder({
        ...payload,
        initialSection: "settings",
      });

      return;
    }

    setToast(
      "Los ajustes de reemplazo no estan habilitados para este acceso."
    );

    window.setTimeout(
      () => setToast(""),
      3000
    );

    return;
  }

  if (
    payload.action === "replace" &&
    equivalentMealAccess.canCreate
  ) {
    setMealDrawer(null);

    setEquivalentMealBuilder({
      ...payload,
      initialSection: "library",
    });

    return;
  }

  setMealDrawer({
    ...payload,
    initialView:
      payload.action === "replace"
        ? "replace"
        : "detail",
  });
}

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

  function requestDeleteAutomaticMenuMeal(row, meal, mealIndex = 0) {
    const targetRow = row || selectedRow;
    const choice = trackingChoice(targetRow);
    if (saving || !canQuickEditMenuChoice(choice, activePlanSource, targetRow?.date)) return;
    setAutomaticMenuPlanAction({
      kind: "one",
      planningKind: isFreePlannedMenuMeal(targetRow, meal) ? "free" : "automatic",
      row: targetRow,
      meal,
      mealIndex,
      mealName: mealName(meal, mealIndex),
    });
  }

  function requestDeleteAutomaticMenuMeals(row = selectedRow) {
    const targetRow = row || selectedRow;
    const choice = trackingChoice(targetRow);
    if (saving || !canQuickEditMenuChoice(choice, activePlanSource, targetRow?.date)) return;
    setAutomaticMenuPlanAction({
      kind: "all",
      row: targetRow,
    });
  }

  async function applyAutomaticMenuPlanRemoval() {
    if (!automaticMenuPlanAction || saving) return;
    const row = automaticMenuPlanAction.row || selectedRow || {};
    const menuId = activeMenuIdFrom(row, activePlan);
    if (!menuId) {
      setToast("No pudimos identificar el menú automático.");
      window.setTimeout(() => setToast(""), 3000);
      return;
    }

    setSaving(true);
    try {
      const menu = await getClientMenu(menuId);
      const choice = trackingChoice(row);
      const draft = normalizeClientMenuForQuickEdit(menu || {}, choice, activePlan);
      let nextMeals = [];

      if (automaticMenuPlanAction.kind === "one") {
        const removeIndex = findQuickMealIndex(
          draft,
          automaticMenuPlanAction.meal,
          automaticMenuPlanAction.mealIndex
        );
        if (!draft.comidas?.[removeIndex]) {
          throw new Error("No encontramos la comida que querés eliminar.");
        }
        nextMeals = draft.comidas.filter((_, index) => index !== removeIndex);
      }

      const hasPhysicalMeal = nextMeals.some(mealHasContent);
      if (automaticMenuPlanAction.kind === "all" || !hasPhysicalMeal) {
        await deleteClientMenu(menuId, { confirmActiveDelete: true });
      } else {
        await updateClientMenu(menuId, quickMenuPayload(draft, nextMeals));
      }

      await Promise.all([
        loadWeek(weekStart, { silent: true }),
        selectedTrackingQuery.refetch(),
      ]);
      setAutomaticMenuPlanAction(null);
      setToast(automaticMenuPlanAction.kind === "all" || !hasPhysicalMeal
        ? "Comidas eliminadas. El día volvió a quedar sin planificación."
        : `${automaticMenuPlanAction.mealName || "Comida"} eliminada de la planificación.`);
      window.setTimeout(() => setToast(""), 3200);
    } catch (removalError) {
      setToast(removalError?.message || "No se pudieron eliminar las comidas.");
      window.setTimeout(() => setToast(""), 3600);
    } finally {
      setSaving(false);
    }
  }

  async function openQuickMealEditor(context = {}) {
    const row = context.row || selectedRow;
    const choice = trackingChoice(row);
    const dateScopedOwnMenu = isDateScopedOwnMenuChoice(choice, row?.date);
    if (!canQuickEditMenuChoice(choice, activePlanSource, row?.date) || saving) return;
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
      const draft = normalizeClientMenuForQuickEdit(menu || {}, choice, activePlan);
      const resolvedMealIndex = findQuickMealIndex(draft, baseMeal, mealIndex);
      const mealDraft = draft.comidas[resolvedMealIndex] || normalizeQuickMeal(baseMeal, mealIndex);
      setQuickMealEditor({
        ...loadingContext,
        loading: false,
        draft,
        mealDraft,
        mealIndex: resolvedMealIndex,
        mode: dateScopedOwnMenu
          ? isFreePlannedMenuMeal(row, mealDraft) ? "edit-free" : "edit-day"
          : "edit-menu",
        dateScoped: dateScopedOwnMenu,
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

  async function saveQuickMealChanges(nextMeal, options = {}) {
    if (!quickMealEditor || saving) return;

    if (quickMealEditor.mode === "create-free") {
      const date = quickMealEditor.date || selectedRow?.date || selectedQuickDate;
      const items = (nextMeal?.items || []).map((item, index) => ({
        ...normalizeQuickMenuItem(item, index),
        alimentoId: item?.alimentoId || item?.foodId || item?.alimentoObjectId || null,
        quantitySource: "manual",
      }));
      if (!date || !items.length) {
        setToast("Agregá al menos un alimento para registrar la comida.");
        window.setTimeout(() => setToast(""), 2800);
        return;
      }

      const mealStatus = options?.mealStatus === "done" ? "done" : "planned";
      if (mealStatus === "done") {
        const mealType = nextMeal?.tipoComida || quickMealEditor.mealType || "otra";
        const token = String(quickMealEditor.token || uid("free-tracking"))
          .replace(/[^a-zA-Z0-9_-]/g, "")
          .slice(-36);
        const trackingMealId = `tracked_${mealType}_${date}_${token}`.slice(0, 80);
        const requestId = `free-done-${date}-${token}`.slice(0, 120);

        setSaving(true);
        try {
          const updatedTracking = await addFoodLogsBatch({
            requestId,
            date,
            mealId: trackingMealId,
            mealType,
            mealName: nextMeal?.nombre || quickMealEditor.title || "Comida",
            source: "free_meal_registration",
            items,
          });
          if (updatedTracking) {
            queryClient.setQueryData(queryKeys.trackingDay(date), updatedTracking);
          }
          await Promise.all([
            selectedTrackingQuery.refetch(),
            loadWeek(weekStart, { silent: true }),
          ]);
          setQuickMealEditor(null);
          setToast(`${quickMealEditor.title || "Comida"} registrada como hecha.`);
          window.setTimeout(() => setToast(""), 2800);
        } catch (err) {
          setToast(err?.message || "No se pudo registrar la comida como hecha.");
          window.setTimeout(() => setToast(""), 3200);
        } finally {
          setSaving(false);
        }
        return;
      }

      const baseMeals = Array.isArray(quickMealEditor.baseMeals)
        ? quickMealEditor.baseMeals.map(normalizeQuickMeal)
        : [];
      const plannedMeal = normalizeQuickMeal({
        ...nextMeal,
        nombre: nextMeal.nombre || quickMealEditor.title || "Comida",
        tipoComida: nextMeal.tipoComida || quickMealEditor.mealType || "otra",
        orden: baseMeals.length + 1,
        target: null,
        targetMealId: null,
        targetOrigin: null,
        compositionOrigin: "manual",
        generationSource: "",
        plannerSlotIndex: null,
        items,
      }, baseMeals.length);
      const menuName = `Plan libre - ${quickMealEditor.title || "Comida"} - ${date}`;
      const payload = {
        ...quickMenuPayload({
          nombre: menuName,
          descripcion: "Comida libre planificada para una fecha puntual.",
          source: "manual",
          selectedDays: [dayKeyFromIsoDate(date)],
        }, [...baseMeals, plannedMeal]),
        fechaInicio: date,
        selectedDate: date,
        activationScope: "date",
        activationDate: date,
        activate: true,
      };

      setSaving(true);
      try {
        await createClientMenu(payload);
        await Promise.all([
          loadWeek(weekStart, { silent: true }),
          selectedTrackingQuery.refetch(),
        ]);
        setQuickMealEditor(null);
        setToast(`${quickMealEditor.title || "Comida"} planificada sin meta.`);
        window.setTimeout(() => setToast(""), 2800);
      } catch (err) {
        setToast(err?.message || "No se pudo planificar la comida libre.");
        window.setTimeout(() => setToast(""), 3200);
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!quickMealEditor.menuId || !quickMealEditor.draft) return;
    const draft = quickMealEditor.draft;
    const mealIndex = quickMealEditor.mealIndex;
    const nextComidas = (draft.comidas || []).map((meal, index) =>
      index === mealIndex
        ? normalizeQuickMeal({
            ...meal,
            ...nextMeal,
            items: nextMeal.items || [],
            compositionOrigin: "manual",
            generationSource: "",
            plannerSlotIndex: null,
          }, index)
        : normalizeQuickMeal(meal, index)
    );
    const payload = quickMenuPayload(draft, nextComidas);
    const plannedTotals = sumTotals(nextComidas.map((meal) => sumTotals(meal.items || [])));
    const dayTarget = targetTotals(quickMealEditor.row || {});
    const plannedKcalOverage = dayTarget.kcal > 0 ? plannedTotals.kcal - dayTarget.kcal : 0;
    setSaving(true);
    try {
      await updateClientMenu(quickMealEditor.menuId, payload);
      await loadWeek(weekStart, { silent: true });
      setQuickMealEditor(null);
      setToast(plannedKcalOverage > 0.5
        ? `Cambios guardados. La planificación excede la meta del día por ${formatNumber(plannedKcalOverage, 0)} kcal.`
        : "Alimentos del menú actualizados.");
      window.setTimeout(() => setToast(""), plannedKcalOverage > 0.5 ? 4200 : 2600);
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
    if (!canNavigateToMenuDate(nextDate)) {
      setToast(`Solo se conserva el detalle de los últimos ${trackingHistoryDays} días.`);
      window.setTimeout(() => setToast(""), 2800);
      return;
    }
    setSelectedDate(nextDate);
    const nextWeek = mondayOfWeek(nextDate);
    if (nextWeek !== weekStart) setWeekStart(nextWeek);
  }

  async function submitTracking(payload, message = "Registro guardado.") {
    if (!payload?.date) return false;
    setSaving(true);
    try {
      await saveMenuTrackingDay(payload);
      await loadWeek(weekStart, { silent: true });
      setToast(message);
      window.setTimeout(() => setToast(""), 2600);
      return true;
    } catch (err) {
      setToast(err?.message || "No se pudo guardar el registro.");
      return false;
    } finally {
      setSaving(false);
    }
  }



async function setMealTargetMode({
  row,
  meal,
  mealIndex = 0,
  active = true,
} = {}) {
  if (!row?.date || !meal || saving) {
    return false;
  }

  /*
   * ID REAL de la comida del menú.
   * Ejemplo: el ID del Almuerzo/Merienda
   * que viene del menú asignado.
   */
  const id = String(
    mealId(
      meal,
      mealIndex
    )
  );

  /*
   * Tomamos el tracking actual del día.
   */
  const currentPayload =
    trackingPayloadBase(row);

  /*
   * Comidas actualmente configuradas
   * en modo Por meta.
   */
  const targetIds = new Set(
    (
      currentPayload.targetMealIds || []
    ).map(String)
  );

  /*
   * Comidas marcadas como Hecha.
   */
  const completedIds = new Set(
    (
      currentPayload.completedMenuMealIds || []
    ).map(String)
  );

  if (active) {
    /*
     * =====================================
     * ACTIVAR POR META
     * =====================================
     *
     * Una comida NO puede estar:
     *
     * ✓ Hecha como propuesta
     * Y
     * 🎯 Por meta
     *
     * simultáneamente.
     */

    targetIds.add(id);

    completedIds.delete(id);

  } else {
    /*
     * =====================================
     * SALIR DE POR META
     * =====================================
     */

    targetIds.delete(id);
  }

  const nextTargetMealIds = [
    ...targetIds,
  ];

  const nextCompletedMenuMealIds = [
    ...completedIds,
  ];

  /*
   * Valores nuevos que queremos guardar
   * dentro de row.tracking.
   */
  const trackingOverrides = {
    targetMealIds:
      nextTargetMealIds,

    completedMenuMealIds:
      nextCompletedMenuMealIds,
  };

  /*
   * =====================================
   * ACTUALIZACIÓN OPTIMISTA
   * =====================================
   *
   * Cambiamos la UI inmediatamente,
   * sin esperar al backend.
   */
  const optimisticRow =
    rowWithTracking(
      row,
      trackingOverrides
    );

  /*
   * Actualizamos la semana visible.
   */
  setWeekData((currentData) =>
    currentData
      ? {
          ...currentData,

          days: (
            currentData.days || []
          ).map((day) =>
            day.date ===
            optimisticRow.date
              ? optimisticRow
              : day
          ),
        }
      : currentData
  );

  /*
   * Si está abierto el detalle del día,
   * también lo actualizamos.
   */
  setDetailRow((current) =>
    current?.date ===
    optimisticRow.date
      ? optimisticRow
      : current
  );

  /*
   * Si está abierto el drawer de la comida,
   * mantenemos también la row actualizada.
   */
  setMealDrawer((current) =>
    current?.row?.date ===
    optimisticRow.date
      ? {
          ...current,
          row: optimisticRow,
        }
      : current
  );

  /*
   * =====================================
   * PERSISTENCIA REAL
   * =====================================
   *
   * submitTracking se encarga de:
   *
   * - guardar en backend
   * - recargar la semana
   * - mostrar toast
   */
  return await submitTracking(
    trackingPayloadBase(
      row,
      trackingOverrides
    ),

    active
      ? "Comida configurada por meta."
      : "Comida restaurada a su propuesta."
  );
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

  async function persistSavedMeal(payload, options = {}) {
    if (!payload?.items?.length || saving) return false;
    setSaving(true);
    try {
      await createSavedMeal(payload);
      if (options.closeDraft !== false) setSaveMealDraft(null);
      setToast(`“${payload.nombre}” quedó guardada en Mis comidas.`);
      window.setTimeout(() => setToast(""), 3000);
      return true;
    } catch (err) {
      setToast(err?.message || "No se pudo guardar esta comida.");
      window.setTimeout(() => setToast(""), 3600);
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveMenuMealAsSavedMeal(meal, mealIndex = 0, options = {}) {
    if (!meal || saving) return false;
    const activeMenuSource = menuSourceMeta(activePlanSource).key;
    const source = savedMealSourceMeta(meal, {
      menuSource: activeMenuSource,
      ...options,
    });
    const payload = savedMealPayloadFromMenuMeal(meal, mealIndex, {
      menuSource: activeMenuSource,
      ...options,
      sourceKind: source.kind,
    });
    if (!payload.items.length) {
      setToast("Esta comida no tiene alimentos para guardar.");
      window.setTimeout(() => setToast(""), 2600);
      return false;
    }
    if (options.immediate === true) {
      return await persistSavedMeal(payload);
    }
    setSaveMealDraft({
      payload,
      sourceLabel: source.label,
      totals: sumTotals(payload.items),
    });
    return true;
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

  function openFlexibleMargin(row, mode = "manual", planOverride = null) {
    const baseRow = row?.date ? (days.find((day) => day.date === row.date) || row) : selectedRow;
    const displayRow = rowWithActiveGeneratedMeals(baseRow, days);
    const choice = trackingChoice(displayRow);
    const plan = planOverride || flexiblePlanForChoice(displayRow, choice, activePlanSource);
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
      plan,
      token: `${displayRow.date}-${mode}-${Date.now()}`,
    });
  }

  async function saveFlexibleMarginEntries(row, entries, completed, successMessage = "", planOverride = null) {
    if (!row?.date) return;
    const currentRow = days.find((day) => day.date === row.date) || row;
    const plan = planOverride || flexiblePlanForChoice(currentRow, trackingChoice(currentRow), activePlanSource);
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

  function toggleFlexibleMarginCompleted(row, planOverride = null) {
    if (!row?.date || saving) return;
    const currentRow = days.find((day) => day.date === row.date) || row;
    const nextCompleted = !isFlexibleMarginCompleted(currentRow);
    if (nextCompleted) {
      const displayRow = rowWithActiveGeneratedMeals(currentRow, days);
      const plan = planOverride || flexiblePlanForChoice(displayRow, trackingChoice(displayRow), activePlanSource);
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
      nextCompleted ? "Margen flexible marcado como hecho." : "Margen flexible reabierto.",
      planOverride
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

  function applyMealReplacement({ row, originalMeal, replacementMeal, mealIndex, markCompleted = true }) {
    const replacementEntry = buildMealReplacementEntry(row, originalMeal, replacementMeal, mealIndex);
    const completedIds = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String));
    if (markCompleted) completedIds.add(mealId(originalMeal, mealIndex));
    const currentMealReplacements = Array.isArray(row?.tracking?.mealReplacements) ? row.tracking.mealReplacements : [];
    const currentFoodReplacements = Array.isArray(row?.tracking?.foodReplacements) ? row.tracking.foodReplacements : [];
    const replacementContext = {
      date: row?.date,
      mealIndex,
      originalMealId: mealId(originalMeal, mealIndex),
    };
    const nextMealReplacements = mealReplacementSlot(replacementEntry) === "client_generated"
      ? replaceClientGeneratedSlot(currentMealReplacements, replacementEntry, replacementContext)
      : [
          ...activateMealReplacement(currentMealReplacements, replacementContext, "")
            .filter((entry) => String(entry?.id || "") !== String(replacementEntry.id || "")),
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

  function selectMealChoice(row, originalMeal, mealIndex, option = {}) {
    if (!row?.date || saving) return;
    if (option?.candidate && option?.meal) {
      applyMealReplacement({
        row,
        originalMeal,
        replacementMeal: { ...option.meal, replacementSlot: "coach_assigned", replacementIdentity: option.key },
        mealIndex,
        markCompleted: false,
      });
      return;
    }
    const selectionKey = String(option?.key || option || "");
    const context = {
      date: row.date,
      mealIndex,
      originalMealId: mealId(originalMeal, mealIndex),
    };
    const current = Array.isArray(row?.tracking?.mealReplacements) ? row.tracking.mealReplacements : [];
    const nextMealReplacements = activateMealReplacement(current, context, selectionKey === "original" ? "" : selectionKey);
    const optimisticRow = rowWithTracking(row, { mealReplacements: nextMealReplacements });
    setWeekData((currentData) => currentData ? {
      ...currentData,
      days: (currentData.days || []).map((day) => day.date === optimisticRow.date ? optimisticRow : day),
    } : currentData);
    setDetailRow((currentRow) => currentRow?.date === optimisticRow.date ? optimisticRow : currentRow);
    setMealDrawer(null);
    submitTracking(
      trackingPayloadBase(row, { mealReplacements: nextMealReplacements }),
      selectionKey === "original" ? "Comida original restaurada." : "Alternativa elegida para este dia."
    );
  }

  async function applyEquivalentMeal({
    saveTemplate = false,
    completionMode = false,
    trackingExecutionId = "",
    ...replacement
  } = {}) {
    if (completionMode) {
      const row = replacement.row || {};
      const replacementMeal = replacement.replacementMeal || {};
      const batch = buildCompletionTrackingBatch({
        date: row.date,
        trackingExecutionId,
        replacementMeal,
        mealName: mealName(replacement.originalMeal, replacement.mealIndex),
      });
      if (!batch) {
        throw new Error("No se pudo preparar el restante para Tracking.");
      }
      setSaving(true);
      try {
        await addFoodLogsBatch(batch);
        await Promise.all([
          selectedTrackingQuery.refetch(),
          loadWeek(weekStart, { silent: true }),
        ]);
        setEquivalentMealBuilder(null);
        setToast("Los alimentos se registraron en Tracking. Lo ya consumido no se duplicó.");
        window.setTimeout(() => setToast(""), 3200);
        return true;
      } finally {
        setSaving(false);
      }
    }
    const saved = await applyMealReplacement({ ...replacement, markCompleted: false });
    if (!saved) throw new Error("No se pudo guardar el reemplazo para este dia.");
    if (saveTemplate) {
      await saveMenuMealAsSavedMeal(replacement.replacementMeal, replacement.mealIndex, {
        favorite: true,
        immediate: true,
        equivalenceReference: replacement.replacementMeal?.equivalenceReference || null,
      });
    }
    setEquivalentMealBuilder(null);
  }

  async function applyFoodReplacement({
    row,
    meal,
    mealIndex,
    food,
    originalFood,
    foodIndex,
    replacement,
    recalculateOtherAutos = false,
  }) {
    const sourceFood = originalFood || food;
    const replacementEntry = buildFoodReplacementEntry(row, meal, mealIndex, sourceFood, foodIndex, replacement);
    const completedIds = new Set(trackingPayloadBase(row).completedMenuMealIds.map(String));
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
    const saved = await submitTracking(
      trackingPayloadBase(row, {
        completedMenuMealIds: [...completedIds],
        foodReplacements: nextFoodReplacements,
      }),
      "Reemplazo de alimento guardado."
    );
    if (!saved) return false;
    setFoodDrawer(null);
    if (recalculateOtherAutos) {
      const seedFoods = mealFoods(effectiveMeal).map((entry, index) => {
        const seed = equivalentBuilderSeedFood(entry, index);
        return index === foodIndex ? { ...seed, quantityMode: "manual", suggested: false } : seed;
      });
      const hasOtherAutos = seedFoods.some((entry, index) => (
        index !== foodIndex && String(entry.quantityMode || "").toLowerCase() === "automatic"
      ));
      if (hasOtherAutos) {
        setEquivalentMealBuilder({
          row: optimisticRow,
          baseMeal: meal,
          meal: effectiveMeal,
          mealIndex,
          seedFoods,
        });
      } else {
        setToast("Reemplazo aplicado. No habia otros alimentos Auto para recalcular.");
        window.setTimeout(() => setToast(""), 3200);
      }
    }
    return true;
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
    <MenuAutonomousActionsContext.Provider value={autonomousActions}>
    <MealChoiceActionsContext.Provider value={{ select: selectMealChoice }}>
    <div
      className="-mt-1.5 min-h-screen overflow-x-hidden bg-[#070707] px-0 pb-10 pt-0 text-zinc-100 sm:mt-0 sm:px-6 sm:pb-12 sm:pt-5"
      style={{ background: "#070707", color: "#f4f4f5", minHeight: "60vh" }}
    >
      <div className="mx-auto grid w-full max-w-6xl gap-3 sm:gap-5">
        {toast ? (
          <div className="fixed right-4 top-4 z-50 max-w-sm rounded-3xl border border-[#D4AF37]/35 bg-[#11151c] px-4 py-3 text-sm font-bold text-[#FFE8A3] shadow-2xl">
            {toast}
          </div>
        ) : null}

        {saveDayFavoriteDraft ? (
          <SaveDayFavoriteModal
            draft={saveDayFavoriteDraft}
            saving={saving}
            onClose={() => setSaveDayFavoriteDraft(null)}
            onSave={saveDayFavorite}
          />
        ) : null}

        {saveMealDraft ? (
          <SaveMealModal
            draft={saveMealDraft}
            saving={saving}
            favoriteLimit={capabilitiesQuery.data?.limits?.favorites}
            savedMealLimit={capabilitiesQuery.data?.limits?.ownMeals}
            onClose={() => setSaveMealDraft(null)}
            onSave={(changes) => persistSavedMeal({
              ...saveMealDraft.payload,
              ...changes,
            })}
          />
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
                trackingDay={selectedTrackingQuery.data}
                weekRows={days}
                activePlan={activePlan}
                activePlanSource={activePlanSource}
                detailChoiceKey={mobileDetailChoiceKey}
                onBack={() => setMobileView("overview")}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                previousDisabled={previousDayDisabled}
                onToggleMeal={toggleMenuMeal}
                onOpenFlexibleMargin={openFlexibleMargin}
                onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                onOpenMeal={openMealAction}
                onQuickEditMeal={openQuickMealEditor}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onRestoreGenerated={restoreGeneratedRemaining}
                onRestoreManual={restoreManualEntries}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canUseFlexibleRecommendations={canUseFlexibleRecommendations}
                manualCompletionAction={renderManualCompletionAction()}
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
                trackingDay={selectedTrackingQuery.data}
                dailyTargetItems={selectedDailyTargetItems}
                weekRows={days}
                activePlan={activePlan}
                activePlanSource={activePlanSource}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                previousDisabled={previousDayDisabled}
                onOpenMenuOptions={openMenuOptions}
                onEditActiveMenu={(options) => openActiveMenuEditor(selectedRow, options)}
                onOpenFlexibleMargin={openFlexibleMargin}
                onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                onToggleMeal={toggleMenuMeal}
                onOpenMeal={openMealAction}
                onQuickEditMeal={openQuickMealEditor}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onRestoreGenerated={restoreGeneratedRemaining}
                onRestoreManual={restoreManualEntries}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canUseFlexibleRecommendations={canUseFlexibleRecommendations}
                manualCompletionAction={renderManualCompletionAction()}
                saving={saving}
              />
            )
          ) : (
            <>
              <TodayHero
                row={selectedDisplayRow}
                trackingDay={selectedTrackingQuery.data}
                weekRows={days}
                activePlan={activePlan}
                activePlanSource={activePlanSource}
                onPrevious={() => moveSelectedDay(-1)}
                onNext={() => moveSelectedDay(1)}
                onView={() => setDetailRow(selectedDisplayRow)}
                onOpenMenuOptions={openMenuOptions}
                onEditActiveMenu={(options) => openActiveMenuEditor(selectedDisplayRow, options)}
                onToggleMeal={toggleMenuMeal}
                onOpenMeal={openMealAction}
                onQuickEditMeal={openQuickMealEditor}
                onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                onOpenFlexibleMargin={openFlexibleMargin}
                onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                onDeleteManual={deleteManualEntry}
                canMarkMeals={canMarkMeals}
                canUseFlexibleRecommendations={canUseFlexibleRecommendations}
                manualCompletionAction={renderManualCompletionAction()}
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
                    trackingDay={selectedTrackingQuery.data}
                    dailyTargetItems={selectedDailyTargetItems}
                    weekRows={days}
                    activePlanSource={activePlanSource}
                    onMarkMissed={markDayMissed}
                    onToggleMeal={toggleMenuMeal}
                    onOpenMeal={openMealAction}
                    onQuickEditMeal={openQuickMealEditor}
                    onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
                    onOpenFlexibleMargin={openFlexibleMargin}
                    onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
                    onRestoreGenerated={restoreGeneratedRemaining}
                    onRestoreManual={restoreManualEntries}
                    onDeleteManual={deleteManualEntry}
                    canMarkMeals={canMarkMeals}
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
          onOpenMeal={openMealAction}
          onQuickEditMeal={openQuickMealEditor}
          onSaveAsSavedMeal={saveMenuMealAsSavedMeal}
          onOpenFlexibleMargin={openFlexibleMargin}
          onToggleFlexibleMarginCompleted={toggleFlexibleMarginCompleted}
          onRestoreGenerated={restoreGeneratedRemaining}
          onRestoreManual={restoreManualEntries}
          onDeleteManual={deleteManualEntry}
          canMarkMeals={canMarkMeals}
          canUseFlexibleRecommendations={canUseFlexibleRecommendations}
          manualCompletionAction={renderManualCompletionAction(
            manualCompletionSummaryForRow(
              rowWithActiveGeneratedMeals(detailRow, days),
              canUseManualDayCompletion,
              selectedTrackingQuery.data,
              quickSettings.targetPlanDate === detailRow?.date ? quickSettings.targetMeals : []
            )
          )}
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
          planOverride={flexibleMarginEditor.plan}
          activePlanSource={activePlanSource}
          initialMode={flexibleMarginEditor.mode}
          canRecommend={canUseFlexibleRecommendations}
          saving={saving}
          onClose={() => setFlexibleMarginEditor(null)}
          onSave={(entries, completed, successMessage) => saveFlexibleMarginEntries(
            flexibleMarginEditor.row,
            entries,
            completed,
            successMessage,
            flexibleMarginEditor.plan
          )}
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

    canCreateEquivalentMeal={equivalentMealAccess.canCreate}

    onCreateEquivalentMeal={(context) => {
      setMealDrawer(null);
      setEquivalentMealBuilder(context);
    }}

    canReplaceFoods={equivalentMealAccess.canReplaceFoods}

    readOnlyProfessionalMenu={
      menuSourceMeta(activePlanSource).key === "coach"
    }

    onApplyMealReplacement={applyMealReplacement}

    onSaveAsSavedMeal={saveMenuMealAsSavedMeal}

    onDeleteManual={deleteManualEntry}

    onSetMealTargetMode={setMealTargetMode}

    saving={saving}

    onTargetTrackingChanged={async () => {
      await loadWeek(weekStart, {
        silent: true,
      });
    }}

    onTargetToast={(message) => {
      setToast(message);

      window.setTimeout(() => {
        setToast("");
      }, 3000);
    }}
  />
) : null}

      {foodDrawer ? (
        <FoodActionDrawer
          context={foodDrawer}
          canReplaceFoods={equivalentMealAccess.canReplaceFoods}
          saving={saving}
          onApplyReplacement={applyFoodReplacement}
          onClose={() => setFoodDrawer(null)}
        />
      ) : null}

      {equivalentMealBuilder ? (
        <EquivalentMealBuilder
          key={`${equivalentMealBuilder.row?.date || "day"}-${equivalentMealBuilder.mealIndex || 0}`}
          context={equivalentMealBuilder}
          canAuto={equivalentMealAccess.canAuto}
          maxFoods={equivalentMealAccess.maxFoods}
          saving={saving}
          onClose={() => setEquivalentMealBuilder(null)}
          onApply={applyEquivalentMeal}
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




{quickTrackingOpen ? (

<QuickTrackingFoodDrawer
  open={quickTrackingOpen}
  date={selectedRow?.date || currentDate}
  initialDestinationKey={
    quickTrackingDestination
  }
  destinationLocked={quickTrackingDestinationLocked}
  destinations={selectedQuickTrackingDestinations}
  onClose={() => {
    setQuickTrackingOpen(false);
    setQuickTrackingDestinationLocked(false);
  }}
  onSaved={() => {
    setToast(
      "Alimento registrado en Tracking."
    );

    window.setTimeout(() => {
      setToast("");
    }, 2600);

    void Promise.all([
      selectedTrackingQuery.refetch(),

      loadWeek(
        weekStart,
        {
          silent: true,
        }
      ),
    ]).catch((refreshError) => {
      console.warn(
        "[MenuPlan] No se pudo refrescar después de registrar alimento",
        refreshError
      );
    });
  }}
/>
) : null}

{quickPlanMealOpen && quickPlanMealStep === "__legacy_target" ? (
  <div
    className="
      fixed
      inset-0
      z-[140]
      flex
      items-end
      justify-center
      bg-black/70
      backdrop-blur-[2px]
    "
    onClick={() =>
      setQuickPlanMealOpen(false)
    }
  >
    <div
      className="
        w-full
        max-w-[430px]
        rounded-t-[1.5rem]
        border
        border-white/10
        bg-[#081018]
        p-4
        shadow-[0_-20px_50px_rgba(0,0,0,.45)]
      "
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      {/* HEADER */}
      <div className="mb-4">
        <span className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-300/70">
          Comida del día
        </span>

        <h3 className="mt-1 text-[18px] font-black text-white">
          Registrar comida
        </h3>

        <p className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-400">
          Elegí qué comida querés registrar dentro de tu objetivo diario.
        </p>
      </div>


      {quickPlanMealStep ===
"target" ? (
  <div className="grid gap-3">
    <button
      type="button"
      onClick={() =>
        setQuickPlanMealStep(
          "type"
        )
      }
      className="
        w-fit
        text-[10px]
        font-black
        text-zinc-500
        transition
        hover:text-zinc-300
      "
    >
      ← Cambiar comida
    </button>

    <div
      className="
        rounded-2xl
        border
        border-emerald-300/20
        bg-emerald-300/[0.05]
        px-3
        py-3
      "
    >
      <span className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-300/70">
        Comida seleccionada
      </span>

      <strong className="mt-1 block text-[15px] font-black text-white">
        {menuTargetMealTypeLabel(
          quickPlanMealType
        )}
      </strong>
    </div>

    <label className="block">
      <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.1em] text-zinc-500">
        Meta para esta comida
      </span>

      <div
        className="
          flex
          items-center
          gap-2
          rounded-2xl
          border
          border-white/10
          bg-black/30
          px-3
          py-2
        "
      >
        <input
          type="number"
          min="1"
          step="10"
          inputMode="numeric"
          value={
            quickPlanMealKcal
          }
          onChange={(event) =>
            setQuickPlanMealKcal(
              event.target.value
            )
          }
          placeholder="Ej: 600"
          className="
            min-w-0
            flex-1
            bg-transparent
            text-[22px]
            font-black
            text-white
            outline-none
            placeholder:text-zinc-700
          "
        />

        <span className="text-[11px] font-black text-zinc-500">
          kcal
        </span>
      </div>
    </label>

    <div
      className="
        rounded-xl
        border
        border-white/[0.07]
        bg-white/[0.025]
        px-3
        py-2
      "
    >
      <span className="text-[8px] font-bold text-zinc-500">
        Esta meta reserva calorías para la comida.
        No significa que ya las consumiste.
      </span>
    </div>
  </div>
) : null}

    </div>
  </div>
) : null}

{quickPlanMealOpen ? (
  <div
    className="
      fixed
      inset-0
      z-[140]
      flex
      items-end
      justify-center
      bg-black/70
      backdrop-blur-[2px]
    "
    onClick={() => {
      setQuickPlanMealOpen(false);
      setQuickPlanMealStep("mode");
      setQuickPlanMealMode("target");
      setQuickPlanMealKcal("");
      setQuickPlanMealMacros({ proteina: "", carbs: "", grasas: "" });
      setQuickPlanMealMacroLocks({ proteina: false, carbs: false, grasas: false });
    }}
  >
    <div
      className="
        w-full
        max-w-[430px]
        rounded-t-[1.5rem]
        border
        border-white/10
        bg-[#081018]
        p-4
        shadow-[0_-20px_50px_rgba(0,0,0,.45)]
      "
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      {/* HEADER */}
      <div className="mb-4">
        <span className="text-[8px] font-black uppercase tracking-[0.14em] text-emerald-300/70">
          Comida del día
        </span>

        <h3 className="mt-1 text-[18px] font-black text-white">
          {quickPlanMealStep === "mode"
            ? "¿Cómo querés registrarla?"
            : quickPlanMealStep === "type"
              ? "Elegir comida"
              : "Definir meta"}
        </h3>

        <p className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-400">
          {quickPlanMealStep === "mode"
            ? "Podés crear una meta planificada o registrar una comida libre como pendiente o hecha."
            : quickPlanMealStep === "type"
              ? `Elegí qué comida querés registrar ${quickPlanMealMode === "free" ? "libremente" : "por meta"}.`
              : "Definí las calorías y los macros objetivo de esta comida."}
        </p>
      </div>

      {quickPlanMealStep === "mode" ? (
        <>
          <div className="grid gap-2">
            <button
              type="button"
              disabled={!canCreatePersonalMealTarget}
              onClick={() => {
                setQuickPlanMealMode("target");
                setQuickPlanMealStep("type");
              }}
              className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-emerald-300/30 bg-emerald-300/[0.07] p-3 text-left transition hover:border-emerald-300/55 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                <Target size={20} strokeWidth={2.3} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[14px] font-black text-white">Por meta</strong>
                <span className="mt-1 block text-[10px] font-bold leading-relaxed text-zinc-400">
                  Definí kcal y macros. Queda como objetivo pendiente, no como consumo.
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-emerald-200" />
            </button>

            <button
              type="button"
              disabled={!canCreateAutonomousMenu}
              onClick={() => {
                setQuickPlanMealMode("free");
                setQuickPlanMealStep("type");
              }}
              className="flex min-h-[82px] items-center gap-3 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/[0.08] p-3 text-left transition hover:border-[#FFE16A]/60 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE16A]">
                <Utensils size={20} strokeWidth={2.3} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-[14px] font-black text-white">Libre</strong>
                <span className="mt-1 block text-[10px] font-bold leading-relaxed text-zinc-400">
                  Elegí alimentos y cantidades sin fijar una meta para la comida.
                </span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-[#FFE16A]" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setQuickPlanMealOpen(false);
              setQuickPlanMealMode("target");
            }}
            className="mt-4 min-h-[44px] w-full rounded-xl border border-white/10 bg-white/[0.025] text-[11px] font-black text-zinc-400"
          >
            Cancelar
          </button>
        </>
      ) : quickPlanMealStep === "type" ? (
        <>
          {/* TIPO DE COMIDA */}
          <div className="grid grid-cols-2 gap-2">
            {[
              ["desayuno", "Desayuno"],
              ["almuerzo", "Almuerzo"],
              ["merienda", "Merienda"],
              ["cena", "Cena"],
              ["picoteo", "Picoteo"],
              ["snack", "Snack"],
            ].map(
              ([value, label]) => {
                const selected =
                  quickPlanMealType ===
                  value;

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setQuickPlanMealType(
                        value
                      )
                    }
                    className={`
                      min-h-[43px]
                      rounded-xl
                      border
                      px-3
                      text-[11px]
                      font-black
                      transition
                      ${
                        selected
                          ? `
                            border-emerald-300/45
                            bg-emerald-300/[0.10]
                            text-emerald-200
                          `
                          : `
                            border-white/10
                            bg-white/[0.025]
                            text-zinc-300
                          `
                      }
                    `}
                  >
                    {label}
                  </button>
                );
              }
            )}
          </div>

          {/* ACCIONES PASO 1 */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setQuickPlanMealStep("mode");
              }}
              className="
                min-h-[44px]
                rounded-xl
                border
                border-white/10
                bg-white/[0.025]
                text-[11px]
                font-black
                text-zinc-400
              "
            >
              Volver
            </button>

            <button
              type="button"
              onClick={() => {
                if (quickPlanMealMode === "free") {
                  openQuickFreeMealEditor();
                  return;
                }
                setQuickPlanMealStep("target");
              }}
              className="
                flex
                min-h-[44px]
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-[#FFD76B]/40
                bg-gradient-to-r
                from-[#FFC928]
                to-[#FFE16A]
                text-[11px]
                font-black
                text-black
              "
            >
              {quickPlanMealMode === "free"
                ? <Utensils size={15} strokeWidth={2.4} />
                : <Target size={15} strokeWidth={2.4} />}

              {quickPlanMealMode === "free" ? "Elegir alimentos" : "Continuar"}
            </button>
          </div>
        </>
      ) : (
        <>
          {/* COMIDA SELECCIONADA */}
          <div
            className="
              rounded-2xl
              border
              border-emerald-300/15
              bg-emerald-300/[0.045]
              p-3
            "
          >
            <span className="text-[8px] font-black uppercase tracking-[0.12em] text-emerald-300/70">
              Comida seleccionada
            </span>

            <strong className="mt-1 block text-[14px] font-black text-white">
              {{
                desayuno:
                  "Desayuno",
                almuerzo:
                  "Almuerzo",
                merienda:
                  "Merienda",
                cena:
                  "Cena",
                picoteo:
                  "Picoteo",
                snack:
                  "Snack",
              }[
                quickPlanMealType
              ] || "Comida"}
            </strong>
          </div>

          {/* META */}
          <div className="mt-3">
            <label className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.1em] text-zinc-400">
              Meta para esta comida
            </label>

            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                value={
                  quickPlanMealKcal
                }
                onChange={(event) =>
                  setQuickPlanMealKcal(
                    event.target.value
                  )
                }
                placeholder="Ej: 600"
                className="
                  min-h-[46px]
                  min-w-0
                  flex-1
                  rounded-xl
                  border
                  border-white/10
                  bg-black/25
                  px-3
                  text-[14px]
                  font-black
                  text-white
                  outline-none
                  transition
                  placeholder:text-zinc-600
                  focus:border-emerald-300/40
                "
              />

              <span className="shrink-0 text-[11px] font-black text-zinc-400">
                kcal
              </span>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                ["proteina", "Proteína", "P", "emerald"],
                ["carbs", "Carbohidratos", "C", "sky"],
                ["grasas", "Grasas", "G", "amber"],
              ].map(([field, label, shortLabel, tone]) => {
                const locked = quickPlanMealMacroLocks[field];
                const displayedValue = locked
                  ? quickPlanMealMacros[field]
                  : quickPlanMealCalculation.macros[field];
                const toneClass = tone === "emerald"
                  ? "border-emerald-300/35 bg-emerald-300/[0.07] text-emerald-200"
                  : tone === "sky"
                    ? "border-sky-300/30 bg-sky-300/[0.06] text-sky-200"
                    : "border-amber-300/30 bg-amber-300/[0.06] text-amber-200";

                return (
                  <div key={field} className={`min-w-0 rounded-xl border p-2 ${locked ? toneClass : "border-white/10 bg-black/25 text-zinc-300"}`}>
                    <div className="mb-1.5 flex items-center justify-between gap-1">
                      <span className="min-w-0 truncate text-[8px] font-black uppercase tracking-wide">
                        {shortLabel} · {label}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          if (!locked) {
                            setQuickPlanMealMacros((current) => ({
                              ...current,
                              [field]: String(quickPlanMealCalculation.macros[field]),
                            }));
                          }
                          setQuickPlanMealMacroLocks((current) => ({
                            ...current,
                            [field]: !locked,
                          }));
                        }}
                        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition ${locked ? "border-current/30 bg-black/20" : "border-white/10 bg-white/[0.04] text-zinc-500"}`}
                        aria-label={`${locked ? "Desbloquear" : "Bloquear"} ${label}`}
                        title={locked ? `${label} fijo` : `${label} automático`}
                      >
                        {locked ? <Lock size={11} /> : <LockOpen size={11} />}
                      </button>
                    </div>
                    <div className="flex min-h-[32px] items-center">
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        inputMode="decimal"
                        value={displayedValue}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(event) => {
                          setQuickPlanMealMacros((current) => ({
                            ...current,
                            [field]: event.target.value,
                          }));
                          setQuickPlanMealMacroLocks((current) => ({
                            ...current,
                            [field]: true,
                          }));
                        }}
                        aria-label={`${label} objetivo`}
                        title={locked ? `${label} fijo` : `Escribí para fijar ${label.toLowerCase()}`}
                        className={`min-w-0 flex-1 bg-transparent text-[15px] font-black outline-none ${locked ? "text-white" : "text-zinc-300"}`}
                      />
                      <span className="ml-1 text-[9px] font-black opacity-60">g</span>
                    </div>
                    <span className="block text-[7px] font-black uppercase tracking-wide opacity-60">
                      {locked ? "Fijo · editable" : "Auto · escribí para fijar"}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className={`mt-3 rounded-xl border p-3 ${quickPlanMealCalculation.cannotMatchTarget ? "border-rose-300/30 bg-rose-300/[0.07]" : "border-emerald-300/20 bg-emerald-300/[0.045]"}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="block text-[8px] font-black uppercase tracking-wide text-zinc-500">Resultado nutricional</span>
                  <strong className="mt-0.5 block text-[16px] font-black text-white">
                    {formatNumber(quickPlanMealCalculation.actualKcal, 0)} kcal reales
                  </strong>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-black ${Math.abs(quickPlanMealCalculation.differenceKcal) <= 1 ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : "border-amber-300/30 bg-amber-300/10 text-amber-200"}`}>
                  {quickPlanMealCalculation.differenceKcal > 0 ? "+" : ""}{formatNumber(quickPlanMealCalculation.differenceKcal, 1)} kcal
                </span>
              </div>
              <p className={`mt-1.5 text-[8.5px] font-bold leading-relaxed ${quickPlanMealCalculation.cannotMatchTarget ? "text-rose-200" : "text-zinc-500"}`}>
                {quickPlanMealCalculation.cannotMatchTarget
                  ? "Con todos esos valores fijos no se alcanza la meta. Abrí un candado o ajustá un valor."
                  : "Los candados abiertos se ajustan automáticamente para alcanzar la meta calórica."}
              </p>
            </div>
          </div>

          {/* ACCIONES PASO 2 */}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                setQuickPlanMealStep(
                  "type"
                )
              }
              className="
                min-h-[44px]
                rounded-xl
                border
                border-white/10
                bg-white/[0.025]
                text-[11px]
                font-black
                text-zinc-400
              "
            >
              Volver
            </button>

            <button
              type="button"
              disabled={
                saving ||
                quickPlanMealCalculation.cannotMatchTarget ||
                quickPlanMealCalculation.invalidLockedMacros.length > 0 ||
                !Number(
                  quickPlanMealKcal
                ) ||
                Number(
                  quickPlanMealKcal
                ) <= 0
              }
              onClick={createQuickPlannedMeal}
              className="
                flex
                min-h-[44px]
                items-center
                justify-center
                gap-2
                rounded-xl
                border
                border-[#FFD76B]/40
                bg-gradient-to-r
                from-[#FFC928]
                to-[#FFE16A]
                text-[11px]
                font-black
                text-black
                transition
                disabled:cursor-not-allowed
                disabled:opacity-40
              "
            >
              <Target
                size={15}
                strokeWidth={2.4}
              />

              {saving ? "Creando..." : "Crear por meta"}
            </button>
          </div>
        </>
      )}
    </div>
  </div>
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

      {automaticMenuPlanAction ? (
        <AutomaticMenuPlanRemovalDialog
          kind={automaticMenuPlanAction.kind}
          planningKind={automaticMenuPlanAction.planningKind}
          mealName={automaticMenuPlanAction.mealName}
          saving={saving}
          onCancel={() => !saving && setAutomaticMenuPlanAction(null)}
          onConfirm={applyAutomaticMenuPlanRemoval}
        />
      ) : null}

      {personalTargetPlanAction ? (
        <PersonalTargetPlanActionDialog
          kind={personalTargetPlanAction.kind}
          mealName={personalTargetPlanAction.mealName}
          hasFoodLogs={personalTargetPlanAction.hasFoodLogs}
          wasClosed={personalTargetPlanAction.wasClosed}
          canRedistribute={personalTargetPlanAction.canRedistribute}
          saving={saving}
          onCancel={() => !saving && setPersonalTargetPlanAction(null)}
          onConfirm={applyPersonalTargetPlanAction}
        />
      ) : null}

      {personalTargetEditor ? (
        <PersonalTargetEditDialog
          meal={personalTargetEditor.meal}
          meals={personalMealTargetsFromTrackingDay(selectedTrackingQuery.data)}
          dailyTarget={selectedQuickTarget}
          saving={saving}
          onCancel={() => !saving && setPersonalTargetEditor(null)}
          onSave={savePersonalTargetEdit}
        />
      ) : null}

      {manualCompletionPrompt ? (
        <ManualDayCompletionDialog
          state={manualCompletionPrompt}
          saving={saving}
          onCancel={() => {
            if (!saving) setManualCompletionPrompt(null);
          }}
          onRetry={() => loadManualCompletionPreview({
            row: manualCompletionPrompt.row,
            completed: manualCompletionPrompt.completed,
            total: manualCompletionPrompt.total,
          })}
          onConfirm={confirmManualDayCompletion}
        />
      ) : null}

    </div>
    </MealChoiceActionsContext.Provider>
    </MenuAutonomousActionsContext.Provider>
  );
}

function PersonalTargetReconciliationBanner({
  reconciliation = null,
  saving = false,
  onMaintain,
  onAdjust,
}) {
  if (!reconciliation?.hasDifference) return null;
  const difference = reconciliation.difference || {};
  const signed = (value, unit = "") => {
    const numeric = Number(value) || 0;
    return `${numeric > 0 ? "+" : ""}${formatNumber(numeric, 1)}${unit}`;
  };
  const kcalOver = Number(difference.kcal) > 0;
  const hasEditableTargets = reconciliation.canAdjust === true;

  if (!hasEditableTargets) {
    const kcalDifference = Number(difference.kcal) || 0;
    const missingKcal = kcalDifference < 0;
    const hasKcalDifference = Math.abs(kcalDifference) > 0.5;
    const projectedKcal = Number(reconciliation.forecast?.kcal) || 0;
    const targetKcal = Number(reconciliation.target?.kcal) || 0;
    const title = hasKcalDifference
      ? missingKcal
        ? `${formatNumber(Math.abs(kcalDifference), 1)} kcal sin asignar`
        : `${formatNumber(kcalDifference, 1)} kcal de excedente proyectado`
      : "Macros pendientes de asignar";
    const statusCopy = hasKcalDifference
      ? `Proyectado ${formatNumber(projectedKcal, 0)} / ${formatNumber(targetKcal, 0)} kcal · ${missingKcal ? "corregí desde Editar metas" : "sin metas para compensar"}`
      : `Objetivo calórico cubierto · sin metas para compensar`;

    return (
      <section className={`zf-menu-reconcile-compact mt-2.5 overflow-hidden rounded-[1rem] border p-2.5 ${missingKcal ? "border-sky-300/25 bg-sky-300/[0.055]" : "border-amber-300/25 bg-amber-300/[0.055]"}`} role="status" aria-live="polite">
        <div className="flex items-center gap-2.5">
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border ${missingKcal ? "border-sky-300/25 bg-sky-300/10 text-sky-200" : "border-amber-300/25 bg-amber-300/10 text-amber-100"}`}>
            <AlertTriangle size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <strong className="block text-[12px] font-black text-white">{title}</strong>
            <span className="mt-0.5 block truncate text-[9px] font-bold text-zinc-400" title={statusCopy}>
              {statusCopy}
            </span>
          </span>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {[
            ["P", difference.proteina],
            ["C", difference.carbs],
            ["G", difference.grasas],
          ].map(([label, value]) => (
            <span key={label} className="inline-flex min-h-7 items-center justify-center gap-1 rounded-lg border border-white/[0.07] bg-black/20 px-1.5 text-center">
              <small className="text-[8px] font-black uppercase text-zinc-500">{label}</small>
              <b className="text-[9.5px] font-black text-zinc-200">{signed(value, " g")}</b>
            </span>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="mt-3 overflow-hidden rounded-[1.25rem] border border-amber-300/35 bg-[radial-gradient(circle_at_0_0,rgba(251,191,36,.14),transparent_42%),linear-gradient(145deg,rgba(38,28,8,.94),rgba(10,16,23,.98))] p-3.5 shadow-[0_16px_38px_rgba(0,0,0,.30)]" role="status" aria-live="polite">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-amber-300/35 bg-amber-300/10 text-amber-100"><AlertTriangle size={20} /></span>
        <div className="min-w-0">
          <strong className="block text-[14px] font-black text-white">Tu balance del día cambió</strong>
          <p className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-300">
            Tracking refleja lo que consumiste. Tus metas siguen intactas hasta que elijas qué hacer.
          </p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-4 overflow-hidden rounded-xl border border-white/[0.08] bg-black/25">
        {[
          ["kcal", signed(difference.kcal, " kcal")],
          ["P", signed(difference.proteina, " g")],
          ["C", signed(difference.carbs, " g")],
          ["G", signed(difference.grasas, " g")],
        ].map(([label, value], index) => (
          <span key={label} className={`px-1.5 py-2.5 text-center ${index ? "border-l border-white/[0.07]" : ""}`}>
            <small className="block text-[8px] font-black uppercase text-zinc-500">{label}</small>
            <b className={`mt-1 block text-[10px] font-black ${label === "kcal" && kcalOver ? "text-rose-200" : "text-amber-100"}`}>{value}</b>
          </span>
        ))}
      </div>

      <p className="mt-2.5 text-[9px] font-bold leading-relaxed text-zinc-400">
        Quedan {formatNumber(reconciliation.accounting?.freeCaloriesRemaining, 1)} kcal libres. El forecast compara Tracking real + metas pendientes + esa reserva contra tu objetivo diario.
      </p>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <button type="button" onClick={onMaintain} disabled={saving} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-[10px] font-black text-zinc-200 disabled:opacity-45">Mantener planificación</button>
        <button type="button" onClick={onAdjust} disabled={saving} className="min-h-11 rounded-xl border border-amber-300/45 bg-amber-300/10 px-3 text-[10px] font-black text-amber-100 disabled:opacity-45">{saving ? "Ajustando..." : "Ajustar metas pendientes"}</button>
      </div>
    </section>
  );
}

function PersonalTargetPlanActionDialog({
  kind = "format",
  mealName = "esta comida",
  hasFoodLogs = false,
  wasClosed = false,
  canRedistribute = false,
  saving = false,
  onCancel,
  onConfirm,
}) {
  const deletingOne = kind === "delete_one";
  const deleting = kind === "delete" || deletingOne;
  const contextualName = String(mealName || "esta comida");
  return (
    <section className="fixed inset-0 z-[160] grid place-items-center bg-black/80 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="personal-target-action-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onCancel} aria-label="Cancelar" />
      <div className={`relative w-full max-w-md rounded-[1.6rem] border bg-[#0b131c] p-5 shadow-[0_28px_80px_rgba(0,0,0,.7)] ${deleting ? "border-rose-300/30" : "border-amber-300/30"}`}>
        <span className={`grid h-12 w-12 place-items-center rounded-2xl border ${deleting ? "border-rose-300/30 bg-rose-300/10 text-rose-100" : "border-amber-300/30 bg-amber-300/10 text-amber-100"}`}>
          {deleting ? <Trash2 size={22} /> : <RotateCcw size={22} />}
        </span>
        <h3 id="personal-target-action-title" className="mt-4 text-xl font-black text-white">
          {deletingOne ? `¿Eliminar ${contextualName}?` : deleting ? "¿Eliminar tu planificación?" : "¿Formatear este menú?"}
        </h3>
        <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-300">
          {deletingOne
            ? hasFoodLogs
              ? `Se eliminará únicamente esta meta del día. Tus alimentos consumidos y sus valores reales seguirán en Tracking.${wasClosed ? " También se limpiará el cierre asociado a la meta." : ""}`
              : `Se eliminará esta meta del día.${wasClosed ? " También se limpiará el cierre asociado a la meta." : ""}`
            : deleting
              ? "Se eliminarán únicamente las metas Por meta que creaste vos y el margen libre de esta planificación. Todo lo consumido seguirá en Tracking y las metas del coach no se tocarán."
              : "Se liberarán las metas automáticas pendientes que pueden regenerarse. Los FoodLogs, las metas manuales y los candados seguirán intactos."}
        </p>
        {deletingOne && canRedistribute ? (
          <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-3 text-[11px] font-bold leading-relaxed text-emerald-100">
            Recomendado: redistribuirá sólo la parte que todavía faltaba consumir entre las otras metas automáticas. Las comidas manuales, bloqueadas o hechas no cambian.
          </p>
        ) : null}
        {deletingOne ? (
          <div className="mt-5 grid gap-2">
            {canRedistribute ? (
              <button type="button" disabled={saving} onClick={() => onConfirm?.("redistribute")} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-300/12 px-3 text-sm font-black text-emerald-100 disabled:opacity-50">
                {saving ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {saving ? "Procesando..." : "Eliminar y redistribuir"}
              </button>
            ) : null}
            <button type="button" disabled={saving} onClick={() => onConfirm?.("keep")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-rose-300/35 bg-rose-300/12 px-3 text-sm font-black text-rose-100 disabled:opacity-50">
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
              {saving ? "Procesando..." : "Eliminar sin redistribuir"}
            </button>
            <button type="button" disabled={saving} onClick={onCancel} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm font-black text-zinc-300 disabled:opacity-50">
              Cancelar
            </button>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" disabled={saving} onClick={onCancel} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-sm font-black text-zinc-300 disabled:opacity-50">
              Cancelar
            </button>
            <button type="button" disabled={saving} onClick={onConfirm} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-black disabled:opacity-50 ${deleting ? "border-rose-300/35 bg-rose-300/12 text-rose-100" : "border-amber-300/35 bg-amber-300/12 text-amber-100"}`}>
              {saving ? <RefreshCw size={16} className="animate-spin" /> : deleting ? <Trash2 size={16} /> : <RotateCcw size={16} />}
              {saving ? "Procesando..." : deleting ? "Eliminar" : "Formatear"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function PersonalTargetEditDialog({ meal, meals = [], dailyTarget = {}, saving, onCancel, onSave }) {
  const source = totalFromLike(meal?.target || {});
  const [draft, setDraft] = useState({
    kcal: source.kcal,
    proteina: source.proteina,
    carbs: source.carbs,
    grasas: source.grasas,
  });
  const [mode, setMode] = useState("redistribute");
  const [error, setError] = useState("");
  const currentTotals = personalMealTargetTotals(meals);
  const deltaKcal = (Number(draft.kcal) || 0) - source.kcal;
  const projectedKcal = mode === "redistribute" ? currentTotals.kcal : currentTotals.kcal + deltaKcal;
  const macroKcal = (Number(draft.proteina) || 0) * 4 + (Number(draft.carbs) || 0) * 4 + (Number(draft.grasas) || 0) * 9;

  const submit = async () => {
    setError("");
    try {
      await onSave?.({ mealId: meal.id, target: draft, mode });
    } catch (saveError) {
      setError(saveError?.message || "No pudimos guardar esta meta.");
    }
  };

  return (
    <div className="fixed inset-0 z-[130] grid items-end bg-black/75 p-3 backdrop-blur-sm sm:place-items-center" role="presentation">
      <section className="max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-[1.5rem] border border-[#D4AF37]/40 bg-[#091018] p-4 shadow-2xl" role="dialog" aria-modal="true" aria-label={`Editar meta: ${meal?.name || "Comida"}`}>
        <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black uppercase tracking-wider text-teal-300">Meta por comida</span><h3 className="mt-1 text-[19px] font-black text-white">Editar meta: {meal?.name}</h3><p className="mt-1 text-[10px] font-semibold text-zinc-400">Podés editar calorías y macros sin superar el objetivo diario.</p></div><button type="button" onClick={onCancel} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400"><X size={18} /></button></div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["kcal", "Calorías", "kcal"], ["proteina", "Proteína", "g"], ["carbs", "Carbohidratos", "g"], ["grasas", "Grasas", "g"]].map(([key, label, unit]) => (
            <label key={key} className="rounded-xl border border-white/10 bg-black/25 p-2.5"><span className="block text-[8px] font-black text-zinc-500">{label}</span><span className="mt-1 grid grid-cols-[1fr_auto] items-center gap-1"><input type="number" min="0" step="0.1" value={draft[key]} onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))} className="min-w-0 bg-transparent text-[15px] font-black text-white outline-none" /><small className="text-[8px] font-black text-zinc-500">{unit}</small></span></label>
          ))}
        </div>

        <div className={`mt-3 rounded-xl border p-3 text-[9px] font-bold ${Math.abs(macroKcal - (Number(draft.kcal) || 0)) > 5 ? "border-amber-300/25 bg-amber-300/10 text-amber-100" : "border-white/10 bg-black/20 text-zinc-400"}`}>
          Los macros equivalen teóricamente a {formatNumber(macroKcal, 1)} kcal. Es una referencia informativa; el techo diario se controla con las kcal de las metas.
        </div>

        <div className="mt-3 grid gap-2">
          <button type="button" onClick={() => setMode("redistribute")} className={`rounded-xl border p-3 text-left ${mode === "redistribute" ? "border-teal-300/45 bg-teal-300/[0.08]" : "border-white/10 bg-black/20"}`}><strong className="text-[11px] font-black text-white">Redistribuir en las comidas restantes</strong><span className="mt-1 block text-[9px] font-bold text-zinc-400">Mantiene el total de {formatNumber(currentTotals.kcal, 1)} kcal ajustando sólo otros slots vacíos.</span></button>
          <button type="button" onClick={() => setMode("keep")} className={`rounded-xl border p-3 text-left ${mode === "keep" ? "border-[#FFD75E]/45 bg-[#D4AF37]/10" : "border-white/10 bg-black/20"}`}><strong className="text-[11px] font-black text-white">Mantener las demás metas</strong><span className="mt-1 block text-[9px] font-bold text-zinc-400">El día quedaría en {formatNumber(projectedKcal, 1)} / {formatNumber(dailyTarget.kcal, 1)} kcal.</span></button>
        </div>

        {projectedKcal > Number(dailyTarget.kcal) + 0.05 ? <p className="mt-3 rounded-xl border border-amber-300/25 bg-amber-300/10 p-3 text-[9px] font-black text-amber-100">Esta edición superaría el objetivo diario. Reducí la meta o elegí redistribuir.</p> : null}
        {error ? <p className="mt-3 rounded-xl border border-rose-300/25 bg-rose-300/10 p-3 text-[9px] font-black text-rose-100" role="alert">{error}</p> : null}
        <div className="mt-4"><button type="button" onClick={submit} disabled={saving || projectedKcal > Number(dailyTarget.kcal) + 0.05} className="min-h-12 w-full rounded-xl border border-[#FFD75E]/60 bg-[linear-gradient(135deg,#D4AF37,#FFE071)] text-[11px] font-black text-black disabled:cursor-not-allowed disabled:opacity-40">{saving ? "Guardando..." : "Aplicar cambios"}</button></div>
      </section>
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
              <h3 id="tracking-only-confirm-title" className="mt-1 text-xl font-black leading-tight text-white">Desactivar menú activo</h3>
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
            {saving ? "Desactivando..." : "Desactivar menú"}
          </button>
        </footer>
      </div>
    </section>
  );
}

function AutomaticMenuPlanRemovalDialog({ kind = "one", planningKind = "automatic", mealName: selectedMealName = "", saving, onCancel, onConfirm }) {
  const removeAll = kind === "all";
  const freePlanning = planningKind === "free";
  return (
    <section className="fixed inset-0 z-[135] flex items-end justify-center bg-black/80 px-3 pb-3 pt-8 backdrop-blur-md sm:items-center sm:p-6" role="alertdialog" aria-modal="true" aria-labelledby="automatic-menu-removal-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onCancel} aria-label="Cerrar confirmación" />
      <div className="relative w-full max-w-md overflow-hidden rounded-[1.7rem] border border-rose-300/25 bg-[radial-gradient(circle_at_18%_0,rgba(244,63,94,.16),transparent_34%),linear-gradient(180deg,#17151b,#080d12)] p-4 shadow-[0_28px_90px_rgba(0,0,0,.72)]">
        <div className="flex items-start gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-rose-300/30 bg-rose-300/10 text-rose-100">
            <Trash2 size={22} />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-wide text-rose-200">
              {freePlanning ? "Planificación libre" : "Planificación automática"}
            </span>
            <h3 id="automatic-menu-removal-title" className="mt-1 text-xl font-black leading-tight text-white">
              {removeAll ? "¿Eliminar todas las comidas?" : `¿Eliminar ${String(selectedMealName || "esta comida").toLowerCase()}?`}
            </h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-300">
              {removeAll
                ? "El día volverá a quedar sin menú planificado y podrás generar uno nuevo o crear metas."
                : freePlanning
                  ? "Se quitará esta comida planificada de este día. La comida original guardada en tu biblioteca no se modifica."
                  : "Se quitará únicamente esta comida del menú automático."}
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-200 disabled:opacity-60" aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.055] p-3 text-xs font-bold leading-relaxed text-emerald-100">
          El consumo real y los FoodLogs de Tracking no se eliminan.
        </div>

        <footer className="mt-4 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.045] px-3 text-sm font-black text-zinc-100 disabled:opacity-60">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={saving} className="min-h-12 rounded-2xl border border-rose-300/35 bg-rose-300/15 px-3 text-sm font-black text-rose-100 disabled:opacity-60">
            {saving ? "Eliminando..." : removeAll ? "Eliminar comidas" : "Eliminar comida"}
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
    <section
      className="zf-menu-loading"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy="true"
    >
      <div className="zf-menu-loading-glow" aria-hidden="true" />

      <BrandLogo
        size="sm"
        priority
        className="zf-menu-loading-brand"
        imgClassName="zf-menu-loading-brand-image"
      />

      <div className="zf-menu-loading-status">
        <span className="zf-menu-loading-spinner" aria-hidden="true">
          <span />
        </span>
        <div className="min-w-0">
          <strong className="zf-menu-loading-title">Cargando menú</strong>
          <p className="zf-menu-loading-copy">
            Preparando tus metas y comidas del día.
          </p>
        </div>
      </div>

      <div className="zf-menu-loading-skeleton" aria-hidden="true">
        {["74%", "91%", "62%"].map((width, item) => (
          <span key={width} className="zf-menu-loading-skeleton-row">
            <i />
            <b style={{ width, animationDelay: `${item * 95}ms` }} />
          </span>
        ))}
      </div>
    </section>
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

function MobileDayPicker({
  row,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
}) {
  const selectedIsToday = row?.date === todayIso();
  const longDateLabel = formatLongDate(row?.date);

  return (
    <div className="zf-menu-mobile-date grid grid-cols-[40px_minmax(0,1fr)_40px] items-center gap-1 rounded-[.95rem] border border-white/10 bg-[linear-gradient(145deg,rgba(15,22,32,.98),rgba(7,11,17,.99))] p-1 shadow-[0_8px_22px_rgba(0,0,0,.24),inset_0_1px_0_rgba(255,255,255,.035)]">
      <button
        type="button"
        onClick={onPrevious}
        disabled={previousDisabled}
        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-100 transition duration-200 hover:border-white/20 hover:bg-white/[0.065] active:scale-95 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.02] disabled:text-zinc-700 disabled:opacity-55"
        aria-label="Día anterior"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="min-w-0 px-1 text-center" aria-current={selectedIsToday ? "date" : undefined}>
        <div className="flex min-w-0 items-center justify-center gap-1.5">
          <CalendarDays size={14} className={`shrink-0 ${selectedIsToday ? "text-[#FFD76B]" : "text-zinc-400"}`} />
          <span className="truncate text-[12.5px] font-black leading-tight text-zinc-100 min-[360px]:text-[13px]">
            {longDateLabel}
          </span>
          {selectedIsToday ? (
            <span className="hidden shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-1.5 py-0.5 text-[7px] font-black uppercase tracking-[.08em] text-[#FFE080] min-[390px]:inline-flex">
              Hoy
            </span>
          ) : null}
        </div>
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        className="grid h-10 w-10 place-items-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-100 transition duration-200 hover:border-white/20 hover:bg-white/[0.065] active:scale-95 disabled:cursor-not-allowed disabled:border-white/[0.06] disabled:bg-white/[0.02] disabled:text-zinc-700 disabled:opacity-55"
        aria-label="Día siguiente"
      >
        <ChevronRight size={18} />
      </button>
    </div>
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
      className={`zf-meal-card zf-meal-card--flexible ${completed ? "is-complete" : exceeded ? "is-warning" : hasEntries ? "is-progress" : "is-empty"} mt-2 cursor-pointer overflow-hidden rounded-[1.05rem] border shadow-[0_10px_26px_rgba(0,0,0,.24)] ${palette.shell} ${compact ? "p-2" : "p-2.5"}`}
      onClick={handleCardClick}
    >
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border ${palette.icon}`}>
          <Icon size={16} strokeWidth={1.9} aria-hidden="true" />
        </span>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <h4 className="truncate text-[15px] font-black leading-tight text-white">Calorías libres</h4>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wide ${palette.badge}`}>
              {badgeLabel}
            </span>
          </div>
          <span className="mt-0.5 block text-[9px] font-black uppercase tracking-[0.1em] text-sky-100/55">
            Extra flexible del día
          </span>
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
          className="zf-meal-card__action grid h-10 w-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-zinc-200"
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
            className={`inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border px-3 text-xs font-black ${palette.primary}`}
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
            className={`inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-full border px-3 text-xs font-black disabled:opacity-50 sm:flex-none ${palette.primary}`}
          >
            {hasEntries ? <PencilLine size={14} /> : <Plus size={14} />}
            {hasEntries ? "Editar alimentos" : "Agregar alimentos"}
          </button>
          {canMarkComplete ? (
            <button
              type="button"
              onClick={onToggleCompleted}
              disabled={saving}
              className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 text-xs font-black text-emerald-100 disabled:opacity-50"
              aria-label="Marcar calorias libres como hecho"
            >
              <CheckCircle2 size={14} />
              Hecho
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/[0.035] px-3 text-xs font-black text-zinc-300"
            aria-expanded={expanded}
          >
            {expanded ? "Ocultar" : "Detalle"}
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      )}

      {expanded ? (
        <div className="zf-meal-card__details mt-3 border-t border-white/10 pt-3">
          <p className="text-xs font-bold leading-relaxed text-zinc-300">
            {plan?.source === "personal_target"
              ? "Reservaste este margen al crear tus metas. Podés completarlo libremente sin modificar las metas de cada comida."
              : "Tu coach dejó este margen para completar durante el día. Podés registrarlo en Tracking o consumirlo fuera del menú."}
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

function SaveDayFavoriteModal({ draft, saving, onClose, onSave }) {
  const [name, setName] = useState(draft?.name || "Mi día favorito");
  const physicalCount = draft?.physicalMeals?.length || 0;
  const targetCount = draft?.targetMeals?.length || 0;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-end bg-black/75 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="save-day-title">
      <section className="w-full max-w-md rounded-t-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_100%_0,rgba(45,212,191,.14),transparent_34%),#0c131a] p-5 shadow-2xl sm:rounded-[1.6rem]">
        <div className="flex items-start justify-between gap-3">
          <div><span className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Día guardado</span><h2 id="save-day-title" className="mt-1 text-xl font-black text-white">Guardar esta planificación</h2></div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300"><X size={17} /></button>
        </div>
        <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-400">Se guarda como plantilla. No se copiarán Picoteo, estados “Hecha” ni alimentos consumidos de Tracking.</p>
        <label className="mt-4 block text-xs font-black text-zinc-300" htmlFor="save-day-name">Nombre</label>
        <input id="save-day-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-black text-white outline-none focus:border-emerald-300/50" />
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.07] p-2"><span className="block text-[8px] font-black uppercase text-zinc-500">Plan</span><strong className="mt-1 block text-sm text-[#FFE080]">{displayKcal(draft?.plannedTotals?.kcal)}</strong></div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2"><span className="block text-[8px] font-black uppercase text-zinc-500">Comidas</span><strong className="mt-1 block text-sm text-white">{physicalCount}</strong></div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2"><span className="block text-[8px] font-black uppercase text-zinc-500">Metas</span><strong className="mt-1 block text-sm text-white">{targetCount}</strong></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] text-sm font-black text-zinc-300 disabled:opacity-50">Cancelar</button>
          <button type="button" onClick={() => onSave({ ...draft, name: name.trim() || draft.name })} disabled={saving || !name.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 text-sm font-black text-[#04110d] disabled:opacity-50">{saving ? <RefreshCw size={16} className="animate-spin" /> : <Heart size={16} />}Guardar día</button>
        </div>
      </section>
    </div>
  );
}

function SaveMealModal({
  draft,
  saving,
  favoriteLimit,
  savedMealLimit,
  onClose,
  onSave,
}) {
  const [name, setName] = useState(draft?.payload?.nombre || "Mi comida");
  const [favorite, setFavorite] = useState(draft?.payload?.favorita === true);
  const itemCount = draft?.payload?.items?.length || 0;
  const totals = totalFromLike(draft?.totals);
  const limitCopy = Number.isFinite(Number(savedMealLimit))
    ? `Tu plan permite hasta ${Number(savedMealLimit)} comidas guardadas.`
    : "Se guardará en tu biblioteca personal.";

  return (
    <div className="fixed inset-0 z-[190] grid place-items-end bg-black/75 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="save-meal-title">
      <section className="w-full max-w-md rounded-t-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_100%_0,rgba(45,212,191,.14),transparent_34%),#0c131a] p-5 shadow-2xl sm:rounded-[1.6rem]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-300">Mis comidas</span>
            <h2 id="save-meal-title" className="mt-1 text-xl font-black text-white">Guardar esta comida</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 disabled:opacity-50" aria-label="Cerrar">
            <X size={17} />
          </button>
        </div>

        <p className="mt-3 text-sm font-bold leading-relaxed text-zinc-400">
          Se guarda una copia reutilizable de los alimentos y cantidades. Tracking y la planificación actual no cambian.
        </p>

        <label className="mt-4 block text-xs font-black text-zinc-300" htmlFor="save-meal-name">Nombre</label>
        <input
          id="save-meal-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={180}
          autoFocus
          className="mt-2 min-h-12 w-full rounded-xl border border-white/10 bg-black/25 px-3 text-sm font-black text-white outline-none focus:border-emerald-300/50"
        />

        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.07] p-2">
            <span className="block text-[8px] font-black uppercase text-zinc-500">Energía</span>
            <strong className="mt-1 block text-sm text-emerald-200">{displayKcal(totals.kcal)}</strong>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2">
            <span className="block text-[8px] font-black uppercase text-zinc-500">Alimentos</span>
            <strong className="mt-1 block text-sm text-white">{itemCount}</strong>
          </div>
          <div className="rounded-xl border border-white/[0.07] bg-black/20 p-2">
            <span className="block text-[8px] font-black uppercase text-zinc-500">Origen</span>
            <strong className="mt-1 block truncate text-[10px] text-white">{draft?.sourceLabel || "Menú"}</strong>
          </div>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3">
          <input
            type="checkbox"
            checked={favorite}
            onChange={(event) => setFavorite(event.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#D4AF37]"
          />
          <span>
            <strong className="block text-xs font-black text-[#FFE8A3]">Destacar como favorita</strong>
            <small className="mt-1 block text-[9px] font-bold leading-relaxed text-zinc-500">
              {Number.isFinite(Number(favoriteLimit))
                ? `Podés destacar hasta ${Number(favoriteLimit)} favoritas con tu plan.`
                : "Podrás encontrarla más rápido usando el filtro de favoritas."}
            </small>
          </span>
        </label>

        <p className="mt-3 text-[9px] font-bold text-zinc-500">{limitCopy}</p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] text-sm font-black text-zinc-300 disabled:opacity-50">Cancelar</button>
          <button
            type="button"
            onClick={() => onSave({ nombre: name.trim(), favorita: favorite })}
            disabled={saving || !name.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-300 to-teal-300 text-sm font-black text-[#04110d] disabled:opacity-50"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : favorite ? <Heart size={16} fill="currentColor" /> : <Save size={16} />}
            Guardar comida
          </button>
        </div>
      </section>
    </div>
  );
}

function AutonomousMenuQuickActions({ mobile = false }) {
  const actions = React.useContext(MenuAutonomousActionsContext);

  if (!actions?.visible) return null;
  const createsTargets = actions.generationAction === "create_targets";
  const automaticLocked = createsTargets ? !actions.canPlanMeal : !actions.canGenerate;


  const actionCount = [
  actions.canCreate,
  true,
  actions.canEditSettings,
  ...(mobile ? [true, true] : []),
].filter(Boolean).length;
  const denseMobileActions = mobile && actionCount >= 5;

  const modeLabel = generationModeLabel(actions.settings?.mode);

  return (
    <section className={`${mobile ? "zf-menu-mobile-actions" : ""} mt-2.5`} aria-label="Acciones rápidas de menú">

      <div
        className={mobile
          ? "grid gap-2"
          : "grid overflow-hidden rounded-[1.05rem] border border-[#D4AF37]/20 bg-[linear-gradient(145deg,#111820,#090d13)] shadow-[0_10px_26px_rgba(0,0,0,.26)]"}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, actionCount)}, minmax(0, 1fr))` }}
      >


{actions.canCreate ? (
  <QuickMenuAction
    icon={ClipboardPlus}
    label="Crear menú"
    compactLabel={denseMobileActions ? "Crear" : ""}
    tone="violet"
    onClick={actions.onCreate}
    mobile={mobile}
  />
) : null}



<QuickMenuAction
  icon={actions.generating ? RefreshCw : Sparkles}
  label={actions.generating ? actions.creatingTargets ? "Creando" : "Generando" : "Generar"}
  detail={automaticLocked ? "Pro" : createsTargets ? "Por meta" : modeLabel}
  tone="cyan"
  onClick={actions.onAutomatic}
  busy={actions.generating}
  locked={automaticLocked}
  mobile={mobile}
/>
        {actions.canEditSettings ?

<QuickMenuAction
  icon={SlidersHorizontal}
  label="Ajustes"
  tone="gold"
  onClick={actions.onToggleSettings}
  pressed={actions.settingsOpen}
  controls="menu-generation-settings"
  mobile={mobile}
/> : null}

        {mobile ? (
          <>
            <QuickMenuAction
              icon={Heart}
              label="Guardar"
              tone="green"
              onClick={actions.onSaveDay}
              disabled={!actions.canSaveDay}
              mobile
            />
            <QuickMenuAction
              icon={BookOpen}
              label="Guardados"
              compactLabel={denseMobileActions ? "Días" : ""}
              tone="gold"
              onClick={actions.onOpenSavedDays}
              mobile
            />
          </>
        ) : null}
      </div>

      {!mobile ? <div className="zf-menu-day-tools mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={actions.onSaveDay}
          disabled={!actions.canSaveDay}
          aria-label="Guardar día"
          title="Guardar día"
          className={`zf-menu-day-tool inline-flex items-center justify-center gap-2 rounded-xl px-3 text-[10.5px] font-black transition duration-200 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 ${mobile ? "min-h-10" : "min-h-11"} ${mobile
            ? "border border-emerald-300/20 bg-[linear-gradient(145deg,rgba(16,185,129,.065),rgba(6,13,16,.82))] text-emerald-100 hover:border-emerald-300/35 hover:bg-emerald-300/[0.09]"
            : "border border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100"}`}
        >
          <Heart size={14} />
          {mobile ? "Guardar" : "Guardar día"}
        </button>
        <button
          type="button"
          onClick={actions.onOpenSavedDays}
          aria-label="Abrir días guardados"
          title="Días guardados"
          className={`zf-menu-day-tool inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-3 text-[10.5px] font-black text-zinc-200 transition duration-200 active:scale-[0.98] ${mobile ? "min-h-10" : "min-h-11"} ${mobile
            ? "bg-[linear-gradient(145deg,rgba(255,255,255,.035),rgba(3,6,10,.7))] hover:border-white/20 hover:bg-white/[0.055]"
            : "bg-white/[0.035]"}`}
        >
          <BookOpen size={14} />
          {mobile ? "Guardados" : "Días guardados"}
        </button>
      </div> : null}

      {actions.topUpOffer ? (
        <div className="mt-2 overflow-hidden rounded-2xl border border-cyan-300/30 bg-[radial-gradient(circle_at_100%_0,rgba(34,211,238,.12),transparent_38%),rgba(8,18,25,.96)] p-3 shadow-[0_12px_28px_rgba(0,0,0,.28)]" role="alertdialog" aria-labelledby="menu-top-up-title" aria-describedby="menu-top-up-description">
          <div className="flex items-start gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 text-cyan-200"><CircleAlert size={17} aria-hidden="true" /></span>
            <div className="min-w-0">
              <strong id="menu-top-up-title" className="block text-[12px] font-black text-white">Encontramos un menú cercano</strong>
              <p id="menu-top-up-description" className="mt-1 text-[10px] font-bold leading-relaxed text-zinc-300">
                <b className="text-cyan-100">{actions.topUpOffer.candidateName}</b> cumple la referencia proteica, pero faltan <b className="text-[#FFE080]">{Math.round(Number(actions.topUpOffer.topUpTarget?.kcal) || 0)} kcal</b> para tu objetivo del día.
              </p>
              <p className="mt-1 text-[9px] font-bold leading-relaxed text-zinc-500">Si aceptás, se abrirá un borrador con un complemento pendiente para que elijas sus alimentos antes de guardar.</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-[.72fr_1.28fr] gap-2">
            <button type="button" className="min-h-11 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-[10px] font-black text-zinc-300" onClick={actions.onRejectTopUp} disabled={actions.generating}>No usar</button>
            <button type="button" className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-cyan-300/35 bg-cyan-300/10 px-2 text-[10px] font-black text-cyan-100" onClick={actions.onAcceptTopUp} disabled={actions.generating}>
              {actions.generating ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Usar y completar {Math.round(Number(actions.topUpOffer.topUpTarget?.kcal) || 0)} kcal
            </button>
          </div>
        </div>
      ) : null}

      {actions.error ? (
        <div className="mt-2 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-3 text-xs font-bold text-amber-100" role="alert">
          <p>{actions.error}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {!actions.hasTarget ? <button type="button" className="min-h-11 rounded-xl border border-amber-200/30 px-3 font-black" onClick={actions.onOpenObjectives}>Ir a Objetivos</button> : null}
            <button type="button" className="min-h-11 rounded-xl border border-white/10 px-3 font-black" onClick={actions.onLibrary}>Explorar biblioteca</button>
            <button type="button" className="min-h-11 rounded-xl border border-white/10 px-3 font-black" onClick={actions.onCreate}>Crear manualmente</button>
          </div>
        </div>
      ) : null}

      <MenuGenerationSettingsWizard
        open={actions.settingsOpen}
        settings={actions.targetDayEditContext?.settings || actions.settings}
        target={actions.target}
        trackingBreakdown={actions.trackingBreakdown}
        hasMenu={actions.hasMenu}
        purpose={actions.wizardPurpose}
        onClose={actions.onCloseSettings}
        onSave={actions.onSaveSettings}
        onGenerate={actions.onGenerateFromSettings}
        onCreateTargets={actions.onCreateTargetsFromSettings}
        creatingTargets={actions.creatingTargets}
        onRestore={actions.onRestoreSettings}
        targetEditContext={actions.targetDayEditContext}
        targetGenerationContext={actions.targetGenerationContext}
        onUpdateTargets={actions.onUpdatePersonalTargetDay}
        externalError={actions.error}
      />
    </section>
  );
}

function QuickMenuAction({
  icon,
  label,
  compactLabel = "",
  detail = "",
  tone = "gold",
  onClick,
  busy = false,
  locked = false,
  pressed,
  controls,
  mobile = false,
  disabled = false,
}) {
  const colors = {
    green:
      "border-lime-400/35 bg-lime-400/10 text-lime-300",
    violet:
      "border-violet-400/35 bg-violet-400/10 text-violet-300",
    cyan:
      "border-cyan-400/35 bg-cyan-400/10 text-cyan-200",
    gold:
      "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#FFD76B]",
  };
  const mobileSurfaces = {
    green: "border-lime-300/20 bg-[radial-gradient(circle_at_50%_0,rgba(163,230,53,.10),transparent_55%),linear-gradient(145deg,#10171a,#080d11)]",
    violet: "border-violet-300/20 bg-[radial-gradient(circle_at_50%_0,rgba(167,139,250,.13),transparent_55%),linear-gradient(145deg,#12131c,#080d12)]",
    cyan: "border-cyan-300/22 bg-[radial-gradient(circle_at_50%_0,rgba(34,211,238,.13),transparent_55%),linear-gradient(145deg,#0d171c,#070d12)]",
    gold: "border-[#D4AF37]/25 bg-[radial-gradient(circle_at_50%_0,rgba(212,175,55,.14),transparent_55%),linear-gradient(145deg,#16160f,#090d11)]",
  };

  return (
    <button
      type="button"
      className={`group relative flex min-w-0 flex-col items-center justify-center gap-1 text-center transition duration-200 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFD76B] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-35 disabled:active:scale-100 ${mobile
        ? `min-h-[62px] overflow-hidden rounded-[.9rem] border px-1.5 py-1.5 shadow-[0_8px_22px_rgba(0,0,0,.23),inset_0_1px_0_rgba(255,255,255,.035)] hover:-translate-y-0.5 hover:border-white/25 ${mobileSurfaces[tone] || mobileSurfaces.gold}`
        : "min-h-[70px] border-r border-white/[0.07] px-1 py-2.5 hover:bg-white/[0.055] min-[640px]:min-h-[72px] min-[640px]:flex-row min-[640px]:gap-2.5 min-[640px]:px-3"}
        ${pressed ? "ring-1 ring-inset ring-[#FFD76B]/35 bg-[#D4AF37]/[0.08]" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-busy={busy || undefined}
      aria-pressed={pressed}
      aria-expanded={controls ? pressed : undefined}
      aria-controls={controls}
      aria-label={`${label}${detail ? `, ${detail}` : ""}${locked ? ", requiere plan Pro o VIP" : ""}`}
      title={label}
    >
      <span
        className={`
          grid
          ${mobile ? "h-8 w-8" : "h-11 w-11 min-[640px]:h-10 min-[640px]:w-10"}
          shrink-0
          place-items-center
          rounded-full
          border
          ${colors[tone] || colors.gold}
        `}
      >
        {React.createElement(icon, {
          size: mobile ? 16 : 19,
          strokeWidth: 2.2,
          className: busy ? "animate-spin" : "",
          "aria-hidden": "true",
        })}
      </span>

      <span className="w-full min-w-0 px-0.5">
        <strong
          className={`
            block
            truncate
            text-[10.5px]
            font-black
            leading-tight
            text-zinc-100
            ${mobile ? "min-[390px]:text-[11px]" : "min-[390px]:text-[11px] sm:text-[12.5px]"}
          `}
        >
          {compactLabel || label}
        </strong>

        {detail ? (
          <small
            className={`
              ${mobile && locked ? "block" : "hidden"}
              truncate
              text-[8.5px]
              font-bold
              text-zinc-500
              ${mobile ? "" : "min-[640px]:block"}
            `}
          >
            {detail}
          </small>
        ) : null}
      </span>
    </button>
  );
}

function EditDayTargetsButton({ onClick, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="group relative flex min-h-[66px] w-full items-center gap-3 overflow-hidden rounded-[1.15rem] border border-teal-300/35 bg-[radial-gradient(circle_at_12%_0,rgba(45,212,191,.18),transparent_34%),linear-gradient(135deg,rgba(8,35,39,.96),rgba(8,15,23,.98))] px-3.5 py-3 text-left shadow-[0_14px_34px_rgba(0,0,0,.30),inset_0_1px_0_rgba(255,255,255,.045)] transition hover:border-teal-200/55 hover:shadow-[0_16px_38px_rgba(20,184,166,.12)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <span className="pointer-events-none absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-teal-200 via-cyan-300 to-[#FFD75E] shadow-[0_0_16px_rgba(45,212,191,.7)]" />
      <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-teal-200/35 bg-teal-300/10 text-teal-100 shadow-[0_0_22px_rgba(45,212,191,.12)]">
        <Layers3 size={20} strokeWidth={2.15} />
        <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border border-[#071014] bg-[#FFD75E] text-black shadow-lg">
          <PencilLine size={10} strokeWidth={2.8} />
        </span>
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-black leading-tight text-white sm:text-sm">
          Editar metas del día
        </span>
        <span className="mt-1 block text-[9.5px] font-bold leading-snug text-teal-50/60 sm:text-[11px]">
          Ajustá comidas, kcal, macros y candados
        </span>
      </span>

      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-teal-100 transition group-hover:translate-x-0.5 group-hover:border-teal-200/30">
        <ChevronRight size={17} strokeWidth={2.5} />
      </span>
    </button>
  );
}

function MobileDayMenu({
  row,
  trackingDay = null,
  dailyTargetItems = [],
  weekRows = [],
  activePlan = {},
  activePlanSource = "none",
  onPrevious,
  onNext,
  previousDisabled = false,
  onOpenMenuOptions,
  onEditActiveMenu,
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
  canUseFlexibleRecommendations,
  manualCompletionAction = null,
  saving,
}) {
  const [isGoalExpanded, setIsGoalExpanded] = useState(false);
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);

  if (!row) return null;
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const choices = menuChoices(row);
  const primary = choices[0] || null;
  const activeChoice = trackingChoice(row) || primary;
  const activeMeals = reconcilePlannedMealsWithPersonalTargets({
    plannedMeals: activeChoice ? choiceMeals(activeChoice) : [],
    trackingDay,
    completedMealIds: displayRow?.tracking?.completedMenuMealIds,
    suppressedMealIds: suppressedMenuMealIds(displayRow),
    legacyTargetMeals: autonomousActions?.legacyTargetPlanDate === displayRow?.date
      ? autonomousActions?.legacyTargetMeals
      : [],
    menuSource: activeChoice?.snapshot?.source,
  }).meals;
  const effectiveMeals = effectiveMealEntriesForDay(displayRow, activeMeals, weekRows, trackingDay);
  const targetOnlyMeals = plannedMealTargets(displayRow, trackingDay);
  const plannedTargetCompositions = plannedCompositionsByTarget(
    displayRow,
    targetOnlyMeals,
    activeMeals
  );
  const attachedPlannedMealIds = new Set(
    [...plannedTargetCompositions.values()].map((entry) => String(entry.baseMealId))
  );
  const visibleEffectiveMeals = effectiveMeals.filter((entry) => (
    !attachedPlannedMealIds.has(String(mealId(entry.baseMeal || entry.meal, entry.mealIndex)))
  ));
  const generatedEntries = visibleEffectiveMeals.filter((entry) => entry.generated);
  const manualEntries = visibleEffectiveMeals.filter((entry) => entry.manual);
  const removablePlanningEntries = visibleEffectiveMeals.filter((entry) => !entry.manual && !entry.generated);
  const countableMeals = countableMealEntries(effectiveMeals);
  const completedCount = completedCountableMeals(effectiveMeals);
  const target = targetTotals(displayRow);
  const hasTarget = hasConfiguredTarget(displayRow);
  const consumed = consumedTotals(displayRow);
  const remaining = remainingTotals(displayRow);
  const percent = completionPercent(displayRow);
  const activeMenuStatus = activeChoice ? choiceStatus(row, activeChoice) : menuState(row);
  const canQuickEditMeals = canQuickEditMenuChoice(activeChoice, activePlanSource, displayRow?.date);
  const emptyCopy = emptyMenuCopy(activePlanSource);
  const hasRetiredMenuPlanning = suppressedMenuMealIds(displayRow).length > 0
    || (autonomousActions?.legacyTargetPlanDate === displayRow?.date
      && (autonomousActions?.legacyTargetMeals?.length || 0) > 0);
  const showPhysicalMenuPlanning = visibleEffectiveMeals.length > 0
    || (!targetOnlyMeals.length && !hasRetiredMenuPlanning);
  const plannedTrackingMealIds = activeMeals.map((meal, index) => (
    menuTargetExecutionContext(displayRow, meal, meal, index).id
  ));
  const personalTargetTracking = generationTrackingBreakdown(trackingDay, {
    excludedMealIds: targetOnlyMeals.flatMap((meal) => (
      Array.isArray(meal?.consumptionSourceMealIds) && meal.consumptionSourceMealIds.length
        ? meal.consumptionSourceMealIds
        : [meal.id]
    )),
  }).total;
  const flexiblePlan = flexiblePlanForChoice(displayRow, activeChoice, activePlanSource)
    || personalMealTargetFlexiblePlan(target, targetOnlyMeals, {
      ...(autonomousActions?.personalTargetFlexibleSettings || {}),
      consumedNutrition: personalTargetTracking,
      date: displayRow?.date,
    });

  return (
    <section className="mx-auto w-full max-w-[760px] overflow-x-hidden px-0.5 pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <MobileDayPicker
        row={row}
        onPrevious={onPrevious}
        onNext={onNext}
        previousDisabled={previousDisabled}
      />

      {activeChoice?.snapshot && showPhysicalMenuPlanning ? (
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
        planned={activeChoice ? choiceTotals(activeChoice) : {}}
        consumed={consumed}
        remaining={remaining}
        percent={percent}
        hasTarget={hasTarget}
        activeMenuStatus={activeMenuStatus}
        trackingTone={statusMeta(row).tone}
        trackingLabelText={trackingLabel(row)}
        completedCount={completedCount}
        mealsCount={countableMeals.length || 0}
        showOverageNotice={!autonomousActions?.personalTargetReconciliation?.hasDifference}
      />

      <WeeklyBalanceNotice balance={displayRow?.weeklyBalance || trackingDay?.weeklyBalance} />

      <AutonomousMenuQuickActions mobile />

      <DailyTargetTrackingDetails
        items={dailyTargetItems}
        remaining={remaining}
      />

      <PersonalTargetReconciliationBanner
        reconciliation={autonomousActions?.personalTargetReconciliation}
        saving={saving}
        onMaintain={autonomousActions?.onMaintainPersonalTargetPlanning}
        onAdjust={autonomousActions?.onAdjustPersonalTargetsToTracking}
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

      {!targetOnlyMeals.length && !visibleEffectiveMeals.length ? (
        <section className="mt-3" aria-labelledby="mobile-menu-meals-title">
          <header className="mb-2 flex items-center justify-between gap-3 px-0.5">
            <h2 id="mobile-menu-meals-title" className="text-[13px] font-black text-white min-[390px]:text-sm">
              Tus comidas
            </h2>
            <button
              type="button"
              onClick={() => setIsGoalExpanded((current) => !current)}
              className="inline-flex min-h-8 items-center gap-1 rounded-lg px-1.5 text-[9.5px] font-black text-[#FFE080] transition hover:bg-[#D4AF37]/10 hover:text-[#FFF0B8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#FFD76B]"
              aria-expanded={isGoalExpanded}
              aria-controls="mobile-goal-day-detail"
            >
              {isGoalExpanded ? "Ocultar detalle" : "Ver macros"}
              {isGoalExpanded ? <ChevronUp size={13} /> : <ChevronRight size={13} />}
            </button>
          </header>

          <MobileStandaloneTracking trackingDay={trackingDay} />

          <div className="mt-2.5">
            <MobileEmptyCard
              title={emptyCopy.title}
              text={emptyCopy.text}
              trackingAction
            />
          </div>
        </section>
      ) : null}




      {targetOnlyMeals.length ? (
        <section className="mt-3 grid gap-2.5" aria-label={`${targetOnlyMeals.length} comidas por meta`}>
          <MobileStandaloneTracking
            trackingDay={trackingDay}
            date={displayRow?.date}
            onlyMealIds={["picoteo"]}
            showHeader={false}
          />

          {flexiblePlan ? (
            <FlexibleMarginSlotCard
              row={displayRow}
              plan={flexiblePlan}
              saving={saving}
              canRecommend={canUseFlexibleRecommendations}
              onEdit={() => onOpenFlexibleMargin?.(displayRow, "manual", flexiblePlan)}
              onCalculate={() => onOpenFlexibleMargin?.(displayRow, "calculate", flexiblePlan)}
              onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(displayRow, flexiblePlan)}
            />
          ) : null}

          {targetOnlyMeals.map((meal, mealIndex) => (


<PlannedMealTargetCard
  key={meal.id}
  row={displayRow}
  meal={meal}
  mealIndex={mealIndex}
  disabled={saving}
  plannedComposition={plannedTargetCompositions.get(String(meal.id)) || null}
  onEditPlanned={canQuickEditMeals && plannedTargetCompositions.has(String(meal.id))
    ? () => {
        const composition = plannedTargetCompositions.get(String(meal.id));
        onQuickEditMeal?.({
          row: displayRow,
          meal: composition.meal,
          baseMeal: composition.meal,
          mealIndex: composition.mealIndex,
        });
      }
    : null}

  onEditTarget={editablePersonalMealTargetIds([meal]).length
    ? () => autonomousActions?.onEditPersonalTarget?.(meal)
    : null}

  onDeleteTarget={editablePersonalMealTargetIds([meal]).length
    ? (context) => autonomousActions?.onDeletePersonalTarget?.(displayRow, meal, context)
    : null}

  onToggleTargetConfirmed={meal.personalTargetOnly
    ? () => autonomousActions?.onTogglePersonalTargetConfirmed?.(meal)
    : meal.coachTargetOnly
      ? () => autonomousActions?.onToggleCoachTargetConfirmed?.(meal, displayRow)
      : null}

  onSettings={() =>
    onOpenMeal({
      row: displayRow,
      meal,
      baseMeal: meal,
      mealIndex,
      action: "settings",
    })
  }

  onManage={() =>
  onOpenMeal({
    row: displayRow,
    meal,
    baseMeal: meal,
    mealIndex,
    action: "native_target",
  })
}

  onAddFood={() =>
    onOpenMeal(buildNativeMealTargetDrawerContext({
      row: displayRow,
      meal,
      mealIndex,
      openFoodPicker: true,
    }))
  }



onGenerate={(completionContext = {}) =>
  onOpenMeal({
    row: displayRow,
    meal,
    baseMeal: meal,
    mealIndex,

    action: "native_target_complete",

    nativeTarget: true,

    ...completionContext,
  })
}
/>

          ))}

          {targetOnlyMeals.some((meal) => meal.personalTargetOnly) ? (
            <EditDayTargetsButton
              disabled={saving || autonomousActions?.canPlanMeal === false}
              onClick={() => autonomousActions?.onEditPersonalTargetDay?.(displayRow, targetOnlyMeals)}
            />
          ) : null}

          <div className="mt-1 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => autonomousActions?.onTracking?.("picoteo")}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#FFD76B]/40 bg-gradient-to-r from-[#FFC928] to-[#FFE16A] px-3 text-[10px] font-black text-black transition active:scale-[0.98]"
            >
              <Plus size={15} strokeWidth={2.7} />
              Registrar alimento
            </button>
            <button
              type="button"
              disabled={autonomousActions?.canPlanMeal === false}
              onClick={() => autonomousActions?.onPlanMeal?.()}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/[0.06] px-3 text-[10px] font-black text-emerald-200 transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Target size={15} strokeWidth={2.4} />
              Registrar otra
            </button>
          </div>

          {targetOnlyMeals.some((meal) => meal.personalTargetOnly) ? (
            <div className="grid grid-cols-2 gap-2 border-t border-white/[0.07] pt-2">
              <button
                type="button"
                disabled={saving}
                onClick={() => autonomousActions?.onFormatPersonalTargets?.(displayRow, targetOnlyMeals)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/[0.06] px-3 text-[10px] font-black text-amber-100 disabled:opacity-45"
              >
                <RotateCcw size={14} />
                Formatear menú
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => autonomousActions?.onDeletePersonalTargets?.(displayRow, targetOnlyMeals)}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/[0.06] px-3 text-[10px] font-black text-rose-100 disabled:opacity-45"
              >
                <Trash2 size={14} />
                Eliminar planificación
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {!primary?.snapshot && targetOnlyMeals.length ? (
        <MobileStandaloneTracking
          trackingDay={trackingDay}
          date={displayRow?.date}
          excludeMealIds={["picoteo"]}
        />
      ) : null}

      {activeChoice?.snapshot ? (
        <MobileStandaloneTracking
          trackingDay={trackingDay}
          date={displayRow?.date}
          excludeMealIds={[
            ...plannedTrackingMealIds,
            ...targetOnlyMeals.map((meal) => meal.id),
            ...(targetOnlyMeals.length ? ["picoteo"] : []),
          ]}
        />
      ) : null}

      {flexiblePlan && !targetOnlyMeals.length ? (
        <FlexibleMarginSlotCard
          row={displayRow}
          plan={flexiblePlan}
          saving={saving}
          canRecommend={canUseFlexibleRecommendations}
          onEdit={() => onOpenFlexibleMargin?.(displayRow, "manual", flexiblePlan)}
          onCalculate={() => onOpenFlexibleMargin?.(displayRow, "calculate", flexiblePlan)}
          onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(displayRow, flexiblePlan)}
        />
      ) : null}

      {activeChoice?.snapshot && showPhysicalMenuPlanning ? (
        <section className="mt-3 grid gap-2.5">
          <div className="flex items-center justify-between gap-3 px-1">
            <h3 className="text-base font-black text-white">Comidas del día</h3>
            <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-black text-[#FFE8A3]">
              {completedMealsLabel(completedCount, countableMeals.length || 0)}
            </span>
          </div>
          {visibleEffectiveMeals.length ? (
            visibleEffectiveMeals.map((entry) => (
              <MobileMealCard
                key={entry.key}
                row={displayRow}
                meal={entry.meal}
                baseMeal={entry.baseMeal}
                mealChoices={entry.mealChoices}
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
          {autonomousActions?.hasAutomaticMenuPlanning ? (
            <button
              type="button"
              onClick={() => {
                if (removablePlanningEntries.length === 1) {
                  const entry = removablePlanningEntries[0];
                  autonomousActions?.onDeleteAutomaticMenuMeal?.(
                    displayRow,
                    entry.baseMeal || entry.meal,
                    entry.mealIndex
                  );
                  return;
                }
                autonomousActions?.onDeleteAutomaticMenuMeals?.(displayRow);
              }}
              disabled={saving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/[0.06] px-3 text-[11px] font-black text-rose-100 transition active:scale-[0.99] disabled:opacity-45"
            >
              <Trash2 size={15} />
              {removablePlanningEntries.length === 1 ? "Eliminar comida" : "Eliminar comidas"}
            </button>
          ) : null}
          <GeneratedWeeklyActions
            row={displayRow}
            generatedEntries={generatedEntries}
            onRestoreGenerated={onRestoreGenerated}
            manualEntries={manualEntries}
            onRestoreManual={onRestoreManual}
            onDeleteManual={onDeleteManual}
          />
          {manualCompletionAction}
        </section>
      ) : null}
    </section>
  );
}

function WeeklyBalanceNotice({ balance = null }) {
  if (!balance?.active) return null;
  const kcal = Number(balance.calorieCarry) || 0;
  if (Math.abs(kcal) <= 0.5) return null;
  const signed = (value, suffix) => Math.abs(value) < 0.05
    ? `0 ${suffix}`
    : `${value > 0 ? "+" : "-"}${formatNumber(Math.abs(value), 0)} ${suffix}`;
  return (
    <aside className="mt-2 flex items-center gap-2.5 rounded-[.95rem] border border-amber-300/25 bg-[linear-gradient(145deg,rgba(18,25,27,.98),rgba(7,13,17,.98))] px-2.5 py-2 shadow-[0_8px_20px_rgba(0,0,0,.18)]" role="status">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[.7rem] border border-amber-300/25 bg-amber-300/10 text-amber-200"><CalendarDays size={15} /></span>
      <div className="min-w-0 flex-1">
        <strong className="block text-[11px] font-black text-white">Ajuste semanal aplicado</strong>
        <span className="mt-0.5 block truncate text-[8.5px] font-bold text-zinc-500">Incluido en la meta de hoy · {balance.isClosingDay ? "Cierra hoy" : "Cierra el domingo"}</span>
      </div>
      <strong className={`shrink-0 text-sm font-black tabular-nums ${kcal < 0 ? "text-rose-300" : "text-amber-200"}`}>{signed(kcal, "kcal")}</strong>
    </aside>
  );
}

function MobileGoalAccordion({
  expanded,
  onToggle,
  target = {},
  planned = {},
  consumed = {},
  remaining = {},
  percent = 0,
  hasTarget = true,
  activeMenuStatus = {},
  trackingTone = "slate",
  trackingLabelText = "Pendiente",
  completedCount = 0,
  mealsCount = 0,
  showOverageNotice = true,
}) {
  const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
  const remainingKcal = Number(remaining?.kcal) || 0;
  const isWithinCalorieTolerance = Math.abs(remainingKcal) <= MEAL_TARGET_KCAL_TOLERANCE;
  const displayPercent = isWithinCalorieTolerance ? 100 : safePercent;
  const remainingKcalValue = isWithinCalorieTolerance ? 0 : Math.abs(remainingKcal);
  const isCalorieOver = remainingKcal < -MEAL_TARGET_KCAL_TOLERANCE;
  const plannedKcalOverage = Math.max(0, (Number(planned?.kcal) || 0) - (Number(target?.kcal) || 0));
  const isPlanOver = plannedKcalOverage > MEAL_TARGET_KCAL_TOLERANCE;
  const remainingKcalLabel = isWithinCalorieTolerance
    ? "Cumplido"
    : isCalorieOver ? "Excediste" : "Te quedan";
  const remainingKcalTone = isCalorieOver
    ? "text-rose-300"
    : isWithinCalorieTolerance
      ? "text-emerald-300"
      : "text-sky-200";
  const effectiveTrackingTone = isWithinCalorieTolerance ? "green" : trackingTone;
  const effectiveTrackingLabel = isWithinCalorieTolerance ? "Cumplido" : trackingLabelText;
  const detailId = "mobile-goal-day-detail";
  const ChevronIcon = expanded ? ChevronUp : ChevronDown;
  const targetKcal = Math.max(0, Number(target?.kcal) || 0);
  const calorieRingPercent = isCalorieOver
    ? 100
    : targetKcal > 0
      ? Math.max(0, Math.min(100, (remainingKcalValue / targetKcal) * 100))
      : 0;
  const calorieRingColor = isCalorieOver ? "#fb7185" : isWithinCalorieTolerance ? "#6ee7b7" : "#2dd4bf";
  const macroRows = [
    {
      key: "protein",
      label: "Proteína",
      current: Math.max(0, Number(consumed?.proteina) || 0),
      goal: Math.max(0, Number(target?.proteina) || 0),
      dotClass: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,.55)]",
      fillClass: "bg-gradient-to-r from-rose-500 to-orange-300",
    },
    {
      key: "carbs",
      label: "Carbohidratos",
      current: Math.max(0, Number(consumed?.carbs) || 0),
      goal: Math.max(0, Number(target?.carbs) || 0),
      dotClass: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,.55)]",
      fillClass: "bg-gradient-to-r from-sky-500 to-cyan-300",
    },
    {
      key: "fat",
      label: "Grasas",
      current: Math.max(0, Number(consumed?.grasas) || 0),
      goal: Math.max(0, Number(target?.grasas) || 0),
      dotClass: "bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,.5)]",
      fillClass: "bg-gradient-to-r from-amber-500 to-yellow-200",
    },
  ];

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
    <section className="zf-menu-mobile-goal mt-2 overflow-hidden rounded-[1.05rem] border border-white/10 bg-[radial-gradient(circle_at_88%_12%,rgba(212,175,55,.10),transparent_32%),radial-gradient(circle_at_0_0,rgba(45,212,191,.09),transparent_38%),linear-gradient(145deg,#101821,#070c12)] shadow-[0_12px_28px_rgba(0,0,0,.28),inset_0_1px_0_rgba(255,255,255,.035)]">
      <button
        type="button"
        className="group relative block w-full px-3 pb-3 pt-2.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#FFD76B]"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={onToggle}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="text-[9px] font-black uppercase tracking-[.11em] text-zinc-400">
            Meta del día
          </span>
          <span className={`inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-[.07em] ${remainingKcalTone}`}>
            {remainingKcalLabel}
            <span className="grid h-6 w-6 place-items-center rounded-full border border-white/10 bg-black/20 text-zinc-300 transition duration-200 group-hover:border-white/20 group-hover:text-white">
              <ChevronIcon size={13} strokeWidth={2.5} aria-hidden="true" />
            </span>
          </span>
        </span>

        <span className="mt-1.5 grid min-w-0 grid-cols-[92px_minmax(0,1fr)] items-center gap-2.5 min-[360px]:gap-3">
          <span
            className="grid h-[92px] w-[92px] shrink-0 place-items-center rounded-full p-[5px] shadow-[0_0_24px_rgba(45,212,191,.08)] transition-[background] duration-500"
            style={{
              background: `conic-gradient(${calorieRingColor} ${calorieRingPercent * 3.6}deg, rgba(255,255,255,.085) 0deg)`,
            }}
            role="img"
            aria-label={`${remainingKcalLabel}: ${displayKcal(remainingKcalValue)} de ${displayKcal(targetKcal)}`}
          >
            <span className="grid h-full w-full place-items-center rounded-full border border-white/[0.06] bg-[radial-gradient(circle_at_50%_30%,#17212a,#080d13_70%)] text-center shadow-[inset_0_2px_10px_rgba(0,0,0,.5)]">
              <span>
                <span className="block text-[7px] font-black uppercase tracking-[.08em] text-zinc-500">
                  {isCalorieOver ? "Exceso" : isWithinCalorieTolerance ? "Balance" : "Restantes"}
                </span>
                <strong className={`mt-0.5 block text-[19px] font-black leading-none tracking-[-.04em] ${remainingKcalTone}`}>
                  {formatNumber(remainingKcalValue, 0)}
                </strong>
                <span className="mt-0.5 block text-[8px] font-black text-zinc-300">kcal</span>
                <span className="mt-0.5 block text-[7px] font-bold text-zinc-600">de {formatNumber(targetKcal, 0)}</span>
              </span>
            </span>
          </span>

          <span className="grid min-w-0 gap-2.5">
            {macroRows.map((macroRow) => {
              const macroPercent = macroRow.goal > 0
                ? Math.max(0, Math.min(100, (macroRow.current / macroRow.goal) * 100))
                : 0;
              const macroExceeded = macroRow.goal > 0 && macroRow.current > macroRow.goal;
              return (
                <span key={macroRow.key} className="block min-w-0">
                  <span className="flex min-w-0 items-center justify-between gap-1.5">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${macroRow.dotClass}`} />
                      <span className="truncate text-[8.5px] font-black uppercase tracking-[.035em] text-zinc-300 min-[360px]:text-[9px]">
                        {macroRow.label}
                      </span>
                    </span>
                    <span className={`shrink-0 text-[9.5px] font-black min-[360px]:text-[10px] ${macroExceeded ? "text-rose-300" : "text-zinc-100"}`}>
                      {formatNumber(macroRow.current, 0)} / {formatNumber(macroRow.goal, 0)} g
                    </span>
                  </span>
                  <span className="mt-1 block h-1 overflow-hidden rounded-full bg-white/[0.075]">
                    <span
                      className={`block h-full rounded-full transition-[width] duration-500 ease-out ${macroRow.fillClass}`}
                      style={{ width: `${macroPercent}%` }}
                    />
                  </span>
                </span>
              );
            })}
          </span>
        </span>
      </button>

      {isPlanOver && !isCalorieOver ? (
        <div
          className="border-t border-amber-300/20 bg-[linear-gradient(90deg,rgba(146,64,14,.22),rgba(69,26,3,.08))] px-2.5 py-2.5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-amber-300/25 bg-amber-300/10 text-amber-100">
              <AlertTriangle size={15} strokeWidth={2.3} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block text-[11px] font-black text-amber-100">
                Tu planificación supera la meta por {displayKcal(plannedKcalOverage)}
              </strong>
              <span className="mt-0.5 block text-[9px] font-bold leading-relaxed text-zinc-400">
                Podés mantenerla o editarla. Todavía no cuenta como consumo hasta que la registres.
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {isCalorieOver && showOverageNotice ? (
        <div
          className="border-t border-rose-300/20 bg-[linear-gradient(90deg,rgba(127,29,29,.24),rgba(76,5,25,.10))] px-2.5 py-2.5"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-rose-300/25 bg-rose-300/10 text-rose-200">
              <AlertTriangle size={15} strokeWidth={2.3} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <strong className="block text-[11px] font-black text-rose-100">
                Superaste tu meta por {displayKcal(remainingKcalValue)}
              </strong>
              <span className="mt-0.5 block text-[9px] font-bold leading-relaxed text-zinc-400">
                El excedente quedó registrado en Tracking. No modificamos automáticamente tu planificación.
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {expanded ? (
        <div id={detailId} className="border-t border-white/10 px-3 pb-3 pt-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black ${toneClass(activeMenuStatus.tone)}`}>
                  <Target size={13} />
                  {activeMenuStatus.label}
                </span>
                <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[11px] font-black ${toneClass(effectiveTrackingTone)}`}>
                  {effectiveTrackingLabel}
                </span>
              </div>
              <h2 className="mt-3 text-xl font-black leading-tight text-white">
                Meta <span className="text-[#FFD76B]">{displayKcal(target.kcal)}</span>
              </h2>
              <p className="mt-1 text-sm font-bold leading-tight text-zinc-400">
                P {formatNumber(target.proteina, 0)} g - C {formatNumber(target.carbs, 0)} g - G {formatNumber(target.grasas, 0)} g
              </p>
            </div>
            <MobileProgressRing percent={displayPercent} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <MobileMetric
              label="Consumido"
              value={displayKcal(consumed.kcal)}
              detail={`P ${formatNumber(consumed.proteina, 0)} / C ${formatNumber(consumed.carbs, 0)} / G ${formatNumber(consumed.grasas, 0)}`}
              tone="green"
              progress={target.kcal ? (consumed.kcal / target.kcal) * 100 : 0}
            />
            <MobileMetric
              label={isWithinCalorieTolerance ? "Balance" : "Faltante"}
              value={displayKcal(isWithinCalorieTolerance ? 0 : remaining.kcal)}
              detail={isWithinCalorieTolerance
                ? `Dentro de ±${MEAL_TARGET_KCAL_TOLERANCE} kcal`
                : `P ${formatNumber(remaining.proteina, 0)} / C ${formatNumber(remaining.carbs, 0)} / G ${formatNumber(remaining.grasas, 0)}`}
              tone={isWithinCalorieTolerance ? "green" : remaining.kcal < -20 ? "red" : "blue"}
            />
            <MobileMetric label="Comidas" value={`${completedCount} / ${mealsCount}`} detail="completadas" tone="gold" />
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DailyTargetTrackingDetails({ items = [], remaining = {} }) {
  if (!Array.isArray(items) || !items.length) return null;

  const totals = sumTotals(items);

  return (
    <section className="mt-3 overflow-hidden rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.045]">
      <header className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-3 py-2.5">
        <div>
          <span className="block text-[9px] font-black uppercase tracking-wide text-emerald-300">
            Registrado hoy · Tracking real
          </span>
          <strong className="mt-0.5 block text-sm font-black text-white">
            {items.length} alimento{items.length === 1 ? "" : "s"} · {displayKcal(totals.kcal)}
          </strong>
        </div>
        <span className="text-right text-[10px] font-bold text-zinc-400">
          Restante
          <strong className="block text-xs font-black text-sky-200">
            {displayKcal(Math.max(0, macro(remaining?.kcal)))}
          </strong>
        </span>
      </header>

      <div className="divide-y divide-white/[0.07]">
        {items.map((item, index) => {
          const totalsForItem = totalFromLike(item);
          const name =
            item?.nombreSnapshot ||
            item?.nombre ||
            item?.name ||
            "Alimento";
          const quantity = macro(item?.cantidad ?? item?.quantity);
          const unit = item?.unidad || item?.unit || "g";
          const id = item?.id || item?._id || `${name}-${index}`;

          return (
            <article key={id} className="flex items-start justify-between gap-3 px-3 py-2.5">
              <div className="min-w-0">
                <strong className="block truncate text-xs font-black text-white">{name}</strong>
                <span className="mt-0.5 block text-[10px] font-bold text-zinc-500">
                  {formatNumber(quantity, 1)} {unit}
                </span>
              </div>
              <div className="shrink-0 text-right">
                <strong className="block text-xs font-black text-[#FFE8A3]">
                  {displayKcal(totalsForItem.kcal)}
                </strong>
                <span className="block text-[9px] font-bold text-zinc-400">
                  P {formatNumber(totalsForItem.proteina, 1)} · C {formatNumber(totalsForItem.carbs, 1)} · G {formatNumber(totalsForItem.grasas, 1)}
                </span>
              </div>
            </article>
          );
        })}
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
        <button
          type="button"
          onClick={onOpenOptions}
          className="min-w-0 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/35"
          aria-label={choicesCount > 1 ? `Ver menu y ${choicesCount - 1} alternativas` : `Ver opciones de ${menuName}`}
        >
          <h2 className="line-clamp-2 text-[17px] font-black leading-tight text-white" title={menuName}>
            {menuName}
          </h2>
          <p className="mt-0.5 text-[11.5px] font-bold leading-snug text-zinc-400" title={summary}>
            <span className="block sm:inline">{summaryParts.primary}</span>
            <span className="hidden sm:inline"> · </span>
            <span className="block sm:inline">{summaryParts.secondary}</span>
          </p>
          {choicesCount > 1 ? (
            <span className="mt-1.5 inline-flex min-h-6 items-center gap-1.5 rounded-full border border-sky-300/25 bg-sky-300/[0.08] px-2 text-[10px] font-black text-sky-100">
              <Layers3 size={12} aria-hidden="true" />
              {choicesCount - 1} alternativa{choicesCount - 1 === 1 ? "" : "s"}
            </span>
          ) : null}
        </button>

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
          {choicesCount > 1 ? (
            <button
              type="button"
              onClick={onOpenOptions}
              className="relative grid h-9 w-9 place-items-center rounded-xl border border-sky-300/30 bg-sky-300/[0.08] text-sky-100 shadow-[0_8px_20px_rgba(0,0,0,.16)] active:scale-[0.98]"
              aria-label={`Ver ${choicesCount - 1} alternativas de menu`}
              title="Alternativas"
            >
              <Layers3 size={17} />
              <span className="absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full border border-[#080d12] bg-[#D4AF37] px-1 text-[9px] font-black text-black">
                {choicesCount - 1}
              </span>
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
  const drawerTitle = showChoiceSelector ? "Menú y alternativas" : "Información del menú";

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
        aria-label={`Cerrar ${drawerTitle.toLowerCase()}`}
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

          {showChoiceSelector ? (
            <section className="mb-3 rounded-[1.15rem] border border-sky-300/20 bg-sky-300/[0.035] p-2.5">
              <header className="mb-2.5 flex items-center justify-between gap-3 px-1">
                <div className="min-w-0">
                  <strong className="flex items-center gap-2 text-sm font-black text-white">
                    <Layers3 size={16} className="text-sky-200" aria-hidden="true" />
                    Elegir menu para hoy
                  </strong>
                  <span className="mt-0.5 block text-[11px] font-bold text-zinc-500">
                    El menu del coach no cambia; solamente elegis cual usar hoy.
                  </span>
                </div>
                <span className="shrink-0 rounded-full border border-sky-300/25 bg-sky-300/[0.08] px-2 py-1 text-[10px] font-black text-sky-100">
                  {choices.length} opciones
                </span>
              </header>
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
            </section>
          ) : activeChoice ? (
            <div className="mb-3 flex items-start gap-2.5 rounded-[1.05rem] border border-white/10 bg-white/[0.025] p-3">
              <Layers3 size={17} className="mt-0.5 shrink-0 text-zinc-500" aria-hidden="true" />
              <div>
                <strong className="block text-xs font-black text-zinc-300">1 menú principal / 0 alternativas</strong>
                <span className="mt-0.5 block text-[11px] font-bold leading-relaxed text-zinc-500">
                  Tu coach todavía no guardó otro menú como alternativa para este día.
                </span>
              </div>
            </div>
          ) : null}

          <div className="mb-3 grid gap-2">
            <Link
              to="/app/menu/preferencias"
              onClick={onClose}
              className="flex min-h-12 items-center justify-between rounded-[1.05rem] border border-white/10 bg-white/[0.035] px-4 text-sm font-black text-zinc-100 focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/15"
            >
              <span className="inline-flex items-center gap-2"><SlidersHorizontal size={17} /> Preferencias</span>
              <ChevronRight size={17} />
            </Link>
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
                  <span className="inline-flex items-center gap-2"><Utensils size={17} /> Desactivar menú activo</span>
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

          {!activeChoice ? (
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
  trackingDay = null,
  weekRows = [],
  activePlanSource = "none",
  detailChoiceKey = "",
  onBack,
  onPrevious,
  onNext,
  previousDisabled = false,
  onToggleMeal,
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onOpenMeal,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onRestoreGenerated,
  onRestoreManual,
  onDeleteManual,
  canMarkMeals,
  canUseFlexibleRecommendations,
  manualCompletionAction = null,
  saving,
}) {
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);
  if (!row) return null;
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const tracking = statusMeta(displayRow);
  const choices = menuChoices(row);
  const detailChoice = choices.find((choice) => choice.key === detailChoiceKey) || choices[0] || null;
  const snapshot = detailChoice?.snapshot || null;
  const meals = reconcilePlannedMealsWithPersonalTargets({
    plannedMeals: detailChoice ? choiceMeals(detailChoice) : [],
    trackingDay,
    completedMealIds: displayRow?.tracking?.completedMenuMealIds,
    suppressedMealIds: suppressedMenuMealIds(displayRow),
    legacyTargetMeals: autonomousActions?.legacyTargetPlanDate === displayRow?.date
      ? autonomousActions?.legacyTargetMeals
      : [],
    menuSource: detailChoice?.snapshot?.source,
  }).meals;
  const effectiveMeals = effectiveMealEntriesForDay(displayRow, meals, weekRows, trackingDay);
  const generatedEntries = effectiveMeals.filter((entry) => entry.generated);
  const manualEntries = effectiveMeals.filter((entry) => entry.manual);
  const detailStatus = detailChoice ? choiceStatus(row, detailChoice) : menuState(row);
  const target = targetTotals(displayRow);
  const hasTarget = hasConfiguredTarget(displayRow);
  const consumed = consumedTotals(displayRow);
  const remaining = remainingTotals(displayRow);
  const percent = completionPercent(displayRow);
  const canQuickEditMeals = canQuickEditMenuChoice(detailChoice, activePlanSource, displayRow?.date);
  const emptyCopy = emptyMenuCopy(activePlanSource);
  const targetOnlyMeals = plannedMealTargets(displayRow, trackingDay);
  const hasRetiredMenuPlanning = suppressedMenuMealIds(displayRow).length > 0
    || (autonomousActions?.legacyTargetPlanDate === displayRow?.date
      && (autonomousActions?.legacyTargetMeals?.length || 0) > 0);
  const showPhysicalMenuPlanning = effectiveMeals.length > 0
    || (!targetOnlyMeals.length && !hasRetiredMenuPlanning);
  const flexiblePlan = flexiblePlanForChoice(displayRow, detailChoice, activePlanSource)
    || personalMealTargetFlexiblePlan(target, targetOnlyMeals, {
      ...(autonomousActions?.personalTargetFlexibleSettings || {}),
      consumedNutrition: generationTrackingBreakdown(trackingDay, {
        excludedMealIds: targetOnlyMeals.flatMap((meal) => (
          Array.isArray(meal?.consumptionSourceMealIds) && meal.consumptionSourceMealIds.length
            ? meal.consumptionSourceMealIds
            : [meal.id]
        )),
      }).total,
      date: displayRow?.date,
    });

  return (
    <section className="mx-auto w-full max-w-[760px] px-0.5 pb-3">
      <MobileTopBar title={detailChoice?.type === "alternative" ? detailChoice.label : "Menú del día"} onBack={onBack} />
      <MobileDayPicker
        row={row}
        onPrevious={onPrevious}
        onNext={onNext}
        previousDisabled={previousDisabled}
      />

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
        onEdit={() => onOpenFlexibleMargin?.(displayRow, "manual", flexiblePlan)}
        onCalculate={() => onOpenFlexibleMargin?.(displayRow, "calculate", flexiblePlan)}
        onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(displayRow, flexiblePlan)}
      />

      {showPhysicalMenuPlanning ? (
      <div className="mt-4 grid gap-3">
        <h3 className="px-1 text-lg font-black text-white">Comidas del día</h3>
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
              mealChoices={entry.mealChoices}
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
        {manualCompletionAction}
      </div>
      ) : null}
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
    <section className="mx-auto w-full max-w-[760px] px-0.5 pb-3">
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

function MobileEmptyCard({
  title,
  text,
  trackingAction = false,
}) {
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);

  if (trackingAction) {
    return (
      <div className="zf-menu-mobile-empty relative overflow-hidden rounded-[1.05rem] border border-white/10 bg-[radial-gradient(circle_at_50%_-15%,rgba(45,212,191,.10),transparent_43%),radial-gradient(circle_at_100%_100%,rgba(212,175,55,.09),transparent_42%),linear-gradient(145deg,#101820,#070c11)] px-3.5 pb-3.5 pt-3 shadow-[0_14px_32px_rgba(0,0,0,.3),inset_0_1px_0_rgba(255,255,255,.035)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-[1.1rem] border border-emerald-300/20 bg-[radial-gradient(circle_at_50%_25%,rgba(110,231,183,.17),rgba(16,185,129,.055)_65%)] text-emerald-100 shadow-[0_10px_30px_rgba(16,185,129,.09),inset_0_1px_0_rgba(255,255,255,.06)]">
          <Soup size={27} strokeWidth={1.65} aria-hidden="true" />
        </div>

        <div className="mt-2.5 text-center">
          <strong className="block text-[13px] font-black leading-tight text-white min-[390px]:text-sm">
            {title}
          </strong>
          {text ? (
            <p className="mx-auto mt-1 max-w-[300px] text-[9px] font-bold leading-[1.45] text-zinc-500 min-[390px]:text-[9.5px]">
              {text}
            </p>
          ) : null}
        </div>

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            disabled={autonomousActions?.canPlanMeal === false}
            onClick={() => autonomousActions?.onPlanMeal?.()}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[#FFE080]/55 bg-gradient-to-r from-[#F8C62B] via-[#FFD84D] to-[#FFE277] px-3 text-[10.5px] font-black text-[#131006] shadow-[0_9px_22px_rgba(212,175,55,.16),inset_0_1px_0_rgba(255,255,255,.5)] transition duration-200 hover:brightness-105 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Plus size={15} strokeWidth={2.8} aria-hidden="true" />
            Registrar comida
          </button>
          <button
            type="button"
            onClick={() => autonomousActions?.onTracking?.("picoteo")}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/35 bg-emerald-300/[0.055] px-3 text-[10.5px] font-black text-emerald-100 transition duration-200 hover:border-emerald-200/55 hover:bg-emerald-300/[0.09] active:scale-[0.985]"
          >
            <Target size={15} strokeWidth={2.35} aria-hidden="true" />
            Registrar alimento
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[1.05rem] border border-[#D4AF37]/20 bg-[radial-gradient(circle_at_100%_0,rgba(212,175,55,.13),transparent_38%),linear-gradient(145deg,#111923,#090e15)] p-2.5 shadow-[0_12px_28px_rgba(0,0,0,.28)]">
      <span
        className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-gradient-to-b from-[#FFE8A3] to-[#D4AF37]"
        aria-hidden="true"
      />

      <div className="flex items-start gap-2 text-zinc-100">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFD76B]">
          <Utensils size={15} />
        </span>

        <span className="min-w-0">
          <span className="block text-[7.5px] font-black uppercase tracking-[0.12em] text-[#FFE8A3]/70">
            Tracking
          </span>

          <strong className="block text-sm font-black leading-tight">
            {title}
          </strong>
        </span>
      </div>

      {text ? (
        <p className="mt-1 pl-10 text-[9.5px] font-bold leading-[1.45] text-zinc-400">
          {text}
        </p>
      ) : null}




    </div>
  );
}

function MobileStandaloneTracking({
  trackingDay = null,
  date = "",
  onlyMealIds = null,
  excludeMealIds = [],
  showHeader = true,
}) {
  const autonomousActions =
  React.useContext(
    MenuAutonomousActionsContext
  );

const deleteMutation =
  useDeleteFoodLog();

const [
  deletingTrackingKey,
  setDeletingTrackingKey,
] = useState("");

const onlyIds = Array.isArray(onlyMealIds) ? new Set(onlyMealIds.map(String)) : null;
const excludedIds = new Set((Array.isArray(excludeMealIds) ? excludeMealIds : []).map(String));
const groups = standaloneTrackingGroups(trackingDay).filter((group) => (
  (!onlyIds || onlyIds.has(String(group.id)))
  && !excludedIds.has(String(group.id))
));
const trackingItemsCount = groups.reduce((sum, group) => sum + group.items.length, 0);
const trackingCalories = groups.reduce((sum, group) => sum + (Number(group?.totals?.kcal) || 0), 0);

const [
  expandedTrackingGroups,
  setExpandedTrackingGroups,
] = useState([]);



const previousTrackingCountsRef =
  React.useRef(null);

useEffect(() => {
  const currentCounts =
    Object.fromEntries(
      groups.map((group) => [
        group.id,
        group.items.length,
      ])
    );

  /*
   * Primera carga:
   * guardamos el estado actual pero
   * NO abrimos nada automáticamente.
   */
  if (
    previousTrackingCountsRef.current ===
    null
  ) {
    previousTrackingCountsRef.current =
      currentCounts;

    return;
  }

  const previousCounts =
    previousTrackingCountsRef.current;

  /*
   * Buscamos grupos que:
   * - aparecieron recién
   * - o recibieron un alimento nuevo
   */
  const groupsWithNewFood =
    groups
      .filter((group) => {
        const previousCount =
          previousCounts[group.id] || 0;

        return (
          group.items.length >
          previousCount
        );
      })
      .map(
        (group) => group.id
      );

  if (
    groupsWithNewFood.length
  ) {
    setExpandedTrackingGroups(
      (current) => [
        ...new Set([
          ...current,
          ...groupsWithNewFood,
        ]),
      ]
    );
  }

  previousTrackingCountsRef.current =
    currentCounts;
}, [groups]);

function toggleTrackingGroup(
  groupId
) {
  setExpandedTrackingGroups(
    (current) => {
      if (
        current.includes(
          groupId
        )
      ) {
        return current.filter(
          (id) =>
            id !== groupId
        );
      }

      return [
        ...current,
        groupId,
      ];
    }
  );
}

async function deleteTrackingFood(
  item
) {
  const logId =
    item?.id ||
    item?._id;

  if (
    !logId ||
    deleteMutation.isPending
  ) {
    return;
  }

  const foodName =
    trackingFoodName(item);

  const confirmed =
    window.confirm(
      `¿Eliminar "${foodName}" de Tracking?`
    );

  if (!confirmed) return;

  setDeletingTrackingKey(
    String(logId)
  );

  try {
    await deleteMutation.mutateAsync({
      logId,
      date,
    });

    await autonomousActions
      ?.onTrackingChanged?.();
  } finally {
    setDeletingTrackingKey("");
  }
}


async function deleteTrackingGroup(
  group
) {
  if (
    !group?.items?.length ||
    deleteMutation.isPending
  ) {
    return;
  }

  const confirmed =
    window.confirm(
      `¿Eliminar todo "${group.label}"? Se borrarán ${group.items.length} ${
        group.items.length === 1
          ? "alimento"
          : "alimentos"
      } de Tracking.`
    );

  if (!confirmed) return;

  setDeletingTrackingKey(
    `group-${group.id}`
  );

  try {
    for (
      const item
      of group.items
    ) {
      const logId =
        item?.id ||
        item?._id;

      if (!logId) continue;

      await deleteMutation.mutateAsync({
        logId,
        date,
      });
    }

    await autonomousActions
      ?.onTrackingChanged?.();
  } finally {
    setDeletingTrackingKey("");
  }
}






  if (!groups.length) {
    return null;
  }

  return (
    <section className={`zf-menu-tracking-section grid gap-2 ${showHeader ? "mt-2.5" : "mt-0"}`}>
      {showHeader ? <div className="zf-menu-section-bar zf-menu-section-bar--tracked">
        <span className="zf-menu-section-bar__icon" aria-hidden="true">
          <CheckCircle2 size={14} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1">
          <h3>Consumido hoy</h3>
          <small>
            {trackingItemsCount} {trackingItemsCount === 1 ? "alimento" : "alimentos"} · {formatNumber(trackingCalories, 0)} kcal
          </small>
        </span>
      </div> : null}

{groups.map((group, groupIndex) => {
  const expanded =
    expandedTrackingGroups.includes(
      group.id
    );
  const trackedMeal = {
    id: group.id,
    nombre: group.label,
    tipoComida: group.mealType,
    type: group.mealType,
  };
  const visual = mealVisualStyle(trackedMeal, groupIndex, { done: true });
  const mealType = String(group.id).toLowerCase() === "picoteo"
    ? "Picoteo"
    : menuTargetMealTypeLabel(normalizeMenuTargetMealType(group.mealType));
  const previewFoods = group.items.map((item, itemIndex) => ({
    id: item?.id || item?._id || `${group.id}-${itemIndex}`,
    name: trackingFoodName(item),
    imageUrl: trackingFoodImage(item),
    category: item?.food?.categoria || item?.food?.category || item?.categoria || item?.category || "",
  }));

  return (
    <article
          key={group.id}
          className={`
            zf-meal-card
            zf-meal-card--tracked
            relative
            overflow-hidden
            rounded-[1.05rem]
            border
            ${visual.frame}
            ${visual.card}
          `}
        >
          <span className={`pointer-events-none absolute inset-0 ${visual.haze}`} aria-hidden="true" />
          <span className={`pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full ${visual.rail}`} aria-hidden="true" />

          {/* HEADER DE LA COMIDA */}
          <div className="zf-meal-card__header relative z-10 flex items-start gap-2 px-2.5 py-2.5">
            <button
              type="button"
              onClick={() => toggleTrackingGroup(group.id)}
              className="flex min-w-0 flex-1 items-start gap-1.5 text-left active:scale-[0.995]"
              aria-expanded={expanded}
            >
              <MealTypeIcon meal={trackedMeal} index={groupIndex} done size="sm" />

              <div className="min-w-0 flex-1 pt-0.5">
                <span className="flex min-w-0 items-baseline gap-1">
                  <strong className="whitespace-nowrap text-[14px] font-black leading-tight tracking-[-0.01em] text-white">{group.label}</strong>
                  <strong className={`shrink-0 whitespace-nowrap text-[10px] font-black ${visual.kcalText}`}>
                    {formatNumber(group.totals.kcal, 0)} kcal
                  </strong>
                </span>
                <span className="mt-1 flex min-w-0 flex-wrap items-center gap-1">
                  <span className={`inline-flex min-h-[18px] items-center rounded-full border px-1.5 text-[8px] font-black uppercase tracking-wide ${visual.status}`}>
                    Registrada
                  </span>
                  <span className="inline-flex min-h-[18px] items-center rounded-full border border-white/10 bg-black/25 px-1.5 text-[8px] font-black text-zinc-300">
                    {mealType}
                  </span>
                  {group.entirelyFromSavedMeal ? (
                    <span className="inline-flex min-h-[18px] items-center rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/[0.08] px-1.5 text-[8px] font-black text-[#FFE8A3]">
                      Mis comidas
                    </span>
                  ) : null}
                </span>
              </div>
            </button>

<div className="zf-meal-card__actions flex shrink-0 items-center justify-end gap-1 pt-0.5">
  {/* AGREGAR */}
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();

      autonomousActions
        ?.onTracking?.(
          group.id,
          { lockDestination: true }
        );
    }}
    className={`zf-meal-card__action
      grid
      h-10
      w-10
      place-items-center
      rounded-full
      border
      ${visual.pendingButton}
      transition
      active:scale-[0.96]
    `}
    aria-label={`Agregar alimento a ${group.label}`}
    title={`Agregar a ${group.label}`}
  >
    <Plus
      size={14}
      strokeWidth={2.4}
    />
  </button>

  {/* ABRIR / CERRAR */}
  <button
    type="button"
    onClick={() =>
      toggleTrackingGroup(
        group.id
      )
    }
    className="zf-meal-card__action
      grid
      h-10
      w-9
      place-items-center
      rounded-full
      border
      border-white/10
      bg-white/[0.025]
      text-zinc-400
      transition
      hover:bg-white/[0.06]
      hover:text-white
    "
    aria-expanded={expanded}
    aria-label={
      expanded
        ? `Minimizar ${group.label}`
        : `Ver detalle de ${group.label}`
    }
    title={
      expanded
        ? "Minimizar"
        : "Ver alimentos"
    }
  >
    {expanded ? (
      <ChevronUp size={14} />
    ) : (
      <ChevronDown size={14} />
    )}
  </button>
</div>


          </div>

{!expanded ? (
  <div className="relative z-10 px-3 pb-3 pt-1.5">
    <div className="zf-meal-card__progress mb-2 rounded-xl border border-white/[0.07] bg-black/20 px-2.5 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <MobileFoodThumbStack foods={previewFoods} compact maxVisible={4} />
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center justify-between gap-2">
            <small className="truncate text-[9px] font-black text-emerald-200">Tracking real</small>
            <strong className="shrink-0 text-[9px] font-black text-zinc-300">
              {group.items.length} {group.items.length === 1 ? "alimento" : "alimentos"}
            </strong>
          </span>
          <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <span className="block h-full w-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-300 to-cyan-200" />
          </span>
        </span>
      </div>
    </div>
    <div className="zf-meal-card__macro-strip grid grid-cols-4 gap-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-2">
      <span className="grid min-w-0 gap-0.5 border-r border-white/[0.07] pr-1.5">
        <small className="text-[8px] font-black uppercase tracking-wide text-zinc-500">Consumido</small>
        <strong className={`truncate text-[11px] font-black ${visual.kcalText}`}>{formatNumber(group.totals.kcal, 0)} kcal</strong>
      </span>
      <span className="grid min-w-0 gap-0.5 border-r border-white/[0.07] px-1.5">
        <small className="text-[8px] font-black uppercase tracking-wide text-zinc-500">Proteína</small>
        <strong className="truncate text-[11px] font-black text-emerald-200">{formatNumber(group.totals.proteina, 1)} g</strong>
      </span>
      <span className="grid min-w-0 gap-0.5 border-r border-white/[0.07] px-1.5">
        <small className="text-[8px] font-black uppercase tracking-wide text-zinc-500">Carbos</small>
        <strong className="truncate text-[11px] font-black text-sky-200">{formatNumber(group.totals.carbs, 1)} g</strong>
      </span>
      <span className="grid min-w-0 gap-0.5 pl-1.5">
        <small className="text-[8px] font-black uppercase tracking-wide text-zinc-500">Grasas</small>
        <strong className="truncate text-[11px] font-black text-amber-200">{formatNumber(group.totals.grasas, 1)} g</strong>
      </span>
    </div>
  </div>
) : null}


{expanded ? (
  <div className="zf-meal-card__details">
    {/* ALIMENTOS */}
    <div className="relative z-10 divide-y divide-white/[0.055] px-2">
      {group.items.map(
        (item, index) => {
          const totals =
            totalFromLike(
              item?.totals ||
              item
            );

          const imageUrl =
            trackingFoodImage(
              item
            );

          const itemId =
            item?.id ||
            item?._id ||
            `${group.id}-${index}`;

          const deletingThisItem =
            deletingTrackingKey ===
            String(
              item?.id ||
              item?._id
            );

          return (
            <div
              key={itemId}
              className="
                flex
                items-center
                gap-2.5
                px-1
                py-2
              "
            >
              {/* IMAGEN */}
              <span
                className="
                  grid
                    h-9
                    w-9
                  shrink-0
                  place-items-center
                  overflow-hidden
                  rounded-xl
                  border
                  border-white/[0.08]
                  bg-black/25
                "
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt=""
                    className="
                      h-full
                      w-full
                      object-cover
                    "
                  />
                ) : (
                  <Apple
                    size={16}
                    className="text-zinc-500"
                  />
                )}
              </span>

              {/* INFO */}
              <div className="min-w-0 flex-1">
                <strong
                  className="
                    block
                    truncate
                    text-[12px]
                    font-black
                    text-zinc-100
                  "
                >
                  {trackingFoodName(
                    item
                  )}
                </strong>

                <small
                  className="
                    mt-0.5
                    block
                    truncate
                    text-[9px]
                    font-bold
                    text-zinc-500
                  "
                >
                  {trackingFoodQuantity(
                    item
                  )}

                  {" · "}

                  {formatNumber(
                    totals.kcal,
                    0
                  )} kcal

                  {" · P"}

                  {formatNumber(
                    totals.proteina,
                    1
                  )}

                  {" · C"}

                  {formatNumber(
                    totals.carbs,
                    1
                  )}

                  {" · G"}

                  {formatNumber(
                    totals.grasas,
                    1
                  )}
                </small>
              </div>

              {/* BORRAR ALIMENTO */}
              <button
                type="button"
                disabled={
                  deletingThisItem ||
                  deleteMutation.isPending
                }
                onClick={() =>
                  deleteTrackingFood(
                    item
                  )
                }
                className="
                  grid
                  h-10
                  w-10
                  shrink-0
                  place-items-center
                  rounded-lg
                  border
                  border-transparent
                  text-zinc-600
                  transition
                  hover:border-rose-300/20
                  hover:bg-rose-300/10
                  hover:text-rose-300
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
                aria-label={`Eliminar ${trackingFoodName(
                  item
                )}`}
                title={`Eliminar ${trackingFoodName(
                  item
                )}`}
              >
                {deletingThisItem ? (
                  <RefreshCw
                    size={13}
                    className="animate-spin"
                  />
                ) : (
                  <Trash2
                    size={13}
                  />
                )}
              </button>
            </div>
          );
        }
      )}
    </div>

    {/* TOTAL */}
    <footer className="relative z-10 flex items-center justify-between border-t border-white/[0.07] bg-black/15 px-3 py-2">
      <span className="text-[9px] font-black text-zinc-500">
        Total {group.label.toLowerCase()}
      </span>

      <span className="text-[10px] font-black text-zinc-300">
        P{" "}
        {formatNumber(
          group.totals.proteina,
          1
        )}
        {" · C "}
        {formatNumber(
          group.totals.carbs,
          1
        )}
        {" · G "}
        {formatNumber(
          group.totals.grasas,
          1
        )}
      </span>
    </footer>

    <div className={`relative z-10 grid gap-2 border-t border-white/[0.06] px-3 py-2.5 ${group.entirelyFromSavedMeal ? "grid-cols-1" : "grid-cols-2"}`}>
      {!group.entirelyFromSavedMeal ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            autonomousActions?.onSaveMeal?.({
              id: group.id,
              name: group.label,
              type: String(group.id).toLowerCase() === "picoteo" ? "picoteo" : group.mealType,
              items: group.items,
              totals: group.totals,
            }, 0, {
              sourceKind: String(group.id).toLowerCase() === "picoteo" ? "picoteo" : "tracking",
              tags: ["tracking"],
            });
          }}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.06] px-2 text-[10px] font-black text-[#FFE8A3] transition active:scale-[0.98]"
        >
          <Save size={14} />
          Guardar comida
        </button>
      ) : null}
      <button
        type="button"
        disabled={deletingTrackingKey === `group-${group.id}`}
        onClick={(event) => {
          event.stopPropagation();
          deleteTrackingGroup(group);
        }}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-rose-300/15 bg-rose-300/[0.05] px-2 text-[10px] font-black text-rose-200/80 transition active:scale-[0.98] disabled:opacity-40"
      >
        {deletingTrackingKey === `group-${group.id}` ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
        Eliminar registro
      </button>
    </div>
  </div>
) : null}




        </article>
      );
})}
    </section>
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
  mealChoices = [],
  saving,
  canMarkMeals,
  onToggleMeal,
  onOpenMeal,
  canQuickEdit = false,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onDeleteManual,
}) {
  const mealChoiceActions = React.useContext(MealChoiceActionsContext);
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);

  const trackingMeal = baseMeal || meal;

  const foods = mealFoods(meal);
  const totals = mealTotals(meal);

  const manual =
    meal?.source === "manual_food";

  const visual = mealVisualStyle(
    meal,
    mealIndex,
    {
      done,
      generated,
      manual,
    }
  );

  const completedVisual =
    done || generated;

  const statusLabel = manual
    ? "Registrado"
    : generated
      ? "Generada"
      : done
        ? "Hecha"
        : "Pendiente";

  const StatusIcon = manual
    ? Utensils
    : generated
      ? Calculator
      : done
        ? CheckCircle2
        : Square;

  const statusClass = manual
    ? visual.status
    : completedVisual
      ? "border-emerald-300/45 bg-emerald-300/14 text-emerald-100 shadow-[0_0_16px_rgba(16,185,129,.22)]"
      : "border-white/10 bg-black/30 text-zinc-500";

  const [isExpanded, setIsExpanded] =
    useState(false);

  const detailPayload = {
    row,
    meal,
    baseMeal: trackingMeal,
    mealIndex,
    generated,
    manual,
  };

  const freePlannedMeal = isFreePlannedMenuMeal(row, trackingMeal);
  const dailyPlannedMeal = isDateScopedOwnMenuChoice(trackingChoice(row), row?.date);

  const canEditThisMeal =
    (canQuickEdit || dailyPlannedMeal) &&
    !manual &&
    !generated;
  const canDeleteAutomaticPlanning = autonomousActions?.hasAutomaticMenuPlanning === true
    && !manual
    && !generated;
  const canDeletePlanning = (canDeleteAutomaticPlanning || dailyPlannedMeal)
    && !manual
    && !generated;

  const activeChoiceIndex = Math.max(
    0,
    mealChoices.findIndex(
      (option) => option.active
    )
  );


  /* =====================================================
     CONTEXTO POR META
     ===================================================== */

  const targetExecution =
    menuTargetExecutionContext(
      row,
      meal,
      trackingMeal,
      mealIndex
    );

  /*
    Leemos el Tracking REAL del día.

    Los registros creados desde Por meta tienen
    un mealId especial:

    menu_target_...
  */
  const targetTrackingQuery =
    useTrackingDay(row?.date || "");

  const targetTrackedItems =
    React.useMemo(() => {
      const trackingMeals =
        targetTrackingQuery.data?.meals || {};

      const items =
        trackingMeals?.[
          targetExecution.id
        ];

      return Array.isArray(items)
        ? items
        : [];
    }, [
      targetTrackingQuery.data,
      targetExecution.id,
    ]);

      /*
    El modo Por meta puede estar activo aunque
    todavía no haya ningún alimento registrado.

    targetMealIds = estado persistido.
    targetTrackedItems = compatibilidad con registros
    que ya existen en Tracking.
  */
  const targetModePersisted =
    !manual &&
    !generated &&
    isMealTargetMode(
      row,
      trackingMeal,
      mealIndex
    );

  const targetModeActive =
    !manual &&
    !generated &&
    (
      targetModePersisted ||
      targetTrackedItems.length > 0
    );


  /* =====================================================
     HELPERS TRACKING POR META
     ===================================================== */

  function targetTrackingItemTotals(
    item = {}
  ) {
    const source =
      item?.totals ||
      item?.totales ||
      item ||
      {};

    return {
      kcal:
        Number(source.kcal) || 0,

      proteina:
        Number(
          source.proteina ??
          source.protein ??
          source.p
        ) || 0,

      carbs:
        Number(
          source.carbs ??
          source.carbohidratos ??
          source.c
        ) || 0,

      grasas:
        Number(
          source.grasas ??
          source.fat ??
          source.g
        ) || 0,
    };
  }

  function targetTrackingItemName(
    item = {}
  ) {
    return (
      item.nombreSnapshot ||
      item.name ||
      item.nombre ||
      item.food?.nombre ||
      item.food?.name ||
      "Alimento"
    );
  }

  function targetTrackingItemQuantity(
    item = {}
  ) {
    const value = Number(
      item.cantidad ??
      item.quantity
    );

    return Number.isFinite(value)
      ? value
      : 0;
  }

  function targetTrackingItemUnit(
    item = {}
  ) {
    return (
      item.unidad ||
      item.unit ||
      "g"
    );
  }


  const targetTrackedTotals =
    React.useMemo(() => {
      return targetTrackedItems.reduce(
        (acc, item) => {
          const itemTotals =
            targetTrackingItemTotals(
              item
            );

          return {
            kcal:
              acc.kcal +
              itemTotals.kcal,

            proteina:
              acc.proteina +
              itemTotals.proteina,

            carbs:
              acc.carbs +
              itemTotals.carbs,

            grasas:
              acc.grasas +
              itemTotals.grasas,
          };
        },
        {
          kcal: 0,
          proteina: 0,
          carbs: 0,
          grasas: 0,
        }
      );
    }, [targetTrackedItems]);


  const targetGoal =
    targetExecution.target || {
      kcal: 0,
      proteina: 0,
      carbs: 0,
      grasas: 0,
    };


  /*
    Por ahora consideramos que la comida está
    realmente en modo Por meta cuando existe
    al menos un alimento confirmado en Tracking.

    Más adelante podemos persistir también el
    modo aunque todavía haya 0 alimentos.
  */


  const targetRemaining = {
    kcal:
      Number(targetGoal.kcal || 0) -
      targetTrackedTotals.kcal,

    proteina: Math.max(
      0,
      Number(
        targetGoal.proteina || 0
      ) -
        targetTrackedTotals.proteina
    ),

    carbs: Math.max(
      0,
      Number(
        targetGoal.carbs || 0
      ) -
        targetTrackedTotals.carbs
    ),

    grasas: Math.max(
      0,
      Number(
        targetGoal.grasas || 0
      ) -
        targetTrackedTotals.grasas
    ),
  };


  const targetProgress =
    Number(targetGoal.kcal) > 0
      ? Math.round(
          (
            targetTrackedTotals.kcal /
            Number(targetGoal.kcal)
          ) * 100
        )
      : 0;


  const targetProgressWidth =
    Math.max(
      0,
      Math.min(
        100,
        targetProgress
      )
    );

  const targetCompleted = isMealTargetCalorieComplete({
    targetKcal: targetGoal.kcal,
    consumedKcal: targetTrackedTotals.kcal,
    trackedItemsCount: targetTrackedItems.length,
  });


  function toggleExpanded() {
    setIsExpanded(
      (value) => !value
    );
  }


  function handlePrimaryAction(event) {
    event.stopPropagation();

    if (manual) {
      onDeleteManual?.(
        row,
        manualEntry
      );

      return;
    }

    if (generated) return;

    onToggleMeal(
      row,
      trackingMeal,
      mealIndex
    );
  }


  function openMealDetail(
    event,
    action = "detail"
  ) {
    event.stopPropagation();

    onOpenMeal({
      ...detailPayload,
      action,
    });
  }


  function saveAsMeal(event) {
    event.stopPropagation();

    onSaveAsSavedMeal?.(
      meal,
      mealIndex
    );
  }


  function quickEditMeal(event) {
    event.stopPropagation();

    onQuickEditMeal?.(
      detailPayload
    );
  }


  /* =====================================================
     CARD ESPECIAL — POR META ACTIVO
     ===================================================== */

  if (targetModeActive) {
    return (
      <article
        className="
          zf-meal-card
          zf-meal-card--target
          relative
          overflow-hidden

          rounded-[1.05rem]

          border
          border-teal-300/35

          bg-black

          p-[1px]

          ring-1
          ring-teal-300/10

          shadow-[0_16px_38px_rgba(0,0,0,.34),0_0_24px_rgba(45,212,191,.08)]

          transition
        "
      >
        <div
          className="zf-meal-card__surface
            relative
            overflow-hidden

            rounded-[calc(1.05rem-1px)]

            bg-[radial-gradient(circle_at_0_0,rgba(45,212,191,.10),transparent_40%),linear-gradient(180deg,rgba(9,25,27,.98),rgba(7,15,18,.98))]

            p-3
          "
        >

          {/* HAZE */}

          <span
            className="
              pointer-events-none
              absolute
              inset-0

              bg-[radial-gradient(circle_at_95%_0,rgba(45,212,191,.10),transparent_35%)]
            "
            aria-hidden="true"
          />


          {/* RAIL */}

          <span
            className="
              pointer-events-none

              absolute
              inset-y-2
              left-0

              w-1

              rounded-r-full

              bg-gradient-to-b
              from-teal-200
              via-teal-400
              to-cyan-500

              shadow-[0_0_20px_rgba(45,212,191,.55)]
            "
            aria-hidden="true"
          />


          {/* HEADER CARD */}

          <div className="zf-meal-card__header relative z-10 flex items-center gap-2.5">

            <button
              type="button"
              onClick={toggleExpanded}
              aria-expanded={
                isExpanded
              }
              className="
                grid
                min-w-0
                flex-1

                grid-cols-[48px_minmax(0,1fr)]

                items-center
                gap-3

                text-left

                active:scale-[0.995]
              "
            >

              <MealTypeIcon
                meal={trackingMeal}
                index={mealIndex}
                done={targetCompleted}
                size="md"
              />


              <span className="min-w-0">

                <span className="flex min-w-0 items-baseline gap-2">

                  <span className="min-w-0 truncate text-[16px] font-black leading-tight tracking-[-0.01em] text-white">
                    {targetExecution.label}
                  </span>

                  <span className="shrink-0 text-[12px] font-black text-[#FFE16B]">
                    {displayKcal(
                      targetGoal.kcal
                    )}
                  </span>

                </span>


                {/* BADGE */}

                <span className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">

                  <span
                    className="
                      inline-flex
                      min-h-5
                      items-center
                      gap-1

                      rounded-full

                      border
                      border-teal-300/30

                      bg-teal-300/10

                      px-2

                      text-[9px]
                      font-black
                      uppercase
                      tracking-wide
                      text-teal-100
                    "
                  >
                    <Target
                      size={12}
                      strokeWidth={2.6}
                    />

                    Por meta
                  </span>


                  <span
                    className="
                      inline-flex
                      min-h-5
                      items-center

                      rounded-full

                      border
                      border-white/10

                      bg-black/25

                      px-2

                      text-[9px]
                      font-black
                      text-zinc-300
                    "
                  >
                    {targetCompleted ? "Hecha" : "En progreso"}
                  </span>

                </span>


                {/* RESUMEN COLAPSADO */}

                {!isExpanded ? (
                  <span className="mt-2 block">

                    <span className="block text-[11px] font-black text-zinc-200">
                      {formatNumber(
                        targetTrackedTotals.kcal,
                        0
                      )}{" "}
                      /{" "}
                      {formatNumber(
                        targetGoal.kcal,
                        0
                      )}{" "}
                      kcal
                    </span>

                    <span className="mt-1 block text-[10px] font-bold text-zinc-500">
                      {targetCompleted
                        ? "Meta alcanzada"
                        : targetRemaining.kcal >= 0
                        ? `Restan ${formatNumber(
                            targetRemaining.kcal,
                            0
                          )} kcal`
                        : `+${formatNumber(
                            Math.abs(
                              targetRemaining.kcal
                            ),
                            0
                          )} kcal sobre la meta`}
                    </span>


                    {/* BARRA */}

                    <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/10">

                      <span
                        className="
                          block
                          h-full

                          rounded-full

                          bg-teal-300

                          transition-all
                        "
                        style={{
                          width: `${targetProgressWidth}%`,
                        }}
                      />

                    </span>

                  </span>
                ) : null}

              </span>

            </button>


            {/* ACCIONES DERECHA */}

            <div className="zf-meal-card__actions flex shrink-0 items-center gap-1.5">

              {/* ABRIR POR META */}

              <button
                type="button"
                onClick={(event) =>
                  openMealDetail(
                    event,
                    "target"
                  )
                }
                className="
                  grid
                  h-9
                  w-9
                  shrink-0
                  place-items-center

                  rounded-full

                  border
                  border-teal-300/35

                  bg-teal-300/10

                  text-teal-100

                  shadow-[0_0_16px_rgba(45,212,191,.12)]

                  transition

                  active:scale-[0.96]
                "
                aria-label="Abrir registro por meta"
                title="Abrir Por meta"
              >
                {targetCompleted ? (
                  <CheckCircle2 size={17} strokeWidth={2.3} />
                ) : (
                  <Target size={17} strokeWidth={2.3} />
                )}
              </button>

              {canDeletePlanning ? (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    autonomousActions?.onDeleteAutomaticMenuMeal?.(
                      row,
                      trackingMeal,
                      mealIndex
                    );
                  }}
                  disabled={saving}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rose-300/30 bg-rose-300/[0.08] text-rose-200 transition active:scale-[0.96] disabled:opacity-45"
                  aria-label={`Eliminar planificación de ${targetExecution.label}`}
                  title="Eliminar planificación"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}


              {/* EXPANDIR */}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();

                  toggleExpanded();
                }}
                className="
                  grid
                  h-9
                  w-8
                  shrink-0
                  place-items-center

                  rounded-full

                  border
                  border-white/10

                  bg-black/20

                  text-zinc-400

                  transition

                  active:scale-[0.96]
                "
                aria-label={
                  isExpanded
                    ? "Contraer comida"
                    : "Expandir comida"
                }
                aria-expanded={
                  isExpanded
                }
              >
                {isExpanded ? (
                  <ChevronLeft
                    size={18}
                    className="rotate-90"
                  />
                ) : (
                  <ChevronRight
                    size={18}
                    className="rotate-90"
                  />
                )}
              </button>

            </div>

          </div>


          {/* =================================================
              EXPANDIDA POR META
              ================================================= */}

          {isExpanded ? (
            <div
              className="zf-meal-card__details
                relative
                z-10

                mt-3

                overflow-hidden

                rounded-[0.95rem]

                border
                border-teal-300/15

                bg-black/20

                p-3
              "
            >

              {/* OBJETIVO */}

              <div className="flex flex-wrap items-center gap-1.5">

                <MobileMealMacroChip
                  label="P"
                  value={
                    targetGoal.proteina
                  }
                />

                <MobileMealMacroChip
                  label="C"
                  value={
                    targetGoal.carbs
                  }
                />

                <MobileMealMacroChip
                  label="G"
                  value={
                    targetGoal.grasas
                  }
                />

              </div>


              {/* PROGRESO */}

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">

                <div className="flex items-center justify-between gap-2">

                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                    Consumido
                  </span>

                  <strong className="text-xs font-black text-white">
                    {formatNumber(
                      targetTrackedTotals.kcal,
                      0
                    )}{" "}
                    /{" "}
                    {formatNumber(
                      targetGoal.kcal,
                      0
                    )}{" "}
                    kcal
                  </strong>

                </div>


                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">

                  <span
                    className="
                      block
                      h-full

                      rounded-full

                      bg-teal-300

                      transition-all
                    "
                    style={{
                      width: `${targetProgressWidth}%`,
                    }}
                  />

                </div>


                <div className="mt-2 flex items-center justify-between gap-2">

                  <span className="text-[10px] font-black text-teal-200">
                    {targetProgress}%
                  </span>

                  <span className="text-[10px] font-bold text-zinc-500">

                    {targetRemaining.kcal >=
                    0
                      ? `Restan ${formatNumber(
                          targetRemaining.kcal,
                          0
                        )} kcal`
                      : `+${formatNumber(
                          Math.abs(
                            targetRemaining.kcal
                          ),
                          0
                        )} kcal`}

                  </span>

                </div>

              </div>


              {/* ALIMENTOS REALES */}

              <div className="mt-3">

                <div className="mb-2 flex items-center justify-between">

                  <span className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                    Registrado
                  </span>

                  <span className="text-[9px] font-black text-teal-300">
                    Tracking real
                  </span>

                </div>


                <div className="grid gap-1.5">

                  {targetTrackedItems.map(
                    (item, itemIndex) => {
                      const itemTotals =
                        targetTrackingItemTotals(
                          item
                        );

                      const quantity =
                        targetTrackingItemQuantity(
                          item
                        );

                      const unit =
                        targetTrackingItemUnit(
                          item
                        );

                      return (
                        <div
                          key={
                            item?.id ||
                            item?._id ||
                            `${targetExecution.id}-${itemIndex}`
                          }
                          className="
                            flex
                            min-w-0
                            items-center
                            gap-2

                            rounded-2xl

                            border
                            border-white/[0.07]

                            bg-white/[0.035]

                            px-2.5
                            py-2
                          "
                        >

                          <span
                            className="
                              grid
                              h-9
                              w-9
                              shrink-0
                              place-items-center

                              rounded-xl

                              border
                              border-teal-300/15

                              bg-teal-300/[0.07]

                              text-teal-200
                            "
                          >
                            <CheckCircle2
                              size={15}
                            />
                          </span>


                          <span className="min-w-0 flex-1">

                            <span className="block truncate text-[12px] font-black text-zinc-100">
                              {targetTrackingItemName(
                                item
                              )}
                            </span>

                            <span className="mt-0.5 block truncate text-[10px] font-bold text-zinc-500">
                              {formatNumber(
                                itemTotals.kcal,
                                0
                              )}{" "}
                              kcal
                            </span>

                          </span>


                          <span
                            className="
                              shrink-0

                              rounded-full

                              border
                              border-teal-300/20

                              bg-teal-300/[0.07]

                              px-2
                              py-1

                              text-[10px]
                              font-black
                              text-teal-100
                            "
                          >
                            {formatNumber(
                              quantity,
                              Number.isInteger(
                                quantity
                              )
                                ? 0
                                : 1
                            )}{" "}
                            {unit}
                          </span>

                        </div>
                      );
                    }
                  )}

                </div>

              </div>


              {/* RESTANTE */}

              <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 px-3 py-2.5">

                <span className="block text-[9px] font-black uppercase tracking-wide text-zinc-500">
                  {targetRemaining.kcal >=
                  0
                    ? "Restante"
                    : "Sobre la meta"}
                </span>

                <strong
                  className={`mt-1 block text-sm font-black ${
                    targetRemaining.kcal >=
                    0
                      ? "text-white"
                      : "text-rose-200"
                  }`}
                >
                  {targetRemaining.kcal >=
                  0
                    ? `${formatNumber(
                        targetRemaining.kcal,
                        0
                      )} kcal`
                    : `+${formatNumber(
                        Math.abs(
                          targetRemaining.kcal
                        ),
                        0
                      )} kcal`}
                </strong>


                <span className="mt-1 block text-[10px] font-bold text-zinc-500">
                  P{" "}
                  {formatNumber(
                    targetRemaining.proteina,
                    0
                  )}{" "}
                  g · C{" "}
                  {formatNumber(
                    targetRemaining.carbs,
                    0
                  )}{" "}
                  g · G{" "}
                  {formatNumber(
                    targetRemaining.grasas,
                    0
                  )}{" "}
                  g
                </span>

              </div>


              {/* BOTONES */}

              <div className="mt-3 grid grid-cols-2 gap-2">

                <button
                  type="button"
                  onClick={(event) =>
                    openMealDetail(
                      event,
                      "target"
                    )
                  }
                  className="
                    inline-flex
                    min-h-11
                    items-center
                    justify-center
                    gap-2

                    rounded-2xl

                    border
                    border-teal-300/30

                    bg-teal-300/10

                    px-3

                    text-xs
                    font-black
                    text-teal-100
                  "
                >
                  <Target size={15} />

                  Abrir Por meta
                </button>


                <button
                  type="button"
                  onClick={(event) =>
                    openMealDetail(
                      event,
                      "detail"
                    )
                  }
                  className="
                    inline-flex
                    min-h-11
                    items-center
                    justify-center
                    gap-2

                    rounded-2xl

                    border
                    border-white/10

                    bg-white/[0.04]

                    px-3

                    text-xs
                    font-black
                    text-zinc-300
                  "
                >
                  <Eye size={15} />

                  Ver propuesta
                </button>

              </div>

            </div>
          ) : null}

        </div>
      </article>
    );
  }


  /* =====================================================
     CARD NORMAL ORIGINAL
     ===================================================== */

  return (
    <article
      className={`zf-meal-card zf-meal-card--planned relative overflow-hidden rounded-[1.05rem] border transition ${visual.frame} ${
        completedVisual
          ? "ring-1 ring-emerald-300/25"
          : "ring-1 ring-white/[0.035]"
      }`}
    >
      <div
        className={`zf-meal-card__surface relative overflow-hidden rounded-[1.05rem] p-3 ${visual.card}`}
      >

        <span
          className={`pointer-events-none absolute inset-0 ${visual.haze}`}
          aria-hidden="true"
        />

        {completedVisual ? (
          <span
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_92%_8%,rgba(52,211,153,.10),transparent_34%)]"
            aria-hidden="true"
          />
        ) : null}

        <span
          className={`pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full ${visual.rail}`}
          aria-hidden="true"
        />


        {mealChoices.length > 1 ? (
          <MealChoiceNavigator
            options={mealChoices}
            activeIndex={activeChoiceIndex}
            disabled={saving}
            onSelect={(option) =>
              mealChoiceActions?.select?.(
                row,
                trackingMeal,
                mealIndex,
                option
              )
            }
          />
        ) : null}


        <div className="zf-meal-card__header relative z-10 flex items-center gap-2.5">

          <button
            type="button"
            onClick={toggleExpanded}
            aria-expanded={
              isExpanded
            }
            className="grid min-w-0 flex-1 grid-cols-[48px_minmax(0,1fr)] items-center gap-2.5 text-left active:scale-[0.995]"
          >

            <MealTypeIcon
              meal={meal}
              index={mealIndex}
              done={completedVisual}
              size="md"
            />

            <span className="min-w-0">

              <span className="flex min-w-0 items-baseline gap-2">

                <span className="min-w-0 truncate text-[16px] font-black leading-tight tracking-[-0.01em] text-white first-letter:uppercase">
                  {mealName(
                    meal,
                    mealIndex
                  )}
                </span>

                <span
                  className={`shrink-0 text-[12px] font-black ${visual.kcalText}`}
                >
                  {displayKcal(
                    totals.kcal
                  )}
                </span>

              </span>


              <span className="mt-1.5 flex min-h-[30px] min-w-0 items-center gap-2">

                <span
                  className={`inline-flex min-h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[9px] font-black uppercase tracking-wide ${statusClass}`}
                >
                  <StatusIcon
                    size={10}
                    strokeWidth={2.6}
                  />

                  {statusLabel}
                </span>

                {!isExpanded ? (
                  <MobileFoodThumbStack
                    foods={foods}
                    compact
                    maxVisible={3}
                  />
                ) : null}

              </span>


              {generatedEntry?.replacesMealNames
                ?.length &&
              isExpanded ? (

                <span className="mt-1 block truncate text-[11px] font-black text-emerald-200/90">
                  Reemplaza{" "}
                  {generatedEntry.replacesMealNames.join(
                    " + "
                  )}
                </span>

              ) : null}

            </span>

          </button>


          <div className="zf-meal-card__actions flex shrink-0 items-center gap-1.5">

            <button
              type="button"
              disabled={
                manual
                  ? saving
                  : generated ||
                    !canMarkMeals ||
                    saving
              }
              onClick={
                handlePrimaryAction
              }
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border text-xs font-black transition active:scale-[0.96] disabled:opacity-50 ${
                manual
                  ? "border-rose-300/35 bg-rose-400/10 text-rose-100"
                  : completedVisual
                    ? `${visual.doneButton}`
                    : "border-white/15 bg-black/35 text-zinc-500"
              }`}
              aria-pressed={
                manual
                  ? undefined
                  : done
              }
              aria-label={
                manual
                  ? "Eliminar registro manual"
                  : generated
                    ? "Comida generada para esta semana"
                    : done
                      ? "Comida completa"
                      : "Marcar comida completa"
              }
            >

              {manual ? (
                <Trash2 size={16} />
              ) : generated ? (
                <Calculator
                  size={16}
                />
              ) : done ? (
                <CheckCircle2
                  size={18}
                />
              ) : (
                <Square size={16} />
              )}

            </button>


            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();

                toggleExpanded();
              }}
              className="grid h-9 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-black/20 text-zinc-400 transition active:scale-[0.96]"
              aria-label={
                isExpanded
                  ? "Contraer comida"
                  : "Expandir comida"
              }
              aria-expanded={
                isExpanded
              }
            >
              {isExpanded ? (
                <ChevronLeft
                  size={18}
                  className="rotate-90"
                />
              ) : (
                <ChevronRight
                  size={18}
                  className="rotate-90"
                />
              )}
            </button>

          </div>

        </div>


        {!isExpanded ? (
          <div className="zf-meal-card__macro-strip relative z-10 mt-3 grid grid-cols-4 gap-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-2">
            <span className="grid min-w-0 gap-0.5 border-r border-white/[0.07] pr-1.5">
              <small className="text-[7px] font-black uppercase tracking-wide text-zinc-500">Planificado</small>
              <strong className={`truncate text-[10px] font-black ${visual.kcalText}`}>
                {displayKcal(totals.kcal)}
              </strong>
            </span>
            <span className="grid min-w-0 gap-0.5 border-r border-white/[0.07] px-1.5">
              <small className="text-[7px] font-black uppercase tracking-wide text-zinc-500">Proteína</small>
              <strong className="truncate text-[10px] font-black text-emerald-200">
                {formatNumber(totals.proteina, 1)} g
              </strong>
            </span>
            <span className="grid min-w-0 gap-0.5 border-r border-white/[0.07] px-1.5">
              <small className="text-[7px] font-black uppercase tracking-wide text-zinc-500">Carbos</small>
              <strong className="truncate text-[10px] font-black text-sky-200">
                {formatNumber(totals.carbs, 1)} g
              </strong>
            </span>
            <span className="grid min-w-0 gap-0.5 pl-1.5">
              <small className="text-[7px] font-black uppercase tracking-wide text-zinc-500">Grasas</small>
              <strong className="truncate text-[10px] font-black text-violet-200">
                {formatNumber(totals.grasas, 1)} g
              </strong>
            </span>
          </div>
        ) : null}


        {isExpanded ? (
          <div className="zf-meal-card__details relative z-10 mt-3 overflow-hidden rounded-[0.95rem] border border-white/10 bg-black/20 p-3 opacity-100 transition-[max-height,opacity] duration-200 ease-out">

            <div className="flex flex-wrap items-center gap-1.5">

              <MobileMealMacroChip
                label="P"
                value={
                  totals.proteina
                }
              />

              <MobileMealMacroChip
                label="C"
                value={totals.carbs}
              />

              <MobileMealMacroChip
                label="G"
                value={totals.grasas}
              />

            </div>


            <div className="mt-3 grid gap-1.5">

              {foods.length ? (
                foods.map(
                  (
                    food,
                    foodIndex
                  ) => {
                    const macroDetail =
                      foodMacroLine(
                        food
                      );

                    return (
                      <div
                        key={`${food.id}-${foodIndex}`}
                        className="flex min-w-0 items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.035] px-2.5 py-2"
                      >

                        <FoodThumb
                          food={food}
                          size="sm"
                        />

                        <span className="min-w-0 flex-1">

                          <span className="block truncate text-[13px] font-black text-zinc-100">
                            {food.name}
                          </span>

                          {macroDetail ? (
                            <span className="mt-0.5 block truncate text-[11.5px] font-bold text-zinc-500">
                              {macroDetail}
                            </span>
                          ) : null}

                        </span>


                        <span className="shrink-0 rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-2 py-1 text-[11px] font-black text-[#FFE8A3]">
                          {food.amount ||
                            "s/d"}
                        </span>

                      </div>
                    );
                  }
                )
              ) : (

                <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] px-3 py-3 text-sm font-bold text-zinc-500">
                  Todavia no agregaste alimentos.
                </div>

              )}

            </div>


            <div className="mt-3 grid gap-2">

              {canEditThisMeal ? (
                <button
                  type="button"
                  onClick={
                    quickEditMeal
                  }
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/10 px-3 text-xs font-black text-emerald-100 disabled:opacity-55"
                >

                  {foods.length ? (
                    <PencilLine
                      size={15}
                    />
                  ) : (
                    <Plus size={15} />
                  )}

                  {foods.length
                    ? "Editar alimentos"
                    : "Agregar alimentos"}

                </button>
              ) : null}

              {canDeletePlanning ? (
                <button
                  type="button"
                  onClick={() => autonomousActions?.onDeleteAutomaticMenuMeal?.(row, trackingMeal, mealIndex)}
                  disabled={saving}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] px-3 text-xs font-black text-rose-100 disabled:opacity-55"
                >
                  <Trash2 size={15} />
                  {freePlannedMeal ? "Eliminar planificación" : "Eliminar comida"}
                </button>
              ) : null}


              {dailyPlannedMeal ? (
                onSaveAsSavedMeal ? (
                  <button
                    type="button"
                    onClick={saveAsMeal}
                    disabled={saving || !foods.length}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] px-3 text-xs font-black text-emerald-100 disabled:opacity-40"
                  >
                    <Save size={15} />
                    Guardar en Mis comidas
                  </button>
                ) : null
              ) : (
              <MealCompactActions
                onDetail={(event) =>
                  openMealDetail(
                    event,
                    "detail"
                  )
                }

                onReplace={(event) =>
                  openMealDetail(
                    event,
                    "replace"
                  )
                }

                onSettings={(event) =>
                  openMealDetail(
                    event,
                    "settings"
                  )
                }

                onTarget={(event) =>
                  openMealDetail(
                    event,
                    "target"
                  )
                }

                onSave={
                  onSaveAsSavedMeal
                    ? saveAsMeal
                    : null
                }

                canReplace={
                  !manual &&
                  !generated
                }

                canConfigure={
                  !manual &&
                  !generated
                }

                canUseTarget={
                  !manual &&
                  !generated &&
                  !done
                }

                saveDisabled={
                  saving ||
                  !foods.length
                }
              />
              )}

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

function personalTargetCardVisual(meal = {}, index = 0) {
  const type = mealIconType(meal, index);
  const styles = {
    breakfast: {
      frame: "border-amber-300/45 shadow-[0_0_28px_rgba(245,158,11,.16),0_18px_36px_rgba(0,0,0,.38)]",
      surface: "bg-[radial-gradient(circle_at_4%_12%,rgba(245,158,11,.19),transparent_34%),linear-gradient(145deg,rgba(24,20,6,.98),rgba(6,13,17,.99)_62%)]",
      icon: "border-amber-300/45 bg-[radial-gradient(circle_at_50%_45%,rgba(251,191,36,.25),transparent_62%),rgba(245,158,11,.08)] text-amber-200 shadow-[0_0_24px_rgba(245,158,11,.28)]",
      accent: "text-amber-200",
      badge: "border-amber-300/30 bg-amber-300/10 text-amber-100",
      progress: "bg-gradient-to-r from-amber-400 via-yellow-300 to-yellow-200 shadow-[0_0_12px_rgba(250,204,21,.45)]",
      panel: "border-amber-300/16 bg-amber-300/[0.035]",
    },
    lunch: {
      frame: "border-violet-300/45 shadow-[0_0_28px_rgba(168,85,247,.17),0_18px_36px_rgba(0,0,0,.38)]",
      surface: "bg-[radial-gradient(circle_at_4%_12%,rgba(168,85,247,.20),transparent_34%),linear-gradient(145deg,rgba(25,12,38,.98),rgba(7,11,19,.99)_62%)]",
      icon: "border-violet-300/45 bg-[radial-gradient(circle_at_50%_45%,rgba(192,132,252,.25),transparent_62%),rgba(139,92,246,.09)] text-violet-200 shadow-[0_0_24px_rgba(168,85,247,.30)]",
      accent: "text-violet-200",
      badge: "border-violet-300/30 bg-violet-300/10 text-violet-100",
      progress: "bg-gradient-to-r from-violet-500 via-fuchsia-400 to-violet-300 shadow-[0_0_12px_rgba(192,132,252,.42)]",
      panel: "border-violet-300/16 bg-violet-300/[0.035]",
    },
    snack: {
      frame: "border-fuchsia-300/40 shadow-[0_0_28px_rgba(232,121,249,.15),0_18px_36px_rgba(0,0,0,.38)]",
      surface: "bg-[radial-gradient(circle_at_4%_12%,rgba(232,121,249,.18),transparent_34%),linear-gradient(145deg,rgba(32,12,31,.98),rgba(7,11,18,.99)_62%)]",
      icon: "border-fuchsia-300/40 bg-fuchsia-300/10 text-fuchsia-100 shadow-[0_0_24px_rgba(232,121,249,.25)]",
      accent: "text-fuchsia-200",
      badge: "border-fuchsia-300/30 bg-fuchsia-300/10 text-fuchsia-100",
      progress: "bg-gradient-to-r from-fuchsia-500 via-pink-400 to-fuchsia-300 shadow-[0_0_12px_rgba(232,121,249,.40)]",
      panel: "border-fuchsia-300/16 bg-fuchsia-300/[0.035]",
    },
    dinner: {
      frame: "border-sky-300/45 shadow-[0_0_28px_rgba(56,189,248,.16),0_18px_36px_rgba(0,0,0,.38)]",
      surface: "bg-[radial-gradient(circle_at_4%_12%,rgba(59,130,246,.20),transparent_34%),linear-gradient(145deg,rgba(8,22,43,.98),rgba(5,11,19,.99)_62%)]",
      icon: "border-sky-300/45 bg-[radial-gradient(circle_at_50%_45%,rgba(125,211,252,.22),transparent_62%),rgba(59,130,246,.09)] text-sky-100 shadow-[0_0_24px_rgba(56,189,248,.28)]",
      accent: "text-sky-200",
      badge: "border-sky-300/30 bg-sky-300/10 text-sky-100",
      progress: "bg-gradient-to-r from-blue-500 via-sky-400 to-cyan-300 shadow-[0_0_12px_rgba(56,189,248,.42)]",
      panel: "border-sky-300/16 bg-sky-300/[0.035]",
    },
    meal: {
      frame: "border-teal-300/40 shadow-[0_0_28px_rgba(45,212,191,.15),0_18px_36px_rgba(0,0,0,.38)]",
      surface: "bg-[radial-gradient(circle_at_4%_12%,rgba(45,212,191,.17),transparent_34%),linear-gradient(145deg,rgba(5,28,29,.98),rgba(5,12,18,.99)_62%)]",
      icon: "border-teal-300/40 bg-teal-300/10 text-teal-100 shadow-[0_0_24px_rgba(45,212,191,.25)]",
      accent: "text-teal-200",
      badge: "border-teal-300/30 bg-teal-300/10 text-teal-100",
      progress: "bg-gradient-to-r from-teal-500 via-teal-300 to-cyan-200 shadow-[0_0_12px_rgba(45,212,191,.42)]",
      panel: "border-teal-300/16 bg-teal-300/[0.035]",
    },
  };
  return styles[type] || styles.meal;
}

function PersonalTargetMealIcon({ meal = {}, index = 0, visual }) {
  const type = mealIconType(meal, index);
  const icons = { breakfast: Sunrise, lunch: Sun, snack: Apple, dinner: MoonStar, meal: Utensils };
  const Icon = icons[type] || Utensils;
  return (
    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[.9rem] border ${visual.icon}`}>
      <Icon className="h-[22px] w-[22px]" strokeWidth={1.9} />
    </span>
  );
}

function PersonalTargetNutritionPanel({
  label,
  totals = {},
  visual,
  remaining = false,
  registered = false,
  overageReview = null,
}) {
  const hasOverage = remaining && (overageReview
    ? overageReview.hasNotice === true
    : ["kcal", "proteina", "carbs", "grasas"].some((key) => Number(totals?.[key]) < -0.05));
  const exceededKeys = new Set(overageReview?.exceededKeys || []);
  const rawKcal = Number(totals.kcal) || 0;
  const kcalExceeded = remaining && rawKcal < 0 && (overageReview
    ? exceededKeys.has("kcal")
    : rawKcal < -0.05);
  const displayedKcal = remaining && rawKcal < 0
    ? kcalExceeded ? Math.abs(rawKcal) : 0
    : Math.abs(rawKcal);
  const kcalTone = kcalExceeded
    ? "text-sky-200"
    : registered
      ? "text-emerald-200"
      : remaining
        ? "text-teal-200"
        : visual.accent;

  return (
    <div className="zf-meal-card__macro-strip grid min-w-0 grid-cols-4 gap-1.5 rounded-xl border border-white/[0.07] bg-black/20 p-2">
      <span className="grid min-w-0 gap-0.5 border-r border-white/[0.07] pr-1.5">
        <small className="truncate text-[8px] font-black uppercase tracking-wide text-zinc-500">{hasOverage ? "Revisar" : label}</small>
        <strong className={`truncate text-[11px] font-black tabular-nums ${kcalTone}`}>
          {kcalExceeded ? "+" : ""}{formatNumber(displayedKcal, 0)} kcal
        </strong>
      </span>
      {[
        ["proteina", "Proteína", totals.proteina, "text-emerald-200"],
        ["carbs", "Carbos", totals.carbs, "text-sky-200"],
        ["grasas", "Grasas", totals.grasas, "text-amber-200"],
      ].map(([key, macroLabel, value, tone]) => {
        const rawValue = Number(value) || 0;
        const exceeded = remaining && rawValue < 0 && (overageReview
          ? exceededKeys.has(key)
          : rawValue < -0.05);
        const displayedValue = remaining && rawValue < 0
          ? exceeded ? Math.abs(rawValue) : 0
          : Math.abs(rawValue);
        return (
          <span key={macroLabel} className="grid min-w-0 gap-0.5 border-r border-white/[0.07] px-1.5 last:border-r-0 last:pr-0">
            <small className="truncate text-[8px] font-black uppercase tracking-wide text-zinc-500">{macroLabel}</small>
            <strong className={`truncate text-[11px] font-black tabular-nums ${exceeded ? "text-sky-200" : tone}`}>
              {exceeded ? "+" : ""}{formatNumber(displayedValue, 1)} g
            </strong>
          </span>
        );
      })}
    </div>
  );
}

function PersonalTargetMacroProgress({ macroKey, label, target = 0, consumed = 0, overageReview = null }) {
  const goal = Math.max(0, Number(target) || 0);
  const actual = Math.max(0, Number(consumed) || 0);
  const percent = goal > 0 ? Math.min(100, Math.round((actual / goal) * 100)) : 0;
  const exceeded = (overageReview?.exceededKeys || []).includes(macroKey);
  const excess = Math.max(0, actual - goal);
  const tones = {
    proteina: { text: "text-teal-200", badge: "border-teal-300/25 bg-teal-300/10 text-teal-200", bar: "bg-teal-300" },
    carbs: { text: "text-fuchsia-200", badge: "border-fuchsia-300/25 bg-fuchsia-300/10 text-fuchsia-200", bar: "bg-fuchsia-300" },
    grasas: { text: "text-amber-200", badge: "border-amber-300/25 bg-amber-300/10 text-amber-200", bar: "bg-amber-300" },
  };
  const tone = tones[macroKey] || tones.proteina;

  return (
    <div className="min-w-0 px-2 first:pl-0 last:pr-0 min-[390px]:px-3">
      <div className="flex min-w-0 items-center gap-1">
        <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-[5px] border text-[8px] font-black ${tone.badge}`}>{label}</span>
        <strong className="min-w-0 whitespace-nowrap text-[9px] font-black text-zinc-100 min-[390px]:text-[10px]">
          <span className={tone.text}>{formatNumber(actual, Number.isInteger(actual) ? 0 : 1)}</span>
          <span className="text-zinc-600"> / </span>
          {formatNumber(goal, Number.isInteger(goal) ? 0 : 1)} g
        </strong>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
        <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${percent}%` }} />
      </div>
      {exceeded ? (
        <span className="mt-1.5 inline-flex rounded-md border border-sky-300/25 bg-sky-300/[0.08] px-1.5 py-0.5 text-[8px] font-black text-sky-200">
          ↑ +{formatNumber(excess, 1)} g
        </span>
      ) : null}
    </div>
  );
}






function PlannedMealTargetCard({
  row,
  meal,
  mealIndex,
  disabled,
  plannedComposition = null,
  onEditPlanned,
  onSettings,
  onEditTarget,
  onDeleteTarget,
  onToggleTargetConfirmed,
  onManage,
  onAddFood,
  onGenerate,
}) {
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);
  const [expanded, setExpanded] =
    useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [plannedConsumptionOpen, setPlannedConsumptionOpen] = useState(false);


  /*
   * =========================================
   * META / COMIDA
   * =========================================
   */

  /*
   * =========================================
   * MISMO ID QUE TRACKING
   * =========================================
   */

  const targetExecution =
    menuTargetExecutionContext(
      row || {},
      meal,
      meal,
      mealIndex
    );


  /*
   * =========================================
   * TRACKING REAL
   * =========================================
   */

  const trackingDate =
    row?.date ||
    todayIso();

  const trackingQuery =
    useTrackingDay(
      trackingDate
    );

  const trackingMeals =
    trackingQuery.data?.meals ||
    {};

  const consumptionSourceMealIds = [...new Set([
    targetExecution.id,
    ...(Array.isArray(meal?.consumptionSourceMealIds) ? meal.consumptionSourceMealIds : []),
  ].map(String).filter(Boolean))];
  const trackedItems = consumptionSourceMealIds.flatMap((sourceMealId) => (
    Array.isArray(trackingMeals[sourceMealId]) ? trackingMeals[sourceMealId] : []
  ));
  const plannedMeal = plannedComposition?.meal || null;
  const plannedFoods = plannedMeal ? mealFoods(plannedMeal) : [];
  const plannedTotals = plannedMeal ? mealTotals(plannedMeal) : emptyTotals();
  const hasPlannedComposition = plannedFoods.length > 0;


  /*
   * =========================================
   * TOTALES
   * =========================================
   */

  const trackedTotals = sumTotals(trackedItems);

  const target =
    totalFromLike(
      targetExecution.target ||
      meal?.target ||
      mealTotals(meal)
    );

  const hasTrackedItems = trackedItems.length > 0;
  const canRegisterPlannedComposition = hasPlannedComposition
    && !hasTrackedItems
    && typeof autonomousActions?.onRegisterPlannedTargetComposition === "function";
  const completionState = personalMealTargetCompletionState({
    target,
    consumed: trackedTotals,
    trackedItemsCount: trackedItems.length,
    metaConfirmed: meal?.metaConfirmed === true || meal?.confirmed === true,
    confirmation: meal?.metaConfirmation,
  });
  const mealCompleted = completionState.completed;
  const manuallyClosed = completionState.manual;
  const hasPendingPlannedComposition = hasPlannedComposition && !mealCompleted;

  const manualOverageReview = manualMealTargetOverageReview({
    target,
    consumed: trackedTotals,
  });
  const confirmationReview = personalMealTargetConfirmationReview(
    target,
    trackedTotals
  );

  /*
   * =========================================
   * RESTANTE
   * =========================================
   */

  const remaining = {
    kcal:
      target.kcal -
      trackedTotals.kcal,

    proteina:
      target.proteina -
      trackedTotals.proteina,

    carbs:
      target.carbs -
      trackedTotals.carbs,

    grasas:
      target.grasas -
      trackedTotals.grasas,
  };


  const exceeded =
    trackedTotals.kcal >
    target.kcal + 0.5;
  const consumedCaloriePercent = target.kcal > 0
    ? Math.max(0, Math.min(100, (trackedTotals.kcal / target.kcal) * 100))
    : 0;
  const trackedPreviewFoods = trackedItems.map((item, itemIndex) => ({
    id: item?.id || item?._id || `${targetExecution.id}-tracked-${itemIndex}`,
    name: trackingFoodName(item),
    imageUrl: trackingFoodImage(item),
    category: item?.food?.categoria || item?.food?.category || item?.categoria || item?.category || "",
  }));
  const collapsedPreviewFoods = hasTrackedItems ? trackedPreviewFoods : plannedFoods;
  const collapsedPreviewLabel = hasTrackedItems
    ? `${trackedItems.length} ${trackedItems.length === 1 ? "consumido" : "consumidos"}`
    : hasPendingPlannedComposition
      ? `${plannedFoods.length} ${plannedFoods.length === 1 ? "planificado" : "planificados"}`
      : "Sin consumo";

  const statusLabel = completionState.manualStale
    ? "Revisar cierre"
    : mealCompleted
      ? "Hecha"
      : hasTrackedItems
        ? "En progreso"
        : "Sin registrar";

  const baseTargetVisual = personalTargetCardVisual(meal, mealIndex);
  const targetVisual = mealCompleted
    ? {
        ...baseTargetVisual,
        frame: "border-emerald-300/55 shadow-[0_0_30px_rgba(45,212,191,.17),0_18px_36px_rgba(0,0,0,.38)]",
        surface: "bg-[radial-gradient(circle_at_4%_12%,rgba(45,212,191,.20),transparent_34%),linear-gradient(145deg,rgba(5,31,29,.98),rgba(5,13,18,.99)_62%)]",
        icon: "border-emerald-300/50 bg-emerald-300/10 text-emerald-200 shadow-[0_0_24px_rgba(45,212,191,.28)]",
        accent: "text-emerald-200",
        badge: "border-emerald-300/35 bg-emerald-300/10 text-emerald-100",
        progress: "bg-[linear-gradient(90deg,#34d399,#86efac)] shadow-[0_0_12px_rgba(52,211,153,.35)]",
      }
    : baseTargetVisual;


  /*
   * =========================================
   * ICONO
   * =========================================
   */

  const handleCardClick = (
    event
  ) => {
    /*
     * Si toca un botón real,
     * no expandimos/colapsamos la card.
     */
    if (
      event.target?.closest?.(
        "button,a,input,select,textarea"
      )
    ) {
      return;
    }

    setExpanded(
      (current) => !current
    );
  };


  return (
    <article
      onClick={
        handleCardClick
      }

      className={`
        zf-meal-card
        zf-meal-card--target
        ${mealCompleted ? "is-complete" : hasTrackedItems ? "is-progress" : "is-empty"}
        relative
        overflow-hidden
        rounded-[1.15rem]

        border
        ${targetVisual.frame}
        ${targetVisual.surface}
      `}
    >

      <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent" aria-hidden="true" />

      {/* =====================================
          CABECERA
          ===================================== */}

      <div
        className="zf-meal-card__header
          grid
          grid-cols-[auto_minmax(0,1fr)_auto]
          items-start
          gap-2.5
          p-3
          min-[390px]:gap-3
        "
      >

        <PersonalTargetMealIcon
          meal={meal}
          index={mealIndex}
          visual={targetVisual}
        />


        <div className="min-w-0">

          {/* NOMBRE + KCAL */}

          <div
            className="
              flex
              min-w-0
              flex-wrap
              items-baseline
              gap-x-1.5
              gap-y-0.5
            "
          >

            <h4
              className="
                truncate
                text-[15px]
                font-black
                leading-tight
                text-white
                min-[390px]:text-[17px]
              "
            >
              {mealName(
                meal,
                mealIndex
              )}
            </h4>

            <strong
              className={`
                text-[11px]
                font-black
                min-[390px]:text-[12px]
                ${targetVisual.accent}
              `}
            >
              {formatNumber(
                target.kcal,
                0
              )} kcal
            </strong>

          </div>


          {/* BADGES */}

          <div
            className="
              mt-1
              flex
              flex-wrap
              items-center
              gap-1.5
            "
          >

            <span
              className={`
                inline-flex
                items-center
                gap-1

                rounded-full

                border
                px-2
                py-0.5

                text-[8.5px]
                font-black
                uppercase
                tracking-wide
                ${targetVisual.badge}
              `}
            >
              <Target
                size={10}
              />

              Por meta
            </span>

            {hasPendingPlannedComposition ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/25 bg-sky-300/[0.08] px-2 py-0.5 text-[8.5px] font-black text-sky-100">
                <ClipboardCheck size={10} />
                Planificada · {plannedFoods.length} {plannedFoods.length === 1 ? "alimento" : "alimentos"}
              </span>
            ) : null}


            {statusLabel !== "Sin registrar" ? (
            <span
              className={`
                inline-flex
                rounded-full
                border
                px-2
                py-0.5
                text-[8.5px]
                font-black

                ${
                  mealCompleted
                    ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-100"

                    : hasTrackedItems
                      ? "border-white/10 bg-white/[0.045] text-zinc-300"

                      : "border-white/10 bg-white/[0.035] text-zinc-400"
                }
              `}
            >
              {statusLabel}
            </span>
            ) : null}

          </div>

        </div>


        {/* =================================
            ACCIONES CABECERA
            ================================= */}

        <div
          className="zf-meal-card__actions
            flex
            shrink-0
            items-center
            gap-2
          "
        >

          <button
            type="button"
            onClick={onAddFood || onManage}
            disabled={disabled || manuallyClosed || !(onAddFood || onManage)}
            className={`zf-meal-card__action grid h-10 w-10 place-items-center rounded-full border transition active:scale-95 disabled:opacity-40 ${targetVisual.badge}`}
            aria-label={`Agregar alimento consumido a ${mealName(meal, mealIndex)}`}
            title={manuallyClosed ? "Reabrí la comida para modificar su consumo" : meal?.personalTargetOnly ? "Agregar alimento a tu meta" : "Agregar alimento a la meta del coach"}
          >
            <Plus size={16} strokeWidth={2.8} />
          </button>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (canRegisterPlannedComposition) {
                setPlannedConsumptionOpen(true);
                return;
              }
              if (completionState.manual) {
                onToggleTargetConfirmed?.();
                return;
              }
              if (completionState.automatic) return;
              setConfirmationOpen(true);
            }}
            disabled={disabled || (
              !canRegisterPlannedComposition
              && (!onToggleTargetConfirmed || completionState.automatic || (!completionState.manual && !hasTrackedItems))
            )}
            className={`zf-meal-card__action grid h-10 w-10 place-items-center rounded-full border transition active:scale-95 disabled:cursor-not-allowed ${
              mealCompleted
                ? "border-emerald-300/45 bg-emerald-300/15 text-emerald-200 shadow-[0_0_18px_rgba(52,211,153,.18)]"
                : completionState.manualStale
                  ? "border-amber-300/40 bg-amber-300/10 text-amber-200"
                : canRegisterPlannedComposition
                  ? "border-emerald-300/45 bg-emerald-300/12 text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,.13)] hover:bg-emerald-300/20"
                : hasTrackedItems
                  ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-200 hover:bg-emerald-300/20"
                  : "border-white/[0.07] bg-white/[0.035] text-zinc-700"
            }`}
            aria-label={canRegisterPlannedComposition ? `Marcar ${mealName(meal, mealIndex)} como realizada` : completionState.manual ? `Reabrir ${mealName(meal, mealIndex)}` : mealCompleted ? `${mealName(meal, mealIndex)} hecha automáticamente` : `Confirmar ${mealName(meal, mealIndex)}`}
            aria-pressed={mealCompleted}
            title={canRegisterPlannedComposition ? "Registrar los alimentos planificados como consumidos" : completionState.manual ? "Comida cerrada manualmente · tocar para reabrir" : completionState.automatic ? "Hecha automáticamente por estar dentro de ±10 kcal" : hasTrackedItems ? "Cerrar comida con el consumo registrado" : "Registrá alimentos para confirmar"}
          >
            <CheckCircle2 size={17} strokeWidth={2.5} />
          </button>

          <button
            type="button"

            onClick={() =>
              setExpanded(
                (current) =>
                  !current
              )
            }

            className="zf-meal-card__action
              grid
              h-10
              w-10
              place-items-center

              rounded-full

              border
              border-white/10

              bg-white/[0.04]

              text-zinc-200
            "

            aria-expanded={
              expanded
            }

            aria-label={
              expanded
                ? "Ocultar detalle"
                : "Ver detalle"
            }
          >
            {expanded ? (
              <ChevronUp
                size={16}
              />
            ) : (
              <ChevronDown
                size={16}
              />
            )}
          </button>

        </div>

      </div>

      {!expanded ? (
        <div className="zf-meal-card__progress mx-3 mb-2 rounded-xl border border-white/[0.07] bg-black/20 px-2.5 py-2" aria-label={`Progreso consumido de ${mealName(meal, mealIndex)}`}>
          <div className="flex min-w-0 items-center gap-2">
            {collapsedPreviewFoods.length ? (
              <MobileFoodThumbStack foods={collapsedPreviewFoods} compact maxVisible={4} />
            ) : (
              <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full border border-white/[0.08] bg-white/[0.035] text-zinc-600">
                <Utensils size={13} aria-hidden="true" />
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span className={`truncate text-[8.5px] font-black ${hasTrackedItems ? "text-emerald-200" : hasPendingPlannedComposition ? "text-sky-200" : "text-zinc-500"}`}>
                  {collapsedPreviewLabel}
                </span>
                <strong className={`shrink-0 text-[9px] font-black tabular-nums ${exceeded ? "text-rose-300" : hasTrackedItems ? "text-zinc-200" : "text-zinc-500"}`}>
                  {formatNumber(trackedTotals.kcal, 0)} / {formatNumber(target.kcal, 0)} kcal
                </strong>
              </span>
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.07] shadow-[inset_0_1px_2px_rgba(0,0,0,.7)]">
                <span
                  className={`zf-meal-card__progress-fill block h-full rounded-full ${exceeded ? "bg-gradient-to-r from-rose-700 via-rose-500 to-red-300" : targetVisual.progress}`}
                  style={{ width: `${consumedCaloriePercent}%` }}
                />
              </span>
            </span>
          </div>
        </div>
      ) : null}

      {!expanded && mealCompleted ? (
        <div
          className="mx-3 mb-3"
          aria-label={`Resumen consumido de ${mealName(meal, mealIndex)}`}
        >
          <PersonalTargetNutritionPanel
            label="Registrado"
            totals={trackedTotals}
            visual={targetVisual}
            registered
          />
        </div>
      ) : null}

      {!expanded && !mealCompleted ? (
        <div className="mx-3 mb-3 grid gap-2">
          <PersonalTargetNutritionPanel
            label="Restante"
            totals={remaining}
            visual={targetVisual}
            remaining
            overageReview={manualOverageReview}
          />
          {hasPendingPlannedComposition ? (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="flex min-h-11 items-center gap-2.5 rounded-xl border border-sky-300/20 bg-sky-300/[0.055] px-3 text-left"
            >
              <MobileFoodThumbStack foods={plannedFoods} compact maxVisible={3} />
              <span className="min-w-0 flex-1">
                <strong className="block text-[10px] font-black text-sky-100">Comida guardada planificada</strong>
                <span className="mt-0.5 block truncate text-[8.5px] font-bold text-zinc-500">
                  {formatNumber(plannedTotals.kcal, 0)} kcal · Todavía no cuenta como consumo
                </span>
              </span>
              <ChevronDown size={15} className="shrink-0 text-sky-200" />
            </button>
          ) : null}
        </div>
      ) : null}


      {/* =====================================
          DETALLE EXPANDIDO
          ===================================== */}

      {expanded ? (

        <div
          className="zf-meal-card__details
            border-t
            border-white/[0.08]

            px-3
            pb-3
            pt-3
          "
        >

          {hasPendingPlannedComposition ? (
            <section className="mb-3 rounded-2xl border border-sky-300/20 bg-sky-300/[0.045] p-3" aria-label="Planificación pendiente">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-[9px] font-black uppercase tracking-[.13em] text-sky-200">Planificación pendiente</span>
                  <p className="mt-1 text-[9px] font-bold leading-relaxed text-zinc-400">
                    Esta es la comida guardada que elegiste. No se suma como consumida hasta que la registres.
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-sky-300/20 bg-sky-300/[0.08] px-2 py-1 text-[9px] font-black text-sky-100">
                  {formatNumber(plannedTotals.kcal, 0)} kcal
                </span>
              </div>

              <div className="mt-3 grid gap-2">
                {plannedFoods.map((food, foodIndex) => (
                  <div
                    key={`${food.id}-${foodIndex}`}
                    className="flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 px-2.5 py-2"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-white/[0.09] bg-black/25">
                      {food.imageUrl ? (
                        <img src={food.imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <Apple size={15} className="text-zinc-500" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-[12px] font-black text-white">{food.name}</strong>
                      <span className="mt-0.5 block truncate text-[9.5px] font-bold text-zinc-500">{foodMacroLine(food)}</span>
                    </span>
                    <span className="shrink-0 rounded-full border border-sky-300/20 bg-sky-300/[0.08] px-2 py-1 text-[9px] font-black text-sky-100">
                      {food.amount || foodAmount(food.cantidad, food.unidad)}
                    </span>
                  </div>
                ))}
              </div>

              {canRegisterPlannedComposition ? (
                <button
                  type="button"
                  onClick={() => setPlannedConsumptionOpen(true)}
                  disabled={disabled}
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-[linear-gradient(110deg,rgba(45,224,178,.20),rgba(52,211,153,.10))] px-3 text-[10px] font-black text-emerald-100 shadow-[0_8px_24px_rgba(45,224,178,.10)] transition hover:bg-emerald-300/[0.18] active:scale-[0.99] disabled:opacity-45"
                >
                  <CheckCircle2 size={15} />
                  Marcar como realizada
                </button>
              ) : null}

              {onEditPlanned ? (
                <button
                  type="button"
                  onClick={onEditPlanned}
                  disabled={disabled}
                  className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-sky-300/30 bg-sky-300/[0.08] px-3 text-[10px] font-black text-sky-100 disabled:opacity-45"
                >
                  <PencilLine size={14} />
                  Editar alimentos planificados
                </button>
              ) : null}
            </section>
          ) : null}

          <section aria-label="Progreso de macronutrientes">
            <div className="mb-2 flex items-center gap-1.5 text-[8.5px] font-black uppercase tracking-[.16em] text-zinc-500">
              <span>Macros</span>
              <CircleAlert size={11} aria-hidden="true" />
            </div>
            <div className="grid grid-cols-3 divide-x divide-white/[0.08] rounded-xl border border-white/[0.08] bg-black/25 px-2 py-3">
              <PersonalTargetMacroProgress macroKey="proteina" label="P" target={target.proteina} consumed={trackedTotals.proteina} overageReview={manualOverageReview} />
              <PersonalTargetMacroProgress macroKey="carbs" label="C" target={target.carbs} consumed={trackedTotals.carbs} overageReview={manualOverageReview} />
              <PersonalTargetMacroProgress macroKey="grasas" label="G" target={target.grasas} consumed={trackedTotals.grasas} overageReview={manualOverageReview} />
            </div>
          </section>


          {/* =================================
              REGISTRADO
              ================================= */}

          <div
            className="
              mt-3
              flex
              items-center
              justify-between
              gap-3
            "
          >

            <span
              className="
                text-[9px]
                font-black
                uppercase
                tracking-wide
                text-zinc-500
              "
            >
              Registrado
            </span>


            <span
              className="
                text-[9px]
                font-black
                text-teal-300
              "
            >
              Tracking real
            </span>

          </div>


          {/* =================================
              ALIMENTOS
              ================================= */}

          {hasTrackedItems ? (

            <div
              className="
                mt-2
                grid
                gap-2
              "
            >

              {trackedItems.map(
                (
                  item,
                  itemIndex
                ) => {

                  const itemTotals =
                    totalFromLike(
                      item
                    );

                  const itemName =
                    item?.nombreSnapshot ||
                    item?.nombre ||
                    item?.name ||
                    "Alimento";

                  const quantity =
                    Number(
                      item?.cantidad ??
                      item?.quantity ??
                      0
                    );

                  const unit =
                    item?.unidad ||
                    item?.unit ||
                    "g";

                  const imageUrl =
                    trackingFoodImage(item);


                  return (
                    <div
                      key={
                        item?.id ||
                        item?._id ||
                        `${itemName}-${itemIndex}`
                      }

                      className="
                        relative
                        rounded-xl

                        border
                        border-white/[0.08]

                        bg-white/[0.035]

                        py-2.5
                        pl-[3.65rem]
                        pr-3
                      "
                    >

                      <span className="absolute left-2.5 top-2.5 grid h-9 w-9 place-items-center overflow-hidden rounded-xl border border-white/[0.09] bg-black/25">
                        {imageUrl ? (
                          <img src={imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                        ) : (
                          <Apple size={16} className="text-zinc-500" />
                        )}
                      </span>

                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                        "
                      >

                        <strong
                          className="
                            min-w-0
                            truncate
                            text-[13px]
                            font-black
                            text-white
                          "
                        >
                          {itemName}
                        </strong>


                        <span
                          className="
                            shrink-0

                            rounded-full

                            border
                            border-teal-300/25

                            bg-teal-300/10

                            px-2
                            py-1

                            text-[9px]
                            font-black
                            text-teal-100
                          "
                        >
                          {formatNumber(
                            quantity,
                            quantity % 1
                              ? 1
                              : 0
                          )}{" "}
                          {unit}
                        </span>

                      </div>


                      {/* KCAL + MACROS DEL ALIMENTO */}

                      <p
                        className="
                          mt-1
                          text-[10px]
                          font-bold
                          leading-relaxed
                          text-zinc-400
                        "
                      >
                        {formatNumber(
                          itemTotals.kcal,
                          0
                        )} kcal

                        {" · P "}

                        {formatNumber(
                          itemTotals.proteina,
                          1
                        )}

                        {" · C "}

                        {formatNumber(
                          itemTotals.carbs,
                          1
                        )}

                        {" · G "}

                        {formatNumber(
                          itemTotals.grasas,
                          1
                        )}
                      </p>

                    </div>
                  );
                }
              )}

            </div>

          ) : (

            <div
              className="
                mt-2
                rounded-xl

                border
                border-white/[0.07]

                bg-white/[0.025]

                px-3
                py-3

                text-[11px]
                font-bold
                text-zinc-500
              "
            >
              Todavía no registraste alimentos
              en esta comida.
            </div>

          )}


          {/* =================================
              RESTANTE
              ================================= */}

          <div
            className="
              hidden
              mt-3

              rounded-xl

              border
              border-white/10

              bg-black/20

              p-3
            "
          >

            <span
              className="
                text-[9px]
                font-black
                uppercase
                tracking-wide
                text-zinc-500
              "
            >
              {exceeded
                ? "Excedido"
                : "Restante"}
            </span>


            <strong
              className="
                mt-1
                block
                text-[18px]
                font-black
                text-white
              "
            >
              {formatNumber(
                Math.abs(
                  remaining.kcal
                ),
                0
              )} kcal
            </strong>


            <p
              className="
                mt-1
                text-[9px]
                font-bold
                leading-relaxed
                text-zinc-500
              "
            >
              P{" "}
              {formatNumber(
                remaining.proteina,
                1
              )}

              {" · C "}

              {formatNumber(
                remaining.carbs,
                1
              )}

              {" · G "}

              {formatNumber(
                remaining.grasas,
                1
              )}
            </p>

          </div>

          {hasTrackedItems && manualOverageReview.hasNotice ? (
            <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-sky-300/25 bg-sky-300/[0.06] px-3 py-2.5 text-sky-50" role="status" aria-live="polite">
              <CircleAlert className="mt-0.5 shrink-0 text-sky-300" size={16} />
              <div className="min-w-0 flex-1">
                <strong className="block text-[10px] font-black">
                  {manualOverageReview.exceededKeys.length === 1
                    ? `Excediste tu meta de ${{ kcal: "calorías", proteina: "proteína", carbs: "carbohidratos", grasas: "grasas" }[manualOverageReview.exceededKeys[0]]}`
                    : "Superaste algunos macros de esta comida"}
                </strong>
                <p className="mt-0.5 text-[9px] font-bold leading-relaxed text-sky-100/75">
                  {manualOverageReview.exceededKeys.map((key) => {
                    const labels = { kcal: "Kcal", proteina: "P", carbs: "C", grasas: "G" };
                    const unit = key === "kcal" ? " kcal" : " g";
                    return `${labels[key]} +${formatNumber(manualOverageReview.excess[key], 1)}${unit}`;
                  }).join(" · ")}. Es informativo y podés continuar.
                </p>
              </div>
            </div>
          ) : null}

{/* =================================
    ACCIONES
    ================================= */}

<div className="mt-3 grid gap-2">

  <button
    type="button"
    onClick={onManage}
    disabled={disabled || manuallyClosed}
    className="
      order-2
      inline-flex
      min-h-11
      w-full
      items-center
      justify-center
      gap-2

      rounded-xl

      border
      border-teal-300/35

      bg-teal-300/10

      px-3

      text-[11px]
      font-black
      text-teal-100

      disabled:opacity-50
    "
  >
    <Plus size={15} />

    {hasTrackedItems
      ? "Administrar alimentos"
      : "Agregar alimento"}
  </button>

  {hasTrackedItems ? (
    <button
      type="button"
      onClick={() => autonomousActions?.onSaveMeal?.({
        ...meal,
        id: targetExecution.id,
        name: mealName(meal, mealIndex),
        type: meal?.type || meal?.tipoComida || targetExecution?.type || "otro",
        items: trackedItems,
        totals: trackedTotals,
      }, mealIndex, {
        sourceKind: meal?.personalTargetOnly ? "target" : "coach",
        tags: ["tracking", "por-meta"],
      })}
      disabled={disabled}
      className="order-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/[0.08] px-3 text-[11px] font-black text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-300/[0.12] disabled:opacity-50"
    >
      <Save size={15} />
      Guardar consumo en Mis comidas
    </button>
  ) : null}


  <div
    className={`order-1 grid gap-2 ${
      onDeleteTarget
        ? "grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem]"
        : "grid-cols-2"
    }`}
  >

    <button
      type="button"
      onClick={onEditTarget || onSettings}
      disabled={disabled || (meal.confirmed && Boolean(onEditTarget))}
      className="
        inline-flex
        min-h-11
        items-center
        justify-center
        gap-2

        rounded-xl

        border
        border-[#D4AF37]/30

        bg-[#D4AF37]/10

        px-3

        text-[11px]
        font-black
        text-[#FFE8A3]

        disabled:opacity-50
      "
    >
      {onEditTarget ? meal.confirmed ? <Lock size={15} /> : <PencilLine size={15} /> : <SlidersHorizontal size={15} />}

      {onEditTarget ? meal.confirmed ? "Meta fija" : "Editar meta" : "Ajustes"}
    </button>


    <button
      type="button"


onClick={() => {
  onGenerate?.({
    // En "Por meta" una propuesta aceptada siempre se registra como consumo.
    // Con la comida vacía, el restante equivale a la meta completa.
    completionMode: true,
    fixedTrackingItems: trackedItems,

    targetOverride:
      target,

    trackingExecutionId:
      targetExecution.id,
  });
}}

      disabled={
        disabled || manuallyClosed
      }

      className="
        inline-flex
        min-h-11
        items-center
        justify-center
        gap-2

        rounded-xl

        border
        border-teal-300/35

        bg-teal-300/10

        px-3

        text-[11px]
        font-black
        text-teal-100

        disabled:opacity-50
      "
    >
      <WandSparkles size={15} />

      {hasTrackedItems
        ? "Completar restante"
        : "Generar"}
    </button>

    {onDeleteTarget ? (
      <button
        type="button"
        onClick={() =>
          onDeleteTarget({
            mealName: mealName(meal, mealIndex),
            hasFoodLogs: hasTrackedItems,
            wasClosed: mealCompleted || completionState.manualStale,
          })
        }
        disabled={disabled}
        className="inline-flex min-h-11 w-11 items-center justify-center rounded-xl border border-rose-300/30 bg-rose-300/[0.08] text-rose-200 transition hover:border-rose-300/50 hover:bg-rose-300/[0.14] active:scale-95 disabled:opacity-40"
        aria-label={`Eliminar ${mealName(meal, mealIndex)}`}
        title={`Eliminar ${mealName(meal, mealIndex).toLowerCase()}`}
      >
        <Trash2 size={15} />
      </button>
    ) : null}

  </div>

</div>



        </div>

      ) : null}

      {confirmationOpen ? (
        <PersonalTargetConfirmationModal
          meal={meal}
          mealIndex={mealIndex}
          target={target}
          composition={trackedTotals}
          review={confirmationReview}
          visual={targetVisual}
          saving={disabled}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={async () => {
            if (typeof onToggleTargetConfirmed !== "function") {
              return { ok: false, error: "No se pudo iniciar la confirmación de esta comida." };
            }
            const result = await onToggleTargetConfirmed();
            if (result?.ok === true || result === true) setConfirmationOpen(false);
            return result;
          }}
        />
      ) : null}

      {plannedConsumptionOpen ? (
        <PlannedMealConsumptionConfirmationModal
          meal={meal}
          mealIndex={mealIndex}
          plannedFoods={plannedFoods}
          plannedTotals={plannedTotals}
          saving={disabled}
          onCancel={() => setPlannedConsumptionOpen(false)}
          onConfirm={() => {
            setPlannedConsumptionOpen(false);
            void autonomousActions?.onRegisterPlannedTargetComposition?.({
              row,
              targetMeal: meal,
              targetExecution,
              plannedMeal,
              mealIndex,
            });
          }}
        />
      ) : null}

    </article>
  );
}


function PlannedMealConsumptionConfirmationModal({
  meal,
  mealIndex,
  plannedFoods = [],
  plannedTotals = {},
  saving,
  onCancel,
  onConfirm,
}) {
  return (
    <div
      className="fixed inset-0 z-[185] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-planned-consumption-title"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-t-[1.6rem] border border-emerald-200/20 bg-[radial-gradient(circle_at_100%_0,rgba(45,212,191,.13),transparent_36%),linear-gradient(160deg,#101923,#071018)] p-4 shadow-[0_28px_90px_rgba(0,0,0,.65)] sm:rounded-[1.6rem]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-600/60 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[9px] font-black uppercase tracking-[.14em] text-emerald-300">Registrar consumo</span>
            <h3 id="confirm-planned-consumption-title" className="mt-1 text-xl font-black text-white">
              ¿Comiste este {mealName(meal, mealIndex).toLowerCase()}?
            </h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-400">
              Se registrarán en Tracking los alimentos y cantidades que dejaste planificados.
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={saving} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 disabled:opacity-50" aria-label="Cerrar confirmación">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-200/15 bg-black/20 p-3">
          <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
            <span className="text-xs font-black text-zinc-300">
              {plannedFoods.length} {plannedFoods.length === 1 ? "alimento" : "alimentos"}
            </span>
            <strong className="text-sm font-black text-emerald-200">
              {formatNumber(plannedTotals.kcal, 0)} kcal
            </strong>
          </div>
          <div className="mt-2 grid gap-1.5">
            {plannedFoods.map((food, index) => (
              <div key={`${food.id}-${index}`} className="flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white/[0.035] px-3 py-2.5">
                <span className="min-w-0 truncate text-xs font-bold text-zinc-100">{food.name}</span>
                <span className="shrink-0 text-[10px] font-black text-[#FFE8A3]">
                  {food.amount || foodAmount(food.cantidad, food.unidad)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="mt-3 text-[10px] font-bold leading-relaxed text-zinc-500">
          Si comiste cantidades distintas, cancelá y usá “Editar alimentos planificados” antes de registrarla.
        </p>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} disabled={saving} className="min-h-12 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-xs font-black text-zinc-200 disabled:opacity-50">
            Cancelar
          </button>
          <button type="button" onClick={onConfirm} disabled={saving} className="min-h-12 rounded-xl border border-emerald-200/40 bg-[linear-gradient(110deg,#2de0b2,#66f0d5)] px-3 text-xs font-black text-[#041d19] shadow-[0_8px_26px_rgba(45,224,178,.20)] disabled:opacity-50">
            Registrar comida
          </button>
        </div>
      </div>
    </div>
  );
}


function PersonalTargetConfirmationModal({
  meal,
  mealIndex,
  target,
  composition,
  review,
  visual,
  saving,
  onCancel,
  onConfirm,
}) {
  const [confirming, setConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const busy = saving || confirming;
  async function handleConfirm() {
    if (busy) return;
    setConfirmationError("");
    setConfirming(true);
    try {
      const result = await onConfirm?.();
      if (result?.ok !== true && result !== true) {
        setConfirmationError(result?.error || "No se pudo confirmar la comida. Intentá nuevamente.");
      }
    } catch (error) {
      setConfirmationError(error?.message || "No se pudo confirmar la comida. Intentá nuevamente.");
    } finally {
      setConfirming(false);
    }
  }
  const proteinCopy = review.proteinStatus === "below"
    ? `Te faltan ${formatNumber(Math.abs(review.proteinDifference), 1)} g de proteína para alcanzar la meta original.`
    : review.proteinStatus === "exceeded"
      ? `Objetivo de proteína alcanzado · +${formatNumber(review.proteinDifference, 1)} g.`
      : "Objetivo de proteína alcanzado.";
  const releasedKcal = Number(review?.difference?.kcal) || 0;

  return (
    <div className="fixed inset-0 z-[180] flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-personal-target-title" onClick={busy ? undefined : onCancel}>
      <div className="w-full max-w-md rounded-t-[1.6rem] border border-white/10 bg-[radial-gradient(circle_at_100%_0,rgba(45,212,191,.10),transparent_34%),linear-gradient(160deg,#101923,#071018)] p-4 shadow-[0_28px_90px_rgba(0,0,0,.65)] sm:rounded-[1.6rem]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-600/60 sm:hidden" />
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 id="confirm-personal-target-title" className="text-xl font-black text-white">
              Confirmar {mealName(meal, mealIndex).toLowerCase()}
            </h3>
            <p className="mt-2 text-sm font-bold leading-relaxed text-zinc-400">
              Vas a cerrar esta meta con el consumo registrado hasta ahora.
            </p>
          </div>
          <button type="button" onClick={onCancel} disabled={busy} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-zinc-300 disabled:opacity-50" aria-label="Cerrar confirmación">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-white/[0.09] bg-black/20 p-3">
          <div className="flex items-center gap-3 border-b border-white/[0.08] pb-3">
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl border ${visual.icon}`}>
              <Target size={22} />
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-base font-black text-white">{mealName(meal, mealIndex)}</strong>
              <span className={`mt-1 inline-flex rounded-full border px-2 py-0.5 text-[8px] font-black uppercase ${visual.badge}`}>Por meta</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-b border-white/[0.07] py-2 text-[9px] font-black uppercase tracking-wide text-zinc-500">
            <span>Consumido</span>
            <span className="text-right">Meta actual</span>
          </div>

          {[
            ["Calorías", "kcal", "kcal"],
            ["Proteína", "proteina", "g"],
            ["Carbohidratos", "carbs", "g"],
            ["Grasas", "grasas", "g"],
          ].map(([label, key, unit]) => (
            <div key={key} className="flex items-center justify-between gap-3 border-b border-white/[0.07] py-2.5 last:border-b-0">
              <span className="text-xs font-bold text-zinc-400">{label}</span>
              <strong className="text-xs font-black text-white">
                {formatNumber(composition[key], 1)} <span className="text-zinc-600">/</span> {formatNumber(target[key], 1)} {unit}
              </strong>
            </div>
          ))}
        </div>

        <div className={`mt-3 flex items-start gap-2.5 rounded-xl border px-3 py-3 ${review.proteinStatus === "below" ? "border-sky-300/25 bg-sky-300/[0.08] text-sky-100" : "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100"}`}>
          {review.proteinStatus === "below" ? <CircleAlert size={17} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={17} className="mt-0.5 shrink-0" />}
          <div>
            <strong className="block text-[11px] font-black">{proteinCopy}</strong>
            <p className="mt-1 text-[9px] font-bold leading-relaxed opacity-70">
              {releasedKcal > 0
                ? `Las ${formatNumber(releasedKcal, 0)} kcal restantes se redistribuirán entre comidas pendientes cuando sea posible.`
                : releasedKcal < 0
                  ? `El exceso de ${formatNumber(Math.abs(releasedKcal), 0)} kcal se compensará con comidas pendientes cuando exista capacidad.`
                  : "La composición coincide con la meta calórica actual."}
            </p>
          </div>
        </div>

        {confirmationError ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-300/30 bg-rose-300/[0.09] px-3 py-3 text-rose-100" role="alert">
            <CircleAlert size={17} className="mt-0.5 shrink-0" />
            <p className="text-[11px] font-black leading-relaxed">{confirmationError}</p>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="min-h-12 rounded-xl border border-white/15 bg-white/[0.04] px-3 text-xs font-black text-zinc-200 disabled:opacity-50">
            Seguir editando
          </button>
          <button type="button" onClick={handleConfirm} disabled={busy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-200/40 bg-[linear-gradient(110deg,#2de0b2,#66f0d5)] px-3 text-xs font-black text-[#041d19] shadow-[0_8px_26px_rgba(45,224,178,.20)] disabled:opacity-50">
            {busy ? <RefreshCw size={14} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={14} aria-hidden="true" />}
            {busy ? "Guardando..." : "Confirmar comida"}
          </button>
        </div>
      </div>
    </div>
  );
}








function MealChoiceNavigator({ options = [], activeIndex = 0, disabled = false, onSelect }) {
  const scrollerRef = useRef(null);
  const scrollTimerRef = useRef(null);

  useEffect(() => {
    const node = scrollerRef.current?.children?.[activeIndex];
    node?.scrollIntoView?.({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeIndex]);

  useEffect(() => () => window.clearTimeout(scrollTimerRef.current), []);

  function handleScroll() {
    window.clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = window.setTimeout(() => {
      const scroller = scrollerRef.current;
      if (!scroller || disabled) return;
      const center = scroller.scrollLeft + scroller.clientWidth / 2;
      const children = [...scroller.children];
      const closestIndex = children.reduce((best, child, index) => {
        const childCenter = child.offsetLeft + child.offsetWidth / 2;
        const bestChild = children[best];
        const bestCenter = bestChild.offsetLeft + bestChild.offsetWidth / 2;
        return Math.abs(childCenter - center) < Math.abs(bestCenter - center) ? index : best;
      }, 0);
      if (closestIndex !== activeIndex) onSelect?.(options[closestIndex]);
    }, 140);
  }

  if (options.length <= 1) return null;
  const previous = (activeIndex - 1 + options.length) % options.length;
  const next = (activeIndex + 1) % options.length;
  return (
    <div className="relative z-20 mb-2.5 grid grid-cols-[36px_minmax(0,1fr)_36px] items-center gap-1.5 rounded-xl border border-white/[0.08] bg-black/25 p-1.5">
      <button type="button" disabled={disabled} onClick={() => onSelect?.(options[previous])} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-200 disabled:opacity-40" aria-label="Ver alternativa anterior">
        <ChevronLeft size={17} />
      </button>
      <div ref={scrollerRef} onScroll={handleScroll} className="flex snap-x snap-mandatory gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Opciones de esta comida">
        {options.map((option, index) => (
          <button key={option.key} type="button" disabled={disabled || index === activeIndex} onClick={() => onSelect?.(option)} className={`min-h-9 min-w-[82%] snap-center rounded-lg border px-2 text-center text-[10px] font-black transition sm:min-w-[46%] ${index === activeIndex ? "border-emerald-300/35 bg-emerald-300/12 text-emerald-100" : "border-white/10 bg-white/[0.035] text-zinc-400"}`} aria-current={index === activeIndex ? "true" : undefined}>
            <span className="block truncate">{option.label}</span>
            <span className="mt-0.5 block text-[9px] font-bold opacity-70">{index + 1} de {options.length}{index === activeIndex ? " · elegida" : ""}</span>
          </button>
        ))}
      </div>
      <button type="button" disabled={disabled} onClick={() => onSelect?.(options[next])} className="grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-white/[0.04] text-zinc-200 disabled:opacity-40" aria-label="Ver alternativa siguiente">
        <ChevronRight size={17} />
      </button>
    </div>
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
        <span key={`${food.id}-${index}`} className="flex min-w-0 items-center gap-1.5 text-[12px] font-bold leading-tight text-zinc-400">
          <span className="min-w-0 truncate">{food.name}</span>
          {food.amount ? <span className="shrink-0 text-[11px] font-black text-[#FFE8A3]/95">{food.amount}</span> : null}
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
  const sizeClass = size === "lg"
    ? "h-[58px] w-[58px] rounded-[1.05rem]"
    : size === "sm"
      ? "h-10 w-10 rounded-xl"
      : "h-12 w-12 rounded-2xl";
  const iconSize = size === "lg" ? 31 : size === "sm" ? 19 : 23;
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
  trackingDay = null,
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
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onDeleteManual,
  canMarkMeals,
  canUseFlexibleRecommendations,
  manualCompletionAction = null,
  saving,
}) {
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);
  if (!row) return null;
  const state = menuState(row);
  const tracking = statusMeta(row);
  const choices = menuChoices(row);
  const activeChoice = trackingChoice(row) || choices[0] || null;
  const activeTotals = choiceTotals(activeChoice);
  const snapshot = activeChoice?.snapshot || null;
  const baseMeals = reconcilePlannedMealsWithPersonalTargets({
    plannedMeals: activeChoice ? choiceMeals(activeChoice) : [],
    trackingDay,
    completedMealIds: row?.tracking?.completedMenuMealIds,
    suppressedMealIds: suppressedMenuMealIds(row),
    legacyTargetMeals: autonomousActions?.legacyTargetPlanDate === row?.date
      ? autonomousActions?.legacyTargetMeals
      : [],
    menuSource: activeChoice?.snapshot?.source,
  }).meals;
  const effectiveMeals = effectiveMealEntriesForDay(row, baseMeals, weekRows, trackingDay);
  const countableMeals = countableMealEntries(effectiveMeals);
  const completedCount = completedCountableMeals(effectiveMeals);
  const targetKcal = targetTotals(row).kcal;
  const hasTarget = hasConfiguredTarget(row);
  const consumed = consumedTotals(row);
  const remaining = remainingTotals(row);
  const menuKcal = activeTotals.kcal;
  const pct = hasTarget && targetKcal ? Math.min(135, Math.round((consumed.kcal / targetKcal) * 100)) : 0;
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

      <AutonomousMenuQuickActions />

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
          {manualCompletionAction ? <div className="mt-3">{manualCompletionAction}</div> : null}
        </div>
      ) : null}

      <div className="mt-3">
        <button type="button" onClick={onView} className="w-full rounded-2xl border border-sky-400/25 bg-sky-400/10 px-3 py-3 text-xs font-black text-sky-100">
          Ver menu completo
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
  trackingDay = null,
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
  manualCompletionAction = null,
  saving,
}) {
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);
  const displayRow = rowWithActiveGeneratedMeals(row, weekRows);
  const choice = trackingChoice(displayRow);
  const baseMeals = reconcilePlannedMealsWithPersonalTargets({
    plannedMeals: choice ? choiceMeals(choice) : [],
    trackingDay,
    completedMealIds: displayRow?.tracking?.completedMenuMealIds,
    suppressedMealIds: suppressedMenuMealIds(displayRow),
    legacyTargetMeals: autonomousActions?.legacyTargetPlanDate === displayRow?.date
      ? autonomousActions?.legacyTargetMeals
      : [],
    menuSource: choice?.snapshot?.source,
  }).meals;
  const effectiveMeals = effectiveMealEntriesForDay(displayRow, baseMeals, weekRows, trackingDay);
  const targetOnlyMeals = plannedMealTargets(displayRow, trackingDay);
  const plannedTargetCompositions = plannedCompositionsByTarget(displayRow, targetOnlyMeals, baseMeals);
  const attachedPlannedMealIds = new Set(
    [...plannedTargetCompositions.values()].map((entry) => String(entry.baseMealId))
  );
  const visibleEffectiveMeals = effectiveMeals.filter((entry) => (
    !attachedPlannedMealIds.has(String(mealId(entry.baseMeal || entry.meal, entry.mealIndex)))
  ));
  const generatedEntries = visibleEffectiveMeals.filter((entry) => entry.generated);
  const manualEntries = visibleEffectiveMeals.filter((entry) => entry.manual);
  const removablePlanningEntries = visibleEffectiveMeals.filter((entry) => !entry.manual && !entry.generated);
  const countableMeals = countableMealEntries(effectiveMeals);
  const completedCount = completedCountableMeals(effectiveMeals);

  if (
    !visibleEffectiveMeals.length
    && (
      targetOnlyMeals.length
      || suppressedMenuMealIds(displayRow).length
      || (autonomousActions?.legacyTargetPlanDate === displayRow?.date
        && (autonomousActions?.legacyTargetMeals?.length || 0) > 0)
    )
  ) return null;

  return (
    <section className="grid gap-3 rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018))] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wide text-[#FFE8A3]">Comidas del día</span>
          <h4 className="mt-1 text-lg font-black text-white">Detalle visible del dia</h4>
        </div>
        <span className="rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/10 px-3 py-1.5 text-[11px] font-black text-[#FFE8A3]">
          {completedMealsLabel(completedCount, countableMeals.length || 0)}
        </span>
      </div>

      {visibleEffectiveMeals.length ? (
        <>
          <DesktopMealsGrid
            row={displayRow}
            effectiveMeals={visibleEffectiveMeals}
            onToggleMeal={onToggleMeal}
            onOpenMeal={onOpenMeal}
            canQuickEditMeals={canQuickEditMeals}
            onQuickEditMeal={onQuickEditMeal}
            onSaveAsSavedMeal={onSaveAsSavedMeal}
            onDeleteManual={onDeleteManual}
            canMarkMeals={canMarkMeals}
            saving={saving}
          />
          {autonomousActions?.hasAutomaticMenuPlanning ? (
            <button
              type="button"
              onClick={() => {
                if (removablePlanningEntries.length === 1) {
                  const entry = removablePlanningEntries[0];
                  autonomousActions?.onDeleteAutomaticMenuMeal?.(
                    displayRow,
                    entry.baseMeal || entry.meal,
                    entry.mealIndex
                  );
                  return;
                }
                autonomousActions?.onDeleteAutomaticMenuMeals?.(displayRow);
              }}
              disabled={saving}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/[0.06] px-3 text-xs font-black text-rose-100 disabled:opacity-45"
            >
              <Trash2 size={15} />
              {removablePlanningEntries.length === 1 ? "Eliminar comida" : "Eliminar comidas"}
            </button>
          ) : null}
          <GeneratedWeeklyActions
            row={displayRow}
            generatedEntries={generatedEntries}
            manualEntries={manualEntries}
            onRestoreGenerated={onRestoreGenerated}
            onRestoreManual={onRestoreManual}
            onDeleteManual={onDeleteManual}
          />
          {manualCompletionAction}
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
  const mealChoiceActions = React.useContext(MealChoiceActionsContext);
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);
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
  const freePlannedMeal = isFreePlannedMenuMeal(row, trackingMeal);
  const dailyPlannedMeal = isDateScopedOwnMenuChoice(trackingChoice(row), row?.date);
  const canEditThisMeal = (canQuickEdit || dailyPlannedMeal) && !manual && !generated;
  const canDeleteAutomaticPlanning = autonomousActions?.hasAutomaticMenuPlanning === true
    && !manual
    && !generated;
  const canDeletePlanning = (canDeleteAutomaticPlanning || dailyPlannedMeal)
    && !manual
    && !generated;
  const mealChoices = Array.isArray(entry.mealChoices) ? entry.mealChoices : [];
  const activeChoiceIndex = Math.max(0, mealChoices.findIndex((option) => option.active));

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

  function openMealDetail(event, action = "detail") {
    event.stopPropagation();
    onOpenMeal?.({ ...detailPayload, action });
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

      {mealChoices.length > 1 ? (
        <MealChoiceNavigator
          options={mealChoices}
          activeIndex={activeChoiceIndex}
          disabled={saving}
          onSelect={(option) => mealChoiceActions?.select?.(row, trackingMeal, mealIndex, option)}
        />
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

          <div className="mt-4 grid gap-2">
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
            {canDeletePlanning ? (
              <button
                type="button"
                onClick={() => autonomousActions?.onDeleteAutomaticMenuMeal?.(row, trackingMeal, mealIndex)}
                disabled={saving}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-300/[0.07] px-3 text-xs font-black text-rose-100 disabled:opacity-55"
              >
                <Trash2 size={15} />
                {freePlannedMeal ? "Eliminar planificación" : "Eliminar comida"}
              </button>
            ) : null}
{dailyPlannedMeal ? (
  onSaveAsSavedMeal ? (
    <button
      type="button"
      onClick={saveAsMeal}
      disabled={saving || !foods.length}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.08] px-3 text-xs font-black text-emerald-100 disabled:opacity-40"
    >
      <Save size={15} />
      Guardar en Mis comidas
    </button>
  ) : null
) : (
<MealCompactActions
  onDetail={(event) => openMealDetail(event, "detail")}
  onReplace={(event) => openMealDetail(event, "replace")}
  onSettings={(event) => openMealDetail(event, "settings")}
  onTarget={(event) => openMealDetail(event, "target")}
  onSave={onSaveAsSavedMeal ? saveAsMeal : null}
  canReplace={!manual && !generated}
  canConfigure={!manual && !generated}
  canUseTarget={!manual && !generated && !done}
  saveDisabled={saving || !foods.length}
/>
)}
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
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onRestoreGenerated,
  canMarkMeals,
  canUseFlexibleRecommendations,
  manualCompletionAction = null,
  onUseAlternative,
  saving,
}) {
  const trackingQuery = useTrackingDay(row?.date || "");

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
            trackingDay={trackingQuery.data}
            weekRows={weekRows}
            activePlanSource={activePlanSource}
            onMarkMissed={onMarkMissed}
            onToggleMeal={onToggleMeal}
            onOpenMeal={onOpenMeal}
            onQuickEditMeal={onQuickEditMeal}
            onSaveAsSavedMeal={onSaveAsSavedMeal}
            onOpenFlexibleMargin={onOpenFlexibleMargin}
            onToggleFlexibleMarginCompleted={onToggleFlexibleMarginCompleted}
            onRestoreGenerated={onRestoreGenerated}
            canMarkMeals={canMarkMeals}
            canUseFlexibleRecommendations={canUseFlexibleRecommendations}
            manualCompletionAction={manualCompletionAction}
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
  trackingDay = null,
  dailyTargetItems = [],
  weekRows = [],
  activePlanSource = "none",
  onMarkMissed,
  onToggleMeal,
  onOpenMeal,
  onQuickEditMeal,
  onSaveAsSavedMeal,
  onOpenFlexibleMargin,
  onToggleFlexibleMarginCompleted,
  onRestoreGenerated,
  canMarkMeals,
  canUseFlexibleRecommendations,
  manualCompletionAction = null,
  onUseAlternative,
  saving,
}) {
  const autonomousActions = React.useContext(MenuAutonomousActionsContext);
  if (!row) return null;
  const choices = menuChoices(row);
  const selectedAlternative = row?.tracking?.selectedAlternative;
  const hasTarget = hasConfiguredTarget(row);
  const activeChoice = trackingChoice(row) || choices[0] || null;
  const canQuickEditMeals = canQuickEditMenuChoice(activeChoice, activePlanSource, row?.date);
  const targetOnlyMeals = plannedMealTargets(row, trackingDay);
  const reconciledPlannedMeals = reconcilePlannedMealsWithPersonalTargets({
    plannedMeals: activeChoice ? choiceMeals(activeChoice) : [],
    trackingDay,
    completedMealIds: row?.tracking?.completedMenuMealIds,
    suppressedMealIds: suppressedMenuMealIds(row),
    menuSource: activeChoice?.snapshot?.source,
  }).meals;
  const plannedTargetCompositions = plannedCompositionsByTarget(
    row,
    targetOnlyMeals,
    reconciledPlannedMeals
  );
  const plannedTrackingMealIds = choiceMeals(activeChoice).map((meal, index) => (
    menuTargetExecutionContext(row, meal, meal, index).id
  ));
  const flexiblePlan = flexiblePlanForChoice(row, activeChoice, activePlanSource)
    || personalMealTargetFlexiblePlan(targetTotals(row), targetOnlyMeals, {
      ...(autonomousActions?.personalTargetFlexibleSettings || {}),
      consumedNutrition: generationTrackingBreakdown(trackingDay, {
        excludedMealIds: targetOnlyMeals.flatMap((meal) => (
          Array.isArray(meal?.consumptionSourceMealIds) && meal.consumptionSourceMealIds.length
            ? meal.consumptionSourceMealIds
            : [meal.id]
        )),
      }).total,
      date: row?.date,
    });

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
            onClick={() => onMarkMissed(row)}
            disabled={!canMarkMeals}
            className="rounded-2xl border border-rose-400/25 bg-rose-400/10 px-3 py-2 text-xs font-black text-rose-100 disabled:opacity-45"
          >
            Día no cumplido
          </button>
        </div>
      </div>

      <WeeklyBalanceNotice balance={row?.weeklyBalance || trackingDay?.weeklyBalance} />

      {hasTarget ? (
        <div className="rounded-3xl border border-white/10 bg-black/20 p-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <TrackingMiniPanel label="Meta" totals={targetTotals(row)} tone="gold" />
            <TrackingMiniPanel label="Consumido" totals={consumedTotals(row)} tone="green" />
            <TrackingMiniPanel label="Faltante" totals={remainingTotals(row)} tone={remainingTotals(row).kcal < -20 ? "red" : "blue"} />
          </div>
          <DailyTargetTrackingDetails
            items={dailyTargetItems}
            remaining={remainingTotals(row)}
          />
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
        <EmptyMenu
          row={row}
          trackingDay={trackingDay}
          onGenerateMeal={(meal, mealIndex, completionContext = {}) => onOpenMeal({
            row,
            meal,
            baseMeal: meal,
            mealIndex,
            action: "native_target_complete",
            nativeTarget: true,
            ...completionContext,
          })}
          onManageMeal={(meal, mealIndex, options = {}) => onOpenMeal({
            row,
            meal,
            baseMeal: meal,
            mealIndex,
            action: "native_target",
            ...options,
          })}
        />
      )}

      <PersonalTargetReconciliationBanner
        reconciliation={autonomousActions?.personalTargetReconciliation}
        saving={saving}
        onMaintain={autonomousActions?.onMaintainPersonalTargetPlanning}
        onAdjust={autonomousActions?.onAdjustPersonalTargetsToTracking}
      />

      <MobileStandaloneTracking
        trackingDay={trackingDay}
        date={row?.date}
        excludeMealIds={[
          ...plannedTrackingMealIds,
          ...targetOnlyMeals.map((meal) => meal.id),
        ]}
      />

      {choices.length && targetOnlyMeals.length ? (
        <section className="grid gap-3 rounded-3xl border border-emerald-300/20 bg-emerald-300/[.045] p-4">
          <div>
            <strong className="text-white">Comidas por meta conservadas</strong>
            <p className="mt-1 text-sm font-semibold text-zinc-400">
              Estas metas se descontaron antes de generar las demás comidas del menú.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {targetOnlyMeals.map((meal, index) => (
              <PlannedMealTargetCard
                key={meal.id}
                row={row}
                meal={meal}
                mealIndex={index}
                disabled={saving}
                plannedComposition={plannedTargetCompositions.get(String(meal.id)) || null}
                onEditPlanned={canQuickEditMeals && plannedTargetCompositions.has(String(meal.id))
                  ? () => {
                      const composition = plannedTargetCompositions.get(String(meal.id));
                      onQuickEditMeal?.({
                        row,
                        meal: composition.meal,
                        baseMeal: composition.meal,
                        mealIndex: composition.mealIndex,
                      });
                    }
                  : null}
                onEditTarget={editablePersonalMealTargetIds([meal]).length
                  ? () => autonomousActions?.onEditPersonalTarget?.(meal)
                  : null}
                onDeleteTarget={editablePersonalMealTargetIds([meal]).length
                  ? (context) => autonomousActions?.onDeletePersonalTarget?.(row, meal, context)
                  : null}
                onToggleTargetConfirmed={meal.personalTargetOnly
                  ? () => autonomousActions?.onTogglePersonalTargetConfirmed?.(meal)
                  : meal.coachTargetOnly
                    ? () => autonomousActions?.onToggleCoachTargetConfirmed?.(meal, row)
                    : null}
                onGenerate={(completionContext = {}) => onOpenMeal({
                  row,
                  meal,
                  baseMeal: meal,
                  mealIndex: index,
                  action: "native_target_complete",
                  nativeTarget: true,
                  ...completionContext,
                })}
                onManage={() => onOpenMeal({ row, meal, baseMeal: meal, mealIndex: index, action: "native_target" })}
                onAddFood={() => onOpenMeal(buildNativeMealTargetDrawerContext({ row, meal, mealIndex: index, openFoodPicker: true }))}
              />
            ))}
          </div>
          {targetOnlyMeals.some((meal) => meal.personalTargetOnly) ? (
            <EditDayTargetsButton
              disabled={saving || autonomousActions?.canPlanMeal === false}
              onClick={() => autonomousActions?.onEditPersonalTargetDay?.(row, targetOnlyMeals)}
            />
          ) : null}
        </section>
      ) : null}

      <FlexibleMarginSlotCard
        row={row}
        plan={flexiblePlan}
        saving={saving}
        canRecommend={canUseFlexibleRecommendations}
        onEdit={() => onOpenFlexibleMargin?.(row, "manual", flexiblePlan)}
        onCalculate={() => onOpenFlexibleMargin?.(row, "calculate", flexiblePlan)}
        onToggleCompleted={() => onToggleFlexibleMarginCompleted?.(row, flexiblePlan)}
      />

      <DesktopMealsSection
        row={row}
        trackingDay={trackingDay}
        weekRows={weekRows}
        onToggleMeal={onToggleMeal}
        onOpenMeal={onOpenMeal}
        canQuickEditMeals={canQuickEditMeals}
        onQuickEditMeal={onQuickEditMeal}
        onSaveAsSavedMeal={onSaveAsSavedMeal}
        onRestoreGenerated={onRestoreGenerated}
        canMarkMeals={canMarkMeals}
        manualCompletionAction={manualCompletionAction}
        saving={saving}
      />

    </section>
  );
}

function MealCompactActions({
  onDetail,
  onReplace,
  onSettings,
  onTarget,
  onSave,
  canReplace = true,
  canConfigure = true,
  canUseTarget = true,
  saveDisabled = false,
}) {
  const buttonClass =
    "group inline-flex h-11 w-11 shrink-0 items-center justify-center gap-1.5 rounded-xl border text-[10px] font-black transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:px-3";

  return (
    <div
      className="flex w-fit max-w-full items-center gap-1.5 rounded-2xl border border-white/[0.08] bg-black/25 p-1.5"
      role="group"
      aria-label="Acciones de la comida"
    >
      <button
        type="button"
        onClick={onDetail}
        className={`${buttonClass} border-white/10 bg-white/[0.05] text-zinc-100`}
        aria-label="Ver detalle de la comida"
        title="Detalle"
      >
        <Eye size={16} />
        <span className="hidden sm:inline">Detalle</span>
      </button>

      <button
        type="button"
        onClick={onReplace}
        disabled={!canReplace}
        className={`${buttonClass} border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-100`}
        aria-label="Armar otra comida equivalente"
        title="Armar alternativa"
      >
        <WandSparkles size={16} />
        <span className="hidden sm:inline">Alternativa</span>
      </button>

      <button
        type="button"
        onClick={onSettings}
        disabled={!canConfigure}
        className={`${buttonClass} border-[#D4AF37]/40 bg-[#D4AF37]/12 text-[#FFE16B] shadow-[inset_0_0_18px_rgba(212,175,55,.08),0_6px_18px_rgba(0,0,0,.18)]`}
        aria-label="Abrir ajustes de generación"
        title="Ajustes de generación"
      >
        <SlidersHorizontal size={16} />
        <span className="hidden sm:inline">Ajustar</span>
      </button>

      {onTarget ? (
        <button
          type="button"
          onClick={onTarget}
          disabled={!canUseTarget}
          className={`${buttonClass} border-teal-300/35 bg-teal-300/[0.10] text-teal-100 shadow-[inset_0_0_18px_rgba(45,212,191,.08)]`}
          aria-label="Registrar esta comida por meta"
          title="Registrar por meta"
        >
          <Target size={16} strokeWidth={2.4} />
          <span className="hidden sm:inline">Por meta</span>
        </button>
      ) : null}

      {onSave ? (
        <button
          type="button"
          onClick={onSave}
          disabled={saveDisabled}
          className={`${buttonClass} border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100`}
          aria-label="Guardar en Mis comidas"
          title="Guardar en Mis comidas"
        >
          <Save size={16} />
          <span className="hidden sm:inline">Guardar</span>
        </button>
      ) : null}
    </div>
  );
}

function FlexibleMarginEditor({
  row,
  planOverride = null,
  activePlanSource = "none",
  initialMode = "manual",
  canRecommend = false,
  saving = false,
  onClose,
  onSave,
}) {
  const choice = trackingChoice(row);
  const plan = planOverride || flexiblePlanForChoice(row, choice, activePlanSource);
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
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

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
      if (event.key !== "Escape" || saving) return;
      if (foodPicker) {
        setFoodPicker(null);
        setError("");
        return;
      }
      onClose?.();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [foodPicker, onClose, saving]);

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
    if (foodPicker?.food) {
      setError("Primero agregá o cancelá el alimento seleccionado.");
      return;
    }
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
  const hasPendingFood = !!pickerFood;

  return (
    <section className="fixed inset-0 z-[95] flex items-end bg-black/80 px-0 pt-2 backdrop-blur-md sm:items-center sm:px-4 sm:py-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onClose} aria-label="Cerrar calorias libres" />
      <div className="relative mx-auto flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.7rem] border border-white/10 bg-[linear-gradient(145deg,#101821_0%,#07111b_48%,#05080d_100%)] shadow-[0_30px_110px_rgba(0,0,0,.78)] sm:max-h-[92dvh] sm:rounded-[1.8rem]" style={{ maxWidth: "896px" }}>
        <div className="mx-auto mt-2 h-1 w-14 shrink-0 rounded-full bg-white/20 sm:mt-3 sm:h-1.5 sm:w-20" aria-hidden="true" />
        <header className="flex shrink-0 items-start justify-between gap-3 px-3 pb-2 pt-3 sm:gap-4 sm:px-6 sm:pb-4 sm:pt-6">
          <div className="min-w-0 flex-1">
            <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-sky-300/30 bg-sky-300/10 px-2.5 text-[10px] font-black uppercase tracking-[0.13em] text-sky-200 shadow-[inset_0_0_18px_rgba(56,189,248,.08)] sm:min-h-8 sm:gap-2 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]">
              <Apple size={15} />
              Tracking flexible
            </span>
            <h3 id={titleId} className="mt-2 text-[1.55rem] font-black leading-[1.05] text-white sm:mt-4 sm:text-4xl">Calorías libres</h3>
            <p className="mt-1 text-xs font-bold leading-snug text-slate-400 sm:mt-2 sm:text-base">{headerSummary}</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#D4AF37]/30 bg-white/[0.055] text-white shadow-[inset_0_0_22px_rgba(212,175,55,.06)] disabled:opacity-50 sm:h-14 sm:w-14" aria-label="Cerrar">
            <X size={21} strokeWidth={2.4} />
          </button>
        </header>

        <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto px-3 pb-3 sm:px-6 sm:pb-6">
          <div className="grid gap-3 sm:gap-5">
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

            <section className="rounded-[1.15rem] border border-white/10 bg-black/20 p-2.5 sm:p-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h4 className="text-lg font-black text-white sm:text-xl">{searchHeading}</h4>
                  <p className="mt-0.5 text-[11px] font-bold leading-snug text-slate-500 sm:mt-1 sm:text-xs">{searchHelp}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-black ${searchModeIsCalculate ? "border-sky-300/25 bg-sky-300/10 text-sky-200" : "border-[#D4AF37]/25 bg-[#D4AF37]/10 text-[#FFE8A3]"}`}>
                  {searchModeIsCalculate ? "Modo calcular" : "Agregar al margen"}
                </span>
              </div>
              <label className="mt-2.5 flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-[#050a0f] px-3 sm:mt-3 sm:min-h-13">
                <Search size={20} className="shrink-0 text-slate-500" strokeWidth={1.8} />
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
                <div className="mt-3">
                  <div
                    className="max-h-[192px] overflow-y-auto overscroll-contain rounded-2xl border border-white/[0.09] bg-white/[0.025] shadow-[inset_0_1px_0_rgba(255,255,255,.035)] [scrollbar-color:rgba(250,204,21,.48)_rgba(255,255,255,.04)] [scrollbar-width:thin]"
                    aria-label="Resultados de alimentos para calorías libres"
                  >
                    {foods.map((food, index) => {
                      const id = String(food.id || food._id || food.alimentoId || foodDisplayName(food) || index);
                      return (
                        <button
                          key={`${id}-${index}`}
                          type="button"
                          onClick={() => openFoodPicker(food)}
                          className="group flex min-h-16 w-full items-center justify-between gap-3 border-b border-white/[0.065] px-3 py-2.5 text-left text-sm font-bold text-zinc-100 transition last:border-b-0 hover:bg-[#D4AF37]/[0.075] focus-visible:bg-[#D4AF37]/[0.075] focus-visible:outline-none"
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <FoodThumb food={{ ...food, name: foodDisplayName(food) }} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate text-[13px] font-black text-white">{foodDisplayName(food)}</span>
                              <span className="mt-0.5 block truncate text-[10px] font-bold text-zinc-500">{foodLibraryMacroLine(food)}</span>
                            </span>
                          </span>
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 text-[#FFE8A3] transition group-hover:border-[#FFE070]/50 group-hover:bg-[#D4AF37]/20">
                            <Plus size={16} />
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {foods.length > 3 ? (
                    <p className="mt-1.5 flex items-center justify-center gap-1 text-[10px] font-black text-[#FFE8A3]/75">
                      Deslizá dentro de la lista para ver {foods.length - 3} resultados más
                      <ChevronDown size={13} aria-hidden="true" />
                    </p>
                  ) : null}
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

              <div className="mt-2 grid gap-2 sm:mt-3">
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
              <p className="mt-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-bold leading-relaxed text-slate-500 sm:mt-3">
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

        <footer className="shrink-0 border-t border-white/10 bg-[#070b10]/95 px-3 pb-[calc(.65rem+env(safe-area-inset-bottom))] pt-2.5 sm:p-4 sm:px-6">
          {hasPendingFood ? (
            <p className="mb-2 flex items-center justify-center gap-1.5 text-center text-[11px] font-black text-amber-100" role="status">
              <CircleAlert size={14} className="shrink-0" />
              Primero agregá o cancelá el alimento seleccionado.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-[46px] rounded-[1rem] border border-white/20 bg-white/[0.045] px-3 text-sm font-black text-slate-400 disabled:opacity-50 sm:min-h-[52px] sm:rounded-[1.1rem] sm:px-4">
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || hasPendingFood}
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-[1rem] bg-gradient-to-r from-[#facc15] to-[#f5d76e] px-3 text-sm font-black text-[#080808] shadow-[0_16px_36px_rgba(212,175,55,.22)] disabled:cursor-not-allowed disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-400 disabled:opacity-70 disabled:shadow-none sm:min-h-[52px] sm:rounded-[1.1rem] sm:px-4"
            >
              {!saving ? <Sparkles size={17} fill="currentColor" strokeWidth={1.8} /> : null}
              {saving ? "Guardando..." : completionState.autoComplete && !completed ? "Guardar y marcar hecho" : "Guardar así"}
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
  const [savedMealPickerOpen, setSavedMealPickerOpen] = useState(false);
  const [freeMealStatus, setFreeMealStatus] = useState("done");
  const [quantityDrafts, setQuantityDrafts] = useState({});
  const [localError, setLocalError] = useState("");

  useEffect(() => {
    setDraftMeal(context.mealDraft || null);
    setPicker(null);
    setSavedMealPickerOpen(false);
    setFreeMealStatus("done");
    setQuantityDrafts({});
    setLocalError("");
  }, [context.token, context.mealDraft]);

  const title = draftMeal?.nombre || context.title || "Comida";
  const items = draftMeal?.items || [];
  const totals = sumTotals(items);
  const titleId = "quick-meal-editor-title";
  const freePlanningMode = context.mode === "create-free" || context.mode === "edit-free";
  const dailyPlanningMode = freePlanningMode || context.mode === "edit-day";

  function updateItem(itemId, patch) {
    setDraftMeal((current) => ({
      ...(current || {}),
      items: (current?.items || []).map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  }

  function removeItem(itemId) {
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[itemId];
      return next;
    });
    setDraftMeal((current) => ({
      ...(current || {}),
      items: (current?.items || []).filter((item) => item.id !== itemId),
    }));
  }

  function updateQuantityDraft(item, rawValue) {
    setLocalError("");
    setQuantityDrafts((current) => ({ ...current, [item.id]: rawValue }));
    if (rawValue === "") return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) return;
    updateItem(item.id, rescaleQuickMenuItem(item, parsed));
  }

  function commitQuantityDraft(item) {
    const rawValue = quantityDrafts[item.id];
    if (rawValue === undefined) return;
    const parsed = Number(rawValue);
    if (rawValue !== "" && Number.isFinite(parsed) && parsed > 0) {
      updateItem(item.id, rescaleQuickMenuItem(item, parsed));
    }
    setQuantityDrafts((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });
  }

  function applyPickedFood(food, quantity, unit) {
    const nextItem = buildQuickMenuItemFromFood(food, quantity, unit);
    setLocalError("");
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

  function applySavedMeal(meal = {}) {
    const sourceItems = Array.isArray(meal.items)
      ? meal.items
      : Array.isArray(meal.alimentos)
        ? meal.alimentos
        : [];
    if (!sourceItems.length) {
      setLocalError("La comida guardada no tiene alimentos para agregar.");
      return;
    }
    const nextItems = sourceItems.map((item, index) => ({
      ...normalizeQuickMenuItem(item, index),
      id: uid("item"),
    }));
    setDraftMeal((current) => ({
      ...(current || {}),
      nombre: meal.nombre || meal.name || current?.nombre || context.title || "Comida",
      tipoComida: current?.tipoComida || context.mealType || meal.tipoComida || "otra",
      items: nextItems,
    }));
    setQuantityDrafts({});
    setPicker(null);
    setSavedMealPickerOpen(false);
    setLocalError("");
  }

  function save() {
    if (!draftMeal || saving) return;
    if (context.requireFood && !(draftMeal.items || []).length) {
      setLocalError("Agregá al menos un alimento para registrar esta comida.");
      return;
    }
    const invalid = (draftMeal.items || []).some((item) => !(Number(item.cantidad) > 0));
    if (invalid) {
      setLocalError("Todas las cantidades deben ser mayores a 0.");
      return;
    }
    onSave?.(
      {
        ...draftMeal,
        items: (draftMeal.items || []).map(normalizeQuickMenuItem),
      },
      { mealStatus: freeMealStatus }
    );
  }

  return (
    <section
      className="fixed inset-0 z-[95] flex items-end bg-black/72 px-2 pt-8 backdrop-blur-md sm:items-center sm:px-4 sm:py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby={savedMealPickerOpen ? undefined : titleId}
      aria-label={savedMealPickerOpen ? "Elegir una comida guardada" : undefined}
    >
      <button type="button" className="absolute inset-0 cursor-default" onClick={saving ? undefined : onClose} aria-label="Cerrar edicion rapida" />
      <div className="relative mx-auto flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[1.7rem] border border-white/10 bg-[radial-gradient(circle_at_15%_0,rgba(45,212,191,.14),transparent_34%),radial-gradient(circle_at_100%_8%,rgba(212,175,55,.16),transparent_30%),linear-gradient(180deg,#101923,#070b10)] shadow-[0_28px_90px_rgba(0,0,0,.72)] sm:rounded-[1.7rem]">
        {!savedMealPickerOpen ? (
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-white/10 bg-white/[0.025] p-4">
          <div className="min-w-0">
            <span className="inline-flex min-h-7 items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-3 text-[11px] font-black uppercase tracking-wide text-[#FFE8A3]">
              {dailyPlanningMode ? <Utensils size={14} /> : <PencilLine size={14} />}
              {freePlanningMode
                ? context.mode === "create-free" ? "Comida libre" : "Planificación libre"
                : context.mode === "edit-day" ? "Planificación del día" : "Editar alimentos"}
            </span>
            <h3 id={titleId} className="mt-3 truncate text-2xl font-black leading-tight text-white">
              {context.mode === "create-free" ? `Registrar ${title}` : `Editar ${title}`}
            </h3>
            <p className="mt-1 text-sm font-bold text-zinc-400">
              {displayKcal(totals.kcal)} - P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.055] text-zinc-100 disabled:opacity-50" aria-label="Cerrar">
            <X size={20} />
          </button>
          </header>
        ) : null}

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
              {!savedMealPickerOpen ? (
                <>
              <div className="rounded-3xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3 text-xs font-bold leading-relaxed text-zinc-300">
                <strong className="block text-[#FFE8A3]">
                  {dailyPlanningMode ? "Ajustá esta comida a tu manera." : "Estás editando tu día base."}
                </strong>
                {dailyPlanningMode
                  ? context.mode === "create-free"
                    ? freeMealStatus === "done"
                      ? "Podés ajustar los alimentos y cantidades. Al confirmar, se registrará directamente como consumida en Tracking."
                      : "Podés ajustar los alimentos y cantidades. Al confirmar, quedará pendiente sólo para este día y no contará como consumo."
                    : "Podés cambiar cantidades, agregar, reemplazar o quitar alimentos. Los cambios afectan sólo a este día y no cuentan como consumo."
                  : "Los cambios se verán durante toda la semana. El cumplimiento continuará siendo independiente por fecha."}
              </div>

              {items.length ? (
                <div className="grid gap-2">
                  {items.map((item) => {
                    const normalized = normalizeMealFood(item);
                    return (
                      <article key={item.id} className="group rounded-[1.15rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.018))] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,.035)] transition hover:border-white/15">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <FoodThumb food={normalized} size="sm" />
                          <div className="min-w-0 flex-1">
                            <strong className="block truncate text-sm font-black text-white">{item.nombreSnapshot || item.nombre || normalized.name}</strong>
                            <span className="mt-0.5 block truncate text-[11px] font-bold text-zinc-500">
                              {displayKcal(item.kcal)} - P {formatNumber(item.proteina, 1)} / C {formatNumber(item.carbs, 1)} / G {formatNumber(item.grasas, 1)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPicker({ mode: "replace", itemId: item.id, label: item.nombreSnapshot || item.nombre || normalized.name })}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-sky-300/20 bg-sky-300/[0.08] text-sky-100 transition hover:border-sky-300/35 hover:bg-sky-300/15"
                            aria-label={`Editar ${item.nombreSnapshot || item.nombre || normalized.name}`}
                            title="Editar o reemplazar alimento"
                          >
                            <PencilLine size={15} />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-300/20 bg-rose-400/[0.07] text-rose-200 transition hover:border-rose-300/35 hover:bg-rose-400/15"
                            aria-label={`Eliminar ${item.nombreSnapshot || item.nombre || normalized.name}`}
                            title="Eliminar alimento"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                        <label className="mt-2 flex min-h-10 items-center overflow-hidden rounded-xl border border-white/[0.09] bg-black/25 transition focus-within:border-[#D4AF37]/40 focus-within:bg-black/35">
                          <span className="shrink-0 pl-3 text-[9px] font-black uppercase tracking-[0.14em] text-zinc-500">Cantidad</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            inputMode="decimal"
                            value={Object.prototype.hasOwnProperty.call(quantityDrafts, item.id) ? quantityDrafts[item.id] : item.cantidad}
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => updateQuantityDraft(item, event.target.value)}
                            onBlur={() => commitQuantityDraft(item)}
                            className="min-w-0 flex-1 bg-transparent px-2 text-right text-sm font-black tabular-nums text-white outline-none"
                            aria-label={`Cantidad de ${item.nombreSnapshot || item.nombre || normalized.name}`}
                          />
                          <span className="mr-1 grid min-h-8 min-w-9 shrink-0 place-items-center rounded-lg bg-white/[0.05] px-2 text-[11px] font-black text-[#FFE8A3]">{item.unidad || "g"}</span>
                        </label>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-white/15 bg-white/[0.025] p-4 text-sm font-bold text-zinc-400">
                  <strong className="block text-base font-black text-white">Todavia no agregaste alimentos.</strong>
                  <span className="mt-1 block">
                    {dailyPlanningMode
                      ? context.mode === "edit-day"
                        ? "Agregá un alimento para volver a completar esta comida planificada."
                        : "Agregá el primero para armar esta comida sin una meta fija."
                      : "Agregá el primero para armar esta comida dentro de tu menú activo."}
                  </span>
                </div>
              )}

              <div className={`grid gap-2 ${freePlanningMode && !items.length ? "sm:grid-cols-2" : ""}`}>
                <button
                  type="button"
                  onClick={() => {
                    setSavedMealPickerOpen(false);
                    setPicker({ mode: "add" });
                  }}
                  className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 text-sm font-black text-[#FFE8A3]"
                >
                  <Plus size={17} />
                  Agregar alimento
                </button>

                {freePlanningMode && !items.length ? (
                  <button
                    type="button"
                    onClick={() => {
                      setPicker(null);
                      setSavedMealPickerOpen((current) => !current);
                    }}
                    className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-emerald-300/[0.07] px-4 text-sm font-black text-emerald-100"
                  >
                    <BookOpen size={17} />
                    Usar comida guardada
                  </button>
                ) : null}
              </div>
                </>
              ) : null}

              {savedMealPickerOpen ? (
                <QuickSavedMealPicker
                  mealType={context.mealType || draftMeal?.tipoComida || ""}
                  onSelect={applySavedMeal}
                  onCancel={() => setSavedMealPickerOpen(false)}
                />
              ) : null}

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

        {!savedMealPickerOpen ? (
          <footer className="shrink-0 border-t border-white/10 bg-[#080d12]/96 p-4">
          {context.mode === "create-free" ? (
            <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.035] p-2.5">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <div>
                  <strong className="block text-xs font-black text-white">Estado de la comida</strong>
                  <span className="mt-0.5 block text-[10px] font-bold text-zinc-500">
                    Elegí si queda pendiente o si ya la comiste.
                  </span>
                </div>
                <span className={`rounded-full border px-2 py-1 text-[9px] font-black uppercase tracking-wide ${freeMealStatus === "done" ? "border-emerald-300/35 bg-emerald-300/10 text-emerald-200" : "border-[#D4AF37]/35 bg-[#D4AF37]/10 text-[#FFE8A3]"}`}>
                  {freeMealStatus === "done" ? "Hecha" : "Planificada"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-black/25 p-1" role="group" aria-label="Estado de la comida">
                <button
                  type="button"
                  onClick={() => setFreeMealStatus("planned")}
                  aria-pressed={freeMealStatus === "planned"}
                  className={`min-h-11 rounded-xl border px-3 text-xs font-black transition ${freeMealStatus === "planned" ? "border-[#D4AF37]/45 bg-[#D4AF37]/15 text-[#FFE8A3] shadow-[0_8px_22px_rgba(212,175,55,.12)]" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                >
                  Planificada
                </button>
                <button
                  type="button"
                  onClick={() => setFreeMealStatus("done")}
                  aria-pressed={freeMealStatus === "done"}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition ${freeMealStatus === "done" ? "border-emerald-300/40 bg-emerald-300/15 text-emerald-100 shadow-[0_8px_22px_rgba(52,211,153,.12)]" : "border-transparent text-zinc-500 hover:text-zinc-300"}`}
                >
                  <CheckCircle2 size={15} />
                  Hecha
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={onClose} disabled={saving} className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.055] px-4 text-sm font-black text-zinc-200 disabled:opacity-50">
              Cancelar
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || context.loading || !!context.error || !draftMeal}
              className="min-h-12 rounded-2xl bg-gradient-to-r from-[#facc15] to-[#f5d76e] px-4 text-sm font-black text-[#080808] shadow-[0_14px_30px_rgba(212,175,55,.20)] disabled:opacity-60"
            >
              {saving ? "Guardando..." : context.mode === "create-free" ? "Confirmar" : "Guardar cambios"}
            </button>
          </div>
          </footer>
        ) : null}
      </div>
    </section>
  );
}

function QuickSavedMealPicker({ mealType = "", onSelect, onCancel }) {
  const [sameTypeOnly, setSameTypeOnly] = useState(true);
  const [search, setSearch] = useState("");
  const [meals, setMeals] = useState([]);
  const [expandedMealId, setExpandedMealId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryKey, setRetryKey] = useState(0);
  const typeLabels = {
    desayuno: "Desayuno",
    almuerzo: "Almuerzo",
    merienda: "Merienda",
    cena: "Cena",
    picoteo: "Picoteo",
    snack: "Snack",
  };
  const typeLabel = typeLabels[mealType] || "Este tipo";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    listSavedMeals({
      scope: "mine",
      tipoComida: sameTypeOnly && mealType ? mealType : "todos",
      limit: 80,
    })
      .then((data) => {
        if (!active) return;
        const nextMeals = Array.isArray(data?.comidas) ? data.comidas : [];
        setMeals(nextMeals.sort((left, right) => {
          const favoriteDifference = Number(Boolean(right?.favorita)) - Number(Boolean(left?.favorita));
          if (favoriteDifference) return favoriteDifference;
          return String(left?.nombre || "").localeCompare(String(right?.nombre || ""), "es");
        }));
      })
      .catch((requestError) => {
        if (!active) return;
        setMeals([]);
        setError(requestError?.message || "No pudimos cargar tus comidas guardadas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mealType, retryKey, sameTypeOnly]);

  useEffect(() => {
    setExpandedMealId("");
  }, [sameTypeOnly, search]);

  const visibleMeals = meals.filter((meal) => {
    const term = search.trim().toLocaleLowerCase("es");
    if (!term) return true;
    const itemNames = (Array.isArray(meal?.items) ? meal.items : [])
      .map((item) => item?.nombre || item?.nombreSnapshot || item?.name || "")
      .join(" ");
    return `${meal?.nombre || ""} ${itemNames}`.toLocaleLowerCase("es").includes(term);
  });

  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.045] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[10px] font-black uppercase tracking-wide text-emerald-200">Mis comidas</span>
          <strong className="mt-1 block text-base font-black text-white">Elegí una comida guardada</strong>
          <p className="mt-1 text-xs font-bold text-zinc-500">Se copiarán sus alimentos y después podrás ajustar las cantidades.</p>
        </div>
        <button type="button" onClick={onCancel} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-zinc-200" aria-label="Cerrar comidas guardadas">
          <X size={16} />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl border border-white/10 bg-black/20 p-1">
        <button
          type="button"
          onClick={() => setSameTypeOnly(true)}
          className={`min-h-9 rounded-xl px-2 text-[11px] font-black transition ${sameTypeOnly ? "bg-emerald-300/15 text-emerald-100" : "text-zinc-500"}`}
        >
          {typeLabel}
        </button>
        <button
          type="button"
          onClick={() => setSameTypeOnly(false)}
          className={`min-h-9 rounded-xl px-2 text-[11px] font-black transition ${!sameTypeOnly ? "bg-emerald-300/15 text-emerald-100" : "text-zinc-500"}`}
        >
          Todas
        </button>
      </div>

      <label className="mt-3 flex min-h-11 items-center gap-2 rounded-2xl border border-white/10 bg-[#080d12] px-3">
        <Search size={15} className="shrink-0 text-emerald-200" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar por nombre o alimento"
          className="min-w-0 flex-1 bg-transparent text-sm font-bold text-white outline-none placeholder:text-zinc-600"
        />
      </label>

      {loading ? (
        <div className="mt-3 flex min-h-24 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 text-sm font-black text-zinc-400">
          <RefreshCw size={16} className="animate-spin text-emerald-200" />
          Cargando tus comidas...
        </div>
      ) : null}

      {!loading && error ? (
        <div className="mt-3 rounded-2xl border border-rose-300/25 bg-rose-300/[0.08] p-3 text-sm font-bold text-rose-100">
          {error}
          <button type="button" onClick={() => setRetryKey((value) => value + 1)} className="mt-2 block min-h-9 rounded-xl border border-rose-200/25 px-3 text-xs font-black">Reintentar</button>
        </div>
      ) : null}

      {!loading && !error && visibleMeals.length ? (
        <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1">
          {visibleMeals.map((meal, mealIndex) => {
            const mealItems = Array.isArray(meal?.items) ? meal.items : [];
            const currentMealId = String(meal?.id || meal?._id || `${meal?.nombre || "meal"}-${mealIndex}`);
            const expanded = expandedMealId === currentMealId;
            const totals = hasTotalValue(totalFromLike(meal?.totales || meal?.totals))
              ? totalFromLike(meal?.totales || meal?.totals)
              : sumTotals(mealItems);
            const firstFood = mealItems[0] ? normalizeMealFood(mealItems[0]) : null;
            return (
              <article
                key={currentMealId}
                className={`overflow-hidden rounded-2xl border bg-black/25 transition ${expanded ? "border-emerald-300/30 shadow-[0_10px_24px_rgba(0,0,0,.20)]" : "border-white/10"}`}
              >
                <button
                  type="button"
                  onClick={() => setExpandedMealId((current) => current === currentMealId ? "" : currentMealId)}
                  disabled={!mealItems.length}
                  aria-expanded={expanded}
                  className="flex min-h-[68px] w-full min-w-0 items-center gap-3 p-3 text-left disabled:opacity-45"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045]">
                    {firstFood ? <FoodThumb food={firstFood} size="sm" /> : <Utensils size={18} className="text-zinc-500" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <strong className="truncate text-sm font-black text-white">{meal?.nombre || "Comida guardada"}</strong>
                      {meal?.favorita ? <Heart size={12} fill="currentColor" className="shrink-0 text-rose-300" /> : null}
                    </span>
                    <span className="mt-1 block truncate text-[11px] font-bold text-zinc-500">
                      {mealItems.length} {mealItems.length === 1 ? "alimento" : "alimentos"} · P {formatNumber(totals.proteina, 0)} / C {formatNumber(totals.carbs, 0)} / G {formatNumber(totals.grasas, 0)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <strong className="text-xs font-black text-[#FFE16A]">{formatNumber(totals.kcal, 0)} kcal</strong>
                    <span className={`grid h-8 w-8 place-items-center rounded-xl border transition ${expanded ? "rotate-180 border-emerald-300/25 bg-emerald-300/10 text-emerald-100" : "border-white/10 bg-white/[0.035] text-zinc-500"}`}>
                      <ChevronDown size={16} />
                    </span>
                  </span>
                </button>

                {expanded ? (
                  <div className="border-t border-white/10 bg-white/[0.025] p-3">
                    <div className="grid gap-1.5">
                      {mealItems.map((item, itemIndex) => {
                        const food = normalizeMealFood(item, itemIndex);
                        const itemNutrition = totalFromLike(item);
                        const quantity = Number(item?.cantidad ?? item?.quantity ?? food?.quantity) || 0;
                        const unit = item?.unidad || item?.unit || food?.unit || "g";
                        return (
                          <div key={`${currentMealId}-food-${String(item?.id || item?.alimentoId || itemIndex)}`} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.07] bg-black/20 px-2.5 py-2">
                            <FoodThumb food={food} size="sm" />
                            <span className="min-w-0 flex-1">
                              <strong className="block truncate text-xs font-black text-zinc-100">{food.name}</strong>
                              <span className="mt-0.5 block text-[10px] font-bold text-zinc-500">
                                {formatNumber(quantity, quantity % 1 ? 1 : 0)} {unit}
                              </span>
                            </span>
                            <strong className="shrink-0 text-[11px] font-black text-[#FFE8A3]">{formatNumber(itemNutrition.kcal, 0)} kcal</strong>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelect?.(meal)}
                      className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/[0.10] px-3 text-sm font-black text-emerald-100"
                    >
                      <CheckCircle2 size={16} />
                      Usar esta comida
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      ) : null}

      {!loading && !error && !visibleMeals.length ? (
        <div className="mt-3 rounded-2xl border border-dashed border-white/15 bg-black/20 p-3 text-sm font-bold text-zinc-400">
          <strong className="block text-white">{search.trim() ? "No encontramos coincidencias." : sameTypeOnly ? `No tenés ${typeLabel.toLowerCase()}s guardados.` : "Todavía no tenés comidas guardadas."}</strong>
          {sameTypeOnly && !search.trim() ? (
            <button type="button" onClick={() => setSameTypeOnly(false)} className="mt-2 min-h-9 rounded-xl border border-emerald-300/25 bg-emerald-300/[0.07] px-3 text-xs font-black text-emerald-100">
              Ver todas mis comidas
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const EMPTY_CUSTOM_FOOD = {
  nombre: "",
  unidad: "g",
  calorias: "",
  proteinas: "",
  carbohidratos: "",
  grasas: "",
};

function customFoodDraft(food = null) {
  if (!food) return { ...EMPTY_CUSTOM_FOOD };
  return {
    nombre: food.nombre || food.name || "",
    unidad: food.unidad || food.unit || "g",
    calorias: String(food.kcal ?? ""),
    proteinas: String(food.proteina ?? food.protein ?? ""),
    carbohidratos: String(food.carbs ?? ""),
    grasas: String(food.grasas ?? food.fat ?? ""),
  };
}

function customFoodCalories(draft = {}) {
  const protein = Math.max(0, Number(String(draft.proteinas || "0").replace(",", ".")) || 0);
  const carbs = Math.max(0, Number(String(draft.carbohidratos || "0").replace(",", ".")) || 0);
  const fat = Math.max(0, Number(String(draft.grasas || "0").replace(",", ".")) || 0);
  return Math.round((protein * 4 + carbs * 4 + fat * 9) * 10) / 10;
}

function CustomFoodLibrary({ onClose, onSelect }) {
  const [state, setState] = useState({ items: [], usage: 0, limit: 0, canCreate: false, plan: "free" });
  const [view, setView] = useState("list");
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(() => customFoodDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listCustomFoods();
      setState({
        items: Array.isArray(data.items) ? data.items : [],
        usage: Number(data.usage) || 0,
        limit: Number(data.limit) || 0,
        canCreate: data.canCreate === true,
        plan: data.plan || "free",
      });
    } catch (err) {
      setError(err?.message || "No pudimos cargar tus alimentos personalizados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function openForm(food = null) {
    setEditing(food);
    setDraft(customFoodDraft(food));
    setError("");
    setView("form");
  }

  function updateDraft(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveFood() {
    if (!draft.nombre.trim()) {
      setError("Escribi un nombre para el alimento.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = {
        nombre: draft.nombre.trim(),
        unidad: draft.unidad,
        calorias: customFoodCalories(draft),
        proteinas: draft.proteinas,
        carbohidratos: draft.carbohidratos,
        grasas: draft.grasas,
      };
      if (editing) {
        const updated = await updateCustomFood(editing.id, payload);
        setState((current) => ({
          ...current,
          items: current.items.map((item) => item.id === updated.id ? updated : item),
        }));
        setEditing(null);
        setView("list");
      } else {
        const created = await createCustomFood(payload);
        onSelect?.(created);
      }
    } catch (err) {
      setError(err?.message || "No pudimos guardar el alimento.");
    } finally {
      setSaving(false);
    }
  }

  async function removeFood(food) {
    if (!window.confirm(`Eliminar ${foodDisplayName(food)} de tus alimentos personalizados?`)) return;
    setError("");
    try {
      await deleteCustomFood(food.id);
      setState((current) => ({
        ...current,
        usage: Math.max(0, current.usage - 1),
        items: current.items.filter((item) => item.id !== food.id),
      }));
    } catch (err) {
      setError(err?.message || "No pudimos eliminar el alimento.");
    }
  }

  const atLimit = state.limit > 0 && state.usage >= state.limit;
  return (
    <section className="rounded-3xl border border-emerald-300/20 bg-emerald-300/[0.055] p-3">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={view === "form" ? () => setView("list") : onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-zinc-100" aria-label="Volver">
          <ChevronLeft size={16} />
        </button>
        <div className="min-w-0 flex-1">
          <span className="block text-[10px] font-black uppercase tracking-[0.16em] text-emerald-300">Biblioteca privada</span>
          <strong className="block truncate text-sm font-black text-white">{view === "form" ? (editing ? "Editar alimento" : "Nuevo alimento") : "Mis alimentos"}</strong>
        </div>
        {state.limit ? <span className="rounded-full border border-emerald-300/20 bg-black/20 px-2.5 py-1 text-[10px] font-black text-emerald-100">{state.usage}/{state.limit}</span> : null}
      </div>

      {error ? <div className="mt-3 rounded-2xl border border-rose-400/25 bg-rose-400/10 p-3 text-xs font-bold text-rose-100">{error}</div> : null}

      {view === "form" ? (
        <div className="mt-3 grid gap-3">
          <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3">
            <div className="flex items-center gap-2 text-[#FFE8A3]"><Sparkles size={15} /><strong className="text-xs font-black">{draft.unidad === "unidad" ? "Valores nutricionales por 1 unidad" : `Valores nutricionales cada 100 ${draft.unidad}`}</strong></div>
            <p className="mt-1 text-[11px] font-bold text-zinc-500">Solo vos y el administrador pueden verlo. No se usa en generaciones automaticas.</p>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_88px] gap-2">
            <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">Nombre<input autoFocus maxLength={80} value={draft.nombre} onChange={(event) => updateDraft("nombre", event.target.value)} placeholder="Ej. Yogur casero" className="min-h-11 rounded-2xl border border-white/10 bg-black/25 px-3 text-sm font-black normal-case text-white outline-none" /></label>
            <label className="grid gap-1 text-[10px] font-black uppercase tracking-wide text-zinc-500">Unidad<select value={draft.unidad} onChange={(event) => updateDraft("unidad", event.target.value)} className="min-h-11 rounded-2xl border border-white/10 bg-[#0b1115] px-3 text-sm font-black normal-case text-white outline-none"><option value="g">100 g</option><option value="ml">100 ml</option><option value="unidad">1 unid</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1 rounded-2xl border border-amber-300/15 bg-amber-300/[0.04] p-2.5 text-[10px] font-black uppercase tracking-wide text-zinc-500">
              Calorias
              <span className="flex items-center gap-2"><output className="min-w-0 flex-1 text-base font-black normal-case text-amber-200">{formatNumber(customFoodCalories(draft), 1)}</output><span className="text-[10px] text-zinc-600">kcal</span></span>
            </div>
            {[
              ["proteinas", "Proteinas", "g", "text-emerald-200"],
              ["carbohidratos", "Carbos", "g", "text-sky-200"],
              ["grasas", "Grasas", "g", "text-violet-200"],
            ].map(([field, fieldLabel, suffix, color]) => (
              <label key={field} className="grid gap-1 rounded-2xl border border-white/10 bg-black/20 p-2.5 text-[10px] font-black uppercase tracking-wide text-zinc-500">
                {fieldLabel}
                <span className="flex items-center gap-2"><input type="number" min="0" step="0.1" inputMode="decimal" value={draft[field]} onChange={(event) => updateDraft(field, event.target.value)} placeholder="0" className={`min-w-0 flex-1 bg-transparent text-base font-black normal-case outline-none ${color}`} /><span className="text-[10px] text-zinc-600">{suffix}</span></span>
              </label>
            ))}
          </div>
          <button type="button" disabled={saving} onClick={saveFood} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-300/30 bg-emerald-300/[0.12] px-4 text-sm font-black text-emerald-100 disabled:opacity-50">
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {editing ? "Guardar cambios" : "Crear y usar alimento"}
          </button>
        </div>
      ) : (
        <div className="mt-3 grid gap-2">
          {loading ? <div className="grid min-h-24 place-items-center"><RefreshCw size={18} className="animate-spin text-emerald-300" /></div> : null}
          {!loading && state.canCreate ? (
            <button type="button" disabled={atLimit} onClick={() => openForm()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-emerald-300/35 bg-emerald-300/[0.06] px-3 text-sm font-black text-emerald-100 disabled:cursor-not-allowed disabled:opacity-45">
              <Plus size={16} /> {atLimit ? "Limite de 30 alcanzado" : "Crear alimento personalizado"}
            </button>
          ) : null}
          {!loading && !state.canCreate ? (
            <div className="rounded-2xl border border-[#D4AF37]/20 bg-[#D4AF37]/[0.055] p-3 text-xs font-bold text-zinc-300"><strong className="block text-[#FFE8A3]">Funcion exclusiva para clientes Pro</strong><span className="mt-1 block text-zinc-500">Con Pro podes crear hasta 30 alimentos privados.</span></div>
          ) : null}
          {!loading && state.items.map((food) => (
            <article key={food.id} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/20 p-2">
              <button type="button" onClick={() => onSelect?.(food)} className="min-w-0 flex-1 p-1 text-left">
                <strong className="block truncate text-sm font-black text-white">{foodDisplayName(food)}</strong>
                <span className="mt-0.5 block truncate text-[11px] font-bold text-zinc-500">{foodDisplayUnit(food) === "unidad" ? "1 unidad" : `100 ${foodDisplayUnit(food)}`} · {displayKcal(food.kcal)} · P {formatNumber(food.proteina, 1)} / C {formatNumber(food.carbs, 1)} / G {formatNumber(food.grasas, 1)}</span>
              </button>
              {state.canCreate ? <button type="button" onClick={() => openForm(food)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-sky-300/20 bg-sky-300/[0.07] text-sky-200" aria-label={`Editar ${foodDisplayName(food)}`}><PencilLine size={15} /></button> : null}
              <button type="button" onClick={() => removeFood(food)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-rose-300/20 bg-rose-300/[0.07] text-rose-200" aria-label={`Eliminar ${foodDisplayName(food)}`}><Trash2 size={15} /></button>
            </article>
          ))}
          {!loading && state.canCreate && !state.items.length ? <div className="rounded-2xl border border-dashed border-white/10 p-3 text-xs font-bold text-zinc-500">Todavia no creaste alimentos. El primero queda listo para usar apenas lo guardes.</div> : null}
        </div>
      )}
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
  const [customFoodsOpen, setCustomFoodsOpen] = useState(false);

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
    setCustomFoodsOpen(false);
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

  if (customFoodsOpen) {
    return <CustomFoodLibrary onClose={() => setCustomFoodsOpen(false)} onSelect={selectFood} />;
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
      <button type="button" onClick={() => setCustomFoodsOpen(true)} className="mb-3 flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.055] px-3 text-left">
        <span className="flex min-w-0 items-center gap-2"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-200"><Plus size={15} /></span><span className="min-w-0"><strong className="block truncate text-xs font-black text-emerald-100">Mis alimentos personalizados</strong><span className="block truncate text-[10px] font-bold text-zinc-500">Crear, editar o elegir · Pro</span></span></span>
        <ChevronRight size={16} className="shrink-0 text-emerald-300" />
      </button>
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

function EmptyMenu({ row, trackingDay = null, onGenerateMeal, onManageMeal }) {
  const actions = React.useContext(MenuAutonomousActionsContext);
  const targetOnlyMeals = plannedMealTargets(row, trackingDay);
  if (targetOnlyMeals.length) {
    return (
      <section className="grid gap-3 rounded-3xl border border-emerald-300/20 bg-emerald-300/[.045] p-4">
        <div>
          <strong className="text-white">Metas por comida</strong>
          <p className="mt-1 text-sm font-semibold text-zinc-400">
            {targetOnlyMeals.some((meal) => meal.personalTargetOnly)
              ? `Creaste ${targetOnlyMeals.length} metas para este día.`
              : `El coach definió ${targetOnlyMeals.length} comidas para este día.`}
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {targetOnlyMeals.map((meal, index) => (


            <PlannedMealTargetCard
              key={meal.id}
              row={row}
              meal={meal}
              mealIndex={index}
              disabled={!onGenerateMeal}

              onEditTarget={editablePersonalMealTargetIds([meal]).length
                ? () => actions?.onEditPersonalTarget?.(meal)
                : null}
              onDeleteTarget={editablePersonalMealTargetIds([meal]).length
                ? (context) => actions?.onDeletePersonalTarget?.(row, meal, context)
                : null}

              onGenerate={(completionContext = {}) => onGenerateMeal?.(meal, index, completionContext)}
              onManage={() => onManageMeal?.(meal, index)}
              onAddFood={() => onManageMeal?.(meal, index, { openFoodPicker: true })}
            />
          ))}

        </div>
        {targetOnlyMeals.some((meal) => meal.personalTargetOnly) ? (
          <div className="grid gap-2 border-t border-white/10 pt-3">
            <EditDayTargetsButton
              disabled={actions?.canPlanMeal === false}
              onClick={() => actions?.onEditPersonalTargetDay?.(row, targetOnlyMeals)}
            />
            <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => actions?.onFormatPersonalTargets?.(row, targetOnlyMeals)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-amber-300/25 bg-amber-300/[0.06] px-3 text-xs font-black text-amber-100"
            >
              <RotateCcw size={15} />
              Formatear metas
            </button>
            <button
              type="button"
              onClick={() => actions?.onDeletePersonalTargets?.(row, targetOnlyMeals)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-rose-300/25 bg-rose-300/[0.06] px-3 text-xs font-black text-rose-100"
            >
              <Trash2 size={15} />
              Eliminar metas
            </button>
            </div>
          </div>
        ) : null}
      </section>
    );
  }
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
        {actions?.canCreate ? <Link
          to="/app/menu/nuevo"
          state={{ from: "/app/menu" }}
          className="inline-flex rounded-2xl border border-[#D4AF37]/25 bg-gradient-to-r from-[#facc15] to-[#f5d76e] px-4 py-2 text-sm font-black text-[#080808]"
          {...createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false })}
        >
          Crear mi menu
        </Link> : null}
        {actions?.canUseLibrary ? <a href="/app/nutricion" className="inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-black text-zinc-100">
          Explorar ZumaFit
        </a> : null}
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
  canCreateEquivalentMeal = false,
  onCreateEquivalentMeal,
  canReplaceFoods,
  readOnlyProfessionalMenu = false,
  onApplyMealReplacement,
  onSaveAsSavedMeal,

  onSetMealTargetMode,
  onTargetTrackingChanged,
  onTargetToast,

  saving,
}) {
  const row = useMemo(() => context?.row || {}, [context?.row]);

  const meal = context?.meal || {};
  const baseMeal = context?.baseMeal || meal;
  const mealIndex = context?.mealIndex || 0;

  const nativeTarget =
  context?.nativeTarget === true;

  const manual =
    !!context?.manual ||
    meal?.source === "manual_food";

  const generated =
    !!context?.generated ||
    meal?.source === "generated_remaining_meal";

  const [replaceOpen, setReplaceOpen] = useState(
    context?.initialView === "replace"
  );

  /* =====================================================
     MODO POR META
     ===================================================== */

  const [targetMode, setTargetMode] = useState(
    context?.initialView === "target"
  );

  const [
  restoreProposalConfirm,
  setRestoreProposalConfirm,
] = useState(null);

const [
  restoreProposalSaving,
  setRestoreProposalSaving,
] = useState(false);

  const done = completedMealIdSet(row).has(
    mealId(baseMeal, mealIndex)
  );

  const isCurrentlyTargetMode =
  isMealTargetMode(
    row,
    baseMeal,
    mealIndex
  );

  const foods = mealFoods(meal);
  const totals = mealTotals(meal);

  const targetExecution = menuTargetExecutionContext(
  row,
  meal,
  baseMeal,
  mealIndex
);

const trackingDate =
  row?.date ||
  context?.date ||
  todayIso();

const targetTrackingQuery =
  useTrackingDay(
    trackingDate
  );

const targetDeleteMutation =
  useDeleteFoodLog();

const restoringProposal =
  restoreProposalSaving ||
  targetDeleteMutation.isPending;

  const replacementOptions = useMemo(
    () =>
      mealReplacementOptions(
        row,
        baseMeal,
        mealIndex
      ),
    [row, baseMeal, mealIndex]
  );

  const canEditThisMeal =
    canEditOwnMenuMeal &&
    !manual &&
    !generated;

  /*
    Si cambia la vista inicial mientras el drawer
    está montado, sincronizamos ambos modos.
  */
  useEffect(() => {
    setReplaceOpen(
      context?.initialView === "replace"
    );

    setTargetMode(
      context?.initialView === "target"
    );
  }, [context?.initialView]);

  /*
    Bloquear scroll del body mientras está abierto.
  */
  useEffect(() => {
    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, []);

  async function restoreOriginalProposal(
  itemsToDelete = []
) {
  if (
    restoreProposalSaving ||
    saving
  ) {
    return false;
  }

  setRestoreProposalSaving(true);

  try {
    /*
     * =========================================
     * 1. BORRAR TRACKING REAL
     * =========================================
     *
     * Primero eliminamos los FoodLogs.
     *
     * Así nunca queda:
     *
     * Pendiente
     * +
     * FoodLogs Por meta todavía activos.
     */

    for (const item of itemsToDelete) {
      if (!item?.id) continue;

      await targetDeleteMutation
        .mutateAsync({
          logId: item.id,
          date: trackingDate,
        });
    }


    /*
     * Refrescamos Tracking después
     * de eliminar los registros.
     */

    if (itemsToDelete.length) {
      await targetTrackingQuery
        .refetch();
    }


    /*
     * =========================================
     * 2. SALIR DE POR META
     * =========================================
     */

    const restored =
      await onSetMealTargetMode?.({
        row,
        meal: baseMeal,
        mealIndex,
        active: false,
      });


    /*
     * Si falló guardar targetMealIds,
     * NO seguimos modificando la UI.
     *
     * En el peor caso quedará:
     *
     * Por meta
     * 0 kcal
     *
     * que es consistente y recuperable.
     */

    if (restored === false) {
      return false;
    }


    /*
     * =========================================
     * 3. ACTUALIZAR UI
     * =========================================
     */

    setRestoreProposalConfirm(
      null
    );

    setTargetMode(
      false
    );

    await onTargetTrackingChanged?.();

    return true;

  } catch (error) {
    console.error(
      "Error restaurando propuesta:",
      error
    );

    onTargetToast?.(
      error?.message ||
      "No se pudo volver a la propuesta."
    );

    return false;

  } finally {
    setRestoreProposalSaving(
      false
    );
  }
}


async function requestRestoreOriginalProposal() {
  if (
    restoreProposalSaving ||
    saving
  ) {
    return;
  }

  try {
    /*
     * Traemos Tracking fresco.
     *
     * Esto evita decidir con datos viejos
     * si acabás de agregar o borrar
     * un alimento.
     */

    const refreshed =
      await targetTrackingQuery
        .refetch();

    const freshItems =
      trackingItemsForExecution(
        refreshed.data,
        targetExecution.id
      );


    /*
     * =========================================
     * HAY ALIMENTOS
     * =========================================
     *
     * No restauramos todavía.
     * Primero confirmación.
     */

    if (freshItems.length) {
      setRestoreProposalConfirm({
        items:
          freshItems,

        totals:
          sumTotals(
            freshItems
          ),
      });

      return;
    }


    /*
     * =========================================
     * NO HAY ALIMENTOS
     * =========================================
     *
     * Podemos volver directamente.
     */

    await restoreOriginalProposal(
      []
    );

  } catch (error) {
    onTargetToast?.(
      error?.message ||
      "No pudimos revisar los registros de esta comida."
    );
  }
}


  return (
    <section
      className="
        fixed inset-0 z-[100]
        flex items-end
        bg-black/80
        p-0
        backdrop-blur-md

        sm:items-center
        sm:px-3
        sm:py-5
      "
      role="dialog"
      aria-modal="true"
    >
      <div
        className="
          mx-auto
          flex
          h-[100dvh]
          max-h-[100dvh]
          w-full
          max-w-2xl
          flex-col
          overflow-hidden

          border
          border-white/10

          bg-[radial-gradient(circle_at_18%_0,rgba(45,212,191,.13),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(212,175,55,.15),transparent_30%),linear-gradient(180deg,#111a25,#080d13)]

          shadow-[0_24px_80px_rgba(0,0,0,.62)]

          sm:h-auto
          sm:max-h-[82dvh]
          sm:rounded-[1.6rem]
        "
      >

        {/* =================================================
            HEADER — SIEMPRE VISIBLE
            ================================================= */}

        <header
          className="
            flex
            shrink-0
            items-start
            justify-between
            gap-2.5

            border-b
            border-white/10

            bg-[#0d151f]/95

            px-3
            pb-3
            pt-[calc(.75rem+env(safe-area-inset-top))]

            backdrop-blur-md

            sm:gap-3
            sm:p-4
          "
        >
          {targetMode ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.055] text-zinc-300 shadow-[0_6px_18px_rgba(0,0,0,.22)]"
                    aria-label="Volver"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <span className="text-[8px] font-black uppercase tracking-wide text-zinc-500">
                    Comida
                  </span>
                  <span className="rounded-full border border-emerald-300/40 bg-emerald-300/10 px-2 py-0.5 text-[8px] font-black uppercase tracking-wide text-emerald-200 shadow-[0_0_16px_rgba(52,211,153,.10)]">
                    Por meta
                  </span>
                  {nativeTarget ? (
                    <span className="rounded-full border border-sky-300/20 bg-sky-300/[0.08] px-2 py-0.5 text-[8px] font-black text-sky-100">
                      Meta del coach
                    </span>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/[0.07] text-zinc-100 shadow-[0_8px_22px_rgba(0,0,0,.24)]"
                  aria-label="Cerrar"
                >
                  <X size={19} />
                </button>
              </div>

              <div className="mt-2 flex min-w-0 items-center gap-2.5">
                <MealTypeIcon meal={meal} index={mealIndex} done={done} />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-xl font-black leading-tight text-white">
                    {mealName(meal, mealIndex)}
                  </h3>
                  <div className="mt-1 flex min-w-0 items-center gap-1">
                    <span className="rounded-full border border-[#D4AF37]/40 bg-[#D4AF37]/10 px-2 py-0.5 text-[9px] font-black text-[#FFE16B] shadow-[0_0_14px_rgba(212,175,55,.10)]">
                      {displayKcal(totals.kcal)}
                    </span>
                    <span className="rounded-full border border-emerald-300/20 bg-black/20 px-2 py-0.5 text-[9px] font-black text-emerald-300">P&nbsp; {formatNumber(totals.proteina, 0)} g</span>
                    <span className="rounded-full border border-cyan-300/20 bg-black/20 px-2 py-0.5 text-[9px] font-black text-cyan-300">C&nbsp; {formatNumber(totals.carbs, 0)} g</span>
                    <span className="rounded-full border border-violet-300/20 bg-black/20 px-2 py-0.5 text-[9px] font-black text-violet-300">G&nbsp; {formatNumber(totals.grasas, 0)} g</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <>
          <div className="flex min-w-0 items-center gap-3">

            <MealTypeIcon
              meal={meal}
              index={mealIndex}
              done={done}
            />

            <div className="min-w-0">

              <div className="flex min-w-0 flex-wrap items-center gap-1.5">

                <span className="text-[10px] font-black uppercase tracking-wide text-[#FFE8A3]">
                  Comida
                </span>

                {targetMode ? (
                  <span className="rounded-full border border-teal-300/30 bg-teal-300/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-teal-100">
                    Por meta
                  </span>
                ) : null}



{nativeTarget ? (
  <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[9px] font-black text-sky-100">
    Meta del coach
  </span>
) : readOnlyProfessionalMenu ? (
  <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2 py-0.5 text-[9px] font-black text-sky-100">
    Coach · Solo lectura
  </span>
) : null}


              </div>

              <h3 className="mt-0.5 truncate text-xl font-black leading-tight text-white sm:mt-1 sm:text-2xl">
                {mealName(meal, mealIndex)}
              </h3>

              <div className="mt-1.5 flex flex-wrap items-center gap-1 sm:mt-2 sm:gap-1.5">

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

          <button
            type="button"
            onClick={onClose}
            className="
              grid
              h-10
              w-10
              shrink-0
              place-items-center

              rounded-xl
              border
              border-white/15

              bg-white/[0.07]

              text-zinc-100

              shadow-[0_8px_22px_rgba(0,0,0,.24)]

              sm:h-11
              sm:w-11
              sm:rounded-2xl
            "
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
          </>
          )}

        </header>


        {/* =================================================
            VISTA POR META
            ================================================= */}


{targetMode ? (
<MealTargetTrackingPanel
  date={row?.date || context?.date}
  mealId={targetExecution.id}
  mealName={targetExecution.label}
  mealType={targetExecution.type}
  target={targetExecution.target}

  nativeTarget={nativeTarget}
  openFoodPickerOnMount={context?.openFoodPicker === true}

  onBack={requestRestoreOriginalProposal}
  onChanged={onTargetTrackingChanged}
  onToast={onTargetToast}
/>
) : (

          /* =================================================
             VISTA NORMAL ACTUAL
             ================================================= */

          <div className="min-h-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:p-4">


            {/* COMPLETADA / GENERADA / MANUAL */}

            {generated || manual ? (

              <div
                className={`
                  mb-3
                  flex
                  min-h-12
                  w-full
                  items-center
                  justify-between
                  rounded-2xl
                  border
                  px-4
                  text-sm
                  font-black
                  shadow-[0_10px_24px_rgba(0,0,0,.20)]

                  ${
                    manual
                      ? "border-sky-300/35 bg-sky-300/10 text-sky-100"
                      : "border-emerald-300/35 bg-emerald-300/10 text-emerald-100"
                  }
                `}
              >

                <span>
                  {manual
                    ? "Registro manual sumado al dia"
                    : "Generada y guardada para esta semana"}
                </span>

                {manual ? (
                  <Utensils size={20} />
                ) : (
                  <CheckSquare2 size={20} />
                )}

              </div>

            ) : (

              <button
                type="button"
                disabled={!canMarkMeals || saving}
                onClick={() => {
                  onToggleMeal(
                    row,
                    baseMeal,
                    mealIndex
                  );

                  onClose();
                }}
                className={`
                  mb-3
                  flex
                  min-h-12
                  w-full
                  items-center
                  justify-between

                  rounded-2xl
                  border

                  px-4

                  text-sm
                  font-black

                  shadow-[0_10px_24px_rgba(0,0,0,.20)]

                  transition
                  active:scale-[0.99]

                  disabled:opacity-50

                  ${
                    done
                      ? "border-emerald-300/45 bg-[linear-gradient(135deg,rgba(16,185,129,.22),rgba(212,175,55,.08))] text-emerald-50"
                      : "border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#FFE8A3]"
                  }
                `}
                aria-pressed={done}
              >

                <span>
                  {done
                    ? "Comida completa"
                    : "Marcar completo"}
                </span>

                {done ? (
                  <CheckSquare2 size={20} />
                ) : (
                  <Square size={20} />
                )}

              </button>

            )}


            {/* EDITAR COMIDA */}

            {canEditThisMeal ? (

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  onQuickEditMeal?.({
                    ...context,
                    row,
                    meal,
                    baseMeal,
                    mealIndex,
                  })
                }
                className="
                  mb-3
                  flex
                  min-h-12
                  w-full
                  items-center
                  justify-between

                  rounded-2xl

                  border
                  border-emerald-300/25

                  bg-emerald-300/10

                  px-4

                  text-sm
                  font-black
                  text-emerald-100

                  shadow-[0_10px_24px_rgba(0,0,0,.18)]

                  transition
                  active:scale-[0.99]

                  disabled:opacity-55
                "
              >

                <span className="flex min-w-0 items-center gap-2">

                  {foods.length ? (
                    <PencilLine
                      size={17}
                      className="shrink-0"
                    />
                  ) : (
                    <Plus
                      size={17}
                      className="shrink-0"
                    />
                  )}

                  <span className="truncate">
                    {foods.length
                      ? "Editar alimentos del menu"
                      : "Agregar alimentos al menu"}
                  </span>

                </span>

                <ChevronRight
                  size={18}
                  className="shrink-0"
                />

              </button>

            ) : null}


            {/* GUARDAR EN MIS COMIDAS */}

            <button
              type="button"
              disabled={
                saving ||
                !foods.length
              }
              onClick={() =>
                onSaveAsSavedMeal?.(
                  meal,
                  mealIndex
                )
              }
              className="
                mb-3
                flex
                min-h-12
                w-full
                items-center
                justify-between

                rounded-2xl

                border
                border-[#D4AF37]/35

                bg-[#D4AF37]/10

                px-4

                text-sm
                font-black
                text-[#FFE8A3]

                shadow-[0_10px_24px_rgba(0,0,0,.18)]

                transition
                active:scale-[0.99]

                disabled:opacity-55
              "
            >

              <span className="flex min-w-0 items-center gap-2">

                <Plus
                  size={17}
                  className="shrink-0"
                />

                <span className="truncate">
                  Guardar en Mis comidas
                </span>

              </span>

              {saving ? (
                <RefreshCw
                  size={18}
                  className="shrink-0 animate-spin"
                />
              ) : (
                <ChevronRight
                  size={18}
                  className="shrink-0"
                />
              )}

            </button>


            {/* CAMBIAR COMIDA */}

            {!generated && !manual ? (

              <div className="mb-3">

                <button
                  type="button"
                  disabled={
                    !canReplaceMeals ||
                    saving
                  }
                  onClick={() =>
                    setReplaceOpen(
                      (value) => !value
                    )
                  }
                  className={`
                    flex
                    min-h-12
                    w-full
                    items-center
                    justify-between

                    rounded-2xl
                    border

                    px-4

                    text-sm
                    font-black

                    shadow-[0_10px_24px_rgba(0,0,0,.18)]

                    transition
                    active:scale-[0.99]

                    disabled:opacity-55

                    ${
                      canReplaceMeals
                        ? "border-white/10 bg-white/[0.055] text-zinc-100"
                        : "border-white/10 bg-white/[0.025] text-zinc-500"
                    }
                  `}
                >

                  <span className="flex min-w-0 items-center gap-2">

                    <RefreshCw
                      size={17}
                      className="shrink-0 text-[#FFD76B]"
                    />

                    <span className="truncate">
                      {canReplaceMeals
                        ? "Cambiar para este día"
                        : "Tu coach no habilitó cambios"}
                    </span>

                  </span>

                  <ChevronRight
                    size={18}
                    className={`
                      shrink-0
                      transition

                      ${
                        replaceOpen
                          ? "rotate-90"
                          : ""
                      }
                    `}
                  />

                </button>


                {readOnlyProfessionalMenu &&
                canReplaceMeals ? (

                  <p className="mt-1.5 px-1 text-[11px] font-bold leading-snug text-sky-100/65">
                    Solo cambia tu tracking de hoy.
                    El menú profesional del coach
                    permanece intacto.
                  </p>

                ) : null}


                {meal.replacementMeta?.approvalStatus ===
                "pending_review" ? (

                  <div
                    className="mt-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[11px] font-black text-amber-100"
                    role="status"
                  >
                    Pendiente de aprobacion del coach.
                    Todavia no se puede marcar como consumida.
                  </div>

                ) : null}


                {meal.replacementMeta?.approvalStatus ===
                "rejected" ? (

                  <div
                    className="mt-2 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 py-2 text-[11px] font-black text-rose-100"
                    role="alert"
                  >
                    Rechazada por el coach
                    {meal.replacementMeta
                      .approvalReason
                      ? `: ${meal.replacementMeta.approvalReason}`
                      : ". Podes duplicarla y corregirla."}
                  </div>

                ) : null}

              </div>

            ) : null}


            {/* PANEL DE REEMPLAZO */}

            {replaceOpen ? (

              <MobileMealReplacementPanel
                row={row}
                meal={baseMeal}
                mealIndex={mealIndex}
                options={replacementOptions}
                saving={saving}
                onApply={
                  onApplyMealReplacement
                }
                canCreateEquivalentMeal={
                  canCreateEquivalentMeal
                }
                onBrowseLibrary={() =>
                  onCreateEquivalentMeal?.({
                    ...context,
                    row,
                    meal,
                    baseMeal,
                    mealIndex,
                    initialSection: "library",
                  })
                }
                onConfigureFoods={() =>
                  onCreateEquivalentMeal?.({
                    ...context,
                    row,
                    meal,
                    baseMeal,
                    mealIndex,
                    initialSection: "settings",
                  })
                }
              />

            ) : null}


            {/* LISTA DE ALIMENTOS */}

            <div
              className="
                overflow-hidden

                rounded-[1.25rem]

                border
                border-white/10

                bg-[linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.025))]

                shadow-[inset_0_1px_0_rgba(255,255,255,.04),0_14px_32px_rgba(0,0,0,.22)]
              "
            >

              {foods.length ? (

                <div className="divide-y divide-white/[0.07]">

                  {foods.map(
                    (food, foodIndex) => (

                      <MobileFoodRow
                        key={`${food.id}-${foodIndex}`}
                        meal={baseMeal}
                        mealIndex={mealIndex}
                        food={food}
                        foodIndex={foodIndex}
                        onOpenFood={onOpenFood}
                        canReplaceFoods={
                          !manual &&
                          canReplaceFoods
                        }
                      />

                    )
                  )}

                </div>

              ) : (

                <div className="p-4 text-sm font-bold text-zinc-500">
                  Sin alimentos cargados.
                </div>

              )}

            </div>


            {/* =============================================
                VOLVER DESDE LA PROPUESTA ORIGINAL
                ============================================= */}

            {isCurrentlyTargetMode ? (
              <div className="mt-4 border-t border-white/10 pt-4">

                <div className="
                  rounded-2xl
                  border border-[#D4AF37]/25
                  bg-[#D4AF37]/[0.07]
                  p-3
                ">

                  <div className="flex items-start gap-2.5">

                    <span className="
                      grid h-9 w-9 shrink-0 place-items-center
                      rounded-xl
                      border border-[#D4AF37]/30
                      bg-[#D4AF37]/10
                      text-[#FFE8A3]
                    ">
                      <RotateCcw size={17} />
                    </span>

                    <div className="min-w-0">

                      <strong className="
                        block
                        text-sm
                        font-black
                        text-white
                      ">
                        ¿Querés volver a esta propuesta?
                      </strong>

                      <p className="
                        mt-1
                        text-[11px]
                        font-bold
                        leading-relaxed
                        text-zinc-400
                      ">
                        Esta comida está actualmente en modo Por meta.
                        Podés restaurar la propuesta original.
                      </p>

                    </div>

                  </div>

<button
  type="button"

  disabled={
    saving ||
    restoringProposal
  }

  onClick={
    requestRestoreOriginalProposal
  }

  className="
    mt-3
    inline-flex
    min-h-11
    w-full
    items-center
    justify-center
    gap-2

    rounded-2xl

    border
    border-[#D4AF37]/40

    bg-[#D4AF37]/10

    px-4

    text-sm
    font-black
    text-[#FFE8A3]

    transition
    active:scale-[0.99]

    disabled:opacity-50
  "
>
  {restoringProposal ? (
    <RefreshCw
      size={16}
      className="animate-spin"
    />
  ) : (
    <RotateCcw size={16} />
  )}

  {restoringProposal
    ? "Revisando..."
    : "Volver a esta propuesta"}
</button>

                </div>

              </div>
            ) : null}


          </div>

        )}

      </div>


{restoreProposalConfirm ? (
  <section
    className="
      fixed inset-0 z-[190]
      flex items-end justify-center
      bg-black/80
      px-3 pb-3 pt-10
      backdrop-blur-md
      sm:items-center sm:p-6
    "
    role="dialog"
    aria-modal="true"
  >

    <button
      type="button"
      className="absolute inset-0 cursor-default"
      disabled={restoringProposal}
      onClick={() => {
        if (!restoringProposal) {
          setRestoreProposalConfirm(null);
        }
      }}
      aria-label="Cancelar"
    />


    <div
      className="
        relative
        w-full max-w-md

        rounded-[1.6rem]

        border border-rose-300/20

        bg-[radial-gradient(circle_at_15%_0,rgba(244,63,94,.15),transparent_35%),linear-gradient(180deg,#121922,#080d13)]

        p-4

        shadow-[0_28px_90px_rgba(0,0,0,.75)]
      "
    >

      <div className="flex items-start gap-3">

        <span
          className="
            grid h-11 w-11 shrink-0 place-items-center
            rounded-2xl
            border border-rose-300/30
            bg-rose-300/10
            text-rose-200
          "
        >
          <Trash2 size={19} />
        </span>


        <div className="min-w-0">

          <span
            className="
              text-[10px]
              font-black
              uppercase
              tracking-[0.1em]
              text-rose-200
            "
          >
            Registros existentes
          </span>

          <h3
            className="
              mt-1
              text-lg
              font-black
              text-white
            "
          >
            ¿Volver a la propuesta?
          </h3>

          <p
            className="
              mt-2
              text-sm
              font-bold
              leading-relaxed
              text-zinc-300
            "
          >
            Ya registraste{" "}
            <strong className="text-white">
              {formatNumber(
                restoreProposalConfirm?.totals?.kcal,
                0
              )} kcal
            </strong>{" "}
            en esta comida.
          </p>

          <p
            className="
              mt-1
              text-xs
              font-bold
              leading-relaxed
              text-zinc-500
            "
          >
            Si volvés a la propuesta original,
            esos alimentos se eliminarán también de Tracking.
          </p>

        </div>

      </div>


      <div
        className="
          mt-4
          flex items-center justify-between gap-3
          rounded-2xl
          border border-white/10
          bg-black/20
          px-3 py-2.5
        "
      >

        <span className="text-xs font-bold text-zinc-400">
          Registros a descartar
        </span>

        <strong className="text-xs font-black text-white">
          {restoreProposalConfirm?.items?.length || 0} alimento{
            (restoreProposalConfirm?.items?.length || 0) === 1
              ? ""
              : "s"
          }
        </strong>

      </div>


      <div className="mt-4 grid gap-2">

        <button
          type="button"

          disabled={restoringProposal}

          onClick={() => {
            void restoreOriginalProposal(
              restoreProposalConfirm?.items || []
            );
          }}

          className="
            inline-flex min-h-12
            items-center justify-center gap-2

            rounded-2xl

            border border-rose-300/35
            bg-rose-300/12

            px-4

            text-sm font-black
            text-rose-100

            disabled:opacity-50
          "
        >

          {restoringProposal ? (
            <RefreshCw
              size={16}
              className="animate-spin"
            />
          ) : (
            <Trash2 size={16} />
          )}

          {restoringProposal
            ? "Descartando..."
            : "Descartar registros y volver"}

        </button>


        <button
          type="button"

          disabled={restoringProposal}

          onClick={() =>
            setRestoreProposalConfirm(null)
          }

          className="
            min-h-11

            rounded-2xl

            border border-white/10
            bg-white/[0.045]

            px-4

            text-sm font-black
            text-zinc-200

            disabled:opacity-50
          "
        >
          Cancelar
        </button>

      </div>

    </div>

  </section>
) : null}



    </section>
  );
}





function MobileMealReplacementPanel({
  row,
  meal,
  mealIndex,
  options = [],
  saving,
  onApply,
  canCreateEquivalentMeal = false,
  onBrowseLibrary,
  onConfigureFoods,
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const originalTotals = mealTotals(meal);
  const activeOption = options[activeIndex] || null;

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(0, options.length - 1)));
  }, [options.length]);

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

      {canCreateEquivalentMeal ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button type="button" onClick={onBrowseLibrary} disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/[0.08] px-2 text-[11px] font-black text-cyan-100 disabled:opacity-50">
            <WandSparkles size={16} /> Armar alternativa
          </button>
          <button type="button" onClick={onConfigureFoods} disabled={saving} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-2 text-[11px] font-black text-[#FFE8A3] disabled:opacity-50">
            <SlidersHorizontal size={16} /> Por alimentos
          </button>
        </div>
      ) : null}

      {options.length ? (
        <div className="mt-3 grid gap-2">
          <div className="flex items-center justify-between gap-2">
            <button type="button" onClick={() => setActiveIndex((index) => Math.max(0, index - 1))} disabled={activeIndex === 0} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/20 text-zinc-200 disabled:opacity-30" aria-label="Alternativa anterior"><ChevronLeft size={18} /></button>
            <span className="text-center text-[10px] font-black uppercase tracking-wide text-zinc-500">Alternativa del coach {activeIndex + 1}/{options.length}</span>
            <button type="button" onClick={() => setActiveIndex((index) => Math.min(options.length - 1, index + 1))} disabled={activeIndex >= options.length - 1} className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-black/20 text-zinc-200 disabled:opacity-30" aria-label="Alternativa siguiente"><ChevronRight size={18} /></button>
          </div>
          <article className="rounded-2xl border border-[#D4AF37]/40 bg-[#D4AF37]/10 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate text-sm font-black text-white">{mealName(activeOption.meal, mealIndex)}</strong>
                <span className="mt-1 block text-xs font-bold text-zinc-400">
                  {displayKcal(activeOption.totals.kcal)} - P {formatNumber(activeOption.totals.proteina, 0)} g - {mealFoods(activeOption.meal).length} alimentos
                </span>
              </div>
              <span className="shrink-0 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-black text-emerald-200">{activeOption.badge}</span>
            </div>
            <div className="mt-2 text-[11px] font-bold text-zinc-500">Dif. {signedNumber(activeOption.diff.kcal)} kcal - P {signedNumber(activeOption.diff.proteina)} g</div>
          </article>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border border-dashed border-white/15 p-3 text-sm font-bold text-zinc-500">
          No hay comidas alternativas compatibles para este horario.
        </div>
      )}

      {activeOption ? (
        <div className="mt-3 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-3">
          <p className="text-sm font-black text-white">
            Usar {mealName(activeOption.meal, mealIndex)} en lugar de {mealName(meal, mealIndex)}?
          </p>
          <p className="mt-1 text-xs font-bold text-zinc-400">
            Se guarda como ajuste de tracking. Meta original: {displayKcal(originalTotals.kcal)}.
          </p>
          <button
            type="button"
            disabled={saving}
            onClick={() => onApply?.({ row, originalMeal: meal, replacementMeal: activeOption.meal, mealIndex })}
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
              onClick={() => onApplyReplacement?.({ ...context, replacement: selected, recalculateOtherAutos: false })}
              className="rounded-2xl border border-[#D4AF37]/35 bg-[#D4AF37]/10 px-4 py-3 text-sm font-black text-[#FFE8A3] disabled:opacity-45"
            >
              {saving ? "Guardando..." : "Reemplazar"}
            </button>
            <button
              type="button"
              disabled={!selected || !canReplaceFoods || saving}
              onClick={() => onApplyReplacement?.({ ...context, replacement: selected, recalculateOtherAutos: true })}
              className="col-span-2 min-h-11 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 px-4 py-3 text-sm font-black text-emerald-100 disabled:opacity-45"
            >
              Reemplazar y recalcular los demas Auto
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
