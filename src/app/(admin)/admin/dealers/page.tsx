"use client";

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Users, ChevronRight } from "lucide-react";

export default function AdminDealersPage() {
  const { data: orgs, isLoading } = trpc.admin.listOrgs.useQuery();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[24px] font-bold text-text-primary tracking-tight">Dealers</h1>
          <p className="text-text-secondary mt-1">Manage dealer organizations and plans</p>
        </div>
        <Link href="/admin/dealers/new">
          <Button size="sm"><Plus className="h-4 w-4" /> New Dealer</Button>
        </Link>
      </div>

      <Card>
        {isLoading ? (
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
                      <span className={org.inspectionsThisMonth >= org.maxInspectionsPerMonth + org.bonusInspections ? "text-red-600 font-medium" : "text-text-secondary"}>
                        {org.inspectionsThisMonth} / {org.maxInspectionsPerMonth}
                        {org.bonusInspections > 0 && (
                          <span className="text-brand-600"> (+{org.bonusInspections})</span>
                        )}
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
  );
}
