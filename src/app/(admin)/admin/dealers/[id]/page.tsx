"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Building2, Users, Shield, Mail, ChevronRight, ClipboardCheck, CreditCard, AlertTriangle, Package, Send, CheckCircle2, Clock, ExternalLink, ImagePlus } from "lucide-react";
import { useRef } from "react";

const roleLabels: Record<string, string> = {
  OWNER: "Owner",
  MANAGER: "Manager",
  INSPECTOR: "Inspector",
  VIEWER: "Viewer",
};

const PLAN_PRICING = [
  { tier: "CORE", label: "Core", annualPriceCents: 358800, inspectionsPerMonth: 10 },
  { tier: "BASE", label: "Base", annualPriceCents: 718800, inspectionsPerMonth: 50 },
  { tier: "PRO", label: "Pro", annualPriceCents: 1558800, inspectionsPerMonth: 125 },
  { tier: "ENTERPRISE", label: "Enterprise", annualPriceCents: 4798800, inspectionsPerMonth: 400 },
] as const;

function getPlanDefaults(tier: string) {
  return PLAN_PRICING.find((p) => p.tier === tier) ?? PLAN_PRICING[0];
}

export default function DealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: org, isLoading, refetch } = trpc.admin.getOrgDetail.useQuery({ orgId: id });

  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({
    subscription: "" as string,
    maxInspectionsPerMonth: 0,
    customAnnualPriceDollars: "",
  });

  // Billing mutations
  const [showCreateSub, setShowCreateSub] = useState(false);
  const [createSubForm, setCreateSubForm] = useState({
    tier: "BASE" as "CORE" | "BASE" | "PRO" | "ENTERPRISE",
    customAnnualPriceDollars: "7188",
    collectionMethod: "send_invoice" as "charge_automatically" | "send_invoice",
    daysUntilDue: 30,
  });
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [packForm, setPackForm] = useState({ packSize: 10, priceDollars: "250", note: "" });
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);

  const update = trpc.admin.updateOrg.useMutation({
    onSuccess: () => { refetch(); setEditMode(false); },
  });
  const updateSub = trpc.admin.updateSubscription.useMutation({
    onSuccess: () => { refetch(); setEditMode(false); },
  });
  const createSub = trpc.admin.createSubscription.useMutation({
    onSuccess: () => { refetch(); setShowCreateSub(false); },
  });
  const cancelSub = trpc.admin.cancelSubscription.useMutation({
    onSuccess: () => { refetch(); setShowCancelConfirm(false); },
  });
  const sendPackInvoice = trpc.admin.createPackInvoice.useMutation({
    onSuccess: (data) => {
      setInvoiceUrl(data.invoiceUrl ?? null);
      setPackForm({ packSize: 10, priceDollars: "250", note: "" });
      refetch();
    },
  });
  const getLogoUrl = trpc.admin.getLogoUploadUrl.useMutation();
  const confirmLogo = trpc.admin.confirmLogoUpload.useMutation({ onSuccess: () => refetch() });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { uploadUrl, publicUrl, storagePath } = await getLogoUrl.mutateAsync({
        orgId: id,
        fileName: file.name,
        mimeType: file.type,
      });
      const res = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!res.ok) throw new Error("Upload failed");
      await confirmLogo.mutateAsync({ orgId: id, publicUrl, storagePath });
    } catch {
      // silently fail — user can retry
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function startEdit() {
    if (!org) return;
    const currentPrice = org.stripePriceAmountCents
      ? (org.stripePriceAmountCents / 100).toString()
      : (getPlanDefaults(org.subscription).annualPriceCents / 100).toString();
    setEditForm({
      subscription: org.subscription,
      maxInspectionsPerMonth: org.maxInspectionsPerMonth,
      customAnnualPriceDollars: currentPrice,
    });
    setEditMode(true);
  }

  function handleEditTierChange(tier: string) {
    const defaults = getPlanDefaults(tier);
    setEditForm({
      ...editForm,
      subscription: tier,
      maxInspectionsPerMonth: defaults.inspectionsPerMonth,
      customAnnualPriceDollars: (defaults.annualPriceCents / 100).toString(),
    });
  }

  function handleCreateSubTierChange(tier: typeof createSubForm.tier) {
    const defaults = getPlanDefaults(tier);
    setCreateSubForm({
      ...createSubForm,
      tier,
      customAnnualPriceDollars: (defaults.annualPriceCents / 100).toString(),
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    const customCents = Math.round(parseFloat(editForm.customAnnualPriceDollars) * 100);

    if (org?.stripeSubscriptionId) {
      // Update subscription (cancel + recreate)
      updateSub.mutate({
        orgId: id,
        tier: editForm.subscription as "CORE" | "BASE" | "PRO" | "ENTERPRISE",
        customAnnualAmountCents: customCents,
        maxInspectionsPerMonth: editForm.maxInspectionsPerMonth,
      });
    } else {
      // DB-only update
      update.mutate({
        orgId: id,
        subscription: editForm.subscription as "CORE" | "BASE" | "PRO" | "ENTERPRISE",
        maxInspectionsPerMonth: editForm.maxInspectionsPerMonth,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <div className="spinner-gradient" />
      </div>
    );
  }

  if (!org) {
    return <p className="text-text-secondary text-center py-16">Organization not found</p>;
  }

  const hasSubscription = !!org.stripeSubscriptionId;
  const editMonthlyEquiv = parseFloat(editForm.customAnnualPriceDollars) / 12;
  const createSubMonthlyEquiv = parseFloat(createSubForm.customAnnualPriceDollars) / 12;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        {/* Logo */}
        <div className="relative group flex-shrink-0">
          {org.logo ? (
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="h-12 rounded-lg border border-border-default bg-white p-1.5 flex items-center justify-center hover:border-brand-500 transition-colors cursor-pointer"
              title="Change logo"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={org.logo} alt={org.name} className="max-h-9 max-w-[120px] object-contain" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              className="h-12 w-12 rounded-lg border border-dashed border-border-default bg-surface-sunken flex items-center justify-center hover:border-brand-500 transition-colors cursor-pointer"
              title="Upload logo"
            >
              {logoUploading ? (
                <div className="spinner-gradient h-4 w-4" />
              ) : (
                <ImagePlus className="h-4 w-4 text-text-tertiary" />
              )}
            </button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/svg+xml,image/webp"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">{org.name}</h1>
          <p className="text-text-secondary mt-0.5 text-sm">{org.slug} &middot; {org.type}</p>
        </div>
        {!editMode && (
          <Button size="sm" variant="secondary" onClick={startEdit}>
            Edit Plan
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card>
          <p className="text-sm text-text-secondary">Plan</p>
          <p className="text-xl font-bold text-text-primary mt-1">{org.subscription}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">This Month</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {org.inspectionsThisMonth} / {org.maxInspectionsPerMonth}
            {org.bonusInspections > 0 && (
              <span className="text-sm font-medium text-brand-600"> (+{org.bonusInspections})</span>
            )}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Total Inspections</p>
          <p className="text-xl font-bold text-text-primary mt-1">{org.totalInspections}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Members</p>
          <p className="text-xl font-bold text-text-primary mt-1">{org.users.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-text-secondary">Billing</p>
          <p className="text-xl font-bold text-text-primary mt-1">
            {hasSubscription ? (
              <Badge variant={org.subscriptionStatus === "active" ? "success" : org.subscriptionStatus === "past_due" ? "warning" : "danger"}>
                {org.subscriptionStatus?.replace(/_/g, " ") ?? "—"}
              </Badge>
            ) : (
              <Badge variant="default">No sub</Badge>
            )}
          </p>
        </Card>
      </div>

      {/* Billing Details */}
      {hasSubscription && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-text-tertiary" />
              <CardTitle>Billing</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Annual Price</span>
              <span className="font-medium text-text-primary">
                {org.stripePriceAmountCents
                  ? `$${(org.stripePriceAmountCents / 100).toLocaleString("en-US")}/yr`
                  : "Standard pricing"}
              </span>
            </div>
            {org.currentPeriodEnd && (
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary">Renews</span>
                <span className="text-text-primary">
                  {new Date(org.currentPeriodEnd).toLocaleDateString("en-US", {
                    month: "long", day: "numeric", year: "numeric",
                  })}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-text-secondary">Stripe Customer</span>
              <span className="text-xs text-text-tertiary font-mono">{org.stripeCustomerId}</span>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                variant="danger"
                onClick={() => setShowCancelConfirm(true)}
                disabled={cancelSub.isPending}
              >
                Cancel Subscription
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Create Subscription — for orgs without one */}
      {!hasSubscription && !editMode && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-text-tertiary" />
              <CardTitle>Billing</CardTitle>
            </div>
            <CardDescription>No Stripe subscription attached</CardDescription>
          </CardHeader>
          {!showCreateSub ? (
            <Button size="sm" onClick={() => {
              const defaults = getPlanDefaults(org.subscription);
              setCreateSubForm({
                tier: org.subscription as typeof createSubForm.tier,
                customAnnualPriceDollars: (defaults.annualPriceCents / 100).toString(),
                collectionMethod: "send_invoice",
                daysUntilDue: 30,
              });
              setShowCreateSub(true);
            }}>
              Create Subscription
            </Button>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const customCents = Math.round(parseFloat(createSubForm.customAnnualPriceDollars) * 100);
                createSub.mutate({
                  orgId: id,
                  tier: createSubForm.tier,
                  customAnnualAmountCents: customCents,
                  collectionMethod: createSubForm.collectionMethod,
                  daysUntilDue: createSubForm.daysUntilDue,
                });
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-secondary">Plan</label>
                  <select
                    value={createSubForm.tier}
                    onChange={(e) => handleCreateSubTierChange(e.target.value as typeof createSubForm.tier)}
                    className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
                  >
                    <option value="CORE">Core (10/mo)</option>
                    <option value="BASE">Base (50/mo)</option>
                    <option value="PRO">Pro (125/mo)</option>
                    <option value="ENTERPRISE">Enterprise (400/mo)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-secondary">Annual Price</label>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-text-secondary">$</span>
                    <input
                      type="number"
                      value={createSubForm.customAnnualPriceDollars}
                      onChange={(e) => setCreateSubForm({ ...createSubForm, customAnnualPriceDollars: e.target.value })}
                      className="w-full text-sm bg-white border border-border-default rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-600"
                      min={1}
                    />
                  </div>
                  <p className="text-xs text-text-tertiary">
                    ${createSubMonthlyEquiv.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo equivalent
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-text-secondary">Collection Method</label>
                  <select
                    value={createSubForm.collectionMethod}
                    onChange={(e) => setCreateSubForm({ ...createSubForm, collectionMethod: e.target.value as typeof createSubForm.collectionMethod })}
                    className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
                  >
                    <option value="send_invoice">Send Invoice</option>
                    <option value="charge_automatically">Charge Automatically</option>
                  </select>
                </div>
                {createSubForm.collectionMethod === "send_invoice" && (
                  <Input
                    id="days-due"
                    label="Days Until Due"
                    type="number"
                    min={1}
                    max={90}
                    value={createSubForm.daysUntilDue}
                    onChange={(e) => setCreateSubForm({ ...createSubForm, daysUntilDue: parseInt(e.target.value) || 30 })}
                  />
                )}
              </div>
              {createSub.error && (
                <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
                  {createSub.error.message}
                </div>
              )}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="secondary" size="sm" onClick={() => setShowCreateSub(false)}>Cancel</Button>
                <Button type="submit" size="sm" loading={createSub.isPending}>Create Subscription</Button>
              </div>
            </form>
          )}
        </Card>
      )}

      {/* Cancel Confirmation Dialog */}
      {showCancelConfirm && (
        <Card className="border-red-300">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <CardTitle>Cancel Subscription</CardTitle>
            </div>
          </CardHeader>
          <div className="space-y-3">
            <p className="text-sm text-text-secondary">
              This will cancel {org.name}&apos;s subscription. Choose when it takes effect:
            </p>
            {cancelSub.error && (
              <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
                {cancelSub.error.message}
              </div>
            )}
            <div className="flex gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => cancelSub.mutate({ orgId: id, cancelAtPeriodEnd: true })}
                loading={cancelSub.isPending}
              >
                Cancel at Period End
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => cancelSub.mutate({ orgId: id, cancelAtPeriodEnd: false })}
                loading={cancelSub.isPending}
              >
                Cancel Immediately
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCancelConfirm(false)}>
                Nevermind
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Edit Plan */}
      {editMode && (
        <Card>
          <CardHeader>
            <CardTitle>Edit Plan</CardTitle>
            {hasSubscription && (
              <CardDescription>
                Changing the plan will cancel the current Stripe subscription and create a new one
              </CardDescription>
            )}
          </CardHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">Plan</label>
                <select
                  value={editForm.subscription}
                  onChange={(e) => handleEditTierChange(e.target.value)}
                  className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
                >
                  <option value="CORE">Core</option>
                  <option value="BASE">Base</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
              <Input
                id="edit-max"
                label="Inspections / Month"
                type="number"
                min={0}
                value={editForm.maxInspectionsPerMonth}
                onChange={(e) => setEditForm({ ...editForm, maxInspectionsPerMonth: parseInt(e.target.value) || 0 })}
              />
            </div>

            {hasSubscription && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-text-secondary">Annual Price</label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-text-secondary">$</span>
                  <input
                    type="number"
                    value={editForm.customAnnualPriceDollars}
                    onChange={(e) => setEditForm({ ...editForm, customAnnualPriceDollars: e.target.value })}
                    className="w-40 text-sm bg-white border border-border-default rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-600"
                    min={1}
                  />
                  <span className="text-xs text-text-tertiary ml-2">
                    ${editMonthlyEquiv.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo
                  </span>
                </div>
              </div>
            )}

            {(update.error || updateSub.error) && (
              <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
                {update.error?.message || updateSub.error?.message}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" size="sm" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" loading={update.isPending || updateSub.isPending}>
                Save Changes
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Inspection Packs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Inspection Packs</CardTitle>
          </div>
          {org.bonusInspections > 0 && (
            <CardDescription>
              {org.bonusInspections} bonus inspection{org.bonusInspections !== 1 ? "s" : ""} remaining
            </CardDescription>
          )}
        </CardHeader>

        {invoiceUrl && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              Invoice sent successfully
            </div>
            <a
              href={invoiceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-green-700 hover:text-green-900 flex items-center gap-1"
            >
              View Invoice <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setInvoiceUrl(null);
            sendPackInvoice.mutate({
              orgId: id,
              packSize: packForm.packSize,
              amountCents: Math.round(parseFloat(packForm.priceDollars) * 100),
              note: packForm.note || undefined,
            });
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Inspections</label>
              <input
                type="number"
                min={1}
                max={500}
                value={packForm.packSize}
                onChange={(e) => setPackForm({ ...packForm, packSize: parseInt(e.target.value) || 1 })}
                className="w-full text-sm bg-white border border-border-default rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Price</label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-text-secondary">$</span>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  value={packForm.priceDollars}
                  onChange={(e) => setPackForm({ ...packForm, priceDollars: e.target.value })}
                  className="w-full text-sm bg-white border border-border-default rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-600"
                />
              </div>
              <p className="text-xs text-text-tertiary">
                ${(parseFloat(packForm.priceDollars || "0") / (packForm.packSize || 1)).toFixed(2)}/inspection
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Note</label>
              <input
                type="text"
                placeholder="e.g. First dealer trial"
                value={packForm.note}
                onChange={(e) => setPackForm({ ...packForm, note: e.target.value })}
                className="w-full text-sm bg-white border border-border-default rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-600"
              />
            </div>
          </div>
          {sendPackInvoice.error && (
            <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
              {sendPackInvoice.error.message}
            </div>
          )}
          <Button type="submit" size="sm" loading={sendPackInvoice.isPending}>
            <Send className="h-4 w-4" /> Send Invoice
          </Button>
        </form>

        {/* Pack purchase history */}
        {org.packPurchases && org.packPurchases.length > 0 && (
          <div className="mt-6 border-t border-border-default pt-4">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Purchase History</p>
            <div className="space-y-2">
              {org.packPurchases.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    {p.status === "completed" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 text-amber-500" />
                    )}
                    <span className="text-text-primary">{p.packSize} inspections</span>
                    <span className="text-text-tertiary">&middot;</span>
                    <span className="text-text-secondary">${(p.amountCents / 100).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={p.status === "completed" ? "success" : "warning"}>
                      {p.status}
                    </Badge>
                    <span className="text-xs text-text-tertiary">
                      {new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Team Members ({org.users.length})</CardTitle>
          </div>
        </CardHeader>
        <div className="divide-y divide-border-default -mx-5">
          {org.users.map((user) => (
            <div key={user.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-surface-overlay border border-border-strong flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-text-secondary">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-text-primary">{user.name}</p>
                  <div className="flex items-center gap-1.5 text-xs text-text-secondary">
                    <Mail className="h-3 w-3" />
                    {user.email}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-text-secondary">{user._count.inspections} inspections</span>
                <Badge variant={user.role === "OWNER" ? "gradient" : "default"}>
                  <Shield className="h-3 w-3 mr-1" />
                  {roleLabels[user.role] || user.role}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Inspected Vehicles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Inspected Vehicles ({org.recentInspections.length})</CardTitle>
          </div>
        </CardHeader>
        {org.recentInspections.length === 0 ? (
          <div className="text-center py-6">
            <p className="text-sm text-text-secondary">No inspections yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border-default -mx-5">
            {org.recentInspections.map((insp) => {
              const vehicleName = insp.vehicle
                ? `${insp.vehicle.year} ${insp.vehicle.make} ${insp.vehicle.model}`
                : "Vehicle pending";
              const vehicleLink = insp.vehicle?.id
                ? `/dashboard/vehicles/${insp.vehicle.id}`
                : `/dashboard/inspections/${insp.id}`;

              return (
                <Link
                  key={insp.id}
                  href={vehicleLink}
                  className="flex items-center justify-between px-5 py-3 hover:bg-surface-hover transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{vehicleName}</span>
                      <span className="text-xs text-text-tertiary shrink-0">{insp.number}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-text-tertiary">
                      {insp.vehicle?.vin && (
                        <span className="font-mono">{insp.vehicle.vin}</span>
                      )}
                      <span>{insp.inspector.name}</span>
                      <span>{new Date(insp.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    {insp.overallScore != null && (
                      <span className={`text-xs font-semibold ${
                        insp.overallScore >= 70 ? "text-green-600" :
                        insp.overallScore >= 40 ? "text-caution-600" : "text-red-600"
                      }`}>
                        {insp.overallScore}/100
                      </span>
                    )}
                    {insp._count.findings > 0 && (
                      <span className="text-xs text-text-tertiary">{insp._count.findings} findings</span>
                    )}
                    <Badge
                      variant={
                        insp.status === "COMPLETED" ? "success" :
                        insp.status === "CANCELLED" ? "danger" : "info"
                      }
                    >
                      {insp.status.replace(/_/g, " ")}
                    </Badge>
                    <ChevronRight className="h-4 w-4 text-text-tertiary" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
