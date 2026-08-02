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
  return mealTypes.map((type, index) => {
    const ratio = rawWeights[index] / weightSum;
    return {
      type,
      name: LABELS[type] || `Comida ${index + 1}`,
      target: {
        kcal: Math.round(generationNumber(target.kcal) * ratio * 10) / 10,
        proteina: Math.round(generationNumber(target.proteina) * ratio * 10) / 10,
        carbs: Math.round(generationNumber(target.carbs) * ratio * 10) / 10,
        grasas: Math.round(generationNumber(target.grasas) * ratio * 10) / 10,
      },
    };
  });
}
