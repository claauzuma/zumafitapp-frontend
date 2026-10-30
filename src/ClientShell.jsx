// src/ClientShell.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  Brain,
  ChevronRight,
  ClipboardCheck,
  Crown,
  Dumbbell,
  House,
  LogOut,
  Menu,
  MoreHorizontal,
  Settings,
  Target,
  TrendingUp,
  Utensils,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js";
import { setAuthGuest, setAuthLogged, getCachedUser, isImpersonating } from "./authCache.js";
import { useAuthMe } from "./authQueries.js";
import ImpersonationBanner from "./ImpersonationBanner.jsx";
import { clearPrivateQueryCache, queryClient, queryKeys, setAuthUserQueryData } from "./queryClient.js";
import AppToast from "./ui/AppToast.jsx";
import { dismissCoachAssignmentNotice } from "./clientCoachApi.js";
import {
  acceptCoachInvitation,
  blockCoachInvitation,
  declineCoachInvitation,
  getPendingCoachInvitations,
} from "./clientInvitationsApi.js";
import PendingCoachInvitationModal, { ClientInvitationBanner } from "./PendingCoachInvitationModal.jsx";
import BrandLogo from "./ui/BrandLogo.jsx";
import FullPageLoader from "./FullPageLoader.jsx";
import { clientPlanLabel, planFromCapabilities } from "./clientPlans/clientPlanUtils.js";
import {
  CLIENT_ACCESS_CONTEXT_STALE_TIME,
  CLIENT_PLAN_CAPABILITIES_STALE_TIME,
  acknowledgeClientTrialExpiryNotice,
  acknowledgeClientTrialOnboardingOffer,
  capabilitiesFromResolvedAccess,
  clientAccessContextKey,
  clientPlanCapabilitiesKey,
  createClientPlanChangeRequest,
  fetchClientAccessContext,
  fetchClientPlanCapabilities,
  startClientProTrial,
} from "./clientPlans/clientPlanQueries.js";
import { createNavigationPrefetchHandlers, scheduleIdleRoutePrefetch } from "./routes/routePrefetch.js";

