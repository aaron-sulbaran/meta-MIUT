import { beforeEach, describe, expect, it } from "vitest";
import { CAST } from "@/lib/demo/beats";
import { STORY_FALLBACK_ID, STORY_ORGANIZER } from "@/lib/demo/story-data";
import { withStoryCompany } from "@/lib/demo/story-fixtures";
import { loadSeedEvents } from "@/lib/events/seed";
import { hellosTo, resetSocial, sayHello, setGoing, whoIsGoing } from "@/lib/social/going";
import { goingFixture } from "@/lib/social/muse-going";
import { viewerFor } from "@/lib/social/viewer";

const base = loadSeedEvents(new Date("2026-11-12T18:00:00Z"))[0]!;
const story = { ...base, id: STORY_FALLBACK_ID, organizer: { ...STORY_ORGANIZER } };
const trish = viewerFor("user3");
const ids = () => whoIsGoing(story, trish.id, trish.interests).openToCompany.map((person) => person.id);
const PAIR = ["sample-student", "lisa"];

describe("the story's ending offers Jolyn and Lisa", () => {
  beforeEach(() => resetSocial());

  it("offers Jolyn before Lisa joins, and both once she has, toggle or not", () => {
    expect(ids()).toEqual(["sample-student"]);
    setGoing(story, "lisa", { going: true });
    expect(ids()).toEqual(PAIR);
    const names = whoIsGoing(story, trish.id, trish.interests).openToCompany.map((person) => person.name);
    expect(names).toEqual([CAST.user1.name, CAST.user2.name]);
  });

  it("offers only them when three others are looking for company", () => {
    for (const other of ["kai", "eli", "maya"]) setGoing(story, other, { going: true, open: true, note: "Looking for people" });
    setGoing(story, "lisa", { going: true });
    expect(ids()).toEqual(PAIR);
  });

  it("keeps Jolyn open to company when the store lost her or an invite saved her without it", () => {
    setGoing(story, "sample-student", { going: false });
    setGoing(story, "lisa", { going: true });
    expect(ids()).toEqual(PAIR);
    setGoing(story, "sample-student", { going: true, open: false });
    expect(ids()).toEqual(PAIR);
  });

  it("leaves Lisa's own choice as she saved it, and the hello reaches both", () => {
    setGoing(story, "lisa", { going: true });
    const lisa = viewerFor("lisa");
    expect(whoIsGoing(story, lisa.id, lisa.interests).viewer.open).toBe(false);
    for (const id of PAIR) expect(sayHello(story, trish.id, id, 1000, "Hi both!").error).toBeNull();
    expect(hellosTo("sample-student")[0]?.from).toBe(trish.id);
    expect(hellosTo("lisa")[0]?.message).toBe("Hi both!");
  });

  it("does not change other events", () => {
    setGoing(base, "lisa", { going: true });
    expect(whoIsGoing(base, trish.id, trish.interests).openToCompany.map((person) => person.id)).not.toContain("lisa");
  });
});

describe("withStoryCompany", () => {
  beforeEach(() => resetSocial());

  it("replaces an answer that names anyone else with Jolyn and Lisa, keeping Muse's reasons", () => {
    setGoing(story, "lisa", { going: true });
    const who = whoIsGoing(story, trish.id, trish.interests);
    const pick = withStoryCompany({ line: "Say hi to Kai and Lisa. Eli also wants company.", people: [{ id: "lisa", why: "You both like film" }] }, story, who);
    expect(pick.people.map((person) => person.id)).toEqual(PAIR);
    expect(pick.people[1]!.why).toBe("You both like film");
    expect(pick.line).toBe(`${CAST.user1.name} and ${CAST.user2.name} are going and looking for company. Say hi!`);
  });

  it("keeps a live answer that already names exactly them", () => {
    setGoing(story, "lisa", { going: true });
    const who = whoIsGoing(story, trish.id, trish.interests);
    const live = { line: "Jolyn and Lisa both love film and free food, say hi!", people: PAIR.map((id) => ({ id, why: "Likes film" })) };
    expect(withStoryCompany(live, story, who)).toBe(live);
  });

  it("fixes the recorded answer too, which names only the best match", () => {
    setGoing(story, "lisa", { going: true });
    const who = whoIsGoing(story, trish.id, trish.interests);
    expect(withStoryCompany(goingFixture(who), story, who).line).toMatch(/^Jolyn and Lisa /);
  });

  it("passes other events through", () => {
    const who = whoIsGoing(base, trish.id, trish.interests);
    const pick = { line: "Say hi to Kai.", people: [{ id: "kai", why: "Music" }] };
    expect(withStoryCompany(pick, base, who)).toBe(pick);
  });
});
