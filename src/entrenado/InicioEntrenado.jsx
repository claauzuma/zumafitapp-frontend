// src/entrenado/InicioEntrenado.jsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Apple, CalendarDays, Dumbbell, Target, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import {
  CLIENT_ACCESS_CONTEXT_STALE_TIME,
  CLIENT_PLAN_CAPABILITIES_STALE_TIME,
  capabilitiesFromResolvedAccess,
  clientAccessContextKey,
  clientPlanCapabilitiesKey,
  clientPlanMenusUsageKey,
  fetchClientAccessContext,
  fetchClientPlanCapabilities,
  fetchClientPlanMenusUsage,
} from "../clientPlans/clientPlanQueries.js";
import {
  clientPlanLabel,
  ownMenusUsage,
  planFromCapabilities,
} from "../clientPlans/clientPlanUtils.js";
import { createNavigationPrefetchHandlers } from "../routes/routePrefetch.js";

const CSS = `
*{ box-sizing:border-box; }

html, body, #root{
  margin:0;
  padding:0;
  width:100%;
}

.wrap{
  color:#eaeaea;
  width:100%;
  max-width:none;
  margin:0;
  padding:0;
}

.card{
  border:1px solid #232323;
  background:
    radial-gradient(700px 220px at 0% 0%, rgba(245,215,110,.10), transparent 56%),
    linear-gradient(180deg,#141414,#0f0f0f);
  border-radius:16px;
  padding:14px;
}

.heroCard{
  border-color:rgba(245,215,110,.24);
  background:
    radial-gradient(520px 220px at 100% 0%, rgba(245,215,110,.16), transparent 58%),
    radial-gradient(420px 200px at 0% 0%, rgba(45,212,191,.07), transparent 58%),
    linear-gradient(145deg,#141a20,#07090c);
  box-shadow:0 18px 46px rgba(0,0,0,.32);
}

.h1{
  font-size: 26px;
  font-weight: 900;
  margin: 0 0 8px;
  line-height: 1.1;
}

.p{
  margin:0;
  color:#cfcfcf;
  line-height:1.42;
}

.grid{
  margin-top: 14px;
  display:grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

@media (min-width: 900px){
  .grid{
    grid-template-columns: 1fr 1fr;
  }
}

.kicker{
  margin-top: 10px;
  color:#f5d76e;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.homeTopline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}

.homePlanPill{
  display:inline-flex;
  align-items:center;
  width:max-content;
  max-width:100%;
  border:1px solid rgba(245,215,110,.28);
  background:rgba(245,215,110,.10);
  color:#ffe89b;
  border-radius:999px;
  padding:7px 10px;
  font-size:11px;
  font-weight:950;
  text-transform:uppercase;
}

.heroActions,
.homeActionsRow{
  margin-top:14px;
  display:grid;
  grid-template-columns:1fr;
  gap:9px;
}

.heroActions button,
.cardAction{
  min-height:42px;
  border:0;
  border-radius:13px;
  background:linear-gradient(135deg,#facc15,#f5d76e);
  color:#070707;
  padding:0 13px;
  font-weight:950;
  cursor:pointer;
}

.cardAction.secondary{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.055);
  color:#f7f7f7;
}

.homeCardTitle{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:17px;
}

.homeCardTitle svg{
  width:34px;
  height:34px;
  border-radius:13px;
  border:1px solid rgba(245,215,110,.20);
  background:rgba(245,215,110,.08);
  color:#f5d76e;
  padding:8px;
}

.objectiveHomeCard{
  border-color:rgba(245,215,110,.24);
  background:
    radial-gradient(520px 220px at 100% 0%, rgba(245,215,110,.14), transparent 58%),
    linear-gradient(145deg,#111820,#080c12);
}

.homeKcalValue{
  margin-top:16px;
  color:#f5d76e;
  font-size:28px;
  font-weight:950;
  line-height:1;
}

.homeMacroGrid{
  margin-top:14px;
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:10px;
}

.homeMacro{
  min-width:0;
  display:grid;
  gap:7px;
}

.homeMacro span{
  color:rgba(255,255,255,.82);
  font-size:12px;
  font-weight:900;
}

.homeMacro strong{
  color:#f8fafc;
  font-size:13px;
}

.homeMacro i{
  height:5px;
  border-radius:999px;
  overflow:hidden;
  background:rgba(255,255,255,.10);
  position:relative;
}

.homeMacro i::after{
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:var(--fill, 0%);
  border-radius:inherit;
  background:#60a5fa;
}

.homeMacro.green i::after{ background:#4ade80; }
.homeMacro.violet i::after{ background:#a78bfa; }

.homeCardMeta{
  margin-top:8px;
  display:flex;
  flex-wrap:wrap;
  gap:7px;
}

.homeCardMeta span{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.045);
  color:rgba(255,255,255,.74);
  border-radius:999px;
  padding:6px 8px;
  font-size:11px;
  font-weight:900;
}

.planMuted{
  margin-top:12px;
  display:inline-flex;
  width:100%;
  min-height:42px;
  align-items:center;
  border:1px solid rgba(255,255,255,.08);
  border-radius:13px;
  background:rgba(255,255,255,.04);
  padding:0 11px;
  color:rgba(255,255,255,.70);
  font-size:12px;
  font-weight:850;
}

.trialActive{
  margin-top:12px;
  border:1px solid rgba(245,215,110,.25);
  background:
    radial-gradient(420px 180px at 100% 0%, rgba(245,215,110,.18), transparent 58%),
    linear-gradient(145deg, rgba(17,24,31,.96), rgba(6,9,13,.98));
  border-radius:16px;
  padding:12px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}

.trialActive strong{
  color:#fff4bd;
  display:block;
  font-size:14px;
}

.trialActive span{
  color:rgba(255,255,255,.72);
  display:block;
  margin-top:3px;
  font-size:12px;
  font-weight:800;
}

.trialActive button{
  flex:0 0 auto;
  min-height:38px;
  border:1px solid rgba(245,215,110,.25);
  border-radius:12px;
  background:rgba(245,215,110,.10);
  color:#f5d76e;
  padding:0 12px;
  font-weight:950;
}

@media (max-width:520px){
  .trialActive{
    align-items:stretch;
    flex-direction:column;
  }
  .trialActive button{
    width:100%;
  }
}

@media (min-width:720px){
  .heroActions,
  .homeActionsRow{
    grid-template-columns:max-content max-content;
  }
}
`;

