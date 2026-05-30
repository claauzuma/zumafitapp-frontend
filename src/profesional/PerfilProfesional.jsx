import React from "react";
import { RefreshCw } from "lucide-react";
import { useProfessionalMe } from "../authQueries.js";
import { Avatar, Metric } from "./profesionalPieces.jsx";
import {
  capacityLabel,
  fmtDate,
  fullName,
  planLabel,
  specialtyLabel,
} from "./profesionalFormat.js";
import "./profesionalPanel.css";

export default function PerfilProfesional() {
  const meQuery = useProfessionalMe();
  const me = meQuery.data || null;
  const loading = meQuery.isFetching;
  const err = meQuery.error?.message || "";

  const effective = me?.effectiveCapabilities || {};
  const features = effective?.features || {};

  return (
    <div className="prof-page">
      <section className="prof-shell">
        <div className="prof-hero">
          <div>
            <div className="prof-kicker">🧑‍🏫 Perfil profesional</div>
            <h1 className="prof-title">Tu perfil de coach</h1>
            <p className="prof-sub">
              Datos de cuenta, especialidad, plan y capacidades activas dentro de ZumaFit.
            </p>
          </div>

          <div className="prof-actions">
            <button type="button" className="prof-btn" onClick={() => meQuery.refetch()} disabled={loading}>
              <RefreshCw size={17} strokeWidth={2.2} aria-hidden="true" />
              {loading ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </div>

        <div className="prof-profileHead">
          <Avatar user={me} size="large" />
          <div>
            <h2 className="prof-profileName">{fullName(me)}</h2>
            <div className="prof-profileEmail">{me?.email || "Sin email"}</div>
            <div className="prof-chipRow">
              <span className="prof-chip info">{specialtyLabel(me)}</span>
              <span className="prof-chip">{planLabel(effective?.planCode || me?.plan)}</span>
              <span className="prof-chip good">{me?.estado || "activo"}</span>
            </div>
          </div>
        </div>

        {err ? <div className="prof-error">{err}</div> : null}

        <div className="prof-grid">
          <Metric emoji="👥" label="Clientes" value={capacityLabel(me)} />
          <Metric emoji="📦" label="Plan" value={effective?.planName || planLabel(me?.plan)} />
          <Metric emoji="⏳" label="Prueba vence" value={fmtDate(effective?.trialEndsAt)} />
          <Metric emoji="🛡️" label="Estado prueba" value={effective?.isTrialExpired ? "Vencida" : "Activa"} />
        </div>

        <div className="prof-section">
          <h3 className="prof-sectionTitle">Permisos y modulos</h3>
          <div className="prof-permissionGrid">
            <Metric emoji="🏋️" label="Rutinas" value={featureStatus(features?.routines)} />
            <Metric emoji="🥗" label="Menus" value={featureStatus(features?.menus)} />
            <Metric emoji="📈" label="Metricas avanzadas" value={features?.metrics?.advanced ? "Habilitadas" : "No habilitadas"} />
            <Metric emoji="📤" label="Exportaciones" value={features?.exports?.enabled ? "Habilitadas" : "No habilitadas"} />
          </div>
        </div>

        <div className="prof-section">
          <h3 className="prof-sectionTitle">Cuenta</h3>
          <div className="prof-grid three">
            <Metric emoji="📅" label="Alta" value={fmtDate(me?.createdAt)} />
            <Metric emoji="🕒" label="Ultimo login" value={fmtDate(me?.lastLoginAt || me?.lastActivityAt)} />
            <Metric emoji="🆔" label="ID" value={me?.id || me?._id || "-"} />
          </div>
        </div>
      </section>
    </div>
  );
}

function featureStatus(group = {}) {
  const enabled = Object.values(group || {}).filter(Boolean).length;
  if (enabled <= 0) return "No disponible";
  return `${enabled} funcion${enabled === 1 ? "" : "es"}`;
}
