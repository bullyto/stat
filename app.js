/* Stats ADN66 — app.js (Front PWA)
   Base visuelle fournie par ADN66 (index.html/style.css)
   Objectif: UI minimal:
   - Bloc "Liens tracking" (format exact demandé)
   - Barres (4 univers) avec couleurs via classes
   - OS / Navigateur / Appareil
   - 50 derniers (mix clicks + events)
*/

const STATS_ORIGIN = "https://stats.aperos.net";
const API_STATS = `${STATS_ORIGIN}/api/stats`;
const API_HEALTH = `${STATS_ORIGIN}/api/health`;

const $ = (id) => document.getElementById(id);

function setText(id, text) { const el = $(id); if (el) el.textContent = text; }
function setHTML(id, html) { const el = $(id); if (el) el.innerHTML = html; }

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

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  const text = await res.text();
  if (!res.ok) {
    const snippet = text.slice(0, 220).replace(/\s+/g," ").trim();
    throw new Error(`HTTP ${res.status} — ${snippet || "réponse vide"}`);
  }
  const trimmed = text.trim();
  if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) {
    const snippet = trimmed.slice(0, 220).replace(/\s+/g," ").trim();
    throw new Error(`Réponse non-JSON. Début: ${snippet}`);
  }
  return JSON.parse(text);
}

/** Normalize /api/stats output */
function normalizeStats(data) {
  const byCampaign = Array.isArray(data.byCampaign) ? data.byCampaign : [];
  const byDevice = Array.isArray(data.byDevice) ? data.byDevice : [];
  const byOS = Array.isArray(data.byOS) ? data.byOS : [];
  const byBrowser = Array.isArray(data.byBrowser) ? data.byBrowser : [];
  const lastClicks = Array.isArray(data.last) ? data.last : [];

  const ev = (data && typeof data.events === "object" && data.events) ? data.events : null;
  const events = {
    byEvent: Array.isArray(ev?.byEvent) ? ev.byEvent : [],
    last: Array.isArray(ev?.last) ? ev.last : [],
  };

  return { byCampaign, byDevice, byOS, byBrowser, lastClicks, events };
}

/** Render simple 2-col tbody */
function renderRows(tbodyId, rows, kGetter, vGetter) {
  const tbody = $(tbodyId);
  if (!tbody) return;

  const safeRows = (rows || [])
    .map(r => ({ k: safeLabel(kGetter(r)), v: Number(vGetter(r) ?? 0) }))
    .sort((a,b)=>b.v-a.v);

  tbody.innerHTML = safeRows.length
    ? safeRows.map(r => `<tr><td>${escapeHtml(r.k)}</td><td class="right">${formatInt(r.v)}</td></tr>`).join("")
    : `<tr><td colspan="2" style="color:rgba(234,242,255,.55)">—</td></tr>`;
}

function campaignMap(byCampaign) {
  const m = {};
  for (const r of (byCampaign || [])) {
    const k = String(r.campaign ?? "").toLowerCase();
    m[k] = Number(r.n ?? 0);
  }
  return m;
}

function eventMap(byEvent) {
  const m = {};
  for (const r of (byEvent || [])) {
    const k = String(r.k ?? r.event_key ?? r.key ?? "").trim();
    if (!k) continue;
    m[k] = Number(r.n ?? 0);
  }
  return m;
}

function linksText() {
  // EXACT format demandé par ADN66
  return [
`APERO.NET :
BOUTON JEUX : https://stats.aperos.net/go/jeux?src=direct
BOUTON INSTAL APP : https://stats.aperos.net/e/apero_nuit.app.click?to=https%3A%2F%2Faperos.net&src=app
BOUTON APPEL : https://stats.aperos.net/e/apero_nuit.call?to=tel%3A0652336461&src=app

BOUTON AGE GATE APERO DE NUIT:
Accepte :https://stats.aperos.net/e/apero_nuit.age.accept?to=https%3A%2F%2Faperos.net&src=agegate
refuse : https://stats.aperos.net/e/apero_nuit.age.refuse?to=https%3A%2F%2Faperos.net&src=agegate


apero de nuit via Facebook :
https://stats.aperos.net/e/apero_nuit.facebook.click?to=https%3A%2F%2Faperos.net&src=facebook

apero de nuit via google my buisness :
https://stats.aperos.net/e/apero_nuit.site.click?to=https%3A%2F%2Faperos.net&src=site

ROUE DE LA FORTUNE :
https://stats.aperos.net/e/wheel.sms.click?to=https%3A%2F%2Fchance.aperos.net&src=sms


catalan.aperos.net :
BOUTTON APPEL : https://stats.aperos.net/e/apero_catalan.call?to=tel%3A0652336461&src=app
BONTON INSTALL APP : https://stats.aperos.net/e/apero_catalan.app.click?to=https%3A%2F%2Fcatalan.aperos.net&src=app

BOUTON AGE GATE 
accepte : https://stats.aperos.net/e/apero_catalan.age.accept?to=https%3A%2F%2Fcatalan.aperos.net&src=agegate
refuse : https://stats.aperos.net/e/apero_catalan.age.refuse?to=https%3A%2F%2Fcatalan.aperos.net&src=agegate


apero catalan via google my buisness :
https://stats.aperos.net/go/catalan?src=direct

apero catalan via facebook :
https://stats.aperos.net/go/catalan?src=facebook

le jeux hibair drink via QR code :
https://stats.aperos.net/go/jeux?src=qr

le jeux hibair drink via facebook :
https://stats.aperos.net/go/jeux?src=facebook`
  ].join("\n");
}

async function copyLinks() {
  const txt = linksText();
  try {
    await navigator.clipboard.writeText(txt);
    setStatus("Liens copiés ✅", "good");
  } catch {
    setStatus("Copie bloquée (navigateur) — essaye Chrome", "warn");
  }
}

