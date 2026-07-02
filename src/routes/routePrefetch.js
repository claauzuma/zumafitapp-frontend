const moduleLoaders = {
  "/": [() => import("../bienvenida.jsx")],
  "/login": [() => import("../AuthPage.jsx")],
  "/auth": [() => import("../AuthPage.jsx")],
  "/register": [() => import("../AuthPage.jsx")],
  "/registro-profesional": [() => import("../profesional/RegistroProfesional.jsx")],

  "/admin/inicio": [() => import("../admin/AdminInicio.jsx")],
  "/admin/usuarios": [() => import("../admin/AdminUsuarios.jsx")],
  "/admin/usuarios/invitaciones": [() => import("../admin/AdminInvitaciones.jsx")],
  "/admin/usuarios/crear": [() => import("../admin/CrearUsuario.jsx")],
  "/admin/comidas": [() => import("../admin/AdminComidas.jsx")],
  "/admin/alimentos": [() => import("../admin/AdminAlimentos.jsx")],
  "/admin/rutinas": [() => import("../admin/AdminRutinas.jsx")],
  "/admin/coach-planes": [() => import("../admin/AdminCoachPlanes.jsx")],
  "/admin/profesionales": [() => import("../admin/AdminProfessionalAccess.jsx")],
  "/admin/sistema": [() => import("../admin/AdminSystem.jsx")],

  "/profesional": [() => import("../profesional/InicioProfesional.jsx")],
  "/profesional/clientes": [() => import("../profesional/ClientesProfesional.jsx")],
  "/profesional/rutinas": [() => import("../profesional/RutinasProfesional.jsx")],
  "/profesional/menus": [() => import("../profesional/MenusProfesional.jsx")],
  "/profesional/comidas": [() => import("../nutritionLibrary/NutritionLibraryPage.jsx")],
  "/profesional/progreso": [() => import("../profesional/ProfesionalPlaceholder.jsx")],
  "/profesional/ajustes": [() => import("../profesional/AjustesProfesional.jsx")],
  "/profesional/perfil": [() => import("../profesional/PerfilProfesional.jsx")],

  "/app/inicio": [() => import("../entrenado/InicioEntrenado.jsx")],
  "/app/objetivos": [() => import("../entrenado/Objetivos.jsx")],
  "/app/menu": [() => import("../entrenado/MenuEj.jsx"), () => import("../entrenado/menu/MenuPlan.jsx")],
  "/app/menu/nuevo": [() => import("../clientMenus/ClientMenuCreatePage.jsx")],
  "/app/menu/preferencias": [() => import("../entrenado/MenuEj.jsx"), () => import("../entrenado/menu/MenuPreferencias.jsx")],
  "/app/menu/favoritas": [() => import("../entrenado/MenuEj.jsx"), () => import("../entrenado/menu/MenuFavoritas.jsx")],
  "/app/perfil": [() => import("../entrenado/Perfil.jsx")],
  "/app/rutinas": [() => import("../entrenado/Rutinas.jsx")],
  "/app/tracking": [() => import("../entrenado/TrackingDiario.jsx")],
  "/app/nutricion": [() => import("../nutritionLibrary/NutritionLibraryPage.jsx")],
  "/app/planes": [() => import("../clientPlans/ClientPlansPage.jsx")],
  "/app/progresos": [() => import("../entrenado/Progresos.jsx")],
  "/app/ajustes": [() => import("../entrenado/Ajustes.jsx")],
};

const loadedModules = new Map();
const prefetchedData = new Map();

function normalizePath(to = "") {
  const text = String(to || "").trim();
  if (!text) return "";
  try {
    return new URL(text, window.location.origin).pathname.replace(/\/+$/, "") || "/";
  } catch {
    return text.split("?")[0].split("#")[0].replace(/\/+$/, "") || "/";
  }
}

function loadersForPath(to = "") {
  const path = normalizePath(to);
  const direct = moduleLoaders[path];
  if (direct) return direct;

  const match = Object.keys(moduleLoaders)
    .filter((key) => path === key || path.startsWith(`${key}/`))
    .sort((a, b) => b.length - a.length)[0];

  return match ? moduleLoaders[match] : [];
}

function preloadModule(loader) {
  if (!loadedModules.has(loader)) {
    loadedModules.set(
      loader,
      loader().catch((error) => {
        loadedModules.delete(loader);
        if (import.meta.env?.DEV) console.warn("[route-prefetch] chunk", error);
      })
    );
  }
  return loadedModules.get(loader);
}

export function preloadRouteChunk(to = "") {
  return Promise.all(loadersForPath(to).map(preloadModule));
}

function todayLocalString() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

async function prefetchWithCache(key, factory) {
  if (prefetchedData.has(key)) return prefetchedData.get(key);
  const promise = factory()
    .catch((error) => {
      if (import.meta.env?.DEV) console.warn("[route-prefetch] data", key, error);
    })
    .finally(() => {
      window.setTimeout(() => prefetchedData.delete(key), 1500);
    });
  prefetchedData.set(key, promise);
  return promise;
}

