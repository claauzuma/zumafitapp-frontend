import test from "node:test";
import assert from "node:assert/strict";

import {
  addMenuAlternative,
  promoteMenuAlternative,
  replacePrimaryMenu,
} from "./weeklyMenuAssignmentChoices.js";

const menu = (id) => ({ menuId: id, menuSnapshot: { id, name: id } });

test("agregar una alternativa conserva el menu principal", () => {
  const base = menu("base");
  const alternative = menu("alternativa");
  const result = addMenuAlternative({ ...base, primaryMenu: base, alternatives: [] }, alternative);
  assert.equal(result.primaryMenu.menuId, "base");
  assert.deepEqual(result.alternatives.map((entry) => entry.menuId), ["alternativa"]);
});

test("fijar una alternativa la hace principal y conserva la anterior como alternativa", () => {
  const base = menu("base");
  const alternative = menu("alternativa");
  const result = promoteMenuAlternative({ ...base, primaryMenu: base, alternatives: [alternative] }, 0);
  assert.equal(result.primaryMenu.menuId, "alternativa");
  assert.deepEqual(result.alternatives.map((entry) => entry.menuId), ["base"]);
});

test("reemplazar deliberadamente el principal tampoco pierde el menu anterior", () => {
  const base = menu("base");
  const existingAlternative = menu("otra");
  const next = menu("nuevo");
  const result = replacePrimaryMenu({ ...base, primaryMenu: base, alternatives: [existingAlternative] }, next);
  assert.equal(result.primaryMenu.menuId, "nuevo");
  assert.deepEqual(result.alternatives.map((entry) => entry.menuId), ["base", "otra"]);
});
