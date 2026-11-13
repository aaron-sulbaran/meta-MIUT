import { connection } from "next/server";
import { AskBar } from "@/components/ask/ask-bar";
import { SubPageHeader } from "@/components/ui/header";
import { getEventStore } from "@/lib/events/store";

export default async function AskPage() {
  await connection();
  const events = await getEventStore().listEvents();
  const now = new Date();
  return (
    <>
      <SubPageHeader title="Ask Muse" backHref="/" backLabel="Back to Events" />
      <AskBar events={events} nowIso={now.toISOString()} docked="screen" />
    </>
  );
}
