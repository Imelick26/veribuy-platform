"use client";

import { motion } from "framer-motion";
import { Search, Camera, BarChart3, FileCheck } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Decode",
    subtitle: "VIN Intelligence + Risk Profile",
    description:
      "Enter or OCR-scan a VIN. NHTSA decode pulls full specs while our AI risk summarizer builds a vehicle-specific known-issues checklist from complaints, recalls, and curated data.",
  },
  {
    number: "02",
    icon: Camera,
    title: "Capture",
    subtitle: "21-Photo Guided Walkthrough",
    description:
      "Walk through a guided 21-photo capture — exterior, interior, and mechanical — with auto-advance, speech-to-text notes, and questions-first risk inspection.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Analyze",
    subtitle: "AI Scoring + Market Valuation",
    description:
      "OpenAI Vision scores condition across 4 areas. 15 AI modules process 6 market data sources to produce fair acquisition pricing, recon estimates, and a buy/pass recommendation.",
  },
  {
    number: "04",
    icon: FileCheck,
    title: "Report",
    subtitle: "PDF Generation + Sharing",
    description:
      "Generate a comprehensive PDF report with scores, findings, photos, market analysis, and deal rating. Share via unique token links with expiry controls.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-20"
        >
          <p className="text-sm font-medium text-accent-pink uppercase tracking-[0.15em] mb-4">
            How It Works
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            From VIN to verified in{" "}
            <span className="text-brand-gradient">minutes</span>
          </h2>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            A streamlined process that replaces hours of manual work
            with AI-powered inspection, scoring, and valuation.
          </p>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-24 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-600/20 to-transparent" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.15 }}
                className="relative text-center"
              >
                {/* Step icon */}
                <div className="relative z-10 mx-auto mb-6 w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand-glow">
                  <step.icon size={28} className="text-white" />
                </div>

                {/* Number badge */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1.5 w-6 h-6 rounded-full bg-[#1a1a2e] border-2 border-accent-pink flex items-center justify-center text-[10px] font-bold z-20">
                  {step.number}
                </div>

                <h3 className="text-xl font-bold mb-1">{step.title}</h3>
                <p className="text-xs text-accent-magenta font-medium uppercase tracking-wider mb-3">
                  {step.subtitle}
                </p>
                <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
