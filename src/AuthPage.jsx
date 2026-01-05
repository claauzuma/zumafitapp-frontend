// src/AuthPage.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetch } from "./Api.js"; // ✅ ojo: api.js en minúscula

export default function AuthPage({ defaultMode = "login" }) {
  const navigate = useNavigate();

  const [mode, setMode] = useState(defaultMode === "register" ? "register" : "login");
  const [name, setName] = useState("");
  const [apellido, setApellido] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [peek, setPeek] = useState(false);
  const [remember, setRemember] = useState(true); // UI only por ahora
  const [tos, setTos] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    try {
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
        console.warn("[AuthPage] Hay overflow horizontal, revisá paddings/margins.");
      }
    } catch {}
  }, []);

  // Si cambiás de tab (login/register), limpio mensajes
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [mode]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validaciones
    if (mode === "register" && name.trim().length < 2) return setError("Ingresá tu nombre (2+ caracteres)");
    if (mode === "register" && apellido.trim().length < 2) return setError("Ingresá tu apellido (2+ caracteres)");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Email inválido");
    if (password.length < 6) return setError("La contraseña debe tener 6+ caracteres");
    if (mode === "register" && !tos) return setError("Aceptá los Términos para continuar");

    setLoading(true);

    try {
      if (mode === "login") {
        // ✅ Login
        await apiFetch("/api/usuarios/auth/login", {
          method: "POST",
          body: JSON.stringify({ email, password, remember }),
        });

        // ✅ Login OK -> directo al menú (MenuEj)
        navigate("/app/inicio", { replace: true });
        return;
      }

      // ✅ Register
      await apiFetch("/api/usuarios/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          nombre: name,
          apellido,
        }),
      });

      // Register OK -> vuelvo a login
      setMode("login");
      setPassword("");
      setSuccess("Cuenta creada ✅ Ahora iniciá sesión");
    } catch (err) {
      // ✅ backend manda { error: "Credenciales incorrectas" } o similar
      setError(err?.message || "Ocurrió un error");
    } finally {
      setLoading(false);
    }
  }

  const goHome = () => navigate("/");

  return (
    <div className="auth-page">
      <style>{AUTH_CSS}</style>

      <header className="ap-nav">
        <div className="ap-nav-inner">
          <button className="ap-brand" onClick={goHome} type="button">
            🍏 <span>ZumaFit</span>
          </button>

          <nav className="ap-nav-links">
            <button className="ap-link" onClick={goHome} type="button">
              Inicio
            </button>
          </nav>
        </div>
      </header>

      <div className="ap-tabs-wrap">
        <div className="ap-tabs" role="tablist" aria-label="Tipo de acceso">
          <button
            role="tab"
            aria-selected={mode === "login"}
            className={`ap-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => setMode("login")}
            type="button"
            disabled={loading}
          >
            Iniciar sesión
          </button>
          <button
            role="tab"
            aria-selected={mode === "register"}
            className={`ap-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => setMode("register")}
            type="button"
            disabled={loading}
          >
            Crear cuenta
          </button>
        </div>
      </div>

      <main className="ap-main">
        <section className="ap-card" aria-labelledby="auth-title">
          <h1 id="auth-title" className="ap-title">
            {mode === "login" ? "Bienvenido de nuevo" : "Empezá gratis"}
          </h1>
          <p className="ap-sub">
            {mode === "login" ? "Ingresá con tu email." : "Registrate con tu email."}
          </p>

          <div className="ap-divider">
            <span>con email</span>
          </div>

          <form className="ap-form" onSubmit={handleSubmit} noValidate>
            {mode === "register" && (
              <>
                <label className="ap-field">
                  <span>Nombre</span>
                  <input
                    type="text"
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    disabled={loading}
                  />
                </label>

                <label className="ap-field">
                  <span>Apellido</span>
                  <input
                    type="text"
                    autoComplete="family-name"
                    value={apellido}
                    onChange={(e) => setApellido(e.target.value)}
                    required
                    disabled={loading}
                  />
                </label>
              </>
            )}

            <label className="ap-field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </label>

            <label className="ap-field ap-field-pass">
              <span>Contraseña</span>
              <input
                type={peek ? "text" : "password"}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                disabled={loading}
              />
              <button
                type="button"
                className="ap-peek"
                aria-label={peek ? "Ocultar contraseña" : "Ver contraseña"}
                onClick={() => setPeek((v) => !v)}
                disabled={loading}
              >
                {peek ? "Ocultar" : "Ver"}
              </button>
            </label>

            {mode === "login" ? (
              <div className="ap-row-between">
                <label className="ap-check">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    disabled={loading}
                  />
                  <span>Recordarme</span>
                </label>
                <button className="ap-link-btn" type="button" disabled>
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
            ) : (
              <label className="ap-check">
                <input
                  type="checkbox"
                  checked={tos}
                  onChange={(e) => setTos(e.target.checked)}
                  required
                  disabled={loading}
                />
                <span>
                  Acepto los <span className="ap-link" style={{ cursor: "default", textDecoration: "underline" }}>
                    Términos y Condiciones
                  </span>
                </span>
              </label>
            )}

            {success && <div className="ap-success" role="status">{success}</div>}
            {error && <div className="ap-error" role="alert">{error}</div>}

            <button className="btn submit" type="submit" disabled={loading}>
              {loading ? "Procesando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
            </button>

            {mode === "login" ? (
              <p className="ap-muted ap-small">
                ¿No tenés cuenta?{" "}
                <button type="button" className="ap-link-btn" onClick={() => setMode("register")} disabled={loading}>
                  Registrate
                </button>
              </p>
            ) : (
              <p className="ap-muted ap-small">
                ¿Ya tenés cuenta?{" "}
                <button type="button" className="ap-link-btn" onClick={() => setMode("login")} disabled={loading}>
                  Iniciá sesión
                </button>
              </p>
            )}
          </form>
        </section>
      </main>

      <footer className="ap-foot">
        <p className="ap-muted">© {new Date().getFullYear()} ZumaFit • Privacidad • Términos</p>
      </footer>
    </div>
  );
}

