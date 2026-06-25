import { apiFetch } from "../Api.js";

function buildQuery(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function collectionPath(collectionName = "") {
  return `/api/admin/system/collections/${encodeURIComponent(collectionName)}`;
}

export async function getAdminDatabaseStats() {
  return apiFetch("/api/admin/database/stats", {
    method: "GET",
    timeoutMs: 20000,
  });
}

export async function getAdminCollections() {
  return apiFetch("/api/admin/system/collections", {
    method: "GET",
    timeoutMs: 20000,
  });
}

export async function getAdminCollectionDetail(collectionName) {
  return apiFetch(collectionPath(collectionName), {
    method: "GET",
    timeoutMs: 20000,
  });
}

export async function getAdminCollectionDocuments(collectionName, params = {}) {
  return apiFetch(`${collectionPath(collectionName)}/documents${buildQuery(params)}`, {
    method: "GET",
    timeoutMs: 20000,
  });
}

export async function getAdminCollectionDocument(collectionName, documentId) {
  return apiFetch(`${collectionPath(collectionName)}/documents/${encodeURIComponent(documentId)}`, {
    method: "GET",
    timeoutMs: 20000,
  });
}
