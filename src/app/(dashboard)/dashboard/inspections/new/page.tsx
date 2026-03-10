"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import {
  Search,
  CheckCircle,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";

export default function NewInspectionPage() {
  const router = useRouter();
  const [vin, setVin] = useState("");
  const [odometer, setOdometer] = useState("");
  const [location, setLocation] = useState("");
  const [decodedVehicle, setDecodedVehicle] = useState<{
    id: string;
    vin: string;
    year: number;
    make: string;
    model: string;
    trim: string | null;
    bodyStyle: string | null;
    drivetrain: string | null;
    engine: string | null;
  } | null>(null);

  const decodeMutation = trpc.vehicle.decode.useMutation({
    onSuccess: (vehicle) => {
      setDecodedVehicle(vehicle);
    },
  });

  const createMutation = trpc.inspection.create.useMutation({
    onSuccess: (inspection) => {
      router.push(`/dashboard/inspections/${inspection.id}`);
    },
  });

  function handleDecode(e: React.FormEvent) {
    e.preventDefault();
    if (vin.length !== 17) return;
    decodeMutation.mutate({ vin: vin.toUpperCase() });
  }

  function handleCreateInspection() {
    if (!decodedVehicle) return;
    createMutation.mutate({
      vehicleId: decodedVehicle.id,
      odometer: odometer ? parseInt(odometer) : undefined,
      location: location || undefined,
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 tracking-tight">New Inspection</h1>
        <p className="text-gray-500 mt-1">Start by entering the vehicle&apos;s VIN</p>
      </div>

      {/* Step 1: VIN Decode */}
      <Card accent>
        <CardHeader>
          <CardTitle>Step 1: Vehicle Identification</CardTitle>
          <CardDescription>Enter the 17-character VIN to decode vehicle details</CardDescription>
        </CardHeader>

        <form onSubmit={handleDecode} className="flex gap-3">
          <div className="flex-1">
            <Input
              placeholder="Enter 17-character VIN"
              value={vin}
              onChange={(e) => setVin(e.target.value.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, ""))}
              maxLength={17}
              className="font-mono tracking-wider"
            />
          </div>
          <Button
            type="submit"
            loading={decodeMutation.isPending}
            disabled={vin.length !== 17}
          >
            <Search className="h-4 w-4" />
            Decode
          </Button>
        </form>

        {decodeMutation.error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 ring-1 ring-red-100">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {decodeMutation.error.message}
          </div>
        )}

        {/* Decoded vehicle info */}
        {decodedVehicle && (
          <div className="mt-6 p-4 rounded-xl bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="font-semibold text-green-800">Vehicle Decoded</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                ["Year", decodedVehicle.year],
                ["Make", decodedVehicle.make],
                ["Model", decodedVehicle.model],
                ["Trim", decodedVehicle.trim || "\u2014"],
                ["Body", decodedVehicle.bodyStyle || "\u2014"],
                ["Drivetrain", decodedVehicle.drivetrain || "\u2014"],
                ["Engine", decodedVehicle.engine || "\u2014"],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-xs text-green-600 uppercase font-medium">{label}</p>
                  <p className="text-sm font-medium text-green-900">{value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Step 2: Inspection details */}
      {decodedVehicle && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Inspection Details</CardTitle>
            <CardDescription>Add context for this inspection</CardDescription>
          </CardHeader>

          <div className="space-y-4">
            <Input
              id="odometer"
              label="Odometer Reading (miles)"
              type="number"
              placeholder="e.g. 21340"
              value={odometer}
              onChange={(e) => setOdometer(e.target.value)}
            />
            <Input
              id="location"
              label="Inspection Location"
              placeholder="e.g. Portland, OR"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>

          <div className="mt-6">
            <Button
              size="lg"
              className="w-full"
              onClick={handleCreateInspection}
              loading={createMutation.isPending}
            >
              Start Inspection
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
