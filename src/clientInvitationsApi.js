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

export async function blockCoachInvitation(invitationId, payload = {}) {
  return await apiFetch(`/api/usuarios/me/invitations/${invitationId}/block`, {
    method: "POST",
    body: payload,
    timeoutMs: 12000,
  });
}

export async function getBlockedCoaches() {
  const data = await apiFetch("/api/usuarios/me/blocked-coaches", {
    method: "GET",
    timeoutMs: 10000,
  });

  return {
    blockedCoaches: Array.isArray(data?.blockedCoaches) ? data.blockedCoaches : [],
  };
}

export async function unblockCoach(coachId) {
  return await apiFetch(`/api/usuarios/me/coaches/${coachId}/block`, {
    method: "DELETE",
    timeoutMs: 12000,
  });
}
