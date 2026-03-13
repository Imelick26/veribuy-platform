import Image from "next/image";

const footerLinks = {
  Product: [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Demo", href: "#demo" },
  ],
  Company: [
    { label: "About", href: "#" },
    { label: "Contact", href: "#contact" },
    { label: "Careers", href: "#" },
  ],
  Legal: [
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
  ],
};

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5 pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-12 mb-16">
          {/* Brand */}
          <div className="lg:col-span-2">
            <a href="#" className="flex items-center gap-3 mb-4">
              <Image
                src="/logo.png"
                alt="VeriBuy"
                width={36}
                height={36}
                className="rounded-lg"
              />
              <span className="text-lg font-bold">VeriBuy</span>
            </a>
            <p className="text-gray-500 text-sm leading-relaxed max-w-xs">
              The enterprise platform for vehicle verification. Built for
              dealerships, inspectors, and insurers who demand precision.
            </p>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                {category}
              </h4>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-gray-500 hover:text-white transition-colors duration-200"
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
          <p className="text-sm text-gray-600">
            &copy; {new Date().getFullYear()} VeriBuy. All rights reserved.
          </p>
          <p className="text-sm text-gray-600">
            <a
              href="https://getveribuy.com"
              className="hover:text-gray-400 transition-colors"
            >
              getVeriBuy.com
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
