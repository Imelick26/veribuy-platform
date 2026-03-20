"use client";

import { useState } from "react";
import { Gauge, Mail, Check, Zap, ExternalLink } from "lucide-react";
import { trpc } from "@/lib/trpc";
import Link from "next/link";

const PACKS = [
  { size: 1 as const, label: "1 Inspection", price: "$39.99", perUnit: "$39.99/ea" },
  { size: 3 as const, label: "3 Inspections", price: "$99.99", perUnit: "$33.33/ea" },
  { size: 10 as const, label: "10 Inspections", price: "$249.99", perUnit: "$25.00/ea" },
];

const UPGRADE_PLANS = [
  { tier: "PRO" as const, label: "Pro", inspections: "100/mo", description: "For growing operations" },
];

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  usage: { used: number; limit: number; bonusInspections: number };
}

export function UpgradeModal({ open, onClose, usage }: UpgradeModalProps) {
  const [contactSent, setContactSent] = useState(false);
  const { data: subStatus } = trpc.billing.getSubscriptionStatus.useQuery();

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
  const requestUpgrade = trpc.billing.requestUpgrade.useMutation({
    onSuccess: () => setContactSent(true),
  });

  if (!open) return null;

  const canUpgrade = !subStatus?.hasSubscription || subStatus?.tier === "BASE";

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

        {/* Upgrade to Pro — for Base tier users */}
        {canUpgrade && (
          <div className="mb-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Zap className="h-3.5 w-3.5 text-brand-500" />
              <p className="text-sm font-medium text-text-primary">Upgrade to Pro</p>
            </div>
            <div className="grid grid-cols-1 gap-2 mb-2">
              {UPGRADE_PLANS.map((plan) => (
                <button
                  key={plan.tier}
                  onClick={() => subscribe.mutate({ tier: plan.tier })}
                  disabled={subscribe.isPending}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border-default p-3 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
                >
                  <span className="text-sm font-bold text-text-primary">{plan.label}</span>
                  <span className="text-sm font-semibold text-brand-gradient">{plan.inspections}</span>
                  <span className="text-xs text-text-tertiary">{plan.description}</span>
                </button>
              ))}
            </div>
            {subscribe.error && (
              <div className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-red-700 ring-1 ring-red-300 mb-2">
                {subscribe.error.message}
              </div>
            )}
            <div className="border-t border-border-default my-3" />
            <p className="text-xs text-text-tertiary text-center mb-2">Or buy inspections individually</p>
          </div>
        )}

        {/* Manage Subscription link — for Pro/Enterprise subscribers */}
        {!canUpgrade && (
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
            <p className="text-xs text-text-tertiary text-center mb-2">Purchase additional inspections</p>
          </div>
        )}

        {/* Pack Cards */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {PACKS.map((pack) => (
            <button
              key={pack.size}
              onClick={() => checkout.mutate({ packSize: pack.size })}
              disabled={checkout.isPending}
              className="flex flex-col items-center gap-1 rounded-lg border border-border-default p-3 hover:border-brand-500 hover:bg-surface-hover transition-all cursor-pointer disabled:opacity-50"
            >
              <span className="text-sm font-semibold text-text-primary">{pack.label}</span>
              <span className="text-lg font-bold text-brand-gradient">{pack.price}</span>
              <span className="text-xs text-text-tertiary">{pack.perUnit}</span>
            </button>
          ))}
        </div>

        {checkout.error && (
          <div className="rounded-lg bg-[#fde8e8] px-3 py-2 text-sm text-red-700 ring-1 ring-red-300 mb-3">
            {checkout.error.message}
          </div>
        )}

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
              {requestUpgrade.isPending ? "Sending..." : "Contact us for an enterprise plan"}
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
