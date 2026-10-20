import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Apple,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Copy,
  Crown,
  Droplets,
  Dumbbell,
  Flame,
  Info,
  LoaderCircle,
  Lock,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Target,
  Wheat,
  X,
} from "lucide-react";

import { clientAccessContextKey, clientPlanCapabilitiesKey } from "../clientPlans/clientPlanQueries.js";
import { clientPlanLabel, normalizeClientPlan, planFromCapabilities } from "../clientPlans/clientPlanUtils.js";
import { clientGoalsKey, fetchClientGoals, previewClientNutrition, updateClientGoals } from "../clientGoals/clientGoalsApi.js";
import {
  WEEKLY_MODE_AUTOMATIC,
  WEEKLY_MODE_PER_DAY,
  WEEKLY_MODE_TRAINING_REST,
  WEEKLY_NUTRITION_DAYS,
  adjustWeeklyDayDraftValue,
  buildWeeklyGoalsPayload as buildWeeklyPayload,
  canUseWeeklyMode,
  copyWeeklyDayToTargets,
  createWeeklyDayDrafts as buildDayDrafts,
  restoreWeeklyDayToBase,
  restoreWeeklyWeekToBase,
  setWeeklyDayDraftValue,
  weeklyBaseDraft,
  weeklyBalanceEnabled as resolveWeeklyBalanceEnabled,
  weeklyDayVisualState,
  weeklyGoalsPayloadSignature as weeklyPayloadSignature,
} from "../clientGoals/weeklyNutritionGoals.js";
import { queryKeys } from "../queryClient.js";
import "./Objetivos.css";

const EMPTY_OBJECT = {};

const DAYS = WEEKLY_NUTRITION_DAYS;

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

function calculatedTargetFromPreview(preview = null) {
  if (!preview?.ready || !preview?.target) {
    const missing = Array.isArray(preview?.missingFields) ? preview.missingFields.join(", ") : "datos corporales";
    return {
      kcal: null,
      macros: { p: null, c: null, g: null },
      description: preview?.formula || "Calculadora central de ZumaFit",
      formula: preview?.formula || "Calculadora central de ZumaFit",
      warning: `Faltan datos para calcular: ${missing}.`,
      usedData: preview?.usedData || {},
    };
  }
  return {
    kcal: preview.target.kcal,
    macros: preview.target.macros,
    description: `TDEE ${Number(preview.maintenanceKcal || 0).toLocaleString("es-AR")} kcal · ajuste ${preview.adjustment?.percent || 0}%`,
    formula: preview.formula,
    maintenance: preview.maintenanceKcal,
    usedData: preview.usedData || {},
    warning: "",
  };
}

function localDateKey() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

function profileDataFromUser(user = {}) {
  const basics = user?.profile?.basics || {};
  return {
    weightKg: getCurrentWeightKg(user),
    date: localDateKey(),
    birthDate: basics.fechaNacimiento || "",
    heightCm: firstNumber(user?.antropometriaActual?.alturaCm, basics.alturaCm),
    age: null,
    gender: basics.genero || "",
    activity: basics.actividadDiaria || "",
    activityFactor: basics.factorActividad ?? null,
    goalType: user?.goal?.type || "",
    trainingFrequency: basics.frecuenciaEjercicio || "",
  };
}

