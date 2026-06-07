import { apiFetch } from "./Api.js";

export async function dismissCoachAssignmentNotice() {
  return await apiFetch("/api/usuarios/me/coach-notice/dismiss", {
    method: "POST",
    timeoutMs: 8000,
  });
}

export async function leaveCurrentCoach() {
  return await apiFetch("/api/usuarios/me/coach-relation/leave", {
    method: "POST",
    timeoutMs: 10000,
  });
}

export async function requestCoachChange(reason = "") {
  return await apiFetch("/api/usuarios/me/coach-relation/request-change", {
    method: "POST",
    body: { reason },
    timeoutMs: 10000,
  });
}
