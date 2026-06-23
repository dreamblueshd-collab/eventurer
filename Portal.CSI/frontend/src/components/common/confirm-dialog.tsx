"use client";

import styles from "./confirm-dialog.module.css";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isLoading = false,
  variant = "primary",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.dialogOverlay} role="presentation" onClick={onCancel}>
      <div
        className={styles.dialogCard}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.dialogHeader}>
          <h2 className={styles.dialogTitle}>{title}</h2>
        </div>
        <div className={styles.dialogBody}>{message}</div>
        <div className={styles.dialogFooter}>
          <button className={`${styles.button} ${styles.cancelButton}`} onClick={onCancel} disabled={isLoading} type="button">
            {cancelLabel}
          </button>
          <button
            className={`${styles.button} ${variant === "danger" ? styles.confirmDanger : styles.confirmPrimary}`}
            onClick={onConfirm}
            disabled={isLoading}
            type="button"
          >
            {isLoading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