const CSS = `
:root{
  --bg:#0b0b0b;
  --panel:#101010;
  --panel2:#0f0f0f;
  --border:#232323;
  --border2:#2b2b2b;
  --txt:#eaeaea;
  --muted:#cfcfcf;
  --gold:#f5d76e;
  --gold2:#facc15;
}

.cs-wrap{
  min-height:100dvh;
  background:
    radial-gradient(900px 420px at 8% -6%, rgba(245,215,110,.065), transparent 58%),
    radial-gradient(760px 420px at 102% 18%, rgba(79,209,181,.035), transparent 58%),
    var(--bg);
  color: var(--txt);
}

/* header */
.cs-header{
  position: sticky;
  top: 0;
  z-index: 80;
  border-bottom:1px solid rgba(255,255,255,.075);
  background: rgba(5,8,12,.84);
  backdrop-filter: blur(18px) saturate(145%);
  box-shadow:0 10px 34px rgba(0,0,0,.16);
}
.cs-header-inner{
  max-width: 1200px;
  margin: 0 auto;
  min-height: 86px;
  padding: 12px 16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
}
.cs-brand{
  display:flex;
  align-items:center;
  gap:10px;
  flex:1 1 auto;
  min-width:0;
  overflow:hidden;
}
.cs-logo{
  width:42px;
  height:42px;
  border-radius:14px;
  border:1px solid var(--border2);
  background: linear-gradient(180deg,#141414,#0f0f0f);
  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:900;
  color: var(--gold);
}
.cs-brand-stack{
  display:grid;
  min-width:0;
  gap:2px;
  justify-items:start;
}
.cs-brandLogo{
  min-width:0;
}
.cs-brandLogo .brand-logo-img{
  height:52px;
  max-width:215px;
}
.cs-title{
  font-weight: 900;
  line-height:1.1;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-sub{
  margin-top:1px;
  font-size:13px;
  line-height:1.18;
  color: var(--muted);
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-actions{
  display:flex;
  align-items:center;
  gap:10px;
  flex:0 0 auto;
}

/* botones */
.cs-btn{
  width:44px;
  height:44px;
  border-radius:14px;
  border:1px solid var(--border2);
  background: var(--panel2);
  color: var(--txt);
  cursor:pointer;
  font-weight:900;
  display:flex;
  align-items:center;
  justify-content:center;
  position:relative;
  overflow:hidden;
  transition: transform var(--zf-motion-instant, .09s) ease, box-shadow var(--zf-motion-fast, .15s) ease, border-color var(--zf-motion-fast, .15s) ease, filter var(--zf-motion-fast, .15s) ease, background-color var(--zf-motion-fast, .15s) ease;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.cs-btn:hover{
  transform: translateY(-1px);
  border-color:#3a3a3a;
  box-shadow: 0 10px 30px rgba(0,0,0,.35);
}
.cs-btn:active{ transform: translateY(1px) scale(.99); }
.cs-btn:disabled{ opacity:.7; cursor:not-allowed; transform:none; box-shadow:none; }
.cs-btn.is-loading{
  border-color: rgba(245,215,110,.55);
  box-shadow: 0 0 0 3px rgba(245,215,110,.10), 0 10px 40px rgba(0,0,0,.35);
  filter: brightness(1.05);
}
.cs-btn::after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:10px;
  height:10px;
  transform: translate(-50%,-50%) scale(0);
  border-radius:999px;
  background: radial-gradient(circle, rgba(245,215,110,.30), transparent 60%);
  opacity:0;
  pointer-events:none;
}
.cs-btn:active::after{
  opacity:1;
  transform: translate(-50%,-50%) scale(18);
  transition: transform .24s ease, opacity .28s ease;
}

/* content */
.cs-content{
  width:100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: 20px clamp(12px, 2vw, 22px) 34px;
}

.cs-mobileNav{
  display:none;
}

.cs-coachNotice{
  border:1px solid rgba(245,215,110,.32);
  background:
    radial-gradient(800px 220px at 0% 0%, rgba(245,215,110,.14), transparent 55%),
    linear-gradient(180deg,#141414,#0f0f0f);
  border-radius:18px;
  padding:14px;
  margin-bottom:14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  box-shadow:0 16px 48px rgba(0,0,0,.28);
}
.cs-coachNoticeText{
  display:grid;
  gap:4px;
  min-width:0;
}
.cs-coachNoticeLabel{
  width:max-content;
  border:1px solid rgba(245,215,110,.28);
  background:rgba(245,215,110,.10);
  color:var(--gold);
  border-radius:999px;
  padding:5px 9px;
  font-size:11px;
  font-weight:900;
}
.cs-coachNotice strong{
  font-size:16px;
  color:#fff;
}
.cs-coachNotice p{
  margin:0;
  color:var(--muted);
  font-size:13px;
  line-height:1.4;
}
.cs-coachNoticeActions{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
  justify-content:flex-end;
}
.cs-actionBtn{
  border:none;
  border-radius:12px;
  padding:10px 12px;
  font-weight:900;
  cursor:pointer;
  background:#0f0f0f;
  color:var(--txt);
  border:1px solid var(--border2);
}
.cs-actionBtn.gold{
  background:linear-gradient(135deg,var(--gold2),var(--gold));
  color:#0a0a0a;
  border-color:transparent;
}
.cs-actionBtn:disabled{
  opacity:.65;
  cursor:not-allowed;
}

.cs-planModalOverlay{
  position:fixed;
  inset:0;
  z-index:10001;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  background:rgba(3,7,12,.68);
  backdrop-filter:blur(10px) saturate(145%);
  animation:csBackdropIn .18s ease both;
}
.cs-planModal{
  width:min(520px, 100%);
  border:1px solid rgba(245,215,110,.25);
  border-radius:24px;
  background:
    radial-gradient(520px 240px at 100% 0%, rgba(245,215,110,.18), transparent 56%),
    radial-gradient(420px 220px at 0% 0%, rgba(255,255,255,.07), transparent 58%),
    linear-gradient(145deg, rgba(16,23,30,.98), rgba(5,8,12,.99));
  box-shadow:0 26px 90px rgba(0,0,0,.72);
  padding:20px;
  color:#f8fafc;
  animation:csDialogIn .32s cubic-bezier(.22,1,.36,1) both;
}
.cs-planModalBadge{
  display:inline-flex;
  align-items:center;
  width:max-content;
  border:1px solid rgba(245,215,110,.30);
  background:rgba(245,215,110,.11);
  color:var(--gold);
  border-radius:999px;
  padding:7px 10px;
  font-size:11px;
  font-weight:950;
  text-transform:uppercase;
  letter-spacing:.05em;
}
.cs-planModal h2{
  margin:12px 0 0;
  font-size:30px;
  line-height:1.03;
}
.cs-planModal p{
  margin:10px 0 0;
  color:rgba(255,255,255,.74);
  line-height:1.45;
}
.cs-planModalList{
  display:grid;
  gap:8px;
  margin:14px 0 0;
  padding:0;
  list-style:none;
}
.cs-planModalList li{
  border:1px solid rgba(255,255,255,.08);
  background:rgba(255,255,255,.045);
  border-radius:14px;
  padding:10px 11px;
  color:#fff4bd;
  font-size:13px;
  font-weight:850;
}
.cs-planModalActions{
  display:grid;
  grid-template-columns:1fr;
  gap:9px;
  margin-top:16px;
}
.cs-planModalActions button{
  min-height:46px;
  border-radius:15px;
  padding:0 14px;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.055);
  color:#f8fafc;
  font-weight:950;
  cursor:pointer;
}
.cs-planModalActions button.primary{
  border-color:transparent;
  background:linear-gradient(135deg,var(--gold2),var(--gold));
  color:#080808;
}
.cs-planModalActions button:disabled{
  opacity:.7;
  cursor:wait;
}

/* overlay + drawer */
.cs-ov{
  position:fixed;
  inset:0;
  z-index: 9998;
  background: rgba(2,5,9,.70);
  backdrop-filter: blur(5px) saturate(130%);
  animation:csBackdropIn .12s ease both;
}
.cs-drawer{
  --cs-lion-opacity:.135;
  position:fixed;
  top:0;
  right:0;
  height: 100dvh;
  width: min(356px, 94vw);
  z-index: 9999;
  overflow:hidden;
  isolation:isolate;
  border-left:1px solid rgba(245,184,28,.24);
  background:
    radial-gradient(420px 220px at 100% 0%, rgba(245,153,0,.11), transparent 62%),
    radial-gradient(300px 260px at 0% 48%, rgba(255,215,75,.035), transparent 68%),
    linear-gradient(165deg,#111318 0%,#090b0f 46%,#07090c 100%);
  box-shadow: -22px 0 80px rgba(0,0,0,.72), inset 1px 0 0 rgba(255,229,135,.035);
  transform: translate3d(110%,0,0);
  transition: transform .2s cubic-bezier(.22,1,.36,1);
  display:flex;
  flex-direction:column;
}
.cs-drawer.open{ transform: translate3d(0,0,0); }
.cs-drawer::before{
  content:"";
  position:absolute;
  z-index:2;
  top:0;
  right:0;
  left:0;
  height:2px;
  background:linear-gradient(90deg,transparent,rgba(245,153,0,.75),#ffe477,transparent);
  opacity:.78;
  pointer-events:none;
}
.cs-drawer::after{
  content:"";
  position:absolute;
  z-index:0;
  right:-110px;
  bottom:-120px;
  width:360px;
  height:360px;
  border-radius:999px;
  background:radial-gradient(circle,rgba(245,153,0,.16),rgba(245,153,0,.045) 42%,transparent 72%);
  filter:blur(10px);
  pointer-events:none;
}
.cs-drawerLion{
  position:absolute;
  z-index:0;
  top:48px;
  right:-54px;
  width:clamp(228px,78vw,294px);
  height:auto;
  opacity:var(--cs-lion-opacity);
  filter:saturate(1.24) contrast(1.06) drop-shadow(0 0 20px rgba(245,153,0,.18));
  mix-blend-mode:screen;
  pointer-events:none;
  user-select:none;
  transform:translate3d(8px,0,0) scale(.975);
  animation:csDrawerLionIn .26s cubic-bezier(.22,1,.36,1) .015s both;
}

@keyframes csBackdropIn{
  from{ opacity:0; }
  to{ opacity:1; }
}
@keyframes csDialogIn{
  from{ opacity:0; transform:translate3d(0,14px,0) scale(.985); }
  to{ opacity:1; transform:translate3d(0,0,0) scale(1); }
}
@keyframes csDrawerSectionIn{
  from{ opacity:0; transform:translate3d(10px,5px,0); }
  to{ opacity:1; transform:translate3d(0,0,0); }
}
@keyframes csDrawerLionIn{
  from{ opacity:0; transform:translate3d(22px,-2px,0) scale(.95); }
  to{ opacity:var(--cs-lion-opacity); transform:translate3d(8px,0,0) scale(.975); }
}

.cs-d-head{
  position:relative;
  z-index:1;
  padding: 9px 12px 10px;
  border-bottom:1px solid rgba(255,255,255,.075);
  background:linear-gradient(180deg,rgba(255,255,255,.025),rgba(255,255,255,0));
  display:flex;
  flex-direction:column;
  gap:7px;
}
.cs-d-brandRow{
  width:100%;
  min-height:42px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}
.cs-d-brandLogo .brand-logo-img{
  height:40px;
  max-width:154px;
}

/* profile header */
.cs-prof{
  display:flex;
  align-items:center;
  gap:10px;
  min-width:0;
}
.cs-avatar{
  width:42px;
  height:42px;
  border-radius:999px;
  border:1px solid rgba(255,204,58,.30);
  background: radial-gradient(circle at 28% 18%, rgba(255,225,115,.24), transparent 42%),
              linear-gradient(145deg,#2b2415,#101216 70%);
  display:flex;
  align-items:center;
  justify-content:center;
  color:#ffe37c;
  font-weight: 900;
  font-size: 18px;
  flex: 0 0 auto;
  overflow:hidden;
  box-shadow:0 8px 24px rgba(0,0,0,.30), inset 0 1px 0 rgba(255,255,255,.08);
}
.cs-avatar img{
  width:100%;
  height:100%;
  object-fit: cover;
  display:block;
}
.cs-prof-name{
  font-weight: 900;
  color:#fff8dc;
  line-height:1.1;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-prof-sub{
  font-size:12px;
  color: var(--muted);
  margin-top: 3px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}
.cs-prof-link{
  display:inline-flex;
  align-items:center;
  min-height:36px;
  padding:0 4px;
  margin: 0 -4px;
  font-size: 11px;
  font-weight: 900;
  color:#ffd45a;
  text-decoration:none;
  width: fit-content;
}
.cs-prof-link:hover{ text-decoration: underline; }
.cs-prof-meta{
  display:flex;
  align-items:center;
  gap:6px;
  flex-wrap:wrap;
}
.cs-planPill{
  display:inline-flex;
  align-items:center;
  gap:4px;
  min-height:36px;
  padding:5px 9px;
  border:1px solid rgba(245,184,28,.28);
  border-radius:999px;
  background:rgba(245,153,0,.07);
  color:#ffe171;
  font-size:9.5px;
  line-height:1;
  font-weight:850;
  text-decoration:none;
}
.cs-planPill:hover{ border-color:rgba(245,184,28,.56); background:rgba(245,153,0,.12); }

/* section title */
.cs-sec{
  padding: 3px 7px 0;
}
.cs-sec-title{
  padding: 7px 9px 3px;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .13em;
  text-transform: uppercase;
  color: rgba(255,212,90,.82);
}

/* item */
.cs-item, .cs-item-disabled{
  position:relative;
  display:flex;
  align-items:center;
  gap:8px;
  width:calc(100% - 8px);
  min-height:48px;
  padding: 6px 8px;
  border-radius: 12px;
  border:1px solid transparent;
  text-decoration:none;
  color: var(--txt);
  font-weight: 800;
  font:inherit;
  text-align:left;
  transition: background .18s ease, border-color .18s ease, transform .12s ease, box-shadow .18s ease, color .18s ease;
  margin: 1px 4px;
  overflow:hidden;
  -webkit-tap-highlight-color:transparent;
}
.cs-item:hover{
  background:linear-gradient(135deg,rgba(255,255,255,.05),rgba(245,153,0,.025));
  border-color:rgba(255,210,84,.18);
  transform: translateY(-1px);
}
.cs-item:active{ transform:scale(.985); }
.cs-item.active{
  background:
    radial-gradient(170px 70px at 100% 50%,rgba(245,153,0,.32),transparent 68%),
    linear-gradient(100deg,rgba(245,153,0,.15),rgba(255,196,44,.045) 54%,rgba(255,255,255,.025)),
    #111216;
  color:#fff8df;
  border-color:rgba(244,177,22,.74);
  box-shadow:0 0 0 1px rgba(245,153,0,.15),0 0 24px rgba(229,145,0,.18),inset 0 1px 0 rgba(255,228,137,.12);
}
.cs-item.active::before{
  content:"";
  position:absolute;
  top:8px;
  bottom:8px;
  left:0;
  width:2px;
  border-radius:0 999px 999px 0;
  background:linear-gradient(180deg,#fff0a0,#f59f00);
  box-shadow:0 0 10px rgba(245,153,0,.9);
}
.cs-ic{
  width:32px;
  height:32px;
  border-radius: 10px;
  border:1px solid rgba(255,255,255,.11);
  background:linear-gradient(145deg,rgba(255,255,255,.045),rgba(0,0,0,.18));
  display:flex;
  align-items:center;
  justify-content:center;
  font-size: 18px;
  flex: 0 0 auto;
}
.cs-ic svg{
  width:17px;
  height:17px;
  transition:transform .22s cubic-bezier(.22,1,.36,1), color .18s ease;
}
.cs-item.active .cs-ic{
  color:#ffd33d;
  border-color:rgba(245,184,28,.42);
  background:rgba(245,153,0,.10);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 16px rgba(245,153,0,.11);
}
.cs-item:hover .cs-ic svg{ transform:scale(1.06); }
.cs-desc{
  display:flex;
  flex-direction:column;
  gap:2px;
  min-width:0;
}
.cs-desc > span{
  font-size:13px;
  line-height:1.15;
  font-weight:850;
}

/* ✅ descripción SIEMPRE visible */
.cs-subline{
  display:block;
  margin-top:2px;
  font-weight: 600;
  color: var(--muted);
  opacity:.9;
  font-size:10px;
  line-height:1.25;
}
.cs-item.active .cs-subline{
  color:rgba(255,245,213,.72);
  opacity:1;
}
.cs-itemArrow{
  flex:0 0 auto;
  margin-left:auto;
  color:rgba(255,255,255,.42);
  transition:transform .18s ease,color .18s ease;
}
.cs-item:hover .cs-itemArrow{ transform:translateX(2px); color:rgba(255,220,112,.72); }
.cs-item.active .cs-itemArrow{ color:#ffd23f; }

/* disabled item */
.cs-item-disabled{
  background:#0f0f0f;
  border-color:#1e1e1e;
  opacity: .78;
  cursor: pointer;
}
.cs-item-disabled:hover{ transform:none; }
.cs-badge{
  margin-left:auto;
  font-size:8.5px;
  font-weight:900;
  color:#0a0a0a;
  background: linear-gradient(135deg,var(--gold2),var(--gold));
  padding:4px 6px;
  border-radius:999px;
}

/* drawer body scroll */
.cs-d-body{
  position:relative;
  z-index:1;
  flex:1;
  min-height:0;
  padding: 3px 0 8px;
  overflow:auto;
  scrollbar-width:thin;
  scrollbar-color:rgba(245,184,28,.55) transparent;
}
.cs-d-body::-webkit-scrollbar{ width:4px; }
.cs-d-body::-webkit-scrollbar-thumb{
  border-radius:999px;
  background:linear-gradient(180deg,#f5a000,#ffe16a);
}
.cs-drawer.open .cs-sec{
  animation:csDrawerSectionIn .2s cubic-bezier(.22,1,.36,1) both;
}
.cs-drawer.open .cs-sec:nth-child(2){ animation-delay:.015s; }
.cs-drawer.open .cs-sec:nth-child(3){ animation-delay:.03s; }
.cs-drawer.open .cs-sec:nth-child(4){ animation-delay:.045s; }
.cs-drawer.open .cs-sec:nth-child(5){ animation-delay:.06s; }

/* footer */
.cs-d-foot{
  position:relative;
  z-index:1;
  margin-top:auto;
  padding: 5px 7px calc(7px + env(safe-area-inset-bottom));
  border-top:1px solid rgba(255,255,255,.075);
  background:linear-gradient(180deg,rgba(8,10,13,.76),rgba(5,7,10,.98));
  display:flex;
  flex-direction:column;
  gap:1px;
}
.cs-foot-item{
  color:#f6f7f8;
}
.cs-foot-item:disabled{
  opacity:.58;
  cursor:not-allowed;
}

/* logout overlay (premium) */
.cn-ov{
  position:fixed;
  inset:0;
  background: rgba(11,11,11,.55);
  backdrop-filter: blur(6px) saturate(140%);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index:10000;
  padding:18px;
}
.cn-ov-card{
  width:min(520px, 100%);
  border:1px solid #232323;
  background: linear-gradient(180deg,#121212,#0b0b0b);
  border-radius:18px;
  padding:18px 16px;
  position:relative;
  overflow:hidden;
  box-shadow: 0 18px 70px rgba(0,0,0,.65);
}
.cn-ov-glow{
  position:absolute;
  inset:-2px;
  background: radial-gradient(600px 200px at 20% 0%, rgba(245,215,110,.22), transparent 60%),
              radial-gradient(520px 220px at 80% 100%, rgba(250,204,21,.10), transparent 60%);
  pointer-events:none;
}
.cn-ov-row{ display:flex; align-items:center; gap:12px; position:relative; }
.cn-ov-spin{
  width:44px; height:44px; border-radius:50%;
  border:3px solid rgba(245,215,110,.18);
  border-top-color: rgba(245,215,110,.95);
  box-shadow: 0 0 18px rgba(245,215,110,.18);
  animation: cnSpin .9s linear infinite;
  flex:0 0 auto;
}
@keyframes cnSpin{ to{ transform: rotate(360deg); } }
.cn-ov-title{ font-weight:900; margin:0; color:#f5d76e; font-size:16px; }
.cn-ov-sub{ margin:4px 0 0; color:#cfcfcf; font-size:13px; line-height:1.4; }
.cn-ov-shimmer{
  margin-top:14px; height:10px; border-radius:999px;
  background:#101010; border:1px solid #1f1f1f;
  overflow:hidden; position:relative;
}
.cn-ov-shimmer::after{
  content:""; position:absolute; inset:0;
  transform: translateX(-60%);
  background: linear-gradient(90deg, transparent, rgba(245,215,110,.35), transparent);
  animation: cnShimmer 1.2s ease-in-out infinite;
}
@keyframes cnShimmer{ 0%{ transform: translateX(-60%);} 100%{ transform: translateX(160%);} }

@media (max-width:767px){
  .cs-header-inner{
    min-height:64px;
    padding:7px 12px;
    gap:10px;
  }
  .cs-btn{ width:44px; height:44px; border-radius:14px; }
  .cs-logo{ width:40px; height:40px; border-radius:13px; }
  .cs-brandLogo .brand-logo-img{
    height:44px;
    max-width:176px;
  }
  .cs-sub{
    display:none;
  }
  .cs-logoutBtn{ display:none; }
  .cs-content{
    padding:14px 10px calc(var(--zf-mobile-nav-height, 74px) + 34px + env(safe-area-inset-bottom));
  }
  .cs-mobileNav{
    position:fixed;
    z-index:86;
    right:10px;
    bottom:calc(8px + env(safe-area-inset-bottom));
    left:10px;
    min-height:var(--zf-mobile-nav-height, 74px);
    display:grid;
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:3px;
    padding:7px;
    border:1px solid rgba(255,255,255,.10);
    border-radius:22px;
    background:linear-gradient(180deg,rgba(15,22,30,.94),rgba(6,10,15,.97));
    box-shadow:0 22px 60px rgba(0,0,0,.54), inset 0 1px 0 rgba(255,255,255,.055);
    backdrop-filter:blur(20px) saturate(155%);
    transition:opacity var(--zf-motion-fast, .15s) ease, transform var(--zf-motion-base, .22s) var(--zf-ease-enter, ease), visibility var(--zf-motion-fast, .15s) ease;
  }
  .cs-mobileNavItem{
    position:relative;
    min-width:0;
    min-height:58px;
    border:0;
    border-radius:16px;
    background:transparent;
    color:#8f9baa;
    text-decoration:none;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:3px;
    padding:4px 2px;
    font:inherit;
    font-size:10px;
    font-weight:850;
    cursor:pointer;
    transition:color .16s ease, background-color .16s ease, transform .1s ease;
  }
  .cs-mobileNavItem svg{
    width:21px;
    height:21px;
    transition:transform .2s cubic-bezier(.22,1,.36,1);
  }
  .cs-mobileNavItem::before{
    content:"";
    position:absolute;
    top:2px;
    width:18px;
    height:2px;
    border-radius:999px;
    background:var(--gold);
    opacity:0;
    transform:scaleX(.4);
    transition:opacity .16s ease, transform .22s cubic-bezier(.22,1,.36,1);
  }
  .cs-mobileNavItem.active{
    color:#fff1a8;
    background:linear-gradient(180deg,rgba(245,215,110,.13),rgba(245,215,110,.035));
  }
  .cs-mobileNavItem.active::before{
    opacity:1;
    transform:scaleX(1);
  }
  .cs-mobileNavItem.active svg{ transform:translateY(-1px) scale(1.06); }
  .cs-mobileNavItem:active{ transform:scale(.96); }
  .cs-avatar{ width:46px; height:46px; }
  .cs-coachNotice{
    align-items:flex-start;
    flex-direction:column;
  }
  .cs-coachNoticeActions{
    width:100%;
  }
  .cs-actionBtn{
    flex:1 1 140px;
    min-height:44px;
  }
  .cs-drawer{
    --cs-lion-opacity:.11;
    width:min(356px,94vw);
  }
  .cs-d-head{
    padding:8px 10px 8px;
  }
  .cs-drawerLion{ right:-66px; }
  .cs-d-brandLogo .brand-logo-img{ height:38px; max-width:146px; }
  .cs-prof{ gap:9px; }
  .cs-avatar{ width:40px; height:40px; }
  .cs-prof-link{ margin:0 -4px; }
  .cs-sec{ padding:3px 7px 0; }
  .cs-sec-title{ padding:6px 9px 2px; }
}

@media (min-width:768px){
  .cs-brandLogo .brand-logo-img{
    height:54px;
    max-width:230px;
  }
}

@media (prefers-reduced-motion:reduce){
  .cs-ov,
  .cs-drawer,
  .cs-drawer.open .cs-sec,
  .cs-drawerLion{
    animation:none !important;
    transition:none !important;
  }
}

/* Onboarding owns the full viewport: no duplicated app chrome or mobile gutters. */
.cs-wrap--onboarding .cs-header,
.cs-wrap--onboarding .cs-ov,
.cs-wrap--onboarding .cs-drawer{
  display:none !important;
}
.cs-wrap--onboarding .cs-content{
  width:100%;
  max-width:none;
  min-height:100dvh;
  margin:0;
  padding:0;
}
`;

