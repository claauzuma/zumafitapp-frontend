import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  LineChart,
  Ruler,
  Scale,
  Target,
  TrendingUp,
} from "lucide-react";
import { getCachedUser } from "../authCache.js";
import {
  CLIENT_PLAN_CAPABILITIES_STALE_TIME,
  clientPlanCapabilitiesKey,
  fetchClientPlanCapabilities,
} from "../clientPlans/clientPlanQueries.js";
import { clientPlanLabel, normalizeClientPlan, planFromCapabilities } from "../clientPlans/clientPlanUtils.js";

const CSS = `
:root{
  --zp-bg:#050608;
  --zp-bg-soft:#08090c;
  --zp-card:#121418;
  --zp-card-2:#15171c;
  --zp-card-3:#181a20;
  --zp-border:rgba(255,255,255,.08);
  --zp-border-strong:#292c33;
  --zp-text:#f5f5f7;
  --zp-muted:#a9adb7;
  --zp-faint:#737985;
  --zp-gold:#ffd21f;
  --zp-gold-2:#f4c400;
  --zp-gold-dark:#8a6a00;
  --zp-green:#39d353;
  --zp-red:#ff5d73;
}

.zp-page{
  min-height:calc(100vh - 120px);
  color:var(--zp-text);
  background:
    radial-gradient(900px 520px at 12% -5%, rgba(255,210,31,.07), transparent 58%),
    radial-gradient(760px 460px at 88% 18%, rgba(57,211,83,.045), transparent 60%),
    linear-gradient(180deg,#050608 0%, #08090c 48%, #050608 100%);
  font-family:Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow-x:hidden;
}

.zp-mobile{
  width:100%;
  max-width:520px;
  margin:0 auto;
  padding:18px 0 26px;
}

.zp-desktop{
  display:none;
}

.zp-topbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  margin-bottom:34px;
}

.zp-brand{
  display:flex;
  align-items:center;
  gap:12px;
  min-width:0;
  overflow:hidden;
}

.zp-brand-stack{
  display:grid;
  min-width:0;
  gap:2px;
  justify-items:start;
}

.zp-logo{
  width:58px;
  height:58px;
  border-radius:20px;
  border:1px solid var(--zp-border-strong);
  background:linear-gradient(145deg, rgba(24,26,32,.92), rgba(9,10,13,.96));
  color:var(--zp-gold);
  display:grid;
  place-items:center;
  font-size:28px;
  font-weight:950;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 20px 44px rgba(0,0,0,.34);
  flex:0 0 auto;
}

.zp-brand-text strong{
  display:block;
  font-size:22px;
  line-height:1;
  letter-spacing:-.02em;
}

.zp-brand-text span{
  display:block;
  margin-top:6px;
  color:var(--zp-muted);
  font-size:16px;
  line-height:1.1;
}

.zp-brandLogo{
  min-width:0;
}

.zp-brandLogo .brand-logo-img{
  height:52px;
  max-width:215px;
}

.zp-brand-text.logo-caption span{
  margin-top:0;
  font-size:13px;
  line-height:1.18;
}

.zp-header-actions{
  display:flex;
  align-items:center;
  gap:12px;
}

.zp-icon-btn{
  width:58px;
  height:58px;
  border-radius:999px;
  border:1px solid var(--zp-border-strong);
  background:rgba(18,20,24,.74);
  color:var(--zp-text);
  display:grid;
  place-items:center;
  position:relative;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06), 0 16px 34px rgba(0,0,0,.28);
  cursor:pointer;
  transition:transform .18s ease, border-color .18s ease, background .18s ease;
}

.zp-icon-btn:hover{
  transform:translateY(-1px);
  border-color:rgba(255,210,31,.35);
  background:rgba(24,26,32,.92);
}

.zp-notification-dot{
  position:absolute;
  top:8px;
  right:13px;
  width:12px;
  height:12px;
  border-radius:999px;
  background:var(--zp-gold);
  box-shadow:0 0 0 4px rgba(255,210,31,.12);
}

.zp-title-block{
  display:grid;
  grid-template-columns:auto 1fr;
  gap:18px;
  align-items:center;
  margin-bottom:28px;
}

.zp-title-icon{
  width:58px;
  height:58px;
  border-radius:16px;
  border:1px solid rgba(255,210,31,.24);
  background:linear-gradient(145deg, rgba(255,210,31,.12), rgba(18,20,24,.95));
  color:var(--zp-gold);
  display:grid;
  place-items:center;
  box-shadow:0 18px 42px rgba(0,0,0,.28);
}

.zp-title-block h1{
  margin:0;
  font-size:38px;
  line-height:.96;
  letter-spacing:-.045em;
  font-weight:950;
}

.zp-title-block p{
  margin:9px 0 0;
  color:var(--zp-muted);
  font-size:17px;
}

.zp-access-banner{
  margin:-12px 0 22px;
  border:1px solid rgba(255,210,31,.20);
  background:linear-gradient(145deg, rgba(255,210,31,.09), rgba(18,20,24,.78));
  border-radius:20px;
  padding:14px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
}

.zp-access-banner strong,
.zp-access-banner span{
  display:block;
}

.zp-access-banner strong{
  color:#fff6bf;
  font-size:15px;
}

.zp-access-banner span{
  margin-top:3px;
  color:var(--zp-muted);
  font-size:13px;
  line-height:1.35;
}

.zp-access-pill{
  flex:0 0 auto;
  border:1px solid rgba(255,210,31,.30);
  background:rgba(255,210,31,.12);
  color:#ffe984;
  border-radius:999px;
  padding:8px 10px;
  font-size:11px;
  font-weight:950;
  text-transform:uppercase;
  white-space:nowrap;
}

.zp-tabs{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:8px;
  margin:0 -4px 8px;
  border-bottom:1px solid transparent;
}

.zp-tab{
  appearance:none;
  border:0;
  background:transparent;
  color:var(--zp-muted);
  padding:0 8px 24px;
  font:inherit;
  font-size:16px;
  font-weight:850;
  position:relative;
  cursor:pointer;
  -webkit-tap-highlight-color:transparent;
}

.zp-tab::after{
  content:"";
  position:absolute;
  left:50%;
  right:50%;
  bottom:0;
  height:3px;
  border-radius:999px;
  background:var(--zp-gold);
  transition:left .2s ease, right .2s ease, opacity .2s ease;
  opacity:0;
}

.zp-tab.active{
  color:var(--zp-gold);
}

.zp-tab.active::after{
  left:8px;
  right:8px;
  opacity:1;
}

.zp-stack{
  display:grid;
  gap:20px;
}

.zp-card{
  border:1px solid var(--zp-border);
  background:
    radial-gradient(640px 300px at 20% 0%, rgba(255,255,255,.055), transparent 55%),
    linear-gradient(145deg, rgba(24,26,32,.94), rgba(9,10,13,.98));
  border-radius:28px;
  box-shadow:0 28px 78px rgba(0,0,0,.38), inset 0 1px 0 rgba(255,255,255,.04);
}

.zp-weight-card{
  padding:24px 20px 20px;
}

.zp-card-head{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:14px;
  margin-bottom:18px;
}

.zp-card-title{
  margin:0;
  font-size:22px;
  line-height:1.05;
  letter-spacing:-.02em;
  font-weight:950;
}

.zp-card-sub{
  margin:7px 0 0;
  color:var(--zp-muted);
  font-size:16px;
}

.zp-range{
  border:1px solid var(--zp-border-strong);
  background:rgba(13,14,18,.72);
  color:var(--zp-text);
  border-radius:14px;
  min-height:48px;
  padding:0 14px;
  display:inline-flex;
  align-items:center;
  gap:13px;
  font-size:16px;
  white-space:nowrap;
  cursor:pointer;
  position:relative;
}

.zp-range select{
  appearance:none;
  border:0;
  outline:0;
  background:transparent;
  color:inherit;
  font:inherit;
  padding:0 28px 0 0;
  cursor:pointer;
}

.zp-range svg{
  position:absolute;
  right:14px;
  pointer-events:none;
}

.zp-range-lock{
  display:inline-flex;
  align-items:center;
  gap:7px;
  min-height:42px;
  border-radius:999px;
  padding:0 13px;
  border:1px solid rgba(255,210,31,.22);
  background:rgba(255,210,31,.08);
  color:#ffe984;
  font-size:12px;
  font-weight:950;
  white-space:nowrap;
}

.zp-lock-note{
  margin:12px 0 0;
  border:1px solid rgba(255,210,31,.18);
  background:rgba(255,210,31,.07);
  color:rgba(255,255,255,.76);
  border-radius:16px;
  padding:12px;
  font-size:13px;
  line-height:1.4;
  font-weight:800;
}

.zp-chart-shell{
  overflow:hidden;
  margin-top:4px;
}

.zp-chart{
  width:100%;
  display:block;
  overflow:visible;
}

.zp-chart text{
  font-family:inherit;
}

.zp-weekly-cards{
  display:grid;
  grid-template-columns:repeat(4, minmax(0, 1fr));
  gap:12px;
  margin-top:16px;
}

.zp-week-card{
  border:1px solid var(--zp-border);
  background:rgba(18,20,24,.68);
  border-radius:12px;
  min-height:76px;
  display:grid;
  place-items:center;
  align-content:center;
  gap:7px;
}

.zp-week-card strong{
  font-size:16px;
  line-height:1;
  font-weight:950;
}

.zp-week-card span{
  color:var(--zp-text);
  font-size:15px;
  font-weight:850;
}

.zp-week-card.active{
  border-color:rgba(255,210,31,.86);
  background:linear-gradient(145deg, rgba(255,210,31,.12), rgba(18,20,24,.82));
  box-shadow:0 0 0 1px rgba(255,210,31,.08), inset 0 1px 0 rgba(255,255,255,.05);
}

.zp-week-card.active strong{
  color:var(--zp-gold);
}

.zp-metrics-strip{
  margin-top:20px;
  border:1px solid rgba(255,255,255,.065);
  background:linear-gradient(145deg, rgba(20,22,27,.72), rgba(10,11,14,.72));
  border-radius:20px;
  padding:20px 16px;
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:12px;
}

.zp-metric{
  display:grid;
  grid-template-columns:auto 1fr;
  gap:12px;
  align-items:center;
  min-width:0;
}

.zp-metric:not(:last-child){
  border-right:1px solid rgba(255,255,255,.1);
  padding-right:10px;
}

.zp-metric-icon{
  width:46px;
  height:46px;
  border-radius:999px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,210,31,.18);
  color:var(--zp-gold);
  background:radial-gradient(circle at 50% 45%, rgba(255,210,31,.24), rgba(138,106,0,.16) 52%, rgba(18,20,24,.8));
}

.zp-metric-icon.green{
  border-color:rgba(57,211,83,.2);
  color:var(--zp-green);
  background:radial-gradient(circle at 50% 45%, rgba(57,211,83,.22), rgba(22,93,48,.18) 52%, rgba(18,20,24,.8));
}

.zp-metric span{
  display:block;
  color:var(--zp-muted);
  font-size:14px;
  line-height:1.1;
}

.zp-metric strong{
  display:block;
  margin-top:5px;
  font-size:25px;
  line-height:1;
  letter-spacing:-.035em;
  font-weight:950;
  white-space:nowrap;
}

.zp-metric strong.good{
  color:var(--zp-green);
}

.zp-metric small{
  display:block;
  margin-top:7px;
  color:var(--zp-muted);
  font-size:13px;
  line-height:1.15;
}

.zp-primary-btn{
  width:100%;
  min-height:58px;
  border:0;
  border-radius:14px;
  margin-top:22px;
  background:linear-gradient(135deg, var(--zp-gold), var(--zp-gold-2));
  color:#08090c;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
  font-size:18px;
  font-weight:950;
  box-shadow:0 18px 42px rgba(255,210,31,.16), inset 0 1px 0 rgba(255,255,255,.34);
  cursor:pointer;
  transition:transform .18s ease, filter .18s ease;
}

.zp-primary-btn:hover{
  transform:translateY(-1px);
  filter:saturate(1.04) brightness(1.02);
}

.zp-section-card{
  padding:20px;
}

.zp-section-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
  margin-bottom:14px;
}

.zp-section-head h2{
  margin:0;
  font-size:22px;
  line-height:1;
  letter-spacing:-.02em;
  font-weight:950;
}

.zp-see-all{
  border:1px solid var(--zp-border-strong);
  background:rgba(13,14,18,.7);
  color:var(--zp-text);
  text-decoration:none;
  border-radius:999px;
  min-height:40px;
  padding:0 13px;
  display:inline-flex;
  align-items:center;
  gap:6px;
  font-size:14px;
  font-weight:760;
  cursor:pointer;
}

.zp-measure-table{
  display:grid;
}

.zp-measure-row{
  display:grid;
  grid-template-columns:1.25fr .9fr 1.35fr 1.15fr;
  align-items:center;
  gap:10px;
  min-height:56px;
  border-bottom:1px solid rgba(255,255,255,.075);
}

.zp-measure-row:last-child{
  border-bottom:0;
}

.zp-measure-head{
  color:var(--zp-muted);
  font-size:14px;
  min-height:38px;
}

.zp-measure-name{
  display:flex;
  align-items:center;
  gap:12px;
  min-width:0;
  font-weight:900;
}

.zp-mini-icon{
  width:32px;
  height:32px;
  border-radius:10px;
  border:1px solid rgba(255,210,31,.16);
  background:rgba(255,210,31,.08);
  color:var(--zp-gold);
  display:grid;
  place-items:center;
  flex:0 0 auto;
}

.zp-measure-value{
  color:var(--zp-text);
  font-weight:760;
  white-space:nowrap;
}

.zp-change{
  display:inline-flex;
  align-items:center;
  gap:6px;
  font-weight:850;
  white-space:nowrap;
}

.zp-change.good{ color:var(--zp-green); }
.zp-change.bad{ color:var(--zp-red); }

.zp-sparkline{
  width:100%;
  min-width:82px;
  height:28px;
}

.zp-photo-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:14px;
}

.zp-upload{
  border:1px dashed rgba(255,255,255,.18);
  background:rgba(10,11,14,.68);
  color:var(--zp-text);
  border-radius:18px;
  min-height:96px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
  cursor:pointer;
  transition:border-color .18s ease, background .18s ease, transform .18s ease;
}

.zp-upload.has-photo{
  border-style:solid;
  border-color:rgba(255,210,31,.28);
  justify-content:flex-start;
  padding:10px;
}

.zp-upload:hover{
  transform:translateY(-1px);
  border-color:rgba(255,210,31,.38);
  background:rgba(18,20,24,.82);
}

.zp-upload-icon{
  color:var(--zp-muted);
}

.zp-upload strong{
  display:block;
  font-size:16px;
}

.zp-upload span{
  display:block;
  margin-top:5px;
  color:var(--zp-muted);
}

.zp-upload-preview{
  width:68px;
  height:68px;
  border-radius:14px;
  object-fit:cover;
  border:1px solid rgba(255,255,255,.12);
}

.zp-file-input{
  position:absolute;
  opacity:0;
  pointer-events:none;
  width:1px;
  height:1px;
}

.zp-bottom-nav{
  position:fixed;
  left:0;
  right:0;
  bottom:0;
  z-index:50;
  border-top:1px solid rgba(255,255,255,.08);
  background:rgba(5,6,8,.86);
  backdrop-filter:blur(18px) saturate(150%);
  padding:9px 8px calc(8px + env(safe-area-inset-bottom));
  display:grid;
  grid-template-columns:repeat(5, minmax(0, 1fr));
  box-shadow:0 -18px 46px rgba(0,0,0,.34);
}

.zp-bottom-item{
  min-width:0;
  border:0;
  background:transparent;
  color:var(--zp-muted);
  text-decoration:none;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:center;
  gap:6px;
  font-size:12px;
  font-weight:760;
}

.zp-bottom-item svg{
  width:26px;
  height:26px;
}

.zp-bottom-item.active{
  color:var(--zp-gold);
}

.zp-placeholder-card{
  padding:22px;
  display:grid;
  gap:14px;
}

.zp-placeholder-grid{
  display:grid;
  gap:12px;
}

.zp-measure-form{
  display:grid;
  gap:14px;
  margin-top:16px;
}

.zp-info-tile{
  border:1px solid var(--zp-border);
  background:rgba(18,20,24,.7);
  border-radius:18px;
  padding:16px;
}

.zp-info-tile span{
  color:var(--zp-muted);
  font-size:13px;
  font-weight:750;
}

.zp-info-tile strong{
  display:block;
  margin-top:8px;
  font-size:20px;
  line-height:1.05;
}

.zp-info-tile p{
  margin:8px 0 0;
  color:var(--zp-muted);
  line-height:1.35;
}

.zp-empty-state{
  border:1px dashed rgba(255,255,255,.14);
  background:rgba(255,255,255,.035);
  border-radius:22px;
  padding:20px;
  display:grid;
  gap:12px;
  color:var(--zp-muted);
}

.zp-empty-state.compact{
  padding:16px;
}

.zp-empty-state svg{
  color:var(--zp-gold);
}

.zp-empty-state strong{
  color:var(--zp-text);
  font-size:18px;
  line-height:1.15;
}

.zp-empty-state p{
  margin:0;
  line-height:1.45;
}

.zp-empty-state .zp-primary-btn,
.zp-empty-state .zp-secondary-btn{
  width:max-content;
  max-width:100%;
}

.zp-pro-lock{
  border-color:rgba(255,210,31,.24);
  background:
    radial-gradient(420px 180px at 100% 0%, rgba(255,210,31,.14), transparent 58%),
    linear-gradient(145deg, rgba(18,20,24,.95), rgba(7,8,11,.98));
}

.zp-pro-lock .zp-access-pill{
  width:max-content;
}

.zp-modal-backdrop{
  position:fixed;
  inset:0;
  z-index:80;
  background:rgba(0,0,0,.62);
  backdrop-filter:blur(12px) saturate(130%);
  display:flex;
  align-items:flex-end;
  justify-content:center;
  padding:16px;
}

.zp-modal{
  width:min(480px, 100%);
  border:1px solid var(--zp-border-strong);
  background:linear-gradient(145deg, rgba(24,26,32,.98), rgba(8,9,12,.98));
  border-radius:28px;
  box-shadow:0 30px 90px rgba(0,0,0,.62);
  padding:22px;
}

.zp-modal h2{
  margin:0;
  font-size:25px;
  line-height:1;
}

.zp-form{
  display:grid;
  gap:14px;
  margin-top:18px;
}

.zp-field{
  display:grid;
  gap:8px;
}

.zp-field label{
  color:var(--zp-muted);
  font-size:13px;
  font-weight:850;
}

.zp-input-wrap{
  border:1px solid var(--zp-border-strong);
  background:rgba(9,10,13,.8);
  border-radius:15px;
  min-height:50px;
  display:flex;
  align-items:center;
  gap:8px;
  padding:0 14px;
}

.zp-input-wrap input,
.zp-input-wrap textarea{
  width:100%;
  min-width:0;
  border:0;
  outline:0;
  background:transparent;
  color:var(--zp-text);
  font:inherit;
  font-weight:780;
}

.zp-input-wrap textarea{
  resize:none;
  padding:14px 0;
  min-height:78px;
}

.zp-input-unit{
  color:var(--zp-gold);
  font-weight:900;
}

.zp-error{
  color:var(--zp-red);
  font-size:13px;
  font-weight:760;
}

.zp-modal-actions{
  display:grid;
  grid-template-columns:1fr 1.2fr;
  gap:12px;
  margin-top:18px;
}

.zp-secondary-btn,
.zp-gold-btn{
  border-radius:15px;
  min-height:52px;
  font:inherit;
  font-weight:950;
  cursor:pointer;
}

.zp-secondary-btn{
  border:1px solid var(--zp-border-strong);
  background:rgba(13,14,18,.82);
  color:var(--zp-text);
}

.zp-gold-btn{
  border:0;
  background:linear-gradient(135deg, var(--zp-gold), var(--zp-gold-2));
  color:#08090c;
}

.zp-menu-sheet{
  position:fixed;
  inset:0;
  z-index:70;
  background:rgba(0,0,0,.58);
  backdrop-filter:blur(10px) saturate(135%);
  display:flex;
  align-items:flex-end;
  padding:16px;
}

.zp-menu-panel{
  width:min(480px, 100%);
  margin:0 auto;
  border:1px solid var(--zp-border-strong);
  background:linear-gradient(145deg, rgba(24,26,32,.98), rgba(8,9,12,.98));
  border-radius:26px;
  padding:12px;
  box-shadow:0 28px 80px rgba(0,0,0,.58);
}

.zp-menu-panel-head{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding:8px 8px 14px;
}

.zp-menu-panel-head strong{
  font-size:17px;
}

.zp-menu-close{
  width:42px;
  height:42px;
  border-radius:14px;
  border:1px solid var(--zp-border-strong);
  background:rgba(13,14,18,.82);
  color:var(--zp-text);
}

.zp-menu-link{
  min-height:50px;
  color:var(--zp-text);
  text-decoration:none;
  display:flex;
  align-items:center;
  gap:12px;
  border-radius:16px;
  padding:0 12px;
  font-weight:850;
}

.zp-menu-link.active{
  color:#08090c;
  background:linear-gradient(135deg, var(--zp-gold), var(--zp-gold-2));
}

.zp-desktop-layout{
  display:grid;
  grid-template-columns:280px minmax(0, 1fr);
  min-height:100vh;
}

.zp-sidebar{
  position:sticky;
  top:0;
  height:100vh;
  border-right:1px solid rgba(255,255,255,.08);
  background:linear-gradient(180deg, rgba(12,13,16,.96), rgba(5,6,8,.98));
  padding:28px 20px;
  display:flex;
  flex-direction:column;
  gap:28px;
}

.zp-sidebar .zp-brand{
  padding:0 4px 6px;
}

.zp-side-nav{
  display:grid;
  gap:8px;
}

.zp-side-link{
  color:var(--zp-muted);
  text-decoration:none;
  border:1px solid transparent;
  border-radius:16px;
  min-height:52px;
  display:flex;
  align-items:center;
  gap:12px;
  padding:0 14px;
  font-weight:850;
}

.zp-side-link.active{
  color:#08090c;
  background:linear-gradient(135deg, var(--zp-gold), var(--zp-gold-2));
}

.zp-side-link:not(.active):hover{
  color:var(--zp-text);
  background:rgba(255,255,255,.045);
  border-color:var(--zp-border);
}

.zp-desktop-main{
  min-width:0;
  padding:28px;
}

.zp-desktop-inner{
  width:min(1440px, 100%);
  margin:0 auto;
}

.zp-desktop-header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:22px;
  margin-bottom:24px;
}

.zp-desktop-header .zp-title-block{
  margin:0;
}

.zp-desktop-user{
  display:flex;
  align-items:center;
  gap:12px;
}

.zp-desktop-grid{
  display:grid;
  grid-template-columns:minmax(0, 2fr) minmax(340px, .95fr);
  gap:22px;
  align-items:start;
}

.zp-side-stack{
  display:grid;
  gap:20px;
}

.zp-kpi-row{
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:16px;
  margin-bottom:22px;
}

.zp-kpi-row .zp-metric{
  border:1px solid var(--zp-border);
  background:
    radial-gradient(380px 180px at 20% 0%, rgba(255,210,31,.08), transparent 58%),
    linear-gradient(145deg, rgba(24,26,32,.92), rgba(9,10,13,.96));
  border-radius:22px;
  padding:18px;
}

.zp-kpi-row .zp-metric:not(:last-child){
  border-right:1px solid var(--zp-border);
}

.zp-desktop .zp-bottom-nav{
  display:none;
}

@media (max-width: 430px){
  .zp-mobile{
    padding-inline:14px;
  }
  .zp-logo,
  .zp-icon-btn,
  .zp-title-icon{
    width:50px;
    height:50px;
  }
  .zp-brand-text strong{
    font-size:19px;
  }
  .zp-brand-text span{
    font-size:14px;
  }
  .zp-brandLogo .brand-logo-img{
    height:48px;
    max-width:196px;
  }
  .zp-brand-text.logo-caption span{
    font-size:12px;
  }
  .zp-title-block h1{
    font-size:33px;
  }
  .zp-title-block p{
    font-size:15px;
  }
  .zp-tab{
    font-size:14px;
    padding-inline:4px;
  }
  .zp-weight-card{
    padding:20px 14px 16px;
  }
  .zp-card-title{
    font-size:19px;
  }
  .zp-card-sub{
    font-size:14px;
  }
  .zp-range{
    min-height:42px;
    padding-inline:11px;
    font-size:14px;
  }
  .zp-weekly-cards{
    gap:8px;
  }
  .zp-week-card{
    min-height:68px;
  }
  .zp-week-card span{
    font-size:13px;
  }
  .zp-metrics-strip{
    grid-template-columns:1fr;
    padding:14px;
  }
  .zp-metric:not(:last-child){
    border-right:0;
    border-bottom:1px solid rgba(255,255,255,.08);
    padding:0 0 12px;
  }
  .zp-metric strong{
    font-size:23px;
  }
  .zp-measure-row{
    grid-template-columns:1.2fr .85fr 1.1fr;
  }
  .zp-measure-row > :last-child{
    display:none;
  }
  .zp-measure-head{
    font-size:12px;
  }
  .zp-photo-grid{
    grid-template-columns:1fr;
  }
}

@media (min-width: 980px){
  .zp-mobile{
    display:none;
  }
  .zp-desktop{
    display:block;
  }
  .zp-card{
    border-radius:26px;
  }
  .zp-weight-card{
    padding:26px;
  }
  .zp-modal-backdrop{
    align-items:center;
  }
}

@media (min-width: 1260px){
  .zp-placeholder-grid{
    grid-template-columns:repeat(2, minmax(0, 1fr));
  }
}
`;

