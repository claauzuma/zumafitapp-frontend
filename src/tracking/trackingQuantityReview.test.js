import assert from "node:assert/strict";
import test from "node:test";

import {
  buildTrackingQuantityInlineFeedback,
  buildTrackingQuantityReview,
  trackingQuantityCaloriePrecisionKind,
  trackingQuantityInvalidFoods,
  trackingQuantityInvalidFoodsMessage,
  trackingQuantitySecondaryMacroLimitations,
} from "./trackingQuantityReview.js";

const configured = { kcal: true, proteina: true, carbs: true, grasas: true };

test("no advierte proteina cuando llega o supera el objetivo", () => {
  const exact = buildTrackingQuantityReview({
    target: { kcal: 500, proteina: 40 },
    proposal: { kcal: 499, proteina: 40 },
    configured,
  });
  const exceeded = buildTrackingQuantityReview({
    target: { kcal: 500, proteina: 40 },
    proposal: { kcal: 499, proteina: 43 },
    configured,
  });

  assert.equal(exact.proteinLevel, null);
  assert.equal(exceeded.proteinLevel, null);
  assert.equal(exceeded.canContinue, true);
});

test("clasifica el deficit proteico hasta 10 g y mayor a 10 g", () => {
  const near = buildTrackingQuantityReview({
    target: { kcal: 355, proteina: 40 },
    proposal: { kcal: 353.6, proteina: 30 },
    configured,
  });
  const high = buildTrackingQuantityReview({
    target: { kcal: 355, proteina: 40 },
    proposal: { kcal: 353.6, proteina: 8.32 },
    configured,
  });

  assert.equal(near.proteinDeficit, 10);
  assert.equal(near.proteinLevel, "near");
  assert.equal(high.proteinLevel, "high");
  assert.ok(high.proteinDeficit > 31.6);
});

test("no convierte una diferencia visual de 0,3 g en alerta proteica", () => {
  const review = buildTrackingQuantityReview({
    target: { kcal: 610, proteina: 60.3, carbs: 0, grasas: 40.4 },
    proposal: { kcal: 492, proteina: 60, carbs: 0, grasas: 28 },
    configured,
    optimization: {
      normalCalorieZoneReached: false,
      maxConstraintsLimited: true,
    },
  });

  assert.ok(Math.abs(review.proteinDeficit - 0.3) < 1e-9);
  assert.equal(review.proteinLevel, null);
  assert.equal(review.requiresProteinConfirmation, false);
  assert.equal(review.outOfNormalCalorieZone, true);
  assert.equal(review.requiresCalorieZoneWarning, false);
});

test("un déficit proteico mínimo y proporcional no exige confirmación fuerte", () => {
  const minimal = buildTrackingQuantityReview({
    target: { kcal: 500, proteina: 60 },
    proposal: { kcal: 499, proteina: 59.4 },
    configured,
  });
  const relevant = buildTrackingQuantityReview({
    target: { kcal: 500, proteina: 60 },
    proposal: { kcal: 499, proteina: 58.7 },
    configured,
  });

  assert.ok(Math.abs(minimal.proteinDeficit - 0.6) < 1e-9);
  assert.equal(minimal.proteinWarningTolerance, 1.2);
  assert.equal(minimal.proteinLevel, null);
  assert.equal(minimal.requiresProteinConfirmation, false);
  assert.equal(relevant.proteinLevel, "near");
  assert.equal(relevant.requiresProteinConfirmation, true);
});

test("muestra la salida de zona como alerta sólo cuando no hay otra limitación principal", () => {
  const review = buildTrackingQuantityReview({
    target: { kcal: 800, proteina: 60, carbs: 90, grasas: 22 },
    proposal: { kcal: 492, proteina: 60, carbs: 0, grasas: 28 },
    configured,
    optimization: {
      normalCalorieZoneReached: false,
      maxConstraintsLimited: false,
    },
  });

  assert.equal(review.proteinLevel, null);
  assert.equal(review.outOfNormalCalorieZone, true);
  assert.equal(review.requiresCalorieZoneWarning, true);
});

test("C y G son informativos y el exceso calorico bloquea continuar", () => {
  const review = buildTrackingQuantityReview({
    target: { kcal: 500, proteina: 30, carbs: 50, grasas: 20 },
    proposal: { kcal: 500.1, proteina: 31, carbs: 38, grasas: 23 },
    configured,
  });

  assert.equal(review.secondaryMacroRows.length, 2);
  assert.equal(review.rowByKey.carbs.difference, -12);
  assert.equal(review.rowByKey.grasas.difference, 3);
  assert.equal(review.respectsCalorieCeiling, false);
  assert.equal(review.canContinue, false);
});

