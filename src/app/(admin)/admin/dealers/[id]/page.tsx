"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Building2, Users, Shield, Mail, ChevronRight, ClipboardCheck } from "lucide-react";

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  INSPECTOR: "Inspector",
  VIEWER: "Viewer",
};

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: org, isLoading, refetch } = trpc.admin.getOrgDetail.useQuery({ orgId: id });

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    subscription: "" as string,
    maxInspectionsPerMonth: 0,
  });

  const update = trpc.admin.updateOrg.useMutation({
    onSuccess: () => {
      refetch();
      setEditMode(false);
    },
  });

  function startEdit() {
    if (!org) return;
    setEditForm({
      subscription: org.subscription,
      maxInspectionsPerMonth: org.maxInspectionsPerMonth,
    });
    setEditMode(true);
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="spinner-gradient" />
      </div>
    );
  }

  if (!org) {
    return <p className="text-text-secondary text-center py-16">Organization not found</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">{org.name}</h1>
          <p className="text-text-secondary mt-0.5 text-sm">{org.slug} &middot; {org.type}</p>
        </div>
        {!editMode && (
          <Button size="sm" variant="secondary" onClick={startEdit}>
            Edit Plan
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <p className="text-sm text-text-secondary">Plan</p>
          <p className="text-xl font-bold text-text-primary mt-1">{org.subscription}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">This Month</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {org.inspectionsThisMonth} / {org.maxInspectionsPerMonth}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Total Inspections</p>
          <p className="text-xl font-bold text-text-primary mt-1">{org.totalInspections}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Members</p>
          <p className="text-xl font-bold text-text-primary mt-1">{org.users.length}</p>
        </Card>
      </div>

      {/* Edit Plan */}
      {editMode && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Plan</CardTitle>
          </CardHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              update.mutate({
                orgId: id,
                subscription: editForm.subscription as "CORE" | "BASE" | "PRO" | "ENTERPRISE",
                maxInspectionsPerMonth: editForm.maxInspectionsPerMonth,
              });
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">Plan</label>
                <select
                  value={editForm.subscription}
                  onChange={(e) => setEditForm({ ...editForm, subscription: e.target.value })}
                  className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
                >
                  <option value="CORE">Core</option>
                  <option value="BASE">Base</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <Input
                id="edit-max"
                label="Inspections / Month"
                type="number"
                min={1}
                value={editForm.maxInspectionsPerMonth}
                onChange={(e) => setEditForm({ ...editForm, maxInspectionsPerMonth: parseInt(e.target.value) || 1 })}
              />
            </div>
            {update.error && (
              <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
                {update.error.message}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={update.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Team Members ({org.users.length})</CardTitle>
          </div>
        </CardHeader>
        <div className="divide-y divide-border-default -mx-5">
          {org.users.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-surface-overlay border border-border-strong flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-text-secondary">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{user.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">{user._count.inspections} inspections</span>
                <Badge variant={user.role === "OWNER" ? "gradient" : "default"}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Inspected Vehicles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Inspected Vehicles ({org.recentInspections.length})</CardTitle>
          </div>
        </CardHeader>
        {org.recentInspections.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-secondary">No inspections yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border-default -mx-5">
            {org.recentInspections.map((insp) => {
              const ma = insp.marketAnalysis as { recommendation?: string; adjustedPrice?: number } | null;
              const vehicleName = insp.vehicle
                ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}`
                : "Vehicle pending";
              const vehicleLink = insp.vehicle?.id
                ? `/dashboard/vehicles/${insp.vehicle.id}`
                : `/dashboard/inspections/${insp.id}`;

              return (
                <Link
                  key={insp.id}
                  href={vehicleLink}
                  className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{vehicleName}</span>
                      <span className="text-xs text-text-tertiary shrink-0">{insp.number}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-text-tertiary">
                      {insp.vehicle?.vin && (
                        <span className="font-mono">{insp.vehicle.vin}</span>
                      )}
                      <span>{insp.inspector.name}</span>
                      <span>{new Date(insp.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {insp.overallScore != null && (
                      <span className={`text-xs font-semibold ${
                        insp.overallScore >= 70 ? "text-green-600" :
                        insp.overallScore >= 40 ? "text-caution-600" : "text-red-600"
                      }`}>
                        {insp.overallScore}/100
                      </span>
                    )}
                    {insp._count.findings > 0 && (
                      <span className="text-xs text-text-tertiary">{insp._count.findings} findings</span>
                    )}
                    <Badge
                      variant={
                        insp.status === "COMPLETED" ? "success" :
                        insp.status === "CANCELLED" ? "danger" : "info"
                      }
                    >
                      {insp.status.replace(/_/g, " ")}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-text-tertiary" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
