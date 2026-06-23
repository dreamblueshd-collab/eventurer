"use client";

import { useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "./email-blast.module.css";
import { sendStandaloneEmailBlast, scheduleStandaloneEmailBlast } from "@/lib/email-blast";
import DatePicker from "@/components/common/date-picker";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useToast, ToastContainer } from "@/components/common/toast";

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseRecipients(text: string): Array<{ name?: string; email: string }> {
  const result: Array<{ name?: string; email: string }> = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length === 0) continue;
    if (parts.length === 1) {
      if (isEmail(parts[0])) result.push({ email: parts[0] });
    } else {
      const allEmails = parts.every(isEmail);
      if (allEmails) {
        for (const p of parts) result.push({ email: p });
      } else {
        const emailPart = parts.find(isEmail);
        const namePart = parts.find((p) => !isEmail(p));
        if (emailPart) result.push({ name: namePart, email: emailPart });
      }
    }
  }
  return result;
}

type SendMode = "immediate" | "schedule";
type ScheduleFrequency = "once" | "daily" | "weekly" | "monthly";
type FieldErrors = {
  subject?: string;
  message?: string;
  recipients?: string;
  scheduleDate?: string;
  scheduleTime?: string;
};

export default function EmailBlastPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [recipientsText, setRecipientsText] = useState("");

  const [includeCalendarInvite, setIncludeCalendarInvite] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [location, setLocation] = useState("");
  const [teamsLink, setTeamsLink] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  // Schedule state
  const [sendMode, setSendMode] = useState<SendMode>("immediate");
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [frequency, setFrequency] = useState<ScheduleFrequency>("once");
  const [dayOfWeek, setDayOfWeek] = useState<number>(1);

  const recipientCount = useMemo(() => parseRecipients(recipientsText).length, [recipientsText]);

  useEffect(() => {
    const firstErrorId =
      errors.subject ? "eb-subject" :
      errors.message ? "eb-message" :
      errors.recipients ? "eb-recipients" :
      errors.scheduleDate ? "eb-sched-date" :
      errors.scheduleTime ? "eb-sched-time" :
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
  }, [errors]);

  const resetForm = () => {
    setSubject("");
    setMessage("");
    setRecipientsText("");
    setFile(null);
    setIncludeCalendarInvite(false);
    setEventTitle("");
    setLocation("");
    setTeamsLink("");
    setStartAt("");
    setEndAt("");
    setErrors({});
    setSendMode("immediate");
    setScheduleDate("");
    setScheduleTime("09:00");
    setFrequency("once");
    setDayOfWeek(1);
  };

  const downloadTemplate = () => {
    const header = "name,email";
    const sample1 = "Nama Penerima,penerima@example.com";
    const sample2 = "Penerima 2,penerima2@example.com";
    const csv = [header, sample1, sample2].join("\n");
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

  const onSubmit = () => {
    const newErrors: FieldErrors = {};
    const recipients = parseRecipients(recipientsText);

    if (!subject.trim()) newErrors.subject = "Subject wajib diisi.";
    if (!message.trim()) newErrors.message = "Message wajib diisi.";
    if (recipients.length === 0 && !file) newErrors.recipients = "Isi recipients manual atau upload file Excel.";
    if (sendMode === "schedule" && !scheduleDate) newErrors.scheduleDate = "Tanggal jadwal wajib diisi.";
    if (sendMode === "schedule" && !scheduleTime) newErrors.scheduleTime = "Waktu jadwal wajib diisi.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setShowConfirm(true);
  };

  const executeSubmit = async () => {
    setShowConfirm(false);
    setErrors({});
    const recipients = parseRecipients(recipientsText);

    if (sendMode === "schedule") {
      setSending(true);
      const res = await scheduleStandaloneEmailBlast({
        subject,
        message,
        recipients,
        scheduledDate: `${scheduleDate}T${scheduleTime}:00`,
        scheduledTime: scheduleTime,
        frequency,
        dayOfWeek: frequency === "weekly" ? dayOfWeek : undefined,
        includeQrCode: false,
        includeSurveyButton: false,
        includeCalendarInvite,
        eventTitle: eventTitle || undefined,
        location,
        teamsLink,
        startAt: startAt || undefined,
        endAt: endAt || undefined,
        file,
      });
      setSending(false);

      if (!res.success) {
        showToast("error", res.message || "Gagal menjadwalkan email blast");
        return;
      }
      showToast("success", "Email blast berhasil dijadwalkan.");
      return;
    }

    // Immediate mode
    setSending(true);
    const res = await sendStandaloneEmailBlast({
      subject,
      message,
      recipients,
      includeQrCode: false,
      includeSurveyButton: false,
      includeCalendarInvite,
      eventTitle: eventTitle || undefined,
      location,
      teamsLink,
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      file,
    });
    setSending(false);

    if (!res.success) {
      showToast("error", res.message || "Gagal mengirim email blast");
      return;
    }
    showToast("success", `Email blast berhasil dikirim - Total ${res.total || 0}, terkirim ${res.sent || 0}, gagal ${res.failed || 0}.`);
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>📧 Email Blast</h1>
          <p className={baseStyles.subtitle}>Kirim email blast standalone ke banyak penerima sekaligus (undangan, pengumuman umum), dengan opsi calendar invite dan Microsoft Teams link.</p>
        </div>
      </div>

      {/* Preview card — di atas */}
      <div className={styles.previewBar}>
        <div className={styles.previewItem}><span className={styles.previewValue}>{recipientCount}</span><span className={styles.previewLabel}>Penerima</span></div>
        <div className={styles.previewItem}><span className={styles.previewValue}>{file ? "✓" : "-"}</span><span className={styles.previewLabel}>File</span></div>
        <div className={styles.previewItem}><span className={styles.previewValue}>{subject ? "✓" : "-"}</span><span className={styles.previewLabel}>Subject</span></div>
        <div className={styles.previewItem}><span className={styles.previewValue}>{includeCalendarInvite ? "ON" : "OFF"}</span><span className={styles.previewLabel}>Calendar</span></div>
        <div className={styles.previewItem}><span className={styles.previewValue}>{sendMode === "schedule" ? "📅" : "⚡"}</span><span className={styles.previewLabel}>Mode</span></div>
      </div>

      <div className={styles.singleCol}>
        {/* Compose */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>✏️</div>
            <div>
              <div className={styles.sectionTitle}>Compose Email</div>
              <div className={styles.sectionSubtitle}>Tulis subject dan isi pesan email</div>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.full}>
              <label className={baseStyles.label} htmlFor="eb-subject">Subject</label>
              <input id="eb-subject" className={`${baseStyles.input} ${errors.subject ? styles.inputError : ""}`} placeholder="Masukkan subject email" value={subject} onChange={(e) => { setSubject(e.target.value); if (errors.subject) setErrors((prev) => ({ ...prev, subject: undefined })); }} />
              {errors.subject && <p className={styles.fieldError}>{errors.subject}</p>}
            </div>
            <div className={styles.full}>
              <label className={baseStyles.label} htmlFor="eb-message">Message</label>
              <textarea id="eb-message" className={`${baseStyles.textarea} ${styles.textarea} ${errors.message ? styles.inputError : ""}`} placeholder="Tulis isi pesan email di sini..." value={message} onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors((prev) => ({ ...prev, message: undefined })); }} />
              {errors.message && <p className={styles.fieldError}>{errors.message}</p>}
            </div>
          </div>
        </div>

        {/* Recipients */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={`${styles.sectionIcon} ${styles.iconGreen}`}>👥</div>
            <div>
              <div className={styles.sectionTitle}>Recipients</div>
              <div className={styles.sectionSubtitle}>Input manual atau upload dari file Excel/CSV</div>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.full}>
              <label className={baseStyles.label} htmlFor="eb-recipients">Input Manual</label>
              <textarea
                id="eb-recipients"
                className={`${baseStyles.textarea} ${styles.textareaSmall} ${errors.recipients ? styles.inputError : ""}`}
                placeholder={"Format per baris:\nNama, email@domain.com\natau langsung email@domain.com"}
                value={recipientsText}
                onChange={(e) => { setRecipientsText(e.target.value); if (errors.recipients) setErrors((prev) => ({ ...prev, recipients: undefined })); }}
              />
              {errors.recipients && <p className={styles.fieldError}>{errors.recipients}</p>}
              {!errors.recipients && <p className={styles.hint}>Satu penerima per baris. Kolom opsional: nama (dipisah koma sebelum email).</p>}
            </div>

            <div className={styles.full}>
              <div className={styles.uploadLabelRow}>
                <label className={baseStyles.label} htmlFor="eb-file-upload">Upload File Excel / CSV</label>
                <button type="button" className={styles.btnTemplate} onClick={downloadTemplate}>
                  📥 Download Template
                </button>
              </div>
              <div className={styles.fileDropZone}>
                <input id="eb-file-upload" name="eb-file-upload" className={styles.fileDropInput} type="file" accept=".xlsx,.xls,.csv" onChange={(e) => { setFile(e.target.files?.[0] || null); if (errors.recipients) setErrors((prev) => ({ ...prev, recipients: undefined })); }} />
                <div className={styles.fileDropLabel}>Klik atau drag file ke sini</div>
                <div className={styles.fileDropHint}>Format: .xlsx, .xls, .csv - Kolom wajib: email, opsional: name</div>
              </div>
              {file && <div className={styles.fileChosen}>{file.name}</div>}
            </div>
          </div>
        </div>

        {/* Calendar Invite */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={`${styles.sectionIcon} ${styles.iconPurple}`}>📅</div>
            <div>
              <div className={styles.sectionTitle}>Calendar Invite</div>
              <div className={styles.sectionSubtitle}>Lampirkan undangan kalender dengan RSVP</div>
            </div>
          </div>

          <div className={styles.toggleRow}>
            <label className={styles.switch} htmlFor="eb-calendar-invite">
              <input id="eb-calendar-invite" name="eb-calendar-invite" type="checkbox" checked={includeCalendarInvite} onChange={(e) => setIncludeCalendarInvite(e.target.checked)} />
              <span className={styles.switchTrack} />
            </label>
            <div>
              <div className={styles.toggleLabel}>Sertakan Calendar Invite</div>
              <div className={styles.toggleDesc}>Penerima akan mendapat file .ics untuk RSVP</div>
            </div>
          </div>

          {includeCalendarInvite && (
            <div className={styles.calendarFields}>
              <div>
                <label className={baseStyles.label} htmlFor="eb-event-title">Event Title</label>
                <input id="eb-event-title" className={baseStyles.input} placeholder="Judul event" value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} />
              </div>
              <div>
                <label className={baseStyles.label} htmlFor="eb-location">Location</label>
                <input id="eb-location" className={baseStyles.input} placeholder="Lokasi acara" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
              <div>
                <label className={baseStyles.label} htmlFor="eb-start">Start</label>
                <DatePicker id="eb-start" mode="datetime" value={startAt} onChange={setStartAt} placeholder="Pilih tanggal & waktu mulai" />
              </div>
              <div>
                <label className={baseStyles.label} htmlFor="eb-end">End</label>
                <DatePicker id="eb-end" mode="datetime" value={endAt} onChange={setEndAt} placeholder="Pilih tanggal & waktu selesai" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label className={baseStyles.label} htmlFor="eb-teams">Teams Link (optional)</label>
                <input id="eb-teams" className={baseStyles.input} placeholder="https://teams.microsoft.com/..." value={teamsLink} onChange={(e) => setTeamsLink(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Schedule Options */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>⏱️</div>
            <div>
              <div className={styles.sectionTitle}>Mode Pengiriman</div>
              <div className={styles.sectionSubtitle}>Kirim langsung atau jadwalkan</div>
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
                  <label className={baseStyles.label} htmlFor="eb-sched-date">Tanggal</label>
                  <DatePicker
                    id="eb-sched-date"
                    value={scheduleDate}
                    onChange={(v) => {
                      setScheduleDate(v);
                      if (errors.scheduleDate) setErrors((prev) => ({ ...prev, scheduleDate: undefined }));
                    }}
                    placeholder="Pilih tanggal"
                  />
                  {errors.scheduleDate && <p className={styles.fieldError}>{errors.scheduleDate}</p>}
                </div>
                <div className={styles.field}>
                  <label className={baseStyles.label} htmlFor="eb-sched-time">Waktu</label>
                  <DatePicker
                    id="eb-sched-time"
                    mode="time"
                    value={scheduleTime}
                    onChange={(v) => {
                      setScheduleTime(v);
                      if (errors.scheduleDate || errors.scheduleTime) setErrors((prev) => ({ ...prev, scheduleDate: undefined, scheduleTime: undefined }));
                    }}
                    placeholder="Pilih waktu"
                  />
                  {errors.scheduleTime && <p className={styles.fieldError}>{errors.scheduleTime}</p>}
                </div>
              </div>
              <div className={styles.scheduleRow}>
                <div className={styles.field}>
                  <label className={baseStyles.label} htmlFor="eb-frequency">Frekuensi</label>
                  <select id="eb-frequency" className={baseStyles.input} value={frequency} onChange={(e) => setFrequency(e.target.value as ScheduleFrequency)}>
                    <option value="once">Sekali</option>
                    <option value="daily">Harian</option>
                    <option value="weekly">Mingguan</option>
                    <option value="monthly">Bulanan</option>
                  </select>
                </div>
                {frequency === "weekly" && (
                  <div className={styles.field}>
                    <label className={baseStyles.label} htmlFor="eb-dow">Hari</label>
                    <select id="eb-dow" className={baseStyles.input} value={dayOfWeek} onChange={(e) => setDayOfWeek(Number(e.target.value))}>
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
        </div>

        {/* Email Preview — mirrors standalone-blast.ejs */}
        <div className={styles.sectionCard}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionIcon}>👁️</div>
            <div>
              <div className={styles.sectionTitle}>Preview Email</div>
              <div className={styles.sectionSubtitle}>Tampilan email yang akan diterima penerima</div>
            </div>
          </div>
          <div className={styles.previewWrapper}>
            <table width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#f0f2f5", padding: "24px 0 32px" }}>
              <tbody><tr><td align="center">
                <table cellPadding={0} cellSpacing={0} style={{ maxWidth: 560, width: "100%" }}>
                  <tbody>
                    <tr>
                      <td style={{ backgroundColor: "#1d4ed8", borderRadius: "12px 12px 0 0", padding: "18px 24px" }}>
                        <table width="100%" cellPadding={0} cellSpacing={0}><tbody><tr>
                          <td style={{ fontFamily: "'Segoe UI',Arial,sans-serif", color: "#fff", fontSize: 16, fontWeight: 800 }}>Portal Event</td>
                          <td align="right" style={{ fontFamily: "'Segoe UI',Arial,sans-serif", color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>PT Astra Otoparts Tbk</td>
                        </tr></tbody></table>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ backgroundColor: "#fff", borderRadius: "0 0 12px 12px", padding: "28px 24px" }}>
                        <p style={{ fontSize: 20, fontWeight: 800, color: "#0f172a", margin: "0 0 20px", fontFamily: "'Segoe UI',Arial,sans-serif" }}>
                          {subject || <em style={{ color: "#94a3b8" }}>Subject belum diisi</em>}
                        </p>
                        <p style={{ fontSize: 13, color: "#475569", margin: "0 0 14px", fontFamily: "'Segoe UI',Arial,sans-serif" }}>
                          Halo <strong>[Nama Penerima]</strong>,
                        </p>
                        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
                          <p style={{ fontSize: 13, color: "#334155", margin: 0, whiteSpace: "pre-wrap", fontFamily: "'Segoe UI',Arial,sans-serif", lineHeight: 1.75 }}>
                            {message || <em style={{ color: "#94a3b8" }}>Pesan belum diisi</em>}
                          </p>
                        </div>
                        {includeCalendarInvite && startAt && (
                          <table width="100%" cellPadding={0} cellSpacing={0} style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, marginBottom: 20 }}>
                            <tbody><tr><td style={{ padding: "16px 18px" }}>
                              <p style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", margin: "0 0 10px", textTransform: "uppercase", letterSpacing: "0.04em", fontFamily: "'Segoe UI',Arial,sans-serif" }}>📅 Detail Undangan</p>
                              {eventTitle && <p style={{ fontSize: 12, color: "#334155", margin: "0 0 4px", fontFamily: "'Segoe UI',Arial,sans-serif" }}><strong>Event:</strong> {eventTitle}</p>}
                              <p style={{ fontSize: 12, color: "#334155", margin: "0 0 4px", fontFamily: "'Segoe UI',Arial,sans-serif" }}>
                                <strong>Waktu:</strong>{" "}
                                {new Date(startAt).toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })},{" "}
                                {new Date(startAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                                {endAt && <> - {new Date(endAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}</>} WIB
                              </p>
                              {location && <p style={{ fontSize: 12, color: "#334155", margin: "0 0 4px", fontFamily: "'Segoe UI',Arial,sans-serif" }}><strong>Lokasi:</strong> {location}</p>}
                              {teamsLink && (
                                <a href={teamsLink} target="_blank" rel="noopener noreferrer" style={{ display: "inline-block", background: "#5b5fc7", color: "#fff", textDecoration: "none", fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 6, marginTop: 8, fontFamily: "'Segoe UI',Arial,sans-serif" }}>
                                  🎥 Gabung via Teams
                                </a>
                              )}
                              <p style={{ fontSize: 11, color: "#64748b", margin: "10px 0 0", fontFamily: "'Segoe UI',Arial,sans-serif" }}>📎 File undangan kalender (.ics) terlampir.</p>
                            </td></tr></tbody>
                          </table>
                        )}
                        <p style={{ fontSize: 11, color: "#94a3b8", textAlign: "center", margin: "16px 0 0", fontFamily: "'Segoe UI',Arial,sans-serif" }}>
                          Email ini dikirim secara otomatis oleh <strong>Portal Event</strong> — PT Astra Otoparts Tbk.
                        </p>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td></tr></tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className={styles.actionsBar}>
          <button type="button" className={styles.btnReset} onClick={resetForm}>🔄 Reset Form</button>
          <button type="button" className={styles.btnSend} onClick={onSubmit} disabled={sending}>
            {sending ? "Memproses..." : sendMode === "schedule" ? "📅 Jadwalkan Email Blast" : "📤 Kirim Email Blast"}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title={sendMode === "schedule" ? "Konfirmasi Jadwal" : "Konfirmasi Pengiriman"}
        message={sendMode === "schedule"
          ? `Jadwalkan email blast "${subject}" untuk dikirim nanti?`
          : `Kirim email blast "${subject}" sekarang ke ${recipientCount} penerima?`
        }
        confirmLabel={sendMode === "schedule" ? "Ya, Jadwalkan" : "Ya, Kirim Sekarang"}
        cancelLabel="Batal"
        isLoading={sending}
        onConfirm={() => void executeSubmit()}
        onCancel={() => setShowConfirm(false)}
      />
    </>
  );
}