function nutritionPreviewPayload(data = {}) {
  return {
    data: {
      birthDate: data.birthDate,
      age: data.age,
      sex: data.gender,
      weightKg: data.weightKg,
      heightCm: data.heightCm,
      activityFactor: data.activityFactor,
      activity: data.activity,
      exerciseFrequency: data.trainingFrequency,
      goalType: data.goalType,
    },
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
  const weeklyDialogRef = useRef(null);
  const weeklyEditorDirtyRef = useRef(false);
  const weeklyReturnFocusRef = useRef(null);
  const [activeTab, setActiveTab] = useState("nutrition");
  const [editNutrition, setEditNutrition] = useState(false);
  const [nutritionMode, setNutritionMode] = useState("recalculate");
  const [recalculationStep, setRecalculationStep] = useState("current_data");
  const [recalculationData, setRecalculationData] = useState({});
  const [confirmProfileUpdate, setConfirmProfileUpdate] = useState(false);
  const [profilePreviewOnly, setProfilePreviewOnly] = useState(false);
  const [nutritionDraft, setNutritionDraft] = useState({ kcal: "", p: "", c: "", g: "" });
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [weeklyMode, setWeeklyMode] = useState("same_all_days");
  const [weeklyBalanceEnabled, setWeeklyBalanceEnabled] = useState(false);
  const [dayDrafts, setDayDrafts] = useState({});
  const [trainingDays, setTrainingDays] = useState(TRAINING_DAYS_DEFAULT);
  const [weeklyEditor, setWeeklyEditor] = useState(null);
  const [weeklyUpgradeOpen, setWeeklyUpgradeOpen] = useState(false);
  const [weeklyDiscardConfirm, setWeeklyDiscardConfirm] = useState(false);
  const [confirmLastChange, setConfirmLastChange] = useState(false);
  const [status, setStatus] = useState(null);
  const [trainingDraft, setTrainingDraft] = useState({ type: "", approach: "" });
  const [automaticTarget, setAutomaticTarget] = useState(() => calculatedTargetFromPreview(null));
  const [updatedAutomaticTarget, setUpdatedAutomaticTarget] = useState(() => calculatedTargetFromPreview(null));
  const [nutritionPreviewLoading, setNutritionPreviewLoading] = useState(false);

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
  const currentProfileData = useMemo(() => profileDataFromUser(user), [user]);
  const goalsAccess = user.goalsAccess || {};
  const nutritionAuthority = accessContext?.authority?.nutrition || user?.goalsAccess?.authority || "client";
  const trainingAuthority = accessContext?.authority?.training || "client";
  const nutritionLockedByCoach = nutritionAuthority === "coach" || target.source === "coach";
  const trainingLockedByCoach = trainingAuthority === "coach";
  const isFree = plan === "free";
  const weeklyPlanningCapability = capabilities?.nutrition?.weeklyPlanning;
  const canUseWeeklyTargets = weeklyPlanningCapability === true
    || (weeklyPlanningCapability === undefined && (plan === "pro" || plan === "vip"));
  const changesLimit = goalsAccess.changesLimit;
  const changesRemaining = goalsAccess.changesRemaining;
  const weeklyPlan = user?.menu?.weeklyPlan || EMPTY_OBJECT;
  const storedWeeklyMode = weeklyPlan?.mode === "unrestricted"
    ? WEEKLY_MODE_AUTOMATIC
    : weeklyPlan?.mode || WEEKLY_MODE_AUTOMATIC;
  const effectiveStoredWeeklyMode = canUseWeeklyTargets ? storedWeeklyMode : WEEKLY_MODE_AUTOMATIC;
  const storedWeeklyBalanceEnabled = canUseWeeklyTargets && resolveWeeklyBalanceEnabled(weeklyPlan);
  const storedTrainingDays = Array.isArray(weeklyPlan?.trainingDays) && weeklyPlan.trainingDays.length
    ? weeklyPlan.trainingDays
    : TRAINING_DAYS_DEFAULT;
  const storedDayDrafts = useMemo(() => buildDayDrafts(target, weeklyPlan), [target, weeklyPlan]);
  const mismatch = energyMismatch(nutritionDraft);
  const nutritionDraftUnchanged = sameNutritionDraft(nutritionDraft, initialDraft);
  const profileUpdateChanged = recalculationStep === "update_data" && (
    round(recalculationData.weightKg) !== round(currentProfileData.weightKg) ||
    recalculationData.activity !== currentProfileData.activity ||
    recalculationData.goalType !== currentProfileData.goalType
  );
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
  const weeklySummary = useMemo(() => {
    const drafts = weeklyMode === "same_all_days"
      ? DAYS.map(() => normalizeDraft(nutritionDraft))
      : DAYS.map((day) => normalizeDraft(dayDrafts[day.key] || nutritionDraft));
    const total = drafts.reduce((acc, value) => ({
      kcal: acc.kcal + (value.kcal || 0), p: acc.p + (value.p || 0), c: acc.c + (value.c || 0), g: acc.g + (value.g || 0),
    }), { kcal: 0, p: 0, c: 0, g: 0 });
    return { total, average: { kcal: total.kcal / 7, p: total.p / 7, c: total.c / 7, g: total.g / 7 } };
  }, [dayDrafts, nutritionDraft, weeklyMode]);
  const weeklyPageDirty = weeklyPayloadSignature(buildWeeklyPayload(weeklyMode, dayDrafts, trainingDays, weeklyBalanceEnabled))
    !== weeklyPayloadSignature(buildWeeklyPayload(effectiveStoredWeeklyMode, storedDayDrafts, storedTrainingDays, storedWeeklyBalanceEnabled));
  const trainingPreviewDay = DAYS.find((day) => trainingDays.includes(day.key));
  const restPreviewDay = DAYS.find((day) => !trainingDays.includes(day.key));
  const trainingPreview = dayDrafts[trainingPreviewDay?.key] || weeklyBaseDraft(target);
  const restPreview = dayDrafts[restPreviewDay?.key] || weeklyBaseDraft(target);
  const weeklyEditorLocalDirty = Boolean(weeklyEditor) && weeklyPayloadSignature(
    buildWeeklyPayload(weeklyMode, weeklyEditor?.workingDayDrafts || {}, trainingDays, weeklyBalanceEnabled)
  ) !== weeklyPayloadSignature(buildWeeklyPayload(weeklyMode, dayDrafts, trainingDays, weeklyBalanceEnabled));
  const weeklyEditorSaveDirty = Boolean(weeklyEditor) && weeklyPayloadSignature(
    buildWeeklyPayload(weeklyMode, weeklyEditor?.workingDayDrafts || {}, trainingDays, weeklyBalanceEnabled)
  ) !== weeklyPayloadSignature(buildWeeklyPayload(effectiveStoredWeeklyMode, storedDayDrafts, storedTrainingDays, storedWeeklyBalanceEnabled));
  weeklyEditorDirtyRef.current = weeklyEditorLocalDirty;
  const weeklyEditorOpen = Boolean(weeklyEditor);
  const weeklyEditorDay = DAYS.find((day) => day.key === weeklyEditor?.dayKey) || DAYS[0];
  const weeklyEditorValues = weeklyEditor?.workingDayDrafts?.[weeklyEditorDay.key] || weeklyBaseDraft(target);
  const weeklyEditorVisualState = weeklyDayVisualState({
    mode: weeklyMode,
    dayKey: weeklyEditorDay.key,
    value: weeklyEditorValues,
    base: weeklyBaseDraft(target),
    trainingDays,
  });

  const mutation = useMutation({
    mutationFn: updateClientGoals,
    onSuccess: async (updatedUser, variables) => {
      setStatus({ type: "success", text: variables?.weeklyPlan ? "Distribucion semanal actualizada." : "Objetivo actualizado correctamente." });
      setConfirmLastChange(false);
      setShowDiscardConfirm(false);
      setEditNutrition(false);
      setWeeklyEditor(null);
      setWeeklyDiscardConfirm(false);
      window.setTimeout(() => editButtonRef.current?.focus(), 0);
      queryClientHook.setQueryData(clientGoalsKey, (old) => ({ ...(old || {}), user: updatedUser || old?.user }));
      await Promise.all([
        queryClientHook.invalidateQueries({ queryKey: queryKeys.authMe() }),
        queryClientHook.invalidateQueries({ queryKey: clientGoalsKey }),
        queryClientHook.invalidateQueries({ queryKey: clientAccessContextKey }),
        queryClientHook.invalidateQueries({ queryKey: clientPlanCapabilitiesKey }),
        queryClientHook.invalidateQueries({ queryKey: queryKeys.trackingDay(new Date().toISOString().slice(0, 10)) }),
        queryClientHook.invalidateQueries({ queryKey: ["menuTrackingWeek"] }),
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
    setDayDrafts(storedDayDrafts);
    setWeeklyMode(effectiveStoredWeeklyMode);
    setWeeklyBalanceEnabled(storedWeeklyBalanceEnabled);
    setTrainingDays(storedTrainingDays);
  }, [effectiveStoredWeeklyMode, initialDraft, storedDayDrafts, storedTrainingDays, storedWeeklyBalanceEnabled]);

  useEffect(() => {
    setRecalculationData(currentProfileData);
    setConfirmProfileUpdate(false);
    setProfilePreviewOnly(false);
  }, [currentProfileData]);

  useEffect(() => {
    if (!user?.id && !user?._id) return undefined;
    let active = true;
    setNutritionPreviewLoading(true);
    previewClientNutrition(nutritionPreviewPayload(currentProfileData))
      .then((preview) => {
        if (!active) return;
        const next = calculatedTargetFromPreview(preview);
        setAutomaticTarget(next);
        setUpdatedAutomaticTarget(next);
      })
      .catch((error) => {
        if (!active) return;
        const failed = calculatedTargetFromPreview(null);
        failed.warning = error?.message || "No pudimos consultar la calculadora de ZumaFit.";
        setAutomaticTarget(failed);
        setUpdatedAutomaticTarget(failed);
      })
      .finally(() => {
        if (active) setNutritionPreviewLoading(false);
      });
    return () => { active = false; };
  }, [currentProfileData, user?._id, user?.id]);

  useEffect(() => {
    if (!user?.id && !user?._id) return undefined;
    let active = true;
    const timer = window.setTimeout(() => {
      setNutritionPreviewLoading(true);
      previewClientNutrition(nutritionPreviewPayload(recalculationData))
        .then((preview) => {
          if (active) setUpdatedAutomaticTarget(calculatedTargetFromPreview(preview));
        })
        .catch((error) => {
          if (!active) return;
          const failed = calculatedTargetFromPreview(null);
          failed.warning = error?.message || "No pudimos consultar la calculadora de ZumaFit.";
          setUpdatedAutomaticTarget(failed);
        })
        .finally(() => {
          if (active) setNutritionPreviewLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [recalculationData, user?._id, user?.id]);

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
    setRecalculationStep("current_data");
    setRecalculationData(currentProfileData);
    setConfirmProfileUpdate(false);
    setProfilePreviewOnly(false);
    setNutritionDraft(initialDraft);
    window.setTimeout(() => editButtonRef.current?.focus(), 0);
  }, [currentProfileData, initialDraft]);

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

  useEffect(() => {
    if (!weeklyEditorOpen && !weeklyUpgradeOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusableSelector = "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
    const focusTimer = window.setTimeout(() => {
      const preferred = weeklyDialogRef.current?.querySelector("input")
        || weeklyDialogRef.current?.querySelector(focusableSelector);
      preferred?.focus();
    }, 0);
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (weeklyUpgradeOpen) {
          setWeeklyUpgradeOpen(false);
          return;
        }
        if (weeklyEditorDirtyRef.current) setWeeklyDiscardConfirm(true);
        else setWeeklyEditor(null);
        return;
      }
      if (event.key !== "Tab" || !weeklyDialogRef.current) return;
      const focusables = Array.from(weeklyDialogRef.current.querySelectorAll(focusableSelector))
        .filter((node) => node.offsetParent !== null);
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
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      window.setTimeout(() => {
        if (weeklyReturnFocusRef.current?.isConnected) weeklyReturnFocusRef.current.focus();
      }, 0);
    };
  }, [weeklyEditorOpen, weeklyUpgradeOpen]);

  

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
    if (nutritionPreviewLoading) {
      setStatus({ type: "info", text: "Estamos calculando la propuesta con tus datos actuales." });
      return;
    }
    const preview = recalculationStep === "update_data" ? updatedAutomaticTarget : automaticTarget;
    if (preview.kcal === null || preview.kcal === undefined) {
      setStatus({ type: "warn", text: preview.warning || "Faltan datos para recalcular automaticamente." });
      return;
    }
    setNutritionDraft({
      kcal: String(preview.kcal),
      p: String(preview.macros.p),
      c: String(preview.macros.c),
      g: String(preview.macros.g),
    });
  }

  function applyUpdatedDataPreview({ saveProfile = false } = {}) {
    setNutritionMode("recalculate");
    setProfilePreviewOnly(!saveProfile);
    setConfirmProfileUpdate(saveProfile);
    setNutritionDraft({
      kcal: String(updatedAutomaticTarget.kcal ?? ""),
      p: String(updatedAutomaticTarget.macros?.p ?? ""),
      c: String(updatedAutomaticTarget.macros?.c ?? ""),
      g: String(updatedAutomaticTarget.macros?.g ?? ""),
    });
  }

  function saveNutrition(confirmed = false, overrides = {}) {
    const effectiveWeeklyMode = overrides.weeklyMode || weeklyMode;
    const effectiveDayDrafts = overrides.dayDrafts || dayDrafts;
    const effectiveTrainingDays = overrides.trainingDays || trainingDays;
    const effectiveBalanceEnabled = overrides.weeklyBalanceEnabled ?? weeklyBalanceEnabled;
    const effectiveWeeklyUnchanged = weeklyPayloadSignature(buildWeeklyPayload(effectiveWeeklyMode, effectiveDayDrafts, effectiveTrainingDays, effectiveBalanceEnabled))
      === weeklyPayloadSignature(buildWeeklyPayload(effectiveStoredWeeklyMode, storedDayDrafts, storedTrainingDays, storedWeeklyBalanceEnabled));
    const effectiveNutritionUnchanged = nutritionDraftUnchanged && effectiveWeeklyUnchanged && !profileUpdateChanged;
    setStatus(null);
    if (nutritionLockedByCoach) {
      setStatus({ type: "error", text: "Tu objetivo nutricional esta gestionado por tu coach." });
      return;
    }
    if (!isNutritionDraftValid(nutritionDraft)) {
      setStatus({ type: "error", text: "Revisa valores vacios, negativos o fuera de rango seguro." });
      return;
    }
    if (effectiveWeeklyMode !== WEEKLY_MODE_AUTOMATIC) {
      const invalidDay = DAYS.find((day) => !isNutritionDraftValid(effectiveDayDrafts[day.key] || {}));
      if (invalidDay) {
        setStatus({ type: "error", text: `Revisa las calorias y macros de ${invalidDay.label}. Todos los dias deben tener valores validos.` });
        return;
      }
    }
    if (mismatch?.severe) {
      setStatus({ type: "error", text: "Las calorias no coinciden con los macros. Ajusta antes de guardar." });
      return;
    }
    if (effectiveNutritionUnchanged) {
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
    if (nutritionMode === "recalculate") {
      payload.recalculation = {
        mode: profilePreviewOnly ? "current_data" : recalculationStep,
        confirmProfileUpdate: !profilePreviewOnly && recalculationStep === "update_data" && confirmProfileUpdate,
        date: recalculationData.date || localDateKey(),
        weightKg: maybeNumber(recalculationData.weightKg),
        activity: recalculationData.activity || null,
      };
      if (recalculationStep === "update_data" && profileUpdateChanged && !profilePreviewOnly) {
        if (!confirmProfileUpdate) {
          setStatus({ type: "warn", text: "Confirma que queres guardar los nuevos datos y registrar el peso de esa fecha." });
          return;
        }
        payload.goal = { type: recalculationData.goalType || null };
      }
    }
    if (canUseWeeklyTargets) {
      payload.weeklyPlan = buildWeeklyPayload(effectiveWeeklyMode, effectiveDayDrafts, effectiveTrainingDays, effectiveBalanceEnabled);
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

  function requestWeeklyMode(mode) {
    if (!canUseWeeklyMode(mode, canUseWeeklyTargets)) {
      weeklyReturnFocusRef.current = document.activeElement;
      setWeeklyUpgradeOpen(true);
      return;
    }
    if (!canEditNutrition) {
      setStatus({ type: "error", text: nutritionLockedByCoach ? "Tu objetivo nutricional esta gestionado por tu coach." : "No tenes cambios disponibles en este periodo." });
      return;
    }
    setStatus(null);
    setWeeklyMode(mode);
  }

  function restoreWeeklyBase() {
    if (!canEditNutrition) return;
    setStatus(null);
    setDayDrafts(restoreWeeklyWeekToBase(weeklyBaseDraft(target)));
  }

  function openWeeklyEditor(dayKey = DAYS[0].key) {
    if (!canUseWeeklyTargets) {
      setWeeklyUpgradeOpen(true);
      return;
    }
    if (!canEditNutrition) {
      setStatus({ type: "error", text: nutritionLockedByCoach ? "Tu objetivo nutricional esta gestionado por tu coach." : "No tenes cambios disponibles en este periodo." });
      return;
    }
    const safeDayKey = DAYS.some((day) => day.key === dayKey) ? dayKey : DAYS[0].key;
    const sourceIsTraining = trainingDays.includes(safeDayKey);
    const initialSelection = weeklyMode === WEEKLY_MODE_TRAINING_REST
      ? DAYS.filter((day) => trainingDays.includes(day.key) === sourceIsTraining).map((day) => day.key)
      : [safeDayKey];
    weeklyReturnFocusRef.current = document.activeElement;
    setStatus(null);
    setWeeklyDiscardConfirm(false);
    setWeeklyEditor({
      dayKey: safeDayKey,
      workingDayDrafts: Object.fromEntries(DAYS.map((day) => [day.key, { ...(dayDrafts[day.key] || weeklyBaseDraft(target)) }])),
      selectedDays: initialSelection,
      feedback: "",
      error: "",
    });
  }

  function updateWeeklyEditorField(field, value) {
    setWeeklyEditor((current) => current ? {
      ...current,
      workingDayDrafts: setWeeklyDayDraftValue(current.workingDayDrafts, current.dayKey, field, value),
      feedback: "",
      error: "",
    } : current);
  }

  function adjustWeeklyEditorField(field, delta) {
    setWeeklyEditor((current) => current ? {
      ...current,
      workingDayDrafts: adjustWeeklyDayDraftValue(current.workingDayDrafts, current.dayKey, field, delta),
      feedback: "",
      error: "",
    } : current);
  }

  function toggleWeeklyEditorDay(dayKey) {
    setWeeklyEditor((current) => {
      if (!current) return current;
      const selected = new Set(current.selectedDays || []);
      if (selected.has(dayKey)) selected.delete(dayKey);
      else selected.add(dayKey);
      return { ...current, selectedDays: [...selected], feedback: "", error: "" };
    });
  }

  function applyWeeklyEditorToSelected() {
    setWeeklyEditor((current) => {
      if (!current) return current;
      if (!current.selectedDays?.length) return { ...current, error: "Selecciona al menos un dia.", feedback: "" };
      return {
        ...current,
        workingDayDrafts: copyWeeklyDayToTargets(current.workingDayDrafts, current.dayKey, current.selectedDays),
        feedback: `Valores aplicados a ${current.selectedDays.length} dia${current.selectedDays.length === 1 ? "" : "s"}.`,
        error: "",
      };
    });
  }

  function copyWeeklyEditorToAll() {
    setWeeklyEditor((current) => current ? {
      ...current,
      workingDayDrafts: copyWeeklyDayToTargets(current.workingDayDrafts, current.dayKey, DAYS.map((day) => day.key)),
      feedback: "Valores copiados a toda la semana.",
      error: "",
    } : current);
  }

  function restoreWeeklyEditorDay() {
    setWeeklyEditor((current) => current ? {
      ...current,
      workingDayDrafts: restoreWeeklyDayToBase(current.workingDayDrafts, current.dayKey, weeklyBaseDraft(target)),
      feedback: "Dia restaurado al objetivo base.",
      error: "",
    } : current);
  }

  function requestCloseWeeklyEditor() {
    if (weeklyEditorLocalDirty) {
      setWeeklyDiscardConfirm(true);
      return;
    }
    setWeeklyEditor(null);
  }

  function saveWeeklyEditor() {
    if (!weeklyEditor) return;
    const invalidDay = DAYS.find((day) => !isNutritionDraftValid(weeklyEditor.workingDayDrafts[day.key] || {}));
    if (invalidDay) {
      setWeeklyEditor((current) => current ? {
        ...current,
        dayKey: invalidDay.key,
        error: `Revisa las calorias y macros de ${invalidDay.label}.`,
        feedback: "",
      } : current);
      return;
    }
    saveNutrition(false, { dayDrafts: weeklyEditor.workingDayDrafts });
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

          <section className="og-weekly">
            <div className="og-weeklyTop">
              <div>
                <span className="og-kicker"><CalendarDays size={15} /> Objetivos por dia</span>
                <div className="og-weeklyTitleLine">
                  <h3>Distribucion semanal</h3>
                  <span className="og-proBadge"><Crown size={13} /> PRO</span>
                </div>
                <p>Personaliza tus calorias y macros por dia sin cambiar la logica nutricional del menu.</p>
              </div>
            </div>

            <div className="og-weeklyModeList" role="radiogroup" aria-label="Modo de distribucion semanal">
              {[
                { value: WEEKLY_MODE_AUTOMATIC, title: "Automatico", text: "Mismo objetivo todos los dias", advanced: false },
                { value: WEEKLY_MODE_PER_DAY, title: "Personalizar por dia", text: "Define distintas calorias y macros para cada dia", advanced: true },
                { value: WEEKLY_MODE_TRAINING_REST, title: "Entrenamiento y descanso", text: "Diferencia los objetivos segun entrenamiento o descanso", advanced: true },
              ].map((option) => {
                const locked = option.advanced && !canUseWeeklyTargets;
                const active = weeklyMode === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    className={`og-weeklyModeCard ${active ? "active" : ""} ${locked ? "locked" : ""}`}
                    onClick={() => requestWeeklyMode(option.value)}
                  >
                    <span className="og-weeklyRadio" aria-hidden="true"><i /></span>
                    <span className="og-weeklyModeCopy"><strong>{option.title}</strong><small>{option.text}</small></span>
                    {option.advanced ? <span className="og-weeklyModePro">{locked ? <Lock size={12} /> : <Crown size={12} />} PRO</span> : null}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={weeklyBalanceEnabled}
              disabled={!canEditNutrition || !canUseWeeklyTargets}
              className={`og-balanceSwitch ${weeklyBalanceEnabled ? "active" : ""}`}
              onClick={() => setWeeklyBalanceEnabled((current) => !current)}
            >
              <span className="og-balanceSwitchIcon"><Flame size={20} /></span>
              <span className="og-balanceSwitchCopy">
                <strong>Balance calorico semanal</strong>
                <small>Compensa solamente las diferencias de calorias hasta el domingo.</small>
              </span>
              <span className="og-switchTrack" aria-hidden="true"><i /></span>
              <b>{weeklyBalanceEnabled ? "Activado" : "Desactivado"}</b>
            </button>

            {weeklyBalanceEnabled ? (
              <aside className="og-balanceInfo"><Info size={16} /><span>Las calorias pendientes se suman o restan hasta el domingo. La proteina no genera deuda ni credito: cada dia vuelve a su meta configurada.</span></aside>
            ) : null}

            {weeklyMode === WEEKLY_MODE_AUTOMATIC ? (
              <>
                <div className="og-weeklyAutomatic">
                  <span className="og-weeklyAutomaticIcon"><Target size={19} /></span>
                  <span><strong>Mismo objetivo durante toda la semana</strong><small>{formatNumber(target.kcal, " kcal")} · P {formatNumber(target.macros.p)} · C {formatNumber(target.macros.c)} · G {formatNumber(target.macros.g)}</small></span>
                </div>
                {canUseWeeklyTargets && canEditNutrition && weeklyPageDirty ? (
                  <div className="og-weeklyAutomaticActions">
                    <button type="button" className="og-save" disabled={mutation.isPending} onClick={() => saveNutrition(false)}>
                      {mutation.isPending ? <LoaderCircle size={17} className="og-spin" /> : <Save size={17} />}
                      {mutation.isPending ? "Guardando..." : "Guardar modo automatico"}
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            {weeklyMode === WEEKLY_MODE_TRAINING_REST && canUseWeeklyTargets ? (
              <section className="og-trainingRestPanel">
                <div className="og-trainingRestCards">
                  <article className="training"><span>Entrenamiento</span><strong>{formatNumber(trainingPreview.kcal, " kcal")}</strong><small>P {trainingPreview.p || "-"} · C {trainingPreview.c || "-"} · G {trainingPreview.g || "-"}</small><button type="button" disabled={!canEditNutrition || !trainingPreviewDay} onClick={() => openWeeklyEditor(trainingPreviewDay?.key)}>Editar objetivo</button></article>
                  <article className="rest"><span>Descanso</span><strong>{formatNumber(restPreview.kcal, " kcal")}</strong><small>P {restPreview.p || "-"} · C {restPreview.c || "-"} · G {restPreview.g || "-"}</small><button type="button" disabled={!canEditNutrition || !restPreviewDay} onClick={() => openWeeklyEditor(restPreviewDay?.key)}>Editar objetivo</button></article>
                </div>
                <div className="og-trainingDayPicker" role="group" aria-label="Dias de entrenamiento">
                  <span>Dias de entrenamiento</span>
                  <div>{DAYS.map((day) => {
                    const active = trainingDays.includes(day.key);
                    const wouldRemoveLastGroup = (active && trainingDays.length <= 1) || (!active && trainingDays.length >= DAYS.length - 1);
                    return <button type="button" key={day.key} disabled={!canEditNutrition || wouldRemoveLastGroup} className={active ? "active" : ""} aria-pressed={active} onClick={() => setTrainingDays((current) => current.includes(day.key) ? current.filter((item) => item !== day.key) : [...current, day.key])}>{day.short}</button>;
                  })}</div>
                </div>
                <div className="og-trainingPresetActions">
                  <button type="button" disabled={!canEditNutrition} onClick={() => applyTrainingRestPreset("training", asNumber(nutritionDraft.kcal) + 150)}>Entreno +150 kcal</button>
                  <button type="button" disabled={!canEditNutrition} onClick={() => applyTrainingRestPreset("rest", Math.max(800, asNumber(nutritionDraft.kcal) - 150))}>Descanso -150 kcal</button>
                </div>
              </section>
            ) : null}

            {weeklyMode !== WEEKLY_MODE_AUTOMATIC && canUseWeeklyTargets ? (
              <section className="og-weekTargets">
                <header className="og-weekTargetsHead">
                  <div className="og-weekTargetsHeading">
                    <span>Tus objetivos de la semana</span>
                    <small>Resumen de la distribucion actual</small>
                  </div>
                  <div className="og-weekSummaryStats" aria-label="Resumen semanal">
                    <span><small>Promedio diario</small><strong>{formatNumber(weeklySummary.average.kcal)}</strong><em>kcal</em></span>
                    <span><small>Total semanal</small><strong>{formatNumber(weeklySummary.total.kcal)}</strong><em>kcal</em></span>
                  </div>
                  <button type="button" disabled={!canEditNutrition} onClick={() => openWeeklyEditor(DAYS[0].key)}><Pencil size={15} /> Editar dias</button>
                </header>
                <div className="og-weekDayList">
                  {DAYS.map((day) => {
                    const values = dayDrafts[day.key] || weeklyBaseDraft(target);
                    const visualState = weeklyDayVisualState({ mode: weeklyMode, dayKey: day.key, value: values, base: weeklyBaseDraft(target), trainingDays });
                    return (
                      <button type="button" disabled={!canEditNutrition} className={`og-weekDayRow day-${day.key}`} key={day.key} onClick={() => openWeeklyEditor(day.key)} aria-label={`Editar objetivos de ${day.label}`}>
                        <strong>{day.label}</strong>
                        <span className={`og-dayBadge ${visualState.key}`}>{visualState.label}</span>
                        <b><span>{formatNumber(values.kcal)}</span><small>kcal</small></b>
                        <span className="og-weekMacro protein"><i /><em>P</em><strong>{formatNumber(values.p)}</strong><small>g</small></span>
                        <span className="og-weekMacro carbs"><i /><em>C</em><strong>{formatNumber(values.c)}</strong><small>g</small></span>
                        <span className="og-weekMacro fats"><i /><em>G</em><strong>{formatNumber(values.g)}</strong><small>g</small></span>
                        <ChevronRight size={18} aria-hidden="true" />
                      </button>
                    );
                  })}
                </div>
                <div className="og-weeklyFooterActions">
                  <button type="button" className="og-weeklyRestore" disabled={!canEditNutrition} onClick={restoreWeeklyBase}><RotateCcw size={15} /> Restaurar semana</button>
                  {canEditNutrition ? <button type="button" className="og-save" disabled={mutation.isPending || !weeklyPageDirty} onClick={() => saveNutrition(false)}>{mutation.isPending ? <LoaderCircle size={17} className="og-spin" /> : <Save size={17} />}{mutation.isPending ? "Guardando..." : "Guardar distribucion semanal"}</button> : null}
                </div>
              </section>
            ) : null}

            {!canUseWeeklyTargets ? (
              <aside className="og-weeklyProNotice">
                <span><Crown size={19} /></span>
                <div><strong>Personalizacion semanal · PRO</strong><p>En el plan gratuito usas el mismo objetivo todos los dias. Con PRO podes personalizar calorias y macros por dia.</p></div>
                <a href="/app/planes">Ver PRO</a>
              </aside>
            ) : null}
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

                {nutritionMode === "recalculate" ? (
                  <section className="og-recalculationSteps">
                    <div className="og-recalculationChoice" role="group" aria-label="Datos para recalcular">
                      <button type="button" className={recalculationStep === "current_data" ? "active" : ""} onClick={() => { setRecalculationStep("current_data"); setConfirmProfileUpdate(false); setProfilePreviewOnly(false); }}>Usar datos actuales</button>
                      <button type="button" className={recalculationStep === "update_data" ? "active" : ""} onClick={() => { setRecalculationStep("update_data"); setProfilePreviewOnly(false); }}>Actualizar datos</button>
                    </div>
                    <div className="og-currentData">
                      <span>Peso <strong>{formatNumber(currentProfileData.weightKg, " kg")}</strong></span>
                      <span>Fecha <strong>{currentProfileData.date}</strong></span>
                      <span>Altura <strong>{formatNumber(currentProfileData.heightCm, " cm")}</strong></span>
                      <span>Edad <strong>{formatNumber(automaticTarget.usedData?.age, " anos")}</strong></span>
                      <span>Sexo <strong>{currentProfileData.gender || "Sin definir"}</strong></span>
                      <span>Actividad <strong>{currentProfileData.activity || "Sin definir"}</strong></span>
                      <span>Objetivo <strong>{goalLabel(currentProfileData.goalType)}</strong></span>
                      <span>Deporte <strong>{trainingFrequencyLabel(currentProfileData.trainingFrequency)}</strong></span>
                      <span>Criterio <strong>{recalculationStep === "update_data" ? updatedAutomaticTarget.formula : automaticTarget.description}</strong></span>
                    </div>
                    {recalculationStep === "update_data" ? (
                      <>
                        <div className="og-profileUpdateGrid">
                          <label><span>Peso (kg)</span><input type="number" min="20" max="350" step="0.1" value={recalculationData.weightKg ?? ""} onChange={(event) => setRecalculationData((current) => ({ ...current, weightKg: event.target.value }))} /></label>
                          <label><span>Fecha del peso</span><input type="date" max={localDateKey()} value={recalculationData.date || localDateKey()} onChange={(event) => setRecalculationData((current) => ({ ...current, date: event.target.value }))} /></label>
                          <label><span>Actividad diaria</span><select value={recalculationData.activity || ""} onChange={(event) => setRecalculationData((current) => ({ ...current, activity: event.target.value }))}><option value="">Seleccionar</option><option value="sedentario">Sedentario</option><option value="ligero">Ligero</option><option value="moderado">Moderado</option><option value="activo">Activo</option><option value="muy_activo">Muy activo</option></select></label>
                          <label><span>Objetivo</span><select value={recalculationData.goalType || ""} onChange={(event) => setRecalculationData((current) => ({ ...current, goalType: event.target.value }))}><option value="">Seleccionar</option>{GOAL_TYPES.map((goal) => <option key={goal.value} value={goal.value}>{goal.label}</option>)}</select></label>
                        </div>
                        <div className="og-previewCompare"><div><span>Antes</span><strong>{formatNumber(target.kcal, " kcal")}</strong><small>P {formatNumber(target.macros?.p)} · C {formatNumber(target.macros?.c)} · G {formatNumber(target.macros?.g)}</small></div><div><span>Vista previa ({formatNumber((updatedAutomaticTarget.kcal || 0) - (target.kcal || 0), " kcal")})</span><strong>{formatNumber(updatedAutomaticTarget.kcal, " kcal")}</strong><small>P {formatNumber(updatedAutomaticTarget.macros?.p)} · C {formatNumber(updatedAutomaticTarget.macros?.c)} · G {formatNumber(updatedAutomaticTarget.macros?.g)} · {updatedAutomaticTarget.formula}</small></div></div>
                        <label className="og-profileConfirm"><input type="checkbox" checked={confirmProfileUpdate} onChange={(event) => { setConfirmProfileUpdate(event.target.checked); setProfilePreviewOnly(false); }} /> Confirmo actualizar estos datos. El peso se guarda en Progresos; si ya existe esa fecha, se reemplaza sin duplicar.</label>
                        <div className="og-previewActions"><button type="button" className="og-applyPreview" onClick={() => applyUpdatedDataPreview({ saveProfile: false })}>Usar objetivo sin guardar datos</button><button type="button" className="og-applyPreview" onClick={() => applyUpdatedDataPreview({ saveProfile: true })}>Actualizar datos y usar objetivo</button></div>
                        {profilePreviewOnly ? <Notice type="info">Vista previa aplicada: al guardar el objetivo no se cambiaran peso ni actividad.</Notice> : null}
                      </>
                    ) : <button type="button" className="og-applyPreview" onClick={applyAutomaticNutritionTarget}>Recalcular sin cambiar mis datos</button>}
                  </section>
                ) : null}

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
                  <><p className="og-formHint"><Info size={16} />Las calorias se calculan automaticamente desde proteina y carbs x4, grasas x9.</p><div className="og-inlineActions"><button type="button" onClick={() => setNutritionDraft(initialDraft)}><RotateCcw size={14} /> Restaurar valores anteriores</button><button type="button" onClick={() => { setNutritionDraft(draftFromTarget(automaticTarget)); setNutritionMode("recalculate"); }}>Restablecer recomendado</button></div></>
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

      {weeklyEditor ? (
        <div
          className="og-weeklyEditorOverlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) requestCloseWeeklyEditor();
          }}
        >
          <section
            ref={weeklyDialogRef}
            className="og-weeklyEditor"
            role="dialog"
            aria-modal="true"
            aria-labelledby="weekly-editor-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="og-sheetHandle" aria-hidden="true" />
            <header className="og-weeklyEditorHead">
              <div>
                <span className="og-kicker">Distribucion semanal</span>
                <h2 id="weekly-editor-title">Editar dia</h2>
                <p>Ajusta los macros de {weeklyEditorDay.label}; las calorias se recalculan automaticamente con la formula 4/4/9.</p>
              </div>
              <div className="og-weeklyEditorHeadActions">
                <span className={`og-dayBadge ${weeklyEditorVisualState.key}`}>{weeklyEditorDay.label} · {weeklyEditorVisualState.label}</span>
                <button type="button" aria-label="Cerrar editor semanal" onClick={requestCloseWeeklyEditor}><X size={20} /></button>
              </div>
            </header>

            <div className="og-weeklyEditorFields">
              {[
                { field: "kcal", label: "Calorias", unit: "kcal", Icon: Flame, step: 50, min: 800, max: 7000, tone: "calories" },
                { field: "p", label: "Proteina", unit: "g", Icon: Dumbbell, step: 5, min: 0, max: 500, tone: "protein" },
                { field: "c", label: "Carbohidratos", unit: "g", Icon: Wheat, step: 5, min: 0, max: 900, tone: "carbs" },
                { field: "g", label: "Grasas", unit: "g", Icon: Droplets, step: 5, min: 0, max: 400, tone: "fats" },
              ].map(({ field, label, unit, Icon: fieldIcon, step, min, max, tone }) => (
                <label className={`og-weeklyEditorField ${tone}`} key={field}>
                  <span className="og-weeklyEditorFieldLabel">{React.createElement(fieldIcon, { size: 17 })} {label}</span>
                  <span className="og-weeklyEditorInput">
                    <input
                      type="number"
                      inputMode="decimal"
                      min={min}
                      max={max}
                      step={step}
                      value={weeklyEditorValues[field] ?? ""}
                      aria-label={`${label} de ${weeklyEditorDay.label}`}
                      onChange={(event) => updateWeeklyEditorField(field, event.target.value)}
                    />
                    <small>{unit}</small>
                  </span>
                  <span className="og-weeklyEditorStepper">
                    <button type="button" aria-label={`Restar ${step} ${unit} a ${label}`} onClick={() => adjustWeeklyEditorField(field, -step)}><Minus size={18} /></button>
                    <button type="button" aria-label={`Sumar ${step} ${unit} a ${label}`} onClick={() => adjustWeeklyEditorField(field, step)}><Plus size={18} /></button>
                  </span>
                </label>
              ))}
            </div>

            <section className="og-weeklyApplyPanel" aria-labelledby="weekly-apply-title">
              <div>
                <strong id="weekly-apply-title">Aplicar tambien en</strong>
                <small>Selecciona los dias que deben recibir los valores de {weeklyEditorDay.label}.</small>
              </div>
              <div className="og-weeklyApplyDays" role="group" aria-label="Dias seleccionados">
                {DAYS.map((day) => {
                  const selected = weeklyEditor.selectedDays?.includes(day.key);
                  return (
                    <button
                      type="button"
                      key={day.key}
                      className={selected ? "active" : ""}
                      aria-pressed={selected}
                      onClick={() => toggleWeeklyEditorDay(day.key)}
                    >
                      {selected ? <CheckCircle2 size={14} /> : null}{day.short}
                    </button>
                  );
                })}
              </div>
              <div className="og-weeklyEditorTools">
                <button type="button" onClick={applyWeeklyEditorToSelected}><Copy size={16} /> Aplicar a seleccionados</button>
                <button type="button" onClick={copyWeeklyEditorToAll}><Copy size={16} /> Copiar a todos</button>
                <button type="button" className="danger" onClick={restoreWeeklyEditorDay}><RotateCcw size={16} /> Restaurar base</button>
              </div>
            </section>

            {weeklyEditor.error ? <Notice type="error">{weeklyEditor.error}</Notice> : null}
            {weeklyEditor.feedback ? <Notice type="info">{weeklyEditor.feedback}</Notice> : null}
            {status && status.type !== "success" ? <Notice type={status.type}>{status.text}</Notice> : null}
            {weeklyDiscardConfirm ? (
              <Notice type="warn">
                <strong>Tenes cambios sin guardar.</strong>
                <br />Si cerras ahora, se descarta todo el borrador semanal.
                <div className="og-inlineActions">
                  <button type="button" onClick={() => { setWeeklyDiscardConfirm(false); setWeeklyEditor(null); }}>Descartar cambios</button>
                  <button type="button" onClick={() => setWeeklyDiscardConfirm(false)}>Seguir editando</button>
                </div>
              </Notice>
            ) : null}

            <footer className="og-weeklyEditorFooter">
              <button type="button" className="og-secondary" onClick={requestCloseWeeklyEditor}>Cancelar</button>
              <button type="button" className="og-save" disabled={mutation.isPending || !weeklyEditorSaveDirty} onClick={saveWeeklyEditor}>
                {mutation.isPending ? <LoaderCircle size={17} className="og-spin" /> : <Save size={17} />}
                {mutation.isPending ? "Guardando..." : "Guardar distribucion semanal"}
              </button>
            </footer>
          </section>
        </div>
      ) : null}

      {weeklyUpgradeOpen ? (
        <div className="og-weeklyEditorOverlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setWeeklyUpgradeOpen(false); }}>
          <section ref={weeklyDialogRef} className="og-weeklyUpgradeDialog" role="dialog" aria-modal="true" aria-labelledby="weekly-upgrade-title" onMouseDown={(event) => event.stopPropagation()}>
            <button type="button" className="og-dialogClose" aria-label="Cerrar" onClick={() => setWeeklyUpgradeOpen(false)}><X size={20} /></button>
            <span className="og-weeklyUpgradeIcon"><Crown size={28} /></span>
            <span className="og-kicker">Funcion PRO</span>
            <h2 id="weekly-upgrade-title">Personaliza cada dia de tu semana</h2>
            <p>Con PRO podes definir calorias y macros distintos por dia o separar tus jornadas de entrenamiento y descanso.</p>
            <div className="og-weeklyUpgradeActions">
              <button type="button" className="og-secondary" onClick={() => setWeeklyUpgradeOpen(false)}>Ahora no</button>
              <a className="og-save" href="/app/planes"><Crown size={16} /> Ver beneficios PRO</a>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
