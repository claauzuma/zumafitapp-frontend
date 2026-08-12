import React, { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Apple, Save, X } from "lucide-react";

import {
  GENERATION_MEAL_TYPES,
  GENERATION_MODES,
  GENERATION_ROLES,
  PORTION_UNITS,
  createFoodDraft,
  editFoodDraft,
  foodCreationPayloadFromDraft,
  generationPayloadFromDraft,
  toggleGenerationFlag,
} from "./adminFoodGeneration.js";

export default function AdminFoodEditor({ food = null, onClose, onSave, saving = false }) {
  const creating = !food;
  const [draft, setDraft] = useState(() => creating ? createFoodDraft() : editFoodDraft(food));
  const [error, setError] = useState("");
  const closeRef = useRef(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, saving]);

  const genericWarnings = useMemo(() => {
    if (draft.generation.mode !== "GENERIC") return [];
    return [
      !Object.values(draft.generation.roles).some(Boolean) ? "Seleccioná al menos un rol." : "",
      !Object.values(draft.generation.mealTypes).some(Boolean) ? "Seleccioná al menos un momento." : "",
    ].filter(Boolean);
  }, [draft.generation]);

  const updateGeneration = (key, value) => {
    setDraft((current) => ({ ...current, generation: { ...current.generation, [key]: value } }));
    setError("");
  };

  const toggleFlag = (group, key) => {
    setDraft((current) => toggleGenerationFlag(current, group, key));
    setError("");
  };

  const submit = async (event) => {
    event.preventDefault();
    const result = creating ? foodCreationPayloadFromDraft(draft) : generationPayloadFromDraft(draft);
    if (result.error) {
      setError(result.error);
      return;
    }
    try {
      setError("");
      await onSave(creating ? result.food : result.generation);
    } catch (saveError) {
      setError(saveError?.message || "No se pudieron guardar los cambios.");
    }
  };

  return (
    <div className="nf-foodEditorBackdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <aside className="nf-foodEditor" role="dialog" aria-modal="true" aria-labelledby="admin-food-editor-title">
        <header className="nf-foodEditorHead">
          <div className="nf-foodEditorIdentity">
            <span className="nf-foodEditorIcon"><Apple size={22} aria-hidden="true" /></span>
            <div>
              <span>{creating ? "NUEVO ALIMENTO" : "METADATA DE GENERACIÓN"}</span>
              <h2 id="admin-food-editor-title">{creating ? "Agregar alimento" : food.name}</h2>
              {!creating ? <small>{food.kcal} kcal · P {food.protein} · C {food.carbs} · G {food.fat} · {food.unit}</small> : null}
            </div>
          </div>
          <button ref={closeRef} type="button" className="nf-iconBtn" onClick={onClose} disabled={saving} aria-label="Cerrar editor">
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        <form className="nf-foodEditorForm" onSubmit={submit}>
          {creating ? <BasicFoodFields draft={draft} setDraft={setDraft} /> : null}

          <section className="nf-foodEditorSection">
            <div className="nf-foodEditorSectionTitle">
              <div><span>POLÍTICA</span><h3>Modo de generación</h3></div>
            </div>
            <label className="nf-foodField">
              <span>Modo</span>
              <select value={draft.generation.mode} onChange={(event) => updateGeneration("mode", event.target.value)}>
                {GENERATION_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
              </select>
            </label>
            <p className={`nf-foodModeNotice ${draft.generation.mode.toLowerCase()}`}>
              {draft.generation.mode === "EXPLICIT_ONLY" ? "Disponible sólo cuando alguien lo seleccione expresamente; no entra al pool automático." : null}
              {draft.generation.mode === "GENERIC" ? "Puede integrar el futuro pool automático únicamente en los roles y momentos habilitados." : null}
              {draft.generation.mode === "DISABLED" ? "Deshabilitado para generación. La configuración se conserva para poder reactivarla." : null}
            </p>
            {genericWarnings.length ? (
              <div className="nf-foodValidation" role="alert"><AlertTriangle size={16} aria-hidden="true" /> {genericWarnings.join(" ")}</div>
            ) : null}
          </section>

          <section className="nf-foodEditorSection">
            <div className="nf-foodEditorSectionTitle"><div><span>COMPATIBILIDAD</span><h3>Roles nutricionales</h3></div></div>
            <div className="nf-foodToggleGrid">
              {GENERATION_ROLES.map(([key, label]) => (
                <FlagToggle key={key} code={key} label={label} checked={draft.generation.roles[key]} onChange={() => toggleFlag("roles", key)} />
              ))}
            </div>
          </section>

          <section className="nf-foodEditorSection">
            <div className="nf-foodEditorSectionTitle"><div><span>MOMENTOS</span><h3>Tipos de comida</h3></div></div>
            <div className="nf-foodToggleGrid meals">
              {GENERATION_MEAL_TYPES.map(([key, label]) => (
                <FlagToggle key={key} code={label} label="Habilitado" checked={draft.generation.mealTypes[key]} onChange={() => toggleFlag("mealTypes", key)} />
              ))}
            </div>
          </section>

          <section className="nf-foodEditorSection">
            <div className="nf-foodEditorSectionTitle"><div><span>REGLA DE PORCIÓN</span><h3>Límites técnicos opcionales</h3></div></div>
            <div className="nf-foodPortionGrid">
              <label className="nf-foodField"><span>Unidad</span><select value={draft.generation.portionRule.unit || ""} onChange={(event) => updateGeneration("portionRule", { ...draft.generation.portionRule, unit: event.target.value || null })}><option value="">Sin definir</option>{PORTION_UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select></label>
              {[["min", "Mínimo"], ["max", "Máximo"], ["step", "Paso"]].map(([key, label]) => (
                <label className="nf-foodField" key={key}><span>{label}</span><input type="number" min="0" step="any" value={draft.generation.portionRule[key] ?? ""} onChange={(event) => updateGeneration("portionRule", { ...draft.generation.portionRule, [key]: event.target.value })} placeholder="Libre" /></label>
              ))}
            </div>
            <label className="nf-foodField full"><span>Valores permitidos</span><input value={draft.allowedValuesText} onChange={(event) => setDraft((current) => ({ ...current, allowedValuesText: event.target.value }))} placeholder="Ej.: 1, 2, 3" aria-describedby="allowed-values-help" /><small id="allowed-values-help">Números positivos separados por comas. No se cargan cantidades reales automáticamente.</small></label>
          </section>

          {error ? <div className="nf-foodEditorError" role="alert">{error}</div> : null}
          <footer className="nf-foodEditorActions">
            <button type="button" className="nf-btn ghost" onClick={onClose} disabled={saving}>Cancelar</button>
            <button type="submit" className="nf-btn gold" disabled={saving || genericWarnings.length > 0}>
              <Save size={17} aria-hidden="true" /> {saving ? "Guardando…" : creating ? "Crear alimento" : "Guardar metadata"}
            </button>
          </footer>
        </form>
      </aside>
    </div>
  );
}

function FlagToggle({ code, label, checked, onChange }) {
  return (
    <label className={`nf-foodFlag ${checked ? "selected" : ""}`}>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span><strong>{code}</strong><small>{label}</small></span>
      <i aria-hidden="true" />
    </label>
  );
}

function BasicFoodFields({ draft, setDraft }) {
  const set = (key, value) => setDraft((current) => ({ ...current, [key]: value }));
  return (
    <section className="nf-foodEditorSection">
      <div className="nf-foodEditorSectionTitle"><div><span>DATOS BASE</span><h3>Información nutricional</h3></div></div>
      <div className="nf-foodBasicGrid">
        <label className="nf-foodField wide"><span>Nombre</span><input value={draft.name} onChange={(event) => set("name", event.target.value)} required /></label>
        <label className="nf-foodField"><span>Categoría</span><input value={draft.category} onChange={(event) => set("category", event.target.value)} /></label>
        <label className="nf-foodField"><span>Unidad actual</span><input value={draft.unit} onChange={(event) => set("unit", event.target.value)} required /></label>
        <label className="nf-foodField"><span>Cantidad base</span><input type="number" min="0.0001" step="any" value={draft.quantity} onChange={(event) => set("quantity", event.target.value)} required /></label>
        {[["kcal", "Kcal"], ["protein", "Proteína"], ["carbs", "Carbohidratos"], ["fat", "Grasas"]].map(([key, label]) => <label className="nf-foodField" key={key}><span>{label}</span><input type="number" min="0" step="any" value={draft[key]} onChange={(event) => set(key, event.target.value)} required /></label>)}
      </div>
    </section>
  );
}
