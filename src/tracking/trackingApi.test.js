import assert from "node:assert/strict";
import test from "node:test";

import { deleteTrackingMeals, updateFoodLog } from "./trackingApi.js";

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => "application/json" },
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

test("borrado batch confirmado usa una sola request", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({
      ok: true,
      date: "2026-09-01",
      mealsConfig: [],
      deletedMealIds: ["menu_target_desayuno", "menu_target_cena"],
    });
  };

  const response = await deleteTrackingMeals({
    date: "2026-09-01",
    mealIds: ["menu_target_desayuno", "menu_target_cena"],
    confirmDeleteLogs: true,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/tracking\/day\/meals\/batch$/);
  assert.equal(calls[0].options.method, "DELETE");
  assert.deepEqual(JSON.parse(calls[0].options.body).mealIds, ["menu_target_desayuno", "menu_target_cena"]);
  assert.equal(response.deletionFallback, undefined);
});

test("backend anterior retira metas vacias con un solo PATCH y devuelve el dia sin metas", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/api/tracking/day/meals/batch")) {
      return jsonResponse({
        ok: true,
        date: "2026-09-01",
        mealsConfig: [
          { mealId: "menu_target_desayuno" },
          { mealId: "coach_lunch" },
          { mealId: "menu_target_cena" },
        ],
        meals: {
          menu_target_desayuno: [],
          coach_lunch: [{ id: "coach-food" }],
          menu_target_cena: [],
        },
      });
    }
    if (url.endsWith("/api/tracking/day/meals")) {
      return jsonResponse({
        ok: true,
        date: "2026-09-01",
        mealsConfig: [{ mealId: "coach_lunch" }],
        meals: { coach_lunch: [{ id: "coach-food" }] },
      });
    }
    throw new Error(`Request inesperada: ${url}`);
  };

  const response = await deleteTrackingMeals({
    date: "2026-09-01",
    mealIds: ["menu_target_desayuno", "menu_target_cena"],
    confirmDeleteLogs: true,
  });

  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /\/meals\/batch$/);
  assert.match(calls[1].url, /\/meals$/);
  assert.equal(calls[0].options.method, "DELETE");
  assert.equal(calls[1].options.method, "PATCH");
  assert.deepEqual(
    JSON.parse(calls[1].options.body).mealsConfig.map((meal) => meal.mealId),
    ["coach_lunch"]
  );
  assert.deepEqual(response.mealsConfig.map((meal) => meal.mealId), ["coach_lunch"]);
  assert.deepEqual(response.deletedMealIds, ["menu_target_desayuno", "menu_target_cena"]);
  assert.equal(response.deletionFallback, "empty_config_batch");
});

test("backend anterior usa borrado individual cuando una meta contiene FoodLogs", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/api/tracking/day/meals/batch")) {
      return jsonResponse({
        ok: true,
        date: "2026-09-01",
        mealsConfig: [
          { mealId: "menu_target_desayuno" },
          { mealId: "coach_lunch" },
          { mealId: "menu_target_cena" },
        ],
        meals: {
          menu_target_desayuno: [{ id: "breakfast-food" }],
          coach_lunch: [{ id: "coach-food" }],
          menu_target_cena: [],
        },
      });
    }
    if (url.endsWith("/api/tracking/day/meals/menu_target_desayuno")) {
      return jsonResponse({
        ok: true,
        date: "2026-09-01",
        mealsConfig: [{ mealId: "coach_lunch" }, { mealId: "menu_target_cena" }],
      });
    }
    return jsonResponse({
      ok: true,
      date: "2026-09-01",
      mealsConfig: [{ mealId: "coach_lunch" }],
    });
  };

  const response = await deleteTrackingMeals({
    date: "2026-09-01",
    mealIds: ["menu_target_desayuno", "menu_target_cena"],
    confirmDeleteLogs: true,
  });

  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.options.method === "DELETE"));
  assert.deepEqual(response.mealsConfig.map((meal) => meal.mealId), ["coach_lunch"]);
  assert.equal(response.deletionFallback, "individual");
});

test("editar cantidad usa PATCH sobre el mismo FoodLog sin enviar otro mealId", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return jsonResponse({
      ok: true,
      date: "2026-09-01",
      meals: {
        menu_target_almuerzo: [{ id: "log-rice", mealId: "menu_target_almuerzo", cantidad: 120 }],
      },
    });
  };

  await updateFoodLog("log-rice", { cantidad: 120, unidad: "g" });

  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/api\/tracking\/day\/logs\/log-rice$/);
  assert.equal(calls[0].options.method, "PATCH");
  assert.deepEqual(JSON.parse(calls[0].options.body), { cantidad: 120, unidad: "g" });
});
