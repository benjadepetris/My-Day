const API_BASE = "https://mcp.strikerapi.com/v1/";
const ALLOWED_TOOLS = new Set([
  "list_teams", "list_games", "get_schedule", "get_standings",
  "get_ratings", "get_head_to_head", "get_squad", "get_game",
  "get_lineups", "get_availability", "get_player", "get_player_games",
  "get_leaders", "get_team_stats"
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "myday-football-api", configured: Boolean(env.STRIKER_API_KEY) });
    }

    if (request.method !== "POST" || !url.pathname.startsWith("/api/")) {
      return json({ error: "Not found" }, 404);
    }

    if (!env.STRIKER_API_KEY) {
      return json({ error: "Football API is not configured yet" }, 503);
    }

    const tool = url.pathname.slice("/api/".length);
    if (!ALLOWED_TOOLS.has(tool)) {
      return json({ error: "Endpoint not allowed" }, 404);
    }

    let payload = {};
    try {
      const raw = await request.text();
      if (raw.length > 12000) return json({ error: "Request too large" }, 413);
      payload = raw ? JSON.parse(raw) : {};
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
        return json({ error: "Invalid JSON body" }, 400);
      }
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    // This service is intentionally restricted to Argentine football data.
    if (tool !== "list_teams" && tool !== "search_players") {
      payload.league = "argentina";
    }

    try {
      const upstream = await fetch(API_BASE + tool, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": env.STRIKER_API_KEY
        },
        body: JSON.stringify(payload)
      });

      const body = await upstream.text();
      let parsed;
      try { parsed = JSON.parse(body); }
      catch { parsed = { error: "Invalid response from data provider" }; }

      return json(parsed, upstream.status);
    } catch {
      return json({ error: "Could not reach the football data provider" }, 502);
    }
  }
};
