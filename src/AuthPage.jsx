// src/AuthPage.jsx
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  User,
} from "lucide-react";
import { apiFetch } from "./Api.js";
import { API_BASE } from "./apiCredentials";
import { fetchAuthMeQuery } from "./authQueries.js";
import { clearPrivateQueryCache, setAuthUserQueryData } from "./queryClient.js";
import {
  setAuthLogged,
  clearAuthCache,
  getCachedStatus,
  getCachedToken, // fallback token
} from "./authCache.js";
import BrandLogo from "./ui/BrandLogo.jsx";
import fondoZumaFit from "./assets/fondozumafit.png";

// Importante para Google: volver aca para que corra /me y redirija por rol.
const AUTH_RETURN_PATH = "/auth";

// ---------------- helpers ----------------
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
  } catch {
    // La limpieza de query params es best-effort.
  }
}

function isProblemBrowser() {
  try {
    const ua = navigator.userAgent || "";

    // Safari real (no Chrome/Edge/Opera, etc.)
    const isSafari =
      /Safari/i.test(ua) &&
      !/Chrome|CriOS|Chromium|Edg|EdgiOS|OPR|Opera/i.test(ua);

    // iOS WebView (in-app browsers)
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isWebViewIOS = isIOS && !/Safari/i.test(ua) && /AppleWebKit/i.test(ua);

    return isSafari || isWebViewIOS;
  } catch {
    return false;
  }
}

function hasOAuthTokenInUrl() {
  const t = readQueryParam("token");
  const o = readQueryParam("oauth");
  return Boolean(t || o);
}

function normalizeRole(role) {
  return String(role || "").trim().toLowerCase();
}

function getHomeByUser(user) {
  const role = normalizeRole(user?.role || user?.rol);
  const tipo = normalizeRole(user?.tipo);
  const done = Boolean(user?.onboarding?.done);
  const enabled = user?.onboarding?.enabled === true;
  const shouldDoOnboarding =
    (role === "cliente" || role === "client") &&
    tipo === "entrenado" &&
    enabled &&
    !done;

  if (role === "admin") return "/admin/inicio";
  if (role === "coach") return "/profesional";

  return shouldDoOnboarding ? "/app/onboarding" : "/app/inicio";
}


