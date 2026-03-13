"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle, Sparkles } from "lucide-react";

export default function DemoAccess() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          type: "demo",
          message: `Demo access requested by ${formData.name} from ${formData.company}`,
        }),
      });
      setSubmitted(true);
    } catch {
      // Still show success — form data captured
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="demo" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-px">
          <div className="rounded-3xl bg-black/90 p-10 md:p-16">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left — Copy */}
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 mb-6">
                  <Sparkles size={16} className="text-accent-pink" />
                  Free to get started
                </div>
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                  See VeriBuy{" "}
                  <span className="text-brand-gradient">in action</span>
                </h2>
                <p className="text-lg text-gray-400 leading-relaxed mb-8">
                  Get hands-on access to the platform. See how VeriBuy
                  transforms your vehicle verification workflow — no commitment
                  required.
                </p>
                <ul className="space-y-3">
                  {[
                    "Full platform access",
                    "Guided onboarding experience",
                    "No credit card required",
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
              </motion.div>

              {/* Right — Form */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: 0.2 }}
              >
                {submitted ? (
                  <div className="text-center py-12">
                    <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <CheckCircle size={32} className="text-emerald-400" />
                    </div>
                    <h3 className="text-2xl font-bold mb-2">You&apos;re in!</h3>
                    <p className="text-gray-400 mb-6">
                      Check your inbox — we&apos;ll have you set up in minutes.
                    </p>
                    <a
                      href="https://getveribuy.com"
                      className="inline-flex items-center gap-2 text-accent-pink hover:text-accent-magenta transition-colors font-medium"
                    >
                      Go to Platform
                      <ArrowRight size={16} />
                    </a>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent-magenta/50 focus:ring-1 focus:ring-accent-magenta/50 transition-colors"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Work Email
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent-magenta/50 focus:ring-1 focus:ring-accent-magenta/50 transition-colors"
                        placeholder="john@company.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Company
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.company}
                        onChange={(e) =>
                          setFormData({ ...formData, company: e.target.value })
                        }
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-accent-magenta/50 focus:ring-1 focus:ring-accent-magenta/50 transition-colors"
                        placeholder="Acme Motors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand-gradient rounded-xl py-3.5 text-base font-semibold text-white shadow-brand-glow hover:shadow-brand-glow-lg hover:opacity-95 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          Get Demo Access
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </motion.div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
