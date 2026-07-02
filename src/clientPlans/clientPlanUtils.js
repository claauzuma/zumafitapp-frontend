export const PLAN_ORDER = ["free", "pro", "vip"];

export const PLAN_PRESETS = {
  free: {
    plan: "free",
    limits: { ownMenus: 1, ownMeals: 5, favorites: 3, menuDays: 1, trackingHistoryDays: 7 },
    canTrack: true,
    canCreateOwnMenu: true,
    canEditOwnMenu: true,
    canUseBasicLibrary: true,
    canUseGlobalLibrary: false,
    canUsePremiumLibrary: false,
    canGenerateAutomaticMenu: false,
    automaticMenusStatus: "blocked",
    automaticRoutineStatus: "blocked",
    autoCoachNutrition: "manual",
    autoCoachTraining: "manual",
    canExportMenuPdf: false,
  },
  pro: {
    plan: "pro",
    limits: { ownMenus: 10, ownMeals: 100, favorites: 20, menuDays: 7, trackingHistoryDays: null },
    canTrack: true,
    canCreateOwnMenu: true,
    canEditOwnMenu: true,
    canUseBasicLibrary: true,
    canUseGlobalLibrary: true,
    canUsePremiumLibrary: false,
    canGenerateAutomaticMenu: false,
    automaticMenusStatus: "coming_soon",
    automaticRoutineStatus: "coming_soon",
    autoCoachNutrition: "coming_soon",
    autoCoachNutritionMode: "suggestions",
    autoCoachTraining: "coming_soon",
    autoCoachTrainingMode: "suggestions",
    canExportMenuPdf: false,
  },
  vip: {
    plan: "vip",
    limits: { ownMenus: 50, ownMeals: 500, favorites: 100, menuDays: 7, trackingHistoryDays: null },
    canTrack: true,
    canCreateOwnMenu: true,
    canEditOwnMenu: true,
    canUseBasicLibrary: true,
    canUseGlobalLibrary: true,
    canUsePremiumLibrary: true,
    canGenerateAutomaticMenu: false,
    automaticMenusStatus: "coming_soon",
    automaticRoutineStatus: "coming_soon",
    autoCoachNutrition: "coming_soon",
    autoCoachNutritionMode: "adaptive_review",
    autoCoachTraining: "coming_soon",
    autoCoachTrainingMode: "adaptive_review",
    canExportMenuPdf: false,
  },
};

export const PLAN_MARKETING_COPY = {
  free: {
    eyebrow: "Plan inicial",
    title: "Estas en Free",
    summary: "Tracking diario, un menu propio y biblioteca basica para empezar sin depender de un coach.",
    library: "Biblioteca basica",
  },
  pro: {
    eyebrow: "Mas autonomia",
    title: "Plan Pro",
    summary: "Mas cupos, planificacion semanal y biblioteca global. AutoCoach nutricional y rutinas automaticas quedan como proximamente.",
    library: "Biblioteca global",
  },
  vip: {
    eyebrow: "Experiencia completa",
    title: "Plan VIP",
    summary: "Biblioteca premium, limites altos y futuras funciones adaptativas preparadas sin activar automatismos inexistentes.",
    library: "Biblioteca premium",
  },
};

export const PLAN_DETAIL_COPY = {
  free: {
    title: "Ideal para probar ZumaFit",
    description: "Free sirve para registrar, aprender el flujo y crear una base simple. Las metas y ajustes quedan en modo manual.",
    bullets: [
      "Tracking diario incluido",
      "1 menu propio de 1 dia",
      "5 comidas guardadas y 3 favoritos",
      "Biblioteca basica ZumaFit",
      "Sin AutoCoach nutricional ni rutinas automaticas",
    ],
  },
  pro: {
    title: "Mas control para organizarte",
    description: "Pro suma margen para planificar, usar biblioteca global y administrar metas sin cooldown manual.",
    bullets: [
      "Biblioteca global ZumaFit",
      "10 menus propios de hasta 7 dias",
      "100 comidas guardadas y 20 favoritos",
      "AutoCoach nutricional y rutinas automaticas marcados como proximamente",
      "Ideal para usuarios autogestionados constantes",
    ],
  },
  vip: {
    title: "Biblioteca premium y limites altos",
    description: "VIP es el nivel pensado para mayor personalizacion y futuras revisiones adaptativas, sin presentar IA como activa todavia.",
    bullets: [
      "50 menus propios y 500 comidas guardadas",
      "100 favoritos",
      "Biblioteca premium ZumaFit",
      "AutoCoach Nutricional y de Entrenamiento marcados como proximamente",
    ],
  },
};

