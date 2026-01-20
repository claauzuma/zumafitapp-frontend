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
          <option value="entrenador">entrenador</option>
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

            // ✅ meta/macros según tu estructura
            const isTrainer = t === "entrenador" || r === "entrenador";
            const objRaw = u?.objetivoActual?.objetivo || null;
            const objetivo = prettifyObjetivo(objRaw);

            const kcal = u?.metasActuales?.kcal ?? "—";
            const p = u?.metasActuales?.macros?.p ?? "—";
            const c = u?.metasActuales?.macros?.c ?? "—";
            const g = u?.metasActuales?.macros?.g ?? "—";

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
                      {u?.plan ? <span className="au-badge soft">{u.plan}</span> : null}
                    </div>
                  </div>
                </div>

                <div className="au-mid">
                  {isTrainer ? (
                    <div className="au-muted2">Entrenador • sin meta/macros</div>
                  ) : (
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

function prettifyObjetivo(v) {
  if (!v) return "—";
  const s = String(v);
  if (s === "perdida_grasa") return "Pérdida de grasa";
  if (s === "ganancia_muscular") return "Ganancia muscular";
  if (s === "mantenimiento") return "Mantenimiento";
  return s;
}

const styles = `
.au-page{
  max-width: 1100px;
  margin: 0 auto;
  padding: 10px 6px 30px;
  color: #eaeaea;
}
.au-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
  margin-bottom: 10px;
}
.au-title{ margin:0; font-size: 26px; letter-spacing:.2px; }
.au-sub{ color:#b9b9b9; font-weight:700; margin-top: 3px; }

.au-headBtns{ display:flex; gap:10px; }
.au-btn{
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #2b2b2b;
  background: #0f0f0f;
  color:#eaeaea;
  cursor:pointer;
  font-weight:900;
}
.au-btn.gold{
  border-color: rgba(245,215,110,.55);
  box-shadow: 0 0 0 3px rgba(245,215,110,.10);
  color:#f5d76e;
}

.au-card{
  background: #0f0f0f;
  border: 1px solid #242424;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0,0,0,.22);
}
.au-filters{
  display:grid;
  grid-template-columns: 1fr 180px 200px 180px auto;
  gap: 10px;
  padding: 12px;
  margin-bottom: 12px;
}
.au-input, .au-select{
  width:100%;
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid #2b2b2b;
  background: #0b0b0b;
  color:#eaeaea;
  font-weight:800;
  outline:none;
}
.au-input:focus, .au-select:focus{
  border-color: rgba(245,215,110,.55);
  box-shadow: 0 0 0 3px rgba(245,215,110,.12);
}

.au-row{ margin: 4px 2px 10px; }
.au-muted{ color:#b9b9b9; font-weight:800; }
.au-err{ color:#ff8b8b; font-weight:900; }

.au-list{ display:flex; flex-direction:column; gap: 10px; }
.au-empty{ padding: 16px; color:#b9b9b9; font-weight:900; }

.au-item{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
  padding: 12px;
}
.au-left{ display:flex; align-items:center; gap: 12px; min-width: 0; }
.au-avatar{
  width: 44px; height: 44px;
  border-radius: 14px;
  display:flex; align-items:center; justify-content:center;
  background: #141414;
  border: 1px solid #2a2a2a;
  color:#f5d76e;
  font-weight: 1000;
}
.au-main{ min-width: 0; }
.au-name{ font-weight: 1000; font-size: 16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.au-email{ color:#b9b9b9; font-weight:800; font-size: 13px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.au-badges{ display:flex; flex-wrap:wrap; gap: 6px; margin-top: 6px; }
.au-badge{
  font-weight: 1000;
  font-size: 12px;
  padding: 6px 8px;
  border-radius: 999px;
  border: 1px solid #2b2b2b;
  background:#0b0b0b;
}
.au-badge.gold{ color:#f5d76e; border-color: rgba(245,215,110,.5); }
.au-badge.ok{ border-color:#1e4a2c; background:#0b120d; }
.au-badge.danger{ border-color:#5a1f1f; background:#1a0b0b; }
.au-badge.soft{ border-color:#2b2b2b; background:#111; color:#cfcfcf; }

.au-mid{
  display:flex;
  gap: 14px;
  align-items:center;
  justify-content:flex-end;
  flex-wrap:wrap;
  flex: 1;
}
.au-kpi{ min-width: 150px; text-align:right; }
.au-kTitle{ color:#b9b9b9; font-weight:900; font-size: 12px; }
.au-kVal{ font-weight: 1000; margin-top: 2px; }
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

.au-muted2{ color:#b9b9b9; font-weight:900; }

.au-right{ display:flex; gap: 8px; align-items:center; }

.au-ibtn{
  position: relative;
  width: 40px; height: 40px;
  border-radius: 12px;
  border: 1px solid #2b2b2b;
  background:#0b0b0b;
  cursor:pointer;
  display:flex;
  align-items:center;
  justify-content:center;
}
.au-ibtn.danger{
  border-color:#5a1f1f;
  background:#1a0b0b;
}
.au-ico{ font-size: 16px; line-height: 1; }
.au-tip{
  position:absolute;
  bottom: -34px;
  left: 50%;
  transform: translateX(-50%);
  background:#0b0b0b;
  border: 1px solid #2b2b2b;
  padding: 6px 8px;
  border-radius: 10px;
  white-space:nowrap;
  font-weight: 900;
  font-size: 12px;
  color:#eaeaea;
  opacity: 0;
  pointer-events:none;
  transition: opacity .12s ease;
  box-shadow: 0 10px 30px rgba(0,0,0,.22);
}
.au-ibtn:hover .au-tip{ opacity: 1; }

@media (max-width: 980px){
  .au-filters{ grid-template-columns: 1fr 1fr; }
  .au-kpi{ min-width: unset; text-align:left; }
  .au-mid{ justify-content:flex-start; }
}
`;
