"use client";

import { motion } from "framer-motion";
import { ClipboardList, Brain, Share2, Activity } from "lucide-react";

const benefits = [
  {
    icon: ClipboardList,
    title: "Standardized Inspections",
    description:
      "Consistent inspection workflows across every location. Every vehicle, every inspector, every time.",
    gradient: "from-yellow-500/20 to-orange-500/20",
  },
  {
    icon: Brain,
    title: "AI Condition Scoring",
    description:
      "AI-powered analysis generates objective condition scores from inspection data, photos, and vehicle history.",
    gradient: "from-brand-600/20 to-accent-magenta/20",
  },
  {
    icon: Share2,
    title: "Shareable Reports",
    description:
      "Generate verification reports that can be shared and trusted by dealers and consumers.",
    gradient: "from-emerald-500/20 to-teal-500/20",
  },
  {
    icon: Activity,
    title: "Real-Time Risk Insights",
    description:
      "Surface risk signals, recall data, and condition intelligence in real time — before issues become costly.",
    gradient: "from-blue-500/20 to-indigo-500/20",
  },
];

export default function Benefits() {
  return (
    <section id="benefits" className="relative py-24 lg:py-32">
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
            Why VeriBuy
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Built for{" "}
            <span className="text-brand-gradient">results</span>
          </h2>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Every feature is designed to deliver measurable impact to your
            operations.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((benefit, i) => (
            <motion.div
              key={benefit.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card glass-card-hover rounded-2xl p-8 text-center transition-all duration-300"
            >
              <div
                className={`mx-auto mb-6 inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${benefit.gradient}`}
              >
                <benefit.icon size={28} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-3">{benefit.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {benefit.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
