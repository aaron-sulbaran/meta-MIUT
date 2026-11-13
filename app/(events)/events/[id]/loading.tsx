import { SubPageHeader } from "@/components/ui/header";

// Shown the moment an event is tapped, while the server renders it.
export default function EventLoading() {
  return (
    <>
      <SubPageHeader title="Event" backHref="/" backLabel="Back to Events" />
      <div aria-hidden className="aspect-[2/1] w-full bg-wash" />
      <div aria-hidden className="px-3 pt-[14px]">
        <div className="h-[12px] w-[40%] rounded-full bg-wash" />
        <div className="mt-[8px] h-[22px] w-[80%] rounded-full bg-wash" />
        <div className="mt-[8px] h-[12px] w-[60%] rounded-full bg-wash" />
        <div className="mt-[18px] h-[36px] w-full rounded-button bg-wash" />
      </div>
    </>
  );
}
