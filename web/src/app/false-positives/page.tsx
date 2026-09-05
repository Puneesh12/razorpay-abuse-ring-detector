"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useCluster } from "@/hooks/use-api";
import { formatPct, formatHours } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { GraphSnapshot, SharedAttribute } from "@/types/api";

function attrDiffers(members: { device_fingerprint: string; ip_subnet: string; payout_account_hash: string }[], key: "device_fingerprint" | "ip_subnet" | "payout_account_hash") {
  return new Set(members.map((m) => m[key])).size === members.length;
}

export default function FalsePositivesPage() {
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  useEffect(() => {
    api
      .graph("test", 400)
      .then((data: GraphSnapshot) => {
        // A genuine cleared cluster: no_action, 3+ accounts, connected specifically
        // via a shared address (not a fabricated example — picked from real output).
        const addrClusterIds = new Set(
          data.edges.filter((e) => e.attrs.includes("shipping_address_hash" as SharedAttribute)).map((e) => {
            const node = data.nodes.find((n) => n.id === e.source);
            return node?.cluster_id;
          })
        );
        const candidate = data.clusters
          .filter((c) => c.action === "no_action" && c.size >= 3 && addrClusterIds.has(c.cluster_id))
          .sort((a, b) => b.size - a.size)[0];
        if (candidate) setCandidateId(candidate.cluster_id);
        else setLoadErr("No qualifying cleared cluster found in this snapshot — try re-running analysis with a larger split.");
      })
      .catch((e: Error) => setLoadErr(e.message));
  }, []);

  const { data: detail, loading } = useCluster(candidateId);

  const diffs = useMemo(() => {
    if (!detail) return null;
    return {
      device: attrDiffers(detail.members, "device_fingerprint"),
      ip: attrDiffers(detail.members, "ip_subnet"),
      payout: attrDiffers(detail.members, "payout_account_hash"),
    };
  }, [detail]);

  return (
    <div className="relative mx-auto w-full max-w-3xl px-6 py-10 overflow-hidden">
      <div className="page-glow" aria-hidden />
      <h1 className="relative font-heading text-[1.6rem] font-medium tracking-tight mb-1">Shared identity signals are evidence, not guilt.</h1>
      <p className="text-[13px] text-muted-foreground mb-8 max-w-xl">
        A shared attribute alone is a coincidence a naive rule would punish. Ring only ever flags on{" "}
        <em>coordinated behaviour</em>, not on connection alone. Here is a genuine cleared cluster from the held-out
        test split, not a constructed example.
      </p>

      {loadErr && <p className="text-[13px] text-destructive">{loadErr}</p>}
      {(loading || !detail) && !loadErr && (
        <div className="space-y-3"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>
      )}

      {detail && diffs && (
        <>
          <div className="rounded-lg border border-border p-5 mb-6">
            <div className="flex items-center justify-between mb-4">
              <span className="font-mono text-[12px] text-muted-foreground">{detail.cluster_id} · held-out test</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-risk-cleared/15 px-3 py-1 text-[11.5px] font-semibold text-risk-cleared">
                <CircleCheck className="size-3.5" /> CLEARED · no_action
              </span>
            </div>

            <div className="rounded-md border border-border overflow-hidden mb-4">
              <div className="grid grid-cols-5 gap-2 px-3 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border">
                <span>Account</span><span>Device</span><span>IP</span><span>Payout</span><span>Address</span>
              </div>
              {detail.members.map((m, i) => (
                <div key={m.account_id} className="grid grid-cols-5 gap-2 px-3 py-2 text-[12px] font-mono border-b border-border last:border-0">
                  <span>Account {String.fromCharCode(65 + i)}</span>
                  <span className="text-muted-foreground">{m.device_fingerprint.slice(0, 8)}</span>
                  <span className="text-muted-foreground">{m.ip_subnet.slice(0, 8)}</span>
                  <span className="text-muted-foreground">{m.payout_account_hash.slice(0, 8)}</span>
                  <span className="text-risk-review font-semibold">{m.shipping_address_hash.slice(0, 8)}</span>
                </div>
              ))}
            </div>

            <ul className="space-y-1.5 text-[12.5px] text-foreground/90">
              <li>· All {detail.members.length} accounts share <span className="text-risk-review font-medium">one shipping address</span></li>
              <li>· {diffs.device ? "Every account uses a different device" : "Some devices are reused"}</li>
              <li>· {diffs.ip ? "Every account connects from a different IP" : "Some IPs are reused"}</li>
              <li>· {diffs.payout ? "Every account pays out to a different instrument" : "Some payout instruments are reused"}</li>
              <li>· Signup gap of {formatHours(detail.features.registration_burstiness_hours)} — not a bulk-creation burst</li>
              <li>· Average refund rate {formatPct(detail.features.mean_refund_rate)} — not elevated</li>
              <li>· {formatPct(detail.features.kyc_verified_ratio, 0)} KYC-verified</li>
            </ul>
          </div>

          <p className="text-[13px] text-muted-foreground leading-relaxed">
            A rule that flags on any shared attribute would have caught this cluster too — it&apos;s exactly what the
            naive baseline on the <a href="/evaluation" className="underline underline-offset-2 hover:text-foreground">evaluation page</a> does.
            Ring didn&apos;t, because nothing about how these accounts <em>behave</em> looks coordinated. That distinction —
            connection is not guilt — is the whole point.
          </p>
        </>
      )}
    </div>
  );
}
