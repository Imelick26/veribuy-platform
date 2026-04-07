"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield } from "lucide-react";
import VehicleInspectionVisual from "./VehicleInspectionVisual";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-brand-600/15 blur-[150px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-accent-pink/10 blur-[150px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20">
        <div className="text-center max-w-4xl mx-auto">
          {/* Enterprise Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm text-gray-300 mb-8 badge-shimmer">
              <Shield size={15} className="text-accent-pink" />
              Enterprise Vehicle Verification Platform
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8"
          >
            Vehicle Condition,{" "}
            <span className="text-brand-gradient">Verified Before Purchase</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="max-w-2xl text-lg md:text-xl text-gray-400 leading-relaxed mb-10 mx-auto"
          >
            The world&apos;s first AI platform that pinpoints a vehicle&apos;s true
            condition in minutes — uncovering hidden issues a basic walk-around
            can&apos;t. Verify Before You Buy with VeriBuy.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
          >
            <a
              href="#demo"
              className="group bg-brand-gradient rounded-full px-8 py-4 text-base font-semibold text-white shadow-brand-glow hover:shadow-brand-glow-lg transition-all duration-300 flex items-center gap-2"
            >
              Book a Demo
              <ArrowRight
                size={18}
                className="group-hover:translate-x-1 transition-transform"
              />
            </a>
            <a
              href="#platform"
              className="rounded-full border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 hover:border-white/25 transition-all duration-300"
            >
              See How It Works
            </a>
          </motion.div>

        </div>

        {/* Vehicle Inspection Visual */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="mt-16"
        >
          <VehicleInspectionVisual />
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0c0f1a] to-transparent" />
    </section>
  );
}
