"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-bg" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-brand-600/20 blur-[150px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-accent-pink/15 blur-[150px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20 text-center">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 mb-8">
            <Shield size={16} className="text-accent-pink" />
            Enterprise Vehicle Verification Platform
          </div>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] mb-8"
        >
          Vehicle Verification,{" "}
          <span className="text-brand-gradient">Reinvented</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mx-auto max-w-2xl text-lg md:text-xl text-gray-400 leading-relaxed mb-12"
        >
          The intelligent platform that transforms how dealerships, inspectors,
          and insurers assess vehicle condition — with confidence, speed, and
          precision.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#demo"
            className="group bg-brand-gradient rounded-full px-8 py-4 text-base font-semibold text-white shadow-brand-glow hover:shadow-brand-glow-lg transition-all duration-300 flex items-center gap-2"
          >
            Request a Demo
            <ArrowRight
              size={18}
              className="group-hover:translate-x-1 transition-transform"
            />
          </a>
          <a
            href="#contact"
            className="rounded-full border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 hover:border-white/25 transition-all duration-300"
          >
            Schedule a Meeting
          </a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-20 grid grid-cols-3 gap-8 max-w-xl mx-auto"
        >
          {[
            { value: "10x", label: "Faster Inspections" },
            { value: "99.9%", label: "Uptime" },
            { value: "SOC 2", label: "Compliant" },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl md:text-3xl font-bold text-brand-gradient">
                {stat.value}
              </div>
              <div className="text-xs md:text-sm text-gray-500 mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}
