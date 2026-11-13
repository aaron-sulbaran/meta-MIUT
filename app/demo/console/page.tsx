import { connection } from "next/server";
import { DemoConsole } from "@/components/alerts/demo-console";
import { FreshRun } from "@/components/demo/fresh-run";
import { PhoneLinks } from "@/components/demo/phone-links";
import { StageNotes } from "@/components/demo/presenter-notes";
import { getEventStore } from "@/lib/events/store";

// Operator page for rehearsals and the live demo: start a fresh run (first, so it
// is the first thing the presenter sees), publish a sample event, fire an alert by hand, and read the presenter notes for the beat
// the stage is on. Not linked from the tab bar.
export default async function DemoPage() {
  await connection();
  const store = getEventStore();
  const events = await store.listEvents();
  const options = [...events]
    .sort((first, second) => Date.parse(first.start) - Date.parse(second.start))
    .map((event) => ({ id: event.id, title: event.title }));

  return (
    <>
      <div className="px-3 pt-3">
        <FreshRun />
      </div>
      <StageNotes />
      <div className="px-3 pt-3">
        <PhoneLinks />
      </div>
      <DemoConsole events={options} backend={store.backend} />
    </>
  );
}
