import dynamic from "next/dynamic";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";

const TrustBar = dynamic(() => import("@/components/TrustBar"));
const ProblemSection = dynamic(() => import("@/components/ProblemSection"));
const SolutionSection = dynamic(() => import("@/components/SolutionSection"));
const IntelligenceSection = dynamic(() => import("@/components/IntelligenceSection"));
const HowItWorks = dynamic(() => import("@/components/HowItWorks"));
const Benefits = dynamic(() => import("@/components/Benefits"));
const NetworkSection = dynamic(() => import("@/components/NetworkSection"));
const DemoAccess = dynamic(() => import("@/components/DemoAccess"));
const Contact = dynamic(() => import("@/components/Contact"));
const Footer = dynamic(() => import("@/components/Footer"));

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <TrustBar />
      <ProblemSection />
      <div className="section-divider" />
      <SolutionSection />
      <div className="section-divider" />
      <IntelligenceSection />
      <div className="section-divider" />
      <HowItWorks />
      <div className="section-divider" />
      <Benefits />
      <div className="section-divider" />
      <NetworkSection />
      <DemoAccess />
      <Contact />
      <Footer />
    </main>
  );
}
