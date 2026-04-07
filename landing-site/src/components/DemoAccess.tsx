"use client";

import { motion } from "framer-motion";
import { CheckCircle, Calendar } from "lucide-react";

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
          className="grid lg:grid-cols-5 gap-10 items-start"
        >
          {/* Left — Value props */}
          <div className="lg:col-span-2 space-y-6">
            <ul className="space-y-4">
              {[
                "15-minute live walkthrough",
                "See AI-powered inspections in action",
                "Get your questions answered directly",
                "No commitment required",
              ].map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 text-gray-300"
                >
                  <CheckCircle
                    size={18}
                    className="text-emerald-400 shrink-0"
                  />
                  {item}
                </li>
              ))}
            </ul>

            <div className="flex items-center gap-3 text-gray-500 text-sm pt-2">
              <Calendar size={16} />
              <span>Select a date &amp; time to get started</span>
            </div>
          </div>

          {/* Right — Cal.com Embed */}
          <div className="lg:col-span-3 relative overflow-hidden rounded-2xl bg-brand-gradient p-px">
            <div className="rounded-2xl bg-[#0c0f1a]/95 overflow-hidden">
              <iframe
                src={`https://cal.com/${CAL_LINK}?embed=true&theme=dark&layout=month_view`}
                className="w-full border-0"
                style={{ minHeight: "550px", height: "100%" }}
                allow="payment"
                loading="lazy"
              />
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
