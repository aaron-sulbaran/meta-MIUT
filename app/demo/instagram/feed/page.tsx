import { connection } from "next/server";
import { InstagramFeed } from "@/components/demo/instagram-feed";
import { STORY_POST, flyerUrl, storyCaption } from "@/lib/demo/staged";

// Demo beat U3a, staged: User 3 scrolls an Instagram feed, a club they follow
// posted the event, and a prompt offers to open it in Facebook Events.
export default async function StagedInstagramFeedPage({ searchParams }: { searchParams: Promise<{ at?: string }> }) {
  await connection();
  const { at } = await searchParams;
  const now = at && Number.isFinite(Date.parse(at)) ? new Date(at) : new Date();
  return <InstagramFeed handle={STORY_POST.organizer.handle} caption={storyCaption(now)} flyerSrc={flyerUrl(now)} />;
}