const progressTabs = ["Resumen", "Peso", "Medidas", "Gym", "Fotos"];

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function maybeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = maybeNumber(value);
    if (number !== null) return number;
  }
  return null;
}

function formatKg(value) {
  const number = maybeNumber(value);
  return number === null ? "Sin registro" : `${number.toFixed(1)} kg`;
}

function formatShortDate(value) {
  if (!value) return "Actual";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return String(value).slice(0, 10) || "Actual";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });
}

function currentWeightFromUser(user = {}) {
  return firstNumber(
    user?.body?.weightKg,
    user?.antropometriaActual?.pesoKg,
    user?.stats?.pesoActualKg,
    user?.stats?.pesoActual,
    user?.progress?.pesoActualKg,
    user?.goal?.startWeightKg,
    user?.profile?.basics?.peso,
    user?.profile?.basics?.pesoKg
  );
}

function goalWeightFromUser(user = {}) {
  return firstNumber(
    user?.goal?.targetWeightKg,
    user?.goal?.targetPesoKg,
    user?.body?.goalWeightKg,
    user?.profile?.basics?.pesoObjetivo,
    user?.profile?.basics?.objetivoPesoKg,
    user?.objetivoPesoKg
  );
}

function weightHistoryFromUser(user = {}) {
  const candidates = [
    user?.progress?.weights,
    user?.progress?.weightHistory,
    user?.body?.weightHistory,
    user?.profile?.weightHistory,
    user?.historialPeso,
  ];
  const raw = candidates.find((items) => Array.isArray(items) && items.length) || [];
  const normalized = raw
    .map((item, index) => {
      const weight = firstNumber(item?.weightKg, item?.pesoKg, item?.weight, item?.peso, item?.value);
      if (weight === null) return null;
      const date = item?.date || item?.fecha || item?.createdAt || item?.updatedAt;
      return {
        week: item?.label || `Registro ${index + 1}`,
        short: item?.short || `R${index + 1}`,
        range: formatShortDate(date),
        averageWeight: Number(weight.toFixed(1)),
        date,
      };
    })
    .filter(Boolean);

  if (normalized.length) {
    return normalized.map((item, index) => ({ ...item, current: index === normalized.length - 1 }));
  }

  const current = currentWeightFromUser(user);
  if (current === null) return [];
  return [{
    week: "Actual",
    short: "Hoy",
    range: formatShortDate(new Date()),
    averageWeight: Number(current.toFixed(1)),
    date: new Date().toISOString(),
    current: true,
  }];
}

