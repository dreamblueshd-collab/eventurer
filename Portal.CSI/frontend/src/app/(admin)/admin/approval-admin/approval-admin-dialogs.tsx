"use client";

import type { ApprovalRespondent, ApprovalTakeout } from "@/lib/approvals";
import styles from "../approval.module.css";
import { formatDateTime } from "./approval-admin-utils";

type ModalState = { type: "none" } | { type: "detail"; row: ApprovalRespondent };

interface ApprovalAdminDialogsProps {
  handleRejectSelected: () => Promise<void>;
  handleRejectTakeouts: () => Promise<void>;
  modal: ModalState;
  rejectOpen: boolean;
  rejectReason: string;
  selectedRespondentIds: number[];
  selectedTakeoutRows: ApprovalTakeout[];
  setModal: (value: ModalState) => void;
  setRejectOpen: (value: boolean) => void;
  setRejectReason: (value: string) => void;
  setTakeoutRejectOpen: (value: boolean) => void;
  setTakeoutRejectReason: (value: string) => void;
  takeoutRejectOpen: boolean;
  takeoutRejectReason: string;
}

export default function ApprovalAdminDialogs({
  handleRejectSelected,
  handleRejectTakeouts,
  modal,
  rejectOpen,
  rejectReason,
  selectedRespondentIds,
  selectedTakeoutRows,
  setModal,
  setRejectOpen,
  setRejectReason,
  setTakeoutRejectOpen,
  setTakeoutRejectReason,
  takeoutRejectOpen,
  takeoutRejectReason,
}: ApprovalAdminDialogsProps) {
  return (
    <>
      {modal.type !== "none" ? (
        <div className={styles.modalOverlay} onClick={() => setModal({ type: "none" })}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="approval-detail-modal-title" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 id="approval-detail-modal-title" className={styles.modalTitle}>Detail Responden</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal detail responden">
                x
              </button>
            </header>
            <div className={styles.modalBody}>
              <p><strong>Nama:</strong> {modal.row.RespondentName || "-"}</p>
              <p><strong>Email:</strong> {modal.row.RespondentEmail || "-"}</p>
              <p><strong>Department:</strong> {modal.row.DepartmentName || "-"}</p>
              <p><strong>Aplikasi:</strong> {modal.row.ApplicationName || "-"}</p>
              <p><strong>Submitted:</strong> {formatDateTime(modal.row.SubmittedAt)}</p>
              <p><strong>Duplicate Count:</strong> {modal.row.DuplicateCount || 1}</p>
            </div>
            <footer className={styles.modalActions}>
              <button type="button" className={styles.btnSecondary} onClick={() => setModal({ type: "none" })}>
                Close
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {rejectOpen ? (
        <div className={styles.modalOverlay} onClick={() => setRejectOpen(false)}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="approval-reject-modal-title" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 id="approval-reject-modal-title" className={styles.modalTitle}>Reject Selected Response</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setRejectOpen(false)} aria-label="Tutup modal reject response">
                x
              </button>
            </header>
            <div className={styles.modalBody}>
              <p className={styles.meta}>Jumlah response terpilih: {selectedRespondentIds.length}</p>
              <textarea
                className={styles.textarea}
                id="reject-response-reason"
                name="reject-response-reason"
                rows={4}
                placeholder="Alasan reject wajib diisi untuk histori"
                aria-label="Alasan reject response"
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </div>
            <footer className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setRejectOpen(false)}>
                Batal
              </button>
              <button type="button" className={styles.btnDanger} onClick={() => void handleRejectSelected()}>
                Reject Response
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      {takeoutRejectOpen ? (
        <div className={styles.modalOverlay} onClick={() => setTakeoutRejectOpen(false)}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="approval-takeout-reject-modal-title" onClick={(event) => event.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 id="approval-takeout-reject-modal-title" className={styles.modalTitle}>Reject Proposed Takeout</h2>
              <button type="button" className={styles.closeBtn} onClick={() => setTakeoutRejectOpen(false)} aria-label="Tutup modal reject takeout">
                x
              </button>
            </header>
            <div className={styles.modalBody}>
              <p className={styles.meta}>Jumlah usulan takeout terpilih: {selectedTakeoutRows.length}</p>
              <textarea
                className={styles.textarea}
                id="reject-takeout-reason"
                name="reject-takeout-reason"
                rows={4}
                placeholder="Alasan reject takeout wajib diisi"
                aria-label="Alasan reject takeout"
                value={takeoutRejectReason}
                onChange={(event) => setTakeoutRejectReason(event.target.value)}
              />
            </div>
            <footer className={styles.modalActions}>
              <button type="button" className={styles.btnGhost} onClick={() => setTakeoutRejectOpen(false)}>
                Batal
              </button>
              <button type="button" className={styles.btnDanger} onClick={() => void handleRejectTakeouts()}>
                Reject Takeout
              </button>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
