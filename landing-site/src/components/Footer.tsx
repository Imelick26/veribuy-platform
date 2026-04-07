import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative border-t border-white/5 py-8">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <a href="#" className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="VeriBuy"
              width={28}
              height={28}
              className="rounded-lg"
            />
            <span className="text-base font-bold">VeriBuy</span>
          </a>
          <p className="text-[11px] text-gray-700">
            &copy; {new Date().getFullYear()} VeriBuy, Inc. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
