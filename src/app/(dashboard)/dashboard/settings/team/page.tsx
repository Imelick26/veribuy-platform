"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { Users, UserPlus, Mail, Trash2, Check } from "lucide-react";

export default function TeamPage() {
  const { data: members, isLoading, refetch } = trpc.auth.teamMembers.useQuery();
  const { data: me } = trpc.auth.me.useQuery();
  const [inviteResult, setInviteResult] = useState<{ name: string; email: string } | null>(null);
  const inviteMutation = trpc.auth.inviteUser.useMutation({
    onSuccess: (data) => {
      refetch();
      setInviteResult({ name: inviteForm.name, email: inviteForm.email });
      setShowInvite(false);
      setInviteForm({ name: "", email: "" });
    },
  });
  const removeMutation = trpc.auth.removeUser.useMutation({
    onSuccess: () => refetch(),
  });

  const [showInvite, setShowInvite] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "" });

  const isOwner = me?.role === "OWNER" || me?.role === "SUPER_ADMIN";

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    inviteMutation.mutate({ ...inviteForm, role: "INSPECTOR" });
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Team</h1>
          <p className="text-text-secondary mt-1">Manage your organization&apos;s team members</p>
        </div>
        {isOwner && (
          <Button onClick={() => setShowInvite(!showInvite)} size="sm" className="self-start sm:self-auto flex-shrink-0">
            <UserPlus className="h-4 w-4" />
            Add Member
          </Button>
        )}
      </div>

      {/* Invite Form */}
      {showInvite && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-text-tertiary" />
              <CardTitle>Add Team Member</CardTitle>
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
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowInvite(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={inviteMutation.isPending}>
                Add Member
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

      {/* Success Message */}
      {inviteResult && (
        <Card className="border-green-300 bg-green-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-green-600" />
              <p className="text-sm text-green-700">
                <strong>{inviteResult.name}</strong> has been added. Login credentials were sent to {inviteResult.email}.
              </p>
            </div>
            <button
              onClick={() => setInviteResult(null)}
              className="text-green-600 hover:text-green-800 text-xs"
            >
              Dismiss
            </button>
          </div>
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
                  {isOwner && member.id !== me?.id && member.role !== "OWNER" && (
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
            {isOwner && (
              <Button size="sm" className="mt-3" onClick={() => setShowInvite(true)}>
                Add your first member
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
