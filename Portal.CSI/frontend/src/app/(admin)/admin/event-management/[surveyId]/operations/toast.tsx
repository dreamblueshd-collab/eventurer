"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./operations.module.css";

export interface ToastItem {
  id: number;
  type: "success" | "error";
  message: string;
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: number) => void }) {
  return (
    <div className={styles.toastContainer}>
      {toasts.map((t) => (
        <ToastMessage key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastMessage({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
      <span className={styles.toastIcon}>{toast.type === "success" ? "✓" : "✕"}</span>
      <span className={styles.toastMessage}>{toast.message}</span>
      <button className={styles.toastClose} onClick={() => onRemove(toast.id)} type="button">×</button>
    </div>
  );
}
