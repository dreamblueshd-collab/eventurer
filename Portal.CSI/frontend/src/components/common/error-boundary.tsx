"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Global Error Boundary — catches unhandled React render errors.
 * Wrap page-level or section-level components to prevent full-page crashes.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to error monitoring (e.g. Sentry)
    if (process.env.NODE_ENV !== "production") {
      console.error("[ErrorBoundary] Uncaught error:", error, info.componentStack);
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div role="alert" aria-live="assertive" style={styles.container}>
          <div style={styles.card}>
            <div style={styles.icon} aria-hidden="true">⚠️</div>
            <h2 style={styles.title}>Terjadi Kesalahan</h2>
            <p style={styles.message}>
              Halaman ini mengalami error yang tidak terduga. Silakan coba muat ulang halaman.
            </p>
            {process.env.NODE_ENV !== "production" && this.state.error ? (
              <details style={styles.details}>
                <summary style={styles.summary}>Detail error (development only)</summary>
                <pre style={styles.pre}>{this.state.error.message}</pre>
              </details>
            ) : null}
            <button
              type="button"
              style={styles.button}
              onClick={this.handleReset}
            >
              Coba Lagi
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "200px",
    padding: "24px",
  },
  card: {
    background: "#fff",
    border: "1px solid #fecaca",
    borderRadius: "12px",
    padding: "32px 28px",
    maxWidth: "480px",
    width: "100%",
    textAlign: "center",
    boxShadow: "0 4px 16px rgba(220,38,38,0.08)",
  },
  icon: {
    fontSize: "36px",
    marginBottom: "12px",
  },
  title: {
    margin: "0 0 8px",
    fontSize: "18px",
    fontWeight: 700,
    color: "#0f172a",
  },
  message: {
    margin: "0 0 20px",
    fontSize: "14px",
    color: "#64748b",
    lineHeight: 1.6,
  },
  details: {
    textAlign: "left",
    marginBottom: "16px",
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "8px",
    padding: "10px 12px",
  },
  summary: {
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    color: "#dc2626",
  },
  pre: {
    margin: "8px 0 0",
    fontSize: "11px",
    color: "#7f1d1d",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  button: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: "38px",
    padding: "0 20px",
    background: "#1d4ed8",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
  },
};
