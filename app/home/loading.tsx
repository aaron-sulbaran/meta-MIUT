// Shown the moment Home is tapped, while the server renders the feed.
export default function HomeLoading() {
  return (
    <div aria-hidden>
      <div className="h-[52px]" />
      <div className="flex items-center gap-[9px] px-[11.4px] pb-[14px] pt-[10px]">
        <div className="h-[39px] w-[39px] rounded-full bg-wash" />
        <div className="h-[38px] flex-1 rounded-full bg-wash" />
      </div>
      <div className="mx-3 mt-[10px] h-[220px] rounded-[14px] bg-wash" />
      <div className="mx-3 mt-[12px] h-[220px] rounded-[14px] bg-wash" />
    </div>
  );
}
