/**
 * notification_app_be/priority_inbox.ts — Stage 1
 *
 * Priority Inbox: fetches notifications from the API and returns
 * the top N most important using a Max-Heap.
 *
 * Priority Score = Type Weight + Recency
 *   Placement = 300  (highest)
 *   Result    = 200
 *   Event     = 100  (lowest)
 *
 * New notifications are inserted in O(log n) — no full re-sort needed.
 *
 * Usage:
 *   npx ts-node priority_inbox.ts        → top 10
 *   npx ts-node priority_inbox.ts 15     → top 15
 */

import { Log } from "./index";
import { authenticate, type Credentials } from "./auth";
import { credentials } from "./config";

// ─── Your Credentials (loaded from config.ts) ────────────────────────────────
const CREDENTIALS: Credentials = credentials;

const NOTIFICATIONS_URL = "http://4.224.186.213/evaluation-service/notifications";

// ─── Types ────────────────────────────────────────────────────────────────────

type NotifType = "Placement" | "Result" | "Event";

interface Notification {
  ID: string;
  Type: NotifType;
  Message: string;
  Timestamp: string;
}

interface ScoredNotification extends Notification {
  score: number;
}

// ─── Priority Configuration ───────────────────────────────────────────────────

const TYPE_WEIGHT: Record<NotifType, number> = {
  Placement: 300,
  Result:    200,
  Event:     100,
};

/**
 * Priority score = type weight + normalised recency.
 * Dividing epoch ms by 1e9 keeps recency in the 1700–1800 range
 * (same order of magnitude as weights) so both factors matter.
 */
function computeScore(n: Notification): number {
  return TYPE_WEIGHT[n.Type] + new Date(n.Timestamp).getTime() / 1e9;
}

// ─── Max-Heap (Priority Queue) ────────────────────────────────────────────────

class MaxHeap {
  private heap: ScoredNotification[] = [];

  get size(): number { return this.heap.length; }

  /** Insert in O(log n) */
  insert(item: ScoredNotification): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  /** Extract highest priority in O(log n) */
  extractMax(): ScoredNotification | null {
    if (!this.heap.length) return null;
    const max = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return max;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = Math.floor((i - 1) / 2);
      if (this.heap[parent].score >= this.heap[i].score) break;
      [this.heap[parent], this.heap[i]] = [this.heap[i], this.heap[parent]];
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      let largest = i;
      const l = 2 * i + 1, r = 2 * i + 2;
      if (l < n && this.heap[l].score > this.heap[largest].score) largest = l;
      if (r < n && this.heap[r].score > this.heap[largest].score) largest = r;
      if (largest === i) break;
      [this.heap[largest], this.heap[i]] = [this.heap[i], this.heap[largest]];
      i = largest;
    }
  }
}

// ─── Fetch Notifications ──────────────────────────────────────────────────────

async function fetchNotifications(token: string): Promise<Notification[]> {
  await Log("backend", "info", "service", `Fetching notifications from ${NOTIFICATIONS_URL}`);

  const res = await fetch(NOTIFICATIONS_URL, {
    headers: { "Authorization": `Bearer ${token}` },
  });

  if (!res.ok) {
    await Log("backend", "error", "service", `Notifications API returned HTTP ${res.status}`);
    throw new Error(`API Error: ${res.status}`);
  }

  const data: any = await res.json();
  const count = data.notifications?.length ?? 0;
  await Log("backend", "info", "service", `Received ${count} notifications from API`);
  return data.notifications as Notification[];
}

// ─── Compute Top N via Max-Heap ───────────────────────────────────────────────

async function getTopN(notifications: Notification[], n: number): Promise<ScoredNotification[]> {
  await Log("backend", "debug", "domain", `Building max-heap from ${notifications.length} notifications, topN=${n}`);

  const heap = new MaxHeap();

  // O(N log N) build
  for (const notif of notifications) {
    heap.insert({ ...notif, score: computeScore(notif) });
  }

  // Extract top N in O(n log N)
  const result: ScoredNotification[] = [];
  for (let i = 0; i < n && heap.size > 0; i++) {
    result.push(heap.extractMax()!);
  }

  await Log("backend", "info", "domain", `Top ${result.length} notifications ranked by priority`);
  return result;
}

// ─── Display Results ──────────────────────────────────────────────────────────

function display(notifications: ScoredNotification[], topN: number): void {
  const icons: Record<NotifType, string> = {
    Placement: "🏢", Result: "📊", Event: "🎉",
  };

  console.log("\n" + "═".repeat(72));
  console.log(`  🔔  PRIORITY INBOX  —  TOP ${topN} NOTIFICATIONS`);
  console.log("═".repeat(72));

  notifications.forEach((n, i) => {
    const rank = String(i + 1).padStart(2, "0");
    const type = n.Type.toUpperCase().padEnd(9);
    console.log(`\n  #${rank}  ${icons[n.Type]} [${type}]  Score: ${n.score.toFixed(4)}`);
    console.log(`       Message : ${n.Message}`);
    console.log(`       Time    : ${n.Timestamp}`);
    console.log(`       ID      : ${n.ID}`);
    console.log("  " + "─".repeat(68));
  });

  console.log("\n  Scoring: Placement(300) > Result(200) > Event(100) + recency");
  console.log("  New notifications are inserted in O(log n) via Max-Heap");
  console.log("═".repeat(72) + "\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const topN = parseInt(process.argv[2] ?? "10", 10) || 10;

  await Log("backend", "info", "controller", `Priority Inbox starting — topN=${topN}`);

  try {
    // 1. Authenticate → get Bearer token
    const token = await authenticate(CREDENTIALS);

    // 2. Fetch all notifications from API
    const notifications = await fetchNotifications(token);

    // 3. Rank using Max-Heap
    const top = await getTopN(notifications, topN);

    // 4. Display ranked results
    display(top, topN);

    await Log("backend", "info", "controller", `Priority Inbox complete — displayed ${top.length} notifications`);

  } catch (err) {
    await Log("backend", "fatal", "controller", `Unhandled error: ${String(err)}`);
    process.exit(1);
  }
}

main();
