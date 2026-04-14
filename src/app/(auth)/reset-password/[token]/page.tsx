"use client";

/* eslint-disable @next/next/no-img-element */
import { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { ChevronDown, ChevronUp } from "lucide-react";

const AGREEMENT_VERSION = "2026-04-14";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);
  const [agreementExpanded, setAgreementExpanded] = useState(false);
  const [agreementHtml, setAgreementHtml] = useState("");

  // Check if this is a new account setup (never logged in) vs regular password reset
  const { data: tokenInfo } = trpc.auth.checkResetToken.useQuery({ token });
  const isNewAccount = tokenInfo?.isNewAccount ?? false;

  // Load the agreement markdown
  useEffect(() => {
    if (!isNewAccount) return;
    fetch("/veribuy-service-agreement.md")
      .then((r) => r.text())
      .then((md) => {
        // Simple markdown-to-html for display (headings, bold, lists, paragraphs)
        const html = md
          .replace(/^### (.+)$/gm, '<h4 class="font-semibold text-text-primary mt-4 mb-1 text-sm">$1</h4>')
          .replace(/^## (.+)$/gm, '<h3 class="font-bold text-text-primary mt-5 mb-2 text-base">$1</h3>')
          .replace(/^# (.+)$/gm, '<h2 class="font-bold text-text-primary mt-6 mb-2 text-lg">$1</h2>')
          .replace(/\*\*"([^"]+)"\*\*/g, '<strong>"$1"</strong>')
          .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
          .replace(/^\- (.+)$/gm, '<li class="ml-4 text-xs text-text-secondary">• $1</li>')
          .replace(/^\*(.+)\*$/gm, '<em class="text-xs text-text-tertiary">$1</em>')
          .replace(/\n\n/g, '<br class="mb-2" />');
        setAgreementHtml(html);
      })
      .catch(() => {});
  }, [isNewAccount]);

  const resetPassword = trpc.auth.resetPassword.useMutation({
    onSuccess: () => setDone(true),
    onError: (err) => setError(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirm) {
      setError("Passwords don't match");
      return;
    }

    if (isNewAccount && !agreementAccepted) {
      setError("Please accept the VeriBuy Service Agreement to continue");
      return;
    }

    resetPassword.mutate({
      token,
      newPassword: password,
      ...(isNewAccount ? { acceptAgreement: true, agreementVersion: AGREEMENT_VERSION } : {}),
    });
  }

  if (done) {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <img src="/logo.png" alt="VeriBuy" className="h-8 w-8" />
          <span className="text-xl font-bold text-brand-gradient">VeriBuy</span>
        </div>

        <h2 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">
          {isNewAccount ? "You're all set!" : "Password reset"}
        </h2>
        <p className="text-text-secondary mb-6">
          {isNewAccount
            ? "Your account is ready. Sign in to start inspecting vehicles."
            : "Your password has been updated. You can now sign in with your new password."}
        </p>
        <Link href="/login">
          <Button className="w-full" size="lg">
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2.5 mb-8 lg:hidden">
        <img src="/logo.png" alt="VeriBuy" className="h-8 w-8" />
        <span className="text-xl font-bold text-brand-gradient">VeriBuy</span>
      </div>

      <h2 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">
        {isNewAccount ? "Set up your account" : "Set new password"}
      </h2>
      <p className="text-text-secondary mb-8">
        {isNewAccount
          ? "Create your password and accept the service agreement to get started."
          : "Enter your new password below."}
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="password"
          label="New Password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <Input
          id="confirm"
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={8}
        />

        {/* Service Agreement — only for new accounts */}
        {isNewAccount && (
          <div className="space-y-3">
            <div className="border border-border-default rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setAgreementExpanded(!agreementExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-surface-sunken hover:bg-surface-overlay transition-colors"
              >
                <span className="text-sm font-medium text-text-primary">VeriBuy Service Agreement</span>
                {agreementExpanded
                  ? <ChevronUp className="h-4 w-4 text-text-tertiary" />
                  : <ChevronDown className="h-4 w-4 text-text-tertiary" />
                }
              </button>
              {agreementExpanded && (
                <div
                  className="px-4 py-3 max-h-80 overflow-y-auto text-xs text-text-secondary leading-relaxed border-t border-border-default"
                  dangerouslySetInnerHTML={{ __html: agreementHtml }}
                />
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={agreementAccepted}
                onChange={(e) => setAgreementAccepted(e.target.checked)}
                className="mt-0.5 rounded border-border-default"
              />
              <span className="text-sm text-text-secondary">
                I have read and agree to the{" "}
                <button
                  type="button"
                  onClick={() => setAgreementExpanded(true)}
                  className="text-brand-500 hover:text-brand-600 underline"
                >
                  VeriBuy Service Agreement
                </button>{" "}
                on behalf of my organization.
              </span>
            </label>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-border-default px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <Button type="submit" loading={resetPassword.isPending} className="w-full" size="lg">
          {isNewAccount ? "Create Account" : "Reset Password"}
        </Button>
      </form>
    </div>
  );
}
