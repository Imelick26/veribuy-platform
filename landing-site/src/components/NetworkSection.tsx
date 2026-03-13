"use client";

import { motion } from "framer-motion";
import { Building2, Users } from "lucide-react";

const participants = [
  { icon: Building2, label: "Dealers" },
  { icon: Users, label: "Consumers" },
];

export default function NetworkSection() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-brand-gradient-subtle" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-accent-pink uppercase tracking-widest mb-4">
            The Network
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            A Shared{" "}
            <span className="text-brand-gradient">Verification Layer</span>
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-3xl mx-auto leading-relaxed">
            VeriBuy creates a shared verification layer where inspections
            generate standardized vehicle condition data that can be trusted
            by dealers and consumers.
          </p>
        </motion.div>

        {/* Participant cards */}
        <div className="flex flex-wrap items-center justify-center gap-6">
          {participants.map((p, i) => (
            <motion.div
              key={p.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="glass-card rounded-2xl px-8 py-6 flex items-center gap-4 min-w-[180px]"
            >
              <div className="w-10 h-10 rounded-xl bg-brand-gradient flex items-center justify-center shrink-0">
                <p.icon size={20} className="text-white" />
              </div>
              <span className="text-base font-medium text-gray-200">
                {p.label}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Connecting visual */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-6 py-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-sm text-gray-400">
              One inspection. Trusted everywhere.
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
