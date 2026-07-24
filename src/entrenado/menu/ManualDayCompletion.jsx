import React, { useEffect, useRef } from "react";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Route, X } from "lucide-react";

import { manualDayStatusText } from "../../tracking/manualDayCompletion.js";

function format(value = 0, digits = 0) {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function configuredMacroItems(progress = {}) {
  const remaining = progress.remaining || {};
  return [
    { key: "proteina", label: "Proteína", short: "P", value: remaining.proteina },
    { key: "carbs", label: "Carbohidratos", short: "C", value: remaining.carbs },
    { key: "grasas", label: "Grasas", short: "G", value: remaining.grasas },
  ].filter((item) => progress?.configured?.[item.key]);
}

export function ManualDayCompletionBanner({
  active = false,
  completed = 0,
  total = 0,
  onStart,
  onOpenTracking,
  disabled = false,
}) {
  if (active) {
    return (
      <section className="mx-3 rounded-[1.45rem] border border-emerald-300/20 bg-[linear-gradient(135deg,rgba(16,185,129,.13),rgba(255,255,255,.035))] p-3.5 shadow-[0_16px_42px_rgba(0,0,0,.22)] sm:mx-0 sm:p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-emerald-200/25 bg-emerald-300/10 text-emerald-100">
            <CheckCircle2 size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-100/70">
              Estado del día
            </span>
            <h2 className="mt-0.5 text-base font-black text-white">
              Continuaste el resto del día por tu cuenta
            </h2>
            <p className="mt-1 text-xs font-bold leading-relaxed text-zinc-400">
              El menú conserva {completed} de {total} comidas realizadas. Tus próximos registros se cargan en Tracking.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenTracking}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-emerald-200/25 bg-emerald-300/10 px-4 text-sm font-black text-emerald-50 transition hover:bg-emerald-300/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-200 sm:w-auto"
        >
          Ir al Tracking Diario
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      </section>
    );
  }

  return (
    <section className="mx-3 rounded-[1.45rem] border border-[#D4AF37]/24 bg-[linear-gradient(135deg,rgba(212,175,55,.12),rgba(255,255,255,.035))] p-3.5 shadow-[0_16px_42px_rgba(0,0,0,.22)] sm:mx-0 sm:p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[#D4AF37]/28 bg-[#D4AF37]/10 text-[#FFE8A3]">
          <Route size={21} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#FFE8A3]/70">
            {completed} de {total} comidas realizadas
          </span>
          <h2 className="mt-0.5 text-base font-black text-white">Seguir por mi cuenta</h2>
          <p className="mt-1 text-xs font-bold leading-relaxed text-zinc-400">
            Completá el resto del día con tracking manual.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onStart}
        disabled={disabled}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFE8A3] to-[#D4AF37] px-4 text-sm font-black text-[#090909] shadow-[0_12px_28px_rgba(212,175,55,.16)] transition hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE8A3] disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto"
      >
        Seguir por mi cuenta
        <ArrowRight size={17} aria-hidden="true" />
      </button>
    </section>
  );
}

