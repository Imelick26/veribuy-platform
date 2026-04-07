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
      "Decode any VIN to instantly surface vehicle specifications, open recalls, and known risk factors. A complete risk profile is built before the first photo is taken.",
  },
  {
    icon: Camera,
    title: "Guided Inspection Workflow",
    description:
      "A structured, step-by-step capture process ensures every vehicle is inspected to the same standard — whether the inspector is a 20-year veteran or brand new to the team.",
  },
  {
    icon: Brain,
    title: "AI Condition Scoring",
    description:
      "Computer vision analyzes every inspection photo to generate objective, auditable condition scores across four areas — removing subjectivity from the assessment process.",
  },
  {
    icon: FileCheck,
    title: "Shareable Condition Reports",
    description:
      "Generate professional PDF reports with condition scores, findings, photos, and market comparables — ready to share with buyers, sellers, lenders, or internal teams.",
  },
  {
    icon: ShieldCheck,
    title: "Real-Time Risk Intelligence",
    description:
      "NHTSA complaints, safety recalls, and known failure patterns are automatically surfaced for every vehicle — turning reactive inspections into proactive risk management.",
  },
  {
    icon: BarChart3,
    title: "Market Valuation Engine",
    description:
      "Fair acquisition pricing powered by six market data sources, regional adjustments, and condition-aware analysis — giving every stakeholder a defensible number.",
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
