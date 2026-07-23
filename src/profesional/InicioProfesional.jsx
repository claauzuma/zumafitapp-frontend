import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Settings, Users, Utensils } from "lucide-react";
import { Link } from "react-router-dom";
import { apiFetch } from "../Api.js";
import { getCachedUser, setAuthLogged } from "../authCache.js";
import { useProfessionalMe } from "../authQueries.js";
import { setAuthUserQueryData } from "../queryClient.js";
import { createCoachSubscriptionRequest, getCoachSubscription } from "../professionalAccessApi.js";
import {
  coachProfessionalPlanFromUser,
  coachProfessionalPlanLabel,
} from "../professionalPlans.js";

export default function InicioProfesional() {
  const queryClient = useQueryClient();
  const meQuery = useProfessionalMe();
  const subscriptionQuery = useQuery({
    queryKey: ["coach", "subscription"],
    queryFn: getCoachSubscription,
    staleTime: 60 * 1000,
    retry: 1,
  });
  const subscriptionMutation = useMutation({
    mutationFn: createCoachSubscriptionRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach", "subscription"] });
      setSubscriptionNotice("Solicitud enviada. Admin debe revisarla y activarla manualmente.");
    },
    onError: (error) => setSubscriptionNotice(error?.message || "No se pudo solicitar el plan."),
  });
  const [optimisticMe, setOptimisticMe] = useState(null);
  const [closingWelcome, setClosingWelcome] = useState(false);
  const [subscriptionNotice, setSubscriptionNotice] = useState("");
  const me = optimisticMe || meQuery.data || getCachedUser() || null;

  const role = String(me?.role || "").toLowerCase();

  const canTraining = useMemo(() => {
    if (role !== "coach") return false;
    const hasSpecialty = !!(me?.professionalScopes || me?.coachProfile?.specialties || {}).training;
    const routines = me?.effectiveCapabilities?.features?.routines || {};
    return hasSpecialty && (!me?.effectiveCapabilities || Object.values(routines).some(Boolean));
  }, [me, role]);

  const canNutrition = useMemo(() => {
    if (role !== "coach") return false;
    const hasSpecialty = !!(me?.professionalScopes || me?.coachProfile?.specialties || {}).nutrition;
    const menus = me?.effectiveCapabilities?.features?.menus || {};
    return hasSpecialty && (!me?.effectiveCapabilities || Object.values(menus).some(Boolean));
  }, [me, role]);

  const showWelcome = role === "coach" && me?.coachWelcome?.show === true;

  const specialtyLabel = useMemo(() => {
    const training = !!me?.coachWelcome?.specialties?.training;
    const nutrition = !!me?.coachWelcome?.specialties?.nutrition;

    if (training && nutrition) return "Entrenamiento + Nutrición";
    if (training) return "Entrenamiento";
    if (nutrition) return "Nutrición";
    return "Coach";
  }, [me]);



