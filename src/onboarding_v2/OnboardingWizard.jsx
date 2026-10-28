// src/onboarding_v2/OnboardingWizard.jsx
import React, { useCallback, useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, LoaderCircle } from "lucide-react";
import { apiFetch } from "../Api.js";
import { setAuthLogged, getCachedUser } from "../authCache.js";
import OnboardingLayout from "./OnboardingLayout.jsx";

// BASICS screens
import IntroStart from "./screens/IntroStart.jsx";
import BasicsSex from "./screens/BasicsSex.jsx";
import BasicsBirth from "./screens/BasicsBirth.jsx";
import BasicsHeight from "./screens/BasicsHeight.jsx";
import BasicsWeight from "./screens/BasicsWeight.jsx";
import BasicsBodyFat from "./screens/BasicsBodyFat.jsx";
import BasicsWeightTrend from "./screens/BasicsWeightTrend.jsx";
import BasicsExerciseFreq from "./screens/BasicsExerciseFreq.jsx";
import BasicsDailyActivity from "./screens/BasicsDailyActivity.jsx";
import BasicsExperience from "./screens/BasicsExperience.jsx";
import BasicsTDEE from "./screens/BasicsTDEE.jsx";

// GOAL
import GoalWizard from "./screens/goal/GoalWizard.jsx";

// PROGRAM
import ProgramWizard from "./screens/program/ProgramWizard.jsx";

const BASICS_SCREENS = [
  { key: "intro", component: IntroStart, title: "Onboarding", subtitle: "Tu plan en 1 minuto" },
  { key: "sex", component: BasicsSex, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "birth", component: BasicsBirth, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "height", component: BasicsHeight, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "weight", component: BasicsWeight, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "bodyfat", component: BasicsBodyFat, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "trend", component: BasicsWeightTrend, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "exercise", component: BasicsExerciseFreq, title: "Básicos", subtitle: "Actividad" },
  { key: "daily", component: BasicsDailyActivity, title: "Básicos", subtitle: "Actividad" },
  { key: "exp", component: BasicsExperience, title: "Básicos", subtitle: "Entrenamiento" },
  { key: "tdee", component: BasicsTDEE, title: "Básicos", subtitle: "Estimación" },
];