function buildSummary(weights, user = {}) {
  const first = maybeNumber(weights[0]?.averageWeight);
  const lastRecord = weights[weights.length - 1] || null;
  const current = maybeNumber(lastRecord?.averageWeight) ?? currentWeightFromUser(user);
  const goal = goalWeightFromUser(user);
  const change = first !== null && current !== null && weights.length > 1 ? Number((current - first).toFixed(1)) : null;
  const percentage = first && change !== null ? Number(((change / first) * 100).toFixed(1)) : null;
  return {
    currentWeight: current,
    goalWeight: goal,
    remainingWeight: current !== null && goal !== null ? Number(Math.abs(current - goal).toFixed(1)) : null,
    changeFourWeeks: change,
    changePercentage: percentage,
    updatedAt: current !== null ? (lastRecord?.date ? `Ultimo registro ${formatShortDate(lastRecord.date)}` : "Ultimo registro disponible") : "Sin peso registrado",
    hasWeight: current !== null,
    hasGoal: goal !== null,
    hasTrend: weights.length > 1,
  };
}

function resolveProgressAccess(user = {}, capabilities = null) {
  const plan = normalizeClientPlan(planFromCapabilities(user, capabilities));
  const historyDays = Number(capabilities?.limits?.trackingHistoryDays);
  const isBasic = plan === "free";
  return {
    plan,
    label: clientPlanLabel(plan),
    isBasic,
    historyDays: Number.isFinite(historyDays) ? historyDays : null,
    canUseLongHistory: !isBasic,
    canUsePhotos: !isBasic,
    canUseAdvancedGym: !isBasic,
  };
}

