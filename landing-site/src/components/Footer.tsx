import Image from "next/image";

const footerLinks = {
  Platform: [
    { label: "Features", href: "#platform" },
    { label: "Schedule Demo", href: "#demo" },
  ],
  Solutions: [
    { label: "Dealerships", href: "#solutions" },
    { label: "Marketplaces", href: "#solutions" },
    { label: "Lenders", href: "#solutions" },
    { label: "Insurers", href: "#solutions" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Contact", href: "#contact" },
    { label: "Careers", href: "#" },
    { label: "Press", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
    { label: "Security", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5 pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-6 gap-10 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#" className="flex items-center gap-2.5 mb-4">
              <Image
                src="/logo.png"
                alt="VeriBuy"
                width={32}
                height={32}
                className="rounded-lg"
              />
              <span className="text-lg font-bold">VeriBuy</span>
            </a>
            <p className="text-gray-600 text-xs leading-relaxed max-w-xs mb-6">
              The verification layer for automotive commerce. AI-powered
              inspections, condition scoring, market valuation, and risk
              intelligence for the modern automotive ecosystem.
            </p>
            <div className="flex items-center gap-4 text-[10px] text-gray-600 uppercase tracking-wider">
              <span>AI-Powered</span>
              <span className="w-px h-3 bg-white/10" />
              <span>6 Data Sources</span>
              <span className="w-px h-3 bg-white/10" />
              <span>NHTSA</span>
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
                      className="text-xs text-gray-600 hover:text-white transition-colors duration-200"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="section-divider mb-8" />
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-[11px] text-gray-700">
            &copy; {new Date().getFullYear()} VeriBuy, Inc. All rights reserved.
          </p>
          <p className="text-[11px] text-gray-700">
            <a
              href="https://getveribuy.com"
              className="hover:text-gray-400 transition-colors"
            >
              getveribuy.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
