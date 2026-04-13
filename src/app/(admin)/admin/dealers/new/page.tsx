"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { trpc } from "@/lib/trpc";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NewDealerPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    orgName: "",
    orgType: "DEALER" as "DEALER" | "INSPECTOR_FIRM" | "INSURANCE" | "INDIVIDUAL",
    ownerName: "",
    ownerEmail: "",
    ownerPassword: "",
    subscription: "CORE" as "CORE" | "BASE" | "PRO" | "ENTERPRISE",
    maxInspectionsPerMonth: 10,
  });

  const create = trpc.admin.createOrg.useMutation({
    onSuccess: (data) => router.push(`/admin/dealers/${data.orgId}`),
  });

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

      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>Set up the dealer and their owner account</CardDescription>
        </CardHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
          className="space-y-5"
        >
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

          <Input
            id="owner-password"
            label="Initial Password"
            type="text"
            placeholder="Secure password for the owner"
            value={form.ownerPassword}
            onChange={(e) => setForm({ ...form, ownerPassword: e.target.value })}
            required
            minLength={8}
          />

          <hr className="border-border-default" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-text-secondary">Plan</label>
              <select
                value={form.subscription}
                onChange={(e) => setForm({ ...form, subscription: e.target.value as typeof form.subscription })}
                className="block w-full rounded-lg border border-border-default bg-surface-sunken px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 focus:ring-offset-surface-overlay transition-colors"
              >
                <option value="CORE">Core</option>
                <option value="BASE">Base</option>
                <option value="PRO">Pro</option>
                <option value="ENTERPRISE">Enterprise</option>
              </select>
            </div>
            <Input
              id="max-inspections"
              label="Inspections / Month"
              type="number"
              min={1}
              value={form.maxInspectionsPerMonth}
              onChange={(e) => setForm({ ...form, maxInspectionsPerMonth: parseInt(e.target.value) || 1 })}
              required
            />
          </div>

          {create.error && (
            <div className="rounded-lg bg-[#fde8e8] px-4 py-3 text-sm text-red-700 ring-1 ring-red-300">
              {create.error.message}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Link href="/admin">
              <Button type="button" variant="secondary" size="sm">Cancel</Button>
            </Link>
            <Button type="submit" size="sm" loading={create.isPending}>
              Create Dealer
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
