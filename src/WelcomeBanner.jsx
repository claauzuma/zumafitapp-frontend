// src/WelcomeBanner.jsx
import React from "react";
import { useNavigate, useLocation } from "react-router-dom";

const CSS = `
.wb{
  --bg:#0b0b0b;
  --fg:#eaeaea;
  --accent:#f5d76e;
  --line:#1b1b1b;
}
.wb{
  background: linear-gradient(180deg, rgba(11,11,11,.95), rgba(11,11,11,.75));
  border-bottom:1px solid var(--line);
  position: sticky;
  top: 0;
  z-index: 60;
  backdrop-filter: blur(4px) saturate(150%);
}
.wb-inner{
  max-width: 1100px;
  margin: 0 auto;
  padding: 10px 16px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap: 12px;
}
.wb-brand{
  display:flex;
  align-items:center;
  gap:10px;
  cursor:pointer;
  user-select:none;
}
.wb-logo{ font-size: 18px; }
.wb-title{
  font-weight: 900;
  letter-spacing: .2px;
  color: var(--accent);
}
.wb-sub{
  font-size: 12px;
  color: #bdbdbd;
  margin-top: 2px;
}
.wb-right{
  display:flex; align-items:center; gap: 8px;
}
.wb-btn{
  border: 1px solid #2b2b2b;
  background:#0f0f0f;
  color: #eaeaea;
  border-radius: 12px;
  padding: 8px 10px;
  font-weight: 800;
  cursor:pointer;
}
.wb-btn.primary{
  background: linear-gradient(135deg, #facc15, #f5d76e);
  border: none;
  color:#0a0a0a;
}
`;

export default function WelcomeBanner() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  const inAuth = pathname.startsWith("/login") || pathname.startsWith("/register");

  return (
    <div className="wb">
      <style>{CSS}</style>
      <div className="wb-inner">
        <div className="wb-brand" onClick={() => nav("/")}>
          <div className="wb-logo">🍏</div>
          <div>
            <div className="wb-title">ZumaFit</div>
            <div className="wb-sub">Menús inteligentes • Macros • Progreso</div>
          </div>
        </div>

        <div className="wb-right">
          {!inAuth && (
            <>
              <button className="wb-btn" onClick={() => nav("/login")}>Login</button>
              <button className="wb-btn primary" onClick={() => nav("/register")}>Registrarse</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
