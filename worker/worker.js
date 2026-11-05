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
const MODELS = new Set(['glm-5.3-flash', 'gpt-5-nano']);
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

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { error: { message: 'Use POST.' } });
    if (!allowed.includes(origin)) return reply(403, { error: { message: 'This origin is not allowed.' } });
    if (!env.SUMOPOD_API_KEY) return reply(500, { error: { message: 'The Worker has no SUMOPOD_API_KEY secret.' } });

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

    const base = (env.SUMOPOD_BASE_URL || 'https://ai.sumopod.com/v1').replace(/\/+$/, '');
    const upstream = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.SUMOPOD_API_KEY },
      body: JSON.stringify({ model: body.model, messages: msgs }),
    });
    return new Response(await upstream.text(), { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  },
};
