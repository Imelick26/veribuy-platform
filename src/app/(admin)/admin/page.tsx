"use client";

import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Users, ClipboardCheck, FileText, Eye, TrendingUp } from "lucide-react";

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: orgs, isLoading: orgsLoading } = trpc.admin.listOrgs.useQuery();

  return (
    <div className="space-y-8">
      {/* Platform Stats */}
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Platform Overview</h1>
        <p className="text-text-secondary mt-1">VeriBuy admin dashboard</p>
      </div>

      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}><div className="h-14 animate-pulse bg-surface-overlay rounded-lg" /></Card>
          ))}
        </div>
      ) : stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-gradient p-2.5 shadow-brand-glow">
                  <Building2 className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Organizations</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.totalOrgs}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-600 p-2.5">
                  <Users className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Total Users</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.totalUsers}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-deal-strong-buy p-2.5">
                  <ClipboardCheck className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Total Inspections</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.totalInspections}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-400 p-2.5">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">This Month</p>
                  <p className="text-2xl font-bold text-text-primary">{stats.inspectionsThisMonth}</p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-700 p-2.5">
                  <FileText className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Reports</p>
                  <p className="text-xl font-bold text-text-primary">{stats.totalReports}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-brand-800 p-2.5">
                  <Eye className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-text-secondary">Report Views</p>
                  <p className="text-xl font-bold text-text-primary">{stats.totalReportViews}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="space-y-2">
                <p className="text-sm text-text-secondary">Orgs by Tier</p>
                <div className="flex items-center gap-2">
                  <Badge>BASE: {stats.orgsByTier.BASE}</Badge>
                  <Badge variant="info">PRO: {stats.orgsByTier.PRO}</Badge>
                  <Badge variant="gradient">ENT: {stats.orgsByTier.ENTERPRISE}</Badge>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Org list */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Dealer Organizations</h2>
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
                <tr className="border-b border-border-default text-left text-text-secondary">
                  <th className="px-5 py-2.5 font-medium">Organization</th>
                  <th className="px-5 py-2.5 font-medium">Plan</th>
                  <th className="px-5 py-2.5 font-medium">Usage</th>
                  <th className="px-5 py-2.5 font-medium">Members</th>
                  <th className="px-5 py-2.5 font-medium">Created</th>
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
                      <span className={org.inspectionsThisMonth >= org.maxInspectionsPerMonth ? "text-red-600 font-medium" : ""}>
                        {org.inspectionsThisMonth} / {org.maxInspectionsPerMonth}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-text-tertiary" />
                        {org._count.users}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-text-secondary">
                      {new Date(org.createdAt).toLocaleDateString()}
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
  );
}
