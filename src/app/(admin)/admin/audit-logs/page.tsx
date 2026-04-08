"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { ScrollText, Search, ChevronDown, ChevronRight } from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function AdminAuditLogsPage() {
  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const { data, isLoading } = trpc.admin.listAuditLogs.useQuery({
    action: actionFilter || undefined,
    entityType: entityFilter || undefined,
    limit: 100,
  });

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Audit Logs</h1>
        <p className="text-text-secondary mt-1">Platform activity trail</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
          <input
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            placeholder="Filter by action..."
            className="block w-full rounded-lg border border-border-default bg-surface-sunken pl-9 pr-3.5 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-surface-base transition-colors"
          />
        </div>
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value)}
          className="rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-1 focus:ring-offset-surface-base transition-colors"
        >
          <option value="">All Entities</option>
          <option value="Organization">Organization</option>
          <option value="User">User</option>
          <option value="Inspection">Inspection</option>
          <option value="Report">Report</option>
        </select>
      </div>

      {/* Logs table */}
      <Card>
        {isLoading ? (
          <div className="flex justify-center py-8"><div className="spinner-gradient" /></div>
        ) : !logs.length ? (
          <div className="text-center py-8">
            <ScrollText className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <p className="text-sm text-text-secondary">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-text-secondary">
                  <th className="w-8 px-3" />
                  <th className="px-5 py-2.5 font-medium">Timestamp</th>
                  <th className="px-5 py-2.5 font-medium">User</th>
                  <th className="px-5 py-2.5 font-medium">Action</th>
                  <th className="px-5 py-2.5 font-medium">Entity</th>
                  <th className="px-5 py-2.5 font-medium">Entity ID</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const isExpanded = expandedLog === log.id;
                  return (
                    <tr
                      key={log.id}
                      className="border-b border-border-default hover:bg-surface-hover transition-colors cursor-pointer"
                      onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    >
                      <td className="px-3 py-3">
                        {log.metadata ? (
                          isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5 text-text-tertiary" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-text-tertiary" />
                          )
                        ) : null}
                      </td>
                      <td className="px-5 py-3 text-text-tertiary text-xs whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString()}
                        {isExpanded && log.metadata && (
                          <div
                            className="mt-3 p-3 bg-surface-sunken rounded-lg border border-border-default"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono max-h-40 overflow-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-text-primary text-sm">{log.user.name}</p>
                        <p className="text-text-tertiary text-xs">{log.user.email}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant="info">{log.action}</Badge>
                      </td>
                      <td className="px-5 py-3 text-text-secondary">{log.entityType}</td>
                      <td className="px-5 py-3 font-mono text-xs text-text-tertiary">
                        {log.entityId.length > 12 ? `${log.entityId.slice(0, 12)}...` : log.entityId}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
