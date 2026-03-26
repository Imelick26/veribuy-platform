"use client";

/**
 * GuidedCapture — Full-screen guided walkthrough camera flow.
 *
 * Walks the inspector through all 21 standard vehicle photos one at a time,
 * auto-advancing after each capture. Ordered for an efficient physical
 * walkthrough around the vehicle.
 */

import { useRef, useState, useCallback, useMemo } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle,
  SkipForward,
  RotateCcw,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
//  Shot definitions — ordered for efficient physical walkthrough
// ---------------------------------------------------------------------------

export interface CaptureShot {
  type: string;
  label: string;
  hint: string;
  section: "EXTERIOR" | "INTERIOR" | "MECHANICAL";
}

export const GUIDED_SHOTS: CaptureShot[] = [
  // ── Exterior (walk around vehicle) ──
  { type: "FRONT_CENTER",        label: "Front Center",           hint: "6-8 ft, centered, full vehicle visible",       section: "EXTERIOR" },
  { type: "FRONT_34_DRIVER",     label: "Front 3/4 Driver",       hint: "45° angle from driver side",                   section: "EXTERIOR" },
  { type: "DRIVER_SIDE",         label: "Driver Side",            hint: "Full profile, 8-10 ft distance",               section: "EXTERIOR" },
  { type: "REAR_34_DRIVER",      label: "Rear 3/4 Driver",        hint: "45° angle from rear driver side",              section: "EXTERIOR" },
  { type: "REAR_CENTER",         label: "Rear Center",            hint: "6-8 ft, centered, full vehicle visible",       section: "EXTERIOR" },
  { type: "REAR_34_PASSENGER",   label: "Rear 3/4 Passenger",     hint: "45° angle from rear passenger side",           section: "EXTERIOR" },
  { type: "PASSENGER_SIDE",      label: "Passenger Side",         hint: "Full profile, 8-10 ft distance",               section: "EXTERIOR" },
  { type: "FRONT_34_PASSENGER",  label: "Front 3/4 Passenger",    hint: "45° angle from passenger side",                section: "EXTERIOR" },
  { type: "ROOF",                label: "Roof",                   hint: "Overhead or elevated angle showing full roof",  section: "EXTERIOR" },

  // ── Interior (open doors, sit inside) ──
  { type: "DASHBOARD_DRIVER",    label: "Dashboard & Steering",   hint: "Wide shot showing dash, steering wheel, gauges, center console", section: "INTERIOR" },
  { type: "ODOMETER",            label: "Odometer",               hint: "Instrument cluster showing current mileage, clearly readable",   section: "INTERIOR" },
  { type: "FRONT_SEATS",         label: "Front Seats",            hint: "Both front seats visible, show bolsters and center console",      section: "INTERIOR" },
  { type: "REAR_SEATS",          label: "Rear Seats",             hint: "Full rear seating area and floor",                                section: "INTERIOR" },
  { type: "CARGO_AREA",          label: "Trunk / Cargo",          hint: "Open trunk or cargo area",                                        section: "INTERIOR" },

  // ── Mechanical (hood open, get low) ──
  { type: "ENGINE_BAY",              label: "Engine Bay",              hint: "Hood open, overhead angle",                           section: "MECHANICAL" },
  { type: "DOOR_JAMB_DRIVER",         label: "Door Jamb Sticker",       hint: "Open driver door — sticker on jamb with VIN, tire pressure, build info", section: "MECHANICAL" },
  { type: "UNDERCARRIAGE",           label: "Undercarriage",           hint: "From ground level, showing underside",                section: "MECHANICAL" },
  { type: "TIRE_FRONT_DRIVER",       label: "Front Tire (Driver)",     hint: "Close-up showing tread depth and sidewall",           section: "MECHANICAL" },
  { type: "TIRE_REAR_DRIVER",        label: "Rear Tire (Driver)",      hint: "Close-up showing tread depth and sidewall",           section: "MECHANICAL" },
  { type: "TIRE_FRONT_PASSENGER",    label: "Front Tire (Passenger)",  hint: "Close-up showing tread depth and sidewall",           section: "MECHANICAL" },
  { type: "TIRE_REAR_PASSENGER",     label: "Rear Tire (Passenger)",   hint: "Close-up showing tread depth and sidewall",           section: "MECHANICAL" },
];

