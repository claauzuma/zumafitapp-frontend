import { useQuery } from "@tanstack/react-query";
import { STALE_TIMES, queryKeys } from "../queryClient.js";
import {
  getAdminCollectionDetail,
  getAdminCollectionDocument,
  getAdminCollectionDocuments,
  getAdminDatabaseStats,
} from "./adminSystemApi.js";

export function useAdminDatabaseStats() {
  return useQuery({
    queryKey: queryKeys.adminDatabaseStats(),
    queryFn: getAdminDatabaseStats,
    staleTime: STALE_TIMES.adminDatabaseStats,
  });
}

export function useAdminCollectionDetail(collectionName, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminCollectionDetail(collectionName),
    queryFn: () => getAdminCollectionDetail(collectionName),
    staleTime: STALE_TIMES.adminDatabaseStats,
    enabled: Boolean(collectionName) && options.enabled !== false,
  });
}

export function useAdminCollectionDocuments(collectionName, params = {}, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminCollectionDocuments(collectionName, params),
    queryFn: () => getAdminCollectionDocuments(collectionName, params),
    staleTime: 20 * 1000,
    enabled: Boolean(collectionName) && options.enabled !== false,
    keepPreviousData: true,
  });
}

export function useAdminCollectionDocument(collectionName, documentId, options = {}) {
  return useQuery({
    queryKey: queryKeys.adminCollectionDocument(collectionName, documentId),
    queryFn: () => getAdminCollectionDocument(collectionName, documentId),
    staleTime: 60 * 1000,
    enabled: Boolean(collectionName && documentId) && options.enabled !== false,
  });
}