test("el techo calorico es estricto aun cuando el exceso se redondearia visualmente", () => {
  const review = buildTrackingQuantityReview({
    target: { kcal: 500, proteina: 30 },
    proposal: { kcal: 500.005, proteina: 30 },
    configured,
  });

  assert.equal(review.respectsCalorieCeiling, false);
  assert.equal(review.canContinue, false);
  assert.ok(review.calorieExcess > 0);
});

test("distingue un macro no configurado de un restante configurado en cero", () => {
  const review = buildTrackingQuantityReview({
    target: { kcal: 355, proteina: 0, carbs: 0, grasas: 0 },
    proposal: { kcal: 353.6, proteina: 8.32, carbs: 78.52, grasas: 0.52 },
    configured: { kcal: true, proteina: true, carbs: false, grasas: false },
  });

  assert.equal(review.rowByKey.proteina.configured, true);
  assert.equal(review.proteinLevel, null);
  assert.equal(review.secondaryMacroRows.length, 0);
});

test("expone el alimento inválido con un error específico aunque no haya propuesta", () => {
  const optimization = {
    policy: "tracking_calorie_fill_v1",
    invalidFoods: [
      { foodId: "zero", name: "Agua sin datos", unit: "ml", reason: "invalid_calories" },
    ],
  };

  assert.equal(trackingQuantityInvalidFoods(optimization).length, 1);
  assert.equal(
    trackingQuantityInvalidFoodsMessage(optimization),
    "No se pudo calcular una cantidad para Agua sin datos porque no tiene información calórica válida."
  );
});

test("no duplica la limitación proteica fuerte dentro de la información secundaria", () => {
  const optimization = {
    macroLimitations: [
      { macro: "proteina", deficit: 18 },
      { macro: "carbs", deficit: 22 },
      { macro: "grasas", deficit: 7 },
    ],
  };

  assert.deepEqual(
    trackingQuantitySecondaryMacroLimitations(optimization, true).map((item) => item.macro),
    ["carbs", "grasas"]
  );
  assert.equal(trackingQuantitySecondaryMacroLimitations(optimization, false).length, 3);
  assert.deepEqual(
    trackingQuantitySecondaryMacroLimitations(
      { ...optimization, proteinReached: true },
      false
    ).map((item) => item.macro),
    ["carbs", "grasas"]
  );
});

test("clasifica la granularidad física como información y prioriza unidades discretas", () => {
  assert.equal(
    trackingQuantityCaloriePrecisionKind({ granularityLimited: true }),
    "granularity"
  );
  assert.equal(
    trackingQuantityCaloriePrecisionKind({ discreteLimited: true }),
    "discrete"
  );
  assert.equal(
    trackingQuantityCaloriePrecisionKind({
      discreteLimited: true,
      granularityLimited: true,
    }),
    "discrete"
  );
  assert.equal(trackingQuantityCaloriePrecisionKind({}), "");
});

test("el cálculo inline no agrega ruido cuando calorías y macros quedaron bien", () => {
  const feedback = buildTrackingQuantityInlineFeedback({
    target: { kcal: 500, proteina: 45, carbs: 55, grasas: 11 },
    proposal: { kcal: 499.95, proteina: 45.44, carbs: 55.12, grasas: 10.86 },
    configured,
    optimization: {
      calorieTolerance: 1,
      calorieTargetCompleted: true,
      macroLimitations: [],
    },
  });

  assert.equal(feedback, null);
});

test("el cálculo inline resume únicamente las limitaciones relevantes de macros", () => {
  const feedback = buildTrackingQuantityInlineFeedback({
    target: { kcal: 903, proteina: 58.5, carbs: 38.4, grasas: 56.1 },
    proposal: { kcal: 902.79, proteina: 179.74, carbs: 0, grasas: 20.43 },
    configured,
    optimization: {
      calorieTolerance: 1,
      calorieTargetCompleted: true,
      macroLimitations: [
        { macro: "carbohidratos", deficit: 38.4 },
        { macro: "grasas", deficit: 35.67 },
      ],
    },
  });

  assert.equal(feedback.type, "warning");
  assert.equal(feedback.title, "Calorías completas, macros limitados");
  assert.match(feedback.message, /C 38,4 g/);
  assert.match(feedback.message, /G 35,7 g/);
  assert.doesNotMatch(feedback.message, /P /);
});

test("el cálculo inline explica el déficit causado por unidades discretas", () => {
  const feedback = buildTrackingQuantityInlineFeedback({
    target: { kcal: 500, proteina: 40 },
    proposal: { kcal: 483, proteina: 42 },
    configured: { kcal: true, proteina: true },
    optimization: {
      calorieTolerance: 1,
      discreteLimited: true,
      macroLimitations: [],
    },
  });

  assert.equal(feedback.title, "Revisá la propuesta");
  assert.match(feedback.message, /17 kcal/);
  assert.match(feedback.message, /unidades enteras/);
});
