"use client";

import Link from "next/link";
import type { DoorprizeEvent, DoorprizeEventStatus } from "@/types/doorprize";
import styles from "./components.module.css";

interface DoorprizeEventCardProps {
  event: DoorprizeEvent;
}

function getStatusBadgeClass(status: DoorprizeEventStatus): string {
  switch (status) {
    case "Active":
      return styles.badgeActive;
    case "Completed":
      return styles.badgeCompleted;
    case "Archived":
      return styles.badgeArchived;
    default:
      return styles.badgeDraft;
  }
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

export default function DoorprizeEventCard({ event }: DoorprizeEventCardProps) {
  return (
    <Link
      href={`/admin/doorprize/${event.doorprizeEventId}`}
      prefetch={false}
      className={styles.eventCard}
    >
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{event.name}</h3>
        <span className={getStatusBadgeClass(event.status)}>
          {event.status}
        </span>
      </div>
      <div className={styles.cardDate}>📅 {formatDate(event.eventDate)}</div>
      <div className={styles.cardStats}>
        <span className={styles.stat}>
          <span className={styles.statIcon}>🎁</span>
          <span className={styles.statValue}>{event.giftCount ?? 0}</span>{" "}
          hadiah
        </span>
        <span className={styles.stat}>
          <span className={styles.statIcon}>👥</span>
          <span className={styles.statValue}>
            {event.participantCount ?? 0}
          </span>{" "}
          peserta
        </span>
        <span className={styles.stat}>
          <span className={styles.statIcon}>🏆</span>
          <span className={styles.statValue}>{event.resultCount ?? 0}</span>{" "}
          pemenang
        </span>
      </div>
    </Link>
  );
}
