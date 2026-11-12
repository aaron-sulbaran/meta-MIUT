import { connection } from "next/server";
import { DemoConsole } from "@/components/alerts/demo-console";
import { getEventStore } from "@/lib/events/store";

// Operator page for rehearsals and the live demo: publish a sample event, fire
// an alert by hand, reset the data. Not linked from the tab bar.
export default async function DemoPage() {
  await connection();
  const store = getEventStore();
  const events = await store.listEvents();
  const options = [...events]
    .sort((first, second) => Date.parse(first.start) - Date.parse(second.start))
    .map((event) => ({ id: event.id, title: event.title }));

  return (
    <>
      <DemoConsole events={options} backend={store.backend} />
    </>
  );
}
