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
  Sparkles,
} from "lucide-react";

/* ─── Data ──────────────────────────────────────────────── */

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "How It Works", href: "#how-it-works" },
  { label: "For Dealers", href: "#for-dealers" },
];

const trustBadges = [
  "AI-Powered",
  "SOC 2 Compliant",
  "256-bit Encryption",
  "Enterprise Ready",
];

const problems = [
  {
    icon: AlertTriangle,
    stat: "$3.5B+",
    statLabel: "in annual losses",
    title: "You Can\u2019t Appraise What You Can\u2019t See",
    description:
      "Walk-arounds miss what\u2019s underneath. Subjective appraisals lead to buying wrong, overpaying at auction, and recon costs that eat your front gross before the unit ever hits the line.",
  },
  {
    icon: EyeOff,
    stat: "68%",
    statLabel: "of buyers distrust listings",
    title: "Buyers Don\u2019t Trust Your Word Alone",
    description:
      "Today\u2019s consumer has been burned before. Without verified, third-party condition data backing your listings, deals stall, be-backs never return, and your close rate suffers.",
  },
  {
    icon: Clock,
    stat: "2.4 hrs",
    statLabel: "avg. manual appraisal",
    title: "Your Recon Process is Bleeding Gross",
    description:
      "Every day a unit sits in recon is carrying cost you\u2019ll never get back. Paper forms, disconnected tools, and slow approvals push your time-to-line into double digits.",
  },
  {
    icon: TrendingDown,
    stat: "41%",
    statLabel: "of post-sale issues preventable",
    title: "Aged Units Are Killing Your Turn",
    description:
      "Without the right intelligence at the point of acquisition, you\u2019re stocking units with hidden problems that sit, depreciate, and eventually wholesale out at a loss.",
  },
];

const capabilities = [
  {
    icon: Scan,
    title: "VIN-Level Intelligence",
    description:
      "Drop a VIN and our AI instantly builds a complete vehicle profile \u2014 history, specs, risk signals, and condition indicators \u2014 before your appraiser even walks the lot.",
  },
  {
    icon: Camera,
    title: "AI-Guided Capture",
    description:
      "Replace inconsistent walk-arounds with an intelligent, guided process. Our AI directs every step so nothing gets missed \u2014 same standard, every unit, every rooftop.",
  },
  {
    icon: Brain,
    title: "AI Condition Scoring",
    description:
      "Our proprietary AI models analyze every data point captured to produce an objective condition score \u2014 removing the subjectivity that costs dealers thousands per unit.",
  },
  {
    icon: FileCheck,
    title: "Verified Condition Reports",
    description:
      "Generate verified, branded reports that give your buyers the transparency they need to say yes. Show your work and close with confidence.",
  },
  {
    icon: ShieldCheck,
    title: "Pre-Acquisition Risk Signals",
    description:
      "Know what you\u2019re buying before you buy it. Our AI surfaces the red flags that turn a good deal into a costly mistake \u2014 before you take the unit over the curb.",
  },
  {
    icon: BarChart3,
    title: "Dealership Analytics",
    description:
      "Track your inventory health, monitor recon velocity, and understand your true cost-to-market across every unit on your lot.",
  },
];

const steps = [
  {
    number: "01",
    icon: Search,
    title: "Decode",
    subtitle: "AI Vehicle Intelligence",
    description:
      "Enter any VIN and let our AI build a complete picture \u2014 specs, history, risk signals \u2014 in seconds, not hours.",
  },
  {
    number: "02",
    icon: Camera,
    title: "Capture",
    subtitle: "AI-Guided Inspection",
    description:
      "Our AI walks your team through a structured capture process. Consistent results, every unit, every time.",
  },
  {
    number: "03",
    icon: Brain,
    title: "Score",
    subtitle: "AI Condition Analysis",
    description:
      "Proprietary AI models analyze everything captured to generate an objective condition score you can trust and act on.",
  },
  {
    number: "04",
    icon: FileCheck,
    title: "Verify",
    subtitle: "Transparent Results",
    description:
      "Share verified condition data with your team, your buyers, or across your group. Build trust that closes deals.",
  },
];

