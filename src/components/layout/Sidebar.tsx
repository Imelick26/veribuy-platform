"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Car,
  ClipboardCheck,
  FileText,
  Settings,
  Users,
  LogOut,
  Plus,
  Shield,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { UpgradeModal } from "@/components/billing/UpgradeModal";
import { useSidebarStore } from "@/stores/sidebar-store";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Inspections", href: "/dashboard/inspections", icon: ClipboardCheck },
  { name: "Vehicles", href: "/dashboard/vehicles", icon: Car },
  { name: "Reports", href: "/dashboard/reports", icon: FileText },
  { name: "Team", href: "/dashboard/settings/team", icon: Users },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isSuperAdmin = (session?.user as Record<string, unknown> | undefined)?.role === "SUPER_ADMIN";
  const { data: usage } = trpc.inspection.usageStats.useQuery();
  const atLimit = usage ? usage.used >= (usage.limit + usage.bonusInspections) : false;
  const [showLimitModal, setShowLimitModal] = useState(false);
  const router = useRouter();
  const { isOpen, close } = useSidebarStore();

  function handleNewInspection(e: React.MouseEvent) {
    close();
    if (atLimit) {
      e.preventDefault();
      setShowLimitModal(true);
    } else {
      router.push("/dashboard/inspections/new");
    }
  }

  return (
    <>
    {/* Backdrop overlay — mobile only */}
    {isOpen && (
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={close}
      />
    )}

    <aside
      className={cn(
        "flex h-screen w-64 flex-col bg-surface-raised border-r border-border-default",
        "fixed inset-y-0 left-0 z-50 transition-transform duration-200 md:static md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 px-5 border-b border-border-default">
        <Image src="/logo.png" alt="VeriBuy" width={28} height={28} className="h-7 w-7" />
        <span className="text-lg font-bold text-brand-gradient">VeriBuy</span>
      </div>

      {/* New Inspection CTA */}
      <div className="px-3 pt-3 pb-1">
        <button
          onClick={handleNewInspection}
          className="flex items-center justify-center gap-2 w-full rounded-lg bg-brand-gradient text-white text-sm font-medium py-2 shadow-brand-glow hover:brightness-110 transition-all cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          New Inspection
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-2 py-2">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              onClick={close}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-surface-hover text-text-primary"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              )}
            >
              <item.icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-text-secondary" : "text-text-tertiary")} />
              {item.name}
            </Link>
          );
        })}

        {/* Admin link — SUPER_ADMIN only */}
        {isSuperAdmin && (
          <>
            <div className="my-2 border-t border-border-default" />
            <Link
              href="/admin"
              onClick={close}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                pathname?.startsWith("/admin")
                  ? "bg-surface-hover text-text-primary"
                  : "text-text-secondary hover:bg-surface-hover hover:text-text-primary"
              )}
            >
              <Shield className={cn("h-4 w-4 flex-shrink-0", pathname?.startsWith("/admin") ? "text-text-secondary" : "text-text-tertiary")} />
              Admin
            </Link>
          </>
        )}
      </nav>

      {/* Sign out */}
      <div className="border-t border-border-default px-2 py-2">
        <button
          onClick={() => { close(); signOut({ callbackUrl: "/login" }); }}
          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-text-tertiary hover:text-red-600 transition-colors cursor-pointer"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>

    {usage && (
      <UpgradeModal
        open={showLimitModal}
        onClose={() => setShowLimitModal(false)}
        usage={usage}
      />
    )}
    </>
  );
}
