export const GENERATOR_DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
export const GENERATOR_MEAL_TYPES = ["desayuno", "almuerzo", "merienda", "cena", "snack", "colacion", "pre_entreno", "post_entreno"];

const LABELS = {
  desayuno: "Desayuno", almuerzo: "Almuerzo", merienda: "Merienda", cena: "Cena", snack: "Snack",
  colacion: "Colacion", pre_entreno: "Pre-entreno", post_entreno: "Post-entreno",
};

export function generationNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function firstPositive(...values) {
  for (const value of values) {
    const parsed = generationNumber(value);
    if (parsed > 0) return parsed;
  }
  return 0;
}

export function nutritionTargetForMenuGeneration(user = {}) {
  const goals = user?.metasActuales || user?.metas || {};
  const macros = goals?.macros || goals?.macrosObjetivo || user?.macrosObjetivo || {};
  return {
    kcal: firstPositive(goals.kcal, goals.calorias, goals.caloriasObjetivo, goals.objetivoCalorico, user.objetivoCalorico, user.kcalObjetivo),
    proteina: firstPositive(macros.p, macros.proteina, macros.proteinas, macros.protein, user.proteinaObjetivo),
    carbs: firstPositive(macros.c, macros.carbs, macros.carbohidratos, user.carbsObjetivo),
    grasas: firstPositive(macros.g, macros.grasas, macros.fat, user.grasasObjetivo),
  };
}

export function distributeGeneratorTarget(target = {}, mealTypes = [], distribution = "balanced") {
  const count = Math.max(1, mealTypes.length);
  const presets = { desayuno: 0.22, almuerzo: 0.32, merienda: 0.14, cena: 0.27, snack: 0.05, colacion: 0.08, pre_entreno: 0.1, post_entreno: 0.14 };
  const rawWeights = mealTypes.map((type) => distribution === "equal" ? 1 : presets[type] || 1 / count);
  const weightSum = rawWeights.reduce((sum, value) => sum + value, 0) || 1;
  const ratios = rawWeights.map((value) => value / weightSum);
  const distribute = (value) => {
    const total = Math.round(generationNumber(value) * 10) / 10;
    let assigned = 0;
    return ratios.map((ratio, index) => {
      const amount = index === ratios.length - 1
        ? Math.round((total - assigned) * 10) / 10
        : Math.round(total * ratio * 10) / 10;
      assigned = Math.round((assigned + amount) * 10) / 10;
      return amount;
    });
  };
  const kcal = distribute(target.kcal);
  const proteina = distributeGeneratorProteinTarget(target.proteina, ratios);
  const carbs = distribute(target.carbs);
  const grasas = distribute(target.grasas);
  return mealTypes.map((type, index) => {
    return {
      type,
      name: LABELS[type] || `Comida ${index + 1}`,
      target: {
        kcal: kcal[index],
        proteina: proteina[index],
        carbs: carbs[index],
        grasas: grasas[index],
      },
    };
  });
}

export function distributeGeneratorProteinTarget(value, ratios = []) {
  const count = Math.max(1, ratios.length);
  const minimumTenths = 150;
  const maximumTenths = 650;
  const requested = generationNumber(value);
  const totalTenths = requested > 0
    ? Math.round(requested * 10)
    : minimumTenths * count;
  if (totalTenths < minimumTenths * count || totalTenths > maximumTenths * count) {
    const error = new Error(`La meta diaria de proteína debe permitir entre 15 g y 65 g por comida para ${count} comidas.`);
    error.code = "MENU_DAILY_PROTEIN_RANGE";
    error.details = {
      requestedProtein: requested,
      minimumDailyProtein: (minimumTenths * count) / 10,
      maximumDailyProtein: (maximumTenths * count) / 10,
      mealCount: count,
    };
    throw error;
  }
  const normalizedRatios = ratios.length === count && ratios.some((ratio) => ratio > 0)
    ? ratios.map((ratio) => Math.max(0, Number(ratio) || 0))
    : Array.from({ length: count }, () => 1 / count);
  const values = Array.from({ length: count }, () => minimumTenths);
  const extras = Array.from({ length: count }, () => 0);
  let pending = totalTenths - (minimumTenths * count);
  while (pending > 0) {
    let selected = -1;
    let bestPriority = -Infinity;
    for (let index = 0; index < count; index += 1) {
      if (values[index] >= maximumTenths) continue;
      const priority = normalizedRatios[index] / (extras[index] + 1);
      if (priority > bestPriority) {
        selected = index;
        bestPriority = priority;
      }
    }
    if (selected < 0) break;
    values[selected] += 1;
    extras[selected] += 1;
    pending -= 1;
  }
  return values.map((amount) => amount / 10);
}

export function generatorMealSpecs({ target = {}, mealTypes = [], distribution = "balanced", mealTargets = [] } = {}) {
  if (!Array.isArray(mealTargets) || !mealTargets.length) {
    return distributeGeneratorTarget(target, mealTypes, distribution);
  }
  const byType = new Map(mealTargets.map((entry) => [String(entry.type || entry.tipo || ""), entry]));
  return mealTypes.map((type, index) => {
    const source = byType.get(type) || mealTargets[index] || {};
    const mealTarget = source.target || source.totals || source;
    const protein = generationNumber(mealTarget.proteina ?? mealTarget.p);
    if (protein > 0 && (protein < 15 || protein > 65)) {
      const error = new Error(`${source.label || source.name || source.nombre || LABELS[type] || `Comida ${index + 1}`} debe tener entre 15 g y 65 g de proteína.`);
      error.code = "MENU_COACH_MEAL_PROTEIN_RANGE";
      error.mealType = type;
      throw error;
    }
    return {
      type,
      name: source.label || source.name || source.nombre || LABELS[type] || `Comida ${index + 1}`,
      target: {
        kcal: generationNumber(mealTarget.kcal),
        proteina: protein || 15,
        carbs: generationNumber(mealTarget.carbs ?? mealTarget.c),
        grasas: generationNumber(mealTarget.grasas ?? mealTarget.g),
      },
      coachTarget: true,
    };
  });
}
