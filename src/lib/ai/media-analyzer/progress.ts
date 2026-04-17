/**
 * Analysis Progress Store
 *
 * In-memory per-inspection progress tracking for the AI media analysis pipeline.
 * The pipeline emits updates; a tRPC query polls the store from the client.
 *
 * Process-local (Map), suitable for VeriBuy's single-server deployment.
 * If the app ever runs on multiple instances, swap this for Redis.
 */

export interface AnalysisProgress {
  /** 0-100 */
  percent: number;
  /** Short stage label shown to the user, e.g. "Inspecting 21 photos…" */
  stage: string;
  /** Optional detail line, e.g. "14 of 21 photos analyzed" */
  detail: string;
  /** Epoch ms of last update (used to purge stale entries) */
  updatedAt: number;
  /** Epoch ms when this analysis started */
  startedAt: number;
}

const store = new Map<string, AnalysisProgress>();

// Purge entries older than 15 minutes — they're either done or the client disconnected.
const STALE_MS = 15 * 60 * 1000;

function prune() {
  const now = Date.now();
  for (const [id, p] of store.entries()) {
    if (now - p.updatedAt > STALE_MS) store.delete(id);
  }
}

export function startProgress(inspectionId: string, stage = "Starting analysis…"): void {
  const now = Date.now();
  store.set(inspectionId, {
    percent: 0,
    stage,
    detail: "",
    updatedAt: now,
    startedAt: now,
  });
  prune();
}

export function updateProgress(
  inspectionId: string,
  percent: number,
  stage?: string,
  detail?: string,
): void {
  const existing = store.get(inspectionId);
  if (!existing) {
    // Caller forgot to call startProgress — create one implicitly
    const now = Date.now();
    store.set(inspectionId, {
      percent: Math.max(0, Math.min(100, percent)),
      stage: stage ?? "Analyzing…",
      detail: detail ?? "",
      updatedAt: now,
      startedAt: now,
    });
    return;
  }
  existing.percent = Math.max(existing.percent, Math.max(0, Math.min(100, percent)));
  if (stage !== undefined) existing.stage = stage;
  if (detail !== undefined) existing.detail = detail;
  existing.updatedAt = Date.now();
}

export function finishProgress(inspectionId: string): void {
  const existing = store.get(inspectionId);
  if (existing) {
    existing.percent = 100;
    existing.stage = "Analysis complete";
    existing.detail = "";
    existing.updatedAt = Date.now();
  }
  // Leave the 100% entry in the store briefly so a final poll sees completion,
  // then prune on the next call.
}

export function getProgress(inspectionId: string): AnalysisProgress | null {
  return store.get(inspectionId) ?? null;
}

export function clearProgress(inspectionId: string): void {
  store.delete(inspectionId);
}
