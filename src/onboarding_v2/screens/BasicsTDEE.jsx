import React, { useMemo, useState } from "react";

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

function calcTDEE({ sexo, fechaNacimiento, alturaCm, pesoKg, actividadDiaria, frecuenciaEjercicio }) {
  const age = yearsOld(fechaNacimiento) ?? 30;
  const cm = Number(alturaCm || 170);
  const kg = Number(pesoKg || 75);

  // Mifflin St-Jeor
  const s = sexo === "masculino" ? 5 : sexo === "femenino" ? -161 : 0;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + s;

  const base =
    actividadDiaria === "muy_activo" ? 1.65 :
    actividadDiaria === "moderado" ? 1.45 :
    1.2;

  const extra =
    frecuenciaEjercicio === "7_plus" ? 0.30 :
    frecuenciaEjercicio === "4_6" ? 0.20 :
    frecuenciaEjercicio === "1_3" ? 0.10 :
    0;

  const factor = Math.min(2.2, Math.max(1.2, base + extra));
  return Math.round(bmr * factor);
}

export default function BasicsTDEE({ form, setForm }) {
  const [editing, setEditing] = useState(false);

  const tdee = useMemo(() => {
    const v = calcTDEE(form);
    return v;
  }, [form]);

  // guardo calculado en state por si querés mostrarlo en pantallas siguientes
  useMemo(() => {
    setForm((p) => ({ ...p, tdeeEstimado: tdee }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tdee]);

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

        <div style={{ marginTop: 14, padding: 12, borderRadius: 16, border: "1px solid #2b2b2b", background: "#0b0b0b" }}>
          <p style={{ margin: 0, color: "#eaeaea", fontWeight: 900 }}>¿Cómo lo calculamos?</p>
          <p style={{ margin: "8px 0 0", color: "#bdbdbd", fontSize: 13, lineHeight: 1.45 }}>
            Usamos una ecuación estándar que considera altura, peso, edad, sexo y actividad.
          </p>
        </div>
      </div>

      <p className="ob2-p" style={{ marginTop: 12, fontSize: 12 }}>
        Podés saltar este paso si preferís que lo complete tu coach/admin después.
      </p>
    </>
  );
}