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
