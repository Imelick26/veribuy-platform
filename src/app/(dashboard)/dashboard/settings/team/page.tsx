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

const roleBadgeVariant: Record<string, "default" | "success" | "warning" | "danger" | "info" | "gradient"> = {
  OWNER: "gradient",
  MANAGER: "success",
  INSPECTOR: "info",
  VIEWER: "default",
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Team</h1>
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
        <Card accent>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-brand-gradient p-2 shadow-brand-glow">
                <UserPlus className="h-4 w-4 text-white" />
              </div>
              <div>
                <CardTitle>Invite Team Member</CardTitle>
                <CardDescription>Add a new member to your organization</CardDescription>
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
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                required
              />
              <Input
                id="invite-email"
                label="Email Address"
                type="email"
                placeholder="jane@company.com"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({
                    ...inviteForm,
                    role: e.target.value as "MANAGER" | "INSPECTOR" | "VIEWER",
                  })
                }
                className="block w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 hover:border-brand-200 transition-all duration-200"
              >
                <option value="INSPECTOR">Inspector</option>
                <option value="MANAGER">Manager</option>
                <option value="VIEWER">Viewer</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={inviteMutation.isPending}>
                Send Invite
              </Button>
            </div>
            {inviteMutation.error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
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
            <div className="rounded-xl bg-brand-50 p-2">
              <Users className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <CardTitle>
                Members{" "}
                {members && (
                  <span className="text-gray-400 font-normal">({members.length})</span>
                )}
              </CardTitle>
              <CardDescription>People with access to your organization</CardDescription>
            </div>
          </div>
        </CardHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="spinner-gradient" />
          </div>
        ) : members && members.length > 0 ? (
          <div className="divide-y divide-gray-50 -mx-6">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-6 py-4 hover:bg-brand-gradient-subtle transition-all duration-200"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-brand-gradient flex items-center justify-center flex-shrink-0 shadow-sm">
                    <span className="text-sm font-semibold text-white">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
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
                  {isManager && member.id !== me?.id && member.role !== "OWNER" && (
                    <button
                      onClick={() => {
                        if (confirm(`Remove ${member.name} from your organization?`)) {
                          removeMutation.mutate({ userId: member.id });
                        }
                      }}
                      className="p-1.5 rounded-xl text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all duration-200 cursor-pointer"
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
            <div className="mx-auto mb-3 h-12 w-12 rounded-2xl bg-brand-50 flex items-center justify-center">
              <Users className="h-6 w-6 text-brand-400" />
            </div>
            <p className="text-sm text-gray-500">No team members yet</p>
            {isManager && (
              <Button size="sm" className="mt-3" onClick={() => setShowInvite(true)}>
                Invite your first member
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