export function normalizeClientPlanStrict(plan = "") {
  const value = String(plan || "").trim().toLowerCase();
  if (value === "premium" || value === "pro") return "pro";
  if (value === "premium2" || value === "vip") return "vip";
  if (value === "free") return "free";
  return "";
}

export function normalizeClientPlan(plan = "free") {
  const normalized = normalizeClientPlanStrict(plan);
  if (normalized) return normalized;
  return "free";
}

export function extractCapabilities(response) {
  if (response?.capabilities && typeof response.capabilities === "object") return response.capabilities;
  if (response?.data?.capabilities && typeof response.data.capabilities === "object") return response.data.capabilities;
  if (response && typeof response === "object" && (response.plan || response.limits || response.canTrack !== undefined)) return response;
  return null;
}

export function extractAccessContext(response) {
  if (response?.accessContext && typeof response.accessContext === "object") return response.accessContext;
  if (response?.data?.accessContext && typeof response.data.accessContext === "object") return response.data.accessContext;
  if (response && typeof response === "object" && response.primaryAccess && response.capabilities) return response;
  return null;
}

export function capabilitiesFromAccessContext(accessContext = null) {
  if (!accessContext || typeof accessContext !== "object") return null;
  const capabilities = accessContext.capabilities || null;
  if (!capabilities || typeof capabilities !== "object") return null;
  return {
    ...capabilities,
    role: "cliente",
    plan: normalizeClientPlan(accessContext.effectivePersonalPlan || capabilities.plan || accessContext.personalPlan),
    personalPlan: normalizeClientPlan(accessContext.personalPlan || capabilities.personalPlan || capabilities.plan),
    effectivePersonalPlan: normalizeClientPlan(accessContext.effectivePersonalPlan || capabilities.effectivePersonalPlan || capabilities.plan),
    hasCoach: !!accessContext.hasCoach,
    clientType: accessContext.clientType || (accessContext.hasCoach ? "with_coach" : "self_managed"),
  };
}

export function validateCapabilities(capabilities = null) {
  if (!capabilities || typeof capabilities !== "object") {
    return { valid: false, reason: "CAPABILITIES_EMPTY" };
  }

  const plan = normalizeClientPlanStrict(capabilities.plan);
  if (!plan) return { valid: false, reason: "CAPABILITIES_PLAN_INVALID" };

  const role = String(capabilities.role || "cliente").trim().toLowerCase();
  if (role && role !== "cliente" && role !== "client") {
    return { valid: false, reason: "CAPABILITIES_ROLE_NOT_CLIENT" };
  }

  const ownMenus = Number(capabilities?.limits?.ownMenus);
  const ownMeals = Number(capabilities?.limits?.ownMeals);
  if (!Number.isFinite(ownMenus) || !Number.isFinite(ownMeals)) {
    return { valid: false, reason: "CAPABILITIES_LIMITS_INVALID" };
  }

  return { valid: true, reason: "", plan };
}

export function normalizeCapabilities(capabilities = null) {
  const validation = validateCapabilities(capabilities);
  if (!validation.valid) return { capabilities: null, validation };
  return {
    capabilities: {
      ...capabilities,
      role: "cliente",
      plan: validation.plan,
      limits: {
        ...capabilities.limits,
        ownMenus: Number(capabilities.limits.ownMenus),
        ownMeals: Number(capabilities.limits.ownMeals),
      },
    },
    validation,
  };
}

export function responseShape(response) {
  if (!response || typeof response !== "object") return "empty";
  const keys = Object.keys(response).slice(0, 8);
  if (response.capabilities) return `object:capabilities:${keys.join(",")}`;
  if (response.data?.capabilities) return `object:data.capabilities:${keys.join(",")}`;
  if (response.plan || response.limits) return `capabilities-direct:${keys.join(",")}`;
  return `object:${keys.join(",")}`;
}

