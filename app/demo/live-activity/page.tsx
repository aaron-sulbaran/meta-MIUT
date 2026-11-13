import { connection } from "next/server";
import { LiveActivityLockScreen } from "@/components/demo/live-activity";
import { nearestFreeBite } from "@/lib/demo/free-bite";
import { getEventStore } from "@/lib/events/store";
import { classJustEnded } from "@/lib/map/class-start";
import { loadDemoStudent } from "@/lib/muse/fixtures/student-context";

// Demo beat U1a, staged: Aaron's lock screen just after class, with a Live
// Activity from Muse. Its words are real data: the class that just ended (his
// schedule) and the closest free food on now (the events the map shows).
// Tapping it opens the map with the walk home planned: /?plan=home&time=<time>,
// the /demo stage's next beat path. ?time=<ISO> pins the demo clock.
export default async function LiveActivityPage({ searchParams }: { searchParams: Promise<{ time?: string }> }) {
  await connection();
  const { time } = await searchParams;
  const pinned = time && Number.isFinite(Date.parse(time)) ? time : null;
  const now = pinned ? new Date(pinned) : new Date();
  const student = loadDemoStudent();
  const events = await getEventStore().listEvents();
  return (
    <LiveActivityLockScreen
      nowIso={now.toISOString()}
      lastClass={classJustEnded(student.schedule, now)}
      bite={nearestFreeBite(events, student.home, now)}
      handoffPath={`/?plan=home&time=${encodeURIComponent(pinned ?? now.toISOString())}`}
    />
  );
}
