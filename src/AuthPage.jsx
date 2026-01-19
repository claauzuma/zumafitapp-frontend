// src/AuthPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { apiFetch } from "./Api.js";
import { API_BASE } from "./apiCredentials";
// antes: import { setAuthLogged } from "./PublicOnlyRoute.jsx";
import { setAuthLogged, clearAuthCache } from "./authCache.js";

// ✅ Si tu AuthPage está en otra ruta (ej "/"), cambiá esto.
// Importante para Google: volver acá para que corra /me y redirija por rol.
const AUTH_RETURN_PATH = "/auth";

function joinUrl(base, path) {
  const b = (base || "").replace(/\/+$/, "");
  const p = (path || "").replace(/^\/+/, "");
  return `${b}/${p}`;
}

function readQueryParam(name) {
  try {
    const u = new URL(window.location.href);
    return u.searchParams.get(name);
  } catch {
    return null;
  }
}

function removeQueryParams(paramsToRemove = []) {
  try {
    const u = new URL(window.location.href);
    paramsToRemove.forEach((p) => u.searchParams.delete(p));
    window.history.replaceState({}, "", u.pathname + (u.search ? u.search : "") + u.hash);
  } catch {}
}

export default function AuthPage({ defaultMode = "login" }) {
  const navigate = useNavigate();
  const location = useLocation();

  // debug id por “sesión” de página (así agrupás logs)
  const debugIdRef = useRef(Math.random().toString(16).slice(2));

  const [mode, setMode] = useState(defaultMode === "register" ? "register" : "login");

  const [name, setName] = useState("");
  const [apellido, setApellido] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [peek, setPeek] = useState(false);
  const [remember, setRemember] = useState(true);
  const [tos, setTos] = useState(false);

  // ✅ Verificación por código
  const [step, setStep] = useState("form"); // "form" | "verify" | "forgot" | "reset"
  const [verifyCode, setVerifyCode] = useState("");

  // ✅ Forgot password states
  const [fpEmail, setFpEmail] = useState("");
  const [fpCode, setFpCode] = useState("");
  const [fpNewPass, setFpNewPass] = useState("");
  const [fpNewPass2, setFpNewPass2] = useState("");

  const MAX_ATTEMPTS = 3;
  const [attemptsLeft, setAttemptsLeft] = useState(MAX_ATTEMPTS);

  const [resendLoading, setResendLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const [verifiedBanner, setVerifiedBanner] = useState(false);

  // overlay grande para requests internos
  const [loading, setLoading] = useState(false);

  // ✅ loader chiquito SOLO para click en Google (no overlay)
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // ✅ Para que al cambiar de modo NO te borre el success cuando lo hacemos programáticamente
  const skipClearOnModeChangeRef = useRef(false);

  const isVerifyLocked = useMemo(() => attemptsLeft <= 0, [attemptsLeft]);

  // ---- logs de montaje / navegación ----
  useEffect(() => {
    console.log(`🧩 [AuthPage ${debugIdRef.current}] mount`, {
      API_BASE,
      href: window.location.href,
      pathname: location.pathname,
      search: location.search,
      key: location.key,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(`🧭 [AuthPage ${debugIdRef.current}] route change`, {
      pathname: location.pathname,
      search: location.search,
      key: location.key,
      step,
      mode,
    });
  }, [location.pathname, location.search, location.key, step, mode]);

  useEffect(() => {
    try {
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth + 1) {
        console.warn("[AuthPage] Hay overflow horizontal, revisá paddings/margins.");
      }
    } catch {}
  }, []);

  useEffect(() => {
    setError(null);
    if (skipClearOnModeChangeRef.current) {
      skipClearOnModeChangeRef.current = false;
      return;
    }
    setSuccess(null);
  }, [mode]);

  useEffect(() => {
    setStep("form");
    setVerifyCode("");
    setCooldown(0);
    setAttemptsLeft(MAX_ATTEMPTS);
    setVerifiedBanner(false);

    // forgot password state reset
    setFpEmail("");
    setFpCode("");
    setFpNewPass("");
    setFpNewPass2("");

    // también frenamos loader google si cambias de modo
    setGoogleLoading(false);
  }, [mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // ✅ 1) Manejo de retorno OAuth por query (opcional):
  useEffect(() => {
    const oauthError = readQueryParam("error");
    const oauthToken = readQueryParam("token");
    const oauthFlag = readQueryParam("oauth"); // solo debug

    if (oauthFlag) console.log(`🟣 [OAuth ${debugIdRef.current}] flag oauth=`, oauthFlag);

    if (oauthError) {
      console.log(`🔴 [OAuth ${debugIdRef.current}] error query:`, oauthError);
      setError(decodeURIComponent(oauthError));
      removeQueryParams(["error", "token"]);
      return;
    }

    if (oauthToken) {
      console.log(`🟡 [OAuth ${debugIdRef.current}] token por query (guardando en localStorage)`);
      try {
        localStorage.setItem("access_token", oauthToken);
      } catch {}
      removeQueryParams(["token", "error"]);
    }
  }, [location.key]);

  // ✅ 2) Auto-login: si ya hay cookie/sesión (o volvimos de Google y backend seteó cookie)
  useEffect(() => {
    if (step !== "form") return;

    let cancelled = false;

    (async () => {
      try {
        console.log(`🟡 [AuthPage ${debugIdRef.current}] probando /api/usuarios/auth/me ...`, {
          step,
          mode,
          href: window.location.href,
        });

        const me = await apiFetch("/api/usuarios/auth/me");
        if (cancelled) return;

        // ✅ Normalizamos el "user" (depende de cómo responda tu backend)
        const user = me?.user || me;
        const role = String(user?.role || user?.rol || "").toLowerCase();

        console.log(`🟢 [AuthPage ${debugIdRef.current}] /me OK`, { user, role });

        // ✅ Guarda status + role (y user si lo guardás en authCache)
        setAuthLogged(user);

        // ✅ Navega según rol
        if (role === "admin") {
          console.log(`🟢 [AuthPage ${debugIdRef.current}] navigate -> /admin/inicio`);
          navigate("/admin/inicio", { replace: true });
        } else {
          console.log(`🟢 [AuthPage ${debugIdRef.current}] navigate -> /app/inicio`);
          navigate("/app/inicio", { replace: true });
        }
      } catch (err) {
        console.log(`🔴 [AuthPage ${debugIdRef.current}] /me FAIL`, {
          status: err?.status,
          message: err?.message,
          err,
        });

        // ✅ evita quedarse con cache viejo (p.ej. "logged" de una sesión anterior)
        clearAuthCache();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, step, mode, location.key]);

  function goHome() {
    navigate("/");
  }

  // ✅ Google: feedback inmediato, sin overlay, y sin borrar el form
  function loginWithGoogle() {
    if (googleLoading || loading) return;

    // ✅ opcional pero recomendado: limpiás cache para que no “rebote”
    clearAuthCache();

    setGoogleLoading(true);

    // dejamos que pinte el estado (spinner / glow) antes de navegar
    requestAnimationFrame(() => {
      // ✅ IMPORTANTE: volver a AuthPage (o ruta que ejecute /me) para redirigir por rol
      const returnTo = encodeURIComponent(window.location.origin + AUTH_RETURN_PATH);
      const url = joinUrl(API_BASE, `/api/usuarios/auth/google?returnTo=${returnTo}`);

      console.log("[AuthPage] loginWithGoogle", {
        API_BASE,
        returnToDecoded: decodeURIComponent(returnTo),
        url,
      });

      window.location.assign(url);
    });

    // “seguro” si el navegador tarda/bloquea
    setTimeout(() => setGoogleLoading(false), 8000);
  }

  function resetVerifyState() {
    setVerifyCode("");
    setAttemptsLeft(MAX_ATTEMPTS);
    setVerifiedBanner(false);
    setCooldown(0);
    setError(null);
    setSuccess(null);
  }

  const isEmailValid = (mail) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(mail || "").trim());

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);

    if (mode === "register") {
      if (name.trim().length < 2) return setError("Ingresá tu nombre (2+ caracteres)");
      if (apellido.trim().length < 2) return setError("Ingresá tu apellido (2+ caracteres)");
      if (!birthDate) return setError("Ingresá tu fecha de nacimiento");
      if (!tos) return setError("Aceptá los Términos para continuar");
    }

    if (!isEmailValid(email)) return setError("Email inválido");
    if (password.length < 6) return setError("La contraseña debe tener 6+ caracteres");

    setLoading(true);

    try {
      if (mode === "login") {
        try {
          console.log(`🟡 [AuthPage ${debugIdRef.current}] POST /auth/login`, { email, remember });

          await apiFetch("/api/usuarios/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password, remember }),
          });

          // ✅ Traemos el user/rol (login normalmente solo setea cookie)
          const me = await apiFetch("/api/usuarios/auth/me");
          const user = me?.user || me;
          const role = String(user?.role || user?.rol || "").toLowerCase();

          console.log(`🟢 [AuthPage ${debugIdRef.current}] login OK ->`, { role, user });

          // ✅ Guarda logged + role en cache
          setAuthLogged(user);

          // ✅ Navega según rol
          if (role === "admin") {
            navigate("/admin/inicio", { replace: true });
          } else {
            navigate("/app/inicio", { replace: true });
          }
          return;
        } catch (err) {
          console.log(`🔴 [AuthPage ${debugIdRef.current}] login FAIL`, {
            status: err?.status,
            message: err?.message,
            pending: err?.pending,
            err,
          });

          const pending =
            err?.pending === true ||
            String(err?.message || "").toLowerCase().includes("verificación pendiente") ||
            String(err?.message || "").toLowerCase().includes("verificacion pendiente");

          if (pending) {
            setStep("verify");
            setVerifyCode("");
            setAttemptsLeft(MAX_ATTEMPTS);
            setCooldown(0);
            setPassword("");
            setPeek(false);
            setError(null);
            setSuccess("Tenés una verificación pendiente. Ingresá el código o reenviá uno nuevo ✅");
            return;
          }

          setError(err?.message || "Email o contraseña incorrectos");
          return;
        }
      }

      console.log(`🟡 [AuthPage ${debugIdRef.current}] POST /auth/register`, { email });

      await apiFetch("/api/usuarios/auth/register", {
        method: "POST",
        body: JSON.stringify({
          email,
          password,
          nombre: name,
          apellido,
          fechaNacimiento: birthDate,
          requireEmailVerification: true,
        }),
        timeoutMs: 60000, // ✅ 60s para que no se aborte mientras manda el mail
      });

      setStep("verify");
      setVerifyCode("");
      setPassword("");
      setPeek(false);
      setAttemptsLeft(MAX_ATTEMPTS);

      setCooldown(60);
      setVerifiedBanner(false);

      setSuccess("Te enviamos un código de 6 dígitos por email. Ingresalo para verificar tu cuenta ✅");
    } catch (err) {
      console.log(`🔴 [AuthPage ${debugIdRef.current}] register FAIL`, {
        status: err?.status,
        message: err?.message,
        pending: err?.pending,
        err,
      });

      const msg = String(err?.message || "");
      if (
        msg.toLowerCase().includes("verificación pendiente") ||
        msg.toLowerCase().includes("verificacion pendiente") ||
        msg.toLowerCase().includes("ya hay una verificación pendiente") ||
        err?.pending === true
      ) {
        setStep("verify");
        setCooldown(0);
        setAttemptsLeft(MAX_ATTEMPTS);
        setSuccess("Ya tenés una verificación pendiente. Ingresá el código o reenviá uno nuevo ✅");
      } else {
        setError(err?.message || "Ocurrió un error");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);

    const code = String(verifyCode || "").trim();
    if (!email) return setError("Ingresá el email con el que te registraste");
    if (!/^\d{6}$/.test(code)) return setError("Ingresá el código de 6 dígitos");

    if (isVerifyLocked) {
      setError("Alcanzaste el máximo de intentos. Reenviá el código para continuar.");
      return;
    }

    setLoading(true);
    try {
      console.log(`🟡 [AuthPage ${debugIdRef.current}] POST /auth/verify-email`, { email });

      await apiFetch("/api/usuarios/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      setVerifiedBanner(true);
      setSuccess("✅ Email verificado correctamente. Tu cuenta ya está activa.");

      setTimeout(() => {
        skipClearOnModeChangeRef.current = true;
        setMode("login");
        setStep("form");
        setVerifyCode("");
        setAttemptsLeft(MAX_ATTEMPTS);
        setCooldown(0);
        setVerifiedBanner(false);
        setSuccess("Cuenta creada exitosamente ✅ Ahora iniciá sesión");
      }, 900);
    } catch (err) {
      console.log(`🔴 [AuthPage ${debugIdRef.current}] verify FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });

      const msg = String(err?.message || "");

      if (msg.toLowerCase().includes("máximo de intentos") || msg.toLowerCase().includes("demasiados intentos")) {
        setAttemptsLeft(0);
        setError("Dígitos incorrectos. Alcanzaste el máximo de intentos. Reenviá el código.");
        return;
      }
      if (msg.toLowerCase().includes("expiró") || msg.toLowerCase().includes("expiro")) {
        setError("El código expiró. Reenviá el código para continuar.");
        return;
      }
      if (
        msg.toLowerCase().includes("no hay verificación pendiente") ||
        msg.toLowerCase().includes("no hay verificacion pendiente")
      ) {
        setError("No hay una verificación pendiente para ese email. Volvé y registrate de nuevo.");
        return;
      }
      if (
        msg.toLowerCase().includes("ya está registrado") ||
        msg.toLowerCase().includes("ya esta registrado") ||
        msg.toLowerCase().includes("ya registrado")
      ) {
        skipClearOnModeChangeRef.current = true;
        setMode("login");
        setStep("form");
        setError(null);
        setSuccess("Ese email ya está registrado ✅ Iniciá sesión.");
        return;
      }

      setAttemptsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next <= 0) setError("Dígitos incorrectos. Alcanzaste el máximo de intentos. Reenviá el código.");
        else setError("Dígitos incorrectos, volver a intentar.");
        return next;
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendLoading || loading) return;

    setError(null);
    setSuccess(null);

    if (!email) {
      setError("Ingresá tu email para reenviar el código");
      return;
    }

    setResendLoading(true);
    try {
      console.log(`🟡 [AuthPage ${debugIdRef.current}] POST /auth/resend-code`, { email });

      await apiFetch("/api/usuarios/auth/resend-code", {
        method: "POST",
        body: JSON.stringify({ email }),
        timeoutMs: 60000,
      });

      setSuccess("Listo ✅ Te reenviamos un nuevo código");
      setCooldown(60);
      setAttemptsLeft(MAX_ATTEMPTS);
      setVerifyCode("");
      setVerifiedBanner(false);
    } catch (err) {
      console.log(`🔴 [AuthPage ${debugIdRef.current}] resend FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });

      const msg = String(err?.message || "");
      if (
        msg.toLowerCase().includes("1 minuto") ||
        msg.toLowerCase().includes("esperá") ||
        msg.toLowerCase().includes("espera")
      ) {
        setCooldown((c) => (c > 0 ? c : 60));
      }
      setError(err?.message || "No se pudo reenviar el código");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleForgot(e) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);

    const mail = String(fpEmail || "").trim();
    if (!isEmailValid(mail)) return setError("Email inválido");

    setLoading(true);
    try {
      console.log(`🟡 [AuthPage ${debugIdRef.current}] POST /auth/forgot-password`, { mail });

      await apiFetch("/api/usuarios/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: mail }),
        timeoutMs: 60000,
      });

      setSuccess("Si el email existe, te enviamos un código ✅");
      setStep("reset");
      setFpCode("");
      setFpNewPass("");
      setFpNewPass2("");
    } catch (err) {
      console.log(`🔴 [AuthPage ${debugIdRef.current}] forgot FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });
      setError(err?.message || "No se pudo enviar el código");
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);

    const mail = String(fpEmail || "").trim();
    const code = String(fpCode || "").trim();

    if (!isEmailValid(mail)) return setError("Email inválido");
    if (!/^\d{6}$/.test(code)) return setError("Ingresá el código de 6 dígitos");
    if ((fpNewPass || "").length < 6) return setError("La contraseña debe tener 6+ caracteres");
    if (fpNewPass !== fpNewPass2) return setError("Las contraseñas no coinciden");

    setLoading(true);
    try {
      console.log(`🟡 [AuthPage ${debugIdRef.current}] POST /auth/reset-password`, { mail });

      await apiFetch("/api/usuarios/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: mail, code, newPassword: fpNewPass }),
      });

      skipClearOnModeChangeRef.current = true;
      setMode("login");
      setStep("form");
      setPassword("");
      setPeek(false);
      setSuccess("Contraseña actualizada ✅ Ahora iniciá sesión");
    } catch (err) {
      console.log(`🔴 [AuthPage ${debugIdRef.current}] reset FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });
      setError(err?.message || "Código inválido o expirado");
    } finally {
      setLoading(false);
    }
  }

  const loadingText =
    mode === "login"
      ? step === "forgot"
        ? "Enviando código…"
        : step === "reset"
        ? "Actualizando contraseña…"
        : "Iniciando sesión…"
      : step === "verify"
      ? "Verificando código…"
      : "Creando tu cuenta…";

  const loadingSub =
    mode === "login"
      ? step === "forgot"
        ? "Si el email existe, te llegará un código."
        : step === "reset"
        ? "Actualizando tu contraseña de forma segura."
        : "Verificando credenciales y preparando tu panel."
      : step === "verify"
      ? "Validando el código y activando tu cuenta."
      : "Guardando tu cuenta y dejando todo listo.";

  const verifyHint = useMemo(() => {
    if (verifiedBanner) return "¡Perfecto! Ya está verificado.";
    if (isVerifyLocked) return "Bloqueado por intentos. Reenviá el código para seguir.";
    return `Te quedan ${attemptsLeft} intento${attemptsLeft === 1 ? "" : "s"}.`;
  }, [attemptsLeft, isVerifyLocked, verifiedBanner]);

  return (
    <div className="auth-page">
      <style>{AUTH_CSS}</style>

      {loading && (
        <div className="ap-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="ap-overlay-card">
            <div className="ap-overlay-glow" />
            <div className="ap-overlay-row">
              <div className="ap-spinner" />
              <div>
                <p className="ap-oload-title">{loadingText}</p>
                <p className="ap-oload-sub">{loadingSub}</p>
              </div>
            </div>
            <div className="ap-shimmer" />
          </div>
        </div>
      )}

      <header className="ap-nav">
        <div className="ap-nav-inner">
          <button className="ap-brand" onClick={goHome} type="button" disabled={loading || googleLoading}>
            🍏 <span>ZumaFit</span>
          </button>

          <nav className="ap-nav-links">
            <button className="ap-link" onClick={goHome} type="button" disabled={loading || googleLoading}>
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
            onClick={() => {
              setMode("login");
              setPeek(false);
              setStep("form");
            }}
            type="button"
            disabled={loading || googleLoading}
          >
            Iniciar sesión
          </button>
          <button
            role="tab"
            aria-selected={mode === "register"}
            className={`ap-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => {
              setMode("register");
              setPeek(false);
              setStep("form");
            }}
            type="button"
            disabled={loading || googleLoading}
          >
            Crear cuenta
          </button>
        </div>
      </div>

      <main className="ap-main">
        <section className="ap-card" aria-labelledby="auth-title">
          <h1 id="auth-title" className="ap-title">
            {mode === "login"
              ? step === "forgot"
                ? "Recuperá tu cuenta"
                : step === "reset"
                ? "Elegí una nueva contraseña"
                : "Bienvenido de nuevo"
              : step === "verify"
              ? "Verificá tu email"
              : "Empezá gratis"}
          </h1>
          <p className="ap-sub">
            {mode === "login"
              ? step === "forgot"
                ? "Te vamos a mandar un código si el email existe."
                : step === "reset"
                ? "Ingresá el código y tu nueva contraseña."
                : "Ingresá con tu email."
              : step === "verify"
              ? "Ingresá el código de 6 dígitos que te enviamos."
              : "Registrate con tu email o con Google."}
          </p>

          {step === "form" && (
            <div className="ap-social">
              <button
                className={`ap-social-btn ${googleLoading ? "is-loading" : ""}`}
                type="button"
                onClick={loginWithGoogle}
                disabled={loading || googleLoading}
                title="Continuar con Google"
              >
                <span className="ap-google-g" aria-hidden="true">
                  <span className="g1">G</span>
                  <span className="g2">o</span>
                  <span className="g3">o</span>
                  <span className="g4">g</span>
                  <span className="g5">l</span>
                  <span className="g6">e</span>
                </span>
                <span>Continuar con Google</span>
                {googleLoading && <span className="ap-mini-spin" aria-hidden="true" />}
              </button>
            </div>
          )}

          <div className="ap-divider">
            <span>con email</span>
          </div>

          {/* FORM LOGIN/REGISTER */}
          {step === "form" && (
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
                      disabled={loading || googleLoading}
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
                      disabled={loading || googleLoading}
                    />
                  </label>

                  <label className="ap-field">
                    <span>Fecha de nacimiento</span>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      required
                      disabled={loading || googleLoading}
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
                  disabled={loading || googleLoading}
                />
              </label>

              <label className="ap-field">
                <span>Contraseña</span>
                <div className="ap-pass-row">
                  <input
                    type={peek ? "text" : "password"}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={loading || googleLoading}
                  />
                  <button
                    type="button"
                    className="ap-peek"
                    aria-label={peek ? "Ocultar contraseña" : "Ver contraseña"}
                    title={peek ? "Ocultar" : "Ver"}
                    onClick={() => setPeek((v) => !v)}
                    disabled={loading || googleLoading}
                  >
                    {peek ? <EyeOpenIcon /> : <EyeClosedIcon />}
                  </button>
                </div>
              </label>

              {mode === "login" ? (
                <div className="ap-row-between">
                  <label className="ap-check">
                    <input
                      type="checkbox"
                      checked={remember}
                      onChange={(e) => setRemember(e.target.checked)}
                      disabled={loading || googleLoading}
                    />
                    <span>Recordarme</span>
                  </label>

                  <button
                    className="ap-link-btn"
                    type="button"
                    onClick={() => {
                      setStep("forgot");
                      setError(null);
                      setSuccess(null);
                      setFpEmail(email || "");
                    }}
                    disabled={loading || googleLoading}
                  >
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
                    disabled={loading || googleLoading}
                  />
                  <span>
                    Acepto los{" "}
                    <span className="ap-link" style={{ cursor: "default", textDecoration: "underline" }}>
                      Términos y Condiciones
                    </span>
                  </span>
                </label>
              )}

              {success && (
                <div className="ap-success" role="status">
                  {success}
                </div>
              )}
              {error && (
                <div className="ap-error" role="alert">
                  {error}
                </div>
              )}

              <button className="btn submit" type="submit" disabled={loading || googleLoading}>
                {loading ? "Procesando…" : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>

              {mode === "login" ? (
                <p className="ap-muted ap-small">
                  ¿No tenés cuenta?{" "}
                  <button
                    type="button"
                    className="ap-link-btn"
                    onClick={() => {
                      setMode("register");
                      setPeek(false);
                      setStep("form");
                    }}
                    disabled={loading || googleLoading}
                  >
                    Registrate
                  </button>
                </p>
              ) : (
                <p className="ap-muted ap-small">
                  ¿Ya tenés cuenta?{" "}
                  <button
                    type="button"
                    className="ap-link-btn"
                    onClick={() => {
                      setMode("login");
                      setPeek(false);
                      setStep("form");
                    }}
                    disabled={loading || googleLoading}
                  >
                    Iniciá sesión
                  </button>
                </p>
              )}
            </form>
          )}

          {/* VERIFY EMAIL */}
          {step === "verify" && (
            <form className="ap-form" onSubmit={handleVerify} noValidate>
              {verifiedBanner && (
                <div className="ap-verified-banner" role="status" aria-live="polite">
                  <div className="ap-verified-ic">✓</div>
                  <div>
                    <p className="ap-verified-title">Email verificado correctamente</p>
                    <p className="ap-verified-sub">Tu cuenta quedó activada. Ya podés iniciar sesión.</p>
                  </div>
                </div>
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

              <label className="ap-field">
                <span>Código de verificación</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading || verifiedBanner}
                  required
                />
              </label>

              <div className={`ap-verify-hint ${isVerifyLocked ? "locked" : ""}`}>{verifyHint}</div>

              {success && !verifiedBanner && (
                <div className="ap-success" role="status">
                  {success}
                </div>
              )}
              {error && !verifiedBanner && (
                <div className="ap-error" role="alert">
                  {error}
                </div>
              )}

              <button className="btn submit" type="submit" disabled={loading || verifiedBanner || isVerifyLocked}>
                {isVerifyLocked ? "Verificación bloqueada" : loading ? "Verificando…" : "Verificar"}
              </button>

              <div className="ap-verify-actions">
                <button
                  type="button"
                  className="ap-link-btn"
                  onClick={handleResend}
                  disabled={loading || resendLoading || cooldown > 0}
                  title={cooldown > 0 ? `Esperá ${cooldown}s` : "Reenviar código"}
                >
                  {resendLoading ? "Reenviando…" : cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
                </button>

                <span className="ap-muted ap-small">•</span>

                <button
                  type="button"
                  className="ap-link-btn"
                  onClick={() => {
                    setStep("form");
                    resetVerifyState();
                  }}
                  disabled={loading}
                >
                  Volver
                </button>
              </div>
            </form>
          )}

          {/* FORGOT PASSWORD */}
          {step === "forgot" && (
            <form className="ap-form" onSubmit={handleForgot} noValidate>
              <label className="ap-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </label>

              {success && <div className="ap-success" role="status">{success}</div>}
              {error && <div className="ap-error" role="alert">{error}</div>}

              <button className="btn submit" type="submit" disabled={loading}>
                {loading ? "Enviando…" : "Enviar código"}
              </button>

              <div className="ap-verify-actions">
                <button
                  type="button"
                  className="ap-link-btn"
                  onClick={() => {
                    setStep("form");
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={loading}
                >
                  Volver
                </button>
              </div>
            </form>
          )}

          {/* RESET PASSWORD */}
          {step === "reset" && (
            <form className="ap-form" onSubmit={handleResetPassword} noValidate>
              <label className="ap-field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={fpEmail}
                  onChange={(e) => setFpEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </label>

              <label className="ap-field">
                <span>Código</span>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={fpCode}
                  onChange={(e) => setFpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={loading}
                  required
                />
              </label>

              <label className="ap-field">
                <span>Nueva contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={fpNewPass}
                  onChange={(e) => setFpNewPass(e.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              <label className="ap-field">
                <span>Repetir nueva contraseña</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  value={fpNewPass2}
                  onChange={(e) => setFpNewPass2(e.target.value)}
                  disabled={loading}
                  required
                />
              </label>

              {success && <div className="ap-success" role="status">{success}</div>}
              {error && <div className="ap-error" role="alert">{error}</div>}

              <button className="btn submit" type="submit" disabled={loading}>
                {loading ? "Actualizando…" : "Cambiar contraseña"}
              </button>

              <div className="ap-verify-actions">
                <button
                  type="button"
                  className="ap-link-btn"
                  onClick={() => {
                    setStep("form");
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={loading}
                >
                  Volver
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <footer className="ap-foot">
        <p className="ap-muted">© {new Date().getFullYear()} ZumaFit • Privacidad • Términos</p>
      </footer>
    </div>
  );
}

// ✅ TU CSS + mejoras tap/loader google
const AUTH_CSS = `
:root{
  --bg:#0b0b0b;
  --fg:#eaeaea;
  --card:linear-gradient(180deg,#141414,#0f0f0f);
  --accent:#f5d76e;
}
* { box-sizing: border-box; }
html, body { margin:0; padding:0; background: var(--bg); color: var(--fg); }
.auth-page{ min-height:100dvh; background:var(--bg); color:var(--fg); display:flex; flex-direction:column; }
.ap-nav{ position:sticky; top:0; z-index:40; border-bottom:1px solid #1b1b1b; background:linear-gradient(180deg,#0b0b0b,#0b0b0bcc); backdrop-filter:saturate(140%) blur(3px); }
.ap-nav-inner{ max-width:1000px; margin:0 auto; padding:12px 16px; display:flex; align-items:center; justify-content:space-between; gap: 10px; }
.ap-brand{ display:flex; align-items:center; gap:8px; text-decoration:none; color:#f5d98a; font-weight:900; letter-spacing:.2px; background:transparent; border:none; cursor:pointer; padding:0; }
.ap-brand span{ color:#f5d98a; }
.ap-nav-links .ap-link{ background:#0f0f0f; color:#eaeaea; border:1px solid #2b2b2b; border-radius:12px; padding:8px 12px; cursor:pointer; }
.ap-nav-links .ap-link:disabled, .ap-brand:disabled{ opacity:.7; cursor:not-allowed; }
.ap-tabs-wrap{ padding:10px 16px 0; }
.ap-tabs{ max-width:1000px; margin:0 auto; display:flex; gap:8px; background:#0f0f0f; border:1px solid #2b2b2b; border-radius:14px; padding:6px; }
.ap-tab{ border:none; background:transparent; color:#ddd; padding:10px 14px; border-radius:12px; font-weight:800; cursor:pointer; }
.ap-tab.active{ background: linear-gradient(135deg, #f5d98a, #ffe89d); color:#0a0a0a; }
.ap-tab:disabled{ opacity:.6; cursor:not-allowed; }
.ap-main{ padding:14px 16px 24px; }
.ap-card{ max-width:720px; margin:0 auto; border:1px solid #232323; background:var(--card); border-radius:16px; padding:16px; position:relative; }
.ap-title{ margin:0 0 6px; font-size:28px; }
.ap-sub{ margin:0 0 12px; color:#cfcfcf; }
.ap-social{ display:grid; gap:10px; margin:10px 0 2px; }

/* ✅ Botón Google con tap PRO */
.ap-social-btn{
  width:100%;
  display:flex; align-items:center; justify-content:center; gap:10px;
  background:#0f0f0f; color:#eaeaea; border:1px solid #2b2b2b;
  border-radius:12px; padding:12px 14px; cursor:pointer; font-weight:900;
  position:relative;
  overflow:hidden;
  transition: transform .08s ease, box-shadow .18s ease, border-color .18s ease, filter .18s ease;
  will-change: transform;
  -webkit-tap-highlight-color: transparent;
  touch-action: manipulation;
}
.ap-social-btn:active{
  transform: translateY(1px) scale(0.99);
}
.ap-social-btn:focus-visible{
  outline:none;
  box-shadow: 0 0 0 3px rgba(245,217,138,.14);
  border-color: rgba(245,217,138,.45);
}

/* Ripple “pro obvio” */
.ap-social-btn::after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width: 10px;
  height: 10px;
  transform: translate(-50%,-50%) scale(0);
  border-radius: 999px;
  background: radial-gradient(circle, rgba(245,215,110,.35), transparent 60%);
  opacity:0;
  pointer-events:none;
}
.ap-social-btn:active::after{
  opacity:1;
  transform: translate(-50%,-50%) scale(18);
  transition: transform .45s ease, opacity .55s ease;
}

.ap-social-btn.is-loading{
  border-color: rgba(245,215,110,.55);
  box-shadow: 0 0 0 3px rgba(245,215,110,.12), 0 10px 40px rgba(0,0,0,.35);
  filter: brightness(1.05);
}
.ap-social-btn:disabled{ opacity:.7; cursor:not-allowed; }

.ap-mini-spin{
  width:16px; height:16px; border-radius:999px;
  border:2px solid rgba(245,215,110,.25);
  border-top-color: rgba(245,215,110,.95);
  display:inline-block;
  margin-left:10px;
  animation: apSpin .8s linear infinite;
  box-shadow: 0 0 10px rgba(245,215,110,.18);
}

.ap-google-g{ display:inline-flex; align-items:baseline; gap:0; font-weight:900; letter-spacing:-.2px; line-height:1; font-size:16px; user-select:none; }
.ap-google-g span{ font-weight:900; }
.ap-google-g .g1{ color:#4285F4; }
.ap-google-g .g2{ color:#EA4335; }
.ap-google-g .g3{ color:#FBBC05; }
.ap-google-g .g4{ color:#4285F4; }
.ap-google-g .g5{ color:#34A853; }
.ap-google-g .g6{ color:#EA4335; }

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
.ap-pass-row{ display:flex; align-items:stretch; gap:10px; }
.ap-pass-row input{ flex:1; min-width:0; }
.ap-peek{
  position:static;
  height:44px;
  padding:0 12px;
  width:48px;
  border:1px solid #2b2b2b;
  background:#161616;
  color:#eaeaea;
  border-radius:12px;
  font-weight:800;
  cursor:pointer;
  display:inline-flex;
  align-items:center;
  justify-content:center;
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
.ap-verify-actions{ display:flex; align-items:center; justify-content:center; gap:10px; margin-top:4px; }
.ap-verify-hint{
  text-align:center;
  font-size:12px;
  color:#b8b8b8;
  border:1px dashed #2b2b2b;
  padding:8px 10px;
  border-radius:12px;
  background:#0f0f0f;
}
.ap-verify-hint.locked{
  border-color:#6b3c00;
  background:#281a00;
  color:#ffd9a1;
}
.ap-verified-banner{
  display:flex;
  align-items:center;
  gap:12px;
  border:1px solid #0f4d2d;
  background: radial-gradient(520px 120px at 20% 0%, rgba(191,247,208,.18), transparent 55%),
              linear-gradient(180deg,#061f13,#05160e);
  color:#bff7d0;
  padding:12px 12px;
  border-radius:14px;
}
.ap-verified-ic{
  width:36px; height:36px;
  border-radius:12px;
  display:flex; align-items:center; justify-content:center;
  background: rgba(191,247,208,.12);
  border:1px solid rgba(191,247,208,.22);
  font-weight:900;
  flex:0 0 auto;
}
.ap-verified-title{ margin:0; font-weight:900; color:#bff7d0; }
.ap-verified-sub{ margin:4px 0 0; font-size:12px; color:#cfeedd; }
.ap-foot{ border-top:1px solid #1e1e1e; padding:16px; text-align:center; }
.ap-overlay{
  position:fixed; inset:0;
  background: rgba(11,11,11,.55);
  backdrop-filter: blur(6px) saturate(140%);
  display:flex; align-items:center; justify-content:center;
  z-index:9999; padding: 18px;
}
.ap-overlay-card{
  width:min(520px, 100%);
  border:1px solid #232323;
  background: linear-gradient(180deg,#121212,#0b0b0b);
  border-radius:18px; padding:18px 16px;
  position:relative; overflow:hidden;
  box-shadow: 0 18px 70px rgba(0,0,0,.65);
}
.ap-overlay-glow{
  position:absolute; inset:-2px;
  background: radial-gradient(600px 200px at 20% 0%, rgba(245,215,110,.22), transparent 60%),
              radial-gradient(520px 220px at 80% 100%, rgba(250,204,21,.10), transparent 60%);
  pointer-events:none;
}
.ap-overlay-row{ display:flex; align-items:center; gap:12px; position:relative; }
.ap-spinner{
  width:44px; height:44px; border-radius:50%;
  border:3px solid rgba(245,215,110,.18);
  border-top-color: rgba(245,215,110,.95);
  box-shadow: 0 0 18px rgba(245,215,110,.18);
  animation: apSpin .9s linear infinite;
  flex:0 0 auto;
}
@keyframes apSpin { to { transform: rotate(360deg); } }
.ap-oload-title{ font-weight:900; margin:0; color:#f5d76e; font-size:16px; }
.ap-oload-sub{ margin:4px 0 0; color:#cfcfcf; font-size:13px; line-height:1.4; }
.ap-shimmer{
  margin-top:14px; height:10px; border-radius:999px;
  background: #101010; border:1px solid #1f1f1f;
  overflow:hidden; position:relative;
}
.ap-shimmer::after{
  content:""; position:absolute; inset:0;
  transform: translateX(-60%);
  background: linear-gradient(90deg, transparent, rgba(245,215,110,.35), transparent);
  animation: apShimmer 1.2s ease-in-out infinite;
}
@keyframes apShimmer { 0% { transform: translateX(-60%); } 100% { transform: translateX(160%); } }
.ap-eye{ display:block; color:#f5d98a; }
`;

function EyeOpenIcon() {
  return (
    <svg className="ap-eye" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2.2 12s3.6-7 9.8-7 9.8 7 9.8 7-3.6 7-9.8 7-9.8-7-9.8-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeClosedIcon() {
  return (
    <svg className="ap-eye" width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M10.6 10.6a2.5 2.5 0 0 0 3.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 5.1A10.8 10.8 0 0 1 12 5c6.2 0 9.8 7 9.8 7a18 18 0 0 1-4 4.9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6.2 6.2C3.4 8.3 2.2 12 2.2 12s3.6 7 9.8 7c1.3 0 2.5-.2 3.6-.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
