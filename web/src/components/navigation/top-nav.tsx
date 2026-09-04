"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const LINKS = [
  { href: "/investigate", label: "Investigation" },
  { href: "/investigations", label: "Cases" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/false-positives", label: "Why not flagged" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/80">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-6 px-6">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img src={api.assetUrl("/assets/razorpay-icon.png")} alt="" width={20} height={20} className="rounded" />
          <span className="text-sm font-semibold tracking-tight text-foreground">RING</span>
          <span className="hidden sm:inline text-[11px] text-muted-foreground font-medium">AI Risk Intelligence</span>
        </Link>

        <nav className="flex items-center gap-1 flex-1">
          {LINKS.map((l) => {
            const active = pathname === l.href || pathname?.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors",
                  active
                    ? "bg-secondary text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                )}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>

        <span className="hidden md:inline text-[11px] text-muted-foreground">
          Independent build · Razorpay AI Buildathon · Track 2 · Not an official Razorpay product
        </span>
      </div>
    </header>
  );
}
