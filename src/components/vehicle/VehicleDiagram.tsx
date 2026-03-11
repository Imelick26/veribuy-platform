"use client";

import { useState } from "react";

export interface DiagramHotspot {
  id: string;
  position: [number, number, number]; // x,y,z from risk-positions.ts
  severity: "CRITICAL" | "MAJOR" | "MODERATE" | "MINOR" | "INFO";
  label: string;
}

interface VehicleDiagramProps {
  hotspots?: DiagramHotspot[];
  onHotspotClick?: (id: string) => void;
  activeHotspot?: string | null;
  className?: string;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: "#dc2626",
  MAJOR: "#ea580c",
  MODERATE: "#ca8a04",
  MINOR: "#16a34a",
  INFO: "#2563eb",
};

/**
 * Map 3D coordinates (x: [-1.2,1.2], y: [-0.1,0.7], z: [-0.55,0.55])
 * to SVG viewport (800 x 340). Side view: x → svgX, y → svgY (inverted).
 * z is ignored (side view flattens depth).
 */
function toSVG(pos: [number, number, number]): { cx: number; cy: number } {
  // x: -1.2 (rear) → 1.2 (front) mapped to svgX: 680 → 120 (car faces left)
  const cx = 400 - (pos[0] / 1.2) * 280;
  // y: -0.1 (ground) → 0.7 (roof) mapped to svgY: 260 → 60
  const cy = 260 - ((pos[1] + 0.1) / 0.8) * 200;
  return { cx: Math.max(60, Math.min(740, cx)), cy: Math.max(40, Math.min(280, cy)) };
}

