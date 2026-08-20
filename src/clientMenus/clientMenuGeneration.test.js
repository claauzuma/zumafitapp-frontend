import test from "node:test";
import assert from "node:assert/strict";

import { distributeGeneratorProteinTarget, distributeGeneratorTarget, generatorMealSpecs, nutritionTargetForMenuGeneration } from "./clientMenuGenerationCore.js";

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
  assert.equal(totals.kcal, target.kcal);
  assert.equal(totals.proteina, target.proteina);
  assert.equal(totals.carbs, target.carbs);
  assert.equal(totals.grasas, target.grasas);
  assert.ok(rows[1].target.kcal > rows[2].target.kcal);
});

test("partes iguales conserva el total y produce exactamente tres comidas", () => {
  const target = { kcal: 2132, proteina: 170, carbs: 206, grasas: 70 };
  const rows = distributeGeneratorTarget(target, ["desayuno", "almuerzo", "cena"], "equal");
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((row) => row.type), ["desayuno", "almuerzo", "cena"]);
  assert.equal(rows.reduce((sum, row) => sum + row.target.kcal, 0), target.kcal);
  assert.equal(rows.reduce((sum, row) => sum + row.target.proteina, 0), target.proteina);
});

test("metas nativas del coach se conservan por comida sin recalcular", () => {
  const mealTargets = [
    { type: "desayuno", label: "Desayuno del coach", target: { kcal: 450, p: 30, c: 50, g: 12 } },
    { type: "almuerzo", target: { kcal: 725, proteina: 55, carbs: 70, grasas: 20 } },
    { type: "cena", target: { kcal: 625, proteina: 45, carbs: 55, grasas: 18 } },
  ];
  const rows = generatorMealSpecs({
    target: { kcal: 1800, proteina: 130, carbs: 175, grasas: 50 },
    mealTypes: ["desayuno", "almuerzo", "cena"],
    mealTargets,
  });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].name, "Desayuno del coach");
  assert.deepEqual(rows.map((row) => row.target.kcal), [450, 725, 625]);
  assert.equal(rows.every((row) => row.coachTarget), true);
});

test("generador conserva P cero como neutral", () => {
  const target = nutritionTargetForMenuGeneration({ metasActuales: { kcal: 1200, macros: { p: 0, c: 200, g: 44 } } });
  assert.equal(target.kcal, 1200);
  assert.equal(target.proteina, 0);
  assert.equal(target.carbs, 200);
});

test("varias generaciones de 3 a 6 comidas conservan proteina diaria y dejan cada comida entre 15 y 65", () => {
  const scenarios = [
    { types: ["desayuno", "almuerzo", "cena"], protein: 150 },
    { types: ["desayuno", "almuerzo", "merienda", "cena"], protein: 170 },
    { types: ["desayuno", "almuerzo", "merienda", "cena", "snack"], protein: 180 },
    { types: ["desayuno", "colacion", "almuerzo", "merienda", "cena", "snack"], protein: 210 },
  ];
  scenarios.forEach(({ types, protein }) => {
    const rows = distributeGeneratorTarget({ kcal: 2400, proteina: protein, carbs: 280, grasas: 70 }, types, "balanced");
    assert.equal(rows.length, types.length);
    assert.equal(rows.reduce((sum, row) => sum + row.target.proteina, 0), protein);
    assert.equal(rows.every((row) => row.target.proteina >= 15 && row.target.proteina <= 65), true);
  });
});

test("proteina diaria incompatible y meta del coach fuera de rango fallan claramente", () => {
  assert.throws(
    () => distributeGeneratorProteinTarget(30, [1 / 3, 1 / 3, 1 / 3]),
    (error) => error?.code === "MENU_DAILY_PROTEIN_RANGE"
  );
  assert.throws(
    () => generatorMealSpecs({ mealTypes: ["almuerzo"], mealTargets: [{ type: "almuerzo", target: { kcal: 500, proteina: 66 } }] }),
    (error) => error?.code === "MENU_COACH_MEAL_PROTEIN_RANGE"
  );
});
