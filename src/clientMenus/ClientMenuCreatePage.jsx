import React, { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Crown, Edit3, Info, Target, Utensils } from "lucide-react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
import { normalizeGoalFromUser } from "../clientNutrition/nutritionState.js";
import AppToast from "../ui/AppToast.jsx";
import ClientMenusPanel from "./ClientMenusPanel.jsx";
import ClientMenuGenerator from "./ClientMenuGenerator.jsx";
import "../nutritionLibrary/nutritionLibrary.css";

function safeReturnPath(value) {
  const text = String(value || "").trim();
  if (!text.startsWith("/app/") || text === "/app/menu/nuevo") return "/app/menu";
  return text;
}

const WIZARD_DAYS = [
  ["monday", "Lun"],
  ["tuesday", "Mar"],
  ["wednesday", "Mié"],
  ["thursday", "Jue"],
  ["friday", "Vie"],
  ["saturday", "Sáb"],
  ["sunday", "Dom"],
];

function localIsoDate() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekdayKeyFromIso(value = "") {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return WIZARD_DAYS[0][0];
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const mondayIndex = (date.getDay() + 6) % 7;
  return WIZARD_DAYS[mondayIndex][0];
}

function planMetaFromUser(user = {}) {
  const capabilities = user?.nutritionCapabilities || {};
  const raw = String(capabilities.plan || user?.plan || "free").toLowerCase();
  const key = raw === "premium2" || raw === "vip" ? "vip" : raw === "premium" || raw === "pro" ? "pro" : "free";
  const explicitLimit = Number(capabilities?.limits?.menuDays);
  return {
    key,
    label: key === "vip" ? "VIP" : key === "pro" ? "Pro" : "Free",
    dayLimit: Number.isFinite(explicitLimit) && explicitLimit > 0 ? Math.min(7, explicitLimit) : key === "free" ? 1 : 7,
  };
}

function targetForWizard(user = {}, override = null) {
  if (override?.kcal) return {
    kcal: Number(override.kcal) || 0,
    proteina: Number(override.proteina ?? override.p) || 0,
    carbs: Number(override.carbs ?? override.c) || 0,
    grasas: Number(override.grasas ?? override.g) || 0,
  };
  const normalized = normalizeGoalFromUser(user);
  return normalized.configured ? {
    kcal: Number(normalized.kcal) || 0,
    proteina: Number(normalized.p) || 0,
    carbs: Number(normalized.c) || 0,
    grasas: Number(normalized.g) || 0,
  } : null;
}

function targetLine(target = null) {
  if (!target?.kcal) return "Objetivo diario pendiente";
  return `${Math.round(target.kcal).toLocaleString("es-AR")} kcal · P${Math.round(target.proteina || 0)} · C${Math.round(target.carbs || 0)} · G${Math.round(target.grasas || 0)}`;
}