function visibleWeightsForAccess(weights = [], access = {}) {
  if (!Array.isArray(weights)) return [];
  if (access.isBasic) return weights.slice(-2);
  return weights;
}

function ProgressPage() {
  const cachedUser = useMemo(() => getCachedUser(), []);
  const [activeTab, setActiveTab] = useState("Resumen");
  const [range, setRange] = useState("4 semanas");
  const [weights] = useState(() => weightHistoryFromUser(cachedUser));
  const [measurements] = useState([]);
  const [photos, setPhotos] = useState({});
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: CLIENT_PLAN_CAPABILITIES_STALE_TIME,
    refetchOnWindowFocus: false,
    retry: false,
  });
  const capabilities = capabilitiesQuery.data || cachedUser?.nutritionCapabilities || null;
  const access = useMemo(() => resolveProgressAccess(cachedUser, capabilities), [cachedUser, capabilities]);
  const summary = useMemo(() => buildSummary(weights, cachedUser), [weights, cachedUser]);

  const commonProps = {
    activeTab,
    onTabChange: setActiveTab,
    range,
    onRangeChange: setRange,
    weights,
    summary,
    measurements,
    photos,
    access,
    capabilitiesError: capabilitiesQuery.isError,
    onPhotoChange: setPhotos,
  };

  return (
    <div className="zp-page">
      <style>{CSS}</style>
      <div className="zp-mobile">
        <MobileProgressScreen {...commonProps} />
      </div>
      <div className="zp-desktop">
        <DesktopProgressScreen {...commonProps} />
      </div>
    </div>
  );
}

