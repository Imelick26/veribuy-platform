"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Building2, Users, CreditCard, Lock, Check, Mail, ExternalLink, Zap } from "lucide-react";

const PACKS = [
  { size: 1 as const, label: "1 Inspection", price: "$39.99", perUnit: "$39.99/ea" },
  { size: 3 as const, label: "3 Inspections", price: "$99.99", perUnit: "$33.33/ea" },
  { size: 10 as const, label: "10 Inspections", price: "$249.99", perUnit: "$25.00/ea" },
];

const UPGRADE_PLANS = [
  { tier: "PRO" as const, label: "Pro", inspections: "100/mo", description: "For growing operations" },
];

export default function SettingsPage() {
  const { data: user } = trpc.auth.me.useQuery();
  const { data: usage } = trpc.inspection.usageStats.useQuery();
  const { data: subStatus } = trpc.billing.getSubscriptionStatus.useQuery();
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");
  const [contactSent, setContactSent] = useState(false);

  const checkout = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
  const subscribe = trpc.billing.createSubscription.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
  const portal = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
    },
  });
  const requestUpgrade = trpc.billing.requestUpgrade.useMutation({
    onSuccess: () => setContactSent(true),
  });

  const [pwForm, setPwForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [pwSuccess, setPwSuccess] = useState(false);
  const changePw = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      setPwForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    },
  });

  // Pricing settings
  const { data: orgSettings } = trpc.auth.getOrgSettings.useQuery();
  const [marginPercent, setMarginPercent] = useState<number | null>(null);
  const [marginSaved, setMarginSaved] = useState(false);
  const updateSettings = trpc.auth.updateOrgSettings.useMutation({
    onSuccess: () => {
      setMarginSaved(true);
      setTimeout(() => setMarginSaved(false), 3000);
    },
  });
  const currentMargin = marginPercent ?? orgSettings?.targetMarginPercent ?? 25;

  const hasSubscription = subStatus?.hasSubscription;
  const canUpgrade = !hasSubscription || subStatus?.tier === "BASE";

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-text-primary tracking-tight">Settings</h1>
        <p className="text-text-secondary mt-1">Manage your account and organization</p>
      </div>

      {/* ── Pricing Preferences ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-brand-600" />
            <CardTitle>Pricing Preferences</CardTitle>
          </div>
          <CardDescription>Adjust how vehicle buy prices are calculated</CardDescription>
        </CardHeader>
        <div className="px-6 pb-6">
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">
                Target Dealer Margin
              </label>
              <p className="text-xs text-text-secondary mb-2">
                The margin percentage used to calculate the recommended buy price. Higher margin = lower buy price.
              </p>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {[15, 20, 25, 30, 35].map((pct) => (
                    <button
                      key={pct}
                      onClick={() => setMarginPercent(pct)}
                      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                        currentMargin === pct
                          ? "bg-brand-600 text-white"
                          : "bg-surface-overlay text-text-secondary hover:bg-surface-sunken"
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={() => updateSettings.mutate({ targetMarginPercent: currentMargin })}
                  loading={updateSettings.isPending}
                  disabled={currentMargin === (orgSettings?.targetMarginPercent ?? 25)}
                >
                  {marginSaved ? <><Check className="h-3.5 w-3.5 mr-1" /> Saved</> : "Save"}
                </Button>
              </div>
              <p className="text-[11px] text-text-tertiary mt-2">
                At {currentMargin}% margin: a $10,000 retail vehicle = ${((10000 * (1 - currentMargin / 100))).toLocaleString()} max buy price (before recon)
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Checkout Success/Cancelled Banners */}
      {checkoutStatus === "success" && (
        <Card className="border-green-300 bg-green-50">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">
              Payment successful! Your bonus inspections have been added.
            </p>
          </div>
        </Card>
      )}
      {checkoutStatus === "subscription_success" && (
        <Card className="border-green-300 bg-green-50">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">
              Subscription activated! Your plan has been upgraded.
            </p>
          </div>
        </Card>
      )}
      {checkoutStatus === "cancelled" && (
        <Card className="border-yellow-300 bg-yellow-50">
          <p className="text-sm text-yellow-700">Payment was cancelled. No charges were made.</p>
        </Card>
      )}

      {/* Organization */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Organization</CardTitle>
          </div>
          <CardDescription>Your organization details</CardDescription>
        </CardHeader>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Name</span>
              <span className="font-medium">{user.org.name}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Slug</span>
              <span className="font-mono text-text-secondary">{user.org.slug}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Type</span>
              <Badge variant="info">{user.org.type}</Badge>
            </div>
            <div className="flex justify-between items-center text-sm py-2">
              <span className="text-text-secondary">Plan</span>
              <div className="flex items-center gap-2">
                <Badge variant="gradient">{user.org.subscription}</Badge>
                {subStatus?.status && subStatus.status !== "active" && (
                  <Badge variant={subStatus.status === "past_due" ? "warning" : "danger"}>
                    {subStatus.status.replace(/_/g, " ")}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Subscription Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Subscription</CardTitle>
          </div>
          <CardDescription>Manage your subscription plan</CardDescription>
        </CardHeader>

        <div className="space-y-4">
          {/* Current plan info */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Current Plan</span>
            <Badge variant="gradient">{subStatus?.tier ?? "BASE"}</Badge>
          </div>
          {hasSubscription && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Status</span>
                <Badge variant={subStatus?.status === "active" ? "success" : subStatus?.status === "past_due" ? "warning" : "danger"}>
                  {subStatus?.status?.replace(/_/g, " ") ?? "—"}
                </Badge>
              </div>
              {subStatus?.currentPeriodEnd && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Next Billing Date</span>
                  <span className="text-text-primary">
                    {new Date(subStatus.currentPeriodEnd).toLocaleDateString("en-US", {
                      month: "long", day: "numeric", year: "numeric",
                    })}
                  </span>
                </div>
              )}
            </>
          )}
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">Monthly Inspections</span>
            <span className="font-medium text-text-primary">{subStatus?.maxInspectionsPerMonth ?? 25}/mo</span>
          </div>

          {/* Manage subscription via Stripe Portal (Pro/Enterprise with active sub) */}
          {hasSubscription && (
            <>
              <Button
                onClick={() => portal.mutate()}
                loading={portal.isPending}
                variant="secondary"
                className="w-full"
              >
                <ExternalLink className="h-4 w-4" />
                Manage Subscription
              </Button>
              <p className="text-xs text-text-tertiary text-center">
                Change plan, update payment method, view invoices, or cancel
              </p>
              {portal.error && (
                <div className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-red-700 ring-1 ring-red-300">
                  {portal.error.message}
                </div>
              )}
            </>
          )}

          {/* Upgrade options — show for Base tier users */}
          {canUpgrade && (
            <>
              <div className="border-t border-border-default pt-3">
                <p className="text-sm font-medium text-text-primary mb-3">Upgrade Your Plan</p>
                <div className="grid grid-cols-1 gap-3">
                  {UPGRADE_PLANS.map((plan) => (
                    <button
                      key={plan.tier}
                      onClick={() => subscribe.mutate({ tier: plan.tier })}
                      disabled={subscribe.isPending}
                      className="flex flex-col items-center gap-1.5 rounded-lg border border-border-default p-5 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span className="text-base font-bold text-text-primary">{plan.label}</span>
                      <span className="text-sm font-semibold text-brand-gradient">{plan.inspections}</span>
                      <span className="text-xs text-text-tertiary">{plan.description}</span>
                    </button>
                  ))}
                </div>
                {subscribe.error && (
                  <div className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-red-700 ring-1 ring-red-300 mt-2">
                    {subscribe.error.message}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Enterprise contact */}
          <div className="border-t border-border-default pt-3">
            {contactSent ? (
              <div className="flex items-center justify-center gap-2 text-sm text-green-700">
                <Check className="h-4 w-4" />
                Request sent! We&apos;ll be in touch shortly.
              </div>
            ) : (
              <button
                onClick={() => requestUpgrade.mutate({})}
                disabled={requestUpgrade.isPending}
                className="flex items-center justify-center gap-2 w-full text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
              >
                <Mail className="h-3.5 w-3.5" />
                {requestUpgrade.isPending ? "Sending..." : "Contact us for an enterprise plan"}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Usage & Bonus Packs */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Usage &amp; Bonus Packs</CardTitle>
          </div>
          <CardDescription>Your inspection usage and one-time purchase options</CardDescription>
        </CardHeader>

        {usage && (
          <div className="space-y-5">
            {/* Current Usage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Monthly Inspections</span>
                <span className="font-medium text-text-primary">
                  {usage.used} / {usage.limit}
                  {usage.bonusInspections > 0 && (
                    <span className="text-text-tertiary"> (+{usage.bonusInspections} bonus)</span>
                  )}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-gradient transition-all"
                  style={{ width: `${Math.min(100, (usage.used / (usage.limit + usage.bonusInspections)) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-tertiary">
                Resets on {(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(1); return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); })()}
              </p>
            </div>

            {/* Purchase Packs */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Purchase Additional Inspections</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {PACKS.map((pack) => (
                  <button
                    key={pack.size}
                    onClick={() => checkout.mutate({ packSize: pack.size })}
                    disabled={checkout.isPending}
                    className="flex flex-col items-center gap-1 rounded-lg border border-border-default p-4 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
                  >
                    <span className="text-sm font-semibold text-text-primary">{pack.label}</span>
                    <span className="text-lg font-bold text-brand-gradient">{pack.price}</span>
                    <span className="text-xs text-text-tertiary">{pack.perUnit}</span>
                  </button>
                ))}
              </div>
              {checkout.error && (
                <div className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-red-700 ring-1 ring-red-300">
                  {checkout.error.message}
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      {/* Profile */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Profile</CardTitle>
          </div>
          <CardDescription>Your personal information</CardDescription>
        </CardHeader>
        {user && (
          <div className="space-y-3">
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Name</span>
              <span className="font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2 border-b border-border-default">
              <span className="text-text-secondary">Email</span>
              <span className="text-text-secondary">{user.email}</span>
            </div>
            <div className="flex justify-between items-center text-sm py-2">
              <span className="text-text-secondary">Role</span>
              <Badge variant="gradient">{user.role}</Badge>
            </div>
          </div>
        )}
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Change Password</CardTitle>
          </div>
          <CardDescription>Update your account password</CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (pwForm.newPassword !== pwForm.confirmPassword) return;
            changePw.mutate({ currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
          }}
          className="space-y-4"
        >
          <Input
            id="current-password"
            label="Current Password"
            type="password"
            value={pwForm.currentPassword}
            onChange={(e) => setPwForm({ ...pwForm, currentPassword: e.target.value })}
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              id="new-password"
              label="New Password"
              type="password"
              minLength={8}
              value={pwForm.newPassword}
              onChange={(e) => setPwForm({ ...pwForm, newPassword: e.target.value })}
              required
            />
            <Input
              id="confirm-password"
              label="Confirm New Password"
              type="password"
              minLength={8}
              value={pwForm.confirmPassword}
              onChange={(e) => setPwForm({ ...pwForm, confirmPassword: e.target.value })}
              required
            />
          </div>
          {pwForm.newPassword && pwForm.confirmPassword && pwForm.newPassword !== pwForm.confirmPassword && (
            <p className="text-sm text-red-600">Passwords do not match</p>
          )}
          {changePw.error && (
            <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
              {changePw.error.message}
            </div>
          )}
          {pwSuccess && (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700 ring-1 ring-green-300">
              Password changed successfully
            </div>
          )}
          <div className="flex justify-end">
            <Button
              type="submit"
              size="sm"
              loading={changePw.isPending}
              disabled={!pwForm.currentPassword || !pwForm.newPassword || pwForm.newPassword !== pwForm.confirmPassword}
            >
              Update Password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
