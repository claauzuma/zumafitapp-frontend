// src/AdminUsuarioDetalle.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { apiFetch } from "../Api.js";

/**
 * ✅ AdminUsuarioDetalle (PRO)
 * - Trae usuario real desde: GET /api/usuarios/admin/users/:id
 * - Muestra objetivo + metas generales (metasActuales + objetivoActual)
 * - Permite editar metas generales (PATCH /api/usuarios/admin/users/:id)
 * - Modal "Plan semanal (Lun–Vie)" con:
 *   - "Personalizado" (antes Override)
 *   - kcal auto = P*4 + C*4 + G*9
 *   - días Lunes..Viernes (sin mostrar fecha en UI, pero se usa internamente)
 *   - ✏️ Menú por día: abre drawer lateral dentro del mismo modal (sin apilar modales)
 * - Guarda overrides semanales en: user.metasDiarias (si no existe en backend, igual lo envía)
 *
 * 🔧 Si tu backend usa otra key para los overrides diarios:
 *   cambiá readDailyOverrides() y buildPatchForDailyOverrides()
 */

export default function AdminUsuarioDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [user, setUser] = useState(null);

  // UI state
  const [openWeekly, setOpenWeekly] = useState(false);
  const [weeklyDrawerDay, setWeeklyDrawerDay] = useState(null); // "YYYY-MM-DD" (selected day)
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [savingWeekly, setSavingWeekly] = useState(false);

  // editable general goal (local)
  const [editGeneral, setEditGeneral] = useState(false);
  const [gObjetivo, setGObjetivo] = useState("mantenimiento"); // perdida_grasa/ganancia_muscular/mantenimiento
  const [gKcal, setGKcal] = useState("");
  const [gP, setGP] = useState("");
  const [gC, setGC] = useState("");
  const [gG, setGG] = useState("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const data = await apiFetch(`/api/usuarios/admin/users/${id}`, {
        method: "GET",
        timeoutMs: 9000,
      });

      const u = data?.user || data;
      setUser(u);

      // precargar general
      const objetivo = u?.objetivoActual?.objetivo || "mantenimiento";
      const metas = u?.metasActuales || {};
      const macros = metas?.macros || {};

      setGObjetivo(objetivo || "mantenimiento");
      setGKcal(numToInput(metas?.kcal));
      setGP(numToInput(macros?.p));
      setGC(numToInput(macros?.c));
      setGG(numToInput(macros?.g));
    } catch (e) {
      setErr(e?.message || "No se pudo cargar el usuario");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ==========
  // Derived data
  // ==========
  const profile = user?.profile || {};
  const nombre = profile?.nombre || "—";
  const apellido = profile?.apellido || "";
  const email = user?.email || "—";
  const role = user?.role || "—";
  const tipo = user?.tipo || "—";
  const estado = user?.estado || "—";

  const objetivoActual = user?.objetivoActual?.objetivo || null; // "perdida_grasa" | "ganancia_muscular" | "mantenimiento"
  const metasActuales = user?.metasActuales || {};
  const macrosActuales = metasActuales?.macros || {};
  const kcalGeneral = metasActuales?.kcal ?? null;
  const pGeneral = macrosActuales?.p ?? null;
  const cGeneral = macrosActuales?.c ?? null;
  const gGeneral = macrosActuales?.g ?? null;

  const coach = user?.coach || null;

  const createdAt = fmtDate(user?.createdAt);
  const lastLoginAt = fmtDate(user?.lastLoginAt);
  const nacimiento = fmtDate(profile?.fechaNacimiento || profile?.nacimiento);

  const weekdays = useMemo(() => buildWeekdaysMonFri(), []);

  const dailyOverrides = useMemo(() => readDailyOverrides(user), [user]);

  // ==========
  // API updates
  // ==========
  async function patchUser(patch) {
    const data = await apiFetch(`/api/usuarios/admin/users/${id}`, {
      method: "PATCH",
      body: patch,
      timeoutMs: 12000,
    });
    return data?.user || data;
  }

  async function saveGeneral() {
    setSavingGeneral(true);
    setErr("");
    try {
      const patch = {
        objetivoActual: {
          ...(user?.objetivoActual || {}),
          objetivo: gObjetivo || null,
          updatedAt: new Date().toISOString(),
        },
        metasActuales: {
          ...(user?.metasActuales || {}),
          kcal: inputToNumOrNull(gKcal),
          macros: {
            p: inputToNumOrNull(gP),
            c: inputToNumOrNull(gC),
            g: inputToNumOrNull(gG),
          },
          updatedAt: new Date().toISOString(),
        },
      };

      const u2 = await patchUser(patch);
      setUser(u2);
      setEditGeneral(false);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar metas generales");
    } finally {
      setSavingGeneral(false);
    }
  }

  async function saveWeeklyOverrides(overridesMap) {
    // overridesMap: { "YYYY-MM-DD": { kcal, macros:{p,c,g} } }
    setSavingWeekly(true);
    setErr("");
    try {
      const patch = buildPatchForDailyOverrides(user, overridesMap);
      const u2 = await patchUser(patch);
      setUser(u2);
      setOpenWeekly(false);
      setWeeklyDrawerDay(null);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar metas diarias");
    } finally {
      setSavingWeekly(false);
    }
  }

  // ==========
  // Menu edit actions (drawer)
  // ==========
  function openMenuEditorForDay(date) {
    setWeeklyDrawerDay(date);
  }

  function goToMenuDayPage(date) {
    // Si preferís editar menú en otra pantalla (recomendado para “modo pro”):
    // implementá una ruta y navegá con date en query.
    navigate(`/admin/usuarios/${id}/menu?date=${encodeURIComponent(date)}`);
  }

  // ==========
  // Render
  // ==========
  if (loading) {
    return (
      <div className="zu-page">
        <div className="zu-card">Cargando usuario…</div>
        <style>{styles}</style>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="zu-page">
        <div className="zu-top">
          <button className="zu-btn" onClick={() => navigate("/admin/usuarios")}>
            ← Volver
          </button>
        </div>
        <div className="zu-card">
          <b>No se pudo cargar.</b>
          <div style={{ marginTop: 8, opacity: 0.85 }}>{err || "—"}</div>
          <div style={{ marginTop: 12 }}>
            <button className="zu-btn gold" onClick={load}>
              Reintentar
            </button>
          </div>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="zu-page">
      {/* Top */}
      <div className="zu-top">
        <button className="zu-btn" onClick={() => navigate("/admin/usuarios")}>
          ← Volver
        </button>

        <div className="zu-actions">
          <button className="zu-btn" onClick={() => load()}>
            ↻ Refrescar
          </button>
          <button className="zu-btn gold" onClick={() => setOpenWeekly(true)}>
            🎯 Plan semanal (Lun–Vie)
          </button>
          <button className="zu-btn danger" onClick={() => alert("TODO: bloquear usuario (PATCH estado=bloqueado)")}>
            ⛔ Bloquear
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="zu-card zu-header">
        <div className="zu-avatar">{initials(nombre, apellido)}</div>

        <div className="zu-headInfo">
          <div className="zu-name">
            {nombre} {apellido}
          </div>
          <div className="zu-sub">
            <span className="mono">{email}</span>
            <span className="dot">•</span>
            <span className="mono">ID: {user?.id || user?._id || id}</span>
          </div>

          <div className="zu-badges">
            {badge(role, role === "admin" ? "gold" : "base")}
            {badge(tipo || "—", "base")}
            {badge(estado || "activo", estado === "bloqueado" ? "danger" : "ok")}
            {coach?.entrenadorId ? badge("Coach asignado", "info") : null}
          </div>
        </div>

        <div className="zu-meta">
          <div className="zu-metaRow">
            <span>Alta</span>
            <b>{createdAt}</b>
          </div>
          <div className="zu-metaRow">
            <span>Último login</span>
            <b>{lastLoginAt}</b>
          </div>
          <div className="zu-metaRow">
            <span>Nacimiento</span>
            <b>{nacimiento}</b>
          </div>
        </div>
      </div>

      {/* Goal summary (AL PRINCIPIO como pediste) */}
      <div className="zu-grid two">
        <div className="zu-card">
          <div className="zu-row">
            <div className="zu-cardTitle">Objetivo + metas generales</div>
            <div className="zu-rowRight">
              <button className="zu-btn sm" onClick={() => setEditGeneral((v) => !v)}>
                {editGeneral ? "Cerrar" : "✏️ Editar"}
              </button>
              <button className="zu-btn sm gold" onClick={() => setOpenWeekly(true)}>
                Ver metas diarias
              </button>
            </div>
          </div>

          <div className="zu-goalGrid">
            <div className="zu-goalBox">
              <div className="zu-kTitle">Meta (objetivo)</div>
              <div className="zu-kVal">{goalLabel(objetivoActual)}</div>
            </div>

            <div className="zu-goalBox">
              <div className="zu-kTitle">Kcal</div>
              <div className="zu-kVal mono">{fmtNumOrDash(kcalGeneral)}</div>
            </div>

            <div className="zu-goalBox">
              <div className="zu-kTitle">Macros</div>
              <div className="zu-kVal mono">
                P {fmtNumOrDash(pGeneral)} • C {fmtNumOrDash(cGeneral)} • G {fmtNumOrDash(gGeneral)}
              </div>
            </div>
          </div>

          {editGeneral ? (
            <div className="zu-editGeneral">
              <div className="zu-formRow">
                <label className="zu-label">
                  Objetivo
                  <select className="zu-input" value={gObjetivo} onChange={(e) => setGObjetivo(e.target.value)}>
                    <option value="perdida_grasa">Pérdida de grasa</option>
                    <option value="ganancia_muscular">Ganancia muscular</option>
                    <option value="mantenimiento">Mantenimiento</option>
                  </select>
                </label>

                <label className="zu-label">
                  Kcal
                  <input className="zu-input" value={gKcal} onChange={(e) => setGKcal(sanitizeNumInput(e.target.value))} placeholder="—" />
                </label>
              </div>

              <div className="zu-formRow">
                <label className="zu-label">
                  Proteína (P)
                  <input className="zu-input" value={gP} onChange={(e) => setGP(sanitizeNumInput(e.target.value))} placeholder="—" />
                </label>
                <label className="zu-label">
                  Carbs (C)
                  <input className="zu-input" value={gC} onChange={(e) => setGC(sanitizeNumInput(e.target.value))} placeholder="—" />
                </label>
                <label className="zu-label">
                  Grasas (G)
                  <input className="zu-input" value={gG} onChange={(e) => setGG(sanitizeNumInput(e.target.value))} placeholder="—" />
                </label>
              </div>

              <div className="zu-miniNote">
                Tip: si cargás macros, podés mantener kcal vacío y calcularlo luego. (Tu app puede autocalcular también.)
              </div>

              <div className="zu-modalBtns">
                <button className="zu-btn" onClick={() => setEditGeneral(false)} disabled={savingGeneral}>
                  Cancelar
                </button>
                <button className="zu-btn gold" onClick={saveGeneral} disabled={savingGeneral}>
                  {savingGeneral ? "Guardando…" : "Guardar metas generales"}
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="zu-card">
          <div className="zu-cardTitle">Acciones rápidas</div>
          <div className="zu-quick">
            <button className="zu-btn" onClick={() => alert("TODO: asignar rutina")}>
              🏋️ Asignar rutina
            </button>
            <button className="zu-btn" onClick={() => alert("TODO: ver historial comidas")}>
              📚 Historial comidas
            </button>
            <button className="zu-btn" onClick={() => alert("TODO: ver progreso/estadísticas")}>
              📈 Progreso
            </button>
            <button className="zu-btn" onClick={() => alert("TODO: ver como usuario")}>
              👤 Ver como usuario
            </button>
          </div>
          {err ? <div className="zu-formErr">• {err}</div> : null}
        </div>
      </div>

      {/* ============= MODAL: Plan semanal ============= */}
      {openWeekly ? (
        <Modal onClose={() => { setOpenWeekly(false); setWeeklyDrawerDay(null); }}>
          <div className="zu-modalHead">
            <div>
              <div className="zu-modalTitle">Metas semanales (Lunes a Viernes)</div>
              <div className="zu-modalSub">
                Si un día está en <b>Personalizado</b>, se usa esa meta. Si no, usa la meta general.
              </div>
            </div>
            <button className="zu-x" onClick={() => { setOpenWeekly(false); setWeeklyDrawerDay(null); }} title="Cerrar">
              ✕
            </button>
          </div>

          <div className="zu-weekShell">
            {/* LEFT: table */}
            <div className="zu-weekLeft">
              <DailyGoalsWeekTable
                weekdays={weekdays}
                general={{
                  kcal: kcalGeneral,
                  p: pGeneral,
                  c: cGeneral,
                  g: gGeneral,
                  objetivo: objetivoActual,
                }}
                initialOverrides={dailyOverrides}
                saving={savingWeekly}
                onCancel={() => { setOpenWeekly(false); setWeeklyDrawerDay(null); }}
                onSave={saveWeeklyOverrides}
                onEditDayMenu={(date) => openMenuEditorForDay(date)}
              />
            </div>

            {/* RIGHT: drawer panel (same modal, no stack) */}
            <div className={`zu-weekRight ${weeklyDrawerDay ? "open" : ""}`}>
              <div className="zu-drawerHead">
                <div className="zu-drawerTitle">
                  Menú del día{" "}
                  <span className="mono" style={{ opacity: 0.8, marginLeft: 8 }}>
                    {weeklyDrawerDay ? dayLabelFromDate(weeklyDrawerDay) : ""}
                  </span>
                </div>
                <button className="zu-iconMini" onClick={() => setWeeklyDrawerDay(null)} title="Cerrar panel">
                  ✕
                </button>
              </div>

              {!weeklyDrawerDay ? (
                <div className="zu-drawerEmpty">
                  Tocá <b>✏️</b> en un día para editar el menú.
                </div>
              ) : (
                <DayMenuEditorStub
                  userId={user?.id || user?._id || id}
                  date={weeklyDrawerDay}
                  onGoFullEditor={() => goToMenuDayPage(weeklyDrawerDay)}
                />
              )}
            </div>
          </div>
        </Modal>
      ) : null}

      <style>{styles}</style>
    </div>
  );
}

/* =========================
   Weekly table component
========================= */
function DailyGoalsWeekTable({ weekdays, general, initialOverrides, saving, onCancel, onSave, onEditDayMenu }) {
  const [rows, setRows] = useState(() => {
    const src = initialOverrides || {};
    return weekdays.map((d) => {
      const ov = src?.[d.date] || null;
      return {
        date: d.date,
        label: d.label,
        enabled: !!ov, // Personalizado Sí/No
        p: numToInput(ov?.macros?.p ?? ""),
        c: numToInput(ov?.macros?.c ?? ""),
        g: numToInput(ov?.macros?.g ?? ""),
      };
    });
  });

  const [err, setErr] = useState("");

  function toggle(date) {
    setRows((prev) => prev.map((r) => (r.date === date ? { ...r, enabled: !r.enabled } : r)));
  }

  function setField(date, key, val) {
    setRows((prev) =>
      prev.map((r) => (r.date === date ? { ...r, [key]: sanitizeNumInput(val) } : r))
    );
  }

  function kcalFromRow(r) {
    const hasAny = r.p !== "" || r.c !== "" || r.g !== "";
    if (!hasAny) return null;

    const P = Number(r.p);
    const C = Number(r.c);
    const G = Number(r.g);

    const pOk = Number.isFinite(P) ? P : 0;
    const cOk = Number.isFinite(C) ? C : 0;
    const gOk = Number.isFinite(G) ? G : 0;

    return Math.round(pOk * 4 + cOk * 4 + gOk * 9);
  }

  async function submit() {
    setErr("");
    try {
      const overrides = {};
      for (const r of rows) {
        if (!r.enabled) continue;

        const kcalCalc = kcalFromRow(r);
        overrides[r.date] = {
          kcal: kcalCalc,
          macros: {
            p: r.p !== "" ? Number(r.p) : null,
            c: r.c !== "" ? Number(r.c) : null,
            g: r.g !== "" ? Number(r.g) : null,
          },
        };
      }
      await onSave(overrides);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar");
    }
  }

  return (
    <div>
      <div className="zu-generalStrip">
        <div className="zu-generalTitle">Meta general actual</div>
        <div className="zu-generalVal mono">
          {goalLabel(general.objetivo)} • kcal {fmtNumOrDash(general.kcal)} • P {fmtNumOrDash(general.p)} • C{" "}
          {fmtNumOrDash(general.c)} • G {fmtNumOrDash(general.g)}
        </div>
      </div>

      <div className="zu-weekTable">
        <div className="zu-weekHead">
          <div>Día</div>
          <div>Personalizado</div>
          <div>P</div>
          <div>C</div>
          <div>G</div>
          <div>Kcal (auto)</div>
          <div />
        </div>

        {rows.map((r) => {
          const kcalAuto = r.enabled ? kcalFromRow(r) : null;

          return (
            <div key={r.date} className={`zu-weekRow ${r.enabled ? "on" : ""}`}>
              <div className="zu-day">
                <div className="zu-dayName">{r.label}</div>
              </div>

              <div className="zu-personalizado">
                <button
                  className={`zu-pillBtn ${r.enabled ? "on" : ""}`}
                  onClick={() => toggle(r.date)}
                  type="button"
                  title={r.enabled ? "Usa metas personalizadas" : "Usa metas generales"}
                >
                  {r.enabled ? "Sí" : "No"}
                </button>
              </div>

              <input
                className="zu-input sm"
                disabled={!r.enabled}
                value={r.p}
                onChange={(e) => setField(r.date, "p", e.target.value)}
                placeholder={fmtNumOrDash(general.p)}
              />
              <input
                className="zu-input sm"
                disabled={!r.enabled}
                value={r.c}
                onChange={(e) => setField(r.date, "c", e.target.value)}
                placeholder={fmtNumOrDash(general.c)}
              />
              <input
                className="zu-input sm"
                disabled={!r.enabled}
                value={r.g}
                onChange={(e) => setField(r.date, "g", e.target.value)}
                placeholder={fmtNumOrDash(general.g)}
              />

              <div className="zu-kcalAuto mono" title="Kcal = P*4 + C*4 + G*9">
                {r.enabled ? fmtNumOrDash(kcalAuto) : fmtNumOrDash(general.kcal)}
              </div>

              <div className="zu-actionsCell">
                <button
                  className="zu-iconMini"
                  type="button"
                  title="Editar menú del día"
                  onClick={() => onEditDayMenu?.(r.date)}
                >
                  ✏️
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {err ? <div className="zu-formErr">• {err}</div> : null}

      <div className="zu-modalBtns">
        <button className="zu-btn" onClick={onCancel} disabled={saving}>
          Cerrar
        </button>
        <button className="zu-btn gold" onClick={submit} disabled={saving}>
          {saving ? "Guardando…" : "Guardar semana"}
        </button>
      </div>
    </div>
  );
}

/* =========================
   Drawer menu editor (stub pro)
   - NO abre otro modal
   - Si querés, acá lo conectamos a tu colección de comidas por fecha
========================= */
function DayMenuEditorStub({ userId, date, onGoFullEditor }) {
  const dayLabel = dayLabelFromDate(date);

  return (
    <div className="zu-drawerBody">
      <div className="zu-drawerCard">
        <div className="zu-cardTitle" style={{ marginBottom: 6 }}>
          {dayLabel}
        </div>
        <div style={{ opacity: 0.85 }}>
          Acá editás el menú del día (comidas + items). Para que quede realmente pro, lo ideal es editar el menú
          en una pantalla dedicada (más espacio, mejor UX).
        </div>

        <div className="zu-miniNote" style={{ marginTop: 10 }}>
          Usuario: <span className="mono">{String(userId)}</span>
          <br />
          Fecha: <span className="mono">{String(date)}</span>
        </div>

        <div className="zu-drawerBtns">
          <button className="zu-btn sm" onClick={() => alert("TODO: cargar menú del día desde backend")}>
            📥 Cargar menú
          </button>
          <button className="zu-btn sm" onClick={() => alert("TODO: guardar cambios del menú en backend")}>
            💾 Guardar menú
          </button>
          <button className="zu-btn sm gold" onClick={onGoFullEditor}>
            🧩 Abrir editor completo
          </button>
        </div>

        <div className="zu-divider" />

        <div style={{ opacity: 0.85 }}>
          <b>Idea pro:</b> “Editor completo” con secciones por comida (Desayuno/Almuerzo/Merienda/Cena) + duplicar
          desde plantilla + recalcular macros por día.
        </div>
      </div>
    </div>
  );
}

/* =========================
   Modal
========================= */
function Modal({ children, onClose }) {
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="zu-modalBackdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="zu-modal">{children}</div>
    </div>
  );
}

/* =========================
   Helpers: daily overrides mapping
========================= */
function readDailyOverrides(user) {
  // ✅ tolerante: si lo guardás en otro lugar, sumá acá.
  const a = user?.metasDiarias;
  const b = user?.settings?.metasDiarias;
  const c = user?.metas?.diarias;
  const src = a || b || c || {};
  return src && typeof src === "object" ? src : {};
}

function buildPatchForDailyOverrides(user, overridesMap) {
  // ✅ default: guardamos en user.metasDiarias
  // si preferís settings.metasDiarias -> devolvé { settings: { ...user.settings, metasDiarias: overridesMap } }
  return { metasDiarias: overridesMap };
}

/* =========================
   Helpers UI
========================= */
function badge(text, tone = "base") {
  return <span className={`zu-badge ${tone}`}>{text}</span>;
}

function initials(nombre = "", apellido = "") {
  const a = String(nombre || "").trim()[0] || "U";
  const b = String(apellido || "").trim()[0] || "X";
  return (a + b).toUpperCase();
}

function fmtNumOrDash(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return String(n);
}

function numToInput(v) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function sanitizeNumInput(x) {
  const s = String(x ?? "");
  // deja solo dígitos
  return s.replace(/[^\d]/g, "");
}

function inputToNumOrNull(x) {
  const s = String(x ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function fmtDate(v) {
  if (!v) return "—";
  try {
    const d = new Date(v);
    if (!Number.isFinite(d.getTime())) return String(v);
    return d.toISOString().slice(0, 10);
  } catch {
    return String(v);
  }
}

function goalLabel(obj) {
  if (!obj) return "—";
  if (obj === "perdida_grasa") return "Pérdida de grasa";
  if (obj === "ganancia_muscular") return "Ganancia muscular";
  if (obj === "mantenimiento") return "Mantenimiento";
  return String(obj);
}

/* =========================
   Week helpers (Mon–Fri)
========================= */
function buildWeekdaysMonFri() {
  const now = new Date();
  const day = now.getDay(); // 0 dom ... 1 lun ... 6 sab
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);

  const names = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes"];
  const out = [];

  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out.push({
      date: d.toISOString().slice(0, 10),
      label: names[i],
    });
  }
  return out;
}

function dayLabelFromDate(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    const wd = d.getDay(); // 0 dom ... 1 lun ...
    const map = { 1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 0: "Domingo" };
    return map[wd] || iso;
  } catch {
    return iso;
  }
}

/* =========================
   Styles (black + gold PRO)
========================= */
const styles = `
.zu-page{
  max-width: 1100px;
  margin: 0 auto;
  padding: 16px;
  color: #eaeaea;
}

.zu-top{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.zu-actions{ display:flex; gap:10px; flex-wrap:wrap; }

.zu-card{
  border: 1px solid #1f1f1f;
  background: linear-gradient(180deg,#0b0b0b,#0b0b0bcc);
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
}

.zu-header{
  display:grid;
  grid-template-columns: 72px 1fr 260px;
  gap: 14px;
  align-items:center;
}

.zu-avatar{
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight: 900;
  color: #f5d76e;
  border: 1px solid rgba(245,215,110,.35);
  background: rgba(245,215,110,.06);
}

.zu-name{
  font-size: 20px;
  font-weight: 900;
  color: #f5d76e;
}
.zu-sub{
  margin-top: 6px;
  opacity: .85;
  display:flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items:center;
}
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }
.dot{ opacity: .6; }
.zu-badges{ display:flex; flex-wrap:wrap; gap: 8px; margin-top: 10px; }

.zu-badge{
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid #2b2b2b;
  background: #0f0f0f;
  font-weight: 900;
}
.zu-badge.gold{ border-color: rgba(245,215,110,.35); color:#f5d76e; background: rgba(245,215,110,.05); }
.zu-badge.ok{ border-color: rgba(80,220,140,.35); color:#a8f7cf; background: rgba(80,220,140,.07); }
.zu-badge.danger{ border-color: rgba(255,80,80,.35); color:#ffb1b1; background: rgba(255,80,80,.08); }
.zu-badge.info{ border-color: rgba(120,180,255,.35); color:#b9d7ff; background: rgba(120,180,255,.08); }

.zu-meta{
  border-left: 1px solid #1f1f1f;
  padding-left: 12px;
  display:grid;
  gap: 8px;
}
.zu-metaRow{ display:flex; align-items:center; justify-content: space-between; gap: 10px; opacity: .9; }
.zu-metaRow span{ opacity: .75; }

.zu-btn{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #2b2b2b;
  background: #0f0f0f;
  color: #eaeaea;
  font-weight: 900;
  cursor: pointer;
}
.zu-btn:hover{ border-color: rgba(245,215,110,.25); }
.zu-btn.gold{ border-color: rgba(245,215,110,.35); background: rgba(245,215,110,.06); color:#f5d76e; }
.zu-btn.danger{ border-color: rgba(255,80,80,.35); background: rgba(255,80,80,.08); }
.zu-btn.sm{ padding: 8px 10px; border-radius: 12px; font-weight: 800; }

.zu-grid{ display:grid; gap: 12px; margin-top: 12px; }
.zu-grid.two{ grid-template-columns: 1.15fr .85fr; }

.zu-cardTitle{ font-weight: 1000; color: #f5d76e; margin-bottom: 10px; }

.zu-row{ display:flex; align-items:center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.zu-rowRight{ display:flex; gap: 10px; flex-wrap: wrap; }

.zu-kTitle{ opacity:.75; font-weight: 1000; font-size: 12px; }
.zu-kVal{ margin-top: 6px; font-weight: 1000; color:#f5d76e; }

.zu-goalGrid{
  display:grid;
  grid-template-columns: 1fr 180px 1.2fr;
  gap: 12px;
  margin-top: 10px;
}
.zu-goalBox{
  border:1px solid #1f1f1f;
  border-radius: 16px;
  background: #0f0f0f;
  padding: 12px;
}

.zu-editGeneral{
  margin-top: 12px;
  border-top: 1px solid #1f1f1f;
  padding-top: 12px;
}
.zu-formRow{
  display:grid;
  grid-template-columns: 1fr 220px;
  gap: 12px;
  margin-top: 10px;
}
.zu-label{ display:grid; gap: 8px; font-weight: 900; opacity:.9; }
.zu-input{
  width: 100%;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid #2b2b2b;
  background: #0b0b0b;
  color: #eaeaea;
  outline: none;
}
.zu-input:focus{
  border-color: rgba(245,215,110,.5);
  box-shadow: 0 0 0 4px rgba(245,215,110,.12);
}
.zu-miniNote{
  margin-top: 10px;
  opacity:.85;
  border: 1px solid #1f1f1f;
  background: rgba(245,215,110,.06);
  padding: 12px;
  border-radius: 16px;
}
.zu-formErr{
  margin-top: 10px;
  color:#ffb1b1;
  font-weight: 1000;
}

.zu-quick{ display:grid; gap: 10px; grid-template-columns: 1fr 1fr; }

.zu-modalBackdrop{
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,.65);
  display:flex;
  align-items:center;
  justify-content:center;
  padding: 16px;
  z-index: 9999;
}
.zu-modal{
  width: min(1100px, 100%);
  max-height: min(88vh, 900px);
  overflow: hidden;
  border-radius: 20px;
  border: 1px solid #1f1f1f;
  background: linear-gradient(180deg,#0b0b0b,#070707);
  box-shadow: 0 20px 60px rgba(0,0,0,.6);
  display:flex;
  flex-direction: column;
}
.zu-modalHead{
  display:flex;
  align-items:flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid #141414;
}
.zu-modalTitle{
  font-weight: 1000;
  color:#f5d76e;
  font-size: 18px;
}
.zu-modalSub{ opacity:.85; margin-top: 6px; }
.zu-x{
  width: 44px; height: 44px;
  border-radius: 14px;
  border: 1px solid #2b2b2b;
  background:#0f0f0f;
  color:#eaeaea;
  cursor:pointer;
  font-weight:1000;
}
.zu-x:hover{ border-color: rgba(245,215,110,.25); }

.zu-weekShell{
  display:grid;
  grid-template-columns: 1.2fr .8fr;
  gap: 0;
  min-height: 0;
  flex: 1;
}
.zu-weekLeft{
  padding: 14px;
  overflow:auto;
}
.zu-weekRight{
  border-left: 1px solid #141414;
  padding: 14px;
  overflow:auto;
  background: rgba(255,255,255,.02);
}
.zu-weekRight.open{
  box-shadow: inset 0 0 0 1px rgba(245,215,110,.08);
}

.zu-generalStrip{
  border: 1px solid #1f1f1f;
  background: rgba(245,215,110,.06);
  padding: 12px;
  border-radius: 16px;
  margin-bottom: 12px;
}
.zu-generalTitle{ font-weight: 1000; color:#f5d76e; }
.zu-generalVal{ margin-top: 6px; opacity:.9; }

.zu-weekTable{ margin-top:12px; display:grid; gap:10px; }
.zu-weekHead{
  display:grid;
  grid-template-columns: 1.2fr 140px 90px 90px 90px 140px 56px;
  gap:10px;
  font-weight:1000; opacity:.8;
  padding: 0 6px;
}
.zu-weekRow{
  display:grid;
  grid-template-columns: 1.2fr 140px 90px 90px 90px 140px 56px;
  gap:10px;
  align-items:center;
  border:1px solid #1f1f1f;
  border-radius: 16px;
  background: #0f0f0f;
  padding: 12px;
}
.zu-weekRow.on{
  border-color: rgba(120,180,255,.25);
  box-shadow: 0 0 0 4px rgba(120,180,255,.06);
}
.zu-dayName{ font-weight:1000; }

.zu-input.sm{ padding:10px 10px; border-radius:12px; }

.zu-kcalAuto{
  border:1px solid #1f1f1f;
  background: rgba(245,215,110,.06);
  padding: 10px 10px;
  border-radius: 12px;
  text-align:center;
  font-weight:1000;
  color:#f5d76e;
}

.zu-personalizado{ display:flex; align-items:center; }
.zu-pillBtn{
  width: 86px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid #2b2b2b;
  background: #0b0b0b;
  color:#eaeaea;
  cursor:pointer;
  font-weight:1000;
}
.zu-pillBtn.on{
  border-color: rgba(120,180,255,.35);
  background: rgba(120,180,255,.08);
  color:#b9d7ff;
}
.zu-pillBtn:hover{ border-color: rgba(245,215,110,.25); }

.zu-actionsCell{ display:flex; justify-content:flex-end; }
.zu-iconMini{
  width:44px; height:44px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0b0b0b;
  cursor:pointer;
  font-weight:1000;
  color:#eaeaea;
}
.zu-iconMini:hover{ border-color: rgba(245,215,110,.25); }

.zu-modalBtns{
  display:flex;
  justify-content:flex-end;
  gap: 10px;
  margin-top: 12px;
  flex-wrap: wrap;
}

.zu-drawerHead{
  display:flex;
  align-items:center;
  justify-content: space-between;
  gap: 10px;
}
.zu-drawerTitle{
  font-weight: 1000;
  color:#f5d76e;
}
.zu-drawerEmpty{
  margin-top: 12px;
  opacity: .85;
  border: 1px dashed #2b2b2b;
  border-radius: 16px;
  padding: 14px;
}
.zu-drawerBody{ margin-top: 12px; }
.zu-drawerCard{
  border: 1px solid #1f1f1f;
  border-radius: 16px;
  background: #0f0f0f;
  padding: 12px;
}
.zu-drawerBtns{ display:flex; gap:10px; flex-wrap:wrap; margin-top: 12px; }
.zu-divider{ height: 1px; background: #141414; margin: 12px 0; }

@media (max-width: 980px){
  .zu-header{ grid-template-columns: 72px 1fr; }
  .zu-meta{ border-left: none; padding-left: 0; border-top: 1px solid #1f1f1f; padding-top: 12px; grid-column: 1 / -1; }

  .zu-grid.two{ grid-template-columns: 1fr; }
  .zu-goalGrid{ grid-template-columns: 1fr; }
  .zu-formRow{ grid-template-columns: 1fr; }

  .zu-weekShell{ grid-template-columns: 1fr; }
  .zu-weekRight{ border-left: none; border-top: 1px solid #141414; }

  .zu-weekHead, .zu-weekRow{
    grid-template-columns: 1fr 140px 1fr 1fr 1fr;
  }
  .zu-weekHead div:nth-child(6), .zu-weekHead div:nth-child(7){ display:none; }
  .zu-weekRow .zu-kcalAuto, .zu-weekRow .zu-actionsCell{ display:none; }
}

@media (max-width: 520px){
  .zu-quick{ grid-template-columns: 1fr; }
}
`;
