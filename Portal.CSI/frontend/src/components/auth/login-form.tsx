"use client";

import {
  consumePendingNext,
  login,
  requestPasswordReset,
} from "@/lib/auth";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./login-form.module.css";

interface LoginFormProps {
  nextTarget: string;
}

const loginSubtitles = [
  "Masuk ke sistem manajemen event",
  "Kelola event, respon, dan report dalam satu portal",
];

export default function LoginForm({ nextTarget }: LoginFormProps) {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({ username: "", password: "", general: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetIdentifier, setResetIdentifier] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetFeedback, setResetFeedback] = useState({ error: "", message: "" });
  const [typedSubtitle, setTypedSubtitle] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const hasResetSuccess = Boolean(resetFeedback.message);

  useEffect(() => {
    let currentIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timer: ReturnType<typeof setTimeout>;

    const tick = () => {
      const fullText = loginSubtitles[currentIndex];

      if (!isDeleting) {
        charIndex += 1;
        setTypedSubtitle(fullText.slice(0, charIndex));

        if (charIndex >= fullText.length) {
          // Pause before deleting
          timer = setTimeout(() => {
            isDeleting = true;
            tick();
          }, 2000);
          return;
        }
        timer = setTimeout(tick, 35);
      } else {
        charIndex -= 1;
        setTypedSubtitle(fullText.slice(0, charIndex));

        if (charIndex <= 0) {
          isDeleting = false;
          currentIndex = (currentIndex + 1) % loginSubtitles.length;
          timer = setTimeout(tick, 400);
          return;
        }
        timer = setTimeout(tick, 20);
      }
    };

    timer = setTimeout(tick, 500);

    return () => clearTimeout(timer);
  }, []);

  const onSubmit: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();
    const nextErrors = { username: "", password: "", general: "" };

    if (!form.username.trim()) {
      nextErrors.username = "Username harus diisi";
    }
    if (!form.password) {
      nextErrors.password = "Password harus diisi";
    }

    setErrors(nextErrors);
    if (nextErrors.username || nextErrors.password) {
      return;
    }

    setLoading(true);

    const result = await login(form.username, form.password);
    setLoading(false);

    if (!result.success) {
      // Parse error message to determine field-specific error
      const errorMsg = result.message || "Username atau password salah";
      
      // Check if it's a lockout error
      if (errorMsg.toLowerCase().includes('too many') || errorMsg.toLowerCase().includes('try again in')) {
        setErrors({
          username: "",
          password: "",
          general: errorMsg,
        });
      }
      // Check if it's specifically about username
      else if (errorMsg.toLowerCase().includes('username') && !errorMsg.toLowerCase().includes('password')) {
        setErrors({
          username: errorMsg,
          password: "",
          general: "",
        });
      }
      // Check if it's specifically about password
      else if (errorMsg.toLowerCase().includes('password') && !errorMsg.toLowerCase().includes('username')) {
        setErrors({
          username: "",
          password: errorMsg,
          general: "",
        });
      }
      // Generic error - show on password field (more common failure point)
      else {
        setErrors({
          username: "",
          password: errorMsg,
          general: "",
        });
      }
      return;
    }

    // Decide where to go after a successful login.
    //
    // 1. If the `next` query param points to a real admin path (it has
    //    already been allow-list validated by /login/page.tsx), use it.
    // 2. Otherwise fall back to the sessionStorage stash that
    //    redirectToLogin() populated right before navigation. This is
    //    our safety net in case the `next` param was lost somewhere.
    // 3. Final fallback is /admin/dashboard.
    const pending = consumePendingNext();
    const finalTarget =
      nextTarget && nextTarget !== "/admin/dashboard"
        ? nextTarget
        : pending && pending !== "/admin/dashboard"
          ? pending
          : nextTarget || "/admin/dashboard";

    // Use a full-page navigation (not router.replace) so admin-shell
    // remounts and re-validates the freshly-issued session cookie.
    // A soft navigation would not re-run the useEffect that flips
    // loading=false / user=<populated>.
    if (typeof window !== "undefined") {
      window.location.href = finalTarget;
    } else {
      router.replace(finalTarget);
    }
  };

  const onSubmitForgotPassword: React.FormEventHandler<HTMLFormElement> = async (event) => {
    event.preventDefault();

    if (!resetIdentifier.trim()) {
      setResetFeedback({
        error: "Email wajib diisi",
        message: "",
      });
      return;
    }

    setResetLoading(true);
    setResetFeedback({ error: "", message: "" });

    const result = await requestPasswordReset("email", resetIdentifier.trim());
    setResetLoading(false);

    if (!result.success) {
      setResetFeedback({
        error: result.message || "Gagal memproses forgot password",
        message: "",
      });
      return;
    }

    setResetFeedback({
      error: "",
      message: result.message || "Permintaan reset password berhasil diproses",
    });
  };

  return (
    <div className={styles.page}>
      <div className={styles.backdropGlow} />
      <div className={styles.card}>
        <div className={styles.header}>
          <Image className={styles.logo} src="/assets/img/logo.png" alt="IT Survey Logo" width={48} height={48} priority />
          <h1 className={styles.title}>Portal Event Management</h1>
          <p className={styles.subtitle}>
            {typedSubtitle}
            <span className={styles.cursor} aria-hidden="true" />
          </p>
        </div>

        <form onSubmit={onSubmit} noValidate>
          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="username">
              Username
            </label>
            <input
              id="username"
              name="username"
              className={`${styles.input} ${errors.username ? styles.inputError : ""}`}
              value={form.username}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, username: event.target.value }))
              }
              placeholder="Masukkan username"
              autoComplete="username"
              required
            />
            <span className={styles.errorMessage}>{errors.username}</span>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.label} htmlFor="password">
              Password
            </label>
            <div className={styles.passwordWrap}>
              <input
                id="password"
                name="password"
                className={`${styles.input} ${errors.password ? styles.inputError : ""}`}
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
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
            <span className={styles.errorMessage}>{errors.password}</span>
          </div>

          {errors.general && (
            <div className={styles.generalError} role="alert">
              <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
              </svg>
              <span>{errors.general}</span>
            </div>
          )}

          <button
            className={styles.button}
            type="submit"
            disabled={loading}
          >
            {loading ? "Memproses..." : "Masuk"}
          </button>

          <button
            className={styles.linkButton}
            type="button"
            onClick={() => {
              setShowForgotPassword(true);
              setResetIdentifier("");
              setResetFeedback({ error: "", message: "" });
            }}
          >
            Forgot Password
          </button>
        </form>

        <div className={styles.footer}>
          <p className={styles.footerText}>
            &copy; 2026 Portal Event Management. All rights reserved.
          </p>
        </div>
      </div>

      {showForgotPassword ? (
        <div className={styles.modalOverlay} role="presentation">
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label="Forgot Password">
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Forgot Password</h2>
              <button className={styles.modalClose} type="button" onClick={() => setShowForgotPassword(false)}>
                x
              </button>
            </div>
            <form className={styles.modalBody} onSubmit={onSubmitForgotPassword}>
              <p className={styles.modalCopy}>
                Reset Password hanya tersedia untuk non-LDAP user.
              </p>

              <div className={styles.methodTabs}>
                <button
                  type="button"
                  id="reset-method-email"
                  className={`${styles.methodTab} ${styles.methodTabActive}`}
                  onClick={() => {
                    setResetIdentifier("");
                    setResetFeedback({ error: "", message: "" });
                  }}
                >
                  By Email
                </button>
                <button
                  type="button"
                  id="reset-method-phone"
                  className={`${styles.methodTab} ${styles.methodTabDisabled}`}
                  disabled
                  title="Reset password via phone dinonaktifkan sementara"
                >
                  By Phone
                </button>
              </div>

              <label className={styles.label} htmlFor="forgot-identifier">
                Email
              </label>
              <input
                id="forgot-identifier"
                name="forgot-identifier"
                className={`${styles.input} ${resetFeedback.error ? styles.inputError : ""}`}
                type="email"
                value={resetIdentifier}
                onChange={(event) => {
                  setResetIdentifier(event.target.value);
                  if (resetFeedback.error || resetFeedback.message) {
                    setResetFeedback({ error: "", message: "" });
                  }
                }}
                placeholder="user@company.co.id"
                autoComplete="email"
                aria-describedby={resetFeedback.error ? "forgot-error" : "forgot-helper"}
              />

              {resetFeedback.error ? <div id="forgot-error" className={styles.inlineError} role="alert">{resetFeedback.error}</div> : null}
              {resetFeedback.message ? <div className={styles.inlineSuccess} role="status">{resetFeedback.message}</div> : null}

              <p id="forgot-helper" className={styles.helperText}>
                Masukkan email terdaftar. Jika cocok untuk user local, link reset akan dikirim ke email tersebut.
              </p>

              <div className={styles.modalActions}>
                <button className={styles.secondaryButton} type="button" onClick={() => setShowForgotPassword(false)}>
                  Close
                </button>
                {!hasResetSuccess ? (
                  <button className={styles.button} type="submit" disabled={resetLoading}>
                    {resetLoading ? "Memproses..." : "Kirim Link Reset"}
                  </button>
                ) : null}
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
