import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Save, RotateCcw } from "lucide-react";

import {
  resetAdminClientPlanConfig,
  resetAdminCoachPlanConfig,
  updateAdminClientPlanConfig,
  updateAdminCoachPlanConfig,
} from "./adminUsuariosApi.js";
import { useAdminClientPlans, useAdminCoachPlans } from "./adminUsuariosQueries.js";
import {
  invalidateAfterClientPlansChange,
  invalidateAfterCoachPlansChange,
  queryKeys,
} from "../queryClient.js";
import { coachProfessionalPlanLabel } from "../professionalPlans.js";

const COACH_CAPABILITIES = [
  ["canUseGlobalMenuTemplates", "Biblioteca global de menús"],
  ["canUseGlobalMealTemplates", "Biblioteca global de comidas"],
  ["canUsePremiumMenuTemplates", "Menús premium"],
  ["canUsePremiumMealTemplates", "Comidas premium"],
];

const CLIENT_LIMITS = [
  ["maxMenus", "Menús propios", false],
  ["maxDaysPerMenu", "Días por menú", false],
  ["maxSavedMeals", "Comidas guardadas", false],
  ["maxFavorites", "Favoritos", false],
  ["trackingHistoryDays", "Días de historial", true],
  ["goalChangesPerWindow", "Cambios de objetivos", true],
  ["goalChangesWindowDays", "Ventana de cambios (días)", true],
];

