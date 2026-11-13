import { SubPageHeader } from "@/components/ui/header";
import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function AskLoading() {
  return (
    <>
      <SubPageHeader title="Ask Muse" backHref="/" backLabel="Back to Events" />
      <PageSkeleton rows={2} />
    </>
  );
}