export function ManualDayCompletionDialog({
  state,
  saving = false,
  onCancel,
  onRetry,
  onConfirm,
}) {
  const panelRef = useRef(null);
  const cancelRef = useRef(null);
  const openerRef = useRef(null);
  const completed = state?.completed || 0;
  const total = state?.total || 0;
  const pending = Math.max(0, total - completed);
  const progress = state?.progress || null;
  const macroItems = progress ? configuredMacroItems(progress) : [];

  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelRef.current?.focus();

    function onKeyDown(event) {
      if (event.key === "Escape" && !saving) {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = [...panelRef.current.querySelectorAll(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      openerRef.current?.focus?.();
    };
  }, [onCancel, saving]);

  return (
    <section
      className="fixed inset-0 z-[140] flex items-end justify-center bg-black/78 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-8 backdrop-blur-md sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="manual-day-completion-title"
      aria-describedby="manual-day-completion-description"
    >
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        onClick={saving ? undefined : onCancel}
        aria-label="Cerrar confirmación"
      />
      <div
        ref={panelRef}
        className="relative w-full max-w-lg overflow-hidden rounded-[1.7rem] border border-[#D4AF37]/22 bg-[radial-gradient(circle_at_18%_0,rgba(212,175,55,.18),transparent_35%),linear-gradient(180deg,#111922,#080d12)] p-4 shadow-[0_30px_95px_rgba(0,0,0,.74)] sm:p-5"
      >
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#FFE8A3]/75">
              {completed ? `${completed} de ${total} comidas realizadas` : "Menú del día"}
            </span>
            <h2 id="manual-day-completion-title" className="mt-1 text-xl font-black leading-tight text-white">
              Completar el día por tu cuenta
            </h2>
            <p id="manual-day-completion-description" className="mt-2 text-sm font-bold leading-relaxed text-zinc-300">
              {completed
                ? `Ya realizaste ${completed} de ${total} comidas del menú.`
                : "No registraste comidas del menú todavía. Podés continuar el día registrando por tu cuenta."}
            </p>
          </div>
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.045] text-zinc-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#FFE8A3] disabled:opacity-55"
            aria-label="Cancelar"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {state?.loading ? (
          <div className="mt-4 grid gap-2" aria-live="polite">
            <div className="h-20 animate-pulse rounded-3xl bg-white/[0.065]" />
            <div className="grid grid-cols-3 gap-2">
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
              <div className="h-14 animate-pulse rounded-2xl bg-white/[0.05]" />
            </div>
            <span className="sr-only">Calculando objetivo nutricional restante</span>
          </div>
        ) : state?.error ? (
          <div className="mt-4 rounded-3xl border border-rose-300/25 bg-rose-300/10 p-3.5" role="alert">
            <strong className="block text-sm font-black text-rose-100">No pudimos calcular el restante</strong>
            <p className="mt-1 text-xs font-bold leading-relaxed text-rose-100/75">{state.error}</p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-2xl border border-rose-200/25 bg-black/15 px-3 text-xs font-black text-rose-50"
            >
              <RefreshCw size={15} aria-hidden="true" />
              Reintentar
            </button>
          </div>
        ) : progress ? (
          <>
            <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-3.5">
              <span className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-500">Tenés aproximadamente</span>
              <strong className="mt-1 block text-2xl font-black text-white">
                {progress.configured?.kcal ? `${format(Math.max(0, progress.remaining.kcal))} kcal restantes` : "Objetivo sin configurar"}
              </strong>
              <p className="mt-1 text-xs font-bold text-zinc-400">{manualDayStatusText(progress)}</p>
              {macroItems.length ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {macroItems.map((item) => (
                    <span key={item.key} className="rounded-2xl border border-white/10 bg-white/[0.045] px-2 py-2 text-center">
                      <small className="block text-[9px] font-black uppercase text-zinc-500">{item.short}</small>
                      <strong className="mt-0.5 block text-xs font-black text-zinc-100">
                        {format(Math.max(0, item.value), 1)} g
                      </strong>
                      <span className="sr-only">{item.label} restante</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs font-bold text-zinc-500">No hay objetivos de macros configurados.</p>
              )}
            </div>

            <p className="mt-3 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5 text-xs font-bold leading-relaxed text-zinc-400">
              Las {pending} comida{pending === 1 ? "" : "s"} pendiente{pending === 1 ? "" : "s"} no se marcarán como realizadas ni se copiarán al Tracking.
            </p>
          </>
        ) : null}

        <footer className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-[.85fr_1.15fr]">
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="min-h-12 rounded-2xl border border-white/10 bg-white/[0.045] px-4 text-sm font-black text-zinc-100 disabled:opacity-55"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={saving || state?.loading || Boolean(state?.error) || !progress}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#FFE8A3] to-[#D4AF37] px-4 text-sm font-black text-[#080808] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {saving ? <Loader2 size={17} className="animate-spin" aria-hidden="true" /> : null}
            {saving ? "Guardando..." : "Seguir por mi cuenta"}
          </button>
        </footer>
      </div>
    </section>
  );
}
