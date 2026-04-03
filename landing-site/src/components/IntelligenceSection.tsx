"use client";

import { motion } from "framer-motion";

const metrics = [
  { value: "21", label: "Guided Photos Per Inspection" },
  { value: "15", label: "AI Valuation Modules" },
  { value: "6", label: "Market Data Sources" },
  { value: "3-Tier", label: "AI Reliability Pattern" },
];

export default function IntelligenceSection() {
  return (
    <section className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left -- Copy */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-sm font-medium text-accent-magenta uppercase tracking-[0.15em] mb-4">
              Built for Scale
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
              Enterprise-grade{" "}
              <span className="text-brand-gradient">performance</span>
            </h2>
            <p className="text-lg text-gray-400 leading-relaxed mb-8">
              VeriBuy&apos;s intelligence engine runs 15 AI modules through a
              3-tier reliability pattern — every module has a primary call,
              simplified fallback, and deterministic heuristic. Every number
              is auditable and every AI call is logged.
            </p>

            <div className="space-y-4">
              {[
                "GPT-4o Vision for damage detection and condition scoring",
                "6 market data sources with AI-weighted consensus pricing",
                "3D risk visualization with interactive vehicle hotspots",
                "Geo-pricing and config-premium analysis (diesel, 4WD, Raptor, etc.)",
                "Full audit trail — every AI module call logged with tier metadata",
              ].map((item) => (
                <div key={item} className="flex items-start gap-3">
                  <div className="shrink-0 w-1.5 h-1.5 rounded-full bg-accent-pink mt-2" />
                  <p className="text-sm text-gray-300">{item}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Right -- Metrics */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="grid grid-cols-2 gap-4"
          >
            {metrics.map((metric, i) => (
              <motion.div
                key={metric.label}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 * i }}
                className="glass-card rounded-2xl p-8 text-center transition-all duration-300"
              >
                <div className="text-3xl md:text-4xl font-bold text-brand-gradient mb-2">
                  {metric.value}
                </div>
                <p className="text-xs text-gray-500 uppercase tracking-wider">
                  {metric.label}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
