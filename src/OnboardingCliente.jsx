// src/pages/OnboardingCliente.jsx
import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js"
import { setAuthLogged } from "./authCache.js"; // ✅ AGREGAR

const OBJETIVOS = [
  { value: "masa", label: "Ganar masa muscular" },
  { value: "definicion", label: "Perder grasa" },
  { value: "mantenimiento", label: "Mantenimiento" },
];

function clampNum(v, min, max) {
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.min(max, Math.max(min, n));
}

export default function OnboardingCliente() {
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const progress = useMemo(() => (step === 1 ? 50 : 100), [step]);

  // Step 1
  const [alturaCm, setAlturaCm] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  const [grasaPct, setGrasaPct] = useState("");

  // Step 2
  const [objetivo, setObjetivo] = useState("masa");
  const [actividad, setActividad] = useState("1.55");
  const [diasEntreno, setDiasEntreno] = useState("3");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
        },
      };

      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      setStep(2);
    } catch (e) {
      setError(e?.message || "No se pudo guardar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function finish() {
    const msg = validateStep2();
    if (msg) return setError(msg);

    setError("");
    setLoading(true);
    try {
      const payload = {
        step: 2,
        data: {
          objetivo,
          actividad: Number(actividad),
          diasEntreno: Number(diasEntreno),
        },
      };

      await apiFetch("/api/usuarios/me/onboarding", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      // ✅ refrescar /me y actualizar cache (evita rebote a onboarding)
      const me = await apiFetch("/api/usuarios/auth/me", { method: "GET" });
      const user = me?.user || me;
      if (user) setAuthLogged(user);

      // ✅ tu home cliente real es /app/inicio
      navigate("/app/inicio", { replace: true });
    } catch (e) {
      setError(e?.message || "No se pudo finalizar. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // ...el resto de tu JSX queda igual
  return (
    <div className="min-h-[100dvh] bg-neutral-950 text-neutral-100 flex flex-col">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="max-w-md mx-auto">
          <h1 className="text-2xl font-semibold">Tu plan en 1 minuto</h1>
          <p className="text-neutral-300 mt-1 text-sm">
            Respondé estas 2 cosas y listo. Podés editarlo después.
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pb-28">
        <div className="max-w-md mx-auto">
          <div className="rounded-2xl bg-neutral-900/60 border border-neutral-800 shadow-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-neutral-300">Paso {step} de 2</span>
              <span className="text-sm text-neutral-300">{progress}%</span>
            </div>

            {error ? (
              <div className="mb-3 rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
                {error}
              </div>
            ) : null}

            {step === 1 ? (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Datos físicos</h2>

                <Field label="Altura (cm)">
                  <input
                    inputMode="numeric"
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-3 text-base outline-none focus:border-neutral-600"
                    placeholder="Ej: 178"
                    value={alturaCm}
                    onChange={(e) => setAlturaCm(e.target.value)}
                  />
                </Field>

                <Field label="Peso (kg)">
                  <input
                    inputMode="decimal"
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-3 text-base outline-none focus:border-neutral-600"
                    placeholder="Ej: 82.5"
                    value={pesoKg}
                    onChange={(e) => setPesoKg(e.target.value)}
                  />
                </Field>

                <Field label="% Graso (opcional)">
                  <input
                    inputMode="decimal"
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-3 text-base outline-none focus:border-neutral-600"
                    placeholder="Ej: 15 (o dejalo vacío)"
                    value={grasaPct}
                    onChange={(e) => setGrasaPct(e.target.value)}
                  />
                </Field>

                <button
                  disabled={loading}
                  onClick={saveStep1}
                  className="w-full rounded-xl bg-white text-black font-semibold py-3 active:scale-[0.99] disabled:opacity-60"
                >
                  {loading ? "Guardando..." : "Continuar"}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold">Objetivo y actividad</h2>

                <Field label="Objetivo">
                  <div className="grid grid-cols-1 gap-2">
                    {OBJETIVOS.map((o) => (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setObjetivo(o.value)}
                        className={[
                          "rounded-xl border px-3 py-3 text-left",
                          objetivo === o.value ? "border-white bg-neutral-950" : "border-neutral-800 bg-neutral-950/40",
                        ].join(" ")}
                      >
                        <div className="font-semibold">{o.label}</div>
                      </button>
                    ))}
                  </div>
                </Field>

                <Field
                  label="Factor de actividad (1.2–2.2)"
                  hint="1.2 sedentario • 1.55 moderado • 1.75 muy activo"
                >
                  <input
                    inputMode="decimal"
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-3 text-base outline-none focus:border-neutral-600"
                    placeholder="Ej: 1.55"
                    value={actividad}
                    onChange={(e) => setActividad(e.target.value)}
                  />
                </Field>

                <Field label="Días de entreno por semana (0–7)">
                  <input
                    inputMode="numeric"
                    className="w-full rounded-xl bg-neutral-950 border border-neutral-800 px-3 py-3 text-base outline-none focus:border-neutral-600"
                    placeholder="Ej: 3"
                    value={diasEntreno}
                    onChange={(e) => setDiasEntreno(e.target.value)}
                  />
                </Field>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setStep(1)}
                    className="w-1/3 rounded-xl border border-neutral-800 bg-neutral-950/30 py-3 font-semibold disabled:opacity-60"
                  >
                    Atrás
                  </button>
                  <button
                    disabled={loading}
                    onClick={finish}
                    className="w-2/3 rounded-xl bg-white text-black font-semibold py-3 active:scale-[0.99] disabled:opacity-60"
                  >
                    {loading ? "Finalizando..." : "Finalizar"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-400 mt-4">
            * Esto se usa para personalizar tus metas. Podés cambiarlo cuando quieras.
          </p>
        </div>
      </div>

      {/* Sticky progress bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-neutral-950/90 backdrop-blur border-t border-neutral-800">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="h-2 w-full rounded-full bg-neutral-800 overflow-hidden">
            <div className="h-full bg-white transition-all" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between text-xs text-neutral-300 mt-2">
            <span>Paso {step} de 2</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <label className="text-sm text-neutral-200">{label}</label>
        {hint ? <span className="text-xs text-neutral-400">{hint}</span> : null}
      </div>
      {children}
    </div>
  );
}
