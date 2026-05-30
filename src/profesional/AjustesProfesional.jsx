import React, { useMemo, useState } from "react";
import {
  Bell,
  Check,
  ImagePlus,
  LayoutDashboard,
  Palette,
  RotateCcw,
  Save,
  Settings,
  Upload,
} from "lucide-react";
import "./profesionalPanel.css";

const STORAGE_KEY = "zumafit_professional_settings_v1";

const DEFAULT_SETTINGS = {
  brandName: "ZumaFit Pro",
  tagline: "Panel profesional",
  logoDataUrl: "",
  accent: "gold",
  density: "comfortable",
  cornerStyle: "soft",
  compactClientCards: false,
  showBackgroundRefresh: true,
  rememberFilters: true,
};

const ACCENTS = [
  { value: "gold", label: "Dorado", color: "#f5d76e" },
  { value: "blue", label: "Azul", color: "#63b3ff" },
  { value: "green", label: "Verde", color: "#5ee29b" },
  { value: "rose", label: "Rosa", color: "#ff8ab3" },
];

export default function AjustesProfesional() {
  const [settings, setSettings] = useState(() => loadSettings());
  const [status, setStatus] = useState("");
  const accent = ACCENTS.find((item) => item.value === settings.accent) || ACCENTS[0];

  const previewStyle = useMemo(
    () => ({
      "--coach-accent": accent.color,
      "--coach-radius": settings.cornerStyle === "rounded" ? "22px" : "14px",
    }),
    [accent.color, settings.cornerStyle]
  );

  function patch(next) {
    setSettings((current) => ({ ...current, ...next }));
    setStatus("");
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setStatus("Ajustes guardados en este dispositivo.");
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    setSettings(DEFAULT_SETTINGS);
    setStatus("Ajustes restaurados.");
  }

  function onLogoChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type !== "image/png") {
      setStatus("El logo debe ser PNG.");
      return;
    }
    if (file.size > 800 * 1024) {
      setStatus("Usa un PNG de hasta 800 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => patch({ logoDataUrl: String(reader.result || "") });
    reader.readAsDataURL(file);
  }

  return (
    <div className="prof-page">
      <section className="prof-shell">
        <div className="prof-hero prof-heroClean">
          <div className="prof-titleRow">
            <div className="prof-titleWithIcon">
              <Settings size={22} strokeWidth={2.4} aria-hidden="true" />
              <h1 className="prof-title">Ajustes</h1>
            </div>
          </div>
        </div>

        {status ? (
          <div className={`prof-success ${status.includes("debe") || status.includes("hasta") ? "warn" : ""}`}>
            {status}
          </div>
        ) : null}

        <div className="prof-settingsGrid">
          <section className="prof-panel prof-settingsPanel">
            <div className="prof-settingsTitle">
              <ImagePlus size={18} strokeWidth={2.3} aria-hidden="true" />
              <span>Marca</span>
            </div>

            <div className="prof-logoRow">
              <div className="prof-logoPreview" aria-label="Logo actual">
                {settings.logoDataUrl ? (
                  <img src={settings.logoDataUrl} alt="" />
                ) : (
                  <span>ZF</span>
                )}
              </div>
              <label className="prof-uploadBtn">
                <Upload size={16} strokeWidth={2.3} aria-hidden="true" />
                <span>Subir PNG</span>
                <input type="file" accept="image/png" onChange={onLogoChange} />
              </label>
            </div>

            <div className="prof-formGrid two">
              <label className="prof-field">
                Nombre visible
                <input
                  value={settings.brandName}
                  onChange={(event) => patch({ brandName: event.target.value })}
                  placeholder="Nombre del panel"
                />
              </label>
              <label className="prof-field">
                Bajada
                <input
                  value={settings.tagline}
                  onChange={(event) => patch({ tagline: event.target.value })}
                  placeholder="Panel profesional"
                />
              </label>
            </div>
          </section>

          <section className="prof-panel prof-settingsPanel">
            <div className="prof-settingsTitle">
              <Palette size={18} strokeWidth={2.3} aria-hidden="true" />
              <span>Estilo</span>
            </div>

            <div className="prof-swatchGrid">
              {ACCENTS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  className={`prof-swatch ${settings.accent === item.value ? "active" : ""}`}
                  onClick={() => patch({ accent: item.value })}
                >
                  <span style={{ background: item.color }} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="prof-segmentGrid">
              <SegmentButton
                active={settings.density === "comfortable"}
                label="Comodo"
                onClick={() => patch({ density: "comfortable" })}
              />
              <SegmentButton
                active={settings.density === "compact"}
                label="Compacto"
                onClick={() => patch({ density: "compact" })}
              />
            </div>

            <div className="prof-segmentGrid">
              <SegmentButton
                active={settings.cornerStyle === "soft"}
                label="Sutil"
                onClick={() => patch({ cornerStyle: "soft" })}
              />
              <SegmentButton
                active={settings.cornerStyle === "rounded"}
                label="Redondo"
                onClick={() => patch({ cornerStyle: "rounded" })}
              />
            </div>
          </section>

          <section className="prof-panel prof-settingsPanel">
            <div className="prof-settingsTitle">
              <Bell size={18} strokeWidth={2.3} aria-hidden="true" />
              <span>Preferencias</span>
            </div>

            <ToggleRow
              label="Cards de clientes compactas"
              checked={settings.compactClientCards}
              onChange={(checked) => patch({ compactClientCards: checked })}
            />
            <ToggleRow
              label="Indicador de actualizacion"
              checked={settings.showBackgroundRefresh}
              onChange={(checked) => patch({ showBackgroundRefresh: checked })}
            />
            <ToggleRow
              label="Recordar filtros"
              checked={settings.rememberFilters}
              onChange={(checked) => patch({ rememberFilters: checked })}
            />
          </section>

          <section className="prof-panel prof-previewPanel" style={previewStyle}>
            <div className="prof-settingsTitle">
              <LayoutDashboard size={18} strokeWidth={2.3} aria-hidden="true" />
              <span>Vista previa</span>
            </div>

            <div className={`prof-previewCard ${settings.density}`}>
              <div className="prof-previewBrand">
                <div className="prof-previewLogo">
                  {settings.logoDataUrl ? <img src={settings.logoDataUrl} alt="" /> : <span>ZF</span>}
                </div>
                <div>
                  <strong>{settings.brandName || "ZumaFit Pro"}</strong>
                  <span>{settings.tagline || "Panel profesional"}</span>
                </div>
              </div>
              <div className="prof-previewLine" />
              <div className="prof-previewPills">
                <span>Clientes</span>
                <span>Rutinas</span>
                <span>Progreso</span>
              </div>
            </div>

            <div className="prof-actions compact">
              <button type="button" className="prof-btn gold" onClick={save}>
                <Save size={16} strokeWidth={2.3} aria-hidden="true" />
                Guardar ajustes
              </button>
              <button type="button" className="prof-btn" onClick={reset}>
                <RotateCcw size={16} strokeWidth={2.3} aria-hidden="true" />
                Restaurar
              </button>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function SegmentButton({ active, label, onClick }) {
  return (
    <button type="button" className={`prof-segment ${active ? "active" : ""}`} onClick={onClick}>
      {active ? <Check size={15} strokeWidth={2.5} aria-hidden="true" /> : null}
      <span>{label}</span>
    </button>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="prof-toggleRow">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
  );
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}
