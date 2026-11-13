// opening-qr: turn the problem deck's opening QR step on or off, in one command.
// Sets openingQr in public/demo/deck/problem/content.json (the deck reads it on load) and
// adds or removes the try-it step at the top of steps.json, so the stage's and the remote's
// notes stay in step with the deck. Run from the repo root.
// usage: node motion/opening/tools/opening-qr.mjs on|off
import { readFileSync, writeFileSync } from 'node:fs';

const mode = process.argv[2];
if (mode !== 'on' && mode !== 'off') {
  console.error('usage: node motion/opening/tools/opening-qr.mjs on|off');
  process.exit(1);
}
const dir = 'public/demo/deck/problem';
const content = JSON.parse(readFileSync(`${dir}/content.json`, 'utf8'));
content.openingQr = mode === 'on';
writeFileSync(`${dir}/content.json`, JSON.stringify(content, null, 2) + '\n');

const TRY_IT = { id: 'try-it', title: 'Try it yourself while we set up', lead: 'speaker', notes: "We built this and it's live. Scan it now, but stay with us for the demo and play with it after: every call you'll see is real." };
const steps = JSON.parse(readFileSync(`${dir}/steps.json`, 'utf8')).filter((s) => s.id !== 'try-it');
if (mode === 'on') steps.unshift(TRY_IT);
writeFileSync(`${dir}/steps.json`, JSON.stringify(steps, null, 2) + '\n');
console.log(`openingQr ${mode}: ${steps.length} steps, first ${steps[0].id}`);
