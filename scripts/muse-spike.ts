// Runs one real flyer image through the live Muse API with the same adapter and
// prompt the app's extract job uses, once per model, and reports how each did.
//
//   pnpm spike:muse <image.(png|jpg|jpeg|webp)> [caption] [--models a,b] [--effort low] [--timeout 60000]
//
// Reads MUSE_* from .env.local (or the shell). Never prints the key or headers.
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { MUSE_MODELS, REASONING_EFFORTS, callMuse, type ReasoningEffort } from "@/lib/muse/client";
import { ExtractOutputSchema, buildExtractRequest } from "@/lib/muse/extract";
import { extractJsonObject } from "@/lib/muse/job";

const MEDIA_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" } as const;
const DEFAULT_SPIKE_TIMEOUT_MS = 90_000;
const DEFAULT_CAPTION = "No caption was posted. Read everything from the flyer image.";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function isReasoningEffort(value: string): value is ReasoningEffort {
  return (REASONING_EFFORTS as readonly string[]).includes(value);
}

function isMediaTypeExtension(value: string): value is keyof typeof MEDIA_TYPES {
  return value in MEDIA_TYPES;
}

const { values: flags, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    models: { type: "string" },
    effort: { type: "string" },
    timeout: { type: "string" },
  },
});

const [imagePath, caption = DEFAULT_CAPTION] = positionals;
if (!imagePath) {
  fail("Usage: pnpm spike:muse <image path> [caption] [--models a,b] [--effort low] [--timeout ms]");
}

try {
  process.loadEnvFile(path.resolve(import.meta.dirname, "..", ".env.local"));
} catch {
  // No .env.local; the shell environment may still carry the variables.
}
if (!process.env.MUSE_API_KEY?.trim()) {
  fail("MUSE_API_KEY is not set. Add it to .env.local (see .env.example) and run again.");
}

const effort = flags.effort;
if (effort !== undefined && !isReasoningEffort(effort)) {
  fail(`--effort must be one of: ${REASONING_EFFORTS.join(", ")}`);
}
const timeoutMs = flags.timeout === undefined ? DEFAULT_SPIKE_TIMEOUT_MS : Number(flags.timeout);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) fail("--timeout must be a positive number of milliseconds");

const models = flags.models
  ? flags.models
      .split(",")
      .map((model) => model.trim())
      .filter(Boolean)
  : [...MUSE_MODELS];

const extension = path.extname(imagePath).toLowerCase();
if (!isMediaTypeExtension(extension)) fail(`Image must be one of: ${Object.keys(MEDIA_TYPES).join(", ")}`);
let imageBytes: Buffer;
try {
  imageBytes = readFileSync(imagePath);
} catch {
  fail(`Could not read image at ${imagePath}`);
}

const request = buildExtractRequest(
  { caption, imageBase64: imageBytes.toString("base64"), imageMediaType: MEDIA_TYPES[extension] },
  new Date(),
);

console.log(
  `Image ${path.basename(imagePath)} (${Math.round(imageBytes.length / 1024)} KB), ${models.length} model(s), timeout ${timeoutMs} ms\n`,
);

let successes = 0;
for (const model of models) {
  const result = await callMuse(request, { model, reasoningEffort: effort, timeoutMs });
  const meta = result.meta;
  const http = meta?.httpStatus === null || meta === null ? "no response" : `HTTP ${meta.httpStatus}`;
  const latency = meta?.latencyMs === null || meta === null ? "-" : `${meta.latencyMs} ms`;
  const usage = meta?.usage
    ? `tokens in ${meta.usage.promptTokens} out ${meta.usage.completionTokens} total ${meta.usage.totalTokens}`
    : "tokens -";
  const summary = [model, `effort ${meta?.reasoningEffort ?? effort ?? "-"}`, http, latency, usage];

  if (result.error !== null) {
    console.log(`${summary.join(" | ")} | error: ${result.error}\n`);
    continue;
  }
  successes += 1;

  let parsedCleanly = true;
  try {
    JSON.parse(result.data);
  } catch {
    parsedCleanly = false;
  }
  const draft = extractJsonObject(result.data);
  const validation = ExtractOutputSchema.safeParse(draft);
  summary.push(
    `finish ${meta?.finishReason ?? "-"}`,
    `json ${parsedCleanly ? "clean" : "needed repair"}`,
    `schema ${validation.success ? "pass" : "FAIL"}`,
  );
  console.log(summary.join(" | "));
  if (!validation.success) {
    console.log(validation.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`).join("\n"));
  }
  console.log(draft === null ? `  raw: ${result.data.slice(0, 500)}` : JSON.stringify(draft, null, 2));
  console.log("");
}

if (successes === 0) process.exit(1);
