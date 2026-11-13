import { describe, expect, it } from "vitest";
import { encodeWav, mergeChunks, resample } from "@/lib/audio/wav";

describe("wav", () => {
  it("merges chunks in order", () => {
    expect([...mergeChunks([new Float32Array([1, 2]), new Float32Array([3])])]).toEqual([1, 2, 3]);
  });

  it("downsamples 48 kHz to 16 kHz by averaging", () => {
    const out = resample(new Float32Array([0, 0.3, 0.6, 0.3, 0.3, 0.3]), 48_000, 16_000);
    expect(out).toHaveLength(2);
    expect(out[0]).toBeCloseTo(0.3);
    expect(out[1]).toBeCloseTo(0.3);
  });

  it("writes a mono 16-bit PCM header and clamps samples", () => {
    const view = new DataView(encodeWav(new Float32Array([0, 1, -2]), 16_000));
    const text = (offset: number) => String.fromCharCode(...[0, 1, 2, 3].map((index) => view.getUint8(offset + index)));
    expect(text(0)).toBe("RIFF");
    expect(text(8)).toBe("WAVE");
    expect(view.getUint16(22, true)).toBe(1);
    expect(view.getUint32(24, true)).toBe(16_000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(6);
    expect(view.getInt16(46, true)).toBe(0x7fff);
    expect(view.getInt16(48, true)).toBe(-0x8000);
  });
});
