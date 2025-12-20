export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ===== HEADERS CORS =====
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ===== HEALTH CHECK =====
    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    // ===== STATS API =====
    if (url.pathname === "/api/stats") {
      const pass = url.searchParams.get("pass");
      if (pass !== "0000") {
        return new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "content-type": "application/json" },
        });
      }

      const total = await env.DB
        .prepare("SELECT COUNT(*) as c FROM clicks")
        .first();

      const today = await env.DB
        .prepare(
          "SELECT COUNT(*) as c FROM clicks WHERE date(created_at)=date('now')"
        )
        .first();

      const campaigns = {};
      const rows = await env.DB
        .prepare(
          "SELECT campaign, COUNT(*) as c FROM clicks GROUP BY campaign"
        )
        .all();

      for (const r of rows.results) {
        campaigns[r.campaign] = r.c;
      }

      return new Response(
        JSON.stringify({
          ok: true,
          total: total.c,
          today: today.c,
          campaigns,
        }),
        { headers: { ...corsHeaders, "content-type": "application/json" } }
      );
    }

    // ===== TRACKING & REDIRECT =====
    if (url.pathname.startsWith("/go/")) {
      const campaign = url.pathname.split("/")[2];

      if (!campaign) {
        return new Response("Campaign missing", { status: 400 });
      }

      await env.DB.prepare(
        "INSERT INTO clicks (campaign) VALUES (?)"
      ).bind(campaign).run();

      const target = `https://${campaign}.aperos.net`;
      return Response.redirect(target, 302);
    }

    return new Response("OK", { headers: corsHeaders });
  },
};
