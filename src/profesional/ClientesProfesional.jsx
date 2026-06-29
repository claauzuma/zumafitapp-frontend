import React, { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Eye, RefreshCw, Search, Send, Trash2, UserPlus, Users, X } from "lucide-react";
import { Avatar, Metric } from "./profesionalPieces.jsx";
import { useProfessionalClientInvitations, useProfessionalClients } from "./profesionalQueries.js";
import {
  activateProfessionalClientInvitation,
  cancelProfessionalClientInvitation,
  createProfessionalClientInvitation,
  deleteProfessionalClientInvitation,
} from "./profesionalApi.js";
import { isImpersonating } from "../authCache.js";
import { invalidateProfessionalClientInvitations } from "../queryClient.js";
import {
  capacityLabel,
  fmtDate,
  fmtKcal,
  fullName,
  goalLabel,
  planLabel,
} from "./profesionalFormat.js";
import AppToast from "../ui/AppToast.jsx";
import "./profesionalPanel.css";

const EMPTY_INVITE_FORM = {
  nombre: "",
  apellido: "",
  email: "",
  servicePackage: "service_pro",
  onboarding: {
    enabled: true,
    mode: "full",
  },
  clientPermissions: {
    menu: {
      canViewMenu: true,
      canEditPreferences: true,
      canUseAutomaticMenu: false,
      canUseSemiAutomaticMenu: false,
      canRequestMenuChanges: true,
    },
    routine: {
      canViewRoutine: true,
      canLogWorkout: true,
      canEditWeights: true,
      canUseAutomaticRoutine: false,
      canUseSemiAutomaticRoutine: false,
      canRequestRoutineChanges: true,
    },
    progress: {
      canLogWeight: true,
      canUploadProgressPhotos: true,
      canViewAdvancedMetrics: false,
    },
  },
};

