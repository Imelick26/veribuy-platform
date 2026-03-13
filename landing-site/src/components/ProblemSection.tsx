"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Clock, EyeOff } from "lucide-react";

const problems = [
  {
    icon: AlertTriangle,
    title: "Inconsistent Inspections",
    description:
      "Every inspector does it differently. Subjective assessments lead to missed issues and unreliable condition reports.",
  },
  {
    icon: EyeOff,
    title: "Zero Transparency",
    description:
      "Buyers, dealers, and insurers lack a single source of truth. Incomplete data breeds distrust and costly disputes.",
  },
  {
    icon: Clock,
    title: "Manual & Error-Prone",
    description:
      "Paper forms, spreadsheets, and disconnected tools waste hours per vehicle — and still miss critical details.",
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
          <p className="text-sm font-medium text-accent-pink uppercase tracking-widest mb-4">
            The Problem
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            The industry is broken
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Over $1 trillion in vehicle transactions occur annually, yet vehicle
            condition is still verified using inconsistent manual processes.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {problems.map((problem, i) => (
            <motion.div
              key={problem.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="glass-card glass-card-hover rounded-2xl p-8 transition-all duration-300"
            >
              <div className="mb-6 inline-flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10">
                <problem.icon size={24} className="text-red-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3">{problem.title}</h3>
              <p className="text-gray-400 leading-relaxed">
                {problem.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