export default function ClientMenuCreatePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState(null);
  const [generatedDraft, setGeneratedDraft] = useState(() => location.state?.generatedDraft || null);
  const [manualMealCount, setManualMealCount] = useState(null);
  const [manualSetup, setManualSetup] = useState(null);
  const cachedUser = useMemo(() => getCachedUser(), []);
  const authQuery = useAuthMe({
    enabled: true,
    initialFromCache: true,
    staleTime: 30 * 1000,
    refetchOnMount: false,
  });
  const user = authQuery.data || cachedUser || {};
  const returnTo = safeReturnPath(location.state?.from);
  const selectedDate = /^\d{4}-\d{2}-\d{2}$/.test(String(location.state?.selectedDate || ""))
    ? String(location.state.selectedDate)
    : "";
  const dailyTarget = location.state?.dailyTarget || null;
  const wizardTarget = targetForWizard(user, dailyTarget);
  const generationSettings = location.state?.generationSettings || null;
  const activeMenuComparison = location.state?.activeMenuComparison || null;
  const editMenuId = location.state?.editMenuId || location.state?.menuId || "";
  const editMenuRequest = editMenuId
    ? {
        id: editMenuId,
        token: location.state?.editToken || `${editMenuId}-route`,
        focusName: location.state?.focus === "name",
      }
    : null;
  const generationMode = searchParams.get("mode") === "generate" && !generatedDraft && !editMenuRequest;
  const mealCountStep = !generationMode && !generatedDraft && !editMenuRequest && !manualMealCount;
  const setupStep = !generationMode && !generatedDraft && !editMenuRequest && !!manualMealCount && !manualSetup;

  function openManualCreator() {
    const next = new URLSearchParams(searchParams);
    next.delete("mode");
    setSearchParams(next, { replace: true });
  }

  return (
    <div className="nl-page client-menu-create-page">
      <section className="nl-shell client-menu-create-shell">
        {generationMode ? (
          <ClientMenuGenerator
            user={user}
            targetOverride={dailyTarget}
            initialSettings={generationSettings}
            selectedDate={selectedDate}
            onCancel={openManualCreator}
            onGenerated={(draft) => {
              setGeneratedDraft({
                ...draft,
                fechaInicio: selectedDate || draft.fechaInicio,
                objectiveMode: dailyTarget?.kcal ? "custom" : draft.objectiveMode,
                menuTarget: dailyTarget?.kcal ? dailyTarget : draft.menuTarget,
              });
              openManualCreator();
            }}
          />
        ) : mealCountStep ? (
          <MealCountStep
            initialCount={Number(location.state?.mealCount) || 4}
            target={wizardTarget}
            onSelect={setManualMealCount}
            onCancel={() => navigate(returnTo, { replace: true })}
          />
        ) : setupStep ? (
          <MenuSetupStep
            user={user}
            targetOverride={dailyTarget}
            initialDate={selectedDate}
            mealCount={manualMealCount}
            onBack={() => setManualMealCount(null)}
            onContinue={setManualSetup}
          />
        ) : (
          <ClientMenusPanel
            directCreate
            editMenuRequest={editMenuRequest}
            initialDraft={generatedDraft}
            returnTo={returnTo}
            user={user}
            initialDate={selectedDate}
            initialTarget={dailyTarget}
            initialMealCount={manualMealCount || 4}
            initialSetup={manualSetup}
            activeMenuComparison={activeMenuComparison}
            onToast={setToast}
          />
        )}
      </section>
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function MealCountStep({ target = null, initialCount = 4, onSelect, onCancel }) {
  const [selected, setSelected] = useState(initialCount);

  return (
    <section className="client-meal-count-step" aria-labelledby="client-meal-count-title">
      <span className="client-wizard-step">Paso 1 de 3</span>
      <span className="client-meal-count-icon"><Utensils size={25} aria-hidden="true" /></span>
      <h1 id="client-meal-count-title">Crear menú manual</h1>
      <p>Elegí cuántas comidas querés hacer hoy. Después podés renombrarlas, reordenarlas o agregar más.</p>
      {target?.kcal ? (
        <div className="client-meal-count-target">
          <Target size={26} aria-hidden="true" />
          <span><strong>Objetivo del día</strong><small>{targetLine(target)}</small></span>
        </div>
      ) : null}
      <div className="client-meal-count-options" role="radiogroup" aria-label="Cantidad inicial de comidas">
        {[3, 4, 5, 6].map((count) => (
          <button
            key={count}
            type="button"
            role="radio"
            aria-checked={selected === count}
            className={`${count === 4 ? "recommended" : ""} ${selected === count ? "selected" : ""}`}
            onClick={() => setSelected(count)}
          >
            <i><Utensils size={19} aria-hidden="true" /></i>
            <span>{count}</span>
            <strong>{count} comidas</strong>
            {count === 4 ? <small><Check size={13} /> Recomendada</small> : null}
          </button>
        ))}
      </div>
      <button type="button" className="client-wizard-primary" onClick={() => onSelect(selected)}>
        Continuar <ArrowRight size={20} aria-hidden="true" />
      </button>
      <button type="button" className="client-wizard-back" onClick={onCancel}><ArrowLeft size={16} /> Volver</button>
    </section>
  );
}

function MenuSetupStep({ user = {}, targetOverride = null, initialDate = "", mealCount = 4, onBack, onContinue }) {
  const plan = planMetaFromUser(user);
  const currentTarget = targetForWizard(user, targetOverride);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(initialDate) ? initialDate : localIsoDate();
  const [name, setName] = useState("Mi menú");
  const [nameEditing, setNameEditing] = useState(false);
  const [date, setDate] = useState(startDate);
  const [objectiveMode, setObjectiveMode] = useState(currentTarget ? "current" : "custom");
  const [customTarget, setCustomTarget] = useState(currentTarget || { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
  const [selectedDays, setSelectedDays] = useState([weekdayKeyFromIso(startDate)]);
  const selectedTarget = objectiveMode === "custom" ? customTarget : currentTarget;
  const canContinue = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(date) && selectedDays.length > 0 && Number(selectedTarget?.kcal) > 0;

  function changeDate(nextDate) {
    const previousDay = weekdayKeyFromIso(date);
    const nextDay = weekdayKeyFromIso(nextDate);
    setDate(nextDate);
    setSelectedDays((current) => current.length === 1 && current[0] === previousDay ? [nextDay] : current);
  }

  function toggleDay(dayKey) {
    setSelectedDays((current) => {
      if (current.includes(dayKey)) return current.length > 1 ? current.filter((day) => day !== dayKey) : current;
      if (current.length >= plan.dayLimit) return current;
      return [...current, dayKey];
    });
  }

  function updateTarget(field, value) {
    const parsed = Math.max(0, Number(value) || 0);
    setCustomTarget((current) => ({ ...current, [field]: parsed }));
  }

  return (
    <section className="client-menu-setup-step" aria-labelledby="client-menu-setup-title">
      <span className="client-wizard-step">Paso 2 de 3</span>
      <span className="client-meal-count-icon"><Utensils size={25} aria-hidden="true" /></span>
      <h1 id="client-menu-setup-title">Configurar mi menú</h1>
      <p>Definí el nombre, la fecha y el objetivo nutricional.</p>

      <div className="client-setup-name">
        <span className="client-setup-name-icon"><Utensils size={20} aria-hidden="true" /></span>
        {nameEditing ? (
          <input
            value={name}
            maxLength={180}
            autoFocus
            onChange={(event) => setName(event.target.value)}
            onBlur={() => setNameEditing(false)}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === "Escape") setNameEditing(false); }}
            aria-label="Nombre del menú"
          />
        ) : <strong>{name}</strong>}
        <button type="button" onClick={() => setNameEditing(true)} aria-label="Editar nombre del menú"><Edit3 size={18} /></button>
        <span className={`client-setup-plan ${plan.key}`}><Crown size={15} /> Plan {plan.label}</span>
      </div>

      <span className="client-setup-limit"><CalendarDays size={15} /> Hasta {plan.dayLimit} {plan.dayLimit === 1 ? "día" : "días"} · {mealCount} comidas iniciales</span>

      <section className="client-setup-objective">
        <h2>Objetivo y comienzo</h2>
        <label className="client-setup-date">
          <span>Fecha de inicio</span>
          <input type="date" value={date} onChange={(event) => changeDate(event.target.value)} aria-label="Fecha de inicio del menú" />
        </label>
        <div className="client-setup-objective-modes" role="radiogroup" aria-label="Objetivo nutricional del menú">
          <button type="button" role="radio" aria-checked={objectiveMode === "current"} disabled={!currentTarget} className={objectiveMode === "current" ? "active" : ""} onClick={() => setObjectiveMode("current")}>
            <Target size={20} /><span><strong>Usar mi objetivo actual</strong><small>{targetLine(currentTarget)}</small></span>
          </button>
          <button type="button" role="radio" aria-checked={objectiveMode === "custom"} className={objectiveMode === "custom" ? "active" : ""} onClick={() => setObjectiveMode("custom")}>
            <Target size={20} /><span><strong>Objetivo propio</strong><small>Definir calorías y macros</small></span>
          </button>
        </div>
        {objectiveMode === "custom" ? (
          <div className="client-setup-target-grid">
            {[["kcal", "Kcal"], ["proteina", "Proteína"], ["carbs", "Carbohidratos"], ["grasas", "Grasas"]].map(([field, label]) => (
              <label key={field}><span>{label}</span><input type="number" min="0" step="0.1" value={customTarget[field] || ""} onChange={(event) => updateTarget(field, event.target.value)} aria-label={`${label} objetivo del menú`} /></label>
            ))}
          </div>
        ) : null}
      </section>

      <div className="client-setup-days" role="group" aria-label="Días incluidos en el menú">
        {WIZARD_DAYS.map(([key, label]) => (
          <button key={key} type="button" className={selectedDays.includes(key) ? "active" : ""} aria-pressed={selectedDays.includes(key)} onClick={() => toggleDay(key)}>{label}</button>
        ))}
      </div>

      <div className="client-setup-note"><Info size={20} /><span>Este menú se crea sin registrar consumo. Podés renombrarlo, eliminarlo, ordenarlo o agregar otras comidas después.</span></div>

      <button
        type="button"
        className="client-wizard-primary"
        disabled={!canContinue}
        onClick={() => onContinue({
          nombre: name.trim(),
          fechaInicio: date,
          objectiveMode,
          menuTarget: objectiveMode === "custom" ? customTarget : null,
          selectedDays,
          dayLimit: plan.dayLimit,
        })}
      >
        Continuar <ArrowRight size={20} aria-hidden="true" />
      </button>
      <button type="button" className="client-wizard-back" onClick={onBack}><ArrowLeft size={16} /> Volver</button>
    </section>
  );
}
