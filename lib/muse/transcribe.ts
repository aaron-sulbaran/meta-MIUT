import "server-only";
import { z } from "zod";
import { MUSE_TIMEOUT_MS, readMuseConfig } from "@/lib/muse/client";

// Muse Voice Transcribe, file upload. Confirmed live on 2026-11-12 against
// dev.meta.ai/docs/speech-to-text: multipart with a JSON `request` part and a
// mono 16-bit PCM WAV `audio` part (16 or 24 kHz). Speech to text only.

export const TRANSCRIBE_MODEL = "muse-voice-transcribe-1.0";
// A 30 s clip at 16 kHz is about 1 MB; the API caps the body at 32 MB.
export const MAX_AUDIO_BYTES = 4_000_000;

const TranscribeResponseSchema = z.object({ transcript: z.string() });

export type TranscribeResult = { data: string; error: null } | { data: null; error: string };

export async function transcribeAudio(
  wav: Blob,
  options: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch } = {},
): Promise<TranscribeResult> {
  const config = readMuseConfig(options.env ?? process.env);
  if (config.error !== null) return { data: null, error: config.error };

  const form = new FormData();
  const settings = { model: TRANSCRIBE_MODEL, audioEncoding: "WAV", mode: "PUSH_TO_TALK", languageBias: ["English"] };
  form.append("request", new Blob([JSON.stringify(settings)], { type: "application/json" }));
  form.append("audio", new Blob([wav], { type: "audio/wav" }), "question.wav");

  try {
    const response = await (options.fetchImpl ?? fetch)(`${config.data.baseUrl}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.data.apiKey}` },
      body: form,
      signal: AbortSignal.timeout(MUSE_TIMEOUT_MS),
    });
    if (!response.ok) return { data: null, error: `Muse Voice Transcribe returned ${response.status}` };
    const parsed = TranscribeResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { data: null, error: "Muse Voice Transcribe returned an unexpected shape" };
    return { data: parsed.data.transcript.trim(), error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "Muse Voice Transcribe failed" };
  }
}
