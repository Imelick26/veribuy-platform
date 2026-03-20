import type { NextAuthConfig } from "next-auth";

/**
 * Edge-compatible auth config — used by middleware for JWT validation.
 * No Prisma, bcrypt, or Node.js-only imports allowed here.
 * The full config in auth.ts extends this with database adapter and providers.
 */
export const authConfig = {
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [], // No providers needed — middleware only validates JWTs
} satisfies NextAuthConfig;
