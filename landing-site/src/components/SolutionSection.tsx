"use client";

import { motion } from "framer-motion";
import {
  Scan,
  FileCheck,
  Users,
  ShieldCheck,
} from "lucide-react";

const features = [
  {
    icon: Scan,
    title: "Intelligent Inspection Workflows",
    description:
      "Guided, standardized processes ensure every vehicle is assessed thoroughly and consistently — every time.",
  },
  {
    icon: FileCheck,
    title: "Comprehensive Condition Reports",
    description:
      "Generate detailed, professional reports that provide full transparency into vehicle condition and history.",
  },
  {
    icon: Users,
    title: "Real-Time Collaboration",
    description:
      "Connect teams across locations. Inspectors, managers, and stakeholders work from a single source of truth.",
  },
  {
    icon: ShieldCheck,
    title: "Risk Intelligence",
    description:
      "Surface known issues, recall data, and risk profiles automatically — before they become costly surprises.",
  },
];

export default function SolutionSection() {
  return (
    <section id="features" className="relative py-24 lg:py-32">
      {/* Background accent */}
      <div className="absolute inset-0 bg-brand-gradient-subtle" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-accent-magenta uppercase tracking-widest mb-4">
            The Solution
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            One platform.{" "}
            <span className="text-brand-gradient">Complete confidence.</span>
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            VeriBuy brings every part of vehicle verification into a single,
            intelligent platform built for the modern automotive industry.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card glass-card-hover rounded-2xl p-8 transition-all duration-300"
            >
              <div className="flex items-start gap-5">
                <div className="shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-brand-gradient">
                  <feature.icon size={24} className="text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
