"use client";

import { motion } from "framer-motion";
import VehicleInspectionVisual from "./VehicleInspectionVisual";

export default function RiskDemo() {
  return (
    <section id="platform" className="relative py-16 lg:py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-6"
        >
          <p className="text-sm font-medium text-accent-magenta uppercase tracking-[0.15em] mb-4">
            The Platform
          </p>
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            From Capture to Confidence{" "}
            <span className="text-brand-gradient">in Minutes.</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
            VeriBuy brings model-specific issues to light and locates them
            on an interactive diagram — turning a basic walk-around into a
            quantifiable purchase decision.
          </p>
        </motion.div>

        {/* Interactive 3D model */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <VehicleInspectionVisual />
        </motion.div>

        {/* Interaction hint */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 1.5 }}
          className="text-center text-[11px] text-gray-600 mt-4"
        >
          Drag to rotate &middot; Scroll to zoom &middot; 8 known issues from NHTSA data
        </motion.p>
      </div>
    </section>
  );
}