function firstName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  return s.split(/\s+/)[0];
}
function initialFromName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "Z";
  return s[0].toUpperCase();
}
function formatShellDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function normalizeShellRole(role) {
  return String(role || "").trim().toLowerCase();
}
function shouldClientDoOnboarding(user) {
  const role = normalizeShellRole(user?.role || user?.rol);
  const tipo = normalizeShellRole(user?.tipo);
  return (
    (role === "cliente" || role === "client") &&
    tipo === "entrenado" &&
    user?.onboarding?.enabled === true &&
    user?.onboarding?.done !== true
  );
}
function invitationSkipsOnboarding(invitation) {
  const onboarding = invitation?.onboarding || {};
  return onboarding.enabled === false || normalizeShellRole(onboarding.mode) === "none";
}
function userWithSkippedOnboarding(user) {
  if (!user) return user;
  return {
    ...user,
    onboarding: {
      ...(user.onboarding || {}),
      enabled: false,
      mode: "none",
      done: true,
    },
  };
}

function ClientCoachAssignmentNotice({ notice, busy = false, onDismiss, onProfile }) {
  const coachName = notice?.coachName || "tu coach";
  return (
    <section className="cs-coachNotice" aria-live="polite">
      <div className="cs-coachNoticeText">
        <span className="cs-coachNoticeLabel">Asignacion de coach</span>
        <strong>Fuiste asignado a {coachName}.</strong>
        <p>
          A partir de ahora este coach puede acompanarte con planificacion, menus, rutina y progreso.
        </p>
      </div>
      <div className="cs-coachNoticeActions">
        <button type="button" className="cs-actionBtn" onClick={onProfile}>
          Ver perfil
        </button>
        <button type="button" className="cs-actionBtn gold" disabled={busy} onClick={onDismiss}>
          {busy ? "Guardando..." : "Entendido"}
        </button>
      </div>
    </section>
  );
}

