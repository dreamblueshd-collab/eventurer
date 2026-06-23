"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type { DoorprizeParticipant } from "@/types/doorprize";
import styles from "./RouletteWheel.module.css";

interface RouletteWheelProps {
  participants: DoorprizeParticipant[];
  spinning: boolean;
  winner: DoorprizeParticipant | null;
  drawDuration?: number;
  onAnimationEnd: () => void;
}

const SEGMENT_COLORS = [
  "#6366f1",
  "#f59e0b",
  "#10b981",
  "#ef4444",
  "#8b5cf6",
  "#3b82f6",
  "#ec4899",
  "#14b8a6",
];

const MAX_SEGMENTS = 16;

function buildDisplaySubset(
  participants: DoorprizeParticipant[],
  winner: DoorprizeParticipant | null
): DoorprizeParticipant[] {
  if (participants.length <= MAX_SEGMENTS) {
    return [...participants].sort(() => Math.random() - 0.5);
  }

  const others = participants.filter(
    (participant) => participant.doorprizeParticipantId !== winner?.doorprizeParticipantId
  );

  for (let i = others.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }

  const subset = others.slice(0, winner ? MAX_SEGMENTS - 1 : MAX_SEGMENTS);
  if (winner) {
    subset.push(winner);
  }

  return subset.sort(() => Math.random() - 0.5);
}

function buildConicGradient(segmentCount: number, segmentAngle: number) {
  if (segmentCount === 0) {
    return "conic-gradient(#1e293b 0deg 360deg)";
  }

  const stops: string[] = [];
  for (let i = 0; i < segmentCount; i += 1) {
    const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
    const startDeg = i * segmentAngle;
    const endDeg = (i + 1) * segmentAngle;
    stops.push(`${color} ${startDeg}deg ${endDeg}deg`);
  }

  return `conic-gradient(${stops.join(", ")})`;
}

export default function RouletteWheel({
  participants,
  spinning,
  winner,
  drawDuration = 3000,
  onAnimationEnd,
}: RouletteWheelProps) {
  const wheelRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const currentRotationRef = useRef(0);
  const winnerRef = useRef(winner);
  const drawDurationRef = useRef(drawDuration);
  const onAnimationEndRef = useRef(onAnimationEnd);
  const hasCalledEndRef = useRef(false);

  const displayParticipants = useMemo(
    () => (spinning && winner ? buildDisplaySubset(participants, winner) : participants.slice(0, MAX_SEGMENTS)),
    [participants, spinning, winner]
  );

  useLayoutEffect(() => {
    winnerRef.current = winner;
    drawDurationRef.current = drawDuration;
    onAnimationEndRef.current = onAnimationEnd;
  });

  useEffect(() => {
    if (!spinning) {
      return;
    }

    const wheel = wheelRef.current;
    if (!wheel) {
      return;
    }

    const renderedParticipants = displayParticipants;
    const activeWinner = winnerRef.current;
    const segmentCount = renderedParticipants.length;
    const segmentAngle = segmentCount > 0 ? 360 / segmentCount : 360;

    const winnerIndex = activeWinner
      ? renderedParticipants.findIndex(
          (participant) =>
            participant.doorprizeParticipantId === activeWinner.doorprizeParticipantId
        )
      : -1;

    const segmentCenter =
      winnerIndex >= 0 ? winnerIndex * segmentAngle + segmentAngle / 2 : 0;
    const baseAngle = currentRotationRef.current % 360;
    const neededRotation =
      (360 - (segmentCenter % 360) - baseAngle + 360) % 360;

    const startRotation = currentRotationRef.current;
    const spinCycles = Math.max(5, Math.round(drawDurationRef.current / 800));
    const endRotation = startRotation + spinCycles * 360 + neededRotation;

    hasCalledEndRef.current = false;
    wheel.style.transform = `rotate(${startRotation}deg)`;

    if (animationRef.current) {
      animationRef.current.cancel();
      animationRef.current = null;
    }

    const animation = wheel.animate(
      [
        { transform: `rotate(${startRotation}deg)` },
        { transform: `rotate(${endRotation}deg)` },
      ],
      {
        duration: drawDurationRef.current,
        easing: "cubic-bezier(0.44, -0.02, 0.16, 1.02)",
        fill: "forwards",
        iterations: 1,
      }
    );

    animationRef.current = animation;

    animation.onfinish = () => {
      currentRotationRef.current = endRotation;
      wheel.style.transform = `rotate(${endRotation}deg)`;
      animationRef.current = null;

      if (!hasCalledEndRef.current) {
        hasCalledEndRef.current = true;
        onAnimationEndRef.current();
      }
    };

    animation.oncancel = () => {
      animationRef.current = null;
      wheel.style.transform = `rotate(${currentRotationRef.current}deg)`;
    };

    return () => {
      if (animationRef.current) {
        animationRef.current.cancel();
        animationRef.current = null;
      }
    };
  }, [displayParticipants, spinning]);

  if (participants.length === 0) {
    return null;
  }

  const segmentCount = displayParticipants.length;
  const segmentAngle = segmentCount > 0 ? 360 / segmentCount : 360;
  const conicGradient = buildConicGradient(segmentCount, segmentAngle);

  return (
    <div className={styles.container} role="status" aria-live="polite">
      <div className={styles.pointer} aria-hidden="true" />

      <div
        ref={wheelRef}
        className={styles.wheel}
        style={{ background: conicGradient }}
      >
        {displayParticipants.map((participant, index) => {
          const labelAngle = index * segmentAngle + segmentAngle / 2 - 90;
          const label =
            participant.name.length > 12
              ? `${participant.name.slice(0, 11)}...`
              : participant.name;

          return (
            <div
              key={participant.doorprizeParticipantId}
              className={styles.segmentLabel}
              style={{ transform: `rotate(${labelAngle}deg)` }}
            >
              <span className={styles.labelText}>{label}</span>
            </div>
          );
        })}
      </div>

      <div className={styles.centerCircle} aria-hidden="true">
        <span className={styles.centerText}>SPIN</span>
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
