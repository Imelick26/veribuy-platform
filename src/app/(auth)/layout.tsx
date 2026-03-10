/* eslint-disable @next/next/no-img-element */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-gradient p-12 text-white relative overflow-hidden">
        {/* Decorative circles */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/5" />
        <div className="absolute top-1/2 right-1/4 w-64 h-64 rounded-full bg-white/3" />

        <div className="flex items-center gap-3 relative z-10">
          <img src="/logo.png" alt="VeriBuy" className="h-10 w-10 drop-shadow-lg" />
          <span className="text-2xl font-bold tracking-tight">VeriBuy</span>
        </div>
        <div className="relative z-10">
          <h1 className="text-5xl font-bold leading-tight mb-4 tracking-tight">
            Vehicle Inspection<br />Intelligence
          </h1>
          <p className="text-lg text-white/80 max-w-md leading-relaxed">
            Make data-backed acquisition decisions. Every vehicle inspected, scored, and priced — before you commit.
          </p>
        </div>
        <p className="text-sm text-white/50 relative z-10">Trusted by dealerships nationwide</p>
      </div>

      {/* Right panel — auth forms */}
      <div className="flex flex-1 items-center justify-center p-8 bg-gradient-to-br from-brand-50/40 via-white to-brand-50/20">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
