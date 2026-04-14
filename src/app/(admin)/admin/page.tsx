"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Users, ChevronRight } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: orgs, isLoading: orgsLoading } = trpc.admin.listOrgs.useQuery();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Platform Overview</h1>
        <p className="text-text-secondary mt-1">VeriBuy admin dashboard</p>
      </div>

      {/* Stats row */}
      {statsLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><div className="h-10 animate-pulse bg-surface-overlay rounded-lg" /></Card>
          ))}
        </div>
      ) : stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Card>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Organizations</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{stats.totalOrgs}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Users</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{stats.totalUsers}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Inspections</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{stats.totalInspections}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">This Month</p>
              <p className="text-2xl font-bold text-text-primary mt-1">{stats.inspectionsThisMonth}</p>
            </Card>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Reports</p>
              <p className="text-xl font-bold text-text-primary mt-1">{stats.totalReports}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider">Report Views</p>
              <p className="text-xl font-bold text-text-primary mt-1">{stats.totalReportViews}</p>
            </Card>
            <Card>
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">Orgs by Tier</p>
              <div className="flex items-center gap-2">
                <Badge>BASE: {stats.orgsByTier.BASE}</Badge>
                <Badge variant="info">PRO: {stats.orgsByTier.PRO}</Badge>
                <Badge variant="gradient">ENT: {stats.orgsByTier.ENTERPRISE}</Badge>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Org list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Dealer Organizations</p>
          <Link href="/admin/dealers/new">
            <Button size="sm"><Plus className="h-4 w-4" /> New Dealer</Button>
          </Link>
        </div>

        <Card>
          {orgsLoading ? (
            <div className="flex justify-center py-8"><div className="spinner-gradient" /></div>
          ) : orgs && orgs.length > 0 ? (
            <div className="overflow-x-auto -mx-5">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-default text-left text-text-tertiary">
                    <th className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider">Organization</th>
                    <th className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider">Plan</th>
                    <th className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider">Usage</th>
                    <th className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider">Members</th>
                    <th className="px-5 py-2.5 font-medium text-xs uppercase tracking-wider">Created</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr
                      key={org.id}
                      className="border-b border-border-default hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => (window.location.href = `/admin/dealers/${org.id}`)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-text-tertiary" />
                          <div>
                            <p className="font-medium text-text-primary">{org.name}</p>
                            <p className="text-xs text-text-tertiary">{org.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="gradient">{org.subscription}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        <span className={org.inspectionsThisMonth >= org.maxInspectionsPerMonth ? "text-red-600 font-medium" : "text-text-secondary"}>
                          {org.inspectionsThisMonth} / {org.maxInspectionsPerMonth}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1 text-text-secondary">
                          <Users className="h-3.5 w-3.5 text-text-tertiary" />
                          {org._count.users}
                        </div>
                      </td>
                      <td className="px-5 py-3 text-text-tertiary text-xs">
                        {new Date(org.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3">
                        <ChevronRight className="h-4 w-4 text-text-tertiary" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Building2 className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
              <p className="text-sm text-text-secondary mb-3">No organizations yet</p>
              <Link href="/admin/dealers/new">
                <Button size="sm"><Plus className="h-3.5 w-3.5" /> Create First Dealer</Button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