function renderLinksBox() {
  // monospace block with clickable URLs
  const raw = linksText();
  // transform URLs into anchors, keep line breaks
  const urlRe = /(https?:\/\/[^\s]+)/g;
  const html = escapeHtml(raw).replace(urlRe, (m)=>`<a href="${m}" target="_blank" rel="noopener">${m}</a>`).replaceAll("\n","<br>");
  setHTML("linksBox", html);
}

function parseDateAny(v) {
  // supports created_at / ts / ISO strings
  const s = String(v || "").trim();
  if (!s) return null;
  // If it's already ISO
  const d1 = new Date(s);
  if (!Number.isNaN(d1.getTime())) return d1;
  // If it's unix seconds/ms
  const n = Number(s);
  if (Number.isFinite(n)) {
    const ms = (n > 1e12) ? n : n*1000;
    const d2 = new Date(ms);
    if (!Number.isNaN(d2.getTime())) return d2;
  }
  return null;
}

function fmtDateShort(d) {
  try {
    return new Intl.DateTimeFormat("fr-FR", { dateStyle:"short", timeStyle:"medium" }).format(d);
  } catch {
    return d.toISOString();
  }
}

function normalizeClickRow(r) {
  return {
    kind: "click",
    date: parseDateAny(r.created_at ?? r.ts ?? r.date) || null,
    name: safeLabel(r.campaign ?? ""),
    src: safeLabel(r.source ?? r.src ?? ""),
    os: safeLabel(r.os ?? ""),
    browser: safeLabel(r.browser ?? ""),
  };
}

function normalizeEventRow(r) {
  return {
    kind: "event",
    date: parseDateAny(r.ts ?? r.created_at ?? r.date) || null,
    name: safeLabel(r.event_key ?? r.k ?? r.key ?? ""),
    src: safeLabel(r.src ?? r.source ?? ""),
    os: safeLabel(r.os ?? ""),
    browser: safeLabel(r.browser ?? ""),
  };
}

function renderLast50(lastClicks, lastEvents) {
  const tbody = $("tbodyLast50");
  if (!tbody) return;

  const clicks = (lastClicks || []).map(normalizeClickRow);
  const events = (lastEvents || []).map(normalizeEventRow);

  const all = clicks.concat(events)
    .filter(x => x.date)
    .sort((a,b)=>b.date.getTime()-a.date.getTime())
    .slice(0,50);

  if (!all.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="color:rgba(234,242,255,.55)">—</td></tr>`;
    return;
  }

  tbody.innerHTML = all.map(x => `
    <tr>
      <td>${escapeHtml(fmtDateShort(x.date))}</td>
      <td>${escapeHtml(x.kind)}</td>
      <td>${escapeHtml(x.name)}</td>
      <td class="hideSm">${escapeHtml(x.src)}</td>
      <td class="hideSm">${escapeHtml(x.os)}</td>
      <td class="hideSm">${escapeHtml(x.browser)}</td>
    </tr>
  `).join("");
}

function computeProjects(byCampaign, byEvent) {
  const c = campaignMap(byCampaign);
  const e = eventMap(byEvent);

  // Hibair Drink = "jeux" campaign (Hibair/Game) — c'est ton usage actuel via /go/jeux
  const hibair = Number(c.jeux ?? c.game ?? 0);

  // Apéro nuit = campaign "apero" (+ events apero_nuit.* si présents)
  let nuit = Number(c.apero ?? 0);
  for (const [k,v] of Object.entries(e)) {
    if (k.startsWith("apero_nuit.")) nuit += Number(v || 0);
  }

  // Catalan = campaign "catalan" (+ events apero_catalan.* si présents)
  let catalan = Number(c.catalan ?? 0);
  for (const [k,v] of Object.entries(e)) {
    if (k.startsWith("apero_catalan.")) catalan += Number(v || 0);
  }

  // Roue = event wheel.* (+ campaign chance si tu l'utilises pour la roue)
  let wheel = 0;
  for (const [k,v] of Object.entries(e)) {
    if (k.startsWith("wheel.")) wheel += Number(v || 0);
  }
  wheel += Number(c.chance ?? 0);

  // expose for index.html mini viz
  window.__ADN66_PROJECTS__ = { nuit, catalan, hibair, wheel };
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
    // base uses service-worker.js as main SW
    navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
  }
}

async function refresh() {
  setStatus("Chargement…", "warn");
  try {
    try { await fetch(API_HEALTH, { cache:"no-store" }); } catch {}

    const raw = await fetchJson(API_STATS);
    if (raw && raw.ok === false) throw new Error(raw.error || "API ok=false");

    const s = normalizeStats(raw);

    // Rendu tables demandées
    renderRows("tbodyDevice", s.byDevice, r => r.device, r => r.n);
    renderRows("tbodyOS", s.byOS, r => r.os, r => r.n);
    renderRows("tbodyBrowser", s.byBrowser, r => r.browser, r => r.n);

    // Projects totals (for bars)
    computeProjects(s.byCampaign, s.events.byEvent);

    // Last 50
    renderLast50(s.lastClicks, s.events.last);

    setStatus("OK ✅", "good");
  } catch (err) {
    console.error(err);
    setStatus(`Erreur: ${err.message}`, "bad");
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
  renderLinksBox();

  const br = $("btnRefresh");
  if (br) br.addEventListener("click", refresh);

  const bc = $("btnCopyLinks");
  if (bc) bc.addEventListener("click", copyLinks);

  const bh = $("btnHardReload");
  if (bh) bh.addEventListener("click", hardReload);

  setupPWAInstall();
  setupAuto();
  refresh();
});
