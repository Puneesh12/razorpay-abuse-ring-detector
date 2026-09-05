"use client";

import { useEffect, useRef, useState } from "react";
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
  const [scrolled, setScrolled] = useState(false);

  // The landing nav is transparent so it floats over the hero photo, but
  // once you scroll past the hero there's nothing behind it -- whatever
  // content is underneath (stats, cards) shows straight through and
  // overlaps the nav text. Give it a solid backing past a small threshold.
  useEffect(() => {
    if (!isLanding) return;
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isLanding]);

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
    <header
      className={cn(
        "sticky top-0 z-40 transition-colors duration-300",
        isLanding
          ? scrolled
            ? "bg-background/45 backdrop-blur-md border-b border-white/10"
            : "animate-slide-down bg-transparent border-b border-transparent"
          : "border-b border-border bg-background/95 backdrop-blur supports-backdrop-blur:bg-background/80"
      )}
    >
      <div className={cn("mx-auto flex max-w-[1440px] items-center px-6", isLanding ? "h-20 gap-10" : "h-14 gap-6")}>
        {isLanding ? (
          <Link href="/" className="flex items-center gap-3 shrink-0">
            <img src={api.assetUrl("/assets/razorpay-icon.png")} alt="" width={26} height={26} className="object-contain" />
            <div className="flex flex-col leading-none">
              <span className="text-foreground text-xs font-semibold uppercase" style={{ letterSpacing: "0.2em" }}>
                Ring
              </span>
              <span className="text-brand text-[10px] font-medium tracking-widest uppercase mt-0.5" style={{ opacity: 0.85 }}>
                by Razorpay
              </span>
            </div>
          </Link>
        ) : (
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img src={api.assetUrl("/assets/razorpay-icon.png")} alt="" width={18} height={18} className="rounded" />
            <span className="font-semibold tracking-tight text-foreground text-sm">Razorpay</span>
            <span className="w-px bg-border h-4" />
            <span className="font-semibold tracking-tight text-brand text-sm">Ring</span>
          </Link>
        )}

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
            "inline-flex items-center transition-all duration-200",
            isLanding
              ? "gap-2 rounded-full border border-white/10 bg-white/10 px-5 py-2.5 text-[13px] font-medium text-foreground backdrop-blur-sm hover:bg-white/[0.15]"
              : "rounded-full border border-border px-4 py-1.5 text-[12px] font-semibold uppercase tracking-wider text-foreground hover:border-brand hover:text-brand"
          )}
        >
          Demo
        </Link>
      </div>
    </header>
  );
}
