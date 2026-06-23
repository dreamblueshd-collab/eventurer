"use client";

import { useCallback, useEffect, useState } from "react";
import styles from "./toast.module.css";

export interface ToastItem {
  id: number;
  type: "success" | "error";
  message: string;
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((type: "success" | "error", message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, showToast, removeToast };
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className={styles.container}>
      {toasts.map((t) => (
        <ToastMessage key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastMessage({ toast, onRemove }: { toast: ToastItem; onRemove: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4500);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <div className={`${styles.toast} ${toast.type === "success" ? styles.success : styles.error}`}>
      <span className={styles.icon}>{toast.type === "success" ? "✓" : "✕"}</span>
      <span className={styles.message}>{toast.message}</span>
      <button className={styles.close} onClick={() => onRemove(toast.id)} type="button" aria-label="Dismiss">×</button>
    </div>
  );
}
