"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

const APP_LINKS = [
  { href: "/investigate", label: "Investigation" },
  { href: "/investigations", label: "Cases" },
  { href: "/evaluation", label: "Evaluation" },
  { href: "/false-positives", label: "Why not flagged" },
];

// The landing page has its own nav in the reference design: anchors into
// the page's own sections, not links to other app routes. The rest of the
// app (investigate/cases/evaluation/etc.) needs real navigation between
// pages instead, so the two variants intentionally differ.
const LANDING_LINKS = [
  { href: "#problem", label: "Problem" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#evidence", label: "Evidence" },
  { href: "#trust", label: "Trust" },
];

export function TopNav() {
  const pathname = usePathname();
  const isLanding = pathname === "/";
  const links = isLanding ? LANDING_LINKS : APP_LINKS;
  const navRef = useRef<HTMLElement>(null);
  const pillRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isLanding) return; // anchor links don't have a persistent "active" route
    const nav = navRef.current;
    const pill = pillRef.current;
    if (!nav || !pill) return;
    const active = nav.querySelector<HTMLElement>("[data-active='true']");
    if (!active) {
      gsap.to(pill, { opacity: 0, duration: 0.15 });
      return;
    }
    gsap.to(pill, {
      opacity: 1,
      x: active.offsetLeft,
      width: active.offsetWidth,
      duration: 0.35,
      ease: "power3.out",
    });
  }, [pathname, isLanding]);

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/80">
      <div className={cn("mx-auto flex max-w-[1440px] items-center px-6", isLanding ? "h-20 gap-10" : "h-14 gap-6")}>
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <img
            src={api.assetUrl("/assets/razorpay-icon.png")}
            alt=""
            width={isLanding ? 22 : 18}
            height={isLanding ? 22 : 18}
            className="rounded"
          />
          <span className={cn("font-semibold tracking-tight text-foreground", isLanding ? "text-lg" : "text-sm")}>Razorpay</span>
          <span className={cn("w-px bg-border", isLanding ? "h-5" : "h-4")} />
          <span className={cn("font-semibold tracking-tight text-brand", isLanding ? "text-lg" : "text-sm")}>Ring</span>
        </Link>

        <nav ref={navRef} className={cn("relative flex items-center flex-1", isLanding ? "gap-8" : "gap-1")}>
          {!isLanding && (
            <div ref={pillRef} className="absolute left-0 top-0 h-full rounded-md bg-secondary opacity-0" style={{ willChange: "transform, width" }} />
          )}
          {links.map((l) => {
            const active = !isLanding && (pathname === l.href || pathname?.startsWith(l.href + "/"));
            const className = cn(
              "relative z-10 transition-colors",
              isLanding
                ? "text-[15px] font-medium text-foreground/90 hover:text-foreground"
                : "px-3 py-1.5 rounded-md text-[13px] font-medium",
              !isLanding && (active ? "text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary/40")
            );
            // next/link intercepts hash-only hrefs for client routing and
            // doesn't perform the native scroll-into-view -- a real <a> is
            // what actually jumps to the section for these in-page anchors.
            if (l.href.startsWith("#")) {
              return (
                <a key={l.href} href={l.href} className={className}>
                  {l.label}
                </a>
              );
            }
            return (
              <Link key={l.href} href={l.href} data-active={active} className={className}>
                {l.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/investigate"
          className={cn(
            "inline-flex items-center rounded-full border border-border font-semibold uppercase tracking-wider text-foreground transition-colors hover:border-brand hover:text-brand",
            isLanding ? "px-5 py-2 text-[13px]" : "px-4 py-1.5 text-[12px]"
          )}
        >
          Demo
        </Link>
      </div>
    </header>
  );
}
