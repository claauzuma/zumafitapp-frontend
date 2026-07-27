import { nutritionTotals } from "./manualDayCompletion.js";

const REVIEW_FIELDS = [
  { key: "kcal", label: "Calorías", short: "Kcal", unit: "kcal" },
  { key: "proteina", label: "Proteína", short: "P", unit: "g" },
  { key: "carbs", label: "Carbohidratos", short: "C", unit: "g" },
  { key: "grasas", label: "Grasas", short: "G", unit: "g" },
];

const CALORIE_CEILING_EPSILON = 1e-6;
// Sólo controla la presentación. Hasta 0,5 g coincide con el estado "exacto"
// del contrato del motor y no cambia cantidades, ranking ni policy.
const PROTEIN_WARNING_EPSILON = 0.5;

function isConfigured(configured = {}, key, target) {
  if (configured?.[key] === true) return true;
  if (configured?.[key] === false) return false;
  return Number(target?.[key]) > 0;
}

function preciseNutritionTotals(value = {}) {
  const rounded = nutritionTotals(value);
  return Object.fromEntries(
    REVIEW_FIELDS.map(({ key }) => {
      const directValue = Number(value?.[key]);
      return [key, Number.isFinite(directValue) ? directValue : rounded[key]];
    })
  );
}

export function buildTrackingQuantityReview({
  target = {},
  proposal = {},
  configured = {},
  optimization = null,
} = {}) {
  const normalizedTarget = preciseNutritionTotals(target);
  const normalizedProposal = preciseNutritionTotals(proposal);
  const rows = REVIEW_FIELDS.map((field) => {
    const targetValue = Number(normalizedTarget[field.key]) || 0;
    const proposedValue = Number(normalizedProposal[field.key]) || 0;
    return {
      ...field,
      configured: isConfigured(configured, field.key, normalizedTarget),
      target: targetValue,
      proposed: proposedValue,
      difference: proposedValue - targetValue,
    };
  });
  const rowByKey = Object.fromEntries(rows.map((row) => [row.key, row]));
  const proteinDeficit = rowByKey.proteina.configured
    ? Math.max(0, rowByKey.proteina.target - rowByKey.proteina.proposed)
    : 0;
  const proteinLevel = proteinDeficit > PROTEIN_WARNING_EPSILON
    ? proteinDeficit <= 10 ? "near" : "high"
    : null;
  const calorieExcess = rowByKey.kcal.configured
    ? Math.max(0, rowByKey.kcal.difference)
    : 0;
  const secondaryMacroRows = [rowByKey.carbs, rowByKey.grasas].filter(
    (row) => row.configured && Math.abs(row.difference) > 0.5
  );
  const outOfNormalCalorieZone = optimization?.normalCalorieZoneReached === false;
  const requiresCalorieZoneWarning = outOfNormalCalorieZone &&
    optimization?.maxConstraintsLimited !== true &&
    proteinLevel === null;

  return {
    rows,
    rowByKey,
    proteinDeficit,
    proteinLevel,
    requiresProteinConfirmation: proteinLevel !== null,
    calorieExcess,
    respectsCalorieCeiling: calorieExcess <= CALORIE_CEILING_EPSILON,
    outOfNormalCalorieZone,
    requiresCalorieZoneWarning,
    secondaryMacroRows,
    canContinue: calorieExcess <= CALORIE_CEILING_EPSILON,
  };
}
