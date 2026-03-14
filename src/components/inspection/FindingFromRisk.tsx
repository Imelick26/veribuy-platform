"use client";

import { useState } from "react";
import { X, Camera, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { AggregatedRisk } from "@/types/risk";

const SEVERITY_OPTIONS = ["CRITICAL", "MAJOR", "MODERATE", "MINOR", "INFO"] as const;
const CATEGORY_OPTIONS = [
  "STRUCTURAL", "DRIVETRAIN", "ENGINE", "TRANSMISSION", "ELECTRICAL",
  "COSMETIC_EXTERIOR", "COSMETIC_INTERIOR", "ELECTRONICS", "SAFETY",
  "TIRES_WHEELS", "BRAKES", "SUSPENSION", "HVAC", "OTHER",
] as const;

interface FindingFromRiskProps {
  risk: AggregatedRisk;
  onSubmit: (finding: {
    title: string;
    description: string;
    severity: (typeof SEVERITY_OPTIONS)[number];
    category: (typeof CATEGORY_OPTIONS)[number];
    repairCostLow?: number;
    repairCostHigh?: number;
    evidence?: string;
    positionX?: number;
    positionY?: number;
    positionZ?: number;
  }) => void;
  onClose: () => void;
  onCaptureEvidence: () => void;
  isSubmitting: boolean;
}

export function FindingFromRisk({
  risk,
  onSubmit,
  onClose,
  onCaptureEvidence,
  isSubmitting,
}: FindingFromRiskProps) {
  const [form, setForm] = useState({
    title: risk.title,
    description: risk.description,
    severity: risk.severity as (typeof SEVERITY_OPTIONS)[number],
    category: (risk.category || "OTHER") as (typeof CATEGORY_OPTIONS)[number],
    repairCostLow: risk.cost.low > 0 ? String(risk.cost.low / 100) : "",
    repairCostHigh: risk.cost.high > 0 ? String(risk.cost.high / 100) : "",
    evidence: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      title: form.title,
      description: form.description,
      severity: form.severity,
      category: form.category,
      repairCostLow: form.repairCostLow ? Math.round(parseFloat(form.repairCostLow) * 100) : undefined,
      repairCostHigh: form.repairCostHigh ? Math.round(parseFloat(form.repairCostHigh) * 100) : undefined,
      evidence: form.evidence || undefined,
      positionX: risk.position.x,
      positionY: risk.position.y,
      positionZ: risk.position.z,
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-surface-overlay shadow-2xl z-50 overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-text-primary">Create Finding from Risk</h3>
            <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-surface-hover">
              <X className="h-5 w-5 text-text-tertiary" />
            </button>
          </div>

          {/* Risk context banner */}
          <div className="mb-4 p-3 rounded-lg bg-[#1a0a2e] border border-brand-800/50">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-brand-400" />
              <p className="text-xs font-bold text-brand-300">Pre-populated from risk profile</p>
            </div>
            <p className="text-[11px] text-brand-200">
              Review and modify the details below before submitting. Add your specific observations in the evidence notes.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="finding-title"
              label="Title"
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
              required
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                required
                rows={3}
                className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary shadow-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">Severity</label>
                <select
                  value={form.severity}
                  onChange={(e) => setForm((p) => ({ ...p, severity: e.target.value as never }))}
                  className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                >
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">Category</label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((p) => ({ ...p, category: e.target.value as never }))}
                  className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="cost-low"
                label="Repair Cost Low ($)"
                type="number"
                placeholder="e.g., 2800"
                value={form.repairCostLow}
                onChange={(e) => setForm((p) => ({ ...p, repairCostLow: e.target.value }))}
              />
              <Input
                id="cost-high"
                label="Repair Cost High ($)"
                type="number"
                placeholder="e.g., 4200"
                value={form.repairCostHigh}
                onChange={(e) => setForm((p) => ({ ...p, repairCostHigh: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Evidence Notes</label>
              <textarea
                placeholder="Describe what you observed during inspection..."
                value={form.evidence}
                onChange={(e) => setForm((p) => ({ ...p, evidence: e.target.value }))}
                rows={2}
                className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary shadow-sm placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay"
              />
            </div>

            <Button
              type="button"
              variant="secondary"
              onClick={onCaptureEvidence}
              className="w-full text-sm"
            >
              <Camera className="h-4 w-4" /> Capture Evidence Photo
            </Button>

            <div className="pt-2 flex gap-3">
              <Button type="button" variant="secondary" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" loading={isSubmitting} className="flex-1">
                Add Finding
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
