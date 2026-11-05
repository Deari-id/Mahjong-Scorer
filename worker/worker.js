/**
 * Mahjong Scorer photo-reading proxy (Cloudflare Worker).
 * Holds the SumoPod API key as a secret so visitors of the public page don't need one,
 * and only forwards requests that look like this app's tile-reading calls.
 *
 * Secrets / vars (set in the Cloudflare dashboard or with wrangler):
 *   SUMOPOD_API_KEY   (secret, required)  your SumoPod key
 *   ALLOWED_ORIGINS   (var)  comma-separated origins allowed to call this Worker
 *   SUMOPOD_BASE_URL  (var)  default https://ai.sumopod.com/v1
 */
// Override with an ALLOWED_MODELS var (comma-separated) in wrangler.toml.
const DEFAULT_MODELS = 'gemini/gemini-3.8-flash,gpt-5-mini';
const MAX_BODY = 3 * 1024 * 1024; // photos are resized to 1600 px in the page, well under this
const PER_MINUTE = 6;             // best-effort per-IP limit (per Worker instance)
const hits = new Map();

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://deari-id.github.io').split(',').map(s => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const reply = (status, obj) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    const MODELS = new Set((env.ALLOWED_MODELS || DEFAULT_MODELS).split(',').map(s => s.trim()).filter(Boolean));
    // Accept the secret under a few spellings: names are case-sensitive and easy to mistype.
    const key = env.SUMOPOD_API_KEY || env.sumopod_api_key || env.SUMOPOD_KEY || env.API_KEY;

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    // Health check: open the Worker URL in a browser to see whether the key is set (never shows the key).
    const base = (env.SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1').replace(/\/+$/, '');
    // Open <worker>/models in a browser to list the model names your SumoPod account offers.
    if (request.method === 'GET' && new URL(request.url).pathname === '/models') {
      if (!key) return reply(500, { error: { message: 'No key configured.' } });
      const r = await fetch(base + '/models', { headers: { 'Authorization': 'Bearer ' + key } });
      let ids = null; try { ids = (await r.clone().json()).data.map(m => m.id).sort(); } catch { }
      return ids ? reply(200, { models: ids }) : new Response(await r.text(), { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    if (request.method === 'GET') return reply(200, { ok: true, keyConfigured: !!key, models: [...MODELS] });
    if (request.method !== 'POST') return reply(405, { error: { message: 'Use POST.' } });
    if (!allowed.includes(origin)) return reply(403, { error: { message: 'This origin is not allowed.' } });
    if (!key) return reply(500, { error: { message: 'The Worker has no SUMOPOD_API_KEY secret.' } });

    const ip = request.headers.get('CF-Connecting-IP') || 'unknown', now = Date.now();
    const recent = (hits.get(ip) || []).filter(t => now - t < 60000);
    if (recent.length >= PER_MINUTE) return reply(429, { error: { message: 'Too many photos in a minute. Wait and try again.' } });
    recent.push(now); hits.set(ip, recent);

    const raw = await request.text();
    if (raw.length > MAX_BODY) return reply(413, { error: { message: 'Photo too large.' } });
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, { error: { message: 'Bad JSON.' } }); }
    if (!MODELS.has(body.model)) return reply(400, { error: { message: 'Model not allowed.' } });
    const msgs = body.messages;
    if (!Array.isArray(msgs) || msgs.length !== 1 || !Array.isArray(msgs[0].content)) return reply(400, { error: { message: 'Unexpected request.' } });

    const upstream = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify({ model: body.model, messages: msgs,
        ...(['minimal', 'low', 'medium'].includes(body.reasoning_effort) ? { reasoning_effort: body.reasoning_effort } : {}) }),
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
