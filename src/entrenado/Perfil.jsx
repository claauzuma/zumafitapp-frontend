// src/Perfil.jsx
import React, { useEffect, useState } from "react";
import { apiFetch } from "../Api";

const CSS = `
.p-wrap{ min-height: calc(100dvh - 56px); background:#0b0b0b; color:#eaeaea; padding:14px 16px 28px; }
.p-inner{ max-width: 1000px; margin:0 auto; display:grid; gap:12px; }
.p-title{ font-size:22px; font-weight:900; margin:0; }
.p-sub{ margin:0; color:#bdbdbd; }
.p-card{ border:1px solid #232323; background: linear-gradient(180deg,#141414,#0f0f0f); border-radius:16px; padding:14px; box-shadow:0 16px 48px rgba(0,0,0,.35); }
.p-row{ display:grid; grid-template-columns: 120px 1fr; gap:12px; align-items:center; }
.p-avatar{
  width:96px; height:96px; border-radius:18px;
  border:1px solid #2b2b2b; background:#0f0f0f;
  display:flex; align-items:center; justify-content:center;
  font-size:34px;
}
.p-grid{ display:grid; grid-template-columns: 1fr; gap:10px; }
.p-field{ display:grid; gap:6px; }
.p-field label{ font-size:12px; color:#bdbdbd; font-weight:800; }
.p-field input{
  width:100%; padding:12px 12px; border-radius:12px;
  border:1px solid #2b2b2b; background:#0f0f0f; color:#fff;
  outline:none;
}
.p-field input:focus{ border-color:#f5d76e; box-shadow:0 0 0 3px rgba(245,215,110,.12); }
.p-actions{ display:flex; gap:10px; flex-wrap:wrap; margin-top:8px; }
.btn{ border:none; border-radius:12px; padding:10px 12px; font-weight:900; cursor:pointer; }
.btn.solid{ background: linear-gradient(135deg, #facc15, #f5d76e); color:#0a0a0a; }
.btn.ghost{ background:#0f0f0f; color:#eaeaea; border:1px solid #2b2b2b; }
.badge{ display:inline-flex; align-items:center; gap:8px; padding:8px 10px; border-radius:999px; border:1px solid #2b2b2b; background:#0f0f0f; color:#dcdcdc; font-size:12px; font-weight:900; }
.warn{ border-color:#6b3c00; background:#281a00; color:#ffd9a1; }
.ok{ border-color:#0f4d2d; background:#062214; color:#bff7d0; }
@media (min-width: 860px){ .p-grid{ grid-template-columns: 1fr 1fr; } }
`;

export default function Perfil() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");

  const [msg, setMsg] = useState(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setMsg(null);

        // tu backend tiene users/me (perfil) y auth/me (sesión)
        const data = await apiFetch("/api/usuarios/users/me");
        if (!mounted) return;

        setEmail(data?.email || "");
        setRole(data?.role || "");
        setNombre(data?.profile?.nombre || "");
        setApellido(data?.profile?.apellido || "");
      } catch (e) {
        if (mounted) setMsg({ type: "warn", text: e?.message || "No pude cargar el perfil" });
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  async function guardar() {
    try {
      setSaving(true);
      setMsg(null);

      const data = await apiFetch("/api/usuarios/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          profile: { nombre, apellido },
        }),
      });

      // refresco por si el back normaliza algo
      setNombre(data?.user?.profile?.nombre || nombre);
      setApellido(data?.user?.profile?.apellido || apellido);

      setMsg({ type: "ok", text: "Perfil actualizado ✅" });
    } catch (e) {
      setMsg({ type: "warn", text: e?.message || "No pude guardar" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-wrap">
      <style>{CSS}</style>

      <div className="p-inner">
        <div>
          <h1 className="p-title">👤 Perfil</h1>
          <p className="p-sub">Tu información básica de cuenta.</p>
        </div>

        {msg && <div className={`badge ${msg.type}`}>{msg.text}</div>}

        <div className="p-card">
          <div className="p-row">
            <div className="p-avatar">🍏</div>

            <div style={{ display: "grid", gap: 8 }}>
              <div className="badge">✉️ {loading ? "Cargando…" : email || "—"}</div>
              <div className="badge">🔒 Rol: {loading ? "…" : role || "cliente"}</div>
            </div>
          </div>

          <div style={{ height: 12 }} />

          <div className="p-grid">
            <div className="p-field">
              <label>Nombre</label>
              <input
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                disabled={loading || saving}
                placeholder="Ej: Claudio"
              />
            </div>

            <div className="p-field">
              <label>Apellido</label>
              <input
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                disabled={loading || saving}
                placeholder="Ej: Zumárraga"
              />
            </div>
          </div>

          <div className="p-actions">
            <button className="btn solid" onClick={guardar} disabled={loading || saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
            <button
              className="btn ghost"
              onClick={() => {
                setMsg(null);
              }}
              disabled={saving}
            >
              Limpiar mensaje
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
