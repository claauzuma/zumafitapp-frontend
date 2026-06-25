import React, { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Apple,
  ArrowDown,
  ArrowUp,
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  Dumbbell,
  Home,
  LineChart,
  Menu,
  MoreHorizontal,
  Plus,
  Ruler,
  Scale,
  Target,
  TrendingUp,
  Trophy,
  Weight,
  X,
} from "lucide-react";
import { getCachedUser } from "../authCache.js";
import BrandLogo from "../ui/BrandLogo.jsx";

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

body:has(.zp-page) .cs-header{ display:none; }
body:has(.zp-page) .cs-content{
  max-width:none;
  padding:0;
}

.zp-page{
  min-height:100vh;
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
  padding:18px 18px calc(102px + env(safe-area-inset-bottom));
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

const initialWeightProgress = [
  { week: "Semana 1", short: "S1", range: "26 may - 1 jun", averageWeight: 79.0 },
  { week: "Semana 2", short: "S2", range: "2 - 8 jun", averageWeight: 78.6 },
  { week: "Semana 3", short: "S3", range: "9 - 15 jun", averageWeight: 78.2 },
  { week: "Semana 4", short: "S4", range: "16 - 22 jun", averageWeight: 77.9, current: true },
];

const measurements = [
  { name: "Cintura", value: 85.2, unit: "cm", change: -1.3, trend: "down", positive: true, icon: Ruler, points: [24, 18, 20, 19, 17, 25, 21, 23, 27, 22, 24, 20, 22] },
  { name: "Pecho", value: 102.4, unit: "cm", change: 0.2, trend: "up", positive: false, icon: Weight, points: [18, 21, 20, 22, 16, 19, 13, 15, 22, 21, 16, 18, 14] },
  { name: "Brazo", value: 33.1, unit: "cm", change: 0.1, trend: "up", positive: false, icon: Trophy, points: [16, 19, 22, 18, 23, 16, 21, 14, 18, 17, 13, 15, 18] },
];

const gymMetrics = [
  { label: "Ultimo entrenamiento", value: "Push superior", text: "Ayer - 62 min" },
  { label: "Semana actual", value: "4 / 5 sesiones", text: "80% de cumplimiento" },
  { label: "PR reciente", value: "Press banca 82.5 kg", text: "+2.5 kg este mes" },
  { label: "Volumen", value: "18.420 kg", text: "Trabajo semanal estimado" },
];

function firstName(fullName) {
  const text = String(fullName || "").trim();
  return text ? text.split(/\s+/)[0] : "Claudio";
}

function todayInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatKg(value) {
  return `${Number(value || 0).toFixed(1)} kg`;
}

function buildSummary(weights) {
  const first = weights[0]?.averageWeight ?? 0;
  const current = weights[weights.length - 1]?.averageWeight ?? 0;
  const goal = 75;
  const change = Number((current - first).toFixed(1));
  const percentage = first ? Number(((change / first) * 100).toFixed(1)) : 0;
  return {
    currentWeight: current,
    goalWeight: goal,
    remainingWeight: Math.max(0, Number((current - goal).toFixed(1))),
    changeFourWeeks: change,
    changePercentage: percentage,
    updatedAt: "Actualizado hoy",
  };
}

function ProgressPage() {
  const cachedUser = useMemo(() => getCachedUser(), []);
  const userName = firstName(cachedUser?.profile?.nombre || cachedUser?.nombre || "Claudio");
  const [activeTab, setActiveTab] = useState("Peso");
  const [range, setRange] = useState("4 semanas");
  const [weights, setWeights] = useState(initialWeightProgress);
  const [modalOpen, setModalOpen] = useState(false);
  const [photos, setPhotos] = useState({});
  const summary = useMemo(() => buildSummary(weights), [weights]);

  function saveWeight(entry) {
    const nextWeight = Number(entry.weight);
    setWeights((current) => {
      const next = current.map((item) => ({ ...item, current: false }));
      const last = next[next.length - 1];
      return [
        ...next.slice(0, -1),
        {
          ...last,
          averageWeight: Number(nextWeight.toFixed(1)),
          current: true,
        },
      ];
    });
    setModalOpen(false);
  }

  const commonProps = {
    activeTab,
    onTabChange: setActiveTab,
    range,
    onRangeChange: setRange,
    weights,
    summary,
    photos,
    onPhotoChange: setPhotos,
    onAddWeight: () => setModalOpen(true),
  };

  return (
    <div className="zp-page">
      <style>{CSS}</style>
      <div className="zp-mobile">
        <MobileProgressScreen userName={userName} {...commonProps} />
      </div>
      <div className="zp-desktop">
        <DesktopProgressScreen userName={userName} {...commonProps} />
      </div>
      {modalOpen ? (
        <AddWeightModal
          initialWeight={summary.currentWeight}
          onClose={() => setModalOpen(false)}
          onSave={saveWeight}
        />
      ) : null}
    </div>
  );
}

function MobileProgressScreen({ userName, activeTab, onTabChange, range, onRangeChange, weights, summary, onAddWeight }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <>
      <AppHeader userName={userName} onMenu={() => setMenuOpen(true)} />
      <ProgressHero />
      <ProgressTabs activeTab={activeTab} onTabChange={onTabChange} />
      <main className="zp-stack">
        <ProgressTabContent
          activeTab={activeTab}
          range={range}
          onRangeChange={onRangeChange}
          weights={weights}
          summary={summary}
          onAddWeight={onAddWeight}
        />
      </main>
      <BottomNavigation />
      {menuOpen ? <MobileMenuSheet onClose={() => setMenuOpen(false)} /> : null}
    </>
  );
}

