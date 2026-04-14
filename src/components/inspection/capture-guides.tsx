"use client";

/**
 * CaptureGuide — Visual reference illustrations for each of the 21 capture angles.
 *
 * Renders an inline SVG showing a generic sedan from the required angle with a
 * camera-position marker and sight-line so the inspector can match the view
 * without reading text instructions.
 */

import { type FC } from "react";

// ---------------------------------------------------------------------------
//  Shared drawing primitives
// ---------------------------------------------------------------------------

const STROKE = "#94a3b8";        // slate-400
const FILL = "#1e293b";          // slate-800
const FILL_LIGHT = "#334155";    // slate-700
const ACCENT = "#3b82f6";        // blue-500  (camera marker)
const SIGHT = "#3b82f6";         // sight-line

/** Camera icon marker — small circle + camera glyph */
function CameraMarker({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={14} fill={ACCENT} opacity={0.2} />
      <circle cx={x} cy={y} r={10} fill={ACCENT} opacity={0.9} />
      {/* Simplified camera icon */}
      <rect x={x - 5} y={y - 3} width={10} height={7} rx={1} fill="white" opacity={0.9} />
      <circle cx={x} cy={y + 0.5} r={2} fill={ACCENT} />
      <rect x={x - 2} y={y - 5} width={4} height={2} rx={0.5} fill="white" opacity={0.9} />
    </g>
  );
}

/** Dashed sight-line from camera to vehicle */
function SightLine({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={SIGHT}
      strokeWidth={1.5}
      strokeDasharray="4 3"
      opacity={0.5}
    />
  );
}

