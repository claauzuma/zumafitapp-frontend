function clean(value) {
  return String(value || "").trim();
}

export function mealReplacementSlot(entry = {}) {
  const explicit = clean(entry.replacementSlot).toLowerCase();
  if (explicit === "client_generated" || explicit === "coach_assigned") return explicit;
  return entry.mode === "custom_equivalent" ? "client_generated" : "coach_assigned";
}

export function mealReplacementSelectionKey(entry = {}) {
  return clean(entry.selectionKey || entry.id);
}

export function replacementBelongsToMeal(entry = {}, { date = "", mealIndex = 0, originalMealId = "" } = {}) {
  const id = clean(entry.id);
  const prefix = `client-meal-replacement-${clean(date) || "day"}-${Number(mealIndex) || 0}-`;
  return id.startsWith(prefix) || (
    clean(originalMealId) && clean(entry.originalMealId) === clean(originalMealId)
  );
}

export function activateMealReplacement(entries = [], context = {}, selectionKey = "") {
  const wanted = clean(selectionKey);
  return (Array.isArray(entries) ? entries : []).map((entry) => {
    if (!replacementBelongsToMeal(entry, context)) return entry;
    return {
      ...entry,
      isActiveReplacement: wanted !== "" && mealReplacementSelectionKey(entry) === wanted,
    };
  });
}

export function replaceClientGeneratedSlot(entries = [], nextEntry = {}, context = {}) {
  const preserved = (Array.isArray(entries) ? entries : []).filter((entry) => !(
    replacementBelongsToMeal(entry, context) && mealReplacementSlot(entry) === "client_generated"
  ));
  return [
    ...activateMealReplacement(preserved, context, ""),
    { ...nextEntry, replacementSlot: "client_generated", isActiveReplacement: true },
  ];
}

