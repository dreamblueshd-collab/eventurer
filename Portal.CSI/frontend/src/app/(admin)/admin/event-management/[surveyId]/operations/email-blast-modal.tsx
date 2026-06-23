"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { sendSurveyBlast, sendSurveyReminder, sendStandaloneEmailBlast } from "@/lib/email-blast";
import { scheduleEventBlast, scheduleEventReminder, type ScheduleFrequency } from "@/lib/surveys";
import { fetchSurveyById } from "@/lib/surveys";
import DatePicker from "@/components/common/date-picker";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useToast, ToastContainer } from "@/components/common/toast";
import EmailTemplateEditor, { getDefaultConfig, type EmailTemplateConfig } from "@/components/common/email-template-editor";
import styles from "./email-blast-modal.module.css";

function parseRecipients(text: string): Array<{ name?: string; email: string }> {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2) return { name: parts[0], email: parts[1] };
      return { email: parts[0] };
    })
    .filter((item) => item.email);
}

type EmailTab = "blast" | "reminder";
type SendMode = "immediate" | "schedule";

interface EmailBlastModalProps {
  surveyId: string;
  qrCodeUrl?: string;
  onClose: () => void;
  onScheduleCreated?: () => void;
}

export default function EmailBlastModal({ surveyId, qrCodeUrl, onClose, onScheduleCreated }: EmailBlastModalProps) {
  const [activeTab, setActiveTab] = useState<EmailTab>("blast");
  const [sendMode, setSendMode] = useState<SendMode>("immediate");

  // Common fields
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Blast-specific
  const [includeQrCode, setIncludeQrCode] = useState(false);
  const [embedCover, setEmbedCover] = useState(false);

  // Template customization
  const [templateConfig, setTemplateConfig] = useState<EmailTemplateConfig>(() => getDefaultConfig("blast"));

  // Reminder-specific
  const [reminderMode, setReminderMode] = useState<"auto" | "custom">("auto");

  // Schedule fields
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("once");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);

  // Survey context
  const [surveyLink, setSurveyLink] = useState("");
  const [surveyTitle, setSurveyTitle] = useState("");
  const [eventTitle, setEventTitle] = useState("");
  const [periodText, setPeriodText] = useState("");

  // UI state
  const [sending, setSending] = useState(false);
  const [_result, setResult] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ scheduleDate?: string; scheduleTime?: string; recipients?: string }>({});
  const { toasts, showToast, removeToast } = useToast();

  const recipientCount = useMemo(() => parseRecipients(recipientsText).length, [recipientsText]);

  useEffect(() => {
    const firstErrorId =
      fieldErrors.scheduleDate ? "ebm-sched-date" :
      fieldErrors.scheduleTime ? "ebm-sched-time" :
      fieldErrors.recipients ? "ebm-recipients" :
      "";

    if (!firstErrorId) return;

    const node = document.getElementById(firstErrorId);
    if (!node) return;

    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
      if (typeof (node as HTMLElement).focus === "function") {
        (node as HTMLElement).focus({ preventScroll: true });
      }
    });
  }, [fieldErrors]);

  useEffect(() => {
    const loadSurveyContext = async () => {
      if (!surveyId) return;
      const res = await fetchSurveyById(surveyId);
      if (!res.success || !res.survey) return;
      setSurveyTitle(res.survey.Title || "");
      setEventTitle((res.survey as { EventTitle?: string }).EventTitle || "");
      setSurveyLink(res.survey.ShortenedLink || res.survey.SurveyLink || "");
      // Build period text from StartDate and EndDate
      const start = res.survey.StartDate ? new Date(res.survey.StartDate).toLocaleDateString("id-ID") : "";
      const end = res.survey.EndDate ? new Date(res.survey.EndDate).toLocaleDateString("id-ID") : "";
      if (start && end) setPeriodText(`${start} – ${end}`);
      else if (start) setPeriodText(start);
    };
    void loadSurveyContext();
  }, [surveyId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const resetForm = useCallback(() => {
    setSubject("");
    setMessage("");
    setRecipientsText("");
    setFile(null);
    setIncludeQrCode(false);
    setEmbedCover(false);
    setReminderMode("auto");
    setScheduleDate("");
    setScheduleTime("09:00");
    setFrequency("once");
    setDayOfWeek(1);
    setSendMode("immediate");
    setResult("");
    setFieldErrors({});
  }, []);

  const downloadTemplate = () => {
    const csv = "name,email\nPenerima 1,penerima1@example.com\nPenerima 2,penerima2@example.com";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "email-blast-recipients-template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleSubmit = async () => {
    setResult("");
    const recipients = parseRecipients(recipientsText);

    // Per-field validation
    const nextErrors: { scheduleDate?: string; scheduleTime?: string; recipients?: string } = {};

    if (sendMode === "schedule") {
      if (!scheduleDate) nextErrors.scheduleDate = "Tanggal jadwal wajib diisi.";
      if (!scheduleTime) nextErrors.scheduleTime = "Waktu jadwal wajib diisi.";
    }

    if (activeTab === "blast" && sendMode === "immediate" && recipients.length === 0 && !file) {
      nextErrors.recipients = "Isi recipients manual atau upload file Excel.";
    }

    if (activeTab === "reminder" && reminderMode === "custom" && recipients.length === 0) {
      nextErrors.recipients = "Isi recipients untuk reminder custom.";
    }

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});

    // Show confirmation dialog
    setShowConfirm(true);
  };

  const executeSubmit = async () => {
    setShowConfirm(false);
    const recipients = parseRecipients(recipientsText);

    setSending(true);

    try {
      if (sendMode === "schedule") {
        // Schedule mode
        const recipientEmails = recipients.map((r) => r.email);
        const scheduleInput = {
          surveyId,
          scheduledDate: `${scheduleDate}T${scheduleTime}:00`,
          emailTemplate: activeTab === "blast" ? "survey-invitation" : "survey-reminder",
          customSubject: subject || undefined,
          customMessage: message || undefined,
          includeQrCode: activeTab === "blast" ? includeQrCode : false,
          recipientEmails: recipientEmails.length > 0 ? recipientEmails : undefined,
          embedCover,
          frequency,
          scheduledTime: scheduleTime,
          dayOfWeek: frequency === "weekly" ? dayOfWeek : undefined,
        };

        const res = activeTab === "blast"
          ? await scheduleEventBlast(scheduleInput)
          : await scheduleEventReminder(scheduleInput);

        if (!res.success) {
          showToast("error", res.message || "Gagal menjadwalkan");
        } else {
          showToast("success", `${activeTab === "blast" ? "Blast" : "Reminder"} berhasil dijadwalkan.`);
          onScheduleCreated?.();
        }
      } else {
        // Immediate mode
        if (activeTab === "blast") {
          // Use file upload path (standalone endpoint) if file exists, otherwise use survey blast endpoint
          if (file) {
            const res = await sendStandaloneEmailBlast({
              subject: subject || surveyTitle,
              message: message || "",
              recipients,
              includeQrCode,
              includeSurveyButton: true,
              surveyLink,
              buttonLabel: "Mulai Survey",
              includeCalendarInvite: false,
              file,
            });
            if (!res.success) { showToast("error", res.message || "Gagal mengirim blast"); }
            else { showToast("success", `Blast berhasil - Total ${res.total || 0}, terkirim ${res.sent || 0}, gagal ${res.failed || 0}.`); }
          } else {
            const recipientEmails = recipients.map((r) => r.email);
            const res = await sendSurveyBlast({
              surveyId,
              customSubject: subject || undefined,
              customMessage: message || undefined,
              includeQrCode,
              embedCover,
              recipientEmails: recipientEmails.length > 0 ? recipientEmails : undefined,
              disableDuplicateCheck: true,
              buttonLabel: templateConfig.buttonLabel || undefined,
              primaryColor: templateConfig.primaryColor || undefined,
              showPeriod: templateConfig.showPeriod !== false,
              showBadge: templateConfig.showBadge !== false,
              badgeText: templateConfig.badgeText || undefined,
              showButton: templateConfig.showButton !== false,
              showLinkFallback: templateConfig.showLinkFallback !== false,
            });
            if (!res.success) { showToast("error", res.message || "Gagal mengirim blast"); }
            else { showToast("success", `Blast berhasil - Total ${res.total || 0}, terkirim ${res.sent || 0}, gagal ${res.failed || 0}, skip ${res.skipped || 0}.`); }
          }
        } else {
          // Reminder
          const recipientEmails = reminderMode === "custom" ? recipients.map((r) => r.email) : [];
          const res = await sendSurveyReminder({
            surveyId,
            customSubject: subject || undefined,
            customMessage: message || undefined,
            recipientEmails,
            embedCover,
            buttonLabel: templateConfig.buttonLabel || undefined,
            primaryColor: templateConfig.primaryColor || undefined,
          });
          if (!res.success) { showToast("error", res.message || "Gagal mengirim reminder"); }
          else { showToast("success", `Reminder berhasil - Total ${res.total || 0}, terkirim ${res.sent || 0}, gagal ${res.failed || 0}, skip ${res.skipped || 0}.`); }
        }
      }
    } finally {
      setSending(false);
    }
  };

  const confirmMessage = sendMode === "schedule"
    ? `Jadwalkan ${activeTab === "blast" ? "blast" : "reminder"} untuk event "${surveyTitle}"?`
    : `Kirim ${activeTab === "blast" ? "blast" : "reminder"} sekarang untuk event "${surveyTitle}"?`;

  return (
    <div className={styles.overlay} role="presentation">
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Email Blast & Reminder">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        {/* Header */}
        <header className={styles.header}>
          <div>
            <h2 className={styles.title}>📧 Distribusi Email</h2>
            {eventTitle ? (
              <>
                <p className={styles.subtitle}>Event: <strong>{eventTitle}</strong></p>
                <p className={styles.subtitle}>Survey/Form: <strong>{surveyTitle || "..."}</strong></p>
              </>
            ) : (
              <p className={styles.subtitle}>Survey/Form: <strong>{surveyTitle || "..."}</strong></p>
            )}
          </div>
          <button className={styles.closeBtn} type="button" onClick={onClose} aria-label="Close">✕</button>
        </header>

        {/* Tab bar */}
        <div className={styles.tabBar}>
          <button type="button" className={`${styles.tab} ${activeTab === "blast" ? styles.tabActive : ""}`} onClick={() => { setActiveTab("blast"); setResult(""); }}>
            📤 Blast
          </button>
          <button type="button" className={`${styles.tab} ${activeTab === "reminder" ? styles.tabActive : ""}`} onClick={() => { setActiveTab("reminder"); setResult(""); }}>
            🔔 Reminder
          </button>
        </div>

        {/* Body */}
        <div className={styles.body}>
          {/* Preview bar — horizontal above form */}
          <div className={styles.previewBar}>
            <div className={styles.previewItem}><span className={styles.previewValue}>{activeTab === "reminder" && reminderMode === "auto" ? "Auto" : recipientCount}</span><span className={styles.previewLabel}>Recipients</span></div>
            <div className={styles.previewItem}><span className={styles.previewValue}>{sendMode === "immediate" ? "⚡" : "📅"}</span><span className={styles.previewLabel}>Mode</span></div>
            <div className={styles.previewItem}><span className={styles.previewValue}>{frequency === "once" ? "1x" : frequency}</span><span className={styles.previewLabel}>Freq</span></div>
            <div className={styles.previewItem}><span className={styles.previewValue}>{includeQrCode ? "ON" : "OFF"}</span><span className={styles.previewLabel}>QR</span></div>
            <div className={styles.previewItem}><span className={styles.previewValue}>{embedCover ? "ON" : "OFF"}</span><span className={styles.previewLabel}>Cover</span></div>
          </div>

          <div className={styles.formCol}>
              {/* Send mode selector */}
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={`${styles.sectionIcon} ${styles.iconBlue}`}>⏱️</span>
                  <div>
                    <div className={styles.sectionTitle}>Mode Pengiriman</div>
                    <div className={styles.sectionDesc}>Kirim langsung atau jadwalkan</div>
                  </div>
                </div>
                <div className={styles.modeSelector}>
                  <button type="button" className={`${styles.modeBtn} ${sendMode === "immediate" ? styles.modeBtnActive : ""}`} onClick={() => setSendMode("immediate")}>
                    ⚡ Kirim Langsung
                  </button>
                  <button type="button" className={`${styles.modeBtn} ${sendMode === "schedule" ? styles.modeBtnActive : ""}`} onClick={() => setSendMode("schedule")}>
                    📅 Jadwalkan
                  </button>
                </div>

                {sendMode === "schedule" && (
                  <div className={styles.scheduleFields}>
                    <div className={styles.scheduleRow}>
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="ebm-sched-date">Tanggal</label>
                        <DatePicker id="ebm-sched-date" value={scheduleDate} onChange={(v) => { setScheduleDate(v); if (fieldErrors.scheduleDate) setFieldErrors((p) => ({ ...p, scheduleDate: undefined })); }} placeholder="Pilih tanggal" />
                        {fieldErrors.scheduleDate && <span className={styles.errorMsg}>{fieldErrors.scheduleDate}</span>}
                      </div>
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="ebm-sched-time">Waktu</label>
                        <DatePicker id="ebm-sched-time" mode="time" value={scheduleTime} onChange={(v) => { setScheduleTime(v); if (fieldErrors.scheduleTime) setFieldErrors((p) => ({ ...p, scheduleTime: undefined })); }} placeholder="Pilih waktu" />
                        {fieldErrors.scheduleTime && <span className={styles.errorMsg}>{fieldErrors.scheduleTime}</span>}
                      </div>
                    </div>
                    <div className={styles.scheduleRow}>
                      <div className={styles.field}>
                        <label className={styles.label} htmlFor="ebm-frequency">Frekuensi</label>
                        <select id="ebm-frequency" className={styles.input} value={frequency} onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}>
                          <option value="once">Sekali</option>
                          <option value="daily">Harian</option>
                          <option value="weekly">Mingguan</option>
                          <option value="monthly">Bulanan</option>
                        </select>
                      </div>
                      {frequency === "weekly" && (
                        <div className={styles.field}>
                          <label className={styles.label} htmlFor="ebm-dow">Hari</label>
                          <select id="ebm-dow" className={styles.input} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
                            <option value={0}>Minggu</option>
                            <option value={1}>Senin</option>
                            <option value={2}>Selasa</option>
                            <option value={3}>Rabu</option>
                            <option value={4}>Kamis</option>
                            <option value={5}>Jumat</option>
                            <option value={6}>Sabtu</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </section>

              {/* Compose */}
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={`${styles.sectionIcon} ${styles.iconBlue}`}>✏️</span>
                  <div>
                    <div className={styles.sectionTitle}>Compose Email</div>
                    <div className={styles.sectionDesc}>Subject dan pesan (opsional, ada default dari template)</div>
                  </div>
                </div>
                <div className={styles.fieldFull}>
                  <label className={styles.label} htmlFor="ebm-subject">Subject (opsional)</label>
                  <input id="ebm-subject" className={styles.input} placeholder="Kosongkan untuk pakai judul event" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
                <div className={styles.fieldFull}>
                  <label className={styles.label} htmlFor="ebm-message">Custom Message (opsional)</label>
                  <textarea id="ebm-message" className={styles.textarea} placeholder="Kosongkan untuk pakai pesan default template" value={message} onChange={(e) => setMessage(e.target.value)} />
                </div>
              </section>

              {/* Recipients */}
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={`${styles.sectionIcon} ${styles.iconGreen}`}>👥</span>
                  <div>
                    <div className={styles.sectionTitle}>Recipients</div>
                    <div className={styles.sectionDesc}>
                      {activeTab === "blast"
                        ? "Wajib isi penerima untuk blast langsung"
                        : "Pilih mode: otomatis non-respondents atau custom"}
                    </div>
                  </div>
                </div>

                {activeTab === "reminder" && (
                  <div className={styles.modeSelector} style={{ marginBottom: 12 }}>
                    <button type="button" className={`${styles.modeBtn} ${reminderMode === "auto" ? styles.modeBtnActive : ""}`} onClick={() => setReminderMode("auto")}>
                      🤖 Auto (Non-respondents)
                    </button>
                    <button type="button" className={`${styles.modeBtn} ${reminderMode === "custom" ? styles.modeBtnActive : ""}`} onClick={() => setReminderMode("custom")}>
                      ✍️ Custom Recipients
                    </button>
                  </div>
                )}

                {activeTab === "reminder" && reminderMode === "auto" ? (
                  <div className={styles.infoBox}>
                    Sistem akan otomatis mengirim reminder ke penerima yang sudah di-blast sebelumnya tapi belum mengisi survey.
                  </div>
                ) : (
                  <>
                    <div className={styles.fieldFull}>
                      <label className={styles.label} htmlFor="ebm-recipients">Input Manual</label>
                      <textarea id="ebm-recipients" className={`${styles.textareaSmall} ${fieldErrors.recipients ? styles.inputError : ""}`} placeholder={"Format per baris:\nNama, email@domain.com"} value={recipientsText} onChange={(e) => { setRecipientsText(e.target.value); if (fieldErrors.recipients) setFieldErrors((p) => ({ ...p, recipients: undefined })); }} />
                      <p className={styles.hint}>Satu penerima per baris. Kolom opsional: nama (dipisah koma sebelum email).</p>
                      {fieldErrors.recipients && <span className={styles.errorMsg}>{fieldErrors.recipients}</span>}
                    </div>
                    {activeTab === "blast" && (
                      <div className={styles.fieldFull}>
                        <div className={styles.uploadRow}>
                          <label className={styles.label} htmlFor="ebm-file-upload">Upload File Excel / CSV</label>
                          <button type="button" className={styles.btnTemplate} onClick={downloadTemplate}>📥 Template</button>
                        </div>
                        <div className={styles.fileZone}>
                          <input id="ebm-file-upload" name="ebm-file-upload" className={styles.fileInput} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
                          <div className={styles.fileLabel}>Klik atau drag file ke sini</div>
                          <div className={styles.fileHint}>Format: .xlsx, .xls, .csv - Kolom wajib: email, opsional: name</div>
                        </div>
                        {file && <div className={styles.fileChosen}>{file.name}</div>}
                      </div>
                    )}
                  </>
                )}
              </section>

              {/* Options */}
              <section className={styles.section}>
                <div className={styles.sectionHead}>
                  <span className={`${styles.sectionIcon} ${styles.iconPurple}`}>⚙️</span>
                  <div>
                    <div className={styles.sectionTitle}>Opsi Tambahan</div>
                    <div className={styles.sectionDesc}>Pengaturan lampiran email</div>
                  </div>
                </div>
                <div className={styles.toggleGrid}>
                  {activeTab === "blast" && (
                    <label className={styles.toggleRow}>
                      <span className={styles.switch}><input id="ebm-qr-toggle" name="ebm-qr-toggle" type="checkbox" checked={includeQrCode} onChange={(e) => { setIncludeQrCode(e.target.checked); setTemplateConfig((prev) => ({ ...prev, showQrCode: e.target.checked })); }} /><span className={styles.switchTrack} /></span>
                      <span><span className={styles.toggleLabel}>Lampirkan QR Code</span><span className={styles.toggleDesc}>QR otomatis dari link survey</span></span>
                    </label>
                  )}
                  <label className={styles.toggleRow}>
                    <span className={styles.switch}><input id="ebm-cover-toggle" name="ebm-cover-toggle" type="checkbox" checked={embedCover} onChange={(e) => { setEmbedCover(e.target.checked); if (e.target.checked) setTemplateConfig((prev) => ({ ...prev, bannerImageUrl: prev.bannerImageUrl || "" })); }} /><span className={styles.switchTrack} /></span>
                    <span><span className={styles.toggleLabel}>Embed Cover Image</span><span className={styles.toggleDesc}>Sertakan hero image di body email</span></span>
                  </label>
                </div>
                <div className={styles.fieldFull} style={{ marginTop: 8 }}>
                  <label className={styles.label} htmlFor="ebm-survey-link">Link Survey (read-only)</label>
                  <input id="ebm-survey-link" name="ebm-survey-link" className={styles.input} value={surveyLink} readOnly />
                </div>
              </section>

              {/* Template Editor + Live Preview */}
              <EmailTemplateEditor
                title={subject || surveyTitle || "Judul Survey"}
                message={message || undefined}
                surveyLink={surveyLink || undefined}
                periodText={periodText || undefined}
                qrCodeUrl={qrCodeUrl || undefined}
                config={templateConfig}
                onConfigChange={setTemplateConfig}
              />
            </div>
        </div>

        {/* Footer */}
        <footer className={styles.footer}>
          <div className={styles.footerActions}>
            <button type="button" className={styles.btnReset} onClick={resetForm}>🔄 Reset</button>
            <button type="button" className={styles.btnCancel} onClick={onClose}>Tutup</button>
            <button type="button" className={styles.btnSend} onClick={() => void handleSubmit()} disabled={sending}>
              {sending ? "Memproses..." : sendMode === "immediate" ? `📤 Kirim ${activeTab === "blast" ? "Blast" : "Reminder"}` : `📅 Jadwalkan ${activeTab === "blast" ? "Blast" : "Reminder"}`}
            </button>
          </div>
        </footer>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={sendMode === "schedule" ? "Konfirmasi Jadwal" : "Konfirmasi Pengiriman"}
        message={confirmMessage}
        confirmLabel={sendMode === "schedule" ? "Ya, Jadwalkan" : "Ya, Kirim Sekarang"}
        cancelLabel="Batal"
        isLoading={sending}
        onConfirm={() => void executeSubmit()}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