export function getErrorStatus(error = null) {
  return Number(error?.status ?? error?.response?.status ?? error?.statusCode ?? 0) || 0;
}

export async function resolveEffectiveClientNutritionCapabilities({
  fetchDirect,
  fetchMenusFallback,
  logger = null,
} = {}) {
  if (typeof fetchDirect !== "function") throw new Error("fetchDirect requerido");
  if (typeof fetchMenusFallback !== "function") throw new Error("fetchMenusFallback requerido");

  try {
    const directResponse = await fetchDirect();
    const { capabilities, validation } = normalizeCapabilities(extractCapabilities(directResponse));
    logger?.("direct", {
      status: 200,
      responseShape: responseShape(directResponse),
      hasCapabilities: !!capabilities,
      validation: validation.reason || "OK",
    });
    if (!capabilities) {
      const error = new Error(validation.reason || "CAPABILITIES_NOT_AVAILABLE");
      error.code = validation.reason || "CAPABILITIES_NOT_AVAILABLE";
      error.status = 200;
      throw error;
    }
    return { capabilities, source: "direct" };
  } catch (primaryError) {
    const primaryStatus = getErrorStatus(primaryError);
    logger?.("direct-error", {
      status: primaryStatus || "unknown",
      code: primaryError?.code,
      message: primaryError?.message,
    });
    if (primaryStatus !== 404) throw primaryError;

    try {
      const fallbackResponse = await fetchMenusFallback();
      const { capabilities, validation } = normalizeCapabilities(extractCapabilities(fallbackResponse));
      logger?.("menus-fallback", {
        status: 200,
        responseShape: responseShape(fallbackResponse),
        hasCapabilities: !!capabilities,
        validation: validation.reason || "OK",
      });
      if (!capabilities) {
        const error = new Error(validation.reason || "CAPABILITIES_NOT_AVAILABLE");
        error.code = "CAPABILITIES_NOT_AVAILABLE";
        error.reason = validation.reason;
        error.status = 404;
        throw error;
      }
      return { capabilities, source: "menus-fallback" };
    } catch (fallbackError) {
      logger?.("menus-fallback-error", {
        status: getErrorStatus(fallbackError) || "unknown",
        code: fallbackError?.code,
        message: fallbackError?.message,
      });
      throw fallbackError;
    }
  }
}

export function clientPlanLabel(plan = "free") {
  const normalized = normalizeClientPlan(plan);
  if (normalized === "vip") return "VIP";
  if (normalized === "pro") return "Pro";
  return "Free";
}

export function clientPlanTone(plan = "free") {
  const normalized = normalizeClientPlan(plan);
  if (normalized === "vip") return "vip";
  if (normalized === "pro") return "pro";
  return "free";
}

export function hasClientCoach(user = {}) {
  return Boolean(
    user?.coach?.entrenadorId ||
    user?.coach?.coachId ||
    user?.coachId ||
    user?.entrenadorId ||
    user?.profesionalId
  );
}

export function clientTypeLabel(user = {}, capabilities = null) {
  return (capabilities?.hasCoach ?? hasClientCoach(user)) ? "Con coach" : "Autogestionado";
}

export function libraryAccessLabel(capabilities = {}) {
  if (capabilities?.canUsePremiumLibrary) return "Premium";
  if (capabilities?.canUseGlobalLibrary) return "Global";
  if (capabilities?.canUseBasicLibrary) return "Basica";
  return "No disponible";
}

export function planCopy(plan = "free") {
  return PLAN_MARKETING_COPY[normalizeClientPlan(plan)] || PLAN_MARKETING_COPY.free;
}

export function planDetails(plan = "free") {
  return PLAN_DETAIL_COPY[normalizeClientPlan(plan)] || PLAN_DETAIL_COPY.free;
}

export function planFromCapabilities(user = {}, capabilities = null) {
  return normalizeClientPlan(capabilities?.plan || user?.nutritionCapabilities?.plan || user?.plan);
}

