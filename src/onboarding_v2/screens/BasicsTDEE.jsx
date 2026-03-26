// src/onboarding_v2/screens/BasicsTDEE.jsx
import React, { useMemo, useState, useEffect } from "react";

function yearsOld(dateStr) {
  try {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return Math.max(0, age);
  } catch {
    return null;
  }
}

/**
 * BMR: Mifflin-St Jeor
 * - Hombre: 10W + 6.25H - 5A + 5
 * - Mujer : 10W + 6.25H - 5A - 161
 */
function bmrMifflin({ sexo, edad, alturaCm, pesoKg }) {
  const s = sexo === "masculino" ? 5 : sexo === "femenino" ? -161 : 0;
  return 10 * pesoKg + 6.25 * alturaCm - 5 * edad + s;
}

/**
 * BMR: Harris-Benedict (Revised 1984)
 * - Hombre: 88.362 + 13.397W + 4.799H - 5.677A
 * - Mujer : 447.593 + 9.247W + 3.098H - 4.330A
 */
function bmrHarrisBenedict({ sexo, edad, alturaCm, pesoKg }) {
  if (sexo === "masculino") {
    return 88.362 + 13.397 * pesoKg + 4.799 * alturaCm - 5.677 * edad;
  }
  if (sexo === "femenino") {
    return 447.593 + 9.247 * pesoKg + 3.098 * alturaCm - 4.33 * edad;
  }
  // si no hay sexo, usamos una media aproximada (promedio de ambas constantes y coeficientes)
  // para no romper UX; es mejor pedir sexo, pero esto evita NaN
  return 268.0 + 11.322 * pesoKg + 3.95 * alturaCm - 5.0 * edad;
}

function activityFactor({ actividadDiaria, frecuenciaEjercicio }) {
  const base =
    actividadDiaria === "muy_activo" ? 1.65 :
    actividadDiaria === "moderado" ? 1.45 :
    1.2;

  const extra =
    frecuenciaEjercicio === "7_plus" ? 0.30 :
    frecuenciaEjercicio === "4_6" ? 0.20 :
    frecuenciaEjercicio === "1_3" ? 0.10 :
    0;

  return Math.min(2.2, Math.max(1.2, base + extra));
}

/**
 * Opción A:
 * - Calcular BMR por Mifflin y por Harris-Benedict (1984)
 * - Promediar ambos BMR
 * - Aplicar factor de actividad
 */
function calcTDEE_A(form) {
  const edad = yearsOld(form.fechaNacimiento) ?? 30;
  const alturaCm = Number(form.alturaCm || 170);
  const pesoKg = Number(form.pesoKg || 75);

  const mif = bmrMifflin({ sexo: form.sexo, edad, alturaCm, pesoKg });
  const hb = bmrHarrisBenedict({ sexo: form.sexo, edad, alturaCm, pesoKg });

  const bmrAvg = (mif + hb) / 2;
  const factor = activityFactor(form);

  return Math.round(bmrAvg * factor);
}

export default function BasicsTDEE({ form, setForm }) {
  const [editing, setEditing] = useState(false);

  const tdee = useMemo(() => calcTDEE_A(form), [form]);

  // ✅ Setear en estado para que ScreenFooter lo mande al backend en step 1 (tdee)
  useEffect(() => {
    setForm((p) => ({ ...p, tdeeEstimado: tdee }));
  }, [tdee, setForm]);

  const shown = form.tdeeCustom != null ? Number(form.tdeeCustom) : tdee;

  return (
    <>
      <h2 className="ob2-h2">Estimación de calorías</h2>
      <p className="ob2-p">
        Según tus respuestas, esto es lo que quema tu cuerpo por día (mantenimiento).
      </p>

      <div className="ob2-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          <div style={{ fontSize: 34, fontWeight: 1000 }}>
            {shown} <span style={{ color: "#bdbdbd", fontSize: 16 }}>kcal</span>
          </div>

          <button
            type="button"
            className="ob2-btn ghost"
            style={{ width: "auto", padding: "10px 12px" }}
            onClick={() => setEditing((v) => !v)}
            title="Editar"
          >
            ✎
          </button>
        </div>

        {editing ? (
          <div style={{ marginTop: 12 }}>
            <input
              className="ob2-input"
              inputMode="numeric"
              placeholder="Ej: 2400"
              value={form.tdeeCustom ?? ""}
              onChange={(e) => {
                const raw = e.target.value.replace(/\D/g, "");
                setForm((p) => ({ ...p, tdeeCustom: raw === "" ? null : Number(raw) }));
              }}
            />
            <p className="ob2-p" style={{ marginTop: 8, fontSize: 12 }}>
              Si no estás seguro, dejalo como está.
            </p>
          </div>
        ) : null}

        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 16,
            border: "1px solid #2b2b2b",
            background: "#0b0b0b",
          }}
        >
          <p style={{ margin: 0, color: "#eaeaea", fontWeight: 900 }}>¿Cómo lo calculamos?</p>
          <p style={{ margin: "8px 0 0", color: "#bdbdbd", fontSize: 13, lineHeight: 1.45 }}>
            Promediamos dos ecuaciones estándar (Mifflin-St Jeor y Harris-Benedict) y aplicamos tu nivel
            de actividad según lo que elegiste.
          </p>
        </div>
      </div>

      <p className="ob2-p" style={{ marginTop: 12, fontSize: 12 }}>
        Podés saltar este paso si preferís que lo complete tu coach/admin después.
      </p>
    </>
  );
}
