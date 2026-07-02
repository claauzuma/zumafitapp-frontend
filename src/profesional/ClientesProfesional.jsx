import React, { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Eye,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UserPlus,
  Users,
  X,
  Zap,
} from "lucide-react";
import { Avatar } from "./profesionalPieces.jsx";
import { useProfessionalClientInvitations, useProfessionalClients } from "./profesionalQueries.js";
import {
  activateProfessionalClientInvitation,
  cancelProfessionalClientInvitation,
  createProfessionalClientInvitation,
  deleteProfessionalClientInvitation,
  endProfessionalClientService,
} from "./profesionalApi.js";
import { isImpersonating } from "../authCache.js";
import { invalidateProfessionalClient, invalidateProfessionalClientInvitations } from "../queryClient.js";
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
  const [inviteShareLink, setInviteShareLink] = useState("");
  const [clientMenuOpenId, setClientMenuOpenId] = useState("");
  const [serviceEndClient, setServiceEndClient] = useState(null);
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

  const activeClientList = useMemo(
    () => clients.filter((client) => String(client?.estado || "activo").toLowerCase() === "activo"),
    [clients]
  );

  const filteredClients = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return activeClientList;

    return activeClientList.filter((client) => {
      const name = fullName(client).toLowerCase();
      const email = String(client?.email || "").toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [activeClientList, query]);

  const effective = coach?.effectiveCapabilities || {};
  const activeClients = activeClientList.length;
  const capacity = getCapacitySummary(coach, activeClients);
  const readOnlySimulation = isImpersonating();
  const invitations = Array.isArray(invitationsQuery.data?.invitations)
    ? invitationsQuery.data.invitations
    : [];
  const inviteAccess = useMemo(() => getInviteAccess(coach, readOnlySimulation), [coach, readOnlySimulation]);
  const canOpenInvite = inviteAccess.canInvite;

  const createInviteMutation = useMutation({
    mutationFn: createProfessionalClientInvitation,
    onSuccess: async (data) => {
      const code = String(data?.code || "");
      const nextShareLink = data?.inviteLink ? absoluteInviteLink(data.inviteLink) : "";
      const message = data?.alreadyExists
        ? code === "INVITATION_ALREADY_ACCEPTED"
          ? "El cliente ya acepto. Solo falta confirmar la activacion."
          : "Ya le enviaste una invitacion. Sigue pendiente."
        : data?.deliveryStatus === "manual_link"
          ? "Invitacion creada. Copia el enlace y compartilo con la persona."
          : "Invitacion enviada correctamente.";
      setToast({ type: data?.alreadyExists ? "warning" : "success", message });
      setInviteShareLink(nextShareLink);
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

  const endServiceMutation = useMutation({
    mutationFn: ({ clientId, reason, reasonNote }) => endProfessionalClientService(clientId, { reason, reasonNote }),
    onSuccess: async (data, variables) => {
      const clientId = variables?.clientId || data?.client?.id || data?.client?._id;
      setToast({ type: "success", message: "Servicio finalizado correctamente." });
      setServiceEndClient(null);
      setClientMenuOpenId("");
      await Promise.all([
        invalidateProfessionalClient(clientId, data?.client || null),
        invalidateProfessionalClientInvitations(),
        clientsQuery.refetch(),
      ]);
    },
    onError: (error) => {
      setToast({
        type: "error",
        message: error?.message || "No se pudo finalizar el servicio.",
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

  async function copyInviteShareLink() {
    if (!inviteShareLink) return;
    try {
      await navigator.clipboard.writeText(inviteShareLink);
      setToast({ type: "success", message: "Link de invitacion copiado." });
    } catch {
      setToast({ type: "warning", message: "No pude copiarlo automaticamente. Seleccionalo y copialo manualmente." });
    }
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

        <div className="prof-capacitySummary" aria-label="Resumen de capacidad">
          <SummaryCard label="Clientes activos" value={activeClients} helper={formatClientCount(activeClients)} />
          <SummaryCard label="Cupos disponibles" value={capacity.availableLabel} helper={capacity.usedLabel} />
          <SummaryCard label="Plan profesional" value={planLabel(effective?.planCode || coach?.plan)} helper={capacityLabel(coach)} />
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
          invitations={invitations}
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

        {inviteShareLink ? (
          <section className="prof-inviteShareBox">
            <div>
              <strong>Link de invitacion</strong>
              <span>Usalo si la persona todavia no esta registrada.</span>
              <code>{inviteShareLink}</code>
            </div>
            <div className="prof-inviteShareActions">
              <button type="button" className="prof-btn compact gold" onClick={copyInviteShareLink}>
                <Copy size={15} strokeWidth={2.3} aria-hidden="true" />
                Copiar link
              </button>
              <button type="button" className="prof-iconBtn small" onClick={() => setInviteShareLink("")} aria-label="Ocultar link">
                <X size={15} strokeWidth={2.4} aria-hidden="true" />
              </button>
            </div>
          </section>
        ) : null}

        {refreshing ? <div className="prof-empty compact">Actualizando datos...</div> : null}
        {err ? <div className="prof-error">{err}</div> : null}

        <section className="prof-activeClientsSection">
          <div className="prof-sectionHeaderRow">
            <div>
              <div className="prof-sectionTitle compact">Clientes activos</div>
              <p>{formatClientCount(filteredClients.length)}</p>
            </div>
          </div>

          {loading ? (
            <div className="prof-empty">Cargando clientes...</div>
          ) : filteredClients.length === 0 ? (
            <div className="prof-empty">
              {query ? "No hay clientes activos que coincidan con la busqueda." : "Todavia no tenes clientes activos."}
            </div>
          ) : (
            <div className="prof-clientList">
              {filteredClients.map((client) => {
                const clientId = client.id || client._id;
                const menuOpen = clientMenuOpenId === String(clientId || client.email || "");
                return (
                  <ActiveClientCard
                    key={clientId || client.email}
                    client={client}
                    menuOpen={menuOpen}
                    readOnly={readOnlySimulation}
                    ending={endServiceMutation.isPending && String(endServiceMutation.variables?.clientId || "") === String(clientId || "")}
                    onMenuToggle={(id) => setClientMenuOpenId((prev) => (prev === id ? "" : id))}
                    onEndService={(selectedClient) => {
                      setClientMenuOpenId("");
                      setServiceEndClient(selectedClient);
                    }}
                  />
                );
              })}
            </div>
          )}
        </section>
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
      {serviceEndClient ? (
        <EndClientServiceDialog
          client={serviceEndClient}
          saving={endServiceMutation.isPending}
          onClose={() => {
            if (!endServiceMutation.isPending) setServiceEndClient(null);
          }}
          onConfirm={(payload) => {
            const clientId = serviceEndClient?.id || serviceEndClient?._id;
            if (!clientId) return;
            endServiceMutation.mutate({ clientId, ...payload });
          }}
        />
      ) : null}
      <AppToast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

function SummaryCard({ label, value, helper }) {
  return (
    <article className="prof-summaryCard">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

function ActiveClientCard({ client, menuOpen, readOnly = false, ending = false, onMenuToggle, onEndService }) {
  const clientId = client.id || client._id;
  const menuId = String(clientId || client.email || "");
  const detailPath = `/profesional/clientes/${clientId}`;

  return (
    <article className="prof-clientCard active">
      <div className="prof-clientTop">
        <Avatar user={client} />
        <div className="prof-clientInfo">
          <div className="prof-clientNameRow">
            <div>
              <div className="prof-clientName">{fullName(client)}</div>
              <div className="prof-clientEmail">{client?.email || "Sin email"}</div>
            </div>
            <span className="prof-clientStatusBadge">Activo</span>
          </div>
        </div>
      </div>

      <div className="prof-clientFacts">
        <ClientFact label="Objetivo" value={goalLabel(client?.goal?.type)} />
        <ClientFact label="Meta diaria" value={fmtKcal(client?.metasActuales?.kcal)} />
        <ClientFact label="Asignado desde" value={fmtDate(client?.coach?.assignedAt)} />
      </div>

      <div className="prof-cardActions">
        <Link className="prof-btn compact gold" to={detailPath}>
          <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
          Ver cliente
        </Link>
        <div className="prof-clientMenuWrap">
          <button
            type="button"
            className="prof-iconBtn small"
            aria-label="Mas acciones del cliente"
            aria-expanded={menuOpen}
            onClick={() => onMenuToggle(menuId)}
          >
            <MoreVertical size={15} strokeWidth={2.5} aria-hidden="true" />
          </button>
          {menuOpen ? (
            <div className="prof-clientMenu" role="menu">
              <Link role="menuitem" to={detailPath}>
                <Eye size={14} strokeWidth={2.3} aria-hidden="true" />
                Ver perfil
              </Link>
              <Link role="menuitem" to={detailPath}>
                <Users size={14} strokeWidth={2.3} aria-hidden="true" />
                Gestionar servicio
              </Link>
              <button
                type="button"
                role="menuitem"
                className="danger"
                disabled={readOnly || ending}
                onClick={() => onEndService?.(client)}
              >
                <AlertTriangle size={14} strokeWidth={2.4} aria-hidden="true" />
                {ending ? "Finalizando..." : "Finalizar servicio"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ClientFact({ label, value }) {
  return (
    <div className="prof-clientFact">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

const END_SERVICE_REASONS = [
  { value: "accompaniment_finished", label: "Fin del acompanamiento" },
  { value: "client_decision", label: "Decision del cliente" },
  { value: "professional_change", label: "Cambio de profesional" },
  { value: "inactive_client", label: "Falta de actividad" },
  { value: "other", label: "Otro" },
];

function EndClientServiceDialog({ client, saving, onClose, onConfirm }) {
  const [reason, setReason] = useState(END_SERVICE_REASONS[0].value);
  const [reasonNote, setReasonNote] = useState("");
  const name = fullName(client);

  function submit(event) {
    event.preventDefault();
    if (saving) return;
    onConfirm({ reason, reasonNote: reasonNote.trim() });
  }

  return (
    <div className="prof-modalBackdrop" role="dialog" aria-modal="true" aria-label={`Finalizar servicio con ${name}`}>
      <form className="prof-serviceEndDialog" onSubmit={submit}>
        <header className="prof-serviceEndHeader">
          <span className="prof-serviceEndIcon">
            <AlertTriangle size={22} strokeWidth={2.4} aria-hidden="true" />
          </span>
          <div>
            <span>Accion segura</span>
            <h3>Finalizar servicio con {name}</h3>
            <p>El cliente volvera a su modalidad autogestionada.</p>
          </div>
          <button type="button" className="prof-iconBtn small" onClick={onClose} disabled={saving} aria-label="Cerrar">
            <X size={16} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </header>

        <section className="prof-serviceEndBody">
          <p className="prof-serviceEndLead">
            El cliente dejara de estar bajo tu gestion profesional. No se borra su cuenta ni su informacion personal.
          </p>

          <div className="prof-serviceEndGrid">
            <div className="prof-serviceEndPanel keep">
              <strong>Se conservara</strong>
              <ul>
                <li>Su cuenta</li>
                <li>Tracking e historial</li>
                <li>Peso, medidas y fotos</li>
                <li>Menus y rutinas creados por el</li>
                <li>Comidas guardadas y favoritos</li>
              </ul>
            </div>
            <div className="prof-serviceEndPanel stop">
              <strong>Dejara de estar activo</strong>
              <ul>
                <li>Menu asignado por el coach</li>
                <li>Rutina asignada por el coach</li>
                <li>Objetivos gestionados por el coach</li>
              </ul>
            </div>
          </div>

          <label className="prof-serviceEndField">
            <span>Motivo de finalizacion</span>
            <select value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving}>
              {END_SERVICE_REASONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="prof-serviceEndField">
            <span>Nota opcional</span>
            <textarea
              value={reasonNote}
              onChange={(event) => setReasonNote(event.target.value)}
              maxLength={500}
              rows={3}
              disabled={saving}
              placeholder="Contexto interno para auditoria del servicio..."
            />
          </label>
        </section>

        <footer className="prof-serviceEndActions">
          <button type="button" className="prof-btn compact" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button type="submit" className="prof-btn compact dangerSoft" disabled={saving}>
            <AlertTriangle size={15} strokeWidth={2.4} aria-hidden="true" />
            {saving ? "Finalizando..." : "Finalizar servicio"}
          </button>
        </footer>
      </form>
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
  const [detailsInvite, setDetailsInvite] = useState(null);
  const [openMenuId, setOpenMenuId] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const groupedInvitations = useMemo(() => groupClientInvitations(invitations), [invitations]);
  const readyCount = groupedInvitations.ready.length;
  const actionableCount = groupedInvitations.ready.length + groupedInvitations.pending.length;
  const historyCount = groupedInvitations.historical.length;

  if (loading) {
    return <div className="prof-empty compact">Cargando invitaciones...</div>;
  }

  if (!invitations.length) return null;

  return (
    <section className="prof-invitePanel">
      <div className="prof-invitePanelHead">
        <div>
	          <div className="prof-sectionTitle compact">Acciones pendientes</div>
	          <div className="prof-inviteMuted">
	            {refreshing
	              ? "Actualizando..."
	              : actionableCount
                ? `${formatReadyCount(readyCount)}${readyCount ? " · " : ""}${formatInvitationCount(actionableCount)} accionables`
                : "No tenes acciones pendientes."}
	          </div>
	        </div>
	      </div>

	      <div className="prof-inviteSections">
        <InvitationSection
          title="Listas para activar"
          invitations={groupedInvitations.ready}
          empty={false}
          render={(invite) => (
            <CoachInvitationCard
              invite={invite}
              readOnly={readOnly}
              locked={isBusy && String(busyId || "") === String(invite?._id || invite?.id || "")}
              menuOpen={openMenuId === String(invite?._id || invite?.id || invite?.email || "")}
              onMenuToggle={(id) => setOpenMenuId((prev) => (prev === id ? "" : id))}
              onDetails={() => {
                setDetailsInvite(invite);
                setOpenMenuId("");
              }}
              onActivate={onActivate}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          )}
        />
        <InvitationSection
          title="Pendientes de respuesta"
          invitations={groupedInvitations.pending}
          render={(invite) => (
            <CoachInvitationCard
              invite={invite}
              readOnly={readOnly}
              locked={isBusy && String(busyId || "") === String(invite?._id || invite?.id || "")}
              menuOpen={openMenuId === String(invite?._id || invite?.id || invite?.email || "")}
              onMenuToggle={(id) => setOpenMenuId((prev) => (prev === id ? "" : id))}
              onDetails={() => {
                setDetailsInvite(invite);
                setOpenMenuId("");
              }}
              onActivate={onActivate}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          )}
        />
          {!actionableCount ? (
            <div className="prof-inviteNoPending">No hay invitaciones esperando respuesta o activacion.</div>
          ) : null}
	      </div>

      {historyCount ? (
        <div className="prof-inviteHistory">
          <button type="button" onClick={() => setHistoryOpen((prev) => !prev)} aria-expanded={historyOpen}>
            {historyOpen ? "Ocultar historial de invitaciones" : "Ver historial de invitaciones"}
            <span>{formatInvitationCount(historyCount)}</span>
          </button>
          {historyOpen ? (
            <InvitationSection
              title="Historial"
              invitations={groupedInvitations.historical}
              render={(invite) => (
                <CoachInvitationCard
                  invite={invite}
                  readOnly={readOnly}
                  locked={isBusy && String(busyId || "") === String(invite?._id || invite?.id || "")}
                  menuOpen={openMenuId === String(invite?._id || invite?.id || invite?.email || "")}
                  onMenuToggle={(id) => setOpenMenuId((prev) => (prev === id ? "" : id))}
                  onDetails={() => {
                    setDetailsInvite(invite);
                    setOpenMenuId("");
                  }}
                  onActivate={onActivate}
                  onCancel={onCancel}
                  onDelete={onDelete}
                />
              )}
            />
          ) : null}
        </div>
      ) : null}

      {detailsInvite ? (
        <InvitationDetailsModal invite={detailsInvite} onClose={() => setDetailsInvite(null)} />
      ) : null}
    </section>
  );
}

function InvitationSection({ title, invitations, render, empty = true }) {
  if (!invitations.length && !empty) return null;

  if (!invitations.length) return null;

  return (
    <section className="prof-inviteSection" aria-label={title}>
      <div className="prof-inviteSectionTitle">{title}</div>
      <div className="prof-inviteList">
        {invitations.map((invite) => (
          <React.Fragment key={invite?._id || invite?.id || invite?.email}>
            {render(invite)}
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function CoachInvitationCard({
  invite,
  readOnly,
  locked,
  menuOpen,
  onMenuToggle,
  onDetails,
  onActivate,
  onCancel,
  onDelete,
}) {
  const id = invite?._id || invite?.id;
  const menuId = String(id || invite?.email || "");
  const full = `${invite?.profile?.nombre || ""} ${invite?.profile?.apellido || ""}`.trim() || "Sin nombre";
  const status = String(invite?.status || "pending");
  const canActivate = status === "accepted_pending_activation";
  const canCancel = status === "pending";
  const canDelete = ["declined", "cancelled", "expired"].includes(status);
  const statusMeta = getInvitationStatusMeta(status);

  function cancelInvite() {
    if (readOnly || locked) return;
    const ok = window.confirm("Cancelar esta invitacion? El cliente ya no podra usar este acceso.");
    if (ok) onCancel(id);
  }

  function deleteInvite() {
    if (readOnly || locked) return;
    const ok = window.confirm("Eliminar esta invitacion del listado? No se modifican clientes activos.");
    if (ok) onDelete(id);
  }

  return (
    <article className={`prof-inviteCard status-${statusMeta.variant} ${canActivate ? "is-ready" : ""}`} key={id || invite?.email}>
      <div className="prof-inviteMain">
        <div className="prof-inviteBadgeRow">
          <span className={`prof-inviteStatusBadge ${statusMeta.variant}`}>
            {canActivate ? <span className="prof-invitePulse" aria-hidden="true" /> : null}
            {canActivate ? <CheckCircle2 size={14} strokeWidth={2.5} aria-hidden="true" /> : null}
            {statusMeta.badge}
          </span>
          <small>Invitada: {fmtDate(invite?.invitedAt || invite?.createdAt)}</small>
        </div>
        <strong className="prof-inviteName">{full}</strong>
        <span>{invite?.email || "Sin email"}</span>
        <div className="prof-inviteState" role={canActivate ? "status" : undefined}>
          <strong>{statusMeta.headline}</strong>
          <p>{statusMeta.copy}</p>
        </div>
        {invite?.expiresAt && canCancel ? <small>Vence: {fmtDate(invite.expiresAt)}</small> : null}
      </div>
      <div className="prof-inviteActions">
        {canActivate ? (
          <button
            type="button"
            className="prof-invitePrimaryAction"
            disabled={locked || readOnly}
            onClick={() => onActivate(id)}
          >
            <Zap size={16} strokeWidth={2.5} aria-hidden="true" />
            {locked ? "Activando..." : "Activar servicio"}
          </button>
        ) : null}
        <button type="button" className="prof-inviteSecondaryAction" onClick={onDetails}>
          <Eye size={15} strokeWidth={2.3} aria-hidden="true" />
          Ver detalles
        </button>
        {canCancel || canDelete ? (
          <div className="prof-inviteMenuWrap">
            <button
              type="button"
              className="prof-iconBtn small"
              aria-label="Mas acciones de invitacion"
              aria-expanded={menuOpen}
              onClick={() => onMenuToggle(menuId)}
            >
              <MoreVertical size={15} strokeWidth={2.5} aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="prof-inviteMenu" role="menu">
                <button type="button" role="menuitem" onClick={onDetails}>
                  <Eye size={14} strokeWidth={2.3} aria-hidden="true" />
                  Ver invitacion
                </button>
                {canCancel ? (
                  <button type="button" role="menuitem" onClick={cancelInvite} disabled={locked || readOnly}>
                    <X size={14} strokeWidth={2.5} aria-hidden="true" />
                    Cancelar invitacion
                  </button>
                ) : null}
                {canDelete ? (
                  <button type="button" role="menuitem" className="danger" onClick={deleteInvite} disabled={locked || readOnly}>
                    <Trash2 size={14} strokeWidth={2.5} aria-hidden="true" />
                    Eliminar del listado
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function InvitationDetailsModal({ invite, onClose }) {
  const status = String(invite?.status || "pending");
  const statusMeta = getInvitationStatusMeta(status);
  const full = `${invite?.profile?.nombre || ""} ${invite?.profile?.apellido || ""}`.trim() || "Sin nombre";
  const permissions = invite?.clientPermissions || {};

  return (
    <div className="prof-modalBackdrop" role="presentation">
      <section className="prof-inviteDetailsModal" role="dialog" aria-modal="true" aria-label="Detalle de invitacion">
        <div className="prof-inviteModalHead">
          <div>
            <div className={`prof-inviteStatusBadge ${statusMeta.variant}`}>{statusMeta.badge}</div>
            <h2>Detalle de invitacion</h2>
          </div>
          <button type="button" className="prof-iconBtn" onClick={onClose} aria-label="Cerrar detalle">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>
        <div className="prof-inviteDetailsGrid">
          <DetailLine label="Cliente" value={full} />
          <DetailLine label="Email" value={invite?.email || "Sin email"} />
          <DetailLine label="Estado" value={statusMeta.headline} />
          <DetailLine label="Servicio" value={invite?.servicePackage || "No especificado"} />
          <DetailLine label="Invitada" value={fmtDate(invite?.invitedAt || invite?.createdAt)} />
          <DetailLine label="Aceptada" value={fmtDate(invite?.acceptedAt || invite?.acceptedAtClient || "")} />
          <DetailLine label="Activada" value={fmtDate(invite?.activatedAt || invite?.activation?.activatedAt || "")} />
          <DetailLine label="Vence" value={fmtDate(invite?.expiresAt)} />
          <DetailLine label="Mensaje" value={invite?.message || "Sin mensaje"} wide />
        </div>
        <div className="prof-inviteDetailsScopes">
          <strong>Permisos incluidos</strong>
          <div>
            <span>Menu: {summarizePermissions(permissions.menu)}</span>
            <span>Rutina: {summarizePermissions(permissions.routine)}</span>
            <span>Progreso: {summarizePermissions(permissions.progress)}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function DetailLine({ label, value, wide = false }) {
  return (
    <div className={`prof-inviteDetailLine ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      <strong>{value || "No disponible"}</strong>
    </div>
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

function groupClientInvitations(invitations = []) {
  const sorted = [...invitations].sort((a, b) => {
    const rank = (invite) => {
      const status = String(invite?.status || "pending");
      if (status === "accepted_pending_activation") return 0;
      if (status === "pending") return 1;
      if (status === "active") return 2;
      return 3;
    };
    const dateValue = (invite) => new Date(invite?.acceptedAt || invite?.updatedAt || invite?.createdAt || 0).getTime();
    return rank(a) - rank(b) || dateValue(b) - dateValue(a);
  });

  return {
    ready: sorted.filter((invite) => String(invite?.status || "") === "accepted_pending_activation"),
    pending: sorted.filter((invite) => String(invite?.status || "pending") === "pending"),
    historical: sorted.filter((invite) => {
      const status = String(invite?.status || "pending");
      return status !== "accepted_pending_activation" && status !== "pending";
    }),
  };
}

function getInvitationStatusMeta(status) {
  switch (String(status || "pending")) {
    case "accepted_pending_activation":
      return {
        badge: "Cliente acepto",
        headline: "Pendiente de tu confirmacion",
        copy: "El cliente ya confirmo la invitacion. Solo falta activar el servicio para comenzar el seguimiento.",
        variant: "ready",
      };
    case "active":
      return {
        badge: "Servicio activo",
        headline: "Relacion activa",
        copy: "El servicio ya esta activo para este cliente.",
        variant: "active",
      };
    case "declined":
    case "rejected":
      return {
        badge: "Invitacion rechazada",
        headline: "El cliente rechazo la invitacion",
        copy: "La invitacion queda como historial. Podes revisar el detalle.",
        variant: "rejected",
      };
    case "cancelled":
      return {
        badge: "Cancelada",
        headline: "Invitacion cancelada",
        copy: "Esta invitacion fue cancelada y ya no puede aceptarse.",
        variant: "muted",
      };
    case "expired":
      return {
        badge: "Vencida",
        headline: "Invitacion vencida",
        copy: "El plazo de aceptacion finalizo.",
        variant: "expired",
      };
    case "pending":
    default:
      return {
        badge: "Pendiente",
        headline: "Pendiente de respuesta",
        copy: "El cliente todavia no acepto la invitacion.",
        variant: "pending",
      };
  }
}

function formatInvitationCount(count) {
  return `${count} ${count === 1 ? "invitacion" : "invitaciones"}`;
}

function formatClientCount(count) {
  return `${count} ${count === 1 ? "cliente" : "clientes"}`;
}

function formatReadyCount(count) {
  if (!count) return "";
  return `${count} ${count === 1 ? "lista" : "listas"} para activar`;
}

function getCapacitySummary(coach, activeClients) {
  const effective = coach?.effectiveCapabilities || {};
  const maxRaw = effective?.maxClients ?? coach?.coachStats?.maxClients ?? null;
  const max = Number(maxRaw);

  if (!Number.isFinite(max) || max <= 0) {
    return {
      availableLabel: "Sin limite",
      usedLabel: `${activeClients} usados`,
    };
  }

  const available = Math.max(max - activeClients, 0);
  return {
    availableLabel: `${available} de ${max}`,
    usedLabel: `${activeClients} usados de ${max}`,
  };
}

function summarizePermissions(section = {}) {
  const enabled = Object.entries(section || {}).filter(([, value]) => !!value).length;
  if (!enabled) return "Sin permisos activos";
  return `${enabled} ${enabled === 1 ? "permiso" : "permisos"} activos`;
}

function absoluteInviteLink(path) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}${raw.startsWith("/") ? raw : `/${raw}`}`;
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
