/* Stats ADN66 — PWA front
   Campagnes: apero / catalan / chance / jeux
   API: https://stats.aperos.net/api/stats
   Tracking: https://stats.aperos.net/go/<campaign>?src=XXX
*/

const API_STATS = "https://stats.aperos.net/api/stats";
const TRACK_BASE = "https://stats.aperos.net/go";

const $ = (id) => document.getElementById(id);

function setStatus(msg, isErr = false) {
  const el = $("status");
  if (!el) return;
  el.textContent = msg || "";
  el.classList.toggle("err", !!isErr);
}

function formatInt(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("fr-FR").format(v);
}

function campaignLabel(key) {
  const map = { apero: "Apéro", catalan: "Catalan", chance: "Chance", jeux: "Jeux" };
  return map[key] || key;
}

function defaultDestinations() {
  // ✅ tes vraies destinations
  return {
    apero: "https://aperos.net",
    catalan: "https://catalan.aperos.net",
    chance: "https://chance.aperos.net",
    jeux: "https://game.aperos.net",
  };
}

// ✅ Worker: /go/<campaign>?src=QR (ou SMS/FB/etc)
function buildGoLink(campaign, src = "direct") {
  const u = new URL(`${TRACK_BASE}/${encodeURIComponent(campaign)}`);
  if (src) u.searchParams.set("src", src);
  return u.toString();
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

/* ---------- Helpers pour parser les résultats D1 ---------- */

function pick(obj, keys, fallback = null) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return fallback;
}

function toMapFromArray(arr, keyCandidates, valueCandidates) {
  // arr = [{campaign:'jeux', n:10}, ...] ou [{pays:'FR', n:16}, ...]
  const map = {};
  if (!Array.isArray(arr)) return map;
  for (const row of arr) {
    const k = String(pick(row, keyCandidates, "") || "").trim();
    const v = Number(pick(row, valueCandidates, 0) || 0);
    if (!k) continue;
    map[k] = (map[k] || 0) + (Number.isFinite(v) ? v : 0);
  }
  return map;
}

function sortEntriesDesc(map) {
  return Object.entries(map).sort((a, b) => (b[1] || 0) - (a[1] || 0));
}

function ensureExtraContainer() {
  let host = $("extra");
  if (host) return host;

  // fallback: on insère après la table si possible, sinon fin du body
  const table = document.querySelector("table");
  host = document.createElement("div");
  host.id = "extra";
  host.style.marginTop = "16px";

  if (table && table.parentElement) {
    table.parentElement.appendChild(host);
  } else {
    document.body.appendChild(host);
  }
  return host;
}

