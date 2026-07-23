import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAdminUsers } from "./adminUsuariosQueries.js";
import {
  clientPlanLabel,
  coachProfessionalPlanFromUser,
  coachProfessionalPlanLabel,
} from "../professionalPlans.js";

export default function AdminUsuarios() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("todos");
  const [specialty, setSpecialty] = useState("todos");
  const [estado, setEstado] = useState("todos");

  const roleForApi = role === "cliente_self" || role === "cliente_coach" ? "cliente" : role;
  const showSpecialtyFilter = role === "coach";
  const debouncedSearch = useDebouncedValue(search, 300);
  const queryFilters = useMemo(
    () => ({
      search: debouncedSearch,
      role: roleForApi,
      estado,
      limit: 100,
    }),
    [debouncedSearch, estado, roleForApi]
  );
  const usersQuery = useAdminUsers(queryFilters);
  const loading = usersQuery.isLoading;
  const refreshing = usersQuery.isFetching && !usersQuery.isLoading;
  const err = usersQuery.error?.message || "";
  const users = useMemo(
    () => (Array.isArray(usersQuery.data?.users) ? usersQuery.data.users : []),
    [usersQuery.data]
  );

  const filtered = useMemo(() => {
    let arr = [...users];

    const s = search.trim().toLowerCase();
    if (s) {
      arr = arr.filter((u) => {
        const nombre = String(u?.profile?.nombre || "").toLowerCase();
        const apellido = String(u?.profile?.apellido || "").toLowerCase();
        const full = `${nombre} ${apellido}`.trim();
        const email = String(u?.email || "").toLowerCase();
        return full.includes(s) || email.includes(s);
      });
    }

    if (role === "cliente_self") {
      arr = arr.filter((u) => String(u?.role || "").toLowerCase() === "cliente" && !u?.coach?.entrenadorId);
    } else if (role === "cliente_coach") {
      arr = arr.filter((u) => String(u?.role || "").toLowerCase() === "cliente" && Boolean(u?.coach?.entrenadorId));
    } else if (role !== "todos") {
      arr = arr.filter((u) => String(u?.role || "").toLowerCase() === role);
    }

    if (estado !== "todos") {
      arr = arr.filter((u) => String(u?.estado || "").toLowerCase() === estado);
    }

    if (showSpecialtyFilter && specialty !== "todos") {
      arr = arr.filter((u) => {
        const training = !!u?.coachProfile?.specialties?.training;
        const nutrition = !!u?.coachProfile?.specialties?.nutrition;

        if (specialty === "entrenador") return training && !nutrition;
        if (specialty === "nutricionista") return nutrition && !training;
        if (specialty === "entrenador_nutricionista") return training && nutrition;

        return true;
      });
    }

    return arr;
  }, [users, search, role, specialty, estado, showSpecialtyFilter]);

  function limpiar() {
    setSearch("");
    setRole("todos");
    setSpecialty("todos");
    setEstado("todos");
  }

  function onVer(u) {
    navigate(`/admin/usuarios/${u?.id || u?._id || ""}`);
  }

  const tabClass = ({ isActive }) => `au-tab ${isActive ? "active" : ""}`;

  return (
    <div className="au-page">
      <div className="au-head">
        <div>
          <h1 className="au-title">Usuarios</h1>
          <div className="au-sub">Gestión rápida de usuarios e invitaciones.</div>
        </div>

        <div className="au-headBtns">
          <button className="au-btn" onClick={() => usersQuery.refetch()} disabled={usersQuery.isFetching}>
            {usersQuery.isFetching ? "Actualizando..." : "↻ Refrescar"}
          </button>

          <button
            className="au-btn gold"
            onClick={() => navigate("/admin/usuarios/crear")}
          >
            + Crear usuario
          </button>
        </div>
      </div>

      <div className="au-tabsWrap">
        <NavLink to="/admin/usuarios" end className={tabClass}>
          Usuarios
        </NavLink>

        <NavLink to="/admin/usuarios/invitaciones" className={tabClass}>
          Invitaciones
        </NavLink>
      </div>

      <div className="au-filters au-card">
        <input
          className="au-input"
          placeholder="Buscar por email / nombre / apellido..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="au-select"
          value={role}
          onChange={(e) => {
            const nextRole = e.target.value;
            setRole(nextRole);
            if (nextRole !== "coach") setSpecialty("todos");
          }}
        >
          <option value="todos">Todos</option>
          <option value="admin">Admin</option>
          <option value="coach">Coach</option>
          <option value="cliente">Clientes</option>
          <option value="cliente_self">Autogestionados</option>
          <option value="cliente_coach">Clientes con coach</option>
        </select>

        {showSpecialtyFilter ? (
          <select
            className="au-select"
            value={specialty}
            onChange={(e) => setSpecialty(e.target.value)}
          >
            <option value="todos">Especialidad: Todas</option>
            <option value="entrenador">entrenador</option>
            <option value="nutricionista">nutricionista</option>
            <option value="entrenador_nutricionista">entrenador-nutricionista</option>
          </select>
        ) : (
          <div className="au-select au-selectDisabled">Especialidad</div>
        )}

        <select className="au-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="todos">Estado: Todos</option>
          <option value="activo">activo</option>
          <option value="bloqueado">bloqueado</option>
          <option value="inactivo">inactivo</option>
        </select>

        <button className="au-btn" onClick={limpiar}>Limpiar</button>
      </div>

      <div className="au-row">
        <div className="au-muted">
          {loading ? "Cargando..." : `Mostrando ${filtered.length} usuario(s)`}
          {refreshing ? " - actualizando..." : ""}
          {err ? <span className="au-err"> • {err}</span> : null}
        </div>
      </div>

      <div className="au-grid">
        {loading ? (
          <div className="au-card au-empty">Cargando usuarios...</div>
        ) : filtered.length === 0 ? (
          <div className="au-card au-empty">No hay resultados con esos filtros.</div>
        ) : (
          filtered.map((u) => {
            const id = u?.id || u?._id || u?.email;
            const nombre = (u?.profile?.nombre || "").trim();
            const apellido = (u?.profile?.apellido || "").trim();
            const avatar = getAvatarUrl(u);
            const estadoActual = String(u?.estado || "").toLowerCase();
            const activo = estadoActual === "activo";

            const kind = getUserKindMeta(u);
            const userType = getUserTypeMeta(u);
            const plan = getUserPlanMeta(u);

            const activityLabel = formatLastActivity(u?.lastActivityAt);
            const activityExact = formatExactDate(u?.lastActivityAt);

            return (
              <div key={id} className="au-card au-userCard">
                <div className="au-avatarWrap">
                  {avatar ? (
                    <img
                      className="au-avatarImg"
                      src={avatar}
                      alt={`${nombre} ${apellido}`.trim()}
                    />
                  ) : (
                    <div className="au-avatarFallback">{initials(nombre, apellido)}</div>
                  )}

                  <div
                    className={`au-planBadge ${plan.className}`}
                    title={plan.label}
                    aria-label={plan.label}
                  >
                    {plan.emoji}
                  </div>
                </div>

                <div className="au-lastName" title={apellido || "Sin apellido"}>
                  {apellido || "SIN APELLIDO"}
                </div>

                <div className="au-firstName" title={nombre || "Sin nombre"}>
                  {nombre || "Sin nombre"}
                </div>

                <div
                  className={`au-userTypeChip ${userType.className}`}
                  title={userType.label}
                  aria-label={`Tipo de usuario: ${userType.label}`}
                >
                  {userType.label}
                </div>

                <div
                  className={`au-lastActivity ${getActivityToneClass(u?.lastActivityAt)}`}
                  title={activityExact}
                >
                  {activityLabel}
                </div>

                <div className="au-iconsRow">
                  <StatusIcon active={activo} />

                  <IconBtn title="Detalle" onClick={() => onVer(u)}>ℹ️</IconBtn>

                  <div
                    className={`au-kindIcon ${kind.className}`}
                    title={kind.label}
                    aria-label={kind.label}
                  >
                    {kind.emoji}
                  </div>
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

function useDebouncedValue(value, delayMs) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [delayMs, value]);

  return debounced;
}

function IconBtn({ title, onClick, children }) {
  return (
    <button className="au-iconBtn" onClick={onClick} type="button" title={title}>
      <span className="au-iconInner" aria-hidden="true">{children}</span>
    </button>
  );
}

function StatusIcon({ active }) {
  return (
    <div
      className={`au-statusIcon ${active ? "ok" : "off"}`}
      title={active ? "Activo" : "Inactivo"}
      aria-label={active ? "Activo" : "Inactivo"}
    >
      {active ? "🟢" : "🔴"}
    </div>
  );
}

function initials(nombre = "", apellido = "") {
  const a = String(nombre || "").trim()[0] || "U";
  const b = String(apellido || "").trim()[0] || "X";
  return (a + b).toUpperCase();
}

function getAvatarUrl(u) {
  return (
    u?.profile?.foto ||
    u?.profile?.avatar ||
    u?.profile?.avatarUrl ||
    u?.avatar ||
    u?.avatarUrl ||
    ""
  );
}

function getUserKindMeta(u) {
  const role = String(u?.role || "").toLowerCase();

  if (role === "admin") {
    return { emoji: "👑", label: "Admin", className: "admin" };
  }

  if (role === "coach") {
    const training = !!u?.coachProfile?.specialties?.training;
    const nutrition = !!u?.coachProfile?.specialties?.nutrition;

    if (training && nutrition) return { emoji: "⚡", label: "Coach mixto", className: "mixed" };
    if (training) return { emoji: "🏋️", label: "Coach entrenador", className: "coach" };
    if (nutrition) return { emoji: "🥗", label: "Coach nutricionista", className: "nutrition" };

    return { emoji: "🧑‍🏫", label: "Coach", className: "coach" };
  }

  const hasCoach = !!u?.coach?.entrenadorId;
  if (role === "cliente" && !hasCoach) {
    return { emoji: "📱", label: "Autogestionado", className: "self" };
  }

  return { emoji: "👤", label: "Cliente", className: "user" };
}

function getUserTypeMeta(u) {
  const role = String(u?.role || "").toLowerCase();
  const hasCoach = Boolean(u?.coach?.entrenadorId);

  if (role === "admin") {
    return { label: "Admin", className: "admin" };
  }

  if (role === "coach") {
    return { label: "Coach", className: "coach" };
  }

  if (role === "cliente" && hasCoach) {
    return { label: "Cliente con coach", className: "clientCoach" };
  }

  if (role === "cliente") {
    return { label: "Autogestionado", className: "self" };
  }

  return { label: toDisplayRole(role) || "Cliente", className: "fallback" };
}

function toDisplayRole(role) {
  const value = String(role || "").trim().toLowerCase();
  if (!value) return "";
  if (value === "admin") return "Admin";
  if (value === "coach") return "Coach";
  if (value === "cliente") return "Cliente";

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getUserPlanMeta(u) {
  const role = String(u?.role || "").toLowerCase();
  if (role === "admin") {
    return { emoji: "👑", label: "Admin", className: "vip" };
  }

  if (role === "coach") {
    const plan = coachProfessionalPlanFromUser(u);
    return {
      emoji: plan === "coach_ai" ? "💎" : "",
      label: `Coach ${coachProfessionalPlanLabel(plan)}`,
      className: plan === "coach_ai" ? "vip" : plan === "coach_pro" ? "plus" : "free",
    };
  }

  const rawPlan =
    u?.effectiveCapabilities?.planCode ||
    u?.plan ||
    u?.planActual ||
    u?.subscription?.tier ||
    u?.subscription?.plan ||
    u?.suscripcion?.plan ||
    u?.suscripcion?.tier ||
    u?.membership ||
    u?.membresia ||
    u?.profile?.plan ||
    "free";

  const plan = String(rawPlan || "free").toLowerCase().trim();

  const label = clientPlanLabel(plan);
  if (label === "VIP") return { emoji: "💎", label: "Cliente VIP", className: "vip" };
  if (label === "Pro") return { emoji: "", label: "Cliente Pro", className: "plus" };
  return { emoji: "🆓", label: "Cliente Free", className: "free" };
}

function formatLastActivity(value) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad";

  const diffMs = Date.now() - date.getTime();
  const min = Math.floor(diffMs / (1000 * 60));
  const hr = Math.floor(diffMs / (1000 * 60 * 60));
  const day = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (min < 1) return "Ahora";
  if (min < 60) return `Hace ${min} min`;
  if (hr < 24) return `Hace ${hr} h`;
  if (day < 7) return `Hace ${day} d`;
  return "+7 d";
}

function formatExactDate(value) {
  if (!value) return "Sin actividad";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin actividad";

  return date.toLocaleString("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getActivityToneClass(value) {
  if (!value) return "old";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "old";

  const diffMs = Date.now() - date.getTime();
  const day = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (day < 1) return "fresh";
  if (day < 7) return "mid";
  return "old";
}

const styles = `
.au-page{
  width:100%;
  max-width:100%;
  margin:0 auto;
  padding:6px 8px 14px;
  color:#eaeaea;
}
.au-head{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px;
  flex-wrap:wrap;
  margin-bottom:6px;
}
.au-title{
  margin:0;
  font-size:28px;
  color:#f5d76e;
  letter-spacing:.2px;
}
.au-sub{
  margin-top:2px;
  opacity:.82;
}
.au-headBtns{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}
.au-tabsWrap{
  display:flex;
  gap:10px;
  margin:12px 0 10px;
  flex-wrap:wrap;
}
.au-tab{
  text-decoration:none;
  padding:10px 14px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  font-weight:900;
  transition:.16s ease;
}
.au-tab:hover{
  border-color: rgba(245,215,110,.25);
}
.au-tab.active{
  border-color: rgba(245,215,110,.40);
  background: rgba(245,215,110,.08);
  color:#f5d76e;
}
.au-card{
  border:1.4px solid rgba(245,215,110,.18);
  background: linear-gradient(180deg, #0a0d12, #080b10);
  border-radius:18px;
  box-shadow:
    0 10px 26px rgba(0,0,0,.24),
    inset 0 1px 0 rgba(255,255,255,.02);
}
.au-btn{
  padding:10px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  font-weight:900;
  cursor:pointer;
  transition:.16s ease;
}
.au-btn:hover{
  border-color: rgba(245,215,110,.25);
}
.au-btn.gold{
  border-color: rgba(245,215,110,.35);
  background: rgba(245,215,110,.06);
  color:#f5d76e;
}
.au-filters{
  margin-top:8px;
  padding:10px;
  display:grid;
  grid-template-columns: 1.5fr .8fr .9fr .8fr auto;
  gap:8px;
  align-items:center;
}
.au-input,.au-select,.au-selectDisabled{
  width:100%;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0b0b0b;
  color:#eaeaea;
  outline:none;
}
.au-selectDisabled{
  opacity:.45;
  display:flex;
  align-items:center;
}
.au-input:focus,.au-select:focus{
  border-color: rgba(245,215,110,.5);
  box-shadow: 0 0 0 4px rgba(245,215,110,.12);
}
.au-row{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin:10px 4px 0;
}
.au-muted{
  opacity:.85;
  font-weight:900;
}
.au-err{
  color:#ffb1b1;
  font-weight:900;
}
.au-grid{
  margin-top:10px;
  display:grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap:10px;
}
.au-empty{
  min-height:100px;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  opacity:.85;
}
.au-userCard{
  padding:14px 12px 12px;
  min-height:286px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-start;
  text-align:center;
  transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease;
}
.au-userCard:hover{
  transform: translateY(-2px);
  border-color: rgba(245,215,110,.28);
  box-shadow:
    0 14px 32px rgba(0,0,0,.32),
    0 0 0 1px rgba(245,215,110,.04);
}
.au-avatarWrap{
  position:relative;
  width:108px;
  height:108px;
  margin-bottom:12px;
  border-radius:999px;
  overflow:visible;
  background:#151515;
  border:1px solid rgba(255,255,255,.06);
  display:flex;
  align-items:center;
  justify-content:center;
}
.au-avatarImg{
  width:100%;
  height:100%;
  object-fit:cover;
  display:block;
  border-radius:999px;
}
.au-avatarFallback{
  width:100%;
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:34px;
  font-weight:1000;
  color:#f5d76e;
  border-radius:999px;
  background: radial-gradient(circle at top, rgba(245,215,110,.14), rgba(255,255,255,.02));
}
.au-planBadge{
  position:absolute;
  right:-2px;
  bottom:2px;
  width:32px;
  height:32px;
  border-radius:999px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:16px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  box-shadow: 0 8px 20px rgba(0,0,0,.28);
}
.au-planBadge.free{
  border-color: rgba(160,160,160,.28);
  background: rgba(255,255,255,.045);
}
.au-planBadge.plus{
  border-color: rgba(245,215,110,.35);
  background: rgba(245,215,110,.08);
}
.au-planBadge.vip{
  border-color: rgba(120,210,255,.35);
  background: rgba(120,210,255,.08);
}
.au-lastName{
  max-width:100%;
  font-size:20px;
  line-height:1.05;
  font-weight:700;
  color:#f0f0f0;
  text-transform:uppercase;
  letter-spacing:.4px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.au-firstName{
  margin-top:8px;
  max-width:100%;
  font-size:12px;
  line-height:1.2;
  font-weight:600;
  color:#bdbdbd;
  text-transform:uppercase;
  letter-spacing:.8px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.au-userTypeChip{
  margin-top:8px;
  max-width:100%;
  min-height:24px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:4px 10px;
  border-radius:999px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.045);
  color:#e8eef8;
  font-size:10.5px;
  line-height:1;
  font-weight:1000;
  letter-spacing:.55px;
  text-transform:uppercase;
  white-space:nowrap;
  box-shadow: inset 0 1px 0 rgba(255,255,255,.04);
}
.au-userTypeChip.admin{
  color:#ffe48a;
  border-color:rgba(245,215,110,.34);
  background:rgba(245,215,110,.09);
}
.au-userTypeChip.coach{
  color:#b9dcff;
  border-color:rgba(96,165,250,.34);
  background:rgba(96,165,250,.09);
}
.au-userTypeChip.self{
  color:#a9f5d0;
  border-color:rgba(45,212,191,.32);
  background:rgba(45,212,191,.08);
}
.au-userTypeChip.clientCoach{
  color:#d9ccff;
  border-color:rgba(167,139,250,.34);
  background:rgba(88,80,180,.12);
}
.au-userTypeChip.fallback{
  color:#d8e2f0;
  border-color:rgba(148,163,184,.28);
  background:rgba(148,163,184,.08);
}
.au-lastActivity{
  margin-top:10px;
  min-height:22px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  padding:4px 10px;
  border-radius:999px;
  font-size:11px;
  font-weight:900;
  letter-spacing:.5px;
  border:1px solid #2a2a2a;
  background:#101010;
  color:#cfcfcf;
}
.au-lastActivity.fresh{
  color:#a8f7cf;
  border-color: rgba(80,220,140,.35);
  background: rgba(80,220,140,.07);
}
.au-lastActivity.mid{
  color:#f5d76e;
  border-color: rgba(245,215,110,.30);
  background: rgba(245,215,110,.06);
}
.au-lastActivity.old{
  color:#b7b7b7;
  border-color: rgba(160,160,160,.24);
  background: rgba(255,255,255,.04);
}
.au-iconsRow{
  margin-top:auto;
  width:100%;
  display:grid;
  grid-template-columns: 42px 42px 42px;
  justify-content:space-between;
  align-items:center;
  padding-top:18px;
}
.au-statusIcon,
.au-iconBtn,
.au-kindIcon{
  width:42px;
  height:42px;
  border-radius:12px;
  display:flex;
  align-items:center;
  justify-content:center;
}
.au-statusIcon{
  border:1px solid #2b2b2b;
  background:#101010;
  font-size:20px;
}
.au-statusIcon.ok{
  border-color: rgba(80,220,140,.35);
  background: rgba(80,220,140,.07);
}
.au-statusIcon.off{
  border-color: rgba(255,80,80,.35);
  background: rgba(255,80,80,.08);
}
.au-kindIcon{
  border:1px solid #2b2b2b;
  background:#101010;
  font-size:18px;
}
.au-kindIcon.admin{
  border-color: rgba(245,215,110,.35);
  background: rgba(245,215,110,.08);
}
.au-kindIcon.coach{
  border-color: rgba(120,170,255,.35);
  background: rgba(120,170,255,.08);
}
.au-kindIcon.nutrition{
  border-color: rgba(80,220,140,.35);
  background: rgba(80,220,140,.08);
}
.au-kindIcon.mixed{
  border-color: rgba(255,170,80,.35);
  background: rgba(255,170,80,.08);
}
.au-kindIcon.self{
  border-color: rgba(160,160,160,.35);
  background: rgba(255,255,255,.05);
}
.au-kindIcon.user{
  border-color: rgba(150,150,150,.28);
  background: rgba(255,255,255,.04);
}
.au-iconBtn{
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  cursor:pointer;
  transition:.16s ease;
}
.au-iconBtn:hover{
  transform: translateY(-1px);
  border-color: rgba(245,215,110,.25);
}
.au-iconInner{
  font-size:18px;
  line-height:1;
}
@media (max-width: 980px){
  .au-filters{
    grid-template-columns: 1fr 1fr;
  }
}
@media (max-width: 640px){
  .au-page{
    padding:6px 6px 12px;
  }
  .au-title{
    font-size:24px;
  }
  .au-grid{
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .au-userCard{
    min-height:260px;
    padding:12px 10px 10px;
  }
  .au-avatarWrap{
    width:88px;
    height:88px;
  }
  .au-planBadge{
    width:28px;
    height:28px;
    font-size:14px;
    right:-1px;
    bottom:0;
  }
  .au-lastName{
    font-size:17px;
  }
  .au-firstName{
    font-size:11px;
  }
  .au-userTypeChip{
    min-height:22px;
    padding:4px 8px;
    font-size:9px;
    line-height:1.12;
    letter-spacing:.32px;
    white-space:normal;
  }
  .au-lastActivity{
    font-size:10px;
    padding:4px 8px;
  }
  .au-iconsRow{
    grid-template-columns: 38px 38px 38px;
  }
  .au-statusIcon,
  .au-iconBtn,
  .au-kindIcon{
    width:38px;
    height:38px;
  }
}
`;
