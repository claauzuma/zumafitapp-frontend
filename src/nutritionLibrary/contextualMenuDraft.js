const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function numeric(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function selectedDay(dateValue = "") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue));
  if (!match) return "monday";
  return DAY_KEYS[new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay()];
}

function sourceMeals(menu = {}) {
  if (Array.isArray(menu.comidas) && menu.comidas.length) return menu.comidas;
  if (Array.isArray(menu.meals) && menu.meals.length) return menu.meals;
  return [];
}

export function buildContextualMenuDraft(menu = {}, target = {}, selectedDate = "", { adjustToTarget = false } = {}) {
  const menuKey = String(menu.id || menu._id || "menu");
  const meals = sourceMeals(menu).map((meal, mealIndex) => ({
    id: `context-meal-${menuKey}-${mealIndex}`,
    nombre: meal.nombre || meal.name || `Comida ${mealIndex + 1}`,
    tipoComida: meal.tipoComida || meal.mealType || "otra",
    orden: meal.orden || mealIndex + 1,
    target: meal.target || meal.meta || null,
    items: (Array.isArray(meal.items) ? meal.items : Array.isArray(meal.alimentos) ? meal.alimentos : []).map((item, itemIndex) => ({
      ...item,
      id: `context-food-${menuKey}-${mealIndex}-${itemIndex}`,
    })),
  }));
  const normalizedTarget = {
    kcal: numeric(target.kcal),
    proteina: numeric(target.proteina),
    carbs: numeric(target.carbs),
    grasas: numeric(target.grasas),
  };

  return {
    nombre: `${menu.nombre || menu.name || "Menú"} · alternativa`,
    descripcion: menu.descripcion || menu.description || "",
    fechaInicio: /^\d{4}-\d{2}-\d{2}$/.test(String(selectedDate)) ? selectedDate : "",
    objectiveMode: adjustToTarget ? "custom" : "current",
    menuTarget: adjustToTarget ? normalizedTarget : null,
    selectedDays: [selectedDay(selectedDate)],
    comidas: meals,
    isActiveOwnMenu: false,
    templateSourceId: menuKey,
  };
}

