// src/entrenado/InicioEntrenado.jsx
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Apple, CalendarDays, CheckCircle2, Dumbbell, Target, TrendingUp, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { getCachedUser } from "../authCache.js";
import { useAuthMe } from "../authQueries.js";
import {
  CLIENT_ACCESS_CONTEXT_STALE_TIME,
  CLIENT_PLAN_CAPABILITIES_STALE_TIME,
  capabilitiesFromResolvedAccess,
  clientAccessContextKey,
  clientPlanCapabilitiesKey,
  clientPlanMenusUsageKey,
  fetchClientAccessContext,
  fetchClientPlanCapabilities,
  fetchClientPlanMenusUsage,
} from "../clientPlans/clientPlanQueries.js";
import {
  clientPlanLabel,
  ownMenusUsage,
  planFromCapabilities,
} from "../clientPlans/clientPlanUtils.js";
import { normalizeGoalFromUser } from "../clientNutrition/nutritionState.js";
import { assignmentFlexibleCalories } from "../menus/menuAssignmentCompatibility.js";
import {
  flexibleMarginEntries,
  flexibleMarginRemaining,
  flexibleMarginTotals,
  isFlexibleMarginCompleted,
} from "../menus/flexibleMarginTracking.js";
import { createNavigationPrefetchHandlers } from "../routes/routePrefetch.js";
import { getMenuTrackingWeek } from "../tracking/trackingApi.js";

