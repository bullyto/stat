/* Stats ADN66 — app.js (Front PWA)
   Objectif: afficher toutes les stats collectées par le Worker (D1)
   - API en relatif pour éviter CORS/DNS: /api/stats
   - Tolère réponse HTML (évite "Unexpected token '<'")
*/

const API_STATS = "/api/stats"; // IMPORTANT: relatif
const API_HEALTH = "/api/health"; // optionnel

const $ = (id) => document.getElementById(id);

function elExists(id) { return !!$(id); }

function setText(id, text) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
}

function setHTML(id, html) {
  const el = $(id);
  if (!el) return;
  el.innerHTML = html;
}

function setStatus(msg, isErr = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("err", !!isErr);
}

function formatInt(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("fr-FR").format(num);
}

function safeLabel(v) {
  if (v === null || v === undefined) return "?";
  const s = String(v).trim();
  return s.length ? s : "?";
}

function campaignLabel(key) {
  const map = {
    apero: "Apéro",
    catalan: "Catalan",
    chance: "Chance",
    jeux: "Jeux",
    game: "Jeux",
  };
  return map[key] || key;
}

/** Worker: /go/:campaign?src=QR (destinations fixées côté Worker) */
function buildGoLink(campaign, src = "direct") {
  const u = new URL(`/go/${encodeURIComponent(campaign)}`, window.location.origin);
  if (src) u.searchParams.set("src", src);
  return u.toString();
}

function defaultDestinations() {
  // Tes vraies destinations
  return {
    apero: "https://aperos.net",
    catalan: "https://catalan.aperos.net",
    chance: "https://chance.aperos.net",
    jeux: "https://game.aperos.net",
  };
}

/** Fetch JSON robuste: si HTML => message clair */
async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  const text = await res.text();

  if (!res.ok) {
    // même si c'est une erreur, on affiche un bout du body pour debug
    const snippet = text.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(`HTTP ${res.status} — ${snippet || "réponse vide"}`);
  }

  if (!ct.includes("application/json") && !text.trim().startsWith("{") && !text.trim().startsWith("[")) {
    const snippet = text.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(`Réponse non-JSON (probable HTML). Début: ${snippet}`);
  }

  try {
    return JSON.parse(text);
  } catch (e) {
    const snippet = text.slice(0, 180).replace(/\s+/g, " ").trim();
    throw new Error(`JSON invalide. Début: ${snippet}`);
  }
}

/** Normalise les différentes clés possibles renvoyées par ton API */
function normalizeStats(data) {
  // total / today (ou aujourd'hui)
  const total = Number(data.total ?? data.totalClicks ?? 0);
  const today = Number(data.today ?? data.aujourdhui ?? data["aujourd'hui"] ?? 0);

  // byCampaign : [{campaign,n}] OU autre
  const byCampaign = Array.isArray(data.byCampaign) ? data.byCampaign : [];

  // source
  const bySource = Array.isArray(data.bySource) ? data.bySource : [];

  // device / os / browser / country (selon ton screenshot)
  const byDevice = Array.isArray(data.byDevice) ? data.byDevice : [];
  const byOS = Array.isArray(data.byOS) ? data.byOS : [];
  const byBrowser = Array.isArray(data.byBrowser) ? data.byBrowser : [];
  const byCountry = Array.isArray(data.byCountry) ? data.byCountry : [];

  // derniers clics / hourly si ton worker les ajoute plus tard
  const last = Array.isArray(data.last) ? data.last : (Array.isArray(data.lastClicks) ? data.lastClicks : []);
  const hourly = Array.isArray(data.hourly) ? data.hourly : (Array.isArray(data.byHour) ? data.byHour : []);

  return { total, today, byCampaign, bySource, byDevice, byOS, byBrowser, byCountry, last, hourly };
}

