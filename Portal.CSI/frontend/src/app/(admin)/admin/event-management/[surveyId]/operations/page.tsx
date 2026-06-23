"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { fetchSurveyById, generateEventLink } from "@/lib/surveys";
import { generateQRCode, getScheduledOperations, cancelScheduledOperation, retryScheduledOperation } from "@/lib/operations";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import Image from "next/image";
import styles from "./operations.module.css";
import { useToast, ToastContainer } from "./toast";
import { toDownloadFileStem, formatOperationDate, getStatusBadge, type ScheduledOperation } from "./operations-utils";
import ConfirmDialog from "./confirm-dialog";
import EmailBlastModal from "./email-blast-modal";

type ShareTab = "invite" | "qr" | "embed";

export default function OperationsPage() {
  const params = useParams();
  const surveyId = params.surveyId as string;
  const currentUser = getCurrentUser();
  const currentRole = currentUser?.role;

  // SuperAdmin tidak boleh mengakses halaman ini
  useEffect(() => {
    if (currentRole === "SuperAdmin") {
      window.location.href = "/admin/event-management";
    }
  }, [currentRole]);

  const [loading, setLoading] = useState(true);
  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyLink, setSurveyLink] = useState("");
  const [shortenedLink, setShortenedLink] = useState("");
  const [linkLoading, setLinkLoading] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [qrLoading, setQrLoading] = useState(false);
  const [shareTab, setShareTab] = useState<ShareTab>("invite");
  const [shortenUrl, setShortenUrl] = useState(false);
  const [openInfoPanel, setOpenInfoPanel] = useState<string | null>(null);
  const [showEmailBlast, setShowEmailBlast] = useState(false);
  const [scheduledOps, setScheduledOps] = useState<ScheduledOperation[]>([]);
  const [cancelTarget, setCancelTarget] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const { toasts, showToast, removeToast } = useToast();

  const handleCloseEmailBlast = useCallback(() => setShowEmailBlast(false), []);

  const loadScheduledOperations = useCallback(async () => {
    const res = await getScheduledOperations(surveyId);
    if (res.success && res.operations) setScheduledOps(res.operations);
  }, [surveyId]);

  useEffect(() => {
    const load = async () => {
      const [surveyResult, opsResult] = await Promise.all([
        fetchSurveyById(surveyId),
        getScheduledOperations(surveyId),
      ]);

      setLoading(false);

      if (!surveyResult.success || !surveyResult.survey) {
        showToast("error", surveyResult.message || "Gagal memuat event");
        return;
      }
      setSurveyTitle(surveyResult.survey.Title || "");
      setSurveyLink(surveyResult.survey.SurveyLink || "");
      setShortenedLink(surveyResult.survey.ShortenedLink || "");
      setQrCodeUrl(surveyResult.survey.QRCodeDataUrl || "");

      if (opsResult.success && opsResult.operations) {
        setScheduledOps(opsResult.operations);
      }
    };

    void load();
  }, [surveyId, showToast]);

  const handleCancelOperation = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    const res = await cancelScheduledOperation(surveyId, cancelTarget);
    setCancelling(false);
    setCancelTarget(null);
    if (!res.success) { showToast("error", res.message || "Gagal cancel operation"); return; }
    showToast("success", "Operation berhasil di-cancel");
    void loadScheduledOperations();
  };

  const handleRetryOperation = async (operationId: number) => {
    const res = await retryScheduledOperation(operationId);
    if (!res.success) { showToast("error", res.message || "Gagal retry operation"); return; }
    showToast("success", res.message || "Operation berhasil di-retry");
    void loadScheduledOperations();
  };

  const handleGenerateQR = async () => {
    setQrLoading(true);
    const result = await generateQRCode(surveyId);
    setQrLoading(false);
    if (!result.success) {
      showToast("error", result.message || "Gagal generate QR code");
      return;
    }
    setQrCodeUrl(result.qrCodeUrl || "");
    showToast("success", "QR Code berhasil dibuat");
  };

  const handleGenerateLink = async (useShorten: boolean) => {
    setLinkLoading(true);
    const result = await generateEventLink(surveyId, useShorten);
    setLinkLoading(false);
    if (!result.success) {
      showToast("error", result.message || "Gagal generate link survey");
      return;
    }

    setSurveyLink(result.surveyLink || "");
    setShortenedLink(result.shortenedLink || "");
    showToast("success", useShorten ? "Short link berhasil dibuat" : "Link survey berhasil dibuat");
  };

  const copyToClipboard = async (value: string, label: string) => {
    if (!value) return;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = value;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        document.body.removeChild(textArea);
      }
      showToast("success", `${label} berhasil disalin`);
    } catch {
      showToast("error", `Gagal menyalin ${label.toLowerCase()}`);
    }
  };

  const handleDownloadQR = () => {
    if (!qrCodeUrl) return;
    const link = document.createElement("a");
    link.href = qrCodeUrl;
    link.download = `qr-${toDownloadFileStem(surveyTitle, "survey")}.png`;
    link.click();
  };

  const toggleInfoPanel = (panelId: string) => {
    setOpenInfoPanel((prev) => (prev === panelId ? null : panelId));
  };

  if (loading) return <div className={styles.wrapper}>Memuat...</div>;

  const effectiveLink = shortenUrl && shortenedLink ? shortenedLink : surveyLink;
  const embedCode = effectiveLink
    ? `<iframe width="640" height="480" src="${effectiveLink}" frameborder="0" marginwidth="0" marginheight="0" style="border:none; max-width:100%; max-height:100vh" allowfullscreen webkitallowfullscreen mozallowfullscreen msallowfullscreen> </iframe>`
    : "";

  return (
    <div className={styles.wrapper}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>⚙️ Operational Controls</h1>
          <div className={styles.subtitle}>{surveyTitle}</div>
        </div>
        <Link href="/admin/event-management" prefetch={false} className={`${styles.btn} ${styles.btnSecondary} ${styles.headerBackButton}`}>
          ← Kembali ke Event Management
        </Link>
      </div>

      <section className={styles.panelFull}>
        <div className={styles.panelHeading}>
          <h2 className={styles.panelTitle}>📤 Share Survey</h2>
          <button
            type="button"
            className={styles.infoButton}
            aria-label="Info Share Survey"
            onClick={() => toggleInfoPanel("share")}
          >
            i
          </button>
        </div>

        {openInfoPanel === "share" ? (
          <div className={styles.infoText}>
            Gunakan fitur ini untuk membuat link, QR, atau embed survey. Untuk email blast/reminder, gunakan menu Email Blast.
          </div>
        ) : null}

        <div className={styles.shareTabs}>
          <button type="button" className={`${styles.tabButton} ${shareTab === "invite" ? styles.tabButtonActive : ""}`} onClick={() => setShareTab("invite")}>🔗 Invite</button>
          <button type="button" className={`${styles.tabButton} ${shareTab === "qr" ? styles.tabButtonActive : ""}`} onClick={() => setShareTab("qr")}>📱 QR Code</button>
          <button type="button" className={`${styles.tabButton} ${shareTab === "embed" ? styles.tabButtonActive : ""}`} onClick={() => setShareTab("embed")}>🖥️ Embed</button>
        </div>

        <div className={styles.shareBody}>
          {shareTab === "invite" ? (
            <>
              <div className={styles.linkRow}>
                <input
                  id="survey-link"
                  aria-label="Survey link"
                  className={styles.input}
                  readOnly
                  placeholder="Link survey belum dibuat"
                  value={effectiveLink}
                />
                <button
                  className={`${styles.btn} ${styles.btnPrimary} ${styles.linkActionButton}`}
                  onClick={() => void copyToClipboard(effectiveLink, "Link survey")}
                  type="button"
                  disabled={!effectiveLink}
                >
                  Copy Link
                </button>
              </div>

              <label className={styles.checkboxRow}>
                <input id="shorten-url" type="checkbox" checked={shortenUrl} onChange={(e) => setShortenUrl(e.target.checked)} />
                Shorten URL
              </label>

              <div className={styles.linkActions}>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={() => void handleGenerateLink(shortenUrl)} disabled={linkLoading} type="button">
                  {linkLoading ? "Memproses..." : "🔄 Generate Link"}
                </button>
              </div>
            </>
          ) : null}

          {shareTab === "qr" ? (
            <div className={styles.qrSection}>
              {qrCodeUrl ? (
                <Image src={qrCodeUrl} alt="QR Survey" width={220} height={220} className={styles.qrImage} unoptimized />
              ) : (
                <div className={styles.qrPlaceholder}>QR Code belum tersedia</div>
              )}
              <div className={styles.qrActions}>
                <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={handleGenerateQR} disabled={qrLoading} type="button">
                  {qrLoading ? "Memproses..." : "🔄 Generate QR"}
                </button>
                <button className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleDownloadQR} disabled={!qrCodeUrl} type="button">
                  📥 Download QR
                </button>
              </div>
            </div>
          ) : null}

          {shareTab === "embed" ? (
            <div className={styles.linkSection}>
              <textarea
                aria-label="Embed code"
                className={styles.textarea}
                rows={4}
                readOnly
                value={embedCode}
                placeholder="Embed code belum tersedia"
              />
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => void copyToClipboard(embedCode, "Embed code")}
                disabled={!embedCode}
                type="button"
              >
                Copy Embed
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className={styles.panelFull}>
        <div className={styles.panelHeading}>
          <div>
            <h2 className={styles.panelTitle}>Distribusi Email</h2>
            <p className={styles.panelDesc}>Kirim email blast dan reminder terkait event ini langsung dari sini.</p>
          </div>
          <span className={styles.panelBadge}>Survey Context</span>
        </div>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => setShowEmailBlast(true)}>
          📧 Email Blast
        </button>
      </section>

      {showEmailBlast ? <EmailBlastModal surveyId={surveyId} qrCodeUrl={qrCodeUrl} onClose={handleCloseEmailBlast} onScheduleCreated={loadScheduledOperations} /> : null}

      {/* Scheduled Operations Table */}
      <section className={styles.panelFull}>
        <div className={styles.panelHeading}>
          <div>
            <h2 className={styles.panelTitle}>📋 Scheduled Operations</h2>
            <p className={styles.panelDesc}>Daftar jadwal blast dan reminder yang aktif</p>
          </div>
          <span className={styles.panelBadge}>{scheduledOps.length} jadwal</span>
        </div>
        {scheduledOps.length === 0 ? (
          <div className={styles.empty}>Belum ada jadwal operasi. Gunakan modal Email Blast untuk membuat jadwal.</div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Tipe</th>
                  <th scope="col">Frekuensi</th>
                  <th scope="col">Jadwal</th>
                  <th scope="col">Status</th>
                  <th scope="col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {scheduledOps.map((op) => (
                  <tr key={op.operationId}>
                    <td>{op.operationType === "Blast" ? "📤 Blast" : "🔔 Reminder"}</td>
                    <td>{op.frequency}</td>
                    <td>{formatOperationDate(op.scheduledDate, op.scheduledTime)}</td>
                    <td><span className={`${styles.badge} ${getStatusBadge(op.status)}`}>{op.status}</span></td>
                    <td>
                      {op.status.toLowerCase() === "pending" && (
                        <button type="button" className={styles.actionBtn} onClick={() => setCancelTarget(op.operationId)}>Cancel</button>
                      )}
                      {op.status.toLowerCase() === "failed" && (
                        <button type="button" className={`${styles.actionBtn} ${styles.retryBtn}`} onClick={() => void handleRetryOperation(op.operationId)}>Retry</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={cancelTarget !== null}
        title="Cancel Scheduled Operation"
        message="Apakah Anda yakin ingin membatalkan operasi ini?"
        confirmLabel="Ya, Cancel"
        variant="danger"
        loading={cancelling}
        onConfirm={() => void handleCancelOperation()}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
