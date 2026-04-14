import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      image?: string;
      role: "OWNER" | "MANAGER" | "INSPECTOR" | "VIEWER";
      orgId: string;
      orgName: string;
      orgSlug: string;
      orgLogo?: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    orgId?: string;
    orgName?: string;
    orgSlug?: string;
    orgLogo?: string;
  }
}
