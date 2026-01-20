import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js";

export default function AdminUsuarios() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [users, setUsers] = useState([]);

  // filtros
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("todos");
  const [tipo, setTipo] = useState("todos");
  const [estado, setEstado] = useState("todos");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      // 🔁 si tu endpoint está en otro path, cambiá acá:
      // /api/usuarios/admin/users
      const qs = new URLSearchParams();
      if (search.trim()) qs.set("search", search.trim());
      if (role !== "todos") qs.set("role", role);
      if (tipo !== "todos") qs.set("tipo", tipo);
      if (estado !== "todos") qs.set("estado", estado);
      qs.set("limit", "100");

      const data = await apiFetch(`/api/usuarios/admin/users?${qs.toString()}`, {
        method: "GET",
        timeoutMs: 9000,
      });

      const arr = data?.users || data?.usuarios || data || [];
      setUsers(Array.isArray(arr) ? arr : []);
    } catch (e) {
      setErr(e?.message || "No se pudo cargar usuarios");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let arr = [...users];

    // por si el backend no filtra, filtramos acá también
    const s = search.trim().toLowerCase();
    if (s) {
      arr = arr.filter((u) => {
        const full = `${u?.profile?.nombre || ""} ${u?.profile?.apellido || ""}`.toLowerCase();
        const em = String(u?.email || "").toLowerCase();
        return full.includes(s) || em.includes(s);
      });
    }
    if (role !== "todos") arr = arr.filter((u) => (u?.role || "") === role);
    if (tipo !== "todos") arr = arr.filter((u) => (u?.tipo || "") === tipo);
    if (estado !== "todos") arr = arr.filter((u) => (u?.estado || "") === estado);

    return arr;
  }, [users, search, role, tipo, estado]);

  function limpiar() {
    setSearch("");
    setRole("todos");
    setTipo("todos");
    setEstado("todos");
  }

  function onVer(u) {
    // ✅ acá vas al detalle pro
    navigate(`/admin/usuarios/${u?.id || u?._id || ""}`);
  }

  function onEditar(u) {
    alert(`TODO: editar usuario ${u?.email}`);
  }

  async function onEliminar(u) {
    const id = u?.id || u?._id;
    if (!id) return;

    const ok = confirm(`¿Eliminar a ${u?.email}?`);
    if (!ok) return;

    try {
      await apiFetch(`/api/usuarios/admin/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((x) => (x?.id || x?._id) !== id));
    } catch (e) {
      alert(e?.message || "No se pudo eliminar");
    }
  }

  return (
    <div className="au-page">
      <div className="au-head">
        <div>
          <h1 className="au-title">Usuarios</h1>
          <div className="au-sub">Gestión completa: filtros, roles, metas y acceso al detalle.</div>
        </div>

        <div className="au-headBtns">
          <button className="au-btn" onClick={load}>↻ Refrescar</button>
          <button className="au-btn gold" onClick={() => alert("TODO: crear usuario")}>+ Crear usuario</button>
        </div>
      </div>

      <div className="au-filters au-card">
        <input
          className="au-input"
          placeholder="Buscar por email / nombre / apellido…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select className="au-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="todos">Rol: Todos</option>
          <option value="admin">admin</option>
          <option value="cliente">cliente</option>
        </select>

        <select className="au-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="todos">Tipo: Todos</option>
          <option value="entrenado">entrenado</option>
          <option value="entrenador">entrenador</option>
        </select>

        <select className="au-select" value={estado} onChange={(e) => setEstado(e.target.value)}>
          <option value="todos">Estado: Todos</option>
          <option value="activo">activo</option>
          <option value="bloqueado">bloqueado</option>
        </select>

        <button className="au-btn" onClick={limpiar}>Limpiar</button>
      </div>

      <div className="au-row">
        <div className="au-muted">
          {loading ? "Cargando…" : `Mostrando ${filtered.length} usuario(s)`}
          {err ? <span className="au-err"> • {err}</span> : null}
        </div>
      </div>

      <div className="au-list">
        {loading ? (
          <div className="au-card au-empty">Cargando usuarios…</div>
        ) : filtered.length === 0 ? (
          <div className="au-card au-empty">No hay resultados con esos filtros.</div>
        ) : (
          filtered.map((u) => {
            const id = u?.id || u?._id;
            const nombre = u?.profile?.nombre || "—";
            const apellido = u?.profile?.apellido || "";
            const email = u?.email || "—";
            const r = u?.role || "—";
            const t = u?.tipo || "—";
            const est = u?.estado || "—";

            // meta/macros (si es entrenador, no mostrar)
            const showPlan = t !== "entrenador";
            const objetivo = u?.meta || u?.objetivo || u?.goal || "—"; // pérdida/ganancia/mantenimiento
            const kcal = u?.kcalObjetivo || u?.kcal || u?.metas?.kcal || "—";
            const p = u?.metas?.p ?? u?.macros?.p ?? "—";
            const c = u?.metas?.c ?? u?.macros?.c ?? "—";
            const g = u?.metas?.g ?? u?.macros?.g ?? "—";

            return (
              <div key={id} className="au-card au-item">
                <div className="au-left">
                  <div className="au-avatar">{initials(nombre, apellido)}</div>

                  <div className="au-main">
                    <div className="au-name">{nombre} {apellido}</div>
                    <div className="au-email">{email}</div>

                    <div className="au-badges">
                      <span className={`au-badge ${r === "admin" ? "gold" : ""}`}>{r}</span>
                      <span className="au-badge">{t}</span>
                      <span className={`au-badge ${est === "bloqueado" ? "danger" : "ok"}`}>{est}</span>
                    </div>
                  </div>
                </div>

                <div className="au-mid">
                  {showPlan ? (
                    <>
                      <div className="au-kpi">
                        <div className="au-kTitle">Meta</div>
                        <div className="au-kVal">{objetivo}</div>
                      </div>
                      <div className="au-kpi">
                        <div className="au-kTitle">Kcal</div>
                        <div className="au-kVal mono">{kcal}</div>
                      </div>
                      <div className="au-kpi">
                        <div className="au-kTitle">Macros</div>
                        <div className="au-kVal mono">
                          P {p} • C {c} • G {g}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="au-muted2">Entrenador • sin meta/macros</div>
                  )}
                </div>

                <div className="au-right">
                  <IconBtn title="Ver" onClick={() => onVer(u)}>👁</IconBtn>
                  <IconBtn title="Editar" onClick={() => onEditar(u)}>✏️</IconBtn>
                  <IconBtn title="Eliminar" danger onClick={() => onEliminar(u)}>🗑</IconBtn>
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

// ✅ Botón icon-only con tooltip
function IconBtn({ title, onClick, children, danger = false }) {
  return (
    <button className={`au-ibtn ${danger ? "danger" : ""}`} onClick={onClick} type="button">
      <span className="au-ico" aria-hidden="true">{children}</span>
      <span className="au-tip">{title}</span>
    </button>
  );
}

function initials(nombre = "", apellido = "") {
  const a = String(nombre || "").trim()[0] || "U";
  const b = String(apellido || "").trim()[0] || "X";
  return (a + b).toUpperCase();
}

const styles = `
.au-page{ max-width:1100px; margin:0 auto; padding:16px; color:#eaeaea; }
.au-head{ display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap; }
.au-title{ margin:0; font-size:34px; color:#f5d76e; letter-spacing:.2px; }
.au-sub{ margin-top:6px; opacity:.85; }
.au-headBtns{ display:flex; gap:10px; flex-wrap:wrap; }

.au-card{
  border:1px solid #1f1f1f;
  background: linear-gradient(180deg,#0b0b0b,#0b0b0bcc);
  border-radius:18px;
  padding:14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
}

.au-btn{
  padding:10px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  font-weight:900;
  cursor:pointer;
}
.au-btn:hover{ border-color: rgba(245,215,110,.25); }
.au-btn.gold{ border-color: rgba(245,215,110,.35); background: rgba(245,215,110,.06); color:#f5d76e; }

.au-filters{
  margin-top:14px;
  display:grid;
  grid-template-columns: 1.5fr .8fr .8fr .8fr auto;
  gap:12px;
  align-items:center;
}
.au-input,.au-select{
  width:100%;
  padding:10px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0b0b0b;
  color:#eaeaea;
  outline:none;
}
.au-input:focus,.au-select:focus{
  border-color: rgba(245,215,110,.5);
  box-shadow: 0 0 0 4px rgba(245,215,110,.12);
}

.au-row{ display:flex; justify-content:space-between; align-items:center; margin:10px 4px 0; }
.au-muted{ opacity:.8; font-weight:800; }
.au-muted2{ opacity:.75; font-weight:900; }
.au-err{ color:#ffb1b1; font-weight:900; }

.au-list{ margin-top:12px; display:grid; gap:12px; }
.au-empty{ opacity:.85; }

.au-item{
  display:grid;
  grid-template-columns: 1.2fr 1fr 170px;
  gap:14px;
  align-items:center;
}

.au-left{ display:flex; gap:12px; align-items:center; min-width:0; }
.au-avatar{
  width:52px; height:52px; border-radius:16px;
  display:flex; align-items:center; justify-content:center;
  font-weight:1000;
  color:#f5d76e;
  border:1px solid rgba(245,215,110,.35);
  background: rgba(245,215,110,.06);
  flex: 0 0 auto;
}
.au-main{ min-width:0; }
.au-name{ font-size:18px; font-weight:1000; }
.au-email{ opacity:.8; margin-top:3px; word-break:break-word; }

.au-badges{ display:flex; flex-wrap:wrap; gap:8px; margin-top:8px; }
.au-badge{
  font-size:12px; padding:6px 10px; border-radius:999px;
  border:1px solid #2b2b2b; background:#0f0f0f; font-weight:1000;
}
.au-badge.gold{ border-color: rgba(245,215,110,.35); color:#f5d76e; background: rgba(245,215,110,.05); }
.au-badge.ok{ border-color: rgba(80,220,140,.35); color:#a8f7cf; background: rgba(80,220,140,.07); }
.au-badge.danger{ border-color: rgba(255,80,80,.35); color:#ffb1b1; background: rgba(255,80,80,.08); }

.au-mid{
  display:flex;
  gap:14px;
  justify-content:flex-end;
  flex-wrap:wrap;
}
.au-kpi{ min-width:140px; text-align:right; }
.au-kTitle{ opacity:.75; font-weight:1000; font-size:12px; }
.au-kVal{ margin-top:6px; font-weight:1000; color:#f5d76e; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

.au-right{
  display:flex;
  justify-content:flex-end;
  gap:10px;
}
.au-ibtn{
  position:relative;
  width:44px; height:44px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  cursor:pointer;
  font-weight:1000;
  display:grid;
  place-items:center;
}
.au-ibtn:hover{ border-color: rgba(245,215,110,.25); }
.au-ibtn.danger{
  border-color: rgba(255,80,80,.35);
  background: rgba(255,80,80,.08);
}
.au-ico{ font-size:18px; line-height:1; }
.au-tip{
  position:absolute;
  bottom: -34px;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #1f1f1f;
  background: #0b0b0b;
  font-size: 12px;
  opacity: 0;
  pointer-events: none;
  transition: opacity .15s ease, transform .15s ease;
}
.au-ibtn:hover .au-tip{
  opacity: 1;
  transform: translateX(-50%) translateY(-2px);
}

@media (max-width: 980px){
  .au-filters{ grid-template-columns: 1fr 1fr; }
  .au-item{ grid-template-columns: 1fr; }
  .au-mid{ justify-content:flex-start; }
  .au-right{ justify-content:flex-start; }
  .au-kpi{ text-align:left; }
}
`;
