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
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Team</h1>
          <p className="text-text-secondary mt-1">Manage your organization&apos;s team members</p>
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
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-text-tertiary" />
              <CardTitle>Invite Team Member</CardTitle>
            </div>
            <CardDescription>Add a new member to your organization</CardDescription>
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
              <label className="block text-sm font-medium text-text-secondary">Role</label>
              <select
                value={inviteForm.role}
                onChange={(e) =>
                  setInviteForm({
                    ...inviteForm,
                    role: e.target.value as "MANAGER" | "INSPECTOR" | "VIEWER",
                  })
                }
                className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
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
              <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
                {inviteMutation.error.message}
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Team Members List */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <CardTitle>
              Members{" "}
              {members && (
                <span className="text-text-tertiary font-normal">({members.length})</span>
              )}
            </CardTitle>
          </div>
          <CardDescription>People with access to your organization</CardDescription>
        </CardHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="spinner-gradient" />
          </div>
        ) : members && members.length > 0 ? (
          <div className="divide-y divide-border-default -mx-5">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-surface-overlay border border-border-strong flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-medium text-text-secondary">
                      {member.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-text-primary truncate">{member.name}</p>
                      {member.id === me?.id && (
                        <span className="text-xs text-text-tertiary">(You)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{member.email}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right mr-2 hidden sm:block">
                    <p className="text-xs text-text-secondary">
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
                      className="p-1.5 rounded-md text-text-tertiary hover:text-red-700 hover:bg-[#fde8e8] transition-colors cursor-pointer"
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
            <Users className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-secondary">No team members yet</p>
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
