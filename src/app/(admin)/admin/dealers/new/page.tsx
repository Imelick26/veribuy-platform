"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Check } from "lucide-react";
import Link from "next/link";

const PLAN_PRICING = [
  { tier: "CORE", label: "Core", annualPriceCents: 358800, inspectionsPerMonth: 10 },
  { tier: "BASE", label: "Base", annualPriceCents: 718800, inspectionsPerMonth: 50 },
  { tier: "PRO", label: "Pro", annualPriceCents: 1558800, inspectionsPerMonth: 125 },
  { tier: "ENTERPRISE", label: "Enterprise", annualPriceCents: 4798800, inspectionsPerMonth: 400 },
] as const;

function getPlanDefaults(tier: string) {
  return PLAN_PRICING.find((p) => p.tier === tier) ?? PLAN_PRICING[0];
}

export default function NewDealerPage() {
  const router = useRouter();
  const [step, setStep] = useState<"idle" | "creating_org" | "creating_sub" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [createdOrgId, setCreatedOrgId] = useState<string | null>(null);

  const [form, setForm] = useState({
    orgName: "",
    orgType: "DEALER" as "DEALER" | "INSPECTOR_FIRM" | "INSURANCE" | "INDIVIDUAL",
    ownerName: "",
    ownerEmail: "",
    subscription: "BASE" as "CORE" | "BASE" | "PRO" | "ENTERPRISE",
    maxInspectionsPerMonth: 50,
    createSubscription: true,
    customAnnualPriceDollars: "7188",
    collectionMethod: "send_invoice" as "charge_automatically" | "send_invoice",
    daysUntilDue: 30,
  });

  const createOrg = trpc.admin.createOrg.useMutation();
  const createSub = trpc.admin.createSubscription.useMutation();

  function updateTier(tier: typeof form.subscription) {
    const defaults = getPlanDefaults(tier);
    setForm({
      ...form,
      subscription: tier,
      maxInspectionsPerMonth: defaults.inspectionsPerMonth,
      customAnnualPriceDollars: (defaults.annualPriceCents / 100).toString(),
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Step 1: Create org
    setStep("creating_org");
    let orgId: string;
    let tempPassword: string;
    try {
      const result = await createOrg.mutateAsync({
        orgName: form.orgName,
        orgType: form.orgType,
        ownerName: form.ownerName,
        ownerEmail: form.ownerEmail,
        subscription: form.subscription,
        maxInspectionsPerMonth: form.maxInspectionsPerMonth,
      });
      orgId = result.orgId;
      tempPassword = result.tempPassword;
    } catch (err: unknown) {
      setStep("idle");
      setError(err instanceof Error ? err.message : "Failed to create organization");
      return;
    }

    // Step 2: Create Stripe subscription (if enabled)
    if (form.createSubscription) {
      setStep("creating_sub");
      try {
        const customCents = Math.round(parseFloat(form.customAnnualPriceDollars) * 100);
        await createSub.mutateAsync({
          orgId,
          tier: form.subscription,
          customAnnualAmountCents: customCents,
          collectionMethod: form.collectionMethod,
          daysUntilDue: form.daysUntilDue,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Org created but billing setup failed");
      }
    }

    setStep("done");
    setCreatedOrgId(orgId);
  }

  const monthlyEquiv = parseFloat(form.customAnnualPriceDollars) / 12;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">New Dealer</h1>
          <p className="text-text-secondary mt-1">Create a new dealer organization</p>
        </div>
      </div>

      {/* Success */}
      {createdOrgId && (
        <Card className="border-l-4 border-l-green-500">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              <CardTitle>Dealer Created</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              {form.createSubscription
                ? "An invoice has been sent to the dealer. Once they pay, they'll receive a welcome email with instructions to set up their password and start using VeriBuy."
                : "The dealer account has been created. You can attach a Stripe subscription from the dealer detail page."}
            </p>
            {error && (
              <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
                {error}
              </div>
            )}
            <div className="pt-2">
              <Link href={`/admin/dealers/${createdOrgId}`}>
                <Button size="sm">Go to Dealer</Button>
              </Link>
            </div>
          </div>
        </Card>
      )}

      {/* Creation form — hidden after success */}
      {!createdOrgId && <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Set up the dealer and their owner account</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input
            id="org-name"
            label="Dealership Name"
            placeholder="Smith Auto Group"
            value={form.orgName}
            onChange={(e) => setForm({ ...form, orgName: e.target.value })}
            required
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-text-secondary">Organization Type</label>
            <select
              value={form.orgType}
              onChange={(e) => setForm({ ...form, orgType: e.target.value as typeof form.orgType })}
              className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
            >
              <option value="DEALER">Dealer</option>
              <option value="INSPECTOR_FIRM">Inspector Firm</option>
              <option value="INSURANCE">Insurance</option>
              <option value="INDIVIDUAL">Individual</option>
            </select>
          </div>

          <hr className="border-border-default" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="owner-name"
              label="Owner Name"
              placeholder="John Smith"
              value={form.ownerName}
              onChange={(e) => setForm({ ...form, ownerName: e.target.value })}
              required
            />
            <Input
              id="owner-email"
              label="Owner Email"
              type="email"
              placeholder="john@smithauto.com"
              value={form.ownerEmail}
              onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })}
              required
            />
          </div>

          <hr className="border-border-default" />

          {/* Plan & Billing */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Plan</label>
              <select
                value={form.subscription}
                onChange={(e) => updateTier(e.target.value as typeof form.subscription)}
                className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
              >
                <option value="CORE">Core (10/mo)</option>
                <option value="BASE">Base (50/mo)</option>
                <option value="PRO">Pro (125/mo)</option>
                <option value="ENTERPRISE">Enterprise (400/mo)</option>
              </select>
            </div>
            <Input
              id="max-inspections"
              label="Inspections / Month"
              type="number"
              min={0}
              value={form.maxInspectionsPerMonth}
              onChange={(e) => setForm({ ...form, maxInspectionsPerMonth: parseInt(e.target.value) || 0 })}
            />
          </div>

          {/* Stripe Billing */}
          <div className="space-y-3 rounded-lg border border-border-default p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.createSubscription}
                onChange={(e) => setForm({ ...form, createSubscription: e.target.checked })}
                className="rounded border-border-default"
              />
              <span className="text-sm font-medium text-text-primary">Create Stripe subscription</span>
            </label>

            {form.createSubscription && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">Annual Price</label>
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-text-secondary">$</span>
                      <input
                        type="number"
                        value={form.customAnnualPriceDollars}
                        onChange={(e) => setForm({ ...form, customAnnualPriceDollars: e.target.value })}
                        className="w-full text-sm bg-white border border-border-default rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-600"
                        min={1}
                        step={1}
                      />
                    </div>
                    <p className="text-xs text-text-tertiary">
                      ${monthlyEquiv.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo equivalent
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-text-secondary">Collection Method</label>
                    <select
                      value={form.collectionMethod}
                      onChange={(e) => setForm({ ...form, collectionMethod: e.target.value as typeof form.collectionMethod })}
                      className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
                    >
                      <option value="send_invoice">Send Invoice</option>
                      <option value="charge_automatically">Charge Automatically</option>
                    </select>
                  </div>
                </div>

                {form.collectionMethod === "send_invoice" && (
                  <Input
                    id="days-until-due"
                    label="Days Until Due"
                    type="number"
                    min={1}
                    max={90}
                    value={form.daysUntilDue}
                    onChange={(e) => setForm({ ...form, daysUntilDue: parseInt(e.target.value) || 30 })}
                  />
                )}
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <Button
              type="submit"
              loading={step === "creating_org" || step === "creating_sub"}
              disabled={step !== "idle"}
            >
              {step === "creating_org"
                ? "Creating organization..."
                : step === "creating_sub"
                ? "Setting up billing..."
                : "Create Dealer"}
            </Button>
          </div>
        </form>
      </Card>}
    </div>
  );
}
