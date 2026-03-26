// src/Perfil.jsx
import React, { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../Api";

const CSS = `
.p-wrap{
  min-height: calc(100dvh - 56px);
  background:#0b0b0b; color:#eaeaea;
  padding:16px 16px 28px;
}
.p-inner{ max-width: 1020px; margin:0 auto; display:grid; gap:14px; }

.p-head{
  display:flex; align-items:flex-end; justify-content:space-between; gap:12px;
}
.p-title{ font-size:22px; font-weight:1000; margin:0; letter-spacing:-.2px; }
.p-sub{ margin:4px 0 0; color:#bdbdbd; }

.p-badges{ display:flex; gap:10px; flex-wrap:wrap; justify-content:flex-end; }
.badge{
  display:inline-flex; align-items:center; gap:8px;
  padding:8px 10px; border-radius:999px;
  border:1px solid #2b2b2b; background:#0f0f0f;
  color:#dcdcdc; font-size:12px; font-weight:900;
}
.badge.warn{ border-color:#6b3c00; background:#281a00; color:#ffd9a1; }
.badge.ok{ border-color:#0f4d2d; background:#062214; color:#bff7d0; }
.badge.gold{
  border-color: rgba(245,215,110,.35);
  background: linear-gradient(180deg, rgba(245,215,110,.10), rgba(0,0,0,.08));
  color:#ffe9a6;
}

.p-grid{
  display:grid;
  grid-template-columns: 1fr;
  gap:12px;
}
@media (min-width: 920px){
  .p-grid{ grid-template-columns: 1.1fr .9fr; }
}

.card{
  border:1px solid #232323;
  background: radial-gradient(1200px 500px at 20% 0%, rgba(245,215,110,.08), transparent 55%),
              linear-gradient(180deg,#141414,#0f0f0f);
  border-radius:18px;
  padding:14px;
  box-shadow:0 16px 48px rgba(0,0,0,.35);
}

.card h2{
  margin:0 0 10px;
  font-size:14px; font-weight:1000;
  color:#f5d98a; letter-spacing:.2px;
}

.row{
  display:flex; align-items:center; justify-content:space-between;
  gap:12px; flex-wrap:wrap;
}

.p-profileRow{
  display:grid;
  grid-template-columns: 110px 1fr;
  gap:14px;
  align-items:center;
}
@media (max-width: 520px){
  .p-profileRow{ grid-template-columns: 1fr; }
}

.avatar{
  width:96px; height:96px;
  border-radius:22px;
  border:1px solid rgba(245,215,110,.20);
  background:
    radial-gradient(70px 70px at 30% 20%, rgba(245,215,110,.22), transparent 60%),
    linear-gradient(180deg,#111,#0b0b0b);
  display:flex; align-items:center; justify-content:center;
  font-size:34px; font-weight:1000;
  color:#ffe9a6;
  box-shadow: 0 18px 60px rgba(0,0,0,.45);
}
.avatarSmall{
  width:34px; height:34px; border-radius:12px;
  border:1px solid #2b2b2b; background:#0f0f0f;
  display:grid; place-items:center; font-weight:1000;
  color:#f5d98a;
}

.meta{
  display:grid; gap:8px;
}
.metaLine{
  display:flex; align-items:center; gap:10px; flex-wrap:wrap;
}
.kv{
  display:grid; gap:2px;
}
.kv .k{ font-size:11px; color:#bdbdbd; font-weight:900; letter-spacing:.2px; }
.kv .v{ font-size:14px; font-weight:1000; color:#eaeaea; }

.hr{
  height:1px; background:#1b1b1b; margin:14px 0;
}

.form{
  display:grid; gap:10px;
}
.formGrid{
  display:grid; grid-template-columns: 1fr;
  gap:10px;
}
@media (min-width: 720px){
  .formGrid{ grid-template-columns: 1fr 1fr; }
}

.field{ display:grid; gap:6px; }
.field label{
  font-size:11px; color:#bdbdbd;
  font-weight:900; letter-spacing:.2px;
}
.input{
  width:100%;
  padding:12px 12px;
  border-radius:14px;
  border:1px solid #2b2b2b;
  background:#0b0b0b;
  color:#fff;
  outline:none;
}
.input:focus{
  border-color: rgba(245,215,110,.65);
  box-shadow:0 0 0 3px rgba(245,215,110,.12);
}
.input:disabled{
  opacity:.65;
}

.actions{
  display:flex; gap:10px; flex-wrap:wrap;
  margin-top: 8px;
}
.btn{
  border:none; border-radius:14px;
  padding:10px 12px;
  font-weight:1000;
  cursor:pointer;
}
.btn.solid{
  background: linear-gradient(135deg, #facc15, #f5d76e);
  color:#0a0a0a;
}
.btn.ghost{
  background:#0f0f0f; color:#eaeaea;
  border:1px solid #2b2b2b;
}
.btn.danger{
  background: transparent;
  border: 1px solid rgba(255,120,90,.35);
  color: #ffd0c6;
}
.btn:disabled{ opacity:.55; cursor:not-allowed; }

.tip{
  margin: 0;
  color:#bdbdbd;
  font-size:12px;
  line-height:1.45;
}
`;

function initialsOf(nombre, apellido, fallbackEmail) {
  const n = String(nombre || "").trim();
  const a = String(apellido || "").trim();
  if (n || a) {
    return `${n ? n[0].toUpperCase() : ""}${a ? a[0].toUpperCase() : ""}`.slice(0, 2) || "Z";
  }
  const e = String(fallbackEmail || "").trim();
  return e ? e[0].toUpperCase() : "Z";
}

export default function Perfil() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const [msg, setMsg] = useState(null);

  // datos “server”
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [plan, setPlan] = useState("");
  const [estado, setEstado] = useState("");

  // editable profile
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [ciudad, setCiudad] = useState("");

  // físico (solo lectura, desde onboarding/basics)
  const [alturaCm, setAlturaCm] = useState("");
  const [pesoKg, setPesoKg] = useState("");
  const [grasaPct, setGrasaPct] = useState("");

  // snapshot para cancelar
  const snapshot = useMemo(
    () => ({ nombre, apellido, telefono, ciudad }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editing] // se recalcula cuando entrás a editar (ver useEffect abajo)
  );

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        setLoading(true);
        setMsg(null);

        const data = await apiFetch("/api/usuarios/users/me");
        if (!mounted) return;

        setEmail(data?.email || "");
        setRole(data?.role || "");
        setPlan(data?.plan || "");
        setEstado(data?.estado || "");

        setNombre(data?.profile?.nombre || "");
        setApellido(data?.profile?.apellido || "");
        setTelefono(data?.profile?.telefono || "");
        setCiudad(data?.profile?.ciudad || "");

        // intentar mapear físico desde tus estructuras actuales
        const a = data?.antropometriaActual?.alturaCm ?? data?.profile?.basics?.alturaCm ?? data?.profile?.basics?.altura ?? "";
        const p = data?.antropometriaActual?.pesoKg ?? data?.profile?.basics?.pesoKg ?? data?.profile?.basics?.peso ?? "";
        const g = data?.antropometriaActual?.grasaPct ?? data?.profile?.basics?.grasaPct ?? "";

        setAlturaCm(a ? String(a) : "");
        setPesoKg(p ? String(p) : "");
        setGrasaPct(g === 0 ? "0" : (g ? String(g) : ""));
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

  // al entrar en modo edición, guardamos snapshot (para “Cancelar”)
  const [snap, setSnap] = useState(null);
  useEffect(() => {
    if (editing) {
      setSnap({ nombre, apellido, telefono, ciudad });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  function cancelarEdicion() {
    if (snap) {
      setNombre(snap.nombre);
      setApellido(snap.apellido);
      setTelefono(snap.telefono);
      setCiudad(snap.ciudad);
    }
    setEditing(false);
    setMsg(null);
  }

  async function guardar() {
    try {
      setSaving(true);
      setMsg(null);

      // mandamos solo lo que editás
      const payload = {
        profile: {
          nombre: String(nombre || "").trim(),
          apellido: String(apellido || "").trim(),
          telefono: String(telefono || "").trim(),
          ciudad: String(ciudad || "").trim(),
        },
      };

      const res = await apiFetch("/api/usuarios/users/me", {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const u = res?.user || res;

      setNombre(u?.profile?.nombre ?? payload.profile.nombre);
      setApellido(u?.profile?.apellido ?? payload.profile.apellido);
      setTelefono(u?.profile?.telefono ?? payload.profile.telefono);
      setCiudad(u?.profile?.ciudad ?? payload.profile.ciudad);

      setEditing(false);
      setMsg({ type: "ok", text: "Perfil actualizado ✅" });
    } catch (e) {
      setMsg({ type: "warn", text: e?.message || "No pude guardar" });
    } finally {
      setSaving(false);
    }
  }

  const avatarText = initialsOf(nombre, apellido, email);

  return (
    <div className="p-wrap">
      <style>{CSS}</style>

      <div className="p-inner">
        <div className="p-head">
          <div>
            <h1 className="p-title">👤 Perfil</h1>
            <p className="p-sub">Tu cuenta, tus datos y lo que usaremos para personalizar tu plan.</p>
          </div>

          <div className="p-badges">
            {msg && <div className={`badge ${msg.type}`}>{msg.text}</div>}
            {plan ? <div className="badge gold">⭐ Plan: {plan}</div> : null}
            {estado ? <div className="badge">🟢 {estado}</div> : null}
          </div>
        </div>

        <div className="p-grid">
          {/* Col izquierda */}
          <div className="card">
            <h2>Cuenta</h2>

            <div className="p-profileRow">
              <div className="avatar" aria-label="Avatar">
                {loading ? "…" : avatarText}
              </div>

              <div className="meta">
                <div className="metaLine">
                  <div className="badge">✉️ {loading ? "Cargando…" : email || "—"}</div>
                  <div className="badge">🔒 Rol: {loading ? "…" : role || "cliente"}</div>
                </div>

                <div className="row" style={{ marginTop: 6 }}>
                  <div className="kv">
                    <div className="k">Nombre completo</div>
                    <div className="v">
                      {loading ? "…" : (nombre || apellido ? `${nombre} ${apellido}`.trim() : "—")}
                    </div>
                  </div>
                  <div className="kv">
                    <div className="k">Estado</div>
                    <div className="v">{loading ? "…" : estado || "—"}</div>
                  </div>
                </div>

                <p className="tip" style={{ marginTop: 6 }}>
                  Estos datos se usan para tu experiencia y para tu coach/admin (si aplica).
                </p>
              </div>
            </div>

            <div className="hr" />

            <h2>Físico (del onboarding)</h2>
            <div className="row">
              <div className="kv">
                <div className="k">Altura</div>
                <div className="v">{alturaCm ? `${alturaCm} cm` : "—"}</div>
              </div>
              <div className="kv">
                <div className="k">Peso</div>
                <div className="v">{pesoKg ? `${pesoKg} kg` : "—"}</div>
              </div>
              <div className="kv">
                <div className="k">% graso</div>
                <div className="v">{grasaPct ? `${grasaPct}%` : "—"}</div>
              </div>
            </div>

            <p className="tip" style={{ marginTop: 10 }}>
              (Por ahora) esto se edita desde el onboarding. Después, si querés, lo hacemos editable acá con validaciones.
            </p>
          </div>

          {/* Col derecha */}
          <div className="card">
            <h2>Datos personales</h2>

            <div className="form">
              <div className="formGrid">
                <div className="field">
                  <label>Nombre</label>
                  <input
                    className="input"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    disabled={loading || saving || !editing}
                    placeholder="Ej: Claudio"
                  />
                </div>

                <div className="field">
                  <label>Apellido</label>
                  <input
                    className="input"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    disabled={loading || saving || !editing}
                    placeholder="Ej: Zumárraga"
                  />
                </div>

                <div className="field">
                  <label>Teléfono</label>
                  <input
                    className="input"
                    value={telefono}
                    onChange={(e) => setTelefono(e.target.value)}
                    disabled={loading || saving || !editing}
                    placeholder="Ej: +54 11 1234-5678"
                  />
                </div>

                <div className="field">
                  <label>Ciudad</label>
                  <input
                    className="input"
                    value={ciudad}
                    onChange={(e) => setCiudad(e.target.value)}
                    disabled={loading || saving || !editing}
                    placeholder="Ej: Buenos Aires"
                  />
                </div>
              </div>

              <div className="actions">
                {!editing ? (
                  <button
                    className="btn solid"
                    onClick={() => {
                      setMsg(null);
                      setEditing(true);
                    }}
                    disabled={loading || saving}
                  >
                    ✏️ Editar
                  </button>
                ) : (
                  <>
                    <button className="btn solid" onClick={guardar} disabled={loading || saving}>
                      {saving ? "Guardando…" : "Guardar cambios"}
                    </button>
                    <button className="btn ghost" onClick={cancelarEdicion} disabled={saving}>
                      Cancelar
                    </button>
                  </>
                )}

                <button
                  className="btn ghost"
                  onClick={() => setMsg(null)}
                  disabled={saving}
                  title="Oculta el mensaje de estado"
                >
                  Limpiar mensaje
                </button>
              </div>

              <p className="tip">
                Tip: si querés que el usuario edite también altura/peso/%grasa desde acá, lo hacemos con un modal + validación,
                sin tocar tu onboarding.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
