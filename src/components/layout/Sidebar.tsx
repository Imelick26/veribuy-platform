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
} from "lucide-react";
import { signOut } from "next-auth/react";

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

  return (
    <aside className="flex h-screen w-64 flex-col bg-surface-raised border-r border-border-default">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 px-6 border-b border-border-default">
        <Image src="/logo.png" alt="VeriBuy" width={36} height={36} className="h-9 w-9" />
        <span className="text-xl font-bold text-brand-gradient">VeriBuy</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-brand-gradient-subtle text-brand-300 nav-accent-left"
                  : "text-text-secondary hover:bg-surface-hover hover:text-brand-300"
              )}
            >
              <item.icon className={cn("h-5 w-5 flex-shrink-0", isActive && "text-brand-400")} />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className="border-t border-border-default px-3 py-4">
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-text-secondary hover:bg-[#2e0a0a] hover:text-red-400 transition-all duration-200 cursor-pointer"
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
