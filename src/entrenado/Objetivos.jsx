import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Apple,
  CalendarDays,
  CheckCircle2,
  Droplets,
  Dumbbell,
  Flame,
  Info,
  LoaderCircle,
  Lock,
  Pencil,
  RotateCcw,
  Save,
  Target,
  Wheat,
  X,
} from "lucide-react";

import { clientAccessContextKey, clientPlanCapabilitiesKey } from "../clientPlans/clientPlanQueries.js";
import { clientPlanLabel, normalizeClientPlan, planFromCapabilities } from "../clientPlans/clientPlanUtils.js";
import { clientGoalsKey, fetchClientGoals, updateClientGoals } from "../clientGoals/clientGoalsApi.js";
import { queryKeys } from "../queryClient.js";
import "./Objetivos.css";

const EMPTY_OBJECT = {};

const DAYS = [
  { key: "monday", short: "Lun", label: "Lunes" },
  { key: "tuesday", short: "Mar", label: "Martes" },
  { key: "wednesday", short: "Mie", label: "Miercoles" },
  { key: "thursday", short: "Jue", label: "Jueves" },
  { key: "friday", short: "Vie", label: "Viernes" },
  { key: "saturday", short: "Sab", label: "Sabado" },
  { key: "sunday", short: "Dom", label: "Domingo" },
];

const GOAL_TYPES = [
  { value: "ganar_masa", label: "Ganar masa muscular" },
  { value: "ganar_peso", label: "Ganar peso" },
  { value: "perder_grasa", label: "Perder grasa" },
  { value: "perder_peso", label: "Perder peso" },
  { value: "fuerza", label: "Mejorar fuerza" },
  { value: "resistencia", label: "Mejorar resistencia" },
  { value: "mantener_peso", label: "Mantener condicion" },
];

const TRAINING_DAYS_DEFAULT = ["monday", "tuesday", "thursday", "friday"];
const MACRO_DRAFT_KEYS = new Set(["p", "c", "g"]);

function asNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function firstNumber(...values) {
  for (const value of values) {
    const n = maybeNumber(value);
    if (n !== null) return n;
  }
  return null;
}

