import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Apple,
  CalendarDays,
  Check,
  ClipboardList,
  Copy,
  Dumbbell,
  Flame,
  Mail,
  Pencil,
  Phone,
  RotateCcw,
  Ruler,
  Save,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  UserRound,
  Weight,
  X,
} from "lucide-react";
import { Avatar, Metric } from "./profesionalPieces.jsx";
import { fmtDate, fmtKcal, fullName, goalLabel, planLabel, specialtyLabel } from "./profesionalFormat.js";
import {
  updateProfessionalClientMenu,
  updateProfessionalClientNutrition,
  updateProfessionalClientRoutine,
} from "./profesionalApi.js";
import { useProfessionalClientDetail } from "./profesionalQueries.js";
import { invalidateProfessionalClient, queryClient, queryKeys } from "../queryClient.js";
import WeeklyClientMenuPlanner from "../menus/WeeklyClientMenuPlanner.jsx";
import {
  calculateMacroKcal,
  createDailyTargetsDraft,
  NUTRITION_WEEK_DAYS,
  resolveNutritionTarget,
  serializeDailyTargets,
} from "../nutricion/dailyNutritionTargets.js";
import AppToast from "../ui/AppToast.jsx";
import "./profesionalPanel.css";

const MODE_LABELS = {
  manual: "Manual",
  semiautomatic: "Semiautomático",
  automatic: "Automático",
};

const DAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MEALS = ["Desayuno", "Almuerzo", "Merienda", "Cena"];

