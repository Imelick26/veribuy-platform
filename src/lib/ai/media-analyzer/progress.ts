/**
 * Analysis Progress — callback-based.
 *
 * On Vercel each serverless function has its own process, so an in-memory
 * Map between the pipeline mutation and the progress-polling query does
 * not share state. Instead the pipeline accepts an async callback and the
 * caller (inspection.ts) is responsible for persisting progress to the DB
 * where the polling query can read it back.
 */

export interface AnalysisProgressData {
  /** 0-100 */
  percent: number;
  /** Short stage label shown to the user, e.g. "Inspecting 21 photos…" */
  stage: string;
  /** Optional detail line, e.g. "14 of 21 photos analyzed" */
  detail: string;
  /** Epoch ms of last update */
  updatedAt: number;
  /** Epoch ms when this analysis started */
  startedAt: number;
}

/**
 * Called by the pipeline as progress advances. May be async (writes to DB
 * or Redis) or sync (in-memory). Errors from the emitter are swallowed so
 * a persistence failure never breaks the pipeline itself.
 */
export type ProgressEmitter = (progress: AnalysisProgressData) => void | Promise<void>;

/** No-op emitter for contexts that don't need progress tracking (eg scripts). */
export const noopEmitter: ProgressEmitter = () => {};

/**
 * Helper: wrap an emitter so it never throws.
 * Logs failures but does not propagate.
 */
export function safeEmitter(emit: ProgressEmitter): ProgressEmitter {
  return async (progress) => {
    try {
      await emit(progress);
    } catch (err) {
      console.warn(
        `[progress] emitter failed at ${progress.percent}% (${progress.stage}): ${err instanceof Error ? err.message : err}`,
      );
    }
  };
}
