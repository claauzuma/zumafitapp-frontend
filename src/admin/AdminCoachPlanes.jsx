import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  updateAdminCoachPlanConfig,
  resetAdminCoachPlanConfig,
} from "./adminUsuariosApi.js";
import { useAdminCoachPlans } from "./adminUsuariosQueries.js";
import { invalidateAfterCoachPlansChange, queryKeys } from "../queryClient.js";

const FEATURE_SECTIONS = [
  {
    key: "clients",
    title: "Clientes",
    fields: [["canAssign", "Asignar clientes"], ["canViewProgress", "Ver progreso"]],
  },
  {
    key: "routines",
    title: "Rutinas",
    fields: [
      ["manualBuilder", "Armador manual"],
      ["librarySearch", "Biblioteca"],
      ["ownTemplates", "Plantillas propias"],
      ["duplicatePlans", "Duplicar planes"],
      ["semiAutomaticBuilder", "Armador semiautomatico"],
      ["automaticGenerator", "Generador automatico"],
    ],
    limitField: "ownTemplatesLimit",
  },
  {
    key: "menus",
    title: "Menus",
    fields: [
      ["manualBuilder", "Armador manual"],
      ["foodLibrarySearch", "Biblioteca alimentos"],
      ["menuLibrarySearch", "Biblioteca menus"],
      ["ownTemplates", "Plantillas propias"],
      ["duplicatePlans", "Duplicar planes"],
      ["semiAutomaticBuilder", "Armador semiautomatico"],
      ["automaticGenerator", "Generador automatico"],
    ],
    limitField: "ownTemplatesLimit",
  },
  {
    key: "metrics",
    title: "Metricas",
    fields: [["basic", "Basicas"], ["advanced", "Avanzadas"]],
  },
  {
    key: "exports",
    title: "Exportaciones",
    fields: [["enabled", "Exportaciones habilitadas"]],
  },
];