export default function ClientesProfesional() {
  const [query, setQuery] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState(() => structuredCloneSafe(EMPTY_INVITE_FORM));
  const [toast, setToast] = useState(null);
  const clientsQuery = useProfessionalClients();
  const invitationsQuery = useProfessionalClientInvitations({ status: "todos" });
  const loading = clientsQuery.isLoading;
  const refreshing = clientsQuery.isFetching && !clientsQuery.isLoading;
  const err = clientsQuery.error?.message || "";
  const coach = clientsQuery.data?.coach || null;
  const clients = useMemo(
    () => (Array.isArray(clientsQuery.data?.clients) ? clientsQuery.data.clients : []),
    [clientsQuery.data]
  );

  const filteredClients = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return clients;

    return clients.filter((client) => {
      const name = fullName(client).toLowerCase();
      const email = String(client?.email || "").toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [clients, query]);

  const total = clients.length;
  const effective = coach?.effectiveCapabilities || {};
  const activeClients = clients.filter((client) => String(client?.estado || "activo").toLowerCase() === "activo").length;
  const readOnlySimulation = isImpersonating();
  const pendingInvitations = Array.isArray(invitationsQuery.data?.invitations)
    ? invitationsQuery.data.invitations
    : [];
  const inviteAccess = useMemo(() => getInviteAccess(coach, readOnlySimulation), [coach, readOnlySimulation]);
  const canOpenInvite = inviteAccess.canInvite;

  const createInviteMutation = useMutation({
    mutationFn: createProfessionalClientInvitation,
    onSuccess: async () => {
      setToast({ type: "success", message: "Invitacion creada correctamente." });
      setInviteForm(structuredCloneSafe(EMPTY_INVITE_FORM));
      setInviteOpen(false);
      await invalidateProfessionalClientInvitations();
    },
    onError: (error) => {
      setToast({
        type: "error",
        message: error?.message || "No se pudo crear la invitacion.",
      });
    },
  });

  const cancelInviteMutation = useMutation({
    mutationFn: cancelProfessionalClientInvitation,
    onSuccess: async () => {
      setToast({ type: "success", message: "Invitacion cancelada." });
      await invalidateProfessionalClientInvitations();
    },
    onError: (error) => {
      setToast({
        type: "error",
        message: error?.message || "No se pudo cancelar la invitacion.",
      });
    },
  });

  const activateInviteMutation = useMutation({
    mutationFn: activateProfessionalClientInvitation,
    onSuccess: async () => {
      setToast({ type: "success", message: "Servicio activado correctamente." });
      await invalidateProfessionalClientInvitations();
      await clientsQuery.refetch();
    },
    onError: (error) => {
      setToast({
        type: "error",
        message: error?.message || "No se pudo activar el servicio.",
      });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: deleteProfessionalClientInvitation,
    onSuccess: async () => {
      setToast({ type: "success", message: "Invitacion eliminada." });
      await invalidateProfessionalClientInvitations();
    },
    onError: (error) => {
      setToast({
        type: "error",
        message: error?.message || "No se pudo eliminar la invitacion.",
      });
    },
  });

  function updateInviteField(field, value) {
    setInviteForm((prev) => ({ ...prev, [field]: value }));
  }

  function updatePermission(section, field, value) {
    setInviteForm((prev) => ({
      ...prev,
      clientPermissions: {
        ...prev.clientPermissions,
        [section]: {
          ...(prev.clientPermissions?.[section] || {}),
          [field]: value,
        },
      },
    }));
  }

  function openInviteDialog() {
    if (!inviteAccess.canInvite) {
      setToast({
        type: "warning",
        message: inviteAccess.reason || "No podes invitar clientes en este momento.",
      });
      return;
    }
    setInviteOpen(true);
  }

  function closeInviteDialog() {
    if (createInviteMutation.isPending) return;
    setInviteOpen(false);
  }

  function submitInvite(event) {
    event.preventDefault();

    if (!inviteAccess.canInvite) {
      setToast({
        type: "warning",
        message: inviteAccess.reason || "No podes invitar clientes en este momento.",
      });
      return;
    }

    const nombre = inviteForm.nombre.trim();
    const apellido = inviteForm.apellido.trim();
    const email = inviteForm.email.trim().toLowerCase();

    if (!nombre) {
      setToast({ type: "warning", message: "Ingresa el nombre." });
      return;
    }
    if (!apellido) {
      setToast({ type: "warning", message: "Ingresa el apellido." });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setToast({ type: "warning", message: "Ingresa un email valido." });
      return;
    }

    createInviteMutation.mutate({
      email,
      profile: { nombre, apellido },
      servicePackage: inviteForm.servicePackage || "service_pro",
      onboarding: inviteForm.onboarding,
      clientPermissions: inviteForm.clientPermissions,
    });
  }

  return (
    <div className="prof-page">
      <section className="prof-shell">
        <div className="prof-hero prof-heroClean">
          <div className="prof-titleRow">
            <div className="prof-kicker">👥 Clientes</div>
            <div className="prof-titleWithIcon">
              <Users size={22} strokeWidth={2.4} aria-hidden="true" />
              <h1 className="prof-title">Tus clientes</h1>
            </div>
            <p className="prof-sub">
              Vista profesional para seguir personas asignadas, objetivos, kcal y estado general.
            </p>
          </div>

          <div className="prof-actions">
            <button
              type="button"
              className="prof-btn gold prof-inviteBtn"
              onClick={openInviteDialog}
              disabled={!canOpenInvite}
              title={inviteAccess.reason || "Invitar cliente"}
            >
              <UserPlus size={17} strokeWidth={2.3} aria-hidden="true" />
              Invitar cliente
            </button>
            <button
              type="button"
              className="prof-iconBtn"
              onClick={() => clientsQuery.refetch()}
              disabled={clientsQuery.isFetching}
              title={clientsQuery.isFetching ? "Actualizando" : "Actualizar"}
              aria-label={clientsQuery.isFetching ? "Actualizando clientes" : "Actualizar clientes"}
            >
              <RefreshCw size={18} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="prof-grid">
          <Metric emoji="👤" label="Clientes" value={`${total}/${effective?.maxClients ?? "sin limite"}`} />
          <Metric emoji="✅" label="Activos" value={activeClients} />
          <Metric emoji="📦" label="Plan" value={planLabel(effective?.planCode || coach?.plan)} />
          <Metric emoji="🧭" label="Capacidad" value={capacityLabel(coach)} />
        </div>

        <div className="prof-toolbar">
          <div className="prof-searchWrap">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <input
              className="prof-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o email..."
            />
          </div>
        </div>

        {!canOpenInvite && inviteAccess.reason ? (
          <div className="prof-lock compact">{inviteAccess.reason}</div>
        ) : null}

        <ClientInvitationsPanel
          invitations={pendingInvitations}
          loading={invitationsQuery.isLoading}
          refreshing={invitationsQuery.isFetching && !invitationsQuery.isLoading}
          onCancel={(id) => cancelInviteMutation.mutate(id)}
          onActivate={(id) => activateInviteMutation.mutate(id)}
          onDelete={(id) => deleteInviteMutation.mutate(id)}
          readOnly={readOnlySimulation}
          busyId={
            cancelInviteMutation.variables ||
            activateInviteMutation.variables ||
            deleteInviteMutation.variables ||
            ""
          }
          isBusy={cancelInviteMutation.isPending || activateInviteMutation.isPending || deleteInviteMutation.isPending}
        />

        {refreshing ? <div className="prof-empty compact">Actualizando datos...</div> : null}
        {err ? <div className="prof-error">{err}</div> : null}

        {loading ? (
          <div className="prof-empty">Cargando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="prof-empty">
            {query ? "No hay clientes que coincidan con la busqueda." : "Todavia no tenes clientes asignados."}
          </div>
        ) : (
          <div className="prof-clientList">
            {filteredClients.map((client) => (
              <article className="prof-clientCard" key={client.id || client._id || client.email}>
                <div className="prof-clientTop">
                  <Avatar user={client} />
                  <div className="prof-clientInfo">
                    <div className="prof-clientName">{fullName(client)}</div>
                    <div className="prof-clientEmail">{client?.email || "Sin email"}</div>
                    <div className="prof-chipRow">
                      <span className="prof-chip info">🎯 {goalLabel(client?.goal?.type)}</span>
                      <span className="prof-chip">🔥 {fmtKcal(client?.metasActuales?.kcal)}</span>
                      <span className="prof-chip good">Estado: {client?.estado || "activo"}</span>
                      <span className="prof-chip">Asignado: {fmtDate(client?.coach?.assignedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="prof-cardActions">
                  <Link className="prof-btn compact gold" to={`/profesional/clientes/${client.id || client._id}`}>
                    <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
                    Ver detalle
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {inviteOpen ? (
        <InviteClientDialog
          form={inviteForm}
          access={inviteAccess}
          saving={createInviteMutation.isPending}
          onField={updateInviteField}
          onPermission={updatePermission}
          onSubmit={submitInvite}
          onClose={closeInviteDialog}
        />
      ) : null}
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function ClientInvitationsPanel({
  invitations,
  loading,
  refreshing,
  onCancel,
  onActivate,
  onDelete,
  readOnly,
  busyId,
  isBusy,
}) {
  if (loading) {
    return <div className="prof-empty compact">Cargando invitaciones...</div>;
  }

  if (!invitations.length) return null;

  return (
    <section className="prof-invitePanel">
      <div className="prof-invitePanelHead">
        <div>
          <div className="prof-sectionTitle compact">Invitaciones de clientes</div>
          <div className="prof-inviteMuted">
            {refreshing ? "Actualizando..." : `${invitations.length} invitacion(es)`}
          </div>
        </div>
      </div>

      <div className="prof-inviteList">
        {invitations.map((invite) => {
          const id = invite?._id || invite?.id;
          const full = `${invite?.profile?.nombre || ""} ${invite?.profile?.apellido || ""}`.trim() || "Sin nombre";
          const locked = isBusy && String(busyId || "") === String(id || "");
          const status = String(invite?.status || "pending");
          const canActivate = status === "accepted_pending_activation";

          return (
            <article className="prof-inviteCard" key={id || invite?.email}>
              <div className="prof-inviteMain">
                <strong>{full}</strong>
                <span>{invite?.email || "Sin email"}</span>
                <small>Invitada: {fmtDate(invite?.invitedAt || invite?.createdAt)}</small>
                {canActivate ? <small className="prof-positive">Aceptada: falta activar servicio</small> : null}
              </div>
              <div className="prof-inviteActions">
                {canActivate ? (
                  <button
                    type="button"
                    className="prof-chipButton"
                    disabled={locked || readOnly}
                    onClick={() => onActivate(id)}
                  >
                    Activar servicio
                  </button>
                ) : null}
                <button
                  type="button"
                  className="prof-iconBtn small"
                  title="Cancelar invitacion"
                  aria-label="Cancelar invitacion"
                  disabled={locked || readOnly}
                  onClick={() => onCancel(id)}
                >
                  <X size={15} strokeWidth={2.4} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="prof-iconBtn small danger"
                  title="Eliminar invitacion"
                  aria-label="Eliminar invitacion"
                  disabled={locked || readOnly}
                  onClick={() => onDelete(id)}
                >
                  <Trash2 size={15} strokeWidth={2.4} aria-hidden="true" />
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InviteClientDialog({
  form,
  access,
  saving,
  onField,
  onPermission,
  onSubmit,
  onClose,
}) {
  return (
    <div className="prof-modalBackdrop" role="presentation">
      <section className="prof-inviteModal" role="dialog" aria-modal="true" aria-label="Invitar cliente">
        <div className="prof-inviteModalHead">
          <div>
            <div className="prof-kicker">Clientes</div>
            <h2>Invitar cliente</h2>
          </div>
          <button type="button" className="prof-iconBtn" onClick={onClose} aria-label="Cerrar">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <form className="prof-inviteForm" onSubmit={onSubmit}>
          <div className="prof-formGrid two">
            <label className="prof-field">
              Nombre
              <input
                value={form.nombre}
                onChange={(event) => onField("nombre", event.target.value)}
                placeholder="Nombre"
              />
            </label>
            <label className="prof-field">
              Apellido
              <input
                value={form.apellido}
                onChange={(event) => onField("apellido", event.target.value)}
                placeholder="Apellido"
              />
            </label>
            <label className="prof-field prof-full">
              Email
              <input
                type="email"
                value={form.email}
                onChange={(event) => onField("email", event.target.value)}
                placeholder="cliente@email.com"
              />
            </label>
            <label className="prof-field prof-full">
              Paquete de servicio
              <select
                value={form.servicePackage || "service_pro"}
                onChange={(event) => onField("servicePackage", event.target.value)}
              >
                <option value="service_pro">Coach Pro</option>
                <option value="service_vip" disabled={!access.canOfferServiceVip}>
                  Coach VIP{access.canOfferServiceVip ? "" : " - requiere Coach IA"}
                </option>
              </select>
            </label>
          </div>

          <OnboardingInviteSection
            value={form.onboarding}
            onChange={(value) => onField("onboarding", value)}
          />

          <div className="prof-invitePermissionGrid">
            {access.menu.available ? (
              <PermissionSection title="Menu / nutricion">
                <PermissionToggle
                  label="Ver menu"
                  checked={form.clientPermissions.menu.canViewMenu}
                  onChange={(value) => onPermission("menu", "canViewMenu", value)}
                />
                <PermissionToggle
                  label="Editar preferencias"
                  checked={form.clientPermissions.menu.canEditPreferences}
                  onChange={(value) => onPermission("menu", "canEditPreferences", value)}
                />
                <PermissionToggle
                  label="Menu semiautomatico"
                  checked={form.clientPermissions.menu.canUseSemiAutomaticMenu}
                  disabled={!access.menu.semiAutomatic}
                  hint={!access.menu.semiAutomatic ? "Bloqueado por plan" : ""}
                  onChange={(value) => onPermission("menu", "canUseSemiAutomaticMenu", value)}
                />
                <PermissionToggle
                  label="Menu automatico"
                  checked={form.clientPermissions.menu.canUseAutomaticMenu}
                  disabled={!access.menu.automatic}
                  hint={!access.menu.automatic ? "Bloqueado por plan" : ""}
                  onChange={(value) => onPermission("menu", "canUseAutomaticMenu", value)}
                />
                <PermissionToggle
                  label="Pedir cambios"
                  checked={form.clientPermissions.menu.canRequestMenuChanges}
                  onChange={(value) => onPermission("menu", "canRequestMenuChanges", value)}
                />
              </PermissionSection>
            ) : null}

            {access.routine.available ? (
              <PermissionSection title="Rutinas / entrenamiento">
                <PermissionToggle
                  label="Ver rutina"
                  checked={form.clientPermissions.routine.canViewRoutine}
                  onChange={(value) => onPermission("routine", "canViewRoutine", value)}
                />
                <PermissionToggle
                  label="Registrar entrenamiento"
                  checked={form.clientPermissions.routine.canLogWorkout}
                  onChange={(value) => onPermission("routine", "canLogWorkout", value)}
                />
                <PermissionToggle
                  label="Editar pesos"
                  checked={form.clientPermissions.routine.canEditWeights}
                  onChange={(value) => onPermission("routine", "canEditWeights", value)}
                />
                <PermissionToggle
                  label="Rutina semiautomatica"
                  checked={form.clientPermissions.routine.canUseSemiAutomaticRoutine}
                  disabled={!access.routine.semiAutomatic}
                  hint={!access.routine.semiAutomatic ? "Bloqueado por plan" : ""}
                  onChange={(value) => onPermission("routine", "canUseSemiAutomaticRoutine", value)}
                />
                <PermissionToggle
                  label="Rutina automatica"
                  checked={form.clientPermissions.routine.canUseAutomaticRoutine}
                  disabled={!access.routine.automatic}
                  hint={!access.routine.automatic ? "Bloqueado por plan" : ""}
                  onChange={(value) => onPermission("routine", "canUseAutomaticRoutine", value)}
                />
                <PermissionToggle
                  label="Pedir cambios"
                  checked={form.clientPermissions.routine.canRequestRoutineChanges}
                  onChange={(value) => onPermission("routine", "canRequestRoutineChanges", value)}
                />
              </PermissionSection>
            ) : null}

            {access.progress.available ? (
              <PermissionSection title="Progreso">
                <PermissionToggle
                  label="Registrar peso"
                  checked={form.clientPermissions.progress.canLogWeight}
                  onChange={(value) => onPermission("progress", "canLogWeight", value)}
                />
                <PermissionToggle
                  label="Subir fotos"
                  checked={form.clientPermissions.progress.canUploadProgressPhotos}
                  onChange={(value) => onPermission("progress", "canUploadProgressPhotos", value)}
                />
                <PermissionToggle
                  label="Metricas avanzadas"
                  checked={form.clientPermissions.progress.canViewAdvancedMetrics}
                  disabled={!access.progress.advanced}
                  hint={!access.progress.advanced ? "Bloqueado por plan" : ""}
                  onChange={(value) => onPermission("progress", "canViewAdvancedMetrics", value)}
                />
              </PermissionSection>
            ) : null}
          </div>

          <div className="prof-inviteFooter">
            <button type="button" className="prof-btn" onClick={onClose} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="prof-btn gold" disabled={saving}>
              <Send size={16} strokeWidth={2.3} aria-hidden="true" />
              {saving ? "Enviando..." : "Crear invitacion"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function PermissionSection({ title, children }) {
  return (
    <section className="prof-permissionBox">
      <h3>{title}</h3>
      <div>{children}</div>
    </section>
  );
}

function OnboardingInviteSection({ value, onChange }) {
  const mode = value?.enabled === false ? "none" : "full";

  function choose(nextMode) {
    onChange({
      enabled: nextMode !== "none",
      mode: nextMode === "none" ? "none" : "full",
    });
  }

  return (
    <section className="prof-permissionBox prof-onboardingInvite">
      <div className="prof-permissionBoxHead">
        <div>
          <h3>Onboarding inicial</h3>
          <p>Definí si el cliente completa el recorrido inicial cuando acepta la invitación.</p>
        </div>
      </div>
      <div className="prof-onboardingOptions">
        <button
          type="button"
          className={mode === "full" ? "active" : ""}
          onClick={() => choose("full")}
        >
          <strong>Completo</strong>
          <span>Ve todo el onboarding y carga sus datos iniciales.</span>
        </button>
        <button
          type="button"
          className={mode === "none" ? "active" : ""}
          onClick={() => choose("none")}
        >
          <strong>No mostrar</strong>
          <span>Entra directo al panel del cliente.</span>
        </button>
      </div>
    </section>
  );
}

function PermissionToggle({ label, checked, disabled = false, hint = "", onChange }) {
  return (
    <label className={`prof-permissionToggle ${disabled ? "disabled" : ""}`}>
      <span>
        {label}
        {hint ? <small>{hint}</small> : null}
      </span>
      <input
        type="checkbox"
        checked={!!checked && !disabled}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

function hasAnyFeature(features = {}) {
  return Object.values(features || {}).some(Boolean);
}

function getInviteAccess(coach, readOnlySimulation = false) {
  const effective = coach?.effectiveCapabilities || {};
  const features = effective?.features || {};
  const specialties = coach?.coachProfile?.specialties || {};
  const trialExpired = !!effective?.isTrialExpired;
  const canAssign = effective?.features?.clients?.canAssign !== false;
  const canReceive = effective?.canReceiveClients !== false;
  const coachActive = String(coach?.estado || "activo").toLowerCase() === "activo";
  const canInviteFlag = coach?.coachCapabilities?.canInviteClients !== false;
  const hasSpecialty = !!specialties.training || !!specialties.nutrition;
  const subscriptionPlan = String(coach?.coachSubscription?.plan || coach?.subscription?.plan || coach?.plan || "")
    .trim()
    .toLowerCase();
  const canOfferServiceVip = ["coach_ai", "coach_vip", "vip", "premium2"].includes(subscriptionPlan);

  let reason = "";
  if (readOnlySimulation) reason = "Estas viendo el panel en modo simulacion de solo lectura.";
  else if (!coach) reason = "Cargando datos del coach.";
  else if (!coachActive) reason = "Tu cuenta profesional no esta activa.";
  else if (!canInviteFlag) reason = "Tu cuenta no tiene habilitada la invitacion de clientes.";
  else if (trialExpired) reason = "Tu prueba esta vencida.";
  else if (!canAssign) reason = "Tu plan no permite recibir clientes.";
  else if (!canReceive) reason = "Alcanzaste el limite de clientes de tu plan.";
  else if (!hasSpecialty) reason = "Tu perfil no tiene especialidades habilitadas.";

  const menuAvailable = !!specialties.nutrition && !trialExpired && hasAnyFeature(features.menus);
  const routineAvailable = !!specialties.training && !trialExpired && hasAnyFeature(features.routines);

  return {
    canInvite: !reason,
    reason,
    canOfferServiceVip,
    menu: {
      available: menuAvailable,
      automatic: menuAvailable && !!features?.menus?.automaticGenerator,
      semiAutomatic: menuAvailable && !!features?.menus?.semiAutomaticBuilder,
    },
    routine: {
      available: routineAvailable,
      automatic: routineAvailable && !!features?.routines?.automaticGenerator,
      semiAutomatic: routineAvailable && !!features?.routines?.semiAutomaticBuilder,
    },
    progress: {
      available: (menuAvailable || routineAvailable) && !trialExpired,
      advanced: !!features?.metrics?.advanced && !trialExpired,
    },
  };
}
