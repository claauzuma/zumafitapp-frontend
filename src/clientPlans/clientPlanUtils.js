export const PLAN_ORDER = ["free", "pro", "vip"];

export const PLAN_PRESETS = {
  free: {
    plan: "free",
    limits: { ownMenus: 2, ownMeals: 10 },
    canTrack: true,
    canCreateOwnMenu: true,
    canEditOwnMenu: true,
    canUseBasicLibrary: true,
    canUseGlobalLibrary: false,
    canUsePremiumLibrary: false,
    canGenerateAutomaticMenu: false,
    autoCoachNutrition: "manual",
    autoCoachTraining: "manual",
    canExportMenuPdf: false,
  },
  pro: {
    plan: "pro",
    limits: { ownMenus: 20, ownMeals: 100 },
    canTrack: true,
    canCreateOwnMenu: true,
    canEditOwnMenu: true,
    canUseBasicLibrary: true,
    canUseGlobalLibrary: true,
    canUsePremiumLibrary: false,
    canGenerateAutomaticMenu: false,
    autoCoachNutrition: "suggestions",
    autoCoachTraining: "suggestions",
    canExportMenuPdf: false,
  },
  vip: {
    plan: "vip",
    limits: { ownMenus: 100, ownMeals: 500 },
    canTrack: true,
    canCreateOwnMenu: true,
    canEditOwnMenu: true,
    canUseBasicLibrary: true,
    canUseGlobalLibrary: true,
    canUsePremiumLibrary: true,
    canGenerateAutomaticMenu: false,
    autoCoachNutrition: "adaptive",
    autoCoachTraining: "adaptive",
    canExportMenuPdf: false,
  },
};

export const PLAN_MARKETING_COPY = {
  free: {
    eyebrow: "Plan inicial",
    title: "Estas en Free",
    summary: "Tracking diario, menus propios limitados y biblioteca basica para organizar tu nutricion sin coach.",
    library: "Biblioteca basica",
  },
  pro: {
    eyebrow: "Mas autonomia",
    title: "Plan Pro",
    summary: "Mas cupos para tus menus y comidas propias, con acceso a la biblioteca global ZumaFit.",
    library: "Biblioteca global",
  },
  vip: {
    eyebrow: "Experiencia completa",
    title: "Plan VIP",
    summary: "Limites altos, biblioteca premium y mayor margen para guardar tu organizacion nutricional.",
    library: "Biblioteca premium",
  },
};

export const PLAN_DETAIL_COPY = {
  free: {
    title: "Ideal para probar ZumaFit",
    description: "Free sirve para registrar, aprender el flujo y crear una base simple. Las metas y ajustes quedan en modo manual.",
    bullets: [
      "Tracking diario incluido",
      "Menus y comidas propias con limite bajo",
      "Biblioteca basica ZumaFit",
      "Sin AutoCoach ni ajustes adaptativos",
    ],
  },
  pro: {
    title: "Mas control y mejores sugerencias",
    description: "Pro suma margen para organizarte y recibir senales inteligentes sin que la app cambie objetivos automaticamente.",
    bullets: [
      "Biblioteca global ZumaFit",
      "Sugerencias nutricionales segun progreso",
      "Sugerencias de progresion para rutina",
      "Ideal para usuarios autogestionados constantes",
    ],
  },
  vip: {
    title: "AutoCoach adaptativo",
    description: "VIP es el nivel pensado para ajustes semi automaticos segun peso, adherencia, entrenamientos y progreso.",
    bullets: [
      "AutoCoach Nutricional con ajustes de calorias y macros",
      "AutoCoach de Entrenamiento con progresion y deload sugerido",
      "Biblioteca premium ZumaFit",
      "Limites altos para menus y comidas propias",
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
  if (capabilities.canExportMenuPdf) benefits.push("Exportar PDF");
  return benefits;
}

export function planFeatureRows(capabilities = {}) {
  const ownMenus = Number(capabilities?.limits?.ownMenus);
  const ownMeals = Number(capabilities?.limits?.ownMeals);
  const nutritionMode = String(capabilities?.autoCoachNutrition || "manual");
  const trainingMode = String(capabilities?.autoCoachTraining || "manual");
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
      key: "ownMeals",
      label: "Comidas propias",
      value: Number.isFinite(ownMeals) ? `Hasta ${ownMeals}` : "No disponible",
      included: Number.isFinite(ownMeals) && ownMeals > 0,
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
      value: capabilities.canGenerateAutomaticMenu ? "Incluido" : "No disponible aun",
      included: !!capabilities.canGenerateAutomaticMenu,
      muted: !capabilities.canGenerateAutomaticMenu,
    },
    {
      key: "autoCoachNutrition",
      label: "AutoCoach nutricion",
      value: autoCoachModeLabel(nutritionMode),
      included: nutritionMode !== "manual",
      muted: nutritionMode === "manual",
    },
    {
      key: "autoCoachTraining",
      label: "AutoCoach entrenamiento",
      value: autoCoachModeLabel(trainingMode),
      included: trainingMode !== "manual",
      muted: trainingMode === "manual",
    },
  ];
}

export function autoCoachModeLabel(mode = "manual") {
  if (mode === "adaptive") return "Ajustes adaptativos";
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

  if (target.canUsePremiumLibrary && !current.canUsePremiumLibrary) {
    highlights.push("Biblioteca premium");
  } else if (target.canUseGlobalLibrary && !current.canUseGlobalLibrary) {
    highlights.push("Biblioteca global");
  }

  if (target.canGenerateAutomaticMenu && !current.canGenerateAutomaticMenu) {
    highlights.push("Menus automaticos");
  }
  if (target.autoCoachNutrition === "suggestions" && current.autoCoachNutrition === "manual") {
    highlights.push("AutoCoach nutricion");
  }
  if (target.autoCoachNutrition === "adaptive" && current.autoCoachNutrition !== "adaptive") {
    highlights.push("AutoCoach adaptativo");
  }
  if (target.autoCoachTraining === "suggestions" && current.autoCoachTraining === "manual") {
    highlights.push("AutoCoach training");
  }
  if (target.autoCoachTraining === "adaptive" && current.autoCoachTraining !== "adaptive") {
    highlights.push("Rutina adaptativa");
  }

  return highlights;
}
