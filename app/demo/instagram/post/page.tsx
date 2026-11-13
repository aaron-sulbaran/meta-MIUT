import { connection } from "next/server";
import { InstagramNewPost } from "@/components/demo/instagram-new-post";
import { STORY_POST, flyerUrl, storyCaption } from "@/lib/demo/staged";

// Demo beats O1 and O2, staged: the organizer's Instagram "new post" with the
// story flyer, then the prompt to post it to Facebook Events. ?at=<ISO> pins
// the demo clock so the flyer, the caption, and the event agree.
export default async function StagedInstagramPostPage({ searchParams }: { searchParams: Promise<{ at?: string }> }) {
  await connection();
  const { at } = await searchParams;
  const now = at && Number.isFinite(Date.parse(at)) ? new Date(at) : new Date();
  return (
    <InstagramNewPost
      handle={STORY_POST.organizer.handle}
      organizerName={STORY_POST.organizer.name}
      caption={storyCaption(now)}
      flyerSrc={flyerUrl(now)}
      atIso={at && Number.isFinite(Date.parse(at)) ? now.toISOString() : null}
    />
  );
}
