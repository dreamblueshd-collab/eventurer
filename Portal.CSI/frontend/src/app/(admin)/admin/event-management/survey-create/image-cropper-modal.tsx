"use client";

import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SurveyImageType } from "@/lib/image-upload";
import styles from "./image-cropper.module.css";

interface ImageCropperModalProps {
  file: File;
  imageType: SurveyImageType;
  onCancel: () => void;
  onApply: (file: File) => Promise<void>;
  onPlacementChange?: (x: number, y: number) => void;
  placementX?: number;
  placementY?: number;
}

function getCropSpec(imageType: SurveyImageType) {
  if (imageType === "hero") return { width: 1600, height: 500, label: "Hero Cover", aspect: 1600 / 500 };
  if (imageType === "logo") return { width: 600, height: 600, label: "Logo", aspect: 1 };
  return { width: 1920, height: 1080, label: "Background", aspect: 1920 / 1080 };
}

const PLACEMENTS = [
  { label: "↖ Kiri Atas", x: 0, y: 0 },
  { label: "↑ Tengah Atas", x: 50, y: 0 },
  { label: "↗ Kanan Atas", x: 100, y: 0 },
  { label: "↙ Kiri Bawah", x: 0, y: 100 },
  { label: "↓ Tengah Bawah", x: 50, y: 100 },
  { label: "↘ Kanan Bawah", x: 100, y: 100 },
];

