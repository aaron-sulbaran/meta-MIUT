import { connection } from "next/server";
import { AskBox } from "@/components/ask/ask-box";
import { getEventStore } from "@/lib/events/store";
import { RECORDED_QUESTION } from "@/lib/muse/fixtures/ask";

export default async function AskPage() {
  await connection();
  const events = await getEventStore().listEvents();
  return (
    <AskBox placeholder={RECORDED_QUESTION} eventTitles={events.map((event) => ({ id: event.id, title: event.title }))} />
  );
}
