// src/entrenado/InicioEntrenado.jsx
import React, { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Crown, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import {
  clientPlanCapabilitiesKey,
  clientPlanMenusUsageKey,
  fetchClientPlanCapabilities,
  fetchClientPlanMenusUsage,
} from "../clientPlans/clientPlanQueries.js";
import {
  clientPlanLabel,
  clientPlanTone,
  clientTypeLabel,
  ownMenusUsage,
  planActionLabel,
  planFromCapabilities,
  usageText,
} from "../clientPlans/clientPlanUtils.js";

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

.badgeRow{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-bottom:10px;
}

.badge{
  display:inline-flex;
  align-items:center;
  gap:8px;
  border:1px solid #2b2b2b;
  background:#0f0f0f;
  padding:8px 10px;
  border-radius: 999px;
  font-weight:900;
  color:#f5d76e;
  font-size: 12px;
}

.planBadge{
  text-transform:uppercase;
}
.planBadge.free{ color:#d7e1ee; border-color:rgba(148,163,184,.28); background:rgba(148,163,184,.10); }
.planBadge.pro{ color:#f5d76e; border-color:rgba(245,215,110,.32); background:rgba(245,215,110,.10); }
.planBadge.vip{ color:#e9d5ff; border-color:rgba(168,85,247,.34); background:rgba(168,85,247,.11); }
.planBadge.self{ color:#a7f3d0; border-color:rgba(16,185,129,.28); background:rgba(16,185,129,.10); }
.planBadge.coach{ color:#bfdbfe; border-color:rgba(96,165,250,.28); background:rgba(96,165,250,.10); }

.kicker{
  margin-top: 10px;
  color:#f5d76e;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.planRow{
  margin-top:14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
  border:1px solid rgba(245,215,110,.18);
  background:rgba(245,215,110,.065);
  border-radius:14px;
  padding:10px;
}

.planRowText{
  min-width:0;
  display:grid;
  gap:3px;
}

.planRowText strong{
  color:#fff;
  font-size:14px;
  line-height:1.2;
}

.planRowText span{
  color:rgba(255,255,255,.68);
  font-size:12px;
  font-weight:800;
}

.planRow button{
  flex:0 0 auto;
  min-height:38px;
  border:0;
  border-radius:12px;
  background:linear-gradient(135deg,#facc15,#f5d76e);
  color:#070707;
  padding:0 12px;
  font-weight:950;
  cursor:pointer;
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

@media (max-width:520px){
  .planRow{
    align-items:stretch;
    flex-direction:column;
  }
  .planRow button{
    width:100%;
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

export default function InicioEntrenado() {
  const navigate = useNavigate();
  const user = useMemo(() => getCachedUser(), []);
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
  const usageQuery = useQuery({
    queryKey: clientPlanMenusUsageKey,
    queryFn: fetchClientPlanMenusUsage,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    enabled: !!capabilitiesQuery.data,
  });

  const genero = user?.profile?.genero || user?.genero;
  const nombre = titleCaseFirstName(user?.profile?.nombre || user?.nombre || "");
  const titulo = nombre ? `${getSaludo(genero)}, ${nombre}` : getSaludo(genero);
  const summary = usageQuery.data || {};
  const capabilities = capabilitiesQuery.data || user?.nutritionCapabilities || null;
  const rawPlan = capabilities?.plan || user?.nutritionCapabilities?.plan || user?.plan;
  const plan = rawPlan ? planFromCapabilities(user, capabilities) : "";
  const usage = ownMenusUsage(summary, capabilities);
  const usageKnown = usageQuery.isSuccess && Number.isFinite(Number(usage.used));
  const planTone = clientPlanTone(plan || "free");

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <div className="card">
        <div className="badgeRow">
          <span className="badge">Sesion activa</span>
          <span className={`badge planBadge ${capabilities?.hasCoach ? "coach" : "self"}`}>
            <ShieldCheck size={14} aria-hidden="true" />
            {clientTypeLabel(user, capabilities)}
          </span>
          {rawPlan ? (
            <span className={`badge planBadge ${planTone}`}>
              <Crown size={14} aria-hidden="true" />
              Plan {clientPlanLabel(plan)}
            </span>
          ) : null}
        </div>

        <div className="kicker">Inicio</div>
        <h1 className="h1">{titulo}</h1>

        <p className="p">
          Aca vas a ver un resumen rapido y accesos a tus secciones.
        </p>

        {capabilitiesQuery.isError && !rawPlan ? (
          <div className="planMuted">No pudimos cargar tu plan ahora. Reintenta desde Mi plan.</div>
        ) : rawPlan ? (
          <div className="planRow">
            <div className="planRowText">
              <strong>
                Plan {clientPlanLabel(plan)} · {usageKnown ? `${usageText(usage)} menus utilizados` : "menus utilizados no disponible"}
              </strong>
              <span>{clientTypeLabel(user, capabilities)} · Beneficios y limites de nutricion</span>
            </div>
            <button type="button" onClick={() => navigate("/app/planes")}>
              {planActionLabel(plan)}
            </button>
          </div>
        ) : (
          <div className="planMuted">Cargando plan y limites...</div>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <strong>Menu</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Genera o ajusta comidas segun tus objetivos.
          </p>
        </div>

        <div className="card">
          <strong>Rutina</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Tu entrenamiento del dia o la semana.
          </p>
        </div>

        <div className="card">
          <strong>Progresos</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Medidas, fotos, rendimiento y constancia.
          </p>
        </div>

        <div className="card">
          <strong>Perfil / Ajustes</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Preferencias, metas y datos personales.
          </p>
        </div>
      </div>
    </div>
  );
}
