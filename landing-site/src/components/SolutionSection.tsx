"use client";

import { motion } from "framer-motion";
import {
  Scan,
  FileCheck,
  Brain,
  ShieldCheck,
  Camera,
  BarChart3,
} from "lucide-react";

const capabilities = [
  {
    icon: Scan,
    title: "VIN Intelligence",
    description:
      "Scan any VIN to instantly verify vehicle details, recall history, and known risk factors. VeriBuy builds a complete risk profile for every vehicle before the inspection even begins.",
  },
  {
    icon: Camera,
    title: "Guided Photo Workflow",
    description:
      "Our step-by-step guided capture makes it easy for anyone — even with zero automotive experience — to complete a thorough, professional-grade vehicle inspection in minutes.",
  },
  {
    icon: Brain,
    title: "AI Condition Scoring",
    description:
      "Our proprietary AI engine analyzes every inspection photo to generate objective, auditable condition scores — giving you a trusted, unbiased picture of any vehicle's true state.",
  },
  {
    icon: FileCheck,
    title: "PDF Condition Reports",
    description:
      "Generate detailed condition reports with scores, findings, photos, and market pricing from comparable vehicles near you — everything you need to make a confident purchase decision.",
  },
  {
    icon: ShieldCheck,
    title: "Real-Time Risk Intelligence",
    description:
      "VeriBuy automatically surfaces known issues, safety recalls, and potential red flags for every vehicle — so you know exactly what to look for before you buy.",
  },
  {
    icon: BarChart3,
    title: "Market Valuation Engine",
    description:
      "Get fair acquisition pricing powered by multiple market data sources, regional adjustments, and AI-driven analysis — so you never overpay for a vehicle.",
  },
];

export default function SolutionSection() {
  return (
    <section id="platform" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-brand-gradient-subtle" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-accent-magenta uppercase tracking-[0.15em] mb-4">
            The Platform
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            From VIN to Verified{" "}
            <span className="text-brand-gradient">in Minutes.</span>
          </h2>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Every step from VIN decode to buy/pass recommendation — standardized,
            auditable, and powered by AI. No guesswork. No blind spots.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {capabilities.map((cap, i) => (
            <motion.div
              key={cap.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass-card glass-card-hover rounded-2xl p-7 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center mb-5">
                <cap.icon size={22} className="text-white" />
              </div>
              <h3 className="text-base font-semibold mb-2">{cap.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {cap.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
