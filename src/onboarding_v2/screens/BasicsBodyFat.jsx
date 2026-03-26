import React, { useMemo } from "react";

const MALE = [
  { v: "3-4", l: "3–4%" },
  { v: "5-7", l: "5–7%" },
  { v: "8-12", l: "8–12%" },
  { v: "13-17", l: "13–17%" },
  { v: "18-23", l: "18–23%" },
  { v: "24-29", l: "24–29%" },
  { v: "30-34", l: "30–34%" },
  { v: "35-39", l: "35–39%" },
  { v: "40+", l: "40% +" },
];

const FEMALE = [
  { v: "10-13", l: "10–13%" },
  { v: "14-17", l: "14–17%" },
  { v: "18-23", l: "18–23%" },
  { v: "24-28", l: "24–28%" },
  { v: "29-33", l: "29–33%" },
  { v: "34-37", l: "34–37%" },
  { v: "38-42", l: "38–42%" },
  { v: "43-49", l: "43–49%" },
  { v: "50+", l: "50% +" },
];

function normSexo(sexo) {
  const s = String(sexo || "").toLowerCase();
  if (s === "femenino" || s === "mujer" || s === "female") return "femenino";
  return "masculino";
}

export default function BasicsBodyFat({ form, setForm }) {
  const sexo = normSexo(form?.sexo);
  const options = useMemo(() => (sexo === "femenino" ? FEMALE : MALE), [sexo]);
  const selected = String(form?.grasaNivel || "");

  return (
    <div className="ob2-card">
      <h2 className="ob2-h2" style={{ marginTop: 0 }}>
        ¿Que imagen te representa?
      </h2>
      <p className="ob2-p">Usá una evaluación visual. No hace falta ser exacto.</p>

      <div className="ob2-bf-grid">
        {options.map((o) => {
          const active = selected === o.v;
          return (
            <button
              key={o.v}
              type="button"
              className={`ob2-bf-item ${active ? "is-active" : ""}`}
              onClick={() => setForm((prev) => ({ ...prev, grasaNivel: o.v }))}
            >
              <div className="ob2-bf-illus" aria-hidden="true">
                <Silhouette variant={sexo === "femenino" ? "female" : "male"} level={o.v} />
              </div>

              <div className="ob2-bf-pill">{o.l}</div>

              <div className="ob2-bf-radio" aria-hidden="true">
                {active ? "●" : "○"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Silhouette({ variant = "male", level = "18-23" }) {
  const k = levelToBulk(level);
  const bulk = 18 + k * 18;
  const waist = 10 + k * 14;
  const hips = variant === "female" ? 14 + k * 18 : 10 + k * 14;

  return (
    <svg width="92" height="92" viewBox="0 0 92 92" fill="none">
      <rect x="1" y="1" width="90" height="90" rx="18" stroke="rgba(255,255,255,.06)" />
      <circle cx="46" cy="24" r="10" fill="rgba(255,255,255,.10)" />
      <path d={variant === "female" ? femalePath(bulk, waist, hips) : malePath(bulk, waist, hips)} fill="rgba(255,255,255,.10)" />
      <path
        d={`M${46 - hips} 62 Q46 70 ${46 + hips} 62 L${46 + hips - 6} 76 Q46 82 ${46 - hips + 6} 76 Z`}
        fill="rgba(255,255,255,.08)"
      />
    </svg>
  );
}

function levelToBulk(level) {
  const s = String(level);
  if (s.includes("3-4")) return 0.02;
  if (s.includes("5-7")) return 0.06;
  if (s.includes("8-12")) return 0.12;
  if (s.includes("10-13")) return 0.14;
  if (s.includes("13-17")) return 0.22;
  if (s.includes("14-17")) return 0.24;
  if (s.includes("18-23")) return 0.38;
  if (s.includes("24-29")) return 0.55;
  if (s.includes("24-28")) return 0.52;
  if (s.includes("30-34")) return 0.70;
  if (s.includes("29-33")) return 0.68;
  if (s.includes("35-39")) return 0.82;
  if (s.includes("34-37")) return 0.78;
  if (s.includes("40")) return 0.92;
  if (s.includes("38-42")) return 0.88;
  if (s.includes("43-49")) return 0.95;
  if (s.includes("50")) return 1.0;
  return 0.4;
}

function malePath(bulk, waist, hips) {
  const xL = 46 - bulk;
  const xR = 46 + bulk;
  const wL = 46 - waist;
  const wR = 46 + waist;
  const hL = 46 - hips;
  const hR = 46 + hips;

  return `
    M${xL} 38
    Q46 32 ${xR} 38
    L${wR} 54
    Q46 58 ${wL} 54
    Z
    M${wL} 54
    Q46 62 ${wR} 54
    L${hR} 62
    Q46 66 ${hL} 62
    Z
  `;
}

function femalePath(bulk, waist, hips) {
  const xL = 46 - bulk * 0.9;
  const xR = 46 + bulk * 0.9;
  const wL = 46 - waist * 0.8;
  const wR = 46 + waist * 0.8;
  const hL = 46 - hips;
  const hR = 46 + hips;

  return `
    M${xL} 38
    Q46 31 ${xR} 38
    L${wR} 52
    Q46 56 ${wL} 52
    Z
    M${wL} 52
    Q46 60 ${wR} 52
    L${hR} 62
    Q46 66 ${hL} 62
    Z
  `;
}