/**
 * 🔧 CONFIG
 * - Se quitó Notificaciones del drawer.
 * - Ajustes también se quitó del drawer (queda solo "Salir" abajo).
 */
const NAV_TOP = [
  { to: "/app/inicio", label: "Inicio", sub: "Resumen y accesos", icon: <House size={19} aria-hidden="true" />, enabled: true },
];

const NAV_SECTIONS = [
  {
    title: "Tu plan",
    items: [
      { to: "/app/objetivos", label: "Objetivos", sub: "Nutricion y entrenamiento", icon: <Target size={19} aria-hidden="true" />, enabled: true },
      { to: "/app/menu", label: "Menú", sub: "Comidas y planificación", icon: <Utensils size={19} aria-hidden="true" />, enabled: true },
      { to: "/app/nutricion", label: "Mis comidas", sub: "Guardadas y favoritas", icon: <BookOpen size={19} aria-hidden="true" />, enabled: true },
      { to: "/app/tracking", label: "Tracking", sub: "Registro diario", icon: <ClipboardCheck size={19} aria-hidden="true" />, enabled: true },
      { to: "/app/rutinas", label: "Rutina", sub: "Entrenamiento", icon: <Dumbbell size={19} aria-hidden="true" />, enabled: true },
      { to: "/app/equivalencias", label: "Equivalencias", sub: "Intercambios de alimentos", icon: <Brain size={19} aria-hidden="true" />, enabled: false },
    ],
  },
  {
    title: "Tu progreso",
    items: [
      { to: "/app/progresos", label: "Progresos", sub: "Medidas y fotos", icon: <TrendingUp size={19} aria-hidden="true" />, enabled: true },
    ],
  },
];

