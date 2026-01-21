// src/OnboardingCliente.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./Api";
import { setAuthLogged } from "./authCache";

const OBJETIVOS = [
  { value: "masa", label: "Ganar masa muscular", sub: "Fuerza + superávit controlado" },
  { value: "definicion", label: "Perder grasa", sub: "Déficit + preservación muscular" },
  { value: "mantenimiento", label: "Mantenimiento", sub: "Balance y consistencia" },
];

const DISTRIBUCIONES = [
  { value: "equilibrada", label: "Equilibrada", sub: "Reparte parejo entre comidas" },
  { value: "desayuno_fuerte", label: "Desayuno fuerte", sub: "Más calorías temprano" },
  { value: "cena_fuerte", label: "Cena fuerte", sub: "Más calorías al final del día" },
  { value: "custom", label: "Custom", sub: "Después lo afinás manualmente" },
];

const RESTRICCIONES = [
  { value: "vegano", label: "Vegano" },
  { value: "vegetariano", label: "Vegetariano" },
  { value: "sin_tacc", label: "Sin TACC" },
  { value: "sin_lactosa", label: "Sin lactosa" },
  { value: "keto", label: "Keto" },
  { value: "halal", label: "Halal" },
];

function toNum(v) {
  const n = Number(String(v ?? "").trim().replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function clampNum(v, min, max) {
  const n = toNum(v);
  if (n == null) return null;
  return Math.min(max, Math.max(min, n));
}

export default function OnboardingCliente() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);

  const progress = useMemo(() => {
    if (step === 1) return 34;
    if (step === 2) return 67;
    return 100;
  }, [step]);

  // -----------------
  // Step 1
  // -----------------
  const [alturaCm, setAlturaCm] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  const [grasaPct, setGrasaPct] = useState("");
  const [genero, setGenero] = useState("prefiero_no_decir");

  // -----------------
  // Step 2
  // -----------------
  const [objetivo, setObjetivo] = useState("masa");
  const [actividad, setActividad] = useState("1.55");
  const [diasEntreno, setDiasEntreno] = useState("3");

  // -----------------
  // Step 3 (preferenciasPlan)
  // -----------------
  const [comidasPorDia, setComidasPorDia] = useState("4"); // string para inputs/select
  const [distribucion, setDistribucion] = useState("equilibrada");

  const [weekendBoost, setWeekendBoost] = useState(false);
  const [weekendBoostPct, setWeekendBoostPct] = useState("10");

  const [restricciones, setRestricciones] = useState([]); // array of strings
  const [snackLibre, setSnackLibre] = useState(false);
  const [snackLibreKcal, setSnackLibreKcal] = useState("150");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const subtitle =
    step === 1
      ? "Decinos lo básico. Después lo podés ajustar cuando quieras."
      : step === 2
      ? "Elegí tu objetivo y nivel de actividad. Calculamos tus metas."
      : "Último paso: preferencias del plan (podés saltearlo).";

  function validateStep1() {
    const a = clampNum(alturaCm, 120, 230);
    const p = clampNum(pesoKg, 30, 250);
    const g = grasaPct.trim() === "" ? null : clampNum(grasaPct, 3, 70);

    if (a == null) return "Ingresá una altura válida (120–230 cm).";
    if (p == null) return "Ingresá un peso válido (30–250 kg).";
    if (grasaPct.trim() !== "" && g == null) return "El % graso debe ser 3–70 (o dejalo vacío).";
    return null;
  }

  function validateStep2() {
    const act = clampNum(actividad, 1.2, 2.2);
    const dias = clampNum(diasEntreno, 0, 7);
    if (!OBJETIVOS.some((o) => o.value === objetivo)) return "Elegí un objetivo válido.";
    if (act == null) return "Actividad debe ser un número entre 1.2 y 2.2.";
    if (dias == null) return "Días de entreno debe ser 0–7.";
    return null;
  }

  function validateStep3() {
    // Si no completa, igual puede apretar "Saltar" (ahí no validamos)
    const n = clampNum(comidasPorDia, 2, 6);
    if (n == null) return "Comidas por día debe ser entre 2 y 6.";

    if (!DISTRIBUCIONES.some((d) => d.value === distribucion)) {
      return "Distribución inválida.";
    }

    const w = clampNum(weekendBoostPct, 0, 30);
    if (weekendBoost && w == null) return "Weekend boost % debe ser 0–30.";

    const k = clampNum(snackLibreKcal, 0, 600);
    if (snackLibre && k == null) return "Snack libre kcal debe ser 0–600.";

    return null;
  }

  async function refreshMeAndGo() {
    const me = await apiFetch("/api/usuarios/auth/me", { method: "GET" });
    const user = me?.user || me;
    if (user) setAuthLogged(user);
    navigate("/app/inicio", { replace: true });
  }

  async function saveStep1() {
    const msg = validateStep1();
    if (msg) return setError(msg);

    setError("");
    setLoading(true);
    try {
      const payload = {
        step: 1,
        data: {
          alturaCm: Number(alturaCm),
          pesoKg: Number(pesoKg),
          grasaPct: grasaPct.trim() === "" ? null : Number(grasaPct),
          genero,
        },
      };

      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setStep(2);
    } catch (e) {
      console.log("ONBOARDING STEP1 ERROR:", e);
      setError(e?.error || e?.message || "No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Antes era "finish", ahora es "saveStep2" y te manda al step 3
  async function saveStep2() {
    const msg = validateStep2();
    if (msg) return setError(msg);

    setError("");
    setLoading(true);
    try {
      const payload = {
        step: 2,
        data: {
          objetivo,
          actividad: toNum(actividad),
          diasEntreno: toNum(diasEntreno),
        },
      };

      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      // ✅ en vez de ir a /app/inicio, pasamos al step 3
      setStep(3);
    } catch (e) {
      console.log("ONBOARDING STEP2 ERROR:", e);
      setError(e?.error || e?.message || "No se pudo finalizar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function skipStep3() {
    setError("");
    setLoading(true);
    try {
      const payload = { step: 3, data: { skip: true } };

      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      await refreshMeAndGo();
    } catch (e) {
      console.log("ONBOARDING STEP3 SKIP ERROR:", e);
      setError(e?.error || e?.message || "No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function finishStep3() {
    const msg = validateStep3();
    if (msg) return setError(msg);

    setError("");
    setLoading(true);
    try {
      const payload = {
        step: 3,
        data: {
          skip: false,
          comidasPorDia: Number(comidasPorDia),
          distribucion,
          weekendBoost,
          weekendBoostPct: weekendBoost ? Number(weekendBoostPct) : 0,
          restricciones,
          snackLibre,
          snackLibreKcal: snackLibre ? Number(snackLibreKcal) : 0,
        },
      };

      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      await refreshMeAndGo();
    } catch (e) {
      console.log("ONBOARDING STEP3 FINISH ERROR:", e);
      setError(e?.error || e?.message || "No se pudo finalizar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const nextDisabled = loading;

  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-neutral-100">
      {/* Glow fondo */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full blur-3xl opacity-30 bg-yellow-300/20" />
        <div className="absolute bottom-[-140px] right-[-100px] h-[320px] w-[320px] rounded-full blur-3xl opacity-25 bg-amber-200/15" />
      </div>

      <div className="relative px-4 pt-6 pb-28">
        <div className="mx-auto max-w-md">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-neutral-800 bg-neutral-900/40 px-3 py-1 text-xs text-neutral-200">
                <span className="h-2 w-2 rounded-full bg-amber-200 shadow-[0_0_12px_rgba(245,215,110,.4)]" />
                Setup inicial
              </div>

              <h1 className="mt-3 text-2xl font-extrabold tracking-tight">
                Tu plan en <span className="text-amber-200">1 minuto</span>
              </h1>
              <p className="text-neutral-300 mt-1 text-sm">{subtitle}</p>
            </div>

            <div className="shrink-0">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 px-3 py-2">
                <div className="text-[11px] text-neutral-300">Paso</div>
                <div className="text-lg font-extrabold leading-tight tabular-nums">
                  {step}
                  <span className="text-neutral-500">/3</span>
                </div>
              </div>
            </div>
          </div>

          {/* Card */}
          <div className="mt-5 rounded-3xl border border-neutral-800 bg-neutral-900/50 shadow-[0_16px_50px_rgba(0,0,0,.55)] overflow-hidden">
            {/* Top progress */}
            <div className="px-5 pt-5">
              <div className="flex items-center justify-between text-xs text-neutral-300">
                <span className="font-semibold">Progreso</span>
                <span className="tabular-nums">{progress}%</span>
              </div>

              <div className="mt-2 h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-200 to-yellow-100 transition-all duration-300 shadow-[0_0_18px_rgba(245,215,110,.25)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="px-5 pb-5 pt-4">
              {error ? (
                <div className="mb-4 rounded-2xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-200">
                  <div className="font-semibold">Ups…</div>
                  <div className="mt-1">{error}</div>
                </div>
              ) : null}

              {step === 1 ? (
                <div className="space-y-4">
                  <SectionTitle title="Datos físicos" sub="Con esto personalizamos tus cálculos." />

                  <Field label="Género">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { v: "masculino", l: "Masculino" },
                        { v: "femenino", l: "Femenino" },
                        { v: "no_binario", l: "No binario" },
                        { v: "prefiero_no_decir", l: "Prefiero no decir" },
                      ].map((g) => (
                        <button
                          key={g.v}
                          type="button"
                          onClick={() => setGenero(g.v)}
                          className={[
                            "rounded-xl border px-3 py-3 text-left",
                            genero === g.v ? "border-white bg-neutral-950" : "border-neutral-800 bg-neutral-950/40",
                          ].join(" ")}
                        >
                          <div className="font-semibold">{g.l}</div>
                        </button>
                      ))}
                    </div>
                  </Field>

                  <Field label="Altura" hint="cm">
                    <Input
                      icon={<IconRuler />}
                      inputMode="numeric"
                      placeholder="Ej: 178"
                      value={alturaCm}
                      onChange={(e) => setAlturaCm(e.target.value)}
                      disabled={loading}
                    />
                  </Field>

                  <Field label="Peso" hint="kg">
                    <Input
                      icon={<IconWeight />}
                      inputMode="decimal"
                      placeholder="Ej: 82.5"
                      value={pesoKg}
                      onChange={(e) => setPesoKg(e.target.value)}
                      disabled={loading}
                    />
                  </Field>

                  <Field label="% Graso (opcional)" hint="%">
                    <Input
                      icon={<IconDrop />}
                      inputMode="decimal"
                      placeholder="Ej: 15 (o vacío)"
                      value={grasaPct}
                      onChange={(e) => setGrasaPct(e.target.value)}
                      disabled={loading}
                    />
                  </Field>
                </div>
              ) : step === 2 ? (
                <div className="space-y-4">
                  <SectionTitle title="Objetivo y actividad" sub="Ajustamos tu plan según tu vida real." />

                  <Field label="Objetivo">
                    <div className="grid gap-2">
                      {OBJETIVOS.map((o) => {
                        const active = objetivo === o.value;
                        return (
                          <button
                            key={o.value}
                            type="button"
                            onClick={() => setObjetivo(o.value)}
                            disabled={loading}
                            className={[
                              "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                              active
                                ? "border-amber-200/60 bg-neutral-950 shadow-[0_0_0_3px_rgba(245,215,110,.10)]"
                                : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-bold">{o.label}</div>
                              {active ? (
                                <span className="text-xs rounded-full bg-amber-200 text-black px-2 py-0.5 font-extrabold">
                                  Elegido
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-neutral-400 mt-1">{o.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field
                    label="Factor de actividad"
                    hint="1.2–2.2"
                    helper="1.2 sedentario • 1.55 moderado • 1.75 muy activo"
                  >
                    <Input
                      icon={<IconBolt />}
                      inputMode="decimal"
                      placeholder="Ej: 1.55"
                      value={actividad}
                      onChange={(e) => setActividad(e.target.value)}
                      disabled={loading}
                    />
                  </Field>

                  <Field label="Días de entreno / semana" hint="0–7">
                    <Input
                      icon={<IconCalendar />}
                      inputMode="numeric"
                      placeholder="Ej: 3"
                      value={diasEntreno}
                      onChange={(e) => setDiasEntreno(e.target.value)}
                      disabled={loading}
                    />
                  </Field>
                </div>
              ) : (
                <div className="space-y-4">
                  <SectionTitle title="Preferencias del plan" sub="Esto mejora la generación del menú (opcional)." />

                  <Field label="Comidas por día" hint="2–6">
                    <Select
                      value={comidasPorDia}
                      onChange={(e) => setComidasPorDia(e.target.value)}
                      disabled={loading}
                      icon={<IconFork />}
                      options={[
                        { value: "2", label: "2 comidas" },
                        { value: "3", label: "3 comidas" },
                        { value: "4", label: "4 comidas" },
                        { value: "5", label: "5 comidas" },
                        { value: "6", label: "6 comidas" },
                      ]}
                    />
                  </Field>

                  <Field label="Distribución del día">
                    <div className="grid gap-2">
                      {DISTRIBUCIONES.map((d) => {
                        const active = distribucion === d.value;
                        return (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => setDistribucion(d.value)}
                            disabled={loading}
                            className={[
                              "rounded-2xl border px-4 py-3 text-left transition active:scale-[0.99]",
                              active
                                ? "border-amber-200/60 bg-neutral-950 shadow-[0_0_0_3px_rgba(245,215,110,.10)]"
                                : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-700",
                            ].join(" ")}
                          >
                            <div className="flex items-center justify-between">
                              <div className="font-bold">{d.label}</div>
                              {active ? (
                                <span className="text-xs rounded-full bg-amber-200 text-black px-2 py-0.5 font-extrabold">
                                  Elegido
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-neutral-400 mt-1">{d.sub}</div>
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Weekend boost" helper="Sube calorías el finde (si te cuesta cumplir).">
                    <div className="flex gap-2">
                      <ToggleButton
                        active={weekendBoost}
                        onClick={() => setWeekendBoost(true)}
                        disabled={loading}
                        label="Activado"
                      />
                      <ToggleButton
                        active={!weekendBoost}
                        onClick={() => setWeekendBoost(false)}
                        disabled={loading}
                        label="No"
                      />
                    </div>

                    {weekendBoost ? (
                      <div className="mt-2">
                        <Field label="Boost %" hint="0–30">
                          <Input
                            icon={<IconPercent />}
                            inputMode="numeric"
                            placeholder="Ej: 10"
                            value={weekendBoostPct}
                            onChange={(e) => setWeekendBoostPct(e.target.value)}
                            disabled={loading}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </Field>

                  <Field label="Restricciones" helper="Elegí las que aplican (opcional).">
                    <div className="flex flex-wrap gap-2">
                      {RESTRICCIONES.map((r) => {
                        const active = restricciones.includes(r.value);
                        return (
                          <button
                            key={r.value}
                            type="button"
                            disabled={loading}
                            onClick={() => {
                              setRestricciones((prev) => {
                                if (prev.includes(r.value)) return prev.filter((x) => x !== r.value);
                                return [...prev, r.value];
                              });
                            }}
                            className={[
                              "rounded-full border px-3 py-2 text-xs font-bold transition",
                              active
                                ? "border-amber-200/60 bg-amber-200 text-black"
                                : "border-neutral-800 bg-neutral-950/40 text-neutral-200 hover:border-neutral-700",
                            ].join(" ")}
                          >
                            {r.label}
                          </button>
                        );
                      })}
                    </div>
                  </Field>

                  <Field label="Snack libre" helper="Te deja un snack fijo (útil para antojos).">
                    <div className="flex gap-2">
                      <ToggleButton
                        active={snackLibre}
                        onClick={() => setSnackLibre(true)}
                        disabled={loading}
                        label="Sí"
                      />
                      <ToggleButton
                        active={!snackLibre}
                        onClick={() => setSnackLibre(false)}
                        disabled={loading}
                        label="No"
                      />
                    </div>

                    {snackLibre ? (
                      <div className="mt-2">
                        <Field label="Kcal del snack" hint="0–600">
                          <Input
                            icon={<IconFire />}
                            inputMode="numeric"
                            placeholder="Ej: 150"
                            value={snackLibreKcal}
                            onChange={(e) => setSnackLibreKcal(e.target.value)}
                            disabled={loading}
                          />
                        </Field>
                      </div>
                    ) : null}
                  </Field>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs text-neutral-400 mt-4">
            * Se usa para personalizar tus metas. Lo podés cambiar en Ajustes.
          </p>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-950/85 backdrop-blur border-t border-neutral-800">
        <div className="mx-auto max-w-md px-4 py-3">
          <div className="flex items-center justify-between text-xs text-neutral-300 mb-2">
            <span>Paso {step} de 3</span>
            <span className="tabular-nums">{progress}%</span>
          </div>

          {step === 1 ? (
            <button
              disabled={nextDisabled}
              onClick={saveStep1}
              className="w-full rounded-2xl bg-gradient-to-r from-amber-200 to-yellow-100 text-black font-extrabold py-3 shadow-[0_10px_30px_rgba(0,0,0,.45)] active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Siguiente"}
            </button>
          ) : step === 2 ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep(1)}
                className="w-1/3 rounded-2xl border border-neutral-800 bg-neutral-950/30 py-3 font-extrabold text-neutral-100 active:scale-[0.99] disabled:opacity-60"
              >
                Atrás
              </button>
              <button
                disabled={loading}
                onClick={saveStep2}
                className="w-2/3 rounded-2xl bg-gradient-to-r from-amber-200 to-yellow-100 text-black font-extrabold py-3 shadow-[0_10px_30px_rgba(0,0,0,.45)] active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "Guardando..." : "Siguiente"}
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={() => setStep(2)}
                className="w-1/3 rounded-2xl border border-neutral-800 bg-neutral-950/30 py-3 font-extrabold text-neutral-100 active:scale-[0.99] disabled:opacity-60"
              >
                Atrás
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={skipStep3}
                className="w-1/3 rounded-2xl border border-neutral-800 bg-neutral-950/30 py-3 font-extrabold text-neutral-100 active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "..." : "Saltar"}
              </button>

              <button
                disabled={loading}
                onClick={finishStep3}
                className="w-1/3 rounded-2xl bg-gradient-to-r from-amber-200 to-yellow-100 text-black font-extrabold py-3 shadow-[0_10px_30px_rgba(0,0,0,.45)] active:scale-[0.99] disabled:opacity-60"
              >
                {loading ? "Finalizando..." : "Finalizar"}
              </button>
            </div>
          )}

          <div className="mt-3 h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full rounded-full bg-white/90 transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ title, sub }) {
  return (
    <div>
      <div className="text-lg font-extrabold">{title}</div>
      {sub ? <div className="text-xs text-neutral-400 mt-0.5">{sub}</div> : null}
    </div>
  );
}

function Field({ label, hint, helper, children }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-sm font-semibold text-neutral-200">
          {label} {hint ? <span className="text-neutral-500 font-normal">({hint})</span> : null}
        </label>
      </div>
      {children}
      {helper ? <div className="text-[11px] text-neutral-500">{helper}</div> : null}
    </div>
  );
}

function Input({ icon, ...props }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-neutral-950 border border-neutral-800 px-3 py-3 focus-within:border-amber-200/60 focus-within:shadow-[0_0_0_3px_rgba(245,215,110,.10)] transition">
      <div className="text-amber-200/90">{icon}</div>
      <input className="w-full bg-transparent outline-none text-base placeholder:text-neutral-600" {...props} />
    </div>
  );
}

function Select({ icon, options, ...props }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-neutral-950 border border-neutral-800 px-3 py-3 focus-within:border-amber-200/60 focus-within:shadow-[0_0_0_3px_rgba(245,215,110,.10)] transition">
      <div className="text-amber-200/90">{icon}</div>
      <select className="w-full bg-transparent outline-none text-base" {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-neutral-950">
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleButton({ active, onClick, disabled, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex-1 rounded-2xl border px-4 py-3 text-center font-extrabold transition active:scale-[0.99] disabled:opacity-60",
        active ? "border-amber-200/60 bg-amber-200 text-black" : "border-neutral-800 bg-neutral-950/40 text-neutral-100",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

/* --- tiny icons --- */
function IconRuler() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M7 7v4M11 7v2M15 7v4M19 7v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 17h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
function IconWeight() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 7a5 5 0 0 1 10 0" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M6 7h12l2 14H4L6 7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IconDrop() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2s7 7.2 7 12a7 7 0 1 1-14 0c0-4.8 7-12 7-12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconBolt() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M7 3v3M17 3v3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 8h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M6 5h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconFork() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 2v10M9 2v10M6 7h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 2v20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M16 2c2 0 3 2 3 4s-1 4-3 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
function IconPercent() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M19 5 5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M7 7h.01M17 17h.01" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
function IconFire() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 22c4 0 7-3 7-7 0-2.5-1.2-4.4-3-6-1 2-3 2-3 2s1-3-1-7C8 6 5 9 5 15c0 4 3 7 7 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
