import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import { friendsNamesLine, sharedLine, type GoingPerson, type WhoIsGoing } from "@/lib/social/types";

// "Who do I know that's going?" on the event page (demo beat U3d): Muse reads
// the event and who is going (friends, people with friends in common, people
// open to company who share interests) and says who to go with, in a line or
// two, naming up to three people with a short reason each.

export const GoingPickSchema = z.object({
  line: z.string().min(1).max(220),
  people: z
    .array(z.object({ id: z.string().min(1), why: z.string().min(1).max(90) }))
    .max(3),
});
export type GoingPick = z.infer<typeof GoingPickSchema>;

const GOING_STRUCTURED_OUTPUT = museStructuredOutput("who_to_go_with", GoingPickSchema);

const SYSTEM = [
  "You help a student decide who to go to a campus event with.",
  "You get the event and who is going: friends, people who have friends in common with the student, and people open to company who share interests.",
  'Return JSON only: {"line":"one or two short sentences to the student, friends first by name, warm and plain, no emoji, no dashes","people":[{"id","why"}]}.',
  "people: up to 3, best first, only ids from the list. why: under 60 characters, like Your friend, or Friends with Lisa, likes film.",
  "If no friend is going, suggest the best person open to company. Never invent people or facts.",
].join(" ");

function describe(person: GoingPerson, kind: "friend" | "company") {
  return {
    id: person.id,
    name: person.name,
    kind,
    year: person.year,
    major: person.major,
    sharedInterests: person.shared,
    mutualFriends: person.mutual ?? [],
    note: person.note ?? null,
  };
}

/** What the fixture says when Muse is not reachable: friends first, else the best match open to company. */
export function goingFixture(who: WhoIsGoing): GoingPick {
  const friendsLine = friendsNamesLine(who.friends);
  if (friendsLine) {
    return {
      line: `${friendsLine}. Want to go with ${who.friends.length === 1 ? "them" : "them both"}?`,
      people: who.friends.slice(0, 3).map((friend) => ({ id: friend.id, why: "Your friend" })),
    };
  }
  const best = who.openToCompany[0];
  if (best) {
    const why = best.mutual?.length ? `Friends with ${best.mutual[0]}` : sharedLine(best.shared);
    return { line: `None of your friends yet, but ${best.name} is looking for company. ${why}.`, people: [{ id: best.id, why }] };
  }
  return { line: "Nobody you know is going yet. Be the first, and your friends will see it.", people: [] };
}

export async function whoToGoWith(event: CampusEvent, who: WhoIsGoing, viewerName: string): Promise<MuseJobResult<GoingPick>> {
  const listed = [...who.friends.map((person) => describe(person, "friend")), ...who.openToCompany.map((person) => describe(person, "company"))];
  const ids = new Set(listed.map((person) => person.id));
  return runMuseJob({
    request: {
      system: SYSTEM,
      prompt: `Student: ${viewerName}\nEvent: ${JSON.stringify({ title: event.title, description: event.description, place: event.place.name })}\nGoing (${who.goingCount} in all): ${JSON.stringify(listed)}`,
      structuredOutput: GOING_STRUCTURED_OUTPUT,
    },
    outputSchema: GoingPickSchema,
    fixture: () => goingFixture(who),
    accept: (output) => (output.people.every((person) => ids.has(person.id)) ? null : "Muse named someone who is not going"),
  });
}
