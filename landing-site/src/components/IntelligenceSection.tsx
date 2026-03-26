"use client";

import { motion } from "framer-motion";
import { Brain, Camera, FileSearch, Fingerprint } from "lucide-react";

const capabilities = [
  {
    icon: Fingerprint,
    label: "VIN Data Analysis",
  },
  {
    icon: Camera,
    label: "Photo & Video Processing",
  },
  {
    icon: FileSearch,
    label: "Inspection Input Analysis",
  },
  {
    icon: Brain,
    label: "Risk Signal Detection",
  },
];

export default function IntelligenceSection() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm font-medium text-accent-magenta uppercase tracking-widest mb-4">
              The Intelligence Layer
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Vehicle Condition{" "}
              <span className="text-brand-gradient">Intelligence</span>
            </h2>
            <p className="text-lg text-gray-400 leading-relaxed">
              VeriBuy analyzes VIN data, photos, videos, and inspection inputs
              to generate standardized condition intelligence and risk signals
              for every vehicle.
            </p>
          </motion.div>

          {/* Right — Capabilities grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className="glass-card glass-card-hover rounded-2xl p-6 text-center transition-all duration-300"
              >
                <div className="mx-auto mb-4 w-12 h-12 rounded-xl bg-brand-gradient flex items-center justify-center">
                  <cap.icon size={24} className="text-white" />
                </div>
                <p className="text-sm font-medium text-gray-300">{cap.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
