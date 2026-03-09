import { z } from "zod/v4";
import { router, publicProcedure, protectedProcedure, managerProcedure } from "../init";
import bcrypt from "bcryptjs";

export const authRouter = router({
  // Register a new user + organization
  register: publicProcedure
    .input(
      z.object({
        email: z.email(),
        password: z.string().min(8, "Password must be at least 8 characters"),
        name: z.string().min(1),
        orgName: z.string().min(1),
        orgType: z.enum(["DEALER", "INSPECTOR_FIRM", "INSURANCE", "INDIVIDUAL"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if email already exists
      const existing = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (existing) {
        throw new Error("Email already registered");
      }

      // Create slug from org name
      const slug = input.orgName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");

      const passwordHash = await bcrypt.hash(input.password, 12);

      // Create org + user in a transaction
      const result = await ctx.db.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: input.orgName,
            slug,
            type: input.orgType,
          },
        });

        const user = await tx.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash,
            role: "OWNER",
            orgId: org.id,
          },
        });

        return { user, org };
      });

      return {
        userId: result.user.id,
        orgId: result.org.id,
        message: "Registration successful",
      };
    }),

  // Get current session info
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.userId },
      include: { org: true },
    });
    if (!user) throw new Error("User not found");
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      avatar: user.avatar,
      org: {
        id: user.org.id,
        name: user.org.name,
        slug: user.org.slug,
        type: user.org.type,
        subscription: user.org.subscription,
      },
    };
  }),

  // Invite a team member
  inviteUser: managerProcedure
    .input(
      z.object({
        email: z.email(),
        name: z.string().min(1),
        role: z.enum(["MANAGER", "INSPECTOR", "VIEWER"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tempPassword = Math.random().toString(36).slice(-12);
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          name: input.name,
          passwordHash,
          role: input.role,
          orgId: ctx.orgId,
        },
      });

      // TODO: Send invitation email via Resend with temp password

      return { userId: user.id, message: "User invited" };
    }),
});
