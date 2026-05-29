import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, RefreshCw, Search } from "lucide-react";
import { apiFetch } from "../Api.js";
import { Avatar, Metric } from "./profesionalPieces.jsx";
import {
  capacityLabel,
  fmtDate,
  fmtKcal,
  fullName,
  goalLabel,
  planLabel,
} from "./profesionalFormat.js";
import "./profesionalPanel.css";

export default function ClientesProfesional() {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [coach, setCoach] = useState(null);
  const [clients, setClients] = useState([]);
  const [query, setQuery] = useState("");

  const loadClients = useCallback(async () => {
    try {
      setLoading(true);
      setErr("");
      const data = await apiFetch("/api/usuarios/users/me/coach-clients");
      setCoach(data?.coach || null);
      setClients(Array.isArray(data?.clients) ? data.clients : []);
    } catch (error) {
      setErr(error?.message || "No se pudieron cargar tus clientes");
      setClients([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadClients();
  }, [loadClients]);

  const filteredClients = useMemo(() => {
    const s = query.trim().toLowerCase();
    if (!s) return clients;

    return clients.filter((client) => {
      const name = fullName(client).toLowerCase();
      const email = String(client?.email || "").toLowerCase();
      return name.includes(s) || email.includes(s);
    });
  }, [clients, query]);

  const total = clients.length;
  const effective = coach?.effectiveCapabilities || {};
  const activeClients = clients.filter((client) => String(client?.estado || "activo").toLowerCase() === "activo").length;

  return (
    <div className="prof-page">
      <section className="prof-shell">
        <div className="prof-hero">
          <div>
            <div className="prof-kicker">👥 Clientes</div>
            <h1 className="prof-title">Tus clientes</h1>
            <p className="prof-sub">
              Vista profesional para seguir personas asignadas, objetivos, kcal y estado general.
            </p>
          </div>

          <div className="prof-actions">
            <button type="button" className="prof-btn" onClick={loadClients} disabled={loading}>
              <RefreshCw size={17} strokeWidth={2.2} aria-hidden="true" />
              {loading ? "Cargando..." : "Actualizar"}
            </button>
          </div>
        </div>

        <div className="prof-grid">
          <Metric emoji="👤" label="Clientes" value={`${total}/${effective?.maxClients ?? "sin limite"}`} />
          <Metric emoji="✅" label="Activos" value={activeClients} />
          <Metric emoji="📦" label="Plan" value={planLabel(effective?.planCode || coach?.plan)} />
          <Metric emoji="🧭" label="Capacidad" value={capacityLabel(coach)} />
        </div>

        <div className="prof-toolbar">
          <div className="prof-searchWrap">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <input
              className="prof-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nombre o email..."
            />
          </div>
        </div>

        {err ? <div className="prof-error">{err}</div> : null}

        {loading ? (
          <div className="prof-empty">Cargando clientes...</div>
        ) : filteredClients.length === 0 ? (
          <div className="prof-empty">
            {query ? "No hay clientes que coincidan con la busqueda." : "Todavia no tenes clientes asignados."}
          </div>
        ) : (
          <div className="prof-clientList">
            {filteredClients.map((client) => (
              <article className="prof-clientCard" key={client.id || client._id || client.email}>
                <div className="prof-clientTop">
                  <Avatar user={client} />
                  <div className="prof-clientInfo">
                    <div className="prof-clientName">{fullName(client)}</div>
                    <div className="prof-clientEmail">{client?.email || "Sin email"}</div>
                    <div className="prof-chipRow">
                      <span className="prof-chip info">🎯 {goalLabel(client?.goal?.type)}</span>
                      <span className="prof-chip">🔥 {fmtKcal(client?.metasActuales?.kcal)}</span>
                      <span className="prof-chip good">Estado: {client?.estado || "activo"}</span>
                      <span className="prof-chip">Asignado: {fmtDate(client?.coach?.assignedAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="prof-cardActions">
                  <Link className="prof-btn compact gold" to={`/profesional/clientes/${client.id || client._id}`}>
                    <Eye size={16} strokeWidth={2.2} aria-hidden="true" />
                    Ver detalle
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
