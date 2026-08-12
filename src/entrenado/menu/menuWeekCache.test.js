import test from "node:test";
import assert from "node:assert/strict";

import { menuWeekCacheKey, menuWeekCacheOwner } from "./menuWeekCache.js";

test("la cache semanal queda aislada por cliente", () => {
  const week = "2026-08-03";
  const first = menuWeekCacheKey(week, menuWeekCacheOwner({ id: "cliente-a" }));
  const second = menuWeekCacheKey(week, menuWeekCacheOwner({ id: "cliente-b" }));
  assert.notEqual(first, second);
});

test("el mismo cliente reutiliza solamente su misma semana", () => {
  const owner = menuWeekCacheOwner({ email: "CLIENTE@ZUMAFIT.COM" });
  assert.equal(owner, "cliente@zumafit.com");
  assert.equal(
    menuWeekCacheKey("2026-08-03", owner),
    "cliente@zumafit.com::2026-08-03"
  );
});
