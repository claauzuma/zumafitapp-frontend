import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const editorSource = readFileSync(new URL("./NutritionEditors.jsx", import.meta.url), "utf8");
const payloadBuilderSource = editorSource.match(
  /export function buildQuantityGenerationPayload[\s\S]*?\n}\n\nfunction buildQuantityGenerationRequest/
)?.[0] || "";

test("Admin y Coach no redondean macros unitarios antes de enviarlos al motor", () => {
  assert.ok(payloadBuilderSource, "se encontro buildQuantityGenerationPayload");
  assert.doesNotMatch(
    payloadBuilderSource,
    /(?:kcal|protein|carbs|fat)PerUnitOrGram:\s*round\(/,
    "el redondeo a un decimal no debe reaparecer en el payload"
  );

  for (const [field, sourceField] of [
    ["kcalPerUnitOrGram", "kcal"],
    ["proteinPerUnitOrGram", "proteina"],
    ["carbsPerUnitOrGram", "carbs"],
    ["fatPerUnitOrGram", "grasas"],
  ]) {
    assert.match(
      payloadBuilderSource,
      new RegExp(`${field}:\\s*toNumber\\(base\\.${sourceField},\\s*0\\)\\s*\\/\\s*baseQty`),
      `${field} conserva la division exacta`
    );
  }
});

test("las razones reales de pollo y almendras conservan su precision", () => {
  const ratio = (total, quantity) => Number(total) / Number(quantity);
  assert.deepEqual(
    [ratio(110.5, 100), ratio(22, 100), ratio(0, 100), ratio(2.5, 100)],
    [1.105, 0.22, 0, 0.025]
  );
  assert.deepEqual(
    [ratio(715, 100), ratio(26, 100), ratio(15.5, 100), ratio(61, 100)],
    [7.15, 0.26, 0.155, 0.61]
  );
});

