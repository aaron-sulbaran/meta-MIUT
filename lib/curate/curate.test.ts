import { describe, expect, it } from "vitest";
import { USER3_CONNECTORS } from "@/lib/curate/connectors";
import { buildCurateRequest, curateCandidates, curateFixture, pinStory, sameKindOfNight, type CurateOutput } from "@/lib/curate/curate";
import type { CampusEvent } from "@/lib/events/schema";

const NOW = new Date("2026-11-13T18:00:00.000Z");

function event(id: string, title: string, startsInHours: number, extra: Partial<CampusEvent> = {}): CampusEvent {
  const start = new Date(NOW.getTime() + startsInHours * 3_600_000);
  return {
    id,
    title,
    description: "",
    start: start.toISOString(),
    end: new Date(start.getTime() + 2 * 3_600_000).toISOString(),
    place: { name: "Somewhere", lat: 42.36, lng: -71.09 },
    free: true,
    food: false,
    access: { kind: "open" },
    organizer: { name: "Club", handle: "club" },
    source: { kind: "manual" },
    status: "published",
    createdAt: NOW.toISOString(),
    ...extra,
  };
}

const story = event("evt-demo-story", "Board Game Night", 1, { food: true, foodNote: "Dumplings" });
const film = event("evt-film", "Film night", 3);
const yoga = event("evt-yoga", "Sunrise yoga", 20);
const past = event("evt-past", "Over already", -5);
const later = event("evt-later", "Next month", 24 * 30);

describe("curateCandidates", () => {
  it("keeps upcoming events within a week, soonest first", () => {
    expect(curateCandidates([later, yoga, past, story, film], NOW).map((item) => item.id)).toEqual(["evt-demo-story", "evt-film", "evt-yoga"]);
  });
});

describe("buildCurateRequest", () => {
  it("lists every signal and every candidate id", () => {
    const request = buildCurateRequest([story, film], USER3_CONNECTORS, NOW);
    expect(request.prompt).toContain("MIT Board Game Club newsletter");
    expect(request.prompt).toContain("id evt-demo-story");
    expect(request.prompt).toContain("id evt-film");
    expect(request.structuredOutput?.name).toBe("curated_feed");
  });
});

describe("pinStory", () => {
  const output: CurateOutput = {
    summary: "You like film.",
    picks: [
      { eventId: "evt-film", reason: "You follow @mit_film." },
      { eventId: "evt-demo-story", reason: "Board games and dumplings." },
      { eventId: "evt-yoga", reason: "Morning." },
    ],
  };

  it("moves the story event to the top and keeps Muse's reason", () => {
    const feed = pinStory(output, "evt-demo-story", [story, film, yoga]);
    expect(feed.picks.map((pick) => pick.eventId)).toEqual(["evt-demo-story", "evt-film", "evt-yoga"]);
    expect(feed.picks[0]?.reason).toBe("Board games and dumplings.");
    expect(feed.storyPinned).toBe(true);
  });

  it("adds the story event when Muse left it out, keeping three picks", () => {
    const feed = pinStory({ summary: "x", picks: [output.picks[0]!, output.picks[2]!] }, "evt-demo-story", [story, film, yoga]);
    expect(feed.picks.map((pick) => pick.eventId)).toEqual(["evt-demo-story", "evt-film", "evt-yoga"]);
  });

  it("changes nothing when the story event is already first or not listed", () => {
    expect(pinStory({ summary: "x", picks: [output.picks[1]!] }, "evt-demo-story", [story]).storyPinned).toBe(false);
    expect(pinStory(output, "evt-missing", [story, film, yoga]).picks[0]?.eventId).toBe("evt-film");
  });
});

describe("curateFixture", () => {
  it("puts the story event first and fills three picks", () => {
    const fixture = curateFixture([film, yoga, story], USER3_CONNECTORS, "evt-demo-story");
    expect(fixture.picks).toHaveLength(3);
    expect(fixture.picks[0]?.eventId).toBe("evt-demo-story");
  });
});

describe("three different picks", () => {
  const storyFull = event("evt-demo-story", "Board Game Night + Free Dumplings", 1, { food: true, foodNote: "Dumplings", description: "board games dumplings" });
  const copy = event("evt-copy", "Board Game Night + Free Dumplings", 2, { food: true, foodNote: "Dumplings", description: "board games dumplings" });
  const stata = event("evt-stata", "Free Dumplings in the Stata Student Street", 1, { food: true, foodNote: "Dumplings", description: "dumplings late night food" });
  const center = event("evt-center", "Dumpling Night in the Student Center", 2, { food: true, foodNote: "Dumplings", description: "dumplings food" });
  const tea = event("evt-tea", "Board Games and Tea at Walker", 3, { description: "board games strategy" });
  const shorts = event("evt-film", "Short Film Night", 4, { description: "film screening" });

  it("lists a second copy of an event once, keeping the story's", () => {
    const ids = curateCandidates([copy, storyFull, tea], NOW, "evt-demo-story").map((item) => item.id);
    expect(ids).toContain("evt-demo-story");
    expect(ids).not.toContain("evt-copy");
  });

  it("never repeats an event or a title, and the recorded feed is not three dumpling nights", () => {
    const candidates = curateCandidates([storyFull, stata, center, tea, shorts], NOW, "evt-demo-story");
    const recorded = curateFixture(candidates, USER3_CONNECTORS, "evt-demo-story");
    const titles = recorded.picks.map((pick) => candidates.find((item) => item.id === pick.eventId)!.title);
    expect(titles[0]).toBe("Board Game Night + Free Dumplings");
    expect(new Set(titles).size).toBe(3);
    expect(titles.filter((title) => /dumpling/i.test(title))).toHaveLength(1);
  });

  it("drops a repeated pick and pins the story first", () => {
    const output: CurateOutput = { summary: "s", picks: [{ eventId: "evt-tea", reason: "a" }, { eventId: "evt-tea", reason: "b" }, { eventId: "evt-demo-story", reason: "c" }] };
    const feed = pinStory(output, "evt-demo-story", [storyFull, tea, shorts]);
    expect(feed.picks.map((pick) => pick.eventId)).toEqual(["evt-demo-story", "evt-tea"]);
  });
});

describe("sameKindOfNight", () => {
  it("catches near copies and repeated food nights, not different nights", () => {
    expect(sameKindOfNight("Board Game Night + Free Dumplings", "Board Game Night")).toBe(true);
    expect(sameKindOfNight("Free Dumplings in the Stata Student Street", "Dumpling Night in the Student Center")).toBe(true);
    expect(sameKindOfNight("Board Game Night + Free Dumplings", "Board Games and Tea at Walker")).toBe(false);
    expect(sameKindOfNight("Board Game Night + Free Dumplings", "Short Film Night in the Sidney-Pacific Lounge")).toBe(false);
  });
});

describe("Trish's calendar agrees with the story clock", () => {
  it("says her class ended at 3:00 PM and never puts a class later today", () => {
    const calendar = USER3_CONNECTORS.find((source) => source.id === "calendar")!;
    const words = [calendar.found, ...calendar.items].join(" ");
    expect(words).toContain("3:00 PM");
    expect(words).not.toMatch(/[4-9](:\d\d)? ?(PM|pm)|tonight/);
  });
});
