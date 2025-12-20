// Cloudflare Worker (Pages/Workers) + D1
// - Logs clicks on /go/<campaign>
// - Exposes stats on /api/stats
// - Adds CORS so your GitHub Pages dashboard can call the API

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...corsHeaders, ...extraHeaders },
  });
}

function pickSource(url, request) {
  const src = (url.searchParams.get("src") || "").trim().toLowerCase();
  if (src) return src.slice(0, 32);

  const ref = (request.headers.get("referer") || "").toLowerCase();
  if (ref.includes("facebook.com") || ref.includes("fb.com") || ref.includes("m.facebook.com")) return "facebook";
  if (ref.includes("instagram.com")) return "instagram";
  if (ref.includes("t.co") || ref.includes("twitter.com") || ref.includes("x.com")) return "x";
  if (ref.includes("snapchat.com")) return "snapchat";
  return "unknown";
}

function defaultTargetFor(campaign) {
  // Ajuste ici si tu veux un défaut spécifique par campagne.
  // Sinon, passe toujours ?to=... dans tes liens.
  const map = {
    apero: "https://aperos.net",
    catalan: "https://catalan.aperos.net",
    chance: "https://chance.aperos.net",
    jeux: "https://game.aperos.net",
    game: "https://game.aperos.net",
    gps: "https://gps.aperos.net",
    stat: "https://stat.aperos.net",
    stats: "https://stats.aperos.net",
  };
  return map[campaign] || `https://${campaign}.aperos.net`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Health check
    if (url.pathname === "/api/health") {
      return json({ ok: true });
    }

    // Stats API
    if (url.pathname === "/api/stats") {
      try {
        // totals
        const totalRow = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM clicks"
        ).first();
        const todayRow = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM clicks WHERE date(created_at) = date('now')"
        ).first();

        // by campaign
        const campaignsRes = await env.DB.prepare(
          "SELECT campaign, COUNT(*) AS n FROM clicks GROUP BY campaign ORDER BY n DESC"
        ).all();

        // by source (sms/facebook/qr/...)
        const sourcesRes = await env.DB.prepare(
          "SELECT COALESCE(source,'unknown') AS source, COUNT(*) AS n FROM clicks GROUP BY source ORDER BY n DESC"
        ).all();

        // last clicks
        const lastRes = await env.DB.prepare(
          "SELECT campaign, COALESCE(source,'unknown') AS source, created_at, COALESCE(country,'') AS country FROM clicks ORDER BY id DESC LIMIT 50"
        ).all();

        // today by hour
        const byHourRes = await env.DB.prepare(
          "SELECT strftime('%H', created_at) AS hour, COUNT(*) AS n FROM clicks WHERE date(created_at) = date('now') GROUP BY hour ORDER BY hour ASC"
        ).all();

        return json({
          ok: true,
          total: totalRow?.n ?? 0,
          today: todayRow?.n ?? 0,
          campaigns: Object.fromEntries((campaignsRes.results || []).map(r => [r.campaign, r.n])),
          sources: Object.fromEntries((sourcesRes.results || []).map(r => [r.source, r.n])),
          byHourToday: (byHourRes.results || []).reduce((acc, r) => {
            acc[r.hour] = r.n;
            return acc;
          }, {}),
          last: lastRes.results || [],
        });
      } catch (e) {
        return json({ ok: false, error: String(e) }, 500);
      }
    }

    // Redirect tracking
    if (url.pathname.startsWith("/go/")) {
      const campaign = (url.pathname.split("/")[2] || "").trim().toLowerCase();
      const target = url.searchParams.get("to") || defaultTargetFor(campaign);

      // log click (best-effort)
      try {
        const source = pickSource(url, request);
        const referrer = (request.headers.get("referer") || "").slice(0, 500);
        const ua = (request.headers.get("user-agent") || "").slice(0, 200);
        const country = request.cf?.country || null;

        await env.DB.prepare(
          "INSERT INTO clicks (campaign, source, created_at, referrer, ua, country) VALUES (?, ?, datetime('now'), ?, ?, ?)"
        ).bind(campaign || "unknown", source, referrer, ua, country).run();
      } catch (e) {
        // ignore logging failures; still redirect
      }

      return Response.redirect(target, 302);
    }

    return new Response("OK", { headers: corsHeaders });
  },
};
