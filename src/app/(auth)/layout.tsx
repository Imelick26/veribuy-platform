export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-gradient p-12 text-white">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
            <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l-8 4.5v7c0 4.28 3.4 8.28 8 9.5 4.6-1.22 8-5.22 8-9.5v-7L12 2z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <span className="text-2xl font-bold">VeriBuy</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Vehicle Inspection Intelligence
          </h1>
          <p className="text-lg text-white/80 max-w-md">
            Make data-backed acquisition decisions. Every vehicle inspected, scored, and priced — before you commit.
          </p>
        </div>
        <p className="text-sm text-white/60">Trusted by dealerships nationwide</p>
      </div>

      {/* Right panel — auth forms */}
      <div className="flex flex-1 items-center justify-center p-8 bg-brand-50/30">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
