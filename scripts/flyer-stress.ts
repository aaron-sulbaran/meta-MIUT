// Runs generated flyers (cases.json + PNGs) through the real extract and match jobs and checks each field.
//   node --conditions=react-server --import ./scripts/register-ts-paths.mjs scripts/flyer-stress.ts [dir]
// dir defaults to scripts/flyer-stress (made-up test flyers). Needs MUSE_API_KEY and the app running on :3000 (APP_URL) for the listed events.
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractEventDrafts } from "@/lib/muse/extract";
import { matchExistingEvent } from "@/lib/muse/match";
import type { CampusEvent } from "@/lib/events/schema";

type Expect = {
  count?: number; count_min?: number; free?: boolean; food?: boolean; start?: string; end?: string; starts?: string[];
  place?: string; access?: string; capacity?: number; past_ok?: boolean; match?: string | null;
};
type Case = { id: string; caption: string | null; expect: Expect; kind: string; note: string };

const dir = process.argv[2] ?? "scripts/flyer-stress";
const cases = JSON.parse(readFileSync(path.join(dir, "cases.json"), "utf8")) as Case[];
const now = new Date();
// Listed events come from the running app (seed JSON needs import attributes under plain Node).
const listed = (await (await fetch(process.env.APP_URL ?? "http://localhost:3000/api/events")).json()) as { data: { events: CampusEvent[] } | CampusEvent[] };
// The seed HSA night is pinned to server start; list it tonight at 7 PM so a "pushed back to 9" repost is clearly the same night.
const events = (Array.isArray(listed.data) ? listed.data : listed.data.events).map((e) =>
  e.id === "evt-hsa-movie-night" ? { ...e, start: "2026-11-13T19:00:00-05:00", end: "2026-11-13T21:00:00-05:00" } : e,
);
const local = (iso: string) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso)).replace(" ", "T");

async function run(c: Case) {
  const image = readFileSync(path.join(dir, `${c.id}.png`)).toString("base64");
  const caption = c.caption ?? "No caption was posted. Read everything from the flyer image.";
  const t0 = Date.now();
  const result = await extractEventDrafts({ caption, imageBase64: image, imageMediaType: "image/png" }, now);
  const ms = Date.now() - t0;
  const drafts = result.data?.events ?? [];
  const fails: string[] = [];
  const e = c.expect;
  if (result.source !== "muse") fails.push(`fell back to fixture: ${result.fallbackReason}`);
  if (e.count !== undefined && drafts.length !== e.count) fails.push(`count ${drafts.length} != ${e.count}`);
  if (e.count_min !== undefined && drafts.length < e.count_min) fails.push(`count ${drafts.length} < ${e.count_min}`);
  const d = drafts[0];
  if (d) {
    if (e.free !== undefined && d.free !== e.free) fails.push(`free ${d.free}`);
    if (e.food !== undefined && d.food !== e.food) fails.push(`food ${d.food}`);
    if (e.start && local(d.start) !== e.start) fails.push(`start ${local(d.start)} != ${e.start}`);
    if (e.end && local(d.end) !== e.end) fails.push(`end ${local(d.end)} != ${e.end}`);
    if (e.place && !d.placeName.toLowerCase().includes(e.place.toLowerCase())) fails.push(`place "${d.placeName}"`);
    if (e.access && d.access.kind !== e.access) fails.push(`access ${d.access.kind}`);
    if (e.capacity && (d.access.kind !== "rsvp" || d.access.capacity !== e.capacity)) fails.push(`capacity ${JSON.stringify(d.access)}`);
    if (Date.parse(d.end) < Date.parse(d.start)) fails.push("end before start");
  }
  if (e.starts) {
    const got = drafts.map((x) => local(x.start)).sort();
    if (JSON.stringify(got) !== JSON.stringify([...e.starts].sort())) fails.push(`starts ${got.join(", ")}`);
  }
  let match: string | null | undefined;
  if (e.match !== undefined && d) {
    const m = await matchExistingEvent({ draft: d, organizerHandle: "mit_hsa" }, events);
    match = m.data?.eventId ?? null;
    if (match !== e.match) fails.push(`match ${match} != ${e.match}`);
    if (e.match && m.data && !("start" in m.data.updates)) fails.push(`match updates ${Object.keys(m.data.updates).join(",")} miss start`);
  }
  return {
    id: c.id, kind: c.kind, ok: fails.length === 0, fails, ms, match,
    drafts: drafts.map((x) => ({ title: x.title, start: local(x.start), end: local(x.end), place: x.placeName, free: x.free, food: x.food, access: x.access, confidence: x.confidence })),
  };
}

const results = [];
for (let i = 0; i < cases.length; i += 4) results.push(...(await Promise.all(cases.slice(i, i + 4).map(run))));
const out = path.join(tmpdir(), "flyer-stress-results.json");
writeFileSync(out, JSON.stringify(results, null, 1));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id.padEnd(24)} ${String(r.ms).padStart(6)}ms  ${r.drafts.map((x) => `${x.title} @ ${x.start}-${x.end.slice(11)} | ${x.place} | free ${x.free} food ${x.food}`).join(" ; ") || "(no events)"}${r.fails.length ? "\n      " + r.fails.join("; ") : ""}`);
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed, details in ${out}`);
