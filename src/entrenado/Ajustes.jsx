// src/Ajustes.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../Api";

const CSS = `
.a-wrap{ min-height: calc(100dvh - 56px); background:#0b0b0b; color:#eaeaea; padding:14px 16px 28px; }
.a-inner{ max-width: 1000px; margin:0 auto; display:grid; gap:12px; }
.a-title{ font-size:22px; font-weight:900; margin:0; }
.a-sub{ margin:0; color:#bdbdbd; }
.a-card{ border:1px solid #232323; background: linear-gradient(180deg,#141414,#0f0f0f); border-radius:16px; padding:14px; box-shadow:0 16px 48px rgba(0,0,0,.35); display:grid; gap:10px; }
.a-row{ display:flex; align-items:center; justify-content:space-between; gap:12px; border:1px solid #2b2b2b; background:#0f0f0f; border-radius:14px; padding:12px; }
.a-row b{ font-weight:1000; }
.a-muted{ color:#bdbdbd; font-size:12px; }
.toggle{
  appearance:none; width:48px; height:28px; border-radius:999px;
  background:#1a1a1a; border:1px solid #2b2b2b; position:relative; cursor:pointer;
}
.toggle:checked{ background:#1a1300; border-color:#3a3000; }
.toggle::after{
  content:""; position:absolute; top:3px; left:3px; width:22px; height:22px;
  border-radius:999px; background:#dcdcdc; transition: all .2s ease;
}
.toggle:checked::after{ left: 23px; background:#f5d76e; }
.btn{ border:none; border-radius:12px; padding:10px 12px; font-weight:900; cursor:pointer; }
.btn.solid{ background: linear-gradient(135deg, #facc15, #f5d76e); color:#0a0a0a; }
.badge{ display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border-radius:999px; border:1px solid #2b2b2b; background:#0f0f0f; color:#dcdcdc; font-size:12px; font-weight:900; }
.warn{ border-color:#6b3c00; background:#281a00; color:#ffd9a1; }
.ok{ border-color:#0f4d2d; background:#062214; color:#bff7d0; }
`;

export default function Ajustes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dark, setDark] = useState(true);
  const [notif, setNotif] = useState(true);

  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setMsg(null);

        // Tu controlador devuelve settings en /users/me
        const data = await apiFetch("/api/usuarios/users/me");
        if (!mounted) return;

        const s = data?.settings || {};
        // defaults
        setDark(s?.darkMode ?? true);
        setNotif(s?.notificaciones ?? true);
      } catch (e) {
        if (mounted) setMsg({ type: "warn", text: e?.message || "No pude cargar ajustes" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => (mounted = false);
  }, []);

  async function guardar() {
    try {
      setSaving(true);
      setMsg(null);

      await apiFetch("/api/usuarios/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          settings: {
            darkMode: dark,
            notificaciones: notif,
          },
        }),
      });

      setMsg({ type: "ok", text: "Ajustes guardados ✅" });
    } catch (e) {
      setMsg({ type: "warn", text: e?.message || "No pude guardar ajustes" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="a-wrap">
      <style>{CSS}</style>

      <div className="a-inner">
        <div>
          <h1 className="a-title">⚙️ Ajustes</h1>
          <p className="a-sub">Preferencias del usuario (guardadas en tu backend).</p>
        </div>

        {msg && <div className={`badge ${msg.type}`}>{msg.text}</div>}

        <div className="a-card">
          <div className="a-row">
            <div>
              <b>Modo oscuro</b>
              <div className="a-muted">UI oscura (recomendado)</div>
            </div>
            <input
              className="toggle"
              type="checkbox"
              checked={dark}
              onChange={(e) => setDark(e.target.checked)}
              disabled={loading || saving}
            />
          </div>

          <div className="a-row">
            <div>
              <b>Notificaciones</b>
              <div className="a-muted">Recordatorios y avisos</div>
            </div>
            <input
              className="toggle"
              type="checkbox"
              checked={notif}
              onChange={(e) => setNotif(e.target.checked)}
              disabled={loading || saving}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button className="btn solid" onClick={guardar} disabled={loading || saving}>
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
