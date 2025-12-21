/* Stats ADN66 - app.js (frontend)
   - Affiche: total, aujourd'hui
   - Détails: campagnes, sources, appareils, OS, navigateurs, pays
   - Optionnel si dispo côté API: clics par heure, derniers clics
*/

(() => {
  "use strict";

  // ========= CONFIG =========
  const CAMPAIGNS = [
    { key: "apero", label: "Apéro" },
    { key: "catalan", label: "Catalan" },
    { key: "chance", label: "Chance" },
    { key: "jeux", label: "Jeux" },
  ];

  // Liste "source" proposée (tu peux en ajouter)
  const SOURCES = [
    { key: "direct", label: "Direct" },
    { key: "sms", label: "SMS" },
    { key: "facebook", label: "Facebook" },
    { key: "messenger",label: "Messenger" },
    { key: "insta", label: "Instagram" },
    { key: "snap", label: "Snap" },
    { key: "flyer", label: "Flyer" },
    { key: "qr", label: "QR" },
  ];

  // API: même domaine
  const API_STATS = "/api/stats";
  const API_HEALTH = "/api/health";

  // ========= HELPERS =========
  const $ = (id) => document.getElementById(id);

  function safeText(v) {
    if (v === null || v === undefined) return "?";
    const s = String(v).trim();
    return s.length ? s : "?";
  }

  function n(v) {
    const x = Number(v);
    return Number.isFinite(x) ? x : 0;
  }

  function setStatus(msg, ok = true) {
    const el = $("status");
    if (!el) return;
    el.textContent = msg;
    el.dataset.ok = ok ? "1" : "0";
  }

  function fmtDateLocal(isoLike) {
    // created_at peut être "YYYY-MM-DD HH:MM:SS" (sqlite) ou ISO
    if (!isoLike) return "";
    const s = String(isoLike);

    // essaie ISO direct
    let d = new Date(s);
    if (!isNaN(d.getTime())) return d.toLocaleString();

    // essaie "YYYY-MM-DD HH:MM:SS" -> "YYYY-MM-DDTHH:MM:SS"
    const s2 = s.replace(" ", "T");
    d = new Date(s2);
    if (!isNaN(d.getTime())) return d.toLocaleString();

    return s;
  }

  function renderPairs(containerId, title, rows, keyField, valueField) {
    const root = $(containerId);
    if (!root) return;

    // Structure attendue:
    // <div id="xxx">
    // <div class="mini-title">...</div> (optionnel)
    // <div class="rows"></div> (optionnel)
    // </div>

    const titleEl = root.querySelector("[data-title]") || root.querySelector(".mini-title");
    if (titleEl && title) titleEl.textContent = title;

    const list = root.querySelector("[data-rows]") || root;
    list.innerHTML = "";

    if (!rows || !rows.length) {
      const empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = "—";
      list.appendChild(empty);
      return;
    }

    const table = document.createElement("table");
    table.className = "mini-table";

    const thead = document.createElement("thead");
    thead.innerHTML = `<tr><th>${safeText(keyField)}</th><th>${safeText(valueField)}</th></tr>`;
    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    for (const r of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(safeText(r[keyField]))}</td>
        <td>${escapeHtml(String(n(r[valueField])))}</td>
      `;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    list.appendChild(table);
  }

  function renderCampaignCards(byCampaign) {
    // Affichage “cards” si tu as des IDs dédiés (sinon ça ne casse pas)
    // Ex: <span id="camp_apero">0</span> etc.
    if (!byCampaign || !byCampaign.length) return;

    const map = new Map();
    for (const r of byCampaign) map.set(String(r.campaign || "").toLowerCase(), n(r.n));

    for (const c of CAMPAIGNS) {
      const el = $(`camp_${c.key}`);
      if (el) el.textContent = String(map.get(c.key) ?? 0);
    }

    // tableau “Détails par campagne” si existe
    const tableWrap = $("tableCampaign");
    if (tableWrap) {
      tableWrap.innerHTML = "";
      const table = document.createElement("table");
      table.className = "big-table";
      table.innerHTML = `
        <thead>
          <tr><th>Campagne</th><th>Clics</th></tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");

      // tri décroissant
      const sorted = [...byCampaign].sort((a,b) => n(b.n) - n(a.n));
      for (const r of sorted) {
        const key = safeText(r.campaign);
        const label = CAMPAIGNS.find(x => x.key === String(key).toLowerCase())?.label || key;
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${escapeHtml(label)}</td><td>${escapeHtml(String(n(r.n)))}</td>`;
        tbody.appendChild(tr);
      }
      tableWrap.appendChild(table);
    }
  }

  function renderHourly(hourlyRows) {
    // Attendu: [{hour:"00", n: 1}, ...]
    const root = $("tableHourly");
    if (!root) return;

    root.innerHTML = "";
    if (!hourlyRows || !hourlyRows.length) {
      root.textContent = "—";
      return;
    }

    const table = document.createElement("table");
    table.className = "big-table";
    table.innerHTML = `
      <thead><tr><th>Heure</th><th>Clics</th></tr></thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    const sorted = [...hourlyRows].sort((a,b) => String(a.hour).localeCompare(String(b.hour)));
    for (const r of sorted) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${escapeHtml(safeText(r.hour))}</td><td>${escapeHtml(String(n(r.n)))}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    root.appendChild(table);
  }

  function renderLastClicks(lastRows) {
    // Attendu: [{created_at,campaign,source,country,device,os,browser,referrer,domain,path}]
    const root = $("tableLast");
    if (!root) return;

    root.innerHTML = "";
    if (!lastRows || !lastRows.length) {
      root.textContent = "—";
      return;
    }

    const table = document.createElement("table");
    table.className = "big-table";
    table.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Campagne</th>
          <th>Source</th>
          <th>Pays</th>
          <th>Appareil</th>
          <th>OS</th>
          <th>Navigateur</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tbody = table.querySelector("tbody");

    for (const r of lastRows) {
      const campKey = safeText(r.campaign).toLowerCase();
      const campLabel = CAMPAIGNS.find(x => x.key === campKey)?.label || safeText(r.campaign);

      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHtml(fmtDateLocal(r.created_at))}</td>
        <td>${escapeHtml(campLabel)}</td>
        <td>${escapeHtml(safeText(r.source))}</td>
        <td>${escapeHtml(safeText(r.country))}</td>
        <td>${escapeHtml(safeText(r.device))}</td>
        <td>${escapeHtml(safeText(r.os))}</td>
        <td>${escapeHtml(safeText(r.browser))}</td>
      `;
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    root.appendChild(table);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ========= LINKS =========
  function buildGoLink(campaignKey, src) {
    // relative (même domaine): /go/chance?src=QR
    const u = new URL(location.origin + `/go/${campaignKey}`);
    if (src) u.searchParams.set("src", src);
    return u.toString();
  }

  function buildLinksText() {
    // Format prêt à coller
    // (Tu peux modifier les sources comme tu veux)
    const lines = [];

    lines.push("=== ADN66 Tracking Links ===");
    lines.push("");

    for (const c of CAMPAIGNS) {
      lines.push(`--- ${c.label} ---`);
      lines.push(`Direct: ${buildGoLink(c.key)}`);
      lines.push(`QR: ${buildGoLink(c.key, "QR")}`);
      lines.push(`Flyer: ${buildGoLink(c.key, "flyer")}`);
      lines.push(`SMS: ${buildGoLink(c.key, "sms")}`);
      lines.push(`FB: ${buildGoLink(c.key, "facebook")}`);
      lines.push("");
    }

    lines.push("Astuce: tu peux inventer une source: ?src=toto (ça s’affiche dans Origine).");
    return lines.join("\n");
  }

  async function copyLinks() {
    const text = buildLinksText();
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Liens copiés ✅", true);
    } catch {
      // fallback
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      setStatus("Liens copiés ✅", true);
    }
  }

  // ========= FETCH / RENDER =========
  async function refresh() {
    setStatus("Chargement…", true);

    try {
      // petit check health (optionnel)
      await fetch(API_HEALTH, { cache: "no-store" }).catch(() => {});

      const r = await fetch(API_STATS, { cache: "no-store" });
      const data = await r.json();

      if (!data?.ok) {
        setStatus(`Erreur: ${safeText(data?.error)}`, false);
        return;
      }

      // Totaux
      if ($("total")) $("total").textContent = String(n(data.total));
      if ($("today")) $("today").textContent = String(n(data.today));

      // Campagnes
      renderCampaignCards(data.byCampaign || []);

      // Blocs simples (si tes IDs existent)
      // NB: ton API renvoie des objets genre:
      // byDevice: [{device:"mobile", n:10}, ...]
      // byOS: [{os:"Android", n:10}, ...]
      // byBrowser: [{browser:"Chrome", n:10}, ...]
      // byCountry: [{country:"FR", n:20}, ...]
      // bySource: [{source:"qr", n:5}, ...] (si tu l’ajoutes côté Worker)

      // Compat si ton API a des noms différents (ex: appareil/os/navigateur/pays)
      const byDevice = normalizeRows(data.byDevice, ["device","appareil"], "device");
      const byOS = normalizeRows(data.byOS, ["os"], "os");
      const byBrowser = normalizeRows(data.byBrowser, ["browser","navigateur"], "browser");
      const byCountry = normalizeRows(data.byCountry, ["country","pays"], "country");
      const bySource = normalizeRows(data.bySource, ["source"], "source");

      renderPairs("boxDevice", "Appareils", byDevice, "device", "n");
      renderPairs("boxOS", "OS", byOS, "os", "n");
      renderPairs("boxBrowser", "Navigateurs", byBrowser, "browser", "n");
      renderPairs("boxCountry", "Pays", byCountry, "country", "n");
      renderPairs("boxSource", "Origine", bySource, "source", "n");

      // Optionnel si ton Worker les renvoie
      // hourlyToday: [{hour:"00", n:1}, ...]
      // last: [{created_at,...}, ...]
      renderHourly(data.hourlyToday || data.byHour || []);
      renderLastClicks(data.last || data.lastClicks || []);

      setStatus("OK • stats à jour ✅", true);

    } catch (e) {
      setStatus(`Erreur: ${safeText(e?.message || e)}`, false);
    }
  }

  function normalizeRows(rows, possibleKeyFields, targetKey) {
    if (!Array.isArray(rows)) return [];
    // transforme [{appareil:"mobile", n:10}] -> [{device:"mobile", n:10}]
    return rows.map(r => {
      const out = { ...r };
      if (!(targetKey in out)) {
        for (const k of possibleKeyFields) {
          if (k in out) {
            out[targetKey] = out[k];
            break;
          }
        }
      }
      // fallback
      if (!(targetKey in out)) out[targetKey] = "?";
      if (!("n" in out)) out.n = 0;
      return out;
    });
  }

  // ========= PWA INSTALL + SW =========
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
      navigator.serviceWorker.register("./service-worker.js").catch(console.error);
    }
  }

  // ========= INIT =========
  document.addEventListener("DOMContentLoaded", () => {
    const br = $("btnRefresh");
    const bc = $("btnCopyLinks");
    if (br) br.addEventListener("click", refresh);
    if (bc) bc.addEventListener("click", copyLinks);

    setupPWAInstall();
    refresh();
  });

})();
