"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Users, UserPlus, Mail, Shield, Trash2 } from "lucide-react";

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  INSPECTOR: "Inspector",
  VIEWER: "Viewer",
};

const roleBadgeVariant: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  OWNER: "info",
  MANAGER: "success",
  INSPECTOR: "default",
  VIEWER: "warning",
};

export default function TeamPage() {
  const { data: members, isLoading, refetch } = trpc.auth.teamMembers.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const inviteMutation = trpc.auth.inviteUser.useMutation({
    onSuccess: () => {
      refetch();
      setShowInvite(false);
      setInviteForm({ name: "", email: "", role: "INSPECTOR" });
    },
  });
  const removeMutation = trpc.auth.removeUser.useMutation({
    onSuccess: () => refetch(),
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    name: "",
    email: "",
    role: "INSPECTOR" as "MANAGER" | "INSPECTOR" | "VIEWER",
  });

  const isManager = me?.role === "OWNER" || me?.role === "MANAGER";

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    inviteMutation.mutate(inviteForm);
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-500 mt-1">Manage your organization&apos;s team members</p>
        </div>
        {isManager && (
          <Button onClick={() => setShowInvite(!showInvite)} size="sm">
            <UserPlus className="h-4 w-4" />
            Invite Member
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-brand-600" />
              <div>
                <CardTitle>Invite Team Member</CardTitle>
                <CardDescription>
                  Add a new member to your organization
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                id="invite-name"
                label="Full Name"
                placeholder="Jane Smith"
                value={inviteForm.name}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, name: e.target.value })
                }
                required
              />
              <Input
                id="invite-email"
                label="Email Address"
                type="email"
                placeholder="jane@company.com"
                value={inviteForm.email}
                onChange={(e) =>
                  setInviteForm({ ...inviteForm, email: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">
                Role
              </label>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({
                    ...inviteForm,
                    role: e.target.value as "MANAGER" | "INSPECTOR" | "VIEWER",
                  })
                }
                className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 transition-colors"
              >
                <option value="INSPECTOR">Inspector</option>
                <option value="MANAGER">Manager</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setShowInvite(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                loading={inviteMutation.isPending}
              >
                Send Invite
              </Button>
            </div>
            {inviteMutation.error && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {inviteMutation.error.message}
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>
                Members{" "}
                {members && (
                  <span className="text-gray-400 font-normal">
                    ({members.length})
                  </span>
                )}
              </CardTitle>
              <CardDescription>
                People with access to your organization
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-brand-600" />
          </div>
        ) : members && members.length > 0 ? (
          <div className="divide-y divide-gray-100 -mx-6">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-6 py-4"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-semibold text-brand-700">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {member.name}
                      </p>
                      {member.id === me?.id && (
                        <span className="text-xs text-gray-400">(You)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right mr-2 hidden sm:block">
                    <p className="text-xs text-gray-500">
                      {member._count.inspections} inspection
                      {member._count.inspections !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <Badge variant={roleBadgeVariant[member.role] || "default"}>
                    <Shield className="h-3 w-3 mr-1" />
                    {roleLabels[member.role] || member.role}
                  </Badge>
                  {isManager &&
                    member.id !== me?.id &&
                    member.role !== "OWNER" && (
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Remove ${member.name} from your organization?`
                            )
                          ) {
                            removeMutation.mutate({ userId: member.id });
                          }
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Remove member"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">No team members yet</p>
            {isManager && (
              <Button
                variant="secondary"
                size="sm"
                className="mt-3"
                onClick={() => setShowInvite(true)}
              >
                Invite your first member
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