function clampNumber(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function maybeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function round(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function formatNumber(value, suffix = "") {
  const n = maybeNumber(value);
  if (n === null) return "Sin definir";
  return `${Math.round(n).toLocaleString("es-AR")}${suffix}`;
}

function progressWidth(value, max) {
  const n = maybeNumber(value);
  const limit = Math.max(1, Number(max) || 1);
  if (n === null || n <= 0) return "0%";
  return `${Math.min(100, Math.max(8, Math.round((n / limit) * 100)))}%`;
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function macroKcal(macros = {}) {
  const p = maybeNumber(macros.p);
  const c = maybeNumber(macros.c);
  const g = maybeNumber(macros.g);
  if (p === null || c === null || g === null) return null;
  return Math.round(p * 4 + c * 4 + g * 9);
}

function targetFromUser(user = {}) {
  const metas = user?.metasActuales || {};
  const macros = metas?.macros || {};
  const kcal = maybeNumber(metas.kcal);
  const p = maybeNumber(macros.p);
  const c = maybeNumber(macros.c);
  const g = maybeNumber(macros.g);

  if (kcal !== null || p !== null || c !== null || g !== null) {
    return {
      kcal,
      macros: { p, c, g },
      source: metas.source || "self",
      sourceCoachId: metas.sourceCoachId || null,
      needsReview: metas.needsReview === true,
      updatedAt: metas.updatedAt || null,
      status: "ok",
    };
  }

  const legacyKcal = maybeNumber(user?.goal?.initialBudgetKcal || user?.profile?.basics?.tdeeEstimado);
  if (legacyKcal !== null) {
    return {
      kcal: legacyKcal,
      macros: distributeMacros(legacyKcal, user),
      source: "legacy",
      sourceCoachId: null,
      needsReview: true,
      updatedAt: null,
      status: "legacy",
    };
  }

  return {
    kcal: null,
    macros: { p: null, c: null, g: null },
    source: "missing",
    sourceCoachId: null,
    needsReview: true,
    updatedAt: null,
    status: "missing",
  };
}

function proteinRatio(program = {}) {
  const level = String(program?.protein || "").toLowerCase();
  if (level === "low") return 0.18;
  if (level === "high") return 0.3;
  if (level === "extra_high") return 0.34;
  return 0.25;
}

function macroRatios(program = {}) {
  const p = proteinRatio(program);
  const diet = String(program?.diet || "").toLowerCase();
  if (diet === "keto") return { p, c: 0.08, g: 0.92 - p };
  if (diet === "baja_carbo") return { p, c: 0.28, g: 0.72 - p };
  if (diet === "baja_grasa") return { p, c: 0.55, g: 0.45 - p };
  return { p, c: 0.45, g: 0.55 - p };
}

function distributeMacros(kcal, user = {}) {
  const calories = Math.max(0, asNumber(kcal));
  const ratios = macroRatios(user?.program || {});
  return {
    p: round((calories * ratios.p) / 4),
    c: round((calories * ratios.c) / 4),
    g: round((calories * Math.max(0.08, ratios.g)) / 9),
  };
}

function getCurrentWeightKg(user = {}) {
  return firstNumber(
    user?.body?.weightKg,
    user?.antropometriaActual?.pesoKg,
    user?.stats?.pesoActualKg,
    user?.stats?.pesoActual,
    user?.progress?.pesoActualKg,
    user?.goal?.startWeightKg
  );
}

function getMaintenanceKcal(user = {}, target = {}) {
  return firstNumber(
    user?.body?.tdeeCustom,
    user?.profile?.basics?.tdeeCustom,
    user?.goal?.maintenanceKcal,
    user?.body?.tdeeEstimated,
    user?.profile?.basics?.tdeeEstimado,
    user?.goal?.initialBudgetKcal,
    target?.kcal
  );
}

function getGoalMode(user = {}) {
  const type = String(user?.goal?.type || "").toLowerCase();
  if (type === "perder_peso" || type === "perder_grasa") return "lose";
  if (type === "ganar_peso" || type === "ganar_masa") return "gain";
  return "maintain";
}

function buildAutomaticNutritionTarget(user = {}, target = {}) {
  const maintenance = getMaintenanceKcal(user, target);
  const weight = getCurrentWeightKg(user);
  const mode = getGoalMode(user);
  const defaultRate = mode === "maintain" ? 0 : 0.5;
  const rate = Math.abs(firstNumber(user?.goal?.ratePctBWPerWeek, defaultRate) || defaultRate);
  const fallbackKcal = firstNumber(user?.goal?.initialBudgetKcal, target?.kcal, maintenance);
  let kcal = maintenance ?? fallbackKcal;
  const warnings = [];

  if (maintenance !== null && mode !== "maintain") {
    if (weight !== null) {
      const kcalPerDay = ((weight * (rate / 100)) * 7700) / 7;
      if (mode === "lose") {
        const minBudget = 1400;
        const maxBudgetLose = Math.max(minBudget, maintenance - 100);
        kcal = Math.round(clampNumber(maintenance - kcalPerDay, minBudget, maxBudgetLose));
      } else {
        kcal = Math.round(clampNumber(maintenance + kcalPerDay, maintenance + 100, maintenance + 1200));
      }
    } else {
      kcal = fallbackKcal ?? maintenance;
      warnings.push("No encontramos peso actual. Usamos tu presupuesto guardado como base.");
    }
  } else if (maintenance !== null) {
    kcal = Math.round(maintenance);
  }

  if (kcal === null || kcal === undefined) {
    return {
      kcal: null,
      macros: { p: null, c: null, g: null },
      description: "Faltan datos de peso o mantenimiento",
      warning: "Faltan datos corporales para calcular automaticamente.",
    };
  }

  const macros = distributeMacros(kcal, user);
  const modeLabel = mode === "lose" ? "perdida" : mode === "gain" ? "subida" : "mantenimiento";
  const parts = [
    maintenance !== null ? `TDEE ${round(maintenance).toLocaleString("es-AR")} kcal` : "meta actual",
    weight !== null ? `peso ${weight.toLocaleString("es-AR")} kg` : "sin peso actual",
    mode === "maintain" ? modeLabel : `${modeLabel} ${rate}%/sem`,
  ];

  return {
    kcal: round(kcal),
    macros,
    description: parts.join(" · "),
    warning: warnings[0] || "",
  };
}

function draftFromTarget(target) {
  return {
    kcal: target?.kcal !== null && target?.kcal !== undefined ? String(round(target.kcal)) : "",
    p: target?.macros?.p !== null && target?.macros?.p !== undefined ? String(round(target.macros.p)) : "",
    c: target?.macros?.c !== null && target?.macros?.c !== undefined ? String(round(target.macros.c)) : "",
    g: target?.macros?.g !== null && target?.macros?.g !== undefined ? String(round(target.macros.g)) : "",
  };
}

function normalizeDraft(draft = {}) {
  return {
    kcal: maybeNumber(draft.kcal),
    p: maybeNumber(draft.p),
    c: maybeNumber(draft.c),
    g: maybeNumber(draft.g),
  };
}

function kcalFromDraftMacros(draft = {}) {
  const values = normalizeDraft(draft);
  return macroKcal({ p: values.p, c: values.c, g: values.g });
}

function isNutritionDraftValid(draft = {}) {
  const values = normalizeDraft(draft);
  return (
    values.kcal !== null &&
    values.kcal >= 800 &&
    values.kcal <= 7000 &&
    values.p !== null &&
    values.p >= 0 &&
    values.p <= 500 &&
    values.c !== null &&
    values.c >= 0 &&
    values.c <= 900 &&
    values.g !== null &&
    values.g >= 0 &&
    values.g <= 400
  );
}

function energyMismatch(draft = {}) {
  const values = normalizeDraft(draft);
  if (values.kcal === null || values.p === null || values.c === null || values.g === null) return null;
  const fromMacros = macroKcal({ p: values.p, c: values.c, g: values.g });
  const diff = Math.abs(fromMacros - values.kcal);
  const tolerance = Math.max(80, values.kcal * 0.05);
  return {
    fromMacros,
    diff,
    tolerance,
    warning: diff > tolerance,
    severe: diff > Math.max(250, values.kcal * 0.18),
  };
}

function sameNutritionDraft(a = {}, b = {}) {
  const left = normalizeDraft(a);
  const right = normalizeDraft(b);
  return ["kcal", "p", "c", "g"].every((key) => round(left[key]) === round(right[key]));
}

function goalLabel(type = "") {
  const found = GOAL_TYPES.find((goal) => goal.value === type);
  if (found) return found.label;
  if (type === "ganar_peso") return "Ganar peso";
  if (type === "perder_peso") return "Perder peso";
  if (type === "mantener_peso") return "Mantener condicion";
  return "Sin definir";
}

function trainingLevelLabel(value = "") {
  const v = String(value || "").toLowerCase();
  if (v === "avanzado") return "Avanzado";
  if (v === "intermedio") return "Intermedio";
  if (v === "principiante") return "Principiante";
  if (v === "ninguna") return "Inicial";
  return "Sin definir";
}

function trainingFrequencyLabel(value = "") {
  const v = String(value || "").toLowerCase();
  if (v === "6_plus") return "6 o mas dias por semana";
  if (v === "4_5") return "4 a 5 dias por semana";
  if (v === "1_3") return "1 a 3 dias por semana";
  if (v === "0") return "Sin entrenamiento fijo";
  return "Sin definir";
}

function buildDayDrafts(target) {
  const base = draftFromTarget(target);
  return DAYS.reduce((acc, day) => {
    acc[day.key] = { ...base };
    return acc;
  }, {});
}

function buildWeeklyPayload(mode, dayDrafts, trainingDays) {
  if (mode === "same_all_days") {
    return { mode: "same_all_days", caloriesByDay: {}, macrosByDay: {}, trainingDays: [] };
  }

  const caloriesByDay = {};
  const macrosByDay = {};
  DAYS.forEach((day) => {
    const values = normalizeDraft(dayDrafts[day.key] || {});
    if (values.kcal !== null) caloriesByDay[day.key] = values.kcal;
    if (values.p !== null || values.c !== null || values.g !== null) {
      macrosByDay[day.key] = {
        ...(values.p !== null ? { p: values.p } : {}),
        ...(values.c !== null ? { c: values.c } : {}),
        ...(values.g !== null ? { g: values.g } : {}),
      };
    }
  });

  return {
    mode,
    caloriesByDay,
    macrosByDay,
    trainingDays: mode === "training_rest" ? trainingDays : [],
  };
}

function getPlan(data = {}) {
  const user = data.user || {};
  const accessContext = data.accessContext || {};
  const capabilities = accessContext.capabilities || user.nutritionCapabilities || null;
  return normalizeClientPlan(planFromCapabilities(user, capabilities));
}

function Notice({ type = "info", children }) {
  return <div className={`og-notice ${type}`} role={type === "error" ? "alert" : "status"}>{children}</div>;
}

function ObjectiveStat({ label, value, width, tone = "yellow" }) {
  return (
    <div className="og-targetStat">
      <span>{label}</span>
      <strong>{value}</strong>
      <i className={tone} style={{ "--og-fill": width }} />
    </div>
  );
}

function EditorField({ icon, label, unit, value, onChange, readOnly = false, disabled = false, autoFocus = false }) {
  return (
    <label className={`og-editorField ${readOnly ? "readonly" : ""}`}>
      <span className="og-editorFieldIcon">{React.createElement(icon, { size: 18 })}</span>
      <span className="og-editorFieldLabel">{label}</span>
      <span className="og-editorFieldUnit">{unit}</span>
      <input
        data-autofocus={autoFocus ? "true" : undefined}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        readOnly={readOnly}
        disabled={disabled}
      />
    </label>
  );
}

export default function Objetivos() {
  const queryClientHook = useQueryClient();
  const editButtonRef = useRef(null);
  const dialogRef = useRef(null);
  const [activeTab, setActiveTab] = useState("nutrition");
  const [editNutrition, setEditNutrition] = useState(false);
  const [nutritionMode, setNutritionMode] = useState("recalculate");
  const [nutritionDraft, setNutritionDraft] = useState({ kcal: "", p: "", c: "", g: "" });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [weeklyMode, setWeeklyMode] = useState("same_all_days");
  const [dayDrafts, setDayDrafts] = useState({});
  const [trainingDays, setTrainingDays] = useState(TRAINING_DAYS_DEFAULT);
  const [confirmLastChange, setConfirmLastChange] = useState(false);
  const [status, setStatus] = useState(null);
  const [trainingDraft, setTrainingDraft] = useState({ type: "", approach: "" });

  const goalsQuery = useQuery({
    queryKey: clientGoalsKey,
    queryFn: fetchClientGoals,
    staleTime: 45 * 1000,
    retry: 1,
  });

  const data = goalsQuery.data || EMPTY_OBJECT;
  const user = data.user || EMPTY_OBJECT;
  const accessContext = data.accessContext || {};
  const capabilities = accessContext.capabilities || user.nutritionCapabilities || {};
  const plan = getPlan(data);
  const target = useMemo(() => targetFromUser(user), [user]);
  const initialDraft = useMemo(() => draftFromTarget(target), [target]);
  const automaticTarget = useMemo(() => buildAutomaticNutritionTarget(user, target), [user, target]);
  const goalsAccess = user.goalsAccess || {};
  const nutritionAuthority = accessContext?.authority?.nutrition || user?.goalsAccess?.authority || "client";
  const trainingAuthority = accessContext?.authority?.training || "client";
  const nutritionLockedByCoach = nutritionAuthority === "coach" || target.source === "coach";
  const trainingLockedByCoach = trainingAuthority === "coach";
  const isFree = plan === "free";
  const canUseWeeklyTargets = !!capabilities?.nutrition?.weeklyPlanning || plan === "pro" || plan === "vip";
  const changesLimit = goalsAccess.changesLimit;
  const changesRemaining = goalsAccess.changesRemaining;
  const mismatch = energyMismatch(nutritionDraft);
  const nutritionDraftUnchanged = sameNutritionDraft(nutritionDraft, initialDraft);
  const nutritionUnchanged = nutritionDraftUnchanged && weeklyMode === "same_all_days";
  const weeklyPlan = user?.menu?.weeklyPlan || {};
  const freeChangesBlocked = isFree && changesLimit !== null && changesRemaining <= 0;
  const canEditNutrition = !nutritionLockedByCoach && !freeChangesBlocked;
  const editorChangeText = nutritionLockedByCoach
    ? "Gestionado por coach"
    : !isFree
      ? "Edicion libre"
      : freeChangesBlocked
        ? "Sin cambios disponibles"
        : changesRemaining === 1
          ? "Ultimo cambio disponible"
          : `${changesRemaining ?? 0} cambios disponibles`;

  const mutation = useMutation({
    mutationFn: updateClientGoals,
    onSuccess: async (updatedUser) => {
      setStatus({ type: "success", text: "Objetivo actualizado correctamente." });
      setConfirmLastChange(false);
      setShowDiscardConfirm(false);
      setEditNutrition(false);
      window.setTimeout(() => editButtonRef.current?.focus(), 0);
      queryClientHook.setQueryData(clientGoalsKey, (old) => ({ ...(old || {}), user: updatedUser || old?.user }));
      await Promise.all([
        queryClientHook.invalidateQueries({ queryKey: queryKeys.authMe() }),
        queryClientHook.invalidateQueries({ queryKey: clientGoalsKey }),
        queryClientHook.invalidateQueries({ queryKey: clientAccessContextKey }),
        queryClientHook.invalidateQueries({ queryKey: clientPlanCapabilitiesKey }),
        queryClientHook.invalidateQueries({ queryKey: queryKeys.trackingDay(new Date().toISOString().slice(0, 10)) }),
      ]);
    },
    onError: (error) => {
      setStatus({
        type: "error",
        text: error?.message || error?.error || "No pudimos guardar los objetivos.",
      });
    },
  });

  useEffect(() => {
    setNutritionDraft(initialDraft);
    setDayDrafts(buildDayDrafts(target));
    setWeeklyMode(weeklyPlan?.mode || "same_all_days");
    setTrainingDays(Array.isArray(weeklyPlan?.trainingDays) && weeklyPlan.trainingDays.length ? weeklyPlan.trainingDays : TRAINING_DAYS_DEFAULT);
  }, [initialDraft, target, weeklyPlan?.mode, weeklyPlan?.trainingDays]);

  useEffect(() => {
    setTrainingDraft({
      type: user?.goal?.type || "",
      approach: user?.goal?.approach || "",
    });
  }, [user?.goal?.type, user?.goal?.approach]);

  const closeNutritionEditor = useCallback(() => {
    setEditNutrition(false);
    setShowDiscardConfirm(false);
    setConfirmLastChange(false);
    setStatus(null);
    setNutritionMode("manual");
    setNutritionDraft(initialDraft);
    window.setTimeout(() => editButtonRef.current?.focus(), 0);
  }, [initialDraft]);

  useEffect(() => {
    if (!editNutrition) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
    const focusTimer = window.setTimeout(() => {
      const first = dialogRef.current?.querySelector("[data-autofocus]") || dialogRef.current?.querySelector(focusableSelector);
      first?.focus();
    }, 0);

    function closeFromKeyboard() {
      closeNutritionEditor();
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeFromKeyboard();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(dialogRef.current.querySelectorAll(focusableSelector))
        .filter((node) => !node.hasAttribute("disabled") && node.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [editNutrition, closeNutritionEditor]);

  

  function openNutritionEditor() {
    setEditNutrition(true);
    setNutritionDraft(initialDraft);
    setNutritionMode("manual");
    setConfirmLastChange(false);
    setShowDiscardConfirm(false);
    setStatus(null);
  }

  function handleEditorBackdrop(event) {
    if (event.target === event.currentTarget) {
      closeNutritionEditor();
    }
  }

  function setDraftValue(key, value) {
    setStatus(null);
    setConfirmLastChange(false);
    setShowDiscardConfirm(false);
    setNutritionDraft((current) => {
      const next = { ...current, [key]: value };
      if (nutritionMode === "recalculate" && key === "kcal") {
        const macros = distributeMacros(value, user);
        return {
          ...next,
          p: String(macros.p),
          c: String(macros.c),
          g: String(macros.g),
        };
      }
      if (nutritionMode === "manual" && MACRO_DRAFT_KEYS.has(key)) {
        const kcal = kcalFromDraftMacros(next);
        if (kcal !== null) return { ...next, kcal: String(kcal) };
      }
      return next;
    });
  }

  function handleRecalculateMacros() {
    const macros = distributeMacros(nutritionDraft.kcal, user);
    setNutritionDraft((current) => ({
      ...current,
      p: String(macros.p),
      c: String(macros.c),
      g: String(macros.g),
    }));
  }

  function handleAdjustCaloriesToMacros() {
    const kcal = kcalFromDraftMacros(nutritionDraft);
    if (kcal !== null) setNutritionDraft((current) => ({ ...current, kcal: String(kcal) }));
  }

  function enableManualNutritionMode() {
    setShowDiscardConfirm(false);
    setNutritionMode("manual");
    const kcal = kcalFromDraftMacros(nutritionDraft);
    if (kcal !== null) setNutritionDraft((current) => ({ ...current, kcal: String(kcal) }));
  }

  function applyAutomaticNutritionTarget() {
    setStatus(null);
    setConfirmLastChange(false);
    setShowDiscardConfirm(false);
    setNutritionMode("recalculate");
    if (automaticTarget.kcal === null || automaticTarget.kcal === undefined) {
      setStatus({ type: "warn", text: automaticTarget.warning || "Faltan datos para recalcular automaticamente." });
      return;
    }
    setNutritionDraft({
      kcal: String(automaticTarget.kcal),
      p: String(automaticTarget.macros.p),
      c: String(automaticTarget.macros.c),
      g: String(automaticTarget.macros.g),
    });
  }

  function saveNutrition(confirmed = false) {
    setStatus(null);
    if (nutritionLockedByCoach) {
      setStatus({ type: "error", text: "Tu objetivo nutricional esta gestionado por tu coach." });
      return;
    }
    if (!isNutritionDraftValid(nutritionDraft)) {
      setStatus({ type: "error", text: "Revisa valores vacios, negativos o fuera de rango seguro." });
      return;
    }
    if (mismatch?.severe) {
      setStatus({ type: "error", text: "Las calorias no coinciden con los macros. Ajusta antes de guardar." });
      return;
    }
    if (nutritionUnchanged) {
      setStatus({ type: "info", text: "No hay cambios nuevos para guardar." });
      return;
    }
    if (isFree && changesLimit !== null && changesRemaining === 1 && !confirmed) {
      setConfirmLastChange(true);
      return;
    }
    if (isFree && changesLimit !== null && changesRemaining <= 0) {
      setStatus({ type: "error", text: `No te quedan cambios hasta el ${formatDate(goalsAccess.nextResetAt) || "proximo periodo"}.` });
      return;
    }

    const values = normalizeDraft(nutritionDraft);
    const payload = {
      metasActuales: {
        kcal: values.kcal,
        macros: { p: values.p, c: values.c, g: values.g },
      },
    };
    if (!isFree && canUseWeeklyTargets) {
      payload.weeklyPlan = buildWeeklyPayload(weeklyMode, dayDrafts, trainingDays);
    }
    mutation.mutate(payload);
  }

  function saveTraining() {
    setStatus(null);
    if (trainingLockedByCoach) {
      setStatus({ type: "error", text: "Tu objetivo de entrenamiento esta gestionado por tu coach." });
      return;
    }
    mutation.mutate({
      goal: {
        type: trainingDraft.type || null,
        approach: trainingDraft.approach || null,
      },
    });
  }

  function applyTrainingRestPreset(kind, value) {
    const base = normalizeDraft(nutritionDraft);
    const macros = distributeMacros(value, user);
    setDayDrafts((current) => {
      const next = { ...current };
      DAYS.forEach((day) => {
        const isTrainingDay = trainingDays.includes(day.key);
        const shouldApply = kind === "training" ? isTrainingDay : !isTrainingDay;
        if (shouldApply) {
          next[day.key] = {
            kcal: String(value || base.kcal || ""),
            p: String(macros.p),
            c: String(macros.c),
            g: String(macros.g),
          };
        }
      });
      return next;
    });
  }

  if (goalsQuery.isLoading) {
    return (
      <div className="og-page">
        <div className="og-skeleton hero" />
        <div className="og-skeleton card" />
      </div>
    );
  }

  if (goalsQuery.isError) {
    return (
      <div className="og-page">
        <div className="og-error">
          <AlertTriangle size={22} />
          <div>
            <strong>No pudimos cargar tus objetivos.</strong>
            <p>{goalsQuery.error?.message || "Revisa la conexion e intenta nuevamente."}</p>
          </div>
          <button type="button" onClick={() => goalsQuery.refetch()}>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="og-page">
      <section className={`og-hero ${plan}`}>
        <div>
          <span className="og-kicker"><Target size={16} /> Objetivos</span>
          <h1>Objetivos</h1>
          <p>
            Defini tus metas de nutricion y entrenamiento sin mezclar la meta con la ejecucion diaria.
          </p>
          <div className="og-badges">
            <span>Plan {clientPlanLabel(plan)}</span>
            {nutritionLockedByCoach || trainingLockedByCoach ? <span>Gestionado por coach</span> : null}
            {freeChangesBlocked ? <span>Sin cambios disponibles</span> : null}
          </div>
        </div>
      </section>

      <div className="og-tabs" role="tablist" aria-label="Objetivos">
        <button
          type="button"
          className={activeTab === "nutrition" ? "active" : ""}
          onClick={() => setActiveTab("nutrition")}
          role="tab"
          aria-selected={activeTab === "nutrition"}
        >
          <Apple size={17} />
          Nutricion
        </button>
        <button
          type="button"
          className={activeTab === "training" ? "active" : ""}
          onClick={() => setActiveTab("training")}
          role="tab"
          aria-selected={activeTab === "training"}
        >
          <Dumbbell size={17} />
          Entrenamiento
        </button>
      </div>

      {status && (!editNutrition || status.type === "success") ? <Notice type={status.type}>{status.text}</Notice> : null}
      {data.accessContextError ? (
        <Notice type="warn">El contexto de acceso no cargo completo. Usamos los datos de usuario disponibles.</Notice>
      ) : null}

      {activeTab === "nutrition" ? (
        <section className="og-panel og-summaryPanel">
          <section className="og-targetCard">
            <div className="og-targetCardTop">
              <div>
                <span>Objetivo diario base</span>
                <strong>{formatNumber(target.kcal, " kcal")}</strong>
                <p>
                  P {formatNumber(target.macros.p, " g")} / C {formatNumber(target.macros.c, " g")} / G {formatNumber(target.macros.g, " g")}
                </p>
              </div>
              <button
                ref={editButtonRef}
                type="button"
                className={`og-editTarget ${nutritionLockedByCoach || freeChangesBlocked ? "locked" : ""}`}
                aria-label="Editar objetivo nutricional"
                title="Editar objetivo"
                onClick={openNutritionEditor}
                disabled={mutation.isPending}
              >
                {nutritionLockedByCoach || freeChangesBlocked ? <Lock size={21} /> : <Pencil size={21} />}
              </button>
            </div>
            <div className="og-targetStats">
              <ObjectiveStat label="Proteina" value={formatNumber(target.macros.p, " g")} width={progressWidth(target.macros.p, 260)} tone="blue" />
              <ObjectiveStat label="Carbohidratos" value={formatNumber(target.macros.c, " g")} width={progressWidth(target.macros.c, 520)} tone="green" />
              <ObjectiveStat label="Grasas" value={formatNumber(target.macros.g, " g")} width={progressWidth(target.macros.g, 170)} tone="violet" />
              <ObjectiveStat label="Calorias" value={formatNumber(target.kcal, " kcal")} width={progressWidth(target.kcal, 4200)} tone="yellow" />
            </div>
          </section>

          {target.status === "missing" ? (
            <Notice type="warn">
              No encontramos una meta valida. Completa tus objetivos para evitar que Menu o Tracking muestren valores vacios.
            </Notice>
          ) : null}
          {target.status === "legacy" ? (
            <Notice type="warn">
              <strong>Objetivo inicial</strong>
              <br />
              Calculamos esta meta a partir de los datos que completaste en el onboarding. Podes ajustarla segun tu plan.
            </Notice>
          ) : null}
          {nutritionLockedByCoach ? (
            <Notice type="info">
              Tu objetivo nutricional esta gestionado por tu coach. Podes verlo, pero no editarlo desde esta pantalla.
            </Notice>
          ) : null}

          <section className={`og-weekly ${canUseWeeklyTargets && !isFree ? "" : "locked"}`}>
            <div className="og-weeklyTop">
              <div>
                <span className="og-kicker">Objetivos por dia</span>
                <h3>Distribucion semanal</h3>
                <p>Configura distintas calorias y macros por dia o diferencia entrenamiento y descanso.</p>
              </div>
              {canUseWeeklyTargets && !isFree ? <CalendarDays size={24} /> : <Lock size={24} />}
            </div>

            {canUseWeeklyTargets && !isFree ? (
              <>
                <div className="og-modeGrid weekly" role="radiogroup" aria-label="Distribucion semanal">
                  {[
                    ["same_all_days", "Mismo objetivo todos los dias"],
                    ["per_day", "Personalizar por dia"],
                    ["training_rest", "Entrenamiento y descanso"],
                  ].map(([value, label]) => (
                    <label key={value} className={weeklyMode === value ? "active" : ""}>
                      <input type="radio" checked={weeklyMode === value} onChange={() => setWeeklyMode(value)} />
                      {label}
                    </label>
                  ))}
                </div>

                {weeklyMode === "training_rest" ? (
                  <div className="og-trainingDays">
                    {DAYS.map((day) => (
                      <button
                        type="button"
                        key={day.key}
                        className={trainingDays.includes(day.key) ? "active" : ""}
                        onClick={() => {
                          setTrainingDays((current) =>
                            current.includes(day.key)
                              ? current.filter((item) => item !== day.key)
                              : [...current, day.key]
                          );
                        }}
                      >
                        {day.short}
                      </button>
                    ))}
                    <button type="button" onClick={() => applyTrainingRestPreset("training", asNumber(nutritionDraft.kcal) + 150)}>
                      Subir entreno +150 kcal
                    </button>
                    <button type="button" onClick={() => applyTrainingRestPreset("rest", Math.max(800, asNumber(nutritionDraft.kcal) - 150))}>
                      Bajar descanso -150 kcal
                    </button>
                  </div>
                ) : null}

                {weeklyMode !== "same_all_days" ? (
                  <div className="og-dayGrid">
                    {DAYS.map((day) => (
                      <div className="og-dayRow" key={day.key}>
                        <strong>{day.short}</strong>
                        {["kcal", "p", "c", "g"].map((key) => (
                          <label key={key}>
                            <span>{key === "kcal" ? "kcal" : key.toUpperCase()}</span>
                            <input
                              type="number"
                              value={dayDrafts[day.key]?.[key] || ""}
                              onChange={(event) =>
                                setDayDrafts((current) => ({
                                  ...current,
                                  [day.key]: {
                                    ...(current[day.key] || {}),
                                    [key]: event.target.value,
                                  },
                                }))
                              }
                            />
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            ) : (
              <div className="og-lockedCopy">
                <strong>Disponible en Pro</strong>
                <p>Free usa un unico objetivo diario para lunes a domingo. La configuracion avanzada se conserva si venis de Pro, pero no queda editable.</p>
                <a href="/app/planes">Ver beneficios Pro</a>
              </div>
            )}
          </section>
        </section>
      ) : (
        <section className="og-panel">
          <section className="og-targetCard og-trainingTargetCard">
            <div className="og-targetCardTop">
              <div>
                <span>Objetivo de entrenamiento</span>
                <strong>{goalLabel(user?.goal?.type)}</strong>
                <p>{trainingLevelLabel(user?.profile?.basics?.experienciaPesas)} / {trainingFrequencyLabel(user?.profile?.basics?.frecuenciaEjercicio)}</p>
              </div>
              <span className={`og-pill ${trainingLockedByCoach ? "coach" : "ok"}`}>
                {trainingLockedByCoach ? "Coach" : "Editable"}
              </span>
            </div>
            <div className="og-targetStats">
              <ObjectiveStat label="Nivel" value={trainingLevelLabel(user?.profile?.basics?.experienciaPesas)} width="70%" tone="blue" />
              <ObjectiveStat label="Disponibilidad" value={trainingFrequencyLabel(user?.profile?.basics?.frecuenciaEjercicio)} width="65%" tone="green" />
              <ObjectiveStat label="Equipamiento" value={user?.routine?.structure?.equipment || user?.program?.equipment || "Sin definir"} width="55%" tone="violet" />
              <ObjectiveStat label="Estado" value={trainingLockedByCoach ? "Coach" : "Editable"} width={trainingLockedByCoach ? "45%" : "80%"} tone="yellow" />
            </div>
          </section>

          {trainingLockedByCoach ? (
            <Notice type="info">Tu objetivo de entrenamiento esta gestionado por tu coach.</Notice>
          ) : null}

          <div className="og-editor compact">
            <div className="og-formGrid two">
              <label>
                <span>Objetivo principal</span>
                <select
                  value={trainingDraft.type}
                  onChange={(event) => setTrainingDraft((current) => ({ ...current, type: event.target.value }))}
                  disabled={trainingLockedByCoach || mutation.isPending}
                >
                  <option value="">Seleccionar</option>
                  {GOAL_TYPES.map((goal) => (
                    <option key={goal.value} value={goal.value}>{goal.label}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>Prioridad general</span>
                <input
                  value={trainingDraft.approach}
                  onChange={(event) => setTrainingDraft((current) => ({ ...current, approach: event.target.value }))}
                  disabled={trainingLockedByCoach || mutation.isPending}
                  placeholder="Ej: recomposicion, fuerza, constancia"
                />
              </label>
            </div>

            <Notice type="info">
              La generacion automatica de rutinas no esta disponible actualmente. Esta pestaña solo guarda el perfil de objetivo.
            </Notice>

            <div className="og-actions">
              <button
                type="button"
                className="og-save"
                disabled={trainingLockedByCoach || mutation.isPending}
                onClick={saveTraining}
              >
                <CheckCircle2 size={17} />
                {mutation.isPending ? "Guardando..." : "Guardar entrenamiento"}
              </button>
              <button
                type="button"
                className="og-secondary"
                disabled={mutation.isPending}
                onClick={() => setTrainingDraft({ type: user?.goal?.type || "", approach: user?.goal?.approach || "" })}
              >
                <RotateCcw size={16} />
                Restaurar
              </button>
            </div>
          </div>
        </section>
      )}

      {editNutrition ? (
        <div className="og-dialogOverlay" onMouseDown={handleEditorBackdrop}>
          <section
            ref={dialogRef}
            className="og-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nutrition-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="og-sheetHandle" aria-hidden="true" />
            <header className="og-dialogHead">
              <div>
                <span className="og-kicker">Objetivo nutricional</span>
                <h2 id="nutrition-editor-title">Editar objetivo diario base</h2>
                <p>Ajusta tus calorias y macros diarios.</p>
              </div>
              <button
                type="button"
                className="og-dialogClose"
                aria-label="Cerrar editor"
                onClick={closeNutritionEditor}
              >
                <X size={21} />
              </button>
            </header>

            <div className="og-dialogBadges">
              <span className={nutritionLockedByCoach ? "coach" : "ok"}>{nutritionLockedByCoach ? "Coach" : "Editable"}</span>
              <span>{editorChangeText}</span>
            </div>

            {nutritionLockedByCoach ? (
              <Notice type="info">
                <strong>Objetivo gestionado por tu coach</strong>
                <br />
                Tu coach tiene autoridad nutricional activa. Podes revisar los valores, pero no editarlos desde aca.
              </Notice>
            ) : null}

            {freeChangesBlocked ? (
              <Notice type="warn">
                <strong>Ya utilizaste tus cambios disponibles.</strong>
                <br />
                Podras volver a editar el {formatDate(goalsAccess.nextResetAt) || "proximo periodo"}.
                <div className="og-inlineActions">
                  <a className="og-inlineLink" href="/app/planes">Ver beneficios Pro</a>
                </div>
              </Notice>
            ) : null}

            {canEditNutrition ? (
              <>
                <div className="og-editModeGrid" role="radiogroup" aria-label="Modo de edicion nutricional">
                  <button
                    type="button"
                    className={nutritionMode === "recalculate" ? "active" : ""}
                    onClick={applyAutomaticNutritionTarget}
                  >
                    <Target size={18} />
                    <span>
                      <strong>Recalcular con peso y configuracion actual</strong>
                      <small>ZumaFit recalcula calorias y macros con tus datos actuales.</small>
                    </span>
                  </button>
                  <button
                    type="button"
                    className={nutritionMode === "manual" ? "active" : ""}
                    onClick={enableManualNutritionMode}
                  >
                    <Pencil size={18} />
                    <span>
                      <strong>Editar macros manualmente</strong>
                      <small>Proteina, carbohidratos y grasas determinan las calorias.</small>
                    </span>
                  </button>
                </div>

                <div className="og-editorFields">
                  <EditorField
                    icon={Flame}
                    label="Calorias"
                    unit="kcal"
                    value={nutritionDraft.kcal}
                    onChange={(value) => setDraftValue("kcal", value)}
                    readOnly={nutritionMode === "manual"}
                    disabled={mutation.isPending}
                    autoFocus
                  />
                  <EditorField
                    icon={Dumbbell}
                    label="Proteina"
                    unit="g"
                    value={nutritionDraft.p}
                    onChange={(value) => setDraftValue("p", value)}
                    disabled={mutation.isPending}
                  />
                  <EditorField
                    icon={Wheat}
                    label="Carbohidratos"
                    unit="g"
                    value={nutritionDraft.c}
                    onChange={(value) => setDraftValue("c", value)}
                    disabled={mutation.isPending}
                  />
                  <EditorField
                    icon={Droplets}
                    label="Grasas"
                    unit="g"
                    value={nutritionDraft.g}
                    onChange={(value) => setDraftValue("g", value)}
                    disabled={mutation.isPending}
                  />
                </div>

                {nutritionMode === "recalculate" ? (
                  <p className="og-formHint">
                    <Info size={16} />
                    {automaticTarget.warning || `Usamos ${automaticTarget.description}. Si ajustas kcal, se redistribuyen los macros.`}
                  </p>
                ) : null}
                {nutritionMode === "manual" ? (
                  <p className="og-formHint">
                    <Info size={16} />
                    Las calorias se calculan automaticamente desde proteina y carbs x4, grasas x9.
                  </p>
                ) : null}

                {status && status.type !== "success" ? <Notice type={status.type}>{status.text}</Notice> : null}

                {mismatch?.warning ? (
                  <Notice type={mismatch.severe ? "error" : "warn"}>
                    Los macros suman {formatNumber(mismatch.fromMacros, " kcal")}, con una diferencia de {formatNumber(mismatch.diff, " kcal")}.
                    <div className="og-inlineActions">
                      <button type="button" onClick={handleAdjustCaloriesToMacros}>Ajustar calorias a macros</button>
                      <button type="button" onClick={handleRecalculateMacros}>Recalcular macros</button>
                    </div>
                  </Notice>
                ) : null}

                {confirmLastChange ? (
                  <Notice type="warn">
                    Este es tu ultimo cambio disponible hasta el {formatDate(goalsAccess.nextResetAt) || "proximo periodo"}. Queres guardar el nuevo objetivo?
                    <div className="og-inlineActions">
                      <button type="button" onClick={() => setConfirmLastChange(false)}>Volver a editar</button>
                      <button type="button" onClick={() => saveNutrition(true)}>Confirmar cambio</button>
                    </div>
                  </Notice>
                ) : null}

                {showDiscardConfirm ? (
                  <Notice type="warn">
                    Tenes cambios sin guardar.
                    <div className="og-inlineActions">
                      <button type="button" onClick={closeNutritionEditor}>Descartar</button>
                      <button type="button" onClick={() => setShowDiscardConfirm(false)}>Seguir editando</button>
                    </div>
                  </Notice>
                ) : null}
              </>
            ) : null}

            <footer className="og-dialogFooter">
              <button
                type="button"
                className="og-secondary"
                onClick={closeNutritionEditor}
              >
                {canEditNutrition ? "Cancelar" : "Cerrar"}
              </button>
              {canEditNutrition ? (
                <button
                  type="button"
                  className="og-save"
                  disabled={mutation.isPending || confirmLastChange}
                  onClick={() => saveNutrition(false)}
                >
                  {mutation.isPending ? <LoaderCircle size={17} className="og-spin" /> : <Save size={17} />}
                  {mutation.isPending ? "Guardando..." : "Guardar objetivo"}
                </button>
              ) : null}
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
