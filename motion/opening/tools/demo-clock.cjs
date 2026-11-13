// Preload for capture servers only: shifts the server's clock so "now" starts at DEMO_NOW
// (default 3:05 PM ET on the demo day), and then runs forward normally. Seeds, lists and
// the story read the same afternoon the pitch describes. Never used by the app itself.
const target = Date.parse(process.env.DEMO_NOW || '2026-11-13T20:05:00.000Z');
const RealDate = Date;
const offset = target - RealDate.now();
function DemoDate(...args) {
  if (!new.target) return new RealDate(RealDate.now() + offset).toString();
  return args.length === 0 ? new RealDate(RealDate.now() + offset) : new RealDate(...args);
}
DemoDate.prototype = RealDate.prototype;
DemoDate.now = () => RealDate.now() + offset;
DemoDate.UTC = RealDate.UTC;
DemoDate.parse = RealDate.parse;
globalThis.Date = DemoDate;
