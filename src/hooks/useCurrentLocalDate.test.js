import test from "node:test";
import assert from "node:assert/strict";

import {
  localDateKey,
  millisecondsUntilNextLocalDay,
  resolveSelectedMenuDate,
} from "./useCurrentLocalDate.js";

test("genera la clave con la fecha local y programa el siguiente cambio de dia", () => {
  const date = new Date(2026, 6, 28, 23, 59, 30, 0);
  assert.equal(localDateKey(date), "2026-07-28");
  assert.equal(millisecondsUntilNextLocalDay(date), 30_050);
});

test("una fecha explicita conserva la consulta historica", () => {
  assert.equal(resolveSelectedMenuDate({
    currentDate: "2026-07-28",
    previousCurrentDate: "2026-07-28",
    selectedDate: "2026-07-28",
    requestedDate: "2026-07-27",
  }), "2026-07-27");
});

test("al quitar una fecha historica de la URL vuelve a hoy", () => {
  assert.equal(resolveSelectedMenuDate({
    currentDate: "2026-07-28",
    previousCurrentDate: "2026-07-28",
    selectedDate: "2026-07-27",
    previousRequestedDate: "2026-07-27",
  }), "2026-07-28");
});

test("al pasar la medianoche avanza si se estaba viendo el dia anterior", () => {
  assert.equal(resolveSelectedMenuDate({
    currentDate: "2026-07-28",
    previousCurrentDate: "2026-07-27",
    selectedDate: "2026-07-27",
  }), "2026-07-28");
});

test("al pasar la medianoche no interrumpe una consulta historica manual", () => {
  assert.equal(resolveSelectedMenuDate({
    currentDate: "2026-07-28",
    previousCurrentDate: "2026-07-27",
    selectedDate: "2026-07-20",
  }), "2026-07-20");
});
