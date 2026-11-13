import { CurateFlow } from "@/components/curate/curate-flow";
import { SubPageHeader } from "@/components/ui/header";

// The first time someone with a Facebook account opens Events (User 3 in the
// demo, beat U3b): Muse curates their feed from what they already do.
export default function CuratePage() {
  return (
    <>
      <SubPageHeader title="Events" backHref="/" backLabel="Back to Events" />
      <CurateFlow />
    </>
  );
}
