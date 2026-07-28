import { execFileSync, spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(process.cwd());
const outputDir = resolve(root, "artifacts", "tracking-calorie-fill-visual");
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const viewports = [
  { name: "mobile-360x800", width: 360, height: 800 },
  { name: "mobile-390x844", width: 390, height: 844 },
  { name: "mobile-430x932", width: 430, height: 932 },
  { name: "tablet-768x1024", width: 768, height: 1024 },
  { name: "desktop-1440x900", width: 1440, height: 900 },
];

mkdirSync(outputDir, { recursive: true });
const beforeCss = execFileSync("git", ["show", "HEAD:src/entrenado/trackingDiario.css"], {
  cwd: root,
  encoding: "utf8",
  maxBuffer: 2 * 1024 * 1024,
});
const afterCss = readFileSync(resolve(root, "src", "entrenado", "trackingDiario.css"), "utf8");

function foodRow({ name, nutrition, state, stateClass, quantity, unit = "g", draft = true }) {
  return `
    <div class="td-food ${draft ? "td-foodDraft" : ""}">
      <div class="td-foodThumb fallback" aria-hidden="true">${name.slice(0, 1)}</div>
      <div class="td-foodMain">
        <strong>${name}</strong>
        <span>${nutrition}</span>
      </div>
      <div class="td-foodActions ${draft ? "td-foodDraftControls" : ""}">
        <b class="td-foodStateBadge ${stateClass}">${state}</b>
        <label><input value="${quantity}" aria-label="Cantidad de ${name}"><span>${unit}</span></label>
        <button type="button" aria-label="Eliminar ${name}">×</button>
      </div>
    </div>`;
}

function mealMarkup() {
  return `
  <div class="td-page">
    <section class="td-shell">
      <div class="td-trackingMealsHeader">
        <strong>Comidas del tracking</strong>
        <span>Propuesta local: el total real cambia al confirmar.</span>
      </div>
      <section class="td-meals">
        <article class="td-meal">
          <div class="td-mealHead">
            <div class="td-mealTitleRow">
              <span class="td-mealBadge almuerzo">A</span>
              <div>
                <h2>Almuerzo</h2>
                <p>339 kcal · P 8 · C 75,5 · G 0,5</p>
                <small class="td-mealDraftTotal">+ 564 kcal por confirmar</small>
                <div class="td-mealMeta"><span>Almuerzo</span><span class="goal">Meta 903 kcal · P58,5 C38,4 G56,1</span></div>
              </div>
            </div>
          </div>
          <div class="td-foodList" aria-label="Alimentos de Almuerzo">
            ${foodRow({ name: "Arroz", nutrition: "339 kcal · P 8 · C 75,5 · G 0,5", state: "Registrado", stateClass: "is-registered", quantity: "100", draft: false })}
            ${foodRow({ name: "Pechuga de pollo con piel", nutrition: "199 kcal · P 32 · C 0 · G 8", state: "Calculado", stateClass: "is-calculated", quantity: "160" })}
            ${foodRow({ name: "Queso cremoso", nutrition: "703 kcal · P 27,6 · C 2 · G 65", state: "Calculado", stateClass: "is-calculated", quantity: "197" })}
            ${foodRow({ name: "Aceite de oliva extra virgen de descripción deliberadamente extensa", nutrition: "0 kcal · P 0 · C 0 · G 0", state: "Auto", stateClass: "is-automatic", quantity: "—" })}
            ${foodRow({ name: "Papas", nutrition: "173 kcal · P 3,1 · C 34,2 · G 2,7", state: "Fijo", stateClass: "is-fixed", quantity: "180" })}
            ${foodRow({ name: "Palta", nutrition: "95 kcal · P 1,2 · C 2,5 · G 9", state: "Fijo", stateClass: "is-fixed", quantity: "60" })}
          </div>
          <div class="td-mealInlineActions has-confirm">
            <button class="td-secondaryBtn">Calcular cantidades</button>
            <button class="td-primaryBtn">Confirmar consumo</button>
          </div>
        </article>
      </section>
    </section>
  </div>`;
}

function plannerMarkup(after) {
  const selector = after ? `
    <fieldset class="td-quantityModeSelector">
      <legend>Método de cálculo</legend>
      <div class="td-quantityModeSegments">
        <label><input type="radio" name="mode"><span>Respetar porciones</span></label>
        <label class="is-active"><input type="radio" name="mode" checked><span>Completar calorías</span></label>
      </div>
      <p>Prioriza completar las calorías disponibles con los alimentos elegidos.</p>
    </fieldset>` : "";
  return `
  <section class="td-modalBackdrop td-bottomSheet td-autoQuantityBackdrop" role="dialog" aria-modal="true">
    <button class="td-dialogBackdropButton" aria-label="Cerrar"></button>
    <div class="td-modal td-autoQuantityModal" tabindex="-1">
      <div class="td-modalTop td-autoQuantityHeader">
        <div><span class="td-kicker">Herramienta Pro</span><h3>Calcular cantidades</h3><p>Almuerzo · objetivo disponible 903 kcal</p></div>
        <button class="td-iconBtn" aria-label="Cerrar">×</button>
      </div>
      ${selector}
      <div class="td-autoQuantityDrafts">
        <div class="td-autoQuantityDraftsTop"><strong>Alimentos a preparar</strong><span>1 fijo · 2 pendientes</span></div>
        <div class="td-autoQuantityDraftRow"><span><strong>Pechuga de pollo con piel</strong><small>160 g · se recalculará</small></span><b class="is-pending">Auto</b></div>
        <div class="td-autoQuantityDraftRow"><span><strong>Queso cremoso</strong><small>197 g · cantidad fija</small></span><b class="is-fixed">Fijo</b></div>
        <div class="td-autoQuantityDraftRow"><span><strong>Aceite de oliva</strong><small>Cantidad pendiente</small></span><b class="is-pending">Auto</b></div>
      </div>
      <div class="td-autoQuantityFeedback">
        <div class="td-autoQuantityCalorieSuccess"><span aria-hidden="true">✓</span><span><strong>Objetivo calórico completado.</strong><small>La propuesta queda a 0,9 kcal del objetivo sin superar el techo.</small></span></div>
        <details class="td-autoQuantityInfoDetails"><summary>ⓘ Porciones recomendadas superadas</summary><p>Es intencional en este método. Revisá las cantidades antes de confirmar.</p></details>
        <div class="td-autoQuantityMacroInfo"><span aria-hidden="true">ⓘ</span><span><strong>No es posible acercarse a todos los macronutrientes con estos alimentos.</strong><small>C: faltan 36,4 g · G: excede 16,9 g porque la selección no contiene una fuente de carbohidratos.</small></span></div>
      </div>
      <div class="td-autoQuantityProposal">
        <article><span><strong>Pechuga de pollo con piel</strong><small>199 kcal sugeridas</small></span><label><input value="160" aria-label="Cantidad de Pechuga"><span>g</span></label></article>
        <article><span><strong>Queso cremoso</strong><small>Cantidad manual respetada</small></span><label><input value="197" aria-label="Cantidad de Queso"><span>g</span></label></article>
        <div class="td-autoQuantityTotals"><strong>902 kcal</strong><span>P 59,6 · C 2 · G 73</span></div>
        <details class="td-autoQuantityComparison"><summary>Ver detalle nutricional</summary></details>
      </div>
      <div class="td-autoQuantityFooter">
        <button class="td-calculateQuantityBtn">Recalcular restante</button>
        <p class="td-autoQuantityProposalNotice">Esta es una propuesta local. El total real cambia recién al confirmar.</p>
        <div class="td-modalActions td-autoQuantityDecisionActions">
          <button class="td-secondaryBtn">Agregar alimento</button>
          <button class="td-secondaryBtn">Volver al borrador</button>
          <button class="td-primaryBtn">Usar esta propuesta</button>
        </div>
      </div>
    </div>
  </section>`;
}

function html(css, variant) {
  const after = variant === "after";
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Tracking ${variant}</title>
<style>${css}</style>
<style>
  html, body { margin: 0; min-height: 100%; background: #05090d; color: #eef9fb; }
  * { box-sizing: border-box; }
  body.visual-meal .td-autoQuantityBackdrop { display: none !important; }
  body.visual-modal .td-page { min-height: 110vh; }
  .visual-label { position: fixed; z-index: 9999; top: 4px; left: 4px; padding: 4px 7px; border-radius: 6px; background: #020508dd; color: #7ee9f8; font: 700 10px/1 system-ui; }
  #visual-metrics { display: none; }
</style>
</head>
<body>
<span class="visual-label">${after ? "DESPUÉS" : "ANTES"} · fixture CSS</span>
${mealMarkup()}
${plannerMarkup(after)}
<script>
  const view = new URLSearchParams(location.search).get("view") || "modal";
  document.body.classList.add("visual-" + view);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const rows = [...document.querySelectorAll(".td-food")];
    const actions = [...document.querySelectorAll("button")].filter((button) => {
      const style = getComputedStyle(button);
      const rect = button.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
    });
    const modal = document.querySelector(".td-autoQuantityModal");
    const rowHeights = rows.map((row) => Number(row.getBoundingClientRect().height.toFixed(2)));
    const buttonRects = actions.map((button) => ({
      label: button.getAttribute("aria-label") || button.textContent.trim(),
      width: Number(button.getBoundingClientRect().width.toFixed(2)),
      height: Number(button.getBoundingClientRect().height.toFixed(2)),
    }));
    const metrics = {
      variant: "${variant}", view,
      viewport: { width: innerWidth, height: innerHeight },
      document: { clientWidth: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth },
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      rows: { count: rows.length, heights: rowHeights, min: Math.min(...rowHeights), max: Math.max(...rowHeights), average: rowHeights.reduce((a,b)=>a+b,0)/Math.max(1,rowHeights.length) },
      visibleRows: rows.filter((row) => { const rect=row.getBoundingClientRect(); return rect.top < innerHeight && rect.bottom > 0; }).length,
      buttons: { count: buttonRects.length, minWidth: Math.min(...buttonRects.map(x=>x.width)), minHeight: Math.min(...buttonRects.map(x=>x.height)), rects: buttonRects },
      modal: modal ? { clientHeight: modal.clientHeight, scrollHeight: modal.scrollHeight, internalScroll: modal.scrollHeight > modal.clientHeight + 1 } : null,
    };
    document.getElementById("visual-metrics").textContent = JSON.stringify(metrics);
  }));
</script>
<script id="visual-metrics" type="application/json"></script>
</body></html>`;
}

for (const [variant, css] of [["before", beforeCss], ["after", afterCss]]) {
  writeFileSync(resolve(outputDir, `${variant}.html`), html(css, variant), "utf8");
}

const profileRoot = mkdtempSync(join(tmpdir(), "tracking-calorie-fill-visual-"));
const metrics = [];
const delay = (milliseconds) => new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));

function cdpClient(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map();
  let nextId = 0;
  const ready = new Promise((resolveReady, rejectReady) => {
    socket.addEventListener("open", resolveReady, { once: true });
    socket.addEventListener("error", rejectReady, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (!message.id || !pending.has(message.id)) return;
    const { resolve: resolveCall, reject: rejectCall } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) rejectCall(new Error(message.error.message));
    else resolveCall(message.result);
  });
  return {
    ready,
    send(method, params = {}) {
      const id = ++nextId;
      return new Promise((resolveCall, rejectCall) => {
        pending.set(id, { resolve: resolveCall, reject: rejectCall });
        socket.send(JSON.stringify({ id, method, params }));
      });
    },
    close() {
      socket.close();
    },
  };
}

async function waitForDevTools(profileDirectory, browserProcess) {
  const portFile = resolve(profileDirectory, "DevToolsActivePort");
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (browserProcess.exitCode !== null) throw new Error("Edge se cerró antes de iniciar CDP");
    try {
      const [port] = readFileSync(portFile, "utf8").trim().split(/\r?\n/);
      if (port) return Number(port);
    } catch {
      // El archivo aparece cuando Edge termina de inicializar el perfil temporal.
    }
    await delay(100);
  }
  throw new Error("Edge no publicó DevToolsActivePort");
}

async function captureWithCdp(port, variant, viewport, view) {
  const htmlPath = resolve(outputDir, `${variant}.html`);
  const url = `${pathToFileURL(htmlPath).href}?view=${view}`;
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent("about:blank")}`, {
    method: "PUT",
  }).then((response) => response.json());
  const client = cdpClient(target.webSocketDebuggerUrl);
  await client.ready;
  try {
    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width <= 430,
      screenWidth: viewport.width,
      screenHeight: viewport.height,
    });
    await client.send("Page.navigate", { url });
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const state = await client.send("Runtime.evaluate", {
        expression: "document.readyState",
        returnByValue: true,
      });
      if (state.result?.value === "complete") break;
      await delay(25);
    }
    await delay(150);
    const measured = await client.send("Runtime.evaluate", {
      expression: "JSON.parse(document.getElementById('visual-metrics').textContent)",
      returnByValue: true,
    });
    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const screenshotName = `${variant}-${view}-${viewport.name}.png`;
    writeFileSync(resolve(outputDir, screenshotName), Buffer.from(screenshot.data, "base64"));
    metrics.push({ screenshot: screenshotName, ...measured.result.value });
  } finally {
    client.close();
    await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`).catch(() => {});
  }
}

const browserProcess = spawn(edge, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--allow-file-access-from-files",
  "--disable-sync",
  "--disable-background-networking",
  "--no-first-run",
  "--remote-debugging-port=0",
  `--user-data-dir=${profileRoot}`,
  "about:blank",
], { cwd: root, windowsHide: true, stdio: "ignore" });
try {
  const port = await waitForDevTools(profileRoot, browserProcess);
  for (const variant of ["before", "after"]) {
    for (const viewport of viewports) {
      for (const view of ["meal", "modal"]) {
        await captureWithCdp(port, variant, viewport, view);
      }
    }
  }
} finally {
  browserProcess.kill();
  await Promise.race([
    new Promise((resolveExit) => browserProcess.once("exit", resolveExit)),
    delay(3000),
  ]);
  rmSync(profileRoot, { recursive: true, force: true });
}

writeFileSync(resolve(outputDir, "metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");

function rounded(value) {
  return Number(value || 0).toFixed(1).replace(/\.0$/, "");
}

const lines = [
  "# Auditoría visual Tracking — Completar calorías",
  "",
  "Comparación reproducible del CSS en `HEAD` (antes) contra el working tree (después), usando la misma fixture de comida y calculadora. No es una captura autenticada de datos reales; sirve para medir layout, densidad, overflow y acciones en los viewports pedidos.",
  "",
  "| Vista | Viewport | Antes: fila prom./máx. | Después: fila prom./máx. | Filas visibles después | Overflow después | Botón mínimo después | Scroll interno modal |",
  "|---|---|---:|---:|---:|:---:|---:|:---:|",
];
for (const viewport of viewports) {
  for (const view of ["meal", "modal"]) {
    const before = metrics.find((item) => item.variant === "before" && item.view === view && item.viewport.width === viewport.width);
    const after = metrics.find((item) => item.variant === "after" && item.view === view && item.viewport.width === viewport.width);
    lines.push(`| ${view === "meal" ? "Comida" : "Calculadora"} | ${viewport.width}×${viewport.height} | ${rounded(before.rows.average)} / ${rounded(before.rows.max)} px | ${rounded(after.rows.average)} / ${rounded(after.rows.max)} px | ${view === "meal" ? after.visibleRows : "—"} | ${after.horizontalOverflow ? "sí" : "no"} | ${rounded(after.buttons.minHeight)} px | ${after.modal?.internalScroll ? "sí" : "no"} |`);
  }
}
lines.push(
  "",
  "## Capturas",
  "",
  ...viewports.flatMap((viewport) => [
    `### ${viewport.width}×${viewport.height}`,
    "",
    `- Comida: [antes](./before-meal-${viewport.name}.png) · [después](./after-meal-${viewport.name}.png)`,
    `- Calculadora: [antes](./before-modal-${viewport.name}.png) · [después](./after-modal-${viewport.name}.png)`,
    "",
  ]),
  "## Alcance",
  "",
  "La fixture incluye seis alimentos, nombres y warnings extensos, kcal/P/C/G, Auto/Fijo/Calculado/Registrado y acciones del modal. La interacción real con teclado móvil, teclado virtual y una sesión autenticada continúa siendo una prueba manual pendiente; el footer sticky, scroll interno y ausencia de overflow se verifican geométricamente aquí.",
  "",
);
writeFileSync(resolve(outputDir, "AUDITORIA_VISUAL.md"), `${lines.join("\n")}\n`, "utf8");

console.log(JSON.stringify({ outputDir, captures: metrics.length, metrics: resolve(outputDir, "metrics.json") }, null, 2));
