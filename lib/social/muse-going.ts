import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import { sharedLine, type GoingPerson, type WhoIsGoing } from "@/lib/social/types";

// Looking for company on the event page: Muse reads the event and the students
// going who are open to company and share interests (not the viewer's friends,
// who the page already lists), and suggests who to say hi to, in a line or
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
  "You suggest new people a student could meet at a campus event and maybe become friends with.",
  "You get the event and the students going who are open to company and share interests with the student. None of them are the student's friends yet.",
  'Return JSON only: {"line":"one or two short sentences to the student: who to say hi to and what you have in common, warm and plain, no emoji, no dashes","people":[{"id","why"}]}.',
  "people: up to 3, best match first, only ids from the list. why: under 60 characters, like You both like film, or Friends with Lisa, likes film.",
  "Never mention or suggest the student's friends, and never invent people or facts.",
].join(" ");

function describe(person: GoingPerson) {
  return {
    id: person.id,
    name: person.name,
    year: person.year,
    major: person.major,
    sharedInterests: person.shared,
    mutualFriends: person.mutual ?? [],
    note: person.note ?? null,
  };
}

/** What the fixture says when Muse is not reachable: the best matches looking for company. */
export function goingFixture(who: WhoIsGoing): GoingPick {
  const best = who.openToCompany[0];
  if (!best) return { line: "Nobody is looking for company here yet. Mark Going and Open to company so others can say hi.", people: [] };
  const people = who.openToCompany.slice(0, 3).map((person) => ({
    id: person.id,
    why: person.mutual?.length ? `Friends with ${person.mutual[0]}` : sharedLine(person.shared),
  }));
  return { line: `Say hi to ${best.name}. ${people[0]!.why}.`, people };
}

export async function whoToGoWith(event: CampusEvent, who: WhoIsGoing, viewerName: string): Promise<MuseJobResult<GoingPick>> {
  const listed = who.openToCompany.map(describe);
  const ids = new Set(listed.map((person) => person.id));
  return runMuseJob({
    request: {
      system: SYSTEM,
      prompt: `Student: ${viewerName}\nEvent: ${JSON.stringify({ title: event.title, description: event.description, place: event.place.name })}\nGoing: ${who.goingCount} in all. Open to company and sharing interests: ${JSON.stringify(listed)}`,
      structuredOutput: GOING_STRUCTURED_OUTPUT,
    },
    outputSchema: GoingPickSchema,
    fixture: () => goingFixture(who),
    accept: (output) => (output.people.every((person) => ids.has(person.id)) ? null : "Muse named someone who is not going"),
  });
}
