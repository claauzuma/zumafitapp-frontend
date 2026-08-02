// src/entrenado/InicioEntrenado.jsx
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Apple,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Crown,
  Dumbbell,
  ListChecks,
  Target,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
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
import { normalizeGoalFromUser } from "../clientNutrition/nutritionState.js";
import { assignmentFlexibleCalories } from "../menus/menuAssignmentCompatibility.js";
import {
  flexibleMarginEntries,
  flexibleMarginRemaining,
  flexibleMarginTotals,
  isFlexibleMarginCompleted,
} from "../menus/flexibleMarginTracking.js";
import { createNavigationPrefetchHandlers } from "../routes/routePrefetch.js";
import { getMenuTrackingWeek } from "../tracking/trackingApi.js";
import { buildWeeklyCalorieSummary } from "./homeWeeklyCalories.js";

const CSS = `
*{ box-sizing:border-box; }

html, body, #root{
  margin:0;
  padding:0;
  width:100%;
}

.wrap{
  --accent-primary:#f5d76e;
  --accent-strong:#facc15;
  --surface-card:#101820;
  --surface-card-2:#07090c;
  --border-soft:rgba(255,255,255,.10);
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

.heroActions button.secondary{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.055);
  color:#f7f7f7;
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

.nextActionCard{
  margin-top:14px;
  border-color:rgba(245,215,110,.28);
  background:
    radial-gradient(520px 220px at 100% 0%, rgba(245,215,110,.13), transparent 56%),
    linear-gradient(145deg,#111820,#070b10);
}

.nextActionCard .homeCardTitle{
  font-size:18px;
}

.nextActionCard .cardAction{
  width:100%;
}

@keyframes followupEnter{
  0%{ opacity:0; transform:translateY(8px) scale(.985); }
  58%{ opacity:1; transform:translateY(-1px) scale(1.003); }
  100%{ opacity:1; transform:translateY(0) scale(1); }
}

@keyframes followupAttentionGlow{
  0%,100%{
    border-color:rgba(251,146,60,.34);
    box-shadow:0 16px 42px rgba(0,0,0,.30), 0 0 0 rgba(251,113,133,0);
  }
  45%{
    border-color:rgba(251,146,60,.54);
    box-shadow:0 18px 48px rgba(0,0,0,.34), 0 0 30px rgba(251,146,60,.17), 0 0 22px rgba(251,113,133,.10);
  }
}

@keyframes followupRailPulse{
  0%,100%{ opacity:.88; filter:saturate(1); }
  50%{ opacity:1; filter:saturate(1.28) drop-shadow(0 0 8px rgba(251,146,60,.38)); }
}

@keyframes followupChipPulse{
  0%,100%{ transform:translateY(0); box-shadow:0 0 0 rgba(251,146,60,0); }
  50%{ transform:translateY(-1px); box-shadow:0 0 18px rgba(251,146,60,.16); }
}

.followupCard{
  margin-top:14px;
  position:relative;
  overflow:hidden;
  border-color:rgba(251,146,60,.34);
  background:
    radial-gradient(460px 190px at 0% 0%, rgba(251,113,133,.14), transparent 56%),
    radial-gradient(520px 180px at 100% 0%, rgba(251,146,60,.18), transparent 58%),
    radial-gradient(340px 150px at 22% 110%, rgba(45,212,191,.08), transparent 58%),
    linear-gradient(145deg,#101820,#080b10);
  box-shadow:0 16px 42px rgba(0,0,0,.30), 0 0 24px rgba(251,146,60,.08);
  animation:followupEnter .42s cubic-bezier(.2,.82,.2,1) both, followupAttentionGlow 1.35s ease-in-out .18s 2;
  will-change:transform, box-shadow;
}

.followupCard::before{
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:4px;
  background:linear-gradient(180deg,#fb7185,#fb923c 46%,#f5d76e);
  opacity:.88;
  animation:followupRailPulse 1.35s ease-in-out .18s 2;
}

.followupInner{
  position:relative;
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  gap:12px;
  align-items:start;
}

.followupIcon{
  width:38px;
  height:38px;
  border-radius:14px;
  display:grid;
  place-items:center;
  border:1px solid rgba(251,146,60,.34);
  background:linear-gradient(145deg,rgba(251,146,60,.14),rgba(251,113,133,.08));
  color:#ffd18a;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
}

.followupCopy{
  min-width:0;
}

.followupEyebrow{
  display:inline-flex;
  align-items:center;
  gap:6px;
  width:max-content;
  max-width:100%;
  border:1px solid rgba(251,146,60,.30);
  border-radius:999px;
  background:rgba(251,146,60,.105);
  color:#ffd6a6;
  padding:5px 8px;
  font-size:10px;
  font-weight:950;
  letter-spacing:.08em;
  text-transform:uppercase;
  animation:followupChipPulse 1.35s ease-in-out .22s 2;
}

.followupTitle{
  display:block;
  margin-top:3px;
  color:#fff;
  font-size:18px;
  font-weight:950;
  line-height:1.12;
}

.followupText{
  margin:7px 0 0;
  color:rgba(255,255,255,.78);
  font-size:13px;
  font-weight:800;
  line-height:1.4;
}

.followupText strong{
  color:#fff3b0;
}

.followupMeta{
  margin-top:9px;
  display:flex;
  flex-wrap:wrap;
  gap:7px;
}

.followupMeta span{
  display:inline-flex;
  align-items:center;
  min-height:25px;
  border:1px solid rgba(251,146,60,.18);
  background:rgba(255,255,255,.045);
  color:rgba(255,245,232,.80);
  border-radius:999px;
  padding:0 8px;
  font-size:11px;
  font-weight:900;
}

.followupActions{
  margin-top:12px;
  display:grid;
  grid-template-columns:1fr;
  gap:8px;
}

.followupPrimary,
.followupSecondary,
.followupClose{
  border:0;
  cursor:pointer;
  font-weight:950;
}

.followupPrimary,
.followupSecondary{
  min-height:40px;
  border-radius:13px;
  padding:0 12px;
}

.followupPrimary{
  background:linear-gradient(135deg,#fb923c,#facc15 55%,#f5d76e);
  color:#080808;
  box-shadow:0 12px 24px rgba(251,146,60,.18);
}

.followupSecondary{
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.045);
  color:#f7f7f7;
}

.followupClose{
  width:32px;
  height:32px;
  border-radius:12px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.045);
  color:rgba(255,255,255,.72);
}

@media (prefers-reduced-motion: reduce){
  .followupCard,
  .followupCard::before,
  .followupEyebrow{
    animation:none;
    will-change:auto;
  }
}

@media (min-width:680px){
  .followupActions{
    grid-template-columns:max-content max-content;
  }
}

@media (max-width:420px){
  .followupInner{
    grid-template-columns:auto minmax(0,1fr);
  }
  .followupClose{
    grid-column:2;
    grid-row:1;
    justify-self:end;
  }
  .followupCopy{
    grid-column:1 / -1;
  }
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

.homeEmptyNote{
  margin-top:12px;
  border:1px dashed rgba(245,215,110,.24);
  border-radius:14px;
  background:rgba(245,215,110,.055);
  padding:12px;
  color:rgba(255,255,255,.76);
  font-size:13px;
  font-weight:800;
  line-height:1.4;
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

const HOME_V2_CSS = `
.zfh{
  width:min(100%, 980px);
  margin:0 auto;
  display:grid;
  gap:14px;
  color:#f8fafc;
}