const CSS = `
*{ box-sizing:border-box; }

html, body, #root{
  margin:0;
  padding:0;
  width:100%;
}

.wrap{
  --accent-primary:#f5d76e;
  --accent-strong:#facc15;
  --surface-card:#101820;
  --surface-card-2:#07090c;
  --border-soft:rgba(255,255,255,.10);
  color:#eaeaea;
  width:100%;
  max-width:none;
  margin:0;
  padding:0;
}

.card{
  border:1px solid #232323;
  background:
    radial-gradient(700px 220px at 0% 0%, rgba(245,215,110,.10), transparent 56%),
    linear-gradient(180deg,#141414,#0f0f0f);
  border-radius:16px;
  padding:14px;
}

.heroCard{
  border-color:rgba(245,215,110,.24);
  background:
    radial-gradient(520px 220px at 100% 0%, rgba(245,215,110,.16), transparent 58%),
    radial-gradient(420px 200px at 0% 0%, rgba(45,212,191,.07), transparent 58%),
    linear-gradient(145deg,#141a20,#07090c);
  box-shadow:0 18px 46px rgba(0,0,0,.32);
}

.h1{
  font-size: 26px;
  font-weight: 900;
  margin: 0 0 8px;
  line-height: 1.1;
}

.p{
  margin:0;
  color:#cfcfcf;
  line-height:1.42;
}

.grid{
  margin-top: 14px;
  display:grid;
  gap: 12px;
  grid-template-columns: 1fr;
}

@media (min-width: 900px){
  .grid{
    grid-template-columns: 1fr 1fr;
  }
}

.kicker{
  margin-top: 10px;
  color:#f5d76e;
  font-weight: 900;
  font-size: 12px;
  letter-spacing: .06em;
  text-transform: uppercase;
}

.homeTopline{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  margin-bottom:12px;
}

.homePlanPill{
  display:inline-flex;
  align-items:center;
  width:max-content;
  max-width:100%;
  border:1px solid rgba(245,215,110,.28);
  background:rgba(245,215,110,.10);
  color:#ffe89b;
  border-radius:999px;
  padding:7px 10px;
  font-size:11px;
  font-weight:950;
  text-transform:uppercase;
}

.heroActions,
.homeActionsRow{
  margin-top:14px;
  display:grid;
  grid-template-columns:1fr;
  gap:9px;
}

.heroActions button,
.cardAction{
  min-height:42px;
  border:0;
  border-radius:13px;
  background:linear-gradient(135deg,#facc15,#f5d76e);
  color:#070707;
  padding:0 13px;
  font-weight:950;
  cursor:pointer;
}

.heroActions button.secondary{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.055);
  color:#f7f7f7;
}

.cardAction.secondary{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.055);
  color:#f7f7f7;
}

.homeCardTitle{
  display:flex;
  align-items:center;
  gap:10px;
  font-size:17px;
}

.nextActionCard{
  margin-top:14px;
  border-color:rgba(245,215,110,.28);
  background:
    radial-gradient(520px 220px at 100% 0%, rgba(245,215,110,.13), transparent 56%),
    linear-gradient(145deg,#111820,#070b10);
}

.nextActionCard .homeCardTitle{
  font-size:18px;
}

.nextActionCard .cardAction{
  width:100%;
}

@keyframes followupEnter{
  0%{ opacity:0; transform:translateY(8px) scale(.985); }
  58%{ opacity:1; transform:translateY(-1px) scale(1.003); }
  100%{ opacity:1; transform:translateY(0) scale(1); }
}

@keyframes followupAttentionGlow{
  0%,100%{
    border-color:rgba(251,146,60,.34);
    box-shadow:0 16px 42px rgba(0,0,0,.30), 0 0 0 rgba(251,113,133,0);
  }
  45%{
    border-color:rgba(251,146,60,.54);
    box-shadow:0 18px 48px rgba(0,0,0,.34), 0 0 30px rgba(251,146,60,.17), 0 0 22px rgba(251,113,133,.10);
  }
}

@keyframes followupRailPulse{
  0%,100%{ opacity:.88; filter:saturate(1); }
  50%{ opacity:1; filter:saturate(1.28) drop-shadow(0 0 8px rgba(251,146,60,.38)); }
}

@keyframes followupChipPulse{
  0%,100%{ transform:translateY(0); box-shadow:0 0 0 rgba(251,146,60,0); }
  50%{ transform:translateY(-1px); box-shadow:0 0 18px rgba(251,146,60,.16); }
}

.followupCard{
  margin-top:14px;
  position:relative;
  overflow:hidden;
  border-color:rgba(251,146,60,.34);
  background:
    radial-gradient(460px 190px at 0% 0%, rgba(251,113,133,.14), transparent 56%),
    radial-gradient(520px 180px at 100% 0%, rgba(251,146,60,.18), transparent 58%),
    radial-gradient(340px 150px at 22% 110%, rgba(45,212,191,.08), transparent 58%),
    linear-gradient(145deg,#101820,#080b10);
  box-shadow:0 16px 42px rgba(0,0,0,.30), 0 0 24px rgba(251,146,60,.08);
  animation:followupEnter .42s cubic-bezier(.2,.82,.2,1) both, followupAttentionGlow 1.35s ease-in-out .18s 2;
  will-change:transform, box-shadow;
}

.followupCard::before{
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:4px;
  background:linear-gradient(180deg,#fb7185,#fb923c 46%,#f5d76e);
  opacity:.88;
  animation:followupRailPulse 1.35s ease-in-out .18s 2;
}

.followupInner{
  position:relative;
  display:grid;
  grid-template-columns:auto minmax(0,1fr) auto;
  gap:12px;
  align-items:start;
}

.followupIcon{
  width:38px;
  height:38px;
  border-radius:14px;
  display:grid;
  place-items:center;
  border:1px solid rgba(251,146,60,.34);
  background:linear-gradient(145deg,rgba(251,146,60,.14),rgba(251,113,133,.08));
  color:#ffd18a;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
}

.followupCopy{
  min-width:0;
}

.followupEyebrow{
  display:inline-flex;
  align-items:center;
  gap:6px;
  width:max-content;
  max-width:100%;
  border:1px solid rgba(251,146,60,.30);
  border-radius:999px;
  background:rgba(251,146,60,.105);
  color:#ffd6a6;
  padding:5px 8px;
  font-size:10px;
  font-weight:950;
  letter-spacing:.08em;
  text-transform:uppercase;
  animation:followupChipPulse 1.35s ease-in-out .22s 2;
}

.followupTitle{
  display:block;
  margin-top:3px;
  color:#fff;
  font-size:18px;
  font-weight:950;
  line-height:1.12;
}

.followupText{
  margin:7px 0 0;
  color:rgba(255,255,255,.78);
  font-size:13px;
  font-weight:800;
  line-height:1.4;
}

.followupText strong{
  color:#fff3b0;
}

.followupMeta{
  margin-top:9px;
  display:flex;
  flex-wrap:wrap;
  gap:7px;
}

.followupMeta span{
  display:inline-flex;
  align-items:center;
  min-height:25px;
  border:1px solid rgba(251,146,60,.18);
  background:rgba(255,255,255,.045);
  color:rgba(255,245,232,.80);
  border-radius:999px;
  padding:0 8px;
  font-size:11px;
  font-weight:900;
}

.followupActions{
  margin-top:12px;
  display:grid;
  grid-template-columns:1fr;
  gap:8px;
}

.followupPrimary,
.followupSecondary,
.followupClose{
  border:0;
  cursor:pointer;
  font-weight:950;
}

.followupPrimary,
.followupSecondary{
  min-height:40px;
  border-radius:13px;
  padding:0 12px;
}

.followupPrimary{
  background:linear-gradient(135deg,#fb923c,#facc15 55%,#f5d76e);
  color:#080808;
  box-shadow:0 12px 24px rgba(251,146,60,.18);
}

.followupSecondary{
  border:1px solid rgba(255,255,255,.12);
  background:rgba(255,255,255,.045);
  color:#f7f7f7;
}

.followupClose{
  width:32px;
  height:32px;
  border-radius:12px;
  display:grid;
  place-items:center;
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.045);
  color:rgba(255,255,255,.72);
}

@media (prefers-reduced-motion: reduce){
  .followupCard,
  .followupCard::before,
  .followupEyebrow{
    animation:none;
    will-change:auto;
  }
}

@media (min-width:680px){
  .followupActions{
    grid-template-columns:max-content max-content;
  }
}

@media (max-width:420px){
  .followupInner{
    grid-template-columns:auto minmax(0,1fr);
  }
  .followupClose{
    grid-column:2;
    grid-row:1;
    justify-self:end;
  }
  .followupCopy{
    grid-column:1 / -1;
  }
}

.homeCardTitle svg{
  width:34px;
  height:34px;
  border-radius:13px;
  border:1px solid rgba(245,215,110,.20);
  background:rgba(245,215,110,.08);
  color:#f5d76e;
  padding:8px;
}

.objectiveHomeCard{
  border-color:rgba(245,215,110,.24);
  background:
    radial-gradient(520px 220px at 100% 0%, rgba(245,215,110,.14), transparent 58%),
    linear-gradient(145deg,#111820,#080c12);
}

.homeKcalValue{
  margin-top:16px;
  color:#f5d76e;
  font-size:28px;
  font-weight:950;
  line-height:1;
}

.homeMacroGrid{
  margin-top:14px;
  display:grid;
  grid-template-columns:repeat(3, minmax(0, 1fr));
  gap:10px;
}

.homeMacro{
  min-width:0;
  display:grid;
  gap:7px;
}

.homeMacro span{
  color:rgba(255,255,255,.82);
  font-size:12px;
  font-weight:900;
}

.homeEmptyNote{
  margin-top:12px;
  border:1px dashed rgba(245,215,110,.24);
  border-radius:14px;
  background:rgba(245,215,110,.055);
  padding:12px;
  color:rgba(255,255,255,.76);
  font-size:13px;
  font-weight:800;
  line-height:1.4;
}

.homeMacro strong{
  color:#f8fafc;
  font-size:13px;
}

.homeMacro i{
  height:5px;
  border-radius:999px;
  overflow:hidden;
  background:rgba(255,255,255,.10);
  position:relative;
}

.homeMacro i::after{
  content:"";
  position:absolute;
  inset:0 auto 0 0;
  width:var(--fill, 0%);
  border-radius:inherit;
  background:#60a5fa;
}

.homeMacro.green i::after{ background:#4ade80; }
.homeMacro.violet i::after{ background:#a78bfa; }

.homeCardMeta{
  margin-top:8px;
  display:flex;
  flex-wrap:wrap;
  gap:7px;
}

.homeCardMeta span{
  border:1px solid rgba(255,255,255,.10);
  background:rgba(255,255,255,.045);
  color:rgba(255,255,255,.74);
  border-radius:999px;
  padding:6px 8px;
  font-size:11px;
  font-weight:900;
}

.planMuted{
  margin-top:12px;
  display:inline-flex;
  width:100%;
  min-height:42px;
  align-items:center;
  border:1px solid rgba(255,255,255,.08);
  border-radius:13px;
  background:rgba(255,255,255,.04);
  padding:0 11px;
  color:rgba(255,255,255,.70);
  font-size:12px;
  font-weight:850;
}

.trialActive{
  margin-top:12px;
  border:1px solid rgba(245,215,110,.25);
  background:
    radial-gradient(420px 180px at 100% 0%, rgba(245,215,110,.18), transparent 58%),
    linear-gradient(145deg, rgba(17,24,31,.96), rgba(6,9,13,.98));
  border-radius:16px;
  padding:12px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:10px;
}

.trialActive strong{
  color:#fff4bd;
  display:block;
  font-size:14px;
}

.trialActive span{
  color:rgba(255,255,255,.72);
  display:block;
  margin-top:3px;
  font-size:12px;
  font-weight:800;
}

.trialActive button{
  flex:0 0 auto;
  min-height:38px;
  border:1px solid rgba(245,215,110,.25);
  border-radius:12px;
  background:rgba(245,215,110,.10);
  color:#f5d76e;
  padding:0 12px;
  font-weight:950;
}

@media (max-width:520px){
  .trialActive{
    align-items:stretch;
    flex-direction:column;
  }
  .trialActive button{
    width:100%;
  }
}

@media (min-width:720px){
  .heroActions,
  .homeActionsRow{
    grid-template-columns:max-content max-content;
  }
}
`;

