"use client";

import styles from "./operations.module.css";
import { formatOperationDate, type ScheduledOperation } from "./operations-utils";

interface CancelScheduledOperationDialogProps {
  cancelTarget: ScheduledOperation | null;
  onCancel: () => void;
  onConfirm: (operationId: number) => void;
}

export default function CancelScheduledOperationDialog({
  cancelTarget,
  onCancel,
  onConfirm,
}: CancelScheduledOperationDialogProps) {
  if (!cancelTarget) {
    return null;
  }

  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>Cancel Scheduled Operation</h3>
        </div>
        <div className={styles.modalBody}>
          <p className={styles.modalText}>
            Yakin ingin membatalkan {cancelTarget.operationType || "operation"} yang dijadwalkan pada{" "}
            {formatOperationDate(cancelTarget.scheduledDate, cancelTarget.scheduledTime)}?
          </p>
        </div>
        <div className={styles.modalActions}>
          <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={onCancel}>
            Batal
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => onConfirm(cancelTarget.operationId)}>
            Ya, Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
