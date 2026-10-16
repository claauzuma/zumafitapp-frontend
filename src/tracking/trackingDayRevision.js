function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed * 1000) / 1000 : 0;
}

/** Snapshot mínimo para impedir que una preview vieja pise Tracking reciente. */
export function trackingDayRevision(day = null) {
  if (!day) return "missing";
  const configs = (Array.isArray(day?.mealsConfig) ? day.mealsConfig : []).map((meal) => ({
    id: String(meal?.mealId || meal?.id || ""),
    targetOrigin: String(meal?.targetOrigin || ""),
    confirmed: meal?.metaConfirmed === true,
    meta: ["kcal", "proteina", "carbs", "grasas"].map((key) => number(
      meal?.meta?.[key] ?? meal?.target?.[key]
    )),
  })).sort((left, right) => left.id.localeCompare(right.id));
  const logs = Object.entries(day?.meals || {}).flatMap(([mealId, items]) => (
    (Array.isArray(items) ? items : []).map((item) => ({
      mealId,
      id: String(item?.id || item?._id || item?.writeRequestId || ""),
      quantity: number(item?.cantidad ?? item?.quantity),
      totals: ["kcal", "proteina", "carbs", "grasas"].map((key) => number(item?.[key])),
    }))
  )).sort((left, right) => `${left.mealId}:${left.id}`.localeCompare(`${right.mealId}:${right.id}`));
  return JSON.stringify({ date: String(day?.date || ""), configs, logs });
}
