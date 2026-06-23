"use client";

import { useEffect, useLayoutEffect, useRef, useCallback } from "react";
import styles from "./SpinWheel.module.css";
import type { DoorprizeParticipant } from "@/types/doorprize";

interface SpinWheelProps {
  participants: DoorprizeParticipant[];
  spinning: boolean;
  winner: DoorprizeParticipant | null;
  drawDuration?: number;
  onAnimationEnd: () => void;
}

const CARD_WIDTH = 180;
const CARD_GAP = 20;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const REPEAT_COUNT = 8;

/**
 * Easing: fast start, smooth deceleration to stop.
 * easeOutQuint: 1 - (1-t)^5
 */
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

export default function SpinWheel({
  participants,
  spinning,
  winner,
  drawDuration = 4000,
  onAnimationEnd,
}: SpinWheelProps) {
  const stripRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const hasCalledEnd = useRef(false);

  const winnerRef = useRef(winner);
  const drawDurationRef = useRef(drawDuration);
  const onAnimationEndRef = useRef(onAnimationEnd);

  useLayoutEffect(() => {
    winnerRef.current = winner;
    drawDurationRef.current = drawDuration;
    onAnimationEndRef.current = onAnimationEnd;
  });

  const repeated = Array.from({ length: REPEAT_COUNT }, () => participants).flat();

  // Apply translateX + 3D per-card transforms
  const applyTransform = useCallback((offsetPx: number) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transition = "none";
    strip.style.transform = `translateX(${-offsetPx}px)`;

    const viewportCenter = (strip.parentElement?.offsetWidth ?? 800) / 2;
    const cards = strip.querySelectorAll<HTMLElement>(`.${styles.card}`);
    cards.forEach((card, i) => {
      const cardCenter = i * CARD_STEP + CARD_WIDTH / 2 - offsetPx;
      const dist = Math.abs(cardCenter - viewportCenter);
      const maxDist = CARD_STEP * 2.5;
      const t = Math.min(dist / maxDist, 1);
      const scale = 1 - t * 0.38;
      const opacity = 1 - t * 0.65;
      const rotateY = t * 40 * (cardCenter < viewportCenter ? -1 : 1);
      const translateZ = (1 - t) * 80;
      card.style.transform = `perspective(900px) rotateY(${rotateY}deg) scale(${scale}) translateZ(${translateZ}px)`;
      card.style.opacity = String(opacity);
    });
  }, []);

  // Single RAF loop: interpolate from 0 to targetOffset using easing over drawDuration
  useEffect(() => {
    if (!spinning || !winner) return;

    const strip = stripRef.current;
    if (!strip) return;

    hasCalledEnd.current = false;

    const pts = participants;
    const viewportCenter = (strip.parentElement?.offsetWidth ?? 800) / 2;
    const winnerIndex = pts.findIndex(
      (p) => p.doorprizeParticipantId === winner.doorprizeParticipantId
    );

    // Target: winner card in repetition 5 centered in viewport
    const repOffset = 5 * pts.length;
    const targetCardIndex = repOffset + (winnerIndex >= 0 ? winnerIndex : 0);
    const targetOffset = targetCardIndex * CARD_STEP + CARD_WIDTH / 2 - viewportCenter;

    const duration = drawDurationRef.current;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuint(progress);

      const currentOffset = easedProgress * targetOffset;
      applyTransform(currentOffset);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete — highlight winner
        const cards = strip.querySelectorAll<HTMLElement>(`.${styles.card}`);
        if (cards[targetCardIndex]) {
          cards[targetCardIndex].classList.add(styles.cardWinner);
        }

        rafRef.current = null;
        if (!hasCalledEnd.current) {
          hasCalledEnd.current = true;
          onAnimationEndRef.current();
        }
      }
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [spinning, winner, participants, applyTransform]);

  if (participants.length === 0) return null;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.centerLine} aria-hidden="true" />

      <div className={styles.viewport}>
        <div ref={stripRef} className={styles.strip}>
          {repeated.map((participant, i) => (
            <div
              key={`${participant.doorprizeParticipantId}-${i}`}
              className={styles.card}
            >
              <div className={styles.cardInner}>
                {participant.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={participant.imageUrl}
                    alt={participant.name}
                    className={styles.avatar}
                    loading="lazy"
                  />
                ) : (
                  <div className={styles.avatarPlaceholder} aria-hidden="true">👤</div>
                )}
                <p className={styles.name}>{participant.name}</p>
                {participant.unit && (
                  <p className={styles.unit}>{participant.unit}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {winner && (
        <span className={styles.srOnly} role="alert">
          Pemenang undian: {winner.name}{winner.unit ? `, ${winner.unit}` : ""}
        </span>
      )}
    </div>
  );
}
