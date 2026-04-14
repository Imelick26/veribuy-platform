import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const role = (session?.user as Record<string, unknown> | undefined)?.role;

  if (!session || role !== "SUPER_ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-surface-sunken">
      <header className="bg-surface-raised border-b border-border-default px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-text-primary text-lg">VeriBuy Admin</span>
          <span className="text-xs text-text-tertiary bg-surface-overlay px-2 py-0.5 rounded-full">Internal</span>
        </div>
        <a href="/dashboard" className="text-sm text-text-secondary hover:text-text-primary transition-colors">
          Back to Dashboard
        </a>
      </header>
      <AdminNav />
      <main className="max-w-5xl mx-auto p-6">{children}</main>
    </div>
  );
}
