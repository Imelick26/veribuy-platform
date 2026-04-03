"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, CheckCircle } from "lucide-react";

export default function DemoAccess() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    role: "",
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
          message: `Demo requested by ${formData.name} (${formData.role}) from ${formData.company}. Phone: ${formData.phone}`,
        }),
      });
      setSubmitted(true);
    } catch {
      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-accent-pink/50 focus:ring-1 focus:ring-accent-pink/50 transition-colors";

  return (
    <section id="demo" className="relative py-24 lg:py-32">
      <div className="mx-auto max-w-2xl px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-10"
        >
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Interested in{" "}
            <span className="text-brand-gradient">VeriBuy</span>?
          </h2>
          <p className="text-gray-400 text-lg">
            Leave your info below and our team will reach out to schedule a demo.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="relative overflow-hidden rounded-2xl bg-brand-gradient p-px"
        >
          <div className="rounded-2xl bg-[#0c0f1a]/95 p-8 md:p-10">
            {submitted ? (
              <div className="text-center py-8">
                <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle size={32} className="text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold mb-2">We&apos;ll be in touch!</h3>
                <p className="text-gray-400">
                  Our team will reach out within one business day to get your demo scheduled.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Jane Smith"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Work Email *
                    </label>
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) =>
                        setFormData({ ...formData, email: e.target.value })
                      }
                      className={inputClass}
                      placeholder="jane@dealership.com"
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      required
                      value={formData.phone}
                      onChange={(e) =>
                        setFormData({ ...formData, phone: e.target.value })
                      }
                      className={inputClass}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Company *
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      className={inputClass}
                      placeholder="Acme Auto Group"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Your Role
                  </label>
                  <select
                    value={formData.role}
                    onChange={(e) =>
                      setFormData({ ...formData, role: e.target.value })
                    }
                    className={`${inputClass} appearance-none`}
                  >
                    <option value="" className="bg-[#0c0f1a]">Select role</option>
                    <option value="dealer-principal" className="bg-[#0c0f1a]">Dealer Principal / GM</option>
                    <option value="operations" className="bg-[#0c0f1a]">Operations Manager</option>
                    <option value="technology" className="bg-[#0c0f1a]">Technology / IT</option>
                    <option value="finance" className="bg-[#0c0f1a]">Finance / Lending</option>
                    <option value="insurance" className="bg-[#0c0f1a]">Insurance / Risk</option>
                    <option value="marketplace" className="bg-[#0c0f1a]">Marketplace / Platform</option>
                    <option value="other" className="bg-[#0c0f1a]">Other</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-gradient rounded-xl py-3.5 text-sm font-semibold text-white shadow-brand-glow hover:shadow-brand-glow-lg hover:opacity-95 transition-all duration-300 disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      Schedule Your Demo
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-gray-600 text-center">
                  No credit card required. We&apos;ll confirm your demo within 24 hours.
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
