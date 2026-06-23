"use client";

import { resetPassword } from "@/lib/auth";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import styles from "./reset-password.module.css";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = String(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ error: "", message: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!token) {
      setFeedback({ error: "Token reset password tidak ditemukan", message: "" });
      return;
    }

    if (password.trim().length < 8) {
      setFeedback({ error: "Password baru minimal 8 karakter", message: "" });
      return;
    }

    if (password !== confirmPassword) {
      setFeedback({ error: "Konfirmasi password tidak sama", message: "" });
      return;
    }

    setLoading(true);
    setFeedback({ error: "", message: "" });
    const result = await resetPassword(token, password);
    setLoading(false);

    if (!result.success) {
      setFeedback({ error: result.message || "Gagal mereset password", message: "" });
      return;
    }

    setFeedback({ error: "", message: result.message || "Password berhasil direset" });
    window.setTimeout(() => {
      router.replace("/login");
    }, 1200);
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Reset Password</h1>
        <p className={styles.subtitle}>Buat password baru untuk akun user local CSI Web App.</p>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.label} htmlFor="password">
            Password Baru
          </label>
          <div className={styles.passwordWrap}>
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className={styles.input}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimal 8 karakter"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          <label className={styles.label} htmlFor="confirmPassword">
            Konfirmasi Password
          </label>
          <div className={styles.passwordWrap}>
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              className={styles.input}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Ulangi password baru"
            />
            <button
              type="button"
              className={styles.passwordToggle}
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              aria-label={showConfirmPassword ? "Sembunyikan password" : "Tampilkan password"}
              aria-pressed={showConfirmPassword}
              tabIndex={-1}
            >
              {showConfirmPassword ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>

          {feedback.error ? <div className={styles.errorBox}>{feedback.error}</div> : null}
          {feedback.message ? <div className={styles.successBox}>{feedback.message}</div> : null}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? "Memproses..." : "Reset Password"}
          </button>
        </form>

        <Link className={styles.backLink} href="/login">
          Kembali ke Login
        </Link>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={styles.card}>Memuat reset password...</div>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
