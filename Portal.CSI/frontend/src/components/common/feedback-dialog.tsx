"use client";

import styles from "./feedback-dialog.module.css";

type FeedbackDialogProps = {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
};

export function FeedbackDialog({ open, title, message, onClose }: FeedbackDialogProps) {
  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={onClose}>
      <div
        className={styles.card}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button className={styles.close} type="button" onClick={onClose} aria-label="Close dialog">
            x
          </button>
        </div>
        <div className={styles.body}>
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.footer}>
          <button className={styles.button} type="button" onClick={onClose}>
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
