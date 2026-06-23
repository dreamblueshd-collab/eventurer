"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <html lang="id">
      <body
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          textAlign: "center",
          fontFamily: "system-ui, sans-serif",
          background: "#f9fafb",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem", color: "#111" }}>
          Aplikasi Mengalami Gangguan
        </h1>
        <p style={{ color: "#555", marginBottom: "1.5rem", maxWidth: 400 }}>
          Terjadi kesalahan kritis. Silakan muat ulang halaman atau hubungi administrator.
        </p>
        {error.digest ? (
          <p style={{ fontSize: "0.75rem", color: "#999", marginBottom: "1rem" }}>
            Error ID: {error.digest}
          </p>
        ) : null}
        <button
          type="button"
          onClick={reset}
          style={{
            padding: "0.5rem 1.5rem",
            background: "#2563eb",
            color: "#fff",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
            fontWeight: 600,
            fontSize: "0.9rem",
          }}
        >
          Muat Ulang
        </button>
      </body>
    </html>
  );
}
