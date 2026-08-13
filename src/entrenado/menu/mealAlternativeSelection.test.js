import test from "node:test";
import assert from "node:assert/strict";

import {
  activateMealReplacement,
  mealReplacementSlot,
  replaceClientGeneratedSlot,
} from "./mealAlternativeSelection.js";

const context = { date: "2026-08-13", mealIndex: 1, originalMealId: "lunch" };

function entry(id, slot, active = true) {
  return { id, replacementSlot: slot, originalMealId: "lunch", isActiveReplacement: active };
}

test("la comida original se recupera desactivando opciones sin borrar alternativas", () => {
  const entries = [entry("coach", "coach_assigned"), entry("client", "client_generated", false)];
  const restored = activateMealReplacement(entries, context, "");
  assert.equal(restored.length, 2);
  assert.equal(restored.every((item) => item.isActiveReplacement === false), true);
});

test("solo una alternativa queda activa y la eleccion es persistible", () => {
  const entries = [entry("coach", "coach_assigned"), entry("client", "client_generated", false)];
  const selected = activateMealReplacement(entries, context, "client");
  assert.equal(selected.find((item) => item.id === "coach").isActiveReplacement, false);
  assert.equal(selected.find((item) => item.id === "client").isActiveReplacement, true);
});

test("una nueva generacion pisa solo el slot del cliente", () => {
  const entries = [entry("coach", "coach_assigned"), entry("old-client", "client_generated", false)];
  const result = replaceClientGeneratedSlot(entries, entry("new-client", "client_generated"), context);
  assert.deepEqual(result.map((item) => item.id), ["coach", "new-client"]);
  assert.equal(result[0].isActiveReplacement, false);
  assert.equal(result[1].isActiveReplacement, true);
});

test("los registros custom historicos se reconocen como slot del cliente", () => {
  assert.equal(mealReplacementSlot({ mode: "custom_equivalent" }), "client_generated");
  assert.equal(mealReplacementSlot({ mode: "assigned" }), "coach_assigned");
});

