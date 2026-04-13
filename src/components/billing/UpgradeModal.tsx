"use client";

import { useState } from "react";
import { Gauge, Mail, Check, Zap, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

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

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  usage: { used: number; limit: number; bonusInspections: number };
}

export function UpgradeModal({ open, onClose, usage }: UpgradeModalProps) {
  const [contactSent, setContactSent] = useState(false);
  const { data: subStatus } = trpc.billing.getSubscriptionStatus.useQuery();

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
  const requestUpgrade = trpc.billing.requestUpgrade.useMutation({
    onSuccess: () => setContactSent(true),
  });

  if (!open) return null;

  const currentTier = subStatus?.tier ?? "CORE";
  const tierOrder = ["CORE", "BASE", "PRO", "ENTERPRISE"];
  const currentTierIndex = tierOrder.indexOf(currentTier);
  const upgradePlans = PLANS.filter((_, i) => i > currentTierIndex);
  const overagePrice = OVERAGE_DISPLAY[currentTier] ?? "$19.99";

  const resetDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    d.setDate(1);
    return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  })();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-surface-raised rounded-xl border border-border-default shadow-xl max-w-md w-full mx-4 p-6">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#fde8e8]">
            <Gauge className="h-5 w-5 text-red-600" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary mb-1">Inspection Limit Reached</h3>
          <p className="text-sm text-text-secondary mb-1">
            Your organization has used <strong>{usage.used}</strong> of <strong>{usage.limit}</strong> inspections this month.
            {usage.bonusInspections > 0 && (
              <> ({usage.bonusInspections} bonus remaining)</>
            )}
          </p>
          <p className="text-sm text-text-secondary mb-4">
            Resets on <strong>{resetDate}</strong>.
          </p>
        </div>

        {/* Upgrade options — show higher tiers */}
        {upgradePlans.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-brand-500" />
              <p className="text-sm font-medium text-text-primary">Upgrade Your Plan</p>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-2">
              {upgradePlans.map((plan) => (
                <button
                  key={plan.tier}
                  onClick={() => subscribe.mutate({ tier: plan.tier })}
                  disabled={subscribe.isPending}
                  className="flex items-center justify-between rounded-lg border border-border-default p-3 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-text-primary">{plan.label}</span>
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
              <div className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-red-700 ring-1 ring-red-300 mb-2">
                {subscribe.error.message}
              </div>
            )}
            <div className="border-t border-border-default my-3" />
          </div>
        )}

        {/* Manage Subscription link — for subscribers who are already on highest tier */}
        {upgradePlans.length === 0 && subStatus?.hasSubscription && (
          <div className="mb-4">
            <Link
              href="/dashboard/settings"
              onClick={() => { onClose(); setContactSent(false); }}
              className="flex items-center justify-center gap-2 w-full text-sm font-medium text-brand-500 hover:text-brand-600 transition-colors mb-3"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Manage Subscription in Settings
            </Link>
            <div className="border-t border-border-default my-3" />
          </div>
        )}

        {/* Buy Additional Report */}
        <div className="mb-4">
          <p className="text-xs text-text-tertiary text-center mb-2">Or buy an additional report</p>
          <button
            onClick={() => purchaseReport.mutate()}
            disabled={purchaseReport.isPending}
            className="flex flex-col items-center gap-1 w-full rounded-lg border border-border-default p-4 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
          >
            <span className="text-sm font-semibold text-text-primary">1 Additional Report</span>
            <span className="text-lg font-bold text-brand-gradient">{overagePrice}</span>
          </button>
          {purchaseReport.error && (
            <div className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-red-700 ring-1 ring-red-300 mt-2">
              {purchaseReport.error.message}
            </div>
          )}
        </div>

        {/* Contact Us */}
        <div className="border-t border-border-default pt-3 mb-3">
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

        <button
          onClick={() => { onClose(); setContactSent(false); }}
          className="w-full text-sm text-text-tertiary hover:text-text-secondary transition-colors cursor-pointer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
