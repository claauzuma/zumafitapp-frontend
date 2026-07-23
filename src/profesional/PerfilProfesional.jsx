import React from "react";
import {
  Activity,
  CalendarDays,
  Clock3,
  Dumbbell,
  IdCard,
  Package,
  RefreshCw,
  ShieldCheck,
  Upload,
  UserCircle,
  Users,
  Utensils,
} from "lucide-react";
import { useProfessionalMe } from "../authQueries.js";
import { coachTrialState } from "../professionalPlans.js";
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
  const trial = coachTrialState(me);

  return (
    <div className="prof-page">
      <section className="prof-shell">
        <div className="prof-hero">
          <div>
            <div className="prof-kicker">
              <UserCircle size={15} strokeWidth={2.3} aria-hidden="true" />
              Perfil profesional
            </div>
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
          <Metric icon={Users} label="Clientes" value={capacityLabel(me)} />
          <Metric icon={Package} label="Plan" value={effective?.planName || planLabel(me?.plan)} />
          <Metric icon={Clock3} label="Prueba vence" value={trial.isTrial ? fmtDate(trial.endsAt) : "-"} />
          <Metric
            icon={ShieldCheck}
            label="Beneficio de prueba"
            value={trial.isTrial ? (trial.expired ? "Vencida" : "Activa") : "No aplica"}
          />
        </div>

        <div className="prof-section">
          <h3 className="prof-sectionTitle">Permisos y módulos</h3>
          <div className="prof-permissionGrid">
            <Metric icon={Dumbbell} label="Rutinas" value={featureStatus(features?.routines)} />
            <Metric icon={Utensils} label="Menús" value={featureStatus(features?.menus)} />
            <Metric icon={Activity} label="Métricas avanzadas" value={features?.metrics?.advanced ? "Habilitadas" : "No habilitadas"} />
            <Metric icon={Upload} label="Exportaciones" value={features?.exports?.enabled ? "Habilitadas" : "No habilitadas"} />
          </div>
        </div>

        <div className="prof-section">
          <h3 className="prof-sectionTitle">Cuenta</h3>
          <div className="prof-grid three">
            <Metric icon={CalendarDays} label="Alta" value={fmtDate(me?.createdAt)} />
            <Metric icon={Clock3} label="Último login" value={fmtDate(me?.lastLoginAt || me?.lastActivityAt)} />
            <Metric icon={IdCard} label="ID" value={me?.id || me?._id || "-"} />
          </div>
        </div>
      </section>
    </div>
  );
}

function featureStatus(group = {}) {
  const enabled = Object.values(group || {}).filter(Boolean).length;
  if (enabled <= 0) return "No disponible";
  return `${enabled} función${enabled === 1 ? "" : "es"}`;
}
