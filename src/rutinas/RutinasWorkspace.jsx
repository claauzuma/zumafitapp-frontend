import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  ClipboardList,
  Clock,
  Copy,
  Dumbbell,
  Eye,
  Layers,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  SlidersHorizontal,
  Target,
  Trash2,
  TrendingUp,
  Users,
  Weight,
  X,
} from "lucide-react";

import {
  invalidateClienteRutinas,
  invalidateRoutineDetail,
  invalidateRoutinesLibrary,
  queryKeys,
} from "../queryClient.js";
import {
  assignRutinaToClient,
  createEjercicio,
  createRutina,
  deleteEjercicio,
  deleteClienteRutina,
  deleteRutina,
  duplicateRutina,
  updateClienteRutina,
  updateEjercicio,
  updateRutina,
} from "./rutinasApi.js";
import {
  useAssignableClients,
  useClienteRutinas,
  useEjercicios,
  useRutina,
  useRutinas,
} from "./rutinasQueries.js";
import { DEMO_RUTINAS } from "./rutinasDemo.js";
import "./rutinas.css";

const OBJECTIVES = [
  ["todos", "Objetivo"],
  ["hipertrofia", "Hipertrofia"],
  ["fuerza", "Fuerza"],
  ["recomposicion", "Recomposicion"],
  ["perdida_grasa", "Perdida grasa"],
  ["salud", "Salud"],
  ["rendimiento", "Rendimiento"],
];

const LEVELS = [
  ["todos", "Nivel"],
  ["principiante", "Principiante"],
  ["intermedio", "Intermedio"],
  ["avanzado", "Avanzado"],
];

const VISIBILITY = [
  ["todos", "Visibilidad"],
  ["publica", "Publica"],
  ["privada", "Privada"],
  ["sistema", "Sistema"],
];

const EXERCISE_FILTERS = [
  ["todos", "Grupo"],
  ["pecho", "Pecho"],
  ["espalda", "Espalda"],
  ["cuadriceps", "Cuadriceps"],
  ["isquios", "Isquios"],
  ["gluteos", "Gluteos"],
  ["hombro", "Hombro"],
  ["core", "Core"],
];