function MobileProgressScreen({ activeTab, onTabChange, range, onRangeChange, weights, summary, measurements, photos, access, capabilitiesError, onPhotoChange }) {
  return (
    <>
      <ProgressHero />
      <ProgressAccessBanner access={access} capabilitiesError={capabilitiesError} />
      <ProgressTabs activeTab={activeTab} onTabChange={onTabChange} />
      <main className="zp-stack">
        <ProgressTabContent
          activeTab={activeTab}
          range={range}
          onRangeChange={onRangeChange}
          weights={weights}
          summary={summary}
          measurements={measurements}
          photos={photos}
          access={access}
          onPhotoChange={onPhotoChange}
        />
      </main>
    </>
  );
}

function DesktopProgressScreen({ activeTab, onTabChange, range, onRangeChange, weights, summary, measurements, photos, access, capabilitiesError, onPhotoChange }) {
  return (
    <div className="zp-desktop-inner">
      <ProgressHero />
      <ProgressTabs activeTab={activeTab} onTabChange={onTabChange} />
      <ProgressAccessBanner access={access} capabilitiesError={capabilitiesError} />
      <DesktopDashboard
        activeTab={activeTab}
        range={range}
        onRangeChange={onRangeChange}
        weights={weights}
        summary={summary}
        measurements={measurements}
        photos={photos}
        access={access}
        onPhotoChange={onPhotoChange}
      />
    </div>
  );
}

function ProgressHero() {
  return (
    <section className="zp-title-block">
      <div className="zp-title-icon">
        <LineChart size={29} strokeWidth={2.3} />
      </div>
      <div>
        <h1>Progresos</h1>
        <p>Sigue tu evolución y mantén el foco.</p>
      </div>
    </section>
  );
}

