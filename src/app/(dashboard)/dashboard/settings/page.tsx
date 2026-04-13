"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { trpc } from "@/lib/trpc";
import { Building2, Users, CreditCard, Lock, Check, Mail, ExternalLink, Zap } from "lucide-react";
import { getConditionMarginPct } from "@/components/report/MarketAnalysisSection";

const PLANS = [
  { tier: "CORE" as const, label: "Core", price: "$299/mo", inspections: "10/mo" },
  { tier: "BASE" as const, label: "Base", price: "$599/mo", inspections: "50/mo" },
  { tier: "PRO" as const, label: "Pro", price: "$1,299/mo", inspections: "125/mo", popular: true },
  { tier: "ENTERPRISE" as const, label: "Enterprise", price: "$3,999/mo", inspections: "400/mo" },
] as const;

const OVERAGE_DISPLAY: Record<string, string> = {
  CORE: "$19.99",
  BASE: "$14.99",
  PRO: "$11.99",
  ENTERPRISE: "$9.99",
};

export default function SettingsPage() {
  const { data: user } = trpc.auth.me.useQuery();
  const { data: usage } = trpc.inspection.usageStats.useQuery();
  const { data: subStatus } = trpc.billing.getSubscriptionStatus.useQuery();
  const searchParams = useSearchParams();
  const checkoutStatus = searchParams.get("checkout");
  const [contactSent, setContactSent] = useState(false);

  const purchaseReport = trpc.billing.purchaseAdditionalReport.useMutation({
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
  const [minProfit, setMinProfit] = useState<string>("");
  const [marginSaved, setMarginSaved] = useState(false);
  const updateSettings = trpc.auth.updateOrgSettings.useMutation({
    onSuccess: () => {
      setMarginSaved(true);
      setTimeout(() => setMarginSaved(false), 3000);
    },
  });
  const currentMargin = marginPercent ?? orgSettings?.targetMarginPercent ?? 20;
  const currentMinProfit = minProfit !== "" ? Math.round(parseFloat(minProfit) * 100) : (orgSettings?.minProfitPerUnit ?? 150000);
  const currentMinProfitDollars = currentMinProfit / 100;

  const hasSubscription = subStatus?.hasSubscription;
  const currentTier = subStatus?.tier ?? "CORE";
  const tierOrder = ["CORE", "BASE", "PRO", "ENTERPRISE"];
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const upgradePlans = PLANS.filter((_, i) => i > currentTierIndex);
  const overagePrice = OVERAGE_DISPLAY[currentTier] ?? "$19.99";

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
          <div className="space-y-5">
            {/* Pricing Strategy */}
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">
                Pricing Strategy
              </label>
              <p className="text-xs text-text-secondary mb-3">
                Controls your margin on each vehicle. More aggressive = higher margins, more profit per car. More conservative = thinner margins, easier to close deals.
              </p>
              <div className="flex items-center gap-1">
                {([
                  { label: "Aggressive", pct: 35, desc: "Max profit" },
                  { label: "Moderate", pct: 30, desc: "Strong margins" },
                  { label: "Standard", pct: 25, desc: "Balanced" },
                  { label: "Conservative", pct: 20, desc: "Competitive" },
                  { label: "Minimal", pct: 15, desc: "Win deals" },
                ] as const).map(({ label, pct, desc }) => (
                  <button
                    key={pct}
                    onClick={() => setMarginPercent(pct)}
                    className={`flex-1 px-2 py-2.5 rounded-lg text-center transition-colors ${
                      currentMargin === pct
                        ? "bg-text-primary text-white"
                        : "bg-surface-overlay text-text-secondary hover:bg-surface-sunken"
                    }`}
                  >
                    <p className={`text-xs font-semibold ${currentMargin === pct ? "text-white" : "text-text-primary"}`}>{label}</p>
                    <p className={`text-[10px] mt-0.5 ${currentMargin === pct ? "text-white/70" : "text-text-tertiary"}`}>{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Condition → Margin Preview */}
            <div>
              <p className="text-xs text-text-secondary mb-2">
                Margin scales automatically based on vehicle condition score. Easy flips get thinner margins, project cars get wider margins.
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {([
                  { label: "Excellent", score: "85+", color: "bg-green-50 border-green-200 text-green-700", example: "Clean, low miles" },
                  { label: "Good", score: "70-84", color: "bg-green-50 border-green-200 text-green-700", example: "Solid, minor wear" },
                  { label: "Fair", score: "60-69", color: "bg-surface-overlay border-border-default text-text-secondary", example: "Needs work" },
                  { label: "Poor", score: "<60", color: "bg-red-50 border-red-200 text-red-700", example: "Heavy recon" },
                ] as const).map(({ label, score, color, example }) => {
                  const pct = getConditionMarginPct(currentMargin, label === "Excellent" ? 90 : label === "Good" ? 75 : label === "Fair" ? 65 : 50);
                  return (
                    <div key={label} className={`rounded-lg border px-2.5 py-2 text-center ${color}`}>
                      <p className="font-bold text-lg">{pct}%</p>
                      <p className="text-[10px] font-semibold">{label}</p>
                      <p className="text-[9px] opacity-60">{example}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Minimum Profit Floor */}
            <div>
              <label className="text-sm font-medium text-text-primary block mb-1">
                Minimum Profit Per Vehicle
              </label>
              <p className="text-xs text-text-secondary mb-2">
                Safety net for low-value vehicles. If the condition-based margin produces less than this amount, this floor is used instead.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm text-text-secondary">$</span>
                <input
                  type="number"
                  value={minProfit !== "" ? minProfit : (orgSettings?.minProfitPerUnit ? (orgSettings.minProfitPerUnit / 100).toString() : "1500")}
                  onChange={(e) => setMinProfit(e.target.value)}
                  className="w-32 text-sm bg-white border border-border-default rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-600"
                  min={0}
                  step={100}
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={() => updateSettings.mutate({
                targetMarginPercent: currentMargin,
                minProfitPerUnit: currentMinProfit,
              })}
              loading={updateSettings.isPending}
              disabled={
                currentMargin === (orgSettings?.targetMarginPercent ?? 20) &&
                currentMinProfit === (orgSettings?.minProfitPerUnit ?? 150000)
              }
            >
              {marginSaved ? <><Check className="h-3.5 w-3.5 mr-1" /> Saved</> : "Save"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Checkout Success/Cancelled Banners */}
      {checkoutStatus === "success" && (
        <Card className="border-border-default border-l-4 border-l-green-500">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">
              Payment successful! Your bonus inspections have been added.
            </p>
          </div>
        </Card>
      )}
      {checkoutStatus === "subscription_success" && (
        <Card className="border-border-default border-l-4 border-l-green-500">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-600" />
            <p className="text-sm text-green-700 font-medium">
              Subscription activated! Your plan has been upgraded.
            </p>
          </div>
        </Card>
      )}
      {checkoutStatus === "cancelled" && (
        <Card className="border-border-default border-l-4 border-l-caution-400">
          <p className="text-sm text-caution-600">Payment was cancelled. No charges were made.</p>
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
            <Badge variant="gradient">{subStatus?.tier ?? "CORE"}</Badge>
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
            <span className="font-medium text-text-primary">{subStatus?.maxInspectionsPerMonth ?? 0}/mo</span>
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
                <div className="rounded-lg border border-border-default px-3 py-2 text-sm text-red-600">
                  {portal.error.message}
                </div>
              )}
            </>
          )}

          {/* Upgrade options — show higher tiers */}
          {upgradePlans.length > 0 && (
            <>
              <div className="border-t border-border-default pt-3">
                <p className="text-sm font-medium text-text-primary mb-3">Upgrade Your Plan</p>
                <p className="text-xs text-text-tertiary mb-3">All plans billed annually</p>
                <div className="grid grid-cols-1 gap-3">
                  {upgradePlans.map((plan) => (
                    <button
                      key={plan.tier}
                      onClick={() => subscribe.mutate({ tier: plan.tier })}
                      disabled={subscribe.isPending}
                      className="flex items-center justify-between rounded-lg border border-border-default p-4 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base font-bold text-text-primary">{plan.label}</span>
                        {"popular" in plan && plan.popular && (
                          <span className="text-[10px] font-semibold bg-brand-500 text-white px-1.5 py-0.5 rounded">POPULAR</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-semibold text-text-primary">{plan.price}</span>
                        <span className="text-xs text-text-tertiary ml-1">({plan.inspections})</span>
                      </div>
                    </button>
                  ))}
                </div>
                {subscribe.error && (
                  <div className="rounded-lg border border-border-default px-3 py-2 text-sm text-red-600 mt-2">
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
                {requestUpgrade.isPending ? "Sending..." : "Contact us about custom plans"}
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Usage & Additional Reports */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-text-tertiary" />
            <CardTitle>Usage &amp; Additional Reports</CardTitle>
          </div>
          <CardDescription>Your inspection usage and per-report purchase option</CardDescription>
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
              {(usage.limit + usage.bonusInspections) > 0 && (
                <div className="h-2 rounded-full bg-surface-overlay overflow-hidden">
                  <div
                    className="h-full rounded-full bg-brand-gradient transition-all"
                    style={{ width: `${Math.min(100, (usage.used / (usage.limit + usage.bonusInspections)) * 100)}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-text-tertiary">
                Resets on {(() => { const d = new Date(); d.setMonth(d.getMonth() + 1); d.setDate(1); return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }); })()}
              </p>
            </div>

            {/* Purchase Additional Report */}
            <div className="space-y-2">
              <p className="text-sm font-medium text-text-primary">Purchase Additional Report</p>
              <button
                onClick={() => purchaseReport.mutate()}
                disabled={purchaseReport.isPending}
                className="flex flex-col items-center gap-1 w-full rounded-lg border border-border-default p-4 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="text-sm font-semibold text-text-primary">1 Additional Report</span>
                <span className="text-lg font-bold text-text-primary">{overagePrice}</span>
                <span className="text-xs text-text-tertiary">Based on your {currentTier} plan</span>
              </button>
              {purchaseReport.error && (
                <div className="rounded-lg border border-border-default px-3 py-2 text-sm text-red-600">
                  {purchaseReport.error.message}
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
            <div className="rounded-lg border border-border-default px-4 py-3 text-sm text-red-600">
              {changePw.error.message}
            </div>
          )}
          {pwSuccess && (
            <div className="rounded-lg border border-border-default px-4 py-3 text-sm text-green-600">
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
