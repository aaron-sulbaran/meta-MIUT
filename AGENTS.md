# meta-MIUT: read this first

```text
Team hub rule (meta-hack26). Our agents coordinate only through the hub repo at ../hub (github.com/aaron-sulbaran/meta-hack26-hub). Its AGENTS.md is the contract. In every session, in any repo:
1. Start with `../hub/hub sync`, then `../hub/hub status`. Sync again about every 15 minutes.
2. Claim or add the item before building. Post a `hub note` at each real step. Ask, do not guess.
3. Major decision: `hub propose`, tell your person, keep working elsewhere. Silence is never a yes. Never accept, reject, or pass anything.
4. When kb/project-repo.md has a URL, clone it beside the hub. Claude Code only: `node ../hub/scripts/install-hooks.mjs <that clone>`.
5. Finish with `hub done`, then `hub end`.
```

`../hub` means the hub cloned beside this repo. Cloud agents whose machine is rebuilt each session clone the hub first, per the hub's `docs/standing-instruction.md`.

# Layer 1: rules (set by the team; agents do not edit)

- **Stage: sketch.** Three-day hackathon prototype. Speed over polish, but main always runs.
- **Public repo.** No secrets, keys, tokens, emails, or phone numbers in code, docs, commits, or fixtures. Name an env var, never its value. Nothing private from the hub gets copied here.
- **Autonomy.** The hub's `AGENTS.md` decides what you do alone and what needs a person. Major decisions (design direction, architecture, new services or heavy dependencies, scope) go through `hub propose`.
- **Never force-push.**
- **Main stays green.** Run `pnpm typecheck && pnpm test && pnpm build` before every push.
- **Branches** are short-lived and named `<id>/<lane>-<slug>` (for example `lisa/map-pins`). Small PRs, or direct small commits to main. Rebase on main before pushing.
- **The event contract** in `lib/events/schema.ts` changes only after a hub proposal is accepted.
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

Env vars (server side, `.env.local`, never committed): `MUSE_API_KEY`, `MUSE_BASE_URL`, `MUSE_MODEL`. Without them every Muse job answers from its fixture.

## Map

```
app/(events)/        Events tab: / and /events/[id]
app/map/             map screen
app/organizer/       organizer flow (Instagram post to draft to confirm)
app/ask/             ask Muse screen
app/api/muse/        route handlers: extract, rank, ask (POST, JSON)
components/ui/       shared frame: top bar, tab bar, icons, Card
components/<lane>/   lane components
lib/brand.ts         PRODUCT_NAME, campus name and time zone
lib/events/          schema.ts (the contract), seed.ts, store.ts, time.ts
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

Shared, change with care and a hub note: `lib/events/schema.ts` (proposal required), `lib/events/store.ts`, `lib/brand.ts`, `package.json`.

## Muse layer

- `callMuse` in `lib/muse/client.ts` is the only network call. The wire format lives in `museAdapter` there and is an **unconfirmed guess** until checked against dev.meta.ai docs. Fix it there; nothing else knows the format.
- Each job (`extract`, `rank`, `ask`) has zod-validated output and a fixture in `lib/muse/fixtures/`. `runMuseJob` returns `{ data, error, source: "muse" | "fixture", fallbackReason }`. Missing key, failed call, or bad output all fall back to the fixture.
- `rank` computes walking minutes itself; the model only picks ids and reasons. Ids the model invents are rejected.
- Client components import response types from `lib/muse/types.ts`, never from the job files (they are `server-only`).

## Gotchas

- Next.js 16. Read `node_modules/next/dist/docs/` before using an API you are unsure of. `params` is a Promise. `next build` does not lint.
- Pages that show times call `await connection()` so they render per request, not at build.
- Seed times are relative (`startsInMinutes`) and resolved when the in-memory store first loads. The store lives per server process: it resets on restart and is not shared across serverless instances. Swap `createMemoryStore` for a database behind the same `EventStore` interface.
- Times display in the campus time zone (`CAMPUS_TIME_ZONE`), not the viewer's.
- Tailwind v4: tokens are in `@theme` in `app/globals.css` (`bg-wash`, `bg-card`, `text-primary`, `text-muted`, `border-divider`).
- `server-only` is stubbed in tests by `vitest.config.ts`.
- ESLint reads any function named `use...` as a React hook.
