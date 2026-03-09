"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Car } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export default function VehiclesPage() {
  const { data, isLoading } = trpc.vehicle.list.useQuery({ limit: 50 });
  const vehicles = data?.vehicles || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Vehicles</h1>
        <p className="text-gray-500 mt-1">All vehicles in your database</p>
      </div>

      <Card className="p-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : vehicles.length === 0 ? (
          <div className="text-center py-20">
            <Car className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No vehicles yet</h3>
            <p className="text-gray-500">Vehicles are added when you start an inspection</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Vehicle</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">VIN</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Drivetrain</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Inspections</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-6 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {vehicles.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {v.year} {v.make} {v.model} {v.trim || ""}
                    </p>
                    <p className="text-xs text-gray-500">{v.bodyStyle}</p>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-gray-600">{v.vin}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">{v.drivetrain || "—"}</td>
                  <td className="px-6 py-4">
                    <Badge>{v._count.inspections}</Badge>
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
