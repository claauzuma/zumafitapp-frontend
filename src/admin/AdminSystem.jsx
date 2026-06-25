import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDownUp,
  ArrowLeft,
  Braces,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Copy,
  Database,
  Eye,
  FileText,
  Filter,
  HardDrive,
  Layers3,
  RefreshCw,
  Search,
  Server,
  X,
} from "lucide-react";
import {
  useAdminCollectionDetail,
  useAdminCollectionDocument,
  useAdminCollectionDocuments,
  useAdminDatabaseStats,
} from "./adminSystemQueries.js";
import "./adminSystem.css";

const SORT_OPTIONS = [
  { value: "total-desc", label: "Mayor tamano total" },
  { value: "indexes-desc", label: "Mayor tamano de indices" },
  { value: "documents-desc", label: "Mas documentos" },
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

function useDebouncedValue(value, delay = 320) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
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
    <div className="ads-usage" title={`${percentage.toFixed(1)}% del tamano total`}>
      <span style={{ width: `${Math.max(percentage, percentage > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

function documentIdOf(document = {}) {
  return String(document?._id || "");
}

function getNestedValue(document = {}, field = "") {
  if (!field) return undefined;
  return String(field)
    .split(".")
    .reduce((value, key) => (value && typeof value === "object" ? value[key] : undefined), document);
}

function stringifyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function compactValue(value) {
  if (value === null) return "null";
  if (value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  }
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return `[${value.length}]`;
  if (typeof value === "object") return "{...}";
  return String(value);
}

function columnsForCollection(collectionName = "", sampleFields = []) {
  const normalized = collectionName.toLowerCase();
  if (normalized === "fooddatabase2" || normalized.includes("food")) {
    return [
      "_id",
      "Alimentos",
      "Nombre",
      "Categoria",
      "Unidad",
      "Calorias",
      "Proteinas",
      "Carbohidratos",
      "Grasas",
      "ImagenUrl",
      "imagen.url",
      "imageUrl",
      "urlGenerica",
    ];
  }

  const preferred = ["_id", "nombre", "Nombre", "email", "role", "estado", "createdAt", "updatedAt"];
  return [...new Set([...preferred, ...sampleFields].filter(Boolean))].slice(0, 9);
}

function fieldOptions(detail = {}) {
  const fields = [
    "imagen.url",
    "ImagenUrl",
    "imageUrl",
    "urlGenerica",
    "Alimentos",
    "Nombre",
    "Categoria",
    "email",
    ...(detail.searchFields || []),
    ...(detail.sampleFields || []),
  ];
  return [...new Set(fields.filter(Boolean))].slice(0, 140);
}

function LoadingState() {
  return (
    <div className="ads-loading" aria-label="Cargando estadisticas">
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

function CollectionMobileCard({ collection, totalDatabaseSize, onOpen }) {
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
          <dt>Indices</dt>
          <dd>{formatBytes(collection.indexSize)}</dd>
        </div>
        <div>
          <dt>Total</dt>
          <dd>{formatBytes(collection.totalSize)}</dd>
        </div>
      </dl>

      <div className="ads-collection-card-foot">
        <span>{formatCount(collection.indexesCount)} indices</span>
        <span>{formatBytes(collection.avgObjSize)} promedio/doc.</span>
        {share >= 20 && <span className="ads-heavy-badge">Coleccion pesada · {share.toFixed(0)}%</span>}
      </div>

      <button type="button" className="ads-view-button" onClick={() => onOpen(collection.name)}>
        <Eye size={15} strokeWidth={2.3} aria-hidden="true" />
        Ver detalle
      </button>

      {collection.error && <p className="ads-collection-warning">{collection.error}</p>}
    </article>
  );
}

function ValuePreview({ value }) {
  const isBoolean = typeof value === "boolean";
  const isEmpty = value === null || value === undefined || value === "";
  const text = compactValue(value);
  return (
    <span className={`ads-value-preview ${isBoolean ? "boolean" : ""} ${isEmpty ? "empty" : ""}`} title={typeof value === "string" ? value : text}>
      {text}
    </span>
  );
}

function Pagination({ page, totalPages, onPageChange, loading }) {
  return (
    <div className="ads-pagination">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={loading || page <= 1}>
        <ChevronLeft size={16} strokeWidth={2.4} aria-hidden="true" />
        Anterior
      </button>
      <span>
        Pagina {formatCount(page)} de {formatCount(totalPages)}
      </span>
      <button type="button" onClick={() => onPageChange(page + 1)} disabled={loading || page >= totalPages}>
        Siguiente
        <ChevronRight size={16} strokeWidth={2.4} aria-hidden="true" />
      </button>
    </div>
  );
}

function DocumentJsonModal({ collectionName, documentId, fallbackDocument, onClose }) {
  const [copied, setCopied] = useState(false);
  const documentQuery = useAdminCollectionDocument(collectionName, documentId, { enabled: Boolean(documentId) });
  const document = documentQuery.data?.document || fallbackDocument || {};
  const json = stringifyJson(document);

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1300);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="ads-json-backdrop" role="presentation" onMouseDown={onClose}>
      <aside className="ads-json-modal" role="dialog" aria-modal="true" aria-label="JSON del documento" onMouseDown={(event) => event.stopPropagation()}>
        <div className="ads-json-head">
          <div>
            <span>Solo lectura</span>
            <h3>{collectionName}</h3>
            <p>{documentId}</p>
          </div>
          <button type="button" className="ads-icon-action" onClick={onClose} aria-label="Cerrar JSON">
            <X size={18} strokeWidth={2.4} aria-hidden="true" />
          </button>
        </div>

        <div className="ads-json-actions">
          <button type="button" onClick={copyJson}>
            <Copy size={15} strokeWidth={2.3} aria-hidden="true" />
            {copied ? "Copiado" : "Copiar JSON"}
          </button>
        </div>

        {documentQuery.isLoading ? (
          <div className="ads-empty">Cargando documento...</div>
        ) : documentQuery.isError ? (
          <div className="ads-empty">No se pudo cargar el documento completo.</div>
        ) : (
          <pre className="ads-json-code">{json}</pre>
        )}
      </aside>
    </div>
  );
}

function CollectionDocuments({ detail, documentsQuery, columns, onOpenDocument }) {
  const documents = documentsQuery.data?.documents || [];
  const loading = documentsQuery.isLoading || documentsQuery.isFetching;

  if (documentsQuery.isError) {
    return <div className="ads-empty">No se pudo cargar la coleccion.</div>;
  }

  if (loading && !documents.length) {
    return <div className="ads-empty">Cargando documentos...</div>;
  }

  if (!documents.length) {
    return <div className="ads-empty">No se encontraron documentos para esta busqueda.</div>;
  }

  return (
    <>
      <div className="ads-doc-table-wrap" aria-busy={loading}>
        <table className="ads-doc-table">
          <thead>
            <tr>
              {columns.map((field) => (
                <th key={field}>{field}</th>
              ))}
              <th>JSON</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => {
              const id = documentIdOf(document);
              return (
                <tr key={id || stringifyJson(document).slice(0, 40)}>
                  {columns.map((field) => (
                    <td key={field}>
                      <ValuePreview value={getNestedValue(document, field)} />
                    </td>
                  ))}
                  <td>
                    <button type="button" className="ads-json-button" onClick={() => onOpenDocument(id, document)} disabled={!id}>
                      <Braces size={15} strokeWidth={2.3} aria-hidden="true" />
                      Ver JSON
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="ads-doc-mobile-list">
        {documents.map((document) => {
          const id = documentIdOf(document);
          const titleField = columns.find((field) => field !== "_id");
          return (
            <article className="ads-doc-card" key={id || stringifyJson(document).slice(0, 40)}>
              <div className="ads-doc-card-head">
                <strong>{getNestedValue(document, titleField) || id || "Documento"}</strong>
                <button type="button" className="ads-json-button" onClick={() => onOpenDocument(id, document)} disabled={!id}>
                  <Braces size={15} strokeWidth={2.3} aria-hidden="true" />
                  JSON
                </button>
              </div>
              <dl>
                {columns.slice(0, 7).map((field) => (
                  <div key={field}>
                    <dt>{field}</dt>
                    <dd>
                      <ValuePreview value={getNestedValue(document, field)} />
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          );
        })}
      </div>

      <p className="ads-doc-footnote">
        Mostrando {formatCount(documents.length)} de {formatCount(documentsQuery.data?.total || detail.documents || 0)} documentos.
      </p>
    </>
  );
}

function CollectionDetailView({ collectionName, collectionSummary, onBack }) {
  const [search, setSearch] = useState("");
  const [field, setField] = useState("");
  const [presenceField, setPresenceField] = useState("imagen.url");
  const [presenceMode, setPresenceMode] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 320);
  const detailQuery = useAdminCollectionDetail(collectionName);
  const detail = useMemo(() => detailQuery.data || collectionSummary || {}, [collectionSummary, detailQuery.data]);
  const fields = useMemo(() => fieldOptions(detail), [detail]);
  const columns = useMemo(() => columnsForCollection(collectionName, detail.sampleFields || []), [collectionName, detail.sampleFields]);
  const params = useMemo(
    () => ({
      page,
      limit: 25,
      q: debouncedSearch,
      field,
      fieldExists: presenceMode === "exists" ? presenceField : "",
      fieldMissing: presenceMode === "missing" ? presenceField : "",
    }),
    [debouncedSearch, field, page, presenceField, presenceMode]
  );
  const documentsQuery = useAdminCollectionDocuments(collectionName, params);
  const totalPages = documentsQuery.data?.totalPages || 1;

  useEffect(() => {
    setPage(1);
  }, [collectionName, debouncedSearch, field, presenceField, presenceMode]);

  function setImageFilter(mode) {
    setPresenceField("imagen.url");
    setPresenceMode(mode);
  }

  return (
    <main className="ads-page">
      <header className="ads-detail-header">
        <button type="button" className="ads-back-button" onClick={onBack}>
          <ArrowLeft size={17} strokeWidth={2.4} aria-hidden="true" />
          Volver a colecciones
        </button>
        <div>
          <span className="ads-eyebrow">
            <Database size={16} strokeWidth={2.3} aria-hidden="true" />
            Explorador solo lectura
          </span>
          <h1>Coleccion: {collectionName}</h1>
          <p>{formatCount(detail.documents)} documentos detectados.</p>
        </div>
      </header>

      <section className="ads-detail-metrics">
        <SummaryCard icon={FileText} label="Documentos" value={formatCount(detail.documents)} detail="total estimado" />
        <SummaryCard icon={Database} label="Datos" value={formatBytes(detail.dataSize)} detail="tamano logico" tone="green" />
        <SummaryCard icon={HardDrive} label="Storage" value={formatBytes(detail.storageSize)} detail="almacenamiento" tone="blue" />
        <SummaryCard icon={Layers3} label="Indices" value={formatCount(detail.indexesCount)} detail={formatBytes(detail.indexSize)} />
      </section>

      <section className="ads-explorer-panel">
        <div className="ads-section-head">
          <div>
            <h2>Documentos</h2>
            <p>Consulta paginada y segura. No hay acciones de edicion ni borrado.</p>
          </div>
          <StatusBadge status={detail.status || "ok"} />
        </div>

        <div className="ads-document-toolbar">
          <label className="ads-search ads-document-search">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={`Buscar en ${collectionName}...`}
            />
          </label>

          <label className="ads-sort">
            <Search size={17} strokeWidth={2.2} aria-hidden="true" />
            <select value={field} onChange={(event) => setField(event.target.value)}>
              <option value="">Todos los campos</option>
              {fields.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="ads-sort">
            <Filter size={17} strokeWidth={2.2} aria-hidden="true" />
            <select value={presenceField} onChange={(event) => setPresenceField(event.target.value)}>
              {fields.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <div className="ads-presence-actions" aria-label="Filtros por existencia de campo">
            <button type="button" className={presenceMode === "all" ? "active" : ""} onClick={() => setPresenceMode("all")}>
              Todos
            </button>
            <button type="button" className={presenceMode === "exists" ? "active" : ""} onClick={() => setPresenceMode("exists")}>
              Con campo
            </button>
            <button type="button" className={presenceMode === "missing" ? "active" : ""} onClick={() => setPresenceMode("missing")}>
              Sin campo
            </button>
          </div>
        </div>

        <div className="ads-quick-filters">
          <button type="button" onClick={() => setImageFilter("missing")}>Sin imagen.url</button>
          <button type="button" onClick={() => setImageFilter("exists")}>Con imagen.url</button>
          <button type="button" onClick={() => { setField("Alimentos"); setSearch(""); }}>Buscar por alimento</button>
          <button type="button" onClick={() => { setField("Categoria"); setSearch(""); }}>Buscar por categoria</button>
        </div>

        {detailQuery.isLoading ? <div className="ads-empty">Cargando metadata de la coleccion...</div> : null}

        <CollectionDocuments
          detail={detail}
          documentsQuery={documentsQuery}
          columns={columns}
          onOpenDocument={(id, document) => setSelectedDocument({ id, document })}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          loading={documentsQuery.isFetching}
          onPageChange={(nextPage) => setPage(Math.max(1, Math.min(totalPages, nextPage)))}
        />
      </section>

      <section className="ads-schema-panel">
        <div>
          <h2>Campos detectados</h2>
          <p>Muestra de atributos encontrados en documentos recientes.</p>
        </div>
        <div className="ads-field-cloud">
          {(detail.sampleFields || []).slice(0, 80).map((sampleField) => (
            <span key={sampleField}>{sampleField}</span>
          ))}
        </div>
      </section>

      {selectedDocument ? (
        <DocumentJsonModal
          collectionName={collectionName}
          documentId={selectedDocument.id}
          fallbackDocument={selectedDocument.document}
          onClose={() => setSelectedDocument(null)}
        />
      ) : null}
    </main>
  );
}

export default function AdminSystem() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("total-desc");
  const [selectedCollection, setSelectedCollection] = useState(null);
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
            <p>{statsQuery.error?.message || "La informacion tecnica no esta disponible ahora."}</p>
          </div>
          <button type="button" onClick={() => statsQuery.refetch()} disabled={statsQuery.isFetching}>
            <RefreshCw size={17} strokeWidth={2.3} aria-hidden="true" />
            Reintentar
          </button>
        </section>
      </main>
    );
  }

  if (selectedCollection) {
    const collectionSummary = collections.find((collection) => collection.name === selectedCollection) || null;
    return (
      <CollectionDetailView
        collectionName={selectedCollection}
        collectionSummary={collectionSummary}
        onBack={() => setSelectedCollection(null)}
      />
    );
  }

  return (
    <main className="ads-page">
      <header className="ads-header">
        <div className="ads-header-copy">
          <span className="ads-eyebrow">
            <Server size={16} strokeWidth={2.3} aria-hidden="true" />
            Administracion tecnica
          </span>
          <h1>Sistema</h1>
          <p>Monitoreo tecnico de la aplicacion y base de datos.</p>
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
          detail="estimacion rapida"
          tone="blue"
        />
        <SummaryCard
          icon={Database}
          label="Datos usados"
          value={formatBytes(database.dataSize)}
          detail="tamano logico"
          tone="green"
        />
        <SummaryCard
          icon={Layers3}
          label="Indices"
          value={formatBytes(database.indexSize)}
          detail="espacio de indices"
          tone="blue"
        />
        <SummaryCard
          icon={HardDrive}
          label="Tamano total"
          value={formatBytes(database.totalSize)}
          detail={`${formatBytes(database.storageSize)} storage + indices`}
          tone="gold"
        />
      </section>

      <section className="ads-collections-section">
        <div className="ads-section-head">
          <div>
            <h2>Colecciones</h2>
            <p>Ordenadas por tamano total. Podes inspeccionar documentos en modo solo lectura.</p>
          </div>

          <div className="ads-toolbar">
            <label className="ads-search">
              <Search size={17} strokeWidth={2.2} aria-hidden="true" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar coleccion"
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
          <div className="ads-empty">No hay colecciones que coincidan con la busqueda.</div>
        ) : (
          <>
            <div className="ads-table-wrap">
              <table className="ads-table">
                <thead>
                  <tr>
                    <th>Coleccion</th>
                    <th>Documentos</th>
                    <th>Datos</th>
                    <th>Storage</th>
                    <th>Indices</th>
                    <th>Total</th>
                    <th>Cant. indices</th>
                    <th>Estado</th>
                    <th>Detalle</th>
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
                        <td>
                          <button type="button" className="ads-view-button" onClick={() => setSelectedCollection(collection.name)}>
                            <Eye size={15} strokeWidth={2.3} aria-hidden="true" />
                            Ver detalle
                          </button>
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
                  onOpen={setSelectedCollection}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </main>
  );
}
