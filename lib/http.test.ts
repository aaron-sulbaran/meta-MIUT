import { describe, expect, it, vi } from "vitest";
import { SAVE_FAILED, savingRoute } from "@/lib/http";

describe("savingRoute", () => {
  it("answers an unexpected exception with a JSON error and logs the cause", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const handler = savingRoute("test", async () => {
      throw new TypeError("Cannot read properties of undefined (reading 'entries')");
    });
    const response = await handler();
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ data: null, error: SAVE_FAILED });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("passes a normal answer through", async () => {
    const response = await savingRoute("test", async () => Response.json({ data: 1, error: null }))();
    expect(await response.json()).toEqual({ data: 1, error: null });
  });
});
