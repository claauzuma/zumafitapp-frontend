import test from "node:test";
import assert from "node:assert/strict";

import { distributeGeneratorTarget, nutritionTargetForMenuGeneration } from "./clientMenuGenerationCore.js";

test("generador distribuye el objetivo sin inventar ni perder macros", () => {
  const target = { kcal: 2400, proteina: 160, carbs: 280, grasas: 70 };
  const rows = distributeGeneratorTarget(target, ["desayuno", "almuerzo", "merienda", "cena"], "balanced");
  assert.equal(rows.length, 4);
  const totals = rows.reduce((acc, row) => ({
    kcal: acc.kcal + row.target.kcal,
    proteina: acc.proteina + row.target.proteina,
    carbs: acc.carbs + row.target.carbs,
    grasas: acc.grasas + row.target.grasas,
  }), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  assert.ok(Math.abs(totals.kcal - target.kcal) < 0.2);
  assert.ok(Math.abs(totals.proteina - target.proteina) < 0.2);
  assert.ok(rows[1].target.kcal > rows[2].target.kcal);
});

test("generador conserva P cero como neutral", () => {
  const target = nutritionTargetForMenuGeneration({ metasActuales: { kcal: 1200, macros: { p: 0, c: 200, g: 44 } } });
  assert.equal(target.kcal, 1200);
  assert.equal(target.proteina, 0);
  assert.equal(target.carbs, 200);
});
