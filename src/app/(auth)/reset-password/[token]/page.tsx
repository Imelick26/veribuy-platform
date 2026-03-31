"use client";

/* eslint-disable @next/next/no-img-element */
import { use, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";

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

    resetPassword.mutate({ token, newPassword: password });
  }

  if (done) {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <img src="/logo.png" alt="VeriBuy" className="h-8 w-8" />
          <span className="text-xl font-bold text-brand-gradient">VeriBuy</span>
        </div>

        <h2 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Password reset</h2>
        <p className="text-text-secondary mb-6">
          Your password has been updated. You can now sign in with your new password.
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

      <h2 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Set new password</h2>
      <p className="text-text-secondary mb-8">Enter your new password below.</p>

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

        {error && (
          <div className="rounded-xl border border-border-default px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <Button type="submit" loading={resetPassword.isPending} className="w-full" size="lg">
          Reset Password
        </Button>
      </form>
    </div>
  );
}
