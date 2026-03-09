"use client";

import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/Badge";

export function Header() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div />
      <div className="flex items-center gap-4">
        {user && (
          <>
            <Badge variant="info">
              {(user as Record<string, unknown>).orgName as string}
            </Badge>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                <span className="text-sm font-semibold text-blue-700">
                  {user.name?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="text-sm">
                <p className="font-medium text-gray-900">{user.name}</p>
                <p className="text-xs text-gray-500">{(user as Record<string, unknown>).role as string}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </header>
  );
}
