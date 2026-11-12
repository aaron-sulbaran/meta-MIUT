import "server-only";
import { z } from "zod";
import { callMuse, type MuseRequest } from "@/lib/muse/client";
import type { AnswerSource } from "@/lib/muse/types";

export type { AnswerSource };

export type MuseJobResult<T> =
  | { data: T; error: null; source: AnswerSource; fallbackReason: string | null }
  | { data: null; error: string; source: AnswerSource; fallbackReason: string | null };

// Models often wrap JSON in prose or code fences. Pull out the outermost object.
export function extractJsonObject(text: string): unknown {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last <= first) return null;
  try {
    return JSON.parse(text.slice(first, last + 1));
  } catch {
    return null;
  }
}

type JobSpec<Output> = {
  request: MuseRequest;
  outputSchema: z.ZodType<Output>;
  fixture: () => Output;
  // Optional post-check against the input, for example that ids exist.
  accept?: (output: Output) => string | null;
};

export async function runMuseJob<Output>(spec: JobSpec<Output>): Promise<MuseJobResult<Output>> {
  const fallBackToFixture = (reason: string): MuseJobResult<Output> => {
    const parsed = spec.outputSchema.safeParse(spec.fixture());
    if (!parsed.success) {
      return { data: null, error: `Fixture is invalid: ${parsed.error.message}`, source: "fixture", fallbackReason: reason };
    }
    return { data: parsed.data, error: null, source: "fixture", fallbackReason: reason };
  };

  const call = await callMuse(spec.request);
  if (call.error !== null) return fallBackToFixture(call.error);

  const parsed = spec.outputSchema.safeParse(extractJsonObject(call.data));
  if (!parsed.success) return fallBackToFixture("Muse output did not match the schema");

  const rejection = spec.accept?.(parsed.data) ?? null;
  if (rejection !== null) return fallBackToFixture(rejection);

  return { data: parsed.data, error: null, source: "muse", fallbackReason: null };
}
