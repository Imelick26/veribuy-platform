import { z } from "zod/v4";
import { router, publicProcedure, protectedProcedure, managerProcedure } from "../init";
import bcrypt from "bcryptjs";
import { sendWelcomeEmail } from "@/lib/email";

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

  // List team members in the org
  teamMembers: protectedProcedure.query(async ({ ctx }) => {
    const members = await ctx.db.user.findMany({
      where: { orgId: ctx.orgId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatar: true,
        createdAt: true,
        _count: { select: { inspections: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    return members;
  }),

  // Remove a team member (owner/manager only)
  removeUser: managerProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (input.userId === ctx.userId) {
        throw new Error("You cannot remove yourself from the team");
      }
      const user = await ctx.db.user.findFirst({
        where: { id: input.userId, orgId: ctx.orgId },
      });
      if (!user) {
        throw new Error("User not found in your organization");
      }
      if (user.role === "OWNER") {
        throw new Error("Cannot remove the organization owner");
      }
      await ctx.db.user.delete({ where: { id: input.userId } });
      return { message: "User removed" };
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
      // Check for duplicate email
      const existingEmail = await ctx.db.user.findUnique({
        where: { email: input.email },
      });
      if (existingEmail) {
        throw new Error("A user with this email already exists");
      }

      const org = await ctx.db.organization.findUnique({
        where: { id: ctx.orgId },
        select: { name: true },
      });

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

      // Send welcome email with credentials (fire-and-forget)
      sendWelcomeEmail({
        to: input.email,
        name: input.name,
        orgName: org?.name || "your organization",
        tempPassword,
      }).catch((err) => console.error("Failed to send welcome email:", err));

      return { userId: user.id, message: "User invited" };
    }),

  // Change password
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: ctx.userId },
        select: { passwordHash: true },
      });
      if (!user?.passwordHash) {
        throw new Error("No password set for this account");
      }
      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) {
        throw new Error("Current password is incorrect");
      }
      const newHash = await bcrypt.hash(input.newPassword, 12);
      await ctx.db.user.update({
        where: { id: ctx.userId },
        data: { passwordHash: newHash },
      });
      return { message: "Password changed successfully" };
    }),
});
