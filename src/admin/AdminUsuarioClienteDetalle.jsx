import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  updateAdminUserGoals,
  assignCoachToClient,
  unassignCoachFromClient,
  updateAdminUserStatus,
  updateAdminUserPlan,
  getAdminCoaches,
  getAdminUserById,
  deleteAdminUser,
} from "./adminUsuariosApi.js";
import "./adminUsuarioCliente.css";

export default function AdminUsuarioClienteDetalle({ user, onUserChange }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("resumen");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const [gObjetivo, setGObjetivo] = useState(user?.goal?.type || "mantener_peso");
  const [gKcal, setGKcal] = useState(numToInput(user?.metasActuales?.kcal));
  const [gP, setGP] = useState(numToInput(user?.metasActuales?.macros?.p));
  const [gC, setGC] = useState(numToInput(user?.metasActuales?.macros?.c));
  const [gG, setGG] = useState(numToInput(user?.metasActuales?.macros?.g));

  const [coachQuery, setCoachQuery] = useState("");
  const [coachOptions, setCoachOptions] = useState([]);
  const [coachesLoading, setCoachesLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState(null);

  const [assignedCoach, setAssignedCoach] = useState(null);
  const [assignedCoachLoading, setAssignedCoachLoading] = useState(false);

  const tabs = [
    { key: "resumen", label: "Resumen" },
    { key: "nutricion", label: "Nutrición" },
    { key: "rutina", label: "Rutina" },
    { key: "progreso", label: "Progreso" },
    { key: "relacion", label: "Relación" },
    { key: "cuenta", label: "Cuenta" },
  ];

  const assignedCoachId = user?.coach?.entrenadorId || null;

  useEffect(() => {
    setGObjetivo(user?.goal?.type || "mantener_peso");
    setGKcal(numToInput(user?.metasActuales?.kcal));
    setGP(numToInput(user?.metasActuales?.macros?.p));
    setGC(numToInput(user?.metasActuales?.macros?.c));
    setGG(numToInput(user?.metasActuales?.macros?.g));
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    async function loadAssignedCoach() {
      if (!assignedCoachId) {
        setAssignedCoach(null);
        return;
      }

      try {
        setAssignedCoachLoading(true);
        const coach = await getAdminUserById(assignedCoachId);
        if (!cancelled) {
          setAssignedCoach(coach || null);
        }
      } catch {
        if (!cancelled) {
          setAssignedCoach(null);
        }
      } finally {
        if (!cancelled) {
          setAssignedCoachLoading(false);
        }
      }
    }

    loadAssignedCoach();

    return () => {
      cancelled = true;
    };
  }, [assignedCoachId]);

  useEffect(() => {
    let cancelled = false;

    const timer = setTimeout(async () => {
      if (activeTab !== "relacion") return;
      if (!dropdownOpen && !coachQuery.trim()) return;

      try {
        setCoachesLoading(true);
        const coaches = await getAdminCoaches(coachQuery.trim());
        if (!cancelled) {
          setCoachOptions(Array.isArray(coaches) ? coaches : []);
        }
      } catch {
        if (!cancelled) {
          setCoachOptions([]);
        }
      } finally {
        if (!cancelled) {
          setCoachesLoading(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [coachQuery, activeTab, dropdownOpen]);

  const coachActualNombre = useMemo(() => {
    if (!assignedCoach) return "—";
    return fullName(assignedCoach);
  }, [assignedCoach]);

  async function handleSaveGoals() {
    setSaving(true);
    setErr("");
    try {
      const updated = await updateAdminUserGoals(user.id, {
        goal: {
          ...(user?.goal || {}),
          type: gObjetivo || null,
        },
        metasActuales: {
          ...(user?.metasActuales || {}),
          kcal: inputToNumOrNull(gKcal),
          macros: {
            p: inputToNumOrNull(gP),
            c: inputToNumOrNull(gC),
            g: inputToNumOrNull(gG),
          },
        },
      });

      onUserChange(updated);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  async function handleBlock() {
    try {
      setErr("");
      const next = user?.estado === "bloqueado" ? "activo" : "bloqueado";
      const updated = await updateAdminUserStatus(user.id, next);
      onUserChange(updated);
    } catch (e) {
      setErr(e?.message || "No se pudo cambiar el estado");
    }
  }

  async function handlePlanChange(plan) {
    try {
      setErr("");
      const updated = await updateAdminUserPlan(user.id, plan);
      onUserChange(updated);
    } catch (e) {
      setErr(e?.message || "No se pudo cambiar el plan");
    }
  }

  async function handleAssignCoach() {
    try {
      setErr("");

      if (!selectedCoach?.id) {
        setErr("Primero elegí un coach de la lista.");
        return;
      }

      const updated = await assignCoachToClient(user.id, selectedCoach.id);
      onUserChange(updated);
      setAssignedCoach(selectedCoach);
      setCoachQuery("");
      setSelectedCoach(null);
      setDropdownOpen(false);
    } catch (e) {
      setErr(e?.message || "No se pudo asignar coach");
    }
  }

  async function handleUnassignCoach() {
    try {
      setErr("");
      const updated = await unassignCoachFromClient(user.id);
      onUserChange(updated);
      setAssignedCoach(null);
      setCoachQuery("");
      setSelectedCoach(null);
      setDropdownOpen(false);
    } catch (e) {
      setErr(e?.message || "No se pudo quitar el coach");
    }
  }

  async function handleDeleteUser() {
    const ok = window.confirm(
      `¿Seguro que querés eliminar a ${fullName(user)}?\n\nEsta acción borra el usuario de la base de datos.`
    );

    if (!ok) return;

    try {
      setErr("");
      await deleteAdminUser(user.id);
      navigate("/admin/usuarios");
    } catch (e) {
      setErr(e?.message || "No se pudo eliminar el usuario");
    }
  }

  function handleCoachInputChange(e) {
    setCoachQuery(e.target.value);
    setSelectedCoach(null);
    setDropdownOpen(true);
  }

  function handleSelectCoach(coach) {
    setSelectedCoach(coach);
    setCoachQuery(formatCoachOption(coach));
    setDropdownOpen(false);
  }

  function handleCoachInputFocus() {
    setDropdownOpen(true);
  }

  function handleCoachInputBlur() {
    setTimeout(() => {
      setDropdownOpen(false);
    }, 180);
  }

  return (
    <div className="auc-wrap">
      <div className="auc-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`auc-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resumen" && (
        <div className="auc-grid">
          <div className="auc-card">
            <div className="auc-title">Resumen del cliente</div>

            <div className="auc-summaryGrid">
              <div className="auc-summaryItem">
                <span className="auc-summaryLabel">Objetivo</span>
                <strong>{goalLabel(user?.goal?.type)}</strong>
              </div>

              <div className="auc-summaryItem">
                <span className="auc-summaryLabel">Kcal</span>
                <strong>{fmtNumOrDash(user?.metasActuales?.kcal)}</strong>
              </div>

              <div className="auc-summaryItem">
                <span className="auc-summaryLabel">Coach</span>
                <strong>
                  {assignedCoachLoading
                    ? "Cargando..."
                    : assignedCoach
                    ? coachActualNombre
                    : "Autogestionado"}
                </strong>
              </div>
            </div>
          </div>

          <div className="auc-card">
            <div className="auc-title">Acciones rápidas</div>
            <div className="auc-actions">
              <button className="auc-btn auc-btnGold" onClick={() => setActiveTab("relacion")}>
                Asignar coach
              </button>
              <button className="auc-btn" onClick={handleUnassignCoach}>
                Quitar coach
              </button>
              <button className="auc-btn auc-btnDanger" onClick={handleBlock}>
                {user?.estado === "bloqueado" ? "Desbloquear" : "Bloquear"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "nutricion" && (
        <div className="auc-card">
          <div className="auc-title">Objetivo + metas</div>

          <div className="auc-form">
            <select
              value={gObjetivo}
              onChange={(e) => setGObjetivo(e.target.value)}
              className="auc-input"
            >
              <option value="perder_peso">Pérdida de grasa</option>
              <option value="ganar_peso">Ganancia muscular</option>
              <option value="mantener_peso">Mantenimiento</option>
            </select>

            <input
              className="auc-input"
              value={gKcal}
              onChange={(e) => setGKcal(sanitizeNumInput(e.target.value))}
              placeholder="Kcal"
            />
            <input
              className="auc-input"
              value={gP}
              onChange={(e) => setGP(sanitizeNumInput(e.target.value))}
              placeholder="Proteína"
            />
            <input
              className="auc-input"
              value={gC}
              onChange={(e) => setGC(sanitizeNumInput(e.target.value))}
              placeholder="Carbs"
            />
            <input
              className="auc-input"
              value={gG}
              onChange={(e) => setGG(sanitizeNumInput(e.target.value))}
              placeholder="Grasas"
            />
          </div>

          <div className="auc-actions">
            <button className="auc-btn auc-btnGold" onClick={handleSaveGoals} disabled={saving}>
              {saving ? "Guardando..." : "Guardar metas"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "rutina" && (
        <div className="auc-card">
          <div className="auc-title">Rutina</div>
          <div className="auc-note">
            Más adelante podés agregar acá rutina actual, split, días, editor y acciones de asignación.
          </div>
        </div>
      )}

      {activeTab === "progreso" && (
        <div className="auc-card">
          <div className="auc-title">Progreso</div>
          <div className="auc-note">
            Más adelante podés agregar peso, adherencia, historial, check-ins y métricas.
          </div>
        </div>
      )}

      {activeTab === "relacion" && (
        <div className="auc-card">
          <div className="auc-title">Relación con coach</div>

          <div className="auc-relationBox">
            <div className="auc-relationTop">
              <div>
                <div className="auc-relationLabel">Estado actual</div>
                <div className="auc-relationValue">
                  {assignedCoach ? "Asignado" : "Autogestionado"}
                </div>
              </div>

              <div>
                <div className="auc-relationLabel">Entrenador</div>
                <div className="auc-relationValue">
                  {assignedCoachLoading
                    ? "Cargando..."
                    : assignedCoach
                    ? fullName(assignedCoach)
                    : "Sin asignar"}
                </div>
              </div>
            </div>

            {assignedCoach ? (
              <div className="auc-currentCoachCard">
                <div className="auc-currentCoachName">{fullName(assignedCoach)}</div>
                <div className="auc-currentCoachEmail">{assignedCoach?.email || "—"}</div>
              </div>
            ) : null}

            <div className="auc-searchArea">
              <label className="auc-searchLabel">Buscar coach</label>

              <div className="auc-searchWrap">
                <input
                  className="auc-searchInput"
                  value={coachQuery}
                  onChange={handleCoachInputChange}
                  onFocus={handleCoachInputFocus}
                  onBlur={handleCoachInputBlur}
                  placeholder="Escribí nombre, apellido o email..."
                />

                <button
                  type="button"
                  className="auc-searchReload"
                  onClick={() => {
                    setDropdownOpen(true);
                    setCoachQuery((v) => v);
                  }}
                >
                  ↻
                </button>

                {dropdownOpen && (
                  <div className="auc-dropdown">
                    {coachesLoading ? (
                      <div className="auc-dropdownState">Buscando coaches...</div>
                    ) : coachOptions.length === 0 ? (
                      <div className="auc-dropdownState">No se encontraron coaches.</div>
                    ) : (
                      coachOptions.map((coach) => (
                        <button
                          key={coach.id}
                          type="button"
                          className={`auc-option ${
                            selectedCoach?.id === coach.id ? "selected" : ""
                          }`}
                          onClick={() => handleSelectCoach(coach)}
                        >
                          <div className="auc-optionMain">
                            <div className="auc-optionName">{fullName(coach)}</div>
                            <div className="auc-optionEmail">{coach?.email || "—"}</div>
                          </div>

                          <div className="auc-optionMeta">
                            {coach?.plan ? String(coach.plan).toUpperCase() : "FREE"}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="auc-helperText">
                Podés escribir parte del nombre, apellido o email y seleccionar de la lista.
              </div>
            </div>

            <div className="auc-actions">
              <button className="auc-btn auc-btnGold" onClick={handleAssignCoach}>
                Asignar coach
              </button>
              <button className="auc-btn" onClick={handleUnassignCoach}>
                Quitar coach
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "cuenta" && (
        <div className="auc-card">
          <div className="auc-title">Cuenta</div>

          <div className="auc-note">
            Estado actual: <strong>{user?.estado || "activo"}</strong>
          </div>

          <div className="auc-subtitle">Plan</div>
          <div className="auc-actions">
            <button className="auc-btn" onClick={() => handlePlanChange("free")}>Free</button>
            <button className="auc-btn" onClick={() => handlePlanChange("premium")}>Pro</button>
            <button className="auc-btn" onClick={() => handlePlanChange("premium2")}>VIP</button>
          </div>

          <div className="auc-subtitle">Seguridad</div>
          <div className="auc-actions">
            <button className="auc-btn" onClick={handleBlock}>
              {user?.estado === "bloqueado" ? "Desbloquear" : "Bloquear"}
            </button>
            <button className="auc-btn auc-btnDanger" onClick={handleDeleteUser}>
              Eliminar usuario
            </button>
          </div>
        </div>
      )}

      {err ? <div className="auc-error">• {err}</div> : null}
    </div>
  );
}

function fullName(u) {
  const nombre = String(u?.profile?.nombre || "").trim();
  const apellido = String(u?.profile?.apellido || "").trim();
  return `${nombre} ${apellido}`.trim() || "Sin nombre";
}

function formatCoachOption(coach) {
  const nombre = fullName(coach);
  const email = coach?.email || "";
  return email ? `${nombre} — ${email}` : nombre;
}

function sanitizeNumInput(x) {
  return String(x ?? "").replace(/[^\d]/g, "");
}

function inputToNumOrNull(x) {
  const s = String(x ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function numToInput(v) {
  if (v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
}

function fmtNumOrDash(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "—";
}

function goalLabel(obj) {
  if (!obj) return "—";
  if (obj === "perder_peso") return "Pérdida de grasa";
  if (obj === "ganar_peso") return "Ganancia muscular";
  if (obj === "mantener_peso") return "Mantenimiento";
  return String(obj);
}
