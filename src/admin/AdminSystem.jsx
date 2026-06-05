import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  CircleCheck,
  Database,
  FileText,
  HardDrive,
  Layers3,
  RefreshCw,
  Search,
  Server,
} from "lucide-react";
import { useAdminDatabaseStats } from "./adminSystemQueries.js";
import "./adminSystem.css";

const SORT_OPTIONS = [
  { value: "total-desc", label: "Mayor tamaño total" },
  { value: "indexes-desc", label: "Mayor tamaño de índices" },
  { value: "documents-desc", label: "Más documentos" },
  { value: "name-asc", label: "Nombre A-Z" },
];

function safeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function formatBytes(value) {
  const bytes = safeNumber(value);
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const scaled = bytes / 1024 ** unitIndex;
  const digits = scaled >= 100 || unitIndex === 0 ? 0 : scaled >= 10 ? 1 : 2;

  return `${scaled.toFixed(digits)} ${units[unitIndex]}`;
}

function formatCount(value) {
  return new Intl.NumberFormat("es-AR").format(safeNumber(value));
}

function formatGeneratedAt(value) {
  if (!value) return "Sin datos";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin datos";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
}

function statusCopy(status) {
  if (status === "ok") return { label: "Disponible", className: "ok", Icon: CircleCheck };
  if (status === "partial") return { label: "Parcial", className: "partial", Icon: AlertTriangle };
  return { label: "Error", className: "error", Icon: AlertTriangle };
}

