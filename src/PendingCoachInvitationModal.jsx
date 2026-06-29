import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  Clock3,
  Dumbbell,
  ShieldCheck,
  UserRound,
  Utensils,
  X,
} from "lucide-react";
import "./clientInvitations.css";

function normalizeScopes(invitation = {}) {
  return Array.isArray(invitation.serviceScopes) && invitation.serviceScopes.length
    ? invitation.serviceScopes
    : ["training", "nutrition"];
}

function serviceLabel(invitation = {}) {
  return invitation.serviceLabel || (invitation.servicePackage === "service_vip" ? "Coach VIP" : "Coach Pro");
}

export default function PendingCoachInvitationModal({
  invitations = [],
  busy = "",
  error = "",
  onAccept,
  onDecline,
  onSnooze,
}) {
  const [selectedId, setSelectedId] = useState(() => invitations[0]?.id || "");
  const selected = useMemo(
    () => invitations.find((item) => item.id === selectedId) || invitations[0] || null,
    [invitations, selectedId]
  );

  if (!selected) return null;

  const waitingActivation = selected.status === "accepted_pending_activation";
  const scopes = normalizeScopes(selected);

  return (
    <div className="pci-backdrop" role="presentation">
      <section className="pci-modal" role="dialog" aria-modal="true" aria-labelledby="pci-title">
        <button type="button" className="pci-close" onClick={onSnooze} aria-label="Cerrar invitacion">
          <X size={18} />
        </button>

        <div className="pci-heroIcon">
          <UserRound size={24} strokeWidth={2.4} />
        </div>

        <span className="pci-eyebrow">{serviceLabel(selected)}</span>
        <h2 id="pci-title">{waitingActivation ? "Invitacion aceptada" : "Tenes una invitacion de coach"}</h2>
        <p className="pci-lead">
          <strong>{selected.coachName || "Tu coach"}</strong> te invito a formar parte de su seguimiento en ZumaFit.
        </p>
        <p className="pci-copy">
          {waitingActivation
            ? "Tu aceptacion quedo registrada. El servicio todavia no esta activo: falta que el profesional confirme el inicio."
            : "Si aceptas, este coach podra ayudarte con tu planificacion, menus, rutina y progreso. El pago se acuerda fuera de ZumaFit."}
        </p>

        {invitations.length > 1 ? (
          <div className="pci-coachList" aria-label="Invitaciones disponibles">
            {invitations.map((invite) => (
              <button
                type="button"
                key={invite.id}
                className={invite.id === selected.id ? "active" : ""}
                onClick={() => setSelectedId(invite.id)}
              >
                <span>{invite.coachName || "Coach"}</span>
                <small>{invite.status === "accepted_pending_activation" ? "Esperando activacion" : invite.coachEmail || "Invitacion pendiente"}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="pci-benefits">
          <div><Utensils size={16} /><span>{scopes.includes("nutrition") ? "Menus y nutricion" : "Nutricion no incluida"}</span></div>
          <div><Dumbbell size={16} /><span>{scopes.includes("training") ? "Rutina y entrenamiento" : "Entrenamiento no incluido"}</span></div>
          <div><ShieldCheck size={16} /><span>Seguimiento de progreso</span></div>
        </div>

        {selected.price?.amount ? (
          <p className="pci-copy">
            Valor informado: <strong>{selected.price.currency || "ARS"} {selected.price.amount}</strong> / {selected.price.interval || "mes"}.
          </p>
        ) : null}

        {error ? <div className="pci-error">{error}</div> : null}

        <div className="pci-actions">
          {waitingActivation ? (
            <div className="pci-waiting">
              <Clock3 size={17} />
              <span>Esperando activacion del profesional</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="pci-btn gold"
                disabled={!!busy}
                onClick={() => onAccept(selected)}
              >
                <CheckCircle2 size={17} />
                {busy === "accept" ? "Aceptando..." : "Aceptar invitacion"}
              </button>
              <button
                type="button"
                className="pci-btn"
                disabled={!!busy}
                onClick={() => onDecline(selected)}
              >
                {busy === "decline" ? "Rechazando..." : "Rechazar"}
              </button>
            </>
          )}
          <button type="button" className="pci-btn subtle" disabled={!!busy} onClick={onSnooze}>
            <Clock3 size={16} />
            Decidir despues
          </button>
        </div>
      </section>
    </div>
  );
}

export function ClientInvitationBanner({ invitation, busy = "", onAccept, onDecline }) {
  if (!invitation) return null;
  const waitingActivation = invitation.status === "accepted_pending_activation";

  return (
    <section className="pci-banner">
      <div>
        <span className="pci-bannerLabel">{waitingActivation ? "Esperando activacion" : "Invitacion pendiente"}</span>
        <strong>
          {waitingActivation
            ? `${invitation.coachName || "Tu coach"} debe confirmar el inicio del servicio.`
            : `${invitation.coachName || "Tu coach"} quiere acompanarte en ZumaFit.`}
        </strong>
      </div>
      <div className="pci-bannerActions">
        {waitingActivation ? null : (
          <>
            <button type="button" className="pci-btn gold compact" disabled={!!busy} onClick={() => onAccept(invitation)}>
              {busy === "accept" ? "Aceptando..." : "Aceptar"}
            </button>
            <button type="button" className="pci-btn compact" disabled={!!busy} onClick={() => onDecline(invitation)}>
              Rechazar
            </button>
          </>
        )}
      </div>
    </section>
  );
}