// ---------------- component ----------------
export default function AuthPage({ defaultMode = "login" }) {
  const navigate = useNavigate();
  const location = useLocation();

  const debugIdRef = useRef(Math.random().toString(16).slice(2));
  const problemBrowserRef = useRef(isProblemBrowser());

  // booting: evita flash del form en Safari/WebView cuando hay token/fallback/OAuth
  const [booting, setBooting] = useState(() => {
    if (hasOAuthTokenInUrl()) return true;
    return isProblemBrowser() && !!getCachedToken();
  });

  const initialMode = defaultMode === "select" ? "select" : defaultMode === "register" ? "register" : "login";
  const [mode, setMode] = useState(initialMode);
  const [accountType, setAccountType] = useState("cliente");

  const [name, setName] = useState("");
  const [apellido, setApellido] = useState("");
  const [birthDate, setBirthDate] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [peek, setPeek] = useState(false);
  const [remember, setRemember] = useState(true);
  const [tos, setTos] = useState(false);

  // Verificacion por codigo
  const [step, setStep] = useState("form"); // "form" | "verify" | "forgot" | "reset"
  const [verifyCode, setVerifyCode] = useState("");

  // Forgot password states
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

  // Loader chiquito SOLO para click en Google (no overlay)
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const skipClearOnModeChangeRef = useRef(false);
  const oauthHandlingRef = useRef(false);
  const isVerifyLocked = useMemo(() => attemptsLeft <= 0, [attemptsLeft]);

  useEffect(() => {
    const nextMode = defaultMode === "select" ? "select" : defaultMode === "register" ? "register" : "login";
    setMode(nextMode);
  }, [defaultMode, location.pathname]);

  useEffect(() => {
    if (location.pathname === "/forgot-password") {
      setMode("login");
      setStep("forgot");
      setError(null);
      setSuccess(null);
    }
  }, [location.pathname]);

  useEffect(() => {
    const invitedEmail = readQueryParam("email");
    const inviteToken = readQueryParam("invite");
    if (!invitedEmail && !inviteToken) return;

    if (invitedEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(invitedEmail || "").trim())) {
      setEmail(invitedEmail.trim().toLowerCase());
    }
    setMode("register");
    setSuccess("Tenes una invitacion de coach. Crea tu cuenta con este email y despues vas a poder aceptar o rechazar la invitacion desde ZumaFit.");
  }, []);

  // ---- logs ----
  useEffect(() => {
    console.log(`[AuthPage ${debugIdRef.current}] mount`, {
      API_BASE,
      href: window.location.href,
      pathname: location.pathname,
      search: location.search,
      key: location.key,
      isProblemBrowser: problemBrowserRef.current,
      booting,
      hasFallbackToken: !!getCachedToken(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log(`[AuthPage ${debugIdRef.current}] route change`, {
      pathname: location.pathname,
      search: location.search,
      key: location.key,
      step,
      mode,
      booting,
    });
  }, [location.pathname, location.search, location.key, step, mode, booting]);

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

    // forgot password reset
    setFpEmail("");
    setFpCode("");
    setFpNewPass("");
    setFpNewPass2("");
    setConfirmPassword("");

    setGoogleLoading(false);

    // Si cambias de modo manualmente, deja booting en false salvo fallback/OAuth.
    setBooting(hasOAuthTokenInUrl() || (problemBrowserRef.current && !!getCachedToken()));
  }, [mode]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Retorno OAuth por query: si viene token, lo guardamos y hacemos /me sin mostrar form.
  useEffect(() => {
    const oauthError = readQueryParam("error");
    const oauthToken = readQueryParam("token");
    const oauthFlag = readQueryParam("oauth"); // debug

    if (oauthFlag) console.log(`[OAuth ${debugIdRef.current}] flag oauth=`, oauthFlag);

    if (oauthError) {
      console.log(`[OAuth ${debugIdRef.current}] error query:`, oauthError);
      oauthHandlingRef.current = false;
      setError(decodeURIComponent(oauthError));
      removeQueryParams(["error", "token", "oauth"]);
      setBooting(false);
      return;
    }

    if (oauthToken || oauthFlag) {
      console.log(`[OAuth ${debugIdRef.current}] token por query -> guardando fallback y resolviendo /me sin flash`);
      // Bloquea UI para evitar ver el form.
      oauthHandlingRef.current = true;
      setBooting(true);

      // Guarda token fallback.
      clearPrivateQueryCache();
      if (oauthToken) setAuthLogged(null, oauthToken);

      // Limpia la URL para no dejar token en la barra.
      removeQueryParams(["token", "error", "oauth"]);

      // Ahora resolvemos /me y redirigimos sin recargar.
      (async () => {
        try {
          const user = await fetchAuthMeQuery({ timeoutMs: 8000 });
          if (!user) throw new Error("No se pudo validar la sesion de Google");
          const role = normalizeRole(user?.role || user?.rol);

          console.log(`[OAuth ${debugIdRef.current}] /me OK luego de token query`, { role, user });

          setAuthLogged(user);
          setAuthUserQueryData(user);
         navigate(getHomeByUser(user), { replace: true });
        } catch (err) {
          console.log(`[OAuth ${debugIdRef.current}] /me FAIL luego de token query`, {
            status: err?.status,
            message: err?.message,
            err,
          });
          clearAuthCache();
          clearPrivateQueryCache();
          oauthHandlingRef.current = false;
          setError("No se pudo completar el login con Google. Proba de nuevo.");
          // Si falla, deja que el usuario vea el form.
          setBooting(false);
        }
      })();

      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Auto-login: si ya hay cookie o token fallback, probamos /me.
  useEffect(() => {
    if (step !== "form") return;

    let cancelled = false;

    (async () => {
      try {
        const hasFallbackToken = !!getCachedToken();
        const cachedStatus = getCachedStatus();
        const isPB = problemBrowserRef.current;
        const shouldTryAutoLogin = cachedStatus === "logged" || hasFallbackToken;

        if (oauthHandlingRef.current || hasOAuthTokenInUrl()) return;

        if (!shouldTryAutoLogin) {
          setBooting(false);
          return;
        }

        // Si es Safari/WebView y hay token fallback, evita el form hasta resolver.
        if (isPB && hasFallbackToken) setBooting(true);

        console.log(`[AuthPage ${debugIdRef.current}] probando /api/usuarios/auth/me ...`, {
          step,
          mode,
          href: window.location.href,
          hasFallbackToken,
          cachedStatus,
          isProblemBrowser: isPB,
        });

        const user = await fetchAuthMeQuery({ timeoutMs: 6000 });
        if (!user) throw new Error("No se pudo validar la sesion");
        if (cancelled) return;

        const role = normalizeRole(user?.role || user?.rol);

        console.log(`[AuthPage ${debugIdRef.current}] /me OK`, { role, user });

        setAuthLogged(user);
        setAuthUserQueryData(user);

// Una vez que tenemos /me, ya no hay flash.
setBooting(false);

navigate(getHomeByUser(user), { replace: true });

      } catch (err) {
        if (cancelled) return;

        console.log(`[AuthPage ${debugIdRef.current}] /me FAIL`, {
          status: err?.status,
          message: err?.message,
          err,
          hasFallbackToken: !!getCachedToken(),
          isProblemBrowser: problemBrowserRef.current,
        });

        // Un 401 de /me confirma que la sesion local ya no es valida.
        if (err?.status === 401) {
          clearAuthCache();
          clearPrivateQueryCache();
        }

        // Si fallo y estamos en booting, deja ver el form sin flash previo.
        setBooting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, step, mode, location.key]);

  // Google: feedback inmediato, sin overlay; booting cubre el retorno.
  function loginWithGoogle() {
    if (googleLoading || loading) return;

    // Podemos limpiar estado/user/role sin romper Chrome.
    clearAuthCache();
    clearPrivateQueryCache();

    setGoogleLoading(true);

    requestAnimationFrame(() => {
      const returnTo = encodeURIComponent(window.location.origin + AUTH_RETURN_PATH);
      const url = joinUrl(API_BASE, `/api/usuarios/auth/google?returnTo=${returnTo}`);

      console.log("[AuthPage] loginWithGoogle", {
        API_BASE,
        returnToDecoded: decodeURIComponent(returnTo),
        url,
      });

      window.location.assign(url);
    });

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
      if (name.trim().length < 2) return setError("Ingresa tu nombre (2+ caracteres)");
      if (apellido.trim().length < 2) return setError("Ingresa tu apellido (2+ caracteres)");
      if (!birthDate) return setError("Ingresa tu fecha de nacimiento");
      if (!tos) return setError("Acepta los terminos para continuar");
      if (password !== confirmPassword) return setError("Las contraseñas no coinciden");
    }

    if (!isEmailValid(email)) return setError("Email invalido");
    if (password.length < 6) return setError("La contraseña debe tener 6+ caracteres");

    setLoading(true);

    try {
      if (mode === "login") {
        try {
          console.log(`[AuthPage ${debugIdRef.current}] POST /auth/login`, { email, remember });

          // 1) Login
          const r = await apiFetch("/api/usuarios/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password, remember }),
          });

          // 2) Fallback: si viene token
          clearPrivateQueryCache();
          if (r?.token) setAuthLogged(null, r.token);

          // 3) /me
          const user = await fetchAuthMeQuery({ timeoutMs: 8000 });
          const role = normalizeRole(user?.role || user?.rol);

          console.log(`[AuthPage ${debugIdRef.current}] login OK ->`, { role, user });

          setAuthLogged(user);
          setAuthUserQueryData(user);

navigate(getHomeByUser(user), { replace: true });

return;

        } catch (err) {
          console.log(`[AuthPage ${debugIdRef.current}] login FAIL`, {
            status: err?.status,
            message: err?.message,
            pending: err?.pending,
            err,
          });

          const pending =
            err?.pending === true ||
            String(err?.message || "").toLowerCase().includes("verificacion pendiente") ||
            String(err?.message || "").toLowerCase().includes("verificacion pendiente");

          if (pending) {
            setStep("verify");
            setVerifyCode("");
            setAttemptsLeft(MAX_ATTEMPTS);
            setCooldown(0);
            setPassword("");
            setPeek(false);
            setError(null);
            setSuccess("Tenes una verificacion pendiente. Ingresa el codigo o reenvia uno nuevo.");
            return;
          }

          setError(err?.message || "Email o contraseña incorrectos");
          return;
        }
      }

      console.log(`[AuthPage ${debugIdRef.current}] POST /auth/register`, { email });

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
        timeoutMs: 60000,
      });

      setStep("verify");
      setVerifyCode("");
      setPassword("");
      setPeek(false);
      setAttemptsLeft(MAX_ATTEMPTS);

      setCooldown(60);
      setVerifiedBanner(false);

      setSuccess("Te enviamos un codigo de 6 digitos por email. Ingresalo para verificar tu cuenta.");
    } catch (err) {
      console.log(`[AuthPage ${debugIdRef.current}] register FAIL`, {
        status: err?.status,
        message: err?.message,
        pending: err?.pending,
        err,
      });

      const msg = String(err?.message || "");
      if (
        msg.toLowerCase().includes("verificacion pendiente") ||
        msg.toLowerCase().includes("verificacion pendiente") ||
        msg.toLowerCase().includes("ya hay una verificacion pendiente") ||
        err?.pending === true
      ) {
        setStep("verify");
        setCooldown(0);
        setAttemptsLeft(MAX_ATTEMPTS);
        setSuccess("Ya tenes una verificacion pendiente. Ingresa el codigo o reenvia uno nuevo.");
      } else {
        setError(err?.message || "Ocurrio un error");
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
    if (!email) return setError("Ingresa el email con el que te registraste");
    if (!/^\d{6}$/.test(code)) return setError("Ingresa el codigo de 6 digitos");

    if (isVerifyLocked) {
      setError("Alcanzaste el maximo de intentos. Reenvia el codigo para continuar.");
      return;
    }

    setLoading(true);
    try {
      console.log(`[AuthPage ${debugIdRef.current}] POST /auth/verify-email`, { email });

      await apiFetch("/api/usuarios/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      });

      setVerifiedBanner(true);
      setSuccess("Email verificado correctamente. Tu cuenta ya esta activa.");

      setTimeout(() => {
        skipClearOnModeChangeRef.current = true;
        setMode("login");
        setStep("form");
        setVerifyCode("");
        setAttemptsLeft(MAX_ATTEMPTS);
        setCooldown(0);
        setVerifiedBanner(false);
        setSuccess("Cuenta creada exitosamente. Ahora inicia sesion");
      }, 900);
    } catch (err) {
      console.log(`[AuthPage ${debugIdRef.current}] verify FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });

      const msg = String(err?.message || "");

      if (msg.toLowerCase().includes("maximo de intentos") || msg.toLowerCase().includes("demasiados intentos")) {
        setAttemptsLeft(0);
        setError("Digitos incorrectos. Alcanzaste el maximo de intentos. Reenvia el codigo.");
        return;
      }
      if (msg.toLowerCase().includes("expiro") || msg.toLowerCase().includes("expirado")) {
        setError("El codigo expiro. Reenvia el codigo para continuar.");
        return;
      }
      if (
        msg.toLowerCase().includes("no hay verificacion pendiente") ||
        msg.toLowerCase().includes("no hay verificacion pendiente")
      ) {
        setError("No hay una verificacion pendiente para ese email. Volve y registrate de nuevo.");
        return;
      }
      if (
        msg.toLowerCase().includes("ya esta registrado") ||
        msg.toLowerCase().includes("ya esta registrado") ||
        msg.toLowerCase().includes("ya registrado")
      ) {
        skipClearOnModeChangeRef.current = true;
        setMode("login");
        setStep("form");
        setError(null);
        setSuccess("Ese email ya esta registrado. Inicia sesion.");
        return;
      }

      setAttemptsLeft((prev) => {
        const next = Math.max(0, prev - 1);
        if (next <= 0) setError("Digitos incorrectos. Alcanzaste el maximo de intentos. Reenvia el codigo.");
        else setError("Digitos incorrectos, volve a intentar.");
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
      setError("Ingresa tu email para reenviar el codigo");
      return;
    }

    setResendLoading(true);
    try {
      console.log(`[AuthPage ${debugIdRef.current}] POST /auth/resend-code`, { email });

      await apiFetch("/api/usuarios/auth/resend-code", {
        method: "POST",
        body: JSON.stringify({ email }),
        timeoutMs: 60000,
      });

      setSuccess("Listo. Te reenviamos un nuevo codigo");
      setCooldown(60);
      setAttemptsLeft(MAX_ATTEMPTS);
      setVerifyCode("");
      setVerifiedBanner(false);
    } catch (err) {
      console.log(`[AuthPage ${debugIdRef.current}] resend FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });

      const msg = String(err?.message || "");
      if (
        msg.toLowerCase().includes("1 minuto") ||
        msg.toLowerCase().includes("espera") ||
        msg.toLowerCase().includes("espera")
      ) {
        setCooldown((c) => (c > 0 ? c : 60));
      }
      setError(err?.message || "No se pudo reenviar el codigo");
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
    if (!isEmailValid(mail)) return setError("Email invalido");

    setLoading(true);
    try {
      console.log(`[AuthPage ${debugIdRef.current}] POST /auth/forgot-password`, { mail });

      await apiFetch("/api/usuarios/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email: mail }),
        timeoutMs: 60000,
      });

      setSuccess("Si el email existe, te enviamos un codigo.");
      setStep("reset");
      setFpCode("");
      setFpNewPass("");
      setFpNewPass2("");
    } catch (err) {
      console.log(`[AuthPage ${debugIdRef.current}] forgot FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });
      setError(err?.message || "No se pudo enviar el codigo");
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

    if (!isEmailValid(mail)) return setError("Email invalido");
    if (!/^\d{6}$/.test(code)) return setError("Ingresa el codigo de 6 digitos");
    if ((fpNewPass || "").length < 6) return setError("La contraseña debe tener 6+ caracteres");
    if (fpNewPass !== fpNewPass2) return setError("Las contraseñas no coinciden");

    setLoading(true);
    try {
      console.log(`[AuthPage ${debugIdRef.current}] POST /auth/reset-password`, { mail });

      await apiFetch("/api/usuarios/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email: mail, code, newPassword: fpNewPass }),
      });

      skipClearOnModeChangeRef.current = true;
      setMode("login");
      setStep("form");
      setPassword("");
      setPeek(false);
      setSuccess("Contraseña actualizada. Ahora inicia sesion");
    } catch (err) {
      console.log(`[AuthPage ${debugIdRef.current}] reset FAIL`, {
        status: err?.status,
        message: err?.message,
        err,
      });
      setError(err?.message || "Codigo invalido o expirado");
    } finally {
      setLoading(false);
    }
  }

  const loadingText =
    mode === "login"
      ? step === "forgot"
        ? "Enviando codigo..."
        : step === "reset"
        ? "Actualizando contraseña..."
        : "Iniciando sesion..."
      : step === "verify"
      ? "Verificando codigo..."
      : "Creando tu cuenta...";

  const loadingSub =
    mode === "login"
      ? step === "forgot"
        ? "Si el email existe, te llegara un codigo."
        : step === "reset"
        ? "Actualizando tu contraseña de forma segura."
        : "Verificando credenciales y preparando tu panel."
      : step === "verify"
      ? "Validando el codigo y activando tu cuenta."
      : "Guardando tu cuenta y dejando todo listo.";

  const verifyHint = useMemo(() => {
    if (verifiedBanner) return "Perfecto. Ya esta verificado.";
    if (isVerifyLocked) return "Bloqueado por intentos. Reenvia el codigo para seguir.";
    return `Te quedan ${attemptsLeft} intento${attemptsLeft === 1 ? "" : "s"}.`;
  }, [attemptsLeft, isVerifyLocked, verifiedBanner]);

  function goLogin() {
    setMode("login");
    setPeek(false);
    setStep("form");
    navigate("/auth/login");
  }

  function goRegisterChoice() {
    setMode("select");
    setPeek(false);
    setStep("form");
    navigate("/auth/register");
  }

  function goClientRegister() {
    setAccountType("cliente");
    setMode("register");
    setPeek(false);
    setStep("form");
    navigate("/auth/register/client");
  }

  function goCoachRegister() {
    setAccountType("coach");
    navigate("/auth/register/coach");
  }

  function continueSelectedAccount() {
    if (accountType === "coach") goCoachRegister();
    else goClientRegister();
  }

  // Si estamos booting, no mostramos el form para evitar flash en Safari/WebView.
  if (booting) {
    return (
      <div className="auth-page">
        <style>{AUTH_CSS}</style>
        <div className="ap-overlay" role="status" aria-live="polite" aria-busy="true">
          <div className="ap-overlay-card">
            <div className="ap-overlay-glow" />
            <div className="ap-overlay-row">
              <div className="ap-spinner" />
              <div>
                <p className="ap-oload-title">Cargando sesion...</p>
                <p className="ap-oload-sub">Estamos verificando tu acceso.</p>
              </div>
            </div>
            <div className="ap-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page" style={{ "--auth-hero-bg": `url(${fondoZumaFit})` }}>
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
          <button className="ap-brand" onClick={() => navigate("/")} type="button" disabled={loading || googleLoading}>
            <BrandLogo className="ap-brandLogo" size="client" priority />
          </button>
        </div>
      </header>

      <section className="ap-hero" aria-label="ZumaFit">
        <BrandLogo className="ap-heroLogo" size="client" priority />
        <p>Tu plan, tus macros, <strong>tu progreso.</strong></p>
      </section>

      <div className="ap-tabs-wrap">
        <div className="ap-tabs" role="tablist" aria-label="Tipo de acceso">
          <button
            role="tab"
            aria-selected={mode === "login"}
            className={`ap-tab ${mode === "login" ? "active" : ""}`}
            onClick={goLogin}
            type="button"
            disabled={loading || googleLoading}
          >
            Iniciar sesión
          </button>
          <button
            role="tab"
            aria-selected={mode === "select" || mode === "register"}
            className={`ap-tab ${mode === "select" || mode === "register" ? "active" : ""}`}
            onClick={goRegisterChoice}
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
            {mode === "select"
              ? "Elegí cómo querés usar ZumaFit"
              : mode === "login"
              ? step === "forgot"
                ? "Recuperá tu cuenta"
                : step === "reset"
                ? "Elegí una nueva contraseña"
                : "Bienvenido de nuevo"
              : step === "verify"
              ? "Verificá tu email"
              : "Creá tu cuenta y empezá tu transformación"}
          </h1>
          <p className="ap-sub">
            {mode === "select"
              ? "Así podemos personalizar tu experiencia desde el primer día."
              : mode === "login"
              ? step === "forgot"
                ? "Te vamos a mandar un código si el email existe."
                : step === "reset"
                ? "Ingresá el código y tu nueva contraseña."
                : "Ingresá con tu email."
              : step === "verify"
              ? "Ingresá el código de 6 dígitos que te enviamos."
              : "Registrate con tu email o con Google."}
          </p>

          {mode === "select" && step === "form" ? (
            <div className="ap-account-select">
              <div className="ap-register-steps" aria-label="Pasos de registro">
                <span className="active">1</span>
                <strong>Elegí tu cuenta</strong>
                <span>2</span>
                <strong>Completá tus datos</strong>
              </div>

              <fieldset className="ap-choice-fieldset">
                <legend className="sr-only">Tipo de cuenta</legend>
                <label className={`ap-choice-card ${accountType === "cliente" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="cliente"
                    checked={accountType === "cliente"}
                    onChange={() => setAccountType("cliente")}
                  />
                  <span className="ap-choice-icon"><User size={34} /></span>
                  <span className="ap-choice-copy">
                    <strong>Quiero ser cliente</strong>
                    <small>Nutrición, menús, Tracking, rutina y progreso personal.</small>
                  </span>
                  <span className="ap-choice-radio" aria-hidden="true" />
                </label>

                <label className={`ap-choice-card ${accountType === "coach" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="accountType"
                    value="coach"
                    checked={accountType === "coach"}
                    onChange={() => setAccountType("coach")}
                  />
                  <span className="ap-choice-icon"><BriefcaseBusiness size={34} /></span>
                  <span className="ap-choice-copy">
                    <strong>Quiero ser coach</strong>
                    <small>Gestioná clientes, acompañamiento y seguimiento profesional.</small>
                  </span>
                  <span className="ap-choice-radio" aria-hidden="true" />
                </label>
              </fieldset>

              {accountType === "cliente" ? (
                <button
                  className={`ap-social-btn ${googleLoading ? "is-loading" : ""}`}
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={loading || googleLoading}
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
              ) : (
                <div className="ap-coach-note">
                  El registro coach se completa como solicitud profesional y queda pendiente de revisión administrativa.
                </div>
              )}

              <button className="btn submit ap-cta-arrow" type="button" onClick={continueSelectedAccount}>
                Continuar <ArrowRight size={22} />
              </button>

              <p className="ap-muted ap-small ap-centered">
                Ya tengo cuenta ·{" "}
                <button type="button" className="ap-link-btn" onClick={goLogin}>
                  Iniciar sesión
                </button>
              </p>
            </div>
          ) : null}

          {mode !== "select" && step === "form" && (
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
                <span>{mode === "register" ? "Crear cuenta con Google" : "Continuar con Google"}</span>
                {googleLoading && <span className="ap-mini-spin" aria-hidden="true" />}
              </button>
            </div>
          )}

          {mode !== "select" ? (
          <div className="ap-divider">
            <span>con email</span>
          </div>
          ) : null}

          {/* FORM LOGIN/REGISTER */}
          {mode !== "select" && step === "form" && (
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

              {mode === "register" ? (
                <label className="ap-field">
                  <span>Confirmar contraseña</span>
                  <div className="ap-pass-row">
                    <input
                      type={peek ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      minLength={6}
                      disabled={loading || googleLoading}
                    />
                    <span className="ap-pass-spacer" aria-hidden="true" />
                  </div>
                </label>
              ) : null}

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
                      navigate("/forgot-password");
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
                {loading ? "Procesando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>

              {mode === "login" ? (
                <p className="ap-muted ap-small">
                  ¿No tenés cuenta?{" "}
                  <button
                    type="button"
                    className="ap-link-btn"
                    onClick={goRegisterChoice}
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
                    onClick={goLogin}
                    disabled={loading || googleLoading}
                  >
                    Iniciá sesión
                  </button>
                </p>
              )}

              {mode === "register" ? (
                <p className="ap-muted ap-small">
                  ¿Sos entrenador o profesional?{" "}
                  <button
                    type="button"
                    className="ap-link-btn"
                    onClick={goCoachRegister}
                    disabled={loading || googleLoading}
                  >
                    Registrate como profesional
                  </button>
                </p>
              ) : null}
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
                {isVerifyLocked ? "Verificación bloqueada" : loading ? "Verificando..." : "Verificar"}
              </button>

              <div className="ap-verify-actions">
                <button
                  type="button"
                  className="ap-link-btn"
                  onClick={handleResend}
                  disabled={loading || resendLoading || cooldown > 0}
                  title={cooldown > 0 ? `Esperá ${cooldown}s` : "Reenviar código"}
                >
                  {resendLoading ? "Reenviando..." : cooldown > 0 ? `Reenviar en ${cooldown}s` : "Reenviar código"}
                </button>

                <span className="ap-muted ap-small">·</span>

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
                {loading ? "Enviando..." : "Enviar código"}
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
                {loading ? "Actualizando..." : "Cambiar contraseña"}
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
        <p className="ap-muted">© {new Date().getFullYear()} ZumaFit · Privacidad · Términos</p>
      </footer>
    </div>
  );
}

/* =========
   CSS
   ========= */

const AUTH_CSS = `
:root{
  --auth-bg:#020507;
  --auth-surface:rgba(9,14,20,.92);
  --auth-surface-soft:rgba(18,24,31,.82);
  --auth-border:rgba(255,211,83,.24);
  --auth-gold:#f4c542;
  --auth-gold-soft:#ffe178;
  --auth-text:#f7f7f7;
  --auth-muted:#a7adb5;
}
*{ box-sizing:border-box; }
html, body{ margin:0; padding:0; background:var(--auth-bg); color:var(--auth-text); }
.sr-only{ position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }
.auth-page{
  min-height:100dvh;
  color:var(--auth-text);
  background:
    radial-gradient(circle at 50% -12%, rgba(244,197,66,.16), transparent 34%),
    linear-gradient(180deg,#020507,#05070a 55%,#020507);
  display:flex;
  flex-direction:column;
}
.ap-nav{
  position:absolute;
  inset:0 0 auto 0;
  z-index:4;
  pointer-events:none;
}
.ap-nav-inner{
  width:min(960px,100%);
  margin:0 auto;
  padding:16px clamp(14px,4vw,28px);
  display:flex;
  align-items:center;
  justify-content:flex-start;
}
.ap-brand{
  pointer-events:auto;
  border:0;
  background:transparent;
  padding:0;
  cursor:pointer;
  display:flex;
  align-items:center;
}
.ap-brandLogo .brand-logo-img{ height:clamp(42px,8vw,60px); max-width:min(230px,60vw); }
.ap-hero{
  min-height:240px;
  padding:86px 18px 52px;
  display:grid;
  place-items:center;
  text-align:center;
  background:
    linear-gradient(180deg, rgba(2,5,8,.20) 0%, rgba(2,5,8,.34) 42%, rgba(2,5,8,.94) 100%),
    radial-gradient(circle at 50% 38%, rgba(244,197,66,.12), transparent 38%),
    var(--auth-hero-bg);
  background-size:cover;
  background-position:center 24%;
  border-bottom:1px solid rgba(255,255,255,.08);
}
.ap-heroLogo .brand-logo-img{ height:clamp(58px,12vw,96px); max-width:min(420px,82vw); }
.ap-hero p{
  margin:18px 0 0;
  color:rgba(247,247,247,.78);
  font-size:clamp(14px,3vw,22px);
  font-weight:800;
  letter-spacing:.20em;
  text-transform:uppercase;
}
.ap-hero strong{ color:var(--auth-gold-soft); }
.ap-tabs-wrap{
  width:min(900px,100%);
  margin:-34px auto 0;
  padding:0 14px;
  position:relative;
  z-index:5;
}
.ap-tabs{
  display:flex;
  gap:0;
  border:1px solid rgba(255,255,255,.12);
  border-radius:24px;
  background:rgba(10,15,20,.82);
  padding:6px;
  box-shadow:0 20px 60px rgba(0,0,0,.40);
  backdrop-filter:blur(18px);
}
.ap-tab{
  flex:1 1 0;
  min-height:62px;
  border-radius:19px;
  border:1px solid transparent;
  background:transparent;
  color:rgba(247,247,247,.72);
  font-size:clamp(15px,3vw,22px);
  font-weight:1000;
  cursor:pointer;
}
.ap-tab.active{
  color:var(--auth-gold-soft);
  border-color:rgba(255,211,83,.50);
  background:linear-gradient(135deg, rgba(244,197,66,.18), rgba(255,255,255,.04));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05);
}
.ap-tab:focus-visible,.ap-link-btn:focus-visible,.ap-social-btn:focus-visible,.btn.submit:focus-visible,.ap-peek:focus-visible,.ap-choice-card:focus-within{
  outline:none;
  box-shadow:0 0 0 4px rgba(244,197,66,.16);
}
.ap-tab:disabled{ opacity:.6; cursor:not-allowed; }
.ap-main{
  width:min(900px,100%);
  margin:0 auto;
  padding:0 14px 28px;
}
.ap-card{
  width:100%;
  border:1px solid var(--auth-border);
  border-radius:0 0 30px 30px;
  background:
    radial-gradient(circle at 16% 0, rgba(244,197,66,.10), transparent 34%),
    linear-gradient(145deg, rgba(18,24,31,.92), rgba(4,8,13,.96));
  box-shadow:0 26px 80px rgba(0,0,0,.52), inset 0 1px 0 rgba(255,255,255,.05);
  padding:clamp(26px,6vw,56px);
  backdrop-filter:blur(14px);
}
.ap-title{
  margin:0;
  font-size:clamp(34px,7vw,54px);
  line-height:1.05;
  letter-spacing:-.035em;
  font-weight:1000;
}
.ap-sub{
  max-width:640px;
  margin:14px 0 24px;
  color:rgba(247,247,247,.66);
  font-size:clamp(18px,3.2vw,26px);
  line-height:1.36;
  font-weight:700;
}
.ap-social{ display:grid; gap:10px; margin:0 0 6px; }
.ap-social-btn{
  width:100%;
  min-height:62px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:14px;
  border:1px solid rgba(255,255,255,.14);
  border-radius:18px;
  background:linear-gradient(145deg, rgba(9,20,32,.80), rgba(8,12,18,.86));
  color:var(--auth-text);
  cursor:pointer;
  font-size:clamp(15px,3vw,22px);
  font-weight:1000;
  transition:transform .12s ease, border-color .18s ease, filter .18s ease;
}
.ap-social-btn:active{ transform:scale(.99); }
.ap-social-btn.is-loading{ border-color:rgba(244,197,66,.48); filter:brightness(1.06); }
.ap-social-btn:disabled{ opacity:.7; cursor:not-allowed; }
.ap-mini-spin{
  width:16px; height:16px; border-radius:999px;
  border:2px solid rgba(245,215,110,.25);
  border-top-color:rgba(245,215,110,.95);
  display:inline-block;
  animation:apSpin .8s linear infinite;
}
.ap-google-g{ display:inline-flex; align-items:baseline; gap:0; font-weight:1000; letter-spacing:-.2px; line-height:1; font-size:22px; user-select:none; }
.ap-google-g span{ font-weight:1000; }
.ap-google-g .g1{ color:#4285F4; }.ap-google-g .g2{ color:#EA4335; }.ap-google-g .g3{ color:#FBBC05; }.ap-google-g .g4{ color:#4285F4; }.ap-google-g .g5{ color:#34A853; }.ap-google-g .g6{ color:#EA4335; }
.ap-divider{
  display:flex;
  align-items:center;
  gap:16px;
  margin:26px 0;
  color:rgba(247,247,247,.50);
  font-size:clamp(14px,2.6vw,18px);
  font-weight:700;
}
.ap-divider::before,.ap-divider::after{ content:""; flex:1; height:1px; background:rgba(255,255,255,.14); }
.ap-form{ display:grid; gap:18px; }
.ap-field{ display:grid; gap:9px; color:rgba(247,247,247,.92); font-size:clamp(15px,3vw,20px); font-weight:850; }
.ap-field input{
  width:100%;
  min-height:58px;
  border:1px solid rgba(255,255,255,.16);
  border-radius:17px;
  background:rgba(3,10,16,.76);
  color:var(--auth-text);
  padding:0 18px;
  font:inherit;
  font-weight:800;
  outline:none;
}
.ap-field input::placeholder{ color:rgba(247,247,247,.34); }
.ap-field input:focus{ border-color:rgba(255,211,83,.58); box-shadow:0 0 0 4px rgba(244,197,66,.12); }
.ap-field input:disabled{ opacity:.68; }
.ap-pass-row{ display:grid; grid-template-columns:minmax(0,1fr) 54px; gap:10px; align-items:stretch; }
.ap-peek,.ap-pass-spacer{
  width:54px;
  min-height:58px;
  border-radius:17px;
  border:1px solid rgba(255,255,255,.16);
  background:rgba(3,10,16,.76);
  color:var(--auth-gold-soft);
  display:grid;
  place-items:center;
}
.ap-peek{ cursor:pointer; }
.ap-peek:disabled{ opacity:.6; cursor:not-allowed; }
.ap-row-between{ display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.ap-check{
  display:flex;
  align-items:center;
  gap:10px;
  color:rgba(247,247,247,.78);
  font-size:clamp(14px,2.8vw,18px);
  font-weight:700;
}
.ap-check input{ width:20px; height:20px; accent-color:var(--auth-gold); }
.ap-link,.ap-link-btn{ color:var(--auth-gold-soft); text-decoration:underline; text-underline-offset:3px; background:transparent; border:0; cursor:pointer; font:inherit; font-weight:850; }
.ap-link-btn:disabled{ opacity:.55; cursor:not-allowed; text-decoration:none; }
.ap-error,.ap-success{
  border-radius:16px;
  padding:12px 14px;
  font-size:14px;
  font-weight:800;
  line-height:1.35;
}
.ap-error{ border:1px solid rgba(255,107,107,.34); background:rgba(80,13,20,.38); color:#ffd1d1; }
.ap-success{ border:1px solid rgba(52,211,153,.28); background:rgba(5,56,38,.34); color:#c8f7df; }
.btn.submit{
  width:100%;
  min-height:66px;
  border:0;
  border-radius:18px;
  background:linear-gradient(135deg,#ffc414,#ffe47a 58%,#f1b915);
  color:#080807;
  font-size:clamp(18px,3.6vw,27px);
  font-weight:1000;
  cursor:pointer;
  box-shadow:0 18px 44px rgba(244,197,66,.20);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  gap:12px;
}
.btn.submit:disabled{ opacity:.68; cursor:not-allowed; }
.ap-muted{ color:rgba(247,247,247,.58); }
.ap-small{ font-size:clamp(14px,2.8vw,18px); text-align:center; }
.ap-centered{ text-align:center; }
.ap-account-select{ display:grid; gap:24px; }
.ap-register-steps{
  display:flex;
  align-items:center;
  justify-content:center;
  gap:12px;
  color:rgba(247,247,247,.58);
  flex-wrap:wrap;
}
.ap-register-steps span{
  width:36px;
  height:36px;
  border-radius:999px;
  display:grid;
  place-items:center;
  background:rgba(255,255,255,.08);
  color:rgba(247,247,247,.70);
  font-weight:1000;
}
.ap-register-steps span.active{ background:linear-gradient(135deg,#ffc414,#ffe47a); color:#080807; }
.ap-register-steps strong{ font-size:14px; }
.ap-choice-fieldset{ border:0; padding:0; margin:0; display:grid; gap:14px; }
.ap-choice-card{
  min-height:124px;
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:18px;
  border:1px solid rgba(255,255,255,.14);
  border-radius:20px;
  background:rgba(255,255,255,.035);
  padding:18px;
  cursor:pointer;
}
.ap-choice-card input{ position:absolute; opacity:0; pointer-events:none; }
.ap-choice-card.selected{
  border-color:rgba(255,211,83,.64);
  background:linear-gradient(135deg,rgba(244,197,66,.14),rgba(255,255,255,.04));
}
.ap-choice-icon{
  width:70px;
  height:70px;
  border-radius:999px;
  display:grid;
  place-items:center;
  color:var(--auth-gold-soft);
  border:1px solid rgba(255,211,83,.20);
  background:rgba(244,197,66,.08);
}
.ap-choice-copy strong{ display:block; font-size:clamp(20px,4vw,27px); font-weight:1000; }
.ap-choice-copy small{ display:block; margin-top:7px; color:rgba(247,247,247,.62); font-size:clamp(14px,3vw,20px); line-height:1.45; font-weight:700; }
.ap-choice-radio{
  width:30px;
  height:30px;
  border-radius:999px;
  border:2px solid rgba(247,247,247,.52);
  position:relative;
}
.ap-choice-card.selected .ap-choice-radio{ border-color:var(--auth-gold-soft); }
.ap-choice-card.selected .ap-choice-radio::after{
  content:"";
  position:absolute;
  inset:6px;
  border-radius:999px;
  background:var(--auth-gold-soft);
}
.ap-coach-note{
  border:1px solid rgba(255,211,83,.20);
  border-radius:16px;
  background:rgba(244,197,66,.07);
  color:rgba(247,247,247,.72);
  padding:12px 14px;
  font-size:14px;
  font-weight:800;
  line-height:1.35;
}
.ap-cta-arrow{ margin-top:2px; }
.ap-verify-actions{ display:flex; align-items:center; justify-content:center; gap:10px; margin-top:4px; flex-wrap:wrap; }
.ap-verify-hint{
  text-align:center;
  font-size:13px;
  color:rgba(247,247,247,.62);
  border:1px dashed rgba(255,255,255,.14);
  padding:10px 12px;
  border-radius:14px;
  background:rgba(255,255,255,.035);
}
.ap-verify-hint.locked{ border-color:rgba(255,107,107,.34); background:rgba(80,13,20,.30); color:#ffd1d1; }
.ap-verified-banner{
  display:flex;
  align-items:center;
  gap:12px;
  border:1px solid rgba(52,211,153,.28);
  background:rgba(5,56,38,.34);
  color:#c8f7df;
  padding:12px;
  border-radius:16px;
}
.ap-verified-ic{
  width:38px; height:38px;
  border-radius:13px;
  display:flex; align-items:center; justify-content:center;
  background:rgba(52,211,153,.12);
  border:1px solid rgba(52,211,153,.22);
  font-weight:1000;
  flex:0 0 auto;
}
.ap-verified-title{ margin:0; font-weight:1000; color:#c8f7df; }
.ap-verified-sub{ margin:4px 0 0; font-size:12px; color:#d9f8e8; }
.ap-foot{ padding:16px; text-align:center; border-top:1px solid rgba(255,255,255,.08); }
.ap-overlay{
  position:fixed; inset:0;
  background:rgba(2,5,8,.74);
  backdrop-filter:blur(8px) saturate(140%);
  display:flex; align-items:center; justify-content:center;
  z-index:9999; padding:18px;
}
.ap-overlay-card{
  width:min(520px,100%);
  border:1px solid rgba(255,211,83,.22);
  background:linear-gradient(180deg,#121923,#070b10);
  border-radius:22px;
  padding:18px 16px;
  position:relative;
  overflow:hidden;
  box-shadow:0 22px 80px rgba(0,0,0,.70);
}
.ap-overlay-glow{
  position:absolute; inset:-2px;
  background:radial-gradient(600px 200px at 20% 0%, rgba(245,215,110,.18), transparent 60%);
  pointer-events:none;
}
.ap-overlay-row{ display:flex; align-items:center; gap:12px; position:relative; }
.ap-spinner{
  width:44px; height:44px; border-radius:50%;
  border:3px solid rgba(245,215,110,.18);
  border-top-color:rgba(245,215,110,.95);
  animation:apSpin .9s linear infinite;
  flex:0 0 auto;
}
@keyframes apSpin{ to{ transform:rotate(360deg); } }
.ap-oload-title{ font-weight:1000; margin:0; color:var(--auth-gold-soft); font-size:16px; }
.ap-oload-sub{ margin:4px 0 0; color:rgba(247,247,247,.74); font-size:13px; line-height:1.4; }
.ap-shimmer{
  margin-top:14px; height:10px; border-radius:999px;
  background:rgba(255,255,255,.06);
  overflow:hidden; position:relative;
}
.ap-shimmer::after{
  content:""; position:absolute; inset:0;
  transform:translateX(-60%);
  background:linear-gradient(90deg,transparent,rgba(245,215,110,.35),transparent);
  animation:apShimmer 1.2s ease-in-out infinite;
}
@keyframes apShimmer{ 0%{ transform:translateX(-60%); } 100%{ transform:translateX(160%); } }
.ap-eye{ display:block; color:var(--auth-gold-soft); }
@media (min-width:1024px){
  .auth-page{
    display:grid;
    grid-template-columns:minmax(0,1fr) minmax(440px,520px);
    align-items:stretch;
  }
  .ap-nav{ grid-column:1; }
  .ap-hero{
    grid-column:1;
    min-height:100dvh;
    align-content:center;
    border-right:1px solid rgba(255,255,255,.08);
    border-bottom:0;
    padding:120px 42px;
  }
  .ap-tabs-wrap{
    grid-column:2;
    width:100%;
    margin:0;
    padding:34px 28px 0;
    align-self:end;
  }
  .ap-main{
    grid-column:2;
    width:100%;
    padding:0 28px 28px;
    align-self:start;
  }
  .ap-card{ border-radius:0 0 28px 28px; padding:34px; }
  .ap-foot{ display:none; }
}
@media (max-width:640px){
  .ap-nav-inner{ padding:12px 14px; }
  .ap-brandLogo .brand-logo-img{ height:40px; max-width:170px; }
  .ap-hero{
    min-height:220px;
    padding:78px 14px 48px;
    background-position:58% top;
  }
  .ap-tabs-wrap{ margin-top:-28px; padding-inline:10px; }
  .ap-tabs{ border-radius:18px; padding:5px; }
  .ap-tab{ min-height:54px; border-radius:14px; }
  .ap-main{ padding-inline:10px; }
  .ap-card{ padding:22px 18px; border-radius:0 0 24px 24px; }
  .ap-row-between{ align-items:flex-start; flex-direction:column; }
  .ap-choice-card{ grid-template-columns:1fr auto; min-height:auto; }
  .ap-choice-icon{ width:54px; height:54px; grid-column:1; }
  .ap-choice-copy{ grid-column:1 / 2; }
  .ap-choice-radio{ grid-column:2; grid-row:1 / span 2; }
}
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


