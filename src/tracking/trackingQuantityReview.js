import { nutritionTotals } from "./manualDayCompletion.js";

const REVIEW_FIELDS = [
  { key: "kcal", label: "Calorías", short: "Kcal", unit: "kcal" },
  { key: "proteina", label: "Proteína", short: "P", unit: "g" },
  { key: "carbs", label: "Carbohidratos", short: "C", unit: "g" },
  { key: "grasas", label: "Grasas", short: "G", unit: "g" },
];

const CALORIE_CEILING_EPSILON = 1e-6;
// Sólo controla la severidad visual. No cambia cantidades, ranking ni policy
// del optimizador: una diferencia mínima se mantiene informativa en vez de
// exigir una confirmación fuerte.
const PROTEIN_WARNING_MIN_GRAMS = 1;
const PROTEIN_WARNING_TARGET_RATIO = 0.02;
const INLINE_MACRO_LABELS = {
  proteina: "P",
  protein: "P",
  carbohidratos: "C",
  carbs: "C",
  grasas: "G",
  fat: "G",
};

function formatInlineNumber(value = 0) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(Number(value) || 0);
}

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

export function trackingQuantityInvalidFoods(optimization = null) {
  return Array.isArray(optimization?.invalidFoods)
    ? optimization.invalidFoods.filter((food) => food && typeof food === "object")
    : [];
}

export function trackingQuantityInvalidFoodsMessage(optimization = null) {
  const invalidFoods = trackingQuantityInvalidFoods(optimization);
  if (!invalidFoods.length) return "";
  return invalidFoods.map((food) => (
    `No se pudo calcular una cantidad para ${food.name || "un alimento"} porque no tiene información calórica válida.`
  )).join(" ");
}

export function trackingQuantitySecondaryMacroLimitations(
  optimization = null,
  proteinWarningActive = false
) {
  const limitations = Array.isArray(optimization?.macroLimitations)
    ? optimization.macroLimitations
    : [];
  if (!proteinWarningActive && optimization?.proteinReached !== true) return limitations;
  return limitations.filter((limitation) => ![
    "p",
    "protein",
    "proteina",
    "proteína",
  ].includes(String(limitation?.macro || "").trim().toLowerCase()));
}

export function trackingQuantityCaloriePrecisionKind(optimization = null) {
  if (optimization?.discreteLimited === true) return "discrete";
  if (optimization?.granularityLimited === true) return "granularity";
  return "";
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
  const proteinWarningTolerance = rowByKey.proteina.configured
    ? Math.max(
        PROTEIN_WARNING_MIN_GRAMS,
        rowByKey.proteina.target * PROTEIN_WARNING_TARGET_RATIO
      )
    : 0;
  const proteinLevel = proteinDeficit > proteinWarningTolerance + CALORIE_CEILING_EPSILON
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
    proteinWarningTolerance,
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

export function buildTrackingQuantityInlineFeedback({
  target = {},
  configured = {},
  proposal = {},
  optimization = null,
} = {}) {
  const review = buildTrackingQuantityReview({ target, proposal, configured, optimization });
  const notices = [];
  const calorieDeficit = Math.max(0, Number(target?.kcal || 0) - Number(proposal?.kcal || 0));
  const calorieTolerance = Math.max(0, Number(optimization?.calorieTolerance) || 1);

  if (calorieDeficit > calorieTolerance + CALORIE_CEILING_EPSILON) {
    const reason = optimization?.discreteLimited
      ? "por las unidades enteras disponibles"
      : optimization?.granularityLimited
        ? "por la precisión física de los alimentos"
        : "con los alimentos elegidos";
    notices.push(`Faltan ${formatInlineNumber(calorieDeficit)} kcal ${reason}.`);
  }

  const limitations = Array.isArray(optimization?.macroLimitations)
    ? optimization.macroLimitations
    : [];
  const macroParts = limitations.map((limitation) => {
    const key = String(limitation?.macro || "").trim().toLowerCase();
    const label = INLINE_MACRO_LABELS[key] || limitation?.macro || "Macro";
    return `${label} ${formatInlineNumber(Math.max(0, Number(limitation?.deficit) || 0))} g`;
  });

  if (!macroParts.some((part) => part.startsWith("P ")) && review.proteinLevel) {
    macroParts.unshift(`P ${formatInlineNumber(review.proteinDeficit)} g`);
  }
  if (macroParts.length) {
    notices.push(`Con estos alimentos todavía faltan ${macroParts.join(" · ")}.`);
  }

  if (optimization?.maxConstraintsLimited === true) {
    notices.push("Las porciones configuradas limitan cuánto puede acercarse la propuesta.");
  } else if (review.requiresCalorieZoneWarning && calorieDeficit <= calorieTolerance + CALORIE_CEILING_EPSILON) {
    notices.push("La propuesta quedó fuera de la zona calórica esperada.");
  }

  if (!notices.length) return null;
  return {
    type: "warning",
    title: calorieDeficit <= calorieTolerance + CALORIE_CEILING_EPSILON
      ? "Calorías completas, macros limitados"
      : "Revisá la propuesta",
    message: notices.join(" "),
  };
}
