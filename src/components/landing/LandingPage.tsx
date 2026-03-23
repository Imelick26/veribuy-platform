"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Shield,
  CheckCircle,
  Menu,
  X,
  Scan,
  Camera,
  Brain,
  FileCheck,
  ShieldCheck,
  BarChart3,
  Search,
  AlertTriangle,
  EyeOff,
  Clock,
  TrendingDown,
  Building2,
  Users,
  Store,
  Zap,
} from "lucide-react";

/* ─── Data ──────────────────────────────────────────────── */

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "For Dealers", href: "#for-dealers" },
];

const trustBadges = [
  "SOC 2 Compliant",
  "256-bit Encryption",
  "99.9% Uptime SLA",
  "Enterprise Ready",
];

const problems = [
  {
    icon: AlertTriangle,
    stat: "$3.5B+",
    statLabel: "in annual losses",
    title: "Inconsistent Evaluations",
    description:
      "Every dealership does it differently. Subjective assessments lead to missed issues, pricing errors, and costly post-sale surprises.",
  },
  {
    icon: EyeOff,
    stat: "68%",
    statLabel: "of buyers distrust listings",
    title: "Eroded Buyer Confidence",
    description:
      "Buyers and dealers operate on incomplete information. Without a trusted standard, deals stall and margins shrink.",
  },
  {
    icon: Clock,
    stat: "2.4 hrs",
    statLabel: "avg. manual process",
    title: "Slow, Manual Workflows",
    description:
      "Paper forms, disconnected tools, and phone-camera photos waste hours per vehicle while still missing what matters most.",
  },
  {
    icon: TrendingDown,
    stat: "41%",
    statLabel: "of issues are preventable",
    title: "Avoidable Losses",
    description:
      "Without the right intelligence upfront, dealerships acquire vehicles with hidden problems that eat into profit after the fact.",
  },
];

const capabilities = [
  {
    icon: Scan,
    title: "Vehicle Intelligence",
    description:
      "Instantly unlock a comprehensive picture of any vehicle — from factory specs to history signals — all from a single identifier.",
  },
  {
    icon: Camera,
    title: "Structured Capture",
    description:
      "Replace inconsistent processes with guided workflows that ensure nothing gets missed, every time, at every location.",
  },
  {
    icon: Brain,
    title: "AI-Powered Analysis",
    description:
      "Proprietary models turn raw data into actionable intelligence, giving your team objective insights that remove the guesswork.",
  },
  {
    icon: FileCheck,
    title: "Trusted Reports",
    description:
      "Generate verified, shareable condition reports that build confidence with buyers and create transparency across your operation.",
  },
  {
    icon: ShieldCheck,
    title: "Risk Detection",
    description:
      "Surface critical signals before they become costly problems — so you can make acquisition decisions with full clarity.",
  },
  {
    icon: BarChart3,
    title: "Operational Insights",
    description:
      "Track trends across your inventory, measure team performance, and identify opportunities to improve margins and efficiency.",
  },
];

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Identify",
    subtitle: "Instant Intelligence",
    description:
      "Start with a VIN and instantly surface everything you need to know about a vehicle before going any further.",
  },
  {
    number: "02",
    icon: Camera,
    title: "Capture",
    subtitle: "Guided Workflow",
    description:
      "Walk through a standardized process that ensures consistent, comprehensive documentation every single time.",
  },
  {
    number: "03",
    icon: BarChart3,
    title: "Analyze",
    subtitle: "AI-Driven Scoring",
    description:
      "Our engine processes everything captured to produce an objective, quantified assessment you can trust and act on.",
  },
  {
    number: "04",
    icon: FileCheck,
    title: "Verify",
    subtitle: "Transparent Results",
    description:
      "Share verified results with your team, your buyers, or anyone in the transaction — building trust at every step.",
  },
];

const dealerBenefits = [
  {
    icon: Building2,
    title: "Multi-Rooftop Operations",
    description:
      "Manage every location from a single platform. Ensure consistency, visibility, and control across your entire dealer group.",
    features: [
      "Centralized management",
      "Consistent standards",
      "Cross-location visibility",
    ],
  },
  {
    icon: Zap,
    title: "Faster Acquisition Decisions",
    description:
      "Get the intelligence you need in minutes, not hours. Make confident buy decisions at auction, trade-in, or wholesale — before the opportunity passes.",
    features: [
      "Minutes, not hours",
      "Auction-ready speed",
      "Confident pricing",
    ],
  },
  {
    icon: Users,
    title: "Buyer Trust & Transparency",
    description:
      "Give your customers the verified information they need to buy with confidence. Differentiate your dealership with a level of transparency that drives loyalty.",
    features: [
      "Verified condition data",
      "Branded reports",
      "Higher close rates",
    ],
  },
  {
    icon: Store,
    title: "Inventory Intelligence",
    description:
      "Know exactly what you have on your lot. Understand condition trends, identify reconditioning priorities, and optimize your turn time.",
    features: [
      "Lot-wide visibility",
      "Recon prioritization",
      "Margin optimization",
    ],
  },
];

