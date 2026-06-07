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

  return (
    <div className="pci-backdrop" role="presentation">
      <section className="pci-modal" role="dialog" aria-modal="true" aria-labelledby="pci-title">
        <button type="button" className="pci-close" onClick={onSnooze} aria-label="Cerrar invitacion">
          <X size={18} />
        </button>

        <div className="pci-heroIcon">
          <UserRound size={24} strokeWidth={2.4} />
        </div>

        <span className="pci-eyebrow">Invitacion profesional</span>
        <h2 id="pci-title">Tenes una invitacion de coach</h2>
        <p className="pci-lead">
          <strong>{selected.coachName || "Tu coach"}</strong> te invito a formar parte de su seguimiento en ZumaFit.
        </p>
        <p className="pci-copy">
          Si aceptas, este coach podra ayudarte con tu planificacion, menus, rutina y progreso.
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
                <small>{invite.coachEmail || "Invitacion pendiente"}</small>
              </button>
            ))}
          </div>
        ) : null}

        <div className="pci-benefits">
          <div><Utensils size={16} /><span>Menus y nutricion</span></div>
          <div><Dumbbell size={16} /><span>Rutina y entrenamiento</span></div>
          <div><ShieldCheck size={16} /><span>Seguimiento de progreso</span></div>
        </div>

        {error ? <div className="pci-error">{error}</div> : null}

        <div className="pci-actions">
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

  return (
    <section className="pci-banner">
      <div>
        <span className="pci-bannerLabel">Invitacion pendiente</span>
        <strong>{invitation.coachName || "Tu coach"} quiere acompañarte en ZumaFit.</strong>
      </div>
      <div className="pci-bannerActions">
        <button type="button" className="pci-btn gold compact" disabled={!!busy} onClick={() => onAccept(invitation)}>
          {busy === "accept" ? "Aceptando..." : "Aceptar"}
        </button>
        <button type="button" className="pci-btn compact" disabled={!!busy} onClick={() => onDecline(invitation)}>
          Rechazar
        </button>
      </div>
    </section>
  );
}
