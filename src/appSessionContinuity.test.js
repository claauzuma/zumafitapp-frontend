import test from "node:test";
import assert from "node:assert/strict";
import { QueryClient } from "@tanstack/react-query";

import {
  LIVE_TAB_KEY,
  clearLiveTabSnapshot,
  createLiveTabSnapshot,
  isRestorableLiveTabSnapshot,
  persistLiveTabSnapshot,
  restoreLiveTabSnapshot,
} from "./appSessionContinuity.js";
import { shouldShowInitialSessionLoader } from "./sessionGateState.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
}

test("una vuelta a la misma pantalla restaura las consultas activas de esa pestaña", () => {
  const source = new QueryClient();
  source.setQueryData(["auth", "me"], { id: "cliente-1" });
  source.setQueryData(["trackingDay", "2026-08-13"], { totals: { calories: 640 } });
  source.getQueryCache().find({ queryKey: ["trackingDay", "2026-08-13"] }).isActive = () => true;
  const storage = memoryStorage();
  const locationLike = { pathname: "/app/tracking", search: "?date=2026-08-13", hash: "" };

  assert.equal(persistLiveTabSnapshot(source, {
    storage,
    locationLike,
    scrollY: 480,
    now: 1_000,
  }), true);

  const target = new QueryClient();
  const result = restoreLiveTabSnapshot(target, { storage, locationLike, now: 2_000 });
  assert.equal(result.restored, true);
  assert.equal(result.scroll.y, 480);
  assert.deepEqual(target.getQueryData(["auth", "me"]), { id: "cliente-1" });
  assert.deepEqual(target.getQueryData(["trackingDay", "2026-08-13"]), { totals: { calories: 640 } });
  assert.equal(storage.getItem(LIVE_TAB_KEY), null);
});

test("no restaura una ruta distinta ni un estado vencido", () => {
  const client = new QueryClient();
  const snapshot = createLiveTabSnapshot({
    queryClient: client,
    locationLike: { pathname: "/app/menu", search: "", hash: "" },
    now: 1_000,
  });
  assert.equal(isRestorableLiveTabSnapshot(snapshot, {
    locationLike: { pathname: "/app/tracking", search: "", hash: "" },
    now: 2_000,
  }), false);
  assert.equal(isRestorableLiveTabSnapshot(snapshot, {
    locationLike: { pathname: "/app/menu", search: "", hash: "" },
    now: 1_000 + (13 * 60 * 60 * 1000),
  }), false);
});

test("una revalidacion con usuario visible no reemplaza la pantalla por Cargando", () => {
  assert.equal(shouldShowInitialSessionLoader({ data: { id: "1" }, isFetching: true }), false);
  assert.equal(shouldShowInitialSessionLoader({ data: undefined, isPending: true }), true);
  assert.equal(shouldShowInitialSessionLoader({ data: undefined, isFetching: false }), false);
});

test("cerrar sesion elimina la continuidad temporal de la pestaña", () => {
  const storage = memoryStorage();
  storage.setItem(LIVE_TAB_KEY, "snapshot privado");
  assert.equal(clearLiveTabSnapshot(storage), true);
  assert.equal(storage.getItem(LIVE_TAB_KEY), null);
});
