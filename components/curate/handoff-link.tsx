"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { handOff } from "@/lib/demo/staged";

/** A link that also tells the /demo stage it moved on (lib/demo/staged.ts handOff), so the stage follows without a reload. */
export function HandoffLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      className={className}
      onClick={(click) => {
        if (click.metaKey || click.ctrlKey || click.shiftKey) return;
        click.preventDefault();
        handOff(href, router.push);
      }}
    >
      {children}
    </Link>
  );
}
