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
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Vehicles</h1>
        <p className="text-gray-500 mt-1">All vehicles in your database</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="spinner-gradient" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-20">
            <div className="mx-auto mb-4 h-14 w-14 rounded-2xl bg-brand-50 flex items-center justify-center">
              <Car className="h-7 w-7 text-brand-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">No vehicles yet</h3>
            <p className="text-gray-500">Vehicles are added when you start an inspection</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Vehicle</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">VIN</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Drivetrain</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Inspections</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-brand-gradient-subtle transition-all duration-200">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {v.year} {v.make} {v.model} {v.trim || ""}
                    </p>
                    <p className="text-xs text-gray-500">{v.bodyStyle}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{v.vin}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{v.drivetrain || "&mdash;"}</td>
                  <td className="px-6 py-4">
                    <Badge variant="info">{v._count.inspections}</Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">{formatDate(v.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
