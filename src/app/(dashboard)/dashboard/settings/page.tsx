"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Building2, Users, CreditCard } from "lucide-react";

export default function SettingsPage() {
  const { data: user } = trpc.auth.me.useQuery();

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account and organization</p>
      </div>

      {/* Organization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Your organization details</CardDescription>
            </div>
          </div>
        </CardHeader>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{user.org.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Slug</span>
              <span className="font-mono text-gray-600">{user.org.slug}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Type</span>
              <Badge>{user.org.type}</Badge>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Plan</span>
              <Badge variant="info">{user.org.subscription}</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>Profile</CardTitle>
              <CardDescription>Your personal information</CardDescription>
            </div>
          </div>
        </CardHeader>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Name</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Email</span>
              <span className="text-gray-600">{user.email}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Role</span>
              <Badge variant="info">{user.role}</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-gray-400" />
            <div>
              <CardTitle>Subscription</CardTitle>
              <CardDescription>Manage your plan and billing</CardDescription>
            </div>
          </div>
        </CardHeader>
        <div className="text-center py-6">
          <p className="text-sm text-gray-500 mb-4">
            You&apos;re currently on the <strong>Free</strong> plan.
          </p>
          <Button variant="secondary">Upgrade Plan</Button>
        </div>
      </Card>
    </div>
  );
}
