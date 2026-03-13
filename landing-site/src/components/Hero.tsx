"use client";

import { motion } from "framer-motion";
import { ArrowRight, Shield, Smartphone, FileText, BarChart3 } from "lucide-react";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 grid-bg" />

      {/* Gradient orbs */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-brand-600/20 blur-[150px] animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-accent-pink/15 blur-[150px] animate-pulse-glow" style={{ animationDelay: "1.5s" }} />

      {/* Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — Copy */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 mb-8">
                <Shield size={16} className="text-accent-pink" />
                Vehicle Verification Infrastructure
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-7xl lg:text-7xl font-bold tracking-tight leading-[0.95] mb-8"
            >
              AI-Powered Vehicle{" "}
              <span className="text-brand-gradient">Verification Infrastructure</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="max-w-xl text-lg md:text-xl text-gray-400 leading-relaxed mb-12 mx-auto lg:mx-0"
            >
              VeriBuy standardizes inspections, analyzes vehicle condition data,
              and surfaces risk intelligence to help dealerships make better
              acquisition and pricing decisions.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row items-center lg:items-start justify-center lg:justify-start gap-4"
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
                Contact Us
              </a>
            </motion.div>

          </div>

          {/* Right — Product Visual */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="hidden lg:block"
          >
            <div className="relative">
              {/* Dashboard mockup */}
              <div className="glass-card rounded-2xl p-6 border border-white/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500/60" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                  <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  <span className="ml-3 text-xs text-gray-500">VeriBuy Dashboard</span>
                </div>

                {/* Vehicle info header */}
                <div className="bg-white/5 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-sm font-semibold text-white">2024 BMW X5 xDrive40i</div>
                      <div className="text-xs text-gray-500">VIN: WBA53EJ09R...7842</div>
                    </div>
                    <div className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-medium">
                      Verified
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-brand-gradient">92</div>
                      <div className="text-[10px] text-gray-500">Condition Score</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-emerald-400">Low</div>
                      <div className="text-[10px] text-gray-500">Risk Level</div>
                    </div>
                    <div className="bg-white/5 rounded-lg p-2 text-center">
                      <div className="text-lg font-bold text-white">12</div>
                      <div className="text-[10px] text-gray-500">Photos</div>
                    </div>
                  </div>
                </div>

                {/* Inspection checklist preview */}
                <div className="space-y-2">
                  {[
                    { label: "Exterior Condition", status: "Complete", color: "text-emerald-400" },
                    { label: "Interior Assessment", status: "Complete", color: "text-emerald-400" },
                    { label: "Mechanical Review", status: "In Progress", color: "text-yellow-400" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-300">{item.label}</span>
                      <span className={`text-[10px] font-medium ${item.color}`}>{item.status}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Floating cards */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute -top-4 -right-4 glass-card rounded-xl p-3 border border-white/10 flex items-center gap-2"
              >
                <Smartphone size={16} className="text-accent-pink" />
                <span className="text-xs text-gray-300">Mobile Capture</span>
              </motion.div>

              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute -bottom-4 -left-4 glass-card rounded-xl p-3 border border-white/10 flex items-center gap-2"
              >
                <FileText size={16} className="text-emerald-400" />
                <span className="text-xs text-gray-300">Verified Report</span>
              </motion.div>

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute top-1/2 -right-6 glass-card rounded-xl p-3 border border-white/10 flex items-center gap-2"
              >
                <BarChart3 size={16} className="text-brand-500" />
                <span className="text-xs text-gray-300">Risk Score</span>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}
