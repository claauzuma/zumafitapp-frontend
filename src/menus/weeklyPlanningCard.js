export const EMPTY_DAY_ACTIONS = Object.freeze([
  { key: "choose", label: "Elegir menú" },
  { key: "target", label: "Definir meta" },
  { key: "create", label: "Crear menú" },
]);

export function emptyDayPlanningCopy({ kcal = 0, protein = 0 } = {}) {
  return {
    status: "Sin planificación",
    targetLabel: "Meta actual",
    kcal: Number(kcal) || 0,
    protein: Number(protein) || 0,
    explanation: "Todavía no definiste cómo manejar este día.",
  };
}

export const ASSIGNED_DAY_PLANNING_ACTIONS = Object.freeze([
  { key: "edit", label: "Editar menú" },
  { key: "choose", label: "Cambiar menú" },
  { key: "target", label: "Definir meta" },
]);

export const TARGET_DEFINITION_MODES = Object.freeze([
  {
    key: "per_meal",
    label: "Personalizar por comida",
    description: "Elegí de 3 a 6 comidas y definí kcal + P/C/G para cada una.",
    recommended: true,
  },
  {
    key: "mixed",
    label: "Plan mixto",
    description: "Definí algunas comidas y dejá el resto flexible con la meta restante.",
    recommended: false,
  },
  {
    key: "daily_only",
    label: "Solo meta diaria",
    description: "Definí kcal y macros del día. El cliente arma el menú como quiera.",
    recommended: false,
  },
]);

export function defaultTargetDefinitionMode() {
  return TARGET_DEFINITION_MODES.find((mode) => mode.recommended)?.key || TARGET_DEFINITION_MODES[0].key;
}
