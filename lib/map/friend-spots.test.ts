import { describe, expect, it } from "vitest";
import { friendContext, friendLabel, friendNamedIn } from "@/lib/map/friend-spots";

describe("friendNamedIn", () => {
  it("finds a friend named in a spoken request", () => {
    const friend = friendNamedIn("wait actually I'm not going home, I was gonna hang out with Lisa");
    expect(friend?.id).toBe("lisa");
    expect(friend && friendLabel(friend)).toBe("Lisa at Kendall Square");
  });

  it("matches whole words only", () => {
    expect(friendNamedIn("Elisabeth said the leopard print was free")).toBeNull();
  });

  it("returns null when no friend is named", () => {
    expect(friendNamedIn("find me free food on the way home")).toBeNull();
    expect(friendContext("find me free food on the way home")).toBeNull();
  });

  it("tells Muse where a named friend is", () => {
    expect(friendContext("meeting Lisa later")).toContain("Kendall Square");
  });
});
