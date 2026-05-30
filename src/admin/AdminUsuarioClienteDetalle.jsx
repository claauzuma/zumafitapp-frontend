import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  Eye,
  RefreshCw,
  Trash2,
  UserMinus,
  UserPlus,
} from "lucide-react";
import {
  assignCoachToClient,
  unassignCoachFromClient,
  updateAdminUserStatus,
  updateAdminUserPlan,
  deleteAdminUser,
} from "./adminUsuariosApi.js";
import { useAdminCoaches, useAdminUser } from "./adminUsuariosQueries.js";
import { startAdminImpersonation } from "../impersonationApi.js";
import {
  invalidateAfterAdminUserUpdate,
  invalidateAfterAssignCoach,
  invalidateAfterDeleteUser,
  invalidateAfterUnassignCoach,
} from "../queryClient.js";
import "./adminUsuarioCliente.css";

export default function AdminUsuarioClienteDetalle({ user, onUserChange }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("resumen");
  const [err, setErr] = useState("");

  const [coachQuery, setCoachQuery] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState(null);

  const tabs = [
    { key: "resumen", label: "Resumen", emoji: "📋" },
    { key: "nutricion", label: "Nutricion", emoji: "🥗" },
    { key: "rutina", label: "Rutina", emoji: "🏋️" },
    { key: "progreso", label: "Progreso", emoji: "📈" },
    { key: "relacion", label: "Relacion", emoji: "🤝" },
    { key: "cuenta", label: "Cuenta", emoji: "⚙️" },
  ];

  const assignedCoachId = user?.coach?.entrenadorId || null;
  const debouncedCoachQuery = useDebouncedValue(coachQuery, 250);
  const shouldLoadCoaches = activeTab === "relacion" && (dropdownOpen || Boolean(coachQuery.trim()));
  const assignedCoachQuery = useAdminUser(assignedCoachId, { enabled: Boolean(assignedCoachId) });
  const coachesQuery = useAdminCoaches(debouncedCoachQuery.trim(), { enabled: shouldLoadCoaches });
  const assignedCoach = assignedCoachQuery.data || null;
  const assignedCoachLoading = Boolean(assignedCoachId) && assignedCoachQuery.isLoading;
  const coachOptions = Array.isArray(coachesQuery.data) ? coachesQuery.data : [];
  const coachesLoading = shouldLoadCoaches && (coachesQuery.isLoading || coachesQuery.isFetching);

  const coachActualNombre = useMemo(() => {
    if (!assignedCoach) return "-";
    return fullName(assignedCoach);
  }, [assignedCoach]);

  async function handleBlock() {
    try {
      setErr("");
      const next = user?.estado === "bloqueado" ? "activo" : "bloqueado";
      const updated = await updateAdminUserStatus(user.id, next);
      onUserChange(updated);
      await invalidateAfterAdminUserUpdate(user.id, updated);
    } catch (e) {
      setErr(e?.message || "No se pudo cambiar el estado");
    }
  }

  async function handlePlanChange(plan) {
    try {
      setErr("");
      const updated = await updateAdminUserPlan(user.id, plan);
      onUserChange(updated);
      await invalidateAfterAdminUserUpdate(user.id, updated);
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

      const previousCoachId = assignedCoachId;
      const updated = await assignCoachToClient(user.id, selectedCoach.id);
      onUserChange(updated);
      setCoachQuery("");
      setSelectedCoach(null);
      setDropdownOpen(false);
      await invalidateAfterAssignCoach({
        clientId: user.id,
        previousCoachId,
        nextCoachId: selectedCoach.id,
        updatedClient: updated,
      });
    } catch (e) {
      setErr(e?.message || "No se pudo asignar coach");
    }
  }

  async function handleUnassignCoach() {
    try {
      setErr("");
      const previousCoachId = assignedCoachId;
      const updated = await unassignCoachFromClient(user.id);
      onUserChange(updated);
      setCoachQuery("");
      setSelectedCoach(null);
      setDropdownOpen(false);
      await invalidateAfterUnassignCoach({
        clientId: user.id,
        previousCoachId,
        updatedClient: updated,
      });
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
      await invalidateAfterDeleteUser({
        deletedUser: user,
        userId: user.id,
        previousCoachId: assignedCoachId,
      });
      navigate("/admin/usuarios");
    } catch (e) {
      setErr(e?.message || "No se pudo eliminar el usuario");
    }
  }

  async function handleViewAsClient() {
    const ok = window.confirm(
      `Vas a ingresar en modo simulacion de solo lectura como ${fullName(user)}.`
    );
    if (!ok) return;

    try {
      setErr("");
      await startAdminImpersonation(user.id, {
        returnTo: `/admin/usuarios/${user.id}`,
      });
      navigate("/app/inicio", { replace: true });
    } catch (e) {
      setErr(e?.message || "No se pudo iniciar la simulacion");
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
            <span className="auc-tabEmoji" aria-hidden="true">{tab.emoji}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "resumen" && (
        <div className="auc-grid">
          <div className="auc-card">
            <SectionTitle emoji="📋" title="Resumen del cliente" />

            <div className="auc-summaryGrid">
              <MetricCard emoji="🎯" label="Objetivo" value={goalLabel(user?.goal?.type)} />
              <MetricCard emoji="🔥" label="Kcal" value={fmtKcal(user?.metasActuales?.kcal)} />
              <MetricCard
                emoji="🤝"
                label="Coach"
                value={
                  assignedCoachLoading
                    ? "Cargando..."
                    : assignedCoach
                    ? coachActualNombre
                    : "Autogestionado"
                }
              />
              <MetricCard emoji="🥩" label="Proteina" value={fmtMacro(user?.metasActuales?.macros?.p)} />
              <MetricCard emoji="🍚" label="Carbs" value={fmtMacro(user?.metasActuales?.macros?.c)} />
              <MetricCard emoji="🥑" label="Grasas" value={fmtMacro(user?.metasActuales?.macros?.g)} />
            </div>
          </div>

          <div className="auc-card">
            <SectionTitle emoji="⚡" title="Acciones rápidas" />
            <div className="auc-actions">
              <button type="button" className="auc-btn auc-btnGold" onClick={() => setActiveTab("relacion")}>
                <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" />
                Asignar
              </button>
              <button type="button" className="auc-btn" onClick={handleViewAsClient}>
                <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
                Ver como
              </button>
              <button type="button" className="auc-btn" onClick={handleUnassignCoach} disabled={!assignedCoachId}>
                <UserMinus size={16} strokeWidth={2.2} aria-hidden="true" />
                Quitar coach
              </button>
              <button type="button" className="auc-btn auc-btnDanger" onClick={handleBlock}>
                <Ban size={16} strokeWidth={2.2} aria-hidden="true" />
                {user?.estado === "bloqueado" ? "Desbloquear" : "Bloquear"}
              </button>
              <button type="button" className="auc-btn auc-btnDanger subtle" onClick={handleDeleteUser}>
                <Trash2 size={16} strokeWidth={2.2} aria-hidden="true" />
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "nutricion" && (
        <div className="auc-card auc-featureCard nutrition">
          <div className="auc-sectionTop">
            <SectionTitle emoji="🥗" title="Nutricion" />
            <span className="auc-readOnlyPill">Solo lectura</span>
          </div>

          <div className="auc-readOnlyNotice">
            El admin revisa esta informacion, pero no edita metas nutricionales. La edicion debe hacerla el coach con especialidad de nutricion o el flujo del cliente.
          </div>

          <div className="auc-summaryGrid auc-summaryGridWide">
            <MetricCard emoji="🎯" label="Objetivo" value={goalLabel(user?.goal?.type)} />
            <MetricCard emoji="🔥" label="Kcal objetivo" value={fmtKcal(user?.metasActuales?.kcal)} />
            <MetricCard emoji="🥩" label="Proteina" value={fmtMacro(user?.metasActuales?.macros?.p)} />
            <MetricCard emoji="🍚" label="Carbs" value={fmtMacro(user?.metasActuales?.macros?.c)} />
            <MetricCard emoji="🥑" label="Grasas" value={fmtMacro(user?.metasActuales?.macros?.g)} />
            <MetricCard emoji="📅" label="Actualizado" value={dateLabel(firstPresent(user?.metasActuales?.updatedAt, user?.updatedAt))} />
          </div>
        </div>
      )}

      {activeTab === "rutina" && (
        <div className="auc-card auc-featureCard routine">
          <div className="auc-sectionTop">
            <SectionTitle emoji="🏋️" title="Rutina" />
            <span className="auc-readOnlyPill">Solo lectura</span>
          </div>

          <div className="auc-readOnlyNotice">
            El admin puede ver el estado general. La creacion o edicion de rutinas corresponde al coach con especialidad de entrenamiento.
          </div>

          <div className="auc-summaryGrid">
            <MetricCard emoji="🏷️" label="Plan actual" value={firstPresent(user?.rutinaActual?.nombre, user?.routine?.name, user?.trainingPlan?.name)} />
            <MetricCard emoji="📆" label="Frecuencia" value={firstPresent(user?.profile?.basics?.frecuenciaEjercicio, user?.program?.training?.frequency, user?.training?.frequency)} />
            <MetricCard emoji="📌" label="Tipo" value={firstPresent(user?.program?.training, user?.training?.type, user?.rutinaActual?.tipo)} />
            <MetricCard emoji="✅" label="Estado" value={firstPresent(user?.rutinaActual?.estado, user?.trainingPlan?.status, "Sin rutina asignada")} />
          </div>
        </div>
      )}

      {activeTab === "progreso" && (
        <div className="auc-card auc-featureCard progress">
          <div className="auc-sectionTop">
            <SectionTitle emoji="📈" title="Progreso" />
            <span className="auc-readOnlyPill">Solo lectura</span>
          </div>

          <div className="auc-readOnlyNotice">
            Vista rapida para control administrativo. Los registros y cambios de progreso no se cargan desde el panel admin.
          </div>

          <div className="auc-summaryGrid">
            <MetricCard emoji="⚖️" label="Peso actual" value={fmtUnit(firstPresent(user?.antropometriaActual?.pesoKg, user?.profile?.basics?.pesoKg, user?.profile?.pesoKg), "kg")} />
            <MetricCard emoji="📏" label="Altura" value={fmtUnit(firstPresent(user?.antropometriaActual?.alturaCm, user?.profile?.basics?.alturaCm, user?.profile?.alturaCm), "cm")} />
            <MetricCard emoji="🔥" label="TDEE" value={fmtKcal(firstPresent(user?.profile?.basics?.tdeeEstimado, user?.metasActuales?.tdee))} />
            <MetricCard emoji="🎯" label="Peso objetivo" value={goalTargetLabel(user?.goal)} />
          </div>
        </div>
      )}

      {activeTab === "relacion" && (
        <div className="auc-card">
          <SectionTitle emoji="🤝" title="Relacion con coach" />

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
                <div className="auc-currentCoachTop">
                  <Avatar user={assignedCoach} />
                  <div className="auc-currentCoachInfo">
                    <div className="auc-currentCoachName">{fullName(assignedCoach)}</div>
                    <div className="auc-currentCoachMeta">
                      <span>{specialtyLabel(assignedCoach)}</span>
                      <span>{planLabel(assignedCoach?.effectiveCapabilities?.planCode || assignedCoach?.plan)}</span>
                      <span>{capacityLabel(assignedCoach)}</span>
                    </div>
                    <div className="auc-currentCoachEmail">{assignedCoach?.email || "-"}</div>
                  </div>
                </div>
                <div className="auc-helperText">
                  Asignado el {dateLabel(user?.coach?.assignedAt)}.
                </div>
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
                    coachesQuery.refetch();
                  }}
                >
                  <RefreshCw size={16} strokeWidth={2.2} aria-hidden="true" />
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
                            <div className="auc-optionSub">
                              {specialtyLabel(coach)} - {capacityLabel(coach)}
                            </div>
                            <div className="auc-optionEmail">{coach?.email || "-"}</div>
                          </div>

                          <div className="auc-optionMeta">
                            {planLabel(coach?.effectiveCapabilities?.planCode || coach?.plan)}
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
              <button type="button" className="auc-btn auc-btnGold" onClick={handleAssignCoach}>
                <UserPlus size={16} strokeWidth={2.2} aria-hidden="true" />
                Asignar coach
              </button>
              <button type="button" className="auc-btn" onClick={handleUnassignCoach} disabled={!assignedCoachId}>
                <UserMinus size={16} strokeWidth={2.2} aria-hidden="true" />
                Quitar coach
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "cuenta" && (
        <div className="auc-card">
          <SectionTitle emoji="⚙️" title="Cuenta" />

          <div className="auc-note">
            Estado actual: <strong>{user?.estado || "activo"}</strong>
          </div>

          <div className="auc-subtitle">Plan</div>
          <div className="auc-actions">
            <button type="button" className="auc-btn" onClick={() => handlePlanChange("free")}>Free</button>
            <button type="button" className="auc-btn" onClick={() => handlePlanChange("premium")}>Pro</button>
            <button type="button" className="auc-btn" onClick={() => handlePlanChange("premium2")}>VIP</button>
          </div>

          <div className="auc-subtitle">Seguridad</div>
          <div className="auc-actions">
            <button type="button" className="auc-btn" onClick={handleBlock}>
              <Ban size={16} strokeWidth={2.2} aria-hidden="true" />
              {user?.estado === "bloqueado" ? "Desbloquear" : "Bloquear"}
            </button>
            <button type="button" className="auc-btn auc-btnDanger" onClick={handleDeleteUser}>
              <Trash2 size={16} strokeWidth={2.2} aria-hidden="true" />
              Eliminar usuario
            </button>
            <button type="button" className="auc-btn auc-btnGold" onClick={handleViewAsClient}>
              <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
              Ver como cliente
            </button>
          </div>
        </div>
      )}

      {err ? <div className="auc-error">{err}</div> : null}
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

function SectionTitle({ emoji, title }) {
  return (
    <div className="auc-titleLine">
      <span className="auc-titleEmoji" aria-hidden="true">{emoji}</span>
      <div className="auc-title">{title}</div>
    </div>
  );
}

function MetricCard({ emoji, label, value }) {
  return (
    <div className="auc-summaryItem">
      <div className="auc-summaryIcon" aria-hidden="true">{emoji}</div>
      <span className="auc-summaryLabel">{label}</span>
      <strong>{displayValue(value)}</strong>
    </div>
  );
}

function fullName(u) {
  const nombre = String(u?.profile?.nombre || "").trim();
  const apellido = String(u?.profile?.apellido || "").trim();
  return `${nombre} ${apellido}`.trim() || "Sin nombre";
}

function Avatar({ user }) {
  const avatarUrl = getAvatarUrl(user);
  return (
    <div className="auc-avatar">
      {avatarUrl ? (
        <img src={avatarUrl} alt={fullName(user)} className="auc-avatarImg" />
      ) : (
        <div className="auc-avatarFallback">{initials(user?.profile?.nombre, user?.profile?.apellido)}</div>
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

function initials(nombre = "", apellido = "") {
  const a = String(nombre || "").trim()[0] || "U";
  const b = String(apellido || "").trim()[0] || "X";
  return `${a}${b}`.toUpperCase();
}

function specialtyLabel(user) {
  const training = !!user?.coachProfile?.specialties?.training;
  const nutrition = !!user?.coachProfile?.specialties?.nutrition;

  if (training && nutrition) return "Entrenamiento + Nutricion";
  if (training) return "Entrenamiento";
  if (nutrition) return "Nutricion";
  return "Sin especialidad";
}

function planLabel(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium2" || p === "vip") return "VIP";
  if (p === "premium" || p === "pro") return "Pro";
  if (p === "free" || p === "trial_pro" || p === "trial") return "Prueba Pro";
  return "Prueba Pro";
}

function capacityLabel(coach) {
  const effective = coach?.effectiveCapabilities || {};
  const current = effective?.currentClients ?? coach?.coachStats?.currentClients ?? 0;
  const max = effective?.maxClients ?? "sin limite";
  if (effective?.isTrialExpired) return `${current}/${max} - prueba vencida`;
  if (effective?.canReceiveClients === false) return `${current}/${max} - sin cupo`;
  return `${current}/${max} clientes`;
}

function dateLabel(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatCoachOption(coach) {
  const nombre = fullName(coach);
  const email = coach?.email || "";
  return email ? `${nombre} - ${email}` : nombre;
}

function displayValue(v) {
  if (v === null || v === undefined || v === "") return "-";
  return String(v);
}

function firstPresent(...values) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function fmtKcal(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n)} kcal` : String(v);
}

function fmtMacro(v) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? `${Math.round(n)} g` : String(v);
}

function fmtUnit(v, unit) {
  if (v === null || v === undefined || v === "") return "-";
  const n = Number(v);
  return Number.isFinite(n) ? `${n} ${unit}` : `${v} ${unit}`;
}

function goalTargetLabel(goal) {
  const range = goal?.targetRangeKg || goal?.rangoObjetivoKg;
  if (range?.min != null && range?.max != null) return `${range.min} - ${range.max} kg`;

  const target = firstPresent(goal?.targetWeightKg, goal?.pesoObjetivoKg, goal?.target?.weightKg);
  return fmtUnit(target, "kg");
}

function goalLabel(obj) {
  if (!obj) return "-";
  if (obj === "perder_peso") return "Perdida de grasa";
  if (obj === "ganar_peso") return "Ganancia muscular";
  if (obj === "mantener_peso") return "Mantenimiento";
  return String(obj);
}
