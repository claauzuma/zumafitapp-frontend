import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  updateAdminUserStatus,
  updateAdminUserPlan,
  getAdminCoachClients,
  unassignCoachFromClient,
  deleteAdminUser,
} from "./adminUsuariosApi.js";
import "./adminUsuarioCoach.css";

const PLAN_OPTIONS = [
  { value: "free", label: "Plan Free" },
  { value: "premium", label: "Plan Pro" },
  { value: "premium2", label: "Plan VIP" },
];

export default function AdminUsuarioCoachDetalle({ user, onUserChange, onRefresh }) {
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("resumen");
  const [err, setErr] = useState("");

  const [draftPlan, setDraftPlan] = useState(user?.plan || "free");
  const [savingPlan, setSavingPlan] = useState(false);
  const [savingAccount, setSavingAccount] = useState(false);

  const [loadingClients, setLoadingClients] = useState(false);
  const [clients, setClients] = useState([]);
  const [clientsSearch, setClientsSearch] = useState("");
  const [busyClientId, setBusyClientId] = useState("");

  useEffect(() => {
    setDraftPlan(user?.plan || "free");
  }, [user?.id, user?.plan]);

  useEffect(() => {
    if (activeTab === "clientes") {
      loadClients();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user?.id]);

  async function loadClients() {
    try {
      setLoadingClients(true);
      setErr("");

      const data = await getAdminCoachClients(user.id);
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (e) {
      setErr(e?.message || "No se pudieron cargar los clientes");
      setClients([]);
    } finally {
      setLoadingClients(false);
    }
  }

  async function handleToggleBlock() {
    try {
      setSavingAccount(true);
      setErr("");

      const nextEstado = user?.estado === "bloqueado" ? "activo" : "bloqueado";
      const updated = await updateAdminUserStatus(user.id, nextEstado);
      onUserChange(updated);
    } catch (e) {
      setErr(e?.message || "No se pudo cambiar el estado");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleSavePlan() {
    if (draftPlan === user?.plan) return;

    try {
      setSavingPlan(true);
      setErr("");

      const updated = await updateAdminUserPlan(user.id, draftPlan);
      onUserChange(updated);
    } catch (e) {
      setErr(e?.message || "No se pudo guardar el plan");
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDeleteCoach() {
    const confirmDelete = window.confirm(
      `¿Seguro que querés eliminar a ${fullName(user)}?\n\nSi tiene clientes asignados, primero los voy a desvincular del coach.`
    );

    if (!confirmDelete) return;

    try {
      setSavingAccount(true);
      setErr("");

      const data = await getAdminCoachClients(user.id);
      const coachClients = Array.isArray(data?.clients) ? data.clients : [];

      for (const client of coachClients) {
        await unassignCoachFromClient(client.id);
      }

      await deleteAdminUser(user.id);
      navigate("/admin/usuarios");
    } catch (e) {
      setErr(e?.message || "No se pudo eliminar el coach");
    } finally {
      setSavingAccount(false);
    }
  }

  async function handleRemoveClient(client) {
    const ok = window.confirm(
      `¿Querés quitar a ${fullName(client)} de este coach?`
    );
    if (!ok) return;

    try {
      setBusyClientId(client.id);
      setErr("");

      await unassignCoachFromClient(client.id);
      await loadClients();
      if (typeof onRefresh === "function") await onRefresh();
    } catch (e) {
      setErr(e?.message || "No se pudo quitar el cliente del coach");
    } finally {
      setBusyClientId("");
    }
  }

  async function handleDeleteClient(client) {
    const ok = window.confirm(
      `¿Seguro que querés eliminar al cliente ${fullName(client)}?\n\nEsta acción lo borra de la base de datos.`
    );
    if (!ok) return;

    try {
      setBusyClientId(client.id);
      setErr("");

      await deleteAdminUser(client.id);
      await loadClients();
    } catch (e) {
      setErr(e?.message || "No se pudo eliminar el cliente");
    } finally {
      setBusyClientId("");
    }
  }

  const filteredClients = useMemo(() => {
    const s = String(clientsSearch || "").trim().toLowerCase();
    if (!s) return clients;

    return clients.filter((c) => {
      const nombre = String(c?.profile?.nombre || "").toLowerCase();
      const apellido = String(c?.profile?.apellido || "").toLowerCase();
      const email = String(c?.email || "").toLowerCase();
      const full = `${nombre} ${apellido}`.trim();

      return full.includes(s) || email.includes(s);
    });
  }, [clients, clientsSearch]);

  const currentPlanChanged = draftPlan !== (user?.plan || "free");

  const tabs = [
    { key: "resumen", label: "Resumen" },
    { key: "clientes", label: "Clientes" },
    { key: "permisos", label: "Permisos" },
    { key: "plan", label: "Plan" },
    { key: "cuenta", label: "Cuenta" },
  ];

  const specialties = specialtyLabel(user);
  const clientsCount = clients.length;

  return (
    <div className="auco-wrap">
      <div className="auco-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`auco-tab ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "resumen" && (
        <div className="auco-grid">
          <div className="auco-card">
            <div className="auco-title">Resumen del coach</div>

            <div className="auco-infoGrid">
              <div className="auco-box">
                <div className="auco-kicker">Especialidades</div>
                <div className="auco-value">{specialties}</div>
              </div>

              <div className="auco-box">
                <div className="auco-kicker">Plan actual</div>
                <div className="auco-value">{planLabel(user?.plan)}</div>
              </div>

              <div className="auco-box">
                <div className="auco-kicker">Máximo de clientes</div>
                <div className="auco-value">
                  {user?.coachCapabilities?.maxClients ?? "—"}
                </div>
              </div>

              <div className="auco-box">
                <div className="auco-kicker">Clientes actuales</div>
                <div className="auco-value">{clientsCount || 0}</div>
              </div>
            </div>
          </div>

          <div className="auco-card">
            <div className="auco-title">Acciones rápidas</div>

            <div className="auco-actions">
              <button className="auco-btn" onClick={() => setActiveTab("clientes")}>
                Ver clientes
              </button>

              <button className="auco-btn" onClick={() => setActiveTab("plan")}>
                Cambiar plan
              </button>

              <button className="auco-btn" onClick={() => setActiveTab("cuenta")}>
                Cuenta
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "clientes" && (
        <div className="auco-card">
          <div className="auco-row">
            <div>
              <div className="auco-title">Clientes del coach</div>
              <div className="auco-sub">
                Administrá los clientes vinculados a este coach.
              </div>
            </div>

            <button className="auco-btn" onClick={loadClients} disabled={loadingClients}>
              {loadingClients ? "Cargando..." : "Recargar"}
            </button>
          </div>

          <div className="auco-searchWrap">
            <input
              className="auco-input"
              placeholder="Buscar por nombre, apellido o email..."
              value={clientsSearch}
              onChange={(e) => setClientsSearch(e.target.value)}
            />
          </div>

          {loadingClients ? (
            <div className="auco-empty">Cargando clientes...</div>
          ) : filteredClients.length === 0 ? (
            <div className="auco-empty">No hay clientes para mostrar.</div>
          ) : (
            <div className="auco-clientList">
              {filteredClients.map((client) => {
                const avatarUrl = getAvatarUrl(client);

                return (
                  <div key={client.id} className="auco-clientCard">
                    <div className="auco-clientTop">
                      <div className="auco-clientAvatarWrap">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={fullName(client)}
                            className="auco-clientAvatarImg"
                          />
                        ) : (
                          <div className="auco-clientAvatarFallback">
                            {initials(client?.profile?.nombre, client?.profile?.apellido)}
                          </div>
                        )}
                      </div>

                      <div className="auco-clientInfo">
                        <div className="auco-clientName">{fullName(client)}</div>
                        <div className="auco-clientEmail">{client?.email || "—"}</div>

                        <div className="auco-clientMeta">
                          <span className="auco-chip">
                            Objetivo: {goalLabel(client?.goal?.type)}
                          </span>
                          <span className="auco-chip">
                            Kcal: {fmtNumOrDash(client?.metasActuales?.kcal)}
                          </span>
                          <span className="auco-chip">
                            Plan: {planLabel(client?.plan)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="auco-clientActions">
                      <button
                        className="auco-btn"
                        onClick={() => navigate(`/admin/usuarios/${client.id}`)}
                      >
                        Ver detalle
                      </button>

                      <button
                        className="auco-btn"
                        onClick={() => handleRemoveClient(client)}
                        disabled={busyClientId === client.id}
                      >
                        {busyClientId === client.id ? "Procesando..." : "Quitar del coach"}
                      </button>

                      <button
                        className="auco-btn auco-btnDanger"
                        onClick={() => handleDeleteClient(client)}
                        disabled={busyClientId === client.id}
                      >
                        Eliminar cliente
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "permisos" && (
        <div className="auco-card">
          <div className="auco-title">Permisos del coach</div>

          <div className="auco-permissions">
            <div className="auco-box">
              <div className="auco-kicker">Menús habilitados</div>
              <div className="auco-chipWrap">
                {permissionChip("Automáticos", user?.coachCapabilities?.menus?.automatic)}
                {permissionChip("Semiautomáticos", user?.coachCapabilities?.menus?.semiautomatic)}
                {permissionChip("Fijos", user?.coachCapabilities?.menus?.fixed)}
                {permissionChip("Híbridos", user?.coachCapabilities?.menus?.hybrid)}
              </div>
            </div>

            <div className="auco-box">
              <div className="auco-kicker">Rutinas habilitadas</div>
              <div className="auco-chipWrap">
                {permissionChip("Automáticas", user?.coachCapabilities?.routines?.automatic)}
                {permissionChip("Semiautomáticas", user?.coachCapabilities?.routines?.semiautomatic)}
                {permissionChip("Manuales", user?.coachCapabilities?.routines?.manual)}
                {permissionChip("Híbridas", user?.coachCapabilities?.routines?.hybrid)}
              </div>
            </div>

            <div className="auco-box">
              <div className="auco-kicker">Extras</div>
              <div className="auco-chipWrap">
                {permissionChip("Invitar clientes", user?.coachCapabilities?.canInviteClients)}
                {permissionChip("Gestionar entrenamiento", user?.coachCapabilities?.canManageTraining)}
                {permissionChip("Gestionar nutrición", user?.coachCapabilities?.canManageNutrition)}
                {permissionChip("Plantillas", user?.coachCapabilities?.canUseTemplates)}
                {permissionChip("Duplicar planes", user?.coachCapabilities?.canDuplicatePlans)}
                {permissionChip("Exportar", user?.coachCapabilities?.canExportData)}
                {permissionChip("Métricas avanzadas", user?.coachCapabilities?.canSeeAdvancedMetrics)}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "plan" && (
        <div className="auco-card">
          <div className="auco-title">Plan del coach</div>
          <div className="auco-sub">
            Elegí el plan y después apretá guardar.
          </div>

          <div className="auco-planRow">
            {PLAN_OPTIONS.map((plan) => (
              <button
                key={plan.value}
                type="button"
                className={`auco-planBtn ${draftPlan === plan.value ? "active" : ""}`}
                onClick={() => setDraftPlan(plan.value)}
              >
                {plan.label}
              </button>
            ))}
          </div>

          <div className="auco-note">
            Plan actual guardado: <strong>{planLabel(user?.plan)}</strong>
            {currentPlanChanged ? " • Hay cambios sin guardar." : ""}
          </div>

          <div className="auco-actions">
            <button
              className="auco-btn auco-btnGold"
              onClick={handleSavePlan}
              disabled={savingPlan || !currentPlanChanged}
            >
              {savingPlan ? "Guardando..." : "Guardar plan"}
            </button>
          </div>
        </div>
      )}

      {activeTab === "cuenta" && (
        <div className="auco-card">
          <div className="auco-title">Cuenta</div>
          <div className="auco-sub">
            Acciones sensibles sobre la cuenta del coach.
          </div>

          <div className="auco-actions">
            <button
              className="auco-btn"
              onClick={handleToggleBlock}
              disabled={savingAccount}
            >
              {savingAccount
                ? "Procesando..."
                : user?.estado === "bloqueado"
                ? "Desbloquear coach"
                : "Bloquear coach"}
            </button>

            <button
              className="auco-btn auco-btnDanger"
              onClick={handleDeleteCoach}
              disabled={savingAccount}
            >
              {savingAccount ? "Eliminando..." : "Eliminar coach"}
            </button>
          </div>
        </div>
      )}

      {err ? <div className="auco-error">• {err}</div> : null}
    </div>
  );
}

function permissionChip(label, enabled) {
  return (
    <span className={`auco-chip ${enabled ? "is-on" : "is-off"}`}>
      {label}
    </span>
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

function specialtyLabel(user) {
  const training = !!user?.coachProfile?.specialties?.training;
  const nutrition = !!user?.coachProfile?.specialties?.nutrition;

  if (training && nutrition) return "Entrenamiento + Nutrición";
  if (training) return "Entrenamiento";
  if (nutrition) return "Nutrición";
  return "Sin especialidad";
}

function goalLabel(obj) {
  if (!obj) return "—";
  if (obj === "perder_peso") return "Pérdida de grasa";
  if (obj === "ganar_peso") return "Ganancia muscular";
  if (obj === "mantener_peso") return "Mantenimiento";
  return String(obj);
}

function fmtNumOrDash(v) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "—";
}

function planLabel(plan) {
  const p = String(plan || "").toLowerCase();
  if (p === "premium2" || p === "vip") return "VIP";
  if (p === "premium" || p === "pro") return "Pro";
  return "Free";
}
