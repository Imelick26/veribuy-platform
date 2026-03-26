"use client";

import { motion } from "framer-motion";

export default function TrustBar() {
  return (
    <section className="relative py-16 border-y border-white/5">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-lg text-gray-400 tracking-wide"
        >
          Built for the modern automotive ecosystem.
        </motion.p>
      </div>
    </section>
  );
}
