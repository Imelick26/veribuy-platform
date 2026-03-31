"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const requestReset = trpc.auth.requestPasswordReset.useMutation({
    onSuccess: () => setSent(true),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    requestReset.mutate({ email });
  }

  if (sent) {
    return (
      <div>
        <div className="flex items-center gap-2.5 mb-8 lg:hidden">
          <img src="/logo.png" alt="VeriBuy" className="h-8 w-8" />
          <span className="text-xl font-bold text-brand-gradient">VeriBuy</span>
        </div>

        <h2 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Check your email</h2>
        <p className="text-text-secondary mb-6">
          If an account exists for <strong>{email}</strong>, we sent a password reset link. It expires in 1 hour.
        </p>
        <Link href="/login">
          <Button variant="secondary" className="w-full" size="lg">
            Back to Sign In
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

      <h2 className="text-3xl font-bold text-text-primary mb-2 tracking-tight">Forgot password?</h2>
      <p className="text-text-secondary mb-8">Enter your email and we'll send you a reset link.</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <Button type="submit" loading={requestReset.isPending} className="w-full" size="lg">
          Send Reset Link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-text-secondary">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-text-primary underline hover:opacity-80 transition-opacity">
          Sign in
        </Link>
      </p>
    </div>
  );
}
