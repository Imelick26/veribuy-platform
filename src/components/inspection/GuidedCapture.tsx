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
  onCapture: (captureType: string, file: File) => void | Promise<unknown>;
  isUploading?: string | null;
  uploadError?: string | null;
  onClearError?: () => void;
  onClose: (inspectorNotes?: string) => void;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

export function GuidedCapture({
  inspectionId,
  captures,
  onCapture,
  isUploading,
  uploadError,
  onClearError,
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
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [isListening, setIsListening] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

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

  const [pendingUploads, setPendingUploads] = useState<Set<string>>(new Set());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const captureType = currentShot.type;

      // Track this upload so we know it's in-flight
      setPendingUploads((prev) => new Set(prev).add(captureType));

      // Fire the upload — onCapture returns a promise (or void)
      const uploadPromise = Promise.resolve(onCapture(captureType, file));
      uploadPromise
        .then(() => {
          setPendingUploads((prev) => {
            const next = new Set(prev);
            next.delete(captureType);
            return next;
          });
        })
        .catch(() => {
          setPendingUploads((prev) => {
            const next = new Set(prev);
            next.delete(captureType);
            return next;
          });
        });

      setJustCaptured(captureType);
      // Show brief success flash, then advance
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
          onClick={() => {
            if (pendingUploads.size > 0) return; // Block close while uploads pending
            onClose();
          }}
          disabled={pendingUploads.size > 0}
          className={cn(
            "flex items-center gap-1 text-sm transition-colors",
            pendingUploads.size > 0 ? "text-slate-600 cursor-not-allowed" : "text-slate-400 hover:text-white"
          )}
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

      {/* ── Upload error banner ── */}
      {uploadError && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-red-500/20 border border-red-500/40 px-4 py-2.5">
          <span className="text-sm text-red-300 flex-1">Upload failed: {uploadError}. Please retake the photo.</span>
          <button onClick={onClearError} className="text-red-400 hover:text-red-200 text-xs font-medium shrink-0">Dismiss</button>
        </div>
      )}

      {/* ── Pending uploads indicator ── */}
      {pendingUploads.size > 0 && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 px-4 py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-500/30 border-t-amber-500 shrink-0" />
          <span className="text-xs text-amber-300">{pendingUploads.size} photo{pendingUploads.size > 1 ? "s" : ""} uploading — don&apos;t close yet</span>
        </div>
      )}

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

        {/* All done — inspector notes + done button */}
        {capturedCount === GUIDED_SHOTS.length && (
          <div className="mt-4 max-w-lg mx-auto space-y-3">
            {/* Inspector notes input */}
            <div className="bg-slate-800/80 rounded-2xl p-4">
              <p className="text-sm font-medium text-slate-200 mb-2">
                Anything the camera might have missed?
              </p>
              <div className="relative">
                <textarea
                  value={inspectorNotes}
                  onChange={(e) => setInspectorNotes(e.target.value)}
                  placeholder="Dents, tire wear, smells, noises, leaks..."
                  rows={3}
                  className="w-full rounded-xl bg-slate-700 text-white placeholder-slate-400 text-sm px-4 py-3 pr-12 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {/* Talk-to-text button */}
                {"webkitSpeechRecognition" in (typeof window !== "undefined" ? window : {}) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) {
                        recognitionRef.current?.stop();
                        setIsListening(false);
                        return;
                      }
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      const SR = (window as any).webkitSpeechRecognition;
                      const recognition = new SR();
                      recognition.continuous = true;
                      recognition.interimResults = true;
                      recognition.lang = "en-US";
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      recognition.onresult = (event: any) => {
                        let transcript = "";
                        for (let i = 0; i < event.results.length; i++) {
                          transcript += event.results[i][0].transcript;
                        }
                        setInspectorNotes((prev) => {
                          const base = prev.trim();
                          return base ? `${base} ${transcript}` : transcript;
                        });
                      };
                      recognition.onerror = () => setIsListening(false);
                      recognition.onend = () => setIsListening(false);
                      recognitionRef.current = recognition;
                      recognition.start();
                      setIsListening(true);
                    }}
                    className={cn(
                      "absolute right-2 top-2 p-2 rounded-full transition-colors",
                      isListening
                        ? "bg-red-500 text-white animate-pulse"
                        : "bg-slate-600 text-slate-300 hover:bg-slate-500"
                    )}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      <line x1="12" x2="12" y1="19" y2="22" />
                    </svg>
                  </button>
                )}
              </div>
              <p className="text-[10px] text-slate-500 mt-1.5">Optional — helps the AI assessment focus on specific areas</p>
            </div>

            <button
              onClick={() => {
                if (pendingUploads.size > 0) return;
                onClose(inspectorNotes.trim() || undefined);
              }}
              disabled={pendingUploads.size > 0}
              className={cn(
                "w-full h-12 rounded-2xl font-semibold transition-colors flex items-center justify-center gap-2",
                pendingUploads.size > 0
                  ? "bg-slate-600 text-slate-400 cursor-not-allowed"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              )}
            >
              {pendingUploads.size > 0 ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-400/30 border-t-slate-400" />
                  Waiting for {pendingUploads.size} upload{pendingUploads.size > 1 ? "s" : ""}...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  {inspectorNotes.trim() ? "Continue with Notes" : `All ${GUIDED_SHOTS.length} Photos Captured — Done`}
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
