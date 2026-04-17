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
  /** Step-by-step instructions written for people with no car background */
  steps: string[];
  section: "EXTERIOR" | "INTERIOR" | "MECHANICAL";
}

// NOTE ON SIDES: "driver side" = the side where the steering wheel sits (left in the US).
// "passenger side" = the opposite side. Every shot below uses those plain words.

export const GUIDED_SHOTS: CaptureShot[] = [
  // ── Exterior (walk around vehicle) ──
  {
    type: "FRONT_CENTER",
    label: "Front of the vehicle",
    hint: "Stand 6–8 feet in front, centered on the grille.",
    steps: [
      "Stand directly in front of the vehicle, about 6–8 feet back (roughly 2 long steps).",
      "Hold the phone straight, not tilted — match the height of the headlights if possible.",
      "Center the grille in the middle of the screen. The whole front of the car should fit in the frame, including both headlights, bumper, and the front license plate area.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "FRONT_34_DRIVER",
    label: "Front corner — driver side",
    hint: "Stand off to the driver-side front corner so the front AND driver side are both visible.",
    steps: [
      "Walk to the front-left corner of the car (driver side — the side with the steering wheel).",
      "Stand 6–8 feet back at roughly a 45° angle — you should see BOTH the front bumper AND the driver side of the car in the frame.",
      "Include the driver-side headlight, front fender, front door, and front wheel.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "DRIVER_SIDE",
    label: "Full driver side",
    hint: "Stand 8–10 feet back so the full length of the car fits in the frame.",
    steps: [
      "Walk to the middle of the driver side (the side with the steering wheel).",
      "Back up until the entire car fits in the screen — front bumper to rear bumper, top of the roof to bottom of the tires. This is usually 8–10 feet away.",
      "Keep the phone level. Both wheels and both door handles should be visible.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "REAR_34_DRIVER",
    label: "Rear corner — driver side",
    hint: "Stand off to the rear driver-side corner so the back AND driver side are both visible.",
    steps: [
      "Walk to the rear-left corner of the car (driver side, near the back bumper).",
      "Stand 6–8 feet back at roughly a 45° angle — you should see BOTH the rear of the car AND the driver side in the frame.",
      "Include the driver-side taillight, rear door, rear fender, and rear wheel.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "REAR_CENTER",
    label: "Back of the vehicle",
    hint: "Stand 6–8 feet behind, centered on the trunk/tailgate.",
    steps: [
      "Walk around to the back of the vehicle and stand 6–8 feet away, centered behind it.",
      "Match the height of the taillights if possible. Keep the phone level.",
      "The whole back of the car should fit in the frame — both taillights, rear bumper, license plate, and the trunk/tailgate.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "REAR_34_PASSENGER",
    label: "Rear corner — passenger side",
    hint: "Stand off to the rear passenger-side corner so the back AND passenger side are both visible.",
    steps: [
      "Walk to the rear-right corner of the car (passenger side — opposite the steering wheel).",
      "Stand 6–8 feet back at roughly a 45° angle — you should see BOTH the rear of the car AND the passenger side in the frame.",
      "Include the passenger-side taillight, rear door, rear fender, and rear wheel.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "PASSENGER_SIDE",
    label: "Full passenger side",
    hint: "Stand 8–10 feet back so the full length of the car fits in the frame.",
    steps: [
      "Walk to the middle of the passenger side (opposite the steering wheel).",
      "Back up until the entire car fits in the screen — front bumper to rear bumper, top of the roof to bottom of the tires. This is usually 8–10 feet away.",
      "Keep the phone level. Both wheels and both door handles should be visible.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "FRONT_34_PASSENGER",
    label: "Front corner — passenger side",
    hint: "Stand off to the front passenger-side corner so the front AND passenger side are both visible.",
    steps: [
      "Walk to the front-right corner of the car (passenger side, near the headlight).",
      "Stand 6–8 feet back at roughly a 45° angle — you should see BOTH the front of the car AND the passenger side in the frame.",
      "Include the passenger-side headlight, front fender, front door, and front wheel.",
    ],
    section: "EXTERIOR",
  },
  {
    type: "ROOF",
    label: "Roof",
    hint: "Capture the full roof from above or an elevated angle.",
    steps: [
      "If you can safely get above the car (from a step, curb, or nearby elevated spot), aim the camera down at the roof.",
      "If you can't get above, stand at one end of the car, hold the phone high, and angle it down so as much of the roof surface as possible is visible.",
      "Try to capture the whole roof from front windshield to rear window, including any sunroof or roof rails.",
    ],
    section: "EXTERIOR",
  },

  // ── Interior (open doors, sit inside) ──
  {
    type: "DASHBOARD_DRIVER",
    label: "Dashboard and steering wheel",
    hint: "Sit in the driver seat. Capture the dashboard, steering wheel, and center screen.",
    steps: [
      "Open the driver door and sit in the driver seat (the one with the steering wheel).",
      "Hold the phone in front of you at chest height, pointed forward at the dashboard.",
      "Back up the phone until the frame shows: the full steering wheel, the gauges behind it, and the center screen/radio on the right. All three should be visible in one shot.",
    ],
    section: "INTERIOR",
  },
  {
    type: "ODOMETER",
    label: "Odometer (mileage reading)",
    hint: "The numbers showing total miles, on the gauge cluster behind the steering wheel.",
    steps: [
      "Sit in the driver seat. If needed, turn the key or press the start button to wake the dashboard.",
      "Look at the gauges behind the steering wheel — one of them shows a number of miles (like \"127,342\"). That's the odometer.",
      "Zoom in close enough that the miles number is clearly readable in the photo. No glare, no blur — we need to read the exact number.",
    ],
    section: "INTERIOR",
  },
  {
    type: "FRONT_SEATS",
    label: "Front seats",
    hint: "Both front seats visible in one shot — open the driver door and step back.",
    steps: [
      "Open the driver door. Stand outside the car, just beside the open door.",
      "Aim the camera across both front seats so BOTH the driver seat and the passenger seat are in the frame.",
      "Include the full seat cushions, the seat backs, the center console (armrest / cupholders / shifter) between them, and the floor in front of each seat.",
    ],
    section: "INTERIOR",
  },
  {
    type: "REAR_SEATS",
    label: "Back seats",
    hint: "Open a rear door and capture the entire back seating area.",
    steps: [
      "Open one of the rear doors (either side works).",
      "Stand outside the car and aim the camera straight into the back seating area.",
      "Include all the back seats (bench or individual), the seat backs, and the floor. If there's a third row in an SUV/van, get as much of it as you can in the frame.",
    ],
    section: "INTERIOR",
  },
  {
    type: "CARGO_AREA",
    label: "Trunk or cargo area",
    hint: "Open the trunk, tailgate, or hatch. Capture the storage space inside.",
    steps: [
      "Walk to the back of the vehicle and open the trunk, tailgate, or rear hatch.",
      "Stand a couple feet back from the opening and aim the camera straight into the cargo space.",
      "Include the full floor of the cargo area, the inside of the lid/hatch, and the rear seat backs from behind. For pickup trucks, capture the full length of the truck bed from tailgate to cab.",
    ],
    section: "INTERIOR",
  },

  // ── Mechanical (hood open, get low) ──
  {
    type: "ENGINE_BAY",
    label: "Engine (under the hood)",
    hint: "Open the hood. Take the photo from above, looking straight down.",
    steps: [
      "Open the hood (pull the release lever usually located near the driver's footwell, then lift the hood and prop it up with the metal stick underneath).",
      "Stand in front of the car, facing the engine.",
      "Hold the phone directly above the engine, pointing straight down, high enough that the ENTIRE engine bay fits in the frame — front of the engine to the windshield, driver-side fender to passenger-side fender.",
    ],
    section: "MECHANICAL",
  },
  {
    type: "DOOR_JAMB_DRIVER",
    label: "Door jamb sticker",
    hint: "The small white/silver sticker on the edge of the driver door frame.",
    steps: [
      "Open the driver door (the door on the side with the steering wheel).",
      "Look at the metal frame that the door latches onto — usually on the side of the car, between the front seat and where the door closes. You'll see a small white or silver sticker with printed text.",
      "Hold the phone close enough (about 6–12 inches) that the text on the sticker — VIN, tire pressure, build date — is clearly readable in the photo.",
    ],
    section: "MECHANICAL",
  },
  {
    type: "UNDERCARRIAGE",
    label: "Underneath the vehicle",
    hint: "Crouch at the very front of the car. Aim the camera UNDER the car, pointing toward the back.",
    steps: [
      "Walk to the very front of the vehicle and stand facing it.",
      "Crouch or kneel down below the front bumper. Your head should be near the ground.",
      "Hold the phone low — as close to the ground as you can — and point the camera BACKWARD, through the space under the car, toward the rear of the vehicle.",
      "The goal: one photo that shows as much of the underside of the car as possible in a single shot, looking from the front toward the back.",
    ],
    section: "MECHANICAL",
  },
  {
    type: "TIRE_FRONT_DRIVER",
    label: "Front tire — driver side",
    hint: "Close-up of the front-left tire (driver side = side with the steering wheel).",
    steps: [
      "Walk to the FRONT tire on the DRIVER side of the car (the front wheel on the side with the steering wheel).",
      "Crouch down so the camera is at tire height. Get within about 2 feet of the tire.",
      "Aim straight at the face of the tire. The full circle of the tire should fit in the frame — the rubber tread pattern, the sidewall, and the wheel in the middle all clearly visible.",
    ],
    section: "MECHANICAL",
  },
  {
    type: "TIRE_REAR_DRIVER",
    label: "Rear tire — driver side",
    hint: "Close-up of the rear-left tire (driver side = side with the steering wheel).",
    steps: [
      "Walk to the REAR tire on the DRIVER side of the car (the back wheel on the side with the steering wheel).",
      "Crouch down so the camera is at tire height. Get within about 2 feet of the tire.",
      "Aim straight at the face of the tire. The full circle of the tire should fit in the frame — the rubber tread pattern, the sidewall, and the wheel in the middle all clearly visible.",
    ],
    section: "MECHANICAL",
  },
  {
    type: "TIRE_FRONT_PASSENGER",
    label: "Front tire — passenger side",
    hint: "Close-up of the front-right tire (passenger side = opposite the steering wheel).",
    steps: [
      "Walk to the FRONT tire on the PASSENGER side of the car (the front wheel on the side opposite the steering wheel).",
      "Crouch down so the camera is at tire height. Get within about 2 feet of the tire.",
      "Aim straight at the face of the tire. The full circle of the tire should fit in the frame — the rubber tread pattern, the sidewall, and the wheel in the middle all clearly visible.",
    ],
    section: "MECHANICAL",
  },
  {
    type: "TIRE_REAR_PASSENGER",
    label: "Rear tire — passenger side",
    hint: "Close-up of the rear-right tire (passenger side = opposite the steering wheel).",
    steps: [
      "Walk to the REAR tire on the PASSENGER side of the car (the back wheel on the side opposite the steering wheel).",
      "Crouch down so the camera is at tire height. Get within about 2 feet of the tire.",
      "Aim straight at the face of the tire. The full circle of the tire should fit in the frame — the rubber tread pattern, the sidewall, and the wheel in the middle all clearly visible.",
    ],
    section: "MECHANICAL",
  },
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
  uploadStatus?: string; // "PENDING" | "CONFIRMED" | "FAILED"
}

interface FailedUploadInfo {
  captureType: string;
  error: string;
}

interface GuidedCaptureProps {
  inspectionId: string;
  captures: CapturedPhoto[];
  onCapture: (captureType: string, file: File) => void | Promise<unknown>;
  isUploading?: string | null;
  uploadError?: string | null;
  onClearError?: () => void;
  onClose: (inspectorNotes?: string) => void;
  failedUploads?: FailedUploadInfo[];
  onRetryUpload?: (captureType: string) => void;
}

// ---------------------------------------------------------------------------
//  Component
// ---------------------------------------------------------------------------

// Helper: a photo is truly "captured" only if CONFIRMED (or legacy records without status)
function isPhotoConfirmed(c: CapturedPhoto): boolean {
  return !!(c.url && (!c.uploadStatus || c.uploadStatus === "CONFIRMED"));
}

export function GuidedCapture({
  inspectionId,
  captures,
  onCapture,
  isUploading,
  uploadError,
  onClearError,
  onClose,
  failedUploads = [],
  onRetryUpload,
}: GuidedCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Find the first uncaptured shot as the starting index
  const firstUncaptured = useMemo(() => {
    const idx = GUIDED_SHOTS.findIndex(
      (s) => !captures.some((c) => c.captureType === s.type && isPhotoConfirmed(c))
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
    (c) => c.captureType === currentShot.type && isPhotoConfirmed(c)
  );
  const currentCapture = captures.find(
    (c) => c.captureType === currentShot.type
  );
  const isCurrentUploading = isUploading === currentShot.type;

  const capturedCount = GUIDED_SHOTS.filter((s) =>
    captures.some((c) => c.captureType === s.type && isPhotoConfirmed(c))
  ).length;

  // Section progress
  const sectionProgress = useMemo(() => {
    const result: Record<string, { captured: number; total: number }> = {};
    for (const sec of SECTIONS) {
      const shots = GUIDED_SHOTS.filter((s) => s.section === sec.key);
      const captured = shots.filter((s) =>
        captures.some((c) => c.captureType === s.type && isPhotoConfirmed(c))
      ).length;
      result[sec.key] = { captured, total: shots.length };
    }
    return result;
  }, [captures]);

  // Advance to next uncaptured shot
  const advanceToNext = useCallback(() => {
    // Find next uncaptured after current
    for (let i = currentIndex + 1; i < GUIDED_SHOTS.length; i++) {
      if (!captures.some((c) => c.captureType === GUIDED_SHOTS[i].type && isPhotoConfirmed(c))) {
        setCurrentIndex(i);
        return;
      }
    }
    // Wrap around — find first uncaptured
    for (let i = 0; i < currentIndex; i++) {
      if (!captures.some((c) => c.captureType === GUIDED_SHOTS[i].type && isPhotoConfirmed(c))) {
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
          // Upload failed — remove from pending (failedUploads tracks it in the parent)
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
                  const isFailed = failedUploads.some((f) => f.captureType === shot.type);
                  const isCaptured = !isFailed && captures.some(
                    (c) => c.captureType === shot.type && isPhotoConfirmed(c)
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
                          : isFailed
                          ? "bg-red-500 animate-pulse"
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

      {/* ── Failed uploads retry banner ── */}
      {failedUploads.length > 0 && (
        <div className="mx-4 mt-2 rounded-xl bg-red-500/15 border border-red-500/30 px-4 py-2.5">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-red-300">
              {failedUploads.length} photo{failedUploads.length > 1 ? "s" : ""} failed to upload
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {failedUploads.map((f) => {
              const shot = GUIDED_SHOTS.find((s) => s.type === f.captureType);
              return (
                <button
                  key={f.captureType}
                  onClick={() => onRetryUpload?.(f.captureType)}
                  className="text-xs bg-red-500/30 hover:bg-red-500/50 text-red-200 rounded-lg px-3 py-1.5 transition-colors"
                >
                  Retry {shot?.label || f.captureType}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Pending uploads indicator ── */}
      {pendingUploads.size > 0 && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-xl bg-caution-500/15 border border-caution-500/30 px-4 py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-caution-500/30 border-t-caution-500 shrink-0" />
          <span className="text-xs text-caution-300">{pendingUploads.size} photo{pendingUploads.size > 1 ? "s" : ""} uploading — don&apos;t close yet</span>
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
          <div className="w-full max-w-lg rounded-2xl bg-slate-800/60 border border-slate-700 flex flex-col relative overflow-hidden shadow-xl">
            {isCurrentUploading ? (
              <div className="aspect-[4/3] flex flex-col items-center justify-center gap-3">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-600 border-t-brand-500" />
                <p className="text-sm text-slate-400">Uploading...</p>
              </div>
            ) : (
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-4">
                  <div className="shrink-0 h-10 w-10 rounded-full bg-brand-500/20 border border-brand-500/40 flex items-center justify-center">
                    <Camera className="h-5 w-5 text-brand-300" />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-white leading-tight">{currentShot.label}</h2>
                    <p className="text-xs text-slate-400 mt-0.5">{currentShot.hint}</p>
                  </div>
                </div>

                <ol className="space-y-3">
                  {currentShot.steps.map((step, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="shrink-0 h-6 w-6 rounded-full bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <p className="text-sm text-slate-200 leading-relaxed pt-0.5">{step}</p>
                    </li>
                  ))}
                </ol>

                <p className="text-[11px] text-slate-500 mt-4 pt-3 border-t border-slate-700/60">
                  Take your time — a clear photo from the right angle gives the most accurate report.
                </p>
              </div>
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
