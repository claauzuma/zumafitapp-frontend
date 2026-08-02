function finite(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function automaticMenuMatchMessage(status = "") {
  if (status === "no_protein_match") return "Hay menús cercanos en calorías, pero ninguno alcanza esta meta proteica.";
  if (status === "no_calorie_match") return "No hay menús con estas calorías.";
  return "No encontramos un menú compatible en la biblioteca.";
}

export function buildCalorieTopUpMeal(topUpTarget = {}, { id = "calorie-top-up", order = 1 } = {}) {
  const kcal = finite(topUpTarget.kcal);
  return {
    id,
    nombre: `Completar ${Math.round(kcal)} kcal`,
    tipoComida: "snack",
    orden: order,
    items: [],
    target: {
      kcal,
      proteina: finite(topUpTarget.proteina),
      carbs: finite(topUpTarget.carbs),
      grasas: finite(topUpTarget.grasas),
    },
    notas: "Complemento pendiente: elegí sus alimentos antes de guardar el menú.",
    generationSource: "calorie_top_up_pending",
  };
}
