import {
  calculateMacroKcal,
  createDailyTargetsDraft,
  NUTRITION_WEEK_DAYS,
  resolveNutritionWeek,
} from "../nutricion/dailyNutritionTargets.js";

function targetDraftFromClient(client = {}) {
  const macros = client?.metasActuales?.macros || {};
  return {
    kcal: client?.metasActuales?.kcal ?? "",
    p: macros.p ?? "",
    c: macros.c ?? "",
    g: macros.g ?? "",
    dailyTargets: createDailyTargetsDraft(client),
  };
}

function comparableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

function targetSignature(target = {}) {
  return JSON.stringify({
    kcal: comparableNumber(target.kcal),
    p: comparableNumber(target.p),
    c: comparableNumber(target.c),
    g: comparableNumber(target.g),
  });
}

function compactTarget(target = {}) {
  return {
    kcal: comparableNumber(target.kcal),
    p: comparableNumber(target.p),
    c: comparableNumber(target.c),
    g: comparableNumber(target.g),
  };
}

function assignedEntryForDay(assignments = {}, day = {}) {
  const normalized = (value) => String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const matchingKey = Object.keys(assignments || {}).find((key) => (
    normalized(key) === day.key ||
    normalized(key) === normalized(day.label) ||
    normalized(key) === normalized(day.storageKey) ||
    (day.aliases || []).some((alias) => normalized(key) === normalized(alias))
  ));
  return matchingKey ? assignments[matchingKey] : null;
}

function assignedMenuCount(entry = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return 0;
  return 1 + (Array.isArray(entry.alternatives) ? entry.alternatives.length : 0);
}

function primaryAssignment(entry = {}) {
  return entry?.primaryMenu && typeof entry.primaryMenu === "object"
    ? entry.primaryMenu
    : entry;
}

function hasComparableTargetMacros(value = {}) {
  return ["p", "c", "g"].every((key) => Number.isFinite(Number(value?.[key])));
}

function assignmentWasCreatedForTarget(entry = {}, target = {}) {
  const primary = primaryAssignment(entry);
  const targetCalories = Number(primary?.targetCalories);
  const targetMacros = primary?.targetMacros || {};
  const hasCalories = Number.isFinite(targetCalories) && targetCalories > 0;
  const hasMacros = hasComparableTargetMacros(targetMacros);
  if (!hasCalories || !hasMacros) return null;
  return (
    comparableNumber(targetCalories) === comparableNumber(target?.kcal) &&
    comparableNumber(targetMacros.p) === comparableNumber(target?.p) &&
    comparableNumber(targetMacros.c) === comparableNumber(target?.c) &&
    comparableNumber(targetMacros.g) === comparableNumber(target?.g)
  );
}

function assignmentPredatesTargetRevision(client = {}, entry = {}) {
  const primary = primaryAssignment(entry);
  const assignedAt = Date.parse(primary?.assignedAt || "");
  const targetRevision = Date.parse(
    client?.menu?.weeklyPlan?.targetsUpdatedAt ||
    client?.metasActuales?.updatedAt ||
    ""
  );
  return Number.isFinite(assignedAt) && Number.isFinite(targetRevision) && assignedAt < targetRevision;
}

function isStaleAssignment(client = {}, entry = {}, target = {}) {
  const createdForTarget = assignmentWasCreatedForTarget(entry, target);
  if (createdForTarget !== null) return !createdForTarget;
  return assignmentPredatesTargetRevision(client, entry);
}

export function buildNutritionAssignmentImpact(client = {}, nextDraft = {}) {
  const assignments = client?.menu?.weeklyPlan?.assignedMenusByDay || {};
  const currentWeek = resolveNutritionWeek(targetDraftFromClient(client));
  const nextWeek = resolveNutritionWeek({
    ...nextDraft,
    kcal: calculateMacroKcal(nextDraft.p, nextDraft.c, nextDraft.g) ?? nextDraft.kcal,
  });

  const affectedDays = NUTRITION_WEEK_DAYS.reduce((result, day) => {
    const assigned = assignedEntryForDay(assignments, day);
    if (!assigned) return result;
    const previousTarget = currentWeek.targets?.[day.key] || {};
    const nextTarget = nextWeek.targets?.[day.key] || {};
    const targetChanged = targetSignature(previousTarget) !== targetSignature(nextTarget);
    const staleAssignment = isStaleAssignment(client, assigned, nextTarget);
    if (!targetChanged && !staleAssignment) return result;
    result.push({
      key: day.key,
      label: day.label,
      assignedMenus: assignedMenuCount(assigned),
      previousTarget: compactTarget(previousTarget),
      nextTarget: compactTarget(nextTarget),
      reason: targetChanged ? "target_changed" : "stale_assignment",
    });
    return result;
  }, []);

  return {
    affectedDays,
    affectedDayKeys: affectedDays.map((day) => day.key),
    assignedMenus: affectedDays.reduce((total, day) => total + day.assignedMenus, 0),
    changedDays: affectedDays.filter((day) => day.reason === "target_changed").length,
    staleDays: affectedDays.filter((day) => day.reason === "stale_assignment").length,
    previousWeeklyKcal: comparableNumber(currentWeek?.summary?.currentWeeklyKcal),
    nextWeeklyKcal: comparableNumber(nextWeek?.summary?.currentWeeklyKcal),
  };
}
