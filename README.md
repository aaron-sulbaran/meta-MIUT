# meta-MIUT

A hackathon prototype of an Events tab inside a phone-sized Facebook mock that shows a college student the free events near them today. Muse (the Meta Model API) turns a club's Instagram flyer into a drafted event, picks a personal top 3, and answers "what can I do tonight?" style questions. The product name is not decided; it lives in one constant, `PRODUCT_NAME` in `lib/brand.ts`.

## Run it

Needs Node 22.18 or newer (the repo pins 24 in `.nvmrc`) and pnpm 10. On an older Node, `pnpm install` stops with an "Unsupported engine" message; Tailwind v4 cannot load on Node 20.11, and every page would 500.

```sh
nvm install && nvm use       # reads .nvmrc; any other way to get Node 24 works too
corepack enable              # gives you the pnpm version pinned in package.json
pnpm install
cp .env.example .env.local   # optional; without a key every Muse job uses a recorded fixture
pnpm dev                     # http://localhost:3000
```

Checks: `pnpm typecheck`, `pnpm test`, `pnpm lint`, `pnpm build`. CI runs all four on every push to main and every pull request (`.github/workflows/ci.yml`).

Useful screens while building:

- `/` the Events tab, `/events/<id>` an event, `/organizer` the organizer flow, `/map`, `/ask`.
- `/demo` the operator console: publish a sample event, fire a notification, reset the data. Notifications reach every open screen within about 3 seconds.

## Contributing (teammates and their agents)

1. Claim your item on the team hub, then announce the files you will touch and your branch there, before editing. Check that nobody else has those files in flight; if someone does, ask them first. One writer per file at a time.
2. Work locally on a short branch named `<id>/<lane>-<slug>`, in your lane's folders (`AGENTS.md` lists who owns what). Build against the fixtures and the seed; nothing waits on a live key.
3. Before every push: rebase on main, then `pnpm typecheck && pnpm test && pnpm lint && pnpm build`. Merge small and often.
4. Post on the hub when you push or merge (commit and files), so everyone else rebases.

## Environment variables

Server side only, never committed. See `.env.example`.

- `MUSE_API_KEY` (the only required one)
- `MUSE_BASE_URL` (default `https://api.meta.ai/v1`)
- `MUSE_MODEL` (default `muse-ember-1.0`)
- `MUSE_REASONING_EFFORT` (default `low`)
- `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Redis from the Vercel Marketplace, the shared store; without them the store is in memory per server process)
- `DEMO_RESET_TOKEN` (guards the reset on the deployed `/demo` console)

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
