"use client";

import { motion } from "framer-motion";
import { Building2, Landmark, ShieldCheck, Globe } from "lucide-react";

const audiences = [
  {
    icon: Building2,
    title: "Dealerships & Dealer Groups",
    description:
      "Standardize inspections across your operation. AI-powered condition scoring and 6-source market valuation gives you fair acquisition pricing, recon estimates, and buy/pass recommendations before you commit.",
    features: ["Fair acquisition pricing", "Recon cost estimates", "Buy/pass recommendations"],
  },
  {
    icon: Globe,
    title: "Online Marketplaces",
    description:
      "Give your buyers the confidence to transact remotely. Embed verified condition scores and PDF reports directly into listings to drive conversion and reduce post-sale disputes.",
    features: ["Shareable PDF reports", "AI condition scores", "Recall transparency"],
  },
  {
    icon: Landmark,
    title: "Lenders & Finance",
    description:
      "Make smarter underwriting decisions with AI-driven condition intelligence and market-based valuation data. Verify vehicle condition before funding with comprehensive reports.",
    features: ["Condition-based valuation", "Risk flag visibility", "Auditable AI scoring"],
  },
  {
    icon: ShieldCheck,
    title: "Insurers & Warranty Providers",
    description:
      "Access standardized, AI-scored condition data at the point of policy origination. Understand vehicle condition through 4-area scoring and severity-based findings with repair cost estimates.",
    features: ["4-area condition scoring", "Repair cost estimates", "NHTSA recall integration"],
  },
];

export default function Benefits() {
  return (
    <section id="solutions" className="relative py-24 lg:py-32">
      <div className="absolute inset-0 bg-brand-gradient-subtle" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <p className="text-sm font-medium text-accent-pink uppercase tracking-[0.15em] mb-4">
            Built For Your Industry
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            Solutions for every{" "}
            <span className="text-brand-gradient">stakeholder</span>
          </h2>
          <p className="mt-6 text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Whether you operate a single lot or a national platform, VeriBuy
            is purpose-built for the entire automotive transaction ecosystem.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {audiences.map((audience, i) => (
            <motion.div
              key={audience.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card glass-card-hover rounded-2xl p-8 transition-all duration-300"
            >
              <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center mb-5">
                <audience.icon size={22} className="text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{audience.title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed mb-5">
                {audience.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {audience.features.map((feature) => (
                  <span
                    key={feature}
                    className="px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[11px] text-gray-400"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
