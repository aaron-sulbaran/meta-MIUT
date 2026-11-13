import { SubPageHeader } from "@/components/ui/header";

// Where every icon this demo has no screen for leads: a pointer to the real app.

export const metadata = { title: "Get Facebook" };

export default function GetFacebookPage() {
  return (
    <>
      <SubPageHeader title="Facebook" backHref="/home" backLabel="Back to Home" />
      <div className="flex flex-col items-center px-[28px] pt-[72px] text-center">
        <span className="font-display text-[44px] leading-[52px] font-extrabold tracking-[-0.05em] text-primary">facebook</span>
        <h2 className="mt-[18px] font-display text-[20px] font-bold">Get the real Facebook</h2>
        <p className="mt-[8px] text-body text-muted">
          This part is not in the demo. Download the Facebook app for Messenger, Video, Marketplace, notifications and your profile.
        </p>
        <a
          href="https://www.facebook.com"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-[24px] flex h-[44px] w-full items-center justify-center rounded-button bg-primary font-display text-label font-bold text-on-primary"
        >
          Download Facebook
        </a>
      </div>
    </>
  );
}
