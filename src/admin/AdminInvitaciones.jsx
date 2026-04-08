import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { apiFetch } from "../Api.js";

export default function AdminInvitaciones() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [items, setItems] = useState([]);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [role, setRole] = useState("todos");

  async function load() {
    setLoading(true);
    setErr("");

    try {
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (status !== "todos") qs.set("status", status);
      if (role !== "todos") qs.set("role", role);
      qs.set("limit", "100");

      const data = await apiFetch(`/api/usuarios/admin/invitations?${qs.toString()}`, {
        method: "GET",
        timeoutMs: 9000,
      });

      const arr = data?.invitations || data?.items || data || [];
      setItems(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setErr(e?.message || "No se pudieron cargar las invitaciones");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let arr = [...items];

    const s = search.trim().toLowerCase();
    if (s) {
      arr = arr.filter((it) => {
        const email = String(it?.email || "").toLowerCase();
        const nombre = String(it?.profile?.nombre || "").toLowerCase();
        const apellido = String(it?.profile?.apellido || "").toLowerCase();
        const full = `${nombre} ${apellido}`.trim();
        return email.includes(s) || full.includes(s);
      });
    }

    if (status !== "todos") {
      arr = arr.filter((it) => String(it?.status || "").toLowerCase() === status);
    }

    if (role !== "todos") {
      arr = arr.filter((it) => String(it?.role || "").toLowerCase() === role);
    }

    return arr;
  }, [items, search, status, role]);

  function limpiar() {
    setSearch("");
    setStatus("todos");
    setRole("todos");
  }

  const tabClass = ({ isActive }) => `ai-tab ${isActive ? "active" : ""}`;

  return (
    <div className="ai-page">
      <div className="ai-head">
        <div>
          <h1 className="ai-title">Invitaciones</h1>
          <div className="ai-sub">Controlá invitaciones pendientes y el estado de acceso.</div>
        </div>

        <div className="ai-headBtns">
          <button className="ai-btn" onClick={load}>↻ Refrescar</button>

          <button
            className="ai-btn gold"
            onClick={() => navigate("/admin/usuarios/crear")}
          >
            + Crear invitación
          </button>
        </div>
      </div>

      <div className="ai-tabsWrap">
        <NavLink to="/admin/usuarios" end className={tabClass}>
          Usuarios
        </NavLink>

        <NavLink to="/admin/usuarios/invitaciones" className={tabClass}>
          Invitaciones
        </NavLink>
      </div>

      <div className="ai-filters ai-card">
        <input
          className="ai-input"
          placeholder="Buscar por email / nombre / apellido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className="ai-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="todos">Rol: Todos</option>
          <option value="admin">admin</option>
          <option value="coach">coach</option>
          <option value="cliente">cliente</option>
        </select>

        <select className="ai-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="todos">Estado: Todos</option>
          <option value="pending">pending</option>
          <option value="accepted">accepted</option>
          <option value="rejected">rejected</option>
          <option value="cancelled">cancelled</option>
          <option value="expired">expired</option>
        </select>

        <button className="ai-btn" onClick={limpiar}>Limpiar</button>
      </div>

      <div className="ai-row">
        <div className="ai-muted">
          {loading ? "Cargando..." : `Mostrando ${filtered.length} invitación(es)`}
          {err ? <span className="ai-err"> • {err}</span> : null}
        </div>
      </div>

      <div className="ai-grid">
        {loading ? (
          <div className="ai-card ai-empty">Cargando invitaciones...</div>
        ) : filtered.length === 0 ? (
          <div className="ai-card ai-empty">No hay invitaciones con esos filtros.</div>
        ) : (
          filtered.map((it) => {
            const id = it?._id || it?.id || it?.email;
            const nombre = String(it?.profile?.nombre || "").trim();
            const apellido = String(it?.profile?.apellido || "").trim();
            const fullName = `${nombre} ${apellido}`.trim();
            const roleMeta = getInviteRoleMeta(it);
            const statusMeta = getInviteStatusMeta(it?.status);
            const planMeta = getInvitePlanMeta(it?.plan);
            const specialtyText = getInviteSpecialtyText(it);
            const invitedAt = formatDateTime(it?.invitedAt || it?.createdAt);
            const acceptedAt = formatDateTime(it?.acceptedAt);
            const email = String(it?.email || "");

            return (
              <div key={id} className="ai-card ai-inviteCard">
                <div className="ai-top">
                  <div className={`ai-roleBadge ${roleMeta.className}`}>
                    <span>{roleMeta.emoji}</span>
                    <span>{roleMeta.label}</span>
                  </div>

                  <div className={`ai-statusBadge ${statusMeta.className}`}>
                    <span>{statusMeta.emoji}</span>
                    <span>{statusMeta.label}</span>
                  </div>
                </div>

                <div className="ai-mainId">
                  <div className="ai-name" title={fullName || "Sin nombre"}>
                    {fullName || "Sin nombre"}
                  </div>

                  <div className="ai-email" title={email || "Sin email"}>
                    {email || "Sin email"}
                  </div>
                </div>

                <div className="ai-chips">
                  {planMeta ? (
                    <div className={`ai-chip ${planMeta.className}`}>
                      <span>{planMeta.emoji}</span>
                      <span>{planMeta.label}</span>
                    </div>
                  ) : null}

                  {specialtyText ? (
                    <div className="ai-chip neutral">
                      <span>🧩</span>
                      <span>{specialtyText}</span>
                    </div>
                  ) : null}
                </div>

                <div className="ai-meta">
                  <div className="ai-metaRow">
                    <span className="ai-metaLabel">Fecha</span>
                    <span className="ai-metaValue">{invitedAt}</span>
                  </div>


                </div>

                <div className="ai-actions">
                  <button
                    type="button"
                    className="ai-iconBtn"
                    title="Copiar email"
                    onClick={() => navigator.clipboard?.writeText(email)}
                  >
                    <span aria-hidden="true">📋</span>
                  </button>

                  <button
                    type="button"
                    className="ai-iconBtn"
                    title="Nueva invitación"
                    onClick={() => navigate("/admin/usuarios/crear")}
                  >
                    <span aria-hidden="true">➕</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <style>{styles}</style>
    </div>
  );
}

function getInviteRoleMeta(it) {
  const role = String(it?.role || "").toLowerCase();

  if (role === "admin") {
    return { emoji: "👑", label: "Admin", className: "admin" };
  }

  if (role === "coach") {
    return { emoji: "🧑‍🏫", label: "Coach", className: "coach" };
  }

  return { emoji: "👤", label: "Cliente", className: "cliente" };
}

function getInviteStatusMeta(status) {
  const s = String(status || "").toLowerCase();

  if (s === "accepted") return { emoji: "✅", label: "Aceptada", className: "accepted" };
  if (s === "rejected") return { emoji: "⛔", label: "Rechazada", className: "rejected" };
  if (s === "cancelled") return { emoji: "🚫", label: "Cancelada", className: "cancelled" };
  if (s === "expired") return { emoji: "⌛", label: "Expirada", className: "expired" };

  return { emoji: "🟡", label: "Pendiente", className: "pending" };
}

function getInvitePlanMeta(planRaw) {
  const plan = String(planRaw || "").toLowerCase().trim();

  if (!plan) return null;
  if (plan === "premium2" || plan === "vip") {
    return { emoji: "💎", label: "VIP", className: "vip" };
  }
  if (plan === "premium" || plan === "pro" || plan === "plus") {
    return { emoji: "⭐", label: "Premium", className: "plus" };
  }
  return { emoji: "🆓", label: "Free", className: "free" };
}

function getInviteSpecialtyText(it) {
  const training = !!it?.coachProfile?.specialties?.training;
  const nutrition = !!it?.coachProfile?.specialties?.nutrition;

  if (training && nutrition) return "Entrenador + Nutricionista";
  if (training) return "Entrenador";
  if (nutrition) return "Nutricionista";
  return "";
}

function formatDateTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

const styles = `
.ai-page{
  width:100%;
  max-width:100%;
  margin:0 auto;
  padding:6px 8px 14px;
  color:#eaeaea;
}
.ai-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
  margin-bottom:6px;
}
.ai-title{
  margin:0;
  font-size:28px;
  color:#f5d76e;
  letter-spacing:.2px;
}
.ai-sub{
  margin-top:2px;
  opacity:.82;
}
.ai-headBtns{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.ai-tabsWrap{
  display:flex;
  gap:10px;
  margin:12px 0 10px;
  flex-wrap:wrap;
}
.ai-tab{
  text-decoration:none;
  padding:10px 14px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  font-weight:900;
  transition:.16s ease;
}
.ai-tab:hover{
  border-color: rgba(245,215,110,.25);
}
.ai-tab.active{
  border-color: rgba(245,215,110,.40);
  background: rgba(245,215,110,.08);
  color:#f5d76e;
}
.ai-card{
  border:1.4px solid rgba(245,215,110,.18);
  background: linear-gradient(180deg, #0a0d12, #080b10);
  border-radius:18px;
  box-shadow:
    0 10px 26px rgba(0,0,0,.24),
    inset 0 1px 0 rgba(255,255,255,.02);
}
.ai-btn{
  padding:10px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  font-weight:900;
  cursor:pointer;
  transition:.16s ease;
}
.ai-btn:hover{
  border-color: rgba(245,215,110,.25);
}
.ai-btn.gold{
  border-color: rgba(245,215,110,.35);
  background: rgba(245,215,110,.06);
  color:#f5d76e;
}
.ai-filters{
  margin-top:8px;
  padding:10px;
  display:grid;
  grid-template-columns: 1.5fr .9fr .9fr auto;
  gap:8px;
  align-items:center;
}
.ai-input,.ai-select{
  width:100%;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0b0b0b;
  color:#eaeaea;
  outline:none;
}
.ai-input:focus,.ai-select:focus{
  border-color: rgba(245,215,110,.5);
  box-shadow: 0 0 0 4px rgba(245,215,110,.12);
}
.ai-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin:10px 4px 0;
}
.ai-muted{
  opacity:.85;
  font-weight:900;
}
.ai-err{
  color:#ffb1b1;
  font-weight:900;
}
.ai-grid{
  margin-top:10px;
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(270px, 1fr));
  gap:12px;
}
.ai-empty{
  min-height:110px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  opacity:.85;
}
.ai-inviteCard{
  padding:16px;
  display:flex;
  flex-direction:column;
  gap:14px;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.ai-inviteCard:hover{
  transform: translateY(-2px);
  border-color: rgba(245,215,110,.28);
  box-shadow:
    0 14px 32px rgba(0,0,0,.32),
    0 0 0 1px rgba(245,215,110,.04);
}
.ai-top{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.ai-roleBadge,
.ai-statusBadge,
.ai-chip{
  display:inline-flex;
  align-items:center;
  gap:8px;
  padding:8px 10px;
  border-radius:999px;
  font-size:12px;
  font-weight:900;
}
.ai-roleBadge.admin{
  border:1px solid rgba(245,215,110,.35);
  background: rgba(245,215,110,.08);
  color:#f5d76e;
}
.ai-roleBadge.coach{
  border:1px solid rgba(120,170,255,.35);
  background: rgba(120,170,255,.08);
  color:#b9ceff;
}
.ai-roleBadge.cliente{
  border:1px solid rgba(160,160,160,.28);
  background: rgba(255,255,255,.05);
  color:#d7d7d7;
}
.ai-statusBadge.pending{
  border:1px solid rgba(245,215,110,.30);
  background: rgba(245,215,110,.06);
  color:#f5d76e;
}
.ai-statusBadge.accepted{
  border:1px solid rgba(80,220,140,.35);
  background: rgba(80,220,140,.07);
  color:#a8f7cf;
}
.ai-statusBadge.rejected{
  border:1px solid rgba(255,80,80,.35);
  background: rgba(255,80,80,.08);
  color:#ffb9b9;
}
.ai-statusBadge.cancelled{
  border:1px solid rgba(180,180,180,.25);
  background: rgba(255,255,255,.04);
  color:#cfcfcf;
}
.ai-statusBadge.expired{
  border:1px solid rgba(255,170,80,.35);
  background: rgba(255,170,80,.08);
  color:#ffcf9c;
}
.ai-mainId{
  display:flex;
  flex-direction:column;
  gap:6px;
}
.ai-name{
  font-size:20px;
  font-weight:900;
  color:#f0f0f0;
  line-height:1.1;
}
.ai-email{
  color:#b8c0cc;
  font-size:14px;
  word-break:break-word;
}
.ai-chips{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}
.ai-chip.free{
  border:1px solid rgba(160,160,160,.28);
  background: rgba(255,255,255,.045);
  color:#d7d7d7;
}
.ai-chip.plus{
  border:1px solid rgba(245,215,110,.35);
  background: rgba(245,215,110,.08);
  color:#f5d76e;
}
.ai-chip.vip{
  border:1px solid rgba(120,210,255,.35);
  background: rgba(120,210,255,.08);
  color:#b9e6ff;
}
.ai-chip.neutral{
  border:1px solid rgba(255,255,255,.10);
  background: rgba(255,255,255,.04);
  color:#eaeaea;
}
.ai-meta{
  display:grid;
  gap:8px;
  padding:12px;
  border-radius:16px;
  border:1px solid rgba(255,255,255,.06);
  background: rgba(255,255,255,.03);
}
.ai-metaRow{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.ai-metaLabel{
  font-size:12px;
  font-weight:900;
  color:#aab3bf;
  text-transform:uppercase;
  letter-spacing:.05em;
}
.ai-metaValue{
  font-size:13px;
  font-weight:700;
  color:#f0f0f0;
  text-align:right;
}
.ai-actions{
  margin-top:auto;
  display:flex;
  justify-content:flex-end;
  gap:10px;
}
.ai-iconBtn{
  width:42px;
  height:42px;
  border-radius:12px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  cursor:pointer;
  transition:.16s ease;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:18px;
}
.ai-iconBtn:hover{
  transform: translateY(-1px);
  border-color: rgba(245,215,110,.25);
}
@media (max-width: 980px){
  .ai-filters{
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 640px){
  .ai-page{
    padding:6px 6px 12px;
  }
  .ai-title{
    font-size:24px;
  }
  .ai-grid{
    grid-template-columns: 1fr;
  }
}
`;
