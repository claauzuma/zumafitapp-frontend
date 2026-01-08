// src/authCache.js
// src/authCache.js
const TTL_MS = 3 * 60_000; // 3 minutos


let mem = { status: "unknown", ts: 0 }; // unknown | logged | guest

export function clearAuthCache() {
  mem = { status: "unknown", ts: 0 };
  try {
    sessionStorage.removeItem("auth_status");
    sessionStorage.removeItem("auth_ts");
  } catch {}
}

export function setAuthLogged() {
  mem = { status: "logged", ts: Date.now() };
  try {
    sessionStorage.setItem("auth_status", "logged");
    sessionStorage.setItem("auth_ts", String(Date.now()));
  } catch {}
}

export function setAuthGuest() {
  mem = { status: "guest", ts: Date.now() };
  try {
    sessionStorage.setItem("auth_status", "guest");
    sessionStorage.setItem("auth_ts", String(Date.now()));
  } catch {}
}

export function getCachedStatus() {
  const now = Date.now();

  // ✅ 1) memoria
  if (mem.status !== "unknown" && now - mem.ts < TTL_MS) return mem.status;

  // ✅ 2) sessionStorage
  try {
    const status = sessionStorage.getItem("auth_status");
    const ts = Number(sessionStorage.getItem("auth_ts") || 0);
    if (status && ts && now - ts < TTL_MS) {
      if (status === "logged" || status === "guest") {
        mem = { status, ts };
        return status;
      }
    }
  } catch {}

  return "unknown";
}