const CLIENT_ROUTE_PREFETCH_PATHS = [
  "/app/menu",
  "/app/tracking",
  "/app/progresos",
  "/app/inicio",
  "/app/rutinas",
  "/app/objetivos",
  "/app/perfil",
  "/app/ajustes",
  "/app/planes",
  "/app/nutricion",
  "/app/menu/nuevo",
];

let drawerLionPreloadPromise = null;

function preloadDrawerLion() {
  if (drawerLionPreloadPromise || typeof Image === "undefined") return drawerLionPreloadPromise;
  const image = new Image();
  image.decoding = "async";
  image.fetchPriority = "low";
  image.src = "/images/brand/lion-drawer-watermark.png";
  drawerLionPreloadPromise = typeof image.decode === "function"
    ? image.decode().catch(() => undefined)
    : new Promise((resolve) => {
        image.onload = resolve;
        image.onerror = resolve;
      });
  return drawerLionPreloadPromise;
}

export default function ClientShell() {
  const nav = useNavigate();
  const loc = useLocation();
  const menuButtonRef = useRef(null);
  const cachedUser = useMemo(() => getCachedUser(), []);
  const meQuery = useAuthMe({
    enabled: true,
    initialFromCache: true,
    staleTime: 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const user = meQuery.data || cachedUser;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [invitationBusy, setInvitationBusy] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const [coachNoticeBusy, setCoachNoticeBusy] = useState(false);
  const invitationSessionKey = `coach_invite_snooze_${user?.id || user?._id || user?.email || "anon"}`;
  const [invitationSnoozed, setInvitationSnoozed] = useState(() => {
    try {
      return sessionStorage.getItem(invitationSessionKey) === "1";
    } catch {
      return false;
    }
  });
  const role = normalizeShellRole(user?.role || user?.rol);
  const isClientUser = role === "cliente" || role === "client";
  const invitationQueryKey = queryKeys.pendingCoachInvitations(user?.id || user?._id || user?.email || "");
  const pendingInvitationsQuery = useQuery({
    queryKey: invitationQueryKey,
    queryFn: getPendingCoachInvitations,
    enabled: isClientUser && !isImpersonating(),
    staleTime: 30 * 1000,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const accessContextQuery = useQuery({
    queryKey: clientAccessContextKey,
    queryFn: fetchClientAccessContext,
    enabled: isClientUser && !isImpersonating(),
    staleTime: CLIENT_ACCESS_CONTEXT_STALE_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const planSummaryQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    enabled: isClientUser && !isImpersonating() && accessContextQuery.isError,
    staleTime: CLIENT_PLAN_CAPABILITIES_STALE_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const pendingInvitations = Array.isArray(pendingInvitationsQuery.data?.invitations)
    ? pendingInvitationsQuery.data.invitations
    : [];
  const primaryInvitation = pendingInvitations[0] || null;
  const coachNotice = user?.clientCoachNotice || null;
  const showCoachNotice =
    isClientUser &&
    !isImpersonating() &&
    coachNotice?.type === "admin_coach_assigned" &&
    coachNotice?.status === "unread";

  function applyAccessContext(nextAccessContext) {
    if (!nextAccessContext) return;
    queryClient.setQueryData(clientAccessContextKey, nextAccessContext);
    queryClient.invalidateQueries({ queryKey: clientPlanCapabilitiesKey });
  }

  const dismissTrialOfferMutation = useMutation({
    mutationFn: acknowledgeClientTrialOnboardingOffer,
    onSuccess: (nextAccessContext) => {
      applyAccessContext(nextAccessContext);
      setToast({ type: "success", message: "Listo. Seguís con Free y podés activar la prueba desde Mi plan." });
    },
    onError: (error) => {
      setToast({ type: "error", message: error?.message || "No se pudo guardar tu preferencia." });
    },
  });

  const startTrialMutation = useMutation({
    mutationFn: startClientProTrial,
    onSuccess: (nextAccessContext) => {
      applyAccessContext(nextAccessContext);
      const ends = formatShellDate(nextAccessContext?.trial?.endsAt);
      setToast({
        type: "success",
        message: ends ? `Tu prueba Pro está activa hasta el ${ends}.` : "Tu prueba Pro está activa.",
      });
    },
    onError: (error) => {
      setToast({ type: "error", message: error?.message || "No se pudo activar la prueba Pro." });
    },
  });

  const acknowledgeExpiryMutation = useMutation({
    mutationFn: acknowledgeClientTrialExpiryNotice,
    onSuccess: (nextAccessContext) => {
      applyAccessContext(nextAccessContext);
      setToast({ type: "success", message: "Seguís en Free. Podés solicitar Pro cuando quieras." });
    },
    onError: (error) => {
      setToast({ type: "error", message: error?.message || "No se pudo cerrar el aviso." });
    },
  });

  const requestProAfterTrialMutation = useMutation({
    mutationFn: async () => {
      const requestData = await createClientPlanChangeRequest("pro");
      const nextAccessContext = await acknowledgeClientTrialExpiryNotice();
      return { requestData, nextAccessContext };
    },
    onSuccess: ({ requestData, nextAccessContext }) => {
      applyAccessContext(requestData?.accessContext || nextAccessContext);
      if (nextAccessContext) applyAccessContext(nextAccessContext);
      setToast({
        type: "success",
        message: requestData?.pendingAlreadyExists
          ? "Ya tenés una solicitud Pro pendiente."
          : "Solicitud Pro enviada. Administración la va a revisar.",
      });
      nav("/app/planes");
    },
    onError: (error) => {
      setToast({ type: "error", message: error?.message || "No se pudo solicitar el plan Pro." });
    },
  });

  const closeDrawer = useCallback(({ restoreFocus = false } = {}) => {
    setOpen(false);
    if (restoreFocus) {
      window.setTimeout(() => menuButtonRef.current?.focus(), 0);
    }
  }, []);

  // ✅ cierra drawer cuando cambia la ruta
  useEffect(() => {
    setOpen(false);
  }, [loc.pathname]);

  // ✅ bloquea scroll de fondo y libera la capa al cerrar
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, closeDrawer]);

  // ✅ ESC para cerrar
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") closeDrawer({ restoreFocus: true });
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeDrawer]);

  async function logout() {
    if (isImpersonating()) return;
    if (loading) return;
    closeDrawer();
    setLoading(true);
    setToast(null);
    try {
      await apiFetch("/api/usuarios/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("[ClientShell] logout FAIL", err);
      setToast({
        type: "error",
        message: err?.message || "No se pudo cerrar sesion. Proba de nuevo.",
      });
      setLoading(false);
      return;
    }

    setAuthGuest();
    clearPrivateQueryCache();
    nav("/", { replace: true });
    setTimeout(() => setLoading(false), 200);
  }

  async function refreshInvitations() {
    await queryClient.invalidateQueries({ queryKey: invitationQueryKey, exact: true });
    await queryClient.invalidateQueries({ queryKey: clientAccessContextKey });
    await queryClient.invalidateQueries({ queryKey: clientPlanCapabilitiesKey });
  }

  function cacheAcceptedUser(nextUser) {
    if (!nextUser) return;
    setAuthLogged(nextUser);
    setAuthUserQueryData(nextUser);
  }

  async function handleDismissCoachNotice() {
    if (coachNoticeBusy) return;
    setCoachNoticeBusy(true);
    try {
      const data = await dismissCoachAssignmentNotice();
      if (data?.user) cacheAcceptedUser(data.user);
      setToast({
        type: "success",
        message: "Listo. Dejamos registrado que viste la asignacion del coach.",
      });
    } catch (error) {
      setToast({
        type: "error",
        message: error?.message || "No se pudo marcar la notificacion como vista.",
      });
    } finally {
      setCoachNoticeBusy(false);
    }
  }

  async function handleAcceptInvitation(invitation) {
    if (!invitation?.id || invitationBusy) return;
    setInvitationBusy("accept");
    setInvitationError("");
    try {
      const data = await acceptCoachInvitation(invitation.id);
      const skipOnboarding = invitationSkipsOnboarding(invitation);
      const nextUser = skipOnboarding ? userWithSkippedOnboarding(data?.user || null) : data?.user || null;
      cacheAcceptedUser(nextUser);
      await refreshInvitations();
      setInvitationSnoozed(false);
      try {
        sessionStorage.removeItem(invitationSessionKey);
      } catch {
        // sessionStorage puede no estar disponible en algunos entornos.
      }
      setToast({
        type: "success",
        message: `Invitación aceptada. Ya quedaste vinculado con ${invitation.coachName || "tu coach"}.`,
      });
      const nextPath = skipOnboarding
        ? "/app/inicio"
        : data?.nextPath || (shouldClientDoOnboarding(nextUser) ? "/app/onboarding" : "/app/inicio");
      nav(nextPath, { replace: true });
    } catch (error) {
      const message = error?.message || "No se pudo procesar la invitacion. Intenta nuevamente.";
      setInvitationError(message);
      setToast({ type: "error", message });
    } finally {
      setInvitationBusy("");
    }
  }

  async function handleDeclineInvitation(invitation) {
    if (!invitation?.id || invitationBusy) return;
    setInvitationBusy("decline");
    setInvitationError("");
    try {
      const data = await declineCoachInvitation(invitation.id);
      if (data?.user) cacheAcceptedUser(data.user);
      await refreshInvitations();
      setToast({
        type: "success",
        message: "Rechazaste la invitacion. Podes seguir usando ZumaFit de forma autogestionada.",
      });
    } catch (error) {
      const message = error?.message || "No se pudo rechazar la invitacion. Intenta nuevamente.";
      setInvitationError(message);
      setToast({ type: "error", message });
    } finally {
      setInvitationBusy("");
    }
  }

  async function handleBlockInvitation(invitation, options = {}) {
    if (!invitation?.id || invitationBusy) return;
    if (!options?.confirmed) {
      const ok = window.confirm(
        `Bloquear a ${invitation.coachName || "este coach"}? No va a poder volver a enviarte invitaciones mientras este bloqueado.`
      );
      if (!ok) return;
    }

    setInvitationBusy("block");
    setInvitationError("");
    try {
      const data = await blockCoachInvitation(invitation.id, options);
      if (data?.user) {
        cacheAcceptedUser(data.user);
        setAuthUserQueryData(data.user);
      }
      await refreshInvitations();
      setInvitationSnoozed(false);
      try {
        sessionStorage.removeItem(invitationSessionKey);
      } catch {
        // sessionStorage puede no estar disponible en algunos entornos.
      }
      setToast({
        type: "success",
        message: "Coach bloqueado. Descartamos sus invitaciones pendientes.",
      });
    } catch (error) {
      const message = error?.message || "No se pudo bloquear al coach. Intenta nuevamente.";
      setInvitationError(message);
      setToast({ type: "error", message });
    } finally {
      setInvitationBusy("");
    }
  }

  function handleSnoozeInvitation() {
    setInvitationSnoozed(true);
    setInvitationError("");
    try {
      sessionStorage.setItem(invitationSessionKey, "1");
    } catch {
      // sessionStorage puede no estar disponible en algunos entornos.
    }
  }

  const fullName = user?.profile?.nombre || user?.nombre || "";
  const nombre = firstName(fullName);
  const sub = nombre ? `Hola, ${nombre}` : "Tu espacio";
  const shellAccessContext = accessContextQuery.data || null;
  const shellAccessCapabilities = capabilitiesFromResolvedAccess(shellAccessContext);
  const shellCapabilities = shellAccessCapabilities || planSummaryQuery.data || user?.nutritionCapabilities || null;
  const rawShellPlan = shellCapabilities?.plan || user?.nutritionCapabilities?.plan || user?.plan;
  const shellPlan = rawShellPlan ? planFromCapabilities(user, shellCapabilities) : "";
  const planDrawerItem = {
    to: "/app/planes",
    label: "Mi plan",
    sub: rawShellPlan
      ? `${clientPlanLabel(shellPlan)} · Ver beneficios`
      : planSummaryQuery.isLoading
        ? "Cargando beneficios"
        : "Ver beneficios",
    icon: <Crown size={19} aria-hidden="true" />,
    enabled: true,
  };
  const isOnboardingRoute = loc.pathname.startsWith("/app/onboarding");
  const showTrialWelcomeModal = Boolean(
    isClientUser &&
    !isImpersonating() &&
    !isOnboardingRoute &&
    !primaryInvitation &&
    shellAccessContext?.trialOffer?.showOnboardingOffer
  );
  const showTrialExpiredModal = Boolean(
    isClientUser &&
    !isImpersonating() &&
    !showTrialWelcomeModal &&
    !primaryInvitation &&
    shellAccessContext?.trial?.expiryNoticeRequired
  );

  useEffect(() => {
    return scheduleIdleRoutePrefetch(CLIENT_ROUTE_PREFETCH_PATHS, {
      delay: 120,
      interval: 80,
      timeout: 900,
    });
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const warmImage = () => { void preloadDrawerLion(); };
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(warmImage, { timeout: 1000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const timer = window.setTimeout(warmImage, 250);
    return () => window.clearTimeout(timer);
  }, []);

  // (opcional) si en el futuro tenés una URL de avatar:
  const avatarUrl = user?.profile?.avatarUrl || user?.avatarUrl || "";

  function renderItem(it) {
    if (!it.enabled) {
      return (
        <button
          key={it.to}
          type="button"
          className="cs-item-disabled"
          title={`${it.label} (Próximamente)`}
          aria-disabled="true"
          onClick={() => closeDrawer({ restoreFocus: true })}
        >
          <span className="cs-ic">{it.icon}</span>
          <span className="cs-desc">
            <span>{it.label}</span>
            <small className="cs-subline">{it.sub}</small>
          </span>
          <span className="cs-badge">Próximamente</span>
        </button>
      );
    }

    return (
      <NavLink
        key={it.to}
        to={it.to}
        className={({ isActive }) => `cs-item ${isActive ? "active" : ""}`}
        title={it.label}
        onClick={() => closeDrawer()}
        {...createNavigationPrefetchHandlers(it.to)}
      >
        <span className="cs-ic">{it.icon}</span>
        <span className="cs-desc">
          <span>{it.label}</span>
          <small className="cs-subline">{it.sub}</small>
        </span>
        <ChevronRight className="cs-itemArrow" size={15} strokeWidth={2.2} aria-hidden="true" />
      </NavLink>
    );
  }

  return (
    <div className={`cs-wrap ${isOnboardingRoute ? "cs-wrap--onboarding" : ""}`}>
      <style>{CSS}</style>
      <ImpersonationBanner />
      <AppToast toast={toast} onClose={() => setToast(null)} />
      {!isOnboardingRoute && primaryInvitation && !invitationSnoozed ? (
        <PendingCoachInvitationModal
          invitations={pendingInvitations}
          busy={invitationBusy}
          error={invitationError}
          onAccept={handleAcceptInvitation}
          onDecline={handleDeclineInvitation}
          onBlock={handleBlockInvitation}
          onSnooze={handleSnoozeInvitation}
        />
      ) : null}

      {showTrialWelcomeModal ? (
        <div className="cs-planModalOverlay" role="dialog" aria-modal="true" aria-labelledby="trial-welcome-title">
          <section className="cs-planModal">
            <span className="cs-planModalBadge">Tu cuenta Free está lista</span>
            <h2 id="trial-welcome-title">Probá ZumaFit Pro gratis durante 14 días</h2>
            <p>
              Accedé a menús semanales, más capacidad, biblioteca global, equivalencias, 14 días de historial nutricional y progreso avanzado.
              La prueba no se activa sola.
            </p>
            <ul className="cs-planModalList">
              <li>Sin cobro automático.</li>
              <li>Tu plan personal sigue siendo Free.</li>
              <li>Al terminar, volvés a Free y tus datos quedan guardados.</li>
            </ul>
            <div className="cs-planModalActions">
              <button
                type="button"
                className="primary"
                disabled={startTrialMutation.isPending || dismissTrialOfferMutation.isPending}
                onClick={() => startTrialMutation.mutate()}
              >
                {startTrialMutation.isPending ? "Activando..." : "Activar 14 días Pro"}
              </button>
              <button
                type="button"
                disabled={startTrialMutation.isPending || dismissTrialOfferMutation.isPending}
                onClick={() => dismissTrialOfferMutation.mutate()}
              >
                {dismissTrialOfferMutation.isPending ? "Guardando..." : "Seguir con Free"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {showTrialExpiredModal ? (
        <div className="cs-planModalOverlay" role="dialog" aria-modal="true" aria-labelledby="trial-expired-title">
          <section className="cs-planModal">
            <span className="cs-planModalBadge">Prueba Pro finalizada</span>
            <h2 id="trial-expired-title">Tu prueba Pro terminó</h2>
            <p>
              Volviste al plan Free. Tus menús, comidas, progreso y registros siguen guardados. Podés continuar gratis o
              solicitar Pro para recuperar las funciones avanzadas.
            </p>
            <div className="cs-planModalActions">
              <button
                type="button"
                className="primary"
                disabled={requestProAfterTrialMutation.isPending || acknowledgeExpiryMutation.isPending}
                onClick={() => requestProAfterTrialMutation.mutate()}
              >
                {requestProAfterTrialMutation.isPending ? "Enviando..." : "Solicitar plan Pro"}
              </button>
              <button
                type="button"
                disabled={requestProAfterTrialMutation.isPending || acknowledgeExpiryMutation.isPending}
                onClick={() => acknowledgeExpiryMutation.mutate()}
              >
                {acknowledgeExpiryMutation.isPending ? "Guardando..." : "Continuar con Free"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {loading ? (
        <FullPageLoader
          title="Cerrando sesión..."
          sub="Guardando cambios y asegurando tu cuenta."
          variant="overlay"
        />
      ) : null}

      <header className="cs-header">
        <div className="cs-header-inner">
          <div className="cs-brand">
            <div className="cs-brand-stack">
              <BrandLogo className="cs-brandLogo" size="client" priority />
              <div className="cs-sub">{sub}</div>
            </div>
          </div>

          <div className="cs-actions">
            <button
              ref={menuButtonRef}
              type="button"
              className="cs-btn cs-menuBtn"
              onClick={() => setOpen(true)}
              onPointerEnter={preloadDrawerLion}
              onPointerDown={preloadDrawerLion}
              onTouchStart={preloadDrawerLion}
              aria-label="Abrir menú"
              title="Menú"
              aria-expanded={open}
              aria-controls="client-main-menu"
            >
              <Menu size={22} strokeWidth={2.3} aria-hidden="true" />
            </button>

            <button
              type="button"
              className={`cs-btn cs-logoutBtn ${loading ? "is-loading" : ""}`}
              onClick={logout}
              disabled={loading || isImpersonating()}
              aria-label={isImpersonating() ? "Modo solo lectura" : loading ? "Cerrando sesión..." : "Cerrar sesión"}
              title={isImpersonating() ? "Modo solo lectura" : loading ? "Cerrando sesión..." : "Cerrar sesión"}
            >
              {isImpersonating() ? "SL" : loading ? "…" : <LogOut size={21} strokeWidth={2.2} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {/* overlay */}
      {open && <div className="cs-ov" onClick={() => closeDrawer({ restoreFocus: true })} aria-hidden="true" />}

      <aside
        id="client-main-menu"
        className={`cs-drawer ${open ? "open" : ""}`}
        role="dialog"
        aria-modal={open ? "true" : undefined}
        aria-hidden={!open}
        inert={!open}
        aria-label="Menú principal"
      >
        {open ? (
          <img
            className="cs-drawerLion"
            src="/images/brand/lion-drawer-watermark.png"
            alt=""
            aria-hidden="true"
            width="560"
            height="840"
            decoding="async"
          />
        ) : null}
        <div className="cs-d-head">
          <div className="cs-d-brandRow">
            <BrandLogo className="cs-d-brandLogo" size="sm" />

            <button type="button" className="cs-btn" onClick={() => closeDrawer({ restoreFocus: true })} aria-label="Cerrar menú" title="Cerrar">
              <X size={20} strokeWidth={2.3} aria-hidden="true" />
            </button>
          </div>

          <div className="cs-prof">
            <div className="cs-avatar" aria-label="Avatar">
              {avatarUrl ? <img src={avatarUrl} alt="Avatar" /> : <span>{initialFromName(fullName)}</span>}
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="cs-prof-name">{fullName ? fullName : "Mi cuenta"}</div>
              <div className="cs-prof-sub">{sub}</div>

              <div className="cs-prof-meta">
                <NavLink
                  className="cs-planPill"
                  to="/app/planes"
                  onClick={() => closeDrawer()}
                  {...createNavigationPrefetchHandlers("/app/planes")}
                >
                  <Crown size={11} strokeWidth={2.2} aria-hidden="true" />
                  <span>{rawShellPlan ? clientPlanLabel(shellPlan) : "Mi plan"} · Ver beneficios</span>
                </NavLink>
                <NavLink
                  className="cs-prof-link"
                  to="/app/perfil"
                  onClick={() => closeDrawer()}
                  {...createNavigationPrefetchHandlers("/app/perfil")}
                >
                  Ver perfil →
                </NavLink>
              </div>
            </div>
          </div>
        </div>

        <div className="cs-d-body">
          {/* TOP */}
          <div className="cs-sec">{NAV_TOP.map(renderItem)}</div>

          <div className="cs-sec">
            <div className="cs-sec-title">Plan</div>
            {renderItem(planDrawerItem)}
          </div>

          {/* SECTIONS */}
          {NAV_SECTIONS.map((sec) => (
            <div key={sec.title} className="cs-sec">
              <div className="cs-sec-title">{sec.title}</div>
              {sec.items.map(renderItem)}
            </div>
          ))}
        </div>

        <div className="cs-d-foot">
          {renderItem({
            to: "/app/ajustes",
            label: "Configuración",
            sub: "Preferencias de la app",
            icon: <Settings size={18} aria-hidden="true" />,
            enabled: true,
          })}
          <button
            type="button"
            className="cs-item cs-foot-item"
            onClick={logout}
            disabled={loading || isImpersonating()}
          >
            <span className="cs-ic"><LogOut size={18} strokeWidth={2.2} aria-hidden="true" /></span>
            <span className="cs-desc">
              <span>{isImpersonating() ? "Modo solo lectura" : loading ? "Cerrando..." : "Salir"}</span>
            </span>
            <ChevronRight className="cs-itemArrow" size={15} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </aside>

      {/* contenido */}
      <main className="cs-content">
        {!isOnboardingRoute && showCoachNotice ? (
          <ClientCoachAssignmentNotice
            notice={coachNotice}
            busy={coachNoticeBusy}
            onDismiss={handleDismissCoachNotice}
            onProfile={() => nav("/app/perfil")}
          />
        ) : null}
        {!isOnboardingRoute && primaryInvitation && invitationSnoozed ? (
          <ClientInvitationBanner
            invitation={primaryInvitation}
            busy={invitationBusy}
            onAccept={handleAcceptInvitation}
            onDecline={handleDeclineInvitation}
            onBlock={handleBlockInvitation}
          />
        ) : null}
        <Outlet />
      </main>

      {!isOnboardingRoute ? (
        <nav className="cs-mobileNav" aria-label="Navegación principal">
          <NavLink
            to="/app/inicio"
            end
            className={({ isActive }) => `cs-mobileNavItem ${isActive ? "active" : ""}`}
            {...createNavigationPrefetchHandlers("/app/inicio")}
          >
            <House aria-hidden="true" />
            <span>Inicio</span>
          </NavLink>
          <NavLink
            to="/app/menu"
            className={({ isActive }) => `cs-mobileNavItem ${isActive ? "active" : ""}`}
            {...createNavigationPrefetchHandlers("/app/menu")}
          >
            <Utensils aria-hidden="true" />
            <span>Menú</span>
          </NavLink>
          <NavLink
            to="/app/tracking"
            className={({ isActive }) => `cs-mobileNavItem ${isActive ? "active" : ""}`}
            {...createNavigationPrefetchHandlers("/app/tracking")}
          >
            <ClipboardCheck aria-hidden="true" />
            <span>Tracking</span>
          </NavLink>
          <NavLink
            to="/app/progresos"
            className={({ isActive }) => `cs-mobileNavItem ${isActive ? "active" : ""}`}
            {...createNavigationPrefetchHandlers("/app/progresos")}
          >
            <TrendingUp aria-hidden="true" />
            <span>Progreso</span>
          </NavLink>
          <button
            type="button"
            className={`cs-mobileNavItem ${open ? "active" : ""}`}
            onClick={() => setOpen(true)}
            onPointerEnter={preloadDrawerLion}
            onPointerDown={preloadDrawerLion}
            onTouchStart={preloadDrawerLion}
            aria-label="Abrir más opciones"
            aria-expanded={open}
            aria-controls="client-main-menu"
          >
            <MoreHorizontal aria-hidden="true" />
            <span>Más</span>
          </button>
        </nav>
      ) : null}
    </div>
  );
}
