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
    icon: Camera,
    title: "Guided Photo Capture",
    description:
      "A structured, step-by-step workflow walks any inspector through 21 standardized photos — exterior, interior, and mechanical — ensuring every vehicle is documented to the same standard.",
  },
  {
    icon: Scan,
    title: "VIN Decode & Risk Profiling",
    description:
      "Confirm the VIN, decode full vehicle specs, and automatically generate a risk profile from NHTSA complaints, recalls, and known failure patterns for that exact make, model, and year.",
  },
  {
    icon: Brain,
    title: "AI Condition Scoring",
    description:
      "Computer vision analyzes every inspection photo to generate objective, auditable condition scores across four areas — removing subjectivity from the assessment process.",
  },
  {
    icon: ShieldCheck,
    title: "Risk Inspection",
    description:
      "Each known risk gets a targeted yes/no checklist. If an issue is flagged, the inspector is prompted for evidence — no wasted time photographing things that aren't broken.",
  },
  {
    icon: BarChart3,
    title: "Market Valuation Engine",
    description:
      "Fair acquisition pricing powered by six market data sources, regional adjustments, and condition-aware analysis — giving every stakeholder a defensible number.",
  },
  {
    icon: FileCheck,
    title: "Shareable Condition Reports",
    description:
      "Generate professional PDF reports with condition scores, findings, photos, and market comparables — ready to share with buyers, sellers, lenders, or internal teams.",
  },
];

export default function SolutionSection() {
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
          <div className="space-y-2 mb-6">
            {[
              "Carfax",
              "AutoCheck",
              "Book values",
              "Auction comps",
              "Recon spreadsheets",
              "Third-party inspections",
            ].map((tool, i) => (
              <motion.p
                key={tool}
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: i * 0.1 }}
                className="text-2xl md:text-3xl font-semibold text-gray-600 line-through decoration-white/20"
              >
                {tool}
              </motion.p>
            ))}
          </div>
          <motion.h2
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="text-5xl md:text-6xl font-bold tracking-tight"
          >
            <span className="text-brand-gradient">VeriBuy.</span>
          </motion.h2>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Once condition is understood, VeriBuy uses trusted market data to
            ensure you pay exactly what the vehicle is worth.
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
