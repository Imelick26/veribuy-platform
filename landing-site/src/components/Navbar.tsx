"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0c0f1a]/90 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex h-18 items-center justify-between">
          {/* Logo */}
          <a href="#" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="VeriBuy" width={36} height={36} className="rounded-lg" />
            <span className="text-lg font-bold tracking-tight">VeriBuy</span>
          </a>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center">
            <a
              href="#demo"
              className="bg-brand-gradient rounded-full px-6 py-2.5 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity shadow-brand-glow"
            >
              Book a Demo
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden text-gray-400 hover:text-white"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden bg-[#0c0f1a]/95 backdrop-blur-xl border-t border-white/5">
          <div className="px-6 py-6 space-y-3">
            <a
              href="#demo"
              onClick={() => setMobileOpen(false)}
              className="block text-center bg-brand-gradient rounded-full px-6 py-2.5 text-sm font-semibold text-white"
            >
              Book a Demo
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}
