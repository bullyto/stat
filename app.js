/* Stats ADN66 — app.js (Front PWA)
   - UI: stat.aperos.net (GitHub Pages / Pages)
   - API + tracking: stats.aperos.net (Cloudflare Worker + D1)
   IMPORTANT: On n'invente pas d'endpoints. On affiche TOUT ce que l'API renvoie.
*/

const STATS_ORIGIN = "https://stats.aperos.net";
const API_STATS = `${STATS_ORIGIN}/api/stats`;
const API_HEALTH = `${STATS_ORIGIN}/api/health`;

// Endpoints OPTIONNELS (si tu les ajoutes un jour côté Worker, ça s'affichera automatiquement)
const OPT_ENDPOINTS = [
  { key: "bySource", url: `${STATS_ORIGIN}/api/source` },
  { key: "hourly",  url: `${STATS_ORIGIN}/api/hourly` },
  { key: "last",    url: `${STATS_ORIGIN}/api/last` },
];

const $ = (id) => document.getElementById(id);
const elExists = (id) => !!$(id);

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function setStatus(msg, level="warn") {
  const el = $("status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.remove("good","bad","warn");
  el.classList.add(level);
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

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function campaignLabel(key) {
  const map = { apero:"Apéro", catalan:"Catalan", chance:"Chance", jeux:"Jeux", game:"Jeux" };
  return map[(key || "").toLowerCase()] || key;
}

function buildGoLink(campaign, src="direct") {
  const u = new URL(`${STATS_ORIGIN}/go/${encodeURIComponent(campaign)}`);
  if (src) u.searchParams.set("src", src);
  return u.toString();
}

// NEW: liens events (/e/<event_key>?to=...)
function buildEventLink(event_key, to, src="direct") {
  const u = new URL(`${STATS_ORIGIN}/e/${encodeURIComponent(event_key)}`);
  u.searchParams.set("to", to); // déjà encodé ou pas: URL fera le boulot
  if (src) u.searchParams.set("src", src);
  return u.toString();
}

function defaultDestinations() {
  return {
    apero: "https://aperos.net",
    catalan: "https://catalan.aperos.net",
    chance: "https://chance.aperos.net",
    jeux: "https://game.aperos.net",
  };
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.slice(0, 200).replace(/\s+/g," ").trim();
    throw new Error(`HTTP ${res.status} — ${snippet || "réponse vide"}`);
  }
  const trimmed = text.trim();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (!looksJson) {
    const snippet = trimmed.slice(0, 200).replace(/\s+/g," ").trim();
    throw new Error(`Réponse non-JSON. Début: ${snippet}`);
  }
  return JSON.parse(text);
}

async function fetchOptional(url) {
  try {
    const res = await fetch(url, { cache:"no-store" });
    if (!res.ok) return null;
    const t = (await res.text()).trim();
    if (!(t.startsWith("{") || t.startsWith("["))) return null;
    return JSON.parse(t);
  } catch {
    return null;
  }
}

/** Normalize /api/stats output (arrays from Worker) */
function normalizeStats(data) {
  const total = Number(data.total ?? 0);
  const today = Number(data.today ?? 0);

  const byCampaign = Array.isArray(data.byCampaign) ? data.byCampaign : [];
  const byDevice = Array.isArray(data.byDevice) ? data.byDevice : [];
  const byOS = Array.isArray(data.byOS) ? data.byOS : [];
  const byBrowser = Array.isArray(data.byBrowser) ? data.byBrowser : [];
  const byCountry = Array.isArray(data.byCountry) ? data.byCountry : [];

  // If someday you add them in /api/stats, they will appear automatically:
  const bySource = Array.isArray(data.bySource) ? data.bySource : [];
  const hourly = Array.isArray(data.hourly) ? data.hourly : [];
  const last = Array.isArray(data.last) ? data.last : [];

  // NEW: events block (trackings fins)
  const ev = (data && typeof data.events === "object" && data.events) ? data.events : null;
  const events = {
    total: Number(ev?.total ?? 0),
    today: Number(ev?.today ?? 0),
    byEvent: Array.isArray(ev?.byEvent) ? ev.byEvent : [],
    byBrand: Array.isArray(ev?.byBrand) ? ev.byBrand : [],
    byChannel: Array.isArray(ev?.byChannel) ? ev.byChannel : [],
    byAction: Array.isArray(ev?.byAction) ? ev.byAction : [],
    last: Array.isArray(ev?.last) ? ev.last : [],
  };

  return { total, today, byCampaign, bySource, byDevice, byOS, byBrowser, byCountry, hourly, last, events };
}

function renderRows(tbodyId, rows, kGetter, vGetter) {
  const tbody = $(tbodyId);
  if (!tbody) return;

  const safeRows = (rows || [])
    .map(r => ({ k: safeLabel(kGetter(r)), v: Number(vGetter(r) ?? 0) }))
    .sort((a,b)=>b.v-a.v);

  tbody.innerHTML = safeRows.length
    ? safeRows.map(r => `<tr><td>${escapeHtml(r.k)}</td><td class="right">${formatInt(r.v)}</td></tr>`).join("")
    : `<tr><td colspan="2" style="color:rgba(210,255,250,.65)">—</td></tr>`;
}

// NEW: label “humain” pour tes event_key
function eventLabel(key) {
  const k = String(key || "").trim();

  const map = {
    // Apéro de Nuit 66 (canaux)
    "apero_nuit.site.click": "Apéro de Nuit 66 — Site",
    "apero_nuit.facebook.click": "Apéro de Nuit 66 — Facebook",
    "apero_nuit.sms.click": "Apéro de Nuit 66 — SMS",
    "apero_nuit.qr.click": "Apéro de Nuit 66 — QR",
    "apero_nuit.app.click": "Apéro de Nuit 66 — Application",

    // Hibair
    "hibair.facebook.click": "Hibair Drink — Facebook",
    "hibair.sms.click": "Hibair Drink — SMS",
    "hibair.qr.click": "Hibair Drink — QR",
    "hibair.app.click": "Hibair Drink — Application",

    // Actions
    "apero_nuit.call": "Apéro de Nuit 66 — Bouton appeler",
    "apero_catalan.call": "Apéro Catalan — Bouton appeler",
    "apero_nuit.app.order": "Apéro de Nuit 66 — Commander (application)",

    // Roue
    "wheel.sms.click": "Roue de la fortune — SMS",

    // Age gate
    "apero_nuit.age.accept": "Apéro de Nuit 66 — Accepter l’âge",
    "apero_nuit.age.refuse": "Apéro de Nuit 66 — Refuser l’âge",
    "apero_catalan.age.accept": "Apéro Catalan — Accepter l’âge",
    "apero_catalan.age.refuse": "Apéro Catalan — Refuser l’âge",
  };

  return map[k] || k;
}

function fillKPIs({ total, today, byCampaign, events }) {
  setText("kpiTotal", formatInt(total));
  setText("kpiToday", formatInt(today));
  setText("kpiCampaigns", String((byCampaign||[]).length || 4));

  // NEW KPI (optionnels) : si tu ajoutes ces IDs dans le HTML
  if (events) {
    if (elExists("kpiEventsTotal")) setText("kpiEventsTotal", formatInt(events.total));
    if (elExists("kpiEventsToday")) setText("kpiEventsToday", formatInt(events.today));
  }
}

function fillCampaigns(byCampaign) {
  const dest = defaultDestinations();
  const map = {};
  for (const r of (byCampaign || [])) {
    const k = String(r.campaign ?? "").toLowerCase();
    map[k] = Number(r.n ?? 0);
  }
  setText("cApero", formatInt(map.apero ?? 0));
  setText("cCatalan", formatInt(map.catalan ?? 0));
  setText("cChance", formatInt(map.chance ?? 0));
  setText("cJeux", formatInt(map.jeux ?? map.game ?? 0));

  const tbody = $("tbodyCampaign");
  if (!tbody) return;

  const keys = ["apero","catalan","chance","jeux"];
  const rows = keys
    .map(k => ({ key:k, clicks:Number(map[k] ?? 0), to:dest[k] || "#" }))
    .sort((a,b)=>b.clicks-a.clicks);

  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escapeHtml(campaignLabel(r.key))}</td>
      <td class="right">${formatInt(r.clicks)}</td>
      <td class="hideSm"><a href="${escapeHtml(buildGoLink(r.key,"direct"))}" target="_blank" rel="noopener">Lien tracking</a></td>
      <td class="hideSm"><a href="${escapeHtml(r.to)}" target="_blank" rel="noopener">Destination</a></td>
    </tr>
  `).join("");
}

function fillLastClicks(last) {
  const tbody = $("tbodyLast");
  if (!tbody) return;
  if (!Array.isArray(last) || !last.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="color:rgba(210,255,250,.65)">—</td></tr>`;
    return;
  }
  tbody.innerHTML = last.slice(0,50).map(r => {
    const date = safeLabel(r.created_at ?? r.date ?? "");
    const camp = safeLabel(r.campaign ?? "");
    const src = safeLabel(r.source ?? "");
    const country = safeLabel(r.country ?? "");
    const device = safeLabel(r.device ?? "");
    const os = safeLabel(r.os ?? "");
    const browser = safeLabel(r.browser ?? "");
    return `
      <tr>
        <td>${escapeHtml(date)}</td>
        <td>${escapeHtml(campaignLabel(String(camp).toLowerCase()))}</td>
        <td>${escapeHtml(src)}</td>
        <td>${escapeHtml(country)}</td>
        <td class="hideSm">${escapeHtml(device)}</td>
        <td class="hideSm">${escapeHtml(os)}</td>
        <td class="hideSm">${escapeHtml(browser)}</td>
      </tr>
    `;
  }).join("");
}

