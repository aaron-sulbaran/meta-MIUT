import { CurateFlow } from "@/components/curate/curate-flow";
import { SubPageHeader } from "@/components/ui/header";

// The first time someone with a Facebook account opens Events (User 3 in the
// demo, beat U3b): Muse curates their feed from what they already do.
// ?auto=1 (the /demo stage) starts it on arrival, with no tap.
export default async function CuratePage({ searchParams }: { searchParams: Promise<{ auto?: string }> }) {
  const { auto } = await searchParams;
  return (
    <>
      <SubPageHeader title="Events" backHref="/" backLabel="Back to Events" />
      <CurateFlow auto={auto === "1"} />
    </>
  );
}