function ProgressAccessBanner({ access, capabilitiesError = false }) {
  const title = access.isBasic ? "Progreso basico" : "Progreso completo";
  const copy = access.isBasic
    ? "Free muestra tu peso, objetivo y medidas basicas reales cuando ya estan disponibles. El alta de nuevos registros se habilitara con guardado persistente."
    : "Historial completo, rangos largos y funciones avanzadas segun tu plan efectivo.";
  return (
    <section className="zp-access-banner" aria-label="Acceso a progresos">
      <div>
        <strong>{title}</strong>
        <span>
          {copy}
          {capabilitiesError ? " No pudimos refrescar capacidades; usamos datos locales sin asumir funciones premium." : ""}
        </span>
      </div>
      <span className="zp-access-pill">Plan {access.label}</span>
    </section>
  );
}

function ProgressTabs({ activeTab, onTabChange }) {
  return (
    <nav className="zp-tabs" aria-label="Tabs de progreso">
      {progressTabs.map((tab) => (
        <button
          key={tab}
          type="button"
          className={`zp-tab ${activeTab === tab ? "active" : ""}`}
          onClick={() => onTabChange(tab)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

function ProgressTabContent({ activeTab, range, onRangeChange, weights, summary, measurements, photos, access, onPhotoChange }) {
  if (activeTab === "Peso") {
    return (
      <>
        <WeightChartCard
          weights={weights}
          summary={summary}
          range={range}
          onRangeChange={onRangeChange}
          access={access}
        />
        <BodyMeasurementsCard access={access} measurements={measurements} />
        {access.canUsePhotos ? (
          <ProgressPhotosCard photos={photos} onPhotoChange={onPhotoChange} />
        ) : (
          <ProLockedCard
            icon={Camera}
            title="Fotos de progreso"
            text="Compara tus cambios visuales con historial completo."
          />
        )}
      </>
    );
  }

  if (activeTab === "Medidas") {
    return (
      <>
        <BodyMeasurementsCard expanded access={access} measurements={measurements} />
      </>
    );
  }

  if (activeTab === "Gym") {
    return <GymProgressCard access={access} />;
  }

  if (activeTab === "Fotos") {
    if (!access.canUsePhotos) {
      return (
        <ProLockedCard
          icon={Camera}
          title="Fotos de progreso"
          text="Compara tu evolucion visual con el tiempo. Disponible en Pro."
          actionLabel="Ver beneficios Pro"
        />
      );
    }
    return (
      <>
        <ProgressPhotosCard expanded photos={photos} onPhotoChange={onPhotoChange} />
        <PhotoCompareCard />
      </>
    );
  }

  return (
    <>
      <SummaryCards summary={summary} />
      <WeightChartCard
        weights={weights}
        summary={summary}
        range={range}
        onRangeChange={onRangeChange}
        access={access}
      />
    </>
  );
}

function DesktopDashboard({ activeTab, range, onRangeChange, weights, summary, measurements, photos, access, onPhotoChange }) {
  if (activeTab !== "Peso") {
    return (
      <div className="zp-stack">
        <ProgressTabContent
          activeTab={activeTab}
          range={range}
          onRangeChange={onRangeChange}
          weights={weights}
          summary={summary}
          measurements={measurements}
          photos={photos}
          access={access}
          onPhotoChange={onPhotoChange}
        />
      </div>
    );
  }

  return (
    <>
      <div className="zp-kpi-row">
        <ProgressMetricCard icon={Scale} label="Peso actual" value={formatKg(summary.currentWeight)} detail={summary.updatedAt} />
        <ProgressMetricCard icon={Target} label="Objetivo" value={formatKg(summary.goalWeight)} detail={summary.hasGoal ? `Faltan ${formatKg(summary.remainingWeight)}` : "Configura tu objetivo"} />
        <ProgressMetricCard icon={TrendingUp} label={access.isBasic ? "Cambio reciente" : `Cambio ${range}`} value={summary.hasTrend ? `${summary.changeFourWeeks.toFixed(1)} kg` : "Sin tendencia"} detail={summary.hasTrend ? `${summary.changePercentage.toFixed(1)}% del peso inicial` : "Cargá más registros"} positive />
      </div>
      <div className="zp-desktop-grid">
        <WeightChartCard
          weights={weights}
          summary={summary}
          range={range}
          onRangeChange={onRangeChange}
          access={access}
        />
        <div className="zp-side-stack">
          <BodyMeasurementsCard access={access} measurements={measurements} />
          {access.canUsePhotos ? <ProgressPhotosCard photos={photos} onPhotoChange={onPhotoChange} /> : <ProLockedCard compact icon={Camera} title="Fotos Pro" text="Historial visual disponible en Pro." />}
          <GymProgressCard compact access={access} />
        </div>
      </div>
    </>
  );
}

function RangeSelector({ value, onChange, access }) {
  const ranges = ["4 semanas", "8 semanas", "12 semanas", "6 meses", "1 año"];
  if (access?.isBasic) {
    return <div className="zp-range-lock">Pro · Historial completo</div>;
  }
  return (
    <label className="zp-range" aria-label="Cambiar rango">
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {ranges.map((range) => (
          <option key={range} value={range}>{range}</option>
        ))}
      </select>
      <ChevronDown size={18} />
    </label>
  );
}

function WeightChartCard({ weights, summary, range, onRangeChange, access }) {
  const visibleWeights = visibleWeightsForAccess(weights, access);
  const title = access.isBasic ? "Peso - ultimos registros" : `Peso - ${range}`;
  const subtitle = access.isBasic ? "Progreso basico incluido en Free" : "historial completo";
  const changeLabel = access.isBasic ? "Cambio reciente" : `Cambio ${range}`;
  return (
    <section className="zp-card zp-weight-card">
      <div className="zp-card-head">
        <div>
          <h2 className="zp-card-title">{title}</h2>
          <p className="zp-card-sub">{subtitle}</p>
        </div>
        <RangeSelector value={range} onChange={onRangeChange} access={access} />
      </div>

      {visibleWeights.length >= 2 ? (
        <>
          <WeightLineChart weights={visibleWeights} access={access} />
          <WeeklyAverageCards weights={visibleWeights} />
        </>
      ) : (
        <ProgressEmptyState
          compact
          icon={Scale}
          title={summary.hasWeight ? "Todavia necesitas mas registros para ver una tendencia." : "Todavia no hay un peso registrado."}
          text="Registro de progreso proximamente. No vamos a simular un guardado que se pierda al recargar."
        />
      )}

      {access.isBasic ? (
        <div className="zp-lock-note">
          Historial completo, rangos de varias semanas y comparativas largas estan disponibles en Pro.
        </div>
      ) : null}

      <div className="zp-metrics-strip">
        <ProgressMetricCard icon={Scale} label="Peso actual" value={formatKg(summary.currentWeight)} detail={summary.updatedAt} />
        <ProgressMetricCard icon={Target} label="Objetivo" value={formatKg(summary.goalWeight)} detail={summary.hasGoal ? `Faltan ${formatKg(summary.remainingWeight)}` : "Configura tu objetivo"} />
        <ProgressMetricCard icon={TrendingUp} label={changeLabel} value={summary.hasTrend ? `${summary.changeFourWeeks.toFixed(1)} kg` : "Sin tendencia"} detail={summary.hasTrend ? `${summary.changePercentage.toFixed(1)}% del peso inicial` : "Carga mas registros"} positive />
      </div>

      <div className="zp-lock-note" role="status">
        Registro de peso proximamente. Disponible cuando activemos guardado de progreso.
      </div>
    </section>
  );
}

function WeightLineChart({ weights, access }) {
  const values = weights.map((item) => item.averageWeight).filter((value) => Number.isFinite(value));
  const minY = Math.floor(Math.min(...values) - 1);
  const maxY = Math.ceil(Math.max(...values) + 1);
  const width = 720;
  const height = 300;
  const left = 54;
  const right = 32;
  const top = 28;
  const bottom = 70;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yTicks = Array.from({ length: 5 }, (_, index) => maxY - index * ((maxY - minY) / 4));
  const points = weights.map((item, index) => {
    const x = left + (plotWidth / Math.max(1, weights.length - 1)) * index;
    const y = top + ((maxY - item.averageWeight) / (maxY - minY)) * plotHeight;
    return { ...item, x, y };
  });
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z`;

  return (
    <div className="zp-chart-shell">
      <svg className="zp-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={access?.isBasic ? "Grafico de peso de ultimos registros" : "Grafico de peso del historial seleccionado"}>
        <defs>
          <linearGradient id="zpWeightArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#ffd21f" stopOpacity=".42" />
            <stop offset="58%" stopColor="#8a6a00" stopOpacity=".18" />
            <stop offset="100%" stopColor="#8a6a00" stopOpacity="0" />
          </linearGradient>
          <filter id="zpGlow" x="-20%" y="-40%" width="140%" height="180%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feColorMatrix in="blur" type="matrix" values="1 0 0 0 1  0 1 0 0 .72  0 0 1 0 .12  0 0 0 .45 0" />
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <text x="0" y="38" fill="#f5f5f7" fontSize="15">kg</text>
        {yTicks.map((tick) => {
          const y = top + ((maxY - tick) / (maxY - minY)) * plotHeight;
          return (
            <g key={tick}>
              <text x="0" y={y + 5} fill="#f5f5f7" fontSize="15">{Number(tick).toFixed(0)}</text>
              <line x1={left} x2={width - right} y1={y} y2={y} stroke="rgba(255,255,255,.14)" strokeWidth="1" strokeDasharray="5 6" />
            </g>
          );
        })}
        <line x1={left} x2={width - right} y1={top + plotHeight} y2={top + plotHeight} stroke="rgba(255,255,255,.18)" />
        <path d={areaPath} fill="url(#zpWeightArea)" />
        <path d={linePath} fill="none" stroke="#ffd21f" strokeWidth="4" strokeLinecap="round" filter="url(#zpGlow)" />
        {points.map((point) => (
          <g key={point.week}>
            <text x={point.x} y={point.y - 18} textAnchor="middle" fill="#f5f5f7" fontSize="20" fontWeight="900">
              {point.averageWeight.toFixed(1)}
            </text>
            <circle cx={point.x} cy={point.y} r={point.current ? 13 : 7} fill={point.current ? "rgba(255,210,31,.22)" : "#ffd21f"} stroke="#ffd21f" strokeWidth={point.current ? 4 : 0} />
            {point.current ? <circle cx={point.x} cy={point.y} r="8" fill="#ffd21f" /> : null}
            <text x={point.x} y={height - 42} textAnchor="middle" fill={point.current ? "#ffd21f" : "#f5f5f7"} fontSize="15" fontWeight={point.current ? "900" : "700"}>
              {point.week}
            </text>
            <text x={point.x} y={height - 17} textAnchor="middle" fill={point.current ? "#ffd21f" : "#a9adb7"} fontSize="14">
              {point.range}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function buildSmoothPath(points) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = previous.x + (point.x - previous.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function WeeklyAverageCards({ weights }) {
  return (
    <div className="zp-weekly-cards">
      {weights.map((item) => (
        <div key={item.short} className={`zp-week-card ${item.current ? "active" : ""}`}>
          <strong>{item.short}</strong>
          <span>{item.averageWeight.toFixed(1)} kg</span>
        </div>
      ))}
    </div>
  );
}

function ProgressMetricCard({ icon, label, value, detail, positive = false }) {
  const MetricIcon = icon;
  return (
    <article className="zp-metric">
      <div className={`zp-metric-icon ${positive ? "green" : ""}`}>
        <MetricIcon size={23} />
      </div>
      <div>
        <span>{label}</span>
        <strong className={positive ? "good" : ""}>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function ProgressEmptyState({ icon: Icon = InfoIcon, title, text, actionLabel = "", onAction = null, compact = false }) {
  const content = (
    <>
      {React.createElement(Icon, { size: 24 })}
      <strong>{title}</strong>
      <p>{text}</p>
    </>
  );
  return (
    <div className={`zp-empty-state ${compact ? "compact" : ""}`}>
      {content}
      {onAction && actionLabel ? (
        <button type="button" className="zp-secondary-btn" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}

function InfoIcon(props) {
  return <LineChart {...props} />;
}

function ProLockedCard({ icon: Icon = Camera, title, text, actionLabel = "Ver beneficios Pro", compact = false }) {
  return (
    <section className={`zp-card zp-placeholder-card zp-pro-lock ${compact ? "compact" : ""}`}>
      <span className="zp-access-pill">Disponible en Pro</span>
      <div className="zp-empty-state compact">
        {React.createElement(Icon, { size: 25 })}
        <strong>{title}</strong>
        <p>{text}</p>
        <NavLink className="zp-secondary-btn" to="/app/planes">{actionLabel}</NavLink>
      </div>
    </section>
  );
}

function SummaryCards({ summary }) {
  return (
    <section className="zp-card zp-placeholder-card">
      <div className="zp-section-head">
        <h2>Resumen</h2>
      </div>
      <div className="zp-placeholder-grid">
        <div className="zp-info-tile">
          <span>Peso actual</span>
          <strong>{formatKg(summary.currentWeight)}</strong>
          <p>Promedio semanal actualizado con tu ultimo registro.</p>
        </div>
        <div className="zp-info-tile">
          <span>Objetivo</span>
          <strong>{formatKg(summary.goalWeight)}</strong>
          <p>{summary.hasGoal ? `Faltan ${formatKg(summary.remainingWeight)} para llegar a la meta.` : "Todavia no definiste tu objetivo de peso."}</p>
          {!summary.hasGoal ? <NavLink className="zp-secondary-btn" to="/app/objetivos">Configurar objetivo</NavLink> : null}
        </div>
        <div className="zp-info-tile">
          <span>Cambio reciente</span>
          <strong>{summary.hasTrend ? `${summary.changeFourWeeks.toFixed(1)} kg` : "Sin tendencia"}</strong>
          <p>{summary.hasTrend ? `${summary.changePercentage.toFixed(1)}% desde el primer registro visible.` : "Todavia necesitás mas registros para comparar."}</p>
        </div>
      </div>
    </section>
  );
}

function BodyMeasurementsCard({ expanded = false, access, measurements = [] }) {
  const hasMeasurements = measurements.length > 0;
  return (
    <section className="zp-card zp-section-card">
      <div className="zp-section-head">
        <h2>Medidas corporales</h2>
        {access?.isBasic ? (
          <NavLink className="zp-see-all" to="/app/planes">
            Historial Pro
            <ChevronRight size={16} />
          </NavLink>
        ) : <span className="zp-see-all">Historial</span>}
      </div>
      {hasMeasurements ? (
        <div className="zp-measure-table">
        <div className="zp-measure-row zp-measure-head">
          <span>Medida</span>
          <span>Actual</span>
          <span>Cambio (vs mes anterior)</span>
          <span>Evolución</span>
        </div>
          {measurements.map((item) => (
          <MeasurementRow key={item.name} item={item} />
          ))}
        </div>
      ) : (
        <ProgressEmptyState
          compact
          icon={Ruler}
          title="Registro de progreso proximamente"
          text="Disponible cuando activemos guardado persistente de medidas."
        />
      )}

      {access?.isBasic ? (
        <div className="zp-lock-note">
          Free mostrara peso y medidas basicas reales. El historial completo y las comparaciones mensuales se desbloquean con Pro.
        </div>
      ) : null}
      {expanded ? (
        <MeasurementsFormPreview key={access?.plan || "free"} access={access} embedded />
      ) : null}
    </section>
  );
}

function MeasurementRow({ item }) {
  const Icon = item.icon;
  const TrendIcon = item.trend === "down" ? ArrowDown : ArrowUp;
  const tone = item.positive ? "good" : "bad";
  const hasChange = maybeNumber(item.change) !== null;
  const hasSparkline = Array.isArray(item.points) && item.points.length > 1;
  return (
    <div className="zp-measure-row">
      <div className="zp-measure-name">
        <span className="zp-mini-icon"><Icon size={18} /></span>
        <span>{item.name}</span>
      </div>
      <div className="zp-measure-value">{item.value.toFixed(1)} {item.unit}</div>
      <div className={`zp-change ${tone}`}>
        {hasChange ? (
          <>
            {item.change > 0 ? "+" : ""}{item.change.toFixed(1)} {item.unit}
            <TrendIcon size={15} />
          </>
        ) : "Primer registro"}
      </div>
      {hasSparkline ? <Sparkline points={item.points} color={item.positive ? "#39d353" : "#ff5d73"} /> : <span className="zp-measure-value">Sin historial</span>}
    </div>
  );
}

function Sparkline({ points, color }) {
  const width = 118;
  const height = 34;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const path = points.map((point, index) => {
    const x = (width / Math.max(1, points.length - 1)) * index;
    const y = 6 + ((point - min) / Math.max(1, max - min)) * (height - 12);
    return `${index === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
  return (
    <svg className="zp-sparkline" viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProgressPhotosCard({ expanded = false, photos = {}, onPhotoChange }) {
  function handlePhoto(label, file) {
    if (!file || !onPhotoChange) return;
    const url = URL.createObjectURL(file);
    onPhotoChange((current) => ({
      ...current,
      [label]: {
        name: file.name,
        url,
        date: todayInputValue(),
      },
    }));
  }

  return (
    <section className="zp-card zp-section-card">
      <div className="zp-section-head">
        <h2>Fotos de progreso</h2>
        <button className="zp-see-all" type="button">
          Ver todas
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="zp-photo-grid">
        <PhotoUpload label="Frontal" photo={photos.Frontal} onPick={handlePhoto} />
        <PhotoUpload label="Lateral" photo={photos.Lateral} onPick={handlePhoto} />
        {expanded ? <PhotoUpload label="Espalda" photo={photos.Espalda} onPick={handlePhoto} /> : null}
      </div>
    </section>
  );
}

function PhotoUpload({ label, photo, onPick }) {
  return (
    <label className={`zp-upload ${photo ? "has-photo" : ""}`}>
      <input
        className="zp-file-input"
        type="file"
        accept="image/*"
        onChange={(event) => onPick?.(label, event.target.files?.[0])}
      />
      {photo ? <img className="zp-upload-preview" src={photo.url} alt={`Foto ${label}`} /> : <Camera className="zp-upload-icon" size={28} />}
      <span>
        <strong>{label}</strong>
        <span>{photo ? photo.name : "Agregar foto"}</span>
      </span>
    </label>
  );
}

function GymProgressCard({ compact = false, access }) {
  return (
    <section className="zp-card zp-placeholder-card">
      <div className="zp-section-head">
        <h2>Gym</h2>
        <NavLink className="zp-see-all" to="/app/rutinas">
          Ver rutina
          <ChevronRight size={16} />
        </NavLink>
      </div>
      <ProgressEmptyState
        compact={compact}
        icon={Dumbbell}
        title="Todavia no registraste entrenamientos."
        text={access?.canUseAdvancedGym ? "Cuando tengas registros reales, aca vas a ver tu progreso de entrenamiento." : "El registro basico sigue disponible en Rutina."}
      />
      {!access?.canUseAdvancedGym ? (
        <div className="zp-lock-note">
          Historial y analisis avanzado de entrenamiento disponible en Pro.
        </div>
      ) : null}
    </section>
  );
}

function MeasurementsFormPreview({ access, embedded = false }) {
  return (
    <section className={embedded ? "zp-measure-form" : "zp-card zp-placeholder-card"}>
      <div className="zp-section-head">
        <h2>Nueva medición</h2>
      </div>
      <div className="zp-empty-state compact" role="status">
        <Ruler size={24} />
        <strong>Registro de progreso próximamente</strong>
        <p>
          {access?.isBasic
            ? "Disponible cuando activemos guardado persistente de medidas básicas."
            : "Disponible cuando activemos guardado persistente de medidas."}
        </p>
      </div>
    </section>
  );
}

function PhotoCompareCard() {
  return (
    <section className="zp-card zp-placeholder-card">
      <div className="zp-section-head">
        <h2>Comparar fotos</h2>
      </div>
      <div className="zp-info-tile">
        <span>Próxima comparación</span>
        <strong>Actual vs anterior</strong>
        <p>La estructura queda preparada para comparar fotos por fecha y postura.</p>
      </div>
    </section>
  );
}

export default function Progresos() {
  return <ProgressPage />;
}