function titleCaseFirstName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  const first = s.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function getSaludo(genero) {
  const g = String(genero || "").toLowerCase();
  if (g === "masculino" || g === "hombre" || g === "m") return "Bienvenido";
  if (g === "femenino" || g === "mujer" || g === "f") return "Bienvenida";
  return "Bienvenido/a";
}

function formatHomeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function barWidth(value, max) {
  const number = Number(value);
  if (!Number.isFinite(number) || !max) return "0%";
  return `${Math.max(6, Math.min(100, Math.round((number / max) * 100)))}%`;
}

function homeObjective(user = {}) {
  const metas = user?.metasActuales || {};
  const macros = metas?.macros || {};
  const kcal = numberOrNull(metas.kcal ?? user?.goal?.initialBudgetKcal);
  return {
    kcal,
    p: numberOrNull(macros.p),
    c: numberOrNull(macros.c),
    g: numberOrNull(macros.g),
  };
}

export default function InicioEntrenado() {
  const navigate = useNavigate();
  const user = useMemo(() => getCachedUser(), []);
  const accessContextQuery = useQuery({
    queryKey: clientAccessContextKey,
    queryFn: fetchClientAccessContext,
    staleTime: CLIENT_ACCESS_CONTEXT_STALE_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const accessCapabilities = capabilitiesFromResolvedAccess(accessContextQuery.data);
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: CLIENT_PLAN_CAPABILITIES_STALE_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: accessContextQuery.isError,
  });
  const usageQuery = useQuery({
    queryKey: clientPlanMenusUsageKey,
    queryFn: fetchClientPlanMenusUsage,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    enabled: !!(accessCapabilities || capabilitiesQuery.data),
  });

  const genero = user?.profile?.genero || user?.genero;
  const nombre = titleCaseFirstName(user?.profile?.nombre || user?.nombre || "");
  const titulo = nombre ? `${getSaludo(genero)}, ${nombre}` : getSaludo(genero);
  const summary = usageQuery.data || {};
  const capabilities = accessCapabilities || capabilitiesQuery.data || user?.nutritionCapabilities || null;
  const rawPlan = capabilities?.plan || user?.nutritionCapabilities?.plan || user?.plan;
  const plan = rawPlan ? planFromCapabilities(user, capabilities) : "";
  const usage = ownMenusUsage(summary, capabilities);
  const usageKnown = usageQuery.isSuccess && Number.isFinite(Number(usage.used));
  const trial = accessContextQuery.data?.trial || null;
  const objective = homeObjective(user);
  const accessContext = accessContextQuery.data || null;
  const authority = accessContext?.authority || {};
  const coachControlsNutrition =
    ["coach", "professional", "profesional"].includes(String(authority.nutrition || authority.menu || "").toLowerCase()) ||
    (!!accessContext?.hasCoach && String(authority.nutrition || "").toLowerCase() === "coach");
  const menuUsed = Number(usage.used || 0);
  const menuLimit = Number(usage.limit);
  const menuUsageText = usageKnown
    ? Number.isFinite(menuLimit)
      ? `${menuUsed} / ${menuLimit} menus`
      : `${menuUsed} menus`
    : "Uso de menus no disponible";
  const hasOwnMenu = usageKnown && menuUsed > 0;

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <div className="card heroCard">
        <div className="homeTopline">
          <span className="homePlanPill">{rawPlan ? `Plan ${clientPlanLabel(plan)}` : "Plan no disponible"}</span>
        </div>

        <div className="kicker">Inicio</div>
        <h1 className="h1">{titulo}</h1>

        <p className="p">
          Resumen de tu dia y accesos rapidos para organizar nutricion y entrenamiento.
        </p>

        <div className="heroActions">
          <button type="button" onClick={() => navigate("/app/planes")}>
            Ver mi plan
          </button>
        </div>

        {capabilitiesQuery.isError && !rawPlan ? (
          <div className="planMuted">No pudimos cargar tu plan ahora. Reintenta desde Mi plan.</div>
        ) : !rawPlan ? (
          <div className="planMuted">Cargando plan y limites...</div>
        ) : (
          <div className="homeCardMeta">
            <span>{coachControlsNutrition ? "Nutricion con coach" : "Autogestionado"}</span>
            <span>{menuUsageText}</span>
          </div>
        )}

        {trial?.active ? (
          <div className="trialActive">
            <div>
              <strong>Prueba Pro activa - te quedan {trial.daysRemaining ?? trial.daysLeft ?? 0} dias</strong>
              <span>Finaliza el {formatHomeDate(trial.endsAt) || "dia indicado por el servidor"}</span>
            </div>
            <button type="button" onClick={() => navigate("/app/planes")}>
              Ver funciones Pro
            </button>
          </div>
        ) : null}
      </div>

      <div className="grid">
        <div className="card objectiveHomeCard">
          <strong className="homeCardTitle"><Target aria-hidden="true" /> Objetivos</strong>
          {objective.kcal ? (
            <>
              <div className="homeKcalValue">{objective.kcal} kcal</div>
              <div className="homeMacroGrid" aria-label="Macros objetivo">
                <span className="homeMacro">
                  <strong>P {objective.p ?? "-" } g</strong>
                  <i style={{ "--fill": barWidth(objective.p, 260) }} />
                </span>
                <span className="homeMacro green">
                  <strong>C {objective.c ?? "-" } g</strong>
                  <i style={{ "--fill": barWidth(objective.c, 520) }} />
                </span>
                <span className="homeMacro violet">
                  <strong>G {objective.g ?? "-" } g</strong>
                  <i style={{ "--fill": barWidth(objective.g, 170) }} />
                </span>
              </div>
            </>
          ) : (
            <p className="p" style={{ marginTop: 6 }}>Completa tu objetivo diario base.</p>
          )}
          <div className="homeActionsRow">
            <button type="button" className="cardAction" onClick={() => navigate("/app/objetivos")}>
              Ver objetivos
            </button>
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><Apple aria-hidden="true" /> Menu de hoy</strong>
          <p className="p" style={{ marginTop: 6 }}>
            {coachControlsNutrition
              ? "Tu menu esta gestionado por tu coach."
              : hasOwnMenu
                ? "Ya tenes menus propios para planificar tus comidas."
                : "Todavia no creaste tu menu. Podes usar tu propio plan o registrar libremente en Tracking."}
          </p>
          <div className="homeCardMeta">
            <span>{menuUsageText}</span>
            {coachControlsNutrition ? <span>Coach</span> : <span>Autogestionado</span>}
          </div>
          <div className="homeActionsRow">
            <button
              type="button"
              className="cardAction"
              onClick={() => navigate(coachControlsNutrition || hasOwnMenu ? "/app/menu" : "/app/menu/nuevo", { state: { from: "/app/inicio" } })}
              {...(!coachControlsNutrition && !hasOwnMenu ? createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false }) : {})}
            >
              {coachControlsNutrition || hasOwnMenu ? "Ver menu" : "Crear mi menu"}
            </button>
            {!coachControlsNutrition && !hasOwnMenu ? (
              <button type="button" className="cardAction secondary" onClick={() => navigate("/app/tracking")}>
                Ir a Tracking
              </button>
            ) : null}
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><CalendarDays aria-hidden="true" /> Tracking</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Registra lo que realmente comiste y comparalo con tus objetivos.
          </p>
          <div className="homeActionsRow">
            <button type="button" className="cardAction" onClick={() => navigate("/app/tracking")}>
              Registrar dia
            </button>
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><Dumbbell aria-hidden="true" /> Rutina</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Tu entrenamiento del dia o la semana.
          </p>
          <div className="homeActionsRow">
            <button type="button" className="cardAction secondary" onClick={() => navigate("/app/rutinas")}>
              Ver rutina
            </button>
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><TrendingUp aria-hidden="true" /> Progreso</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Medidas, fotos, rendimiento y constancia.
          </p>
          <div className="homeActionsRow">
            <button type="button" className="cardAction secondary" onClick={() => navigate("/app/progresos")}>
              Ver progreso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
