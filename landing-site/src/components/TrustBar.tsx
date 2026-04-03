"use client";

import { motion } from "framer-motion";

const integrations = [
  "NHTSA",
  "Black Book",
  "NADA Guides",
  "VinAudit",
  "MarketCheck",
  "VehicleDatabases",
  "OpenAI Vision",
  "Supabase",
];

export default function TrustBar() {
  return (
    <section className="relative py-14 border-y border-white/5 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs font-medium text-gray-600 uppercase tracking-[0.2em] mb-10"
        >
          Powered by industry-leading data sources
        </motion.p>
      </div>

      {/* Marquee logos */}
      <div className="relative">
        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#0c0f1a] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#0c0f1a] to-transparent z-10" />

        <div className="flex overflow-hidden">
          <div className="flex shrink-0 items-center gap-16 marquee-track">
            {[...integrations, ...integrations].map((name, i) => (
              <div
                key={`${name}-${i}`}
                className="flex items-center gap-3 shrink-0 opacity-30 hover:opacity-60 transition-opacity duration-300"
              >
                <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-gray-400">
                    {name.charAt(0)}
                  </span>
                </div>
                <span className="text-sm font-medium text-gray-400 tracking-wide whitespace-nowrap">
                  {name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