const AUTH_CSS = `
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background: var(--bg); color: var(--fg); }

.auth-page{ min-height:100dvh; background:var(--bg); color:var(--fg); display:flex; flex-direction:column; }

.ap-nav{ position:sticky; top:0; z-index:40; border-bottom:1px solid #1b1b1b; background:linear-gradient(180deg,#0b0b0b,#0b0b0bcc); backdrop-filter:saturate(140%) blur(3px); }
.ap-nav-inner{ max-width:1000px; margin:0 auto; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.ap-brand{ display:flex; align-items:center; gap:8px; text-decoration:none; color:#f5d98a; font-weight:900; letter-spacing:.2px; background:transparent; border:none; cursor:pointer; padding:0; }
.ap-brand span{ color:#f5d98a; }
.ap-nav-links .ap-link{ background:#0f0f0f; color:#eaeaea; border:1px solid #2b2b2b; border-radius:12px; padding:8px 12px; cursor:pointer; }

.ap-tabs-wrap{ padding:10px 16px 0; }
.ap-tabs{ max-width:1000px; margin:0 auto; display:flex; gap:8px; background:#0f0f0f; border:1px solid #2b2b2b; border-radius:14px; padding:6px; }
.ap-tab{ border:none; background:transparent; color:#ddd; padding:10px 14px; border-radius:12px; font-weight:800; cursor:pointer; }
.ap-tab.active{ background: linear-gradient(135deg, #f5d98a, #ffe89d); color:#0a0a0a; }
.ap-tab:disabled{ opacity:.6; cursor:not-allowed; }

.ap-main{ padding:14px 16px 24px; }
.ap-card{ max-width:720px; margin:0 auto; border:1px solid #232323; background:var(--card); border-radius:16px; padding:16px; }
.ap-title{ margin:0 0 6px; font-size:28px; }
.ap-sub{ margin:0 0 12px; color:#cfcfcf; }

.ap-divider{ display:flex; align-items:center; gap:8px; color:#a7a7a7; font-size:12px; margin:12px 0; }
.ap-divider::before, .ap-divider::after{ content:""; flex:1; height:1px; background:#2b2b2b; }

.ap-form{ display:grid; gap:12px; }
.ap-field{ display:grid; gap:6px; }
.ap-field input{
  width:100%;
  background:#0f0f0f;
  color:#fff;
  border:1px solid #2b2b2b;
  border-radius:12px;
  padding:12px 14px;
  outline:none;
}
.ap-field input:focus{ border-color:#f5d98a; box-shadow:0 0 0 3px rgba(245,217,138,.12); }
.ap-field input:disabled{ opacity:.7; }

.ap-field-pass{ position:relative; }
.ap-field-pass input{ padding-right:82px; }
.ap-peek{
  position:absolute; right:8px; top:50%; transform:translateY(-50%);
  border:1px solid #2b2b2b; background:#161616; color:#eaeaea;
  border-radius:10px; padding:8px 10px; font-weight:800; cursor:pointer;
}
.ap-peek:disabled{ opacity:.6; cursor:not-allowed; }

.ap-row-between{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
.ap-check{ display:flex; align-items:center; gap:8px; color:#dcdcdc; }
.ap-link, .ap-link-btn{ color:#d9c374; text-decoration:underline; background:transparent; border:none; cursor:pointer; }
.ap-link-btn:disabled{ opacity:.6; cursor:not-allowed; text-decoration:none; }

.ap-error{ border:1px solid #6b3c00; background:#281a00; color:#ffd9a1; padding:10px 12px; border-radius:12px; }
.ap-success{ border:1px solid #0f4d2d; background:#062214; color:#bff7d0; padding:10px 12px; border-radius:12px; }

.btn.submit{
  width:100%;
  background: linear-gradient(135deg, #f5d98a, #ffe89d);
  color:#0a0a0a; border:none; border-radius:12px; padding:12px 14px; font-weight:900;
  cursor:pointer;
}
.btn.submit:disabled{ opacity:.7; cursor:not-allowed; }

.ap-muted{ color:#b8b8b8; }
.ap-small{ font-size:12px; }

.ap-foot{ border-top:1px solid #1e1e1e; padding:16px; text-align:center; }
`;
