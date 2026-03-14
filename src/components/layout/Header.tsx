"use client";

import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex h-16 items-center justify-between bg-surface-raised px-6 relative">
      {/* Gradient bottom border */}
      <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-brand-600/40 to-transparent" />
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <>
            <Badge variant="gradient">
              {(user as Record<string, unknown>).orgName as string}
            </Badge>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-brand-gradient flex items-center justify-center shadow-sm">
                <span className="text-sm font-semibold text-white">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-sm">
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
