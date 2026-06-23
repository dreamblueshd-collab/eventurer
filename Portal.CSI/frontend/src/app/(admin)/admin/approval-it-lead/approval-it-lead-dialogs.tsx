"use client";

import type { PendingApproval } from "@/lib/approvals";
import styles from "../approval.module.css";

interface ApprovalItLeadDialogsProps {
  handleProposeTakeout: () => Promise<void>;
  proposeOpen: boolean;
  proposeReason: string;
  selectedRows: PendingApproval[];
  setProposeOpen: (value: boolean) => void;
  setProposeReason: (value: string) => void;
}

export default function ApprovalItLeadDialogs({
  handleProposeTakeout,
  proposeOpen,
  proposeReason,
  selectedRows,
  setProposeOpen,
  setProposeReason,
}: ApprovalItLeadDialogsProps) {
  if (!proposeOpen) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={() => setProposeOpen(false)}>
      <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="it-lead-propose-modal-title" onClick={(event) => event.stopPropagation()}>
        <header className={styles.modalHeader}>
          <h2 id="it-lead-propose-modal-title" className={styles.modalTitle}>Propose Takeout</h2>
          <button type="button" className={styles.closeBtn} onClick={() => setProposeOpen(false)} aria-label="Tutup modal propose takeout">
            x
          </button>
        </header>
        <div className={styles.modalBody}>
          <p className={styles.meta}>Jumlah item terpilih: {selectedRows.length}</p>
          <textarea
            className={styles.textarea}
            id="propose-takeout-reason"
            name="propose-takeout-reason"
            rows={4}
            placeholder="Alasan propose takeout wajib diisi"
            aria-label="Alasan propose takeout"
            value={proposeReason}
            onChange={(event) => setProposeReason(event.target.value)}
          />
        </div>
        <footer className={styles.modalActions}>
          <button type="button" className={styles.btnSecondary} onClick={() => setProposeOpen(false)}>
            Cancel
          </button>
          <button type="button" className={styles.btnDanger} onClick={() => void handleProposeTakeout()}>
            Submit Proposal
          </button>
        </footer>
      </div>
    </div>
  );
}