const dealerBenefits = [
  {
    icon: Building2,
    title: "Built for Dealer Groups",
    description:
      "One platform across every rooftop. Standardize your appraisal process, get centralized visibility into inventory condition, and ensure your team follows the same playbook \u2014 whether you have 2 stores or 200.",
    features: [
      "Multi-rooftop management",
      "Standardized processes",
      "Group-wide visibility",
    ],
  },
  {
    icon: Zap,
    title: "Buy Right, Every Time",
    description:
      "Our AI gives you the true condition picture before you commit \u2014 at auction, on trade-ins, or wholesale. Know your recon exposure upfront so you can pencil the deal with confidence and protect your front gross.",
    features: [
      "Pre-acquisition intelligence",
      "Recon cost clarity",
      "Confident appraisals",
    ],
  },
  {
    icon: Users,
    title: "Build Buyer Confidence",
    description:
      "Today\u2019s buyers want transparency. VeriBuy gives you verified, AI-backed condition data you can share on your listings and at the desk \u2014 turning skeptical shoppers into confident buyers.",
    features: [
      "Verified condition data",
      "Branded buyer reports",
      "Higher close rates",
    ],
  },
  {
    icon: Store,
    title: "Turn Faster, Earn More",
    description:
      "Cut your time-to-line by getting condition intelligence on day one. Prioritize recon, price to market faster, and get frontline-ready units in front of buyers before carrying costs eat your margin.",
    features: [
      "Faster time-to-line",
      "Recon prioritization",
      "Margin protection",
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
                <Sparkles size={15} className="text-accent-pink" />
                The First AI-Based Condition Intelligence Platform
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
              The Industry&apos;s First AI-Based Condition Intelligence Platform.{" "}
              <span className="text-brand-gradient">Setting the New Standard for Truth.</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial="hidden"
              animate="visible"
              custom={0.2}
              variants={fadeUp}
              className="max-w-2xl text-lg md:text-xl text-gray-500 leading-relaxed mb-10 mx-auto"
            >
              VeriBuy is an AI-powered verification platform that analyzes vehicle
              condition and surfaces risk intelligence before acquisition, bringing
              consistency and confidence to every purchase.
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
              The Problem
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              Million-dollar inventory decisions shouldn&apos;t rely on a quick walk-around
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              The used car business moves fast. But the tools most dealers rely on
              for condition assessment haven&apos;t kept up. That gap is costing you
              gross, time, and trust.
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

      {/* ─── AI-First Platform Section ──────────────────── */}
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
              AI-First Platform
            </p>
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
              AI that actually understands{" "}
              <span className="text-brand-gradient">vehicle condition</span>
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              VeriBuy is the first AI-based condition intelligence platform built
              specifically for the automotive industry. Our AI does the heavy
              lifting so your team can focus on what they do best \u2014 selling cars.
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
              Our AI handles what used to take hours. Four steps, one platform,
              and your team has everything they need to buy right and sell with
              confidence.
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
              Your lot. Your team.{" "}
              <span className="text-brand-gradient">Smarter.</span>
            </h2>
            <p className="mt-6 text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
              Whether you&apos;re running a single rooftop or a national group,
              VeriBuy is purpose-built to help you buy right, recon faster, and
              close with the kind of transparency that builds repeat business.
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

      {/* ─── New Standard Banner ─────────────────────────── */}
      <section className="relative py-16 lg:py-20 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/80 px-5 py-2.5 text-sm text-brand-600 mb-6">
              <Shield size={15} className="text-accent-pink" />
              Setting the New Standard
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-6">
              The industry&apos;s first AI-based condition intelligence platform.{" "}
              <span className="text-brand-gradient">Setting the new standard for truth.</span>
            </h2>
            <p className="text-lg text-gray-500 leading-relaxed">
              Every dealer deserves to know exactly what they&apos;re buying and
              every buyer deserves to know exactly what they&apos;re getting.
              VeriBuy is building that standard \u2014 powered by AI, built for
              the realities of the dealership floor.
            </p>
          </motion.div>
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
                  Ready to buy smarter and{" "}
                  <span className="text-brand-gradient">sell with confidence?</span>
                </h2>
                <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed mb-4">
                  Join the dealers who are already using AI-powered condition
                  intelligence to protect their gross, turn faster, and build
                  the kind of buyer trust that drives repeat business.
                </p>
                <p className="text-base text-gray-500 max-w-xl mx-auto leading-relaxed mb-10">
                  Catch one bad unit before it hits your lot and the platform has already paid for itself.
                </p>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                  <Link
                    href="/register"
                    className="group bg-brand-gradient rounded-full px-8 py-4 text-base font-semibold text-white shadow-brand-glow hover:shadow-brand-glow-lg transition-all duration-300 flex items-center gap-2"
                  >
                    Set Up Your Dealership
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
                  No credit card required. Get your team up and running in minutes.
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
                The first AI-based automotive condition intelligence platform.
                Helping dealers know the truth about every vehicle \u2014 before
                they buy, before they recon, and before they sell.
              </p>
              <div className="flex items-center gap-4 text-[10px] text-gray-400 uppercase tracking-wider">
                <span>AI-Powered</span>
                <span className="w-px h-3 bg-gray-200" />
                <span>SOC 2</span>
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