function DesktopProgressScreen({ userName, activeTab, onTabChange, range, onRangeChange, weights, summary, photos, onPhotoChange, onAddWeight }) {
  return (
    <div className="zp-desktop-layout">
      <DesktopSidebar />
      <main className="zp-desktop-main">
        <div className="zp-desktop-inner">
          <div className="zp-desktop-header">
            <ProgressHero />
            <div className="zp-desktop-user">
              <button className="zp-icon-btn" type="button" aria-label="Notificaciones">
                <Bell size={23} />
                <span className="zp-notification-dot" />
              </button>
              <div className="zp-brand">
                <div className="zp-brand-stack">
                  <BrandLogo className="zp-brandLogo" size="client" priority />
                  <div className="zp-brand-text logo-caption">
                    <span>Hola, {userName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <ProgressTabs activeTab={activeTab} onTabChange={onTabChange} />
          <DesktopDashboard
            activeTab={activeTab}
            range={range}
            onRangeChange={onRangeChange}
            weights={weights}
            summary={summary}
            photos={photos}
            onPhotoChange={onPhotoChange}
            onAddWeight={onAddWeight}
          />
        </div>
      </main>
    </div>
  );
}

function AppHeader({ userName, onMenu }) {
  return (
    <header className="zp-topbar">
      <div className="zp-brand">
        <div className="zp-brand-stack">
          <BrandLogo className="zp-brandLogo" size="client" priority />
          <div className="zp-brand-text logo-caption">
          <span>Hola, {userName} 👋</span>
          </div>
        </div>
      </div>
      <div className="zp-header-actions">
        <button className="zp-icon-btn" type="button" aria-label="Notificaciones">
          <Bell size={24} />
          <span className="zp-notification-dot" />
        </button>
        <button className="zp-icon-btn" type="button" aria-label="Menu" onClick={onMenu}>
          <Menu size={27} />
        </button>
      </div>
    </header>
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

function ProgressTabContent({ activeTab, range, onRangeChange, weights, summary, photos, onPhotoChange, onAddWeight }) {
  if (activeTab === "Peso") {
    return (
      <>
        <WeightChartCard
          weights={weights}
          summary={summary}
          range={range}
          onRangeChange={onRangeChange}
          onAddWeight={onAddWeight}
        />
        <BodyMeasurementsCard />
        <ProgressPhotosCard photos={photos} onPhotoChange={onPhotoChange} />
      </>
    );
  }

  if (activeTab === "Medidas") {
    return (
      <>
        <BodyMeasurementsCard expanded />
        <MeasurementsFormPreview />
      </>
    );
  }

  if (activeTab === "Gym") {
    return <GymProgressCard />;
  }

  if (activeTab === "Fotos") {
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
        onAddWeight={onAddWeight}
      />
    </>
  );
}

function DesktopDashboard({ activeTab, range, onRangeChange, weights, summary, photos, onPhotoChange, onAddWeight }) {
  if (activeTab !== "Peso") {
    return (
      <div className="zp-stack">
        <ProgressTabContent
          activeTab={activeTab}
          range={range}
          onRangeChange={onRangeChange}
          weights={weights}
          summary={summary}
          photos={photos}
          onPhotoChange={onPhotoChange}
          onAddWeight={onAddWeight}
        />
      </div>
    );
  }

  return (
    <>
      <div className="zp-kpi-row">
        <ProgressMetricCard icon={Scale} label="Peso actual" value={formatKg(summary.currentWeight)} detail={summary.updatedAt} />
        <ProgressMetricCard icon={Target} label="Objetivo" value={formatKg(summary.goalWeight)} detail={`Faltan ${formatKg(summary.remainingWeight)}`} />
        <ProgressMetricCard icon={TrendingUp} label="Cambio 4 semanas" value={`${summary.changeFourWeeks.toFixed(1)} kg`} detail={`${summary.changePercentage.toFixed(1)}% del peso inicial`} positive />
      </div>
      <div className="zp-desktop-grid">
        <WeightChartCard
          weights={weights}
          summary={summary}
          range={range}
          onRangeChange={onRangeChange}
          onAddWeight={onAddWeight}
        />
        <div className="zp-side-stack">
          <BodyMeasurementsCard />
          <ProgressPhotosCard photos={photos} onPhotoChange={onPhotoChange} />
          <GymProgressCard compact />
        </div>
      </div>
    </>
  );
}

function RangeSelector({ value, onChange }) {
  const ranges = ["4 semanas", "8 semanas", "12 semanas"];
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

function WeightChartCard({ weights, summary, range, onRangeChange, onAddWeight }) {
  return (
    <section className="zp-card zp-weight-card">
      <div className="zp-card-head">
        <div>
          <h2 className="zp-card-title">Peso - últimas 4 semanas</h2>
          <p className="zp-card-sub">promedio semanal</p>
        </div>
        <RangeSelector value={range} onChange={onRangeChange} />
      </div>

      <WeightLineChart weights={weights} />
      <WeeklyAverageCards weights={weights} />

      <div className="zp-metrics-strip">
        <ProgressMetricCard icon={Scale} label="Peso actual" value={formatKg(summary.currentWeight)} detail={summary.updatedAt} />
        <ProgressMetricCard icon={Target} label="Objetivo" value={formatKg(summary.goalWeight)} detail={`Faltan ${formatKg(summary.remainingWeight)}`} />
        <ProgressMetricCard icon={TrendingUp} label="Cambio 4 semanas" value={`${summary.changeFourWeeks.toFixed(1)} kg`} detail={`${summary.changePercentage.toFixed(1)}% del peso inicial`} positive />
      </div>

      <button className="zp-primary-btn" type="button" onClick={onAddWeight}>
        <Plus size={24} />
        Cargar nuevo peso
      </button>
    </section>
  );
}

function WeightLineChart({ weights }) {
  const minY = 76;
  const maxY = 80;
  const width = 720;
  const height = 300;
  const left = 54;
  const right = 32;
  const top = 28;
  const bottom = 70;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const yTicks = [80, 79, 78, 77, 76];
  const points = weights.map((item, index) => {
    const x = left + (plotWidth / Math.max(1, weights.length - 1)) * index;
    const y = top + ((maxY - item.averageWeight) / (maxY - minY)) * plotHeight;
    return { ...item, x, y };
  });
  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${top + plotHeight} L ${points[0].x} ${top + plotHeight} Z`;

  return (
    <div className="zp-chart-shell">
      <svg className="zp-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de peso de las ultimas 4 semanas">
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
              <text x="0" y={y + 5} fill="#f5f5f7" fontSize="15">{tick}</text>
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
          <p>Faltan {formatKg(summary.remainingWeight)} para llegar a la meta.</p>
        </div>
      </div>
    </section>
  );
}

function BodyMeasurementsCard({ expanded = false }) {
  return (
    <section className="zp-card zp-section-card">
      <div className="zp-section-head">
        <h2>Medidas corporales</h2>
        <button className="zp-see-all" type="button">
          Ver todas
          <ChevronRight size={16} />
        </button>
      </div>
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
      {expanded ? (
        <button className="zp-primary-btn" type="button">
          <Plus size={22} />
          Cargar medidas
        </button>
      ) : null}
    </section>
  );
}

function MeasurementRow({ item }) {
  const Icon = item.icon;
  const TrendIcon = item.trend === "down" ? ArrowDown : ArrowUp;
  const tone = item.positive ? "good" : "bad";
  return (
    <div className="zp-measure-row">
      <div className="zp-measure-name">
        <span className="zp-mini-icon"><Icon size={18} /></span>
        <span>{item.name}</span>
      </div>
      <div className="zp-measure-value">{item.value.toFixed(1)} {item.unit}</div>
      <div className={`zp-change ${tone}`}>
        {item.change > 0 ? "+" : ""}{item.change.toFixed(1)} {item.unit}
        <TrendIcon size={15} />
      </div>
      <Sparkline points={item.points} color={item.positive ? "#39d353" : "#ff5d73"} />
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

function GymProgressCard({ compact = false }) {
  return (
    <section className="zp-card zp-placeholder-card">
      <div className="zp-section-head">
        <h2>Gym</h2>
        <button className="zp-see-all" type="button">
          Ver rutina
          <ChevronRight size={16} />
        </button>
      </div>
      <div className="zp-placeholder-grid">
        {gymMetrics.slice(0, compact ? 2 : gymMetrics.length).map((item) => (
          <div className="zp-info-tile" key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <p>{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function MeasurementsFormPreview() {
  const fields = ["Cintura", "Pecho", "Brazo", "Cadera", "Pierna", "Abdomen"];
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((field) => [field, ""])));
  const [saved, setSaved] = useState(false);

  function updateField(field, value) {
    setSaved(false);
    setValues((current) => ({ ...current, [field]: value }));
  }

  function saveMeasurements(event) {
    event.preventDefault();
    setSaved(true);
  }

  return (
    <form className="zp-card zp-placeholder-card" onSubmit={saveMeasurements}>
      <div className="zp-section-head">
        <h2>Nueva medición</h2>
      </div>
      <div className="zp-placeholder-grid">
        {fields.map((label) => (
          <div className="zp-info-tile" key={label}>
            <span>{label}</span>
            <div className="zp-input-wrap" style={{ marginTop: 10 }}>
              <input
                type="number"
                min="0"
                step="0.1"
                value={values[label]}
                onChange={(event) => updateField(label, event.target.value)}
                placeholder="--"
              />
              <span className="zp-input-unit">cm</span>
            </div>
          </div>
        ))}
      </div>
      {saved ? <div className="zp-info-tile"><span>Medidas guardadas en esta vista</span><p>Listo para conectar con historial cuando sumemos persistencia.</p></div> : null}
      <button className="zp-primary-btn" type="submit">
        <Plus size={22} />
        Guardar medidas
      </button>
    </form>
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

function MobileMenuSheet({ onClose }) {
  const links = [
    { to: "/app/inicio", label: "Inicio", icon: Home },
    { to: "/app/menu", label: "Nutrición", icon: Apple },
    { to: "/app/rutinas", label: "Entrenamiento", icon: Dumbbell },
    { to: "/app/progresos", label: "Progresos", icon: LineChart },
    { to: "/app/perfil", label: "Perfil", icon: MoreHorizontal },
  ];
  return (
    <div className="zp-menu-sheet" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className="zp-menu-panel" role="dialog" aria-label="Menu principal">
        <div className="zp-menu-panel-head">
          <strong>Menú</strong>
          <button className="zp-menu-close" type="button" onClick={onClose} aria-label="Cerrar menú">
            <X size={20} />
          </button>
        </div>
        {links.map((link) => {
          const LinkIcon = link.icon;
          return (
            <NavLink key={link.to} to={link.to} className={({ isActive }) => `zp-menu-link ${isActive ? "active" : ""}`} onClick={onClose}>
              <LinkIcon size={20} />
              {link.label}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

function BottomNavigation() {
  const items = [
    { to: "/app/inicio", label: "Inicio", icon: Home },
    { to: "/app/rutinas", label: "Entrenamiento", icon: Dumbbell },
    { to: "/app/progresos", label: "Progresos", icon: LineChart, active: true },
    { to: "/app/menu", label: "Nutrición", icon: Apple },
    { to: "/app/perfil", label: "Más", icon: MoreHorizontal },
  ];
  return (
    <nav className="zp-bottom-nav" aria-label="Navegación inferior">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.label} to={item.to} className={`zp-bottom-item ${item.active ? "active" : ""}`}>
            <Icon />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

function DesktopSidebar() {
  const items = [
    { to: "/app/inicio", label: "Inicio", icon: Home },
    { to: "/app/rutinas", label: "Entrenamientos", icon: Dumbbell },
    { to: "/app/progresos", label: "Progresos", icon: LineChart },
    { to: "/app/menu", label: "Nutrición", icon: Apple },
    { to: "/app/perfil", label: "Perfil", icon: MoreHorizontal },
  ];
  return (
    <aside className="zp-sidebar">
      <div className="zp-brand">
        <div className="zp-brand-stack">
          <BrandLogo className="zp-brandLogo" size="client" priority />
          <div className="zp-brand-text logo-caption">
            <span>Panel cliente</span>
          </div>
        </div>
      </div>
      <nav className="zp-side-nav" aria-label="Navegación desktop">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.label} to={item.to} className={({ isActive }) => `zp-side-link ${isActive ? "active" : ""}`}>
              <Icon size={21} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

function AddWeightModal({ initialWeight, onSave, onClose }) {
  const [weight, setWeight] = useState(String(initialWeight || ""));
  const [date, setDate] = useState(todayInputValue());
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  function submit(event) {
    event.preventDefault();
    const numericWeight = Number(weight);
    if (!Number.isFinite(numericWeight) || numericWeight <= 0) {
      setError("Ingresá un peso válido mayor a 0.");
      return;
    }
    if (!date) {
      setError("Elegí una fecha para el registro.");
      return;
    }
    onSave({ weight: numericWeight, date, note });
  }

  return (
    <div className="zp-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <form className="zp-modal" onSubmit={submit}>
        <h2>Cargar nuevo peso</h2>
        <div className="zp-form">
          <div className="zp-field">
            <label htmlFor="progress-weight">Peso</label>
            <div className="zp-input-wrap">
              <input
                id="progress-weight"
                type="number"
                min="1"
                step="0.1"
                value={weight}
                onChange={(event) => {
                  setWeight(event.target.value);
                  setError("");
                }}
                autoFocus
              />
              <span className="zp-input-unit">kg</span>
            </div>
          </div>
          <div className="zp-field">
            <label htmlFor="progress-date">Fecha</label>
            <div className="zp-input-wrap">
              <input id="progress-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </div>
          </div>
          <div className="zp-field">
            <label htmlFor="progress-note">Nota opcional</label>
            <div className="zp-input-wrap">
              <textarea id="progress-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ej: ayunas, post entrenamiento..." />
            </div>
          </div>
          {error ? <div className="zp-error">{error}</div> : null}
        </div>
        <div className="zp-modal-actions">
          <button className="zp-secondary-btn" type="button" onClick={onClose}>Cancelar</button>
          <button className="zp-gold-btn" type="submit">Guardar</button>
        </div>
      </form>
    </div>
  );
}

export default function Progresos() {
  return <ProgressPage />;
}