export default function RutinasWorkspace({ mode = "coach" }) {
  const queryClient = useQueryClient();
  const scope = mode === "admin" ? "admin" : "coach";
  const [tab, setTab] = useState("rutinas");
  const [filters, setFilters] = useState({
    search: "",
    objetivo: "todos",
    nivel: "todos",
    diasPorSemana: 0,
    visibilidad: "todos",
  });
  const [exerciseFilters, setExerciseFilters] = useState({ search: "", grupoMuscular: "todos" });
  const [selectedRoutineId, setSelectedRoutineId] = useState("");
  const [selectedPreview, setSelectedPreview] = useState(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [editor, setEditor] = useState(null);
  const [exerciseEditor, setExerciseEditor] = useState(null);
  const [assigningRoutine, setAssigningRoutine] = useState(null);
  const [clientSearch, setClientSearch] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedAssignedId, setSelectedAssignedId] = useState("");
  const [assignedDraft, setAssignedDraft] = useState(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const routinesQuery = useRutinas(filters);
  const exercisesQuery = useEjercicios(exerciseFilters);
  const clientsQuery = useAssignableClients(scope, clientSearch, {
    enabled: tab === "asignadas" || Boolean(assigningRoutine),
  });
  const assignedQuery = useClienteRutinas(selectedClientId, { enabled: Boolean(selectedClientId) });
  const detailQuery = useRutina(selectedRoutineId, {
    enabled: Boolean(selectedRoutineId) && !selectedPreview?.demo,
  });

  const realRoutines = routinesQuery.data?.rutinas || [];
  const displayRoutines = realRoutines.length ? realRoutines : DEMO_RUTINAS;
  const usingDemo = !routinesQuery.isLoading && realRoutines.length === 0;
  const exercises = exercisesQuery.data?.ejercicios || [];
  const clients = clientsQuery.data?.clients || [];
  const selectedRoutine = selectedPreview?.demo ? selectedPreview : detailQuery.data || selectedPreview;
  const selectedAssigned = useMemo(() => {
    const list = assignedQuery.data?.rutinas || [];
    return list.find((item) => getId(item) === selectedAssignedId) || list[0] || null;
  }, [assignedQuery.data?.rutinas, selectedAssignedId]);

  useEffect(() => {
    if (selectedAssigned) {
      setAssignedDraft(assignedToDraft(selectedAssigned));
      setSelectedAssignedId(getId(selectedAssigned));
    } else {
      setAssignedDraft(null);
    }
  }, [selectedAssigned]);

  const saveRoutineMutation = useMutation({
    mutationFn: async (draft) => {
      const payload = routineDraftToPayload(draft, scope);
      if (draft.id && !draft.demo && draft.mode === "edit") {
        return await updateRutina(draft.id, payload);
      }
      return await createRutina(payload);
    },
    onSuccess: async (routine) => {
      setEditor(null);
      setSelectedPreview(routine);
      setSelectedRoutineId(getId(routine));
      setNotice("Rutina guardada.");
      await invalidateRoutineDetail(getId(routine));
    },
    onError: handleMutationError,
  });

  const duplicateMutation = useMutation({
    mutationFn: async (routine) => {
      if (routine.demo) {
        return await createRutina(routineDraftToPayload(routineToDraft(routine, "create"), scope));
      }
      return await duplicateRutina(getId(routine), { nombre: `${routine.nombre || "Rutina"} - copia` });
    },
    onSuccess: async (routine) => {
      setNotice("Rutina duplicada.");
      setSelectedPreview(routine);
      setSelectedRoutineId(getId(routine));
      await invalidateRoutineDetail(getId(routine));
    },
    onError: handleMutationError,
  });

  const deleteRoutineMutation = useMutation({
    mutationFn: (routine) => deleteRutina(getId(routine)),
    onSuccess: async () => {
      setNotice("Rutina eliminada.");
      setSelectedPreview(null);
      setSelectedRoutineId("");
      setMobileDetailOpen(false);
      await invalidateRoutinesLibrary();
    },
    onError: handleMutationError,
  });

  const saveExerciseMutation = useMutation({
    mutationFn: async (draft) => {
      const payload = {
        ...draft,
        gruposSecundarios: String(draft.gruposSecundariosText || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };
      if (draft.id) return await updateEjercicio(draft.id, payload);
      return await createEjercicio(payload);
    },
    onSuccess: async () => {
      setExerciseEditor(null);
      setNotice("Ejercicio guardado.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.ejerciciosRoot() });
    },
    onError: handleMutationError,
  });

  const deleteExerciseMutation = useMutation({
    mutationFn: (exercise) => deleteEjercicio(getId(exercise)),
    onSuccess: async () => {
      setNotice("Ejercicio eliminado.");
      await queryClient.invalidateQueries({ queryKey: queryKeys.ejerciciosRoot() });
    },
    onError: handleMutationError,
  });

  const assignMutation = useMutation({
    mutationFn: async ({ routine, clientId, form }) => {
      if (routine.demo) throw new Error("Primero guarda esta rutina demo en la base.");
      return await assignRutinaToClient(clientId, {
        rutinaBaseId: getId(routine),
        fechaInicio: form.fechaInicio,
        duracionSemanas: form.duracionSemanas,
        notasCoach: form.notasCoach,
      });
    },
    onSuccess: async (assigned, variables) => {
      setAssigningRoutine(null);
      setTab("asignadas");
      setSelectedClientId(variables.clientId);
      setSelectedAssignedId(getId(assigned));
      setAssignedDraft(assignedToDraft(assigned));
      setNotice("Rutina asignada. Ya podes ajustar peso, reps y RIR por serie.");
      await invalidateClienteRutinas(variables.clientId);
    },
    onError: handleMutationError,
  });

  const saveAssignedMutation = useMutation({
    mutationFn: async (draft) => updateClienteRutina(selectedClientId, draft.id, assignedDraftToPayload(draft)),
    onSuccess: async (routine) => {
      setAssignedDraft(assignedToDraft(routine));
      setNotice("Rutina asignada actualizada.");
      await invalidateClienteRutinas(selectedClientId);
    },
    onError: handleMutationError,
  });

  const deleteAssignedMutation = useMutation({
    mutationFn: async (routine) => deleteClienteRutina(selectedClientId, getId(routine)),
    onSuccess: async () => {
      setNotice("Rutina asignada eliminada.");
      setSelectedAssignedId("");
      setAssignedDraft(null);
      await invalidateClienteRutinas(selectedClientId);
    },
    onError: handleMutationError,
  });

  function handleMutationError(error) {
    setError(error?.message || "No se pudo completar la accion.");
  }

  function refreshVisible() {
    if (tab === "rutinas") queryClient.invalidateQueries({ queryKey: queryKeys.rutinasRoot() });
    if (tab === "ejercicios") queryClient.invalidateQueries({ queryKey: queryKeys.ejerciciosRoot() });
    if (tab === "asignadas" && selectedClientId) invalidateClienteRutinas(selectedClientId);
  }

  function openRoutine(routine) {
    setSelectedPreview(routine);
    setSelectedRoutineId(routine.demo ? "" : getId(routine));
    setMobileDetailOpen(true);
  }

  function openRoutineEditor(routine = null) {
    setEditor({
      ...routineToDraft(routine, routine && !routine.demo ? "edit" : "create", scope),
      mode: routine && !routine.demo ? "edit" : "create",
    });
  }

  function removeRoutine(routine) {
    if (routine.demo) return;
    if (!window.confirm(`Eliminar "${routine.nombre}"?`)) return;
    deleteRoutineMutation.mutate(routine);
  }

  function openAssign(routine) {
    if (routine.demo) {
      setError("Primero guarda esta rutina demo en la base para poder asignarla.");
      return;
    }
    setAssigningRoutine(routine);
  }

  return (
    <section className="rt-page">
      <div className="rt-shell">
        <header className="rt-hero rt-heroClean">
          <div className="rt-heroContent">
            <div className="rt-titleRow">
              <div className="rt-titleWithIcon">
                <Dumbbell size={22} strokeWidth={2.4} aria-hidden="true" />
                <h1>Rutinas</h1>
              </div>
              <button
                type="button"
                className="rt-iconBtn rt-refreshIcon"
                onClick={refreshVisible}
                title="Actualizar"
                aria-label="Actualizar rutinas"
              >
                <RefreshCcw size={18} strokeWidth={2.3} aria-hidden="true" />
              </button>
            </div>
            <p>
              Biblioteca de ejercicios, plantillas reutilizables y rutinas asignadas con peso,
              reps y RIR por serie.
            </p>
            <button type="button" className="rt-btn gold rt-createBtn" onClick={() => openRoutineEditor()}>
              <Plus size={17} />
              <span>Crear rutina</span>
            </button>
          </div>
        </header>

        {(notice || error) && (
          <div className={`rt-alert ${error ? "error" : ""}`}>
            <span>{error || notice}</span>
            <button type="button" onClick={() => { setNotice(""); setError(""); }} aria-label="Cerrar aviso">
              <X size={16} />
            </button>
          </div>
        )}

        <div className="rt-tabs" role="tablist" aria-label="Modulo rutinas">
          <TabButton active={tab === "rutinas"} onClick={() => setTab("rutinas")} icon={ClipboardList} label="Plantillas" />
          <TabButton active={tab === "ejercicios"} onClick={() => setTab("ejercicios")} icon={Dumbbell} label="Ejercicios" />
          <TabButton active={tab === "asignadas"} onClick={() => setTab("asignadas")} icon={Users} label="Asignadas" />
        </div>

        {tab === "rutinas" && (
          <RoutineLibrary
            filters={filters}
            setFilters={setFilters}
            routines={displayRoutines}
            selectedRoutine={selectedRoutine}
            usingDemo={usingDemo}
            isLoading={routinesQuery.isLoading}
            isFetching={routinesQuery.isFetching}
            onView={openRoutine}
            onEdit={openRoutineEditor}
            onDuplicate={(routine) => duplicateMutation.mutate(routine)}
            onDelete={removeRoutine}
            onAssign={openAssign}
            duplicating={duplicateMutation.isPending}
          />
        )}

        {tab === "ejercicios" && (
          <ExercisesPanel
            filters={exerciseFilters}
            setFilters={setExerciseFilters}
            exercises={exercises}
            isLoading={exercisesQuery.isLoading}
            isFetching={exercisesQuery.isFetching}
            editor={exerciseEditor}
            setEditor={setExerciseEditor}
            onSave={(draft) => saveExerciseMutation.mutate(draft)}
            onDelete={(exercise) => {
              if (window.confirm(`Eliminar "${exercise.nombre}"?`)) deleteExerciseMutation.mutate(exercise);
            }}
            saving={saveExerciseMutation.isPending}
          />
        )}

        {tab === "asignadas" && (
          <AssignedPanel
            clients={clients}
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
            selectedClientId={selectedClientId}
            setSelectedClientId={setSelectedClientId}
            clientsLoading={clientsQuery.isLoading}
            routines={assignedQuery.data?.rutinas || []}
            routinesLoading={assignedQuery.isLoading}
            selectedAssignedId={selectedAssignedId}
            setSelectedAssignedId={setSelectedAssignedId}
            draft={assignedDraft}
            setDraft={setAssignedDraft}
            exercises={exercises}
            onSave={(draft) => saveAssignedMutation.mutate(draft)}
            onDelete={(routine) => {
              if (window.confirm(`Eliminar "${routine.nombre}"?`)) deleteAssignedMutation.mutate(routine);
            }}
            saving={saveAssignedMutation.isPending}
          />
        )}
      </div>

      {selectedRoutine && mobileDetailOpen && tab === "rutinas" && (
        <MobileRoutineDetailOverlay
          routine={selectedRoutine}
          onClose={() => setMobileDetailOpen(false)}
          onEdit={openRoutineEditor}
          onDuplicate={(routine) => duplicateMutation.mutate(routine)}
          onAssign={openAssign}
        />
      )}

      {editor && (
        <RoutineEditor
          draft={editor}
          setDraft={setEditor}
          exercises={exercises}
          scope={scope}
          onClose={() => setEditor(null)}
          onSave={() => saveRoutineMutation.mutate(editor)}
          saving={saveRoutineMutation.isPending}
        />
      )}

      {assigningRoutine && (
        <AssignRoutineDialog
          routine={assigningRoutine}
          clients={clients}
          search={clientSearch}
          setSearch={setClientSearch}
          loading={clientsQuery.isLoading}
          onClose={() => setAssigningRoutine(null)}
          onAssign={(clientId, form) => assignMutation.mutate({ routine: assigningRoutine, clientId, form })}
          saving={assignMutation.isPending}
        />
      )}
    </section>
  );
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button type="button" className={`rt-tab ${active ? "active" : ""}`} onClick={onClick}>
      {React.createElement(icon, { size: 16 })}
      <span>{label}</span>
    </button>
  );
}

function RoutineLibrary({
  filters,
  setFilters,
  routines,
  selectedRoutine,
  usingDemo,
  isLoading,
  isFetching,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onAssign,
  duplicating,
}) {
  return (
    <div className="rt-twoCol">
      <div className="rt-panel">
        <div className="rt-toolbar">
          <div className="rt-searchWrap">
            <Search size={17} />
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar rutina, objetivo o tag..."
            />
          </div>
          <select value={filters.objetivo} onChange={(e) => setFilters((prev) => ({ ...prev, objetivo: e.target.value }))}>
            {OBJECTIVES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.nivel} onChange={(e) => setFilters((prev) => ({ ...prev, nivel: e.target.value }))}>
            {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select value={filters.visibilidad} onChange={(e) => setFilters((prev) => ({ ...prev, visibilidad: e.target.value }))}>
            {VISIBILITY.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>

        {usingDemo && (
          <div className="rt-demoNotice">
            No hay rutinas reales todavia. Estas tarjetas son ejemplos demo y no se guardan solas.
          </div>
        )}

        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <div className="rt-routineGrid">
            {routines.map((routine) => (
              <RoutineCard
                key={getId(routine)}
                routine={routine}
                selected={getId(selectedRoutine) === getId(routine)}
                onView={() => onView(routine)}
                onEdit={() => onEdit(routine)}
                onDuplicate={() => onDuplicate(routine)}
                onDelete={() => onDelete(routine)}
                onAssign={() => onAssign(routine)}
                duplicating={duplicating}
              />
            ))}
          </div>
        )}

        {isFetching && !isLoading && <div className="rt-fetching">Actualizando en segundo plano...</div>}
      </div>

      <RoutineDetail
        routine={selectedRoutine}
        onEdit={onEdit}
        onDuplicate={onDuplicate}
        onAssign={onAssign}
        placement="desktop"
      />
    </div>
  );
}

function RoutineCard({ routine, selected, onView, onEdit, onDuplicate, onDelete, onAssign, duplicating }) {
  const days = routine?.dias?.length || routine?.diasPorSemana || 0;
  const isDemo = !!routine?.demo;

  return (
    <article className={`rt-card ${selected ? "selected" : ""}`}>
      <div className="rt-cardTop">
        <div>
          <span className={`rt-pill ${isDemo ? "demo" : ""}`}>{isDemo ? "Ejemplo demo" : labelVisibility(routine.visibilidad)}</span>
          <h3>{routine.nombre}</h3>
        </div>
        <button type="button" className="rt-iconBtn" onClick={onView} title="Ver detalle">
          <Eye size={17} />
        </button>
      </div>
      <p>{routine.descripcion || "Sin descripcion."}</p>
      <div className="rt-cardFacts">
        <FactLine icon={Target} label="Objetivo" value={labelToken(routine.objetivo)} />
        <FactLine icon={TrendingUp} label="Nivel" value={labelToken(routine.nivel)} />
        <FactLine icon={CalendarDays} label="Dias" value={`${days || "-"} dias`} />
        <FactLine icon={Clock} label="Duracion" value={`${routine.duracionSemanasDefault || "-"} semanas`} />
      </div>
      <div className="rt-cardActions">
        <button type="button" className="rt-btn compact" onClick={onEdit}>
          <Pencil size={15} />
          <span>{isDemo ? "Guardar demo" : "Editar"}</span>
        </button>
        <button type="button" className="rt-btn compact" onClick={onDuplicate} disabled={duplicating}>
          <Copy size={15} />
          <span>Duplicar</span>
        </button>
        <button type="button" className="rt-btn compact gold" onClick={onAssign} disabled={isDemo}>
          <Users size={15} />
          <span>Asignar</span>
        </button>
        {!isDemo && (
          <button type="button" className="rt-iconBtn danger" onClick={onDelete} title="Eliminar">
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </article>
  );
}

function RoutineDetail({ routine, onEdit, onDuplicate, onAssign, placement = "desktop" }) {
  const className = `rt-panel rt-detail ${placement === "desktop" ? "rt-detailDesktop" : ""}`;

  if (!routine) {
    return (
      <aside className={className}>
        <div className="rt-empty">
          <Layers size={22} />
          <strong>Selecciona una rutina</strong>
          <span>Vas a ver dias, ejercicios, series, reps, RIR y descansos.</span>
        </div>
      </aside>
    );
  }

  return (
    <aside className={className}>
      <div className="rt-detailHead">
        <div>
          <span className={`rt-pill ${routine.demo ? "demo" : ""}`}>{routine.demo ? "Ejemplo demo" : labelVisibility(routine.visibilidad)}</span>
          <h2>{routine.nombre}</h2>
          <p>{routine.descripcion || "Sin descripcion."}</p>
        </div>
      </div>
      <div className="rt-detailActions">
        <button type="button" className="rt-btn compact" onClick={() => onEdit(routine)}>
          <Pencil size={15} />
          <span>{routine.demo ? "Guardar demo" : "Editar"}</span>
        </button>
        <button type="button" className="rt-btn compact" onClick={() => onDuplicate(routine)}>
          <Copy size={15} />
          <span>Duplicar</span>
        </button>
        <button type="button" className="rt-btn compact gold" onClick={() => onAssign(routine)} disabled={routine.demo}>
          <Users size={15} />
          <span>Asignar</span>
        </button>
      </div>

      <div className="rt-dayList">
        {(routine.dias || []).map((day, dayIndex) => (
          <section key={`${day.nombre}-${dayIndex}`} className="rt-day">
            <div className="rt-dayTitle">
              <strong>{day.nombre}</strong>
              <span>{day.foco || "Sin foco"}</span>
            </div>
            <div className="rt-exerciseRows">
              {(day.ejercicios || []).map((exercise, exerciseIndex) => (
                <div className="rt-exerciseRow" key={`${exercise.nombreSnapshot}-${exerciseIndex}`}>
                  <span>{exercise.nombreSnapshot}</span>
                  <small>{exercise.series} series</small>
                  <small>{exercise.reps} reps</small>
                  <small>RIR {exercise.rir || "-"}</small>
                  <small>{exercise.descansoSeg || 0}s</small>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function MobileRoutineDetailOverlay({ routine, onClose, onEdit, onDuplicate, onAssign }) {
  return (
    <div className="rt-mobileDetailBackdrop" role="presentation" onClick={onClose}>
      <aside
        className="rt-panel rt-detail rt-mobileDetail"
        role="dialog"
        aria-modal="true"
        aria-label={`Detalle de ${routine?.nombre || "rutina"}`}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="rt-mobileDetailClose" onClick={onClose} aria-label="Cerrar detalle">
          <X size={18} strokeWidth={2.4} />
        </button>

        <div className="rt-detailHead">
          <div>
            <span className={`rt-pill ${routine.demo ? "demo" : ""}`}>{routine.demo ? "Ejemplo demo" : labelVisibility(routine.visibilidad)}</span>
            <h2>{routine.nombre}</h2>
            <p>{routine.descripcion || "Sin descripcion."}</p>
          </div>
        </div>
        <div className="rt-detailActions">
          <button type="button" className="rt-btn compact" onClick={() => onEdit(routine)}>
            <Pencil size={15} />
            <span>{routine.demo ? "Guardar demo" : "Editar"}</span>
          </button>
          <button type="button" className="rt-btn compact" onClick={() => onDuplicate(routine)}>
            <Copy size={15} />
            <span>Duplicar</span>
          </button>
          <button type="button" className="rt-btn compact gold" onClick={() => onAssign(routine)} disabled={routine.demo}>
            <Users size={15} />
            <span>Asignar</span>
          </button>
        </div>

        <div className="rt-dayList">
          {(routine.dias || []).map((day, dayIndex) => (
            <section key={`${day.nombre}-${dayIndex}`} className="rt-day">
              <div className="rt-dayTitle">
                <strong>{day.nombre}</strong>
                <span>{day.foco || "Sin foco"}</span>
              </div>
              <div className="rt-exerciseRows">
                {(day.ejercicios || []).map((exercise, exerciseIndex) => (
                  <div className="rt-exerciseRow" key={`${exercise.nombreSnapshot}-${exerciseIndex}`}>
                    <span>{exercise.nombreSnapshot}</span>
                    <small>{exercise.series} series</small>
                    <small>{exercise.reps} reps</small>
                    <small>RIR {exercise.rir || "-"}</small>
                    <small>{exercise.descansoSeg || 0}s</small>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ExercisesPanel({
  filters,
  setFilters,
  exercises,
  isLoading,
  isFetching,
  editor,
  setEditor,
  onSave,
  onDelete,
  saving,
}) {
  return (
    <div className="rt-twoCol exercises">
      <div className="rt-panel">
        <div className="rt-toolbar">
          <div className="rt-searchWrap">
            <Search size={17} />
            <input
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              placeholder="Buscar ejercicio..."
            />
          </div>
          <select value={filters.grupoMuscular} onChange={(e) => setFilters((prev) => ({ ...prev, grupoMuscular: e.target.value }))}>
            {EXERCISE_FILTERS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" className="rt-btn gold" onClick={() => setEditor(emptyExerciseDraft())}>
            <Plus size={16} />
            <span>Crear ejercicio</span>
          </button>
        </div>
        {isLoading ? (
          <SkeletonGrid />
        ) : (
          <div className="rt-exerciseGrid">
            {exercises.map((exercise) => (
              <article className="rt-card small" key={getId(exercise)}>
                <div className="rt-cardTop">
                  <div>
                    <span className="rt-pill">{labelToken(exercise.grupoMuscular)}</span>
                    <h3>{exercise.nombre}</h3>
                  </div>
                </div>
                <p>{exercise.instrucciones || "Sin instrucciones cargadas."}</p>
                <div className="rt-tagRow">
                  <span>{labelToken(exercise.patronMovimiento)}</span>
                  <span>{labelToken(exercise.equipamiento)}</span>
                  <span>{labelToken(exercise.dificultad)}</span>
                </div>
                <div className="rt-cardActions">
                  <button type="button" className="rt-btn compact" onClick={() => setEditor(exerciseToDraft(exercise))}>
                    <Pencil size={15} />
                    <span>Editar</span>
                  </button>
                  <button type="button" className="rt-iconBtn danger" onClick={() => onDelete(exercise)} title="Eliminar">
                    <Trash2 size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
        {isFetching && !isLoading && <div className="rt-fetching">Actualizando ejercicios...</div>}
      </div>

      <aside className="rt-panel">
        {editor ? (
          <ExerciseEditor
            draft={editor}
            setDraft={setEditor}
            onSave={() => onSave(editor)}
            onCancel={() => setEditor(null)}
            saving={saving}
          />
        ) : (
          <div className="rt-empty">
            <Dumbbell size={22} />
            <strong>Base de ejercicios</strong>
            <span>Crea ejercicios con grupo, patron, equipo e instrucciones para usarlos en rutinas.</span>
          </div>
        )}
      </aside>
    </div>
  );
}

function AssignedPanel({
  clients,
  clientSearch,
  setClientSearch,
  selectedClientId,
  setSelectedClientId,
  clientsLoading,
  routines,
  routinesLoading,
  selectedAssignedId,
  setSelectedAssignedId,
  draft,
  setDraft,
  exercises,
  onSave,
  onDelete,
  saving,
}) {
  const selectedClient = clients.find((client) => getId(client) === selectedClientId) || null;

  return (
    <div className="rt-twoCol assigned">
      <div className="rt-panel">
        <div className="rt-toolbar">
          <div className="rt-searchWrap">
            <Search size={17} />
            <input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Buscar cliente..."
            />
          </div>
        </div>
        <div className="rt-clientList">
          {clientsLoading ? (
            <div className="rt-empty compact">Cargando clientes...</div>
          ) : clients.length ? (
            clients.map((client) => (
              <button
                key={getId(client)}
                type="button"
                className={`rt-clientItem ${selectedClientId === getId(client) ? "active" : ""}`}
                onClick={() => setSelectedClientId(getId(client))}
              >
                <strong>{fullName(client)}</strong>
                <span>{client.email}</span>
              </button>
            ))
          ) : (
            <div className="rt-empty compact">No hay clientes para mostrar.</div>
          )}
        </div>

        {selectedClient && (
          <div className="rt-assignedList">
            <h3>Rutinas de {fullName(selectedClient)}</h3>
            {routinesLoading ? (
              <div className="rt-empty compact">Cargando rutinas...</div>
            ) : routines.length ? (
              routines.map((routine) => (
                <button
                  key={getId(routine)}
                  type="button"
                  className={`rt-assignedItem ${selectedAssignedId === getId(routine) ? "active" : ""}`}
                  onClick={() => setSelectedAssignedId(getId(routine))}
                >
                  <span>{routine.nombre}</span>
                  <small>{labelToken(routine.estado)} - semana {routine.semanaActual || 1}</small>
                </button>
              ))
            ) : (
              <div className="rt-empty compact">Este cliente todavia no tiene rutinas asignadas.</div>
            )}
          </div>
        )}
      </div>

      <aside className="rt-panel rt-assignedEditorPanel">
        {draft ? (
          <>
            <AssignedRoutineEditor draft={draft} setDraft={setDraft} exercises={exercises} onSave={onSave} saving={saving} />
            <div className="rt-dangerZone">
              <button type="button" className="rt-btn danger" onClick={() => onDelete(draft)}>
                <Trash2 size={16} />
                <span>Eliminar asignacion</span>
              </button>
            </div>
          </>
        ) : (
          <div className="rt-empty">
            <Weight size={22} />
            <strong>Elegir rutina asignada</strong>
            <span>Aca se editan series, reps, RIR y peso por serie sin tocar la plantilla base.</span>
          </div>
        )}
      </aside>
    </div>
  );
}

function RoutineEditor({ draft, setDraft, exercises, scope, onClose, onSave, saving }) {
  const canVisibility = scope === "admin";

  return (
    <div className="rt-modalBackdrop" role="presentation">
      <section className="rt-modal" role="dialog" aria-modal="true" aria-label="Editor de rutina">
        <header className="rt-modalHead">
          <div>
            <span className="rt-pill">{draft.mode === "edit" ? "Editar plantilla" : "Nueva plantilla"}</span>
            <h2>{draft.mode === "edit" ? "Editar rutina" : "Crear rutina"}</h2>
          </div>
          <button type="button" className="rt-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>

        <div className="rt-formGrid">
          <Field label="Nombre" value={draft.nombre} onChange={(value) => setDraft((d) => ({ ...d, nombre: value }))} />
          <Field label="Dias por semana" type="number" value={draft.diasPorSemana} onChange={(value) => setDraft((d) => ({ ...d, diasPorSemana: value }))} />
          <SelectField label="Objetivo" value={draft.objetivo} options={OBJECTIVES.slice(1)} onChange={(value) => setDraft((d) => ({ ...d, objetivo: value }))} />
          <SelectField label="Nivel" value={draft.nivel} options={LEVELS.slice(1)} onChange={(value) => setDraft((d) => ({ ...d, nivel: value }))} />
          <Field label="Duracion semanas" type="number" value={draft.duracionSemanasDefault} onChange={(value) => setDraft((d) => ({ ...d, duracionSemanasDefault: value }))} />
          <SelectField
            label="Visibilidad"
            value={draft.visibilidad}
            disabled={!canVisibility}
            options={VISIBILITY.slice(1)}
            onChange={(value) => setDraft((d) => ({ ...d, visibilidad: value }))}
          />
          <Field label="Tags" value={draft.tagsText} onChange={(value) => setDraft((d) => ({ ...d, tagsText: value }))} />
          <label className="rt-field wide">
            <span>Descripcion</span>
            <textarea value={draft.descripcion} onChange={(e) => setDraft((d) => ({ ...d, descripcion: e.target.value }))} />
          </label>
        </div>

        <div className="rt-builderHead">
          <h3>Constructor de dias</h3>
          <button type="button" className="rt-btn compact" onClick={() => setDraft((d) => ({ ...d, dias: [...d.dias, emptyDay(d.dias.length)] }))}>
            <Plus size={15} />
            <span>Agregar dia</span>
          </button>
        </div>

        <div className="rt-builder">
          {draft.dias.map((day, dayIndex) => (
            <DayEditor
              key={day.localId}
              day={day}
              dayIndex={dayIndex}
              exercises={exercises}
              updateDay={(patch) => setDraft((d) => updateDayDraft(d, dayIndex, patch))}
              removeDay={() => setDraft((d) => ({ ...d, dias: d.dias.filter((_, index) => index !== dayIndex) }))}
              updateExercise={(exerciseIndex, patch) => setDraft((d) => updateExerciseDraft(d, dayIndex, exerciseIndex, patch))}
              removeExercise={(exerciseIndex) => setDraft((d) => removeExerciseDraft(d, dayIndex, exerciseIndex))}
              addExercise={(exercise) => setDraft((d) => addExerciseDraft(d, dayIndex, exercise))}
            />
          ))}
        </div>

        <footer className="rt-modalFoot">
          <button type="button" className="rt-btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="rt-btn gold" onClick={onSave} disabled={saving}>
            <Save size={16} />
            <span>{saving ? "Guardando..." : "Guardar rutina"}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

function DayEditor({ day, dayIndex, exercises, updateDay, removeDay, updateExercise, removeExercise, addExercise }) {
  const [selectedExercise, setSelectedExercise] = useState("");

  function addSelected() {
    const exercise = exercises.find((item) => getId(item) === selectedExercise);
    addExercise(exercise || null);
    setSelectedExercise("");
  }

  return (
    <section className="rt-dayEdit">
      <div className="rt-dayEditHead">
        <Field label="Dia" value={day.nombre} onChange={(value) => updateDay({ nombre: value })} />
        <Field label="Foco" value={day.foco} onChange={(value) => updateDay({ foco: value })} />
        <button type="button" className="rt-iconBtn danger" onClick={removeDay} title="Quitar dia">
          <Trash2 size={16} />
        </button>
      </div>
      <div className="rt-addExercise">
        <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}>
          <option value="">Agregar desde ejercicios...</option>
          {exercises.map((exercise) => (
            <option key={getId(exercise)} value={getId(exercise)}>{exercise.nombre}</option>
          ))}
        </select>
        <button type="button" className="rt-btn compact" onClick={addSelected}>
          <Plus size={15} />
          <span>{selectedExercise ? "Agregar" : "Agregar libre"}</span>
        </button>
      </div>
      <div className="rt-dayExerciseEditList">
        {day.ejercicios.map((exercise, exerciseIndex) => (
          <div className="rt-exerciseEdit" key={exercise.localId}>
            <Field label="Ejercicio" value={exercise.nombreSnapshot} onChange={(value) => updateExercise(exerciseIndex, { nombreSnapshot: value })} />
            <Field label="Series" type="number" value={exercise.series} onChange={(value) => updateExercise(exerciseIndex, { series: value })} />
            <Field label="Reps" value={exercise.reps} onChange={(value) => updateExercise(exerciseIndex, { reps: value })} />
            <Field label="RIR" value={exercise.rir} onChange={(value) => updateExercise(exerciseIndex, { rir: value })} />
            <Field label="Descanso seg" type="number" value={exercise.descansoSeg} onChange={(value) => updateExercise(exerciseIndex, { descansoSeg: value })} />
            <button type="button" className="rt-iconBtn danger" onClick={() => removeExercise(exerciseIndex)} title="Quitar ejercicio">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
      {!day.ejercicios.length && <div className="rt-empty compact">Dia {dayIndex + 1} sin ejercicios.</div>}
    </section>
  );
}

function ExerciseEditor({ draft, setDraft, onSave, onCancel, saving }) {
  return (
    <div className="rt-sideEditor">
      <div className="rt-sideEditorHead">
        <h3>{draft.id ? "Editar ejercicio" : "Crear ejercicio"}</h3>
      </div>
      <div className="rt-formGrid single">
        <Field label="Nombre" value={draft.nombre} onChange={(value) => setDraft((d) => ({ ...d, nombre: value }))} />
        <Field label="Grupo principal" value={draft.grupoMuscular} onChange={(value) => setDraft((d) => ({ ...d, grupoMuscular: value }))} />
        <Field label="Secundarios" value={draft.gruposSecundariosText} onChange={(value) => setDraft((d) => ({ ...d, gruposSecundariosText: value }))} />
        <Field label="Patron" value={draft.patronMovimiento} onChange={(value) => setDraft((d) => ({ ...d, patronMovimiento: value }))} />
        <Field label="Equipamiento" value={draft.equipamiento} onChange={(value) => setDraft((d) => ({ ...d, equipamiento: value }))} />
        <SelectField label="Dificultad" value={draft.dificultad} options={LEVELS.slice(1)} onChange={(value) => setDraft((d) => ({ ...d, dificultad: value }))} />
        <label className="rt-field wide">
          <span>Instrucciones</span>
          <textarea value={draft.instrucciones} onChange={(e) => setDraft((d) => ({ ...d, instrucciones: e.target.value }))} />
        </label>
      </div>
      <div className="rt-cardActions stretch">
        <button type="button" className="rt-btn ghost" onClick={onCancel}>Cancelar</button>
        <button type="button" className="rt-btn gold" onClick={onSave} disabled={saving}>
          <Save size={16} />
          <span>{saving ? "Guardando..." : "Guardar"}</span>
        </button>
      </div>
    </div>
  );
}

function AssignRoutineDialog({ routine, clients, search, setSearch, loading, onClose, onAssign, saving }) {
  const [clientId, setClientId] = useState("");
  const [form, setForm] = useState({
    fechaInicio: new Date().toISOString().slice(0, 10),
    duracionSemanas: routine?.duracionSemanasDefault || 4,
    notasCoach: "",
  });

  return (
    <div className="rt-modalBackdrop" role="presentation">
      <section className="rt-modal small" role="dialog" aria-modal="true" aria-label="Asignar rutina">
        <header className="rt-modalHead">
          <div>
            <span className="rt-pill">Asignar rutina</span>
            <h2>{routine.nombre}</h2>
          </div>
          <button type="button" className="rt-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </header>
        <div className="rt-formGrid">
          <label className="rt-field wide">
            <span>Cliente</span>
            <div className="rt-searchWrap inField">
              <Search size={16} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar cliente..." />
            </div>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">{loading ? "Cargando..." : "Elegir cliente"}</option>
              {clients.map((client) => (
                <option key={getId(client)} value={getId(client)}>{fullName(client)} - {client.email}</option>
              ))}
            </select>
          </label>
          <Field label="Fecha inicio" type="date" value={form.fechaInicio} onChange={(value) => setForm((prev) => ({ ...prev, fechaInicio: value }))} />
          <Field label="Duracion semanas" type="number" value={form.duracionSemanas} onChange={(value) => setForm((prev) => ({ ...prev, duracionSemanas: value }))} />
          <label className="rt-field wide">
            <span>Notas coach</span>
            <textarea value={form.notasCoach} onChange={(e) => setForm((prev) => ({ ...prev, notasCoach: e.target.value }))} />
          </label>
        </div>
        <footer className="rt-modalFoot">
          <button type="button" className="rt-btn ghost" onClick={onClose}>Cancelar</button>
          <button type="button" className="rt-btn gold" disabled={!clientId || saving} onClick={() => onAssign(clientId, form)}>
            <Check size={16} />
            <span>{saving ? "Asignando..." : "Asignar"}</span>
          </button>
        </footer>
      </section>
    </div>
  );
}

function AssignedRoutineEditor({ draft, setDraft, exercises, onSave, saving }) {
  function patch(patchValue) {
    setDraft((prev) => ({ ...prev, ...patchValue }));
  }

  return (
    <div className="rt-assignedEditor">
      <div className="rt-assignedHeader">
        <div>
          <span className="rt-pill">Rutina asignada</span>
          <h2>{draft.nombre}</h2>
        </div>
        <button type="button" className="rt-btn gold" onClick={() => onSave(draft)} disabled={saving}>
          <Save size={16} />
          <span>{saving ? "Guardando..." : "Guardar ajustes"}</span>
        </button>
      </div>

      <div className="rt-formGrid">
        <Field label="Nombre" value={draft.nombre} onChange={(value) => patch({ nombre: value })} />
        <Field label="Semana actual" type="number" value={draft.semanaActual} onChange={(value) => patch({ semanaActual: value })} />
        <Field label="Fecha inicio" type="date" value={draft.fechaInicio} onChange={(value) => patch({ fechaInicio: value })} />
        <Field label="Duracion semanas" type="number" value={draft.duracionSemanas} onChange={(value) => patch({ duracionSemanas: value })} />
        <SelectField
          label="Estado"
          value={draft.estado}
          options={[["activa", "Activa"], ["pausada", "Pausada"], ["finalizada", "Finalizada"]]}
          onChange={(value) => patch({ estado: value })}
        />
        <label className="rt-field wide">
          <span>Notas coach</span>
          <textarea value={draft.notasCoach} onChange={(e) => patch({ notasCoach: e.target.value })} />
        </label>
      </div>

      <div className="rt-builderHead">
        <h3>Personalizacion fina</h3>
        <button type="button" className="rt-btn compact" onClick={() => setDraft((d) => ({ ...d, dias: [...d.dias, emptyAssignedDay(d.dias.length)] }))}>
          <Plus size={15} />
          <span>Agregar dia</span>
        </button>
      </div>

      <div className="rt-assignedDays">
        {draft.dias.map((day, dayIndex) => (
          <AssignedDay
            key={day.localId}
            day={day}
            dayIndex={dayIndex}
            exercises={exercises}
            setDraft={setDraft}
          />
        ))}
      </div>
    </div>
  );
}

function AssignedDay({ day, dayIndex, exercises, setDraft }) {
  const [selectedExercise, setSelectedExercise] = useState("");

  function updateDay(patch) {
    setDraft((draft) => updateAssignedDayDraft(draft, dayIndex, patch));
  }

  function addSelectedExercise() {
    const exercise = exercises.find((item) => getId(item) === selectedExercise);
    setDraft((draft) => addAssignedExerciseDraft(draft, dayIndex, exercise || null));
    setSelectedExercise("");
  }

  return (
    <section className="rt-assignedDay">
      <div className="rt-dayEditHead">
        <Field label="Dia" value={day.nombre} onChange={(value) => updateDay({ nombre: value })} />
        <Field label="Foco" value={day.foco} onChange={(value) => updateDay({ foco: value })} />
        <button type="button" className="rt-iconBtn danger" onClick={() => setDraft((d) => ({ ...d, dias: d.dias.filter((_, index) => index !== dayIndex) }))}>
          <Trash2 size={16} />
        </button>
      </div>
      <div className="rt-addExercise">
        <select value={selectedExercise} onChange={(e) => setSelectedExercise(e.target.value)}>
          <option value="">Agregar ejercicio...</option>
          {exercises.map((exercise) => <option key={getId(exercise)} value={getId(exercise)}>{exercise.nombre}</option>)}
        </select>
        <button type="button" className="rt-btn compact" onClick={addSelectedExercise}>
          <Plus size={15} />
          <span>{selectedExercise ? "Agregar" : "Agregar libre"}</span>
        </button>
      </div>

      {day.ejercicios.map((exercise, exerciseIndex) => (
        <AssignedExercise
          key={exercise.localId}
          exercise={exercise}
          dayIndex={dayIndex}
          exerciseIndex={exerciseIndex}
          setDraft={setDraft}
        />
      ))}
      {!day.ejercicios.length && <div className="rt-empty compact">Dia sin ejercicios.</div>}
    </section>
  );
}

function AssignedExercise({ exercise, dayIndex, exerciseIndex, setDraft }) {
  function updateExercise(patch) {
    setDraft((draft) => updateAssignedExerciseDraft(draft, dayIndex, exerciseIndex, patch));
  }

  function applyField(field) {
    const value = exercise[field] ?? "";
    setDraft((draft) => applyToSeriesDraft(draft, dayIndex, exerciseIndex, field, value));
  }

  return (
    <article className="rt-assignedExercise">
      <div className="rt-assignedExerciseHead">
        <Field label="Ejercicio" value={exercise.nombreSnapshot} onChange={(value) => updateExercise({ nombreSnapshot: value })} />
        <Field label="Series" type="number" value={exercise.series} onChange={(value) => {
          const series = Number(value) || 1;
          setDraft((draft) => resizeSeriesDraft(draft, dayIndex, exerciseIndex, series));
        }} />
        <Field label="Reps objetivo" value={exercise.reps} onChange={(value) => updateExercise({ reps: value })} />
        <Field label="RIR objetivo" value={exercise.rir} onChange={(value) => updateExercise({ rir: value })} />
        <Field label="Peso general" type="number" value={exercise.pesoKg ?? ""} onChange={(value) => updateExercise({ pesoKg: value })} />
        <button type="button" className="rt-iconBtn danger" onClick={() => setDraft((d) => removeAssignedExerciseDraft(d, dayIndex, exerciseIndex))}>
          <Trash2 size={16} />
        </button>
      </div>

      <div className="rt-seriesActions">
        <button type="button" className="rt-btn compact" onClick={() => applyField("pesoKg")}>
          <Weight size={15} />
          <span>Aplicar peso</span>
        </button>
        <button type="button" className="rt-btn compact" onClick={() => applyField("rir")}>
          <SlidersHorizontal size={15} />
          <span>Aplicar RIR</span>
        </button>
        <button type="button" className="rt-btn compact" onClick={() => applyField("reps")}>
          <ClipboardList size={15} />
          <span>Aplicar reps</span>
        </button>
        <button type="button" className="rt-btn compact" onClick={() => setDraft((d) => addSerieDraft(d, dayIndex, exerciseIndex))}>
          <Plus size={15} />
          <span>Agregar serie</span>
        </button>
        <button type="button" className="rt-btn compact" onClick={() => setDraft((d) => duplicateAssignedExerciseDraft(d, dayIndex, exerciseIndex))}>
          <Copy size={15} />
          <span>Duplicar ejercicio</span>
        </button>
      </div>

      <div className="rt-seriesTable">
        <div className="rt-seriesRow head">
          <span>Serie</span>
          <span>Reps</span>
          <span>RIR</span>
          <span>Peso kg</span>
          <span>Acciones</span>
        </div>
        {exercise.seriesDetalle.map((serie, serieIndex) => (
          <div className="rt-seriesRow" key={`${exercise.localId}-serie-${serieIndex}`}>
            <span className="rt-serieNum">{serie.serie}</span>
            <input value={serie.reps} onChange={(e) => setDraft((d) => updateSerieDraft(d, dayIndex, exerciseIndex, serieIndex, { reps: e.target.value }))} />
            <input value={serie.rir} onChange={(e) => setDraft((d) => updateSerieDraft(d, dayIndex, exerciseIndex, serieIndex, { rir: e.target.value }))} />
            <input type="number" value={serie.pesoKg ?? ""} onChange={(e) => setDraft((d) => updateSerieDraft(d, dayIndex, exerciseIndex, serieIndex, { pesoKg: e.target.value }))} />
            <button type="button" className="rt-iconBtn danger" onClick={() => setDraft((d) => removeSerieDraft(d, dayIndex, exerciseIndex, serieIndex))}>
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <label className="rt-field wide">
        <span>Notas del ejercicio</span>
        <textarea value={exercise.notas} onChange={(e) => updateExercise({ notas: e.target.value })} />
      </label>
    </article>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label className="rt-field">
      <span>{label}</span>
      <input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <label className="rt-field">
      <span>{label}</span>
      <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>{labelText}</option>
        ))}
      </select>
    </label>
  );
}

function FactLine({ icon, label, value }) {
  return (
    <div className="rt-factLine">
      {React.createElement(icon, { size: 15, strokeWidth: 2.3, "aria-hidden": "true" })}
      <span>{label}:</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="rt-routineGrid">
      {Array.from({ length: 4 }).map((_, index) => <div key={index} className="rt-skeleton" />)}
    </div>
  );
}

function getId(item) {
  return String(item?.id || item?._id || "");
}

function fullName(user) {
  const name = `${user?.profile?.nombre || ""} ${user?.profile?.apellido || ""}`.trim();
  return name || user?.email || "Cliente";
}

function labelToken(value) {
  return String(value || "-").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function labelVisibility(value) {
  if (value === "publica") return "Publica";
  if (value === "sistema") return "Sistema";
  if (value === "privada") return "Privada";
  return labelToken(value);
}

function localId(prefix = "rt") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function emptyExercise(index = 0, source = null) {
  return {
    localId: localId("ex"),
    ejercicioId: source ? getId(source) : null,
    nombreSnapshot: source?.nombre || `Ejercicio ${index + 1}`,
    grupoMuscularSnapshot: source?.grupoMuscular || "general",
    series: 3,
    reps: "8-10",
    rir: "2-3",
    descansoSeg: 90,
    tempo: "",
    notas: "",
  };
}

function emptyAssignedExercise(index = 0, source = null) {
  const base = emptyExercise(index, source);
  return {
    ...base,
    pesoKg: "",
    seriesDetalle: seriesDetails(base.series, base.reps, base.rir, ""),
  };
}

function emptyDay(index = 0) {
  return {
    localId: localId("day"),
    nombre: `Dia ${index + 1}`,
    orden: index + 1,
    foco: "",
    ejercicios: [],
  };
}

function emptyAssignedDay(index = 0) {
  return {
    ...emptyDay(index),
    ejercicios: [],
  };
}

function createEmptyRoutine(scope = "coach") {
  return {
    id: "",
    mode: "create",
    demo: false,
    nombre: "",
    descripcion: "",
    objetivo: "hipertrofia",
    nivel: "principiante",
    diasPorSemana: 3,
    duracionSemanasDefault: 4,
    visibilidad: scope === "admin" ? "publica" : "privada",
    tagsText: "",
    estado: "activa",
    dias: [emptyDay(0)],
  };
}

function routineToDraft(routine = null, mode = "create", scope = "coach") {
  if (!routine) return createEmptyRoutine(scope);

  return {
    id: getId(routine),
    mode,
    demo: !!routine.demo,
    nombre: routine.nombre || "",
    descripcion: routine.descripcion || "",
    objetivo: routine.objetivo || "hipertrofia",
    nivel: routine.nivel || "principiante",
    diasPorSemana: routine.diasPorSemana || 3,
    duracionSemanasDefault: routine.duracionSemanasDefault || 4,
    visibilidad: routine.demo ? (scope === "admin" ? "publica" : "privada") : routine.visibilidad || "privada",
    tagsText: (routine.tags || []).join(", "),
    estado: routine.estado || "activa",
    dias: (routine.dias || []).map((day) => ({
      ...day,
      localId: localId("day"),
      ejercicios: (day.ejercicios || []).map((exercise, exerciseIndex) => ({
        ...emptyExercise(exerciseIndex),
        ...exercise,
        localId: localId("ex"),
      })),
    })),
  };
}

function routineDraftToPayload(draft, scope = "coach") {
  return {
    nombre: draft.nombre,
    descripcion: draft.descripcion,
    objetivo: draft.objetivo,
    nivel: draft.nivel,
    diasPorSemana: Number(draft.diasPorSemana) || 1,
    duracionSemanasDefault: Number(draft.duracionSemanasDefault) || 4,
    visibilidad: scope === "admin" ? draft.visibilidad : "privada",
    tags: String(draft.tagsText || "").split(",").map((item) => item.trim()).filter(Boolean),
    estado: draft.estado || "activa",
    dias: draft.dias.map((day, dayIndex) => ({
      nombre: day.nombre,
      orden: dayIndex + 1,
      foco: day.foco,
      ejercicios: day.ejercicios.map((exercise) => ({
        ejercicioId: exercise.ejercicioId || null,
        nombreSnapshot: exercise.nombreSnapshot,
        grupoMuscularSnapshot: exercise.grupoMuscularSnapshot,
        series: Number(exercise.series) || 1,
        reps: exercise.reps,
        rir: exercise.rir,
        descansoSeg: Number(exercise.descansoSeg) || 0,
        tempo: exercise.tempo || "",
        notas: exercise.notas || "",
      })),
    })),
  };
}

function assignedToDraft(routine) {
  return {
    id: getId(routine),
    nombre: routine.nombre || "",
    descripcion: routine.descripcion || "",
    fechaInicio: routine.fechaInicio ? String(routine.fechaInicio).slice(0, 10) : "",
    duracionSemanas: routine.duracionSemanas || 4,
    semanaActual: routine.semanaActual || 1,
    estado: routine.estado || "activa",
    notasCoach: routine.notasCoach || "",
    dias: (routine.dias || []).map((day, dayIndex) => ({
      ...day,
      localId: localId("aday"),
      orden: day.orden || dayIndex + 1,
      ejercicios: (day.ejercicios || []).map((exercise, exerciseIndex) => {
        const series = Number(exercise.series) || Number(exercise.seriesDetalle?.length) || 1;
        return {
          ...emptyAssignedExercise(exerciseIndex),
          ...exercise,
          localId: localId("aex"),
          series,
          pesoKg: exercise.pesoKg ?? "",
          seriesDetalle: normalizeSeriesDetails(exercise.seriesDetalle, series, exercise.reps, exercise.rir, exercise.pesoKg),
        };
      }),
    })),
  };
}

function assignedDraftToPayload(draft) {
  return {
    nombre: draft.nombre,
    descripcion: draft.descripcion,
    fechaInicio: draft.fechaInicio,
    duracionSemanas: Number(draft.duracionSemanas) || 4,
    semanaActual: Number(draft.semanaActual) || 1,
    estado: draft.estado,
    notasCoach: draft.notasCoach,
    dias: draft.dias.map((day, dayIndex) => ({
      nombre: day.nombre,
      orden: dayIndex + 1,
      foco: day.foco,
      ejercicios: day.ejercicios.map((exercise) => ({
        ejercicioId: exercise.ejercicioId || null,
        nombreSnapshot: exercise.nombreSnapshot,
        grupoMuscularSnapshot: exercise.grupoMuscularSnapshot,
        series: Number(exercise.series) || exercise.seriesDetalle.length || 1,
        reps: exercise.reps,
        rir: exercise.rir,
        pesoKg: exercise.pesoKg === "" || exercise.pesoKg === null || exercise.pesoKg === undefined
          ? null
          : Number(exercise.pesoKg),
        descansoSeg: Number(exercise.descansoSeg) || 0,
        tempo: exercise.tempo || "",
        notas: exercise.notas || "",
        seriesDetalle: exercise.seriesDetalle.map((serie, index) => ({
          serie: index + 1,
          reps: serie.reps,
          rir: serie.rir,
          pesoKg: serie.pesoKg === "" || serie.pesoKg === null || serie.pesoKg === undefined
            ? null
            : Number(serie.pesoKg),
          completada: !!serie.completada,
        })),
      })),
    })),
  };
}

function emptyExerciseDraft() {
  return {
    id: "",
    nombre: "",
    grupoMuscular: "general",
    gruposSecundariosText: "",
    patronMovimiento: "aislamiento",
    equipamiento: "peso_corporal",
    dificultad: "principiante",
    instrucciones: "",
    videoUrl: "",
    imagenUrl: "",
    estado: "activa",
  };
}

function exerciseToDraft(exercise) {
  return {
    id: getId(exercise),
    nombre: exercise.nombre || "",
    grupoMuscular: exercise.grupoMuscular || "",
    gruposSecundariosText: (exercise.gruposSecundarios || []).join(", "),
    patronMovimiento: exercise.patronMovimiento || "",
    equipamiento: exercise.equipamiento || "",
    dificultad: exercise.dificultad || "principiante",
    instrucciones: exercise.instrucciones || "",
    videoUrl: exercise.videoUrl || "",
    imagenUrl: exercise.imagenUrl || "",
    estado: exercise.estado || "activa",
  };
}

function updateDayDraft(draft, dayIndex, patch) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)),
  };
}

function updateExerciseDraft(draft, dayIndex, exerciseIndex, patch) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map((exercise, exIndex) => (
          exIndex === exerciseIndex ? { ...exercise, ...patch } : exercise
        )),
      };
    }),
  };
}

function addExerciseDraft(draft, dayIndex, exercise) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: [...day.ejercicios, emptyExercise(day.ejercicios.length, exercise)],
      };
    }),
  };
}

function removeExerciseDraft(draft, dayIndex, exerciseIndex) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => (
      index === dayIndex
        ? { ...day, ejercicios: day.ejercicios.filter((_, exIndex) => exIndex !== exerciseIndex) }
        : day
    )),
  };
}

function updateAssignedDayDraft(draft, dayIndex, patch) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => (index === dayIndex ? { ...day, ...patch } : day)),
  };
}

function updateAssignedExerciseDraft(draft, dayIndex, exerciseIndex, patch) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map((exercise, exIndex) => (
          exIndex === exerciseIndex ? { ...exercise, ...patch } : exercise
        )),
      };
    }),
  };
}

function addAssignedExerciseDraft(draft, dayIndex, exercise) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: [...day.ejercicios, emptyAssignedExercise(day.ejercicios.length, exercise)],
      };
    }),
  };
}

function removeAssignedExerciseDraft(draft, dayIndex, exerciseIndex) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => (
      index === dayIndex
        ? { ...day, ejercicios: day.ejercicios.filter((_, exIndex) => exIndex !== exerciseIndex) }
        : day
    )),
  };
}