export default function AdminCoachPlanes() {
  const queryClient = useQueryClient();
  const plansQuery = useAdminCoachPlans();
  const plans = useMemo(
    () => (Array.isArray(plansQuery.data) ? plansQuery.data : []),
    [plansQuery.data]
  );
  const [selectedCode, setSelectedCode] = useState("trial_pro");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const loading = plansQuery.isLoading;
  const queryErr = plansQuery.error?.message || "";

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.code === selectedCode) || plans[0] || null,
    [plans, selectedCode]
  );

  useEffect(() => {
    if (selectedPlan) setDraft(clone(selectedPlan));
  }, [selectedPlan]);

  useEffect(() => {
    if (plans.length && !plans.find((plan) => plan.code === selectedCode)) {
      setSelectedCode(plans[0].code);
    }
  }, [plans, selectedCode]);

  function updatePlanCache(updated) {
    queryClient.setQueryData(queryKeys.adminCoachPlans(), (prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      return arr.map((plan) => (plan.code === updated.code ? updated : plan));
    });
  }

  function patchDraft(path, value) {
    setDraft((prev) => {
      const next = clone(prev);
      let cursor = next;
      for (let i = 0; i < path.length - 1; i += 1) {
        cursor[path[i]] = cursor[path[i]] || {};
        cursor = cursor[path[i]];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  }

  async function save() {
    if (!draft?.code) return;
    try {
      setSaving(true);
      setErr("");
      setOk("");
      const updated = await updateAdminCoachPlanConfig(draft.code, draft);
      updatePlanCache(updated);
      await invalidateAfterCoachPlansChange();
      setOk("Plan guardado.");
    } catch (e) {
      setErr(e?.message || "No se pudo guardar el plan");
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!draft?.code) return;
    const okReset = window.confirm("Restaurar este plan a los valores base?");
    if (!okReset) return;

    try {
      setSaving(true);
      setErr("");
      setOk("");
      const updated = await resetAdminCoachPlanConfig(draft.code);
      updatePlanCache(updated);
      setDraft(clone(updated));
      await invalidateAfterCoachPlansChange();
      setOk("Plan restaurado.");
    } catch (e) {
      setErr(e?.message || "No se pudo restaurar el plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="acp-page">
      <div className="acp-head">
        <div>
          <h1>Planes de coaches</h1>
          <p>Configura reglas base para Prueba Pro, Pro y VIP. Los overrides por coach se editan desde el detalle del coach.</p>
        </div>
        <button className="acp-btn" onClick={() => plansQuery.refetch()} disabled={plansQuery.isFetching}>
          {plansQuery.isFetching ? "Actualizando..." : "Recargar"}
        </button>
      </div>

      {queryErr ? <div className="acp-alert error">{queryErr}</div> : null}
      {err ? <div className="acp-alert error">{err}</div> : null}
      {ok ? <div className="acp-alert ok">{ok}</div> : null}

      <div className="acp-tabs">
        {plans.map((plan) => (
          <button
            key={plan.code}
            className={`acp-tab ${selectedCode === plan.code ? "active" : ""}`}
            onClick={() => setSelectedCode(plan.code)}
            type="button"
          >
            {plan.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="acp-card">Cargando planes...</div>
      ) : draft ? (
        <div className="acp-card">
          <div className="acp-grid">
            <label>
              Nombre
              <input className="acp-input" value={draft.name || ""} onChange={(e) => patchDraft(["name"], e.target.value)} />
            </label>
            <label>
              Max clientes
              <input
                className="acp-input"
                value={numToInput(draft.maxClients)}
                onChange={(e) => patchDraft(["maxClients"], inputToNumOrNull(e.target.value) ?? 0)}
              />
            </label>
            <label>
              Duracion prueba (dias)
              <input
                className="acp-input"
                value={draft.durationDays == null ? "" : String(draft.durationDays)}
                onChange={(e) => patchDraft(["durationDays"], inputToNumOrNull(e.target.value))}
                placeholder="Sin vencimiento"
              />
            </label>
          </div>

          <div className="acp-sections">
            {FEATURE_SECTIONS.map((section) => (
              <div className="acp-section" key={section.key}>
                <h2>{section.title}</h2>
                <div className="acp-featureGrid">
                  {section.fields.map(([field, label]) => (
                    <label key={field} className="acp-check">
                      <input
                        type="checkbox"
                        checked={!!draft?.features?.[section.key]?.[field]}
                        onChange={(e) => patchDraft(["features", section.key, field], e.target.checked)}
                      />
                      {label}
                    </label>
                  ))}

                  {section.limitField ? (
                    <label>
                      Limite plantillas
                      <input
                        className="acp-input"
                        value={draft?.features?.[section.key]?.[section.limitField] == null ? "" : String(draft.features[section.key][section.limitField])}
                        onChange={(e) => patchDraft(["features", section.key, section.limitField], inputToNumOrNull(e.target.value))}
                        placeholder="Sin limite"
                      />
                    </label>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <div className="acp-actions">
            <button className="acp-btn gold" onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar plan"}
            </button>
            <button className="acp-btn" onClick={reset} disabled={saving}>
              Resetear plan
            </button>
          </div>
        </div>
      ) : (
        <div className="acp-card">No hay planes configurados.</div>
      )}

      <style>{styles}</style>
    </div>
  );
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

function inputToNumOrNull(x) {
  const s = String(x ?? "").replace(/[^\d]/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function numToInput(v) {
  if (v == null) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

const styles = `
.acp-page{
  color:#eaeaea;
}
.acp-head{
  display:flex;
  justify-content:space-between;
  gap:12px;
  align-items:flex-start;
  margin-bottom:14px;
}
.acp-head h1{
  margin:0;
  color:#f5d76e;
}
.acp-head p{
  margin:6px 0 0;
  color:#b8c0cc;
  line-height:1.5;
}
.acp-tabs{
  display:flex;
  flex-wrap:wrap;
  gap:10px;
  margin-bottom:14px;
}
.acp-tab,.acp-btn{
  min-height:44px;
  padding:0 14px;
  border-radius:14px;
  border:1px solid #2a3038;
  background:#0d1117;
  color:#edf2f7;
  font-weight:900;
  cursor:pointer;
}
.acp-tab.active,.acp-btn.gold{
  border-color:rgba(245,215,110,.42);
  background:rgba(245,215,110,.08);
  color:#f5d76e;
}
.acp-card{
  border:1px solid rgba(245,215,110,.12);
  background:linear-gradient(180deg, rgba(12,14,19,.96), rgba(8,10,14,.98));
  border-radius:22px;
  padding:16px;
}
.acp-grid,.acp-featureGrid{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:12px;
}
.acp-input{
  margin-top:8px;
  width:100%;
  min-height:44px;
  border-radius:14px;
  border:1px solid #2a313b;
  background:#0b0f15;
  color:#edf2f7;
  padding:0 12px;
  outline:none;
}
.acp-sections{
  margin-top:14px;
  display:grid;
  gap:12px;
}
.acp-section{
  border:1px solid rgba(255,255,255,.06);
  background:#0f141b;
  border-radius:18px;
  padding:14px;
}
.acp-section h2{
  margin:0 0 12px;
  font-size:16px;
  color:#f5d76e;
}
.acp-check{
  min-height:44px;
  display:flex;
  align-items:center;
  gap:10px;
  font-weight:850;
}
.acp-actions{
  margin-top:14px;
  display:flex;
  gap:10px;
  flex-wrap:wrap;
}
.acp-alert{
  margin-bottom:12px;
  border-radius:14px;
  padding:12px 14px;
  font-weight:850;
}
.acp-alert.error{
  border:1px solid rgba(255,80,80,.24);
  background:rgba(255,80,80,.08);
  color:#ffb9b9;
}
.acp-alert.ok{
  border:1px solid rgba(80,220,140,.24);
  background:rgba(80,220,140,.08);
  color:#bdf4d0;
}
@media (max-width: 800px){
  .acp-head{
    flex-direction:column;
  }
  .acp-grid,.acp-featureGrid{
    grid-template-columns:1fr;
  }
  .acp-btn,.acp-tab{
    width:100%;
  }
}
`;
