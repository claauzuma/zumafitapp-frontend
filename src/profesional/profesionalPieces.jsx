import { avatarUrl, fullName, initials } from "./profesionalFormat.js";

export function Avatar({ user, size = "" }) {
  const src = avatarUrl(user);
  return (
    <div className={`prof-avatar ${size}`}>
      {src ? <img src={src} alt={fullName(user)} /> : initials(user)}
    </div>
  );
}

export function Metric({ emoji, label, value }) {
  return (
    <div className="prof-metric">
      <div className="prof-metricIcon" aria-hidden="true">{emoji}</div>
      <div className="prof-metricLabel">{label}</div>
      <div className="prof-metricValue">{value || "-"}</div>
    </div>
  );
}
