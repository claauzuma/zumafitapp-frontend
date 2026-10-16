import assert from "node:assert/strict";
import test from "node:test";

import { trackingDayRevision } from "./trackingDayRevision.js";

test("la revisión es estable ante reordenamientos pero cambia al editar Tracking", () => {
  const day = {
    date: "2026-10-13",
    mealsConfig: [
      { mealId: "lunch", targetOrigin: "manual", meta: { kcal: 700, proteina: 50 } },
      { mealId: "breakfast", targetOrigin: "auto", meta: { kcal: 500, proteina: 35 } },
    ],
    meals: {
      lunch: [{ id: "rice", cantidad: 80, kcal: 270, proteina: 6.4 }],
      breakfast: [{ id: "oats", cantidad: 60, kcal: 220, proteina: 8 }],
    },
  };
  const reordered = {
    ...day,
    mealsConfig: [...day.mealsConfig].reverse(),
    meals: { breakfast: day.meals.breakfast, lunch: day.meals.lunch },
  };
  const edited = structuredClone(day);
  edited.meals.lunch[0].cantidad = 100;

  assert.equal(trackingDayRevision(reordered), trackingDayRevision(day));
  assert.notEqual(trackingDayRevision(edited), trackingDayRevision(day));
});
