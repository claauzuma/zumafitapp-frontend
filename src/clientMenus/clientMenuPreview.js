function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function generatedMenuTotals(menu = {}) {
  return (menu?.comidas || []).reduce((totals, meal) => (meal?.items || []).reduce((sum, item) => ({
    kcal: sum.kcal + number(item.kcal),
    proteina: sum.proteina + number(item.proteina ?? item.protein),
    carbs: sum.carbs + number(item.carbs),
    grasas: sum.grasas + number(item.grasas ?? item.fat),
  }), totals), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

export function replaceGeneratedPreviewMeal(preview = {}, mealIndex = -1, replacement = null) {
  if (!replacement || !Array.isArray(preview?.comidas) || !preview.comidas[mealIndex]) return preview;
  const currentMeal = preview.comidas[mealIndex];
  return {
    ...preview,
    comidas: preview.comidas.map((meal, index) => index === mealIndex
      ? {
          ...replacement,
          id: currentMeal.id,
          orden: currentMeal.orden,
          nombre: currentMeal.nombre || replacement.nombre,
        }
      : meal),
  };
}

export function buildGeneratedMenuActivationPayload(preview = {}, target = null) {
  const clean = { ...preview };
  delete clean.focusName;
  delete clean.isActiveOwnMenu;
  const selectedTarget = target || clean.menuTarget || {};
  const payload = {
    ...clean,
    activate: true,
    estrategiaObjetivo: "custom",
    kcalObjetivo: number(selectedTarget.kcal),
    macrosObjetivo: {
      proteina: number(selectedTarget.proteina ?? selectedTarget.p),
      carbs: number(selectedTarget.carbs ?? selectedTarget.c),
      grasas: number(selectedTarget.grasas ?? selectedTarget.g),
    },
  };
  delete payload.menuTarget;
  delete payload.objectiveMode;
  return payload;
}