function duplicateAssignedExerciseDraft(draft, dayIndex, exerciseIndex) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      const source = day.ejercicios[exerciseIndex];
      const copy = {
        ...source,
        localId: localId("aex"),
        nombreSnapshot: `${source.nombreSnapshot} copia`,
        seriesDetalle: source.seriesDetalle.map((serie, serieIndex) => ({ ...serie, serie: serieIndex + 1 })),
      };
      const next = [...day.ejercicios];
      next.splice(exerciseIndex + 1, 0, copy);
      return { ...day, ejercicios: next };
    }),
  };
}

function seriesDetails(count, reps, rir, pesoKg) {
  return Array.from({ length: Number(count) || 1 }).map((_, index) => ({
    serie: index + 1,
    reps: reps || "",
    rir: rir || "",
    pesoKg: pesoKg ?? "",
    completada: false,
  }));
}

function normalizeSeriesDetails(details, count, reps, rir, pesoKg) {
  const target = Number(count) || 1;
  return Array.from({ length: target }).map((_, index) => ({
    serie: index + 1,
    reps: details?.[index]?.reps ?? reps ?? "",
    rir: details?.[index]?.rir ?? rir ?? "",
    pesoKg: details?.[index]?.pesoKg ?? pesoKg ?? "",
    completada: !!details?.[index]?.completada,
  }));
}

