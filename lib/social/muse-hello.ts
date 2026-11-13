import "server-only";
import { z } from "zod";
import type { CampusEvent } from "@/lib/events/schema";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import type { GoingPerson } from "@/lib/social/types";

// Say hi on the event page: Muse writes the one short hello the student sends to
// the people open to company, from what they really share. The page shows the line
// before it says it was sent, so the room sees Muse do the reaching out.

export const HelloLineSchema = z.object({ message: z.string().min(1).max(180) });
export type HelloLine = z.infer<typeof HelloLineSchema>;

const HELLO_STRUCTURED_OUTPUT = museStructuredOutput("hello_line", HelloLineSchema);

const SYSTEM = [
  "You write a short first hello from a student to people they have never met, who are going to the same campus event and said they are open to company.",
  "One or two short sentences, under 160 characters, warm and plain, first person as the student. Greet them by first name.",
  "Mention one interest they really share or the event itself, and suggest meeting there. No emoji, no dashes, no hashtags.",
  'Return JSON only: {"message": string}.',
].join(" ");

function names(people: Pick<GoingPerson, "name">[]): string {
  const list = people.map((person) => person.name);
  return list.length <= 1 ? (list[0] ?? "") : `${list.slice(0, -1).join(", ")} and ${list.at(-1)}`;
}

/** The recorded hello, for when Muse is not reachable. */
export function helloFixture(event: Pick<CampusEvent, "title">, people: Pick<GoingPerson, "name">[]): HelloLine {
  return { message: `Hi ${names(people)}! I'm new to this and going to ${event.title} too. Want to grab a table together?` };
}

export async function writeHello(event: CampusEvent, viewerName: string, people: GoingPerson[]): Promise<MuseJobResult<HelloLine>> {
  const listed = people.map((person) => ({ name: person.name, sharedInterests: person.shared, note: person.note ?? null }));
  return runMuseJob({
    request: {
      system: SYSTEM,
      prompt: `Student: ${viewerName}\nEvent: ${JSON.stringify({ title: event.title, place: event.place.name })}\nSaying hi to: ${JSON.stringify(listed)}`,
      structuredOutput: HELLO_STRUCTURED_OUTPUT,
    },
    outputSchema: HelloLineSchema,
    fixture: () => helloFixture(event, people),
  });
}
