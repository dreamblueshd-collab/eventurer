"use client";

import { useCallback, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast, ToastContainer } from "@/components/common/toast";
import {
  importParticipants,
  uploadParticipantPhotos,
  downloadParticipantTemplate,
} from "@/lib/doorprize-api";
import type { ImportResult } from "@/types/doorprize";
import type { PhotoUploadResult } from "@/lib/doorprize-api";
import baseStyles from "../../../../page-mockup.module.css";
import s from "./import.module.css";

const ACCEPTED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
];
const ACCEPTED_EXT = ".xlsx,.xls";

export default function ImportParticipantsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toasts, showToast, removeToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Upload state
  const [uploading, setUploading] = useState(false);

  // Result state
  const [result, setResult] = useState<ImportResult | null>(null);

  // Template download state
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // ─── ZIP Photo Upload state ───
  const zipInputRef = useRef<HTMLInputElement>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [zipDragActive, setZipDragActive] = useState(false);
  const [zipUploading, setZipUploading] = useState(false);
  const [zipResult, setZipResult] = useState<PhotoUploadResult | null>(null);

  // ─── File selection ───
  function isValidFile(file: File): boolean {
    return (
      ACCEPTED_TYPES.includes(file.type) ||
      file.name.endsWith(".xlsx") ||
      file.name.endsWith(".xls")
    );
  }

  function handleFileSelect(file: File) {
    if (!isValidFile(file)) {
      showToast("error", "Format file tidak valid. Gunakan file .xlsx atau .xls");
      return;
    }
    setSelectedFile(file);
    setResult(null);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDropZoneClick() {
    fileInputRef.current?.click();
  }

  // ─── Drag & Drop ───
  function handleDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleFileSelect(file);
  }

  // ─── Upload / Import ───
  const handleImport = useCallback(async () => {
    if (!selectedFile || uploading) return;

    setUploading(true);
    setResult(null);

    const res = await importParticipants(eventId, selectedFile);

    if (!res.success) {
      showToast("error", res.message);
    } else {
      setResult(res.data);
      showToast(
        "success",
        `Import selesai: ${res.data.imported} berhasil, ${res.data.skipped} dilewati`,
      );
    }

    setUploading(false);
  }, [eventId, selectedFile, uploading, showToast]);

  // ─── Download template ───
  const handleDownloadTemplate = useCallback(async () => {
    if (downloadingTemplate) return;

    setDownloadingTemplate(true);

    const res = await downloadParticipantTemplate(eventId);

    if (!res.success) {
      showToast("error", res.message || "Gagal download template");
    } else if (res.blob) {
      const url = URL.createObjectURL(res.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename || "template-peserta.xlsx";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("success", "Template berhasil didownload");
    }

    setDownloadingTemplate(false);
  }, [eventId, downloadingTemplate, showToast]);

  // ─── Clear file ───
  function handleClearFile() {
    setSelectedFile(null);
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── ZIP Photo Upload handlers ───
  function isValidZipFile(file: File): boolean {
    return (
      file.type === "application/zip" ||
      file.type === "application/x-zip-compressed" ||
      file.name.endsWith(".zip")
    );
  }

  function handleZipFileSelect(file: File) {
    if (!isValidZipFile(file)) {
      showToast("error", "Format file tidak valid. Gunakan file .zip");
      return;
    }
    setZipFile(file);
    setZipResult(null);
  }

  function handleZipInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleZipFileSelect(file);
  }

  function handleZipDropZoneClick() {
    zipInputRef.current?.click();
  }

  function handleZipDragEnter(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setZipDragActive(true);
  }

  function handleZipDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setZipDragActive(false);
  }

  function handleZipDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function handleZipDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setZipDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file) handleZipFileSelect(file);
  }

  const handleZipUpload = useCallback(async () => {
    if (!zipFile || zipUploading) return;

    setZipUploading(true);
    setZipResult(null);

    const res = await uploadParticipantPhotos(eventId, zipFile);

    if (!res.success) {
      showToast("error", res.message);
    } else {
      setZipResult(res.data);
      showToast(
        "success",
        `Upload foto selesai: ${res.data.matched} cocok, ${res.data.unmatched.length} tidak cocok`,
      );
    }

    setZipUploading(false);
  }, [eventId, zipFile, zipUploading, showToast]);

  function handleClearZipFile() {
    setZipFile(null);
    setZipResult(null);
    if (zipInputRef.current) zipInputRef.current.value = "";
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Page Header ── */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Import Peserta</h1>
          <p className={baseStyles.subtitle}>
            Import daftar peserta dari file Excel (.xlsx / .xls)
          </p>
        </div>
        <div className={baseStyles.toolbar}>
          <Link
            href={`/admin/doorprize/${eventId}/participants`}
            prefetch={false}
            className={s.btnBack}
          >
            ← Kembali
          </Link>
        </div>
      </div>

      {/* ── Upload Card ── */}
      <div className={s.sectionCard}>
        <div className={s.sectionHeader}>
          <div className={s.sectionIcon}>📥</div>
          <div className={s.sectionTitleWrap}>
            <div className={s.sectionTitle}>Upload File</div>
            <div className={s.sectionSubtitle}>
              Pilih file Excel berisi data peserta untuk diimport
            </div>
          </div>
          <div className={s.sectionHeaderRight}>
            <button
              type="button"
              className={s.btnTemplate}
              onClick={handleDownloadTemplate}
              disabled={downloadingTemplate}
            >
              {downloadingTemplate ? "⏳ Downloading..." : "📄 Download Template"}
            </button>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          className={`${s.dropZone} ${dragActive ? s.dropZoneActive : ""} ${selectedFile ? s.dropZoneHasFile : ""}`}
          onClick={handleDropZoneClick}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleDropZoneClick();
          }}
          aria-label="Area upload file Excel"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_EXT}
            onChange={handleInputChange}
            className={s.fileInputHidden}
            tabIndex={-1}
            aria-hidden="true"
          />

          {!selectedFile ? (
            <div className={s.dropContent}>
              <div className={s.dropIcon}>📁</div>
              <p className={s.dropTitle}>
                Drag &amp; drop file Excel di sini
              </p>
              <p className={s.dropSubtitle}>
                atau klik untuk memilih file (.xlsx, .xls)
              </p>
            </div>
          ) : (
            <div className={s.dropContent}>
              <div className={s.dropIcon}>✅</div>
              <p className={s.dropTitle}>{selectedFile.name}</p>
              <p className={s.dropSubtitle}>
                {(selectedFile.size / 1024).toFixed(1)} KB — Siap diimport
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className={s.actionRow}>
          {selectedFile && (
            <button
              type="button"
              className={s.btnClear}
              onClick={handleClearFile}
              disabled={uploading}
            >
              ✕ Hapus File
            </button>
          )}
          <button
            type="button"
            className={s.btnImport}
            onClick={handleImport}
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <span className={s.spinnerSm} />
                Mengimport...
              </>
            ) : (
              "📤 Import Peserta"
            )}
          </button>
        </div>
      </div>

      {/* ── Import Results ── */}
      {result && (
        <div className={s.sectionCard} style={{ animationDelay: "0.1s" }}>
          <div className={s.sectionHeader}>
            <div className={s.sectionIcon}>📊</div>
            <div className={s.sectionTitleWrap}>
              <div className={s.sectionTitle}>Hasil Import</div>
              <div className={s.sectionSubtitle}>
                Ringkasan proses import data peserta
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className={s.statsRow}>
            <div className={s.statCard}>
              <div className={s.statValue}>{result.totalRows}</div>
              <div className={s.statLabel}>Total Baris</div>
            </div>
            <div className={`${s.statCard} ${s.statSuccess}`}>
              <div className={s.statValue}>{result.imported}</div>
              <div className={s.statLabel}>Berhasil Import</div>
            </div>
            <div className={`${s.statCard} ${s.statSkipped}`}>
              <div className={s.statValue}>{result.skipped}</div>
              <div className={s.statLabel}>Dilewati</div>
            </div>
            <div className={`${s.statCard} ${s.statError}`}>
              <div className={s.statValue}>{result.errors.length}</div>
              <div className={s.statLabel}>Error</div>
            </div>
          </div>

          {/* Errors table */}
          {result.errors.length > 0 && (
            <div className={s.errorsSection}>
              <h3 className={s.errorsTitle}>⚠️ Detail Error</h3>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>Baris</th>
                      <th>Pesan Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className={s.cellRow}>Baris {err.row}</td>
                        <td>{err.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Upload Foto (Opsional) ── */}
      <div className={s.sectionCard} style={{ animationDelay: "0.2s" }}>
        <div className={s.sectionHeader}>
          <div className={s.sectionIcon}>📷</div>
          <div className={s.sectionTitleWrap}>
            <div className={s.sectionTitle}>Upload Foto (Opsional)</div>
            <div className={s.sectionSubtitle}>
              Upload file ZIP berisi foto peserta
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px" }}>
          <p style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, color: "#166534" }}>📋 Format yang diharapkan:</p>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "12px", color: "#15803d", lineHeight: 1.8 }}>
            <li>Buat folder berisi foto peserta</li>
            <li><strong>Nama file = Kode Karyawan</strong> (contoh: <code>EMP001.jpg</code>, <code>EMP002.png</code>)</li>
            <li>Format foto: JPG, PNG, atau WebP</li>
            <li>Zip semua foto menjadi 1 file .zip (maks 50MB)</li>
            <li>Folder dalam ZIP boleh nested — sistem hanya melihat nama file</li>
          </ul>
        </div>

        {/* ZIP Drop Zone */}
        <div
          className={`${s.dropZone} ${zipDragActive ? s.dropZoneActive : ""} ${zipFile ? s.dropZoneHasFile : ""}`}
          onClick={handleZipDropZoneClick}
          onDragEnter={handleZipDragEnter}
          onDragLeave={handleZipDragLeave}
          onDragOver={handleZipDragOver}
          onDrop={handleZipDrop}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleZipDropZoneClick();
          }}
          aria-label="Area upload file ZIP foto peserta"
        >
          <input
            ref={zipInputRef}
            type="file"
            accept=".zip"
            onChange={handleZipInputChange}
            className={s.fileInputHidden}
            tabIndex={-1}
            aria-hidden="true"
          />

          {!zipFile ? (
            <div className={s.dropContent}>
              <div className={s.dropIcon}>🖼️</div>
              <p className={s.dropTitle}>
                Drag &amp; drop file ZIP di sini
              </p>
              <p className={s.dropSubtitle}>
                atau klik untuk memilih file (.zip, maks 50MB)
              </p>
            </div>
          ) : (
            <div className={s.dropContent}>
              <div className={s.dropIcon}>✅</div>
              <p className={s.dropTitle}>{zipFile.name}</p>
              <p className={s.dropSubtitle}>
                {(zipFile.size / (1024 * 1024)).toFixed(2)} MB — Siap diupload
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className={s.actionRow}>
          {zipFile && (
            <button
              type="button"
              className={s.btnClear}
              onClick={handleClearZipFile}
              disabled={zipUploading}
            >
              ✕ Hapus File
            </button>
          )}
          <button
            type="button"
            className={s.btnImport}
            onClick={handleZipUpload}
            disabled={!zipFile || zipUploading}
          >
            {zipUploading ? (
              <>
                <span className={s.spinnerSm} />
                Mengupload...
              </>
            ) : (
              "📤 Upload Foto"
            )}
          </button>
        </div>
      </div>

      {/* ── Photo Upload Results ── */}
      {zipResult && (
        <div className={s.sectionCard} style={{ animationDelay: "0.3s" }}>
          <div className={s.sectionHeader}>
            <div className={s.sectionIcon}>📊</div>
            <div className={s.sectionTitleWrap}>
              <div className={s.sectionTitle}>Hasil Upload Foto</div>
              <div className={s.sectionSubtitle}>
                Ringkasan proses pencocokan foto dengan data peserta
              </div>
            </div>
          </div>

          {/* Summary stats */}
          <div className={s.statsRow}>
            <div className={s.statCard}>
              <div className={s.statValue}>{zipResult.total}</div>
              <div className={s.statLabel}>Total Foto</div>
            </div>
            <div className={`${s.statCard} ${s.statSuccess}`}>
              <div className={s.statValue}>{zipResult.matched}</div>
              <div className={s.statLabel}>Cocok</div>
            </div>
            <div className={`${s.statCard} ${s.statSkipped}`}>
              <div className={s.statValue}>{zipResult.unmatched.length}</div>
              <div className={s.statLabel}>Tidak Cocok</div>
            </div>
            <div className={`${s.statCard} ${s.statError}`}>
              <div className={s.statValue}>{zipResult.errors.length}</div>
              <div className={s.statLabel}>Error</div>
            </div>
          </div>

          {/* Unmatched list */}
          {zipResult.unmatched.length > 0 && (
            <div className={s.errorsSection}>
              <h3 className={s.errorsTitle}>⚠️ Foto Tidak Cocok (Kode Karyawan Tidak Ditemukan)</h3>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Nama File</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zipResult.unmatched.map((name, idx) => (
                      <tr key={idx}>
                        <td className={s.cellRow}>{idx + 1}</td>
                        <td>{name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Errors list */}
          {zipResult.errors.length > 0 && (
            <div className={s.errorsSection}>
              <h3 className={s.errorsTitle}>❌ Error</h3>
              <div className={s.tableWrap}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>No</th>
                      <th>Pesan Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zipResult.errors.map((err, idx) => (
                      <tr key={idx}>
                        <td className={s.cellRow}>{idx + 1}</td>
                        <td>{err}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