function resizeSeriesDraft(draft, dayIndex, exerciseIndex, series) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map((exercise, exIndex) => {
          if (exIndex !== exerciseIndex) return exercise;
          return {
            ...exercise,
            series,
            seriesDetalle: normalizeSeriesDetails(exercise.seriesDetalle, series, exercise.reps, exercise.rir, exercise.pesoKg),
          };
        }),
      };
    }),
  };
}

function addSerieDraft(draft, dayIndex, exerciseIndex) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map((exercise, exIndex) => {
          if (exIndex !== exerciseIndex) return exercise;
          const next = [
            ...exercise.seriesDetalle,
            {
              serie: exercise.seriesDetalle.length + 1,
              reps: exercise.reps || "",
              rir: exercise.rir || "",
              pesoKg: exercise.pesoKg ?? "",
              completada: false,
            },
          ];
          return { ...exercise, series: next.length, seriesDetalle: next };
        }),
      };
    }),
  };
}

function removeSerieDraft(draft, dayIndex, exerciseIndex, serieIndex) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map((exercise, exIndex) => {
          if (exIndex !== exerciseIndex) return exercise;
          const next = exercise.seriesDetalle
            .filter((_, idx) => idx !== serieIndex)
            .map((serie, idx) => ({ ...serie, serie: idx + 1 }));
          return { ...exercise, series: next.length || 1, seriesDetalle: next.length ? next : seriesDetails(1, exercise.reps, exercise.rir, exercise.pesoKg) };
        }),
      };
    }),
  };
}

function updateSerieDraft(draft, dayIndex, exerciseIndex, serieIndex, patch) {
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map((exercise, exIndex) => {
          if (exIndex !== exerciseIndex) return exercise;
          return {
            ...exercise,
            seriesDetalle: exercise.seriesDetalle.map((serie, idx) => (
              idx === serieIndex ? { ...serie, ...patch } : serie
            )),
          };
        }),
      };
    }),
  };
}

function applyToSeriesDraft(draft, dayIndex, exerciseIndex, field, value) {
  const targetField = field === "pesoKg" ? "pesoKg" : field;
  return {
    ...draft,
    dias: draft.dias.map((day, index) => {
      if (index !== dayIndex) return day;
      return {
        ...day,
        ejercicios: day.ejercicios.map((exercise, exIndex) => {
          if (exIndex !== exerciseIndex) return exercise;
          return {
            ...exercise,
            seriesDetalle: exercise.seriesDetalle.map((serie) => ({ ...serie, [targetField]: value })),
          };
        }),
      };
    }),
  };
}
