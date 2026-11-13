import { DEMO_USER_ID } from "@/lib/muse/memory";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";

// The demo has no accounts: the viewer is the sample student.
export function demoViewer(): { id: string; interests: string[] } {
  return { id: DEMO_USER_ID, interests: loadDemoStudent().interests };
}
