"use client";

import { useRef } from "react";
import { Camera, Video, Mic, CheckCircle, Upload, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
}

const REQUIRED_CAPTURES = [
  { type: "FRONT_CENTER", label: "Front Center", hint: "6-8 ft, centered, full vehicle visible", icon: Camera },
  { type: "FRONT_34_DRIVER", label: "Front 3/4 Driver", hint: "45° angle from driver side", icon: Camera },
  { type: "DRIVER_SIDE", label: "Driver Side", hint: "Full profile, 8-10 ft distance", icon: Camera },
  { type: "REAR_34_DRIVER", label: "Rear 3/4 Driver", hint: "45° angle from rear driver side", icon: Camera },
  { type: "REAR_CENTER", label: "Rear Center", hint: "6-8 ft, centered, full vehicle visible", icon: Camera },
  { type: "PASSENGER_SIDE", label: "Passenger Side", hint: "Full profile, 8-10 ft distance", icon: Camera },
  { type: "ENGINE_BAY", label: "Engine Bay", hint: "Hood open, overhead angle", icon: Camera },
  { type: "UNDER_HOOD_LABEL", label: "VIN / Hood Label", hint: "Close-up, readable", icon: Camera },
];

const OPTIONAL_CAPTURES = [
  { type: "WALKAROUND_VIDEO", label: "Walkaround Video", hint: "60-90 second walk-around", icon: Video },
  { type: "ENGINE_AUDIO", label: "Engine Audio", hint: "15-30 seconds, cold start", icon: Mic },
];

function CaptureCard({
  type,
  label,
  hint,
  icon: Icon,
  captured,
  isUploading,
  onCapture,
  required,
}: {
  type: string;
  label: string;
  hint: string;
  icon: typeof Camera;
  captured?: CaptureItem;
  isUploading: boolean;
  onCapture: (file: File) => void;
  required: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const isCaptured = !!captured?.url;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onCapture(file);
    e.target.value = "";
  };

  return (
    <div
      className={cn(
        "relative rounded-xl border-2 p-4 transition-all",
        isCaptured
          ? "border-green-300 bg-green-50"
          : "border-dashed border-brand-200 bg-white hover:border-brand-400 hover:bg-brand-50/30"
      )}
    >
      {/* Status indicator */}
      {isCaptured && (
        <div className="absolute top-2 right-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
        </div>
      )}

      {/* Content */}
      <div className="flex flex-col items-center text-center gap-2">
        {isCaptured && captured?.thumbnailUrl ? (
          <div className="h-20 w-full rounded-lg bg-gray-100 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={captured.thumbnailUrl}
              alt={label}
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className={cn(
            "h-20 w-full rounded-lg flex items-center justify-center",
            isCaptured ? "bg-green-100" : "bg-brand-50"
          )}>
            {isUploading ? (
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-brand-600" />
            ) : (
              <Icon className={cn("h-8 w-8", isCaptured ? "text-green-500" : "text-brand-400")} />
            )}
          </div>
        )}

        <div>
          <p className="text-sm font-semibold text-gray-900">{label}</p>
          <p className="text-xs text-gray-500 mt-0.5">{hint}</p>
        </div>

        {!required && (
          <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Optional</span>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={type.includes("VIDEO") ? "video/*" : type.includes("AUDIO") ? "audio/*" : "image/*"}
          capture={type.includes("VIDEO") || type.includes("AUDIO") ? undefined : "environment"}
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          onClick={() => inputRef.current?.click()}
          disabled={isUploading}
          className={cn(
            "w-full rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            isCaptured
              ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
              : "bg-brand-600 text-white hover:bg-brand-700",
            isUploading && "opacity-50 cursor-not-allowed"
          )}
        >
          {isUploading ? (
            <span className="flex items-center justify-center gap-1">
              <Upload className="h-3 w-3 animate-pulse" /> Uploading...
            </span>
          ) : isCaptured ? (
            "Retake"
          ) : (
            <span className="flex items-center justify-center gap-1">
              <Camera className="h-3 w-3" /> Capture
            </span>
          )}
        </button>
      </div>
    </div>
  );
}

export function CaptureGrid({ inspectionId, captures, onCapture, isUploading }: CaptureGridProps) {
  const getCaptured = (type: string) => captures.find((c) => c.captureType === type);
  const capturedCount = REQUIRED_CAPTURES.filter((c) => getCaptured(c.type)).length;

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Photo Capture</h3>
          <p className="text-sm text-gray-500">
            {capturedCount} of {REQUIRED_CAPTURES.length} required photos captured
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-32 rounded-full bg-brand-100 overflow-hidden">
            <div
              className="h-full bg-brand-gradient rounded-full transition-all duration-500"
              style={{ width: `${(capturedCount / REQUIRED_CAPTURES.length) * 100}%` }}
            />
          </div>
          <span className="text-sm font-medium text-brand-600">
            {Math.round((capturedCount / REQUIRED_CAPTURES.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Required captures */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 flex items-center gap-1.5">
          <ImageIcon className="h-3.5 w-3.5" /> Required Photos
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {REQUIRED_CAPTURES.map((cap) => (
            <CaptureCard
              key={cap.type}
              type={cap.type}
              label={cap.label}
              hint={cap.hint}
              icon={cap.icon}
              captured={getCaptured(cap.type)}
              isUploading={isUploading === cap.type}
              onCapture={(file) => onCapture(cap.type, file)}
              required
            />
          ))}
        </div>
      </div>

      {/* Optional captures */}
      <div>
        <h4 className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5" /> Optional Media
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {OPTIONAL_CAPTURES.map((cap) => (
            <CaptureCard
              key={cap.type}
              type={cap.type}
              label={cap.label}
              hint={cap.hint}
              icon={cap.icon}
              captured={getCaptured(cap.type)}
              isUploading={isUploading === cap.type}
              onCapture={(file) => onCapture(cap.type, file)}
              required={false}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