function renderMiniTable(host, title, entries, opts = {}) {
  const { max = 8, emptyLabel = "—" } = opts;

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginTop = "12px";
  card.innerHTML = `
    <div class="cardTitle">${title}</div>
    <div class="miniTableWrap">
      <table class="miniTable">
        <thead>
          <tr>
            <th>${title}</th>
            <th style="text-align:right;">Clics</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;
  const tbody = card.querySelector("tbody");

  const sliced = (entries || []).slice(0, max);
  if (!sliced.length) {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${emptyLabel}</td><td style="text-align:right;">0</td>`;
    tbody.appendChild(tr);
  } else {
    for (const [k, v] of sliced) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(k)}</td><td style="text-align:right;">${formatInt(v)}</td>`;
      tbody.appendChild(tr);
    }
  }

  host.appendChild(card);
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ---------- UI ---------- */

function updateTopKPIs(data, campaignCounts) {
  if ($("kpiTotal")) $("kpiTotal").textContent = formatInt(data.total);
  if ($("kpiToday")) $("kpiToday").textContent = formatInt(data.today);

  if ($("cApero")) $("cApero").textContent = formatInt(campaignCounts.apero || 0);
  if ($("cCatalan")) $("cCatalan").textContent = formatInt(campaignCounts.catalan || 0);
  if ($("cChance")) $("cChance").textContent = formatInt(campaignCounts.chance || 0);
  if ($("cJeux")) $("cJeux").textContent = formatInt(campaignCounts.jeux || 0);
}

function renderMainTable(campaignCounts) {
  const tbody = $("tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  const dest = defaultDestinations();
  const rows = ["apero", "catalan", "chance", "jeux"]
    .map((k) => ({ key: k, clicks: Number(campaignCounts[k] ?? 0), to: dest[k] }))
    .sort((a, b) => b.clicks - a.clicks);

  for (const r of rows) {
    const tr = document.createElement("tr");

    const td1 = document.createElement("td");
    td1.textContent = campaignLabel(r.key);

    const td2 = document.createElement("td");
    td2.textContent = formatInt(r.clicks);

    const td3 = document.createElement("td");
    // liens exemples: direct / QR / SMS / FB
    const goDirect = buildGoLink(r.key, "direct");
    const goQR = buildGoLink(r.key, "QR");
    const goSMS = buildGoLink(r.key, "SMS");
    const goFB = buildGoLink(r.key, "FB");

    td3.innerHTML = `
      <div class="linksLine">
        <a href="${goDirect}" target="_blank" rel="noopener">Lien direct</a>
        <span class="muted"> • </span>
        <a href="${goQR}" target="_blank" rel="noopener">QR</a>
        <span class="muted"> • </span>
        <a href="${goSMS}" target="_blank" rel="noopener">SMS</a>
        <span class="muted"> • </span>
        <a href="${goFB}" target="_blank" rel="noopener">FB</a>
      </div>
      <div class="linksLine mutedSmall">
        Destination : <a href="${r.to}" target="_blank" rel="noopener">${r.to}</a>
      </div>
    `;

    tr.appendChild(td1);
    tr.appendChild(td2);
    tr.appendChild(td3);
    tbody.appendChild(tr);
  }
}

function renderExtraBreakdowns(data) {
  const host = ensureExtraContainer();
  host.innerHTML = ""; // reset

  // bySource (si tu l’as dans l’API)
  const bySourceMap = toMapFromArray(
    data.bySource,
    ["source", "src"],
    ["n", "count", "clicks"]
  );

  // byDevice : accepte device/appareil
  const byDeviceMap = toMapFromArray(
    data.byDevice,
    ["device", "appareil"],
    ["n", "count", "clicks"]
  );

  // byOS
  const byOSMap = toMapFromArray(
    data.byOS,
    ["os"],
    ["n", "count", "clicks"]
  );

  // byBrowser : accepte browser/navigateur
  const byBrowserMap = toMapFromArray(
    data.byBrowser,
    ["browser", "navigateur"],
    ["n", "count", "clicks"]
  );

  // byCountry : accepte country/pays
  const byCountryMap = toMapFromArray(
    data.byCountry,
    ["country", "pays"],
    ["n", "count", "clicks"]
  );

  // Rendu (tri décroissant)
  if (Object.keys(bySourceMap).length) {
    renderMiniTable(host, "Sources", sortEntriesDesc(bySourceMap), { max: 10 });
  }
  renderMiniTable(host, "Appareils", sortEntriesDesc(byDeviceMap), { max: 10 });
  renderMiniTable(host, "OS", sortEntriesDesc(byOSMap), { max: 10 });
  renderMiniTable(host, "Navigateurs", sortEntriesDesc(byBrowserMap), { max: 10 });
  renderMiniTable(host, "Pays", sortEntriesDesc(byCountryMap), { max: 12 });
}

async function refresh() {
  setStatus("Chargement des stats…");
  try {
    const data = await fetchJson(API_STATS);

    // Campagnes: on reconstruit à partir de byCampaign (ton API actuelle)
    const campaignCounts = toMapFromArray(
      data.byCampaign,
      ["campaign"],
      ["n", "count", "clicks"]
    );

    // assure les 4 clés
    const safeCampaigns = {
      apero: Number(campaignCounts.apero || 0),
      catalan: Number(campaignCounts.catalan || 0),
      chance: Number(campaignCounts.chance || 0),
      jeux: Number(campaignCounts.jeux || 0),
    };

    updateTopKPIs(data, safeCampaigns);
    renderMainTable(safeCampaigns);
    renderExtraBreakdowns(data);

    setStatus("OK • stats à jour ✅");
  } catch (err) {
    console.error(err);
    setStatus("Erreur : API non accessible (Worker / DNS / CORS).", true);
  }
}

async function copyLinks() {
  const dest = defaultDestinations();
  const lines = [
    `Apéro (QR) : ${buildGoLink("apero", "QR")} -> ${dest.apero}`,
    `Catalan (QR) : ${buildGoLink("catalan", "QR")} -> ${dest.catalan}`,
    `Chance (QR) : ${buildGoLink("chance", "QR")} -> ${dest.chance}`,
    `Jeux (QR) : ${buildGoLink("jeux", "QR")} -> ${dest.jeux}`,
    "",
    `Apéro (SMS) : ${buildGoLink("apero", "SMS")}`,
    `Catalan (SMS) : ${buildGoLink("catalan", "SMS")}`,
    `Chance (SMS) : ${buildGoLink("chance", "SMS")}`,
    `Jeux (SMS) : ${buildGoLink("jeux", "SMS")}`,
    "",
    `Apéro (FB) : ${buildGoLink("apero", "FB")}`,
    `Catalan (FB) : ${buildGoLink("catalan", "FB")}`,
    `Chance (FB) : ${buildGoLink("chance", "FB")}`,
    `Jeux (FB) : ${buildGoLink("jeux", "FB")}`,
  ];

  const txt = lines.join("\n");
  try {
    await navigator.clipboard.writeText(txt);
    setStatus("Liens copiés ✅ (tu peux coller dans tes notes / SMS / FB)");
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

  if (btn) {
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
  }

  // Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(console.error);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const b1 = $("btnRefresh");
  const b2 = $("btnCopyLinks");

  if (b1) b1.addEventListener("click", refresh);
  if (b2) b2.addEventListener("click", copyLinks);

  setupPWAInstall();
  refresh();
});