async function handleCloseWelcome() {
  setClosingWelcome(true);
  const optimisticUser = me
    ? {
        ...me,
        coachWelcome: {
          ...(me.coachWelcome || {}),
          show: false,
          seenAt: new Date().toISOString(),
        },
      }
    : me;

  setOptimisticMe(optimisticUser);
  if (optimisticUser) setAuthLogged(optimisticUser);
  if (optimisticUser) setAuthUserQueryData(optimisticUser);

  try {
    await apiFetch("/api/usuarios/users/me/coach-welcome-seen", {
      method: "PATCH",
    });
  } catch (error) {
    console.error("No se pudo marcar coachWelcome como visto:", error);
  } finally {
    setClosingWelcome(false);
  }
}





  if (showWelcome) {
    const firstName = me?.profile?.nombre || "coach";

    return (
      <div className="pro-wrap pro-wrapCenter">
        <div className="pro-inner pro-innerNarrow">
          <div className="pro-welcome pro-welcomeFull">
            <div className="pro-welcomeBadge">Nuevo acceso</div>

            <p className="pro-hello">Hola, {firstName}</p>

            <h1 className="pro-welcomeTitle">Fuiste invitado como coach</h1>

            <p className="pro-welcomeText">
              Ya tenés acceso a tu panel profesional en ZumaFit.
            </p>

            <div className="pro-welcomeMeta">
              <span className="pro-chip">
                Plan profesional: {coachProfessionalPlanLabel(coachProfessionalPlanFromUser(me))}
              </span>
              <span className="pro-chip">
                Especialidad: {specialtyLabel}
              </span>
            </div>

            <button
              type="button"
              className="pro-btn"
              onClick={handleCloseWelcome}
              disabled={closingWelcome}
            >
              {closingWelcome ? "Cargando..." : "Continuar"}
            </button>
          </div>
        </div>

        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="pro-wrap">
      <div className="pro-inner">
        <div className="pro-hero">
          <h1 className="pro-title">Panel profesional</h1>
          <p className="pro-sub">
            Desde acá vas a poder gestionar clientes, planes y seguimiento.
          </p>
        </div>

        <ProfessionalStatusCard
          me={me}
          data={subscriptionQuery.data}
          loading={subscriptionQuery.isLoading}
          notice={subscriptionNotice}
          onRequestPlan={(plan) => {
            setSubscriptionNotice("");
            subscriptionMutation.mutate({ requestedPlan: plan });
          }}
          requesting={subscriptionMutation.isPending}
        />

        <div className="pro-grid">
          <Link to="/profesional/clientes" className="pro-card">
            <div className="pro-icon"><Users size={27} strokeWidth={2.1} aria-hidden="true" /></div>
            <div className="pro-cardTitle">Clientes</div>
            <div className="pro-cardText">Ver y administrar tus clientes.</div>
          </Link>

          {canTraining && (
            <Link to="/profesional/rutinas" className="pro-card">
              <div className="pro-icon"><Dumbbell size={27} strokeWidth={2.1} aria-hidden="true" /></div>
              <div className="pro-cardTitle">Rutinas</div>
              <div className="pro-cardText">Crear y editar entrenamientos.</div>
            </Link>
          )}

          {canNutrition && (
            <Link to="/profesional/menus" className="pro-card">
              <div className="pro-icon"><Utensils size={27} strokeWidth={2.1} aria-hidden="true" /></div>
              <div className="pro-cardTitle">Menús</div>
              <div className="pro-cardText">
                Armar planes y seguimiento nutricional.
              </div>
            </Link>
          )}

          <Link to="/profesional/perfil" className="pro-card">
            <div className="pro-icon"><Settings size={27} strokeWidth={2.1} aria-hidden="true" /></div>
            <div className="pro-cardTitle">Perfil profesional</div>
            <div className="pro-cardText">Datos, foto y configuración.</div>
          </Link>
        </div>

        {me?.effectiveCapabilities?.isTrialExpired ? (
          <div className="pro-note">
            Tu prueba está vencida. Conservás datos y clientes, pero las nuevas acciones de gestión quedan limitadas hasta pasar a Pro o VIP.
          </div>
        ) : null}
      </div>

      <style>{styles}</style>
    </div>
  );
}

function ProfessionalStatusCard({ me, data, loading, notice, onRequestPlan, requesting }) {
  const subscription = data?.subscription || me?.effectiveCapabilities?.professionalSubscription || null;
  const scopes = data?.scopes || me?.professionalScopes || me?.coachProfile?.specialties || {};
  const status = data?.professionalStatus || me?.professionalStatus || me?.coachProfile?.status || "approved";
  const currentClients = me?.effectiveCapabilities?.currentClients || me?.coachStats?.currentClients || 0;
  const limit = me?.effectiveCapabilities?.limits?.maxActiveClients ?? me?.effectiveCapabilities?.maxClients ?? subscription?.clientLimit ?? 0;
  const currentMenus = Number(me?.effectiveCapabilities?.usage?.currentCoachOwnedMenus || 0);
  const menuLimit = Number(me?.effectiveCapabilities?.limits?.maxCoachOwnedMenus || 0);
  const currentMeals = Number(me?.effectiveCapabilities?.usage?.currentCoachOwnedMeals || 0);
  const mealLimit = Number(me?.effectiveCapabilities?.limits?.maxCoachOwnedMeals || 0);
  const available = limit ? Math.max(0, Number(limit) - Number(currentClients || 0)) : null;

  return (
    <section className="pro-statusCard">
      <div>
        <span className="pro-statusKicker">Estado profesional</span>
        <h2>{statusLabel(status)}</h2>
        <p>
          {loading
            ? "Consultando suscripción..."
            : `Suscripción: ${subscriptionLabel(subscription)}. Cupos disponibles: ${available === null ? "sin límite" : available}.`}
        </p>
        <div className="pro-statusChips">
          <span>Entrenamiento: {scopes.training ? "aprobado" : "pendiente"}</span>
          <span>Nutrición: {scopes.nutrition ? "aprobado" : "pendiente"}</span>
          <span>{currentClients} / {limit || "sin límite"} clientes</span>
          {menuLimit >= 0 ? <span>{currentMenus} / {menuLimit} menús propios</span> : null}
          {mealLimit >= 0 ? <span>{currentMeals} / {mealLimit} comidas propias</span> : null}
        </div>
      </div>
      <div className="pro-statusActions">
        <button type="button" onClick={() => onRequestPlan("coach_initial")} disabled={requesting}>Inicial</button>
        <button type="button" onClick={() => onRequestPlan("coach_pro")} disabled={requesting}>Pro</button>
        <button type="button" onClick={() => onRequestPlan("coach_ai")} disabled={requesting}>VIP</button>
      </div>
      {notice ? <div className="pro-statusNotice">{notice}</div> : null}
    </section>
  );
}

