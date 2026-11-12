# meta-MIUT

A hackathon prototype of an Events tab inside a phone-sized Facebook mock that shows a college student the free events near them today. Muse (the Meta Model API) turns a club's Instagram flyer into a drafted event, picks a personal top 3, and answers "what can I do tonight?" style questions. The product name is not decided; it lives in one constant, `PRODUCT_NAME` in `lib/brand.ts`.

## Run it

Needs Node 20.9 or newer and pnpm 10.

```sh
pnpm install
cp .env.example .env.local   # optional; without a key every Muse job uses a recorded fixture
pnpm dev                     # http://localhost:3000
```

Checks: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`.

## Environment variables

Server side only, never committed. See `.env.example`.

- `MUSE_API_KEY` (the only required one)
- `MUSE_BASE_URL` (default `https://api.meta.ai/v1`)
- `MUSE_MODEL` (default `muse-spark-1.3`)
- `MUSE_REASONING_EFFORT` (default `low`)

The request format follows the dev.meta.ai docs. To check it against the live API with a real flyer, put a key in `.env.local` and run `pnpm spike:muse path/to/flyer.jpg "optional caption"`. It tries all three models and prints status, latency, token usage, and whether the draft passed validation. Add `--models` or `--effort low` to narrow or compare.

The UI labels every Muse answer as "Answered by Muse" or "Recorded fixture", so the demo is honest about which one ran.

## Lanes

Five people build in parallel, each in their own folders (details in `AGENTS.md`):

1. Muse pipeline: extract, rank, ask, fixtures.
2. Events tab: feed, filters, top 3, event page, RSVP, ask screen.
3. Map.
4. Organizer flow and notification.
5. Design, seed data, and the pitch.

The shared contract is the event schema in `lib/events/schema.ts`.

## Team board

The team coordinates through a separate private hub repo cloned beside this one. Ask a teammate for access.

Seed data in `data/seed/` is placeholder until real campus flyers are gathered.
