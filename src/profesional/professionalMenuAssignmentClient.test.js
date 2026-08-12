import test from "node:test";
import assert from "node:assert/strict";

import { resolveNutritionWeek } from "../nutricion/dailyNutritionTargets.js";
import {
  nutritionDraftForMenuAssignment,
  resolveFreshAssignmentClient,
} from "./professionalMenuAssignmentClient.js";

test("la asignacion espera el detalle y no usa el resumen sin plan semanal", () => {
  const listSummary = {
    id: "client-1",
    metasActuales: { macros: { p: 166, c: 196, g: 66 } },
  };
  assert.equal(resolveFreshAssignmentClient(listSummary.id, null, { fetching: true }), null);
  assert.equal(resolveFreshAssignmentClient(listSummary.id, { client: listSummary }, { fetching: true }), null);
});

test("acepta solamente el detalle fresco del cliente seleccionado", () => {
  const detail = {
    id: "client-1",
    menu: {
      weeklyPlan: {
        caloriesByDay: { Lunes: 2858, Martes: 1906 },
        macrosByDay: {
          Lunes: { p: 166, c: 400, g: 66 },
          Martes: { p: 166, c: 162, g: 66 },
        },
      },
    },
  };
  assert.equal(resolveFreshAssignmentClient("client-2", { client: detail }), null);
  assert.equal(resolveFreshAssignmentClient("client-1", { client: detail }), detail);
  const week = resolveNutritionWeek(nutritionDraftForMenuAssignment({
    ...detail,
    metasActuales: { macros: { p: 166, c: 196, g: 66 } },
  }));
  assert.equal(week.targets.monday.kcal, 2858);
  assert.equal(week.targets.tuesday.kcal, 1906);
  assert.equal(week.targets.monday.c, "400");
  assert.equal(week.targets.tuesday.c, "162");
});
