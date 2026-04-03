"use client";

import { motion } from "framer-motion";
import { Lock, Server, Key, ShieldCheck, Globe, FileCheck } from "lucide-react";

const trustItems = [
  {
    icon: ShieldCheck,
    title: "Role-Based Access Control",
    description: "Five distinct roles — Super Admin, Owner, Manager, Inspector, Viewer — with strict multi-tenant isolation. All queries scoped to organization.",
  },
  {
    icon: Key,
    title: "3-Tier AI Reliability",
    description: "Every AI module uses a 3-tier pattern: primary call, simplified fallback, and deterministic heuristic. VeriBuy never silently fails.",
  },
  {
    icon: Server,
    title: "Multi-Tenant Architecture",
    description: "Built on PostgreSQL via Supabase with strict tenant isolation. Organization-scoped data, JWT sessions, and Stripe-managed billing.",
  },
  {
    icon: Globe,
    title: "6 Market Data Integrations",
    description: "Direct integration with Black Book, NADA Guides, VinAudit, MarketCheck, VehicleDatabases, and NHTSA for comprehensive vehicle intelligence.",
  },
  {
    icon: FileCheck,
    title: "Full Audit Trail",
    description: "Every AI module call is logged with module name, model used, inputs, outputs, and which reliability tier succeeded. Complete valuation transparency.",
  },
  {
    icon: Lock,
    title: "Secure Report Sharing",
    description: "PDF reports shared via unique 16-byte hex tokens with configurable expiry, view count tracking, and controlled distribution.",
  },
];

export default function NetworkSection() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-accent-pink uppercase tracking-[0.15em] mb-4">
            Enterprise Security
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Built for teams that{" "}
            <span className="text-brand-gradient">demand trust</span>
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            VeriBuy meets the security, compliance, and reliability standards
            required by enterprise automotive organizations.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {trustItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              className="glass-card rounded-2xl p-6 transition-all duration-300"
            >
              <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center mb-4">
                <item.icon size={20} className="text-accent-pink" />
              </div>
              <h3 className="text-sm font-semibold mb-1.5">{item.title}</h3>
              <p className="text-xs text-gray-500 leading-relaxed">
                {item.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
