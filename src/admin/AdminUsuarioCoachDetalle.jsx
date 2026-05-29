import React, { useEffect, useMemo, useState } from "react";
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
import { startAdminImpersonation } from "../impersonationApi.js";
import "./adminUsuarioCoach.css";

const PLAN_OPTIONS = [
  { value: "trial_pro", label: "Prueba Pro" },
  { value: "pro", label: "Pro" },
  { value: "vip", label: "VIP" },
];

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
  const [trialEndsAt, setTrialEndsAt] = useState(dateInput(user?.coachOverrides?.trialEndsAt));

  const [specialtyDraft, setSpecialtyDraft] = useState(() => getSpecialtyValue(user));

  const [loadingClients, setLoadingClients] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientsSearch, setClientsSearch] = useState("");
  const [busyClientId, setBusyClientId] = useState("");

  const effective = user?.effectiveCapabilities || null;
  const specialties = user?.coachProfile?.specialties || {};
  const currentClients = Number(effective?.currentClients ?? clients.length ?? 0);
  const maxClients = effective?.maxClients ?? "sin limite";

  useEffect(() => {
    setDraftPlan(getPlanCode(user));
    setOverrideDraft(normalizeOverrides(user?.coachOverrides));
    setMaxMode(user?.coachOverrides?.maxClients != null ? "custom" : "plan");
    setCustomMaxClients(numToInput(user?.coachOverrides?.maxClients));
    setTrialEndsAt(dateInput(user?.coachOverrides?.trialEndsAt));
    setSpecialtyDraft(getSpecialtyValue(user));
  }, [user]);

  useEffect(() => {
    if (activeTab === "clientes") {
      loadClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  async function loadClients() {
    if (!user?.id) return;
    try {
      setLoadingClients(true);
      setErr("");

      const data = await getAdminCoachClients(user.id);
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (e) {
      setErr(e?.message || "No se pudieron cargar los clientes");
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  async function handleSavePlan() {
    if (draftPlan === getPlanCode(user) && !resetOverridesOnPlanChange) return;

    try {
      setSavingPlan(true);
      setErr("");

      const updated = await updateAdminCoachPlan(user.id, {
        plan: draftPlan,
        resetOverrides: resetOverridesOnPlanChange,
      });
      onUserChange?.(updated);
      setResetOverridesOnPlanChange(false);
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
        trialEndsAt: trialEndsAt ? new Date(`${trialEndsAt}T23:59:59`).toISOString() : null,
      });

      const updated = await updateAdminCoachOverrides(user.id, payload);
      onUserChange?.(updated);
    } catch (e) {
      setErr(e?.message || "No se pudieron guardar los permisos personalizados");
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
    } catch (e) {
      setErr(e?.message || "No se pudieron guardar las especialidades");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleDeleteCoach() {
    let assignedCount = currentClients;

    try {
      const data = await getAdminCoachClients(user.id);
      const coachClients = Array.isArray(data?.clients) ? data.clients : [];
      assignedCount = coachClients.length;
      setClients(coachClients);
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

  const currentPlanChanged = draftPlan !== getPlanCode(user);
  const tabs = [
    { key: "resumen", label: "Resumen" },
    { key: "clientes", label: "Clientes" },
    { key: "plan", label: "Plan y limites" },
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
              <Info label="Plan" value={effective?.planName || planLabel(user?.plan)} />
              <Info label="Estado" value={user?.estado || "activo"} />
              <Info label="Ultimo acceso" value={dateLabel(user?.lastLoginAt || user?.lastActivityAt)} />
              <Info label="Clientes" value={`${currentClients} / ${maxClients}`} />
              <Info
                label="Permisos"
                value={effective?.usesOverrides ? "Personalizados" : "Heredados del plan"}
              />
              <Info
                label="Prueba"
                value={
                  getPlanCode(user) === "trial_pro"
                    ? `${effective?.isTrialExpired ? "Vencida" : "Activa"} - ${dateLabel(effective?.trialEndsAt)}`
                    : "No aplica"
                }
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
              {loadingClients ? "Cargando..." : "Recargar"}
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
                        <span className="auco-chip">Plan: {planLabel(client?.plan)}</span>
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
          <div className="auco-title">Plan y limites</div>
          <div className="auco-sub">
            Seleccionar un plan no guarda cambios hasta tocar Guardar plan.
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

          <div className="auco-infoGrid">
            <Info label="Plan guardado" value={effective?.planName || planLabel(user?.plan)} />
            <Info label="Plan seleccionado" value={planLabel(draftPlan)} />
            <Info label="Clientes actuales" value={currentClients} />
            <Info label="Limite efectivo" value={maxClients} />
            <Info label="Prueba vence" value={dateLabel(effective?.trialEndsAt)} />
            <Info label="Estado de prueba" value={effective?.isTrialExpired ? "Vencida" : "Sin vencer"} />
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

          <div className="auco-note">
            {effective?.usesOverrides
              ? "Este coach tiene overrides. Si no los restauras, se mantienen y pisan solo los valores personalizados."
              : "Este coach hereda los permisos del plan."}
            {currentPlanChanged ? " Hay un cambio de plan pendiente." : ""}
          </div>

          <div className="auco-actions">
            <button
              type="button"
              className="auco-btn auco-btnGold"
              onClick={handleSavePlan}
              disabled={savingPlan || (!currentPlanChanged && !resetOverridesOnPlanChange)}
            >
              <Save size={16} strokeWidth={2.2} aria-hidden="true" />
              {savingPlan ? "Guardando..." : "Guardar plan"}
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
              <div className="auco-kicker">Vencimiento de prueba</div>
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

function planLabel(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium2" || p === "vip") return "VIP";
  if (p === "premium" || p === "pro") return "Pro";
  if (p === "free" || p === "trial_pro" || p === "trial") return "Prueba Pro";
  return "Prueba Pro";
}

function getPlanCode(user) {
  const p = String(user?.effectiveCapabilities?.planCode || user?.plan || "").toLowerCase();
  if (p === "premium2") return "vip";
  if (p === "premium") return "pro";
  if (p === "free" || p === "trial" || p === "trialpro") return "trial_pro";
  if (["trial_pro", "pro", "vip"].includes(p)) return p;
  return "trial_pro";
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