// NEW: remplir les tableaux events.*
function fillEventTables(events) {
  if (!events) return;

  // byEvent: {k,n}
  if (elExists("tbodyEvent")) {
    const rows = events.byEvent || [];
    const tbody = $("tbodyEvent");
    tbody.innerHTML = rows.length
      ? rows
          .map(r => {
            const key = safeLabel(r.k ?? r.event_key ?? r.key);
            const n = Number(r.n ?? 0);
            return `<tr><td>${escapeHtml(eventLabel(key))}</td><td class="right">${formatInt(n)}</td></tr>`;
          })
          .join("")
      : `<tr><td colspan="2" style="color:rgba(210,255,250,.65)">—</td></tr>`;
  }

  // byBrand: {k,n}
  renderRows("tbodyBrand", events.byBrand, r => r.k, r => r.n);

  // byChannel: {k,n} (inclut "(none)")
  renderRows("tbodyChannel", events.byChannel, r => r.k, r => r.n);

  // byAction: {k,n}
  renderRows("tbodyAction", events.byAction, r => r.k, r => r.n);
}

async function copyLinks() {
  const lines = [
    "TRACKINGS OFFICIELS (ADN66)",
    "",
    "1) Apéro de Nuit 66 — aperos.net (boutons)",
    `• Bouton JEUX : ${buildGoLink("jeux","direct")}`,
    `• Bouton INSTALL APP : ${buildEventLink("apero_nuit.app.click", "https://aperos.net", "app")}`,
    `• Bouton APPEL : ${buildEventLink("apero_nuit.call", "tel:0652336461", "app")}`,
    "",
    "2) Apéro de Nuit 66 — acquisition (liens à coller)",
    `• Facebook : ${buildEventLink("apero_nuit.facebook.click", "https://aperos.net", "facebook")}`,
    `• QR code : ${buildEventLink("apero_nuit.qr.click", "https://aperos.net", "qr")}`,
    `• Google My Business : ${buildEventLink("apero_nuit.site.click", "https://aperos.net", "site")}`,
    "",
    "3) Roue — bouton avis",
    `• Avis (SMS) : ${buildEventLink("wheel.sms.click", "https://chance.aperos.net", "sms")}`,
    "",
    "4) Apéro Catalan — catalan.aperos.net",
    `• Bouton APPEL : ${buildEventLink("apero_catalan.call", "tel:0652336461", "app")}`,
    `• Bouton INSTALL APP : ${buildEventLink("apero_catalan.app.click", "https://catalan.aperos.net", "app")}`,
    "",
    "5) Apéro Catalan — acquisition",
    `• Google My Business : ${buildGoLink("catalan","direct")}`,
    `• Facebook : ${buildGoLink("catalan","facebook")}`,
    "",
    "6) Hibair Drink (Jeux) — acquisition",
    `• QR code : ${buildGoLink("jeux","qr")}`,
    `• Facebook : ${buildGoLink("jeux","facebook")}`,
  ];

  const txt = lines.join("
");
  try {
    await navigator.clipboard.writeText(txt);
    setStatus("Liens copiés ✅", "good");
  } catch {
    setStatus("Copie bloquée (navigateur) — ouvre sur Chrome", "warn");
  }
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

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

async function refresh() {
  setStatus("Chargement des stats…", "warn");

  try {
    // Health (soft)
    try { await fetch(API_HEALTH, { cache: "no-store" }); } catch {}

    const raw = await fetchJson(API_STATS);
    if (raw && raw.ok === false) throw new Error(raw.error || "API ok=false");

    const base = normalizeStats(raw);

    // Optional endpoints: merge if available
    for (const ep of OPT_ENDPOINTS) {
      const opt = await fetchOptional(ep.url);
      if (opt && opt.ok === false) continue;
      if (opt) {
        // Accept both {ok:true, results:[...]} or direct arrays
        if (Array.isArray(opt)) base[ep.key] = opt;
        else if (Array.isArray(opt.results)) base[ep.key] = opt.results;
        else if (Array.isArray(opt[ep.key])) base[ep.key] = opt[ep.key];
      }
    }

    fillKPIs(base);
    fillCampaigns(base.byCampaign);

    renderRows("tbodyDevice", base.byDevice, r => r.device, r => r.n);
    renderRows("tbodyOS", base.byOS, r => r.os, r => r.n);
    renderRows("tbodyBrowser", base.byBrowser, r => r.browser, r => r.n);
    renderRows("tbodyCountry", base.byCountry, r => r.country, r => r.n);

    // Existing optional blocks
    renderRows("tbodySource", base.bySource, r => r.source, r => r.n);
    renderRows("tbodyHourly", base.hourly, r => r.hour ?? r.heure, r => r.n);
    fillLastClicks(base.last);

    // NEW: events blocks
    fillEventTables(base.events);

    setStatus("OK • stats à jour ✅", "good");
  } catch (err) {
    console.error(err);
    setStatus(`Erreur: ${err.message}`, "bad");
    setText("kpiTotal", "—");
    setText("kpiToday", "—");
    setText("kpiCampaigns", "—");
    if (elExists("kpiEventsTotal")) setText("kpiEventsTotal", "—");
    if (elExists("kpiEventsToday")) setText("kpiEventsToday", "—");
  }
}

function setupAuto() {
  const LS = "adn66_stat_auto";
  const toggle = $("autoToggle");
  if (!toggle) return;

  let on = localStorage.getItem(LS) === "1";
  toggle.checked = on;

  let timer = null;
  const arm = () => {
    if (timer) clearInterval(timer);
    if (toggle.checked) timer = setInterval(refresh, 30000);
  };

  toggle.addEventListener("change", () => {
    localStorage.setItem(LS, toggle.checked ? "1":"0");
    arm();
  });

  arm();
}

async function hardReload() {
  try{
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  }catch{}
  location.reload(true);
}

document.addEventListener("DOMContentLoaded", () => {
  setText("apiHost", "stats.aperos.net");
  if (elExists("btnRefresh")) $("btnRefresh").addEventListener("click", refresh);
  if (elExists("btnCopyLinks")) $("btnCopyLinks").addEventListener("click", copyLinks);
  if (elExists("btnHardReload")) $("btnHardReload").addEventListener("click", hardReload);

  setupPWAInstall();
  setupAuto();
  refresh();
});
