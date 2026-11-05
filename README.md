# Mahjong Scorer

Scores Chinese Official (MCR) mahjong hands: all 81 scoring hands, implied-hand exclusions, the 8-point minimum, flowers and payments.

- **Score a hand**: build the 14 tiles (exposed sets, hidden tiles, winning tile) and get the full breakdown.
- **Score from a photo**: take a picture of the tiles and an AI vision model fills in the hand for you to check.
- **Quick tally**: tick the scoring hands yourself and get the total and payments.

Live at **https://deari-id.github.io/Mahjong-Scorer/** (the path is case-sensitive).

## Photo reading (SumoPod)

Visitors don't need an API key. The page sends the photo to a small Cloudflare Worker (`worker/`), which adds the
SumoPod key on the server and forwards the request to `https://ai.sumopod.com/v1/chat/completions`. The page asks
`gemini/gemini-3.8-flash` first and falls back to `gpt-5-mini` (set in `MODEL_CHAIN` in `src/page.html` and `ALLOWED_MODELS` in `worker/wrangler.toml`). Open `<worker URL>/models` to list the model names your SumoPod account offers.

The key is never in this repository or in the page. Anything in a public page can be read by anyone, so the key must
only live in the Worker's secrets.

The Worker only accepts calls from `https://deari-id.github.io`, only the allowed models, photos up to 3 MB and
about 6 photos a minute per visitor. Set a spending limit in your SumoPod account as well.

### Deploy the Worker (once)

1. Create a free account at https://dash.cloudflare.com and go to **Workers & Pages → Create → Create Worker**.
   Name it `mahjong-scorer-ai`, deploy, then **Edit code**, paste in `worker/worker.js` and deploy again.
2. In the Worker's **Settings → Variables and Secrets**, add:
   - `SUMOPOD_API_KEY`: your SumoPod key, type **Secret**
   - `ALLOWED_ORIGINS`: `https://deari-id.github.io`
3. Copy the Worker's URL (like `https://mahjong-scorer-ai.<you>.workers.dev`) into `SHARED_API_URL` (now set to `https://mahjong-scorer-ai.lois-laura.workers.dev`) near the
   photo-scanning code in `src/page.html`, run `python3 build.py`, then commit and push.

Using the command line instead: `cd worker && npx wrangler deploy && npx wrangler secret put SUMOPOD_API_KEY`.

Anyone who prefers their own SumoPod account can still enter a key under **AI settings (optional)**. It stays in that
browser only.

## Development

- `src/engine.js`: the scoring engine (no dependencies).
- `src/page.html`: the page.
- `python3 build.py`: inlines the engine into `index.html`, which is what GitHub Pages serves.
