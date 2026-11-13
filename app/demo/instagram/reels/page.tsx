import { InstagramReels } from "@/components/demo/instagram-reels";

// Demo beats U3a1 to U3a4, staged: Trish scrolls Reels. ?reel=1..3 is the reel on
// screen, &sheet=1 opens the Facebook Events sheet over the third. The screen moves
// between them in place; these only set where a fresh load starts.
export default async function StagedInstagramReelsPage({ searchParams }: { searchParams: Promise<{ reel?: string; sheet?: string }> }) {
  const { reel, sheet } = await searchParams;
  const number = Number(reel);
  const startReel = Number.isInteger(number) && number >= 1 && number <= 3 ? number - 1 : 0;
  const startSheet = sheet === "1";
  return <InstagramReels startReel={startSheet ? 2 : startReel} startSheet={startSheet} />;
}
