import { ACTION_COLOR, ENTITY_COLOR, ENTITY_LABEL } from "@/lib/entity-graph";
import { ACTION_LABEL } from "@/lib/format";

export function GraphLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-muted-foreground">
      <span className="font-medium text-foreground/70">Accounts</span>
      {(["priority_review", "queue_for_review", "no_action"] as const).map((a) => (
        <span key={a} className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: ACTION_COLOR[a] }} />
          {ACTION_LABEL[a]}
        </span>
      ))}
      <span className="w-px h-3 bg-border" />
      <span className="font-medium text-foreground/70">Entities</span>
      {(Object.keys(ENTITY_COLOR) as (keyof typeof ENTITY_COLOR)[]).map((t) => (
        <span key={t} className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-sm" style={{ backgroundColor: ENTITY_COLOR[t] }} />
          {ENTITY_LABEL[t]}
        </span>
      ))}
    </div>
  );
}
