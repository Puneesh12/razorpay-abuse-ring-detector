import type { GraphAccountNode, PolicyAction, SharedAttribute } from "@/types/api";

/**
 * Turns the flat account list from /api/graph into a genuine, semantic,
 * bipartite entity graph: Account <-> Device / IP / Payout / Address.
 *
 * Nothing here is invented. An entity node is only created when a real
 * attribute value is shared by 2+ accounts already present in the snapshot
 * — that's the actual definition of "shared", and it also keeps the graph
 * from being cluttered with a unique, meaningless device-node per account
 * that shares nothing with anyone.
 */

export type EntityType = "account" | "device" | "ip" | "payment" | "address";

export interface EntityNode {
  id: string;
  type: EntityType;
  label: string;
  account?: GraphAccountNode;
  degree: number; // for accounts: number of shared-entity connections
}

export interface EntityEdge {
  id: string;
  source: string;
  target: string;
  relation: SharedAttribute;
}

const ATTR_TO_TYPE: Record<SharedAttribute, EntityType> = {
  device_fingerprint: "device",
  ip_subnet: "ip",
  payout_account_hash: "payment",
  shipping_address_hash: "address",
};

const ATTR_LABEL: Record<SharedAttribute, string> = {
  device_fingerprint: "Device",
  ip_subnet: "IP",
  payout_account_hash: "Payout",
  shipping_address_hash: "Address",
};

export function attributeLabel(attr: SharedAttribute): string {
  return ATTR_LABEL[attr];
}

export function buildEntityGraph(accounts: GraphAccountNode[]): {
  nodes: EntityNode[];
  edges: EntityEdge[];
} {
  const nodes = new Map<string, EntityNode>();
  const edges: EntityEdge[] = [];
  const accountDegree = new Map<string, number>();

  for (const acct of accounts) {
    nodes.set(acct.id, { id: acct.id, type: "account", label: acct.id.slice(0, 8), account: acct, degree: 0 });
    accountDegree.set(acct.id, 0);
  }

  const attrGroups: Partial<Record<SharedAttribute, Map<string, string[]>>> = {};
  const ATTRS: SharedAttribute[] = ["device_fingerprint", "ip_subnet", "payout_account_hash", "shipping_address_hash"];

  for (const attr of ATTRS) {
    const groups = new Map<string, string[]>();
    for (const acct of accounts) {
      const value = acct[attr];
      if (!value) continue;
      const list = groups.get(value) ?? [];
      list.push(acct.id);
      groups.set(value, list);
    }
    attrGroups[attr] = groups;
  }

  for (const attr of ATTRS) {
    const groups = attrGroups[attr]!;
    for (const [value, accountIds] of groups) {
      if (accountIds.length < 2) continue; // not actually "shared"
      const entityId = `${attr}:${value}`;
      const type = ATTR_TO_TYPE[attr];
      nodes.set(entityId, { id: entityId, type, label: `${ATTR_LABEL[attr]} · ${value.slice(0, 6)}`, degree: accountIds.length });
      for (const accountId of accountIds) {
        edges.push({ id: `${entityId}::${accountId}`, source: accountId, target: entityId, relation: attr });
        accountDegree.set(accountId, (accountDegree.get(accountId) ?? 0) + 1);
      }
    }
  }

  for (const [id, deg] of accountDegree) {
    const n = nodes.get(id);
    if (n) n.degree = deg;
  }

  return { nodes: Array.from(nodes.values()), edges };
}

// ── Restrained, semantic color tokens for the graph ────────────────────────
export const ACTION_COLOR: Record<PolicyAction, string> = {
  priority_review: "#ef4444", // red — genuine risk only
  queue_for_review: "#eab308", // amber — standard review
  no_action: "#4ade80", // green — cleared
};

export const ENTITY_COLOR: Record<Exclude<EntityType, "account">, string> = {
  device: "#a1a1aa", // zinc-400
  ip: "#78716c", // stone-500
  payment: "#8a8a93",
  address: "#84776a",
};

export const ENTITY_LABEL: Record<EntityType, string> = {
  account: "Account",
  device: "Device",
  ip: "IP address",
  payment: "Payout instrument",
  address: "Shipping address",
};