export default function ImageCropperModal({
  file,
  imageType,
  onCancel,
  onApply,
  onPlacementChange,
  placementX = 100,
  placementY = 0,
}: ImageCropperModalProps) {
  const spec = useMemo(() => getCropSpec(imageType), [imageType]);
  const isLogo = imageType === "logo";

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);
  const [localPlacementX, setLocalPlacementX] = useState(placementX);
  const [localPlacementY, setLocalPlacementY] = useState(placementY);

  const [imageUrl, setImageUrl] = useState("");

  // Create object URL when file changes
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  // Live preview
  useEffect(() => {
    if (!croppedAreaPixels || !previewCanvasRef.current) return;
    const canvas = previewCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      const { x, y, width, height } = croppedAreaPixels;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.save();
      if (flipH || flipV) {
        ctx.translate(flipH ? canvas.width : 0, flipV ? canvas.height : 0);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      }
      ctx.drawImage(img, x, y, width, height, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    };
    img.src = imageUrl;
  }, [croppedAreaPixels, imageUrl, flipH, flipV]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onCancel(); }
      if (e.key === "Enter" && !loading) { e.preventDefault(); void handleApply(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, onCancel]);

  const handleRotateLeft = () => setRotation((r) => (r - 90 + 360) % 360);
  const handleRotateRight = () => setRotation((r) => (r + 90) % 360);
  const handleFlipH = () => setFlipH((f) => !f);
  const handleFlipV = () => setFlipV((f) => !f);
  const handleReset = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setFlipH(false); setFlipV(false); };

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);
    try {
      const img = await loadImage(imageUrl);
      const canvas = document.createElement("canvas");
      canvas.width = spec.width;
      canvas.height = spec.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas tidak tersedia");

      ctx.save();
      if (flipH || flipV) {
        ctx.translate(flipH ? spec.width : 0, flipV ? spec.height : 0);
        ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      }
      ctx.drawImage(
        img,
        croppedAreaPixels.x, croppedAreaPixels.y,
        croppedAreaPixels.width, croppedAreaPixels.height,
        0, 0, spec.width, spec.height,
      );
      ctx.restore();

      const blob = await canvasToBlob(canvas);
      const output = new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-cropped.webp`, { type: "image/webp" });

      if (isLogo && onPlacementChange) {
        onPlacementChange(localPlacementX, localPlacementY);
      }
      await onApply(output);
    } finally {
      setLoading(false);
    }
  };

  const previewW = 120;
  const previewH = Math.round(previewW / spec.aspect);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className={styles.header}>
          <h2 className={styles.title}>Edit Image</h2>
          <button className={styles.closeBtn} type="button" onClick={onCancel} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </header>

        {/* Body: crop area left, controls right */}
        <div className={styles.body}>
          {/* Crop area */}
          <div className={styles.cropArea}>
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={spec.aspect}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={onCropComplete}
              showGrid
              cropShape={isLogo ? "round" : "rect"}
              style={{
                containerStyle: { background: "#0f172a", borderRadius: 8 },
                cropAreaStyle: { border: "2px solid rgba(255,255,255,0.6)" },
              }}
            />
          </div>

          {/* Controls panel */}
          <div className={styles.controls}>
            {/* Spec badge */}
            <div className={styles.specBadge}>
              <span className={styles.specIcon}>📐</span>
              <span>{spec.label}</span>
              <span className={styles.specDim}>{spec.width} × {spec.height}</span>
            </div>

            {/* Transform tools */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Transform</div>
              <div className={styles.toolRow}>
                <button type="button" className={styles.toolBtn} onClick={handleRotateLeft} aria-label="Rotate left 90°" title="Rotate left">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 2v6h6M2.66 15.57a10 10 0 1 0 .57-8.38"/></svg>
                </button>
                <button type="button" className={styles.toolBtn} onClick={handleRotateRight} aria-label="Rotate right 90°" title="Rotate right">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/></svg>
                </button>
                <button type="button" className={`${styles.toolBtn} ${flipH ? styles.toolBtnActive : ""}`} onClick={handleFlipH} aria-label="Flip horizontal" title="Flip horizontal">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 3v18M16 7l4 5-4 5M8 7L4 12l4 5"/></svg>
                </button>
                <button type="button" className={`${styles.toolBtn} ${flipV ? styles.toolBtnActive : ""}`} onClick={handleFlipV} aria-label="Flip vertical" title="Flip vertical">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M7 8L12 4l5 4M7 16l5 4 5-4"/></svg>
                </button>
                <button type="button" className={styles.toolBtn} onClick={handleReset} aria-label="Reset" title="Reset all">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12a9 9 0 1 1 2.64 6.36"/><path d="M3 7v5h5"/></svg>
                </button>
              </div>
            </div>

            {/* Zoom */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Zoom</div>
              <div className={styles.sliderRow}>
                <input type="range" min={1} max={3} step={0.01} value={zoom} className={styles.slider} onChange={(e) => setZoom(Number(e.target.value))} />
                <span className={styles.sliderValue}>{zoom.toFixed(1)}x</span>
              </div>
            </div>

            {/* Rotation */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Rotation</div>
              <div className={styles.sliderRow}>
                <input type="range" min={0} max={360} step={1} value={rotation} className={styles.slider} onChange={(e) => setRotation(Number(e.target.value))} />
                <span className={styles.sliderValue}>{rotation}°</span>
              </div>
            </div>

            {/* Preview */}
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Preview</div>
              <canvas ref={previewCanvasRef} width={previewW} height={previewH} className={styles.previewCanvas} />
            </div>

            {/* Logo Placement (only for logo) */}
            {isLogo ? (
              <div className={styles.section}>
                <div className={styles.sectionLabel}>📍 Posisi di Survey</div>
                <div className={styles.placementGrid}>
                  {PLACEMENTS.map((p) => (
                    <button
                      key={`${p.x}-${p.y}`}
                      type="button"
                      className={`${styles.placementBtn} ${localPlacementX === p.x && localPlacementY === p.y ? styles.placementBtnActive : ""}`}
                      onClick={() => { setLocalPlacementX(p.x); setLocalPlacementY(p.y); }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <button className={styles.btnCancel} type="button" onClick={onCancel} disabled={loading}>Batal</button>
          <button className={styles.btnApply} type="button" onClick={() => void handleApply()} disabled={loading || !croppedAreaPixels}>
            {loading ? "Memproses..." : "Save Changes"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar"));
    img.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => { if (!blob) { reject(new Error("Gagal export")); return; } resolve(blob); }, "image/webp", 0.9);
  });
}
