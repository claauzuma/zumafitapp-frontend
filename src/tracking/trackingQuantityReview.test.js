import assert from "node:assert/strict";
import test from "node:test";

import { buildTrackingQuantityReview } from "./trackingQuantityReview.js";

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
