// Grey blocks shown the moment a page is tapped, while the server renders it.
export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden className="px-3 pt-[14px]">
      <div className="h-[38px] w-full rounded-full bg-wash" />
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="mt-[12px] h-[120px] w-full rounded-[14px] bg-wash" />
      ))}
    </div>
  );
}
