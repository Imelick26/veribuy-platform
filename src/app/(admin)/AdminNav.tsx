"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { LayoutDashboard, Building2, Users, ClipboardCheck, ScrollText } from "lucide-react";

const tabs = [
  { name: "Overview", href: "/admin", icon: LayoutDashboard },
  { name: "Dealers", href: "/admin/dealers", icon: Building2 },
  { name: "Users", href: "/admin/users", icon: Users },
  { name: "Inspections", href: "/admin/inspections", icon: ClipboardCheck },
  { name: "Audit Logs", href: "/admin/audit-logs", icon: ScrollText },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="bg-surface-default border-b border-border-default px-6">
      <div className="max-w-6xl mx-auto flex gap-1">
        {tabs.map((tab) => {
          const isActive =
            tab.href === "/admin"
              ? pathname === "/admin"
              : pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.name}
              href={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
                isActive
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-text-secondary hover:text-text-primary hover:border-border-strong"
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.name}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
