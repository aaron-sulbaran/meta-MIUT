import type { ReactNode } from "react";
import { SubPageHeader } from "@/components/ui/header";

// Shell only: the shared sub-page header. The organizer lane owns the page.
export default function OrganizerLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SubPageHeader title="Create event" backHref="/" backLabel="Back to Events" />
      {children}
    </>
  );
}