function StatusBadge({ status }) {
  const { label, className, Icon } = statusCopy(status);
  return (
    <span className={`ads-status ${className}`}>
      <Icon size={14} strokeWidth={2.4} aria-hidden="true" />
      {label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone = "gold" }) {
  return (
    <article className={`ads-summary-card ${tone}`}>
      <span className="ads-summary-icon" aria-hidden="true">
        {React.createElement(Icon, { size: 21, strokeWidth: 2.2 })}
      </span>
      <div>
        <span className="ads-summary-label">{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

function CollectionUsage({ value, total }) {
  const percentage = total > 0 ? Math.min(100, (safeNumber(value) / total) * 100) : 0;
  return (
    <div className="ads-usage" title={`${percentage.toFixed(1)}% del tamaño total`}>
      <span style={{ width: `${Math.max(percentage, percentage > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

function CollectionMobileCard({ collection, totalDatabaseSize }) {
  const share = totalDatabaseSize > 0 ? (collection.totalSize / totalDatabaseSize) * 100 : 0;
  return (
    <article className="ads-collection-card">
      <div className="ads-collection-card-head">
        <div>
          <strong>{collection.name}</strong>
          <span>{formatCount(collection.documents)} documentos</span>
        </div>
        <StatusBadge status={collection.status} />
      </div>

      <CollectionUsage value={collection.totalSize} total={totalDatabaseSize} />

      <dl className="ads-collection-metrics">
        <div>
          <dt>Datos</dt>
          <dd>{formatBytes(collection.dataSize)}</dd>
        </div>
        <div>
          <dt>Storage</dt>
          <dd>{formatBytes(collection.storageSize)}</dd>
        </div>
        <div>
          <dt>Índices</dt>
          <dd>{formatBytes(collection.indexSize)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatBytes(collection.totalSize)}</dd>
        </div>
      </dl>

      <div className="ads-collection-card-foot">
        <span>{formatCount(collection.indexesCount)} índices</span>
        <span>{formatBytes(collection.avgObjSize)} promedio/doc.</span>
        {share >= 20 && <span className="ads-heavy-badge">Colección pesada · {share.toFixed(0)}%</span>}
      </div>

      {collection.error && <p className="ads-collection-warning">{collection.error}</p>}
    </article>
  );
}

function LoadingState() {
  return (
    <div className="ads-loading" aria-label="Cargando estadísticas">
      <div className="ads-skeleton ads-skeleton-title" />
      <div className="ads-skeleton-grid">
        {Array.from({ length: 5 }, (_, index) => (
          <div className="ads-skeleton ads-skeleton-card" key={index} />
        ))}
      </div>
      <div className="ads-skeleton ads-skeleton-table" />
    </div>
  );
}

export default function AdminSystem() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("total-desc");
  const statsQuery = useAdminDatabaseStats();
  const database = statsQuery.data?.database || {};
  const collections = useMemo(
    () => statsQuery.data?.collections || [],
    [statsQuery.data?.collections]
  );
  const totalDatabaseSize = safeNumber(database.totalSize);

  const visibleCollections = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    const filtered = term
      ? collections.filter((collection) => collection.name.toLocaleLowerCase("es").includes(term))
      : [...collections];

    return filtered.sort((a, b) => {
      if (sort === "name-asc") return a.name.localeCompare(b.name, "es");
      if (sort === "documents-desc") return safeNumber(b.documents) - safeNumber(a.documents);
      if (sort === "indexes-desc") return safeNumber(b.indexSize) - safeNumber(a.indexSize);
      return safeNumber(b.totalSize) - safeNumber(a.totalSize);
    });
  }, [collections, search, sort]);

  if (statsQuery.isLoading) return <LoadingState />;

  if (statsQuery.isError) {
    return (
      <main className="ads-page">
        <section className="ads-error-panel">
          <AlertTriangle size={28} strokeWidth={2.2} aria-hidden="true" />
          <div>
            <h1>No pudimos consultar MongoDB</h1>
            <p>{statsQuery.error?.message || "La información técnica no está disponible ahora."}</p>
          </div>
          <button type="button" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching}>
            <RefreshCw size={17} strokeWidth={2.3} aria-hidden="true" />
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="ads-page">
      <header className="ads-header">
        <div className="ads-header-copy">
          <span className="ads-eyebrow">
            <Server size={16} strokeWidth={2.3} aria-hidden="true" />
            Administración técnica
          </span>
          <h1>Sistema</h1>
          <p>Monitoreo técnico de la aplicación y base de datos.</p>
        </div>

        <button
          className="ads-refresh"
          type="button"
          onClick={() => statsQuery.refetch()}
          disabled={statsQuery.isFetching}
        >
          <RefreshCw
            className={statsQuery.isFetching ? "ads-spin" : ""}
            size={18}
            strokeWidth={2.3}
            aria-hidden="true"
          />
          {statsQuery.isFetching ? "Actualizando..." : "Actualizar"}
        </button>
      </header>

      <section className="ads-db-heading">
        <div>
          <span className="ads-section-icon" aria-hidden="true">
            <Database size={20} strokeWidth={2.2} />
          </span>
          <div>
            <h2>Estado de MongoDB</h2>
            <p>
              Base <strong>{database.name || "actual"}</strong> · consultado{" "}
              {formatGeneratedAt(database.generatedAt)}
            </p>
          </div>
        </div>
        <StatusBadge status={database.status} />
      </section>

      <section className="ads-summary-grid" aria-label="Resumen de MongoDB">
        <SummaryCard
          icon={Layers3}
          label="Colecciones"
          value={formatCount(database.collectionsCount)}
          detail="detectadas"
        />
        <SummaryCard
          icon={FileText}
          label="Documentos totales"
          value={formatCount(database.totalDocuments)}
          detail="estimación rápida"
          tone="blue"
        />
        <SummaryCard
          icon={Database}
          label="Datos usados"
          value={formatBytes(database.dataSize)}
          detail="tamaño lógico"
          tone="green"
        />
        <SummaryCard
          icon={Layers3}
          label="Índices"
          value={formatBytes(database.indexSize)}
          detail="espacio de índices"
          tone="blue"
        />
        <SummaryCard
          icon={HardDrive}
          label="Tamaño total"
          value={formatBytes(database.totalSize)}
          detail={`${formatBytes(database.storageSize)} storage + índices`}
          tone="gold"
        />
      </section>

      <section className="ads-collections-section">
        <div className="ads-section-head">
          <div>
            <h2>Colecciones</h2>
            <p>Ordenadas por tamaño total. Solo se consulta metadata, nunca documentos.</p>
          </div>

          <div className="ads-toolbar">
            <label className="ads-search">
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar colección"
              />
            </label>
            <label className="ads-sort">
              <ArrowDownUp size={17} strokeWidth={2.2} aria-hidden="true" />
              <select value={sort} onChange={(event) => setSort(event.target.value)}>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {visibleCollections.length === 0 ? (
          <div className="ads-empty">No hay colecciones que coincidan con la búsqueda.</div>
        ) : (
          <>
            <div className="ads-table-wrap">
              <table className="ads-table">
                <thead>
                  <tr>
                    <th>Colección</th>
                    <th>Documentos</th>
                    <th>Datos</th>
                    <th>Storage</th>
                    <th>Índices</th>
                    <th>Total</th>
                    <th>Cant. índices</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCollections.map((collection) => {
                    const share =
                      totalDatabaseSize > 0 ? (collection.totalSize / totalDatabaseSize) * 100 : 0;
                    return (
                      <tr key={collection.name}>
                        <td>
                          <div className="ads-name-cell">
                            <strong>{collection.name}</strong>
                            <CollectionUsage value={collection.totalSize} total={totalDatabaseSize} />
                            <span>
                              {formatBytes(collection.avgObjSize)} promedio/doc.
                              {share >= 20 ? ` · ${share.toFixed(0)}% del total` : ""}
                            </span>
                          </div>
                        </td>
                        <td>{formatCount(collection.documents)}</td>
                        <td>{formatBytes(collection.dataSize)}</td>
                        <td>{formatBytes(collection.storageSize)}</td>
                        <td>{formatBytes(collection.indexSize)}</td>
                        <td className="ads-total-cell">{formatBytes(collection.totalSize)}</td>
                        <td>{formatCount(collection.indexesCount)}</td>
                        <td>
                          <StatusBadge status={collection.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="ads-mobile-list">
              {visibleCollections.map((collection) => (
                <CollectionMobileCard
                  key={collection.name}
                  collection={collection}
                  totalDatabaseSize={totalDatabaseSize}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
