import React, { useMemo } from "react";
import { Check, ScanLine } from "lucide-react";

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

function rangeBounds(value) {
  const numbers = String(value || "").match(/\d+(?:[.,]\d+)?/g)?.map((item) => Number(item.replace(",", "."))) || [];
  if (!numbers.length) return null;
  return {
    min: numbers[0],
    max: String(value).includes("+") ? Number.POSITIVE_INFINITY : (numbers[1] ?? numbers[0]),
  };
}

function representativePct(value) {
  const bounds = rangeBounds(value);
  if (!bounds) return null;
  if (!Number.isFinite(bounds.max)) return bounds.min + 2;
  return Math.round(((bounds.min + bounds.max) / 2) * 10) / 10;
}

function selectedRange(options, grasaPct, legacyLevel) {
  const numeric = Number(grasaPct);
  if (Number.isFinite(numeric)) {
    const match = options.find((option) => {
      const bounds = rangeBounds(option.v);
      return bounds && numeric >= bounds.min && numeric <= bounds.max;
    });
    if (match) return match.v;
  }

  const legacy = String(legacyLevel || "");
  return options.some((option) => option.v === legacy) ? legacy : "";
}

export default function BasicsBodyFat({ form, setForm }) {
  const sexo = normSexo(form?.sexo);
  const options = useMemo(() => (sexo === "femenino" ? FEMALE : MALE), [sexo]);
  const selected = selectedRange(options, form?.grasaPct, form?.grasaNivel);
  const visualLabel = sexo === "femenino" ? "Referencia femenina" : "Referencia masculina";

  return (
    <div className="ob2-card ob2-bf-card">
      <div className="ob2-bf-heading">
        <span className="ob2-bf-headingIcon" aria-hidden="true">
          <ScanLine size={18} strokeWidth={2.1} />
        </span>
        <div>
          <span className="ob2-bf-context">{visualLabel}</span>
          <h2 className="ob2-h2" style={{ marginTop: 0 }}>
            ¿Qué imagen te representa?
          </h2>
        </div>
      </div>
      <p className="ob2-p ob2-bf-copy">
        Elegí la silueta que más se parece a vos hoy. Es solo una referencia visual.
      </p>

      <div className="ob2-bf-grid">
        {options.map((o, index) => {
          const active = selected === o.v;
          return (
            <button
              key={o.v}
              type="button"
              className={`ob2-bf-item ${active ? "is-active" : ""}`}
              aria-pressed={active}
              aria-label={`Seleccionar ${o.l} de grasa corporal`}
              onClick={() => setForm((prev) => ({ ...prev, grasaPct: representativePct(o.v) }))}
            >
              <div className="ob2-bf-illus" aria-hidden="true">
                <BodyCompositionFigure
                  variant={sexo === "femenino" ? "female" : "male"}
                  level={o.v}
                  order={index}
                  active={active}
                />
              </div>

              <div className="ob2-bf-meta">
                <span>Grasa estimada</span>
                <strong>{o.l}</strong>
              </div>

              <div className="ob2-bf-radio" aria-hidden="true">
                {active ? <Check size={13} strokeWidth={3} /> : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BodyCompositionFigure({ variant = "male", level = "18-23", order = 0, active = false }) {
  const k = levelToBulk(level);
  const female = variant === "female";
  const idSuffix = `${variant}-${String(level).replace(/[^a-z0-9]/gi, "-")}`;
  const gradientId = `ob2-bf-body-${idSuffix}`;
  const glowId = `ob2-bf-glow-${idSuffix}`;

  const shoulder = (female ? 19 : 25) + k * (female ? 5 : 7);
  const chest = (female ? 18 : 22) + k * (female ? 8 : 10);
  const waist = (female ? 10.5 : 12) + k * (female ? 15 : 18);
  const hips = (female ? 18 : 14) + k * (female ? 12 : 17);
  const arm = 4.8 + k * 3.2;
  const thigh = (female ? 7.3 : 6.5) + k * 4.5;
  const definition = Math.max(0, 1 - k * 1.5);

  return (
    <svg
      className="ob2-bf-figure"
      viewBox="0 0 128 146"
      fill="none"
      data-variant={variant}
      data-active={active ? "true" : "false"}
    >
      <defs>
        <linearGradient id={gradientId} x1="38" y1="28" x2="91" y2="136" gradientUnits="userSpaceOnUse">
          <stop stopColor={female ? "#ffd1dc" : "#ffe39a"} stopOpacity=".96" />
          <stop offset=".48" stopColor={female ? "#f08a9d" : "#f5bd3f"} stopOpacity=".76" />
          <stop offset="1" stopColor={female ? "#9f4f63" : "#9d6418"} stopOpacity=".68" />
        </linearGradient>
        <radialGradient id={glowId} cx="0" cy="0" r="1" gradientTransform="translate(64 75) rotate(90) scale(67 52)" gradientUnits="userSpaceOnUse">
          <stop stopColor={female ? "#f08a9d" : "#f5c451"} stopOpacity=".19" />
          <stop offset="1" stopColor={female ? "#f08a9d" : "#f5c451"} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="64" cy="75" rx="52" ry="67" fill={`url(#${glowId})`} />
      <path className="ob2-bf-orbit" d="M18 97C28 126 48 139 75 136C101 133 115 111 111 80" />
      <circle className="ob2-bf-orbitDot" cx={21 + (order % 3) * 2} cy={96 - (order % 2) * 3} r="2.2" />

      <circle cx="64" cy="20.5" r={female ? 9.2 : 9.8} fill={`url(#${gradientId})`} />
      <path
        d={`M${59.5 - k} 29 L${68.5 + k} 29 L${70 + k} 39 L${58 - k} 39 Z`}
        fill={`url(#${gradientId})`}
        opacity=".88"
      />
      <path d={bodyPath({ female, shoulder, chest, waist, hips })} fill={`url(#${gradientId})`} />
      <path d={leftArmPath({ shoulder, arm, k })} fill={`url(#${gradientId})`} opacity=".88" />
      <path d={rightArmPath({ shoulder, arm, k })} fill={`url(#${gradientId})`} opacity=".88" />
      <path d={leftLegPath({ hips, thigh, k })} fill={`url(#${gradientId})`} opacity=".9" />
      <path d={rightLegPath({ hips, thigh, k })} fill={`url(#${gradientId})`} opacity=".9" />

      <g className="ob2-bf-definition" opacity={definition}>
        <path d="M64 48V92" />
        <path d="M53 59Q64 64 75 59" />
        <path d="M54 72Q64 76 74 72" />
        <path d="M56 84Q64 88 72 84" />
      </g>
      {k > 0.5 ? (
        <path
          className="ob2-bf-volumeLine"
          d={`M${64 - waist * 0.7} 77 Q64 ${87 + k * 8} ${64 + waist * 0.7} 77`}
        />
      ) : null}
      <ellipse className="ob2-bf-floor" cx="64" cy="139" rx={22 + k * 8} ry="3.5" />
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

function bodyPath({ female, shoulder, chest, waist, hips }) {
  const bustY = female ? 53 : 55;
  return `
    M${64 - shoulder} 41
    Q${64 - chest} ${bustY} ${64 - waist} 76
    Q${64 - waist * 1.02} 91 ${64 - hips} 105
    Q64 116 ${64 + hips} 105
    Q${64 + waist * 1.02} 91 ${64 + waist} 76
    Q${64 + chest} ${bustY} ${64 + shoulder} 41
    Q64 36 ${64 - shoulder} 41
    Z
  `;
}

function leftArmPath({ shoulder, arm, k }) {
  const start = 64 - shoulder + 2;
  return `M${start} 43 Q${start - arm - 4} 61 ${start - arm - 1} 82 L${start - arm + 1} ${104 + k * 2} Q${start - arm + 7} ${105 + k * 2} ${start - arm + 8} 99 L${start - 1} 67 Z`;
}

function rightArmPath({ shoulder, arm, k }) {
  const start = 64 + shoulder - 2;
  return `M${start} 43 Q${start + arm + 4} 61 ${start + arm + 1} 82 L${start + arm - 1} ${104 + k * 2} Q${start + arm - 7} ${105 + k * 2} ${start + arm - 8} 99 L${start + 1} 67 Z`;
}

function leftLegPath({ hips, thigh, k }) {
  return `M${64 - hips + 2} 101 Q${64 - thigh - 4} 115 ${58 - thigh * 0.12} 137 L${48 - k * 2} 137 Q${47 - k * 2} 118 ${50 - hips * 0.28} 105 Z`;
}

function rightLegPath({ hips, thigh, k }) {
  return `M${64 + hips - 2} 101 Q${64 + thigh + 4} 115 ${70 + thigh * 0.12} 137 L${80 + k * 2} 137 Q${81 + k * 2} 118 ${78 + hips * 0.28} 105 Z`;
}
