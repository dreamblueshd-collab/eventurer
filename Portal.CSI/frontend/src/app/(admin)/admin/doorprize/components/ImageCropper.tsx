"use client";

import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { useCallback, useEffect, useState } from "react";
import styles from "./ImageCropper.module.css";

interface ImageCropperProps {
  file: File;
  aspectRatio?: number;
  onCancel: () => void;
  onApply: (croppedFile: File) => void;
}

export default function ImageCropper({
  file,
  aspectRatio = 16 / 9,
  onCancel,
  onApply,
}: ImageCropperProps) {
  const [imageUrl, setImageUrl] = useState("");
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [loading, setLoading] = useState(false);

  // Create object URL when file changes
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const onCropComplete = useCallback((_: Area, croppedPixels: Area) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleApply = async () => {
    if (!croppedAreaPixels) return;
    setLoading(true);

    try {
      const croppedFile = await getCroppedImg(
        imageUrl,
        croppedAreaPixels,
        file.name,
      );
      onApply(croppedFile);
    } catch {
      // If cropping fails, fall back to original file
      onApply(file);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className={styles.header}>
          <h2 className={styles.title}>Crop Gambar</h2>
          <button
            className={styles.closeBtn}
            type="button"
            onClick={onCancel}
            aria-label="Tutup"
          >
            ✕
          </button>
        </header>

        {/* Crop area */}
        <div className={styles.cropArea}>
          {imageUrl && (
            <Cropper
              image={imageUrl}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
              showGrid
              style={{
                containerStyle: { background: "#0f172a" },
                cropAreaStyle: { border: "2px solid rgba(255,255,255,0.6)" },
              }}
            />
          )}
        </div>

        {/* Zoom control */}
        <div className={styles.controls}>
          <div className={styles.sliderRow}>
            <span className={styles.sliderLabel}>Zoom</span>
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              className={styles.slider}
              onChange={(e) => setZoom(Number(e.target.value))}
            />
            <span className={styles.sliderValue}>{zoom.toFixed(1)}x</span>
          </div>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <button
            className={styles.btnCancel}
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </button>
          <button
            className={styles.btnApply}
            type="button"
            onClick={() => void handleApply()}
            disabled={loading || !croppedAreaPixels}
          >
            {loading ? "Memproses..." : "Terapkan"}
          </button>
        </footer>
      </div>
    </div>
  );
}

// ─── Canvas-based crop helper ─────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Gagal memuat gambar"));
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

async function getCroppedImg(
  imageSrc: string,
  pixelCrop: Area,
  originalName: string,
): Promise<File> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  if (!ctx) throw new Error("Canvas tidak tersedia");

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (!b) {
          reject(new Error("Gagal export gambar"));
          return;
        }
        resolve(b);
      },
      "image/webp",
      0.9,
    );
  });

  const baseName = originalName.replace(/\.[^.]+$/, "");
  return new File([blob], `${baseName}-cropped.webp`, { type: "image/webp" });
}
