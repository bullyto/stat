
/* Stats ADN66 — Front (GitHub Pages PWA)
   API: https://stats.aperos.net/api/stats
   Health: https://stats.aperos.net/api/health
*/
(() => {
  const API_STATS = "https://stats.aperos.net/api/stats";
  const API_HEALTH = "https://stats.aperos.net/api/health";

  const CAMPAIGNS = [
    { key: "apero", label: "Apéro" },
    { key: "catalan", label: "Catalan" },
    { key: "chance", label: "Chance" },
    { key: "jeux", label: "Jeux" },
  ];

  // Liens trackés (à adapter si tu changes les routes côté Worker)
  const TRACKED_LINKS = [
    { name: "Apéro", url: "https://stats.aperos.net/go/apero" },
    { name: "Catalan", url: "https://stats.aperos.net/go/catalan" },
    { name: "Chance", url: "https://stats.aperos.net/go/chance" },
    { name: "Jeux", url: "https://stats.aperos.net/go/jeux" },
  ];

  const $ = (sel) => document.querySelector(sel);
  const statusEl = $("#status");
  const btnRefresh = $("#btnRefresh");
  const btnCopyLinks = $("#btnCopyLinks");
  const btnHardRefresh = $("#btnHardRefresh");
  const toggleAuto = $("#toggleAuto");

  const kpiTotal = $("#kpiTotal");
  const kpiToday = $("#kpiToday");

  const campaignCards = $("#campaignCards");
  const tableCampaignBody = $("#tableCampaign tbody");
  const tableSourceBody = $("#tableSource tbody");
  const hourly = $("#hourly");
  const tableLatestBody = $("#tableLatest tbody");

  const linksModal = $("#linksModal");
  const btnCloseModal = $("#btnCloseModal");
  const linksList = $("#linksList");

  const LS = {
    lastStats: "adn66:lastStats",
    lastFetchedAt: "adn66:lastFetchedAt",
    auto: "adn66:auto",
    cacheBust: "adn66:cacheBust",
  };

  function setStatus(kind, text) {
    statusEl.className = `status ${kind}`;
    statusEl.textContent = text;
  }

  function fmt(n) {
    if (n === null || n === undefined) return "—";
    const x = Number(n);
    if (Number.isNaN(x)) return String(n);
    return x.toLocaleString("fr-FR");
  }

  function safeText(s, fallback = "—") {
    if (s === null || s === undefined || s === "") return fallback;
    return String(s);
  }

  function timeAgo(ms) {
    const sec = Math.round(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.round(sec / 60);
    if (min < 60) return `${min}min`;
    const h = Math.round(min / 60);
    return `${h}h`;
  }

  function parseStats(payload) {
    // On supporte plusieurs formats pour éviter les surprises
    // Format "attendu"
    // {
    //   ok: true,
    //   total: 123,
    //   today: 5,
    //   campaigns: { apero: 1, catalan: 2, chance: 3, jeux: 4 },
    //   byCampaign: [{campaign:"apero", n: 10}, ...]
    //   bySource: [{source:"direct", n: 10}, ...]
    //   hourly: [{hour:"23", n: 2}, ...]
    //   latest: [{id, campaign, source, country, created_at, referrer}, ...]
    // }
    const data = payload && payload.data ? payload.data : payload;

    const ok = Boolean(data?.ok ?? true);
    const total = data?.total ?? data?.stats?.total ?? data?.totals?.total ?? data?.clicks_total;
    const today = data?.today ?? data?.stats?.today ?? data?.totals?.today ?? data?.clicks_today;

    const campaigns = data?.campaigns ?? data?.by_campaign_obj ?? {};
    const byCampaign = Array.isArray(data?.byCampaign) ? data.byCampaign
                    : Array.isArray(data?.by_campaign) ? data.by_campaign
                    : Array.isArray(data?.campaigns_list) ? data.campaigns_list
                    : null;

    const bySource = Array.isArray(data?.bySource) ? data.bySource
                  : Array.isArray(data?.by_source) ? data.by_source
                  : Array.isArray(data?.sources) ? data.sources
                  : null;

    const hourlyArr = Array.isArray(data?.hourly) ? data.hourly
                    : Array.isArray(data?.by_hour) ? data.by_hour
                    : null;

    const latest = Array.isArray(data?.latest) ? data.latest
                 : Array.isArray(data?.last) ? data.last
                 : Array.isArray(data?.rows) ? data.rows
                 : null;

    return { ok, total, today, campaigns, byCampaign, bySource, hourly: hourlyArr, latest };
  }

  function renderCampaignCards(campaignCounts) {
    campaignCards.innerHTML = "";
    CAMPAIGNS.forEach((c) => {
      const n = campaignCounts?.[c.key] ?? 0;
      const card = document.createElement("div");
      card.className = "campaignCard";
      card.innerHTML = `
        <div class="campTop">
          <div class="campPill">Campagne</div>
          <div class="campName">${c.label}</div>
        </div>
        <div class="campValue">${fmt(n)}</div>
        <div class="campExact">Nom exact : <b>${c.key}</b></div>
      `;
      campaignCards.appendChild(card);
    });
  }

  function renderTable(bodyEl, rows, columns) {
    bodyEl.innerHTML = "";
    if (!rows || !rows.length) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="${columns.length}">—</td>`;
      bodyEl.appendChild(tr);
      return;
    }
    rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = columns.map((col) => {
        const val = col.value(r);
        const cls = col.className ? ` class="${col.className}"` : "";
        return `<td${cls}>${val}</td>`;
      }).join("");
      bodyEl.appendChild(tr);
    });
  }

  function normalizeCountRows(rows, keyName) {
    // rows might be like {campaign:'apero', n:1} or {campaign:'apero', count:1} or ['apero',1]
    const out = [];
    rows.forEach((r) => {
      if (Array.isArray(r)) {
        out.push({ [keyName]: r[0], n: r[1] });
      } else if (r && typeof r === "object") {
        out.push({ [keyName]: r[keyName] ?? r.name ?? r[keyName.toUpperCase()] ?? r[keyName.toLowerCase()] ?? r[keyName],
                   n: r.n ?? r.count ?? r.total ?? r.cnt ?? 0 });
      }
    });
    out.sort((a,b) => (b.n||0) - (a.n||0));
    return out;
  }

  function renderHourly(hourlyRows) {
    hourly.innerHTML = "";
    const rows = normalizeCountRows(hourlyRows || [], "hour");
    if (!rows.length) {
      hourly.innerHTML = `<div class="hint">—</div>`;
      return;
    }
    const max = Math.max(...rows.map(r => Number(r.n)||0), 1);
    rows.forEach((r) => {
      const row = document.createElement("div");
      row.className = "barRow";
      const hourLabel = String(r.hour).padStart(2,"0");
      const pct = Math.round((Number(r.n)||0) / max * 100);
      row.innerHTML = `
        <div class="barHour">${hourLabel}h</div>
        <div class="bar"><span style="width:${pct}%"></span></div>
        <div class="barN">${fmt(r.n)}</div>
      `;
      hourly.appendChild(row);
    });
  }

  function renderLatest(latestRows) {
    const rows = (latestRows || []).slice(0, 50);
    renderTable(tableLatestBody, rows, [
      { value: (r) => safeText(r.created_at ?? r.createdAt ?? r.date).replace("T"," ").slice(0,19) },
      { value: (r) => safeText(r.campaign ?? r.campagne ?? r.name) },
      { value: (r) => safeText(r.source ?? r.src) },
      { value: (r) => safeText(r.country ?? r.pays) },
      { className: "hideSm", value: (r) => {
          const ref = safeText(r.referrer ?? r.referer ?? r.ref);
          if (ref === "—") return "—";
          const short = ref.length > 70 ? ref.slice(0, 70) + "…" : ref;
          return `<span title="${escapeHtml(ref)}">${escapeHtml(short)}</span>`;
        }
      },
    ]);
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  async function fetchJson(url, { timeoutMs = 12000 } = {}) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);

    const cacheBust = localStorage.getItem(LS.cacheBust) || "";
    const u = new URL(url);
    if (cacheBust) u.searchParams.set("_v", cacheBust);

    const res = await fetch(u.toString(), {
      method: "GET",
      mode: "cors",
      cache: "no-store",
      signal: ctrl.signal,
      headers: {
        "accept": "application/json, text/plain, */*",
      }
    }).finally(() => clearTimeout(t));

    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${text.slice(0,140)}`);
    if (ct.includes("application/json")) return JSON.parse(text);
    // Si le worker renvoie du texte par erreur
    try { return JSON.parse(text); } catch { return { ok: false, raw: text }; }
  }

  function computeCampaignObj(byCampaignRows) {
    const obj = {};
    CAMPAIGNS.forEach(c => obj[c.key] = 0);
    (byCampaignRows || []).forEach(r => {
      const k = (r.campaign ?? r.name ?? r.campagne ?? "").toString().toLowerCase();
      if (k) obj[k] = Number(r.n ?? r.count ?? 0) || 0;
    });
    return obj;
  }

  async function refresh() {
    setStatus("warn", "Chargement…");
    try {
      // Health check
      const health = await fetchJson(API_HEALTH, { timeoutMs: 8000 });
      if (health && health.ok === false) {
        setStatus("bad", "API health: KO");
        console.warn("health", health);
        return;
      }

      const stats = await fetchJson(API_STATS, { timeoutMs: 14000 });
      const parsed = parseStats(stats);

      // Save offline snapshot
      localStorage.setItem(LS.lastStats, JSON.stringify(parsed));
      localStorage.setItem(LS.lastFetchedAt, String(Date.now()));

      render(parsed);
      setStatus("good", "OK • stats à jour ✅");
    } catch (e) {
      console.error(e);
      const last = loadLast();
      if (last) {
        render(last);
        setStatus("warn", "Hors-ligne • affichage du dernier cache");
      } else {
        setStatus("bad", "Erreur • impossible de charger");
      }
    }
  }

  function loadLast() {
    try {
      const raw = localStorage.getItem(LS.lastStats);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  }

  function render(parsed) {
    kpiTotal.textContent = fmt(parsed.total ?? 0);
    kpiToday.textContent = fmt(parsed.today ?? 0);

    // Campaign counts
    let campObj = parsed.campaigns;
    if (!campObj || typeof campObj !== "object" || Array.isArray(campObj)) {
      campObj = {};
    }
    if (parsed.byCampaign && Array.isArray(parsed.byCampaign)) {
      campObj = { ...campObj, ...computeCampaignObj(normalizeCountRows(parsed.byCampaign, "campaign")) };
    }
    renderCampaignCards(campObj);

    // Table campaign
    const byCampRows = parsed.byCampaign
      ? normalizeCountRows(parsed.byCampaign, "campaign").map(r => ({ campaign: r.campaign, n: r.n }))
      : CAMPAIGNS.map(c => ({ campaign: c.label, n: campObj[c.key] ?? 0 }));
    renderTable(tableCampaignBody, byCampRows, [
      { value: (r) => safeText(r.campaign).replace(/^\w/, m => m.toUpperCase()) },
      { className: "right", value: (r) => fmt(r.n) },
    ]);

    // Table source
    const bySrcRows = parsed.bySource ? normalizeCountRows(parsed.bySource, "source") : [];
    renderTable(tableSourceBody, bySrcRows, [
      { value: (r) => safeText(r.source) },
      { className: "right", value: (r) => fmt(r.n) },
    ]);

    // Hourly
    renderHourly(parsed.hourly || []);

    // Latest clicks
    renderLatest(parsed.latest || []);
  }

  function renderLinksModal() {
    linksList.innerHTML = "";
    TRACKED_LINKS.forEach((it) => {
      const row = document.createElement("div");
      row.className = "linkRow";
      row.innerHTML = `
        <div class="linkMeta">
          <div class="linkName">${it.name}</div>
          <div class="linkUrl">${it.url}</div>
        </div>
        <button class="btn" data-copy="${it.url}">Copier</button>
      `;
      linksList.appendChild(row);
    });

    linksList.querySelectorAll("button[data-copy]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const url = btn.getAttribute("data-copy");
        try {
          await navigator.clipboard.writeText(url);
          btn.textContent = "Copié ✅";
          setTimeout(() => (btn.textContent = "Copier"), 1000);
        } catch {
          // fallback
          prompt("Copie ce lien :", url);
        }
      });
    });
  }

  // PWA install button
  let deferredPrompt = null;
  const btnInstall = $("#btnInstall");
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    btnInstall.hidden = false;
  });
  btnInstall?.addEventListener("click", async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(()=>null);
    deferredPrompt = null;
    btnInstall.hidden = true;
  });

  // Service worker
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch(console.warn);
    });
  }

  // Auto refresh
  function scheduleAuto() {
    if (!toggleAuto.checked) return;
    setTimeout(() => {
      if (toggleAuto.checked) refresh();
      scheduleAuto();
    }, 45000);
  }

  // Hard refresh: bump cache-bust + unregister SW + clear caches
  async function hardRefresh() {
    const v = String(Date.now());
    localStorage.setItem(LS.cacheBust, v);
    localStorage.removeItem(LS.lastStats);
    localStorage.removeItem(LS.lastFetchedAt);

    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ("caches" in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) {
      console.warn("hardRefresh cleanup", e);
    }
    location.reload(true);
  }

  // Wire UI
  btnRefresh.addEventListener("click", refresh);
  btnCopyLinks.addEventListener("click", () => {
    renderLinksModal();
    linksModal.showModal();
  });
  btnCloseModal.addEventListener("click", () => linksModal.close());
  linksModal.addEventListener("click", (e) => {
    const rect = linksModal.getBoundingClientRect();
    const inDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
                      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!inDialog) linksModal.close();
  });

  btnHardRefresh.addEventListener("click", hardRefresh);

  // Persist toggle
  const savedAuto = localStorage.getItem(LS.auto);
  if (savedAuto !== null) toggleAuto.checked = savedAuto === "1";
  toggleAuto.addEventListener("change", () => {
    localStorage.setItem(LS.auto, toggleAuto.checked ? "1" : "0");
  });

  // Boot
  const last = loadLast();
  if (last) {
    render(last);
    const t = Number(localStorage.getItem(LS.lastFetchedAt) || 0);
    if (t) setStatus("warn", `Cache local • ${timeAgo(Date.now()-t)} ago`);
  }
  refresh();
  scheduleAuto();
})();
