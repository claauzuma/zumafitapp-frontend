import assert from "node:assert/strict";
import test from "node:test";

import { buildAdminFoodsQuery } from "./adminFoodsParams.js";

test("el catalogo admin serializa filtros y omite los valores libres", () => {
  const query = new URLSearchParams(buildAdminFoodsQuery({
    page: 3,
    limit: 50,
    search: "  arroz integral ",
    category: "Carbohidratos",
    unit: "todos",
    status: "revision",
    sort: "proteina_desc",
    mode: "GENERIC",
    role: "P1",
    mealType: "breakfast",
  }));

  assert.equal(query.get("page"), "3");
  assert.equal(query.get("limit"), "50");
  assert.equal(query.get("search"), "arroz integral");
  assert.equal(query.get("category"), "Carbohidratos");
  assert.equal(query.has("unit"), false);
  assert.equal(query.get("status"), "revision");
  assert.equal(query.get("sort"), "proteina_desc");
  assert.equal(query.get("mode"), "GENERIC");
  assert.equal(query.get("role"), "P1");
  assert.equal(query.get("mealType"), "breakfast");
});

test("el catalogo omite juntos los filtros de generacion sin seleccionar", () => {
  const query = new URLSearchParams(buildAdminFoodsQuery({ mode: "todos", role: "todos", mealType: "todos" }));
  assert.equal(query.has("mode"), false);
  assert.equal(query.has("role"), false);
  assert.equal(query.has("mealType"), false);
});
