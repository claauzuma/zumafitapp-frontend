import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FilePlus2,
  Flame,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  Trash2,
  Utensils,
  X,
} from "lucide-react";

import { useAlimentos, useComidas } from "../nutricion/nutricionQueries.js";
import {
  MenuBaseEditor,
  MenuCreationFlow,
} from "../nutricion/NutritionEditors.jsx";
import "../nutricion/nutricion.css";
import {
  NUTRITION_WEEK_DAYS,
  resolveNutritionWeek,
} from "../nutricion/dailyNutritionTargets.js";
import { formatNumber } from "../nutricion/nutricionUtils.js";
import { updateProfessionalClientMenu } from "../profesional/profesionalApi.js";
import {
  invalidateMenusLibrary,
  invalidateProfessionalClient,
  queryClient,
  queryKeys,
} from "../queryClient.js";
import { createMenuBase } from "./menusApi.js";
import { useMenusBase } from "./menusQueries.js";
import {
  MAX_FLEXIBLE_CALORIES,
  assignmentFlexibleCalories,
  assignmentMacroPending,
  buildFlexibleAssignmentMetadata,
  getMenuDayCompatibility,
} from "./menuAssignmentCompatibility.js";
import "./weeklyClientMenus.css";

const DAY_KEYS = NUTRITION_WEEK_DAYS.map((day) => day.key);
const MAX_MENU_ALTERNATIVES = 10;

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function targetMacroValue(target, key) {
  if (key === "protein") return toNumber(target?.p, 0);
  if (key === "fat") return toNumber(target?.g, 0);
  return toNumber(target?.c, 0);
}

function formatSigned(value, suffix = "") {
  const number = Math.round(toNumber(value, 0) * 10) / 10;
  if (!number) return `0${suffix}`;
  return `${number > 0 ? "+" : ""}${formatNumber(number, 1)}${suffix}`;
}

function hasAnyMacro(totals = {}) {
  return Boolean(
    toNumber(totals.kcal, 0) ||
    toNumber(totals.protein ?? totals.proteina, 0) ||
    toNumber(totals.carbs, 0) ||
    toNumber(totals.fat ?? totals.grasas, 0)
  );
}

function normalizeMacroTotals(source = {}) {
  const totals = source?.totales || source?.totals || source || {};
  return {
    kcal: toNumber(totals.kcal, 0),
    protein: toNumber(totals.proteina ?? totals.protein, 0),
    carbs: toNumber(totals.carbs, 0),
    fat: toNumber(totals.grasas ?? totals.fat, 0),
  };
}

function addMacroTotals(left = {}, right = {}) {
  return {
    kcal: toNumber(left.kcal, 0) + toNumber(right.kcal, 0),
    protein: toNumber(left.protein, 0) + toNumber(right.protein ?? right.proteina, 0),
    carbs: toNumber(left.carbs, 0) + toNumber(right.carbs, 0),
    fat: toNumber(left.fat, 0) + toNumber(right.fat ?? right.grasas, 0),
  };
}

function normalizeSnapshotFood(item = {}, index = 0) {
  return {
    id: String(item.id || item._id || item.alimentoId || `food-${index + 1}`),
    alimentoId: item.alimentoId || null,
    name: item.nombreSnapshot || item.name || item.nombre || item.alimento || `Alimento ${index + 1}`,
    cantidad: toNumber(item.cantidad ?? item.quantity, 0),
    unidad: item.unidad || item.unit || "g",
    kcal: toNumber(item.kcal, 0),
    protein: toNumber(item.proteina ?? item.protein, 0),
    carbs: toNumber(item.carbs, 0),
    fat: toNumber(item.grasas ?? item.fat, 0),
  };
}

