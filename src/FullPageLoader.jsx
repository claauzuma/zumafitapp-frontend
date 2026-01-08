// src/FullPageLoader.jsx
import React from "react";

export default function FullPageLoader({ title = "Cargando…", sub = "Preparando tu panel." }) {
  return (
    <div className="zl-wrap" role="status" aria-live="polite" aria-busy="true">
      <style>{CSS}</style>

      <div className="zl-card">
        <div className="zl-glow" />
        <div className="zl-row">
          <div className="zl-spin" />
          <div>
            <p className="zl-title">{title}</p>
            <p className="zl-sub">{sub}</p>
          </div>
        </div>
        <div className="zl-shimmer" />
      </div>
    </div>
  );
}

const CSS = `
:root{
  --bg:#0b0b0b;
  --fg:#eaeaea;
  --accent:#f5d76e;
}
.zl-wrap{
  min-height:100dvh;
  background: radial-gradient(800px 400px at 20% 0%, rgba(245,215,110,.10), transparent 60%),
              radial-gradient(700px 360px at 80% 100%, rgba(250,204,21,.08), transparent 60%),
              var(--bg);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:18px;
  color:var(--fg);
}
.zl-card{
  width:min(520px, 100%);
  border:1px solid #232323;
  background: linear-gradient(180deg,#121212,#0b0b0b);
  border-radius:18px;
  padding:18px 16px;
  position:relative;
  overflow:hidden;
  box-shadow: 0 18px 70px rgba(0,0,0,.65);
}
.zl-glow{
  position:absolute; inset:-2px;
  background: radial-gradient(600px 200px at 20% 0%, rgba(245,215,110,.22), transparent 60%),
              radial-gradient(520px 220px at 80% 100%, rgba(250,204,21,.10), transparent 60%);
  pointer-events:none;
}
.zl-row{ display:flex; align-items:center; gap:12px; position:relative; }
.zl-spin{
  width:44px; height:44px; border-radius:50%;
  border:3px solid rgba(245,215,110,.18);
  border-top-color: rgba(245,215,110,.95);
  box-shadow: 0 0 18px rgba(245,215,110,.18);
  animation: zlSpin .9s linear infinite;
  flex:0 0 auto;
}
@keyframes zlSpin { to { transform: rotate(360deg); } }
.zl-title{ font-weight:900; margin:0; color:var(--accent); font-size:16px; }
.zl-sub{ margin:4px 0 0; color:#cfcfcf; font-size:13px; line-height:1.4; }
.zl-shimmer{
  margin-top:14px; height:10px; border-radius:999px;
  background: #101010; border:1px solid #1f1f1f;
  overflow:hidden; position:relative;
}
.zl-shimmer::after{
  content:""; position:absolute; inset:0;
  transform: translateX(-60%);
  background: linear-gradient(90deg, transparent, rgba(245,215,110,.35), transparent);
  animation: zlShimmer 1.2s ease-in-out infinite;
}
@keyframes zlShimmer { 0% { transform: translateX(-60%); } 100% { transform: translateX(160%); } }
`;
