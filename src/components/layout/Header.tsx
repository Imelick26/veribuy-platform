"use client";

import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";
import { Menu } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;
  const toggle = useSidebarStore((s) => s.toggle);

  return (
    <header className="flex h-14 items-center justify-between bg-surface-raised px-3 md:px-5 border-b border-border-default">
      <button
        onClick={toggle}
        className="md:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="hidden md:block" />
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {user && (
          <>
            <Badge variant="default" className="hidden sm:inline-flex">
              {(user as Record<string, unknown>).orgName as string}
            </Badge>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full bg-surface-overlay border border-border-strong flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-medium text-text-secondary">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-sm hidden sm:block">
                <p className="font-medium text-text-primary">{user.name}</p>
                <p className="text-xs text-text-tertiary">{(user as Record<string, unknown>).role as string}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
