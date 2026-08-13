import { dehydrate, hydrate } from "@tanstack/react-query";

const LIVE_TAB_KEY = "zumafit_live_tab_v1";
const LIVE_TAB_VERSION = 1;
const MAX_RESUME_AGE_MS = 12 * 60 * 60 * 1000;

function currentPath(locationLike = globalThis.location) {
  if (!locationLike) return "";
  return `${locationLike.pathname || ""}${locationLike.search || ""}${locationLike.hash || ""}`;
}

function canPersistQuery(query) {
  if (query?.state?.status !== "success") return false;
  const key = Array.isArray(query?.queryKey) ? query.queryKey : [];
  const isAuthQuery = key[0] === "auth" && key[1] === "me";
  return isAuthQuery || query?.isActive?.() === true;
}

export function createLiveTabSnapshot({
  queryClient,
  locationLike,
  scrollX = 0,
  scrollY = 0,
  now = Date.now(),
} = {}) {
  if (!queryClient) return null;
  return {
    version: LIVE_TAB_VERSION,
    hiddenAt: now,
    path: currentPath(locationLike),
    scroll: {
      x: Number.isFinite(Number(scrollX)) ? Number(scrollX) : 0,
      y: Number.isFinite(Number(scrollY)) ? Number(scrollY) : 0,
    },
    queryState: dehydrate(queryClient, {
      shouldDehydrateQuery: canPersistQuery,
      shouldRedactErrors: () => true,
    }),
  };
}

export function isRestorableLiveTabSnapshot(snapshot, {
  locationLike,
  now = Date.now(),
  maxAgeMs = MAX_RESUME_AGE_MS,
} = {}) {
  if (!snapshot || snapshot.version !== LIVE_TAB_VERSION) return false;
  if (!snapshot.hiddenAt || now - snapshot.hiddenAt > maxAgeMs || now < snapshot.hiddenAt) return false;
  return snapshot.path === currentPath(locationLike);
}

export function persistLiveTabSnapshot(queryClient, {
  storage = globalThis.sessionStorage,
  locationLike = globalThis.location,
  scrollX = globalThis.scrollX,
  scrollY = globalThis.scrollY,
  now = Date.now(),
} = {}) {
  if (!storage || !queryClient) return false;
  try {
    const snapshot = createLiveTabSnapshot({ queryClient, locationLike, scrollX, scrollY, now });
    storage.setItem(LIVE_TAB_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function clearLiveTabSnapshot(storage = globalThis.sessionStorage) {
  if (!storage) return false;
  try {
    storage.removeItem(LIVE_TAB_KEY);
    return true;
  } catch {
    return false;
  }
}

export function restoreLiveTabSnapshot(queryClient, {
  storage = globalThis.sessionStorage,
  locationLike = globalThis.location,
  now = Date.now(),
} = {}) {
  if (!storage || !queryClient) return { restored: false, scroll: null };
  try {
    const raw = storage.getItem(LIVE_TAB_KEY);
    if (!raw) return { restored: false, scroll: null };
    storage.removeItem(LIVE_TAB_KEY);
    const snapshot = JSON.parse(raw);
    if (!isRestorableLiveTabSnapshot(snapshot, { locationLike, now })) {
      return { restored: false, scroll: null };
    }
    hydrate(queryClient, snapshot.queryState);
    return { restored: true, scroll: snapshot.scroll || null };
  } catch {
    return { restored: false, scroll: null };
  }
}

export function installLiveTabContinuity(queryClient, {
  windowLike = globalThis.window,
  documentLike = globalThis.document,
  storage = globalThis.sessionStorage,
} = {}) {
  if (!windowLike || !documentLike || !queryClient) return () => {};

  const persist = () => persistLiveTabSnapshot(queryClient, {
    storage,
    locationLike: windowLike.location,
    scrollX: windowLike.scrollX,
    scrollY: windowLike.scrollY,
  });
  const onVisibilityChange = () => {
    if (documentLike.visibilityState === "hidden") persist();
  };

  documentLike.addEventListener("visibilitychange", onVisibilityChange);
  windowLike.addEventListener("pagehide", persist);

  if (documentLike.visibilityState === "hidden") persist();

  return () => {
    documentLike.removeEventListener("visibilitychange", onVisibilityChange);
    windowLike.removeEventListener("pagehide", persist);
  };
}

export function restoreLiveTabScroll(scroll, {
  windowLike = globalThis.window,
} = {}) {
  if (!scroll || !windowLike?.scrollTo) return;
  const x = Number(scroll.x) || 0;
  const y = Number(scroll.y) || 0;
  const restore = () => windowLike.scrollTo({ left: x, top: y, behavior: "instant" });
  windowLike.requestAnimationFrame?.(() => {
    restore();
    windowLike.requestAnimationFrame?.(restore);
  });
  windowLike.setTimeout?.(restore, 120);
}

export { LIVE_TAB_KEY, MAX_RESUME_AGE_MS };