const footerLinks = {
  Platform: [
    { label: "Features", href: "#platform" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "For Dealers", href: "#for-dealers" },
    { label: "Security", href: "#" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Contact", href: "#" },
    { label: "Careers", href: "#" },
    { label: "Press", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Security", href: "#" },
  ],
};

/* ─── Fade-in variant ────────────────────────────────────── */

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (delay: number = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay },
  }),
};

/* ─── Component ──────────────────────────────────────────── */

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: "var(--font-inter), Inter, system-ui, sans-serif" }}>
      {/* ─── Navbar ─────────────────────────────────────── */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm"
            : "bg-transparent"
        }`}
      >
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="flex h-18 items-center justify-between">
            <a href="#" className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="VeriBuy" className="h-9 w-9 rounded-lg" />
              <span className="text-lg font-bold tracking-tight text-gray-900">VeriBuy</span>
            </a>

            {/* Desktop nav links */}
            <div className="hidden lg:flex items-center gap-7">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  className="text-[13px] text-gray-500 hover:text-gray-900 transition-colors duration-200"
                >
                  {link.label}
                </a>
              ))}
            </div>

            {/* Desktop CTAs */}
            <div className="hidden lg:flex items-center gap-4">
              <Link
                href="/login"
                className="text-[13px] font-medium text-gray-600 hover:text-gray-900 transition-colors duration-200"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-brand-gradient rounded-full px-5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity shadow-brand-glow"
              >
                Get Started
              </Link>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="lg:hidden text-gray-500 hover:text-gray-900"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden bg-white/95 backdrop-blur-xl border-t border-gray-100">
            <div className="px-6 py-6 space-y-4">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block text-base text-gray-600 hover:text-gray-900 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-4 border-t border-gray-100 space-y-3">
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block text-center text-sm font-medium text-gray-600 hover:text-gray-900 py-2"
                >
                  Sign In
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileOpen(false)}
                  className="block text-center bg-brand-gradient rounded-full px-6 py-2.5 text-sm font-semibold text-white"
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50/60 via-white to-brand-50/40">
        <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full bg-brand-200/20 blur-[150px] animate-pulse-glow" />
        <div
          className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full bg-accent-pink/5 blur-[150px] animate-pulse-glow"
          style={{ animationDelay: "1.5s" }}
        />

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8 pt-32 pb-20">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}>
              <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/80 px-5 py-2.5 text-sm text-brand-600 mb-8">
                <Shield size={15} className="text-accent-pink" />
                Automotive Condition Intelligence Platform
              </div>
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial="hidden"
              animate="visible"
              custom={0.1}
              variants={fadeUp}
              className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.05] mb-8 text-gray-900"
            >
              The Truth Layer for{" "}
              <span className="text-brand-gradient">Automotive Acquisition</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0.2}
              variants={fadeUp}
              className="max-w-2xl text-lg md:text-xl text-gray-500 leading-relaxed mb-10 mx-auto"
            >
              VeriBuy gives dealerships the intelligence to acquire, evaluate,
              and sell vehicles with complete confidence — replacing guesswork
              with verified data at every step.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0.3}
              variants={fadeUp}
              className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16"
            >
              <Link
                href="/register"
                className="group bg-brand-gradient rounded-full px-8 py-4 text-base font-semibold text-white shadow-brand-glow hover:shadow-brand-glow-lg transition-all duration-300 flex items-center gap-2"
              >
                Get Started Free
                <ArrowRight
                  size={18}
                  className="group-hover:translate-x-1 transition-transform"
                />
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-gray-200 bg-white px-8 py-4 text-base font-semibold text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all duration-300 shadow-sm"
              >
                See How It Works
              </a>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial="hidden"
              animate="visible"
              custom={0.4}
              variants={fadeUp}
              className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-400"
            >
              {trustBadges.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle size={14} className="text-emerald-500/70" />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>
          </div>

          {/* Dashboard Preview */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.5 }}
            className="mt-20 max-w-5xl mx-auto"
          >
            <div className="relative rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-brand-600/5">
              <div className="rounded-xl bg-gray-50 border border-gray-100 overflow-hidden">
                {/* Browser chrome */}
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-white">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-300" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-300" />
                  </div>
                  <div className="flex-1 mx-4">
                    <div className="max-w-md mx-auto h-5 rounded-md bg-gray-100 flex items-center justify-center">
                      <span className="text-[10px] text-gray-400">
                        app.getveribuy.com/dashboard
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dashboard content */}
                <div className="p-6 md:p-8 bg-gradient-to-br from-brand-50/40 via-white to-brand-50/20">
                  <div className="grid md:grid-cols-3 gap-4 mb-6">
                    {[
                      { label: "Active Inspections", value: "247", change: "+12% this week" },
                      { label: "Avg. Condition Score", value: "87.4", change: "Across 1,240 vehicles" },
                      { label: "Alerts", value: "3", change: "Requires attention" },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                        <p className="text-[11px] text-gray-400 uppercase tracking-wider mb-1">{stat.label}</p>
                        <p className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</p>
                        <p className="text-[11px] text-gray-400">{stat.change}</p>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-700">Recent Inspections</p>
                      <p className="text-[10px] text-gray-400">View All</p>
                    </div>
                    {[
                      { vehicle: "2024 BMW X5 xDrive40i", vin: "WBA53EJ09R...7842", score: 92, status: "Verified" },
                      { vehicle: "2023 Mercedes-Benz GLE 350", vin: "4JGFB4FB2P...1205", score: 85, status: "Verified" },
                      { vehicle: "2024 Ford F-150 Lariat", vin: "1FTFW1E87N...4019", score: 71, status: "Review" },
                    ].map((row, i) => (
                      <div key={i} className="px-4 py-3 flex items-center justify-between border-b border-gray-50 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{row.vehicle}</p>
                          <p className="text-[10px] text-gray-400">{row.vin}</p>
                        </div>
                        <div className="hidden sm:flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-sm font-semibold text-brand-gradient">{row.score}</p>
                            <p className="text-[9px] text-gray-400">Score</p>
                          </div>
                          <span
                            className={`px-2.5 py-1 rounded-full text-[10px] font-medium ${
                              row.status === "Verified"
                                ? "bg-emerald-50 text-emerald-600"
                                : "bg-yellow-50 text-yellow-600"
                            }`}
                          >
                            {row.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      {/* ─── Problem Section ────────────────────────────── */}
      <section className="relative py-24 lg:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-accent-magenta uppercase tracking-[0.15em] mb-4">
              The Industry Problem
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              The way dealerships evaluate vehicles is broken
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Over $1.2 trillion in used vehicle transactions happen every year,
              yet the tools most dealers rely on haven&apos;t evolved in decades.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {problems.map((problem, i) => (
              <motion.div
                key={problem.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl p-8 transition-all duration-300 bg-gray-50 border border-gray-100 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/5"
              >
                <div className="flex items-start gap-5">
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center mb-3">
                      <problem.icon size={22} className="text-red-500" />
                    </div>
                    <div className="text-2xl font-bold text-gray-900">
                      {problem.stat}
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wider mt-0.5">
                      {problem.statLabel}
                    </div>
                  </div>
                  <div className="pt-1">
                    <h3 className="text-lg font-semibold mb-2 text-gray-900">{problem.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed">
                      {problem.description}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent" />
      </div>

      {/* ─── Platform / Solution Section ────────────────── */}
      <section id="platform" className="relative py-24 lg:py-32 bg-gradient-to-br from-brand-50/40 via-white to-brand-50/20">
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-accent-magenta uppercase tracking-[0.15em] mb-4">
              The Platform
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              Everything you need.{" "}
              <span className="text-brand-gradient">One platform.</span>
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              VeriBuy brings together the intelligence, workflows, and insights
              your dealership needs to operate with confidence at every stage.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {capabilities.map((cap, i) => (
              <motion.div
                key={cap.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="rounded-2xl p-7 transition-all duration-300 bg-white border border-gray-100 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/5"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center mb-5">
                  <cap.icon size={22} className="text-white" />
                </div>
                <h3 className="text-base font-semibold mb-2 text-gray-900">{cap.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {cap.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent" />
      </div>

      {/* ─── How It Works ───────────────────────────────── */}
      <section id="how-it-works" className="relative py-24 lg:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-20"
          >
            <p className="text-sm font-medium text-accent-pink uppercase tracking-[0.15em] mb-4">
              How It Works
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              From VIN to verified in{" "}
              <span className="text-brand-gradient">minutes</span>
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              A streamlined process that replaces hours of manual work with
              intelligent, automated verification.
            </p>
          </motion.div>

          <div className="relative">
            <div className="hidden lg:block absolute top-24 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent" />

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {steps.map((step, i) => (
                <motion.div
                  key={step.title}
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: i * 0.15 }}
                  className="relative text-center"
                >
                  <div className="relative z-10 mx-auto mb-6 w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand-glow">
                    <step.icon size={28} className="text-white" />
                  </div>
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1.5 w-6 h-6 rounded-full bg-white border-2 border-accent-pink flex items-center justify-center text-[10px] font-bold text-accent-pink z-20">
                    {step.number}
                  </div>
                  <h3 className="text-xl font-bold mb-1 text-gray-900">{step.title}</h3>
                  <p className="text-xs text-accent-magenta font-medium uppercase tracking-wider mb-3">
                    {step.subtitle}
                  </p>
                  <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                    {step.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent" />
      </div>

      {/* ─── For Dealers ─────────────────────────────────── */}
      <section id="for-dealers" className="relative py-24 lg:py-32 bg-gradient-to-br from-brand-50/40 via-white to-brand-50/20">
        <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <p className="text-sm font-medium text-accent-pink uppercase tracking-[0.15em] mb-4">
              Built For Dealers
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              Your dealership,{" "}
              <span className="text-brand-gradient">elevated</span>
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Whether you operate a single rooftop or a national group, VeriBuy
              is purpose-built to help you acquire smarter, sell faster, and
              build lasting buyer trust.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-5">
            {dealerBenefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl p-8 transition-all duration-300 bg-white border border-gray-100 hover:border-brand-200 hover:shadow-lg hover:shadow-brand-600/5"
              >
                <div className="w-11 h-11 rounded-xl bg-brand-gradient flex items-center justify-center mb-5">
                  <benefit.icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900">{benefit.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  {benefit.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {benefit.features.map((feature) => (
                    <span
                      key={feature}
                      className="px-3 py-1 rounded-full bg-brand-50 border border-brand-100 text-[11px] text-brand-600 font-medium"
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

      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent" />
      </div>

      {/* ─── CTA Section ────────────────────────────────── */}
      <section className="relative py-24 lg:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-px">
            <div className="rounded-3xl bg-gray-950 px-8 py-16 md:px-16 md:py-20 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6 text-white">
                  Ready to transform your{" "}
                  <span className="text-brand-gradient">dealership?</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-10">
                  Join the growing network of dealers using VeriBuy to make
                  smarter decisions, move faster, and build buyer trust that
                  drives loyalty.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <Link
                    href="/register"
                    className="group bg-brand-gradient rounded-full px-8 py-4 text-base font-semibold text-white shadow-brand-glow hover:shadow-brand-glow-lg transition-all duration-300 flex items-center gap-2"
                  >
                    Set Up Your Account
                    <ArrowRight
                      size={18}
                      className="group-hover:translate-x-1 transition-transform"
                    />
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full border border-white/15 bg-white/5 px-8 py-4 text-base font-semibold text-white hover:bg-white/10 hover:border-white/25 transition-all duration-300"
                  >
                    Sign In to Existing Account
                  </Link>
                </div>
                <p className="text-sm text-gray-600">
                  No credit card required. Get started in under 2 minutes.
                </p>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="relative border-t border-gray-100 pt-16 pb-8 bg-gray-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-10 mb-16">
            {/* Brand */}
            <div className="lg:col-span-2">
              <a href="#" className="flex items-center gap-2.5 mb-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="VeriBuy" className="h-8 w-8 rounded-lg" />
                <span className="text-lg font-bold text-gray-900">VeriBuy</span>
              </a>
              <p className="text-gray-500 text-xs leading-relaxed max-w-xs mb-6">
                The truth layer for automotive acquisition. Helping dealerships
                make confident decisions backed by verified intelligence.
              </p>
              <div className="flex items-center gap-4 text-[10px] text-gray-400 uppercase tracking-wider">
                <span>SOC 2</span>
                <span className="w-px h-3 bg-gray-200" />
                <span>256-bit SSL</span>
                <span className="w-px h-3 bg-gray-200" />
                <span>Enterprise Ready</span>
              </div>
            </div>

            {/* Links */}
            {Object.entries(footerLinks).map(([category, links]) => (
              <div key={category}>
                <h4 className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.15em] mb-4">
                  {category}
                </h4>
                <ul className="space-y-2.5">
                  {links.map((link) => (
                    <li key={link.label}>
                      <a
                        href={link.href}
                        className="text-xs text-gray-500 hover:text-gray-900 transition-colors duration-200"
                      >
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-brand-200/60 to-transparent mb-8" />
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[11px] text-gray-400">
              &copy; {new Date().getFullYear()} VeriBuy, Inc. All rights reserved.
            </p>
            <p className="text-[11px] text-gray-400">
              <a
                href="https://getveribuy.com"
                className="hover:text-gray-600 transition-colors"
              >
                getveribuy.com
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
