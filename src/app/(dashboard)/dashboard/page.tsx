"use client";

import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import {
  ClipboardCheck,
  Car,
  FileText,
  Plus,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

export default function DashboardPage() {
  const { data: inspections } = trpc.inspection.list.useQuery({ limit: 5 });
  const { data: reports } = trpc.report.list.useQuery({ limit: 5 });

  const recentInspections = inspections?.inspections || [];
  const recentReports = reports?.reports || [];

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Overview of your inspection activity</p>
        </div>
        <Link href="/dashboard/inspections/new">
          <Button size="lg">
            <Plus className="h-4 w-4" />
            New Inspection
          </Button>
        </Link>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-brand-50 p-3">
              <ClipboardCheck className="h-6 w-6 text-brand-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Active Inspections</p>
              <p className="text-2xl font-bold text-gray-900">
                {recentInspections.filter((i) => i.status !== "COMPLETED" && i.status !== "CANCELLED").length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-green-50 p-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {recentInspections.filter((i) => i.status === "COMPLETED").length}
              </p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-purple-50 p-3">
              <Car className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Vehicles</p>
              <p className="text-2xl font-bold text-gray-900">—</p>
            </div>
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-amber-50 p-3">
              <FileText className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Reports</p>
              <p className="text-2xl font-bold text-gray-900">{recentReports.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Inspections */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Inspections</CardTitle>
              <Link href="/dashboard/inspections">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          {recentInspections.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck className="h-10 w-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500">No inspections yet</p>
              <Link href="/dashboard/inspections/new" className="mt-3 inline-block">
                <Button variant="secondary" size="sm">
                  <Plus className="h-3.5 w-3.5" /> Start First Inspection
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentInspections.map((insp) => (
                <Link
                  key={insp.id}
                  href={`/dashboard/inspections/${insp.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {insp.vehicle.year} {insp.vehicle.make} {insp.vehicle.model}
                    </p>
                    <p className="text-xs text-gray-500">{insp.number}</p>
                  </div>
                  <Badge
                    variant={
                      insp.status === "COMPLETED" ? "success" :
                      insp.status === "CANCELLED" ? "danger" : "info"
                    }
                  >
                    {insp.status.replace(/_/g, " ")}
                  </Badge>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks to get you started</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            <Link
              href="/dashboard/inspections/new"
              className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:bg-brand-50 hover:border-blue-200 transition-colors"
            >
              <div className="rounded-lg bg-brand-100 p-2.5">
                <Plus className="h-5 w-5 text-brand-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">New Inspection</p>
                <p className="text-sm text-gray-500">Start a vehicle inspection by entering a VIN</p>
              </div>
            </Link>
            <Link
              href="/dashboard/reports"
              className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:bg-green-50 hover:border-green-200 transition-colors"
            >
              <div className="rounded-lg bg-green-100 p-2.5">
                <FileText className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">View Reports</p>
                <p className="text-sm text-gray-500">Access generated inspection reports</p>
              </div>
            </Link>
            <Link
              href="/dashboard/vehicles"
              className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:bg-purple-50 hover:border-purple-200 transition-colors"
            >
              <div className="rounded-lg bg-purple-100 p-2.5">
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Vehicle Database</p>
                <p className="text-sm text-gray-500">Browse all inspected vehicles</p>
              </div>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
