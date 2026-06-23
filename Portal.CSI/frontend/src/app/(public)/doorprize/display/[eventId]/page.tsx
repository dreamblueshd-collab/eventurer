"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { fetchPublicResults, fetchPublicEventInfo } from "@/lib/doorprize-api";
import type { DoorprizeResult } from "@/types/doorprize";
import styles from "./display.module.css";

interface WinnerEntry {
  id: number;
  name: string;
  unit: string | null;
  giftName: string;
  isNew: boolean;
}

export default function DoorprizeDisplayPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const [eventName, setEventName] = useState<string>("");
  const [winners, setWinners] = useState<WinnerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastIdRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const mapResultToEntry = useCallback(
    (result: DoorprizeResult, isNew: boolean): WinnerEntry => ({
      id: result.doorprizeResultId,
      name: result.participant?.name || "—",
      unit: result.participant?.unit || null,
      giftName: result.gift?.name || "—",
      isNew,
    }),
    [],
  );

  // Initial load: fetch event info + all results
  useEffect(() => {
    if (!eventId) return;

    async function loadInitial() {
      setLoading(true);
      setError(null);

      const [infoRes, resultsRes] = await Promise.all([
        fetchPublicEventInfo(eventId),
        fetchPublicResults(eventId),
      ]);

      if (!infoRes.success) {
        setError(infoRes.message);
        setLoading(false);
        return;
      }

      setEventName(infoRes.data.name);

      if (resultsRes.success) {
        const entries = resultsRes.data.results.map((r) =>
          mapResultToEntry(r, false),
        );
        setWinners(entries);

        // Track last result ID for delta polling
        if (entries.length > 0) {
          lastIdRef.current = Math.max(...entries.map((e) => e.id));
        }
      }

      setLoading(false);
    }

    loadInitial();
  }, [eventId, mapResultToEntry]);

  // Delta polling every 5 seconds
  useEffect(() => {
    if (!eventId || loading || error) return;

    intervalRef.current = setInterval(async () => {
      const afterId = lastIdRef.current || undefined;
      const res = await fetchPublicResults(eventId, afterId);

      if (res.success && res.data.results.length > 0) {
        const newEntries = res.data.results.map((r) =>
          mapResultToEntry(r, true),
        );

        setWinners((prev) => {
          // Avoid duplicates
          const existingIds = new Set(prev.map((w) => w.id));
          const unique = newEntries.filter((e) => !existingIds.has(e.id));
          if (unique.length === 0) return prev;
          return [...prev, ...unique];
        });

        const maxNewId = Math.max(...newEntries.map((e) => e.id));
        if (maxNewId > lastIdRef.current) {
          lastIdRef.current = maxNewId;
        }
      }
    }, 5000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [eventId, loading, error, mapResultToEntry]);

  // Clear "isNew" animation flag after animation completes
  useEffect(() => {
    if (winners.some((w) => w.isNew)) {
      const timeout = setTimeout(() => {
        setWinners((prev) => prev.map((w) => ({ ...w, isNew: false })));
      }, 700);
      return () => clearTimeout(timeout);
    }
  }, [winners]);

  if (loading) {
    return <div className={styles.loading}>Memuat data event...</div>;
  }

  if (error) {
    return (
      <div className={styles.error}>
        <p className={styles.errorTitle}>Gagal Memuat</p>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.eventName}>{eventName}</h1>
        <p className={styles.subtitle}>🎉 Daftar Pemenang Doorprize</p>
      </header>

      {winners.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🎁</div>
          <p className={styles.emptyText}>
            Belum ada pemenang. Menunggu undian...
          </p>
        </div>
      ) : (
        <div className={styles.winnersSection}>
          <div className={styles.winnersGrid}>
            {winners.map((winner, idx) => (
              <div
                key={winner.id}
                className={`${styles.winnerCard} ${winner.isNew ? styles.slideIn : ""}`}
              >
                <span className={styles.winnerIndex}>{idx + 1}</span>
                <div className={styles.winnerInfo}>
                  <p className={styles.winnerName}>{winner.name}</p>
                  {winner.unit && (
                    <p className={styles.winnerUnit}>{winner.unit}</p>
                  )}
                </div>
                <span className={styles.winnerGift}>{winner.giftName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className={styles.statusBar}>
        <span className={styles.statusDot} />
        <span>Live — memperbarui otomatis</span>
      </footer>
    </div>
  );
}
