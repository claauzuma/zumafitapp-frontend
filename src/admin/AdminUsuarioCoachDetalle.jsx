import React, { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  Eye,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  UserMinus,
  Users,
} from "lucide-react";
import {
  updateAdminUserStatus,
  updateAdminCoachPlan,
  getAdminCoachClients,
  unassignCoachFromClient,
  deleteAdminUser,
  updateAdminCoachOverrides,
  deleteAdminCoachOverrides,
  updateAdminCoachProfile,
} from "./adminUsuariosApi.js";
import { useAdminCoachClients, useAdminCoachPlanPreview } from "./adminUsuariosQueries.js";
import { startAdminImpersonation } from "../impersonationApi.js";
import {
  STALE_TIMES,
  invalidateAfterAdminUserUpdate,
  invalidateAfterCoachCapabilitiesChange,
  invalidateAfterDeleteUser,
  invalidateAfterUnassignCoach,
  queryKeys,
} from "../queryClient.js";
import {
  COACH_PROFESSIONAL_PLAN_OPTIONS,
  clientPlanLabel,
  coachProfessionalPlanFromUser,
  coachProfessionalPlanLabel,
  coachProfessionalPlanSummary,
  coachTrialState,
  normalizeCoachProfessionalPlan,
} from "../professionalPlans.js";
import "./adminUsuarioCoach.css";

const PLAN_OPTIONS = COACH_PROFESSIONAL_PLAN_OPTIONS;

const SPECIALTY_OPTIONS = [
  {
    value: "training",
    label: "Entrenador",
    specialties: { training: true, nutrition: false },
  },
  {
    value: "nutrition",
    label: "Nutricionista",
    specialties: { training: false, nutrition: true },
  },
  {
    value: "both",
    label: "Entrenador + nutricionista",
    specialties: { training: true, nutrition: true },
  },
];

