# Mahjong Scorer

Scores Chinese Official (MCR) mahjong hands: all 81 scoring hands, implied-hand exclusions, the 8-point minimum, flowers and payments.

- **Score a hand**: build the 14 tiles (exposed sets, hidden tiles, winning tile) and get the full breakdown.
- **Score from a photo**: take a picture of the tiles and an AI vision model fills in the hand for you to check.
- **Quick tally**: tick the scoring hands yourself and get the total and payments.

## Photo reading (SumoPod)

Open **AI settings** in the photo panel and paste your SumoPod API key. The page calls the OpenAI-compatible endpoint
`https://ai.sumopod.com/v1/chat/completions` with model `glm-5.3-flash`, and retries with `gpt-5-nano` if that fails.
The base URL and both models can be changed there.

The key is stored only in your browser (localStorage). Never commit an API key to this repository.

## Development

- `src/engine.js`: the scoring engine (no dependencies).
- `src/page.html`: the page.
- `python3 build.py`: inlines the engine into `index.html`, which is what GitHub Pages serves.
