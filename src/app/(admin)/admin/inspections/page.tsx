"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ClipboardCheck, Search } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AdminInspectionsPage() {
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const { data, isLoading } = trpc.admin.listInspections.useQuery({
    status: (statusFilter as "COMPLETED" | "CREATED" | "CANCELLED") || undefined,
    limit: 50,
  });

  const inspections = data?.inspections ?? [];

  const filtered = search
    ? inspections.filter(
        (i) =>
          (i.vehicle && `${i.vehicle.year} ${i.vehicle.make} ${i.vehicle.model}`
            .toLowerCase()
            .includes(search.toLowerCase())) ||
          (i.vehicle?.vin?.toLowerCase().includes(search.toLowerCase())) ||
          i.number.toLowerCase().includes(search.toLowerCase()) ||
          i.org.name.toLowerCase().includes(search.toLowerCase())
      )
    : inspections;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Inspections</h1>
        <p className="text-text-secondary mt-1">All inspections across organizations</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicle, VIN, or org..."
            className="block w-full rounded-lg border border-border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-surface-base transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-surface-base transition-colors"
        >
          <option value="">All Statuses</option>
          <option value="CREATED">Created</option>
          <option value="VIN_DECODED">VIN Decoded</option>
          <option value="RISK_REVIEWED">Risk Reviewed</option>
          <option value="MEDIA_CAPTURE">Media Capture</option>
          <option value="FINDINGS_RECORDED">Findings Recorded</option>
          <option value="MARKET_PRICED">Market Priced</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="spinner-gradient" /></div>
        ) : !filtered.length ? (
          <div className="text-center py-8">
            <ClipboardCheck className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-secondary">No inspections found</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-text-secondary">
                  <th className="px-5 py-2.5 font-medium">Number</th>
                  <th className="px-5 py-2.5 font-medium">Vehicle</th>
                  <th className="px-5 py-2.5 font-medium">Organization</th>
                  <th className="px-5 py-2.5 font-medium">Inspector</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium text-center">Score</th>
                  <th className="px-5 py-2.5 font-medium text-center">Findings</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((insp) => (
                  <tr key={insp.id} className="border-b border-border-default hover:bg-surface-hover transition-colors">
                    <td className="px-5 py-3 font-mono text-xs text-text-tertiary">{insp.number}</td>
                    <td className="px-5 py-3">
                      {insp.vehicle ? (
                        <>
                          <p className="font-medium text-text-primary">
                            {insp.vehicle.year} {insp.vehicle.make} {insp.vehicle.model}
                          </p>
                          <p className="text-xs text-text-tertiary font-mono">{insp.vehicle.vin}</p>
                        </>
                      ) : (
                        <p className="text-text-tertiary">No vehicle</p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/dealers/${insp.org.id}`}
                        className="text-text-secondary hover:text-brand-600 transition-colors"
                      >
                        {insp.org.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-text-secondary">{insp.inspector.name}</td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={
                          insp.status === "COMPLETED" ? "success" :
                          insp.status === "CANCELLED" ? "danger" : "info"
                        }
                      >
                        {insp.status.replace(/_/g, " ")}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-center">
                      {insp.overallScore !== null ? (
                        <span
                          className={`font-semibold ${
                            insp.overallScore >= 70 ? "text-green-600" :
                            insp.overallScore >= 40 ? "text-amber-600" : "text-red-600"
                          }`}
                        >
                          {insp.overallScore}
                        </span>
                      ) : (
                        <span className="text-text-tertiary">&mdash;</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center text-text-secondary">{insp._count.findings}</td>
                    <td className="px-5 py-3 text-text-tertiary text-xs">
                      {new Date(insp.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
