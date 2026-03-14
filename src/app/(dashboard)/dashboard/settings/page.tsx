"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Building2, Users, CreditCard, Sparkles } from "lucide-react";

export default function SettingsPage() {
  const { data: user } = trpc.auth.me.useQuery();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Settings</h1>
        <p className="text-text-secondary mt-1">Manage your account and organization</p>
      </div>

      {/* Organization */}
      <Card accent>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-brand-gradient p-2 shadow-brand-glow">
              <Building2 className="h-4 w-4 text-white" />
            </div>
            <div>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Your organization details</CardDescription>
            </div>
          </div>
        </CardHeader>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Name</span>
              <span className="font-medium">{user.org.name}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Slug</span>
              <span className="font-mono text-text-secondary">{user.org.slug}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Type</span>
              <Badge variant="info">{user.org.type}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm py-2">
              <span className="text-text-secondary">Plan</span>
              <Badge variant="gradient">{user.org.subscription}</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#1a0a2e] p-2">
              <Users className="h-4 w-4 text-brand-400" />
            </div>
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </div>
          </div>
        </CardHeader>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Name</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Email</span>
              <span className="text-text-secondary">{user.email}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2">
              <span className="text-text-secondary">Role</span>
              <Badge variant="gradient">{user.role}</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-[#1a0a2e] p-2">
              <CreditCard className="h-4 w-4 text-brand-400" />
            </div>
            <div>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Manage your plan and billing</CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="text-center py-6">
          <p className="text-sm text-text-secondary mb-4">
            You&apos;re currently on the <strong>Free</strong> plan.
          </p>
          <Button>
            <Sparkles className="h-4 w-4" />
            Upgrade Plan
          </Button>
        </div>
      </Card>
    </div>
  );
}
