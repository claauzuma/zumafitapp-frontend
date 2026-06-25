import test from "node:test";
import assert from "node:assert/strict";

import {
  extractCapabilities,
  menusUsageFromResponse,
  normalizeCapabilities,
  PLAN_PRESETS,
  planFeatureRows,
  planUpgradeHighlights,
  resolveEffectiveClientNutritionCapabilities,
  usageText,
} from "./clientPlanUtils.js";

const validCapabilities = {
  role: "cliente",
  plan: "free",
  hasCoach: false,
  canTrack: true,
  canCreateOwnMenu: true,
  canEditOwnMenu: true,
  canUseBasicLibrary: true,
  canUseGlobalLibrary: false,
  canUsePremiumLibrary: false,
  limits: {
    ownMenus: 2,
    ownMeals: 10,
  },
};

function httpError(status, message = "HTTP error") {
  const error = new Error(message);
  error.status = status;
  return error;
}

test("extractCapabilities soporta respuesta directa y respuesta con capabilities", () => {
  assert.equal(extractCapabilities({ capabilities: validCapabilities }), validCapabilities);
  assert.equal(extractCapabilities(validCapabilities), validCapabilities);
});

test("normalizeCapabilities normaliza premium y premium2 sin asumir Free si falta plan", () => {
  assert.equal(normalizeCapabilities({ ...validCapabilities, plan: "premium" }).capabilities.plan, "pro");
  assert.equal(normalizeCapabilities({ ...validCapabilities, plan: "premium2" }).capabilities.plan, "vip");
  assert.equal(normalizeCapabilities({ ...validCapabilities, plan: "" }).validation.valid, false);
});

test("resolveEffectiveClientNutritionCapabilities usa endpoint directo 200", async () => {
  const result = await resolveEffectiveClientNutritionCapabilities({
    fetchDirect: async () => ({ capabilities: validCapabilities }),
    fetchMenusFallback: async () => {
      throw new Error("fallback no deberia ejecutarse");
    },
  });

  assert.equal(result.source, "direct");
  assert.equal(result.capabilities.plan, "free");
});

test("resolveEffectiveClientNutritionCapabilities usa fallback cuando directo devuelve 404", async () => {
  const result = await resolveEffectiveClientNutritionCapabilities({
    fetchDirect: async () => {
      throw httpError(404, "not found");
    },
    fetchMenusFallback: async () => ({
      items: [],
      pagination: { total: 0 },
      capabilities: validCapabilities,
    }),
  });

  assert.equal(result.source, "menus-fallback");
  assert.equal(result.capabilities.plan, "free");
});

test("resolveEffectiveClientNutritionCapabilities falla si directo 404 y fallback no trae capabilities", async () => {
  await assert.rejects(
    () => resolveEffectiveClientNutritionCapabilities({
      fetchDirect: async () => {
        throw httpError(404, "not found");
      },
      fetchMenusFallback: async () => ({ items: [], pagination: { total: 0 } }),
    }),
    /CAPABILITIES/
  );
});

test("resolveEffectiveClientNutritionCapabilities propaga 401 sin fallback", async () => {
  let fallbackCalled = false;
  await assert.rejects(
    () => resolveEffectiveClientNutritionCapabilities({
      fetchDirect: async () => {
        throw httpError(401, "unauthorized");
      },
      fetchMenusFallback: async () => {
        fallbackCalled = true;
        return { capabilities: validCapabilities };
      },
    }),
    /unauthorized/
  );
  assert.equal(fallbackCalled, false);
});

test("resolveEffectiveClientNutritionCapabilities propaga 500 sin fallback", async () => {
  let fallbackCalled = false;
  await assert.rejects(
    () => resolveEffectiveClientNutritionCapabilities({
      fetchDirect: async () => {
        throw httpError(500, "server error");
      },
      fetchMenusFallback: async () => {
        fallbackCalled = true;
        return { capabilities: validCapabilities };
      },
    }),
    /server error/
  );
  assert.equal(fallbackCalled, false);
});

test("menusUsageFromResponse usa pagination.total y soporta contador no disponible", () => {
  assert.deepEqual(
    menusUsageFromResponse({ items: [{ id: 1 }], pagination: { total: 4 } }, validCapabilities),
    { used: 4, limit: 2 }
  );
  assert.deepEqual(
    menusUsageFromResponse(null, validCapabilities),
    { used: null, limit: 2 }
  );
  assert.equal(usageText({ used: null, limit: 2 }), "No disponible");
});

test("planFeatureRows marca menus automaticos como no disponibles si backend no los habilita", () => {
  for (const preset of Object.values(PLAN_PRESETS)) {
    const automaticRow = planFeatureRows(preset).find((row) => row.key === "automaticMenu");
    assert.equal(automaticRow.included, false);
    assert.equal(automaticRow.value, "No disponible aun");
  }

  const proNutrition = planFeatureRows(PLAN_PRESETS.pro).find((row) => row.key === "autoCoachNutrition");
  const vipTraining = planFeatureRows(PLAN_PRESETS.vip).find((row) => row.key === "autoCoachTraining");
  assert.equal(proNutrition.value, "Sugerencias");
  assert.equal(vipTraining.value, "Ajustes adaptativos");

  assert.deepEqual(planUpgradeHighlights("pro", "free"), [
    "+18 menus",
    "+90 comidas",
    "Biblioteca global",
    "AutoCoach nutricion",
    "AutoCoach training",
  ]);
  assert.deepEqual(planUpgradeHighlights("vip", "free"), [
    "+98 menus",
    "+490 comidas",
    "Biblioteca premium",
    "AutoCoach adaptativo",
    "Rutina adaptativa",
  ]);
});

test("boton reintentar puede volver a resolver luego de una promesa rechazada previa", async () => {
  let calls = 0;
  const fetchDirect = async () => {
    calls += 1;
    if (calls === 1) throw httpError(404, "not found");
    return { capabilities: { ...validCapabilities, plan: "premium" } };
  };

  await assert.rejects(
    () => resolveEffectiveClientNutritionCapabilities({
      fetchDirect,
      fetchMenusFallback: async () => ({ items: [] }),
    }),
    /CAPABILITIES/
  );

  const retry = await resolveEffectiveClientNutritionCapabilities({
    fetchDirect,
    fetchMenusFallback: async () => {
      throw new Error("fallback no deberia ejecutarse en retry");
    },
  });

  assert.equal(retry.capabilities.plan, "pro");
});