function titleCaseFirstName(fullName) {
  const s = String(fullName || "").trim();
  if (!s) return "";
  const first = s.split(/\s+/)[0];
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

function formatHomeDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function barWidth(value, max) {
  if (value === null || value === undefined || value === "") return "0%";
  const number = Number(value);
  if (!Number.isFinite(number) || !max) return "0%";
  return `${Math.max(6, Math.min(100, Math.round((number / max) * 100)))}%`;
}

function todayLocalDateKey() {
  return dateKeyFromLocalDate(new Date());
}

function dateKeyFromLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(dateKey = "") {
  const match = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function addDaysKey(dateKey, amount) {
  const date = parseDateKey(dateKey);
  if (!date) return "";
  date.setDate(date.getDate() + amount);
  return dateKeyFromLocalDate(date);
}

function mondayOfWeekKey(dateKey) {
  const date = parseDateKey(dateKey);
  if (!date) return todayLocalDateKey();
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return dateKeyFromLocalDate(date);
}

function formatDayReference(dateKey, todayDateKey, { short = false } = {}) {
  const yesterday = addDaysKey(todayDateKey, -1);
  if (dateKey === yesterday) return "ayer";
  const date = parseDateKey(dateKey);
  if (!date) return "ese día";
  const label = date.toLocaleDateString("es-AR", { weekday: short ? "short" : "long", day: short ? undefined : "2-digit", month: short ? undefined : "2-digit" });
  return label ? label.charAt(0).toUpperCase() + label.slice(1).replace(".", "") : "ese día";
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function readTotal(source = {}, keys = []) {
  if (!source || typeof source !== "object") return 0;
  const lower = Object.entries(source).reduce((acc, [key, value]) => {
    acc[String(key).toLowerCase()] = value;
    return acc;
  }, {});
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null && source[key] !== "") return numberValue(source[key]);
    const value = lower[String(key).toLowerCase()];
    if (value !== undefined && value !== null && value !== "") return numberValue(value);
  }
  return 0;
}

function totalsFromAny(value = {}) {
  const source = value?.totals || value?.totales || value?.macros || value?.nutrition || value?.nutricion || value || {};
  return {
    kcal: readTotal(source, ["kcal", "calories", "calorias", "cal"]),
    proteina: readTotal(source, ["proteina", "proteinas", "protein", "p"]),
    carbs: readTotal(source, ["carbs", "carbohidratos", "carbohydrates", "hidratos", "c"]),
    grasas: readTotal(source, ["grasas", "grasa", "fat", "fats", "g"]),
  };
}

function hasAnyTotals(totals = {}) {
  const safeTotals = totalsFromAny(totals);
  return ["kcal", "proteina", "carbs", "grasas"].some((key) => Math.abs(safeTotals[key]) > 0.001);
}

function addTotals(left = {}, right = {}) {
  const a = totalsFromAny(left);
  const b = totalsFromAny(right);
  return {
    kcal: a.kcal + b.kcal,
    proteina: a.proteina + b.proteina,
    carbs: a.carbs + b.carbs,
    grasas: a.grasas + b.grasas,
  };
}

function sumTotals(items = []) {
  return items.reduce((acc, item) => addTotals(acc, item?.totals || item), { kcal: 0, proteina: 0, carbs: 0, grasas: 0 });
}

function targetTotalsFromRow(row = {}) {
  const target = row?.target || row?.objetivo || {};
  const proteina = numberValue(target.p ?? target.proteina ?? target.protein);
  const carbs = numberValue(target.c ?? target.carbs ?? target.carbohidratos);
  const grasas = numberValue(target.g ?? target.grasas ?? target.fat);
  const explicitKcal = numberValue(target.kcal ?? target.calories ?? target.calorias);
  const derivedKcal = hasAnyTotals({ proteina, carbs, grasas }) ? (proteina * 4) + (carbs * 4) + (grasas * 9) : 0;
  return { kcal: explicitKcal || derivedKcal, proteina, carbs, grasas };
}

function menuChoicesFromRow(row = {}) {
  const choices = [];
  const primary = row?.assignment?.primaryMenu;
  if (primary?.menuSnapshot) {
    choices.push({
      key: primary.menuId || primary.menuSnapshot.id || "primary",
      type: "primary",
      snapshot: primary.menuSnapshot,
      assignment: primary,
      totals: row?.menuTotals || primary.menuSnapshot.totals || primary.menuSnapshot,
    });
  }
  const alternatives = Array.isArray(row?.assignment?.alternatives) ? row.assignment.alternatives : [];
  alternatives.forEach((alternative, index) => {
    const snapshot = alternative?.menuSnapshot || {};
    if (!snapshot || !Object.keys(snapshot).length) return;
    choices.push({
      key: alternative.menuId || snapshot.id || `alternative-${index}`,
      type: "alternative",
      index,
      snapshot,
      assignment: alternative,
      totals: snapshot.totals || snapshot,
    });
  });
  return choices;
}

function selectedChoiceFromRow(row = {}) {
  const choices = menuChoicesFromRow(row);
  const selectedIndex = Number(row?.tracking?.selectedAlternative?.index);
  if (Number.isInteger(selectedIndex) && selectedIndex >= 0) {
    return choices.find((choice) => choice.type === "alternative" && choice.index === selectedIndex) || choices[0] || null;
  }
  return choices[0] || null;
}

function snapshotMeals(snapshot = {}) {
  if (Array.isArray(snapshot?.meals)) return snapshot.meals;
  if (Array.isArray(snapshot?.comidas)) return snapshot.comidas;
  return [];
}

function mealItems(meal = {}) {
  if (Array.isArray(meal.items)) return meal.items;
  if (Array.isArray(meal.foods)) return meal.foods;
  if (Array.isArray(meal.alimentos)) return meal.alimentos;
  if (Array.isArray(meal.ingredientes)) return meal.ingredientes;
  if (Array.isArray(meal.ingredients)) return meal.ingredients;
  return [];
}

function mealTotals(meal = {}) {
  const direct = totalsFromAny(meal.totales || meal.totals || meal);
  if (hasAnyTotals(direct)) return direct;
  return sumTotals(mealItems(meal));
}

function mealHasContent(meal = {}) {
  return mealItems(meal).length > 0 || hasAnyTotals(mealTotals(meal));
}

function mealId(meal = {}, index = 0) {
  return String(meal.id || meal._id || meal.nombre || meal.name || `meal-${index + 1}`);
}

function choiceMeals(choice = {}) {
  return choice?.snapshot ? snapshotMeals(choice.snapshot) : [];
}

function choiceTotals(choice = {}) {
  const direct = totalsFromAny(choice?.totals || choice?.snapshot || {});
  if (hasAnyTotals(direct)) return direct;
  return sumTotals(choiceMeals(choice).map(mealTotals));
}

function flexiblePlanForFollowup(row = {}, choice = {}) {
  if (!choice?.snapshot) return null;
  const assignment = choice.assignment || row?.assignment?.primaryMenu || {};
  const target = targetTotalsFromRow(row);
  const planned = choiceTotals(choice);
  const flexibleCalories = assignmentFlexibleCalories(assignment, target, planned);
  if (!(flexibleCalories > 0)) return null;
  return { flexibleCalories, target, planned };
}

function uniqueSortedRecentDays(weekPayloads = []) {
  const byDate = new Map();
  weekPayloads.forEach((payload) => {
    (payload?.days || []).forEach((day) => {
      if (day?.date) byDate.set(day.date, day);
    });
  });
  return [...byDate.values()].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function trackingStarted(row = {}) {
  const tracking = row?.tracking || {};
  return [
    tracking.completedMenuMealIds,
    tracking.manualEntries,
    tracking.generatedRemainingMeals,
    tracking.mealReplacements,
    tracking.foodReplacements,
  ].some((value) => Array.isArray(value) && value.length > 0) ||
    ["in_progress", "partial", "exceeded"].includes(String(tracking.status || "").toLowerCase());
}

function buildDayFollowupState(row = {}) {
  const choice = selectedChoiceFromRow(row);
  const meals = choiceMeals(choice).filter(mealHasContent);
  const completedIds = new Set(Array.isArray(row?.tracking?.completedMenuMealIds) ? row.tracking.completedMenuMealIds.map(String) : []);
  const completedMeals = meals.filter((meal, index) => completedIds.has(mealId(meal, index))).length;
  const totalMeals = meals.length;
  const hasMenu = totalMeals > 0;
  const hasPendingMeals = hasMenu && completedMeals < totalMeals;

  const flexiblePlan = flexiblePlanForFollowup(row, choice);
  const hasFlexibleMargin = !!flexiblePlan;
  const flexibleCompleted = hasFlexibleMargin && isFlexibleMarginCompleted(row);
  const flexibleRegistered = flexibleMarginTotals(row).kcal;
  const flexibleRemainingKcal = hasFlexibleMargin ? Math.max(0, Math.round(flexibleMarginRemaining(flexiblePlan, row))) : 0;
  const flexibleHasEntries = flexibleMarginEntries(row).length > 0;
  const hasPendingFlexibleMargin = hasFlexibleMargin && !flexibleCompleted && (
    flexibleRemainingKcal > 5 ||
    flexibleHasEntries ||
    flexibleRegistered > 0.5
  );
  const started = trackingStarted(row);
  const trackable = hasMenu || hasFlexibleMargin || started;
  const pending = hasPendingMeals || hasPendingFlexibleMargin;

  return {
    date: row?.date || "",
    row,
    trackable,
    pending,
    complete: trackable && !pending,
    meals: { completed: completedMeals, total: totalMeals, pending: hasPendingMeals },
    flexible: {
      available: hasFlexibleMargin,
      pending: hasPendingFlexibleMargin,
      remainingKcal: flexibleRemainingKcal,
      registeredKcal: Math.round(flexibleRegistered),
      completed: flexibleCompleted,
    },
  };
}

function planKindFromValue(plan = "", capabilities = {}) {
  const value = String(plan || capabilities?.plan || capabilities?.tier || "").toLowerCase();
  if (value.includes("vip")) return "vip";
  if (value.includes("pro")) return "pro";
  return "free";
}

function trackingHistoryLimit(capabilities = {}, planKind = "free") {
  const explicit = Number(capabilities?.limits?.trackingHistoryDays ?? capabilities?.trackingHistoryDays);
  if (Number.isFinite(explicit) && explicit > 0) return Math.max(1, Math.min(14, Math.round(explicit)));
  return planKind === "free" ? 7 : 14;
}

function pluralDays(count) {
  return `${count} dia${count === 1 ? "" : "s"}`;
}

function formatKcal(value) {
  const number = Math.round(Number(value) || 0);
  return `${new Intl.NumberFormat("es-AR").format(number)} kcal`;
}

function getPendingFollowupSummary({
  days,
  capabilities,
  todayDateKey,
  plan,
  coachControlsNutrition,
  hasObjective,
  isClientRole,
}) {
  if (!isClientRole || !hasObjective || !Array.isArray(days) || !days.length) return null;
  const planKind = planKindFromValue(plan, capabilities);
  const limit = trackingHistoryLimit(capabilities, planKind);
  const oldestDateKey = addDaysKey(todayDateKey, -(limit - 1));
  const recentStates = days
    .filter((day) => day?.date && day.date < todayDateKey && day.date >= oldestDateKey)
    .slice(0, limit)
    .map(buildDayFollowupState)
    .filter((state) => state.trackable);
  const pendingStates = recentStates.filter((state) => state.pending);
  if (!pendingStates.length) return null;

  const primary = pendingStates[0];
  const affectedDay = formatDayReference(primary.date, todayDateKey);
  const affectedDayTitle = affectedDay === "ayer" ? "ayer" : formatDayReference(primary.date, todayDateKey, { short: true });
  const completedDays = recentStates.filter((state) => state.complete).length;
  const totalDays = recentStates.length;
  const isPremiumSummary = planKind !== "free" && pendingStates.length > 1;
  const title = coachControlsNutrition
    ? "Seguimiento pendiente"
    : isPremiumSummary
      ? planKind === "vip" ? "Seguimiento semanal" : "Resumen de seguimiento"
      : "Retomar seguimiento";
  const eyebrow = coachControlsNutrition ? "Continuidad con coach" : "Seguimiento pendiente";
  const mealLine = primary.meals.total > 0
    ? `${affectedDay === "ayer" ? "Ayer" : affectedDayTitle} registraste ${primary.meals.completed} de ${primary.meals.total} comidas.`
    : `Te quedaron registros pendientes de ${affectedDay}.`;
  const flexibleLine = primary.flexible.pending && primary.flexible.remainingKcal > 0
    ? `Quedaron ${formatKcal(primary.flexible.remainingKcal)} libres sin cerrar.`
    : primary.flexible.pending
      ? "Quedaron calorias libres por cerrar."
      : "";
  const body = coachControlsNutrition
    ? [
        "Tenes registros recientes sin cerrar.",
        primary.meals.total > 0 ? `${affectedDay === "ayer" ? "Ayer" : affectedDayTitle} quedo en ${primary.meals.completed}/${primary.meals.total} comidas.` : "",
        "Podes completarlos o dejarlos como estan para que tu coach vea el seguimiento real.",
      ].filter(Boolean).join(" ")
    : isPremiumSummary
      ? `En los ultimos ${pluralDays(totalDays)} completaste ${completedDays} de ${totalDays}. Tenes ${pluralDays(pendingStates.length)} con registros pendientes.`
      : [mealLine, flexibleLine || "Podes completarlo o seguir con el dia de hoy."].join(" ");

  const meta = [];
  meta.push(affectedDay === "ayer" ? "Ayer" : affectedDayTitle);
  if (primary.meals.total > 0) meta.push(`${primary.meals.completed}/${primary.meals.total} comidas`);
  if (primary.flexible.pending) meta.push(primary.flexible.remainingKcal > 0 ? `${formatKcal(primary.flexible.remainingKcal)} libres` : "Calorias libres");
  if (coachControlsNutrition) meta.push("Coach");

  return {
    title,
    eyebrow,
    body,
    meta,
    targetDate: primary.date,
    pendingCount: pendingStates.length,
    primaryLabel: coachControlsNutrition
      ? "Completar pendiente"
      : isPremiumSummary
        ? planKind === "vip" ? "Revisar semana" : "Revisar pendientes"
        : affectedDay === "ayer" ? "Completar ayer" : "Completar dia",
    secondaryLabel: "Seguir con hoy",
    storageType: isPremiumSummary ? "weekly" : "recent",
  };
}

function userStorageId(user = {}) {
  return String(user?.id || user?._id || user?.email || "cliente");
}

function followupDismissKey(summary, user, todayDateKey) {
  if (!summary?.targetDate) return "";
  return `zumafit.dismissedPendingFollowup.${userStorageId(user)}.${todayDateKey}.${summary.targetDate}.${summary.storageType || "recent"}`;
}

function isFollowupDismissed(summary, user, todayDateKey) {
  const key = followupDismissKey(summary, user, todayDateKey);
  if (!key || typeof window === "undefined") return false;
  return window.localStorage.getItem(key) === "1";
}

function dismissFollowup(summary, user, todayDateKey) {
  const key = followupDismissKey(summary, user, todayDateKey);
  if (!key || typeof window === "undefined") return;
  window.localStorage.setItem(key, "1");
}

export default function InicioEntrenado() {
  const navigate = useNavigate();
  const [dismissedFollowupKey, setDismissedFollowupKey] = useState("");
  const user = useMemo(() => getCachedUser(), []);
  const todayDateKey = useMemo(() => todayLocalDateKey(), []);
  const currentWeekStart = useMemo(() => mondayOfWeekKey(todayDateKey), [todayDateKey]);
  const previousWeekStart = useMemo(() => addDaysKey(currentWeekStart, -7), [currentWeekStart]);
  const authMeQuery = useAuthMe({
    initialFromCache: true,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    staleTime: 45 * 1000,
  });
  const accessContextQuery = useQuery({
    queryKey: clientAccessContextKey,
    queryFn: fetchClientAccessContext,
    staleTime: CLIENT_ACCESS_CONTEXT_STALE_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
  });
  const accessCapabilities = capabilitiesFromResolvedAccess(accessContextQuery.data);
  const capabilitiesQuery = useQuery({
    queryKey: clientPlanCapabilitiesKey,
    queryFn: fetchClientPlanCapabilities,
    staleTime: CLIENT_PLAN_CAPABILITIES_STALE_TIME,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: accessContextQuery.isError,
  });
  const usageQuery = useQuery({
    queryKey: clientPlanMenusUsageKey,
    queryFn: fetchClientPlanMenusUsage,
    staleTime: 2 * 60 * 1000,
    retry: 1,
    enabled: !!(accessCapabilities || capabilitiesQuery.data),
  });

  const currentUser = useMemo(() => authMeQuery.data || user || {}, [authMeQuery.data, user]);
  const role = String(currentUser?.role || currentUser?.rol || "").toLowerCase();
  const isClientRole = !role || role === "cliente" || role === "client";
  const nombre = titleCaseFirstName(currentUser?.profile?.nombre || currentUser?.nombre || "");
  const titulo = nombre ? `Hola, ${nombre}` : "Hola";
  const summary = usageQuery.data || {};
  const capabilities = accessCapabilities || capabilitiesQuery.data || user?.nutritionCapabilities || null;
  const rawPlan = capabilities?.plan || currentUser?.nutritionCapabilities?.plan || currentUser?.plan;
  const plan = rawPlan ? planFromCapabilities(currentUser, capabilities) : "";
  const usage = ownMenusUsage(summary, capabilities);
  const usageKnown = usageQuery.isSuccess && Number.isFinite(Number(usage.used));
  const trial = accessContextQuery.data?.trial || null;
  const objective = normalizeGoalFromUser(currentUser);
  const hasObjective = objective.configured;
  const goalLoadFailed = authMeQuery.isError && !hasObjective;
  const accessContext = accessContextQuery.data || null;
  const authority = accessContext?.authority || {};
  const coachControlsNutrition =
    ["coach", "professional", "profesional"].includes(String(authority.nutrition || authority.menu || "").toLowerCase()) ||
    (!!accessContext?.hasCoach && String(authority.nutrition || "").toLowerCase() === "coach");
  const canLoadPendingFollowup = isClientRole && hasObjective;
  const currentMenuTrackingQuery = useQuery({
    queryKey: ["menuTrackingWeek", currentWeekStart],
    queryFn: () => getMenuTrackingWeek(currentWeekStart),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canLoadPendingFollowup,
  });
  const previousMenuTrackingQuery = useQuery({
    queryKey: ["menuTrackingWeek", previousWeekStart],
    queryFn: () => getMenuTrackingWeek(previousWeekStart),
    staleTime: 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
    enabled: canLoadPendingFollowup && previousWeekStart !== currentWeekStart,
  });
  const followupDays = useMemo(
    () => uniqueSortedRecentDays([currentMenuTrackingQuery.data, previousMenuTrackingQuery.data]),
    [currentMenuTrackingQuery.data, previousMenuTrackingQuery.data]
  );
  const rawPendingFollowup = useMemo(
    () => getPendingFollowupSummary({
      days: followupDays,
      capabilities,
      todayDateKey,
      plan,
      coachControlsNutrition,
      hasObjective,
      isClientRole,
    }),
    [capabilities, coachControlsNutrition, followupDays, hasObjective, isClientRole, plan, todayDateKey]
  );
  const pendingFollowup = useMemo(
    () => {
      if (!rawPendingFollowup) return null;
      const key = followupDismissKey(rawPendingFollowup, currentUser, todayDateKey);
      if (key && dismissedFollowupKey === key) return null;
      return isFollowupDismissed(rawPendingFollowup, currentUser, todayDateKey) ? null : rawPendingFollowup;
    },
    [currentUser, dismissedFollowupKey, rawPendingFollowup, todayDateKey]
  );
  const menuUsed = Number(usage.used || 0);
  const menuLimit = Number(usage.limit);
  const menuUsageText = usageKnown
    ? Number.isFinite(menuLimit)
      ? `${menuUsed} / ${menuLimit} menus`
      : `${menuUsed} menus`
    : "Uso de menus no disponible";
  const hasOwnMenu = usageKnown && menuUsed > 0;
  const nextAction = !hasObjective
    ? {
        title: "Completá tus objetivos",
        text: goalLoadFailed
          ? "No pudimos confirmar tu meta diaria ahora. Revisala para evitar planificar con datos incompletos."
          : "Defini tu meta diaria para que Menu, Tracking y Progreso trabajen sobre el mismo objetivo.",
        label: "Configurar objetivos",
        route: "/app/objetivos",
        icon: Target,
      }
    : !coachControlsNutrition && !hasOwnMenu
      ? {
          title: "Completá tu menú",
          text: "Ya tenes objetivos. Ahora arma tu dia base o segui usando Tracking mientras lo completas.",
          label: "Crear mi menú",
          route: "/app/menu/nuevo",
          icon: Apple,
          state: { from: "/app/inicio" },
        }
      : {
          title: "Tu menú de hoy",
          text: coachControlsNutrition
            ? "Tu coach gestiona el menu planificado. Usá Tracking para registrar lo que consumiste realmente."
            : "Revisa tu menu activo y marca comidas realizadas solo cuando corresponda.",
          label: "Ver menú del día",
          route: "/app/menu",
          icon: Apple,
        };
  const NextActionIcon = nextAction.icon;

  function dismissPendingFollowup() {
    if (!pendingFollowup) return;
    const key = followupDismissKey(pendingFollowup, currentUser, todayDateKey);
    dismissFollowup(pendingFollowup, currentUser, todayDateKey);
    setDismissedFollowupKey(key);
  }

  function openPendingFollowup() {
    if (!pendingFollowup?.targetDate) return;
    navigate(`/app/menu?date=${encodeURIComponent(pendingFollowup.targetDate)}`);
  }

  return (
    <div className="wrap">
      <style>{CSS}</style>

      <div className="card heroCard">
        <div className="homeTopline">
          <span className="homePlanPill">{rawPlan ? `Plan ${clientPlanLabel(plan)}` : "Plan no disponible"}</span>
        </div>

        <div className="kicker">Tu día en ZumaFit</div>
        <h1 className="h1">{titulo}</h1>

        <p className="p">
          Plan {rawPlan ? clientPlanLabel(plan) : "sin confirmar"} · {coachControlsNutrition ? "con coach" : "autogestionado"}.
        </p>

        <div className="heroActions">
          <button type="button" className="secondary" onClick={() => navigate("/app/planes")}>
            Ver mi plan
          </button>
        </div>

        {capabilitiesQuery.isError && !rawPlan ? (
          <div className="planMuted">No pudimos cargar tu plan ahora. Reintenta desde Mi plan.</div>
        ) : !rawPlan ? (
          <div className="planMuted">Cargando plan y limites...</div>
        ) : (
          <div className="homeCardMeta">
            <span>{coachControlsNutrition ? "Nutricion con coach" : "Autogestionado"}</span>
            <span>{hasObjective ? "Objetivos configurados" : "Objetivos pendientes"}</span>
            <span>{menuUsageText}</span>
          </div>
        )}

        {trial?.active ? (
          <div className="trialActive">
            <div>
              <strong>Prueba Pro activa - te quedan {trial.daysRemaining ?? trial.daysLeft ?? 0} dias</strong>
              <span>Finaliza el {formatHomeDate(trial.endsAt) || "dia indicado por el servidor"}</span>
            </div>
            <button type="button" onClick={() => navigate("/app/planes")}>
              Ver funciones Pro
            </button>
          </div>
        ) : null}
      </div>

      {pendingFollowup ? (
        <div className="card followupCard" role="status" aria-live="polite">
          <div className="followupInner">
            <span className="followupIcon" aria-hidden="true">
              <CalendarDays size={20} />
            </span>
            <div className="followupCopy">
              <span className="followupEyebrow"><CheckCircle2 size={13} /> {pendingFollowup.eyebrow}</span>
              <strong className="followupTitle">{pendingFollowup.title}</strong>
              <p className="followupText">{pendingFollowup.body}</p>
              {pendingFollowup.meta?.length ? (
                <div className="followupMeta" aria-label="Resumen de seguimiento pendiente">
                  {pendingFollowup.meta.map((item) => (
                    <span key={item}>{item}</span>
                  ))}
                </div>
              ) : null}
              <div className="followupActions">
                <button type="button" className="followupPrimary" onClick={openPendingFollowup}>
                  {pendingFollowup.primaryLabel}
                </button>
                <button type="button" className="followupSecondary" onClick={dismissPendingFollowup}>
                  {pendingFollowup.secondaryLabel}
                </button>
              </div>
            </div>
            <button type="button" className="followupClose" onClick={dismissPendingFollowup} aria-label="Ocultar aviso de seguimiento">
              <X size={16} />
            </button>
          </div>
        </div>
      ) : null}

      <div className="card nextActionCard">
        <strong className="homeCardTitle"><NextActionIcon aria-hidden="true" /> {nextAction.title}</strong>
        <p className="p" style={{ marginTop: 7 }}>{nextAction.text}</p>
        <div className="homeActionsRow">
          <button
            type="button"
            className="cardAction"
            onClick={() => navigate(nextAction.route, nextAction.state ? { state: nextAction.state } : undefined)}
            {...(nextAction.route === "/app/menu/nuevo" ? createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false }) : {})}
          >
            {nextAction.label}
          </button>
        </div>
      </div>

      <div className="grid">
        <div className="card objectiveHomeCard">
          <strong className="homeCardTitle"><Target aria-hidden="true" /> Objetivos</strong>
          {hasObjective ? (
            <>
              <div className="homeKcalValue">{objective.kcal} kcal</div>
              <div className="homeMacroGrid" aria-label="Macros objetivo">
                <span className="homeMacro">
                  <strong>P {objective.p ?? "-" } g</strong>
                  <i style={{ "--fill": barWidth(objective.p, 260) }} />
                </span>
                <span className="homeMacro green">
                  <strong>C {objective.c ?? "-" } g</strong>
                  <i style={{ "--fill": barWidth(objective.c, 520) }} />
                </span>
                <span className="homeMacro violet">
                  <strong>G {objective.g ?? "-" } g</strong>
                  <i style={{ "--fill": barWidth(objective.g, 170) }} />
                </span>
              </div>
            </>
          ) : (
            <div className="homeEmptyNote">
              {goalLoadFailed
                ? "No pudimos cargar tus objetivos completos. No vamos a mostrar 0 kcal como si fuera una meta real."
                : "Todavia no configuraste una meta diaria. Menu y Tracking pueden funcionar, pero el resumen queda pendiente."}
            </div>
          )}
          <div className="homeActionsRow">
            <button type="button" className={`cardAction ${hasObjective ? "secondary" : ""}`} onClick={() => navigate("/app/objetivos")}>
              {hasObjective ? "Ver objetivos" : "Configurar objetivos"}
            </button>
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><Apple aria-hidden="true" /> Menu de hoy</strong>
          <p className="p" style={{ marginTop: 6 }}>
            {coachControlsNutrition
              ? "Tu menu esta gestionado por tu coach."
              : hasOwnMenu
                ? "Ya tenes menus propios para planificar tus comidas."
                : "Todavia no creaste tu menu. Podes usar tu propio plan o registrar libremente en Tracking."}
          </p>
          <div className="homeCardMeta">
            <span>{menuUsageText}</span>
            {coachControlsNutrition ? <span>Coach</span> : <span>Autogestionado</span>}
          </div>
          <div className="homeActionsRow">
            <button
              type="button"
              className="cardAction secondary"
              onClick={() => navigate(coachControlsNutrition || hasOwnMenu ? "/app/menu" : "/app/menu/nuevo", { state: { from: "/app/inicio" } })}
              {...(!coachControlsNutrition && !hasOwnMenu ? createNavigationPrefetchHandlers("/app/menu/nuevo", { data: false }) : {})}
            >
              {coachControlsNutrition || hasOwnMenu ? "Ver menu" : "Crear mi menu"}
            </button>
            {!coachControlsNutrition && !hasOwnMenu ? (
              <button type="button" className="cardAction secondary" onClick={() => navigate("/app/tracking")}>
                Ir a Tracking
              </button>
            ) : null}
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><CalendarDays aria-hidden="true" /> Tracking</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Registra lo que realmente comiste y comparalo con tus objetivos.
          </p>
          <div className="homeActionsRow">
            <button type="button" className="cardAction secondary" onClick={() => navigate("/app/tracking")}>
              Registrar dia
            </button>
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><Dumbbell aria-hidden="true" /> Rutina</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Tu entrenamiento del dia o la semana.
          </p>
          <div className="homeActionsRow">
            <button type="button" className="cardAction secondary" onClick={() => navigate("/app/rutinas")}>
              Ver rutina
            </button>
          </div>
        </div>

        <div className="card">
          <strong className="homeCardTitle"><TrendingUp aria-hidden="true" /> Progreso</strong>
          <p className="p" style={{ marginTop: 6 }}>
            Peso, medidas y constancia con datos reales disponibles.
          </p>
          <div className="homeActionsRow">
            <button type="button" className="cardAction secondary" onClick={() => navigate("/app/progresos")}>
              Ver progreso
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
