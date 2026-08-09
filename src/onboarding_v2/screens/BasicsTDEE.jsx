import React, { useEffect, useState } from "react";

import { previewClientNutrition } from "../../clientGoals/clientGoalsApi.js";

export default function BasicsTDEE({ form, setForm }) {
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setPreviewError("");
      try {
        const next = await previewClientNutrition({
          purpose: "maintenance",
          data: {
            fechaNacimiento: form.fechaNacimiento,
            sexo: form.sexo,
            alturaCm: form.alturaCm,
            pesoKg: form.pesoKg,
            actividadDiaria: form.actividadDiaria,
            frecuenciaEjercicio: form.frecuenciaEjercicio,
          },
        });
        if (!active) return;
        setPreview(next);
        if (next?.ready && Number.isFinite(Number(next.maintenanceKcal))) {
          setForm((current) => ({ ...current, tdeeEstimado: Number(next.maintenanceKcal) }));
        }
      } catch (error) {
        if (active) setPreviewError(error?.message || "No pudimos calcular tu mantenimiento.");
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [form.actividadDiaria, form.alturaCm, form.fechaNacimiento, form.frecuenciaEjercicio, form.pesoKg, form.sexo, setForm]);

  const shown = form.tdeeCustom != null
    ? Number(form.tdeeCustom)
    : Number(preview?.maintenanceKcal ?? form.tdeeEstimado);

  return (
    <>
      <h2 className="ob2-h2">Estimación de calorías</h2>
      <p className="ob2-p">
        Según tus respuestas, esto es lo que quema tu cuerpo por día (mantenimiento).
      </p>

      <div className="ob2-card">
        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
          <div style={{ fontSize: 34, fontWeight: 1000 }}>
            {Number.isFinite(shown) && shown > 0 ? shown : "—"}{" "}
            <span style={{ color: "#bdbdbd", fontSize: 16 }}>kcal</span>
          </div>

          <button
            type="button"
            className="ob2-btn ghost"
            style={{ width: "auto", padding: "10px 12px" }}
            onClick={() => setEditing((value) => !value)}
            aria-label="Editar calorías de mantenimiento"
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
              aria-label="Calorías de mantenimiento personalizadas"
              placeholder="Ej: 2400"
              value={form.tdeeCustom ?? ""}
              onChange={(event) => {
                const raw = event.target.value.replace(/\D/g, "");
                setForm((current) => ({ ...current, tdeeCustom: raw === "" ? null : Number(raw) }));
              }}
            />
            <p className="ob2-p" style={{ marginTop: 8, fontSize: 12 }}>
              Si no estás seguro, dejalo como está.
            </p>
          </div>
        ) : null}

        {loading ? <p className="ob2-p" style={{ marginTop: 8, fontSize: 12 }}>Calculando con tus datos...</p> : null}
        {!loading && preview?.ready === false ? (
          <p className="ob2-p" style={{ marginTop: 8, fontSize: 12 }}>
            Faltan: {(preview.missingFields || []).join(", ")}.
          </p>
        ) : null}
        {previewError ? <p className="ob2-p" style={{ marginTop: 8, fontSize: 12 }}>{previewError}</p> : null}

        <div style={{ marginTop: 14, padding: 12, borderRadius: 16, border: "1px solid #2b2b2b", background: "#0b0b0b" }}>
          <p style={{ margin: 0, color: "#eaeaea", fontWeight: 900 }}>¿Cómo lo calculamos?</p>
          <p style={{ margin: "8px 0 0", color: "#bdbdbd", fontSize: 13, lineHeight: 1.45 }}>
            Usamos la misma calculadora segura de ZumaFit: promedio de Mifflin-St Jeor y Harris-Benedict,
            aplicado a tu factor de actividad.
          </p>
        </div>
      </div>

      <p className="ob2-p" style={{ marginTop: 12, fontSize: 12 }}>
        Podés completar un valor personalizado o volver atrás para revisar los datos faltantes.
      </p>
    </>
  );
}
