import { beforeEach, describe, expect, it } from "vitest";
import { loadSeedEvents } from "@/lib/events/seed";
import { mutualFriends } from "@/lib/social/fixtures/people";
import { STORY_ORGANIZER } from "@/lib/demo/story-data";
import { hellosTo, resetSocial, sayHello, setGoing, whoIsGoing } from "@/lib/social/going";
import { helloFixture } from "@/lib/social/muse-hello";
import { goingFixture } from "@/lib/social/muse-going";
import { friendsNamesLine } from "@/lib/social/types";
import { viewerFor } from "@/lib/social/viewer";

const events = loadSeedEvents(new Date("2026-11-12T18:00:00Z"));
const event = events[0]!;
const aaron = viewerFor(undefined);
const user3 = viewerFor("user3");

describe("demo personas on Who's going", () => {
  beforeEach(() => resetSocial());

  it("picks the persona from the cookie value, else the sample student (Jolyn)", () => {
    expect(aaron.name).toBe("Jolyn");
    expect(user3.id).toBe("user3");
    expect(viewerFor("nobody").id).toBe(aaron.id);
  });

  it("never seeds the demo's people as going", () => {
    for (const each of events) {
      const who = whoIsGoing(each, user3.id, user3.interests);
      expect(who.friends.map((friend) => friend.name)).not.toContain("Jolyn");
      expect(who.friends.map((friend) => friend.name)).not.toContain("Lisa");
    }
  });

  it("never lists Jolyn or Lisa as Trish's friends, even once they mark going", () => {
    setGoing(event, aaron.id, { going: true });
    setGoing(event, "lisa", { going: true });
    const who = whoIsGoing(event, user3.id, user3.interests);
    expect(who.friends.map((friend) => friend.name)).not.toContain("Jolyn");
    expect(who.friends.map((friend) => friend.name)).not.toContain("Lisa");
    expect(goingFixture(who).people.map((person) => person.id)).not.toContain(aaron.id);
    expect(who.goingCount).toBeGreaterThanOrEqual(2);
  });

  it("Trish knows neither Jolyn nor Lisa", () => {
    expect(mutualFriends(user3.id, "lisa")).toEqual([]);
    expect(mutualFriends(user3.id, "sample-student")).toEqual([]);
  });

  it("on the story event Trish has no friends going and Jolyn and Lisa are the two open to company", () => {
    const story = { ...event, id: "evt-story-test", organizer: { ...STORY_ORGANIZER } };
    // Lisa is marked going by the invite, then turns on Open to company; Jolyn's invite accept keeps her open.
    setGoing(story, "lisa", { going: true });
    setGoing(story, aaron.id, { going: true });
    setGoing(story, "lisa", { going: true, open: true });
    const who = whoIsGoing(story, user3.id, user3.interests);
    expect(who.friends).toEqual([]);
    expect(who.openToCompany.map((person) => person.name).sort()).toEqual(["Jolyn", "Lisa"]);
    expect(who.openToCompany.every((person) => person.shared.length > 0)).toBe(true);
  });

  it("keeps the hello Muse wrote, so the people it went to can see it", () => {
    const story = { ...event, id: "evt-story-hello", organizer: { ...STORY_ORGANIZER } };
    setGoing(story, "lisa", { going: true, open: true });
    expect(sayHello(story, user3.id, "lisa", 1000, "Hi Lisa!").error).toBeNull();
    expect(hellosTo("lisa")).toEqual([{ eventId: story.id, from: user3.id, message: "Hi Lisa!", at: 1000, answered: false }]);
    expect(helloFixture(story, [{ name: "Lisa" }, { name: "Jolyn" }]).message).toMatch(/^Hi Lisa and Jolyn!/);
  });
});

describe("friendsNamesLine", () => {
  it("names one, two, or two and the rest", () => {
    expect(friendsNamesLine([])).toBeNull();
    expect(friendsNamesLine([{ name: "Maya" }])).toBe("Maya is going");
    expect(friendsNamesLine([{ name: "Maya" }, { name: "Leo" }, { name: "Sam" }])).toBe("Maya, Leo and 1 other friend are going");
  });
});
