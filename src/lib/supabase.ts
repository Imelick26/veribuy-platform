import { createClient } from "@supabase/supabase-js";

/**
 * Server-side Supabase admin client.
 * Uses the service role key — NEVER expose this to the client.
 * Lazy-initialized so that import doesn't throw at build time.
 */
function createSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const globalForSupabase = globalThis as unknown as {
  supabaseAdmin: any;
};

/** Lazy getter — only creates client when first called at runtime, not at build. */
export function getSupabaseAdmin() {
  if (!globalForSupabase.supabaseAdmin) {
    globalForSupabase.supabaseAdmin = createSupabaseAdmin();
  }
  return globalForSupabase.supabaseAdmin;
}

/** @deprecated Use getSupabaseAdmin() instead — kept for existing call sites */
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createClient>, {
  get(_target, prop) {
    return (getSupabaseAdmin() as Record<string | symbol, unknown>)[prop];
  },
});

export const MEDIA_BUCKET = "veribuy-media";
