// src/onboarding_v2/OnboardingWizard.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "../Api.js";
import { setAuthLogged, getCachedUser } from "../authCache.js";

import OnboardingLayout from "./OnboardingLayout.jsx";

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

import GoalPlaceholder from "./screens/GoalPlaceholder.jsx";
import ProgramPlaceholder from "./screens/ProgramPlaceholder.jsx";

const BASICS_SCREENS = [
  { key: "intro", component: IntroStart, title: "Onboarding", subtitle: "Tu plan en 1 minuto" },

  { key: "sex", component: BasicsSex, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "birth", component: BasicsBirth, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "height", component: BasicsHeight, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "weight", component: BasicsWeight, title: "Básicos", subtitle: "Datos iniciales" },

  // ✅ NUEVO (va después del peso)
  { key: "bodyfat", component: BasicsBodyFat, title: "Básicos", subtitle: "Datos iniciales" },

  { key: "trend", component: BasicsWeightTrend, title: "Básicos", subtitle: "Datos iniciales" },
  { key: "exercise", component: BasicsExerciseFreq, title: "Básicos", subtitle: "Actividad" },
  { key: "daily", component: BasicsDailyActivity, title: "Básicos", subtitle: "Actividad" },
  { key: "exp", component: BasicsExperience, title: "Básicos", subtitle: "Entrenamiento" },
  { key: "tdee", component: BasicsTDEE, title: "Básicos", subtitle: "Estimación" },
];