export async function preloadRouteData(to = "") {
  const path = normalizePath(to);

  if (path === "/admin/usuarios") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, queryKeys, STALE_TIMES }, { listAdminUsers }] = await Promise.all([
        import("../queryClient.js"),
        import("../admin/adminUsuariosApi.js"),
      ]);
      const filters = { search: "", role: "todos", estado: "todos", limit: 100 };
      return queryClient.prefetchQuery({
        queryKey: queryKeys.adminUsers(filters),
        queryFn: () => listAdminUsers(filters),
        staleTime: STALE_TIMES.adminUsers,
      });
    });
  }

  if (path === "/admin/alimentos") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, queryKeys, STALE_TIMES }, { listAlimentos }] = await Promise.all([
        import("../queryClient.js"),
        import("../nutricion/nutricionApi.js"),
      ]);
      const filters = { search: "", category: "todos" };
      return queryClient.prefetchQuery({
        queryKey: queryKeys.alimentos(filters),
        queryFn: () => listAlimentos(filters),
        staleTime: STALE_TIMES.alimentos,
      });
    });
  }

  if (path === "/admin/rutinas") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, queryKeys, STALE_TIMES }, { listRutinas }] = await Promise.all([
        import("../queryClient.js"),
        import("../rutinas/rutinasApi.js"),
      ]);
      return queryClient.prefetchQuery({
        queryKey: queryKeys.rutinas({}),
        queryFn: () => listRutinas({}),
        staleTime: STALE_TIMES.rutinas,
      });
    });
  }

  if (path === "/admin/coach-planes") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, queryKeys, STALE_TIMES }, { getAdminCoachPlans }] = await Promise.all([
        import("../queryClient.js"),
        import("../admin/adminUsuariosApi.js"),
      ]);
      return queryClient.prefetchQuery({
        queryKey: queryKeys.adminCoachPlans(),
        queryFn: getAdminCoachPlans,
        staleTime: STALE_TIMES.adminCoachPlans,
      });
    });
  }

  if (path === "/admin/sistema") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, queryKeys, STALE_TIMES }, { getAdminDatabaseStats }] = await Promise.all([
        import("../queryClient.js"),
        import("../admin/adminSystemApi.js"),
      ]);
      return queryClient.prefetchQuery({
        queryKey: queryKeys.adminDatabaseStats(),
        queryFn: getAdminDatabaseStats,
        staleTime: STALE_TIMES.adminDatabaseStats,
      });
    });
  }

  if (path === "/profesional/clientes") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, queryKeys, STALE_TIMES }, { getProfessionalClients }] = await Promise.all([
        import("../queryClient.js"),
        import("../profesional/profesionalApi.js"),
      ]);
      return queryClient.prefetchQuery({
        queryKey: queryKeys.professionalClients(),
        queryFn: getProfessionalClients,
        staleTime: STALE_TIMES.professionalClients,
      });
    });
  }

  if (path === "/app/planes" || path === "/app/inicio") {
    return prefetchWithCache(path, async () => {
      const [
        { queryClient },
        { clientAccessContextKey, fetchClientAccessContext },
      ] = await Promise.all([
        import("../queryClient.js"),
        import("../clientPlans/clientPlanQueries.js"),
      ]);
      return queryClient.prefetchQuery({
        queryKey: clientAccessContextKey,
        queryFn: fetchClientAccessContext,
        staleTime: 2 * 60 * 1000,
      });
    });
  }

  if (path === "/app/tracking") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, queryKeys, STALE_TIMES }, { getTrackingDay }] = await Promise.all([
        import("../queryClient.js"),
        import("../tracking/trackingApi.js"),
      ]);
      const date = todayLocalString();
      return queryClient.prefetchQuery({
        queryKey: queryKeys.trackingDay(date),
        queryFn: () => getTrackingDay(date),
        staleTime: STALE_TIMES.trackingDay,
      });
    });
  }

  if (path === "/app/objetivos") {
    return prefetchWithCache(path, async () => {
      const [{ queryClient, STALE_TIMES }, { clientGoalsKey, fetchClientGoals }] = await Promise.all([
        import("../queryClient.js"),
        import("../clientGoals/clientGoalsApi.js"),
      ]);
      return queryClient.prefetchQuery({
        queryKey: clientGoalsKey,
        queryFn: fetchClientGoals,
        staleTime: STALE_TIMES.authMe,
      });
    });
  }

  return Promise.resolve();
}

export function prefetchNavigationTarget(to = "", { data = true } = {}) {
  preloadRouteChunk(to);
  if (data) preloadRouteData(to);
}

export function createNavigationPrefetchHandlers(to = "", options = {}) {
  const run = () => prefetchNavigationTarget(to, options);
  return {
    onPointerEnter: run,
    onFocus: run,
    onTouchStart: run,
    onMouseDown: run,
  };
}

export function scheduleIdleRoutePrefetch(paths = [], options = {}) {
  const uniquePaths = [...new Set(paths.map(normalizePath).filter(Boolean))];
  if (!uniquePaths.length) return () => {};

  const run = () => {
    uniquePaths.forEach((path) => preloadRouteChunk(path));
    if (options.data) uniquePaths.forEach((path) => preloadRouteData(path));
  };

  if (typeof window !== "undefined" && "requestIdleCallback" in window) {
    const id = window.requestIdleCallback(run, { timeout: options.timeout || 3500 });
    return () => window.cancelIdleCallback?.(id);
  }

  const timer = window.setTimeout(run, options.delay || 1200);
  return () => window.clearTimeout(timer);
}
