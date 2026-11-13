"use client";

// Open to company, as a switch: the one control for it on the event page and on
// an invite's event (components/invite/invite-landing.tsx).

export const COMPANY_LINE = "Let other students going say hi. They see your first name and the interests you share.";

export function CompanyToggle({ on, disabled = false, onChange }: { on: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className="mt-[12px] flex w-full items-center gap-[12px] text-left"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-body font-semibold">Open to company</span>
        <span className="block text-meta leading-[16px] text-muted">{COMPANY_LINE}</span>
      </span>
      <span aria-hidden className={`relative h-[30px] w-[50px] shrink-0 rounded-full transition-colors duration-200 ${on ? "bg-primary" : "bg-[#d8dadf]"}`}>
        <span
          className={`absolute top-[3px] left-[3px] h-[24px] w-[24px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)] transition-transform duration-200 motion-reduce:transition-none ${on ? "translate-x-[20px]" : ""}`}
        />
      </span>
    </button>
  );
}
