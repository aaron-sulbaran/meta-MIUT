// measure-people: time moment 6 as Trish: Muse picking who she could go with (read only,
// repeated) and Muse writing the hello (records a hi, so once per person suggested).
// usage: node measure-people.mjs <baseUrl> [--runs 5] [--out file]
import { writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const base = args[0];
const opt = (k, d) => { const i = args.indexOf(k); return i > -1 ? args[i + 1] : d; };
const runs = Number(opt('--runs', 5));
const headers = { 'content-type': 'application/json', cookie: 'demo-persona=user3' };
const story = await (await fetch(`${base}/api/demo/story`, { headers })).json();
const id = story?.data?.id ?? story?.data?.event?.id;
const timed = async (fn) => { const t0 = performance.now(); const res = await fn(); const body = await res.json().catch(() => null); return { ms: Math.round(performance.now() - t0), status: res.status, body }; };
const people = [];
let lastBody = null;
for (let i = 0; i < runs; i++) {
  const r = await timed(() => fetch(`${base}/api/social/events/${encodeURIComponent(id)}/muse`, { method: 'POST', headers, body: '{}' }));
  people.push({ ms: r.ms, status: r.status, source: r.body?.source ?? 'unknown' });
  lastBody = r.body;
  console.log('people', i + 1, r.ms, r.status, r.body?.source);
}
const picks = (lastBody?.data?.suggestions ?? lastBody?.data?.people ?? lastBody?.data?.picks ?? []).map((p) => p.id ?? p.personId ?? p).filter(Boolean);
console.log('suggested', JSON.stringify(lastBody?.data && Object.keys(lastBody.data)), JSON.stringify(picks).slice(0, 200));
const hello = [];
for (const person of picks.slice(0, 2)) {
  const r = await timed(() => fetch(`${base}/api/social/hello`, { method: 'POST', headers, body: JSON.stringify({ eventId: id, to: [person], write: true }) }));
  hello.push({ ms: r.ms, status: r.status, source: r.body?.source ?? r.body?.data?.source ?? 'unknown' });
  console.log('hello', person, r.ms, r.status, JSON.stringify(r.body).slice(0, 160));
}
const out = opt('--out', null);
if (out) writeFileSync(out, JSON.stringify({ measuredAt: new Date().toISOString(), base, eventId: id, people, hello }, null, 2) + '\n');