const SECTIONS = [
  { key: "EXTERIOR",   label: "Exterior",   count: 9 },
  { key: "INTERIOR",   label: "Interior",   count: 5 },
  { key: "MECHANICAL", label: "Mechanical", count: 7 },
] as const;

// ---------------------------------------------------------------------------
//  Props
// ---------------------------------------------------------------------------

interface CapturedPhoto {
  captureType: string;
  url?: string;
  thumbnailUrl?: string;
}

interface GuidedCaptureProps {
  inspectionId: string;
  captures: CapturedPhoto[];
  onCapture: (captureType: string, file: File) => void;
  isUploading?: string | null;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export function GuidedCapture({
  inspectionId,
  captures,
  onCapture,
  isUploading,
  onClose,
}: GuidedCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Find the first uncaptured shot as the starting index
  const firstUncaptured = useMemo(() => {
    const idx = GUIDED_SHOTS.findIndex(
      (s) => !captures.some((c) => c.captureType === s.type && c.url)
    );
    return idx === -1 ? 0 : idx;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [currentIndex, setCurrentIndex] = useState(firstUncaptured);
  const [justCaptured, setJustCaptured] = useState<string | null>(null);

  const currentShot = GUIDED_SHOTS[currentIndex];
  const isCurrentCaptured = captures.some(
    (c) => c.captureType === currentShot.type && c.url
  );
  const currentCapture = captures.find(
    (c) => c.captureType === currentShot.type
  );
  const isCurrentUploading = isUploading === currentShot.type;

  const capturedCount = GUIDED_SHOTS.filter((s) =>
    captures.some((c) => c.captureType === s.type && c.url)
  ).length;

  // Section progress
  const sectionProgress = useMemo(() => {
    const result: Record<string, { captured: number; total: number }> = {};
    for (const sec of SECTIONS) {
      const shots = GUIDED_SHOTS.filter((s) => s.section === sec.key);
      const captured = shots.filter((s) =>
        captures.some((c) => c.captureType === s.type && c.url)
      ).length;
      result[sec.key] = { captured, total: shots.length };
    }
    return result;
  }, [captures]);

  // Advance to next uncaptured shot
  const advanceToNext = useCallback(() => {
    // Find next uncaptured after current
    for (let i = currentIndex + 1; i < GUIDED_SHOTS.length; i++) {
      if (!captures.some((c) => c.captureType === GUIDED_SHOTS[i].type && c.url)) {
        setCurrentIndex(i);
        return;
      }
    }
    // Wrap around — find first uncaptured
    for (let i = 0; i < currentIndex; i++) {
      if (!captures.some((c) => c.captureType === GUIDED_SHOTS[i].type && c.url)) {
        setCurrentIndex(i);
        return;
      }
    }
    // All captured — stay on current
    setCurrentIndex((prev) => Math.min(prev + 1, GUIDED_SHOTS.length - 1));
  }, [currentIndex, captures]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onCapture(currentShot.type, file);
      setJustCaptured(currentShot.type);
      // Auto-advance after a brief flash
      setTimeout(() => {
        setJustCaptured(null);
        if (!isCurrentCaptured) {
          advanceToNext();
        }
      }, 800);
    }
    e.target.value = "";
  };

  const goBack = () => setCurrentIndex((i) => Math.max(0, i - 1));
  const goForward = () =>
    setCurrentIndex((i) => Math.min(GUIDED_SHOTS.length - 1, i + 1));

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
        >
          <X className="h-5 w-5" />
          <span className="hidden sm:inline">Close</span>
        </button>
        <div className="text-center">
          <p className="text-xs text-slate-400 font-medium">
            Shot {currentIndex + 1} of {GUIDED_SHOTS.length}
          </p>
          <p className="text-sm font-semibold text-white">{currentShot.label}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">
            {capturedCount}/{GUIDED_SHOTS.length}
          </p>
          <p className="text-xs font-medium text-emerald-400">
            {Math.round((capturedCount / GUIDED_SHOTS.length) * 100)}%
          </p>
        </div>
      </div>

      {/* ── Section progress dots ── */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 bg-slate-900/50">
        {SECTIONS.map((sec) => {
          const prog = sectionProgress[sec.key];
          const sectionShots = GUIDED_SHOTS.filter(
            (s) => s.section === sec.key
          );
          const sectionStartIdx = GUIDED_SHOTS.indexOf(sectionShots[0]);
          const isCurrentSection = currentShot.section === sec.key;

          return (
            <div key={sec.key} className="flex flex-col items-center gap-1">
              <div className="flex gap-0.5">
                {sectionShots.map((shot, i) => {
                  const globalIdx = sectionStartIdx + i;
                  const isCaptured = captures.some(
                    (c) => c.captureType === shot.type && c.url
                  );
                  const isCurrent = globalIdx === currentIndex;
                  return (
                    <button
                      key={shot.type}
                      onClick={() => setCurrentIndex(globalIdx)}
                      className={cn(
                        "h-2 w-2 rounded-full transition-all",
                        isCurrent
                          ? "bg-brand-500 scale-125 ring-2 ring-brand-500/30"
                          : isCaptured
                          ? "bg-emerald-500"
                          : "bg-slate-600 hover:bg-slate-500"
                      )}
                    />
                  );
                })}
              </div>
              <span
                className={cn(
                  "text-[9px] font-medium",
                  isCurrentSection ? "text-white" : "text-slate-500"
                )}
              >
                {sec.label} ({prog?.captured}/{prog?.total})
              </span>
            </div>
          );
        })}
      </div>

      {/* ── Main content area ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
        {/* Just-captured flash overlay */}
        {justCaptured === currentShot.type && (
          <div className="absolute inset-0 bg-white/20 z-10 animate-pulse pointer-events-none" />
        )}

        {/* Preview or placeholder */}
        {isCurrentCaptured && currentCapture?.url ? (
          <div className="relative w-full max-w-lg aspect-[4/3] rounded-2xl overflow-hidden bg-slate-800 shadow-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentCapture.url}
              alt={currentShot.label}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-3 right-3 bg-emerald-500 rounded-full p-1.5 shadow-lg">
              <CheckCircle className="h-5 w-5 text-white" />
            </div>
          </div>
        ) : (
          <div className="w-full max-w-lg aspect-[4/3] rounded-2xl bg-slate-800/50 border-2 border-dashed border-slate-600 flex flex-col items-center justify-center gap-4">
            {isCurrentUploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-brand-500" />
                <p className="text-sm text-slate-400">Uploading...</p>
              </>
            ) : (
              <>
                <Camera className="h-16 w-16 text-slate-500" />
                <div className="text-center px-6">
                  <p className="text-lg font-semibold text-white mb-1">
                    {currentShot.label}
                  </p>
                  <p className="text-sm text-slate-400">{currentShot.hint}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Bottom controls ── */}
      <div className="px-4 pb-6 pt-3 bg-gradient-to-t from-slate-950 via-slate-950/95 to-transparent">
        <div className="flex items-center justify-between max-w-lg mx-auto gap-3">
          {/* Back */}
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>

          {/* Capture / Retake button */}
          <div className="flex-1">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={isCurrentUploading}
              className={cn(
                "w-full h-14 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all",
                isCurrentCaptured
                  ? "bg-slate-700 text-slate-200 hover:bg-slate-600"
                  : "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/30",
                isCurrentUploading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isCurrentUploading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                  Uploading...
                </>
              ) : isCurrentCaptured ? (
                <>
                  <RotateCcw className="h-5 w-5" />
                  Retake Photo
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5" />
                  Capture Photo
                </>
              )}
            </button>
          </div>

          {/* Forward / Skip */}
          <button
            onClick={goForward}
            disabled={currentIndex === GUIDED_SHOTS.length - 1}
            className="flex items-center justify-center h-12 w-12 rounded-full bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* All done indicator */}
        {capturedCount === GUIDED_SHOTS.length && (
          <div className="mt-4 max-w-lg mx-auto">
            <button
              onClick={onClose}
              className="w-full h-12 rounded-2xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="h-5 w-5" />
              All {GUIDED_SHOTS.length} Photos Captured — Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
