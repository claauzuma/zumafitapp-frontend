import { apiFetch } from "./Api.js";

export async function getPendingCoachInvitations() {
  const data = await apiFetch("/api/usuarios/me/invitations/pending", {
    method: "GET",
    timeoutMs: 8000,
  });

  return {
    invitations: Array.isArray(data?.invitations) ? data.invitations : [],
  };
}

export async function acceptCoachInvitation(invitationId) {
  return await apiFetch(`/api/usuarios/me/invitations/${invitationId}/accept`, {
    method: "POST",
    timeoutMs: 12000,
  });
}

export async function declineCoachInvitation(invitationId) {
  return await apiFetch(`/api/usuarios/me/invitations/${invitationId}/decline`, {
    method: "POST",
    timeoutMs: 12000,
  });
}
