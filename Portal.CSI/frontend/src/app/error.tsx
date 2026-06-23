"use client";

import { useEffect, type CSSProperties } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log to error reporting service in production
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div style={containerStyle}>
      <h1 style={headingStyle}>
        Terjadi Kesalahan
      </h1>
      <p style={messageStyle}>
        Halaman tidak dapat dimuat. Silakan coba lagi atau hubungi administrator jika masalah berlanjut.
      </p>
      {error.digest ? (
        <p style={digestStyle}>
          Error ID: {error.digest}
        </p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        style={retryButtonStyle}
      >
        Coba Lagi
      </button>
    </div>
  );
}

const containerStyle: CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  textAlign: "center",
};

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: "28px",
  color: "#0f172a",
};

const messageStyle: CSSProperties = {
  margin: "12px 0 0",
  maxWidth: "680px",
  color: "#475569",
  lineHeight: 1.6,
};

const digestStyle: CSSProperties = {
  margin: "10px 0 0",
  color: "#64748b",
  fontSize: "12px",
};

const retryButtonStyle: CSSProperties = {
  marginTop: "16px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  padding: "10px 18px",
  background: "#1d4ed8",
  color: "#ffffff",
  fontWeight: 600,
  cursor: "pointer",
};