export default function OnboardingWizard({ startAt = "basics" }) {
  const nav = useNavigate();
  const loc = useLocation();

  // datos acumulados (se van guardando en backend paso a paso)
  const [form, setForm] = useState({
    sexo: "",
    fechaNacimiento: "",
    alturaCm: 170,
    pesoKg: 75,

    // ✅ NUEVO: % graso (string para inputs)
    grasaPct: "",

    tendenciaPeso: "",
    frecuenciaEjercicio: "",
    actividadDiaria: "",
    experienciaPesas: "",
    tdeeEstimado: null,
    tdeeCustom: null,
  });

  // qué “sección” mostrar (basics/goal/program)
  const section = useMemo(() => {
    const p = (loc.pathname || "").toLowerCase();
    if (startAt === "goal" || p.includes("/onboarding/goal")) return "goal";
    if (startAt === "program" || p.includes("/onboarding/program")) return "program";
    return "basics";
  }, [loc.pathname, startAt]);

  // índice para BASICS
  const [i, setI] = useState(() => 0);

  const isBasics = section === "basics";
  const screen = isBasics ? BASICS_SCREENS[i] : null;

  const progressPct = useMemo(() => {
    if (!isBasics) return section === "goal" ? 67 : 100;
    if (i === 0) return 8;
    const basicsCount = BASICS_SCREENS.length - 1; // sin intro
    const idx = Math.max(1, i) - 1;
    return Math.round(((idx + 1) / basicsCount) * 100);
  }, [isBasics, i, section]);

  // ✅ Retomar donde quedó (por onboarding.step en DB/cache)
  useEffect(() => {
    const u = getCachedUser?.();
    const savedStep = Number(u?.onboarding?.step || 1);
    const done = Boolean(u?.onboarding?.done);

    if (done) return;

    const path = (loc.pathname || "").toLowerCase();

    // solo retomar si estamos entrando al root /app/onboarding (o basics)
    const isRootBasics =
      path === "/app/onboarding" ||
      path === "/app/onboarding/" ||
      (section === "basics" && !path.includes("/onboarding/goal") && !path.includes("/onboarding/program"));

    if (!isRootBasics) return;

    if (savedStep >= 3) {
      nav("/app/onboarding/program", { replace: true });
      return;
    }
    if (savedStep >= 2) {
      nav("/app/onboarding/goal", { replace: true });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  async function patchStep1(partialData) {
    const payload = { step: 1, data: partialData };
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
  }

  async function finishOnboardingAndGoHome() {
    // ✅ tu backend Step 3 usa "skip" (en placeholder)
    await apiFetch("/api/usuarios/me/onboarding", {
      method: "PATCH",
      body: JSON.stringify({ step: 3, data: { skip: true } }),
    });

    const me = await apiFetch("/api/usuarios/auth/me", { method: "GET" });
    const user = me?.user || me;
    if (user) setAuthLogged(user);

    nav("/app/inicio", { replace: true });
  }

  function back() {
    if (section === "goal") return nav("/app/onboarding", { replace: true });
    if (section === "program") return nav("/app/onboarding/goal", { replace: true });

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

  // GOAL
  if (section === "goal") {
    return (
      <OnboardingLayout
        title="Objetivo"
        subtitle="Próximo módulo"
        progressPct={progressPct}
        onBack={() => nav("/app/onboarding", { replace: true })}
        footer={null}
      >
        <GoalPlaceholder onGoProgram={() => nav("/app/onboarding/program", { replace: true })} />
      </OnboardingLayout>
    );
  }

  // PROGRAM
  if (section === "program") {
    return (
      <OnboardingLayout
        title="Programa"
        subtitle="Próximo módulo"
        progressPct={progressPct}
        onBack={() => nav("/app/onboarding/goal", { replace: true })}
        footer={null}
      >
        <ProgramPlaceholder onFinish={finishOnboardingAndGoHome} />
      </OnboardingLayout>
    );
  }

  // BASICS
  if (!screen) return null;
  const ScreenComp = screen.component;

  return (
    <OnboardingLayout
      title={screen.title}
      subtitle={screen.subtitle}
      progressPct={progressPct}
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
          <div className="ob2-mini">{isBasics ? "Básicos → Objetivo → Programa" : ""}</div>
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
    if (screenKey === "birth") return !!form.fechaNacimiento;

    // ✅ BodyFat: lo dejamos opcional (podés hacerlo obligatorio si querés)
    // si querés obligatorio: return String(form.grasaPct).trim() !== "";
    if (screenKey === "bodyfat") return true;

    if (screenKey === "trend") return !!form.tendenciaPeso;
    if (screenKey === "exercise") return !!form.frecuenciaEjercicio;
    if (screenKey === "daily") return !!form.actividadDiaria;
    if (screenKey === "exp") return !!form.experienciaPesas;

    return true;
  }

  async function handlePrimary() {
    setError("");
    if (!canContinue()) {
      setError("Completá este paso para continuar.");
      return;
    }

    setLoading(true);
    try {
      if (screenKey === "intro") {
        onNext();
        return;
      }

      if (screenKey === "sex") await patchStep1({ sexo: form.sexo });
      if (screenKey === "birth") await patchStep1({ fechaNacimiento: form.fechaNacimiento });
      if (screenKey === "height") await patchStep1({ alturaCm: Number(form.alturaCm) });
      if (screenKey === "weight") await patchStep1({ pesoKg: Number(form.pesoKg) });

      // ✅ NUEVO: guardar grasaPct (null si vacío)
      if (screenKey === "bodyfat") {
        const raw = String(form.grasaPct ?? "").trim();
        const val = raw === "" ? null : Number(raw);
        await patchStep1({ grasaPct: val });
      }

      if (screenKey === "trend") await patchStep1({ tendenciaPeso: form.tendenciaPeso });
      if (screenKey === "exercise") await patchStep1({ frecuenciaEjercicio: form.frecuenciaEjercicio });
      if (screenKey === "daily") await patchStep1({ actividadDiaria: form.actividadDiaria });
      if (screenKey === "exp") await patchStep1({ experienciaPesas: form.experienciaPesas });

      if (screenKey === "tdee") {
        const kcal = form.tdeeCustom != null ? Number(form.tdeeCustom) : Number(form.tdeeEstimado);
        await patchStep1({ tdeeEstimado: kcal });

        // ✅ refrescar /me para que cache tenga onboarding.step actualizado
        const me = await apiFetch("/api/usuarios/auth/me", { method: "GET" });
        const user = me?.user || me;
        if (user) setAuthLogged(user);

        nav("/app/onboarding/goal", { replace: true });
        return;
      }

      onNext();
    } catch (e) {
      setError(e?.message || "No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const showBack = screenKey !== "intro";

  return (
    <>
      {error ? <div style={{ color: "#ffd9a1", fontSize: 12, textAlign: "center" }}>{error}</div> : null}

      {showBack ? (
        <div className="ob2-row2">
          <button className="ob2-btn ghost" type="button" onClick={onBack} disabled={loading}>
            Atrás
          </button>
          <button className="ob2-btn primary" type="button" onClick={handlePrimary} disabled={loading}>
            {loading ? "Guardando…" : "Siguiente"}
          </button>
        </div>
      ) : (
        <button className="ob2-btn primary" type="button" onClick={handlePrimary} disabled={loading}>
          {loading ? "…" : "Ir a Básicos"}
        </button>
      )}
    </>
  );
}