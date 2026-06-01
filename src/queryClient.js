import { QueryClient } from "@tanstack/react-query";

export const STALE_TIMES = {
  authMe: 60 * 1000,
  adminUsers: 2 * 60 * 1000,
  adminUser: 2 * 60 * 1000,
  adminCoaches: 60 * 1000,
  adminUnassignedClients: 60 * 1000,
  adminCoachClients: 2 * 60 * 1000,
  adminCoachPlans: 5 * 60 * 1000,
  adminEffectiveCapabilities: 2 * 60 * 1000,
  professionalMe: 60 * 1000,
  professionalClients: 2 * 60 * 1000,
  professionalClientDetail: 2 * 60 * 1000,
  professionalClientInvitations: 60 * 1000,
  rutinas: 3 * 60 * 1000,
  rutina: 3 * 60 * 1000,
  ejercicios: 5 * 60 * 1000,
  clienteRutinas: 2 * 60 * 1000,
  clienteRutinaActiva: 2 * 60 * 1000,
  rutinaAssignableClients: 2 * 60 * 1000,
  alimentos: 5 * 60 * 1000,
  comidas: 3 * 60 * 1000,
  menusDemo: 5 * 60 * 1000,
  menusBase: 3 * 60 * 1000,
  menuBase: 3 * 60 * 1000,
  clientMenus: 2 * 60 * 1000,
  clientActiveMenu: 2 * 60 * 1000,
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

function cleanText(value = "") {
  return String(value || "").trim().toLowerCase();
}

function cleanId(value = "") {
  return String(value || "").trim();
}

function cleanFilter(value = "todos") {
  const normalized = cleanText(value);
  return normalized || "todos";
}

function normalizeNutritionFilters(filters = {}) {
  return {
    search: cleanText(filters.search),
    category: cleanFilter(filters.category),
    type: cleanFilter(filters.type),
    goal: cleanFilter(filters.goal || filters.objetivo),
    meals: Number(filters.meals || filters.comidas) || 0,
  };
}

function normalizeMenuFilters(filters = {}) {
  return {
    search: cleanText(filters.search),
    objetivo: cleanFilter(filters.objetivo || filters.goal),
    visibilidad: cleanFilter(filters.visibilidad || filters.visibility),
    estado: cleanFilter(filters.estado || filters.status),
    rangoKcal: cleanFilter(filters.rangoKcal || filters.range),
    proteina: Number(filters.proteina || filters.protein) || 0,
    cantidadComidas: Number(filters.cantidadComidas || filters.meals) || 0,
    includeComidas: filters.includeComidas === true,
  };
}

export function normalizeAdminUsersFilters(filters = {}) {
  return {
    search: cleanText(filters.search),
    role: cleanFilter(filters.role),
    estado: cleanFilter(filters.estado),
    limit: Number(filters.limit) || 100,
  };
}

export const queryKeys = {
  authMe: () => ["auth", "me"],
  adminUsersRoot: () => ["admin", "users"],
  adminUsers: (filters = {}) => ["admin", "users", normalizeAdminUsersFilters(filters)],
  adminUser: (userId) => ["admin", "user", cleanId(userId)],
  adminCoachesRoot: () => ["admin", "coaches"],
  adminCoaches: (search = "") => ["admin", "coaches", cleanText(search)],
  adminUnassignedClientsRoot: () => ["admin", "unassignedClients"],
  adminUnassignedClients: (search = "") => ["admin", "unassignedClients", cleanText(search)],
  adminCoachClients: (coachId) => ["admin", "coachClients", cleanId(coachId)],
  adminCoachPlans: () => ["admin", "coachPlans"],
  adminEffectiveCapabilities: (coachId) => ["admin", "effectiveCapabilities", cleanId(coachId)],
  professionalMe: () => ["professional", "me"],
  professionalClients: () => ["professional", "clients"],
  professionalClientDetail: (clientId) => ["professional", "client", cleanId(clientId)],
  professionalClientInvitations: (filters = {}) => [
    "professional",
    "clientInvitations",
    {
      search: cleanText(filters.search),
      status: cleanFilter(filters.status),
    },
  ],
  professionalClientInvitationsRoot: () => ["professional", "clientInvitations"],
  rutinasRoot: () => ["rutinas"],
  rutinas: (filters = {}) => ["rutinas", normalizeRoutineFilters(filters)],
  rutina: (rutinaId) => ["rutina", cleanId(rutinaId)],
  ejerciciosRoot: () => ["ejercicios"],
  ejercicios: (filters = {}) => ["ejercicios", normalizeRoutineFilters(filters)],
  clienteRutinas: (clientId) => ["clienteRutinas", cleanId(clientId)],
  clienteRutinaActiva: (clientId) => ["clienteRutinaActiva", cleanId(clientId)],
  rutinaAssignableClients: (scope = "coach", search = "") => [
    "rutinas",
    "assignableClients",
    cleanText(scope),
    cleanText(search),
  ],
  alimentos: (filters = {}) => ["alimentos", normalizeNutritionFilters(filters)],
  comidas: (filters = {}) => ["comidas", normalizeNutritionFilters(filters)],
  menusDemo: (filters = {}) => ["menusDemo", normalizeNutritionFilters(filters)],
  menuRanges: () => ["menuRanges"],
  menusByRange: (rango = "") => ["menusByRange", cleanText(rango)],
  menusByProtein: (rango = "", proteina = "") => ["menusByProtein", cleanText(rango), String(proteina || "")],
  menusBaseRoot: () => ["menusBase"],
  menusBase: (filters = {}) => ["menusBase", normalizeMenuFilters(filters)],
  menuBase: (menuId) => ["menuBase", cleanId(menuId)],
  clientMenus: (clientId, filters = {}) => ["clientMenus", cleanId(clientId), normalizeMenuFilters(filters)],
  clientMenusRoot: (clientId = "") => ["clientMenus", cleanId(clientId)],
  clientActiveMenu: (clientId) => ["clientActiveMenu", cleanId(clientId)],
  clientMenu: (clientId, menuAsignadoId) => ["clientMenu", cleanId(clientId), cleanId(menuAsignadoId)],
  foodEquivalents: (payload = {}) => [
    "foodEquivalents",
    cleanText(payload?.alimentoOriginal?.nombreSnapshot || payload?.original?.nombre || ""),
    String(payload?.cantidad || payload?.alimentoOriginal?.cantidad || ""),
    cleanText(payload?.objetivo || ""),
  ],
};

export function getUserId(user) {
  return cleanId(user?.id || user?._id || "");
}

export function getAssignedCoachId(user) {
  return cleanId(user?.coach?.entrenadorId || user?.coach?.coachId || "");
}

export function setAuthUserQueryData(user) {
  if (!user) return;
  queryClient.setQueryData(queryKeys.authMe(), user);
  if (String(user?.role || user?.rol || "").toLowerCase() === "coach") {
    queryClient.setQueryData(queryKeys.professionalMe(), user);
  }
}

export function clearPrivateQueryCache() {
  queryClient.clear();
}

export function setAdminUserQueryData(userId, user) {
  const id = cleanId(userId || getUserId(user));
  if (!id || !user) return;
  queryClient.setQueryData(queryKeys.adminUser(id), user);
}

export function removeAdminUserQueryData(userId) {
  const id = cleanId(userId);
  if (!id) return;
  queryClient.removeQueries({ queryKey: queryKeys.adminUser(id), exact: true });
}

function invalidate(queryKey, options = {}) {
  return queryClient.invalidateQueries({ queryKey, ...options });
}

export async function invalidateAuthMe() {
  await Promise.all([
    invalidate(queryKeys.authMe()),
    invalidate(queryKeys.professionalMe()),
  ]);
}

export async function invalidateAdminUsersList() {
  await invalidate(queryKeys.adminUsersRoot());
}

export async function invalidateAdminCoachesList() {
  await invalidate(queryKeys.adminCoachesRoot());
}

export async function invalidateAdminUnassignedClientsList() {
  await invalidate(queryKeys.adminUnassignedClientsRoot());
}

export async function invalidateAdminCoachPlans() {
  await invalidate(queryKeys.adminCoachPlans());
}

export async function invalidateCoachRelated(coachIds = []) {
  const unique = [...new Set(coachIds.map(cleanId).filter(Boolean))];
  await Promise.all([
    ...unique.map((coachId) => invalidate(queryKeys.adminUser(coachId))),
    ...unique.map((coachId) => invalidate(queryKeys.adminCoachClients(coachId))),
    ...unique.map((coachId) => invalidate(queryKeys.adminEffectiveCapabilities(coachId))),
    invalidate(queryKeys.adminCoachesRoot()),
    invalidate(queryKeys.professionalClients()),
    invalidate(queryKeys.professionalMe()),
  ]);
}

export async function invalidateAfterAdminUserUpdate(userId, user = null) {
  const id = cleanId(userId || getUserId(user));
  const assignedCoachId = getAssignedCoachId(user);
  if (user && id) setAdminUserQueryData(id, user);

  await Promise.all([
    id ? invalidate(queryKeys.adminUser(id)) : Promise.resolve(),
    invalidate(queryKeys.adminUsersRoot()),
    assignedCoachId ? invalidate(queryKeys.adminCoachClients(assignedCoachId)) : Promise.resolve(),
    assignedCoachId ? invalidate(queryKeys.professionalClients()) : Promise.resolve(),
  ]);

  if (String(user?.role || "").toLowerCase() === "coach") {
    await invalidateCoachRelated([id]);
  }
}

export async function invalidateAfterAssignCoach({ clientId, previousCoachId, nextCoachId, updatedClient }) {
  const ids = [previousCoachId, nextCoachId].map(cleanId).filter(Boolean);
  if (updatedClient) setAdminUserQueryData(clientId, updatedClient);

  await Promise.all([
    invalidate(queryKeys.adminUser(clientId)),
    invalidate(queryKeys.adminUsersRoot()),
    invalidate(queryKeys.adminUnassignedClientsRoot()),
    ...ids.map((coachId) => invalidate(queryKeys.adminCoachClients(coachId))),
    ...ids.map((coachId) => invalidate(queryKeys.adminUser(coachId))),
    ...ids.map((coachId) => invalidate(queryKeys.adminEffectiveCapabilities(coachId))),
    invalidate(queryKeys.adminCoachesRoot()),
    invalidate(queryKeys.professionalClients()),
  ]);
}

export async function invalidateAfterUnassignCoach({ clientId, previousCoachId, updatedClient }) {
  await invalidateAfterAssignCoach({
    clientId,
    previousCoachId,
    nextCoachId: "",
    updatedClient,
  });
}

export async function invalidateAfterDeleteUser({ deletedUser, userId, previousCoachId }) {
  const id = cleanId(userId || getUserId(deletedUser));
  const role = String(deletedUser?.role || "").toLowerCase();
  const coachId = cleanId(previousCoachId || getAssignedCoachId(deletedUser));

  if (id) removeAdminUserQueryData(id);

  await Promise.all([
    invalidate(queryKeys.adminUsersRoot()),
    invalidate(queryKeys.adminUnassignedClientsRoot()),
    role === "coach" ? invalidate(queryKeys.adminCoachesRoot()) : Promise.resolve(),
    role === "coach" && id ? invalidate(queryKeys.adminCoachClients(id)) : Promise.resolve(),
    role === "coach" && id ? invalidate(queryKeys.adminEffectiveCapabilities(id)) : Promise.resolve(),
    coachId ? invalidate(queryKeys.adminCoachClients(coachId)) : Promise.resolve(),
    coachId ? invalidate(queryKeys.adminEffectiveCapabilities(coachId)) : Promise.resolve(),
    invalidate(queryKeys.professionalClients()),
  ]);
}

export async function invalidateAfterCoachCapabilitiesChange(coachId, updatedCoach = null) {
  const id = cleanId(coachId || getUserId(updatedCoach));
  if (updatedCoach && id) setAdminUserQueryData(id, updatedCoach);

  await Promise.all([
    id ? invalidate(queryKeys.adminUser(id)) : Promise.resolve(),
    id ? invalidate(queryKeys.adminEffectiveCapabilities(id)) : Promise.resolve(),
    id ? invalidate(queryKeys.adminCoachClients(id)) : Promise.resolve(),
    invalidate(queryKeys.adminCoachesRoot()),
    invalidate(queryKeys.adminUsersRoot()),
    invalidate(queryKeys.professionalMe()),
    invalidate(queryKeys.professionalClients()),
  ]);
}

export async function invalidateAfterCoachPlansChange() {
  await Promise.all([
    invalidate(queryKeys.adminCoachPlans()),
    invalidate(queryKeys.adminCoachesRoot()),
    invalidate(queryKeys.adminUsersRoot()),
    invalidate(["admin", "effectiveCapabilities"]),
    invalidate(queryKeys.professionalMe()),
    invalidate(queryKeys.professionalClients()),
  ]);
}

export async function invalidateProfessionalClient(clientId, updatedClient = null) {
  const id = cleanId(clientId || getUserId(updatedClient));
  if (updatedClient && id) {
    queryClient.setQueryData(queryKeys.professionalClientDetail(id), (old) => ({
      ...(old || {}),
      client: updatedClient,
    }));
  }

  await Promise.all([
    id ? invalidate(queryKeys.professionalClientDetail(id)) : Promise.resolve(),
    invalidate(queryKeys.professionalClients()),
    invalidate(queryKeys.professionalMe()),
  ]);
}

export async function invalidateProfessionalClientInvitations() {
  await Promise.all([
    invalidate(queryKeys.professionalClientInvitationsRoot()),
    invalidate(queryKeys.professionalClients()),
    invalidate(queryKeys.professionalMe()),
  ]);
}

export function normalizeRoutineFilters(filters = {}) {
  return {
    search: cleanText(filters.search),
    objetivo: cleanFilter(filters.objetivo || filters.goal),
    nivel: cleanFilter(filters.nivel || filters.level),
    diasPorSemana: Number(filters.diasPorSemana) || 0,
    visibilidad: cleanFilter(filters.visibilidad || filters.visibility),
    estado: cleanFilter(filters.estado || filters.status),
    grupoMuscular: cleanFilter(filters.grupoMuscular),
    patronMovimiento: cleanFilter(filters.patronMovimiento),
    equipamiento: cleanFilter(filters.equipamiento),
    dificultad: cleanFilter(filters.dificultad),
  };
}

export async function invalidateRoutinesLibrary() {
  await Promise.all([
    invalidate(queryKeys.rutinasRoot()),
    invalidate(queryKeys.ejerciciosRoot()),
  ]);
}

export async function invalidateRoutineDetail(rutinaId) {
  const id = cleanId(rutinaId);
  await Promise.all([
    id ? invalidate(queryKeys.rutina(id)) : Promise.resolve(),
    invalidate(queryKeys.rutinasRoot()),
  ]);
}

export async function invalidateClienteRutinas(clientId) {
  const id = cleanId(clientId);
  await Promise.all([
    id ? invalidate(queryKeys.clienteRutinas(id)) : Promise.resolve(),
    id ? invalidate(queryKeys.clienteRutinaActiva(id)) : Promise.resolve(),
    invalidate(queryKeys.professionalClientDetail(id)),
    invalidate(queryKeys.professionalClients()),
  ]);
}

export async function invalidateMenusLibrary(menuId = "") {
  const id = cleanId(menuId);
  await Promise.all([
    invalidate(queryKeys.menusBaseRoot()),
    id ? invalidate(queryKeys.menuBase(id)) : Promise.resolve(),
  ]);
}

export async function invalidateClientMenus(clientId, menuAsignadoId = "") {
  const id = cleanId(clientId);
  const menuId = cleanId(menuAsignadoId);
  await Promise.all([
    id ? invalidate(queryKeys.clientMenusRoot(id)) : Promise.resolve(),
    id ? invalidate(queryKeys.clientActiveMenu(id)) : Promise.resolve(),
    id && menuId ? invalidate(queryKeys.clientMenu(id, menuId)) : Promise.resolve(),
    id ? invalidate(queryKeys.professionalClientDetail(id)) : Promise.resolve(),
    invalidate(queryKeys.professionalClients()),
  ]);
}
