"use client";

import { useEffect, useRef, useLayoutEffect } from "react";
import type { DoorprizeParticipant } from "@/types/doorprize";
import styles from "./SlotMachine.module.css";

interface SlotMachineProps {
  participants: DoorprizeParticipant[];
  spinning: boolean;
  winner: DoorprizeParticipant | null;
  drawDuration?: number;
  onAnimationEnd: () => void;
}

const ITEM_HEIGHT = 80;
const VISIBLE_ITEMS = 5;
const REPEAT_COUNT = 10;

/**
 * Easing: fast start, smooth deceleration to stop.
 * easeOutQuint: 1 - (1-t)^5
 */
function easeOutQuint(t: number): number {
  return 1 - Math.pow(1 - t, 5);
}

/**
 * SlotMachine — Vertical scrolling names using a single RAF loop with
 * physics-based easing. The entire animation (spin + decelerate) completes
 * in exactly `drawDuration` milliseconds.
 */
export default function SlotMachine({
  participants,
  spinning,
  winner,
  drawDuration = 4000,
  onAnimationEnd,
}: SlotMachineProps) {
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

  const repeatedParticipants = Array.from(
    { length: REPEAT_COUNT },
    () => participants
  ).flat();

  const totalHeight = participants.length * ITEM_HEIGHT;

  // Single RAF loop: interpolate from 0 to targetOffset using easing
  useEffect(() => {
    if (!spinning || !winner) return;

    const strip = stripRef.current;
    if (!strip) return;

    hasCalledEnd.current = false;

    const winnerIndex = participants.findIndex(
      (p) => p.doorprizeParticipantId === winner.doorprizeParticipantId
    );

    // Target: winner at center of viewport, in repetition 6
    const centerSlot = Math.floor(VISIBLE_ITEMS / 2);
    const baseTarget = winnerIndex * ITEM_HEIGHT - centerSlot * ITEM_HEIGHT;
    const targetOffset = 6 * totalHeight + baseTarget;

    const duration = drawDurationRef.current;
    const startTime = performance.now();

    // Reset strip
    strip.style.transition = "none";
    strip.style.transform = "translateY(0px)";

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuint(progress);

      const currentOffset = easedProgress * targetOffset;
      strip.style.transform = `translateY(${-currentOffset}px)`;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
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
  }, [spinning, winner, participants, totalHeight]);

  if (participants.length === 0) return null;

  const viewportHeight = VISIBLE_ITEMS * ITEM_HEIGHT;

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.frame}>
        <div className={styles.highlightBar} aria-hidden="true" />

        <div
          className={styles.viewport}
          style={{ height: `${viewportHeight}px` }}
        >
          <div ref={stripRef} className={styles.strip}>
            {repeatedParticipants.map((participant, i) => {
              const isWinnerItem =
                winner &&
                participant.doorprizeParticipantId === winner.doorprizeParticipantId;
              return (
                <div
                  key={`${participant.doorprizeParticipantId}-${i}`}
                  className={`${styles.item} ${isWinnerItem && !spinning ? styles.itemWinner : ""}`}
                  style={{ height: `${ITEM_HEIGHT}px` }}
                >
                  <div className={styles.itemContent}>
                    {participant.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={participant.imageUrl}
                        alt=""
                        className={styles.itemAvatar}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className={styles.itemAvatarPlaceholder}
                        aria-hidden="true"
                      >
                        👤
                      </div>
                    )}
                    <div className={styles.itemInfo}>
                      <span className={styles.itemName}>{participant.name}</span>
                      {participant.unit && (
                        <span className={styles.itemUnit}>{participant.unit}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.fadeTop} aria-hidden="true" />
        <div className={styles.fadeBottom} aria-hidden="true" />
      </div>

      {winner && (
        <span className={styles.srOnly} role="alert">
          Pemenang undian: {winner.name}
          {winner.unit ? `, ${winner.unit}` : ""}
        </span>
      )}
    </div>
  );
}
