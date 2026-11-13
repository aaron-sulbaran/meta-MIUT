import { describe, expect, it, vi } from "vitest";
import { TRANSCRIBE_MODEL, transcribeAudio } from "@/lib/muse/transcribe";

const env = { MUSE_API_KEY: "test-key-not-real" };
const wav = new Blob([new Uint8Array(44)], { type: "audio/wav" });

describe("transcribeAudio", () => {
  it("posts multipart settings and audio, and returns the trimmed transcript", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ transcript: " free food tonight? ", turns: [] }));
    const result = await transcribeAudio(wav, { env, fetchImpl });
    expect(result).toEqual({ data: "free food tonight?", error: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meta.ai/v1/asr/transcribe");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key-not-real");
    const form = init.body as FormData;
    expect(JSON.parse(await (form.get("request") as Blob).text())).toMatchObject({ model: TRANSCRIBE_MODEL, audioEncoding: "WAV" });
    expect(form.get("audio")).toBeInstanceOf(Blob);
  });

  it("reports a missing key, an HTTP error, and a bad shape", async () => {
    expect((await transcribeAudio(wav, { env: {} })).error).toContain("MUSE_API_KEY");
    const failing = vi.fn(async () => new Response("slow down", { status: 429 }));
    expect((await transcribeAudio(wav, { env, fetchImpl: failing })).error).toContain("429");
    const odd = vi.fn(async () => Response.json({ text: "hi" }));
    expect((await transcribeAudio(wav, { env, fetchImpl: odd })).error).toContain("unexpected");
  });
});
