import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getAdminUserById } from "./adminUsuariosApi.js";
import AdminUsuarioClienteDetalle from "./AdminUsuarioClienteDetalle.jsx";
import AdminUsuarioCoachDetalle from "./AdminUsuarioCoachDetalle.jsx";
import "./adminUsuarioDetalle.css";

export default function AdminUsuarioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const u = await getAdminUserById(id);
      setUser(u || null);
    } catch (e) {
      setErr(e?.message || "No se pudo cargar el usuario");
      setUser(null);
    } finally {
      setLoading(false);
    }
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
            ← Volver
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
          ← Volver
        </button>

        <div className="aud-actions">
          <button className="aud-btn" onClick={load}>
            ↻ Refrescar
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
            <span className="aud-email">{user?.email || "—"}</span>
            <span className="aud-dot">•</span>
            <span className="aud-id">ID: {user?.id || user?._id || id}</span>
          </div>

          <div className="aud-badges">
            <span className="aud-badge">{user?.role || "—"}</span>
            <span className="aud-badge">{user?.tipo || "—"}</span>
            <span className="aud-badge aud-badgeInfo">{planLabel(user?.plan)}</span>
            <span
              className={`aud-badge ${
                String(user?.estado || "").toLowerCase() === "bloqueado"
                  ? "aud-badgeDanger"
                  : "aud-badgeOk"
              }`}
            >
              {user?.estado || "—"}
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
            <span>Último login</span>
            <b>{fmtDate(user?.lastLoginAt)}</b>
          </div>

          <div className="aud-metaRow">
            <span>Nacimiento</span>
            <b>{fmtDate(user?.profile?.fechaNacimiento || user?.profile?.nacimiento)}</b>
          </div>
        </div>
      </div>

      {roleNorm === "coach" ? (
        <AdminUsuarioCoachDetalle user={user} onUserChange={setUser} onRefresh={load} />
      ) : roleNorm === "cliente" ? (
        <AdminUsuarioClienteDetalle user={user} onUserChange={setUser} onRefresh={load} />
      ) : (
        <div className="aud-card">
          <div className="aud-sectionTitle">Detalle del usuario</div>
          <div className="aud-empty">
            Todavía no armamos una vista específica para este rol.
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
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return "—";
    return d.toISOString().slice(0, 10);
  } catch {
    return "—";
  }
}

function planLabel(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium2" || p === "vip") return "VIP";
  if (p === "premium" || p === "pro") return "Pro";
  return "Free";
}