export default function ClienteDetalleProfesional() {
  const { clientId } = useParams();
  const [saving, setSaving] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [editingNutritionDay, setEditingNutritionDay] = useState("");
  const [editingMacros, setEditingMacros] = useState(false);
  const [editingProfileSection, setEditingProfileSection] = useState("");
  const detailQuery = useProfessionalClientDetail(clientId);
  const loading = detailQuery.isLoading;
  const loadErr = detailQuery.error?.message || "";
  const coach = detailQuery.data?.coach || null;
  const client = detailQuery.data?.client || null;

  const [nutritionDraft, setNutritionDraft] = useState(() => createNutritionDraft(null));
  const [menuDraft, setMenuDraft] = useState(() => createMenuDraft(null));
  const [routineDraft, setRoutineDraft] = useState(() => createRoutineDraft(null));

  useEffect(() => {
    setNutritionDraft(createNutritionDraft(client));
    setMenuDraft(createMenuDraft(client));
    setRoutineDraft(createRoutineDraft(client));
    setEditingNutritionDay("");
    setEditingMacros(false);
    setEditingProfileSection("");
  }, [client]);

  const access = useMemo(() => getCoachAccess(coach), [coach]);

  async function saveNutrition() {
    try {
      setSaving("nutrition");
      setErr("");
      setOk("");
      const baseKcal = calculateMacroKcal(nutritionDraft.p, nutritionDraft.c, nutritionDraft.g);
      let data = await updateProfessionalClientNutrition(clientId, {
        kcal: baseKcal ?? toNullableNumber(nutritionDraft.kcal),
        macros: {
          p: toNullableNumber(nutritionDraft.p),
          c: toNullableNumber(nutritionDraft.c),
          g: toNullableNumber(nutritionDraft.g),
        },
        goalType: nutritionDraft.goalType,
        targetWeightKg: toNullableNumber(nutritionDraft.targetWeightKg),
        approach: nutritionDraft.approach,
      });
      const weeklyTargets = serializeDailyTargets(nutritionDraft.dailyTargets);
      const currentWeeklyTargets = serializeDailyTargets(createDailyTargetsDraft(client));
      if (JSON.stringify(weeklyTargets) !== JSON.stringify(currentWeeklyTargets)) {
        data = await updateProfessionalClientMenu(clientId, {
          menu: {
            mode: {
              type: preferredAllowedMode(access.menuModes, menuDraft.modeType),
              lockedByCoach: menuDraft.lockedByCoach,
            },
            weeklyPlan: weeklyTargets,
            coachNotes: menuDraft.coachNotes,
          },
        });
      }
      queryClient.setQueryData(queryKeys.professionalClientDetail(clientId), data);
      await invalidateProfessionalClient(clientId, data?.client);
      setOk("Nutrición actualizada para el cliente.");
    } catch (error) {
      setErr(error?.message || "No se pudo guardar nutrición");
    } finally {
      setSaving("");
    }
  }

  async function saveProfileSection(section, values) {
    try {
      setSaving(`profile-${section}`);
      setErr("");
      setOk("");
      let data;

      if (section === "goal") {
        const nextDraft = {
          ...nutritionDraft,
          goalType: values.goalType,
          targetWeightKg: values.targetWeightKg,
        };
        data = await updateProfessionalClientNutrition(clientId, nutritionPayloadFromDraft(nextDraft));
        setNutritionDraft(nextDraft);
      } else if (section === "nutrition") {
        const nextDraft = { ...nutritionDraft, approach: values.note };
        data = await updateProfessionalClientNutrition(clientId, nutritionPayloadFromDraft(nextDraft));
        setNutritionDraft(nextDraft);
      } else if (section === "menu") {
        const nextDraft = { ...menuDraft, coachNotes: values.note };
        data = await updateProfessionalClientMenu(clientId, {
          menu: {
            mode: { type: preferredAllowedMode(access.menuModes, nextDraft.modeType), lockedByCoach: nextDraft.lockedByCoach },
            coachNotes: nextDraft.coachNotes,
          },
        });
        setMenuDraft(nextDraft);
      } else if (section === "routine") {
        const nextDraft = { ...routineDraft, coachNotes: values.note };
        data = await updateProfessionalClientRoutine(clientId, {
          routine: {
            mode: { type: preferredAllowedMode(access.routineModes, nextDraft.modeType) },
            coachNotes: nextDraft.coachNotes,
          },
        });
        setRoutineDraft(nextDraft);
      }

      if (data) {
        queryClient.setQueryData(queryKeys.professionalClientDetail(clientId), data);
        await invalidateProfessionalClient(clientId, data?.client);
      }
      setEditingProfileSection("");
      setOk("Perfil del cliente actualizado.");
    } catch (error) {
      setErr(error?.message || "No se pudo actualizar el perfil del cliente");
    } finally {
      setSaving("");
    }
  }

  async function saveRoutine() {
    try {
      setSaving("routine");
      setErr("");
      setOk("");
      const data = await updateProfessionalClientRoutine(clientId, {
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
      });
      queryClient.setQueryData(queryKeys.professionalClientDetail(clientId), data);
      await invalidateProfessionalClient(clientId, data?.client);
      setOk("Rutina guardada para el cliente.");
    } catch (error) {
      setErr(error?.message || "No se pudo guardar la rutina");
    } finally {
      setSaving("");
    }
  }

  function fillRoutineBase(modeType = routineDraft.modeType) {
    setRoutineDraft((draft) => ({
      ...draft,
      modeType,
      ...buildRoutineBase(client, draft),
    }));
  }

  function saveDailyTarget(dayKey, values, copyToDays = []) {
    setNutritionDraft((draft) => {
      const nextTarget = normalizeDailyTargetDraft(values);
      const dailyTargets = {
        ...(draft.dailyTargets || {}),
        [dayKey]: nextTarget,
      };
      copyToDays.forEach((key) => {
        dailyTargets[key] = { ...nextTarget };
      });
      return { ...draft, dailyTargets };
    });
    setEditingNutritionDay("");
  }

  function resetDailyTarget(dayKey) {
    setNutritionDraft((draft) => {
      const dailyTargets = { ...(draft.dailyTargets || {}) };
      delete dailyTargets[dayKey];
      return { ...draft, dailyTargets };
    });
    setEditingNutritionDay("");
  }

  function applyGeneralToWeek() {
    setNutritionDraft((draft) => ({ ...draft, dailyTargets: {} }));
  }

  function saveMacroBase(values) {
    setNutritionDraft((draft) => ({
      ...draft,
      p: valueOrEmpty(values.p),
      c: valueOrEmpty(values.c),
      g: valueOrEmpty(values.g),
      kcal: valueOrEmpty(calculateMacroKcal(values.p, values.c, values.g)),
      goalType: values.goalType,
    }));
    setEditingMacros(false);
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
          <div className="prof-error">{err || loadErr || "Cliente no encontrado"}</div>
        </section>
      </div>
    );
  }

  const tabs = [
    { key: "resumen", label: "Resumen", icon: ClipboardList },
    { key: "perfil", label: "Perfil", icon: UserRound },
    { key: "nutricion", label: "Nutrición", icon: Apple },
    { key: "menu", label: "Menús", icon: Utensils },
    { key: "rutina", label: "Rutina", icon: Dumbbell },
    { key: "progreso", label: "Progreso", icon: TrendingUp },
  ];

  return (
    <div className="prof-page">
      <section className="prof-shell">
        <div className="prof-detailHero">
          <Avatar user={client} size="large" />
          <div className="prof-detailInfo">
            <div className="prof-kicker"><UserRound size={14} /> Alumno asignado</div>
            <h1 className="prof-title">{fullName(client)}</h1>
            <div className="prof-clientEmail">{client?.email || "Sin email"}</div>
            <div className="prof-chipRow">
              <span className="prof-chip info"><Target size={14} /> {goalLabel(client?.goal?.type)}</span>
              <span className="prof-chip"><Flame size={14} /> {fmtKcal(client?.metasActuales?.kcal)}</span>
              <span className="prof-chip good">Estado: {client?.estado || "activo"}</span>
              <span className="prof-chip">Asignado: {fmtDate(client?.coach?.assignedAt)}</span>
            </div>
          </div>
        </div>

        <div className="prof-tabs">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                type="button"
                className={`prof-tab ${activeTab === tab.key ? "active" : ""}`}
                onClick={() => setActiveTab(tab.key)}
              >
                <TabIcon size={17} strokeWidth={2.35} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {detailQuery.isFetching && !detailQuery.isLoading ? <div className="prof-empty compact">Actualizando datos...</div> : null}
        {loadErr ? <div className="prof-error">{loadErr}</div> : null}
        {err ? <div className="prof-error">{err}</div> : null}
        {ok ? <div className="prof-success">{ok}</div> : null}

        {activeTab === "resumen" && (
          <div className="prof-section">
            <div className="prof-grid">
              <Metric icon={Target} label="Objetivo" value={goalLabel(client?.goal?.type)} />
              <Metric icon={Flame} label="Kcal" value={fmtKcal(client?.metasActuales?.kcal)} />
              <Metric icon={Apple} label="Proteína" value={formatGram(client?.metasActuales?.macros?.p)} />
              <Metric icon={ClipboardList} label="Plan coach" value={planLabel(coach?.effectiveCapabilities?.planCode || coach?.plan)} />
            </div>

            <div className="prof-panel twoCol">
              <InfoBlock
                icon={UserRound}
                title="Tu acceso profesional"
                lines={[
                  specialtyLabel(coach),
                  access.nutrition ? "Puede gestionar nutrición y menús." : "No puede gestionar nutrición.",
                  access.training ? "Puede gestionar rutinas." : "No puede gestionar rutinas.",
                ]}
              />
              <InfoBlock
                icon={Target}
                title="Capacidades del plan"
                lines={[
                  `Menú manual: ${yesNo(access.menuModes.manual)}`,
                  `Menú automático: ${yesNo(access.menuModes.automatic)}`,
                  `Rutina automática: ${yesNo(access.routineModes.automatic)}`,
                ]}
              />
            </div>
          </div>
        )}

        {activeTab === "perfil" && (
          <ProfileTab
            client={client}
            nutritionDraft={nutritionDraft}
            menuDraft={menuDraft}
            routineDraft={routineDraft}
            access={access}
            onEdit={setEditingProfileSection}
          />
        )}

        {activeTab === "nutricion" && (
          <EditablePanel
            title="Planificación nutricional"
            icon={Apple}
            locked={!access.nutrition}
            lockedText="No disponible: tu perfil no tiene especialidad de nutrición o tu plan no permite gestión nutricional."
          >
            <NutritionGeneralSection draft={nutritionDraft} onEdit={() => setEditingMacros(true)} />

            <DailyTargetsSection
              nutritionDraft={nutritionDraft}
              onEditDay={setEditingNutritionDay}
              onApplyGeneral={applyGeneralToWeek}
            />

            <SaveRow onSave={saveNutrition} saving={saving === "nutrition"} label="Guardar planificación" />
          </EditablePanel>
        )}

        {activeTab === "menu" && (
          <EditablePanel
            title="Menús del cliente"
            icon={Utensils}
            locked={!access.nutrition}
            lockedText="No disponible: tu especialidad o plan efectivo no permite gestionar menús."
          >
            <WeeklyClientMenuPlanner
              clientId={clientId}
              client={client}
              access={access}
              nutritionTargets={nutritionDraft}
              onToast={setToast}
            />


          </EditablePanel>
        )}

        {activeTab === "rutina" && (
          <EditablePanel
            title="Rutina del cliente"
            icon={Dumbbell}
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
              <Field label="Días por semana" value={routineDraft.trainingDaysPerWeek} onChange={(v) => setRoutineDraft((d) => ({ ...d, trainingDaysPerWeek: v }))} />
              <Field label="Split" value={routineDraft.split} onChange={(v) => setRoutineDraft((d) => ({ ...d, split: v }))} />
              <Field label="Duración min." value={routineDraft.sessionDurationMin} onChange={(v) => setRoutineDraft((d) => ({ ...d, sessionDurationMin: v }))} />
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
              <Metric icon={Scale} label="Peso" value={formatUnit(client?.antropometriaActual?.pesoKg, "kg")} />
              <Metric icon={Ruler} label="Altura" value={formatUnit(client?.antropometriaActual?.alturaCm, "cm")} />
              <Metric icon={Flame} label="TDEE" value={fmtKcal(client?.body?.tdeeEstimated || client?.profile?.basics?.tdeeEstimado)} />
              <Metric icon={Check} label="Último check-in" value={fmtDate(client?.stats?.lastCheckinAt)} />
            </div>
            <div className="prof-empty">El seguimiento avanzado queda listo para conectar cuando existan registros históricos reales.</div>
          </div>
        )}
      </section>
      {editingNutritionDay ? (
        <DailyTargetEditor
          key={editingNutritionDay}
          dayKey={editingNutritionDay}
          nutritionDraft={nutritionDraft}
          onSave={saveDailyTarget}
          onReset={resetDailyTarget}
          onClose={() => setEditingNutritionDay("")}
        />
      ) : null}
      {editingMacros ? (
        <MacroBaseEditor
          nutritionDraft={nutritionDraft}
          onSave={saveMacroBase}
          onClose={() => setEditingMacros(false)}
        />
      ) : null}
      {editingProfileSection ? (
        <ProfileEditDrawer
          key={editingProfileSection}
          section={editingProfileSection}
          nutritionDraft={nutritionDraft}
          menuDraft={menuDraft}
          routineDraft={routineDraft}
          saving={saving === `profile-${editingProfileSection}`}
          onSave={saveProfileSection}
          onClose={() => setEditingProfileSection("")}
        />
      ) : null}
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function EditablePanel({ title, icon: Icon, locked, lockedText, children }) {
  return (
    <div className="prof-panel">
      <div className="prof-sectionTitle">
        {Icon ? <Icon size={18} strokeWidth={2.3} aria-hidden="true" /> : null}
        {title}
      </div>
      {locked ? <div className="prof-lock">{lockedText}</div> : children}
    </div>
  );
}

function ProfileTab({ client, nutritionDraft, menuDraft, routineDraft, access, onEdit }) {
  const facts = profileFacts(client);
  const onboarding = onboardingFacts(client);
  const restrictions = restrictionFacts(client);

  return (
    <div className="prof-profileTab">
      <ProfileSection
        eyebrow="Información actual"
        title="Datos del cliente"
        description="Datos personales y antropométricos disponibles en el perfil."
      >
        <div className="prof-profileFactGrid">
          {facts.map((fact) => <ProfileFact key={fact.label} {...fact} />)}
        </div>
      </ProfileSection>

      <ProfileSection
        eyebrow="Objetivo y estado"
        title="Dirección del proceso"
        description="Objetivo principal y referencia corporal definida para el seguimiento."
        action={access.nutrition ? (
          <button type="button" className="prof-iconBtn small" onClick={() => onEdit("goal")} aria-label="Editar objetivo y peso">
            <Pencil size={15} />
          </button>
        ) : null}
      >
        <div className="prof-profileGoalLine">
          <div><span>Objetivo</span><strong>{goalLabel(nutritionDraft.goalType)}</strong></div>
          <div><span>Peso objetivo</span><strong>{formatUnit(nutritionDraft.targetWeightKg, "kg")}</strong></div>
          <div><span>Estado</span><strong>{client?.estado || "activo"}</strong></div>
        </div>
      </ProfileSection>

      <ProfileSection
        eyebrow="Origen: onboarding"
        title="Onboarding y preferencias"
        description="Información disponible para entender contexto, experiencia y necesidades."
      >
        {onboarding.length ? (
          <div className="prof-profileDetailGrid">
            {onboarding.map((item) => <ProfileDetail key={item.label} {...item} />)}
          </div>
        ) : (
          <div className="prof-empty compact">Todavía no hay datos adicionales de onboarding disponibles.</div>
        )}
        {restrictions.length ? (
          <div className="prof-restrictionList">
            {restrictions.map((item) => (
              <div key={item.label}>
                <span>{item.label}</span>
                <div>{item.values.map((value) => <em key={value}>{value}</em>)}</div>
              </div>
            ))}
          </div>
        ) : null}
      </ProfileSection>

      <ProfileSection
        eyebrow="Uso profesional"
        title="Ajustes del coach"
        description="Notas compactas por área. Cada ajuste se guarda en su módulo correspondiente."
      >
        <div className="prof-coachAdjustmentGrid">
          <CoachAdjustmentCard
            icon={ClipboardList}
            title="Ajuste nutricional"
            text={nutritionDraft.approach}
            disabled={!access.nutrition}
            onEdit={() => onEdit("nutrition")}
          />
          <CoachAdjustmentCard
            icon={Utensils}
            title="Ajuste de menús"
            text={menuDraft.coachNotes}
            disabled={!access.nutrition}
            onEdit={() => onEdit("menu")}
          />
          <CoachAdjustmentCard
            icon={Dumbbell}
            title="Ajuste de rutina"
            text={routineDraft.coachNotes}
            disabled={!access.training}
            onEdit={() => onEdit("routine")}
          />
        </div>
      </ProfileSection>
    </div>
  );
}

function ProfileSection({ eyebrow, title, description, action, children }) {
  return (
    <section className="prof-profileSection">
      <div className="prof-profileSectionHead">
        <div>
          <span>{eyebrow}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const ProfileFact = React.memo(function ProfileFact({ icon, label, value }) {
  return (
    <div className="prof-profileFact">
      {React.createElement(icon, { size: 16, "aria-hidden": true })}
      <div><span>{label}</span><strong>{value || "-"}</strong></div>
    </div>
  );
});

const ProfileDetail = React.memo(function ProfileDetail({ label, value }) {
  return <div className="prof-profileDetail"><span>{label}</span><strong>{value}</strong></div>;
});

const CoachAdjustmentCard = React.memo(function CoachAdjustmentCard({ icon, title, text, disabled, onEdit }) {
  return (
    <article className="prof-coachAdjustment">
      <div className="prof-coachAdjustmentHead">
        <span>{React.createElement(icon, { size: 15 })}{title}</span>
        <button type="button" className="prof-iconBtn small" disabled={disabled} onClick={onEdit} aria-label={`Editar ${title}`}>
          <Pencil size={14} />
        </button>
      </div>
      <p>{text || (disabled ? "Sin acceso para editar esta área." : "Sin ajustes cargados todavía.")}</p>
    </article>
  );
});

function NutritionGeneralSection({ draft, onEdit }) {
  const calculatedKcal = calculateMacroKcal(draft.p, draft.c, draft.g);
  const hasMacros = calculatedKcal !== null;
  return (
    <section className="prof-nutritionBlock prof-macroBaseCard">
      <div className="prof-nutritionBlockHead">
        <div>
          <span className="prof-nutritionEyebrow">Base del plan</span>
          <h3>Macros base</h3>
          <p>Los días sin configuración propia heredan esta distribución.</p>
        </div>
        <button type="button" className="prof-btn compact" onClick={onEdit}>
          <Pencil size={15} />
          Editar
        </button>
      </div>

      <div className="prof-macroBaseSummary">
        <div className="prof-calculatedKcal">
          <span>{hasMacros ? "Kcal calculadas" : "Completá los macros base"}</span>
          <strong>{hasMacros ? displayTargetValue(calculatedKcal, "kcal") : "Pendiente"}</strong>
          <small>{hasMacros ? "Según proteína, carbohidratos y grasas" : "Completá P/C/G para calcular kcal"}</small>
        </div>
        <NutritionMacro label="Proteína" value={draft.p} suffix=" g" />
        <NutritionMacro label="Carbs" value={draft.c} suffix=" g" />
        <NutritionMacro label="Grasas" value={draft.g} suffix=" g" />
      </div>
      <div className="prof-macroBaseGoal"><span>Objetivo nutricional</span><strong>{goalLabel(draft.goalType)}</strong></div>
    </section>
  );
}

function DailyTargetsSection({ nutritionDraft, onEditDay, onApplyGeneral }) {
  const baseKcal = calculateMacroKcal(nutritionDraft.p, nutritionDraft.c, nutritionDraft.g);
  return (
    <section className="prof-nutritionBlock prof-dailyTargetsSection">
      <div className="prof-nutritionBlockHead">
        <div>
          <span className="prof-nutritionEyebrow">Semana flexible</span>
          <h3>Distribución diaria</h3>
          <p>Personalizá días de entrenamiento, descanso o refeeds sin perder la referencia general.</p>
        </div>
        <button type="button" className="prof-btn compact" onClick={onApplyGeneral}>
          <RotateCcw size={15} />
          Aplicar general a toda la semana
        </button>
      </div>

      <div className="prof-dailyTargetGrid">
        {NUTRITION_WEEK_DAYS.map((day) => (
          <DailyTargetCard
            key={day.key}
            day={day}
            target={resolveNutritionTarget(nutritionDraft, day.key)}
            baseKcal={baseKcal}
            onEdit={onEditDay}
          />
        ))}
      </div>
    </section>
  );
}

const DailyTargetCard = React.memo(function DailyTargetCard({ day, target, baseKcal, onEdit }) {
  const targetKcal = Number(target.kcal);
  const hasTarget = Number.isFinite(targetKcal) && targetKcal > 0;
  return (
    <button type="button" className={`prof-dailyTargetCard ${target.customized ? "custom" : ""}`} onClick={() => onEdit(day.key)}>
      <div className="prof-dailyTargetTop">
        <div>
          <span className="prof-dailyTargetDay">{day.label}</span>
          <span className={`prof-dailyTargetBadge ${target.customized ? "custom" : ""}`}>
            {target.customized ? "Personalizado" : "General"}
          </span>
        </div>
        <Pencil size={16} aria-hidden="true" />
      </div>
      {hasTarget ? (
        <>
          <strong>{displayTargetValue(target.kcal, "kcal")}</strong>
          <span className="prof-dailyTargetMacros">{targetMacroLine(target)}</span>
          <DailyKcalBar targetKcal={targetKcal} baseKcal={baseKcal} customized={target.customized} />
        </>
      ) : (
        <div className="prof-dailyTargetEmpty">
          <strong>Sin macros base</strong>
          <span>Completá P/C/G para calcular kcal</span>
        </div>
      )}
      {target.note ? <small>{target.note}</small> : <small className="muted">Sin nota específica</small>}
    </button>
  );
});

function DailyKcalBar({ targetKcal, baseKcal, customized }) {
  const base = Number(baseKcal);
  const current = Number(targetKcal);
  const hasBase = Number.isFinite(base) && base > 0;
  const percent = hasBase ? Math.min(130, Math.max(0, (current / base) * 100)) : 0;
  const delta = hasBase ? Math.round(current - base) : 0;
  const tone = !customized ? "general" : delta > 0 ? "high" : delta < 0 ? "low" : "general";
  return (
    <div className="prof-kcalBarWrap">
      <div className={`prof-kcalBar ${tone}`} aria-hidden="true">
        <span style={{ width: `${hasBase ? percent : 0}%` }} />
      </div>
      <small className="prof-kcalBarMeta">
        {hasBase ? `${Math.round(percent)}% de la base${customized && delta ? ` / ${delta > 0 ? "+" : ""}${delta} kcal` : ""}` : "Sin referencia base"}
      </small>
    </div>
  );
}

function MacroBaseEditor({ nutritionDraft, onSave, onClose }) {
  const [localDraft, setLocalDraft] = useState(() => ({
    p: valueOrEmpty(nutritionDraft.p),
    c: valueOrEmpty(nutritionDraft.c),
    g: valueOrEmpty(nutritionDraft.g),
    goalType: nutritionDraft.goalType || "",
  }));
  const calculatedKcal = calculateMacroKcal(localDraft.p, localDraft.c, localDraft.g);

  return (
    <DrawerShell
      eyebrow="Plan base"
      title="Editar macros base"
      description="Las calorías se calculan automáticamente según P/C/G."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="prof-btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="prof-btn gold" onClick={() => onSave(localDraft)}>
            <Save size={16} />
            Guardar cambios
          </button>
        </>
      )}
    >
      <CalculatedKcalPreview kcal={calculatedKcal} />
      <div className="prof-formGrid">
        <Field label="Proteína (g)" inputMode="decimal" value={localDraft.p} onChange={(value) => setLocalDraft((current) => ({ ...current, p: value }))} />
        <Field label="Carbohidratos (g)" inputMode="decimal" value={localDraft.c} onChange={(value) => setLocalDraft((current) => ({ ...current, c: value }))} />
        <Field label="Grasas (g)" inputMode="decimal" value={localDraft.g} onChange={(value) => setLocalDraft((current) => ({ ...current, g: value }))} />
      </div>
      <label className="prof-field">
        <span>Objetivo nutricional</span>
        <select value={localDraft.goalType} onChange={(event) => setLocalDraft((current) => ({ ...current, goalType: event.target.value }))}>
          <option value="">Sin definir</option>
          <option value="perder_peso">Pérdida de grasa</option>
          <option value="mantener_peso">Mantenimiento</option>
          <option value="ganar_peso">Ganancia muscular</option>
        </select>
      </label>
    </DrawerShell>
  );
}

function DailyTargetEditor({ dayKey, nutritionDraft, onSave, onReset, onClose }) {
  const day = NUTRITION_WEEK_DAYS.find((item) => item.key === dayKey);
  const resolved = resolveNutritionTarget(nutritionDraft, dayKey);
  const [localDraft, setLocalDraft] = useState(() => ({
    p: valueOrEmpty(resolved.p),
    c: valueOrEmpty(resolved.c),
    g: valueOrEmpty(resolved.g),
    note: resolved.note || "",
  }));
  const [copyToDays, setCopyToDays] = useState([]);
  const calculatedKcal = calculateMacroKcal(localDraft.p, localDraft.c, localDraft.g);

  function toggleCopyDay(key) {
    setCopyToDays((current) => (
      current.includes(key)
        ? current.filter((item) => item !== key)
        : [...current, key]
    ));
  }

  return (
    <div className="prof-dailyDrawerBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="prof-dailyDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prof-dailyDrawerTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="prof-dailyDrawerHead">
          <div>
            <span className="prof-nutritionEyebrow">
              <CalendarDays size={14} />
              Meta diaria
            </span>
            <h3 id="prof-dailyDrawerTitle">{day?.label || "Día"}</h3>
            <p>Los cambios se aplican recién al guardar este día.</p>
          </div>
          <button type="button" className="prof-iconBtn" onClick={onClose} aria-label="Cerrar edición del día">
            <X size={18} />
          </button>
        </div>

        <div className="prof-dailyDrawerBody">
          <CalculatedKcalPreview kcal={calculatedKcal} />
          <div className="prof-formGrid">
            <Field label="Proteína (g)" inputMode="decimal" value={localDraft.p} onChange={(value) => setLocalDraft((current) => ({ ...current, p: value }))} />
            <Field label="Carbohidratos (g)" inputMode="decimal" value={localDraft.c} onChange={(value) => setLocalDraft((current) => ({ ...current, c: value }))} />
            <Field label="Grasas (g)" inputMode="decimal" value={localDraft.g} onChange={(value) => setLocalDraft((current) => ({ ...current, g: value }))} />
          </div>

          <label className="prof-field">
            <span>Nota corta del día</span>
            <textarea
              maxLength={180}
              placeholder="Ej: pierna, descanso o día libre controlado"
              value={localDraft.note}
              onChange={(event) => setLocalDraft((current) => ({ ...current, note: event.target.value }))}
            />
          </label>

          <div className="prof-copyDays">
            <div>
              <strong>Copiar también a otros días</strong>
              <span>Opcional. Se guardarán con esta misma distribución.</span>
            </div>
            <div className="prof-copyDayGrid">
              {NUTRITION_WEEK_DAYS.filter((item) => item.key !== dayKey).map((item) => {
                const selected = copyToDays.includes(item.key);
                return (
                  <button
                    type="button"
                    className={selected ? "selected" : ""}
                    key={item.key}
                    onClick={() => toggleCopyDay(item.key)}
                  >
                    {selected ? <Check size={14} /> : <Copy size={14} />}
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="prof-dailyDrawerFooter">
          <button type="button" className="prof-btn" onClick={() => onReset(dayKey)}>
            <RotateCcw size={16} />
            Restaurar general
          </button>
          <button type="button" className="prof-btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="prof-btn gold" onClick={() => onSave(dayKey, localDraft, copyToDays)}>
            <Save size={16} />
            Guardar cambios
          </button>
        </div>
      </section>
    </div>
  );
}

function ProfileEditDrawer({ section, nutritionDraft, menuDraft, routineDraft, saving, onSave, onClose }) {
  const isGoal = section === "goal";
  const sectionConfig = {
    goal: { title: "Objetivo y estado", description: "Actualizá el objetivo principal y el peso de referencia." },
    nutrition: { title: "Ajuste nutricional", description: "Nota breve para orientar decisiones nutricionales." },
    menu: { title: "Ajuste de menús", description: "Indicaciones internas sobre selección y organización de menús." },
    routine: { title: "Ajuste de rutina", description: "Indicaciones internas para el trabajo de entrenamiento." },
  }[section] || {};
  const initialNote = section === "nutrition"
    ? nutritionDraft.approach
    : section === "menu"
      ? menuDraft.coachNotes
      : routineDraft.coachNotes;
  const [localDraft, setLocalDraft] = useState(() => (
    isGoal
      ? { goalType: nutritionDraft.goalType || "", targetWeightKg: valueOrEmpty(nutritionDraft.targetWeightKg) }
      : { note: initialNote || "" }
  ));

  return (
    <DrawerShell
      eyebrow="Perfil del cliente"
      title={sectionConfig.title}
      description={sectionConfig.description}
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="prof-btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="prof-btn gold" disabled={saving} onClick={() => onSave(section, localDraft)}>
            <Save size={16} />
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      )}
    >
      {isGoal ? (
        <div className="prof-formGrid two">
          <label className="prof-field">
            <span>Objetivo principal</span>
            <select value={localDraft.goalType} onChange={(event) => setLocalDraft((current) => ({ ...current, goalType: event.target.value }))}>
              <option value="">Sin definir</option>
              <option value="perder_peso">Pérdida de grasa</option>
              <option value="mantener_peso">Mantenimiento</option>
              <option value="ganar_peso">Ganancia muscular</option>
            </select>
          </label>
          <Field label="Peso objetivo (kg)" inputMode="decimal" value={localDraft.targetWeightKg} onChange={(value) => setLocalDraft((current) => ({ ...current, targetWeightKg: value }))} />
        </div>
      ) : (
        <label className="prof-field">
          <span>Ajuste del coach</span>
          <textarea
            className="prof-compactTextarea"
            maxLength={section === "nutrition" ? 120 : 3000}
            placeholder="Escribí un ajuste breve y accionable"
            value={localDraft.note}
            onChange={(event) => setLocalDraft({ note: event.target.value })}
          />
        </label>
      )}
    </DrawerShell>
  );
}

function DrawerShell({ eyebrow, title, description, onClose, footer, children }) {
  return (
    <div className="prof-dailyDrawerBackdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="prof-dailyDrawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prof-sharedDrawerTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="prof-dailyDrawerHead">
          <div>
            <span className="prof-nutritionEyebrow">{eyebrow}</span>
            <h3 id="prof-sharedDrawerTitle">{title}</h3>
            <p>{description}</p>
          </div>
          <button type="button" className="prof-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="prof-dailyDrawerBody">{children}</div>
        <div className="prof-dailyDrawerFooter">{footer}</div>
      </section>
    </div>
  );
}

function CalculatedKcalPreview({ kcal }) {
  return (
    <div className="prof-kcalFormula">
      <span>Kcal calculadas automáticamente</span>
      <strong>{displayTargetValue(kcal, "kcal")}</strong>
      <small>Proteína x 4 + carbohidratos x 4 + grasas x 9</small>
    </div>
  );
}

function NutritionMacro({ label, value, suffix = "", tone = "" }) {
  return (
    <div className={`prof-nutritionMacro ${tone}`}>
      <span>{label}</span>
      <strong>{displayTargetValue(value, suffix)}</strong>
    </div>
  );
}

function Field({ label, value, onChange, inputMode }) {
  return (
    <label className="prof-field">
      <span>{label}</span>
      <input inputMode={inputMode} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
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

function InfoBlock({ icon: Icon, title, lines }) {
  return (
    <div className="prof-infoBlock">
      <div className="prof-infoTitle">
        {Icon ? <Icon size={16} strokeWidth={2.3} aria-hidden="true" /> : null}
        {title}
      </div>
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
    canCreateMenu: !!specialties.nutrition && !trialExpired && !!(features?.menus?.ownTemplates || features?.menus?.manualBuilder),
    canUseMenuSuggestions: !!specialties.nutrition && !trialExpired && !!(features?.menus?.semiAutomaticBuilder || features?.menus?.automaticGenerator),
    routineModes,
  };
}

function createNutritionDraft(client) {
  const p = valueOrEmpty(client?.metasActuales?.macros?.p);
  const c = valueOrEmpty(client?.metasActuales?.macros?.c);
  const g = valueOrEmpty(client?.metasActuales?.macros?.g);
  return {
    kcal: valueOrEmpty(calculateMacroKcal(p, c, g) ?? client?.metasActuales?.kcal),
    p,
    c,
    g,
    goalType: client?.goal?.type || "",
    targetWeightKg: valueOrEmpty(client?.goal?.targetWeightKg),
    approach: client?.goal?.approach || "",
    dailyTargets: createDailyTargetsDraft(client),
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

function preferredAllowedMode(modes = {}, preferred = "manual") {
  if (modes?.[preferred]) return preferred;
  return Object.keys(MODE_LABELS).find((mode) => modes?.[mode]) || "manual";
}

function normalizeDailyTargetDraft(target = {}) {
  const p = valueOrEmpty(target.p);
  const c = valueOrEmpty(target.c);
  const g = valueOrEmpty(target.g);
  return {
    kcal: valueOrEmpty(calculateMacroKcal(p, c, g) ?? target.kcal),
    p,
    c,
    g,
    note: String(target.note || "").trim(),
  };
}

function nutritionPayloadFromDraft(draft = {}) {
  return {
    kcal: calculateMacroKcal(draft.p, draft.c, draft.g) ?? toNullableNumber(draft.kcal),
    macros: {
      p: toNullableNumber(draft.p),
      c: toNullableNumber(draft.c),
      g: toNullableNumber(draft.g),
    },
    goalType: draft.goalType,
    targetWeightKg: toNullableNumber(draft.targetWeightKg),
    approach: draft.approach,
  };
}

function profileFacts(client) {
  const basics = client?.profile?.basics || {};
  const birthDate = firstPresent(basics.fechaNacimiento, client?.body?.birthDate);
  const facts = [
    { icon: UserRound, label: "Nombre", value: fullName(client) },
    { icon: Mail, label: "Email", value: client?.email || "-" },
    { icon: Target, label: "Estado", value: client?.estado || "activo" },
    { icon: CalendarDays, label: "Asignado", value: fmtDate(client?.coach?.assignedAt) },
    { icon: Weight, label: "Peso actual", value: formatUnit(firstPresent(client?.antropometriaActual?.pesoKg, client?.body?.weightKg), "kg") },
    { icon: Ruler, label: "Altura", value: formatUnit(firstPresent(client?.antropometriaActual?.alturaCm, client?.body?.heightCm), "cm") },
    { icon: CalendarDays, label: "Edad", value: ageLabel(birthDate) },
    { icon: Target, label: "Sexo", value: firstPresent(basics.genero, client?.body?.gender, "-") },
  ];
  const phone = firstPresent(client?.profile?.telefono, basics.telefono, client?.phone);
  if (phone) facts.push({ icon: Phone, label: "Teléfono", value: phone });
  return facts;
}

function onboardingFacts(client) {
  const basics = client?.profile?.basics || {};
  const onboarding = client?.onboarding || {};
  const routine = client?.routine || {};
  return compactFacts([
    ["Objetivo declarado", goalLabel(firstPresent(client?.goal?.type, onboarding?.goalType))],
    ["Experiencia", firstPresent(basics.experienciaPesas, client?.body?.trainingExperience, onboarding?.trainingExperience)],
    ["Frecuencia / disponibilidad", firstPresent(basics.frecuenciaEjercicio, client?.body?.exerciseFrequency, routine?.structure?.trainingDaysPerWeek)],
    ["Actividad diaria", firstPresent(basics.actividadDiaria, client?.body?.dailyActivity)],
    ["Equipamiento", listLabel(firstPresent(onboarding?.equipment, onboarding?.equipamiento, basics?.equipamiento))],
    ["Lesiones o molestias", listLabel(firstPresent(onboarding?.injuries, onboarding?.lesiones, basics?.lesiones))],
    ["Notas del cliente", firstPresent(onboarding?.notes, onboarding?.notas, client?.profile?.notes)],
  ]);
}

function restrictionFacts(client) {
  const restrictions = client?.menu?.restrictions || {};
  return [
    ["Preferidos", firstPresent(restrictions.preferredFoods, restrictions.favoriteFoods, restrictions.favoriteMeals)],
    ["No consume", restrictions.excludedFoods],
    ["Alergias", restrictions.allergies],
    ["Intolerancias", restrictions.intolerances],
  ]
    .map(([label, value]) => ({ label, values: normalizeList(value) }))
    .filter((item) => item.values.length);
}

function compactFacts(entries) {
  return entries
    .filter(([, value]) => value !== null && value !== undefined && value !== "" && value !== "-")
    .map(([label, value]) => ({ label, value: String(value) }));
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (value === null || value === undefined || value === "") return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function listLabel(value) {
  const list = normalizeList(value);
  return list.length ? list.join(", ") : "";
}

function firstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function ageLabel(value) {
  if (!value) return "-";
  const birthDate = new Date(value);
  if (Number.isNaN(birthDate.getTime())) return "-";
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const monthDifference = now.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && now.getDate() < birthDate.getDate())) age -= 1;
  return age >= 0 && age < 130 ? `${age} años` : "-";
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

function displayTargetValue(value, suffix = "") {
  if (value === null || value === undefined || value === "") return suffix ? "Sin configurar" : "Pendiente";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return `${Math.round(number)}${suffix ? ` ${suffix}` : ""}`;
}

function targetMacroLine(target = {}) {
  return `P ${displayTargetValue(target.p, "g")} / C ${displayTargetValue(target.c, "g")} / G ${displayTargetValue(target.g, "g")}`;
}

function formatUnit(value, unit) {
  if (value === null || value === undefined || value === "") return "-";
  return `${value} ${unit}`;
}

function yesNo(value) {
  return value ? "Sí" : "No";
}
