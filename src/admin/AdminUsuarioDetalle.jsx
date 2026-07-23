import React from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useAdminUser } from "./adminUsuariosQueries.js";
import AdminUsuarioClienteDetalle from "./AdminUsuarioClienteDetalle.jsx";
import AdminUsuarioCoachDetalle from "./AdminUsuarioCoachDetalle.jsx";
import { setAdminUserQueryData } from "../queryClient.js";
import {
  clientPlanLabel,
  coachProfessionalPlanFromUser,
  coachProfessionalPlanLabel,
} from "../professionalPlans.js";
import "./adminUsuarioDetalle.css";

export default function AdminUsuarioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userQuery = useAdminUser(id);
  const loading = userQuery.isLoading;
  const refreshing = userQuery.isFetching && !userQuery.isLoading;
  const err = userQuery.error?.message || "";
  const user = userQuery.data || null;

  function load() {
    return userQuery.refetch();
  }

  function handleUserChange(updated) {
    setAdminUserQueryData(id, updated);
  }

  if (loading) {
    return (
      <div className="aud-page">
        <div className="aud-card">Cargando usuario...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="aud-page">
        <div className="aud-top">
          <button className="aud-btn" onClick={() => navigate("/admin/usuarios")}>
            <ArrowLeft size={17} strokeWidth={2.2} aria-hidden="true" />
            Volver
          </button>
        </div>

        <div className="aud-card">
          <div className="aud-errorTitle">No se pudo cargar el usuario</div>
          <div className="aud-errorText">{err || "Error desconocido"}</div>

          <div className="aud-actions">
            <button className="aud-btn aud-btnGold" onClick={load}>
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roleNorm = String(user?.role || "").toLowerCase();
  const avatarUrl = getAvatarUrl(user);

  return (
    <div className="aud-page">
      <div className="aud-top">
        <button className="aud-btn" onClick={() => navigate("/admin/usuarios")}>
          <ArrowLeft size={17} strokeWidth={2.2} aria-hidden="true" />
          Volver
        </button>

        <div className="aud-actions">
          <button className="aud-btn" onClick={load}>
            <RefreshCw size={17} strokeWidth={2.2} aria-hidden="true" />
            {refreshing ? "Actualizando..." : "Refrescar"}
          </button>
        </div>
      </div>

      <div className="aud-card aud-header">
        <div className="aud-avatarWrap">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`${fullName(user) || "Usuario"}`}
              className="aud-avatarImg"
            />
          ) : (
            <div className="aud-avatarFallback">
              {initials(user?.profile?.nombre, user?.profile?.apellido)}
            </div>
          )}
        </div>

        <div className="aud-info">
          <div className="aud-name">{fullName(user)}</div>

          <div className="aud-sub">
            <span className="aud-email">{user?.email || "-"}</span>
            <span className="aud-dot">|</span>
            <span className="aud-id">ID: {user?.id || user?._id || id}</span>
          </div>

          <div className="aud-badges">
            <span className="aud-badge">{user?.role || "-"}</span>
            <span className="aud-badge">{user?.tipo || "-"}</span>
            <span className="aud-badge aud-badgeInfo">
              {roleNorm === "coach"
                ? `Plan profesional: ${coachProfessionalPlanLabel(coachProfessionalPlanFromUser(user))}`
                : `Plan cliente: ${clientPlanLabel(user?.plan)}`}
            </span>
            <span
              className={`aud-badge ${
                String(user?.estado || "").toLowerCase() === "bloqueado"
                  ? "aud-badgeDanger"
                  : "aud-badgeOk"
              }`}
            >
              {user?.estado || "-"}
            </span>

            {roleNorm === "cliente" ? (
              <span className="aud-badge">
                {user?.coach?.entrenadorId ? "Con coach" : "Autogestionado"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="aud-meta">
          <div className="aud-metaRow">
            <span>Alta</span>
            <b>{fmtDate(user?.createdAt)}</b>
          </div>

          <div className="aud-metaRow">
            <span>Ultimo login</span>
            <b>{fmtDate(user?.lastLoginAt)}</b>
          </div>

          <div className="aud-metaRow">
            <span>Nacimiento</span>
            <b>{fmtDate(user?.profile?.fechaNacimiento || user?.profile?.nacimiento)}</b>
          </div>
        </div>
      </div>

      {roleNorm === "coach" ? (
        <AdminUsuarioCoachDetalle user={user} onUserChange={handleUserChange} onRefresh={load} />
      ) : roleNorm === "cliente" ? (
        <AdminUsuarioClienteDetalle user={user} onUserChange={handleUserChange} onRefresh={load} />
      ) : (
        <div className="aud-card">
          <div className="aud-sectionTitle">Detalle del usuario</div>
          <div className="aud-empty">
            Todavia no armamos una vista especifica para este rol.
          </div>
        </div>
      )}
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

function fmtDate(v) {
  if (!v) return "-";
  try {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return "-";
    return d.toISOString().slice(0, 10);
  } catch {
    return "-";
  }
}