/** Corner bracket framing guides */
function FramingBrackets({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  const len = 15;
  return (
    <g stroke={STROKE} strokeWidth={1} opacity={0.25}>
      {/* Top-left */}
      <polyline points={`${x},${y + len} ${x},${y} ${x + len},${y}`} fill="none" />
      {/* Top-right */}
      <polyline points={`${x + w - len},${y} ${x + w},${y} ${x + w},${y + len}`} fill="none" />
      {/* Bottom-left */}
      <polyline points={`${x},${y + h - len} ${x},${y + h} ${x + len},${y + h}`} fill="none" />
      {/* Bottom-right */}
      <polyline points={`${x + w - len},${y + h} ${x + w},${y + h} ${x + w},${y + h - len}`} fill="none" />
    </g>
  );
}

// ---------------------------------------------------------------------------
//  Generic sedan body — reusable path fragments
// ---------------------------------------------------------------------------

/** Side-profile sedan (facing right) */
function SedanSideRight({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Body */}
      <path
        d="M30,80 L30,65 Q30,55 40,50 L70,40 Q80,37 90,30 L140,20 Q160,17 180,20 L210,30 Q220,35 225,45 L240,55 Q250,60 250,70 L250,80"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={2}
      />
      {/* Roof line */}
      <path
        d="M90,30 Q100,15 130,12 Q160,10 180,20"
        fill="none"
        stroke={STROKE}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Windows */}
      <path
        d="M95,32 Q105,20 130,17 Q150,15 170,22 L165,38 Q140,35 95,32Z"
        fill={FILL_LIGHT}
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Front wheel */}
      <circle cx={75} cy={80} r={18} fill={FILL} stroke={STROKE} strokeWidth={2} />
      <circle cx={75} cy={80} r={10} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      {/* Rear wheel */}
      <circle cx={205} cy={80} r={18} fill={FILL} stroke={STROKE} strokeWidth={2} />
      <circle cx={205} cy={80} r={10} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      {/* Headlight */}
      <ellipse cx={38} cy={58} rx={6} ry={4} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      {/* Taillight */}
      <ellipse cx={245} cy={58} rx={4} ry={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

/** Side-profile sedan (facing left — mirrored) */
function SedanSideLeft({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${-scale},${scale})`} style={{ transformOrigin: `${x}px ${y}px` }}>
      <SedanSideRight x={0} y={0} scale={1} />
    </g>
  );
}

/** Top-down sedan view */
function SedanTopDown({ x = 0, y = 0, scale = 1 }: { x?: number; y?: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Body outline */}
      <path
        d="M60,20 Q70,10 90,8 L110,8 Q130,10 140,20 L150,50 Q152,70 150,100 L145,140 Q140,155 130,160 L70,160 Q60,155 55,140 L50,100 Q48,70 50,50 Z"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={2}
      />
      {/* Windshield */}
      <path
        d="M70,42 Q80,30 100,28 Q120,30 130,42 L128,55 Q100,52 72,55Z"
        fill={FILL_LIGHT}
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Rear window */}
      <path
        d="M75,115 Q80,110 100,108 Q120,110 125,115 L123,128 Q100,125 77,128Z"
        fill={FILL_LIGHT}
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Wheels — left */}
      <rect x={42} y={38} width={10} height={24} rx={3} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      <rect x={42} y={110} width={10} height={24} rx={3} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Wheels — right */}
      <rect x={148} y={38} width={10} height={24} rx={3} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      <rect x={148} y={110} width={10} height={24} rx={3} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
    </g>
  );
}

/** 3/4 perspective sedan — front-passenger view */
function SedanThreeQuarter({ x = 0, y = 0, scale = 1, flip = false }: { x?: number; y?: number; scale?: number; flip?: boolean }) {
  const tx = flip ? `translate(${x},${y}) scale(${-scale},${scale})` : `translate(${x},${y}) scale(${scale})`;
  return (
    <g transform={tx} style={flip ? { transformOrigin: `${x}px ${y}px` } : undefined}>
      {/* Body — perspective */}
      <path
        d="M40,90 L50,70 Q55,55 70,45 L100,32 Q115,25 140,22 L180,25 Q200,30 210,45 L220,60 Q225,70 225,80 L225,90"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={2}
      />
      {/* Roof */}
      <path
        d="M100,32 Q115,15 145,12 Q170,14 180,25"
        fill="none"
        stroke={STROKE}
        strokeWidth={1.5}
        opacity={0.6}
      />
      {/* Side panel line */}
      <path
        d="M225,80 L235,78 Q240,70 238,60 L230,50 Q225,42 215,38 L190,28"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={1.5}
        opacity={0.7}
      />
      {/* Window */}
      <path
        d="M105,34 Q120,20 145,17 Q165,19 175,27 L172,42 Q140,38 108,36Z"
        fill={FILL_LIGHT}
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.4}
      />
      {/* Front wheel */}
      <ellipse cx={85} cy={90} rx={20} ry={16} fill={FILL} stroke={STROKE} strokeWidth={2} />
      <ellipse cx={85} cy={90} rx={11} ry={9} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      {/* Rear wheel */}
      <ellipse cx={200} cy={90} rx={16} ry={14} fill={FILL} stroke={STROKE} strokeWidth={2} />
      <ellipse cx={200} cy={90} rx={9} ry={8} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      {/* Headlight */}
      <ellipse cx={52} cy={65} rx={7} ry={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
    </g>
  );
}

/** Front/rear view of sedan */
function SedanFrontView({ x = 0, y = 0, scale = 1, isRear = false }: { x?: number; y?: number; scale?: number; isRear?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Body */}
      <path
        d="M50,95 L50,65 Q50,50 60,42 L80,30 Q90,15 110,10 Q130,15 140,30 L160,42 Q170,50 170,65 L170,95"
        fill={FILL}
        stroke={STROKE}
        strokeWidth={2}
      />
      {/* Windshield / rear window */}
      <path
        d={isRear
          ? "M75,38 Q90,22 110,20 Q130,22 145,38 L142,52 Q110,48 78,52Z"
          : "M78,40 Q92,22 110,18 Q128,22 142,40 L138,55 Q110,50 82,55Z"
        }
        fill={FILL_LIGHT}
        stroke={STROKE}
        strokeWidth={1}
        opacity={0.5}
      />
      {/* Lights */}
      <ellipse cx={60} cy={60} rx={7} ry={8} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      <ellipse cx={160} cy={60} rx={7} ry={8} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Bumper */}
      <path
        d="M55,90 Q60,97 110,98 Q160,97 165,90"
        fill="none"
        stroke={STROKE}
        strokeWidth={1.5}
        opacity={0.5}
      />
      {/* Wheels */}
      <rect x={42} y={82} width={16} height={16} rx={4} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <rect x={162} y={82} width={16} height={16} rx={4} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Grille / plate area */}
      <rect x={90} y={70} width={40} height={12} rx={2} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} opacity={0.5} />
    </g>
  );
}

// ---------------------------------------------------------------------------
//  Per-angle illustrations
// ---------------------------------------------------------------------------

function FrontCenter() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={20} y={10} w={260} h={180} />
      <SedanFrontView x={40} y={45} scale={1} />
      <SightLine x1={150} y1={190} x2={150} y2={150} />
      <CameraMarker x={150} y={190} />
    </svg>
  );
}

function FrontThreeQuarterPassenger() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      <SedanThreeQuarter x={30} y={50} scale={1} />
      <SightLine x1={50} y1={185} x2={120} y2={130} />
      <CameraMarker x={50} y={185} />
    </svg>
  );
}

function FrontThreeQuarterDriver() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      <SedanThreeQuarter x={270} y={50} scale={1} flip />
      <SightLine x1={250} y1={185} x2={180} y2={130} />
      <CameraMarker x={250} y={185} />
    </svg>
  );
}

function DriverSide() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={10} y={20} w={280} h={160} />
      <SedanSideLeft x={290} y={35} scale={1} />
      <SightLine x1={150} y1={185} x2={150} y2={140} />
      <CameraMarker x={150} y={185} />
    </svg>
  );
}

function PassengerSide() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={10} y={20} w={280} h={160} />
      <SedanSideRight x={10} y={35} scale={1} />
      <SightLine x1={150} y1={185} x2={150} y2={140} />
      <CameraMarker x={150} y={185} />
    </svg>
  );
}

function RearCenter() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={20} y={10} w={260} h={180} />
      <SedanFrontView x={40} y={45} scale={1} isRear />
      <SightLine x1={150} y1={190} x2={150} y2={150} />
      <CameraMarker x={150} y={190} />
    </svg>
  );
}

function RearThreeQuarterPassenger() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      <g transform="scale(-1,1) translate(-300,0)">
        <SedanThreeQuarter x={30} y={50} scale={1} />
      </g>
      <SightLine x1={250} y1={185} x2={180} y2={130} />
      <CameraMarker x={250} y={185} />
    </svg>
  );
}

function RearThreeQuarterDriver() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      <g transform="scale(-1,1) translate(-300,0)">
        <SedanThreeQuarter x={270} y={50} scale={1} flip />
      </g>
      <SightLine x1={50} y1={185} x2={120} y2={130} />
      <CameraMarker x={50} y={185} />
    </svg>
  );
}

function RoofView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={40} y={10} w={220} h={180} />
      <SedanTopDown x={50} y={10} scale={1} />
      {/* Downward arrow indicating overhead angle */}
      <g opacity={0.6}>
        <line x1={240} y1={30} x2={200} y2={70} stroke={SIGHT} strokeWidth={1.5} strokeDasharray="4 3" />
        <polygon points="200,70 205,62 195,65" fill={SIGHT} />
      </g>
      <CameraMarker x={245} y={25} />
      <text x={245} y={52} textAnchor="middle" fill={STROKE} fontSize={9} opacity={0.6}>above</text>
    </svg>
  );
}

// ── Interior ──

function DashboardSteering() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      {/* Windshield frame */}
      <path d="M30,30 L270,30 L280,170 L20,170Z" fill={FILL} stroke={STROKE} strokeWidth={1.5} opacity={0.3} />
      {/* Dashboard */}
      <path d="M40,120 Q150,110 260,120 L265,160 L35,160Z" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Steering wheel */}
      <circle cx={110} cy={105} r={28} fill="none" stroke={STROKE} strokeWidth={2.5} />
      <circle cx={110} cy={105} r={8} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Steering spokes */}
      <line x1={110} y1={77} x2={110} y2={90} stroke={STROKE} strokeWidth={2} />
      <line x1={85} y1={115} x2={98} y2={110} stroke={STROKE} strokeWidth={2} />
      <line x1={135} y1={115} x2={122} y2={110} stroke={STROKE} strokeWidth={2} />
      {/* Gauge cluster */}
      <rect x={75} y={80} width={70} height={20} rx={4} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      {/* Center console / infotainment */}
      <rect x={165} y={85} width={55} height={40} rx={4} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* AC vents */}
      <rect x={170} y={130} width={45} height={8} rx={2} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      <CameraMarker x={150} y={185} />
      <SightLine x1={150} y1={185} x2={150} y2={140} />
    </svg>
  );
}

function OdometerView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={30} y={15} w={240} h={170} />
      {/* Gauge cluster housing */}
      <rect x={50} y={30} width={200} height={130} rx={15} fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Speedometer */}
      <circle cx={120} cy={90} r={45} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Speed markings */}
      {[0, 30, 60, 90, 120, 150, 180].map((deg, i) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const inner = 35;
        const outer = 42;
        return (
          <line
            key={i}
            x1={120 + Math.cos(rad) * inner}
            y1={90 + Math.sin(rad) * inner}
            x2={120 + Math.cos(rad) * outer}
            y2={90 + Math.sin(rad) * outer}
            stroke={STROKE}
            strokeWidth={1.5}
            opacity={0.6}
          />
        );
      })}
      {/* Tach */}
      <circle cx={200} cy={90} r={30} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Odometer readout — highlighted */}
      <rect x={85} y={118} width={70} height={18} rx={3} fill={ACCENT} opacity={0.15} stroke={ACCENT} strokeWidth={1.5} />
      <text x={120} y={131} textAnchor="middle" fill={STROKE} fontSize={10} fontFamily="monospace">
        ODO: xxxxx
      </text>
      <CameraMarker x={150} y={185} />
      <SightLine x1={150} y1={185} x2={120} y2={140} />
    </svg>
  );
}

function FrontSeatsView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      {/* Driver seat */}
      <path d="M40,170 L40,80 Q40,50 60,45 L95,45 Q105,50 105,80 L105,170" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Driver headrest */}
      <rect x={52} y={35} width={40} height={18} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Driver bolster */}
      <path d="M45,85 Q70,78 100,85" fill="none" stroke={STROKE} strokeWidth={1} opacity={0.5} />
      {/* Passenger seat */}
      <path d="M195,170 L195,80 Q195,50 215,45 L250,45 Q260,50 260,80 L260,170" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Passenger headrest */}
      <rect x={207} y={35} width={40} height={18} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Center console */}
      <rect x={115} y={60} width={70} height={120} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Shifter */}
      <circle cx={150} cy={120} r={8} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Armrest */}
      <rect x={125} y={80} width={50} height={25} rx={4} fill={FILL} stroke={STROKE} strokeWidth={1} opacity={0.6} />
      <CameraMarker x={150} y={190} />
    </svg>
  );
}

function RearSeatsView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      {/* Rear bench seat */}
      <path d="M30,170 L30,80 Q30,55 50,50 L250,50 Q270,55 270,80 L270,170" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Headrests */}
      <rect x={55} y={38} width={35} height={18} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      <rect x={132} y={38} width={35} height={18} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      <rect x={210} y={38} width={35} height={18} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Seat lines */}
      <line x1={115} y1={55} x2={115} y2={170} stroke={STROKE} strokeWidth={1} opacity={0.4} />
      <line x1={185} y1={55} x2={185} y2={170} stroke={STROKE} strokeWidth={1} opacity={0.4} />
      {/* Floor mats */}
      <rect x={40} y={155} width={220} height={20} rx={3} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} opacity={0.4} />
      <CameraMarker x={150} y={190} />
    </svg>
  );
}

function CargoAreaView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={20} y={10} w={260} h={180} />
      {/* Trunk opening */}
      <path d="M40,30 L260,30 L270,170 L30,170Z" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Trunk floor */}
      <rect x={50} y={90} width={200} height={70} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Trunk lid (open) */}
      <path d="M40,30 L45,15 Q150,5 255,15 L260,30" fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} opacity={0.5} />
      {/* Hinge lines */}
      <line x1={50} y1={30} x2={50} y2={50} stroke={STROKE} strokeWidth={1} opacity={0.3} />
      <line x1={250} y1={30} x2={250} y2={50} stroke={STROKE} strokeWidth={1} opacity={0.3} />
      {/* Spare tire well hint */}
      <ellipse cx={150} cy={140} rx={40} ry={10} fill="none" stroke={STROKE} strokeWidth={1} opacity={0.3} />
      <CameraMarker x={150} y={190} />
      <SightLine x1={150} y1={190} x2={150} y2={160} />
    </svg>
  );
}

// ── Mechanical ──

function EngineBayView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={15} y={10} w={270} h={180} />
      {/* Hood opening */}
      <path d="M35,25 L265,25 L275,165 L25,165Z" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Engine block */}
      <rect x={80} y={55} width={100} height={60} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Valve cover */}
      <rect x={90} y={45} width={80} height={15} rx={3} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Air intake */}
      <ellipse cx={210} cy={70} rx={25} ry={20} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Battery */}
      <rect x={50} y={60} width={25} height={20} rx={2} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      {/* Coolant reservoir */}
      <rect x={55} y={100} width={15} height={25} rx={2} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} opacity={0.6} />
      {/* Belts/pulleys */}
      <circle cx={130} cy={130} r={12} fill="none" stroke={STROKE} strokeWidth={1.5} opacity={0.5} />
      <circle cx={160} cy={135} r={8} fill="none" stroke={STROKE} strokeWidth={1} opacity={0.5} />
      {/* Hood prop */}
      <line x1={255} y1={25} x2={250} y2={60} stroke={STROKE} strokeWidth={2} opacity={0.5} />
      <CameraMarker x={150} y={190} />
      <text x={150} y={188} textAnchor="middle" fill={STROKE} fontSize={0} opacity={0} />
    </svg>
  );
}

function DoorJambView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={20} y={10} w={260} h={180} />
      {/* Door frame */}
      <path d="M60,20 L60,180 L120,180 L120,20Z" fill={FILL_LIGHT} stroke={STROKE} strokeWidth={2} />
      {/* Door (open) */}
      <path d="M120,20 L260,50 L260,170 L120,180Z" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* VIN sticker — highlighted */}
      <rect x={68} y={70} width={42} height={55} rx={3} fill={ACCENT} opacity={0.12} stroke={ACCENT} strokeWidth={1.5} />
      {/* Sticker text lines */}
      {[80, 88, 96, 104, 112].map((lineY) => (
        <line key={lineY} x1={73} y1={lineY} x2={105} y2={lineY} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      ))}
      <text x={89} y={78} textAnchor="middle" fill={ACCENT} fontSize={7} opacity={0.7}>VIN</text>
      {/* Door hinge */}
      <rect x={116} y={50} width={8} height={16} rx={2} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      <rect x={116} y={130} width={8} height={16} rx={2} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      {/* Door handle */}
      <rect x={200} y={95} width={30} height={8} rx={3} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} />
      <CameraMarker x={89} y={185} />
      <SightLine x1={89} y1={185} x2={89} y2={130} />
    </svg>
  );
}

function UndercarriageView() {
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={10} y={5} w={280} h={190} />
      {/* Ground line */}
      <line x1={10} y1={170} x2={290} y2={170} stroke={STROKE} strokeWidth={1} opacity={0.3} />
      {/* Vehicle underside (from low angle) */}
      <path d="M40,60 L260,60 L270,100 Q270,120 260,130 L40,130 Q30,120 30,100Z" fill={FILL} stroke={STROKE} strokeWidth={2} />
      {/* Exhaust */}
      <rect x={180} y={125} width={60} height={10} rx={5} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1.5} />
      <ellipse cx={245} cy={130} rx={8} ry={5} fill={FILL} stroke={STROKE} strokeWidth={1} />
      {/* Suspension components */}
      <line x1={70} y1={130} x2={70} y2={155} stroke={STROKE} strokeWidth={2} opacity={0.6} />
      <line x1={230} y1={130} x2={230} y2={155} stroke={STROKE} strokeWidth={2} opacity={0.6} />
      {/* Wheels (edge view) */}
      <ellipse cx={70} cy={160} rx={25} ry={10} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      <ellipse cx={230} cy={160} rx={25} ry={10} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Drivetrain */}
      <rect x={100} y={90} width={100} height={15} rx={3} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={1} opacity={0.5} />
      {/* Frame rails */}
      <line x1={50} y1={75} x2={250} y2={75} stroke={STROKE} strokeWidth={2} opacity={0.4} />
      <line x1={50} y1={115} x2={250} y2={115} stroke={STROKE} strokeWidth={2} opacity={0.4} />
      <CameraMarker x={150} y={190} />
      <text x={150} y={16} textAnchor="middle" fill={STROKE} fontSize={9} opacity={0.5}>ground level</text>
    </svg>
  );
}

function TireCloseup({ position }: { position: "FL" | "FR" | "RL" | "RR" }) {
  const labels: Record<string, string> = { FL: "Front Driver", FR: "Front Pass.", RL: "Rear Driver", RR: "Rear Pass." };
  const isLeft = position === "FL" || position === "RL";
  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      <FramingBrackets x={30} y={10} w={240} h={180} />
      {/* Tire */}
      <ellipse cx={150} cy={100} rx={80} ry={75} fill={FILL} stroke={STROKE} strokeWidth={2.5} />
      {/* Rim */}
      <ellipse cx={150} cy={100} rx={40} ry={38} fill={FILL_LIGHT} stroke={STROKE} strokeWidth={2} />
      {/* Hub */}
      <circle cx={150} cy={100} r={12} fill={FILL} stroke={STROKE} strokeWidth={1.5} />
      {/* Lug nuts */}
      {[0, 72, 144, 216, 288].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return <circle key={deg} cx={150 + Math.cos(rad) * 8} cy={100 + Math.sin(rad) * 8} r={2} fill={STROKE} />;
      })}
      {/* Spoke lines */}
      {[0, 60, 120, 180, 240, 300].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        return (
          <line
            key={deg}
            x1={150 + Math.cos(rad) * 14}
            y1={100 + Math.sin(rad) * 14}
            x2={150 + Math.cos(rad) * 36}
            y2={100 + Math.sin(rad) * 34}
            stroke={STROKE}
            strokeWidth={1.5}
            opacity={0.4}
          />
        );
      })}
      {/* Tread lines */}
      {[-55, -35, -15, 5, 25, 45].map((offset) => (
        <path
          key={offset}
          d={`M${isLeft ? 75 : 225},${100 + offset} Q${150},${95 + offset} ${isLeft ? 225 : 75},${100 + offset}`}
          fill="none"
          stroke={STROKE}
          strokeWidth={1}
          opacity={0.25}
        />
      ))}
      {/* Sidewall highlight zone */}
      <path
        d="M80,55 Q70,100 80,145"
        fill="none"
        stroke={ACCENT}
        strokeWidth={1.5}
        opacity={0.3}
        strokeDasharray="4 3"
      />
      <text x={150} y={190} textAnchor="middle" fill={STROKE} fontSize={10} opacity={0.5}>{labels[position]}</text>
    </svg>
  );
}

// ---------------------------------------------------------------------------
//  Main export — maps capture type to illustration
// ---------------------------------------------------------------------------

const GUIDE_MAP: Record<string, FC> = {
  FRONT_CENTER:         FrontCenter,
  FRONT_34_DRIVER:      FrontThreeQuarterDriver,
  DRIVER_SIDE:          DriverSide,
  REAR_34_DRIVER:       RearThreeQuarterDriver,
  REAR_CENTER:          RearCenter,
  REAR_34_PASSENGER:    RearThreeQuarterPassenger,
  PASSENGER_SIDE:       PassengerSide,
  FRONT_34_PASSENGER:   FrontThreeQuarterPassenger,
  ROOF:                 RoofView,
  DASHBOARD_DRIVER:     DashboardSteering,
  ODOMETER:             OdometerView,
  FRONT_SEATS:          FrontSeatsView,
  REAR_SEATS:           RearSeatsView,
  CARGO_AREA:           CargoAreaView,
  ENGINE_BAY:           EngineBayView,
  DOOR_JAMB_DRIVER:     DoorJambView,
  UNDERCARRIAGE:        UndercarriageView,
  TIRE_FRONT_DRIVER:    () => <TireCloseup position="FL" />,
  TIRE_REAR_DRIVER:     () => <TireCloseup position="RL" />,
  TIRE_FRONT_PASSENGER: () => <TireCloseup position="FR" />,
  TIRE_REAR_PASSENGER:  () => <TireCloseup position="RR" />,
};

interface CaptureGuideProps {
  type: string;
  className?: string;
}

export function CaptureGuide({ type, className }: CaptureGuideProps) {
  const Guide = GUIDE_MAP[type];
  if (!Guide) return null;
  return (
    <div className={className}>
      <Guide />
    </div>
  );
}
