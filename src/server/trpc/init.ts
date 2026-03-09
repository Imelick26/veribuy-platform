import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { auth } from "@/lib/auth";
import { db } from "@/server/db";

export async function createTRPCContext() {
  const session = await auth();

  return {
    db,
    session,
    userId: session?.user?.id,
    orgId: (session?.user as Record<string, unknown>)?.orgId as string | undefined,
  };
}

export type TRPCContext = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<TRPCContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

// Middleware: require authenticated user
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id,
      orgId: (ctx.session.user as Record<string, unknown>).orgId as string,
    },
  });
});

export const protectedProcedure = t.procedure.use(enforceAuth);

// Middleware: require org owner or manager
const enforceManager = t.middleware(async ({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  const role = (ctx.session.user as Record<string, unknown>).role;
  if (role !== "OWNER" && role !== "MANAGER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Manager or owner access required" });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
      userId: ctx.session.user.id,
      orgId: (ctx.session.user as Record<string, unknown>).orgId as string,
    },
  });
});

export const managerProcedure = t.procedure.use(enforceManager);
