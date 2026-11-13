import { z } from "zod";

export async function readJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T; error: null } | { data: null; error: string }> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { data: null, error: "Body must be JSON" };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { data: null, error: z.prettifyError(parsed.error) };
  return { data: parsed.data, error: null };
}

export const SAVE_FAILED = "Could not save that. Try again.";

/**
 * Runs a route handler that saves something; an unexpected exception is logged on the
 * server and answered as a JSON error, so the screen never sees an HTML error page.
 */
export function savingRoute<Args extends unknown[]>(label: string, handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (cause) {
      console.error(`[${label}] failed:`, cause);
      return Response.json({ data: null, error: SAVE_FAILED }, { status: 500 });
    }
  };
}
