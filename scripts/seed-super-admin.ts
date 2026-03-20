/**
 * Seed script to create the super admin org + user.
 *
 * Usage:
 *   npx tsx scripts/seed-super-admin.ts
 *
 * Uses DATABASE_URL from .env.local (or set it explicitly).
 */

import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";
import * as readline from "readline";

const prisma = new PrismaClient();

function ask(question: string, hidden = false): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function main() {
  console.log("VeriBuy Super Admin Setup\n");

  const name = await ask("Admin name: ");
  const email = await ask("Admin email: ");
  const password = await ask("Admin password (min 8 chars): ");

  if (!name || !email || password.length < 8) {
    console.error("All fields required, password must be 8+ chars.");
    process.exit(1);
  }

  // Check if email exists
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`User ${email} already exists.`);

    // If they exist, just make them super admin
    const updated = await prisma.user.update({
      where: { email },
      data: { isSuperAdmin: true },
    });
    console.log(`Promoted ${updated.email} to super admin.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Create VeriBuy internal org
  let org = await prisma.organization.findFirst({
    where: { slug: "veribuy_internal" },
  });

  if (!org) {
    org = await prisma.organization.create({
      data: {
        name: "VeriBuy",
        slug: "veribuy_internal",
        type: "INDIVIDUAL",
        subscription: "ENTERPRISE",
        maxInspectionsPerMonth: 9999,
      },
    });
    console.log(`Created org: ${org.name} (${org.id})`);
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      passwordHash,
      role: "OWNER",
      orgId: org.id,
      isSuperAdmin: true,
    },
  });

  console.log(`\nSuper admin created:`);
  console.log(`  Name:  ${user.name}`);
  console.log(`  Email: ${user.email}`);
  console.log(`  Org:   ${org.name}`);
  console.log(`\nYou can now log in at /login and access /admin.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