export default function AdminCoachPlanes() {
  const queryClient = useQueryClient();
  const coachPlansQuery = useAdminCoachPlans();
  const clientPlansQuery = useAdminClientPlans();
  const [scope, setScope] = useState("coaches");
  const [selectedCodes, setSelectedCodes] = useState({ coaches: "trial_pro", clients: "free" });
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const plans = useMemo(
    () => scope === "coaches"
      ? (Array.isArray(coachPlansQuery.data) ? coachPlansQuery.data : [])
      : (Array.isArray(clientPlansQuery.data) ? clientPlansQuery.data : []),
    [clientPlansQuery.data, coachPlansQuery.data, scope]
  );
  const selectedCode = selectedCodes[scope];
  const selectedPlan = plans.find((plan) => plan.code === selectedCode) || plans[0] || null;
  const activeQuery = scope === "coaches" ? coachPlansQuery : clientPlansQuery;

  useEffect(() => {
    if (!selectedPlan) return;
    setDraft(clone(selectedPlan));
    setMessage(null);
  }, [selectedPlan]);

  useEffect(() => {
    if (!plans.length || plans.some((plan) => plan.code === selectedCode)) return;
    setSelectedCodes((previous) => ({ ...previous, [scope]: plans[0].code }));
  }, [plans, scope, selectedCode]);

  function selectPlan(code) {
    setSelectedCodes((previous) => ({ ...previous, [scope]: code }));
  }

  function patchDraft(path, value) {
    setDraft((previous) => {
      const next = clone(previous);
      let cursor = next;
      for (let index = 0; index < path.length - 1; index += 1) {
        cursor[path[index]] = cursor[path[index]] || {};
        cursor = cursor[path[index]];
      }
      cursor[path[path.length - 1]] = value;
      return next;
    });
  }

  function updateCache(updated) {
    const key = scope === "coaches" ? queryKeys.adminCoachPlans() : queryKeys.adminClientPlans();
    queryClient.setQueryData(key, (previous) => {
      const current = Array.isArray(previous) ? previous : [];
      return current.map((plan) => plan.code === updated.code ? updated : plan);
    });
  }

  async function save() {
    if (!draft?.code) return;
    try {
      setSaving(true);
      setMessage(null);
      const updated = scope === "coaches"
        ? await updateAdminCoachPlanConfig(draft.code, coachPayload(draft))
        : await updateAdminClientPlanConfig(draft.code, clientPayload(draft));
      updateCache(updated);
      setDraft(clone(updated));
      if (scope === "coaches") await invalidateAfterCoachPlansChange();
      else await invalidateAfterClientPlansChange();
      setMessage({ type: "ok", text: "Configuración guardada. Los usuarios sin override ya heredan estos valores." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "No se pudo guardar el plan." });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    if (!draft?.code || !window.confirm("¿Restaurar los valores seguros de este plan?")) return;
    try {
      setSaving(true);
      setMessage(null);
      const updated = scope === "coaches"
        ? await resetAdminCoachPlanConfig(draft.code)
        : await resetAdminClientPlanConfig(draft.code);
      updateCache(updated);
      setDraft(clone(updated));
      if (scope === "coaches") await invalidateAfterCoachPlansChange();
      else await invalidateAfterClientPlansChange();
      setMessage({ type: "ok", text: "Defaults restaurados." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "No se pudo restaurar el plan." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="acp-page">
      <header className="acp-head">
        <div>
          <h1>Configuración de planes</h1>
          <p>Editá defaults globales sin mezclar planes personales, planes profesionales ni servicios coach-cliente.</p>
        </div>
        <button className="acp-btn" type="button" onClick={() => activeQuery.refetch()} disabled={activeQuery.isFetching}>
          {activeQuery.isFetching ? "Actualizando..." : "Recargar"}
        </button>
      </header>

      <div className="acp-scopeTabs" role="tablist" aria-label="Tipo de plan">
        <button type="button" className={scope === "coaches" ? "active" : ""} onClick={() => setScope("coaches")}>Coaches</button>
        <button type="button" className={scope === "clients" ? "active" : ""} onClick={() => setScope("clients")}>Clientes</button>
      </div>

      {message ? <div className={`acp-alert ${message.type}`}>{message.text}</div> : null}
      {activeQuery.error ? <div className="acp-alert error">{activeQuery.error.message}</div> : null}

      <div className="acp-planTabs">
        {plans.map((plan) => (
          <button
            key={plan.code}
            type="button"
            className={selectedPlan?.code === plan.code ? "active" : ""}
            onClick={() => selectPlan(plan.code)}
          >
            {scope === "coaches" ? coachProfessionalPlanLabel(plan.code) : plan.label}
          </button>
        ))}
      </div>

      {activeQuery.isLoading ? (
        <div className="acp-card">Cargando configuración...</div>
      ) : draft ? (
        <section className="acp-card">
          <div className="acp-cardHead">
            <div>
              <span>{scope === "coaches" ? "Plan profesional del coach" : "Plan personal del cliente"}</span>
              <h2>{scope === "coaches" ? coachProfessionalPlanLabel(draft.code) : draft.label}</h2>
            </div>
            <small>Los overrides individuales del coach no se pisan.</small>
          </div>

          {scope === "coaches" ? (
            <CoachPlanForm draft={draft} patchDraft={patchDraft} />
          ) : (
            <ClientPlanForm draft={draft} patchDraft={patchDraft} />
          )}

          <div className="acp-actions">
            <button className="acp-btn gold" type="button" onClick={save} disabled={saving}>
              <Save size={16} aria-hidden="true" />
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
            <button className="acp-btn" type="button" onClick={reset} disabled={saving}>
              <RotateCcw size={16} aria-hidden="true" />
              Restaurar defaults
            </button>
          </div>
        </section>
      ) : (
        <div className="acp-card">No hay planes configurados.</div>
      )}

      <style>{styles}</style>
    </div>
  );
}

function CoachPlanForm({ draft, patchDraft }) {
  const menus = draft?.features?.menus || {};
  return (
    <>
      <div className="acp-fieldGrid">
        <NumberField label="Clientes activos" value={draft.maxClients} onChange={(value) => patchDraft(["maxClients"], value)} min={1} />
        <NumberField label="Menús propios" value={draft.maxCoachOwnedMenus} onChange={(value) => patchDraft(["maxCoachOwnedMenus"], value)} />
        <NumberField label="Comidas propias" value={draft.maxCoachOwnedMeals} onChange={(value) => patchDraft(["maxCoachOwnedMeals"], value)} />
      </div>
      <div className="acp-section">
        <h3>Biblioteca profesional</h3>
        <p>Estos permisos no habilitan IA ni cambian los paquetes service_pro/service_vip.</p>
        <div className="acp-checkGrid">
          {COACH_CAPABILITIES.map(([key, label]) => (
            <label key={key} className="acp-check">
              <input type="checkbox" checked={menus[key] === true} onChange={(event) => patchDraft(["features", "menus", key], event.target.checked)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

function ClientPlanForm({ draft, patchDraft }) {
  return (
    <>
      <div className="acp-fieldGrid">
        {CLIENT_LIMITS.map(([key, label, nullable]) => (
          <NumberField
            key={key}
            label={label}
            value={draft?.limits?.[key]}
            nullable={nullable}
            min={key === "maxDaysPerMenu" || key.endsWith("Days") ? 1 : 0}
            max={key === "maxDaysPerMenu" ? 7 : undefined}
            onChange={(value) => patchDraft(["limits", key], value)}
          />
        ))}
        <label className="acp-field">
          <span>Acceso a biblioteca</span>
          <select value={draft.libraryAccess || "basic"} onChange={(event) => patchDraft(["libraryAccess"], event.target.value)}>
            <option value="basic">Básica</option>
            <option value="global">Global</option>
            <option value="premium">Premium</option>
          </select>
        </label>
      </div>
      <div className="acp-note">“Sin límite” se guarda como null. Las funciones automáticas continúan bloqueadas o coming_soon.</div>
    </>
  );
}

function NumberField({ label, value, onChange, nullable = false, min = 0, max }) {
  return (
    <label className="acp-field">
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step="1"
        value={value == null ? "" : value}
        placeholder={nullable ? "Sin límite" : String(min)}
        onChange={(event) => {
          const raw = event.target.value;
          onChange(raw === "" && nullable ? null : Math.max(min, Number.parseInt(raw || String(min), 10)));
        }}
      />
    </label>
  );
}

function coachPayload(draft) {
  return {
    maxClients: draft.maxClients,
    maxCoachOwnedMenus: draft.maxCoachOwnedMenus,
    maxCoachOwnedMeals: draft.maxCoachOwnedMeals,
    features: {
      menus: Object.fromEntries(COACH_CAPABILITIES.map(([key]) => [key, draft?.features?.menus?.[key] === true])),
    },
  };
}

function clientPayload(draft) {
  return {
    limits: Object.fromEntries(CLIENT_LIMITS.map(([key]) => [key, draft?.limits?.[key] ?? null])),
    libraryAccess: draft.libraryAccess,
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value || {}));
}

const styles = `
.acp-page{color:#edf2f7;max-width:1200px;margin:0 auto}.acp-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;margin-bottom:18px}.acp-head h1{margin:0;color:#f5d76e}.acp-head p{margin:7px 0 0;color:#aeb8c6;line-height:1.5;max-width:760px}.acp-scopeTabs,.acp-planTabs{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:14px}.acp-scopeTabs button,.acp-planTabs button,.acp-btn{min-height:44px;padding:0 16px;border:1px solid #2a313b;border-radius:13px;background:#0c1118;color:#eef2f7;font-weight:850;cursor:pointer}.acp-scopeTabs button.active,.acp-planTabs button.active,.acp-btn.gold{border-color:rgba(245,215,110,.5);background:rgba(245,215,110,.11);color:#f5d76e}.acp-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px}.acp-btn:disabled{opacity:.55;cursor:wait}.acp-card{border:1px solid rgba(245,215,110,.15);background:linear-gradient(180deg,rgba(13,17,23,.98),rgba(8,11,16,.98));border-radius:22px;padding:20px}.acp-cardHead{display:flex;justify-content:space-between;gap:16px;align-items:flex-start;margin-bottom:18px}.acp-cardHead span{color:#f5d76e;font-size:12px;text-transform:uppercase;font-weight:900;letter-spacing:.08em}.acp-cardHead h2{margin:5px 0 0;font-size:26px}.acp-cardHead small{color:#9da8b6}.acp-fieldGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.acp-field{display:grid;gap:7px;color:#c7d0dc;font-weight:800}.acp-field input,.acp-field select{width:100%;min-height:46px;border:1px solid #2b3440;border-radius:13px;background:#090e14;color:#f4f7fa;padding:0 12px;font:inherit}.acp-section{margin-top:18px;border:1px solid rgba(255,255,255,.07);border-radius:17px;background:#0d131b;padding:16px}.acp-section h3{margin:0;color:#f5d76e}.acp-section p{color:#9da8b6;margin:6px 0 14px}.acp-checkGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.acp-check{display:flex;align-items:center;gap:10px;min-height:44px;padding:0 12px;border:1px solid rgba(255,255,255,.06);border-radius:12px;background:#090e14}.acp-check input{accent-color:#d8b848}.acp-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:18px}.acp-alert,.acp-note{padding:12px 14px;border-radius:13px;margin-bottom:14px;font-weight:750}.acp-alert.error{border:1px solid rgba(255,90,90,.3);background:rgba(255,70,70,.09);color:#ffc1c1}.acp-alert.ok{border:1px solid rgba(80,220,140,.28);background:rgba(60,210,130,.08);color:#bff2d2}.acp-note{margin:16px 0 0;border:1px solid rgba(245,215,110,.16);background:rgba(245,215,110,.05);color:#cbd4df}
@media(max-width:800px){.acp-head,.acp-cardHead{flex-direction:column}.acp-fieldGrid,.acp-checkGrid{grid-template-columns:1fr}.acp-scopeTabs button,.acp-planTabs button,.acp-actions .acp-btn{flex:1}.acp-card{padding:15px}}
`;