/** Rend une petite table dans un container <tbody> ou <div> */
function renderKeyValueTable(tbodyId, rows, keyTitle = "Nom", valTitle = "Clics", keyGetter, valGetter) {
  const el = $(tbodyId);
  if (!el) return;

  // Si c'est un TBODY: on met des <tr>. Sinon: on met une mini table.
  const isTbody = el.tagName && el.tagName.toLowerCase() === "tbody";

  const safeRows = (rows || []).map(r => ({
    k: safeLabel(keyGetter(r)),
    v: Number(valGetter(r) ?? 0)
  })).sort((a,b)=> b.v - a.v);

  if (isTbody) {
    el.innerHTML = "";
    for (const r of safeRows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(r.k)}</td><td>${formatInt(r.v)}</td>`;
      el.appendChild(tr);
    }
  } else {
    const html = `
      <table class="mini">
        <thead><tr><th>${escapeHtml(keyTitle)}</th><th>${escapeHtml(valTitle)}</th></tr></thead>
        <tbody>
          ${safeRows.map(r => `<tr><td>${escapeHtml(r.k)}</td><td>${formatInt(r.v)}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
    el.innerHTML = html;
  }
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fillKPIs({ total, today }) {
  if (elExists("kpiTotal")) setText("kpiTotal", formatInt(total));
  if (elExists("kpiToday")) setText("kpiToday", formatInt(today));
}

/** Met à jour les compteurs campagne (cartes) + table principale */
function fillCampaigns(byCampaign) {
  const dest = defaultDestinations();

  // Convertit byCampaign array -> map
  const map = {};
  for (const r of (byCampaign || [])) {
    const k = (r.campaign ?? r.campagne ?? r.name ?? "").toString().toLowerCase();
    map[k] = Number(r.n ?? r.count ?? r.clicks ?? 0);
  }

  // Cartes simples si tes IDs existent
  if (elExists("cApero")) setText("cApero", formatInt(map.apero ?? 0));
  if (elExists("cCatalan")) setText("cCatalan", formatInt(map.catalan ?? 0));
  if (elExists("cChance")) setText("cChance", formatInt(map.chance ?? 0));
  if (elExists("cJeux")) setText("cJeux", formatInt(map.jeux ?? map.game ?? 0));

  // Table “Détails par campagne” si tu as déjà un <tbody id="tbody">
  const tbody = $("tbody");
  if (!tbody) return;

  const keys = ["apero", "catalan", "chance", "jeux"];
  const rows = keys.map(k => ({
    key: k,
    clicks: Number(map[k] ?? 0),
    to: dest[k] || "#"
  })).sort((a,b)=> b.clicks - a.clicks);

  tbody.innerHTML = "";
  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(campaignLabel(r.key))}</td>
      <td>${formatInt(r.clicks)}</td>
      <td>
        <a href="${buildGoLink(r.key, "direct")}" target="_blank" rel="noopener">Lien tracking</a>
        <span class="muted"> • </span>
        <a href="${r.to}" target="_blank" rel="noopener">Destination</a>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function fillBreakdowns({ bySource, byDevice, byOS, byBrowser, byCountry }) {
  // SOURCE
  renderKeyValueTable(
    "tbodySource",
    bySource,
    "Source",
    "Clics",
    (r) => r.source ?? r.src ?? r.origine ?? "?",
    (r) => r.n ?? r.count ?? r.clicks ?? 0
  );

  // DEVICE (dans ton JSON: "appareil")
  renderKeyValueTable(
    "tbodyDevice",
    byDevice,
    "Appareil",
    "Clics",
    (r) => r.device ?? r.appareil ?? "?",
    (r) => r.n ?? r.count ?? r.clicks ?? 0
  );

  // OS
  renderKeyValueTable(
    "tbodyOS",
    byOS,
    "OS",
    "Clics",
    (r) => r.os ?? "?",
    (r) => r.n ?? r.count ?? r.clicks ?? 0
  );

  // Browser (dans ton JSON: "navigateur")
  renderKeyValueTable(
    "tbodyBrowser",
    byBrowser,
    "Navigateur",
    "Clics",
    (r) => r.browser ?? r.navigateur ?? "?",
    (r) => r.n ?? r.count ?? r.clicks ?? 0
  );

  // Country (dans ton JSON: "pays")
  renderKeyValueTable(
    "tbodyCountry",
    byCountry,
    "Pays",
    "Clics",
    (r) => r.country ?? r.pays ?? "?",
    (r) => r.n ?? r.count ?? r.clicks ?? 0
  );
}

/** Optionnel: derniers clics si tu ajoutes une table dans ton HTML */
function fillLastClicks(last) {
  const tbody = $("tbodyLast");
  if (!tbody) return;

  tbody.innerHTML = "";
  for (const r of (last || []).slice(0, 50)) {
    const date = safeLabel(r.created_at ?? r.date ?? r.time ?? "");
    const camp = safeLabel(r.campaign ?? r.campagne ?? "");
    const src = safeLabel(r.source ?? r.src ?? "");
    const country = safeLabel(r.country ?? r.pays ?? "");
    const device = safeLabel(r.device ?? r.appareil ?? "");
    const os = safeLabel(r.os ?? "");
    const browser = safeLabel(r.browser ?? r.navigateur ?? "");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(date)}</td>
      <td>${escapeHtml(campaignLabel(camp.toLowerCase()))}</td>
      <td>${escapeHtml(src)}</td>
      <td>${escapeHtml(country)}</td>
      <td>${escapeHtml(device)}</td>
      <td>${escapeHtml(os)}</td>
      <td>${escapeHtml(browser)}</td>
    `;
    tbody.appendChild(tr);
  }
}

/** Copie des liens prêts à l’emploi (direct, QR, FB, SMS, flyer) */
async function copyLinks() {
  const lines = [
    "LIENS TRACKING (Stats ADN66)",
    "",
    `Apéro direct : ${buildGoLink("apero","direct")}`,
    `Apéro QR : ${buildGoLink("apero","QR")}`,
    `Apéro Facebook : ${buildGoLink("apero","facebook")}`,
    `Apéro SMS : ${buildGoLink("apero","sms")}`,
    "",
    `Catalan direct : ${buildGoLink("catalan","direct")}`,
    `Catalan QR : ${buildGoLink("catalan","QR")}`,
    `Catalan Facebook : ${buildGoLink("catalan","facebook")}`,
    `Catalan SMS : ${buildGoLink("catalan","sms")}`,
    "",
    `Chance direct : ${buildGoLink("chance","direct")}`,
    `Chance QR : ${buildGoLink("chance","QR")}`,
    `Chance Facebook : ${buildGoLink("chance","facebook")}`,
    `Chance SMS : ${buildGoLink("chance","sms")}`,
    "",
    `Jeux direct : ${buildGoLink("jeux","direct")}`,
    `Jeux QR : ${buildGoLink("jeux","QR")}`,
    `Jeux Facebook : ${buildGoLink("jeux","facebook")}`,
    `Jeux SMS : ${buildGoLink("jeux","sms")}`,
  ];

  const txt = lines.join("\n");

  try {
    await navigator.clipboard.writeText(txt);
    setStatus("Liens copiés ✅ (QR / FB / SMS / direct)");
  } catch {
    // fallback
    const ta = document.createElement("textarea");
    ta.value = txt;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    setStatus("Liens copiés ✅");
  }
}

function setupPWAInstall() {
  let deferredPrompt = null;
  const btn = $("btnInstall");
  if (!btn) return;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btn.hidden = false;
  });

  btn.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    btn.hidden = true;
  });

  // Service Worker (si présent)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
}

async function refresh() {
  setStatus("Chargement des stats…");
  try {
    // Petit check health optionnel
    // (si tu veux le garder, sinon commente)
    // await fetch(API_HEALTH, { cache: "no-store" }).catch(()=>{});

    const raw = await fetchJson(API_STATS);

    if (raw && raw.ok === false) {
      throw new Error(raw.error || "API ok=false");
    }

    const data = normalizeStats(raw);

    fillKPIs(data);
    fillCampaigns(data.byCampaign);
    fillBreakdowns(data);
    fillLastClicks(data.last);

    setStatus("OK • stats à jour ✅");
  } catch (err) {
    console.error(err);
    setStatus(`Erreur: ${err.message}`, true);
    // On évite de laisser des KPI "vides" si l’API plante
    if (elExists("kpiTotal")) setText("kpiTotal", "—");
    if (elExists("kpiToday")) setText("kpiToday", "—");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (elExists("btnRefresh")) $("btnRefresh").addEventListener("click", refresh);
  if (elExists("btnCopyLinks")) $("btnCopyLinks").addEventListener("click", copyLinks);
  setupPWAInstall();
  refresh();
});
