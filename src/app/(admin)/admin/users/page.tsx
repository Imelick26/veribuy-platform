"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Users, Search, Key } from "lucide-react";
import { trpc } from "@/lib/trpc";

const roleVariant: Record<string, "danger" | "gradient" | "info" | "success" | "default"> = {
  SUPER_ADMIN: "danger",
  OWNER: "gradient",
  MANAGER: "info",
  INSPECTOR: "success",
  VIEWER: "default",
};

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tempPwResult, setTempPwResult] = useState<{ userId: string; password: string } | null>(null);

  const resetPassword = trpc.admin.setTempPassword.useMutation({
    onSuccess: (result, variables) => {
      setTempPwResult({ userId: variables.id, password: result.tempPassword });
    },
  });

  const { data, isLoading } = trpc.admin.listUsers.useQuery({
    search: search || undefined,
    role: (roleFilter as "SUPER_ADMIN" | "OWNER" | "MANAGER" | "INSPECTOR" | "VIEWER") || undefined,
    limit: 50,
  });

  const handleResetPassword = (userId: string, userName: string) => {
    if (!confirm(`Reset password for ${userName}? A temporary password will be generated.`)) return;
    resetPassword.mutate({ id: userId });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Users</h1>
        <p className="text-text-secondary mt-1">Manage all platform users across organizations</p>
      </div>

      {/* Temp password notification */}
      {tempPwResult && (
        <Card className="border-caution-300 bg-caution-50">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-caution-700">Temporary Password Generated</p>
              <p className="text-sm text-caution-600 mt-1">
                Password: <code className="bg-caution-100 px-2 py-0.5 rounded font-mono text-sm">{tempPwResult.password}</code>
              </p>
              <p className="text-xs text-caution-500 mt-1">Copy and share this with the user. It will not be shown again.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setTempPwResult(null)}>Dismiss</Button>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="block w-full rounded-lg border border-border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-surface-base transition-colors"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-surface-base transition-colors"
        >
          <option value="">All Roles</option>
          <option value="SUPER_ADMIN">Super Admin</option>
          <option value="OWNER">Owner</option>
          <option value="MANAGER">Manager</option>
          <option value="INSPECTOR">Inspector</option>
          <option value="VIEWER">Viewer</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="spinner-gradient" /></div>
        ) : !data?.users.length ? (
          <div className="text-center py-8">
            <Users className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-secondary">No users found</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-text-secondary">
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-5 py-2.5 font-medium">Organization</th>
                  <th className="px-5 py-2.5 font-medium">Role</th>
                  <th className="px-5 py-2.5 font-medium text-center">Inspections</th>
                  <th className="px-5 py-2.5 font-medium">Last Login</th>
                  <th className="px-5 py-2.5 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => (
                  <tr key={user.id} className="border-b border-border-default hover:bg-surface-hover transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-surface-overlay border border-border-strong flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-medium text-text-secondary">
                            {user.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary">{user.name}</p>
                          <p className="text-xs text-text-tertiary">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/admin/dealers/${user.org.id}`} className="text-text-secondary hover:text-brand-600 transition-colors">
                        {user.org.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={roleVariant[user.role] || "default"}>{user.role}</Badge>
                    </td>
                    <td className="px-5 py-3 text-center text-text-secondary">{user._count.inspections}</td>
                    <td className="px-5 py-3 text-text-tertiary text-xs">
                      {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : "Never"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleResetPassword(user.id, user.name)}
                          title="Reset Password"
                        >
                          <Key className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
