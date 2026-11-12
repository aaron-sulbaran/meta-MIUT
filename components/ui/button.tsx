import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentType, ReactNode } from "react";

// Facebook's flat buttons: grey secondary, blue primary, blue-tint soft.
// 6 px radius, bold label, icon left of the label.

export type ButtonTone = "secondary" | "primary" | "soft";

const tones: Record<ButtonTone, string> = {
  secondary: "bg-button text-ink",
  primary: "bg-primary text-on-primary",
  soft: "bg-primary-soft text-link",
};

export function buttonClass(tone: ButtonTone = "secondary", extra = "") {
  return `flex h-[35px] items-center justify-center gap-[7px] rounded-button px-3 font-display text-label font-bold select-none transition-colors duration-150 disabled:opacity-60 ${tones[tone]} ${extra}`;
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: ButtonTone;
  Icon?: ComponentType<{ className?: string }>;
  children?: ReactNode;
};

export function Button({ tone = "secondary", Icon, children, className = "", type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(tone, className)} {...rest}>
      {Icon && <Icon className="h-[17px] w-[17px] shrink-0" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  tone = "secondary",
  Icon,
  children,
  className = "",
}: {
  href: string;
  tone?: ButtonTone;
  Icon?: ComponentType<{ className?: string }>;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={buttonClass(tone, className)}>
      {Icon && <Icon className="h-[17px] w-[17px] shrink-0" />}
      {children}
    </Link>
  );
}
