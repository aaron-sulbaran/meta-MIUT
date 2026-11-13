import { describe, expect, it } from "vitest";
import { switchFrom, withAppSwitch } from "@/lib/demo/app-switch";

describe("the app switch flag", () => {
  it("joins a path with or without a query", () => {
    expect(withAppSwitch("/invite/abc")).toBe("/invite/abc?opened=instagram");
    expect(withAppSwitch("/invite/abc?from=x")).toBe("/invite/abc?from=x&opened=instagram");
  });

  it("plays only for a known source", () => {
    expect(switchFrom("instagram")).toBe("instagram");
    expect(switchFrom(undefined)).toBeNull();
    expect(switchFrom(["instagram"])).toBeNull();
    expect(switchFrom("tiktok")).toBeNull();
  });
});
