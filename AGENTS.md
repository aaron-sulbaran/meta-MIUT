# meta-MIUT: read this first

```text
Team hub rule (meta-hack26). Our agents coordinate only through the hub repo at ../hub (github.com/aaron-sulbaran/meta-hack26-hub). Its AGENTS.md is the contract. In every session, in any repo:
1. Start with `../hub/hub sync`, then `../hub/hub status`. Sync about every 15 minutes.
2. Claim or add the item before building. In the project clone, announce it: `../hub/hub pulse "<what and why>"`. Read `../hub/hub who` to avoid surprises, then go ahead.
3. Push your branch early. Merge your own PR when checks are green; then pulse (docs/working-together.md).
4. Commit only as your person, never as a bot or teammate; run `../hub/hub doctor` in each clone.
5. Big call: record it with `hub propose` and keep building; nothing waits for sign-off.
6. Clone the project repo (kb/project-repo.md) beside the hub, then `node ../hub/scripts/install-hooks.mjs <that clone>`.
7. Finish with `hub done`, then `hub end`.
```

`../hub` means the hub cloned beside this repo. Cloud agents whose machine is rebuilt each session clone the hub first, per the hub's `docs/standing-instruction.md`.

# Layer 1: rules (set by the team; agents do not edit)

- **Stage: sketch.** Three-day hackathon prototype. Speed over polish, but main always runs.
- **Public repo.** No secrets, keys, tokens, emails, or phone numbers in code, docs, commits, or fixtures. Name an env var, never its value. Nothing private from the hub gets copied here.
- **Autonomy.** Build, push, and merge without waiting for anyone; record a big call with `hub propose` and keep building; if two changes collide, fix it on main once both are in.
- **Never force-push.**
- **Pulse your files.** Announce the files you will touch on the hub before editing, and say when your change is pushed or merged, so others see it. Shared files (`lib/events/schema.ts`, `lib/events/store.ts`, `app/layout.tsx`, `package.json`) always get an announcement, even for one line.
- **Main stays green.** Run `pnpm typecheck && pnpm test && pnpm lint && pnpm build` before every push. CI runs the same on every push to main and every pull request.
- **Working together** (full version with a worked day: the hub's `docs/working-together.md`). Branches are short-lived, named `<id>/<lane>-<slug>` (for example `lisa/map-pins`); the lane word is how the hub knows your lane.
  1. Pulse when you start, switch branch, open a PR, merge, and at least every 15 minutes. Hooks do most of it (`node ../hub/scripts/install-hooks.mjs .` once per clone); say what you start with `../hub/hub pulse "<what and why>"`.
  2. Before touching a file outside your lane or a shared file, read `../hub/hub who` to avoid surprises, then go ahead.
  3. Push your branch early. A local-only branch is invisible to everyone.
  4. Rebase on main when `pulse` or `sync` says main changed your files, before you open or update a PR, and before you merge. Otherwise keep working.
  5. Open a PR when checks are green. Small; its description names the hub item.
  6. Merge your own PR as soon as checks are green, whatever files it touches; then pulse so others pull. Use "Rebase and merge" or "Squash and merge". `../hub/hub done` if the item is finished.
  7. Commits carry their author's own identity, never another teammate's or a bot's. `../hub/hub doctor` checks it; the pre-push hook enforces it.
- **The event contract.** Changing the event contract in `lib/events/schema.ts`? Record it with `hub propose` and pulse, so every lane sees it.
- **No product name in code or paths.** Use `PRODUCT_NAME` from `lib/brand.ts`.
- **No status or plans in this file.** They live on the hub board.
- Plain language. No em dashes or emoji in code, docs, or UI strings.

# Layer 2: how it works (agents keep this accurate)

## Run

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm typecheck    # next typegen && tsc --noEmit
pnpm test         # vitest, files named *.test.ts beside the code
pnpm lint
pnpm build
```

Node 22.18 or newer (`.nvmrc` pins 24; `.npmrc` sets `engine-strict`, so `pnpm install` refuses an older Node instead of every page 500ing under Tailwind v4).

Env vars (server side, `.env.local`, never committed): `MUSE_API_KEY` (required), `MUSE_BASE_URL`, `MUSE_MODEL`, `MUSE_REASONING_EFFORT` (defaults in `.env.example`). Without a key every Muse job answers from its fixture. Shared store: `KV_REST_API_URL` and `KV_REST_API_TOKEN` (Redis from the Vercel Marketplace); without them the store is in memory per process. `DEMO_RESET_TOKEN` guards the reset on the deployed `/demo` console.

```sh
pnpm spike:muse <flyer.jpg> ["caption"] [--models muse-spark-1.3,muse-wonder-1.0] [--effort low]
```

Runs one real image through the live API with the app's extract request, one line per model (status, latency, tokens, JSON clean or repaired, schema pass). Needs a key in `.env.local`.

## Map

```
app/(events)/        Events tab: / (chips, Muse top 3, list) and /events/[id]
app/home/            Home feed shell, events lead the feed
app/reference/       /reference/events: Facebook Events today, the fidelity benchmark (sample data)
app/map/             map screen
app/organizer/       organizer flow (Instagram post to draft to confirm)
app/ask/             ask Muse screen
app/api/muse/        route handlers: extract, rank, ask (POST, JSON)
app/api/events/      GET all events, POST publish a confirmed draft (stores it, sends the alert)
app/api/alerts/      GET ?since=<cursor> new alerts, POST send an alert for an event
app/api/events/[id]/attendance/  GET ?viewer=<id> counts and seats left, POST {viewerId, action} interested or RSVP
app/api/demo/reset/  POST reseed events and clear alerts (token in production)
app/demo/            operator console: publish a sample event, fire an alert, reset
components/alerts/   AlertListener (mount once in the root layout), banner, demo console
components/ui/       Facebook shell: tab-bar (TabBar, ProfileAvatar), header (HomeHeader, SectionHeader,
                     SubPageHeader, HeaderAction), chips, button, section-heading, event-card
                     (FbEventCard), event-actions, poster, card, icons
components/<lane>/   lane components
lib/brand.ts         PRODUCT_NAME, campus name and time zone
lib/events/          schema.ts (the contract), seed.ts, store.ts, publish.ts, time.ts
lib/alerts/          schema.ts (client safe), feed.ts, compose.ts (alert text from the event), policy.ts (who gets alerted)
lib/attendance/      Interested and RSVP: schema.ts and client.ts (client safe), viewer.ts (random id per browser), store.ts
lib/store/redis.ts   minimal Upstash Redis REST client (fetch, no SDK)
lib/muse/            client.ts, job.ts, extract.ts, rank.ts, ask.ts, fixtures/
lib/geo.ts           distance and walking minutes
data/seed/           placeholder events and student profile
```

## Lanes and the folders each owns

Stay in your folders. Touching another lane's folder means a hub note to its owner first.

| Lane | Owns |
|---|---|
| Muse | `lib/muse/`, `app/api/muse/` |
| Events tab | `app/(events)/`, `components/events/`, `app/ask/`, `components/ask/`, `lib/events/time.ts` |
| Map | `app/map/`, `components/map/`, `lib/geo.ts` |
| Organizer and notification | `app/organizer/`, `components/organizer/` |
| Design, seed, pitch | `data/seed/`, `app/globals.css`, `components/ui/`, `app/layout.tsx` |
| Integration | `lib/store/`, `lib/alerts/` (except `policy.ts` and `compose.ts`, who gets alerted and what it says, owned by the alert item), `lib/events/publish.ts`, `lib/attendance/`, `app/api/events/`, `app/api/alerts/`, `app/api/demo/`, `app/demo/`, `components/alerts/` |

Shared, change with care and a hub note: `lib/events/schema.ts` (record with `hub propose`), `lib/events/store.ts`, `lib/brand.ts`, `package.json`.

## Muse layer

- `callMuse` in `lib/muse/client.ts` is the only network call. The wire format lives in `museAdapter` there: OpenAI-style `POST {base}/chat/completions`, `developer` role, image as an `image_url` data URL part, explicit `reasoning_effort`, `response_format` json_schema. Confirmed against the dev.meta.ai docs and a live call (2026-11-12, `pnpm spike:muse`). Default model is `muse-ember-1.0` (about 3 s on the flyer extract; Spark and Wonder took 30 to 64 s, past the 20 s timeout). Nothing else knows the format.
- The API rejects `stop`, `n` above 1, `frequency_penalty`, `presence_penalty`, `logit_bias`, `verbosity`, `modalities`, and `max_output_tokens` (use `max_completion_tokens`). Leave `temperature` unset.
- Each job sends its zod output schema via `z.toJSONSchema` with `strict: false`; strict would need every key required and no open records, which extract breaks. `extractJsonObject` still parses leniently on the way back.
- `callMuse` results carry `meta` (model, HTTP status, latency ms, token usage). Timeout is `MUSE_TIMEOUT_MS` (20 s) on the app path.
- Each job (`extract`, `rank`, `ask`) has zod-validated output and a fixture in `lib/muse/fixtures/`. `runMuseJob` returns `{ data, error, source: "muse" | "fixture", fallbackReason }`. Missing key, failed call, or bad output all fall back to the fixture.
- `rank` computes walking minutes itself; the model only picks ids and reasons. Ids the model invents are rejected.
- Client components import response types from `lib/muse/types.ts`, never from the job files (they are `server-only`).

## Gotchas

- Next.js 16. Read `node_modules/next/dist/docs/` before using an API you are unsure of. `params` is a Promise. `next build` does not lint.
- Pages that show times call `await connection()` so they render per request, not at build.
- Seed times are relative (`startsInMinutes`). The memory store resolves them at first load; the Redis store seeds on first read, re-seeds when its 12 hour seed marker expires, and on a `/demo` reset. Redis keys are namespaced by `VERCEL_ENV`, so preview deploys never touch production data.
- Without Redis the store and alert feed live per server process (kept on `globalThis`, because Next dev compiles route handlers and pages as separate module graphs). On Vercel that means a published event can miss another screen: set the Redis env vars there.
- Redis reads that fail fall back to the in-memory seed and log to the server console; writes return the error.
- Alerts reach screens by polling `GET /api/alerts` every 2.5 s. The first poll only learns the cursor, so a freshly opened screen does not replay old alerts. A new alert also calls `router.refresh()`, so the feed already has the event when the student taps through.
- Times display in the campus time zone (`CAMPUS_TIME_ZONE`), not the viewer's.
- Tailwind v4: tokens are in `@theme` in `app/globals.css`. Pages are white (`bg-page`); `bg-wash` is the desktop backdrop and input fill. Text `text-ink`, `text-muted`, `text-link` (blue text), icons and brand `text-primary`, tint `bg-primary-soft`, card outline `border-hairline`, grey buttons `bg-button`. Type: `font-display` (Geologica, every bold label and heading; bold renders at 790) and the default system face for running text; sizes `text-title` 16, `text-label` 14, `text-body` 14, `text-venue` 12.5, `text-meta` 11.5, `text-root-title` 26. Measured from Facebook iOS screenshots at 390 px.
- Each screen draws its own header from `components/ui/header.tsx`; the root layout holds only the 390 px frame, the floating `TabBar`, and `AlertListener`. Main has bottom padding for the tab bar. Tab bar Home goes to `/home`; the other five tabs are drawn but inert (not links, not focusable).
- Event images are `Poster` compositions seeded by event id. An event with `source.imagePath` (a local file under `public/flyers/`) shows its flyer in the same 2:1 frame instead. No hotlinks.
- `server-only` is stubbed in tests by `vitest.config.ts`, and in scripts by `node --conditions=react-server`; `scripts/register-ts-paths.mjs` resolves `@/` for plain Node.
- ESLint reads any function named `use...` as a React hook.
