import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Save, Sparkles } from "lucide-react";
import { apiFetch } from "../Api.js";
import { Avatar, Metric } from "./profesionalPieces.jsx";
import { fmtDate, fmtKcal, fullName, goalLabel, planLabel, specialtyLabel } from "./profesionalFormat.js";
import "./profesionalPanel.css";

const DAYS = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"];
const MEALS = ["Desayuno", "Almuerzo", "Merienda", "Cena"];

const MODE_LABELS = {
  manual: "Manual",
  semiautomatic: "Semiautomatico",
  automatic: "Automatico",
};

export default function ClienteDetalleProfesional() {
  const { clientId } = useParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [coach, setCoach] = useState(null);
  const [client, setClient] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");

  const [nutritionDraft, setNutritionDraft] = useState(() => createNutritionDraft(null));
  const [menuDraft, setMenuDraft] = useState(() => createMenuDraft(null));
  const [routineDraft, setRoutineDraft] = useState(() => createRoutineDraft(null));

  const loadDetail = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      setOk("");
      const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}`);
      setCoach(data?.coach || null);
      setClient(data?.client || null);
    } catch (error) {
      setErr(error?.message || "No se pudo cargar el detalle del cliente");
      setCoach(null);
      setClient(null);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    setNutritionDraft(createNutritionDraft(client));
    setMenuDraft(createMenuDraft(client));
    setRoutineDraft(createRoutineDraft(client));
  }, [client]);

  const access = useMemo(() => getCoachAccess(coach), [coach]);

  async function saveNutrition() {
    try {
      setSaving("nutrition");
      setErr("");
      setOk("");
      const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}/nutrition`, {
        method: "PATCH",
        body: {
          kcal: toNullableNumber(nutritionDraft.kcal),
          macros: {
            p: toNullableNumber(nutritionDraft.p),
            c: toNullableNumber(nutritionDraft.c),
            g: toNullableNumber(nutritionDraft.g),
          },
          goalType: nutritionDraft.goalType,
          targetWeightKg: toNullableNumber(nutritionDraft.targetWeightKg),
          approach: nutritionDraft.approach,
        },
      });
      setClient(data?.client || null);
      setCoach(data?.coach || coach);
      setOk("Nutricion actualizada para el cliente.");
    } catch (error) {
      setErr(error?.message || "No se pudo guardar nutricion");
    } finally {
      setSaving("");
    }
  }

  async function saveMenu() {
    try {
      setSaving("menu");
      setErr("");
      setOk("");
      const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}/menu`, {
        method: "PATCH",
        body: {
          menu: {
            mode: { type: menuDraft.modeType, lockedByCoach: menuDraft.lockedByCoach },
            mealConfig: {
              mealsPerDay: toNullableNumber(menuDraft.mealsPerDay),
              distribution: menuDraft.distribution,
              snackLibre: menuDraft.snackLibre,
              snackLibreKcal: toNullableNumber(menuDraft.snackLibreKcal),
            },
            weeklyPlan: {
              mealsByDay: menuDraft.mealsByDay,
              caloriesByDay: {},
              macrosByDay: {},
            },
            coachNotes: menuDraft.coachNotes,
          },
        },
      });
      setClient(data?.client || null);
      setCoach(data?.coach || coach);
      setOk("Menu guardado para el cliente.");
    } catch (error) {
      setErr(error?.message || "No se pudo guardar el menu");
    } finally {
      setSaving("");
    }
  }

  async function saveRoutine() {
    try {
      setSaving("routine");
      setErr("");
      setOk("");
      const data = await apiFetch(`/api/usuarios/users/me/coach-clients/${clientId}/routine`, {
        method: "PATCH",
        body: {
          routine: {
            mode: { type: routineDraft.modeType },
            structure: {
              split: routineDraft.split,
              trainingDaysPerWeek: toNullableNumber(routineDraft.trainingDaysPerWeek),
              sessionDurationMin: toNullableNumber(routineDraft.sessionDurationMin),
              focus: splitCsv(routineDraft.focusCsv),
            },
            currentPlan: {
              name: routineDraft.name,
              description: routineDraft.description,
              isActive: true,
              days: routineDraft.days.map((day) => ({
                name: day.name,
                focus: day.focus,
                exercises: splitLines(day.exercises),
              })),
            },
            progression: {
              mode: routineDraft.progressionMode,
              progressionRule: routineDraft.progressionRule,
            },
            coachNotes: routineDraft.coachNotes,
          },
        },
      });
      setClient(data?.client || null);
      setCoach(data?.coach || coach);
      setOk("Rutina guardada para el cliente.");
    } catch (error) {
      setErr(error?.message || "No se pudo guardar la rutina");
    } finally {
      setSaving("");
    }
  }

  function fillMenuBase(modeType = menuDraft.modeType) {
    setMenuDraft((draft) => ({
      ...draft,
      modeType,
      mealsByDay: buildMenuBase(client, modeType),
    }));
  }

  function fillRoutineBase(modeType = routineDraft.modeType) {
    setRoutineDraft((draft) => ({
      ...draft,
      modeType,
      ...buildRoutineBase(client, draft),
    }));
  }

  if (loading) {
    return (
      <div className="prof-page">
        <section className="prof-shell">
          <div className="prof-empty">Cargando detalle del cliente...</div>
        </section>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="prof-page">
        <section className="prof-shell">
          <div className="prof-error">{err || "Cliente no encontrado"}</div>
        </section>
      </div>
    );
  }

  const tabs = [
    { key: "resumen", label: "Resumen", emoji: "📌" },
    { key: "nutricion", label: "Nutricion", emoji: "🥗" },
    { key: "menu", label: "Menus", emoji: "🍽️" },
    { key: "rutina", label: "Rutina", emoji: "🏋️" },
    { key: "progreso", label: "Progreso", emoji: "📈" },
  ];

  return (
    <div className="prof-page">
      <section className="prof-shell">
        <div className="prof-detailHero">
          <Avatar user={client} size="large" />
          <div className="prof-detailInfo">
            <div className="prof-kicker">👤 Alumno asignado</div>
            <h1 className="prof-title">{fullName(client)}</h1>
            <div className="prof-clientEmail">{client?.email || "Sin email"}</div>
            <div className="prof-chipRow">
              <span className="prof-chip info">🎯 {goalLabel(client?.goal?.type)}</span>
              <span className="prof-chip">🔥 {fmtKcal(client?.metasActuales?.kcal)}</span>
              <span className="prof-chip good">Estado: {client?.estado || "activo"}</span>
              <span className="prof-chip">Asignado: {fmtDate(client?.coach?.assignedAt)}</span>
            </div>
          </div>
        </div>

        <div className="prof-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`prof-tab ${activeTab === tab.key ? "active" : ""}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {err ? <div className="prof-error">{err}</div> : null}
        {ok ? <div className="prof-success">{ok}</div> : null}

        {activeTab === "resumen" && (
          <div className="prof-section">
            <div className="prof-grid">
              <Metric emoji="🎯" label="Objetivo" value={goalLabel(client?.goal?.type)} />
              <Metric emoji="🔥" label="Kcal" value={fmtKcal(client?.metasActuales?.kcal)} />
              <Metric emoji="🥩" label="Proteina" value={formatGram(client?.metasActuales?.macros?.p)} />
              <Metric emoji="📦" label="Plan coach" value={planLabel(coach?.effectiveCapabilities?.planCode || coach?.plan)} />
            </div>

            <div className="prof-panel twoCol">
              <InfoBlock
                emoji="🧑‍🏫"
                title="Tu acceso profesional"
                lines={[
                  specialtyLabel(coach),
                  access.nutrition ? "Puede gestionar nutricion y menus." : "No puede gestionar nutricion.",
                  access.training ? "Puede gestionar rutinas." : "No puede gestionar rutinas.",
                ]}
              />
              <InfoBlock
                emoji="🧭"
                title="Capacidades del plan"
                lines={[
                  `Menu manual: ${yesNo(access.menuModes.manual)}`,
                  `Menu automatico: ${yesNo(access.menuModes.automatic)}`,
                  `Rutina automatica: ${yesNo(access.routineModes.automatic)}`,
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === "nutricion" && (
          <EditablePanel
            title="Nutricion y macros"
            emoji="🥗"
            locked={!access.nutrition}
            lockedText="No disponible: tu perfil no tiene especialidad de nutricion o tu plan no permite gestion nutricional."
          >
            <div className="prof-formGrid">
              <Field label="Kcal objetivo" value={nutritionDraft.kcal} onChange={(v) => setNutritionDraft((d) => ({ ...d, kcal: v }))} />
              <Field label="Proteina (g)" value={nutritionDraft.p} onChange={(v) => setNutritionDraft((d) => ({ ...d, p: v }))} />
              <Field label="Carbohidratos (g)" value={nutritionDraft.c} onChange={(v) => setNutritionDraft((d) => ({ ...d, c: v }))} />
              <Field label="Grasas (g)" value={nutritionDraft.g} onChange={(v) => setNutritionDraft((d) => ({ ...d, g: v }))} />
              <label className="prof-field">
                <span>Objetivo</span>
                <select value={nutritionDraft.goalType} onChange={(e) => setNutritionDraft((d) => ({ ...d, goalType: e.target.value }))}>
                  <option value="">Sin definir</option>
                  <option value="perder_peso">Perdida de grasa</option>
                  <option value="mantener_peso">Mantenimiento</option>
                  <option value="ganar_peso">Ganancia muscular</option>
                </select>
              </label>
              <Field label="Peso objetivo (kg)" value={nutritionDraft.targetWeightKg} onChange={(v) => setNutritionDraft((d) => ({ ...d, targetWeightKg: v }))} />
            </div>

            <label className="prof-field">
              <span>Enfoque / nota nutricional</span>
              <textarea value={nutritionDraft.approach} onChange={(e) => setNutritionDraft((d) => ({ ...d, approach: e.target.value }))} />
            </label>

            <SaveRow onSave={saveNutrition} saving={saving === "nutrition"} label="Guardar nutricion" />
          </EditablePanel>
        )}

        {activeTab === "menu" && (
          <EditablePanel
            title="Menus del cliente"
            emoji="🍽️"
            locked={!access.nutrition}
            lockedText="No disponible: tu especialidad o plan efectivo no permite gestionar menus."
          >
            <ModePicker
              modes={access.menuModes}
              value={menuDraft.modeType}
              onChange={(modeType) => setMenuDraft((d) => ({ ...d, modeType }))}
            />

            <div className="prof-formGrid">
              <Field label="Comidas por dia" value={menuDraft.mealsPerDay} onChange={(v) => setMenuDraft((d) => ({ ...d, mealsPerDay: v }))} />
              <label className="prof-field">
                <span>Distribucion</span>
                <select value={menuDraft.distribution} onChange={(e) => setMenuDraft((d) => ({ ...d, distribution: e.target.value }))}>
                  <option value="equilibrada">Equilibrada</option>
                  <option value="alta_proteina">Alta proteina</option>
                  <option value="pre_entreno">Foco pre-entreno</option>
                  <option value="simple">Simple</option>
                </select>
              </label>
              <Field label="Snack libre kcal" value={menuDraft.snackLibreKcal} onChange={(v) => setMenuDraft((d) => ({ ...d, snackLibreKcal: v, snackLibre: Number(v) > 0 }))} />
            </div>

            <div className="prof-actions compact">
              <button
                type="button"
                className="prof-btn"
                onClick={() => fillMenuBase(menuDraft.modeType)}
                disabled={!access.menuModes[menuDraft.modeType]}
              >
                <Sparkles size={16} />
                Generar base editable
              </button>
            </div>

            <div className="prof-weekGrid">
              {DAYS.map((day) => (
                <div className="prof-dayCard" key={day}>
                  <div className="prof-dayTitle">{day}</div>
                  {MEALS.map((meal) => (
                    <label className="prof-field compact" key={`${day}-${meal}`}>
                      <span>{meal}</span>
                      <textarea
                        value={menuDraft.mealsByDay?.[day]?.[meal] || ""}
                        onChange={(e) => updateMenuMeal(setMenuDraft, day, meal, e.target.value)}
                      />
                    </label>
                  ))}
                </div>
              ))}
            </div>

            <label className="prof-field">
              <span>Notas para el cliente</span>
              <textarea value={menuDraft.coachNotes} onChange={(e) => setMenuDraft((d) => ({ ...d, coachNotes: e.target.value }))} />
            </label>

            <SaveRow onSave={saveMenu} saving={saving === "menu"} label="Guardar menu" />
          </EditablePanel>
        )}

        {activeTab === "rutina" && (
          <EditablePanel
            title="Rutina del cliente"
            emoji="🏋️"
            locked={!access.training}
            lockedText="No disponible: tu especialidad o plan efectivo no permite gestionar rutinas."
          >
            <ModePicker
              modes={access.routineModes}
              value={routineDraft.modeType}
              onChange={(modeType) => setRoutineDraft((d) => ({ ...d, modeType }))}
            />

            <div className="prof-formGrid">
              <Field label="Nombre del plan" value={routineDraft.name} onChange={(v) => setRoutineDraft((d) => ({ ...d, name: v }))} />
              <Field label="Dias por semana" value={routineDraft.trainingDaysPerWeek} onChange={(v) => setRoutineDraft((d) => ({ ...d, trainingDaysPerWeek: v }))} />
              <Field label="Split" value={routineDraft.split} onChange={(v) => setRoutineDraft((d) => ({ ...d, split: v }))} />
              <Field label="Duracion min." value={routineDraft.sessionDurationMin} onChange={(v) => setRoutineDraft((d) => ({ ...d, sessionDurationMin: v }))} />
              <Field label="Focos (separados por coma)" value={routineDraft.focusCsv} onChange={(v) => setRoutineDraft((d) => ({ ...d, focusCsv: v }))} />
            </div>

            <label className="prof-field">
              <span>Descripcion</span>
              <textarea value={routineDraft.description} onChange={(e) => setRoutineDraft((d) => ({ ...d, description: e.target.value }))} />
            </label>

            <div className="prof-actions compact">
              <button
                type="button"
                className="prof-btn"
                onClick={() => fillRoutineBase(routineDraft.modeType)}
                disabled={!access.routineModes[routineDraft.modeType]}
              >
                <Sparkles size={16} />
                Generar base editable
              </button>
            </div>

            <div className="prof-weekGrid routine">
              {routineDraft.days.map((day, index) => (
                <div className="prof-dayCard" key={index}>
                  <Field label="Dia" value={day.name} onChange={(v) => updateRoutineDay(setRoutineDraft, index, { name: v })} />
                  <Field label="Foco" value={day.focus} onChange={(v) => updateRoutineDay(setRoutineDraft, index, { focus: v })} />
                  <label className="prof-field compact">
                    <span>Ejercicios</span>
                    <textarea value={day.exercises} onChange={(e) => updateRoutineDay(setRoutineDraft, index, { exercises: e.target.value })} />
                  </label>
                </div>
              ))}
            </div>

            <label className="prof-field">
              <span>Regla de progresion</span>
              <textarea value={routineDraft.progressionRule} onChange={(e) => setRoutineDraft((d) => ({ ...d, progressionRule: e.target.value }))} />
            </label>

            <SaveRow onSave={saveRoutine} saving={saving === "routine"} label="Guardar rutina" />
          </EditablePanel>
        )}

        {activeTab === "progreso" && (
          <div className="prof-section">
            <div className="prof-grid">
              <Metric emoji="⚖️" label="Peso" value={formatUnit(client?.antropometriaActual?.pesoKg, "kg")} />
              <Metric emoji="📏" label="Altura" value={formatUnit(client?.antropometriaActual?.alturaCm, "cm")} />
              <Metric emoji="🔥" label="TDEE" value={fmtKcal(client?.body?.tdeeEstimated || client?.profile?.basics?.tdeeEstimado)} />
              <Metric emoji="✅" label="Ultimo check-in" value={fmtDate(client?.stats?.lastCheckinAt)} />
            </div>
            <div className="prof-empty">El seguimiento avanzado queda listo para conectar cuando existan registros historicos reales.</div>
          </div>
        )}
      </section>
    </div>
  );
}

function EditablePanel({ title, emoji, locked, lockedText, children }) {
  return (
    <div className="prof-panel">
      <div className="prof-sectionTitle">
        <span aria-hidden="true">{emoji}</span>
        {title}
      </div>
      {locked ? <div className="prof-lock">{lockedText}</div> : children}
    </div>
  );
}

function Field({ label, value, onChange }) {
  return (
    <label className="prof-field">
      <span>{label}</span>
      <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SaveRow({ onSave, saving, label }) {
  return (
    <div className="prof-actions">
      <button type="button" className="prof-btn gold" onClick={onSave} disabled={saving}>
        <Save size={16} />
        {saving ? "Guardando..." : label}
      </button>
    </div>
  );
}

function ModePicker({ modes, value, onChange }) {
  return (
    <div className="prof-modeGrid">
      {Object.keys(MODE_LABELS).map((mode) => (
        <button
          key={mode}
          type="button"
          className={`prof-mode ${value === mode ? "active" : ""}`}
          disabled={!modes?.[mode]}
          onClick={() => onChange(mode)}
        >
          <span>{MODE_LABELS[mode]}</span>
          <small>{modes?.[mode] ? "Disponible" : "No incluido"}</small>
        </button>
      ))}
    </div>
  );
}

function InfoBlock({ emoji, title, lines }) {
  return (
    <div className="prof-infoBlock">
      <div className="prof-infoTitle">{emoji} {title}</div>
      {lines.map((line, index) => (
        <div className="prof-infoLine" key={index}>{line}</div>
      ))}
    </div>
  );
}

function getCoachAccess(coach) {
  const specialties = coach?.coachProfile?.specialties || {};
  const features = coach?.effectiveCapabilities?.features || {};
  const trialExpired = !!coach?.effectiveCapabilities?.isTrialExpired;

  const menuModes = {
    manual: !!specialties.nutrition && !trialExpired && !!features?.menus?.manualBuilder,
    semiautomatic: !!specialties.nutrition && !trialExpired && !!features?.menus?.semiAutomaticBuilder,
    automatic: !!specialties.nutrition && !trialExpired && !!features?.menus?.automaticGenerator,
  };

  const routineModes = {
    manual: !!specialties.training && !trialExpired && !!features?.routines?.manualBuilder,
    semiautomatic: !!specialties.training && !trialExpired && !!features?.routines?.semiAutomaticBuilder,
    automatic: !!specialties.training && !trialExpired && !!features?.routines?.automaticGenerator,
  };

  return {
    nutrition: Object.values(menuModes).some(Boolean),
    training: Object.values(routineModes).some(Boolean),
    menuModes,
    routineModes,
  };
}

function createNutritionDraft(client) {
  return {
    kcal: valueOrEmpty(client?.metasActuales?.kcal),
    p: valueOrEmpty(client?.metasActuales?.macros?.p),
    c: valueOrEmpty(client?.metasActuales?.macros?.c),
    g: valueOrEmpty(client?.metasActuales?.macros?.g),
    goalType: client?.goal?.type || "",
    targetWeightKg: valueOrEmpty(client?.goal?.targetWeightKg),
    approach: client?.goal?.approach || "",
  };
}

function createMenuDraft(client) {
  const menu = client?.menu || {};
  return {
    modeType: normalizeMode(menu?.mode?.type || "manual"),
    lockedByCoach: !!menu?.mode?.lockedByCoach,
    mealsPerDay: valueOrEmpty(menu?.mealConfig?.mealsPerDay || 4),
    distribution: menu?.mealConfig?.distribution || "equilibrada",
    snackLibre: !!menu?.mealConfig?.snackLibre,
    snackLibreKcal: valueOrEmpty(menu?.mealConfig?.snackLibreKcal),
    mealsByDay: normalizeMealsByDay(menu?.weeklyPlan?.mealsByDay),
    coachNotes: menu?.coachNotes || "",
  };
}

function createRoutineDraft(client) {
  const routine = client?.routine || {};
  const structure = routine?.structure || {};
  const plan = routine?.currentPlan || {};
  const days = Array.isArray(plan?.days) && plan.days.length
    ? plan.days.map((day, index) => ({
        name: day?.name || `Dia ${index + 1}`,
        focus: day?.focus || "",
        exercises: Array.isArray(day?.exercises) ? day.exercises.join("\n") : day?.exercises || "",
      }))
    : buildRoutineBase(client, { trainingDaysPerWeek: 3 }).days;

  return {
    modeType: normalizeMode(routine?.mode?.type || "manual"),
    name: plan?.name || "Plan semanal",
    description: plan?.description || "",
    split: structure?.split || "",
    trainingDaysPerWeek: valueOrEmpty(structure?.trainingDaysPerWeek || days.length || 3),
    sessionDurationMin: valueOrEmpty(structure?.sessionDurationMin || 60),
    focusCsv: Array.isArray(structure?.focus) ? structure.focus.join(", ") : "",
    days,
    progressionMode: routine?.progression?.mode || "manual",
    progressionRule: routine?.progression?.progressionRule || "",
    coachNotes: routine?.coachNotes || "",
  };
}

function buildMenuBase(client, modeType) {
  const goal = client?.goal?.type;
  const protein = goal === "ganar_peso" ? "huevos o yogur griego" : "yogur griego o claras";
  const lunch = goal === "perder_peso" ? "pollo + ensalada + arroz medido" : "pollo/carne + arroz/pasta + verduras";
  const dinner = goal === "ganar_peso" ? "carne magra + pasta + aceite de oliva" : "pescado/pollo + verduras + papa";
  const snack = goal === "ganar_peso" ? "batido proteico + banana" : "fruta + queso untable light";
  const suffix = modeType === "automatic" ? " Ajustar cantidades a macros objetivo." : "";

  return DAYS.reduce((acc, day, index) => {
    acc[day] = {
      Desayuno: `${protein} + avena.${suffix}`,
      Almuerzo: index % 2 === 0 ? lunch : "tarta proteica + ensalada",
      Merienda: snack,
      Cena: dinner,
    };
    return acc;
  }, {});
}

function buildRoutineBase(client, draft = {}) {
  const daysCount = Math.max(1, Math.min(6, Number(draft.trainingDaysPerWeek) || 3));
  const goal = client?.goal?.type;
  const focus = goal === "ganar_peso" ? "Hipertrofia" : goal === "perder_peso" ? "Fuerza + gasto calorico" : "Fuerza general";
  const templates = [
    ["Sentadilla 4x8", "Press banca 4x8", "Remo 4x10", "Plancha 3x40s"],
    ["Peso muerto rumano 3x10", "Press militar 4x8", "Jalon al pecho 4x10", "Zancadas 3x12"],
    ["Prensa 4x12", "Fondos o flexiones 3x10", "Remo bajo 4x10", "Curl femoral 3x12"],
    ["Hip thrust 4x10", "Inclinado mancuerna 3x10", "Dominadas asistidas 3x8", "Core 10 min"],
    ["Full body tecnico 3 rondas", "Cardio zona 2 20 min", "Movilidad 10 min"],
    ["Pierna + gluteo", "Empuje", "Tiron", "Acondicionamiento"],
  ];

  return {
    name: draft.name || `Rutina ${focus}`,
    split: draft.split || (daysCount >= 4 ? "Torso / pierna" : "Full body"),
    focusCsv: draft.focusCsv || focus,
    days: Array.from({ length: daysCount }, (_, index) => ({
      name: `Dia ${index + 1}`,
      focus: index % 2 === 0 ? focus : "Tecnica y accesorios",
      exercises: (templates[index] || templates[0]).join("\n"),
    })),
  };
}

function normalizeMealsByDay(mealsByDay) {
  if (!mealsByDay || typeof mealsByDay !== "object") return buildEmptyMeals();
  return DAYS.reduce((acc, day) => {
    acc[day] = MEALS.reduce((mealAcc, meal) => {
      mealAcc[meal] = mealsByDay?.[day]?.[meal] || "";
      return mealAcc;
    }, {});
    return acc;
  }, {});
}

function buildEmptyMeals() {
  return DAYS.reduce((acc, day) => {
    acc[day] = MEALS.reduce((mealAcc, meal) => {
      mealAcc[meal] = "";
      return mealAcc;
    }, {});
    return acc;
  }, {});
}

function updateMenuMeal(setter, day, meal, value) {
  setter((draft) => ({
    ...draft,
    mealsByDay: {
      ...draft.mealsByDay,
      [day]: {
        ...(draft.mealsByDay?.[day] || {}),
        [meal]: value,
      },
    },
  }));
}

function updateRoutineDay(setter, index, patch) {
  setter((draft) => ({
    ...draft,
    days: draft.days.map((day, i) => (i === index ? { ...day, ...patch } : day)),
  }));
}

function normalizeMode(mode) {
  const value = String(mode || "").toLowerCase();
  if (value.includes("auto") && !value.includes("semi")) return "automatic";
  if (value.includes("semi")) return "semiautomatic";
  return "manual";
}

function valueOrEmpty(value) {
  return value === null || value === undefined ? "" : String(value);
}

function toNullableNumber(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function splitCsv(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitLines(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatGram(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)} g` : String(value);
}

function formatUnit(value, unit) {
  if (value === null || value === undefined || value === "") return "-";
  return `${value} ${unit}`;
}

function yesNo(value) {
  return value ? "Si" : "No";
}
