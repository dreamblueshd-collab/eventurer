"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import type { DoorprizeParticipant, DoorprizeGift } from "@/types/doorprize";
import styles from "./WinnerDisplay.module.css";

interface WinnerDisplayProps {
  winner: DoorprizeParticipant;
  gift: DoorprizeGift;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * WinnerDisplay — Full-screen celebration overlay (legacy Popup style).
 * Uses React Portal to render at document.body level, escaping any parent
 * stacking context issues.
 *
 * Features:
 * - Scale-in entrance animation (CSS only, no framer-motion)
 * - Winner photo (large, rounded), name, unit
 * - "Selamat Kepada Pemenang!" title
 * - Gift name badge
 * - Save = confirm (keep result), Cancel = undo (delete result from DB)
 * - Escape key triggers cancel
 * - No auto-dismiss — user must explicitly Save or Cancel
 */
export default function WinnerDisplay({
  winner,
  gift,
  onSave,
  onCancel,
}: WinnerDisplayProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    cardRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);

  // Prevent scroll on body while overlay is open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const content = (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={`Pemenang: ${winner.name}`}
    >
      {/* Confetti particles */}
      <div className={styles.confetti} aria-hidden="true">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className={styles.confettiPiece} />
        ))}
      </div>

      {/* Main card */}
      <div
        ref={cardRef}
        className={styles.card}
        onClick={(e) => e.stopPropagation()}
        tabIndex={-1}
      >
        {/* Title */}
        <h1 className={styles.title}>Selamat Kepada Pemenang!</h1>

        {/* Winner photo */}
        <div className={styles.photoWrap}>
          {winner.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={winner.imageUrl}
              alt={`Foto ${winner.name}`}
              className={styles.photo}
            />
          ) : (
            <div className={styles.photoPlaceholder} aria-hidden="true">
              👤
            </div>
          )}
        </div>

        {/* Winner name */}
        <h2 className={styles.winnerName}>{winner.name}</h2>

        {/* Winner unit */}
        {winner.unit && <p className={styles.winnerUnit}>{winner.unit}</p>}

        {/* Gift badge */}
        <div className={styles.giftBadge}>
          <span className={styles.giftIcon} aria-hidden="true">
            🎁
          </span>
          <span className={styles.giftName}>{gift.name}</span>
        </div>

        {/* Action buttons */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.btnSave}
            onClick={onSave}
            aria-label="Simpan pemenang"
          >
            Save
          </button>
          <button
            type="button"
            className={styles.btnCancel}
            onClick={onCancel}
            aria-label="Batalkan undian dan hapus hasil"
          >
            Cancel &amp; Reset
          </button>
        </div>
      </div>
    </div>
  );

  // Only use portal on client side
  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}