export function VehicleDiagram({
  hotspots = [],
  onHotspotClick,
  activeHotspot,
  className = "",
}: VehicleDiagramProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className={`relative bg-white rounded-xl border border-gray-200 overflow-hidden ${className}`}>
      <svg viewBox="0 0 800 340" className="w-full h-auto" xmlns="http://www.w3.org/2000/svg">
        {/* Background */}
        <rect width="800" height="340" fill="white" />

        {/* Ground line */}
        <line x1="40" y1="275" x2="760" y2="275" stroke="#e5e7eb" strokeWidth="1.5" />
        <line x1="40" y1="276" x2="760" y2="276" stroke="#f3f4f6" strokeWidth="3" />

        {/* Vehicle Body — Side profile sedan/SUV silhouette */}
        <g transform="translate(400, 170)">
          {/* Main body */}
          <path
            d="M-260,60 L-260,20 C-260,10 -250,0 -240,0 L-180,-5 C-160,-8 -140,-10 -120,-10
               L-80,-10 C-60,-10 -40,-45 -20,-55 L20,-60 C40,-62 80,-62 120,-60
               L160,-55 C180,-45 200,-10 220,-10 L250,-10 C270,-10 280,0 280,10
               L280,40 C280,50 275,55 270,60 Z"
            fill="#f0f4ff"
            stroke="#94a3b8"
            strokeWidth="2"
          />

          {/* Roof line */}
          <path
            d="M-40,-45 C-20,-55 20,-60 60,-62 C100,-60 140,-55 160,-45"
            fill="none"
            stroke="#94a3b8"
            strokeWidth="1.5"
          />

          {/* Windshield */}
          <path
            d="M-40,-45 L-80,-10"
            stroke="#60a5fa"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Rear window */}
          <path
            d="M160,-45 L200,-10"
            stroke="#60a5fa"
            strokeWidth="2.5"
            strokeLinecap="round"
          />

          {/* Side windows */}
          <path
            d="M-38,-43 C-18,-53 20,-58 60,-60 C100,-58 138,-53 158,-43 L198,-10 L-78,-10 Z"
            fill="#dbeafe"
            fillOpacity="0.5"
            stroke="#93c5fd"
            strokeWidth="1"
          />

          {/* Window divider (B-pillar) */}
          <line x1="60" y1="-60" x2="60" y2="-10" stroke="#94a3b8" strokeWidth="2.5" />

          {/* Door line */}
          <line x1="60" y1="-10" x2="60" y2="55" stroke="#94a3b8" strokeWidth="1" strokeDasharray="4,3" />

          {/* Hood line */}
          <path
            d="M-120,-10 L-240,0"
            stroke="#94a3b8"
            strokeWidth="1"
          />

          {/* Trunk line */}
          <path
            d="M220,-10 L260,5"
            stroke="#94a3b8"
            strokeWidth="1"
          />

          {/* Headlight */}
          <ellipse cx="-255" cy="20" rx="12" ry="15" fill="#fef9c3" stroke="#94a3b8" strokeWidth="1.5" />
          <ellipse cx="-255" cy="20" rx="6" ry="8" fill="#fde68a" />

          {/* Taillight */}
          <rect x="268" y="15" width="10" height="25" rx="3" fill="#fecaca" stroke="#94a3b8" strokeWidth="1.5" />

          {/* Bumpers */}
          <path d="M-265,40 L-270,55 L-260,60" stroke="#94a3b8" strokeWidth="1.5" fill="none" />
          <path d="M275,40 L280,55 L270,60" stroke="#94a3b8" strokeWidth="1.5" fill="none" />

          {/* Side skirt detail */}
          <line x1="-200" y1="55" x2="240" y2="55" stroke="#cbd5e1" strokeWidth="0.75" />

          {/* Door handle */}
          <rect x="15" y="5" width="20" height="5" rx="2" fill="#94a3b8" />

          {/* Side mirror */}
          <ellipse cx="-85" cy="-5" rx="10" ry="7" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="1" />
        </g>

        {/* Front wheel */}
        <g transform="translate(220, 235)">
          <circle r="38" fill="#374151" stroke="#1f2937" strokeWidth="2" />
          <circle r="28" fill="#4b5563" />
          <circle r="15" fill="#6b7280" />
          <circle r="6" fill="#9ca3af" />
          {/* Spokes */}
          {[0, 72, 144, 216, 288].map((angle) => (
            <line
              key={angle}
              x1="0" y1="0"
              x2={Math.cos((angle * Math.PI) / 180) * 22}
              y2={Math.sin((angle * Math.PI) / 180) * 22}
              stroke="#9ca3af"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Rear wheel */}
        <g transform="translate(580, 235)">
          <circle r="38" fill="#374151" stroke="#1f2937" strokeWidth="2" />
          <circle r="28" fill="#4b5563" />
          <circle r="15" fill="#6b7280" />
          <circle r="6" fill="#9ca3af" />
          {[0, 72, 144, 216, 288].map((angle) => (
            <line
              key={angle}
              x1="0" y1="0"
              x2={Math.cos((angle * Math.PI) / 180) * 22}
              y2={Math.sin((angle * Math.PI) / 180) * 22}
              stroke="#9ca3af"
              strokeWidth="3"
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Zone labels (subtle) */}
        <text x="180" y="155" fontSize="9" fill="#9ca3af" textAnchor="middle" fontFamily="system-ui">ENGINE</text>
        <text x="400" y="125" fontSize="9" fill="#9ca3af" textAnchor="middle" fontFamily="system-ui">CABIN</text>
        <text x="600" y="155" fontSize="9" fill="#9ca3af" textAnchor="middle" fontFamily="system-ui">REAR</text>
        <text x="220" y="295" fontSize="9" fill="#9ca3af" textAnchor="middle" fontFamily="system-ui">FRONT</text>
        <text x="580" y="295" fontSize="9" fill="#9ca3af" textAnchor="middle" fontFamily="system-ui">REAR</text>

        {/* Hotspots */}
        {hotspots.map((hs) => {
          const { cx, cy } = toSVG(hs.position);
          const color = SEVERITY_COLORS[hs.severity] || SEVERITY_COLORS.INFO;
          const isActive = activeHotspot === hs.id;
          const isHovered = hoveredId === hs.id;
          const r = isActive || isHovered ? 14 : 10;

          return (
            <g
              key={hs.id}
              className="cursor-pointer"
              onClick={() => onHotspotClick?.(hs.id)}
              onMouseEnter={() => setHoveredId(hs.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              {/* Pulse ring for active */}
              {isActive && (
                <circle cx={cx} cy={cy} r={20} fill="none" stroke={color} strokeWidth="2" opacity="0.4">
                  <animate attributeName="r" from="14" to="24" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* Outer glow */}
              <circle cx={cx} cy={cy} r={r + 3} fill={color} opacity="0.15" />

              {/* Main marker */}
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={color}
                stroke="white"
                strokeWidth="2.5"
                opacity={isActive || isHovered ? 1 : 0.85}
              />

              {/* Severity icon inside */}
              <text
                x={cx}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={isActive || isHovered ? "11" : "9"}
                fontWeight="bold"
                fill="white"
                fontFamily="system-ui"
              >
                {hs.severity === "CRITICAL" ? "!" : hs.severity === "MAJOR" ? "!" : "·"}
              </text>

              {/* Label tooltip */}
              {(isHovered || isActive) && (
                <g>
                  <rect
                    x={cx - 60}
                    y={cy - r - 28}
                    width="120"
                    height="22"
                    rx="6"
                    fill="#1f2937"
                    opacity="0.92"
                  />
                  <text
                    x={cx}
                    y={cy - r - 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="white"
                    fontFamily="system-ui"
                  >
                    {hs.label.length > 18 ? hs.label.slice(0, 16) + "…" : hs.label}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Legend */}
        {hotspots.length > 0 && (
          <g transform="translate(640, 15)">
            {[
              { label: "Critical", color: SEVERITY_COLORS.CRITICAL },
              { label: "Major", color: SEVERITY_COLORS.MAJOR },
              { label: "Moderate", color: SEVERITY_COLORS.MODERATE },
              { label: "Minor", color: SEVERITY_COLORS.MINOR },
            ].map((item, i) => (
              <g key={item.label} transform={`translate(0, ${i * 18})`}>
                <circle cx="6" cy="6" r="5" fill={item.color} />
                <text x="16" y="10" fontSize="10" fill="#6b7280" fontFamily="system-ui">{item.label}</text>
              </g>
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
