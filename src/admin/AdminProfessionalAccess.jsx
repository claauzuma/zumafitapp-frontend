import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";

import {
  approveAdminCoachSubscriptionRequest,
  listAdminAccessAuditEvents,
  listAdminCoachSubscriptionRequests,
  listAdminProfessionalApplications,
  patchAdminProfessionalApplication,
  rejectAdminCoachSubscriptionRequest,
} from "../professionalAccessApi.js";
import {
  COACH_PROFESSIONAL_PLAN_OPTIONS,
  coachProfessionalPlanLabel,
} from "../professionalPlans.js";

const PLAN_OPTIONS = COACH_PROFESSIONAL_PLAN_OPTIONS.map(({ value, label }) => [value, label]);

export default function AdminProfessionalAccess() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("applications");
  const applicationsQuery = useQuery({
    queryKey: ["admin", "professionalApplications"],
    queryFn: () => listAdminProfessionalApplications({ limit: 100 }),
    staleTime: 60 * 1000,
  });
  const subscriptionsQuery = useQuery({
    queryKey: ["admin", "coachSubscriptionRequests"],
    queryFn: () => listAdminCoachSubscriptionRequests({ limit: 100 }),
    staleTime: 60 * 1000,
  });
  const auditQuery = useQuery({
    queryKey: ["admin", "accessAuditEvents"],
    queryFn: () => listAdminAccessAuditEvents({ limit: 80 }),
    staleTime: 30 * 1000,
  });
  const [message, setMessage] = useState("");

  const reviewMutation = useMutation({
    mutationFn: ({ id, payload }) => patchAdminProfessionalApplication(id, payload),
    onSuccess: () => {
      setMessage("Solicitud actualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin", "professionalApplications"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "accessAuditEvents"] });
    },
    onError: (error) => setMessage(error?.message || "No se pudo actualizar la solicitud."),
  });

  const subscriptionMutation = useMutation({
    mutationFn: ({ id, action, payload }) =>
      action === "approve"
        ? approveAdminCoachSubscriptionRequest(id, payload)
        : rejectAdminCoachSubscriptionRequest(id, payload),
    onSuccess: () => {
      setMessage("Solicitud de suscripción actualizada.");
      queryClient.invalidateQueries({ queryKey: ["admin", "coachSubscriptionRequests"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "accessAuditEvents"] });
    },
    onError: (error) => setMessage(error?.message || "No se pudo actualizar la suscripción."),
  });

  const applications = useMemo(() => applicationsQuery.data?.applications || [], [applicationsQuery.data]);
  const requests = useMemo(() => subscriptionsQuery.data?.requests || [], [subscriptionsQuery.data]);
  const events = useMemo(() => auditQuery.data?.events || [], [auditQuery.data]);

  function approveApplication(app) {
    reviewMutation.mutate({
      id: app.id,
      payload: {
        status: "approved",
        approvedScopes: {
          training: app.requestedScopes?.training === true,
          nutrition: app.requestedScopes?.nutrition === true,
        },
        reason: "Aprobado desde panel Admin",
      },
    });
  }

  function setCorrections(app) {
    const reason = window.prompt("Motivo o correcciones requeridas", "Completar documentación profesional.");
    if (reason === null) return;
    reviewMutation.mutate({ id: app.id, payload: { status: "corrections_required", reason } });
  }

  function rejectApplication(app) {
    const reason = window.prompt("Motivo del rechazo", "No cumple criterios de verificación.");
    if (reason === null) return;
    reviewMutation.mutate({ id: app.id, payload: { status: "rejected", reason } });
  }

  function approveSubscription(req) {
    const plan = window.prompt("Plan profesional: coach_initial (Inicial), coach_pro (Pro) o coach_ai (VIP)", req.requestedPlan || "coach_initial");
    if (plan === null) return;
    subscriptionMutation.mutate({ id: req.id, action: "approve", payload: { plan } });
  }

  function rejectSubscription(req) {
    const reason = window.prompt("Motivo del rechazo", "Pendiente de pago o validación.");
    if (reason === null) return;
    subscriptionMutation.mutate({ id: req.id, action: "reject", payload: { reason } });
  }

  return (
    <section className="apa-page">
      <header className="apa-head">
        <div>
          <span className="apa-kicker">Sistema profesional</span>
          <h1>Profesionales, scopes y suscripciones</h1>
          <p>Revisá solicitudes, aprobá alcances reales y gestioná planes profesionales Inicial, Pro o VIP.</p>
        </div>
        <button type="button" className="apa-btn" onClick={() => {
          applicationsQuery.refetch();
          subscriptionsQuery.refetch();
          auditQuery.refetch();
        }}>
          Recargar
        </button>
      </header>

      <div className="apa-tabs">
        <button className={tab === "applications" ? "active" : ""} onClick={() => setTab("applications")} type="button">Solicitudes</button>
        <button className={tab === "subscriptions" ? "active" : ""} onClick={() => setTab("subscriptions")} type="button">Suscripciones</button>
        <button className={tab === "audit" ? "active" : ""} onClick={() => setTab("audit")} type="button">Auditoría</button>
      </div>

      {message ? <div className="apa-alert">{message}</div> : null}

      {tab === "applications" ? (
        <div className="apa-grid">
          {applicationsQuery.isLoading ? <CardSkeleton text="Cargando solicitudes..." /> : null}
          {applications.map((app) => (
            <article className="apa-card" key={app.id}>
              <div className="apa-cardTop">
                <StatusBadge status={app.status} />
                <span>{dateLabel(app.createdAt)}</span>
              </div>
              <h2>{app.personal?.nombre || "Profesional"} {app.personal?.apellido || ""}</h2>
              <p>{app.email}</p>
              <div className="apa-chips">
                <span>{typeLabel(app.professional?.tipo)}</span>
                {app.requestedScopes?.training ? <span>Training</span> : null}
                {app.requestedScopes?.nutrition ? <span>Nutrición</span> : null}
              </div>
              <p className="apa-muted">{app.professional?.biografia || app.professional?.experiencia || "Sin descripción extendida."}</p>
              <div className="apa-actions">
                <button type="button" onClick={() => approveApplication(app)} disabled={reviewMutation.isPending}>
                  <CheckCircle2 size={16} /> Aprobar
                </button>
                <button type="button" onClick={() => setCorrections(app)} disabled={reviewMutation.isPending}>
                  <Clock3 size={16} /> Correcciones
                </button>
                <button type="button" className="danger" onClick={() => rejectApplication(app)} disabled={reviewMutation.isPending}>
                  <XCircle size={16} /> Rechazar
                </button>
              </div>
            </article>
          ))}
          {!applicationsQuery.isLoading && !applications.length ? <CardSkeleton text="No hay solicitudes profesionales." /> : null}
        </div>
      ) : null}

      {tab === "subscriptions" ? (
        <div className="apa-grid">
          <article className="apa-card featured">
            <h2>Planes profesionales</h2>
            <div className="apa-planList">
              {PLAN_OPTIONS.map(([id, label]) => <span key={id}>{label}</span>)}
            </div>
            <p className="apa-muted">El checkout no está simulado: el coach solicita plan y Admin aprueba manualmente.</p>
          </article>
          {subscriptionsQuery.isLoading ? <CardSkeleton text="Cargando solicitudes..." /> : null}
          {requests.map((req) => (
            <article className="apa-card" key={req.id}>
              <div className="apa-cardTop"><StatusBadge status={req.status} /><span>{dateLabel(req.createdAt)}</span></div>
              <h2>{planLabel(req.requestedPlan)}</h2>
              <p>Coach: {req.coachId}</p>
              <p className="apa-muted">{req.notes || "Sin observaciones."}</p>
              <div className="apa-actions">
                <button type="button" onClick={() => approveSubscription(req)} disabled={subscriptionMutation.isPending}>
                  <ShieldCheck size={16} /> Aprobar
                </button>
                <button type="button" className="danger" onClick={() => rejectSubscription(req)} disabled={subscriptionMutation.isPending}>
                  <XCircle size={16} /> Rechazar
                </button>
              </div>
            </article>
          ))}
          {!subscriptionsQuery.isLoading && !requests.length ? <CardSkeleton text="No hay solicitudes de suscripción." /> : null}
        </div>
      ) : null}

      {tab === "audit" ? (
        <div className="apa-list">
          {auditQuery.isLoading ? <CardSkeleton text="Cargando auditoría..." /> : null}
          {events.map((event) => (
            <article className="apa-event" key={event._id || `${event.event}-${event.createdAt}`}>
              <strong>{event.event}</strong>
              <span>{event.subjectType} · {String(event.subjectId || "sin sujeto")}</span>
              <small>{dateLabel(event.createdAt)} · {event.reason || "sin motivo"}</small>
            </article>
          ))}
          {!auditQuery.isLoading && !events.length ? <CardSkeleton text="No hay eventos de auditoría." /> : null}
        </div>
      ) : null}

      <style>{styles}</style>
    </section>
  );
}

