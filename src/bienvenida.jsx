// src/bienvenida.jsx
import React from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  ClipboardList,
  Dumbbell,
  Flame,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Utensils,
  Zap,
} from "lucide-react";

import fondoZumaFit from "./assets/fondozumafit.png";
import BrandLogo from "./ui/BrandLogo.jsx";

const BENEFITS = [
  { title: "Nutrición", text: "Objetivos y macros personalizados", short: "Macros", icon: Utensils },
  { title: "Menú", text: "Planificá tus comidas", short: "Comidas", icon: ClipboardList },
  { title: "Rutina", text: "Entrená con propósito", short: "Entrená", icon: Dumbbell },
  { title: "Progreso", text: "Medí y analizá tus avances", short: "Avances", icon: TrendingUp },
  { title: "Tracking", text: "Registrá hábitos y consumo", short: "Hábitos", icon: Flame },
];

const CSS = `
.lw{
  --auth-bg:#020507;
  --auth-surface:rgba(10,15,20,.88);
  --auth-surface-strong:rgba(10,14,19,.96);
  --auth-border:rgba(255,211,83,.25);
  --auth-gold:#f4c542;
  --auth-gold-soft:#ffe178;
  --auth-text:#f7f7f7;
  --auth-muted:#a7adb5;
}
*{ box-sizing:border-box; }
body{ background:#020507; }
.lw.page{
  min-height:100dvh;
  color:var(--auth-text);
  background:#020507;
}
.lw-hero{
  min-height:100dvh;
  padding:clamp(16px,3vw,32px);
  background:
    radial-gradient(circle at 17% 18%, rgba(255,198,49,.12), transparent 28%),
    linear-gradient(180deg, rgba(2,5,8,.06) 0%, rgba(2,5,8,.34) 34%, rgba(2,5,8,.88) 72%, #020507 100%),
    linear-gradient(90deg, rgba(2,5,8,.95) 0%, rgba(2,5,8,.72) 40%, rgba(2,5,8,.12) 100%),
    var(--landing-bg);
  background-size:cover;
  background-position:center top;
  display:grid;
  align-items:start;
}
.lw-shell{
  width:min(1080px,100%);
  margin:0 auto;
  min-height:calc(100dvh - clamp(32px,6vw,64px));
  position:relative;
  isolation:isolate;
  border:1px solid rgba(255,255,255,.10);
  border-radius:clamp(26px,4vw,44px);
  background:
    linear-gradient(180deg, rgba(3,8,13,.20), rgba(3,8,13,.86) 74%, rgba(3,8,13,.94)),
    radial-gradient(circle at 10% 30%, rgba(244,197,66,.10), transparent 34%);
  box-shadow:0 26px 80px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06);
  padding:clamp(22px,5vw,52px);
  display:grid;
  align-content:start;
  gap:clamp(24px,4vw,42px);
  overflow:hidden;
}
.lw-shell > *{
  position:relative;
  z-index:1;
}
.lw-brand{
  width:max-content;
  max-width:100%;
  border:0;
  background:transparent;
  padding:0;
  cursor:pointer;
}
.lw-brand .brand-logo-img{ height:clamp(48px,8vw,82px); max-width:min(310px,72vw); }
.lw-copy{ max-width:650px; }
.lw-kicker{
  display:inline-flex;
  min-height:42px;
  align-items:center;
  gap:10px;
  border:1px solid var(--auth-border);
  border-radius:999px;
  background:rgba(3,8,13,.54);
  padding:0 18px;
  color:var(--auth-gold-soft);
  font-size:13px;
  font-weight:1000;
  letter-spacing:.04em;
  text-transform:uppercase;
  box-shadow:0 12px 32px rgba(0,0,0,.28);
}
.lw-title{
  margin:26px 0 0;
  font-size:clamp(50px,10vw,92px);
  line-height:.98;
  letter-spacing:-.04em;
  font-weight:1000;
}
.lw-title span{ display:block; }
.lw-title .gold{
  color:var(--auth-gold-soft);
  text-shadow:0 12px 36px rgba(244,197,66,.18);
}
.lw-sub{
  max-width:590px;
  margin:24px 0 0;
  color:rgba(247,247,247,.78);
  font-size:clamp(18px,3.4vw,26px);
  line-height:1.45;
  font-weight:700;
}
.lw-benefits{
  display:grid;
  grid-template-columns:repeat(5,minmax(0,1fr));
  gap:12px;
}
.lw-benefit{
  min-height:154px;
  border:1px solid rgba(255,255,255,.10);
  border-radius:20px;
  background:linear-gradient(180deg, rgba(17,26,36,.82), rgba(6,11,17,.78));
  padding:18px 14px;
  display:grid;
  justify-items:center;
  align-content:center;
  gap:10px;
  text-align:center;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
}
.lw-benefit svg{ color:var(--auth-gold); filter:drop-shadow(0 8px 24px rgba(244,197,66,.18)); }
.lw-benefit strong{ font-size:18px; font-weight:1000; }
.lw-benefit span{ color:rgba(247,247,247,.70); font-size:14px; line-height:1.35; font-weight:700; }
.lw-benefitShort{ display:none; }
.lw-value{
  display:grid;
  grid-template-columns:auto 1fr;
  gap:20px;
  align-items:center;
  border:1px solid var(--auth-border);
  border-radius:24px;
  background:linear-gradient(135deg, rgba(18,25,33,.82), rgba(5,9,14,.82));
  padding:22px;
  box-shadow:0 24px 60px rgba(0,0,0,.34), inset 0 1px 0 rgba(255,255,255,.04);
}
.lw-valueIcon{
  width:88px;
  height:88px;
  border-radius:999px;
  display:grid;
  place-items:center;
  color:var(--auth-gold-soft);
  border:1px solid rgba(244,197,66,.28);
  background:rgba(244,197,66,.10);
}
.lw-value h2{ margin:0; color:var(--auth-gold-soft); font-size:clamp(24px,4vw,34px); }
.lw-value p{ margin:8px 0 0; color:rgba(247,247,247,.76); font-size:clamp(16px,3vw,23px); line-height:1.35; font-weight:700; }
.lw-actions{ display:grid; gap:16px; }
.lw-btn{
  min-height:70px;
  border-radius:20px;
  border:1px solid rgba(244,197,66,.34);
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:16px;
  padding:0 24px;
  font-size:clamp(19px,4vw,32px);
  font-weight:1000;
  cursor:pointer;
  transition:transform .16s ease, border-color .16s ease, filter .16s ease;
}
.lw-btn:hover{ transform:translateY(-1px); filter:brightness(1.04); }
.lw-btnPrimary{
  color:#080807;
  background:linear-gradient(135deg,#ffc414,#ffe47a 55%,#f1b915);
  box-shadow:0 18px 44px rgba(244,197,66,.22);
}
.lw-btnSecondary{
  color:var(--auth-gold-soft);
  background:rgba(3,8,13,.54);
}
.lw-trust{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
  color:rgba(247,247,247,.72);
  text-align:left;
  font-weight:800;
}
.lw-trust strong{
  display:block;
  color:rgba(247,247,247,.70);
  font-size:clamp(15px,3vw,22px);
  letter-spacing:.05em;
}
.lw-trust span{ display:block; margin-top:4px; color:rgba(247,247,247,.62); font-size:clamp(13px,2.7vw,18px); }
.lw-trust svg{ color:var(--auth-gold-soft); flex:0 0 auto; }
@media (max-width: 840px){
  .lw-benefits{ grid-template-columns:repeat(2,minmax(0,1fr)); }
  .lw-benefit:last-child{ grid-column:1/-1; }
}
@media (max-width: 560px){
  .lw-hero{
    min-height:100svh;
    padding:8px;
    background:
      radial-gradient(circle at 70% 10%, rgba(255,198,49,.10), transparent 26%),
      linear-gradient(180deg,#020507,#020507);
  }
  .lw-shell{
    min-height:0;
    border-radius:22px;
    padding:14px;
    gap:12px;
    background:
      linear-gradient(180deg, rgba(3,8,13,.14), rgba(3,8,13,.72) 72%, rgba(3,8,13,.98)),
      radial-gradient(circle at 12% 25%, rgba(244,197,66,.08), transparent 30%);
    box-shadow:0 20px 54px rgba(0,0,0,.54), inset 0 1px 0 rgba(255,255,255,.08);
  }
  .lw-shell::before,
  .lw-shell::after{
    content:"";
    position:absolute;
    inset:0;
    pointer-events:none;
  }
  .lw-shell::before{
    z-index:0;
    background-image:var(--landing-bg);
    background-repeat:no-repeat;
    background-size:auto 990px;
    background-position:62% -138px;
    opacity:.98;
  }
  .lw-shell::after{
    z-index:0;
    background:
      linear-gradient(90deg, rgba(2,5,8,.96) 0%, rgba(2,5,8,.80) 42%, rgba(2,5,8,.20) 79%, rgba(2,5,8,.10) 100%),
      linear-gradient(180deg, rgba(2,5,8,.04) 0%, rgba(2,5,8,.08) 26%, rgba(2,5,8,.48) 58%, rgba(2,5,8,.96) 100%),
      radial-gradient(circle at 76% 16%, rgba(255,197,64,.13), transparent 30%);
  }
  .lw-brand .brand-logo-img{ height:36px; max-width:150px; }
  .lw-kicker{ min-height:24px; gap:6px; font-size:8px; padding:0 9px; letter-spacing:.03em; }
  .lw-kicker svg{ width:11px; height:11px; }
  .lw-title{
    margin-top:9px;
    font-size:clamp(38px,11.8vw,50px);
    line-height:.94;
    letter-spacing:-.045em;
  }
  .lw-sub{
    max-width:270px;
    margin-top:8px;
    font-size:12px;
    line-height:1.35;
    font-weight:650;
  }
  .lw-benefits{
    grid-template-columns:repeat(5,minmax(0,1fr));
    gap:5px;
  }
  .lw-benefit{
    min-height:78px;
    padding:7px 3px 6px;
    border-radius:10px;
    gap:5px;
  }
  .lw-benefit:last-child{ grid-column:auto; }
  .lw-benefit svg{ width:23px; height:23px; }
  .lw-benefit strong{ font-size:10px; line-height:1.05; }
  .lw-benefit span{ font-size:8px; line-height:1.15; }
  .lw-benefitFull{ display:none; }
  .lw-benefitShort{ display:inline; }
  .lw-value{
    grid-template-columns:auto 1fr;
    gap:11px;
    padding:11px;
    border-radius:15px;
    min-height:82px;
  }
  .lw-valueIcon{ width:52px; height:52px; }
  .lw-valueIcon svg{ width:25px; height:25px; }
  .lw-value h2{ font-size:15px; line-height:1.1; }
  .lw-value p{ margin-top:4px; font-size:11px; line-height:1.35; }
  .lw-actions{ gap:10px; }
  .lw-btn{
    min-height:54px;
    border-radius:13px;
    padding:0 13px;
    font-size:16px;
  }
  .lw-btnSecondary{ min-height:50px; }
  .lw-btn svg{ width:18px; height:18px; }
  .lw-trust{ justify-content:flex-start; }
  .lw-trust strong{ font-size:11px; }
  .lw-trust span{ font-size:10px; }
  .lw-trust svg{ width:19px; height:19px; }
}
@media (max-width: 360px){
  .lw-shell{ padding:12px; gap:10px; }
  .lw-shell::before{
    background-size:auto 930px;
    background-position:63% -124px;
  }
  .lw-title{ font-size:clamp(35px,11.3vw,42px); }
  .lw-sub{ max-width:245px; font-size:11px; }
  .lw-benefits{ gap:4px; }
  .lw-benefit{ min-height:70px; }
  .lw-benefit svg{ width:20px; height:20px; }
  .lw-benefit strong{ font-size:9px; }
  .lw-benefit span{ display:none; }
  .lw-value{ min-height:76px; padding:10px; }
  .lw-valueIcon{ width:46px; height:46px; }
  .lw-value h2{ font-size:14px; }
  .lw-value p{ font-size:10px; }
  .lw-btn{ min-height:52px; }
}
`;

