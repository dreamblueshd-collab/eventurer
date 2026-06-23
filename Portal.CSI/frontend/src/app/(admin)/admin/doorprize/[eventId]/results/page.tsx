"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast, ToastContainer } from "@/components/common/toast";
import { fetchDrawState, resetDrawResult } from "@/lib/doorprize-api";
import type { DoorprizeResult } from "@/types/doorprize";
import baseStyles from "../../../page-mockup.module.css";
import s from "./results.module.css";

export default function ResultsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toasts, showToast, removeToast } = useToast();

  // Data state
  const [results, setResults] = useState<DoorprizeResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Search state
  const [search, setSearch] = useState("");

  // Reset confirmation state
  const [resetTarget, setResetTarget] = useState<DoorprizeResult | null>(null);
  const [resetting, setResetting] = useState(false);

  // ─── Load results ───
  const loadResults = useCallback(async () => {
    setLoading(true);
    setError("");

    const result = await fetchDrawState(eventId);

    if (!result.success) {
      setError(result.message);
      setResults([]);
    } else {
      setResults(result.data.results);
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadResults();
  }, [loadResults]);

  // ─── Filtered results ───
  const filteredResults = useMemo(() => {
    if (!search.trim()) return results;
    const q = search.toLowerCase().trim();
    return results.filter((r) => {
      const name = r.participant?.name?.toLowerCase() || "";
      const code = r.participant?.employeeCode?.toLowerCase() || "";
      const unit = r.participant?.unit?.toLowerCase() || "";
      const gift = r.gift?.name?.toLowerCase() || "";
      return (
        name.includes(q) ||
        code.includes(q) ||
        unit.includes(q) ||
        gift.includes(q)
      );
    });
  }, [results, search]);

  // ─── Reset handler ───
  async function handleReset() {
    if (!resetTarget) return;
    setResetting(true);

    const result = await resetDrawResult(resetTarget.doorprizeResultId);
    if (!result.success) {
      showToast("error", result.message);
    } else {
      showToast("success", "Hasil undian berhasil di-reset");
      void loadResults();
    }

    setResetting(false);
    setResetTarget(null);
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Page Header ── */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Data Pemenang</h1>
          <p className={baseStyles.subtitle}>
            Daftar seluruh pemenang undian doorprize
          </p>
        </div>
        <div className={baseStyles.toolbar}>
          <Link
            href={`/admin/doorprize/${eventId}`}
            prefetch={false}
            className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
          >
            ← Kembali ke Detail Event
          </Link>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className={s.filterCard}>
        <div className={s.filterHeader}>
          <span className={s.filterIcon}>🔍</span>
          <span className={s.filterTitle}>Pencarian</span>
        </div>
        <div className={s.filterRow}>
          <div className={s.searchGroup}>
            <label className={s.filterLabel} htmlFor="rs-search">
              Cari Pemenang
            </label>
            <input
              id="rs-search"
              type="text"
              className={s.searchInput}
              placeholder="Cari nama, kode karyawan, unit kerja, atau hadiah..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Results Table ── */}
      <div className={s.sectionCard} style={{ animationDelay: "0.10s" }}>
        <div className={s.sectionHeader}>
          <div className={s.sectionIcon}>🏆</div>
          <div className={s.sectionTitleWrap}>
            <div className={s.sectionTitle}>Daftar Pemenang</div>
            <div className={s.sectionSubtitle}>
              Semua hasil undian yang sudah dilakukan
            </div>
          </div>
          <div className={s.sectionHeaderRight}>
            <span className={s.countBadge}>
              {filteredResults.length} pemenang
            </span>
          </div>
        </div>

        {error && <div className={s.errorText}>⚠️ {error}</div>}

        {loading ? (
          <div className={s.loadingBar}>
            <div className={s.spinner} />
            Memuat data pemenang...
          </div>
        ) : !error && filteredResults.length === 0 ? (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>🏆</div>
            <p className={s.emptyTitle}>
              {search.trim()
                ? "Tidak ada hasil yang cocok"
                : "Belum ada pemenang"}
            </p>
            <p className={s.emptyDesc}>
              {search.trim()
                ? "Coba ubah kata kunci pencarian."
                : "Lakukan undian terlebih dahulu untuk melihat data pemenang."}
            </p>
          </div>
        ) : !error ? (
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={baseStyles.colCenter}>#</th>
                  <th className={baseStyles.colCenter}>Kode Karyawan (NP)</th>
                  <th>Nama</th>
                  <th>Unit Kerja</th>
                  <th>Hadiah</th>
                  <th className={baseStyles.colCenter}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredResults.map((r, idx) => (
                  <tr key={r.doorprizeResultId}>
                    <td className={`${s.cellNumber} ${baseStyles.colCenter}`}>{idx + 1}</td>
                    <td className={baseStyles.colCenter}>
                      {r.participant?.employeeCode || (
                        <span className={s.textMuted}>-</span>
                      )}
                    </td>
                    <td className={s.cellName}>
                      {r.participant?.name || (
                        <span className={s.textMuted}>-</span>
                      )}
                    </td>
                    <td>
                      {r.participant?.unit || (
                        <span className={s.textMuted}>-</span>
                      )}
                    </td>
                    <td>
                      {r.gift?.name ? (
                        <span className={s.giftBadge}>🎁 {r.gift.name}</span>
                      ) : (
                        <span className={s.textMuted}>-</span>
                      )}
                    </td>
                    <td className={baseStyles.colCenter}>
                      <button
                        type="button"
                        className={s.btnReset}
                        onClick={() => setResetTarget(r)}
                        title="Reset hasil undian"
                      >
                        🔄 Reset
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ── Reset Confirmation Modal ── */}
      {resetTarget && (
        <div
          className={s.modalOverlay}
          onClick={() => !resetting && setResetTarget(null)}
        >
          <div className={s.modalCardSm} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>⚠️ Konfirmasi Reset</h2>
              <button
                type="button"
                className={s.modalClose}
                onClick={() => setResetTarget(null)}
                disabled={resetting}
              >
                ×
              </button>
            </div>
            <div className={s.modalBody}>
              <p className={s.confirmText}>
                Apakah Anda yakin ingin mereset hasil undian untuk{" "}
                <strong>
                  {resetTarget.participant?.name || "peserta ini"}
                </strong>
                ?
                {resetTarget.gift?.name && (
                  <>
                    {" "}
                    Hadiah <strong>&quot;{resetTarget.gift.name}&quot;</strong>{" "}
                    akan dikembalikan ke kuota.
                  </>
                )}
              </p>
            </div>
            <div className={s.modalFooter}>
              <button
                type="button"
                className={s.btnCancel}
                onClick={() => setResetTarget(null)}
                disabled={resetting}
              >
                Batal
              </button>
              <button
                type="button"
                className={s.btnDanger}
                onClick={handleReset}
                disabled={resetting}
              >
                {resetting ? "Mereset..." : "🔄 Ya, Reset"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