.zfh button{
  font:inherit;
  -webkit-tap-highlight-color:transparent;
  touch-action:manipulation;
}

.zfh-panel{
  position:relative;
  overflow:hidden;
  border:1px solid rgba(245,215,110,.24);
  border-radius:22px;
  background:
    radial-gradient(620px 250px at 100% 0%, rgba(250,204,21,.12), transparent 58%),
    radial-gradient(520px 250px at 0% 0%, rgba(14,165,233,.10), transparent 58%),
    linear-gradient(145deg,#101a23,#070b10 72%);
  box-shadow:0 18px 52px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.025);
}

.zfh-hero{
  padding:20px;
  min-height:190px;
  display:grid;
  align-content:space-between;
  gap:28px;
}

.zfh-hero::after{
  content:"";
  position:absolute;
  width:240px;
  height:240px;
  right:-90px;
  top:-115px;
  border-radius:50%;
  background:radial-gradient(circle,rgba(250,204,21,.18),transparent 68%);
  pointer-events:none;
}

.zfh-heroTop,
.zfh-objectiveHead,
.zfh-menuIntro,
.zfh-sectionHead,
.zfh-weekHead{
  position:relative;
  z-index:1;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

.zfh-planLabel{
  display:inline-flex;
  align-items:center;
  min-height:34px;
  border:1px solid rgba(245,215,110,.38);
  border-radius:999px;
  padding:0 13px;
  color:#fff1ad;
  background:rgba(9,14,19,.52);
  font-size:11px;
  font-weight:950;
  letter-spacing:.07em;
  text-transform:uppercase;
}

.zfh-planLink,
.zfh-detailLink{
  min-height:44px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:13px;
  padding:0 12px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:6px;
  color:rgba(255,255,255,.84);
  background:rgba(255,255,255,.045);
  cursor:pointer;
  font-size:12px;
  font-weight:850;
}

.zfh-heroBody{
  position:relative;
  z-index:1;
  display:grid;
  grid-template-columns:minmax(0,1fr) auto;
  align-items:end;
  gap:16px;
}

.zfh-hello{
  margin:0;
  color:#fff;
  font-size:clamp(30px, 6vw, 48px);
  font-weight:950;
  line-height:1;
  letter-spacing:-.035em;
}

.zfh-identity{
  margin-top:14px;
  display:flex;
  flex-wrap:wrap;
  gap:8px;
}

.zfh-chip{
  min-height:34px;
  display:inline-flex;
  align-items:center;
  gap:7px;
  border:1px solid rgba(255,255,255,.12);
  border-radius:999px;
  padding:0 11px;
  color:rgba(255,255,255,.78);
  background:rgba(255,255,255,.035);
  font-size:12px;
  font-weight:800;
}

.zfh-chip svg{ color:#60a5fa; }

.zfh-planBadge{
  min-width:98px;
  min-height:58px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  border:1px solid rgba(245,215,110,.22);
  border-radius:18px;
  color:#f8d75a;
  background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(255,255,255,.035));
  font-weight:950;
  letter-spacing:.045em;
  text-transform:uppercase;
}

.zfh-planBadge.free{ color:#d1d5db; border-color:rgba(209,213,219,.18); background:rgba(255,255,255,.04); }
.zfh-planBadge.vip{ color:#e9d5ff; border-color:rgba(192,132,252,.30); background:linear-gradient(135deg,rgba(126,34,206,.20),rgba(250,204,21,.06)); }

.zfh-trial{
  margin:0 20px 18px;
}

.zfh-menuCard{
  min-height:196px;
  padding:20px;
  display:grid;
  align-content:space-between;
  gap:18px;
  background:
    linear-gradient(90deg,rgba(7,13,18,.98) 0%,rgba(7,13,18,.92) 54%,rgba(7,13,18,.42) 100%),
    url('/images/foods/pechugadepollo.jpeg') right center / min(48%, 390px) 100% no-repeat,
    linear-gradient(145deg,#101a23,#080b10);
}

.zfh-roundIcon{
  width:46px;
  height:46px;
  flex:0 0 auto;
  border:1px solid rgba(245,215,110,.24);
  border-radius:16px;
  display:grid;
  place-items:center;
  color:#f5d76e;
  background:rgba(245,215,110,.075);
}

.zfh-menuCopy{
  max-width:560px;
}

.zfh-menuCopy h2,
.zfh-sectionHead h2{
  margin:0;
  font-size:clamp(20px,4vw,27px);
  line-height:1.12;
  font-weight:950;
  letter-spacing:-.02em;
}

.zfh-menuCopy p{
  margin:8px 0 0;
  max-width:520px;
  color:rgba(255,255,255,.74);
  font-size:14px;
  line-height:1.45;
}

.zfh-primary{
  width:100%;
  min-height:50px;
  border:0;
  border-radius:15px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:9px;
  color:#080808;
  background:linear-gradient(100deg,#facc15,#ffe27a 72%,#f5c842);
  box-shadow:0 12px 30px rgba(250,204,21,.13);
  cursor:pointer;
  font-weight:950;
}

.zfh-objective{
  padding:20px;
}

.zfh-objectiveTitle{
  display:flex;
  align-items:center;
  gap:11px;
}

.zfh-kcal{
  margin:18px 0 0 58px;
}

.zfh-kcal strong{
  color:#f7d653;
  font-size:clamp(34px,7vw,48px);
  line-height:1;
  font-weight:950;
  letter-spacing:-.035em;
}

.zfh-kcal span{
  margin-left:6px;
  color:#f5d76e;
  font-size:18px;
  font-weight:900;
}

.zfh-kcal small{
  margin-top:6px;
  display:block;
  color:rgba(255,255,255,.56);
  font-size:12px;
  font-weight:750;
}

.zfh-macros{
  margin-top:22px;
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:0;
}

.zfh-macro{
  min-width:0;
  display:grid;
  gap:8px;
  padding:0 14px;
  border-right:1px solid rgba(255,255,255,.10);
}

.zfh-macro:first-child{ padding-left:0; }
.zfh-macro:last-child{ padding-right:0; border-right:0; }
.zfh-macro strong{ font-size:14px; color:#f8fafc; white-space:nowrap; }
.zfh-macroTrack{ height:6px; border-radius:999px; overflow:hidden; background:rgba(255,255,255,.10); }
.zfh-macroTrack i{ display:block; width:var(--fill,0%); height:100%; border-radius:inherit; background:linear-gradient(90deg,#38bdf8,#60a5fa); }
.zfh-macro.carbs .zfh-macroTrack i{ background:linear-gradient(90deg,#34d399,#4ade80); }
.zfh-macro.fat .zfh-macroTrack i{ background:linear-gradient(90deg,#c084fc,#a78bfa); }

.zfh-week{
  margin-top:22px;
  padding-top:18px;
  border-top:1px solid rgba(255,255,255,.09);
}

.zfh-weekHead span{
  color:rgba(255,255,255,.60);
  font-size:13px;
  font-weight:750;
}

.zfh-weekHead strong{
  color:#7dd3fc;
  font-size:12px;
  font-weight:850;
}

.zfh-chart{
  height:180px;
  margin-top:13px;
  padding:16px 4px 0;
  display:grid;
  grid-template-columns:repeat(7,minmax(0,1fr));
  gap:7px;
  align-items:end;
  border-bottom:1px solid rgba(255,255,255,.10);
  background:repeating-linear-gradient(to top, transparent 0, transparent 52px, rgba(255,255,255,.035) 53px);
}

.zfh-day{
  min-width:0;
  height:164px;
  display:grid;
  grid-template-rows:minmax(0,1fr) 28px;
  justify-items:center;
  gap:6px;
}

.zfh-barArea{
  position:relative;
  width:100%;
  display:flex;
  align-items:flex-end;
  justify-content:center;
}

.zfh-bar{
  position:relative;
  width:min(28px,72%);
  min-height:6px;
  border-radius:9px 9px 4px 4px;
  background:linear-gradient(180deg,#ffd84f,#8a6612);
  box-shadow:0 0 16px rgba(250,204,21,.14);
}

.zfh-day.complete .zfh-bar{ background:linear-gradient(180deg,#6ee7a8,#147a4b); box-shadow:0 0 15px rgba(74,222,128,.18); }
.zfh-day.missed .zfh-bar{ background:linear-gradient(180deg,#fb7185,#8f273a); box-shadow:0 0 15px rgba(251,113,133,.14); }
.zfh-day.pending .zfh-bar{ background:linear-gradient(180deg,#ffd84f,#866714); }
.zfh-day.projected .zfh-bar{ opacity:.62; background:repeating-linear-gradient(135deg,#d9aa25 0 6px,#80651e 6px 12px); }

.zfh-barValue{
  position:absolute;
  left:50%;
  top:-14px;
  transform:translateX(-50%);
  color:rgba(255,255,255,.47);
  font-size:8px;
  font-weight:800;
  white-space:nowrap;
}

.zfh-dayLabel{
  min-width:26px;
  height:28px;
  display:grid;
  place-items:center;
  color:rgba(255,255,255,.58);
  font-size:12px;
  font-weight:900;
  border-bottom:2px solid transparent;
}

.zfh-day.today .zfh-dayLabel{
  color:#ffe16d;
  border-bottom-color:#facc15;
}

.zfh-chartLegend{
  margin-top:14px;
  display:flex;
  flex-wrap:wrap;
  gap:8px 14px;
}

.zfh-chartLegend span{
  display:inline-flex;
  align-items:center;
  gap:6px;
  color:rgba(255,255,255,.58);
  font-size:10px;
  font-weight:800;
}

.zfh-chartLegend i{ width:7px; height:7px; border-radius:50%; background:#facc15; }
.zfh-chartLegend .complete i{ background:#4ade80; }
.zfh-chartLegend .missed i{ background:#fb7185; }

.zfh-chartState{
  min-height:170px;
  display:grid;
  place-items:center;
  color:rgba(255,255,255,.62);
  text-align:center;
  font-size:13px;
  font-weight:800;
}

.zfh-secondaryGrid{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:10px;
}

.zfh-quickCard{
  min-width:0;
  min-height:112px;
  padding:15px;
  border:1px solid rgba(255,255,255,.09);
  border-radius:18px;
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  align-items:center;
  gap:11px;
  color:#f8fafc;
  background:linear-gradient(145deg,#101820,#090d12);
  cursor:pointer;
  text-align:left;
}

.zfh-quickCard .zfh-roundIcon{ width:42px; height:42px; border-radius:14px; }
.zfh-quickCard strong{ display:block; font-size:15px; font-weight:950; }
.zfh-quickCard span{ display:block; margin-top:3px; color:rgba(255,255,255,.56); font-size:11px; line-height:1.3; font-weight:750; }
.zfh-quickCard > svg{ color:rgba(255,255,255,.42); }

.zfh-emptyObjective{
  margin-top:16px;
  border:1px dashed rgba(245,215,110,.25);
  border-radius:15px;
  padding:14px;
  color:rgba(255,255,255,.72);
  background:rgba(245,215,110,.05);
  font-size:13px;
  line-height:1.45;
}

.zfh .followupCard{ margin-top:0; }

@media (hover:hover){
  .zfh-planLink:hover,.zfh-detailLink:hover,.zfh-quickCard:hover{ border-color:rgba(245,215,110,.30); transform:translateY(-1px); }
  .zfh-primary:hover{ filter:brightness(1.035); }
}

@media (max-width:680px){
  .zfh{ gap:9px; }
  .zfh-panel{ border-radius:17px; }
  .zfh-hero{ min-height:142px; padding:12px 14px; gap:10px; }
  .zfh-planLink{ display:none; }
  .zfh-planLabel{ min-height:31px; padding:0 11px; font-size:10px; }
  .zfh-heroBody{ grid-template-columns:minmax(0,1fr) auto; gap:10px; }
  .zfh-hello{ font-size:29px; }
  .zfh-planBadge{ min-width:72px; min-height:44px; padding:0 9px; border-radius:15px; font-size:11px; }
  .zfh-planBadge svg{ width:16px; }
  .zfh-identity{ margin-top:8px; gap:5px; }
  .zfh-chip{ min-height:29px; padding:0 8px; font-size:9px; }
  .zfh-chip svg{ width:13px; }
  .zfh-menuCard{ min-height:152px; padding:12px 14px; gap:8px; background-position:right center; background-size:auto 100%; }
  .zfh-objective{ padding:14px; }
  .zfh-roundIcon{ width:42px; height:42px; border-radius:14px; }
  .zfh-menuCopy{ max-width:72%; }
  .zfh-menuCopy h2,.zfh-sectionHead h2{ font-size:19px; }
  .zfh-menuCopy p{ margin-top:4px; font-size:11px; line-height:1.3; max-width:88%; }
  .zfh-primary{ min-height:44px; border-radius:13px; font-size:13px; }
  .zfh-detailLink{ min-height:44px; padding:0 10px; font-size:10px; }
  .zfh-objectiveTitle{ gap:9px; }
  .zfh-kcal{ margin:12px 0 0; }
  .zfh-kcal strong{ font-size:34px; }
  .zfh-kcal span{ font-size:15px; }
  .zfh-kcal small{ margin-top:3px; font-size:10px; }
  .zfh-macros{ margin-top:14px; }
  .zfh-macro{ padding:0 8px; gap:6px; }
  .zfh-macro strong{ font-size:11px; }
  .zfh-macroTrack{ height:5px; }
  .zfh-week{ margin-top:14px; padding-top:13px; }
  .zfh-weekHead span{ font-size:11px; }
  .zfh-weekHead strong{ font-size:10px; }
  .zfh-chart{ height:122px; margin-top:8px; gap:4px; padding:12px 0 0; }
  .zfh-day{ height:107px; grid-template-rows:minmax(0,1fr) 24px; gap:4px; }
  .zfh-dayLabel{ height:24px; font-size:10px; }
  .zfh-bar{ width:min(22px,74%); }
  .zfh-barValue{ top:-12px; font-size:7px; }
  .zfh-chartLegend{ display:none; }
  .zfh-secondaryGrid{ grid-template-columns:1fr; gap:8px; }
  .zfh-quickCard{ min-height:68px; padding:10px 12px; }
}

@media (max-width:390px){
  .zfh-planLink{ width:40px; padding:0; }
  .zfh-planLink span{ display:none; }
  .zfh-planBadge{ min-width:54px; }
  .zfh-planBadge span{ display:none; }
  .zfh-menuCopy{ max-width:82%; }
  .zfh-weekHead{ align-items:flex-start; flex-direction:column; gap:3px; }
  .zfh-macro strong{ font-size:11px; }
  .zfh-barValue{ font-size:7px; }
}
`;

function titleCaseFirstName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  const first = s.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function formatHomeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function barWidth(value, max) {
  if (value === null || value === undefined || value === "") return "0%";
  const number = Number(value);
  if (!Number.isFinite(number) || !max) return "0%";
  return `${Math.max(6, Math.min(100, Math.round((number / max) * 100)))}%`;
}

function todayLocalDateKey() {
  return dateKeyFromLocalDate(new Date());
}

function dateKeyFromLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey = "") {
  const match = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function addDaysKey(dateKey, amount) {
  const date = parseDateKey(dateKey);
  if (!date) return "";
  date.setDate(date.getDate() + amount);
  return dateKeyFromLocalDate(date);
}

function mondayOfWeekKey(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return todayLocalDateKey();
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dateKeyFromLocalDate(date);
}

function formatDayReference(dateKey, todayDateKey, { short = false } = {}) {
  const yesterday = addDaysKey(todayDateKey, -1);
  if (dateKey === yesterday) return "ayer";
  const date = parseDateKey(dateKey);
  if (!date) return "ese día";
  const label = date.toLocaleDateString("es-AR", { weekday: short ? "short" : "long", day: short ? undefined : "2-digit", month: short ? undefined : "2-digit" });
  return label ? label.charAt(0).toUpperCase() + label.slice(1).replace(".", "") : "ese día";
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readTotal(source = {}, keys = []) {
  if (!source || typeof source !== "object") return 0;
  const lower = Object.entries(source).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") return numberValue(source[key]);
    const value = lower[String(key).toLowerCase()];
    if (value !== undefined && value !== null && value !== "") return numberValue(value);
  }
  return 0;
}

function totalsFromAny(value = {}) {
  const source = value?.totals || value?.totales || value?.macros || value?.nutrition || value?.nutricion || value || {};
  return {
    kcal: readTotal(source, ["kcal", "calories", "calorias", "cal"]),
    proteina: readTotal(source, ["proteina", "proteinas", "protein", "p"]),
    carbs: readTotal(source, ["carbs", "carbohidratos", "carbohydrates", "hidratos", "c"]),
    grasas: readTotal(source, ["grasas", "grasa", "fat", "fats", "g"]),
  };
}

function hasAnyTotals(totals = {}) {
  const safeTotals = totalsFromAny(totals);
  return ["kcal", "proteina", "carbs", "grasas"].some((key) => Math.abs(safeTotals[key]) > 0.001);
}

function addTotals(left = {}, right = {}) {
  const a = totalsFromAny(left);
  const b = totalsFromAny(right);
  return {
    kcal: a.kcal + b.kcal,
    proteina: a.proteina + b.proteina,
    carbs: a.carbs + b.carbs,
    grasas: a.grasas + b.grasas,
  };
}

function sumTotals(items = []) {
  return items.reduce((acc, item) => addTotals(acc, item?.totals || item), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

function targetTotalsFromRow(row = {}) {
  const target = row?.target || row?.objetivo || {};
  const proteina = numberValue(target.p ?? target.proteina ?? target.protein);
  const carbs = numberValue(target.c ?? target.carbs ?? target.carbohidratos);
  const grasas = numberValue(target.g ?? target.grasas ?? target.fat);
  const explicitKcal = numberValue(target.kcal ?? target.calories ?? target.calorias);
  const derivedKcal = hasAnyTotals({ proteina, carbs, grasas }) ? (proteina * 4) + (carbs * 4) + (grasas * 9) : 0;
  return { kcal: explicitKcal || derivedKcal, proteina, carbs, grasas };
}

function menuChoicesFromRow(row = {}) {
  const choices = [];
  const primary = row?.assignment?.primaryMenu;
  if (primary?.menuSnapshot) {
    choices.push({
      key: primary.menuId || primary.menuSnapshot.id || "primary",
      type: "primary",
      snapshot: primary.menuSnapshot,
      assignment: primary,
      totals: row?.menuTotals || primary.menuSnapshot.totals || primary.menuSnapshot,
    });
  }
  const alternatives = Array.isArray(row?.assignment?.alternatives) ? row.assignment.alternatives : [];
  alternatives.forEach((alternative, index) => {
    const snapshot = alternative?.menuSnapshot || {};
    if (!snapshot || !Object.keys(snapshot).length) return;
    choices.push({
      key: alternative.menuId || snapshot.id || `alternative-${index}`,
      type: "alternative",
      index,
      snapshot,
      assignment: alternative,
      totals: snapshot.totals || snapshot,
    });
  });
  return choices;
}

function selectedChoiceFromRow(row = {}) {
  const choices = menuChoicesFromRow(row);
  const selectedIndex = Number(row?.tracking?.selectedAlternative?.index);
  if (Number.isInteger(selectedIndex) && selectedIndex >= 0) {
    return choices.find((choice) => choice.type === "alternative" && choice.index === selectedIndex) || choices[0] || null;
  }
  return choices[0] || null;
}

function snapshotMeals(snapshot = {}) {
  if (Array.isArray(snapshot?.meals)) return snapshot.meals;
  if (Array.isArray(snapshot?.comidas)) return snapshot.comidas;
  return [];
}

function mealItems(meal = {}) {
  if (Array.isArray(meal.items)) return meal.items;
  if (Array.isArray(meal.foods)) return meal.foods;
  if (Array.isArray(meal.alimentos)) return meal.alimentos;
  if (Array.isArray(meal.ingredientes)) return meal.ingredientes;
  if (Array.isArray(meal.ingredients)) return meal.ingredients;
  return [];
}

function mealTotals(meal = {}) {
  const direct = totalsFromAny(meal.totales || meal.totals || meal);
  if (hasAnyTotals(direct)) return direct;
  return sumTotals(mealItems(meal));
}

function mealHasContent(meal = {}) {
  return mealItems(meal).length > 0 || hasAnyTotals(mealTotals(meal));
}

function mealId(meal = {}, index = 0) {
  return String(meal.id || meal._id || meal.nombre || meal.name || `meal-${index + 1}`);
}

function choiceMeals(choice = {}) {
  return choice?.snapshot ? snapshotMeals(choice.snapshot) : [];
}

function choiceTotals(choice = {}) {
  const direct = totalsFromAny(choice?.totals || choice?.snapshot || {});
  if (hasAnyTotals(direct)) return direct;
  return sumTotals(choiceMeals(choice).map(mealTotals));
}

function flexiblePlanForFollowup(row = {}, choice = {}) {
  if (!choice?.snapshot) return null;
  const assignment = choice.assignment || row?.assignment?.primaryMenu || {};
  const target = targetTotalsFromRow(row);
  const planned = choiceTotals(choice);
  const flexibleCalories = assignmentFlexibleCalories(assignment, target, planned);
  if (!(flexibleCalories > 0)) return null;
  return { flexibleCalories, target, planned };
}

function uniqueSortedRecentDays(weekPayloads = []) {
  const byDate = new Map();
  weekPayloads.forEach((payload) => {
    (payload?.days || []).forEach((day) => {
      if (day?.date) byDate.set(day.date, day);
    });
  });
  return [...byDate.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function trackingStarted(row = {}) {
  const tracking = row?.tracking || {};
  return [
    tracking.completedMenuMealIds,
    tracking.manualEntries,
    tracking.generatedRemainingMeals,
    tracking.mealReplacements,
    tracking.foodReplacements,
  ].some((value) => Array.isArray(value) && value.length > 0) ||
    ["in_progress", "partial", "exceeded"].includes(String(tracking.status || "").toLowerCase());
}

function buildDayFollowupState(row = {}) {
  const choice = selectedChoiceFromRow(row);
  const meals = choiceMeals(choice).filter(mealHasContent);
  const completedIds = new Set(Array.isArray(row?.tracking?.completedMenuMealIds) ? row.tracking.completedMenuMealIds.map(String) : []);
  const completedMeals = meals.filter((meal, index) => completedIds.has(mealId(meal, index))).length;
  const totalMeals = meals.length;
  const hasMenu = totalMeals > 0;
  const hasPendingMeals = hasMenu && completedMeals < totalMeals;

  const flexiblePlan = flexiblePlanForFollowup(row, choice);
  const hasFlexibleMargin = !!flexiblePlan;
  const flexibleCompleted = hasFlexibleMargin && isFlexibleMarginCompleted(row);
  const flexibleRegistered = flexibleMarginTotals(row).kcal;
  const flexibleRemainingKcal = hasFlexibleMargin ? Math.max(0, Math.round(flexibleMarginRemaining(flexiblePlan, row))) : 0;
  const flexibleHasEntries = flexibleMarginEntries(row).length > 0;
  const hasPendingFlexibleMargin = hasFlexibleMargin && !flexibleCompleted && (
    flexibleRemainingKcal > 5 ||
    flexibleHasEntries ||
    flexibleRegistered > 0.5
  );
  const started = trackingStarted(row);
  const trackable = hasMenu || hasFlexibleMargin || started;
  const pending = hasPendingMeals || hasPendingFlexibleMargin;

  return {
    date: row?.date || "",
    row,
    trackable,
    pending,
    complete: trackable && !pending,
    meals: { completed: completedMeals, total: totalMeals, pending: hasPendingMeals },
    flexible: {
      available: hasFlexibleMargin,
      pending: hasPendingFlexibleMargin,
      remainingKcal: flexibleRemainingKcal,
      registeredKcal: Math.round(flexibleRegistered),
      completed: flexibleCompleted,
    },
  };
}

function planKindFromValue(plan = "", capabilities = {}) {
  const value = String(plan || capabilities?.plan || capabilities?.tier || "").toLowerCase();
  if (value.includes("vip")) return "vip";
  if (value.includes("pro")) return "pro";
  return "free";
}

function trackingHistoryLimit(capabilities = {}, planKind = "free") {
  const explicit = Number(capabilities?.limits?.trackingHistoryDays ?? capabilities?.trackingHistoryDays);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(14, Math.round(explicit)));
  return planKind === "free" ? 7 : 14;
}

function pluralDays(count) {
  return `${count} dia${count === 1 ? "" : "s"}`;
}

function formatKcal(value) {
  const number = Math.round(Number(value) || 0);
  return `${new Intl.NumberFormat("es-AR").format(number)} kcal`;
}

function getPendingFollowupSummary({
  days,
  capabilities,
  todayDateKey,
  plan,
  coachControlsNutrition,
  hasObjective,
  isClientRole,
}) {
  if (!isClientRole || !hasObjective || !Array.isArray(days) || !days.length) return null;
  const planKind = planKindFromValue(plan, capabilities);
  const limit = trackingHistoryLimit(capabilities, planKind);
  const oldestDateKey = addDaysKey(todayDateKey, -(limit - 1));
  const recentStates = days
    .filter((day) => day?.date && day.date < todayDateKey && day.date >= oldestDateKey)
    .slice(0, limit)
    .map(buildDayFollowupState)
    .filter((state) => state.trackable);
  const pendingStates = recentStates.filter((state) => state.pending);
  if (!pendingStates.length) return null;

  const primary = pendingStates[0];
  const affectedDay = formatDayReference(primary.date, todayDateKey);
  const affectedDayTitle = affectedDay === "ayer" ? "ayer" : formatDayReference(primary.date, todayDateKey, { short: true });
  const completedDays = recentStates.filter((state) => state.complete).length;
  const totalDays = recentStates.length;
  const isPremiumSummary = planKind !== "free" && pendingStates.length > 1;
  const title = coachControlsNutrition
    ? "Seguimiento pendiente"
    : isPremiumSummary
      ? planKind === "vip" ? "Seguimiento semanal" : "Resumen de seguimiento"
      : "Retomar seguimiento";
  const eyebrow = coachControlsNutrition ? "Continuidad con coach" : "Seguimiento pendiente";
  const mealLine = primary.meals.total > 0
    ? `${affectedDay === "ayer" ? "Ayer" : affectedDayTitle} registraste ${primary.meals.completed} de ${primary.meals.total} comidas.`
    : `Te quedaron registros pendientes de ${affectedDay}.`;
  const flexibleLine = primary.flexible.pending && primary.flexible.remainingKcal > 0
    ? `Quedaron ${formatKcal(primary.flexible.remainingKcal)} libres sin cerrar.`
    : primary.flexible.pending
      ? "Quedaron calorias libres por cerrar."
      : "";
  const body = coachControlsNutrition
    ? [
        "Tenes registros recientes sin cerrar.",
        primary.meals.total > 0 ? `${affectedDay === "ayer" ? "Ayer" : affectedDayTitle} quedo en ${primary.meals.completed}/${primary.meals.total} comidas.` : "",
        "Podes completarlos o dejarlos como estan para que tu coach vea el seguimiento real.",
      ].filter(Boolean).join(" ")
    : isPremiumSummary
      ? `En los ultimos ${pluralDays(totalDays)} completaste ${completedDays} de ${totalDays}. Tenes ${pluralDays(pendingStates.length)} con registros pendientes.`
      : [mealLine, flexibleLine || "Podes completarlo o seguir con el dia de hoy."].join(" ");

  const meta = [];
  meta.push(affectedDay === "ayer" ? "Ayer" : affectedDayTitle);
  if (primary.meals.total > 0) meta.push(`${primary.meals.completed}/${primary.meals.total} comidas`);
  if (primary.flexible.pending) meta.push(primary.flexible.remainingKcal > 0 ? `${formatKcal(primary.flexible.remainingKcal)} libres` : "Calorias libres");
  if (coachControlsNutrition) meta.push("Coach");

  return {
    title,
    eyebrow,
    body,
    meta,
    targetDate: primary.date,
    pendingCount: pendingStates.length,
    primaryLabel: coachControlsNutrition
      ? "Completar pendiente"
      : isPremiumSummary
        ? planKind === "vip" ? "Revisar semana" : "Revisar pendientes"
        : affectedDay === "ayer" ? "Completar ayer" : "Completar dia",
    secondaryLabel: "Seguir con hoy",
    storageType: isPremiumSummary ? "weekly" : "recent",
  };
}

function userStorageId(user = {}) {
  return String(user?.id || user?._id || user?.email || "cliente");
}

function followupDismissKey(summary, user, todayDateKey) {
  if (!summary?.targetDate) return "";
  return `zumafit.dismissedPendingFollowup.${userStorageId(user)}.${todayDateKey}.${summary.targetDate}.${summary.storageType || "recent"}`;
}

function isFollowupDismissed(summary, user, todayDateKey) {
  const key = followupDismissKey(summary, user, todayDateKey);
  if (!key || typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "1";
}

function dismissFollowup(summary, user, todayDateKey) {
  const key = followupDismissKey(summary, user, todayDateKey);
  if (!key || typeof window === "undefined") return;
  window.localStorage.setItem(key, "1");
}

export default function InicioEntrenado() {
  const navigate = useNavigate();
  const [dismissedFollowupKey, setDismissedFollowupKey] = useState("");
  const user = useMemo(() => getCachedUser(), []);
  const todayDateKey = useMemo(() => todayLocalDateKey(), []);
  const currentWeekStart = useMemo(() => mondayOfWeekKey(todayDateKey), [todayDateKey]);
  const previousWeekStart = useMemo(() => addDaysKey(currentWeekStart, -7), [currentWeekStart]);
  const authMeQuery = useAuthMe({
    initialFromCache: true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 45 * 1000,
  });
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

  const currentUser = useMemo(() => authMeQuery.data || user || {}, [authMeQuery.data, user]);
  const role = String(currentUser?.role || currentUser?.rol || "").toLowerCase();
  const isClientRole = !role || role === "cliente" || role === "client";
  const nombre = titleCaseFirstName(currentUser?.profile?.nombre || currentUser?.nombre || "");
  const titulo = nombre ? `Hola, ${nombre}` : "Hola";
  const summary = usageQuery.data || {};
  const capabilities = accessCapabilities || capabilitiesQuery.data || user?.nutritionCapabilities || null;
  const rawPlan = capabilities?.plan || currentUser?.nutritionCapabilities?.plan || currentUser?.plan;
  const plan = rawPlan ? planFromCapabilities(currentUser, capabilities) : "";
  const usage = ownMenusUsage(summary, capabilities);
  const usageKnown = usageQuery.isSuccess && Number.isFinite(Number(usage.used));
  const trial = accessContextQuery.data?.trial || null;
  const objective = normalizeGoalFromUser(currentUser);
  const hasObjective = objective.configured;
  const goalLoadFailed = authMeQuery.isError && !hasObjective;
  const accessContext = accessContextQuery.data || null;
  const authority = accessContext?.authority || {};
  const coachControlsNutrition =
    ["coach", "professional", "profesional"].includes(String(authority.nutrition || authority.menu || "").toLowerCase()) ||
    (!!accessContext?.hasCoach && String(authority.nutrition || "").toLowerCase() === "coach");
  const canLoadPendingFollowup = isClientRole && hasObjective;
  const currentMenuTrackingQuery = useQuery({
    queryKey: ["menuTrackingWeek", currentWeekStart],
    queryFn: () => getMenuTrackingWeek(currentWeekStart),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canLoadPendingFollowup,
  });
  const previousMenuTrackingQuery = useQuery({
    queryKey: ["menuTrackingWeek", previousWeekStart],
    queryFn: () => getMenuTrackingWeek(previousWeekStart),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canLoadPendingFollowup && previousWeekStart !== currentWeekStart,
  });
  const followupDays = useMemo(
    () => uniqueSortedRecentDays([currentMenuTrackingQuery.data, previousMenuTrackingQuery.data]),
    [currentMenuTrackingQuery.data, previousMenuTrackingQuery.data]
  );
  const rawPendingFollowup = useMemo(
    () => getPendingFollowupSummary({
      days: followupDays,
      capabilities,
      todayDateKey,
      plan,
      coachControlsNutrition,
      hasObjective,
      isClientRole,
    }),
    [capabilities, coachControlsNutrition, followupDays, hasObjective, isClientRole, plan, todayDateKey]
  );
  const pendingFollowup = useMemo(
    () => {
      if (!rawPendingFollowup) return null;
      const key = followupDismissKey(rawPendingFollowup, currentUser, todayDateKey);
      if (key && dismissedFollowupKey === key) return null;
      return isFollowupDismissed(rawPendingFollowup, currentUser, todayDateKey) ? null : rawPendingFollowup;
    },
    [currentUser, dismissedFollowupKey, rawPendingFollowup, todayDateKey]
  );
  const menuUsed = Number(usage.used || 0);
  const menuLimit = Number(usage.limit);
  const menuUsageText = usageKnown
    ? Number.isFinite(menuLimit)
      ? `${menuUsed} / ${menuLimit} menus`
      : `${menuUsed} menus`
    : "Uso de menus no disponible";
  const hasOwnMenu = usageKnown && menuUsed > 0;
  const nextAction = !hasObjective
    ? {
        title: "Completá tus objetivos",
        text: goalLoadFailed
          ? "No pudimos confirmar tu meta diaria ahora. Revisala para evitar planificar con datos incompletos."
          : "Defini tu meta diaria para que Menu, Tracking y Progreso trabajen sobre el mismo objetivo.",
        label: "Configurar objetivos",
        route: "/app/objetivos",
        icon: Target,
      }
    : !coachControlsNutrition && !hasOwnMenu
      ? {
          title: "Completá tu menú",
          text: "Ya tenes objetivos. Ahora arma tu dia base o segui usando Tracking mientras lo completas.",
          label: "Crear mi menú",
          route: "/app/menu/nuevo",
          icon: Apple,
          state: { from: "/app/inicio" },
        }
      : {
          title: "Tu menú de hoy",
          text: coachControlsNutrition
            ? "Tu coach gestiona el menu planificado. Usá Tracking para registrar lo que consumiste realmente."
            : "Revisa tu menu activo y marca comidas realizadas solo cuando corresponda.",
          label: "Ver menú del día",
          route: "/app/menu",
          icon: Apple,
        };
  const NextActionIcon = nextAction.icon;
  const planKind = planKindFromValue(plan, capabilities);
  const planLabel = rawPlan ? clientPlanLabel(plan) : "Sin confirmar";
  const currentWeekDays = useMemo(
    () => Array.isArray(currentMenuTrackingQuery.data?.days) ? currentMenuTrackingQuery.data.days : [],
    [currentMenuTrackingQuery.data?.days]
  );
  const todayRow = currentWeekDays.find((day) => day?.date === todayDateKey) || null;
  const todayTarget = targetTotalsFromRow(todayRow || {});
  const hasTodayTarget = hasAnyTotals(todayTarget);
  const homeObjective = hasTodayTarget
    ? {
        kcal: todayTarget.kcal,
        p: todayTarget.proteina,
        c: todayTarget.carbs,
        g: todayTarget.grasas,
      }
    : objective;
  const hasHomeObjective = hasTodayTarget || hasObjective;
  const weeklyCalories = useMemo(
    () => buildWeeklyCalorieSummary({
      rows: currentWeekDays,
      weekStart: currentWeekStart,
      todayDateKey,
      fallbackTargetKcal: homeObjective?.kcal || 0,
    }),
    [currentWeekDays, currentWeekStart, homeObjective?.kcal, todayDateKey]
  );
  const homeMenuDescription = coachControlsNutrition
    ? "Revisa el menu indicado por tu coach y marca las comidas cuando realmente las completes."
    : hasOwnMenu
      ? "Revisa tu menu activo y registra tus comidas solo cuando corresponda."
      : "Crea tu primer menu o registra el dia libremente desde Tracking.";

  function dismissPendingFollowup() {
    if (!pendingFollowup) return;
    const key = followupDismissKey(pendingFollowup, currentUser, todayDateKey);
    dismissFollowup(pendingFollowup, currentUser, todayDateKey);
    setDismissedFollowupKey(key);
  }

  function openPendingFollowup() {
    if (!pendingFollowup?.targetDate) return;
    navigate(`/app/menu?date=${encodeURIComponent(pendingFollowup.targetDate)}`);
  }

  return (
    <div className="wrap">
      <style>{`${CSS}\n${HOME_V2_CSS}`}</style>

      <div className="zfh">
        <section className="zfh-panel zfh-hero" aria-labelledby="home-client-title">
          <div className="zfh-heroTop">
            <span className="zfh-planLabel">Plan {planLabel}</span>
            <button type="button" className="zfh-planLink" onClick={() => navigate("/app/planes")}>
              <span>Ver mi plan</span><ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="zfh-heroBody">
            <div>
              <h1 className="zfh-hello" id="home-client-title">{titulo}</h1>
              <div className="zfh-identity" aria-label="Resumen de tu plan">
                <span className="zfh-chip"><UserRound size={15} aria-hidden="true" />{coachControlsNutrition ? "Acompañado por coach" : "Autogestionado"}</span>
                <span className="zfh-chip"><ListChecks size={15} aria-hidden="true" />{menuUsageText}</span>
              </div>
            </div>
            <span className={`zfh-planBadge ${planKind}`} aria-label={`Plan ${planLabel}`}>
              <Crown size={20} aria-hidden="true" /><span>{planLabel}</span>
            </span>
          </div>
        </section>

        {capabilitiesQuery.isError && !rawPlan ? (
          <div className="planMuted">No pudimos cargar tu plan ahora. Reintenta desde Mi plan.</div>
        ) : null}

        {trial?.active ? (
          <div className="trialActive zfh-trial">
            <div>
              <strong>Prueba Pro activa · te quedan {trial.daysRemaining ?? trial.daysLeft ?? 0} días</strong>
              <span>Finaliza el {formatHomeDate(trial.endsAt) || "día indicado por el servidor"}</span>
            </div>
            <button type="button" onClick={() => navigate("/app/planes")}>Ver funciones Pro</button>
          </div>
        ) : null}

        <section className="zfh-panel zfh-menuCard" aria-labelledby="home-menu-title">
          <div className="zfh-menuIntro">
            <span className="zfh-roundIcon" aria-hidden="true"><NextActionIcon size={24} /></span>
            <div className="zfh-menuCopy">
              <h2 id="home-menu-title">{nextAction.title}</h2>
              <p>{homeMenuDescription}</p>
            </div>
          </div>
          <button
            type="button"
            className="zfh-primary"
            onClick={() => navigate(nextAction.route, nextAction.state ? { state: nextAction.state } : undefined)}
            {...(nextAction.route === "/app/menu/nuevo" ? createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false }) : {})}
          >
            {nextAction.label}<ArrowRight size={19} aria-hidden="true" />
          </button>
        </section>

      {pendingFollowup ? (
        <div className="card followupCard" role="status" aria-live="polite">
          <div className="followupInner">
            <span className="followupIcon" aria-hidden="true">
              <CalendarDays size={20} />
            </span>
            <div className="followupCopy">
              <span className="followupEyebrow"><CheckCircle2 size={13} /> {pendingFollowup.eyebrow}</span>
              <strong className="followupTitle">{pendingFollowup.title}</strong>
              <p className="followupText">{pendingFollowup.body}</p>
              {pendingFollowup.meta?.length ? (
                <div className="followupMeta" aria-label="Resumen de seguimiento pendiente">
                  {pendingFollowup.meta.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              ) : null}
              <div className="followupActions">
                <button type="button" className="followupPrimary" onClick={openPendingFollowup}>
                  {pendingFollowup.primaryLabel}
                </button>
                <button type="button" className="followupSecondary" onClick={dismissPendingFollowup}>
                  {pendingFollowup.secondaryLabel}
                </button>
              </div>
            </div>
            <button type="button" className="followupClose" onClick={dismissPendingFollowup} aria-label="Ocultar aviso de seguimiento">
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

        <section className="zfh-panel zfh-objective" aria-labelledby="home-objective-title">
          <div className="zfh-objectiveHead">
            <div className="zfh-objectiveTitle">
              <span className="zfh-roundIcon" aria-hidden="true"><Target size={23} /></span>
              <h2 id="home-objective-title">Objetivos</h2>
            </div>
            <button type="button" className="zfh-detailLink" onClick={() => navigate("/app/objetivos")}>
              {hasHomeObjective ? "Ver detalle" : "Configurar"}<ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          {hasHomeObjective ? (
            <>
              <div className="zfh-kcal">
                <strong>{new Intl.NumberFormat("es-AR").format(Math.round(homeObjective.kcal || 0))}</strong>
                <span>kcal</span>
                <small>Meta diaria</small>
              </div>

              <div className="zfh-macros" aria-label="Distribución objetivo de macronutrientes">
                <span className="zfh-macro protein">
                  <strong>P {homeObjective.p ?? "–"} g</strong>
                  <span className="zfh-macroTrack"><i style={{ "--fill": barWidth(homeObjective.p, 260) }} /></span>
                </span>
                <span className="zfh-macro carbs">
                  <strong>C {homeObjective.c ?? "–"} g</strong>
                  <span className="zfh-macroTrack"><i style={{ "--fill": barWidth(homeObjective.c, 520) }} /></span>
                </span>
                <span className="zfh-macro fat">
                  <strong>G {homeObjective.g ?? "–"} g</strong>
                  <span className="zfh-macroTrack"><i style={{ "--fill": barWidth(homeObjective.g, 170) }} /></span>
                </span>
              </div>

              <div className="zfh-week">
                <div className="zfh-weekHead">
                  <span>Objetivo semanal (kcal)</span>
                  <strong>{weeklyCalories.targetDays ? `Prom. ${new Intl.NumberFormat("es-AR").format(weeklyCalories.averageTargetKcal)} kcal` : "Sin metas configuradas"}</strong>
                </div>

                {currentMenuTrackingQuery.isLoading ? (
                  <div className="zfh-chartState" role="status">Cargando tu semana…</div>
                ) : currentMenuTrackingQuery.isError ? (
                  <div className="zfh-chartState">No pudimos cargar la distribución semanal ahora.</div>
                ) : (
                  <div className="zfh-chart" role="list" aria-label="Calorías de la semana: verde cumplido, rojo no cumplido y amarillo pendiente">
                    {weeklyCalories.days.map((day) => {
                      const visibleKcal = day.targetKcal || day.consumedKcal;
                      const accessibleValue = day.targetKcal
                        ? `meta de ${day.targetKcal} calorías, ${day.consumedKcal} registradas`
                        : `${day.consumedKcal} calorías registradas, sin meta configurada`;
                      return (
                        <span
                          key={day.date}
                          role="listitem"
                          className={`zfh-day ${day.tone} ${day.isToday ? "today" : ""} ${day.isProjected ? "projected" : ""}`}
                          aria-label={`${day.label}: ${accessibleValue}, ${day.statusLabel}`}
                          title={`${accessibleValue} · ${day.statusLabel}`}
                        >
                          <span className="zfh-barArea">
                            <span className="zfh-bar" style={{ height: `${day.heightPercent}%` }}>
                              <span className="zfh-barValue">{visibleKcal > 0 ? visibleKcal : "0"}</span>
                            </span>
                          </span>
                          <span className="zfh-dayLabel">{day.label}</span>
                        </span>
                      );
                    })}
                  </div>
                )}

                <div className="zfh-chartLegend" aria-label="Referencias del gráfico">
                  <span className="complete"><i />Cumplido</span>
                  <span className="missed"><i />No cumplido</span>
                  <span className="pending"><i />Pendiente / meta</span>
                </div>
              </div>
            </>
          ) : (
            <div className="zfh-emptyObjective">
              {goalLoadFailed
                ? "No pudimos cargar tus objetivos completos. No mostramos una meta inventada."
                : "Todavía no configuraste una meta diaria. Definila para ver calorías, macros y distribución semanal."}
            </div>
          )}
        </section>

        <section aria-labelledby="home-more-title">
          <div className="zfh-sectionHead" style={{ margin: "2px 2px 10px" }}>
            <h2 id="home-more-title">Tu día, en un vistazo</h2>
          </div>
          <div className="zfh-secondaryGrid">
            <button type="button" className="zfh-quickCard" onClick={() => navigate("/app/tracking")}>
              <span className="zfh-roundIcon" aria-hidden="true"><CalendarDays size={21} /></span>
              <span><strong>Tracking</strong><span>Registrá lo que realmente comiste.</span></span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="zfh-quickCard" onClick={() => navigate("/app/rutinas")}>
              <span className="zfh-roundIcon" aria-hidden="true"><Dumbbell size={21} /></span>
              <span><strong>Rutina</strong><span>Revisá tu entrenamiento disponible.</span></span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
            <button type="button" className="zfh-quickCard" onClick={() => navigate("/app/progresos")}>
              <span className="zfh-roundIcon" aria-hidden="true"><TrendingUp size={21} /></span>
              <span><strong>Progreso</strong><span>Peso, medidas y evolución real.</span></span>
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
