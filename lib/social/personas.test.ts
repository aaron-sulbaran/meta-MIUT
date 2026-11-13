import { beforeEach, describe, expect, it } from "vitest";
import { loadSeedEvents } from "@/lib/events/seed";
import { mutualFriends } from "@/lib/social/fixtures/people";
import { resetSocial, setGoing, whoIsGoing } from "@/lib/social/going";
import { goingFixture } from "@/lib/social/muse-going";
import { friendsNamesLine } from "@/lib/social/types";
import { viewerFor } from "@/lib/social/viewer";

const events = loadSeedEvents(new Date("2026-11-12T18:00:00Z"));
const event = events[0]!;
const aaron = viewerFor(undefined);
const user3 = viewerFor("user3");

describe("demo personas on Who's going", () => {
  beforeEach(() => resetSocial());

  it("picks the persona from the cookie value, else the sample student (Aaron)", () => {
    expect(aaron.name).toBe("Aaron");
    expect(user3.id).toBe("user3");
    expect(viewerFor("nobody").id).toBe(aaron.id);
  });

  it("never seeds the demo's people as going", () => {
    for (const each of events) {
      const who = whoIsGoing(each, user3.id, user3.interests);
      expect(who.friends.map((friend) => friend.name)).not.toContain("Aaron");
      expect(who.friends.map((friend) => friend.name)).not.toContain("Lisa");
    }
  });

  it("shows User 3 that Aaron and Lisa are going once they mark going", () => {
    setGoing(event, aaron.id, { going: true });
    setGoing(event, "lisa", { going: true });
    const who = whoIsGoing(event, user3.id, user3.interests);
    expect(friendsNamesLine(who.friends.filter((friend) => ["Aaron", "Lisa"].includes(friend.name)))).toBe("Aaron and Lisa are going");
    expect(goingFixture(who).line).toContain("Aaron");
    expect(who.goingCount).toBeGreaterThanOrEqual(2);
  });

  it("finds friends in common", () => {
    expect(mutualFriends(user3.id, "leo")).toEqual(expect.arrayContaining(["Aaron", "Lisa"]));
  });
});

describe("friendsNamesLine", () => {
  it("names one, two, or two and the rest", () => {
    expect(friendsNamesLine([])).toBeNull();
    expect(friendsNamesLine([{ name: "Maya" }])).toBe("Maya is going");
    expect(friendsNamesLine([{ name: "Maya" }, { name: "Leo" }, { name: "Sam" }])).toBe("Maya, Leo and 1 other friend are going");
  });
});