function isAtLeast18(birthYYYYMMDD) {
  if (!birthYYYYMMDD) return false;
  const birth = new Date(`${birthYYYYMMDD}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return false;

  const today = new Date();
  const cutoff = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  return birth <= cutoff;
}

function buildFormFromUser(user) {
  const basics = user?.profile?.basics || {};
  const antropometria = user?.antropometriaActual || {};

  return {
    sexo: basics.genero || "",
    fechaNacimiento: basics.fechaNacimiento || "",
    alturaCm: antropometria.alturaCm ?? 170,
    pesoKg: antropometria.pesoKg ?? 75,
    grasaPct:
      antropometria.grasaPct === null || antropometria.grasaPct === undefined
        ? ""
        : antropometria.grasaPct,
    tendenciaPeso: basics.tendenciaPeso || "",
    frecuenciaEjercicio: basics.frecuenciaEjercicio || "",
    actividadDiaria: basics.actividadDiaria || "",
    experienciaPesas: basics.experienciaPesas || "",
    tdeeEstimado: basics.tdeeEstimado ?? null,
    tdeeCustom: null,
  };
}

export default function OnboardingWizard({ startAt = "basics" }) {
  const nav = useNavigate();
  const loc = useLocation();

  const [form, setForm] = useState({
    sexo: "",
    fechaNacimiento: "",
    alturaCm: 170,
    pesoKg: 75,
    grasaPct: "",
    tendenciaPeso: "",
    frecuenciaEjercicio: "",
    actividadDiaria: "",
    experienciaPesas: "",
    tdeeEstimado: null,
    tdeeCustom: null,
  });

  const [i, setI] = useState(0);
  const [nestedProgress, setNestedProgress] = useState(null);
  const [nestedBack, setNestedBack] = useState(null);

  const section = useMemo(() => {
    const p = (loc.pathname || "").toLowerCase();
    if (startAt === "goal" || p.includes("/onboarding/goal")) return "goal";
    if (startAt === "program" || p.includes("/onboarding/program")) return "program";
    return "basics";
  }, [loc.pathname, startAt]);

  const isBasics = section === "basics";
  const screen = isBasics ? BASICS_SCREENS[i] : null;

  const reportNestedProgress = useCallback((next) => {
    if (!next || !next.section) return;
    const normalized = {
      section: next.section,
      step: Math.max(0, Number(next.step) || 0),
      total: Math.max(1, Number(next.total) || 1),
      label: String(next.label || ""),
    };
    setNestedProgress((current) => (
      current?.section === normalized.section
      && current?.step === normalized.step
      && current?.total === normalized.total
      && current?.label === normalized.label
        ? current
        : normalized
    ));
  }, []);

  const reportNestedBack = useCallback((nestedSection, handler, disabled = false) => {
    if (typeof handler !== "function") return;
    setNestedBack({ section: nestedSection, handler, disabled: Boolean(disabled) });
  }, []);

  const sectionStep = nestedProgress?.section === section ? nestedProgress.step : 0;
  const sectionTotal = nestedProgress?.section === section
    ? nestedProgress.total
    : section === "goal"
      ? 4
      : 7;
  const sectionStepCurrent = Math.min(sectionTotal, sectionStep + 1);
  const sectionBackHandler = nestedBack?.section === section ? nestedBack.handler : null;

  const progressPct = useMemo(() => {
    if (isBasics) {
      return Math.max(3, Math.round(((i + 1) / BASICS_SCREENS.length) * 33));
    }
    if (section === "goal") {
      return Math.min(67, 33 + Math.round((sectionStepCurrent / sectionTotal) * 34));
    }
    return Math.min(100, 67 + Math.round((sectionStepCurrent / sectionTotal) * 33));
  }, [i, isBasics, section, sectionStepCurrent, sectionTotal]);

  useEffect(() => {
    const u = getCachedUser?.();
    if (!u) return;
    const done = Boolean(u?.onboarding?.done);
    const enabled = u?.onboarding?.enabled === true;
    if (!enabled || done) {
      nav("/app/inicio", { replace: true });
    }
  }, [nav]);

  // ✅ hidratar form desde user cacheado cuando se monta / cambia ruta
  useEffect(() => {
    const u = getCachedUser?.();
    if (!u) return;
    setForm((prev) => ({
      ...prev,
      ...buildFormFromUser(u),
      tdeeCustom: prev.tdeeCustom, // respetamos custom si el usuario lo estaba editando
    }));
  }, [loc.pathname]);

  // ✅ Resume SOLO cuando entrás al root /app/onboarding
  // pero si venís "a propósito" desde Goal o Program, NO redirige
  useEffect(() => {
    const path = (loc.pathname || "").toLowerCase();
    const isEnteringOnboardingRoot = path === "/app/onboarding" || path === "/app/onboarding/";
    if (!isEnteringOnboardingRoot) return;

    const cameBackToBasics = Boolean(loc.state?.backToBasics);
    const u = getCachedUser?.();
    if (!u) return;

    const done = Boolean(u?.onboarding?.done);
    if (done) return;

    // ✅ si volvió a basics desde goal/program, lo dejamos en basics
    // y lo mandamos a la última pantalla de basics
    if (cameBackToBasics) {
      setI(BASICS_SCREENS.length - 1); // tdee
      return;
    }

    const savedStep = Number(u?.onboarding?.step || 1);

    if (savedStep >= 3) {
      nav("/app/onboarding/program", { replace: true });
      return;
    }
    if (savedStep >= 2) {
      nav("/app/onboarding/goal", { replace: true });
      return;
    }
  }, [loc.pathname, loc.state, nav]);

  async function patchStep1(partialData) {
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ step: 1, data: partialData }),
    });
  }

  async function finishOnboardingAndGoHome() {
    const me = await apiFetch("/api/usuarios/auth/me", { method: "GET" });
    const user = me?.user || me;
    if (user) setAuthLogged(user);
    nav("/app/inicio", { replace: true });
  }

  function back() {
    if (section === "goal") {
      nav("/app/onboarding", { replace: true, state: { backToBasics: true } });
      return;
    }

    if (section === "program") {
      nav("/app/onboarding/goal", { replace: true });
      return;
    }

    if (i <= 0) {
      nav("/app/inicio", { replace: true });
      return;
    }

    setI((x) => Math.max(0, x - 1));
  }

  function next() {
    if (!isBasics) return;
    if (i < BASICS_SCREENS.length - 1) {
      setI((x) => x + 1);
    } else {
      nav("/app/onboarding/goal", { replace: true });
    }
  }

  // =========================
  // GOAL
  // =========================
  if (section === "goal") {
    return (
      <OnboardingLayout
        title="Objetivo"
        subtitle="Definí tu meta"
        theme="goal"
        phaseIndex={1}
        progressPct={progressPct}
        stepCurrent={sectionStepCurrent}
        stepTotal={sectionTotal}
        transitionKey="goal"
        navigationKey={`goal-${sectionStep}`}
        onBack={sectionBackHandler || (() => nav("/app/onboarding", { replace: true, state: { backToBasics: true } }))}
        backDisabled={Boolean(nestedBack?.section === section && nestedBack.disabled)}
        footer={null}
      >
        <div className="ob2-goal">
          <GoalWizard
            onProgress={reportNestedProgress}
            onBackChange={reportNestedBack}
            heightCm={form.alturaCm}
            currentWeightKg={form.pesoKg}
            tdeeKcal={form.tdeeCustom ?? form.tdeeEstimado}
            nutritionInput={{
              birthDate: form.fechaNacimiento,
              sex: form.sexo,
              heightCm: form.alturaCm,
              weightKg: form.pesoKg,
              activity: form.actividadDiaria,
              exerciseFrequency: form.frecuenciaEjercicio,
              ...(form.tdeeCustom != null ? { maintenanceKcalOverride: Number(form.tdeeCustom) } : {}),
            }}
            onDone={async () => {
              const me = await apiFetch("/api/usuarios/auth/me", { method: "GET" });
              const user = me?.user || me;
              if (user) setAuthLogged(user);
              nav("/app/onboarding/program", { replace: true });
            }}
          />
        </div>
      </OnboardingLayout>
    );
  }

  // =========================
  // PROGRAM
  // =========================
  if (section === "program") {
    return (
      <OnboardingLayout
        title="Programa"
        subtitle="Últimos detalles"
        theme="program"
        phaseIndex={2}
        progressPct={progressPct}
        stepCurrent={sectionStepCurrent}
        stepTotal={sectionTotal}
        transitionKey="program"
        navigationKey={`program-${sectionStep}`}
        onBack={sectionBackHandler || (() => nav("/app/onboarding/goal", { replace: true }))}
        backDisabled={Boolean(nestedBack?.section === section && nestedBack.disabled)}
        footer={null}
      >
        <div className="ob2-program">
          <ProgramWizard
            onProgress={reportNestedProgress}
            onBackChange={reportNestedBack}
            onDone={async () => {
              await finishOnboardingAndGoHome();
            }}
          />
        </div>
      </OnboardingLayout>
    );
  }

  // =========================
  // BASICS
  // =========================
  if (!screen) return null;
  const ScreenComp = screen.component;

  return (
    <OnboardingLayout
      title={screen.title}
      subtitle={screen.subtitle}
      theme={screen.key}
      phaseIndex={0}
      progressPct={progressPct}
      stepCurrent={i + 1}
      stepTotal={BASICS_SCREENS.length}
      transitionKey={screen.key}
      navigationKey={`basics-${screen.key}`}
      onBack={back}
      footer={
        <div className="ob2-sticky-inner">
          <ScreenFooter
            screenKey={screen.key}
            form={form}
            onNext={next}
            onBack={back}
            patchStep1={patchStep1}
            nav={nav}
          />
        </div>
      }
    >
      <ScreenComp
        form={form}
        setForm={setForm}
        onNext={next}
        patchStep1={patchStep1}
        nav={nav}
      />
    </OnboardingLayout>
  );
}

function ScreenFooter({ screenKey, form, onNext, onBack, patchStep1, nav }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function canContinue() {
    if (screenKey === "intro") return true;
    if (screenKey === "sex") return !!form.sexo;
    if (screenKey === "birth") return isAtLeast18(form.fechaNacimiento);
    if (screenKey === "bodyfat") return true;
    if (screenKey === "trend") return !!form.tendenciaPeso;
    if (screenKey === "exercise") return !!form.frecuenciaEjercicio;
    if (screenKey === "daily") return !!form.actividadDiaria;
    if (screenKey === "exp") return !!form.experienciaPesas;
    if (screenKey === "tdee") {
      const value = form.tdeeCustom != null ? Number(form.tdeeCustom) : Number(form.tdeeEstimado);
      return Number.isFinite(value) && value > 0;
    }
    return true;
  }

  async function saveCurrentStepInBackground() {
    try {
      if (screenKey === "sex") await patchStep1({ sexo: form.sexo });
      if (screenKey === "birth") await patchStep1({ fechaNacimiento: form.fechaNacimiento });
      if (screenKey === "height") await patchStep1({ alturaCm: Number(form.alturaCm) });
      if (screenKey === "weight") await patchStep1({ pesoKg: Number(form.pesoKg) });
      if (screenKey === "bodyfat") {
        const raw = String(form.grasaPct ?? "").trim();
        const val = raw === "" ? null : Number(raw);
        await patchStep1({ grasaPct: val });
      }
      if (screenKey === "trend") await patchStep1({ tendenciaPeso: form.tendenciaPeso });
      if (screenKey === "exercise") await patchStep1({ frecuenciaEjercicio: form.frecuenciaEjercicio });
      if (screenKey === "daily") await patchStep1({ actividadDiaria: form.actividadDiaria });
      if (screenKey === "exp") await patchStep1({ experienciaPesas: form.experienciaPesas });
    } catch (e) {
      console.error("No se pudo guardar el paso intermedio de Basics", e);
    }
  }

  async function handlePrimary() {
    setError("");

    if (!canContinue()) {
      setError("Completá este paso para continuar.");
      return;
    }

    if (screenKey === "intro") {
      onNext();
      return;
    }

    // último paso de Basics: guardar primero y pasar a Goal
if (screenKey === "tdee") {
  setLoading(true);

  try {
    const kcal =
      form.tdeeCustom != null
        ? Number(form.tdeeCustom)
        : Number(form.tdeeEstimado);

    await patchStep1({ tdeeEstimado: kcal });

    const me = await apiFetch("/api/usuarios/auth/me", { method: "GET" });
    const user = me?.user || me;
    if (user) setAuthLogged(user);

    nav("/app/onboarding/goal", { replace: true });
    return;
  } catch (e) {
    setError(e?.message || "No se pudo guardar. Probá de nuevo.");
    setLoading(false);
  }

  return;
}


    // pasos intermedios: avanzar primero, guardar después
    onNext();
    saveCurrentStepInBackground();
  }

  const showBack = screenKey !== "intro";

  return (
    <>
      {error ? (
        <div className="ob2-inline-error" role="alert">
          {error}
        </div>
      ) : null}

      {showBack ? (
        <div className="ob2-row2">
          <button
            className="ob2-btn ghost"
            type="button"
            onClick={onBack}
            disabled={loading}
          >
            <ArrowLeft size={18} strokeWidth={2.3} aria-hidden="true" />
            <span>Atrás</span>
          </button>

          <button
            className="ob2-btn primary"
            type="button"
            onClick={handlePrimary}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <><LoaderCircle className="ob2-btn-spinner" size={18} aria-hidden="true" /> Guardando…</>
            ) : (
              <>Continuar <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" /></>
            )}
          </button>
        </div>
      ) : (
        <button
          className="ob2-btn primary"
          type="button"
          onClick={handlePrimary}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <><LoaderCircle className="ob2-btn-spinner" size={18} aria-hidden="true" /> Preparando…</>
          ) : (
            <>Empezar <ArrowRight size={18} strokeWidth={2.3} aria-hidden="true" /></>
          )}
        </button>
      )}
    </>
  );
}
