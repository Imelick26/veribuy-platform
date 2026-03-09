"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Shield } from "lucide-react";
import { trpc } from "@/lib/trpc";

const ORG_TYPES = [
  { value: "DEALER", label: "Dealership" },
  { value: "INSPECTOR_FIRM", label: "Inspection Firm" },
  { value: "INSURANCE", label: "Insurance Company" },
  { value: "INDIVIDUAL", label: "Individual Buyer" },
] as const;

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    orgName: "",
    orgType: "DEALER" as "DEALER" | "INSPECTOR_FIRM" | "INSURANCE" | "INDIVIDUAL",
  });
  const [error, setError] = useState("");

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      // Auto sign-in after registration
      await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      router.push("/dashboard");
      router.refresh();
    },
    onError: (err) => {
      setError(err.message);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    registerMutation.mutate(form);
  }

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-8 lg:hidden">
        <Shield className="h-7 w-7 text-blue-600" />
        <span className="text-xl font-bold">VeriBuy</span>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-2">Create your account</h2>
      <p className="text-gray-500 mb-8">Get started with VeriBuy in minutes</p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Input
          id="name"
          label="Your Name"
          placeholder="John Smith"
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          required
        />
        <Input
          id="email"
          label="Email"
          type="email"
          placeholder="you@company.com"
          value={form.email}
          onChange={(e) => update("email", e.target.value)}
          required
        />
        <Input
          id="password"
          label="Password"
          type="password"
          placeholder="Min 8 characters"
          value={form.password}
          onChange={(e) => update("password", e.target.value)}
          required
          minLength={8}
        />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Organization Name
          </label>
          <input
            type="text"
            placeholder="Premier Ford"
            value={form.orgName}
            onChange={(e) => update("orgName", e.target.value)}
            required
            className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">
            Organization Type
          </label>
          <select
            value={form.orgType}
            onChange={(e) => update("orgType", e.target.value)}
            className="block w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          >
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        <Button
          type="submit"
          loading={registerMutation.isPending}
          className="w-full"
          size="lg"
        >
          Create Account
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-blue-600 hover:text-blue-500">
          Sign in
        </Link>
      </p>
    </div>
  );
}
