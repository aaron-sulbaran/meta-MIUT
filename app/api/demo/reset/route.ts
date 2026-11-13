import { timingSafeEqual } from "node:crypto";
import { resetDemo } from "@/lib/demo/reset";

// Puts the demo back to its starting state for every persona: fresh seed events,
// and alerts, going, comments, Muse memory, and Ask history cleared
// (lib/demo/reset.ts). Open in development; in production it needs the
// DEMO_RESET_TOKEN env var and a matching `x-demo-token` header.
function isAllowed(request: Request): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const expected = process.env.DEMO_RESET_TOKEN?.trim();
  const given = request.headers.get("x-demo-token")?.trim();
  if (!expected || !given) return false;
  const expectedBytes = Buffer.from(expected);
  const givenBytes = Buffer.from(given);
  return expectedBytes.length === givenBytes.length && timingSafeEqual(expectedBytes, givenBytes);
}

export async function POST(request: Request) {
  if (!isAllowed(request)) {
    return Response.json({ data: null, error: "Reset needs the demo token" }, { status: 403 });
  }
  const result = await resetDemo(new Date());
  return Response.json(result, { status: result.error === null ? 200 : 502 });
}
