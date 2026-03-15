"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Car } from "lucide-react";
import { formatDate } from "@/lib/utils";

export default function VehiclesPage() {
  const { data, isLoading } = trpc.vehicle.list.useQuery({ limit: 50 });
  const vehicles = data?.vehicles || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Vehicles</h1>
        <p className="text-text-secondary mt-1">All vehicles in your database</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner-gradient" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-20">
            <Car className="h-5 w-5 text-text-tertiary mx-auto mb-2" />
            <h3 className="text-lg font-semibold text-text-primary mb-1">No vehicles yet</h3>
            <p className="text-text-secondary">Vehicles are added when you start an inspection</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-default">
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Vehicle</th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">VIN</th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Drivetrain</th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Inspections</th>
                <th className="text-left text-xs font-medium text-text-tertiary uppercase tracking-wider px-5 py-2.5">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-default">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-surface-hover transition-colors">
                  <td className="px-5 py-3">
                    <p className="font-medium text-text-primary">
                      {v.year} {v.make} {v.model} {v.trim || ""}
                    </p>
                    <p className="text-xs text-text-secondary">{v.bodyStyle}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-sm text-text-secondary">{v.vin}</td>
                  <td className="px-5 py-3 text-sm text-text-secondary">{v.drivetrain || "\u2014"}</td>
                  <td className="px-5 py-3">
                    <Badge variant="info">{v._count.inspections}</Badge>
                  </td>
                  <td className="px-5 py-3 text-sm text-text-tertiary">{formatDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
