export const DEFAULT_QUICK_TRACKING_DESTINATIONS = [
  {
    key: "picoteo",
    label: "Picoteo",
    description: "Fuera de una comida",
    mealId: "picoteo",
    mealType: "otra",
    mealName: "Picoteo",
    featured: true,
  },
  ...["desayuno", "almuerzo", "merienda", "cena", "snack"].map((mealType) => ({
    key: mealType,
    label: `${mealType.slice(0, 1).toUpperCase()}${mealType.slice(1)}`,
    mealId: mealType,
    mealType,
    mealName: `${mealType.slice(0, 1).toUpperCase()}${mealType.slice(1)}`,
  })),
];

function destinationType(value = "") {
  const type = String(value || "").trim().toLowerCase();
  return type === "otro" ? "otra" : type || "otra";
}

/** Los destinos dinámicos reemplazan el genérico del mismo momento. */
export function buildQuickTrackingDestinations(dynamicDestinations = []) {
  const supplied = (Array.isArray(dynamicDestinations) ? dynamicDestinations : [])
    .map((destination) => {
      const mealId = String(destination?.mealId || destination?.id || destination?.key || "").trim();
      if (!mealId || mealId === "picoteo") return null;
      const mealType = destinationType(
        destination?.mealType || destination?.tipo || destination?.type
      );
      const mealName = String(
        destination?.mealName || destination?.nombre || destination?.name || destination?.label || "Comida"
      ).trim();
      return {
        key: mealId,
        label: mealName,
        mealId,
        mealType,
        mealName,
      };
    })
    .filter(Boolean);
  const suppliedIds = new Set(supplied.map((destination) => destination.mealId));
  const suppliedTypes = new Set(supplied.map((destination) => destination.mealType));
  const defaults = DEFAULT_QUICK_TRACKING_DESTINATIONS.filter((destination) => (
    destination.featured
    || (!suppliedIds.has(destination.mealId) && !suppliedTypes.has(destination.mealType))
  ));
  return [...defaults.slice(0, 1), ...supplied, ...defaults.slice(1)]
    .filter((destination, index, all) => (
      all.findIndex((candidate) => candidate.key === destination.key) === index
    ));
}
