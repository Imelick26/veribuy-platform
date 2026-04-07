"use client";

import { motion } from "framer-motion";

const CAL_LINK = "imelick26/veribuy-intro";

export default function DemoAccess() {
  return (
    <section id="demo" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Book a{" "}
            <span className="text-brand-gradient">Demo</span>
          </h2>
          <p className="text-gray-400 text-lg">
            Pick a time that works for you — we&apos;ll walk you through the
            platform live.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative overflow-hidden rounded-2xl bg-brand-gradient p-px"
        >
          <div className="rounded-2xl bg-[#0c0f1a]/95 overflow-hidden">
            <iframe
              src={`https://cal.com/${CAL_LINK}?embed=true&theme=dark&layout=month_view`}
              className="w-full border-0"
              style={{ minHeight: "550px", height: "100%" }}
              allow="payment"
              loading="lazy"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