export function ownMenusUsage(data = {}, capabilities = null) {
  const used = Number(data?.pagination?.total ?? data?.items?.length ?? 0);
  const limit = Number(capabilities?.limits?.ownMenus);
  return {
    used: Number.isFinite(used) ? used : 0,
    limit: Number.isFinite(limit) ? limit : null,
  };
}

export function menusUsageFromResponse(data = {}, capabilities = null) {
  const totalFromPagination = Number(data?.pagination?.total);
  const totalFromItems = Array.isArray(data?.items) ? data.items.length : NaN;
  const used = Number.isFinite(totalFromPagination)
    ? totalFromPagination
    : Number.isFinite(totalFromItems)
      ? totalFromItems
      : null;
  const limit = Number(capabilities?.limits?.ownMenus);
  return {
    used,
    limit: Number.isFinite(limit) ? limit : null,
  };
}

export function usageText({ used = 0, limit = null } = {}) {
  if (used === null || used === undefined) return "No disponible";
  if (!Number.isFinite(Number(used))) return "No disponible";
  if (Number.isFinite(Number(limit))) return `${used} de ${limit}`;
  return `${used}`;
}

export function planActionLabel(plan = "free") {
  return normalizeClientPlan(plan) === "vip" ? "Gestionar plan" : "Ver mi plan";
}

export function planBenefits(capabilities = {}) {
  const benefits = [];
  if (capabilities.canTrack) benefits.push("Tracking diario");
  if (capabilities.canCreateOwnMenu) benefits.push(`Menus propios hasta ${capabilities.limits?.ownMenus ?? "-"}`);
  if (capabilities.canEditOwnMenu) benefits.push("Editar y duplicar menus propios");
  if (Number.isFinite(Number(capabilities.limits?.ownMeals))) {
    benefits.push(`Comidas propias hasta ${capabilities.limits.ownMeals}`);
  }
  if (capabilities.canUsePremiumLibrary) {
    benefits.push("Biblioteca ZumaFit premium");
  } else if (capabilities.canUseGlobalLibrary) {
    benefits.push("Biblioteca ZumaFit global");
  } else if (capabilities.canUseBasicLibrary) {
    benefits.push("Biblioteca basica");
  }
  if (capabilities.canGenerateAutomaticMenu) benefits.push("Generacion automatica");
  if (capabilities.autoCoachNutrition === "coming_soon") benefits.push("AutoCoach nutricional proximamente");
  if (capabilities.autoCoachTraining === "coming_soon") benefits.push("AutoCoach entrenamiento proximamente");
  if (capabilities.canExportMenuPdf) benefits.push("Exportar PDF");
  return benefits;
}

