// src/bienvenida.jsx
import React from "react";
import { useNavigate } from "react-router-dom";

const CSS = `
.lw{
  --bg:#0b0b0b;
  --fg:#eaeaea;
  --card:linear-gradient(180deg,#141414,#0f0f0f);
  --muted:#bdbdbd;
  --accent:#f5d76e;
}
*{ box-sizing:border-box; }
.lw.page{ background:var(--bg); color:var(--fg); min-height:100dvh; display:flex; flex-direction:column; }
.lw-nav{ position:sticky; top:0; z-index:50; backdrop-filter:saturate(150%) blur(3px);
  background: linear-gradient(180deg, rgba(11,11,11,0.9), rgba(11,11,11,0)); border-bottom:1px solid #1b1b1b; }
.nav-inner{ max-width:960px; margin:0 auto; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap:10px; }
.brand{ color:var(--accent); font-weight:900; cursor:pointer; display:flex; align-items:center; gap:8px; }
.btn{ border:none; border-radius:12px; padding:10px 12px; font-weight:900; cursor:pointer; }
.btn.solid{ background: linear-gradient(135deg, #facc15, #f5d76e); color:#0a0a0a; }
.btn.ghost{ background:#0f0f0f; color:#eaeaea; border:1px solid #2b2b2b; }
.hero{ padding:18px 16px 20px; }
.hero-inner{ max-width:960px; margin:0 auto; display:grid; grid-template-columns:1fr; gap:18px; }
h1{ margin:0 0 8px; font-size:34px; }
.sub{ color:#cfcfcf; margin:0 0 14px; line-height:1.4; }
.cta{ display:flex; gap:10px; flex-wrap:wrap; }
.card{ border:1px solid #232323; background:var(--card); border-radius:16px; padding:14px; }
.bullets{ margin:8px 0 0; padding-left:18px; color:#c9c9c9; }
.footer{ margin-top:auto; border-top:1px solid #1e1e1e; padding:14px 16px; }
.foot-inner{ max-width:960px; margin:0 auto; color:#bdbdbd; display:flex; gap:12px; align-items:center; }
@media (min-width: 840px){
  .hero-inner{ grid-template-columns:1.15fr 0.85fr; align-items:start; }
}
`;

export default function Bienvenida() {
  const nav = useNavigate();

  return (
    <div className="lw page">
      <style>{CSS}</style>

      <header className="lw-nav">
        <div className="nav-inner">
          <div className="brand" onClick={() => nav("/")}>🍏 ZumaFit</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn ghost" onClick={() => nav("/login")}>Iniciar sesión</button>
            <button className="btn solid" onClick={() => nav("/register")}>Registrarse</button>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-inner">
          <div>
            <h1>Tu plan, tus macros, tu progreso.</h1>
            <p className="sub">
              ZumaFit te ayuda a organizar nutrición y entrenamiento con un panel simple,
              pensado para celular y para que no pierdas tiempo.
            </p>

            <div className="cta">
              <button className="btn solid" onClick={() => nav("/register")}>Empezar gratis</button>
              <button className="btn ghost" onClick={() => nav("/login")}>Ya tengo cuenta</button>
            </div>

            <ul className="bullets">
              <li>🍽️ Menús y macros</li>
              <li>🏋️ Rutinas</li>
              <li>📈 Progresos</li>
              <li>👤 Perfil / Ajustes</li>
            </ul>
          </div>

          <div className="card">
            <strong style={{ display: "block", marginBottom: 8 }}>¿Qué vas a ver al entrar?</strong>
            <div style={{ color: "#cfcfcf", fontSize: 14, lineHeight: 1.5 }}>
              Un inicio con tu resumen y accesos a: Menú, Rutina, Progresos, Perfil y Ajustes.
              Y arriba, un navbar para moverte rápido + cerrar sesión.
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="foot-inner">
          <span>© {new Date().getFullYear()} ZumaFit</span>
          <span style={{ opacity: 0.7 }}>•</span>
          <span>Privacidad</span>
          <span style={{ opacity: 0.7 }}>•</span>
          <span>Términos</span>
        </div>
      </footer>
    </div>
  );
}
