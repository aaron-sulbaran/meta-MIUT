import "server-only";
import { z } from "zod";
import { museStructuredOutput, runMuseJob, type MuseJobResult } from "@/lib/muse/job";
import { placeFixture } from "@/lib/muse/fixtures/place";

// Reads the crawl's "Somewhere else" line before the map search: fixes typos, turns a kind of
// place ("a taco shop") into search words, and says no to places a student cannot get to
// from campus today (Narnia, San Francisco). Code still checks the distance of what it finds.

export const PlaceReadSchema = z.object({
  reachable: z.boolean(),
  // Words for a map search near campus: a corrected name ("Tatte Kendall Square") or a kind ("tacos").
  query: z.string().trim().max(80),
  // One short sentence for the student when it is not reachable.
  reason: z.string().trim().max(160),
});
export type PlaceRead = z.infer<typeof PlaceReadSchema>;

const SYSTEM = [
  "A student at MIT in Cambridge, Massachusetts typed where their walk should end.",
  "Return JSON only: { reachable, query, reason }.",
  "query: the words to type into a map search near Cambridge and Boston. Fix spelling mistakes and finish partial names (\"tate kendal\" is \"Tatte Kendall Square\").",
  "For a kind of place rather than a name, give the kind in one or two words (\"a taco shop\" is \"tacos\", \"somewhere to get boba\" is \"bubble tea\").",
  "reachable: false only when the place is made up (Narnia, Hogwarts) or is not in the Boston area (another city, state or country, like San Francisco or Paris). Anything that could be in Greater Boston is reachable.",
  "reason: empty when reachable; otherwise one short friendly sentence, for example \"San Francisco is across the country, too far for a walk from MIT.\"",
].join("\n");

export async function readPlace(text: string): Promise<MuseJobResult<PlaceRead>> {
  return runMuseJob({
    request: {
      system: SYSTEM,
      prompt: `The student typed: ${JSON.stringify(text)}`,
      structuredOutput: museStructuredOutput("place_read", PlaceReadSchema),
      maxCompletionTokens: 300,
    },
    outputSchema: PlaceReadSchema,
    fixture: () => placeFixture(text),
    accept: (read) => (read.reachable && !read.query ? "Muse gave no search words" : null),
  });
}