function totalsFromFoods(foods = []) {
  return foods.reduce((acc, food) => addMacroTotals(acc, food), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function rawMealsFromMenu(menu = {}) {
  const comidas = Array.isArray(menu.comidas) ? menu.comidas : null;
  const meals = Array.isArray(menu.meals) ? menu.meals : null;
  if (comidas?.length) return comidas;
  if (meals?.length) return meals;
  return comidas || meals || [];
}

function normalizeSnapshotMeal(meal = {}, index = 0) {
  const rawItems = Array.isArray(meal.items)
    ? meal.items
    : Array.isArray(meal.foods)
      ? meal.foods
      : Array.isArray(meal.alimentos)
        ? meal.alimentos
        : [];
  const foods = rawItems.map((item, itemIndex) => normalizeSnapshotFood(item, itemIndex));
  const explicitTotals = normalizeMacroTotals(meal.totales || meal.totals || meal);
  const foodTotals = totalsFromFoods(foods);
  const totals = hasAnyMacro(explicitTotals) ? explicitTotals : foodTotals;

  return {
    id: String(meal.id || meal._id || meal.comidaId || `meal-${index + 1}`),
    name: meal.name || meal.nombre || `Comida ${index + 1}`,
    type: meal.type || meal.tipoComida || "otro",
    order: toNumber(meal.order ?? meal.orden, index + 1),
    kcal: totals.kcal,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    foods,
  };
}

function mealToSnapshotPayload(meal = {}, index = 0) {
  return {
    id: meal.id || `meal-${index + 1}`,
    nombre: meal.name || `Comida ${index + 1}`,
    tipoComida: meal.type || "otro",
    orden: meal.order || index + 1,
    totales: {
      kcal: toNumber(meal.kcal, 0),
      proteina: toNumber(meal.protein, 0),
      carbs: toNumber(meal.carbs, 0),
      grasas: toNumber(meal.fat, 0),
    },
    items: (meal.foods || []).map((food, foodIndex) => ({
      id: food.id || `item-${index + 1}-${foodIndex + 1}`,
      alimentoId: food.alimentoId || null,
      nombreSnapshot: food.name || `Alimento ${foodIndex + 1}`,
      cantidad: toNumber(food.cantidad, 0),
      unidad: food.unidad || "g",
      kcal: toNumber(food.kcal, 0),
      proteina: toNumber(food.protein, 0),
      carbs: toNumber(food.carbs, 0),
      grasas: toNumber(food.fat, 0),
    })),
  };
}

function menuTotals(menu = {}) {
  const explicitTotals = normalizeMacroTotals(
    menu.totals || menu.totales || {
      kcal: menu.kcal ?? menu.kcalObjetivo ?? menu.calories,
      protein: menu.protein ?? menu.proteina ?? menu.macrosObjetivo?.proteina ?? menu.macros?.protein,
      carbs: menu.carbs ?? menu.macrosObjetivo?.carbs ?? menu.macros?.carbs,
      fat: menu.fat ?? menu.grasas ?? menu.macrosObjetivo?.grasas ?? menu.macros?.fat,
    }
  );
  if (hasAnyMacro(explicitTotals)) return explicitTotals;
  return rawMealsFromMenu(menu)
    .map((meal, index) => normalizeSnapshotMeal(meal, index))
    .reduce((acc, meal) => addMacroTotals(acc, meal), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
}

function normalizeAssignments(source = {}) {
  const raw = source && typeof source === "object" ? source : {};
  return DAY_KEYS.reduce((acc, key) => {
    const entry = raw[key];
    if (!entry) return acc;
    const primarySource = entry.primaryMenu && typeof entry.primaryMenu === "object" ? entry.primaryMenu : entry;
    const primaryMenu = normalizeAssignmentEntry(primarySource, "base");
    if (!primaryMenu?.menuSnapshot?.name && !primaryMenu?.menuId) return acc;
    const alternatives = Array.isArray(entry.alternatives)
      ? entry.alternatives
          .map((alternative) => normalizeAlternativeEntry(alternative))
          .filter((alternative) => alternative?.menuSnapshot?.name || alternative?.menuId)
          .filter((alternative) => !isSameAssignment(alternative, primaryMenu))
          .slice(0, MAX_MENU_ALTERNATIVES)
      : [];
    acc[key] = {
      ...primaryMenu,
      primaryMenu,
      alternatives,
    };
    return acc;
  }, {});
}

function normalizeAssignmentEntry(entry = {}, source = "base") {
  const snapshotSource = entry.menuSnapshot || entry.snapshot || entry;
  const hasSnapshotData = Boolean(
    entry.menuId ||
    entry.menuBaseId ||
    snapshotSource?.id ||
    snapshotSource?._id ||
    snapshotSource?.baseId ||
    snapshotSource?.menuBaseId ||
    snapshotSource?.name ||
    snapshotSource?.nombre ||
    Array.isArray(snapshotSource?.meals) ||
    Array.isArray(snapshotSource?.comidas)
  );
  if (!hasSnapshotData) return null;
  const snapshot = normalizeSnapshot(snapshotSource);
  const planningMeta = assignmentPlanningMeta(entry);
  return {
    menuId: entry.menuId || entry.menuBaseId || snapshot.baseId || snapshot.id || "",
    menuSnapshot: snapshot,
    source: entry.source || source,
    ...planningMeta,
    assignedAt: entry.assignedAt || new Date().toISOString(),
  };
}

function assignmentPlanningMeta(entry = {}) {
  const meta = {};
  [
    "assignmentType",
    "dayKey",
    "targetCalories",
    "targetMacros",
    "plannedCalories",
    "flexibleCalories",
    "flexibleMode",
    "flexibleLabel",
    "macroPending",
    "proteinWarning",
    "compatibility",
  ].forEach((key) => {
    if (entry[key] !== undefined) meta[key] = entry[key];
  });
  return meta;
}

function normalizeAlternativeEntry(entry = {}) {
  const assignment = normalizeAssignmentEntry(entry, "alternative");
  return {
    ...assignment,
    reason: entry.reason || "",
    compatibility: entry.compatibility || null,
  };
}

function normalizeSnapshot(menu = {}) {
  const meals = rawMealsFromMenu(menu).map((meal, index) => normalizeSnapshotMeal(meal, index));
  const totals = menuTotals({ ...menu, meals });
  const mealsCount = toNumber(menu.mealsCount ?? menu.cantidadComidas, meals.length) || meals.length;
  return {
    id: String(menu.id || menu._id || menu.baseId || menu.menuBaseId || ""),
    baseId: String(menu.baseId || menu.menuBaseId || menu.id || menu._id || ""),
    name: menu.name || menu.nombre || "Menú sin nombre",
    description: menu.description || menu.descripcion || "",
    kcal: totals.kcal,
    protein: totals.protein,
    carbs: totals.carbs,
    fat: totals.fat,
    totals: {
      kcal: totals.kcal,
      proteina: totals.protein,
      carbs: totals.carbs,
      grasas: totals.fat,
    },
    mealsCount,
    cantidadComidas: mealsCount,
    meals,
    comidas: meals.map(mealToSnapshotPayload),
  };
}

function snapshotFromMenu(menu = {}) {
  return normalizeSnapshot(menu);
}

function snapshotToEditorMenu(snapshot = {}) {
  const normalized = normalizeSnapshot(snapshot);
  return {
    id: normalized.baseId || normalized.id || "",
    nombre: normalized.name || "Menú del día",
    descripcion: normalized.description || "",
    kcalObjetivo: normalized.kcal || 0,
    macrosObjetivo: {
      proteina: normalized.protein || 0,
      carbs: normalized.carbs || 0,
      grasas: normalized.fat || 0,
    },
    cantidadComidas: normalized.mealsCount || normalized.meals?.length || 0,
    visibilidad: "privada",
    estado: "activo",
    comidas: (normalized.meals || []).map((meal, mealIndex) => ({
      id: meal.id || `meal-${mealIndex + 1}`,
      nombre: meal.name || `Comida ${mealIndex + 1}`,
      orden: meal.order || mealIndex + 1,
      tipoComida: meal.type || "otro",
      items: (meal.foods || []).map((food, foodIndex) => ({
        id: food.id || `item-${mealIndex + 1}-${foodIndex + 1}`,
        alimentoId: food.alimentoId || null,
        nombreSnapshot: food.name || food.nombreSnapshot || `Alimento ${foodIndex + 1}`,
        cantidad: food.cantidad,
        unidad: food.unidad || "g",
        kcal: food.kcal,
        proteina: food.protein ?? food.proteina,
        carbs: food.carbs,
        grasas: food.fat ?? food.grasas,
      })),
    })),
  };
}

function menuToAssignment(menu = {}, source = "coach", options = {}) {
  const snapshot = snapshotFromMenu(menu);
  const planningMeta = options.target
    ? buildFlexibleAssignmentMetadata(snapshot, options.target, { dayKey: options.dayKey, source })
    : {};
  return {
    menuId: snapshot.baseId || snapshot.id || "",
    menuSnapshot: snapshot,
    source,
    ...planningMeta,
    assignedAt: new Date().toISOString(),
  };
}

function assignmentWithPrimary(primaryMenu, alternatives = []) {
  if (!primaryMenu) return null;
  const cleanAlternatives = alternatives
    .filter((alternative) => alternative?.menuSnapshot?.name || alternative?.menuId)
    .filter((alternative) => !isSameAssignment(alternative, primaryMenu))
    .slice(0, MAX_MENU_ALTERNATIVES);
  return {
    ...primaryMenu,
    primaryMenu,
    alternatives: cleanAlternatives,
  };
}

function getPrimaryAssignment(assignment) {
  if (!assignment) return null;
  return assignment.primaryMenu || normalizeAssignmentEntry(assignment, "base");
}

function assignmentIdentity(assignment = {}) {
  const snapshot = assignment.menuSnapshot || assignment.snapshot || assignment;
  return String(assignment.menuId || snapshot.baseId || snapshot.id || snapshot.name || "").trim().toLowerCase();
}

function isSameAssignment(a, b) {
  const left = assignmentIdentity(a);
  const right = assignmentIdentity(b);
  return Boolean(left && right && left === right);
}

function snapshotHasDetailedMeals(snapshot = {}) {
  const normalized = normalizeSnapshot(snapshot);
  return normalized.meals.length > 0 && normalized.meals.some((meal) => (meal.foods || []).length > 0);
}

function isSnapshotIncomplete(snapshot = {}) {
  const normalized = normalizeSnapshot(snapshot);
  const expectedMeals = toNumber(normalized.mealsCount, 0);
  if (!normalized.meals.length) return expectedMeals > 0;
  return !normalized.meals.some((meal) => (meal.foods || []).length > 0);
}

function menuLookupKeys(source = {}) {
  const snapshot = source.menuSnapshot || source.snapshot || source;
  return [
    source.menuId,
    source.menuBaseId,
    source.id,
    source._id,
    source.baseId,
    source.menuBaseId,
    snapshot?.id,
    snapshot?._id,
    snapshot?.baseId,
    snapshot?.menuBaseId,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
}

function buildMenuLookup(menus = []) {
  return menus.reduce((lookup, menu) => {
    menuLookupKeys(menu).forEach((key) => lookup.set(key, menu));
    return lookup;
  }, new Map());
}

function findMenuForAssignment(assignment = {}, lookup = new Map()) {
  return menuLookupKeys(assignment).map((key) => lookup.get(key)).find(Boolean) || null;
}

function hydrateAssignmentEntry(assignment = {}, lookup = new Map()) {
  const normalized = normalizeAssignmentEntry(assignment, assignment.source || "base");
  if (!normalized) return { assignment, changed: false };
  const snapshot = normalizeSnapshot(normalized.menuSnapshot);
  if (!isSnapshotIncomplete(snapshot)) {
    return { assignment: { ...assignment, ...normalized, menuSnapshot: snapshot }, changed: false };
  }

  const sourceMenu = findMenuForAssignment(normalized, lookup);
  const hydratedSnapshot = sourceMenu ? normalizeSnapshot(sourceMenu) : null;
  if (hydratedSnapshot && snapshotHasDetailedMeals(hydratedSnapshot)) {
    return {
      assignment: {
        ...assignment,
        ...normalized,
        menuId: normalized.menuId || hydratedSnapshot.baseId || hydratedSnapshot.id || "",
        menuSnapshot: hydratedSnapshot,
      },
      changed: true,
    };
  }

  return { assignment: { ...assignment, ...normalized, menuSnapshot: snapshot }, changed: false };
}

function hydrateAssignmentsWithMenus(assignments = {}, menus = []) {
  const lookup = buildMenuLookup(menus);
  if (!lookup.size) return assignments;
  let changed = false;
  const next = Object.entries(assignments || {}).reduce((acc, [dayKey, entry]) => {
    const primary = hydrateAssignmentEntry(getPrimaryAssignment(entry) || entry, lookup);
    const alternatives = (Array.isArray(entry?.alternatives) ? entry.alternatives : []).map((alternative) => {
      const hydrated = hydrateAssignmentEntry(alternative, lookup);
      changed = changed || hydrated.changed;
      return {
        ...alternative,
        ...hydrated.assignment,
        reason: alternative.reason || "",
        compatibility: alternative.compatibility || null,
      };
    });
    changed = changed || primary.changed;
    acc[dayKey] = assignmentWithPrimary(primary.assignment, alternatives);
    return acc;
  }, {});
  return changed ? next : assignments;
}

function getCompatibility(menu = {}, target = {}) {
  if (!menu) {
    return {
      key: "empty",
      label: "Sin menú",
      tone: "empty",
      kcalDiff: -toNumber(target?.kcal, 0),
      proteinDiff: -targetMacroValue(target, "protein"),
    };
  }
  const compatibility = getMenuDayCompatibility(menuTotals(menu), target);
  if (compatibility) return compatibility;
  const totals = menuTotals(menu);
  const targetKcal = toNumber(target?.kcal, 0);
  const targetProtein = targetMacroValue(target, "protein");
  const kcalDiff = totals.kcal - targetKcal;
  const proteinDiff = totals.protein - targetProtein;
  const kcalPct = targetKcal > 0 ? Math.abs(kcalDiff) / targetKcal : 0;

  if (targetKcal && kcalPct <= 0.08 && proteinDiff >= -8) {
    return { key: "good", label: "Cerca", tone: "good", kcalDiff, proteinDiff };
  }
  if (targetKcal && kcalDiff > targetKcal * 0.1) {
    return { key: "high", label: "Excede kcal", tone: "warning", kcalDiff, proteinDiff };
  }
  if (targetKcal && kcalDiff < -targetKcal * 0.12) {
    return { key: "low", label: "Bajo en kcal", tone: "review", kcalDiff, proteinDiff };
  }
  if (targetProtein && proteinDiff < -10) {
    return { key: "protein", label: "Bajo en proteína", tone: "review", kcalDiff, proteinDiff };
  }
  return { key: "review", label: "Revisar", tone: "review", kcalDiff, proteinDiff };
}

function compatibilityReason(compatibility = {}) {
  if (compatibility.key === "missing_target") return "Configura kcal y proteina para este dia antes de asignar.";
  if (compatibility.key === "deficit_excessive") {
    return `Este menu queda ${formatNumber(compatibility.flexibleCalories)} kcal por debajo de la meta. El margen flexible maximo permitido es ${MAX_FLEXIBLE_CALORIES} kcal.`;
  }
  if (compatibility.key === "surplus_blocked") {
    return `Este menu excede la meta por +${formatNumber(compatibility.surplusCalories)} kcal. Ajusta el menu o elegi otro dia.`;
  }
  return "Este menu no es compatible con la meta del dia.";
}

function sortByCompatibility(menus = [], target = {}) {
  return [...menus].sort((a, b) => scoreMenu(a, target) - scoreMenu(b, target));
}

function scoreMenu(menu = {}, target = {}) {
  const totals = menuTotals(menu);
  const kcalScore = Math.abs(totals.kcal - toNumber(target?.kcal, 0));
  const proteinScore = Math.max(0, targetMacroValue(target, "protein") - totals.protein) * 8;
  return kcalScore + proteinScore;
}

function defaultMode(access = {}) {
  if (access?.menuModes?.manual) return "manual";
  if (access?.menuModes?.semiautomatic) return "semiautomatic";
  if (access?.menuModes?.automatic) return "automatic";
  return "manual";
}

export default function WeeklyClientMenuPlanner({ clientId, client, access, nutritionTargets, onToast }) {
  const [assignments, setAssignments] = useState(() => normalizeAssignments(client?.menu?.weeklyPlan?.assignedMenusByDay));
  const [selectedDayKey, setSelectedDayKey] = useState("monday");
  const [picker, setPicker] = useState(null);
  const [creator, setCreator] = useState(null);
  const [editor, setEditor] = useState(null);
  const [detailDayKey, setDetailDayKey] = useState("");
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const menusQuery = useMenusBase({ estado: "activo", includeComidas: true });
  const creationOpen = Boolean(creator || editor);
  const foodsQuery = useAlimentos({ search: "" }, { enabled: creationOpen });
  const foods = foodsQuery.data?.all || foodsQuery.data?.alimentos || [];
  const comidasQuery = useComidas({}, foods, { enabled: creationOpen });
  const mealLibrary = comidasQuery.data?.all || comidasQuery.data?.comidas || [];

  useEffect(() => {
    setAssignments(normalizeAssignments(client?.menu?.weeklyPlan?.assignedMenusByDay));
  }, [client?.menu?.weeklyPlan?.assignedMenusByDay]);

  const libraryMenus = useMemo(() => menusQuery.data?.menus || [], [menusQuery.data?.menus]);
  useEffect(() => {
    if (!libraryMenus.length) return;
    setAssignments((current) => hydrateAssignmentsWithMenus(current, libraryMenus));
  }, [libraryMenus]);
  const hydratedAssignments = useMemo(
    () => hydrateAssignmentsWithMenus(assignments, libraryMenus),
    [assignments, libraryMenus]
  );
  const nutritionWeek = useMemo(() => resolveNutritionWeek(nutritionTargets), [nutritionTargets]);

  const weekRows = useMemo(
    () =>
      NUTRITION_WEEK_DAYS.map((day) => {
        const target = nutritionWeek.targets[day.key];
        const assignment = hydratedAssignments[day.key] || null;
        const primary = getPrimaryAssignment(assignment);
        const snapshot = primary?.menuSnapshot ? normalizeSnapshot(primary.menuSnapshot) : null;
        const totals = snapshot ? menuTotals(snapshot) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
        const compatibility = getCompatibility(snapshot, target);
        const alternatives = Array.isArray(assignment?.alternatives) ? assignment.alternatives : [];
        const flexibleCalories = primary ? assignmentFlexibleCalories(primary, target, totals) : 0;
        const macroPending = primary ? assignmentMacroPending(primary, target, totals) : { protein: 0, carbs: 0, fat: 0 };
        return { day, target, assignment, primary, alternatives, snapshot, totals, compatibility, flexibleCalories, macroPending };
      }),
    [hydratedAssignments, nutritionWeek]
  );

  const selectedDay = weekRows.find((row) => row.day.key === selectedDayKey) || weekRows[0];
  const detailRow = weekRows.find((row) => row.day.key === detailDayKey) || null;

  async function persistAssignments(nextAssignments, successMessage = "Plan semanal actualizado.") {
    setAssignments(nextAssignments);
    setBusy("weekly-save");
    try {
      const data = await updateProfessionalClientMenu(clientId, {
        menu: {
          mode: { type: defaultMode(access), lockedByCoach: client?.menu?.mode?.lockedByCoach },
          weeklyPlan: { assignedMenusByDay: nextAssignments },
          coachNotes: client?.menu?.coachNotes || "",
        },
      });
      queryClient.setQueryData(queryKeys.professionalClientDetail(clientId), data);
      await invalidateProfessionalClient(clientId, data?.client);
      onToast?.({ type: "success", message: successMessage });
    } catch (error) {
      setAssignments(normalizeAssignments(client?.menu?.weeklyPlan?.assignedMenusByDay));
      onToast?.({ type: "error", message: error?.message || "No se pudo guardar la asignación semanal." });
    } finally {
      setBusy("");
    }
  }

  async function assignMenu(dayKey, menu, message = "Menú asignado al día.") {
    const row = weekRows.find((item) => item.day.key === dayKey);
    const compatibility = getCompatibility(menu, row?.target);
    if (!compatibility.canAssign) {
      onToast?.({ type: "warning", message: compatibilityReason(compatibility) });
      setPicker(null);
      return;
    }
    const primaryMenu = menuToAssignment(menu, "coach", { target: row?.target, dayKey });
    const current = hydratedAssignments[dayKey] || assignments[dayKey] || {};
    const alternatives = Array.isArray(current.alternatives)
      ? current.alternatives.filter((alternative) => !isSameAssignment(alternative, primaryMenu))
      : [];
    const next = {
      ...hydratedAssignments,
      [dayKey]: assignmentWithPrimary(primaryMenu, alternatives),
    };
    setPicker(null);
    await persistAssignments(next, message);
  }

  async function addAlternative(dayKey, menu) {
    const current = hydratedAssignments[dayKey] || assignments[dayKey] || {};
    const currentPrimary = getPrimaryAssignment(current);
    if (!currentPrimary) {
      await assignMenu(dayKey, menu, "Menú asignado como principal del día.");
      return;
    }

    const row = weekRows.find((item) => item.day.key === dayKey);
    const compatibility = getCompatibility(menu, row?.target);
    if (!compatibility.canAssign) {
      onToast?.({ type: "warning", message: compatibilityReason(compatibility) });
      setPicker(null);
      return;
    }

    const alternative = {
      ...menuToAssignment(menu, "alternative", { target: row?.target, dayKey }),
      reason: "Compatible con la meta del día",
      compatibility,
    };
    const alternatives = Array.isArray(current.alternatives) ? current.alternatives : [];
    if (isSameAssignment(alternative, currentPrimary) || alternatives.some((item) => isSameAssignment(item, alternative))) {
      onToast?.({ type: "info", message: "Ese menú ya está guardado para este día." });
      setPicker(null);
      return;
    }
    if (alternatives.length >= MAX_MENU_ALTERNATIVES) {
      onToast?.({ type: "error", message: "Máximo 10 alternativas para este día." });
      setPicker(null);
      return;
    }

    const next = {
      ...hydratedAssignments,
      [dayKey]: assignmentWithPrimary(currentPrimary, [...alternatives, alternative]),
    };
    setPicker(null);
    await persistAssignments(next, "Alternativa guardada para el día.");
  }

  async function promoteAlternative(dayKey, alternativeIndex) {
    const current = hydratedAssignments[dayKey] || assignments[dayKey];
    const currentPrimary = getPrimaryAssignment(current);
    const alternatives = Array.isArray(current?.alternatives) ? current.alternatives : [];
    const nextPrimary = alternatives[alternativeIndex];
    if (!nextPrimary) return;
    const remaining = alternatives.filter((_, index) => index !== alternativeIndex);
    const nextAlternatives = currentPrimary ? [currentPrimary, ...remaining] : remaining;
    await persistAssignments(
      { ...hydratedAssignments, [dayKey]: assignmentWithPrimary(nextPrimary, nextAlternatives) },
      "Alternativa marcada como menú principal."
    );
  }

  async function removeAlternative(dayKey, alternativeIndex) {
    const current = hydratedAssignments[dayKey] || assignments[dayKey];
    const currentPrimary = getPrimaryAssignment(current);
    if (!currentPrimary) return;
    const alternatives = Array.isArray(current?.alternatives) ? current.alternatives : [];
    const nextAlternatives = alternatives.filter((_, index) => index !== alternativeIndex);
    await persistAssignments(
      { ...hydratedAssignments, [dayKey]: assignmentWithPrimary(currentPrimary, nextAlternatives) },
      "Alternativa quitada del día."
    );
  }

  async function clearDay(dayKey) {
    const next = { ...hydratedAssignments };
    delete next[dayKey];
    setDetailDayKey("");
    await persistAssignments(next, "Menú quitado del día.");
  }

  async function saveCreatedMenu(payload) {
    if (!creator) return;
    if (!access?.canCreateMenu) {
      onToast?.({ type: "error", message: "Tu plan no permite crear menús propios." });
      return;
    }
    try {
      setBusy("create-menu");
      const created = await createMenuBase(payload);
      await invalidateMenusLibrary(created?.id);
      await assignMenu(creator.dayKey, created, "Menú creado y asignado al día.");
      setCreator(null);
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo crear el menú." });
    } finally {
      setBusy("");
    }
  }

  async function saveEditedDayMenu(payload) {
    if (!editor) return;
    if (!access?.canCreateMenu) {
      onToast?.({ type: "error", message: "Tu plan no permite editar creando una plantilla propia." });
      return;
    }
    try {
      setBusy("edit-menu");
      const created = await createMenuBase({
        ...payload,
        nombre: payload.nombre || `${editor.snapshot?.name || "Menú"} editado`,
      });
      await invalidateMenusLibrary(created?.id);
      await assignMenu(editor.dayKey, created, "Menú editado y reasignado al día.");
      setEditor(null);
      setDetailDayKey(editor.dayKey);
    } catch (error) {
      onToast?.({ type: "error", message: error?.message || "No se pudo editar el menú del día." });
    } finally {
      setBusy("");
    }
  }

  function openPicker(dayKey, mode = "choose") {
    setPicker({ dayKey, mode });
    setSearch("");
  }

  const pickerRow = picker ? weekRows.find((row) => row.day.key === picker.dayKey) : null;
  const pickerMenus = useMemo(() => {
    if (!pickerRow) return [];
    const term = search.trim().toLowerCase();
    const filtered = term
      ? libraryMenus.filter((menu) => `${menu.name} ${menu.description} ${(menu.tags || []).join(" ")}`.toLowerCase().includes(term))
      : libraryMenus;
    const withoutDuplicates = picker?.mode === "alternative"
      ? filtered.filter((menu) => {
          const candidate = menuToAssignment(menu);
          return !isSameAssignment(candidate, pickerRow.primary) &&
            !pickerRow.alternatives.some((alternative) => isSameAssignment(alternative, candidate));
        })
      : filtered;
    return sortByCompatibility(withoutDuplicates, pickerRow.target);
  }, [libraryMenus, picker, pickerRow, search]);

  return (
    <div className="wmp">
      <section className="wmp-weekSummary" aria-label="Resumen semanal de menús">
        {weekRows.map((row) => (
          <DayMenuCard
            key={row.day.key}
            row={row}
            selected={selectedDayKey === row.day.key}
            busy={busy === "weekly-save"}
            onSelect={() => setSelectedDayKey(row.day.key)}
            onView={() => setDetailDayKey(row.day.key)}
            onChoose={() => openPicker(row.day.key, "choose")}
            onCreate={() => access?.canCreateMenu && setCreator({ dayKey: row.day.key })}
            onAlternative={() => openPicker(row.day.key, "alternative")}
            onEdit={() => row.snapshot && access?.canCreateMenu && setEditor({ dayKey: row.day.key, snapshot: row.snapshot })}
            onClear={() => clearDay(row.day.key)}
            canCreate={!!access?.canCreateMenu}
          />
        ))}
      </section>

      {selectedDay ? (
        <section className="wmp-focus">
          <div>
            <span>Día seleccionado</span>
            <strong>{selectedDay.day.label}</strong>
            <small>
              Meta {displayKcal(selectedDay.target.kcal)} / P {displayMacro(selectedDay.target.p)} / C {displayMacro(selectedDay.target.c)} / G {displayMacro(selectedDay.target.g)}
            </small>
          </div>
          <div className="wmp-focusActions">
            <button type="button" className="wmp-btn gold" onClick={() => openPicker(selectedDay.day.key, "choose")}>
              <Search size={16} strokeWidth={2.3} aria-hidden="true" />
              Elegir menú
            </button>
            <button type="button" className="wmp-btn" onClick={() => setCreator({ dayKey: selectedDay.day.key })} disabled={!access?.canCreateMenu}>
              <FilePlus2 size={16} strokeWidth={2.3} aria-hidden="true" />
              Crear menú
            </button>
            {selectedDay.snapshot ? (
              <button
                type="button"
                className="wmp-btn ghost"
                onClick={() => openPicker(selectedDay.day.key, "alternative")}
                disabled={(selectedDay.alternatives?.length || 0) >= MAX_MENU_ALTERNATIVES}
                title={(selectedDay.alternatives?.length || 0) >= MAX_MENU_ALTERNATIVES ? "Máximo 10 alternativas para este día" : "Agregar otro menú como alternativa"}
              >
                <Plus size={16} strokeWidth={2.5} aria-hidden="true" />
                Alternativa
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      {picker ? (
        <MenuPickerDrawer
          row={pickerRow}
          menus={pickerMenus}
          search={search}
          loading={menusQuery.isLoading}
          mode={picker.mode}
          onSearch={setSearch}
          onClose={() => setPicker(null)}
          onPick={(menu) => assignMenu(picker.dayKey, menu)}
          onSaveAlternative={(menu) => addAlternative(picker.dayKey, menu)}
        />
      ) : null}

      {detailRow ? (
        <MenuDayDetailDrawer
          row={detailRow}
          onClose={() => setDetailDayKey("")}
          onChoose={() => openPicker(detailRow.day.key, "choose")}
          onAlternative={() => openPicker(detailRow.day.key, "alternative")}
          onPromoteAlternative={(alternativeIndex) => promoteAlternative(detailRow.day.key, alternativeIndex)}
          onRemoveAlternative={(alternativeIndex) => removeAlternative(detailRow.day.key, alternativeIndex)}
          onEdit={() => detailRow.snapshot && access?.canCreateMenu && setEditor({ dayKey: detailRow.day.key, snapshot: detailRow.snapshot })}
          onClear={() => clearDay(detailRow.day.key)}
          canCreate={!!access?.canCreateMenu}
        />
      ) : null}

      {creator ? (
        <MenuCreationFlow
          foods={foods}
          foodsLoading={foodsQuery.isLoading}
          mealLibrary={mealLibrary}
          onSave={saveCreatedMenu}
          onClose={() => setCreator(null)}
          saving={busy === "create-menu"}
          allowSystemVisibility={false}
          canUseSuggestions={Boolean(access?.canUseMenuSuggestions)}
          guidedDefaults={guidedDefaultsForDay(weekRows.find((row) => row.day.key === creator.dayKey))}
        />
      ) : null}

      {editor ? (
        <MenuBaseEditor
          initialMenu={snapshotToEditorMenu(editor.snapshot)}
          foods={foods}
          foodsLoading={foodsQuery.isLoading}
          mealLibrary={mealLibrary}
          onSave={saveEditedDayMenu}
          onClose={() => setEditor(null)}
          saving={busy === "edit-menu"}
          title={`Editar menú de ${NUTRITION_WEEK_DAYS.find((day) => day.key === editor.dayKey)?.label || "día"}`}
          submitLabel="Guardar y asignar"
          allowSystemVisibility={false}
        />
      ) : null}
    </div>
  );
}

function DayMenuCard({ row, selected, busy, canCreate, onSelect, onView, onChoose, onCreate, onAlternative, onEdit, onClear }) {
  const targetKcal = toNumber(row.target.kcal, 0);
  const percent = targetKcal > 0 ? Math.min(130, (row.totals.kcal / targetKcal) * 100) : 0;
  const overflow = percent > 100;
  const hasMenu = !!row.snapshot;
  const barTone = !row.snapshot
    ? "empty"
    : overflow
      ? "overflow"
      : row.compatibility.tone === "good"
        ? "good"
        : row.flexibleCalories || row.compatibility.key === "deficit_excessive"
          ? "low"
          : "review";
  const targetSourceClass = row.target.customized ? "custom" : row.target.adjusted ? "adjusted" : "";
  const targetSourceLabel = row.target.statusLabel || (row.target.customized ? "Personalizado" : row.target.adjusted ? "General ajustado" : "General");
  const alternativesCount = row.alternatives?.length || 0;
  return (
    <article className={`wmp-dayCard ${hasMenu ? "assigned" : "empty"} ${selected ? "selected" : ""}`} onClick={onSelect}>
      <header>
        <div className="wmp-dayIdentity">
          <span className={`wmp-dayIcon ${hasMenu ? "assigned" : "empty"}`} aria-hidden="true">
            {hasMenu ? <Utensils size={18} strokeWidth={2.4} /> : <Search size={18} strokeWidth={2.4} />}
          </span>
          <div>
            <strong>{row.day.label}</strong>
            <span className={`wmp-source ${targetSourceClass}`}>
              {targetSourceLabel}
            </span>
          </div>
        </div>
        {hasMenu ? (
          <span className={`wmp-status ${row.compatibility.tone}`}>{row.compatibility.label}</span>
        ) : (
          <span className="wmp-status empty">
            <AlertTriangle size={13} strokeWidth={2.6} aria-hidden="true" />
            Sin asignar
          </span>
        )}
      </header>

      <div className="wmp-menuName">
        {row.snapshot ? row.snapshot.name : "Día sin menú"}
      </div>

      <div className={`wmp-assignmentState ${hasMenu ? "assigned" : "empty"}`}>
        {hasMenu ? (
          <CheckCircle2 size={15} strokeWidth={2.5} aria-hidden="true" />
        ) : (
          <AlertTriangle size={15} strokeWidth={2.5} aria-hidden="true" />
        )}
        <span>{hasMenu ? "Menú activo para este día" : "Planificación pendiente"}</span>
      </div>

      <div className="wmp-dayKpis">
        <span><Flame size={14} aria-hidden="true" /> Meta {displayKcal(row.target.kcal)}</span>
        {row.flexibleCalories > 0 ? <span>Libre {displayKcal(row.flexibleCalories)}</span> : null}
        <span>Menú {displayKcal(row.totals.kcal)}</span>
      </div>

      <div className={`wmp-targetLine ${hasMenu ? "" : "empty"}`}>
        {hasMenu ? (
          <>
            <span>{`${row.snapshot.mealsCount || row.snapshot.meals?.length || 0} comidas`}</span>
          <span className="wmp-altInline">
            <span>{alternativesCount ? `${alternativesCount} alternativas` : "Sin alternativas"}</span>
            <button
              type="button"
              className="wmp-plusMini"
              onClick={(event) => {
                event.stopPropagation();
                onAlternative();
              }}
              disabled={alternativesCount >= MAX_MENU_ALTERNATIVES}
              title={alternativesCount >= MAX_MENU_ALTERNATIVES ? "Máximo 10 alternativas para este día" : "Agregar otro menú como alternativa"}
            >
              <Plus size={13} strokeWidth={3} aria-hidden="true" />
              Alternativa
            </button>
          </span>
          </>
        ) : (
          <span className="wmp-emptyHint">Asigná un menú para cubrir la meta del día.</span>
        )}
      </div>
      <div className={`wmp-bar ${barTone}`} aria-label={`Progreso calórico ${Math.round(percent)}%`}>
        <span style={{ width: `${percent}%` }} />
      </div>
      <div className="wmp-macroLine">
        <span>P {displayMacro(row.target.p)} a {displayMacro(row.totals.protein)}</span>
        <span>{formatSigned(row.compatibility.kcalDiff, " kcal")}</span>
      </div>

      {hasMenu ? (
        <div className="wmp-cardActions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="wmp-iconBtn" onClick={onView} title="Ver detalle" aria-label={`Ver detalle del menú de ${row.day.label}`}>
            <Eye size={16} />
          </button>
          <button
            type="button"
            className="wmp-iconBtn"
            onClick={onEdit}
            disabled={!canCreate}
            title={canCreate ? "Editar menú" : "Tu plan no permite crear menús propios"}
            aria-label={`Editar el menú de ${row.day.label}`}
          >
            <Pencil size={16} />
          </button>
          <button type="button" className="wmp-iconBtn" onClick={onAlternative} title="Agregar alternativa" aria-label={`Agregar alternativa para ${row.day.label}`}>
            <Plus size={16} />
          </button>
          <button type="button" className="wmp-iconBtn danger" onClick={onClear} disabled={busy} title="Quitar menú" aria-label={`Quitar el menú de ${row.day.label}`}>
            <Trash2 size={16} />
          </button>
        </div>
      ) : (
        <div className="wmp-emptyActions" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="wmp-emptyAction primary" onClick={onChoose}>
            <Search size={16} aria-hidden="true" />
            Elegir menú
          </button>
          <button
            type="button"
            className="wmp-emptyAction"
            onClick={onCreate}
            disabled={!canCreate}
            title={canCreate ? "Crear menú" : "Tu plan no permite crear menús propios"}
          >
            <FilePlus2 size={16} aria-hidden="true" />
            Crear propio
          </button>
        </div>
      )}
    </article>
  );
}

function MenuPickerDrawer({ row, menus, search, loading, mode, onSearch, onClose, onPick, onSaveAlternative }) {
  return (
    <section className="wmp-drawer" role="dialog" aria-modal="true" aria-label="Elegir menú">
      <div className="wmp-drawerPanel picker">
        <header className="wmp-drawerHead">
          <div>
            <span>{mode === "alternative" ? "Alternativas compatibles" : "Elegir menú"}</span>
            <h3>{row?.day?.label || "Día"}</h3>
            <p>Meta {displayKcal(row?.target?.kcal)} / P {displayMacro(row?.target?.p)} / C {displayMacro(row?.target?.c)} / G {displayMacro(row?.target?.g)}</p>
          </div>
          <button type="button" className="wmp-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} strokeWidth={2.3} />
          </button>
        </header>

        <label className="wmp-pickerSearch">
          <Search size={18} strokeWidth={2.2} aria-hidden="true" />
          <input value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Buscar por nombre, tag u objetivo" />
        </label>

        <div className="wmp-pickerList">
          {loading ? <div className="wmp-empty">Cargando menús...</div> : null}
          {!loading && menus.length === 0 ? <div className="wmp-empty">No hay menús que coincidan.</div> : null}
          {menus.map((menu) => {
            const compatibility = getCompatibility(menu, row?.target);
            const totals = menuTotals(menu);
            const canPick = compatibility.canAssign !== false;
            const pickLabel = compatibility.flexibleCalories > 0
              ? `Asignar con ${formatNumber(compatibility.flexibleCalories)} kcal libres`
              : "Usar como principal";
            return (
              <article className="wmp-pickerCard" key={menu.id || menu.baseId || menu.name}>
                <div>
                  <span className={`wmp-status ${compatibility.tone}`}>{compatibility.label}</span>
                  <strong>{menu.name}</strong>
                  <p>{displayKcal(totals.kcal)} / P {displayMacro(totals.protein)} / C {displayMacro(totals.carbs)} / G {displayMacro(totals.fat)}</p>
                  <small>{menu.mealsCount || menu.meals?.length || 0} comidas / Dif. {formatSigned(compatibility.kcalDiff, " kcal")} / P {formatSigned(compatibility.proteinDiff, " g")}</small>
                  {compatibility.flexibleCalories > 0 ? <small>Libre {displayKcal(compatibility.flexibleCalories)} para completar durante el dia.</small> : null}
                  {!canPick ? <small>{compatibilityReason(compatibility)}</small> : null}
                </div>
                <div className="wmp-pickerActions">
                  <button type="button" className="wmp-btn gold" onClick={() => onPick(menu)} disabled={!canPick}>
                    {pickLabel}
                  </button>
                  {mode === "alternative" ? (
                    <button type="button" className="wmp-btn" onClick={() => onSaveAlternative(menu)} disabled={!canPick}>
                      Guardar alternativa
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function MenuDayDetailDrawer({
  row,
  canCreate,
  onClose,
  onChoose,
  onAlternative,
  onPromoteAlternative,
  onRemoveAlternative,
  onEdit,
  onClear,
}) {
  const menu = row.snapshot ? normalizeSnapshot(row.snapshot) : null;
  const alternatives = (row.alternatives || []).map((alternative) => ({
    ...alternative,
    menuSnapshot: normalizeSnapshot(alternative.menuSnapshot),
  }));
  const [selectedMenuKey, setSelectedMenuKey] = useState("primary");
  useEffect(() => {
    setSelectedMenuKey("primary");
  }, [row.day.key, row.primary?.menuId]);
  const selectedAlternativeIndex = selectedMenuKey.startsWith("alternative-")
    ? Number(selectedMenuKey.replace("alternative-", ""))
    : -1;
  const selectedAlternative = selectedAlternativeIndex >= 0 ? alternatives[selectedAlternativeIndex] : null;
  const selectedMenu = selectedAlternative?.menuSnapshot || menu;
  const selectedTotals = selectedMenu ? menuTotals(selectedMenu) : { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const selectedCompatibility = selectedMenu ? getCompatibility(selectedMenu, row.target) : row.compatibility;
  const selectedAssignment = selectedAlternative || row.primary || {};
  const selectedFlexibleCalories = selectedMenu ? assignmentFlexibleCalories(selectedAssignment, row.target, selectedTotals) : 0;
  const selectedMacroPending = selectedMenu ? assignmentMacroPending(selectedAssignment, row.target, selectedTotals) : { protein: 0, carbs: 0, fat: 0 };
  const selectedSnapshotIncomplete = selectedMenu ? isSnapshotIncomplete(selectedMenu) : false;
  return (
    <section className="wmp-drawer" role="dialog" aria-modal="true" aria-label="Detalle del menú del día">
      <div className="wmp-drawerPanel detail">
        <header className="wmp-drawerHead">
          <div>
            <span>Detalle del día</span>
            <h3>{row.day.label}</h3>
            <p>Meta {displayKcal(row.target.kcal)} / P {displayMacro(row.target.p)} / C {displayMacro(row.target.c)} / G {displayMacro(row.target.g)}</p>
          </div>
          <button type="button" className="wmp-close" onClick={onClose} aria-label="Cerrar">
            <X size={20} strokeWidth={2.3} />
          </button>
        </header>

        {!menu ? (
          <div className="wmp-detailEmpty">
            <AlertTriangle size={22} strokeWidth={2.3} />
            <strong>Este día todavía no tiene menú.</strong>
            <button type="button" className="wmp-btn gold" onClick={onChoose}>Elegir menú</button>
          </div>
        ) : (
          <>
            <section className="wmp-detailSummary">
              <div>
                <span className={`wmp-status ${selectedCompatibility.tone}`}>{selectedCompatibility.label}</span>
                <h4>{selectedMenu.name}</h4>
                <p>{selectedMenu.description || "Plantilla asignada a este día."}</p>
              </div>
              <div className="wmp-detailTotals">
                <strong>{displayKcal(selectedTotals.kcal)}</strong>
                <span>P {displayMacro(selectedTotals.protein)} / C {displayMacro(selectedTotals.carbs)} / G {displayMacro(selectedTotals.fat)}</span>
                <small>Dif. {formatSigned(selectedCompatibility.kcalDiff, " kcal")} / P {formatSigned(selectedCompatibility.proteinDiff, " g")}</small>
                {selectedFlexibleCalories > 0 ? (
                  <small>Margen flexible: {displayKcal(selectedFlexibleCalories)} libres / pendientes P {displayMacro(selectedMacroPending.protein)} / C {displayMacro(selectedMacroPending.carbs)} / G {displayMacro(selectedMacroPending.fat)}</small>
                ) : null}
              </div>
            </section>

            <div className="wmp-detailActions">
              <button type="button" className="wmp-btn" onClick={onEdit} disabled={!canCreate}>
                <Pencil size={16} /> Editar
              </button>
              {selectedAlternative ? (
                <button type="button" className="wmp-btn ghost" onClick={() => setSelectedMenuKey("primary")}>
                  <Eye size={16} /> Ver principal
                </button>
              ) : null}
              <button type="button" className="wmp-btn" onClick={onChoose}>
                <RefreshCw size={16} /> Cambiar
              </button>
              <button type="button" className="wmp-btn" onClick={onAlternative}>
                <Shuffle size={16} /> Agregar alternativa
              </button>
              <button type="button" className="wmp-btn danger" onClick={onClear}>
                <Trash2 size={16} /> Quitar
              </button>
            </div>

            {selectedSnapshotIncomplete ? (
              <div className="wmp-snapshotNotice">
                <AlertTriangle size={20} strokeWidth={2.3} aria-hidden="true" />
                <div>
                  <strong>Este menú fue asignado con snapshot incompleto.</strong>
                  <span>Intentamos hidratarlo desde la plantilla original. Si no aparece el detalle, reasignalo para regenerar comidas e items.</span>
                </div>
                <button type="button" className="wmp-btn ghost" onClick={onChoose}>
                  Reasignar
                </button>
              </div>
            ) : null}

            <section className="wmp-alternativesBlock">
              <header>
                <div>
                  <span>Alternativas compatibles</span>
                  <strong>{alternatives.length}/{MAX_MENU_ALTERNATIVES}</strong>
                </div>
                <button type="button" className="wmp-btn ghost" onClick={onAlternative}>
                  <Shuffle size={16} /> Buscar alternativa
                </button>
              </header>
              {alternatives.length ? (
                <div className="wmp-altList">
                  {alternatives.map((alternative, index) => {
                    const snapshot = alternative.menuSnapshot;
                    const compatibility = getCompatibility(snapshot, row.target);
                    const totals = menuTotals(snapshot);
                    const alternativeKey = `alternative-${index}`;
                    const selected = selectedMenuKey === alternativeKey;
                    return (
                      <article
                        className={`wmp-altCard ${selected ? "selected" : ""}`}
                        key={`${alternative.menuId || snapshot.baseId || snapshot.name}-${index}`}
                        onClick={() => setSelectedMenuKey(alternativeKey)}
                      >
                        <div>
                          <span className={`wmp-status ${compatibility.tone}`}>{compatibility.label}</span>
                          <strong>{snapshot.name}</strong>
                          <small>{displayKcal(totals.kcal)} / P {displayMacro(totals.protein)} / Dif. {formatSigned(compatibility.kcalDiff, " kcal")}</small>
                        </div>
                        <div className="wmp-altActions">
                          <button
                            type="button"
                            className="wmp-btn ghost"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedMenuKey(alternativeKey);
                            }}
                          >
                            Ver detalle
                          </button>
                          <button
                            type="button"
                            className="wmp-btn gold"
                            onClick={(event) => {
                              event.stopPropagation();
                              onPromoteAlternative(index);
                            }}
                          >
                            Usar principal
                          </button>
                          <button
                            type="button"
                            className="wmp-iconBtn danger"
                            onClick={(event) => {
                              event.stopPropagation();
                              onRemoveAlternative(index);
                            }}
                            title="Quitar alternativa"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="wmp-empty compact">Todavía no guardaste alternativas para este día.</div>
              )}
            </section>

            <div className="wmp-mealList">
              {(selectedMenu.meals || []).length ? (
                selectedMenu.meals.map((meal) => (
                  <article className="wmp-mealCard" key={meal.id || meal.name}>
                    <header>
                      <strong>{meal.name}</strong>
                      <span>{displayKcal(meal.kcal)} / P {displayMacro(meal.protein)} / C {displayMacro(meal.carbs)} / G {displayMacro(meal.fat)}</span>
                    </header>
                    {(meal.foods || []).length ? (
                      <div className="wmp-foodRows">
                        {meal.foods.map((food) => (
                          <div key={food.id || `${meal.id}-${food.name}`}>
                            <span>{food.name}</span>
                            <small>{formatNumber(food.cantidad, 1)} {food.unidad || "g"} / {displayKcal(food.kcal)} / P {displayMacro(food.protein)}</small>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="wmp-foodEmpty">Sin alimentos cargados.</p>
                    )}
                  </article>
                ))
              ) : (
                <div className="wmp-empty compact">Este menú no tiene comidas detalladas guardadas.</div>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function guidedDefaultsForDay(row) {
  const target = row?.target || {};
  return {
    nombre: row?.day?.label ? `Menú ${row.day.label}` : "",
    kcal: toNumber(target.kcal, 1800) || 1800,
    proteina: toNumber(target.p, 140) || 140,
    carbs: target.c || "",
    grasas: target.g || "",
  };
}

function displayKcal(value) {
  return `${formatNumber(toNumber(value, 0), 0)} kcal`;
}

function displayMacro(value) {
  return `${formatNumber(toNumber(value, 0), 1)} g`;
}
