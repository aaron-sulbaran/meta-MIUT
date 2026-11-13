import { SubPageHeader } from "@/components/ui/header";

// Where every icon this demo has no screen for leads: a pointer to the real app.

export const metadata = { title: "Get Facebook" };

const FOR: Record<string, string> = {
  video: "For the real Reels:",
  marketplace: "For the real Marketplace:",
  notifications: "For real notifications:",
  messenger: "For the real Messenger:",
  profile: "For your real profile:",
  post: "To make a real post:",
  comment: "To leave a real comment:",
  share: "To really share it:",
};

export default async function GetFacebookPage({ searchParams }: { searchParams: Promise<{ from?: string; name?: string }> }) {
  const { from, name } = await searchParams;
  const person = from === "person" && typeof name === "string" ? name.trim().slice(0, 40) : "";
  const line = person ? `To view ${person}'s profile:` : (from && FOR[from]) || "For the real thing:";

  return (
    <>
      <SubPageHeader title="Facebook" backHref="/home" backLabel="Back" previousBack />
      <div className="flex flex-col items-center px-[28px] pt-[72px] text-center">
        <span className="font-display text-[44px] leading-[52px] font-extrabold tracking-[-0.05em] text-primary">facebook</span>
        <h2 className="mt-[18px] font-display text-[20px] font-bold">We can&apos;t code all of Facebook in 36 hours</h2>
        <p className="mt-[10px] text-body text-muted">{line}</p>
        <a
          href="https://www.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-[16px] flex h-[44px] w-full items-center justify-center rounded-button bg-primary font-display text-label font-bold text-on-primary"
        >
          Download Facebook
        </a>
      </div>
    </>
  );
}
