import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Apple,
  BarChart3,
  Beef,
  CalendarDays,
  Check,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Droplets,
  Dumbbell,
  Flame,
  LineChart,
  Mail,
  Pencil,
  Phone,
  PlusCircle,
  RefreshCw,
  RotateCcw,
  Ruler,
  Save,
  Scale,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Utensils,
  UserRound,
  Weight,
  Wheat,
  X,
} from "lucide-react";
import { Avatar, Metric } from "./profesionalPieces.jsx";
import { fmtDate, fmtKcal, fullName, goalLabel, planLabel, specialtyLabel } from "./profesionalFormat.js";
import {
  updateProfessionalClientMenu,
  updateProfessionalClientNutrition,
  updateProfessionalClientProgress,
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
  resolveNutritionWeek,
  serializeDailyTargets,
} from "../nutricion/dailyNutritionTargets.js";
import AppToast from "../ui/AppToast.jsx";
import { buildNutritionAssignmentImpact } from "./nutritionAssignmentImpact.js";
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
  const [editingProgressCheckin, setEditingProgressCheckin] = useState(false);
  const [pendingNutritionSave, setPendingNutritionSave] = useState(null);
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
    setEditingProgressCheckin(false);
    setPendingNutritionSave(null);
  }, [client]);

  const access = useMemo(() => getCoachAccess(coach), [coach]);
  const nutritionAssignmentImpact = useMemo(
    () => buildNutritionAssignmentImpact(client, nutritionDraft),
    [client, nutritionDraft]
  );

  async function saveNutrition() {
    await requestNutritionSave(nutritionDraft, "Nutrición actualizada para el cliente.");
  }

  async function persistNutritionDraft(
    nextDraft,
    okMessage = "Nutrición actualizada para el cliente.",
    assignmentInvalidation = null
  ) {
    try {
      setSaving("nutrition");
      setErr("");
      setOk("");
      const data = await updateProfessionalClientNutrition(
        clientId,
        nutritionPayloadFromDraft(nextDraft, assignmentInvalidation)
      );
      queryClient.setQueryData(queryKeys.professionalClientDetail(clientId), data);
      await invalidateProfessionalClient(clientId, data?.client);
      const invalidatedDays = data?.assignmentInvalidation?.affectedDays?.length || 0;
      const reconciledExisting = invalidatedDays > 0 && data?.assignmentInvalidation?.changedDays === 0;
      setOk(
        invalidatedDays
          ? `${reconciledExisting ? "Asignaciones obsoletas revisadas." : "Metas actualizadas."} Se desasignaron menús de ${invalidatedDays} ${invalidatedDays === 1 ? "día afectado" : "días afectados"} y sus snapshots quedaron preservados.`
          : okMessage
      );
      setPendingNutritionSave(null);
      return data;
    } catch (error) {
      if (error?.code === "NUTRITION_ASSIGNMENTS_CONFIRMATION_REQUIRED" && error?.impact) {
        setPendingNutritionSave({
          draft: nextDraft,
          okMessage,
          impact: error.impact,
        });
        setErr("");
        return null;
      }
      setErr(error?.message || "No se pudo guardar nutrición");
      throw error;
    } finally {
      setSaving("");
    }
  }

  async function requestNutritionSave(nextDraft, okMessage) {
    const impact = buildNutritionAssignmentImpact(client, nextDraft);
    if (impact.affectedDays.length) {
      setPendingNutritionSave({ draft: nextDraft, okMessage, impact });
      return;
    }
    try {
      await persistNutritionDraft(nextDraft, okMessage);
    } catch {
      // El error ya queda visible en la pantalla principal.
    }
  }

  async function confirmNutritionSave() {
    if (!pendingNutritionSave) return;
    try {
      await persistNutritionDraft(
        pendingNutritionSave.draft,
        pendingNutritionSave.okMessage,
        {
          confirmed: true,
          affectedDays: pendingNutritionSave.impact.affectedDayKeys,
        }
      );
    } catch {
      // El error ya queda visible en la pantalla principal.
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

  async function saveProgressCheckin(values) {
    try {
      setSaving("progress");
      setErr("");
      setOk("");
      const data = await updateProfessionalClientProgress(clientId, {
        progress: {
          checkin: {
            date: values.date,
            weightKg: toNullableNumber(values.weightKg),
            dietAdherencePct: toNullableNumber(values.dietAdherencePct),
            workoutAdherencePct: toNullableNumber(values.workoutAdherencePct),
            plannedSessions: toNullableNumber(values.plannedSessions),
            completedSessions: toNullableNumber(values.completedSessions),
            note: values.note,
            status: values.status,
          },
        },
      });
      queryClient.setQueryData(queryKeys.professionalClientDetail(clientId), data);
      await invalidateProfessionalClient(clientId, data?.client);
      setEditingProgressCheckin(false);
      setOk("Check-in de progreso guardado.");
    } catch (error) {
      setErr(error?.message || "No se pudo guardar el check-in");
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

  function recalculateNutritionWeek() {
    setNutritionDraft((draft) => ({ ...draft }));
    setOk("Semana recalculada con los días generales ajustados.");
  }

  async function saveMacroBase(values) {
    const nextDraft = {
      ...nutritionDraft,
      p: valueOrEmpty(values.p),
      c: valueOrEmpty(values.c),
      g: valueOrEmpty(values.g),
      kcal: valueOrEmpty(calculateMacroKcal(values.p, values.c, values.g)),
      goalType: values.goalType,
    };
    setNutritionDraft(nextDraft);
    setEditingMacros(false);
    await requestNutritionSave(nextDraft, "Macros base guardados para el cliente.");
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
              client={client}
              nutritionDraft={nutritionDraft}
              onEditDay={setEditingNutritionDay}
              onApplyGeneral={applyGeneralToWeek}
              onRecalculateWeek={recalculateNutritionWeek}
            />

            {nutritionAssignmentImpact.affectedDays.length ? (
              <NutritionAssignmentImpactNotice
                impact={nutritionAssignmentImpact}
                onReview={() => setPendingNutritionSave({
                  draft: nutritionDraft,
                  okMessage: "Asignaciones nutricionales revisadas.",
                  impact: nutritionAssignmentImpact,
                })}
              />
            ) : null}

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
          <ClientProgressTab
            client={client}
            onNewCheckin={() => setEditingProgressCheckin(true)}
            canEdit={access.training || access.nutrition}
          />
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
      {editingProgressCheckin ? (
        <ProgressCheckinDrawer
          client={client}
          saving={saving === "progress"}
          onSave={saveProgressCheckin}
          onClose={() => setEditingProgressCheckin(false)}
        />
      ) : null}
      {pendingNutritionSave ? (
        <NutritionAssignmentConfirmDialog
          impact={pendingNutritionSave.impact}
          saving={saving === "nutrition"}
          onCancel={() => setPendingNutritionSave(null)}
          onConfirm={confirmNutritionSave}
        />
      ) : null}
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function NutritionAssignmentImpactNotice({ impact, onReview }) {
  const count = impact?.affectedDays?.length || 0;
  const staleOnly = impact?.staleDays > 0 && impact?.changedDays === 0;
  if (!count) return null;
  return (
    <aside className="prof-nutritionImpactNotice" role="status">
      <span className="prof-nutritionImpactIcon"><AlertTriangle size={19} /></span>
      <div>
        <strong>
          {staleOnly
            ? `Hay ${count} ${count === 1 ? "día con un menú anterior" : "días con menús anteriores"} a la última actualización de metas.`
            : `Las nuevas metas afectan ${count} ${count === 1 ? "día con menú asignado" : "días con menús asignados"}.`}
        </strong>
        <p>
          {staleOnly
            ? "Revisalos y desasignalos antes de continuar con la planificación actual."
            : "Al guardar, te vamos a pedir confirmación antes de desasignarlos."} Las plantillas y los snapshots anteriores no se borran.
        </p>
        <div className="prof-nutritionImpactDays">
          {impact.affectedDays.map((day) => <span key={day.key}>{day.label}</span>)}
        </div>
        {onReview ? (
          <button type="button" className="prof-btn compact" onClick={onReview}>
            <RefreshCw size={14} />
            Revisar asignaciones
          </button>
        ) : null}
      </div>
    </aside>
  );
}

function NutritionAssignmentConfirmDialog({ impact, saving, onCancel, onConfirm }) {
  const affectedDays = impact?.affectedDays || [];
  const count = affectedDays.length;
  const assignedMenus = impact?.assignedMenus || count;
  const staleOnly = impact?.staleDays > 0 && impact?.changedDays === 0;

  return (
    <div className="prof-modalBackdrop prof-nutritionConfirmBackdrop" role="presentation" onMouseDown={saving ? undefined : onCancel}>
      <section
        className="prof-nutritionConfirmDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="prof-nutritionConfirmTitle"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="prof-nutritionConfirmHeader">
          <span className="prof-nutritionConfirmIcon"><AlertTriangle size={24} /></span>
          <div>
            <span>Revisión necesaria</span>
            <h3 id="prof-nutritionConfirmTitle">
              {staleOnly ? "Desasignar menús de metas anteriores" : "Actualizar metas y desasignar menús"}
            </h3>
            <p>
              {staleOnly
                ? "Estas asignaciones son anteriores a la última actualización nutricional."
                : "La referencia nutricional cambió en días que ya tenían una asignación."}
            </p>
          </div>
          <button type="button" className="prof-iconBtn" onClick={onCancel} disabled={saving} aria-label="Cerrar confirmación">
            <X size={18} />
          </button>
        </header>

        <div className="prof-nutritionConfirmBody">
          <div className="prof-nutritionConfirmSummary">
            <div>
              <span>Días afectados</span>
              <strong>{count}</strong>
            </div>
            <div>
              <span>Menús y alternativas</span>
              <strong>{assignedMenus}</strong>
            </div>
            <div>
              <span>Meta semanal</span>
              <strong>{formatKcalChange(impact?.previousWeeklyKcal, impact?.nextWeeklyKcal)}</strong>
            </div>
          </div>

          <div className="prof-nutritionConfirmDays">
            {affectedDays.map((day) => (
              <article key={day.key}>
                <strong>{day.label}</strong>
                <span>{formatDailyTarget(day.previousTarget)} <b>→</b> {formatDailyTarget(day.nextTarget)}</span>
                <small>{day.assignedMenus} {day.assignedMenus === 1 ? "menú asignado" : "menús/alternativas asignados"}</small>
              </article>
            ))}
          </div>

          <div className="prof-nutritionConfirmSafety">
            <ShieldCheck size={19} />
            <div>
              <strong>Desasignación segura</strong>
              <p>Solo se quitan las asignaciones de estos días. No se eliminan plantillas, menús de biblioteca ni snapshots: la última asignación queda respaldada.</p>
            </div>
          </div>
        </div>

        <footer className="prof-nutritionConfirmActions">
          <button type="button" className="prof-btn" onClick={onCancel} disabled={saving}>Volver y revisar</button>
          <button type="button" className="prof-btn gold" onClick={onConfirm} disabled={saving}>
            <Save size={16} />
            {saving ? "Actualizando..." : `Guardar y desasignar ${count} ${count === 1 ? "día" : "días"}`}
          </button>
        </footer>
      </section>
    </div>
  );
}

function formatDailyTarget(target = {}) {
  const kcal = Number.isFinite(Number(target?.kcal)) ? `${Math.round(Number(target.kcal))} kcal` : "sin kcal";
  const protein = Number.isFinite(Number(target?.p)) ? `P ${Math.round(Number(target.p))} g` : "P —";
  return `${kcal} · ${protein}`;
}

function formatKcalChange(previous, next) {
  const from = Number.isFinite(Number(previous)) ? `${Math.round(Number(previous))}` : "—";
  const to = Number.isFinite(Number(next)) ? `${Math.round(Number(next))}` : "—";
  return `${from} → ${to} kcal`;
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

function ClientProgressTab({ client, onNewCheckin, canEdit }) {
  const progress = useMemo(() => buildClientProgressData(client), [client]);

  return (
    <div className="prof-progressTab">
      <section className="prof-progressHero">
        <div>
          <span className="prof-nutritionEyebrow">
            <LineChart size={14} strokeWidth={2.4} />
            Seguimiento real
          </span>
          <h3>Progreso del alumno</h3>
          <p>Peso, adherencia nutricional, rutina y check-ins semanales en una vista clara para tomar decisiones.</p>
        </div>
        {canEdit ? (
          <button type="button" className="prof-btn gold" onClick={onNewCheckin}>
            <PlusCircle size={16} />
            Registrar check-in
          </button>
        ) : null}
      </section>

      <ClientProgressOverview progress={progress} />

      {!progress.hasCheckins ? (
        <ClientProgressEmptyState canEdit={canEdit} onNewCheckin={onNewCheckin} />
      ) : null}

      <ClientWeightTrendCard progress={progress} />

      <div className="prof-progressAdherenceGrid">
        <ClientAdherenceCard
          icon={Utensils}
          title="Cumplimiento nutricional"
          description="Promedio semanal de adherencia a la dieta."
          metric={progress.diet}
        />
        <ClientAdherenceCard
          icon={Dumbbell}
          title="Cumplimiento de rutina"
          description="Sesiones y cumplimiento semanal del entrenamiento."
          metric={progress.workout}
          showSessions
        />
      </div>

      <ClientProgressTimeline progress={progress} />
    </div>
  );
}

function ClientProgressOverview({ progress }) {
  const kpis = [
    { icon: Scale, label: "Peso actual", value: formatProgressKg(progress.currentWeightKg), hint: progress.currentWeightDate ? `Actualizado ${formatProgressDate(progress.currentWeightDate)}` : "Sin registro reciente", tone: "blue" },
    { icon: TrendingUp, label: "Cambio desde inicio", value: formatProgressDelta(progress.weightDeltaKg, "kg"), hint: progress.initialWeightKg !== null ? `Inicio: ${formatProgressKg(progress.initialWeightKg)}` : "Falta peso inicial", tone: progress.weightDeltaKg < 0 ? "good" : "gold" },
    { icon: CalendarDays, label: "Ultimo check-in", value: progress.lastCheckinDate ? formatProgressDate(progress.lastCheckinDate) : "Pendiente", hint: progress.hasCheckins ? `${progress.checkins.length} registro(s)` : "Sin historial", tone: "neutral" },
    { icon: Apple, label: "Dieta ultima semana", value: formatProgressPct(progress.diet.latestPct), hint: progress.diet.latestLabel, tone: progress.diet.latestTone },
    { icon: ClipboardCheck, label: "Rutina ultima semana", value: formatProgressPct(progress.workout.latestPct), hint: progress.workout.latestLabel, tone: progress.workout.latestTone },
    { icon: Flame, label: "Tendencia general", value: progress.trend.label, hint: progress.trend.hint, tone: progress.trend.tone },
  ];

  return (
    <div className="prof-progressKpiGrid">
      {kpis.map((item) => (
        <article className={`prof-progressKpi ${item.tone || ""}`} key={item.label}>
          <span className="prof-progressKpiIcon">
            {React.createElement(item.icon, { size: 18, strokeWidth: 2.35 })}
          </span>
          <div>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.hint}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function ClientProgressEmptyState({ canEdit, onNewCheckin }) {
  return (
    <section className="prof-progressEmptyState">
      <div className="prof-progressEmptyIcon">
        <Activity size={22} strokeWidth={2.4} />
      </div>
      <div>
        <h3>Todavia no hay registros de progreso</h3>
        <p>Cuando existan check-ins, pesos o seguimientos, vas a ver la evolucion semanal del alumno aca.</p>
      </div>
      {canEdit ? (
        <button type="button" className="prof-btn compact" onClick={onNewCheckin}>
          <PlusCircle size={15} />
          Cargar primer registro
        </button>
      ) : null}
    </section>
  );
}

function ClientWeightTrendCard({ progress }) {
  const chart = useMemo(() => buildWeightChart(progress.weightSeries), [progress.weightSeries]);
  return (
    <section className="prof-progressCard prof-weightTrendCard">
      <div className="prof-progressCardHead">
        <div>
          <span className="prof-nutritionEyebrow">
            <Scale size={14} strokeWidth={2.4} />
            Evolucion semanal
          </span>
          <h3>Peso corporal</h3>
          <p>Vista semanal usando el ultimo peso disponible de cada semana.</p>
        </div>
        <div className="prof-progressCardBadge">{progress.weightSeries.length} semana(s)</div>
      </div>

      <div className="prof-weightSummaryGrid">
        <ProgressMiniStat label="Inicial" value={formatProgressKg(progress.initialWeightKg)} />
        <ProgressMiniStat label="Actual" value={formatProgressKg(progress.currentWeightKg)} />
        <ProgressMiniStat label="Diferencia" value={formatProgressDelta(progress.weightDeltaKg, "kg")} />
        <ProgressMiniStat label="Promedio semanal" value={formatProgressDelta(progress.averageWeeklyWeightChangeKg, "kg/sem")} />
      </div>

      {chart ? (
        <div className="prof-weightChart" aria-label="Grafico de evolucion de peso">
          <svg viewBox="0 0 360 170" role="img">
            <title>Evolucion semanal de peso</title>
            <line x1="24" y1="132" x2="340" y2="132" />
            <polyline points={chart.pointsLine} />
            {chart.points.map((point) => (
              <g key={point.key}>
                <circle cx={point.x} cy={point.y} r="4.5" />
                <text x={point.x} y={point.y - 10}>{formatNumber(point.weight, 1)}</text>
              </g>
            ))}
          </svg>
          <div className="prof-weightChartLabels">
            <span>{chart.firstLabel}</span>
            <span>{chart.lastLabel}</span>
          </div>
        </div>
      ) : (
        <div className="prof-weightChartEmpty">
          <LineChart size={20} />
          <strong>Faltan mas registros de peso</strong>
          <span>Con al menos dos semanas se dibuja la tendencia.</span>
        </div>
      )}
    </section>
  );
}

function ProgressMiniStat({ label, value }) {
  return (
    <div className="prof-progressMiniStat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ClientAdherenceCard({ icon: Icon, title, description, metric, showSessions = false }) {
  return (
    <section className="prof-progressCard prof-adherenceCard">
      <div className="prof-progressCardHead compact">
        <div>
          <span className="prof-nutritionEyebrow">
            {React.createElement(Icon, { size: 14, strokeWidth: 2.4 })}
            Adherencia
          </span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className={`prof-adherenceBadge ${metric.latestTone}`}>{metric.latestLabel}</span>
      </div>

      <div className="prof-adherenceStats">
        <ProgressMiniStat label="Ultima semana" value={formatProgressPct(metric.latestPct)} />
        <ProgressMiniStat label="Promedio mes" value={formatProgressPct(metric.monthAvgPct)} />
        <ProgressMiniStat label="Mejor semana" value={metric.bestWeek ? `${formatProgressPct(metric.bestWeek.pct)} (${metric.bestWeek.label})` : "Sin datos"} />
        <ProgressMiniStat label="Mas baja" value={metric.worstWeek ? `${formatProgressPct(metric.worstWeek.pct)} (${metric.worstWeek.label})` : "Sin datos"} />
      </div>

      {metric.weeks.length ? (
        <div className="prof-adherenceBars">
          {metric.weeks.slice(-8).map((week) => {
            const status = adherenceStatus(week.pct);
            return (
              <div className="prof-weekBar" key={week.key}>
                <div>
                  <strong>{week.label}</strong>
                  <span>
                    {formatProgressPct(week.pct)}
                    {showSessions && week.plannedSessions ? ` / ${week.completedSessions || 0}/${week.plannedSessions} sesiones` : ""}
                  </span>
                </div>
                <div className={`prof-weekBarTrack ${status.tone}`}>
                  <span style={{ width: `${Math.max(0, Math.min(100, Number(week.pct) || 0))}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="prof-progressInlineEmpty">
          <BarChart3 size={18} />
          <span>Sin datos suficientes para calcular adherencia semanal.</span>
        </div>
      )}
    </section>
  );
}

function ClientProgressTimeline({ progress }) {
  return (
    <section className="prof-progressCard prof-progressTimeline">
      <div className="prof-progressCardHead">
        <div>
          <span className="prof-nutritionEyebrow">
            <CalendarDays size={14} strokeWidth={2.4} />
            Historial
          </span>
          <h3>Check-ins recientes</h3>
          <p>Registro cronologico de peso, cumplimiento y notas del coach.</p>
        </div>
      </div>

      {progress.timeline.length ? (
        <div className="prof-checkinList">
          {progress.timeline.map((checkin) => (
            <article className="prof-checkinCard" key={checkin.id}>
              <div className="prof-checkinDate">
                <span>{formatProgressDate(checkin.date)}</span>
                <em className={`prof-statusPill ${checkin.statusTone}`}>{checkin.statusLabel}</em>
              </div>
              <div className="prof-checkinMetrics">
                <span><Scale size={14} /> {formatProgressKg(checkin.weightKg)}</span>
                <span><Utensils size={14} /> {formatProgressPct(checkin.dietAdherencePct)}</span>
                <span><Dumbbell size={14} /> {formatProgressPct(checkin.workoutAdherencePct)}</span>
              </div>
              {checkin.note ? <p>{checkin.note}</p> : <p className="muted">Sin nota cargada.</p>}
            </article>
          ))}
        </div>
      ) : (
        <div className="prof-progressInlineEmpty">
          <CalendarDays size={18} />
          <span>No hay check-ins guardados todavia.</span>
        </div>
      )}
    </section>
  );
}

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
        <div className="prof-calculatedKcal featured">
          <span className="prof-macroIcon"><Flame size={17} strokeWidth={2.5} /></span>
          <span>{hasMacros ? "Kcal calculadas" : "Completá los macros base"}</span>
          <strong>{hasMacros ? displayTargetValue(calculatedKcal, "kcal") : "Pendiente"}</strong>
          <small>{hasMacros ? "Según proteína, carbohidratos y grasas" : "Completá P/C/G para calcular kcal"}</small>
        </div>
        <NutritionMacro icon={Beef} tone="protein" label="Proteína" value={draft.p} suffix=" g" />
        <NutritionMacro icon={Wheat} tone="carbs" label="Carbs" value={draft.c} suffix=" g" />
        <NutritionMacro icon={Droplets} tone="fat" label="Grasas" value={draft.g} suffix=" g" />
      </div>
      <div className="prof-macroBaseGoal"><span>Objetivo nutricional</span><strong>{goalLabel(draft.goalType)}</strong></div>
    </section>
  );
}

function DailyTargetsSection({ client, nutritionDraft, onEditDay, onApplyGeneral, onRecalculateWeek }) {
  const weekPlan = useMemo(() => resolveNutritionWeek(nutritionDraft), [nutritionDraft]);
  const baseKcal = weekPlan.summary.baseDailyKcal;
  const weeklyDiff = weekPlan.summary.difference;
  const hasWeeklyWarning = weeklyDiff !== null && Math.abs(weeklyDiff) > 5;
  const trainingDays = getTrainingDaysPerWeek(client);
  return (
    <section className="prof-nutritionBlock prof-dailyTargetsSection">
      <div className="prof-nutritionBlockHead">
        <div>
          <span className="prof-nutritionEyebrow">Semana flexible</span>
          <h3>Distribución diaria</h3>
          <p>Personalizá días de entrenamiento, descanso o refeeds sin perder la referencia general.</p>
        </div>
        <div className="prof-nutritionActions">
          <button type="button" className="prof-btn compact" onClick={onRecalculateWeek}>
            <RefreshCw size={15} />
            Recalcular semana
          </button>
          <button type="button" className="prof-btn compact" onClick={onApplyGeneral}>
            <RotateCcw size={15} />
            Aplicar general a toda la semana
          </button>
        </div>
      </div>

      <div className="prof-weekSignalGrid" aria-label="Resumen semanal">
        <div className="prof-weekSignalItem kcal">
          <Flame size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Base diaria</span>
          <strong>{baseKcal ? displayTargetValue(baseKcal, "kcal") : "Pendiente"}</strong>
        </div>
        <div className="prof-weekSignalItem">
          <CalendarDays size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Objetivo semanal</span>
          <strong>{weekPlan.summary.weeklyKcalTarget ? displayTargetValue(weekPlan.summary.weeklyKcalTarget, "kcal") : "Pendiente"}</strong>
        </div>
        <div className={`prof-weekSignalItem ${hasWeeklyWarning ? "warning" : "good"}`}>
          <Target size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Actual semanal</span>
          <strong>{weekPlan.summary.currentWeeklyKcal ? displayTargetValue(weekPlan.summary.currentWeeklyKcal, "kcal") : "Pendiente"}</strong>
        </div>
        <div className={`prof-weekSignalItem ${hasWeeklyWarning ? "warning" : "good"}`}>
          <TrendingUp size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Diferencia semanal</span>
          <strong>{weeklyDiff === null ? "Sin base" : `${weeklyDiff > 0 ? "+" : ""}${formatNumber(weeklyDiff, 0)} kcal`}</strong>
        </div>
        <div className="prof-weekSignalItem">
          <CalendarDays size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Personalizados</span>
          <strong>{weekPlan.summary.customizedDays}/7</strong>
        </div>
        <div className="prof-weekSignalItem adjusted">
          <RefreshCw size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Generales ajustados</span>
          <strong>{weekPlan.summary.adjustedGeneralDays}</strong>
        </div>
        <div className="prof-weekSignalItem gym">
          <Dumbbell size={16} strokeWidth={2.4} aria-hidden="true" />
          <span>Gym estimado</span>
          <strong>{trainingDays ? `${trainingDays} días` : "Sin definir"}</strong>
        </div>
      </div>
      {hasWeeklyWarning ? (
        <div className="prof-weekWarning">
          La semana queda {weeklyDiff > 0 ? "+" : ""}{formatNumber(weeklyDiff, 0)} kcal respecto del objetivo. Revisá los días personalizados o restaurá la semana.
        </div>
      ) : null}

      <div className="prof-dailyTargetGrid">
        {NUTRITION_WEEK_DAYS.map((day) => (
          <DailyTargetCard
            key={day.key}
            day={day}
            target={weekPlan.targets[day.key]}
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
  const statusClass = target.customized ? "custom" : target.adjusted ? "adjusted" : "";
  const statusLabel = target.statusLabel || (target.customized ? "Personalizado" : target.adjusted ? "General ajustado" : "General");
  return (
    <button type="button" className={`prof-dailyTargetCard ${statusClass}`} onClick={() => onEdit(day.key)}>
      <div className="prof-dailyTargetTop">
        <div>
          <span className="prof-dailyTargetDay">{day.label}</span>
          <span className={`prof-dailyTargetBadge ${statusClass}`}>
            {statusLabel}
          </span>
        </div>
        <Pencil size={16} aria-hidden="true" />
      </div>
      {hasTarget ? (
        <>
          <strong>{displayTargetValue(target.kcal, "kcal")}</strong>
          <span className="prof-dailyTargetMacros">{targetMacroLine(target)}</span>
          <DailyKcalBar targetKcal={targetKcal} baseKcal={baseKcal} customized={target.customized} adjusted={target.adjusted} />
        </>
      ) : (
        <div className="prof-dailyTargetEmpty">
          <strong>Sin macros base</strong>
          <span>Completá P/C/G para calcular kcal</span>
        </div>
      )}
      {target.warning ? <small className="warning">{target.warning}</small> : null}
      {target.note ? <small>{target.note}</small> : <small className="muted">Sin nota específica</small>}
    </button>
  );
});

function DailyKcalBar({ targetKcal, baseKcal, customized, adjusted }) {
  const base = Number(baseKcal);
  const current = Number(targetKcal);
  const hasBase = Number.isFinite(base) && base > 0;
  const percent = hasBase ? Math.min(130, Math.max(0, (current / base) * 100)) : 0;
  const delta = hasBase ? Math.round(current - base) : 0;
  const tone = customized && delta > 0 ? "high" : customized && delta < 0 ? "low" : adjusted ? "adjusted" : "general";
  return (
    <div className="prof-kcalBarWrap">
      <div className={`prof-kcalBar ${tone}`} aria-hidden="true">
        <span style={{ width: `${hasBase ? percent : 0}%` }} />
      </div>
      <small className="prof-kcalBarMeta">
        {hasBase ? `${Math.round(percent)}% de la base${delta ? ` / ${delta > 0 ? "+" : ""}${delta} kcal` : ""}` : "Sin referencia base"}
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

function ProgressCheckinDrawer({ client, saving, onSave, onClose }) {
  const latest = getLatestProgressCheckin(client);
  const [localDraft, setLocalDraft] = useState(() => ({
    date: new Date().toISOString().slice(0, 10),
    weightKg: valueOrEmpty(firstPresent(latest?.weightKg, client?.antropometriaActual?.pesoKg, client?.body?.weightKg)),
    dietAdherencePct: valueOrEmpty(latest?.dietAdherencePct),
    workoutAdherencePct: valueOrEmpty(latest?.workoutAdherencePct),
    plannedSessions: valueOrEmpty(latest?.plannedSessions),
    completedSessions: valueOrEmpty(latest?.completedSessions),
    status: "ok",
    note: "",
  }));
  const hasData = Boolean(
    localDraft.weightKg ||
    localDraft.dietAdherencePct ||
    localDraft.workoutAdherencePct ||
    localDraft.plannedSessions ||
    localDraft.completedSessions ||
    localDraft.note.trim()
  );

  const update = (patch) => setLocalDraft((current) => ({ ...current, ...patch }));

  return (
    <DrawerShell
      eyebrow="Progreso"
      title="Registrar check-in"
      description="Guardalo como registro real del alumno. La vista semanal se recalcula al guardar."
      onClose={onClose}
      footer={(
        <>
          <button type="button" className="prof-btn" onClick={onClose}>Cancelar</button>
          <button type="button" className="prof-btn gold" disabled={saving || !hasData} onClick={() => onSave(localDraft)}>
            <Save size={16} />
            {saving ? "Guardando..." : "Guardar check-in"}
          </button>
        </>
      )}
    >
      <div className="prof-checkinForm">
        <Field type="date" label="Fecha" value={localDraft.date} onChange={(value) => update({ date: value })} />
        <Field label="Peso (kg)" inputMode="decimal" value={localDraft.weightKg} onChange={(value) => update({ weightKg: value })} />
        <Field label="Adherencia dieta (%)" inputMode="decimal" value={localDraft.dietAdherencePct} onChange={(value) => update({ dietAdherencePct: value })} />
        <Field label="Adherencia rutina (%)" inputMode="decimal" value={localDraft.workoutAdherencePct} onChange={(value) => update({ workoutAdherencePct: value })} />
        <Field label="Sesiones planificadas" inputMode="numeric" value={localDraft.plannedSessions} onChange={(value) => update({ plannedSessions: value })} />
        <Field label="Sesiones realizadas" inputMode="numeric" value={localDraft.completedSessions} onChange={(value) => update({ completedSessions: value })} />
        <label className="prof-field">
          <span>Estado general</span>
          <select value={localDraft.status} onChange={(event) => update({ status: event.target.value })}>
            <option value="ok">En progreso</option>
            <option value="stable">Estable</option>
            <option value="attention">Necesita atencion</option>
          </select>
        </label>
        <label className="prof-field prof-checkinNote">
          <span>Nota breve</span>
          <textarea
            maxLength={1000}
            placeholder="Ej: buena adherencia, ajustar fin de semana o revisar energia."
            value={localDraft.note}
            onChange={(event) => update({ note: event.target.value })}
          />
        </label>
      </div>
    </DrawerShell>
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

function NutritionMacro({ icon: Icon, label, value, suffix = "", tone = "" }) {
  return (
    <div className={`prof-nutritionMacro ${tone}`}>
      {Icon ? <span className="prof-macroIcon"><Icon size={16} strokeWidth={2.4} /></span> : null}
      <div>
        <span>{label}</span>
        <strong>{displayTargetValue(value, suffix)}</strong>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, inputMode, type = "text" }) {
  return (
    <label className="prof-field">
      <span>{label}</span>
      <input type={type} inputMode={inputMode} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
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

function getTrainingDaysPerWeek(client) {
  const raw = firstPresent(
    client?.routine?.structure?.trainingDaysPerWeek,
    client?.profile?.basics?.frecuenciaEjercicio,
    client?.body?.exerciseFrequency
  );
  const match = String(raw || "").match(/\d+/);
  const numeric = match ? Number(match[0]) : null;
  return Number.isFinite(numeric) && numeric > 0 ? Math.min(7, numeric) : null;
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

function nutritionPayloadFromDraft(draft = {}, assignmentInvalidation = null) {
  const weeklyPlan = serializeDailyTargets(draft.dailyTargets);
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
    weeklyPlan,
    ...(assignmentInvalidation ? { assignmentInvalidation } : {}),
  };
}

function buildClientProgressData(client) {
  const checkins = normalizeClientProgressCheckins(client);
  const weeks = groupProgressCheckinsByWeek(checkins);
  const weightSeries = weeks.filter((week) => Number.isFinite(week.weightKg));
  const weightCheckins = checkins.filter((checkin) => Number.isFinite(checkin.weightKg));
  const firstWeightCheckin = weightCheckins[0] || null;
  const latestWeightCheckin = weightCheckins[weightCheckins.length - 1] || null;
  const stats = client?.stats || {};
  const initialWeightKg = firstNumber(firstWeightCheckin?.weightKg, stats.pesoInicialKg, client?.body?.initialWeightKg);
  const currentWeightKg = firstNumber(
    latestWeightCheckin?.weightKg,
    stats.pesoActualKg,
    client?.antropometriaActual?.pesoKg,
    client?.body?.weightKg
  );
  const currentWeightDate = latestWeightCheckin?.date || stats.lastCheckinAt || null;
  const weightDeltaKg = Number.isFinite(initialWeightKg) && Number.isFinite(currentWeightKg)
    ? roundTo(currentWeightKg - initialWeightKg, 1)
    : null;
  const averageWeeklyWeightChangeKg = Number.isFinite(weightDeltaKg) && weightSeries.length > 1
    ? roundTo(weightDeltaKg / (weightSeries.length - 1), 2)
    : null;
  const diet = buildProgressAdherenceMetric(weeks, "dietAdherencePct");
  const workout = buildProgressAdherenceMetric(weeks, "workoutAdherencePct");
  const trend = buildProgressTrend({ checkins, diet, workout, weightDeltaKg });
  const lastCheckin = checkins[checkins.length - 1] || null;

  return {
    hasCheckins: checkins.length > 0,
    checkins,
    weeks,
    weightSeries,
    initialWeightKg,
    currentWeightKg,
    currentWeightDate,
    weightDeltaKg,
    averageWeeklyWeightChangeKg,
    lastCheckinDate: lastCheckin?.date || stats.lastCheckinAt || null,
    diet,
    workout,
    trend,
    timeline: [...checkins].reverse().slice(0, 10),
  };
}

function normalizeClientProgressCheckins(client) {
  const raw = Array.isArray(client?.progress?.checkins) ? client.progress.checkins : [];
  return raw
    .map((item, index) => normalizeClientProgressCheckin(item, index))
    .filter((item) => item.date)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function normalizeClientProgressCheckin(raw = {}, index = 0) {
  const workoutAdherencePct = firstNumber(
    raw.workoutAdherencePct,
    raw.adherenciaRutinaPct,
    deriveWorkoutAdherence(raw)
  );
  const status = progressStatusMeta(raw.status || raw.estado || "ok");
  return {
    id: String(raw.id || raw._id || `${raw.date || "checkin"}-${index}`),
    date: String(raw.date || raw.fecha || "").slice(0, 10),
    weightKg: firstNumber(raw.weightKg, raw.pesoKg),
    dietAdherencePct: firstNumber(raw.dietAdherencePct, raw.adherenciaDietaPct),
    workoutAdherencePct,
    plannedSessions: firstNumber(raw.plannedSessions, raw.sesionesPlanificadas),
    completedSessions: firstNumber(raw.completedSessions, raw.sesionesRealizadas),
    note: String(raw.note || raw.nota || "").trim(),
    status: status.key,
    statusLabel: status.label,
    statusTone: status.tone,
  };
}

function getLatestProgressCheckin(client) {
  const checkins = normalizeClientProgressCheckins(client);
  return checkins[checkins.length - 1] || null;
}

function groupProgressCheckinsByWeek(checkins = []) {
  const map = new Map();
  checkins.forEach((checkin) => {
    const key = getWeekStartKey(checkin.date);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: weekLabel(key),
        checkins: [],
        plannedSessions: 0,
        completedSessions: 0,
      });
    }
    const week = map.get(key);
    week.checkins.push(checkin);
    if (Number.isFinite(checkin.plannedSessions)) week.plannedSessions += Number(checkin.plannedSessions);
    if (Number.isFinite(checkin.completedSessions)) week.completedSessions += Number(checkin.completedSessions);
  });

  return [...map.values()]
    .map((week) => {
      const sorted = week.checkins.sort((a, b) => String(a.date).localeCompare(String(b.date)));
      const weightEntry = [...sorted].reverse().find((item) => Number.isFinite(item.weightKg));
      return {
        ...week,
        weightKg: weightEntry?.weightKg ?? null,
        weightDate: weightEntry?.date || null,
        dietAdherencePct: averageNumbers(sorted.map((item) => item.dietAdherencePct)),
        workoutAdherencePct: averageNumbers(sorted.map((item) => item.workoutAdherencePct)),
      };
    })
    .sort((a, b) => String(a.key).localeCompare(String(b.key)));
}

function buildProgressAdherenceMetric(weeks, key) {
  const available = weeks
    .map((week) => ({
      key: week.key,
      label: week.label,
      pct: Number(week[key]),
      plannedSessions: week.plannedSessions,
      completedSessions: week.completedSessions,
    }))
    .filter((week) => Number.isFinite(week.pct));
  const latest = available[available.length - 1] || null;
  const recent = available.slice(-4);
  const best = available.length ? available.reduce((max, week) => (week.pct > max.pct ? week : max), available[0]) : null;
  const worst = available.length ? available.reduce((min, week) => (week.pct < min.pct ? week : min), available[0]) : null;
  const status = adherenceStatus(latest?.pct);
  return {
    weeks: available,
    latestPct: latest?.pct ?? null,
    latestLabel: status.label,
    latestTone: status.tone,
    monthAvgPct: averageNumbers(recent.map((week) => week.pct)),
    bestWeek: best,
    worstWeek: worst,
  };
}

function buildProgressTrend({ checkins, diet, workout, weightDeltaKg }) {
  if (!checkins.length) return { label: "Sin datos", hint: "Esperando registros", tone: "neutral" };
  const dietLow = Number.isFinite(diet.latestPct) && diet.latestPct < 60;
  const workoutLow = Number.isFinite(workout.latestPct) && workout.latestPct < 60;
  if (dietLow || workoutLow) return { label: "Necesita atencion", hint: "Revisar adherencia reciente", tone: "bad" };
  if (Number.isFinite(weightDeltaKg) && Math.abs(weightDeltaKg) < 0.3) return { label: "Estable", hint: "Sin cambios grandes", tone: "blue" };
  return { label: "En progreso", hint: "Con registros activos", tone: "good" };
}

function buildWeightChart(weightSeries = []) {
  if (weightSeries.length < 2) return null;
  const weights = weightSeries.map((item) => Number(item.weightKg)).filter(Number.isFinite);
  if (weights.length < 2) return null;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const range = max - min || 1;
  const left = 28;
  const width = 306;
  const top = 28;
  const height = 96;
  const points = weightSeries.map((item, index) => {
    const x = left + (index / Math.max(1, weightSeries.length - 1)) * width;
    const y = top + (1 - ((Number(item.weightKg) - min) / range)) * height;
    return {
      key: item.key,
      x: roundTo(x, 1),
      y: roundTo(y, 1),
      weight: Number(item.weightKg),
    };
  });
  return {
    points,
    pointsLine: points.map((point) => `${point.x},${point.y}`).join(" "),
    firstLabel: weightSeries[0]?.label || "",
    lastLabel: weightSeries[weightSeries.length - 1]?.label || "",
  };
}

function adherenceStatus(value) {
  const pct = Number(value);
  if (!Number.isFinite(pct)) return { label: "Sin datos", tone: "neutral" };
  if (pct >= 90) return { label: "Excelente", tone: "good" };
  if (pct >= 75) return { label: "Buena", tone: "blue" };
  if (pct >= 60) return { label: "Regular", tone: "warn" };
  return { label: "Baja", tone: "bad" };
}

function progressStatusMeta(value) {
  const key = String(value || "ok").toLowerCase();
  if (key.includes("attention") || key.includes("atencion") || key.includes("riesgo")) {
    return { key: "attention", label: "Necesita atencion", tone: "bad" };
  }
  if (key.includes("stable") || key.includes("estable")) {
    return { key: "stable", label: "Estable", tone: "blue" };
  }
  return { key: "ok", label: "En progreso", tone: "good" };
}

function deriveWorkoutAdherence(raw = {}) {
  const planned = firstNumber(raw.plannedSessions, raw.sesionesPlanificadas);
  const completed = firstNumber(raw.completedSessions, raw.sesionesRealizadas);
  if (!Number.isFinite(planned) || planned <= 0 || !Number.isFinite(completed)) return null;
  return Math.max(0, Math.min(100, Math.round((completed / planned) * 100)));
}

function getWeekStartKey(value) {
  const date = parseProgressDate(value);
  if (!date) return "";
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function weekLabel(key) {
  return formatProgressDate(key);
}

function parseProgressDate(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function firstNumber(...values) {
  for (const value of values) {
    if (value === "" || value === null || value === undefined) continue;
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function averageNumbers(values = []) {
  const numbers = values.map(Number).filter(Number.isFinite);
  if (!numbers.length) return null;
  return roundTo(numbers.reduce((sum, value) => sum + value, 0) / numbers.length, 1);
}

function roundTo(value, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function formatProgressDate(value) {
  const date = parseProgressDate(value);
  if (!date) return "-";
  return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(date);
}

function formatProgressKg(value) {
  if (value === null || value === undefined || value === "") return "Sin datos";
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number, 1)} kg` : "Sin datos";
}

function formatProgressPct(value) {
  if (value === null || value === undefined || value === "") return "Sin datos";
  const number = Number(value);
  return Number.isFinite(number) ? `${formatNumber(number, 0)}%` : "Sin datos";
}

function formatProgressDelta(value, suffix) {
  if (value === null || value === undefined || value === "") return "Sin datos";
  const number = Number(value);
  if (!Number.isFinite(number)) return "Sin datos";
  return `${number > 0 ? "+" : ""}${formatNumber(number, suffix === "kg/sem" ? 2 : 1)} ${suffix}`;
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

function formatNumber(value, decimals = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(number);
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
