import { describe, expect, it } from "vitest";
import { createEndpointer, NO_SPEECH_MS, PAUSE_MS } from "@/lib/audio/endpoint";

const RATE = 16_000;
const CHUNK_MS = 100;
const chunk = (level: number) => new Float32Array((RATE * CHUNK_MS) / 1000).map((_, i) => (i % 2 ? level : -level));
const feed = (push: ReturnType<typeof createEndpointer>, level: number, ms: number) => {
  let state = push(chunk(level));
  for (let t = CHUNK_MS; t < ms; t += CHUNK_MS) state = push(chunk(level));
  return state;
};

describe("createEndpointer", () => {
  it("ends the question after speech and then a pause", () => {
    const push = createEndpointer(RATE);
    feed(push, 0.002, 400);
    expect(feed(push, 0.2, 1500)).toBe("speaking");
    expect(feed(push, 0.002, PAUSE_MS - 200)).toBe("speaking");
    expect(feed(push, 0.002, 300)).toBe("done");
  });

  it("keeps listening through short gaps between words", () => {
    const push = createEndpointer(RATE);
    feed(push, 0.002, 400);
    feed(push, 0.2, 800);
    feed(push, 0.002, 600);
    expect(feed(push, 0.2, 500)).toBe("speaking");
  });

  it("gives up when nobody speaks", () => {
    const push = createEndpointer(RATE);
    expect(feed(push, 0.002, NO_SPEECH_MS - 500)).toBe("waiting");
    expect(feed(push, 0.002, 600)).toBe("no-speech");
  });

  it("ignores steady room noise above the fixed minimum", () => {
    const push = createEndpointer(RATE);
    expect(feed(push, 0.03, 3000)).toBe("waiting");
  });
});