function statusLabel(value) {
  const raw = String(value || "").replaceAll("_", " ");
  if (raw === "approved") return "Aprobado";
  if (raw === "corrections required") return "Correcciones requeridas";
  if (raw === "rejected") return "Rechazado";
  if (raw === "suspended") return "Suspendido";
  return "Pendiente de verificación";
}

function subscriptionLabel(subscription) {
  if (!subscription) return "sin datos";
  const label = coachProfessionalPlanLabel(subscription.plan);
  return `${label} - ${subscriptionStatusLabel(subscription.status)}`;
}

function subscriptionStatusLabel(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "active") return "activa";
  if (status === "trial" || status === "trialing") return "prueba activa";
  if (status === "past_due") return "pago pendiente";
  if (status === "cancel_at_period_end") return "activa hasta fin de período";
  if (status === "expired") return "vencida";
  return status || "pendiente";
}

const styles = `
.pro-wrap{
  min-height:100%;
  background:transparent;
  color:#eaeaea;
  padding:0;
}


.pro-wrapCenter{
  display:flex;
  align-items:flex-start;
  padding-top:12px;
}

.pro-inner{
  max-width:1100px;
  margin:0 auto;
  width:100%;
}

.pro-innerNarrow{
  max-width:760px;
}

.pro-welcome{
  margin-bottom:18px;
  border:1px solid rgba(245,215,110,.20);
  border-radius:26px;
  background:
    radial-gradient(circle at top, rgba(245,215,110,.08), transparent 35%),
    linear-gradient(180deg, rgba(14,17,23,.96), rgba(10,13,18,.98));
  padding:22px;
  box-shadow:
    0 18px 50px rgba(0,0,0,.30),
    inset 0 1px 0 rgba(255,255,255,.03);
}

.pro-welcomeFull{
  min-height:320px;
  display:flex;
  flex-direction:column;
  justify-content:flex-start;
}

.pro-welcomeBadge{
  display:inline-flex;
  align-items:center;
  width:max-content;
  padding:8px 12px;
  border-radius:999px;
  background:rgba(245,215,110,.10);
  border:1px solid rgba(245,215,110,.20);
  color:#f5d76e;
  font-size:12px;
  font-weight:900;
  text-transform:uppercase;
  letter-spacing:0;
}

.pro-hello{
  margin:16px 0 0;
  color:#f5d76e;
  font-size:15px;
  font-weight:900;
  letter-spacing:0;
}

.pro-welcomeTitle{
  margin:10px 0 0;
  font-size:40px;
  line-height:1.02;
  font-weight:1000;
  color:#f7f8fa;
  letter-spacing:0;
}

.pro-welcomeText{
  margin:12px 0 0;
  color:#c6cfda;
  font-size:17px;
  line-height:1.55;
  max-width:560px;
}

.pro-welcomeMeta{
  margin-top:18px;
  display:flex;
  flex-wrap:wrap;
  gap:10px;
}

.pro-chip{
  display:inline-flex;
  align-items:center;
  padding:9px 12px;
  border-radius:999px;
  background:#0f141c;
  border:1px solid rgba(245,215,110,.14);
  color:#eaeaea;
  font-size:12px;
  font-weight:900;
}

.pro-btn{
  margin-top:20px;
  width:max-content;
  min-height:48px;
  padding:0 18px;
  border-radius:14px;
  border:1px solid rgba(245,215,110,.34);
  background:rgba(245,215,110,.10);
  color:#f5d76e;
  font-weight:900;
  font-size:15px;
  cursor:pointer;
  transition:.18s ease;
}

.pro-btn:hover{
  transform:translateY(-1px);
  border-color:rgba(245,215,110,.46);
}

.pro-btn:disabled{
  opacity:.7;
  cursor:not-allowed;
  transform:none;
}

.pro-hero{
  margin-bottom:18px;
}

.pro-title{
  margin:0;
  font-size:32px;
  font-weight:1000;
}

.pro-sub{
  margin:8px 0 0;
  color:#b8c0cc;
}

.pro-statusCard{
  margin:0 0 16px;
  border:1px solid rgba(245,215,110,.18);
  border-radius:22px;
  background:
    radial-gradient(circle at top right, rgba(245,215,110,.10), transparent 34%),
    linear-gradient(145deg, rgba(17,24,32,.96), rgba(8,12,18,.98));
  padding:16px;
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  gap:14px;
  box-shadow:0 18px 46px rgba(0,0,0,.26);
}

.pro-statusKicker{
  color:#f5d76e;
  font-size:12px;
  font-weight:1000;
  text-transform:uppercase;
  letter-spacing:.04em;
}

.pro-statusCard h2{
  margin:6px 0 0;
  font-size:24px;
}

.pro-statusCard p{
  margin:7px 0 0;
  color:#b8c0cc;
}

.pro-statusChips{
  margin-top:12px;
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.pro-statusChips span{
  border:1px solid rgba(255,255,255,.10);
  background:#0e151e;
  border-radius:999px;
  padding:7px 10px;
  color:#d9e2ec;
  font-size:12px;
  font-weight:900;
}

.pro-statusActions{
  display:grid;
  grid-template-columns:repeat(3, minmax(0,1fr));
  gap:8px;
  align-self:start;
  min-width:240px;
}

.pro-statusActions button{
  border:1px solid rgba(245,215,110,.22);
  background:rgba(245,215,110,.10);
  color:#f5d76e;
  border-radius:14px;
  min-height:40px;
  padding:0 12px;
  font-weight:1000;
  cursor:pointer;
}

.pro-statusActions button:disabled{
  opacity:.65;
  cursor:not-allowed;
}

.pro-statusNotice{
  grid-column:1/-1;
  border:1px solid rgba(245,215,110,.22);
  background:rgba(245,215,110,.09);
  color:#f5d76e;
  border-radius:14px;
  padding:10px 12px;
  font-weight:900;
}

.pro-grid{
  display:grid;
  grid-template-columns:repeat(2, minmax(0,1fr));
  gap:14px;
}

.pro-card{
  text-decoration:none;
  color:inherit;
  border:1px solid rgba(245,215,110,.16);
  border-radius:18px;
  background:linear-gradient(180deg, #0e1117, #0b0f15);
  padding:18px;
  min-height:132px;
  display:flex;
  flex-direction:column;
  gap:8px;
  transition:.18s ease;
}

.pro-card:hover{
  transform:translateY(-2px);
  border-color:rgba(245,215,110,.28);
}

.pro-icon{
  width:44px;
  height:44px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  border:1px solid rgba(245,215,110,.20);
  border-radius:14px;
  background:rgba(245,215,110,.08);
  color:#f5d76e;
}

.pro-cardTitle{
  font-size:20px;
  font-weight:900;
}

.pro-cardText{
  color:#9ea8b7;
}

.pro-note{
  margin-top:14px;
  border:1px solid rgba(255,190,80,.22);
  background:rgba(255,190,80,.08);
  color:#ffd8a3;
  border-radius:16px;
  padding:12px 14px;
  font-weight:800;
  line-height:1.5;
}

@media (max-width: 700px){
  .pro-statusCard{
    grid-template-columns:1fr;
  }

  .pro-statusActions{
    width:100%;
    min-width:0;
  }

  .pro-grid{
    grid-template-columns:1fr;
    gap:12px;
  }

  .pro-welcomeTitle{
    font-size:30px;
  }

  .pro-welcomeText{
    font-size:15px;
  }

  .pro-wrapCenter{
    padding-top:6px;
  }
}

@media (max-width: 430px){
  .pro-welcome{
    padding:16px;
    border-radius:18px;
  }

  .pro-title{
    font-size:28px;
  }

  .pro-welcomeTitle{
    font-size:28px;
  }

  .pro-card{
    min-height:118px;
    padding:16px;
  }
}
`;
