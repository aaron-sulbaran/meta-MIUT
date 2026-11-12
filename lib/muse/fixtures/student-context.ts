import { loadSeedStudent } from "@/lib/events/seed";
import type { StudentContext } from "@/lib/muse/profile";

// PLACEHOLDER: invented details for the demo student, on top of the seed profile.
export function loadDemoStudent(): StudentContext {
  return {
    ...loadSeedStudent(),
    age: 20,
    year: "second-year",
    major: "Computer Science",
    languages: ["Spanish"],
    communities: [],
    dietary: ["vegetarian"],
  };
}
