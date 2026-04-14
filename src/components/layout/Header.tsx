"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";
import { Menu, LogOut } from "lucide-react";
import { useSidebarStore } from "@/stores/sidebar-store";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;
  const toggle = useSidebarStore((s) => s.toggle);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!showUserMenu) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showUserMenu]);

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
            {(user as Record<string, unknown>).orgLogo ? (
              <div className="hidden sm:flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(user as Record<string, unknown>).orgLogo as string}
                  alt={(user as Record<string, unknown>).orgName as string}
                  className="h-7 max-w-[120px] object-contain"
                />
              </div>
            ) : (
              <Badge variant="default" className="hidden sm:inline-flex">
                {(user as Record<string, unknown>).orgName as string}
              </Badge>
            )}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="flex items-center gap-2 cursor-pointer"
              >
                <div className="h-7 w-7 rounded-full bg-surface-overlay border border-border-strong flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-text-secondary">
                    {user.name?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="text-sm hidden sm:block text-left">
                  <p className="font-medium text-text-primary">{user.name}</p>
                  <p className="text-xs text-text-tertiary">{(user as Record<string, unknown>).role as string}</p>
                </div>
              </button>

              {/* User dropdown menu */}
              {showUserMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-lg border border-border-default bg-surface-raised shadow-lg z-50 py-1">
                  <button
                    onClick={() => { setShowUserMenu(false); signOut({ callbackUrl: "/login" }); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-surface-hover hover:text-red-600 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
