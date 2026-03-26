"use client";

/**
 * CaptureGrid — Review/retake grid for all 21 standard vehicle photos.
 *
 * Shows a thumbnail grid of all required captures with green checkmarks for
 * completed ones. Prominently features a "Start Capture Session" button that
 * opens the GuidedCapture walkthrough, or "Continue Capture (N remaining)"
 * for partial sessions. Individual retakes via tap on any thumbnail.
 */

import { useRef, useState } from "react";
import { Camera, CheckCircle, Upload, ImageIcon, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { GUIDED_SHOTS } from "./GuidedCapture";

// ---------------------------------------------------------------------------
//  Types
// ---------------------------------------------------------------------------

interface CaptureItem {
  captureType: string;
  url?: string;
  thumbnailUrl?: string;
}

interface CaptureGridProps {
  inspectionId: string;
  captures: CaptureItem[];
  onCapture: (captureType: string, file: File) => void;
  isUploading?: string;
  onStartGuidedCapture: () => void;
}

// ---------------------------------------------------------------------------
//  Section grouping (matches GuidedCapture order)
// ---------------------------------------------------------------------------

const SECTIONS = [
  {
    key: "EXTERIOR",
    label: "Exterior",
    shots: GUIDED_SHOTS.filter((s) => s.section === "EXTERIOR"),
  },
  {
    key: "INTERIOR",
    label: "Interior",
    shots: GUIDED_SHOTS.filter((s) => s.section === "INTERIOR"),
  },
  {
    key: "MECHANICAL",
    label: "Mechanical",
    shots: GUIDED_SHOTS.filter((s) => s.section === "MECHANICAL"),
  },
];

// ---------------------------------------------------------------------------
//  Thumbnail card (compact retake-only)
// ---------------------------------------------------------------------------

function ThumbnailCard({
  shot,
  captured,
  isUploading,
  onCapture,
}: {
  shot: (typeof GUIDED_SHOTS)[number];
  captured?: CaptureItem;
  isUploading: boolean;
  onCapture: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCaptured = !!captured?.url;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    e.target.value = "";
  };

  return (
    <button
      onClick={() => inputRef.current?.click()}
      disabled={isUploading}
      className={cn(
        "relative rounded-lg border overflow-hidden transition-all group",
        isCaptured
          ? "border-emerald-300 bg-emerald-50"
          : "border-dashed border-border-strong bg-surface-raised hover:border-brand-400"
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Thumbnail / placeholder */}
      <div className="aspect-[4/3] w-full">
        {isCaptured && captured?.url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={captured.url}
              alt={shot.label}
              className="w-full h-full object-cover"
            />
            {/* Retake overlay on hover */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-xs font-medium text-white">Retake</span>
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-surface-sunken">
            {isUploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-brand-600 border-t-transparent" />
            ) : (
              <Camera className="h-6 w-6 text-slate-400" />
            )}
          </div>
        )}
      </div>

      {/* Label */}
      <div className="px-2 py-1.5">
        <p className="text-[11px] font-medium text-text-primary truncate">
          {shot.label}
        </p>
      </div>

      {/* Checkmark */}
      {isCaptured && (
        <div className="absolute top-1 right-1">
          <CheckCircle className="h-4 w-4 text-emerald-600" />
        </div>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
//  Main Grid
// ---------------------------------------------------------------------------

export function CaptureGrid({
  inspectionId,
  captures,
  onCapture,
  isUploading,
  onStartGuidedCapture,
}: CaptureGridProps) {
  const getCaptured = (type: string) =>
    captures.find((c) => c.captureType === type);

  const totalRequired = GUIDED_SHOTS.length;
  const capturedCount = GUIDED_SHOTS.filter((s) =>
    captures.some((c) => c.captureType === s.type && c.url)
  ).length;
  const remaining = totalRequired - capturedCount;
  const allDone = remaining === 0;

  return (
    <div className="space-y-6">
      {/* ── Progress header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            Photo Capture
          </h3>
          <p className="text-sm text-text-secondary">
            {capturedCount} of {totalRequired} required photos captured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-32 rounded-full bg-surface-sunken overflow-hidden">
            <div
              className="h-full bg-brand-gradient rounded-full transition-all duration-500"
              style={{
                width: `${(capturedCount / totalRequired) * 100}%`,
              }}
            />
          </div>
          <span
            className={cn(
              "text-sm font-medium",
              allDone ? "text-emerald-600" : "text-brand-600"
            )}
          >
            {Math.round((capturedCount / totalRequired) * 100)}%
          </span>
        </div>
      </div>

      {/* ── Start / Continue Capture button ── */}
      <button
        onClick={onStartGuidedCapture}
        className={cn(
          "w-full rounded-xl py-4 font-semibold text-base flex items-center justify-center gap-2 transition-all",
          allDone
            ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
            : "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/20"
        )}
      >
        {allDone ? (
          <>
            <CheckCircle className="h-5 w-5" />
            All Photos Captured — Review Below
          </>
        ) : capturedCount === 0 ? (
          <>
            <Play className="h-5 w-5" />
            Start Capture Session
          </>
        ) : (
          <>
            <Camera className="h-5 w-5" />
            Continue Capture ({remaining} remaining)
          </>
        )}
      </button>

      {/* ── Section grids ── */}
      {SECTIONS.map((section) => {
        const sectionCaptured = section.shots.filter((s) =>
          captures.some((c) => c.captureType === s.type && c.url)
        ).length;

        return (
          <div key={section.key}>
            <h4 className="text-xs uppercase tracking-wider text-text-tertiary font-medium mb-3 flex items-center gap-1.5">
              <ImageIcon className="h-3.5 w-3.5" />
              {section.label}
              <span className="text-text-quaternary ml-auto">
                {sectionCaptured}/{section.shots.length}
              </span>
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {section.shots.map((shot) => (
                <ThumbnailCard
                  key={shot.type}
                  shot={shot}
                  captured={getCaptured(shot.type)}
                  isUploading={isUploading === shot.type}
                  onCapture={(file) => onCapture(shot.type, file)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
