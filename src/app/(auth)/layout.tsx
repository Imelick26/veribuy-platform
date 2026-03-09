import { Shield } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-blue-600 p-12 text-white">
        <div className="flex items-center gap-3">
          <Shield className="h-8 w-8" />
          <span className="text-2xl font-bold">VeriBuy</span>
        </div>
        <div>
          <h1 className="text-4xl font-bold leading-tight mb-4">
            Vehicle Inspection Intelligence
          </h1>
          <p className="text-lg text-blue-100 max-w-md">
            Make data-backed acquisition decisions. Every vehicle inspected, scored, and priced — before you commit.
          </p>
        </div>
        <p className="text-sm text-blue-200">Trusted by dealerships nationwide</p>
      </div>

      {/* Right panel — auth forms */}
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