const PERMISSION_SECTIONS = [
  {
    key: "routines",
    title: "Rutinas",
    specialtyKey: "training",
    unavailableText: "No disponible: este coach no tiene especialidad de entrenamiento.",
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
    specialtyKey: "nutrition",
    unavailableText: "No disponible: este coach no tiene especialidad de nutricion.",
    fields: [
      ["manualBuilder", "Armador manual"],
      ["foodLibrarySearch", "Biblioteca de alimentos"],
      ["menuLibrarySearch", "Biblioteca de menus"],
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
    fields: [
      ["basic", "Metricas basicas"],
      ["advanced", "Metricas avanzadas"],
    ],
  },
  {
    key: "exports",
    title: "Exportaciones",
    fields: [["enabled", "Exportar datos"]],
  },
];

export default function AdminUsuarioCoachDetalle({ user, onUserChange, onRefresh }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState("resumen");
  const [err, setErr] = useState("");

  const [draftPlan, setDraftPlan] = useState(getPlanCode(user));
  const [resetOverridesOnPlanChange, setResetOverridesOnPlanChange] = useState(false);
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const [overrideDraft, setOverrideDraft] = useState(() => normalizeOverrides(user?.coachOverrides));
  const [maxMode, setMaxMode] = useState(user?.coachOverrides?.maxClients != null ? "custom" : "plan");
  const [customMaxClients, setCustomMaxClients] = useState(numToInput(user?.coachOverrides?.maxClients));
  const [menuLimitMode, setMenuLimitMode] = useState(user?.coachOverrides?.maxCoachOwnedMenus != null ? "custom" : "plan");
  const [customMaxMenus, setCustomMaxMenus] = useState(numToInput(user?.coachOverrides?.maxCoachOwnedMenus));
  const [mealLimitMode, setMealLimitMode] = useState(user?.coachOverrides?.maxCoachOwnedMeals != null ? "custom" : "plan");
  const [customMaxMeals, setCustomMaxMeals] = useState(numToInput(user?.coachOverrides?.maxCoachOwnedMeals));
  const [trialEndsAt, setTrialEndsAt] = useState(dateInput(user?.coachOverrides?.trialEndsAt));

  const [specialtyDraft, setSpecialtyDraft] = useState(() => getSpecialtyValue(user));

  const [clientsSearch, setClientsSearch] = useState("");
  const [busyClientId, setBusyClientId] = useState("");

  const coachClientsQuery = useAdminCoachClients(user?.id, { enabled: activeTab === "clientes" });
  const clients = useMemo(
    () => (Array.isArray(coachClientsQuery.data?.clients) ? coachClientsQuery.data.clients : []),
    [coachClientsQuery.data]
  );
  const loadingClients = coachClientsQuery.isLoading;
  const refreshingClients = coachClientsQuery.isFetching && !coachClientsQuery.isLoading;

  const effective = user?.effectiveCapabilities || null;
  const specialties = user?.coachProfile?.specialties || {};
  const currentClients = Number(effective?.currentClients ?? clients.length ?? 0);
  const maxClients = effective?.maxClients ?? "sin limite";
  const currentCoachOwnedMenus = Number(effective?.usage?.currentCoachOwnedMenus || 0);
  const currentCoachOwnedMeals = Number(effective?.usage?.currentCoachOwnedMeals || 0);
  const maxCoachOwnedMenus = Number(effective?.limits?.maxCoachOwnedMenus || 0);
  const maxCoachOwnedMeals = Number(effective?.limits?.maxCoachOwnedMeals || 0);
  const trial = coachTrialState(user);
  const savedPlan = getPlanCode(user);
  const needsCanonicalPlan = !normalizeCoachProfessionalPlan(user?.coachSubscription?.plan);
  const planSelectionChanged = draftPlan !== savedPlan;
  const resetOverridesChanged = !!effective?.usesOverrides && resetOverridesOnPlanChange;
  const hasPendingPlanChanges = planSelectionChanged || needsCanonicalPlan || resetOverridesChanged;
  const coachPlanPreviewQuery = useAdminCoachPlanPreview(
    user?.id,
    draftPlan,
    resetOverridesOnPlanChange,
    { enabled: activeTab === "plan" }
  );
  const planPreview = coachPlanPreviewQuery.data || null;
  const planPreviewLoading = coachPlanPreviewQuery.isLoading || coachPlanPreviewQuery.isFetching;
  const planPreviewFailed = coachPlanPreviewQuery.isError;
  const downgradeBlocked = planPreview?.limitExceeded === true;
  const savePlanLabel = savingPlan
    ? "Guardando..."
    : !hasPendingPlanChanges
      ? "Sin cambios"
      : planSelectionChanged
        ? `Guardar cambio a ${coachProfessionalPlanLabel(draftPlan)}`
        : needsCanonicalPlan
          ? `Guardar plan ${coachProfessionalPlanLabel(draftPlan)}`
          : "Guardar configuración";

  useEffect(() => {
    setDraftPlan(getPlanCode(user));
    setOverrideDraft(normalizeOverrides(user?.coachOverrides));
    setMaxMode(user?.coachOverrides?.maxClients != null ? "custom" : "plan");
    setCustomMaxClients(numToInput(user?.coachOverrides?.maxClients));
    setMenuLimitMode(user?.coachOverrides?.maxCoachOwnedMenus != null ? "custom" : "plan");
    setCustomMaxMenus(numToInput(user?.coachOverrides?.maxCoachOwnedMenus));
    setMealLimitMode(user?.coachOverrides?.maxCoachOwnedMeals != null ? "custom" : "plan");
    setCustomMaxMeals(numToInput(user?.coachOverrides?.maxCoachOwnedMeals));
    setTrialEndsAt(dateInput(user?.coachOverrides?.trialEndsAt));
    setSpecialtyDraft(getSpecialtyValue(user));
  }, [user]);

  async function loadClients() {
    if (!user?.id) return;
    setErr("");
    return coachClientsQuery.refetch();
  }

  async function handleSavePlan() {
    if (!hasPendingPlanChanges) return;
    if (!planPreview || planPreviewLoading || planPreviewFailed) {
      setErr("Esperá a que termine la validación del plan antes de guardar.");
      return;
    }
    if (downgradeBlocked) {
      setErr(
        `No se puede guardar ${coachProfessionalPlanLabel(draftPlan)}: ${formatLimitViolations(planPreview.violations)}`
      );
      return;
    }

    try {
      setSavingPlan(true);
      setErr("");

      const updated = await updateAdminCoachPlan(user.id, {
        plan: draftPlan,
        resetOverrides: resetOverridesOnPlanChange,
      });
      onUserChange?.(updated);
      setResetOverridesOnPlanChange(false);
      await invalidateAfterCoachCapabilitiesChange(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar el plan");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleSavePermissions() {
    try {
      setSavingPermissions(true);
      setErr("");

      const payload = normalizeOverrides({
        ...overrideDraft,
        maxClients: maxMode === "custom" ? inputToNumOrNull(customMaxClients) : null,
        maxCoachOwnedMenus: menuLimitMode === "custom" ? inputToNumOrNull(customMaxMenus) : null,
        maxCoachOwnedMeals: mealLimitMode === "custom" ? inputToNumOrNull(customMaxMeals) : null,
        trialEndsAt: trialEndsAt ? new Date(`${trialEndsAt}T23:59:59`).toISOString() : null,
      });

      const updated = await updateAdminCoachOverrides(user.id, payload);
      onUserChange?.(updated);
      await invalidateAfterCoachCapabilitiesChange(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudieron guardar los permisos personalizados");
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleSaveLimits() {
    if (planSelectionChanged) {
      setErr("Guardá primero el cambio de plan para calcular y aplicar los overrides sobre el plan correcto.");
      return;
    }
    const emptyCustom = [
      [maxMode, customMaxClients, "clientes activos"],
      [menuLimitMode, customMaxMenus, "menús propios"],
      [mealLimitMode, customMaxMeals, "comidas propias"],
    ].find(([mode, value]) => mode === "custom" && String(value || "").trim() === "");
    if (emptyCustom) {
      setErr(`Ingresá un límite personalizado para ${emptyCustom[2]}.`);
      return;
    }
    try {
      setSavingPermissions(true);
      setErr("");
      const updated = await updateAdminCoachOverrides(user.id, {
        maxClients: maxMode === "custom" ? inputToNumOrNull(customMaxClients) : null,
        maxCoachOwnedMenus: menuLimitMode === "custom" ? inputToNumOrNull(customMaxMenus) : null,
        maxCoachOwnedMeals: mealLimitMode === "custom" ? inputToNumOrNull(customMaxMeals) : null,
      });
      onUserChange?.(updated);
      await invalidateAfterCoachCapabilitiesChange(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudieron guardar los límites individuales");
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleResetLimits() {
    const ok = window.confirm("¿Restaurar los tres límites al default global del plan? Los permisos personalizados se conservan.");
    if (!ok) return;
    try {
      setSavingPermissions(true);
      setErr("");
      const updated = await updateAdminCoachOverrides(user.id, {
        maxClients: null,
        maxCoachOwnedMenus: null,
        maxCoachOwnedMeals: null,
      });
      onUserChange?.(updated);
      await invalidateAfterCoachCapabilitiesChange(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudieron restaurar los límites del plan");
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleResetPermissions() {
    const ok = window.confirm("Esto elimina los permisos personalizados y vuelve a heredar todo del plan. Continuar?");
    if (!ok) return;

    try {
      setSavingPermissions(true);
      setErr("");
      const updated = await deleteAdminCoachOverrides(user.id);
      onUserChange?.(updated);
      await invalidateAfterCoachCapabilitiesChange(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudieron restaurar los permisos del plan");
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleToggleBlock() {
    try {
      setSavingAccount(true);
      setErr("");

      const nextEstado = user?.estado === "bloqueado" ? "activo" : "bloqueado";
      const updated = await updateAdminUserStatus(user.id, nextEstado);
      onUserChange?.(updated);
      await invalidateAfterAdminUserUpdate(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudo cambiar el estado");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleSaveSpecialties() {
    try {
      setSavingAccount(true);
      setErr("");

      const option = SPECIALTY_OPTIONS.find((item) => item.value === specialtyDraft);
      const updated = await updateAdminCoachProfile(user.id, {
        coachProfile: undefined,
        specialties: option?.specialties || { training: true, nutrition: false },
      });
      onUserChange?.(updated);
      await invalidateAfterCoachCapabilitiesChange(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudieron guardar las especialidades");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleDeleteCoach() {
    let assignedCount = currentClients;

    try {
      const data = await queryClient.fetchQuery({
        queryKey: queryKeys.adminCoachClients(user.id),
        queryFn: () => getAdminCoachClients(user.id),
        staleTime: STALE_TIMES.adminCoachClients,
      });
      const coachClients = Array.isArray(data?.clients) ? data.clients : [];
      assignedCount = coachClients.length;
    } catch {
      assignedCount = currentClients;
    }

    const confirmDelete = window.confirm(
      `Seguro que queres eliminar a ${fullName(user)}?\n\n${assignedCount} cliente(s) van a quedar autogestionados. Sus menus, rutinas, progreso e historial se conservan.`
    );

    if (!confirmDelete) return;

    try {
      setSavingAccount(true);
      setErr("");

      await deleteAdminUser(user.id);
      await invalidateAfterDeleteUser({
        deletedUser: user,
        userId: user.id,
      });
      navigate("/admin/usuarios");
    } catch (e) {
      setErr(e?.message || "No se pudo eliminar el coach");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleViewAsCoach() {
    const ok = window.confirm(
      `Vas a ingresar en modo simulacion de solo lectura como ${fullName(user)}.`
    );
    if (!ok) return;

    try {
      setErr("");
      await startAdminImpersonation(user.id, {
        returnTo: `/admin/usuarios/${user.id}`,
      });
      navigate("/profesional", { replace: true });
    } catch (e) {
      setErr(e?.message || "No se pudo iniciar la simulacion");
    }
  }

  async function handleRemoveClient(client) {
    const ok = window.confirm(`Queres quitar a ${fullName(client)} de este coach?`);
    if (!ok) return;

    try {
      setBusyClientId(client.id);
      setErr("");

      await unassignCoachFromClient(client.id);
      await invalidateAfterUnassignCoach({
        clientId: client.id,
        previousCoachId: user.id,
        updatedClient: null,
      });
      await loadClients();
      if (typeof onRefresh === "function") await onRefresh();
    } catch (e) {
      setErr(e?.message || "No se pudo quitar el cliente del coach");
    } finally {
      setBusyClientId("");
    }
  }

  async function handleDeleteClient(client) {
    const ok = window.confirm(
      `Seguro que queres eliminar al cliente ${fullName(client)}?\n\nEsta accion borra el usuario de la base de datos.`
    );
    if (!ok) return;

    try {
      setBusyClientId(client.id);
      setErr("");

      await deleteAdminUser(client.id);
      await invalidateAfterDeleteUser({
        deletedUser: client,
        userId: client.id,
        previousCoachId: user.id,
      });
      await loadClients();
    } catch (e) {
      setErr(e?.message || "No se pudo eliminar el cliente");
    } finally {
      setBusyClientId("");
    }
  }

  function updatePermission(section, field, value) {
    const parsed = value === "inherit" ? null : value === "true";
    setOverrideDraft((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [section]: {
          ...(prev.features?.[section] || {}),
          [field]: parsed,
        },
      },
    }));
  }

  function updateNumericPermission(section, field, mode, value) {
    setOverrideDraft((prev) => ({
      ...prev,
      features: {
        ...prev.features,
        [section]: {
          ...(prev.features?.[section] || {}),
          [field]: mode === "inherit" ? null : (inputToNumOrNull(value) ?? 0),
        },
      },
    }));
  }

  const filteredClients = useMemo(() => {
    const s = String(clientsSearch || "").trim().toLowerCase();
    if (!s) return clients;

    return clients.filter((c) => {
      const nombre = String(c?.profile?.nombre || "").toLowerCase();
      const apellido = String(c?.profile?.apellido || "").toLowerCase();
      const email = String(c?.email || "").toLowerCase();
      const full = `${nombre} ${apellido}`.trim();

      return full.includes(s) || email.includes(s);
    });
  }, [clients, clientsSearch]);

  const tabs = [
    { key: "resumen", label: "Resumen" },
    { key: "clientes", label: "Clientes" },
    { key: "plan", label: "Plan y límites" },
    { key: "permisos", label: "Permisos" },
    { key: "cuenta", label: "Cuenta" },
  ];

  return (
    <div className="auco-wrap">
      <div className="auco-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`auco-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resumen" && (
        <div className="auco-grid">
          <div className="auco-card">
            <div className="auco-profileHead">
              <Avatar user={user} size="lg" />
              <div className="auco-profileText">
                <div className="auco-title">{fullName(user)}</div>
                <div className="auco-sub">{user?.email || "Sin email"}</div>
              </div>
            </div>

            <div className="auco-infoGrid">
              <Info label="Especialidad" value={specialtyLabel(user)} />
              <Info label="Plan profesional" value={coachProfessionalPlanLabel(getPlanCode(user))} />
              <Info label="Estado" value={user?.estado || "activo"} />
              <Info label="Ultimo acceso" value={dateLabel(user?.lastLoginAt || user?.lastActivityAt)} />
              <Info label="Clientes" value={`${currentClients} / ${maxClients}`} />
              <Info
                label="Permisos"
                value={effective?.usesOverrides ? "Personalizados" : "Heredados del plan"}
              />
              <Info
                label="Beneficio de prueba"
                value={trial.isTrial ? `${trial.expired ? "Vencida" : "Activa"} - ${dateLabel(trial.endsAt)}` : "No aplica"}
              />
            </div>
          </div>

          <div className="auco-card">
            <div className="auco-title">Acciones rapidas</div>
            <div className="auco-actions">
              <button type="button" className="auco-btn" onClick={() => setActiveTab("clientes")}>
                <Users size={16} strokeWidth={2.2} aria-hidden="true" />
                Ver clientes
              </button>
              <button type="button" className="auco-btn" onClick={() => setActiveTab("plan")}>
                <SlidersHorizontal size={16} strokeWidth={2.2} aria-hidden="true" />
                Cambiar plan
              </button>
              <button type="button" className="auco-btn" onClick={() => setActiveTab("permisos")}>
                <UserCheck size={16} strokeWidth={2.2} aria-hidden="true" />
                Editar permisos
              </button>
              <button type="button" className="auco-btn auco-btnGold" onClick={handleViewAsCoach}>
                <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
                Ver como
              </button>
              <button type="button" className="auco-btn" onClick={() => setActiveTab("cuenta")}>
                <Ban size={16} strokeWidth={2.2} aria-hidden="true" />
                Cuenta
              </button>
            </div>

            <div className="auco-note">
              El limite efectivo se calcula en backend con plan, overrides, especialidad y estado de prueba.
            </div>
          </div>
        </div>
      )}

      {activeTab === "clientes" && (
        <div className="auco-card">
          <div className="auco-row">
            <div>
              <div className="auco-title">Clientes del coach</div>
              <div className="auco-sub">
                {currentClients} cliente(s) asignados. Quitar un coach no borra menus, rutinas ni historial.
              </div>
            </div>

            <button type="button" className="auco-btn" onClick={loadClients} disabled={loadingClients}>
              <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
              {loadingClients ? "Cargando..." : refreshingClients ? "Actualizando..." : "Recargar"}
            </button>
          </div>

          <div className="auco-searchWrap">
            <input
              className="auco-input"
              placeholder="Buscar por nombre, apellido o email..."
              value={clientsSearch}
              onChange={(e) => setClientsSearch(e.target.value)}
            />
          </div>

          {loadingClients ? (
            <div className="auco-empty">Cargando clientes...</div>
          ) : filteredClients.length === 0 ? (
            <div className="auco-empty">No hay clientes para mostrar.</div>
          ) : (
            <div className="auco-clientList">
              {filteredClients.map((client) => (
                <div key={client.id} className="auco-clientCard">
                  <div className="auco-clientTop">
                    <Avatar user={client} />

                    <div className="auco-clientInfo">
                      <div className="auco-clientName">{fullName(client)}</div>
                      <div className="auco-clientEmail">{client?.email || "Sin email"}</div>

                      <div className="auco-clientMeta">
                        <span className="auco-chip">Objetivo: {goalLabel(client?.goal?.type)}</span>
                        <span className="auco-chip">Kcal: {fmtNumOrDash(client?.metasActuales?.kcal)}</span>
                        <span className="auco-chip">Plan cliente: {clientPlanLabel(client?.plan)}</span>
                        <span className="auco-chip">Estado: {client?.estado || "activo"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="auco-clientActions">
                    <button type="button" className="auco-btn" onClick={() => navigate(`/admin/usuarios/${client.id}`)}>
                      Ver detalle
                    </button>
                    <button
                      type="button"
                      className="auco-btn"
                      onClick={() => handleRemoveClient(client)}
                      disabled={busyClientId === client.id}
                    >
                      <UserMinus size={16} strokeWidth={2.2} aria-hidden="true" />
                      {busyClientId === client.id ? "Procesando..." : "Quitar del coach"}
                    </button>
                    <button
                      type="button"
                      className="auco-btn auco-btnDanger"
                      onClick={() => handleDeleteClient(client)}
                      disabled={busyClientId === client.id}
                    >
                      <Trash2 size={16} strokeWidth={2.2} aria-hidden="true" />
                      Eliminar cliente
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "plan" && (
        <div className="auco-card">
          <div className="auco-title">Plan profesional del coach</div>
          <div className="auco-sub">
            Define el acceso profesional del coach. No modifica planes personales de clientes ni paquetes de servicio coach-cliente.
          </div>

          <div className="auco-planRow">
            {PLAN_OPTIONS.map((plan) => (
              <button
                key={plan.value}
                type="button"
                className={`auco-planBtn ${draftPlan === plan.value ? "active" : ""}`}
                onClick={() => setDraftPlan(plan.value)}
              >
                {plan.label}
              </button>
            ))}
          </div>

          <div className={`auco-planChange ${hasPendingPlanChanges ? "pending" : "saved"}`}>
            {planSelectionChanged
              ? `Cambio sin guardar: ${coachProfessionalPlanLabel(savedPlan)} → ${coachProfessionalPlanLabel(draftPlan)}`
              : needsCanonicalPlan
                ? "Registro legacy: al guardar se completará el plan profesional canónico."
                : resetOverridesChanged
                  ? "Cambio sin guardar: se restaurarán los permisos personalizados."
                  : "Sin cambios pendientes."}
          </div>

          <div className="auco-planStatusGrid">
            <section className="auco-planPanel">
              <div className="auco-kicker">Estado actual guardado</div>
              <h3 className="auco-planPanelTitle">
                Plan profesional actual: {coachProfessionalPlanLabel(savedPlan)}
              </h3>
              <p className="auco-planDescription">{coachProfessionalPlanSummary(savedPlan)}</p>
              <div className="auco-planMetrics">
                <PlanMetric label="Clientes" value={`${currentClients} / ${formatLimit(maxClients)}`} />
                <PlanMetric label="Menús propios" value={`${currentCoachOwnedMenus} / ${formatLimit(maxCoachOwnedMenus)}`} />
                <PlanMetric label="Comidas propias" value={`${currentCoachOwnedMeals} / ${formatLimit(maxCoachOwnedMeals)}`} />
                <PlanMetric
                  label="Beneficio de prueba"
                  value={trial.isTrial ? (trial.expired ? "Vencido" : "Activo") : "No aplica"}
                />
                <PlanMetric label="Prueba vence" value={trial.isTrial ? dateLabel(trial.endsAt) : "-"} />
              </div>
            </section>

            <section className="auco-planPanel preview">
              <div className="auco-kicker">Preview al guardar</div>
              <h3 className="auco-planPanelTitle">Plan seleccionado: {coachProfessionalPlanLabel(draftPlan)}</h3>
              <p className="auco-planDescription">{coachProfessionalPlanSummary(draftPlan)}</p>

              {planPreviewLoading && !planPreview ? (
                <div className="auco-planPreviewState">Calculando permisos y límite efectivos...</div>
              ) : planPreviewFailed ? (
                <div className="auco-planPreviewState is-error">
                  No se pudo validar el plan seleccionado. Reintentá antes de guardar.
                </div>
              ) : planPreview ? (
                <>
                  <div className="auco-planMetrics compact">
                    <PlanMetric label="Clientes" value={`${planPreview.currentClients} / ${formatLimit(planPreview.maxClients)}`} />
                    <PlanMetric label="Menús propios" value={`${planPreview.currentCoachOwnedMenus} / ${formatLimit(planPreview.maxCoachOwnedMenus)}`} />
                    <PlanMetric label="Comidas propias" value={`${planPreview.currentCoachOwnedMeals} / ${formatLimit(planPreview.maxCoachOwnedMeals)}`} />
                  </div>
                  <div className="auco-capabilityList" aria-label="Permisos efectivos al guardar">
                    <CapabilityPreviewRow label="Crear menús propios" enabled={planPreview.libraryCapabilities?.canCreateCoachMenus} />
                    <CapabilityPreviewRow label="Crear comidas propias" enabled={planPreview.libraryCapabilities?.canCreateCoachMeals} />
                    <CapabilityPreviewRow
                      label="Biblioteca global ZumaFit"
                      enabled={
                        planPreview.libraryCapabilities?.canUseGlobalMenuTemplates ||
                        planPreview.libraryCapabilities?.canUseGlobalMealTemplates
                      }
                    />
                    <CapabilityPreviewRow
                      label="Plantillas premium"
                      enabled={
                        planPreview.libraryCapabilities?.canUsePremiumMenuTemplates ||
                        planPreview.libraryCapabilities?.canUsePremiumMealTemplates
                      }
                    />
                    <CapabilityPreviewRow label="Duplicar plantillas globales" enabled={planPreview.libraryCapabilities?.canDuplicateGlobalTemplates} />
                    <CapabilityPreviewRow label="Asignar plantillas globales" enabled={planPreview.libraryCapabilities?.canAssignGlobalTemplates} />
                  </div>
                </>
              ) : null}
            </section>
          </div>

          {effective?.usesOverrides ? (
            <label className="auco-check">
              <input
                type="checkbox"
                checked={resetOverridesOnPlanChange}
                onChange={(e) => setResetOverridesOnPlanChange(e.target.checked)}
              />
              Restaurar permisos personalizados al guardar este plan.
            </label>
          ) : null}

          {planPreview?.usesOverrides && !resetOverridesOnPlanChange ? (
            <div className="auco-note">
              El preview conserva los permisos personalizados actuales. Esos valores pueden modificar el preset del plan seleccionado.
            </div>
          ) : null}

          {downgradeBlocked ? (
            <div className="auco-planAlert danger" role="alert">
              No se puede guardar {coachProfessionalPlanLabel(draftPlan)}. {formatLimitViolations(planPreview.violations)}
            </div>
          ) : hasPendingPlanChanges && planPreview ? (
            <div className="auco-planAlert warning">
              Este cambio actualizará el plan profesional y sus permisos efectivos. No modifica el plan personal de ningún cliente.
            </div>
          ) : null}

          <div className="auco-box">
            <div className="auco-sectionHead">
              <div>
                <div className="auco-kicker">Límites individuales del coach</div>
                <div className="auco-sectionHint">Heredar usa el default global del plan. Personalizar afecta únicamente a este coach.</div>
              </div>
            </div>
            <div className="auco-permissionGrid">
              <LimitOverrideControl
                label="Clientes activos"
                current={currentClients}
                planDefault={planPreview?.planDefaults?.maxActiveClients}
                mode={maxMode}
                value={customMaxClients}
                onModeChange={setMaxMode}
                onValueChange={setCustomMaxClients}
                minimum={1}
              />
              <LimitOverrideControl
                label="Menús propios"
                current={currentCoachOwnedMenus}
                planDefault={planPreview?.planDefaults?.maxCoachOwnedMenus}
                mode={menuLimitMode}
                value={customMaxMenus}
                onModeChange={setMenuLimitMode}
                onValueChange={setCustomMaxMenus}
              />
              <LimitOverrideControl
                label="Comidas propias"
                current={currentCoachOwnedMeals}
                planDefault={planPreview?.planDefaults?.maxCoachOwnedMeals}
                mode={mealLimitMode}
                value={customMaxMeals}
                onModeChange={setMealLimitMode}
                onValueChange={setCustomMaxMeals}
              />
            </div>
            <div className="auco-actions">
              <button type="button" className="auco-btn auco-btnGold" onClick={handleSaveLimits} disabled={savingPermissions || planSelectionChanged}>
                <Save size={16} strokeWidth={2.2} aria-hidden="true" />
                {savingPermissions ? "Guardando..." : "Guardar límites individuales"}
              </button>
              <button type="button" className="auco-btn" onClick={handleResetLimits} disabled={savingPermissions || planSelectionChanged}>
                <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
                Restaurar límites del plan
              </button>
            </div>
          </div>

          <div className="auco-actions">
            <button
              type="button"
              className="auco-btn auco-btnGold"
              onClick={handleSavePlan}
              disabled={
                savingPlan ||
                planPreviewLoading ||
                planPreviewFailed ||
                !planPreview ||
                !hasPendingPlanChanges ||
                downgradeBlocked
              }
            >
              <Save size={16} strokeWidth={2.2} aria-hidden="true" />
              {savePlanLabel}
            </button>
          </div>
        </div>
      )}

      {activeTab === "permisos" && (
        <div className="auco-card">
          <div className="auco-title">Permisos personalizados</div>
          <div className="auco-sub">
            Cada valor puede heredar del plan, habilitarse o deshabilitarse. La especialidad siempre tiene prioridad.
          </div>

          <div className="auco-permissions">
            <div className="auco-box">
              <div className="auco-kicker">Limite de clientes</div>
              <div className="auco-inlineControls">
                <select className="auco-select" value={maxMode} onChange={(e) => setMaxMode(e.target.value)}>
                  <option value="plan">Usar limite del plan</option>
                  <option value="custom">Usar limite personalizado</option>
                </select>
                {maxMode === "custom" ? (
                  <input
                    className="auco-input compact"
                    value={customMaxClients}
                    onChange={(e) => setCustomMaxClients(sanitizeNumInput(e.target.value))}
                    placeholder="Max clientes"
                  />
                ) : null}
              </div>
            </div>

            <div className="auco-box">
              <div className="auco-kicker">Vencimiento del beneficio de prueba</div>
              <div className="auco-inlineControls">
                <input
                  className="auco-input compact"
                  type="date"
                  value={trialEndsAt}
                  onChange={(e) => setTrialEndsAt(e.target.value)}
                />
                <button className="auco-btn" type="button" onClick={() => setTrialEndsAt("")}>
                  Heredar
                </button>
              </div>
              <div className="auco-sub">Solo se aplica cuando subscription.status indica una prueba real.</div>
            </div>

            {PERMISSION_SECTIONS.map((section) => {
              const available =
                !section.specialtyKey ||
                (section.specialtyKey === "training" && !!specialties.training) ||
                (section.specialtyKey === "nutrition" && !!specialties.nutrition);

              return (
                <div key={section.key} className={`auco-box ${available ? "" : "is-disabled"}`}>
                  <div className="auco-sectionHead">
                    <div>
                      <div className="auco-kicker">{section.title}</div>
                      {!available ? <div className="auco-sectionHint">{section.unavailableText}</div> : null}
                    </div>
                    {effective?.disabledBySpecialty?.[section.key] ? (
                      <span className="auco-chip is-off">Anulado por especialidad</span>
                    ) : null}
                  </div>

                  <div className="auco-permissionGrid">
                    {section.fields.map(([field, label]) => (
                      <label key={field} className="auco-permissionControl">
                        <span>{label}</span>
                        <select
                          className="auco-select"
                          value={selectValue(overrideDraft?.features?.[section.key]?.[field])}
                          onChange={(e) => updatePermission(section.key, field, e.target.value)}
                          disabled={!available}
                        >
                          <option value="inherit">Heredar del plan</option>
                          <option value="true">Habilitar</option>
                          <option value="false">Deshabilitar</option>
                        </select>
                      </label>
                    ))}

                    {section.limitField ? (
                      <TemplateLimitControl
                        sectionKey={section.key}
                        value={overrideDraft?.features?.[section.key]?.[section.limitField]}
                        disabled={!available}
                        onChange={updateNumericPermission}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="auco-actions">
            <button type="button" className="auco-btn auco-btnGold" onClick={handleSavePermissions} disabled={savingPermissions}>
              <Save size={16} strokeWidth={2.2} aria-hidden="true" />
              {savingPermissions ? "Guardando..." : "Guardar permisos personalizados"}
            </button>
            <button type="button" className="auco-btn" onClick={handleResetPermissions} disabled={savingPermissions}>
              <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
              Restaurar plan
            </button>
          </div>
        </div>
      )}

      {activeTab === "cuenta" && (
        <div className="auco-card">
          <div className="auco-title">Cuenta</div>
          <div className="auco-sub">Acciones sensibles sobre la cuenta del coach.</div>

          <div className="auco-box">
            <div className="auco-kicker">Especialidad</div>
            <div className="auco-inlineControls">
              <select className="auco-select" value={specialtyDraft} onChange={(e) => setSpecialtyDraft(e.target.value)}>
                {SPECIALTY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button type="button" className="auco-btn auco-btnGold" onClick={handleSaveSpecialties} disabled={savingAccount}>
                <Save size={16} strokeWidth={2.2} aria-hidden="true" />
                Guardar especialidad
              </button>
            </div>
          </div>

          <div className="auco-note">
            Al eliminar este coach, {currentClients} cliente(s) quedaran autogestionados y conservaran sus planes e historial.
          </div>

          <div className="auco-actions">
            <button type="button" className="auco-btn" onClick={handleToggleBlock} disabled={savingAccount}>
              <Ban size={16} strokeWidth={2.2} aria-hidden="true" />
              {savingAccount
                ? "Procesando..."
                : user?.estado === "bloqueado"
                ? "Desbloquear coach"
                : "Bloquear coach"}
            </button>

            <button type="button" className="auco-btn auco-btnDanger" onClick={handleDeleteCoach} disabled={savingAccount}>
              <Trash2 size={16} strokeWidth={2.2} aria-hidden="true" />
              {savingAccount ? "Eliminando..." : "Eliminar coach"}
            </button>
            <button type="button" className="auco-btn auco-btnGold" onClick={handleViewAsCoach} disabled={savingAccount}>
              <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
              Ver como coach
            </button>
          </div>
        </div>
      )}

      {err ? <div className="auco-error">{err}</div> : null}
    </div>
  );
}

function TemplateLimitControl({ sectionKey, value, disabled, onChange }) {
  const [mode, setMode] = useState(value === null || value === undefined ? "inherit" : "custom");
  const [input, setInput] = useState(numToInput(value));

  useEffect(() => {
    setMode(value === null || value === undefined ? "inherit" : "custom");
    setInput(numToInput(value));
  }, [value]);

  return (
    <label className="auco-permissionControl">
      <span>Limite de plantillas</span>
      <div className="auco-inlineControls slim">
        <select
          className="auco-select"
          value={mode}
          disabled={disabled}
          onChange={(e) => {
            const nextMode = e.target.value;
            setMode(nextMode);
            onChange(sectionKey, "ownTemplatesLimit", nextMode, input);
          }}
        >
          <option value="inherit">Heredar</option>
          <option value="custom">Personalizado</option>
        </select>
        {mode === "custom" ? (
          <input
            className="auco-input mini"
            value={input}
            disabled={disabled}
            onChange={(e) => {
              const next = sanitizeNumInput(e.target.value);
              setInput(next);
              onChange(sectionKey, "ownTemplatesLimit", "custom", next);
            }}
          />
        ) : null}
      </div>
    </label>
  );
}

function Avatar({ user, size = "md" }) {
  const avatarUrl = getAvatarUrl(user);
  return (
    <div className={`auco-avatar ${size === "lg" ? "large" : ""}`}>
      {avatarUrl ? (
        <img src={avatarUrl} alt={fullName(user)} className="auco-avatarImg" />
      ) : (
        <div className="auco-avatarFallback">{initials(user?.profile?.nombre, user?.profile?.apellido)}</div>
      )}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="auco-box">
      <div className="auco-kicker">{label}</div>
      <div className="auco-value">{value ?? "-"}</div>
    </div>
  );
}

function PlanMetric({ label, value }) {
  return (
    <div className="auco-planMetric">
      <span>{label}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}

function LimitOverrideControl({
  label,
  current,
  planDefault,
  mode,
  value,
  onModeChange,
  onValueChange,
  minimum = 0,
}) {
  return (
    <label className="auco-permissionControl">
      <span>{label}</span>
      <small>Uso actual: {current} · Default del plan: {formatLimit(planDefault)}</small>
      <select className="auco-select" value={mode} onChange={(event) => onModeChange(event.target.value)}>
        <option value="plan">Heredado del plan</option>
        <option value="custom">Personalizado</option>
      </select>
      {mode === "custom" ? (
        <input
          className="auco-input compact"
          inputMode="numeric"
          value={value}
          onChange={(event) => onValueChange(sanitizeNumInput(event.target.value))}
          placeholder={`Mínimo ${minimum}`}
        />
      ) : null}
    </label>
  );
}

function CapabilityPreviewRow({ label, enabled }) {
  return (
    <div className="auco-capabilityRow">
      <span>{label}</span>
      <span className={`auco-capabilityState ${enabled ? "is-on" : "is-off"}`}>{enabled ? "Incluido" : "No incluido"}</span>
    </div>
  );
}

function formatLimit(value) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit < 0) return "Sin límite";
  return String(limit);
}

function formatLimitViolations(violations = []) {
  if (!Array.isArray(violations) || !violations.length) return "El uso actual supera los límites resultantes.";
  return violations
    .map((violation) => `${violation.current} ${violation.label || "elementos"} para un límite de ${violation.limit}`)
    .join("; ");
}

function getAvatarUrl(user) {
  return (
    user?.profile?.avatarUrl ||
    user?.profile?.foto ||
    user?.profile?.avatar ||
    user?.avatarUrl ||
    user?.avatar ||
    ""
  );
}

function fullName(user) {
  const nombre = String(user?.profile?.nombre || "").trim();
  const apellido = String(user?.profile?.apellido || "").trim();
  return `${nombre} ${apellido}`.trim() || "Sin nombre";
}

function initials(nombre = "", apellido = "") {
  const a = String(nombre || "").trim()[0] || "U";
  const b = String(apellido || "").trim()[0] || "X";
  return `${a}${b}`.toUpperCase();
}

function specialtyLabel(user) {
  const training = !!user?.coachProfile?.specialties?.training;
  const nutrition = !!user?.coachProfile?.specialties?.nutrition;

  if (training && nutrition) return "Entrenamiento + Nutricion";
  if (training) return "Entrenamiento";
  if (nutrition) return "Nutricion";
  return "Sin especialidad";
}

function getSpecialtyValue(user) {
  const training = !!user?.coachProfile?.specialties?.training;
  const nutrition = !!user?.coachProfile?.specialties?.nutrition;
  if (training && nutrition) return "both";
  if (nutrition) return "nutrition";
  return "training";
}

function goalLabel(obj) {
  if (!obj) return "-";
  if (obj === "perder_peso") return "Perdida de grasa";
  if (obj === "ganar_peso") return "Ganancia muscular";
  if (obj === "mantener_peso") return "Mantenimiento";
  return String(obj);
}

function fmtNumOrDash(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "-";
}

function getPlanCode(user) {
  return coachProfessionalPlanFromUser(user);
}

function dateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function dateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function selectValue(value) {
  if (value === null || value === undefined) return "inherit";
  return value ? "true" : "false";
}

function sanitizeNumInput(x) {
  return String(x ?? "").replace(/[^\d]/g, "");
}

function inputToNumOrNull(x) {
  const s = String(x ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function numToInput(v) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function normalizeOverrides(raw = {}) {
  const base = {
    maxClients: null,
    maxCoachOwnedMenus: null,
    maxCoachOwnedMeals: null,
    trialEndsAt: null,
    features: {
      routines: {
        manualBuilder: null,
        librarySearch: null,
        ownTemplates: null,
        ownTemplatesLimit: null,
        duplicatePlans: null,
        semiAutomaticBuilder: null,
        automaticGenerator: null,
      },
      menus: {
        manualBuilder: null,
        foodLibrarySearch: null,
        menuLibrarySearch: null,
        ownTemplates: null,
        ownTemplatesLimit: null,
        duplicatePlans: null,
        semiAutomaticBuilder: null,
        automaticGenerator: null,
      },
      metrics: {
        basic: null,
        advanced: null,
      },
      exports: {
        enabled: null,
      },
    },
  };

  return {
    ...base,
    ...raw,
    features: {
      ...base.features,
      ...(raw?.features || {}),
      routines: {
        ...base.features.routines,
        ...(raw?.features?.routines || {}),
      },
      menus: {
        ...base.features.menus,
        ...(raw?.features?.menus || {}),
      },
      metrics: {
        ...base.features.metrics,
        ...(raw?.features?.metrics || {}),
      },
      exports: {
        ...base.features.exports,
        ...(raw?.features?.exports || {}),
      },
    },
  };
}