function StatusBadge({ status }) {
  const raw = String(status || "pending").replaceAll("_", " ");
  return <span className={`apa-status ${status}`}>{raw}</span>;
}

function CardSkeleton({ text }) {
  return <article className="apa-card empty">{text}</article>;
}

function dateLabel(value) {
  if (!value) return "Sin fecha";
  try {
    return new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
  } catch {
    return "Sin fecha";
  }
}

function planLabel(value) {
  return coachProfessionalPlanLabel(value);
}

function typeLabel(value) {
  if (value === "nutritionist") return "Nutricionista";
  if (value === "integral") return "Integral";
  if (value === "other_verified") return "Otro verificado";
  return "Personal trainer";
}

const styles = `
.apa-page{color:#f4f6f8}.apa-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin:10px 0 18px}.apa-kicker{color:#f5d76e;font-size:12px;font-weight:1000;text-transform:uppercase}.apa-head h1{margin:6px 0 0;font-size:clamp(28px,5vw,44px);line-height:1}.apa-head p,.apa-muted{color:#b9c2ce;line-height:1.5}.apa-btn,.apa-tabs button,.apa-actions button{border:1px solid rgba(255,255,255,.12);background:#101720;color:#fff;border-radius:14px;min-height:42px;padding:0 13px;font-weight:900;cursor:pointer}.apa-tabs{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}.apa-tabs .active{background:#f5d76e;color:#080808;border-color:#f5d76e}.apa-alert{border:1px solid rgba(245,215,110,.24);background:rgba(245,215,110,.10);color:#f5d76e;padding:12px 14px;border-radius:16px;margin-bottom:14px;font-weight:900}.apa-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.apa-card{border:1px solid rgba(255,255,255,.10);border-radius:22px;background:linear-gradient(145deg,#111820,#080c12);padding:16px;box-shadow:0 18px 45px rgba(0,0,0,.28)}.apa-card.featured{border-color:rgba(245,215,110,.28)}.apa-card.empty{color:#c5ced8}.apa-cardTop{display:flex;justify-content:space-between;gap:10px;color:#99a5b2;font-size:12px;font-weight:800}.apa-card h2{margin:14px 0 5px;font-size:23px}.apa-card p{margin:6px 0}.apa-status{display:inline-flex;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:5px 9px;background:rgba(255,255,255,.05);font-size:11px;text-transform:uppercase;font-weight:1000}.apa-status.approved{color:#9ff3bd;border-color:rgba(79,255,146,.25);background:rgba(79,255,146,.09)}.apa-status.rejected,.apa-status.suspended{color:#ff9a9a;border-color:rgba(255,90,90,.25);background:rgba(255,90,90,.09)}.apa-chips,.apa-planList{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0}.apa-chips span,.apa-planList span{border:1px solid rgba(245,215,110,.18);background:rgba(245,215,110,.08);color:#f5d76e;border-radius:999px;padding:6px 9px;font-size:12px;font-weight:900}.apa-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}.apa-actions button{display:inline-flex;align-items:center;gap:7px}.apa-actions .danger{color:#ffb4b4;border-color:rgba(255,90,90,.28);background:rgba(255,90,90,.08)}.apa-list{display:grid;gap:9px}.apa-event{border:1px solid rgba(255,255,255,.09);background:#0d131b;border-radius:16px;padding:12px;display:grid;gap:4px}.apa-event span,.apa-event small{color:#aeb8c4}@media(max-width:760px){.apa-head{display:grid}.apa-grid{grid-template-columns:1fr}.apa-actions{display:grid}.apa-actions button{width:100%;justify-content:center}}
`;
