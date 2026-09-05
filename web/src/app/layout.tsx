import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { TopNav } from "@/components/navigation/top-nav";
import { SiteFooter } from "@/components/navigation/site-footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// A serif display face for headings only -- body copy and the dense
// investigation UI stay on Geist for legibility. Gives the hero and page
// titles more editorial weight without touching data density anywhere else.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal"],
});

export const metadata: Metadata = {
  title: "Ring — AI Risk Intelligence",
  description: "Find the network behind the risk. Independent build for the Razorpay AI Buildathon, Track 2.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider delay={150}>
          <TopNav />
          <main className="flex-1 flex flex-col">{children}</main>
          <SiteFooter />
        </TooltipProvider>
      </body>
    </html>
  );
}
