import { beforeEach, describe, expect, it } from "vitest";
import type { CampusEvent } from "@/lib/events/schema";
import { loadSeedEvents } from "@/lib/events/seed";
import { addComment, eventComments, resetComments } from "@/lib/social/comments";

const viewer = { id: "sample-student", name: "Sample" };
const events: CampusEvent[] = loadSeedEvents(new Date("2026-11-12T18:00:00Z"));
const foodEvent = events.find((event) => event.food) as CampusEvent;
const at = (event: CampusEvent, minutesFromStart: number) => new Date(Date.parse(event.start) + minutesFromStart * 60_000);

describe("event comments", () => {
  beforeEach(() => resetComments());

  it("shows only sample comments whose time has come, newest first", () => {
    const now = at(foodEvent, 30);
    const { comments } = eventComments(foodEvent, viewer.id, now);
    expect(comments.length).toBeGreaterThan(0);
    for (const comment of comments) expect(Date.parse(comment.at)).toBeLessThanOrEqual(now.getTime());
    const times = comments.filter((comment) => !comment.replyTo).map((comment) => Date.parse(comment.at));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("threads replies under their comment, oldest first, from someone else first", () => {
    const after = new Date(Date.parse(foodEvent.end) + 60 * 60_000);
    const withReplies = events
      .map((event) => eventComments(event, viewer.id, after).comments)
      .find((comments) => comments.some((comment) => comment.replyTo));
    expect(withReplies).toBeDefined();
    const comments = withReplies as NonNullable<typeof withReplies>;
    comments.forEach((comment, index) => {
      if (!comment.replyTo) return;
      const parentIndex = comments.findIndex((other) => other.id === comment.replyTo);
      expect(parentIndex).toBeGreaterThanOrEqual(0);
      expect(parentIndex).toBeLessThan(index);
      const parent = comments[parentIndex] as (typeof comments)[number];
      expect(Date.parse(comment.at)).toBeGreaterThan(Date.parse(parent.at));
      if (comment.id.endsWith("-r0")) expect(comment.authorId).not.toBe(parent.authorId);
    });
  });

  it("grows as the event goes on and is stable for the same time", () => {
    const early = eventComments(foodEvent, viewer.id, at(foodEvent, -24 * 60)).comments.length;
    const late = eventComments(foodEvent, viewer.id, new Date(Date.parse(foodEvent.end) + 60 * 60_000)).comments;
    expect(late.length).toBeGreaterThanOrEqual(early);
    expect(eventComments(foodEvent, viewer.id, new Date(Date.parse(foodEvent.end) + 60 * 60_000)).comments).toEqual(late);
  });

  it("never mentions food at an event without it", () => {
    const noFood = events.find((event) => !event.food) as CampusEvent;
    const after = new Date(Date.parse(noFood.end) + 60 * 60_000);
    for (const comment of eventComments(noFood, viewer.id, after).comments) expect(comment.text).not.toMatch(/left|gone|run out/);
  });

  it("puts the viewer's comment on top, marked as theirs, on that event only", () => {
    const now = at(foodEvent, 30);
    addComment(foodEvent, viewer, "Saving a seat by the door", now);
    const { comments } = eventComments(foodEvent, viewer.id, now);
    expect(comments[0]).toMatchObject({ text: "Saving a seat by the door", name: "Sample", mine: true });
    expect(comments.filter((comment) => comment.mine)).toHaveLength(1);
    const other = events.find((event) => event.id !== foodEvent.id) as CampusEvent;
    expect(eventComments(other, viewer.id, now).comments.some((comment) => comment.mine)).toBe(false);
  });

  it("puts the viewer's reply under the comment it answers, after the earlier replies", () => {
    const now = at(foodEvent, 30);
    const parent = eventComments(foodEvent, viewer.id, now).comments.find((comment) => !comment.replyTo) as { id: string };
    addComment(foodEvent, viewer, "Count me in", now, parent.id);
    const { comments } = eventComments(foodEvent, viewer.id, now);
    const start = comments.findIndex((comment) => comment.id === parent.id);
    const thread = comments.slice(start + 1).filter((comment, index, rest) => rest.slice(0, index + 1).every((c) => c.replyTo === parent.id));
    expect(thread.at(-1)).toMatchObject({ text: "Count me in", replyTo: parent.id, mine: true });
    expect(comments.filter((comment) => !comment.replyTo).some((comment) => comment.text === "Count me in")).toBe(false);
  });

  it("keeps the name of the person a reply answers", () => {
    const now = at(foodEvent, 30);
    const parent = eventComments(foodEvent, viewer.id, now).comments.find((comment) => !comment.replyTo) as { id: string; name: string };
    addComment(foodEvent, viewer, "See you there", now, parent.id, parent.name);
    const reply = eventComments(foodEvent, viewer.id, now).comments.find((comment) => comment.text === "See you there");
    expect(reply).toMatchObject({ replyTo: parent.id, mention: parent.name });
  });
});
