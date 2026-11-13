import { afterEach, describe, expect, it } from "vitest";
import { resetDemo } from "@/lib/demo/reset";
import { readSaid, SaidRecordSchema, viewFits, writeSaid } from "@/lib/demo/said";
import { setStateClient } from "@/lib/store/state";
import { createFakeRedis } from "@/tests/fake-redis";

const NOW = new Date("2026-11-13T09:00:00.000Z");
const spoken = { text: "I'm meeting Lisa, find us something on the way", by: "voice" as const, view: { line: "Lisa's in Kendall, so I moved you there." } };

afterEach(() => setStateClient(undefined));

describe("what a presenter said on the Muse card", () => {
  it("keeps the exact words and answer per viewer, so Trish never sees Jolyn's words", async () => {
    setStateClient(null);
    await writeSaid("sample-student", spoken, NOW);
    expect(await readSaid("sample-student")).toMatchObject({ text: spoken.text, by: "voice", view: spoken.view });
    expect(await readSaid("user3")).toBeNull();
    // A newer request on purpose replaces it.
    await writeSaid("sample-student", { ...spoken, text: "Actually, find one near Lisa", by: "typed" }, NOW);
    expect((await readSaid("sample-student"))?.text).toBe("Actually, find one near Lisa");
    await resetDemo(NOW);
  });

  it("is shared through the store, and the demo reset clears it for the next run", async () => {
    setStateClient(createFakeRedis().client);
    await writeSaid("sample-student", spoken, NOW);
    expect((await readSaid("sample-student"))?.text).toBe(spoken.text);
    await resetDemo(NOW);
    expect(await readSaid("sample-student")).toBeNull();
  });

  it("accepts only real words and a view of sane size", () => {
    expect(SaidRecordSchema.safeParse({ ...spoken, text: "  " }).success).toBe(false);
    expect(SaidRecordSchema.safeParse({ ...spoken, by: "shouted" }).success).toBe(false);
    expect(viewFits({ ...spoken, view: { line: "x".repeat(70_000) } })).toBe(false);
  });
});
