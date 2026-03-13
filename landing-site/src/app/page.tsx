import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import ProblemSection from "@/components/ProblemSection";
import SolutionSection from "@/components/SolutionSection";
import HowItWorks from "@/components/HowItWorks";
import Benefits from "@/components/Benefits";
import DemoAccess from "@/components/DemoAccess";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

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
      <HowItWorks />
      <div className="section-divider" />
      <Benefits />
      <DemoAccess />
      <Contact />
      <Footer />
    </main>
  );
}
