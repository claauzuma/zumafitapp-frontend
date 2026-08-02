import assert from "node:assert/strict";
import test from "node:test";

import {
  automaticMenuMatchMessage,
  buildCalorieTopUpMeal,
} from "./clientMenuAutomaticMatch.js";

test("aceptar 500 kcal agrega un complemento explícito y todavía no lo marca como comida completa", () => {
  const complement = buildCalorieTopUpMeal(
    { kcal: 500, proteina: 2, carbs: 75, grasas: 20 },
    { id: "top-up-1", order: 5 }
  );
  assert.equal(complement.target.kcal, 500);
  assert.equal(complement.items.length, 0);
  assert.equal(complement.generationSource, "calorie_top_up_pending");
  assert.equal(complement.orden, 5);
});

test("los estados sin coincidencia explican calorías y proteína por separado", () => {
  assert.match(automaticMenuMatchMessage("no_calorie_match"), /calorías/i);
  assert.match(automaticMenuMatchMessage("no_protein_match"), /proteica/i);
});
