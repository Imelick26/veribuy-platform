"use client";

import { motion } from "framer-motion";
import { Search, ClipboardCheck, BarChart3 } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Decode",
    description:
      "Enter any VIN to instantly decode vehicle specifications, pull recall history, and surface known risk profiles.",
  },
  {
    number: "02",
    icon: ClipboardCheck,
    title: "Inspect",
    description:
      "Follow guided, standardized workflows that ensure thorough and consistent assessments across every vehicle and every inspector.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Report",
    description:
      "Generate comprehensive, professional condition reports with scoring, findings, and actionable insights — in seconds.",
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
          <p className="text-sm font-medium text-accent-pink uppercase tracking-widest mb-4">
            How It Works
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Three steps to{" "}
            <span className="text-brand-gradient">complete clarity</span>
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-600/30 to-transparent -translate-y-1/2" />

          <div className="grid lg:grid-cols-3 gap-12 lg:gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: i * 0.2 }}
                className="relative text-center"
              >
                {/* Step number */}
                <div className="relative z-10 mx-auto mb-8 w-20 h-20 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand-glow">
                  <step.icon size={32} className="text-white" />
                </div>

                {/* Number badge */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 w-7 h-7 rounded-full bg-black border-2 border-accent-pink flex items-center justify-center text-xs font-bold z-20">
                  {step.number}
                </div>

                <h3 className="text-2xl font-bold mb-3">{step.title}</h3>
                <p className="text-gray-400 leading-relaxed max-w-sm mx-auto">
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
