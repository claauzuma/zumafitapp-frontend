import assert from "node:assert/strict";
import test from "node:test";

import { nutritionTargetForMenuGeneration } from "../clientMenus/clientMenuGenerationCore.js";
import { normalizeGoalFromUser } from "./nutritionState.js";

const persistedAfterOnboarding = {
  metasActuales: {
    kcal: 2326,
    macros: { p: 160, c: 262, g: 64 },
    source: "self",
    needsReview: false,
    updatedAt: "2026-10-11T12:00:00.000Z",
  },
};

test("Menú reconoce como completa la meta persistida al finalizar onboarding", () => {
  const target = normalizeGoalFromUser(persistedAfterOnboarding);

  assert.deepEqual(target, {
    kcal: 2326,
    p: 160,
    c: 262,
    g: 64,
    configured: true,
    complete: true,
  });
});

test("generación y Por meta reciben los mismos valores canónicos del onboarding", () => {
  const target = nutritionTargetForMenuGeneration(persistedAfterOnboarding);

  assert.deepEqual(target, {
    kcal: 2326,
    proteina: 160,
    carbs: 262,
    grasas: 64,
  });
});
