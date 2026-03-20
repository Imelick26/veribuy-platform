"use client";

import { useState, useMemo } from "react";
import { Camera, ChevronDown, ChevronUp, X, ChevronLeft, ChevronRight } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MediaItem {
  id: string;
  url: string | null;
  captureType: string | null;
  type?: string;
}

interface FindingWithMedia {
  id: string;
  title: string;
  severity: string;
  media?: MediaItem[];
}

interface PhotoGalleryProps {
  media: MediaItem[];
  findings?: FindingWithMedia[];
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const STANDARD_CAPTURE_TYPES = new Set([
  "FRONT_CENTER", "FRONT_34_DRIVER", "FRONT_34_PASSENGER",
  "DRIVER_SIDE", "PASSENGER_SIDE", "REAR_34_DRIVER",
  "REAR_34_PASSENGER", "REAR_CENTER", "ROOF",
  "UNDERCARRIAGE", "ENGINE_BAY", "UNDER_HOOD_LABEL",
]);

const CAPTURE_LABELS: Record<string, string> = {
  FRONT_CENTER: "Front",
  FRONT_34_DRIVER: "Front ¾ Driver",
  FRONT_34_PASSENGER: "Front ¾ Passenger",
  DRIVER_SIDE: "Driver Side",
  PASSENGER_SIDE: "Passenger Side",
  REAR_34_DRIVER: "Rear ¾ Driver",
  REAR_34_PASSENGER: "Rear ¾ Passenger",
  REAR_CENTER: "Rear",
  ROOF: "Roof",
  UNDERCARRIAGE: "Undercarriage",
  ENGINE_BAY: "Engine Bay",
  UNDER_HOOD_LABEL: "Under Hood Label",
  INTERIOR_WALKTHROUGH: "Interior",
  WALKAROUND_VIDEO: "Walkaround",
  ENGINE_AUDIO: "Engine Audio",
  FINDING_EVIDENCE: "Finding Evidence",
  OTHER: "Other",
};

function captureLabel(type: string | null): string {
  if (!type) return "Photo";
  // Handle dynamic FINDING_EVIDENCE_{riskId}_{idx} types
  if (type.startsWith("FINDING_EVIDENCE_")) return "Evidence";
  return CAPTURE_LABELS[type] || type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ------------------------------------------------------------------ */
/*  Lightbox                                                           */
/* ------------------------------------------------------------------ */

function Lightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: {
  photos: MediaItem[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  const photo = photos[currentIndex];
  if (!photo?.url) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={onClose}>
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
      >
        <X className="h-6 w-6" />
      </button>

      {currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
          className="absolute left-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {currentIndex < photos.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
          className="absolute right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      <div className="max-w-5xl max-h-[85vh] px-16" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.url}
          alt={captureLabel(photo.captureType)}
          className="max-w-full max-h-[80vh] object-contain rounded-lg"
        />
        <p className="text-white text-center mt-3 text-sm">
          {captureLabel(photo.captureType)}
          <span className="text-white/50 ml-2">
            {currentIndex + 1} of {photos.length}
          </span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PhotoGallery Component                                             */
/* ------------------------------------------------------------------ */

export function PhotoGallery({ media, findings }: PhotoGalleryProps) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [lightboxPhotos, setLightboxPhotos] = useState<MediaItem[]>([]);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  // Categorize photos
  const { standardPhotos, evidencePhotos, otherPhotos } = useMemo(() => {
    const photos = media.filter((m) => m.url && m.type !== "VIDEO" && m.type !== "AUDIO");

    const standard = photos.filter(
      (m) => m.captureType && STANDARD_CAPTURE_TYPES.has(m.captureType)
    );

    // Evidence photos = linked to findings or FINDING_EVIDENCE capture types
    const findingMediaIds = new Set<string>();
    findings?.forEach((f) => f.media?.forEach((m) => findingMediaIds.add(m.id)));

    const evidence = photos.filter(
      (m) =>
        findingMediaIds.has(m.id) ||
        (m.captureType && (m.captureType === "FINDING_EVIDENCE" || m.captureType.startsWith("FINDING_EVIDENCE_")))
    );

    const standardIds = new Set(standard.map((m) => m.id));
    const evidenceIds = new Set(evidence.map((m) => m.id));
    const other = photos.filter((m) => !standardIds.has(m.id) && !evidenceIds.has(m.id));

    return { standardPhotos: standard, evidencePhotos: evidence, otherPhotos: other };
  }, [media, findings]);

  const totalPhotos = standardPhotos.length + evidencePhotos.length + otherPhotos.length;

  function openLightbox(photos: MediaItem[], index: number) {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
  }

  return (
    <>
      {/* Standard Vehicle Photos */}
      <div className="px-8 py-6 border-b border-border-default">
        <h3 className="text-lg font-bold text-text-primary mb-4">
          <Camera className="inline h-5 w-5 mr-1" />
          Vehicle Photos {standardPhotos.length > 0 && `(${standardPhotos.length})`}
        </h3>
        {standardPhotos.length === 0 ? (
          <div className="text-center py-10 text-text-tertiary">
            <Camera className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm font-medium">No photos captured yet</p>
            <p className="text-xs mt-1">Photos will appear here once they are uploaded during the inspection.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
            {standardPhotos.map((m, i) => (
              <button
                key={m.id}
                onClick={() => openLightbox(standardPhotos, i)}
                className="group rounded-lg bg-surface-sunken overflow-hidden text-left transition-transform hover:scale-[1.02]"
              >
                <div className="aspect-square overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={m.url!}
                    alt={captureLabel(m.captureType)}
                    className="h-full w-full object-cover group-hover:opacity-90 transition-opacity"
                  />
                </div>
                <p className="text-[10px] text-text-secondary text-center py-1.5 bg-surface-raised">
                  {captureLabel(m.captureType)}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Additional Photos — collapsible */}
      {(evidencePhotos.length > 0 || otherPhotos.length > 0) && (
        <div className="px-8 py-4 border-b border-border-default">
          <button
            onClick={() => setShowAllPhotos(!showAllPhotos)}
            className="w-full flex items-center justify-between py-2 text-left hover:bg-surface-hover rounded-lg px-2 -mx-2 transition-colors"
          >
            <span className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Camera className="h-4 w-4 text-text-secondary" />
              Additional Photos ({evidencePhotos.length + otherPhotos.length})
              <span className="text-xs font-normal text-text-tertiary">
                Evidence &amp; other captures
              </span>
            </span>
            {showAllPhotos ? (
              <ChevronUp className="h-4 w-4 text-text-tertiary" />
            ) : (
              <ChevronDown className="h-4 w-4 text-text-tertiary" />
            )}
          </button>

          {showAllPhotos && (
            <div className="mt-4 space-y-6">
              {/* Evidence Photos */}
              {evidencePhotos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                    Finding Evidence ({evidencePhotos.length})
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {evidencePhotos.map((m, i) => (
                      <button
                        key={m.id}
                        onClick={() => openLightbox(evidencePhotos, i)}
                        className="group rounded-lg bg-surface-sunken overflow-hidden text-left transition-transform hover:scale-[1.02]"
                      >
                        <div className="aspect-square overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.url!}
                            alt={captureLabel(m.captureType)}
                            className="h-full w-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                        </div>
                        <p className="text-[10px] text-text-secondary text-center py-1 bg-surface-raised truncate px-1">
                          {captureLabel(m.captureType)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Other Photos */}
              {otherPhotos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">
                    Other Captures ({otherPhotos.length})
                  </p>
                  <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {otherPhotos.map((m, i) => (
                      <button
                        key={m.id}
                        onClick={() => openLightbox(otherPhotos, i)}
                        className="group rounded-lg bg-surface-sunken overflow-hidden text-left transition-transform hover:scale-[1.02]"
                      >
                        <div className="aspect-square overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={m.url!}
                            alt={captureLabel(m.captureType)}
                            className="h-full w-full object-cover group-hover:opacity-90 transition-opacity"
                          />
                        </div>
                        <p className="text-[10px] text-text-secondary text-center py-1 bg-surface-raised truncate px-1">
                          {captureLabel(m.captureType)}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <Lightbox
          photos={lightboxPhotos}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </>
  );
}