export default function Bienvenida() {
  const nav = useNavigate();

  return (
    <main className="lw page">
      <style>{CSS}</style>
      <section className="lw-hero" style={{ "--landing-bg": `url(${fondoZumaFit})` }}>
        <div className="lw-shell">
          <button className="lw-brand" type="button" onClick={() => nav("/")} aria-label="Ir al inicio">
            <BrandLogo className="brand-logoPublic" size="client" priority />
          </button>

          <div className="lw-copy">
            <span className="lw-kicker">
              <Sparkles size={18} />
              Todo en un solo lugar
            </span>
            <h1 className="lw-title">
              <span>Tu plan.</span>
              <span className="gold">Tus macros.</span>
              <span>Tu progreso.</span>
            </h1>
            <p className="lw-sub">
              ZumaFit te ayuda a organizar tu nutrición y entrenamiento con un panel simple,
              pensado para tu estilo de vida.
            </p>
          </div>

          <div className="lw-benefits" aria-label="Funciones principales">
            {BENEFITS.map(({ title, text, short, icon: Icon }) => (
              <article className="lw-benefit" key={title}>
                {React.createElement(Icon, { size: 38, strokeWidth: 1.9 })}
                <strong>{title}</strong>
                <span>
                  <span className="lw-benefitFull">{text}</span>
                  <span className="lw-benefitShort">{short}</span>
                </span>
              </article>
            ))}
          </div>

          <article className="lw-value">
            <span className="lw-valueIcon" aria-hidden="true">
              <BarChart3 size={38} />
            </span>
            <div>
              <h2>Diseñado para resultados reales</h2>
              <p>Planes adaptados a vos. Sin dietas extremas. Sin perder tiempo.</p>
            </div>
          </article>

          <div className="lw-actions">
            <button className="lw-btn lw-btnPrimary" type="button" onClick={() => nav("/auth/register")}>
              <Zap size={26} />
              <span>Empezar gratis</span>
              <ArrowRight size={28} />
            </button>
            <button className="lw-btn lw-btnSecondary" type="button" onClick={() => nav("/auth/login")}>
              <span />
              <span>Iniciar sesión</span>
              <ArrowRight size={26} />
            </button>
          </div>

          <div className="lw-trust">
            <ShieldCheck size={34} />
            <p>
              <strong>CONFIABLE · SEGURO · PRIVADO</strong>
              <span>Tus datos siempre están protegidos</span>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
