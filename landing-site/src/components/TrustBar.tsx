"use client";

import { motion } from "framer-motion";

const partners = [
  "AutoNation",
  "Carvana",
  "Lithia Motors",
  "Penske",
  "Hendrick",
  "Larry H. Miller",
];

export default function TrustBar() {
  return (
    <section className="relative py-16 border-y border-white/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-sm text-gray-500 uppercase tracking-widest mb-10"
        >
          Trusted by industry leaders
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap items-center justify-center gap-x-16 gap-y-8"
        >
          {partners.map((name) => (
            <div
              key={name}
              className="text-xl font-semibold text-gray-700 tracking-wide select-none"
            >
              {name}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
