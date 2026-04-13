import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/server/db";
import bcrypt from "bcryptjs";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(db) as never,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.password) return null;

          const user = await db.user.findUnique({
            where: { email: (credentials.email as string).toLowerCase() },
            include: { org: true },
          });

          if (!user || !user.passwordHash) return null;

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) return null;

          // Update last login
          await db.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatar,
          };
        } catch (err) {
          console.error("[auth] authorize error:", err);
          throw err;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const dbUser = await db.user.findUnique({
          where: { id: user.id },
          include: { org: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.orgId = dbUser.orgId;
          token.orgName = dbUser.org.name;
          token.orgSlug = dbUser.org.slug;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = session.user as any;
        user.role = token.role;
        user.orgId = token.orgId;
        user.orgName = token.orgName;
        user.orgSlug = token.orgSlug;
      }
      return session;
    },
  },
});