export function planFeatureRows(capabilities = {}) {
  const ownMenus = Number(capabilities?.limits?.ownMenus);
  const ownMeals = Number(capabilities?.limits?.ownMeals);
  const favorites = Number(capabilities?.limits?.favorites);
  const menuDays = Number(capabilities?.limits?.menuDays);
  const nutritionMode = String(capabilities?.autoCoachNutrition || "manual");
  const trainingMode = String(capabilities?.autoCoachTraining || "manual");
  const automaticMenusStatus = String(capabilities?.automaticMenusStatus || (capabilities.canGenerateAutomaticMenu ? "enabled" : "blocked"));
  const automaticRoutineStatus = String(capabilities?.automaticRoutineStatus || "blocked");
  return [
    {
      key: "tracking",
      label: "Tracking diario",
      value: capabilities.canTrack ? "Incluido" : "No disponible",
      included: !!capabilities.canTrack,
    },
    {
      key: "ownMenus",
      label: "Menus propios",
      value: Number.isFinite(ownMenus) ? `Hasta ${ownMenus}` : "No disponible",
      included: Number.isFinite(ownMenus) && ownMenus > 0,
    },
    {
      key: "menuDays",
      label: "Dias por menu",
      value: Number.isFinite(menuDays) ? `${menuDays} dia${menuDays === 1 ? "" : "s"}` : "Semanal",
      included: Number.isFinite(menuDays) && menuDays > 1,
      muted: Number.isFinite(menuDays) && menuDays <= 1,
    },
    {
      key: "ownMeals",
      label: "Comidas propias",
      value: Number.isFinite(ownMeals) ? `Hasta ${ownMeals}` : "No disponible",
      included: Number.isFinite(ownMeals) && ownMeals > 0,
    },
    {
      key: "favorites",
      label: "Favoritos",
      value: Number.isFinite(favorites) ? `Hasta ${favorites}` : "Sin limite alto",
      included: Number.isFinite(favorites) && favorites > 3,
      muted: Number.isFinite(favorites) && favorites <= 3,
    },
    {
      key: "library",
      label: "Biblioteca ZumaFit",
      value: libraryAccessLabel(capabilities),
      included: !!capabilities.canUseBasicLibrary,
    },
    {
      key: "automaticMenu",
      label: "Menus automaticos",
      value: capabilities.canGenerateAutomaticMenu
        ? "Incluido"
        : automaticMenusStatus === "coming_soon"
          ? "Proximamente"
          : "No incluido",
      included: !!capabilities.canGenerateAutomaticMenu,
      muted: !capabilities.canGenerateAutomaticMenu,
    },
    {
      key: "automaticRoutine",
      label: "Rutinas automaticas",
      value: automaticRoutineStatus === "coming_soon" ? "Proximamente" : capabilities.canGenerateAutomaticRoutine ? "Incluido" : "No incluido",
      included: !!capabilities.canGenerateAutomaticRoutine,
      muted: !capabilities.canGenerateAutomaticRoutine,
    },
    {
      key: "autoCoachNutrition",
      label: "AutoCoach nutricion",
      value: autoCoachModeLabel(nutritionMode),
      included: nutritionMode !== "manual" && nutritionMode !== "coming_soon",
      muted: nutritionMode === "manual" || nutritionMode === "coming_soon",
    },
    {
      key: "autoCoachTraining",
      label: "AutoCoach entrenamiento",
      value: autoCoachModeLabel(trainingMode),
      included: trainingMode !== "manual" && trainingMode !== "coming_soon",
      muted: trainingMode === "manual" || trainingMode === "coming_soon",
    },
  ];
}

export function autoCoachModeLabel(mode = "manual") {
  if (mode === "coming_soon") return "Proximamente";
  if (mode === "adaptive") return "Ajustes adaptativos";
  if (mode === "adaptive_review") return "Proximamente";
  if (mode === "suggestions") return "Sugerencias";
  return "Manual";
}

export function planUpgradeHighlights(planId = "free", currentPlan = "free") {
  const target = PLAN_PRESETS[normalizeClientPlan(planId)] || PLAN_PRESETS.free;
  const current = PLAN_PRESETS[normalizeClientPlan(currentPlan)] || PLAN_PRESETS.free;
  const highlights = [];

  const menuDiff = Number(target.limits?.ownMenus) - Number(current.limits?.ownMenus);
  if (Number.isFinite(menuDiff) && menuDiff > 0) highlights.push(`+${menuDiff} menus`);

  const mealDiff = Number(target.limits?.ownMeals) - Number(current.limits?.ownMeals);
  if (Number.isFinite(mealDiff) && mealDiff > 0) highlights.push(`+${mealDiff} comidas`);

  const favoriteDiff = Number(target.limits?.favorites) - Number(current.limits?.favorites);
  if (Number.isFinite(favoriteDiff) && favoriteDiff > 0) highlights.push(`+${favoriteDiff} favoritos`);

  const dayDiff = Number(target.limits?.menuDays) - Number(current.limits?.menuDays);
  if (Number.isFinite(dayDiff) && dayDiff > 0) highlights.push("Menu semanal");

  if (target.canUsePremiumLibrary && !current.canUsePremiumLibrary) {
    highlights.push("Biblioteca premium");
  } else if (target.canUseGlobalLibrary && !current.canUseGlobalLibrary) {
    highlights.push("Biblioteca global");
  }

  if (target.canGenerateAutomaticMenu && !current.canGenerateAutomaticMenu) {
    highlights.push("Menus automaticos");
  }
  if (target.autoCoachNutrition === "coming_soon" && current.autoCoachNutrition === "manual") {
    highlights.push("AutoCoach nutricion proximamente");
  }
  if (target.autoCoachTraining === "coming_soon" && current.autoCoachTraining === "manual") {
    highlights.push("AutoCoach entrenamiento proximamente");
  }

  return highlights;
}
