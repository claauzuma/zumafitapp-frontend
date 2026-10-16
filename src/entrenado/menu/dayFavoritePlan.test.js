import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dayFavoriteCompatibility } from "./dayFavoritePlan.js";

describe("dayFavoriteCompatibility", () => {
  it("bloquea un día guardado mayor al objetivo", () => {
    assert.deepEqual(
      { allowed: dayFavoriteCompatibility({ kcal: 2625 }, { kcal: 2000 }).allowed, missingCalories: dayFavoriteCompatibility({ kcal: 2625 }, { kcal: 2000 }).missingCalories },
      { allowed: false, missingCalories: 625 }
    );
  });

  it("permite un objetivo superior y deja el excedente libre", () => {
    const result = dayFavoriteCompatibility({ kcal: 2625 }, { kcal: 2800 });
    assert.equal(result.allowed, true);
    assert.equal(result.exact, false);
    assert.equal(result.extraFreeCalories, 175);
  });
});
