"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Clock, EyeOff, TrendingDown } from "lucide-react";

const problems = [
  {
    icon: AlertTriangle,
    stat: "Billions",
    statLabel: "lost annually",
    title: "Inconsistent Inspections",
    description:
      "Every inspector, every dealership, every platform does it differently. Subjective assessments lead to missed issues, inflated ratings, and costly post-sale disputes.",
  },
  {
    icon: EyeOff,
    stat: "Low",
    statLabel: "buyer trust in listings",
    title: "No Single Source of Truth",
    description:
      "Buyers, dealers, lenders, and insurers all operate on incomplete data. Without a shared verification standard, trust erodes and transactions stall.",
  },
  {
    icon: Clock,
    stat: "Hours",
    statLabel: "per manual inspection",
    title: "Manual, Error-Prone Workflows",
    description:
      "Paper forms, disconnected spreadsheets, and phone-camera photos waste hours per vehicle and still miss critical details that surface after purchase.",
  },
  {
    icon: TrendingDown,
    stat: "High",
    statLabel: "preventable claim rates",
    title: "Avoidable Risk Exposure",
    description:
      "Without proactive risk intelligence, lenders approve loans on vehicles with hidden damage and insurers underwrite policies without complete condition data.",
  },
];

export default function ProblemSection() {
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
            The Industry Problem
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Vehicle verification is fundamentally broken
          </h2>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Hundreds of billions in used vehicle transactions occur annually
            in the U.S. alone, yet condition verification still relies on
            fragmented, manual processes.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {problems.map((problem, i) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card glass-card-hover rounded-2xl p-8 transition-all duration-300"
            >
              <div className="flex items-start gap-5">
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                    <problem.icon size={22} className="text-red-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">{problem.stat}</div>
                  <div className="text-[10px] text-gray-600 uppercase tracking-wider mt-0.5">{problem.statLabel}</div>
                </div>
                <div className="pt-1">
                  <h3 className="text-lg font-semibold mb-2">{problem.title}</h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {problem.description}
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
