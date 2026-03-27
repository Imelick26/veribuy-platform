"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { ArrowRight, Camera } from "lucide-react";

export default function NewInspectionPage() {
  const router = useRouter();
  const [location, setLocation] = useState("");

  const createMutation = trpc.inspection.create.useMutation({
    onSuccess: (inspection) => {
      router.push(`/dashboard/inspections/${inspection.id}`);
    },
  });

  function handleBeginInspection() {
    createMutation.mutate({
      location: location || undefined,
    });
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">
          New Inspection
        </h1>
        <p className="text-text-secondary mt-1">
          Walk up to the vehicle and start capturing photos. VIN will be
          identified from a photo during capture.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-brand-600" />
            Begin Vehicle Inspection
          </CardTitle>
          <CardDescription>
            You&apos;ll be guided through 21 standard photos — VIN, exterior,
            interior, mechanical. Odometer and VIN are captured from photos
            automatically.
          </CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <Input
            id="location"
            label="ZIP Code"
            placeholder="e.g. 97201"
            value={location}
            onChange={(e) => {
              // Only allow digits, max 5
              const val = e.target.value.replace(/\D/g, "").slice(0, 5);
              setLocation(val);
            }}
            inputMode="numeric"
            required
          />
        </div>

        <div className="mt-6">
          <Button
            size="lg"
            className="w-full"
            onClick={handleBeginInspection}
            loading={createMutation.isPending}
            disabled={location.length !== 5}
          >
            Begin Inspection
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {createMutation.error && (
          <div className="mt-4 rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
            {createMutation.error.message}
          </div>
        )}
      </Card>
    </div>
  );
}
