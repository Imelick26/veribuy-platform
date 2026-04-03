"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Platform", href: "#platform" },
  { label: "Get a Demo", href: "#demo" },
];

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

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-7">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[13px] text-gray-400 hover:text-white transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden lg:flex items-center gap-4">
            <a
              href="https://app.getveribuy.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[13px] font-medium text-gray-300 hover:text-white transition-colors duration-200"
            >
              Login
            </a>
            <a
              href="#demo"
              className="bg-brand-gradient rounded-full px-5 py-2 text-[13px] font-semibold text-white hover:opacity-90 transition-opacity shadow-brand-glow"
            >
              Schedule Demo
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
          <div className="px-6 py-6 space-y-4">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="block text-base text-gray-300 hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
            <div className="pt-4 border-t border-white/10 space-y-3">
              <a
                href="https://app.getveribuy.com"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="block text-center text-sm font-medium text-gray-300 hover:text-white py-2"
              >
                Login
              </a>
              <a
                href="#demo"
                onClick={() => setMobileOpen(false)}
                className="block text-center bg-brand-gradient rounded-full px-6 py-2.5 text-sm font-semibold text-white"
              >
                Schedule Demo
              </a>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
