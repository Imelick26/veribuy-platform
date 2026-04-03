import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import TrustBar from "@/components/TrustBar";
import SolutionSection from "@/components/SolutionSection";
import DemoAccess from "@/components/DemoAccess";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen">
      <Navbar />
      <Hero />
      <TrustBar />
      <div className="section-divider" />
      <SolutionSection />
      <div className="section-divider" />
      <DemoAccess />
      <Footer />
    </main>
  );
}
