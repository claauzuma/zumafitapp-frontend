import assert from "node:assert/strict";
import test from "node:test";

import { compactEquivalentActivity, equivalentActivitySummary } from "./equivalentActivityView.js";

test("la actividad repetida se agrupa visualmente sin perder el conteo", () => {
  const activity = [
    { id: "1", event: "client_equivalent_consumed", metadata: { date: "2026-08-10", mealName: "Almuerzo" } },
    { id: "2", event: "client_equivalent_consumed", metadata: { date: "2026-08-10", mealName: "Almuerzo" } },
    { id: "3", event: "client_equivalent_created", metadata: { date: "2026-08-10", mealName: "Almuerzo" } },
  ];
  const compact = compactEquivalentActivity(activity);
  assert.equal(compact.length, 2);
  assert.equal(compact.find((item) => item.event === "client_equivalent_consumed").occurrences, 2);
  assert.deepEqual(equivalentActivitySummary(activity), { pending: 0, attention: 0, consumed: 2, created: 1 });
});

test("las aprobaciones pendientes conservan cada acción individual", () => {
  const pending = [1, 2].map((id) => ({ id: String(id), event: "client_equivalent_pending_approval", metadata: { date: "2026-08-10", mealName: "Cena" } }));
  assert.equal(compactEquivalentActivity(pending).length, 2);
});
