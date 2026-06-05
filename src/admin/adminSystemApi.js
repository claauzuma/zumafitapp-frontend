import { apiFetch } from "../Api.js";

export async function getAdminDatabaseStats() {
  return apiFetch("/api/admin/database/stats", {
    method: "GET",
    timeoutMs: 20000,
  });
}
