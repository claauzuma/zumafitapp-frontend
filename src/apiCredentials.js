// src/apiCredentials.js
// En desarrollo usamos rutas relativas para que Vite reenvie /api al backend.
// Asi tambien funciona desde otro equipo sin depender de la IP local de esta PC.
const viteEnv = import.meta.env || {};
const configuredApiBase = String(viteEnv.VITE_API_BASE || "").trim();

export const API_BASE = configuredApiBase || (
  viteEnv.DEV
    ? ""
    : "https://zumafitapp-backend-production.up.railway.app"
);
 