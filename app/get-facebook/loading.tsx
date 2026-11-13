import { SubPageHeader } from "@/components/ui/header";

export default function GetFacebookLoading() {
  return (
    <>
      <SubPageHeader title="Facebook" backHref="/home" backLabel="Back" previousBack />
      <div aria-hidden className="flex flex-col items-center px-[28px] pt-[72px]">
        <div className="h-[44px] w-[180px] rounded-full bg-wash" />
        <div className="mt-[18px] h-[20px] w-[85%] rounded-full bg-wash" />
        <div className="mt-[26px] h-[44px] w-full rounded-button bg-wash" />
      </div>
    </>
  );
}
