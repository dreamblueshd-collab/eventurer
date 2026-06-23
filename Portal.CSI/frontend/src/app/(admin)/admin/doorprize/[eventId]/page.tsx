"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useToast, ToastContainer } from "@/components/common/toast";
import {
  fetchDoorprizeEventById,
  updateDoorprizeEvent,
  updateDoorprizeEventWithImage,
  deleteDoorprizeEvent,
} from "@/lib/doorprize-api";
import DatePicker from "@/components/common/date-picker";
import ImageCropper from "../components/ImageCropper";
import type { DoorprizeEvent, DoorprizeEventStatus } from "@/types/doorprize";
import baseStyles from "../../page-mockup.module.css";
import s from "./detail.module.css";

export default function DoorprizeDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const router = useRouter();
  const { toasts, showToast, removeToast } = useToast();

  // Data state
  const [event, setEvent] = useState<DoorprizeEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStatus, setEditStatus] = useState<DoorprizeEventStatus>("Draft");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Image edit state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [cropperFile, setCropperFile] = useState<File | null>(null);

  const loadEvent = useCallback(async () => {
    setLoading(true);
    setError("");

    const result = await fetchDoorprizeEventById(eventId);

    if (!result.success) {
      setError(result.message);
      setEvent(null);
    } else {
      setEvent(result.data);
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadEvent();
  }, [loadEvent]);

  // ── Helpers ──

  function formatDate(dateStr: string) {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "-";
    }
  }

  function toDatetimeLocal(dateStr: string) {
    try {
      const d = new Date(dateStr);
      const offset = d.getTimezoneOffset();
      const local = new Date(d.getTime() - offset * 60000);
      // DatePicker datetime mode expects "YYYY-MM-DD HH:mm"
      return local.toISOString().slice(0, 16).replace("T", " ");
    } catch {
      return "";
    }
  }

  function getStatusBadgeClass(status: DoorprizeEventStatus) {
    switch (status) {
      case "Active":
        return s.badgeActive;
      case "Completed":
        return s.badgeCompleted;
      case "Archived":
        return s.badgeArchived;
      default:
        return s.badgeDraft;
    }
  }

  // ── Edit handlers ──

  function startEdit() {
    if (!event) return;
    setEditName(event.name);
    setEditDate(toDatetimeLocal(event.eventDate));
    setEditStatus(event.status);
    setEditImageFile(null);
    setEditImagePreview(event.imageUrl || null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setEditImageFile(null);
    setEditImagePreview(null);
  }

  async function handleSave() {
    if (!event) return;

    if (!editName.trim()) {
      showToast("error", "Nama event wajib diisi");
      return;
    }
    if (!editDate) {
      showToast("error", "Tanggal event wajib diisi");
      return;
    }

    setSaving(true);

    let result;
    if (editImageFile) {
      const formData = new FormData();
      formData.append("name", editName.trim());
      formData.append("eventDate", editDate.includes("T") ? editDate : editDate.replace(" ", "T") + ":00");
      formData.append("status", editStatus);
      formData.append("image", editImageFile);
      result = await updateDoorprizeEventWithImage(event.doorprizeEventId, formData);
    } else {
      result = await updateDoorprizeEvent(event.doorprizeEventId, {
        name: editName.trim(),
        eventDate: editDate.includes("T") ? editDate : editDate.replace(" ", "T") + ":00",
        status: editStatus,
      });
    }

    if (!result.success) {
      showToast("error", result.message || "Gagal memperbarui event");
    } else {
      showToast("success", "Event berhasil diperbarui");
      setEvent(result.data);
      setEditing(false);
    }

    setSaving(false);
  }

  // ── Delete handlers ──

  async function handleDelete() {
    if (!event) return;

    setDeleting(true);

    const result = await deleteDoorprizeEvent(event.doorprizeEventId);

    if (!result.success) {
      showToast("error", result.message || "Gagal menghapus event");
      setDeleting(false);
      setShowDeleteModal(false);
    } else {
      showToast("success", "Event berhasil dihapus");
      router.push(event.parentEventId ? `/admin/event-management/${event.parentEventId}` : "/admin/event-management");
    }
  }

  // ── Loading state ──

  if (loading) {
    return (
      <div className={s.loadingWrap}>
        <div className={s.spinner} />
        <span className={s.loadingText}>Memuat detail event...</span>
      </div>
    );
  }

  // ── Error state ──

  if (error || !event) {
    return (
      <div className={s.errorWrap}>
        <p className={s.errorText}>⚠️ {error || "Event tidak ditemukan"}</p>
        <Link href="/admin/event-management" prefetch={false} className={s.btnBack}>
          ← Kembali ke Event Management
        </Link>
      </div>
    );
  }

  // ── Main render ──

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Page header */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Detail Event Doorprize</h1>
          <p className={baseStyles.subtitle}>
            Kelola hadiah, peserta, dan undian untuk event ini
          </p>
        </div>
        <div className={baseStyles.toolbar}>
          <Link
            href={event.parentEventId ? `/admin/event-management/${event.parentEventId}` : "/admin/event-management"}
            prefetch={false}
            className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
          >
            ← Kembali
          </Link>
        </div>
      </div>

      {/* Event info card */}
      <div className={s.infoCard}>
        {!editing ? (
          <>
            <div className={s.infoHeader}>
              <div className={s.infoLeft}>
                <h2 className={s.eventName}>{event.name}</h2>
                <div className={s.eventMeta}>
                  <span className={s.metaItem}>
                    📅 {formatDate(event.eventDate)}
                  </span>
                  <span className={getStatusBadgeClass(event.status)}>
                    {event.status}
                  </span>
                </div>
              </div>
              <div className={s.infoActions}>
                <button
                  type="button"
                  className={s.btnEdit}
                  onClick={startEdit}
                >
                  ✏️ Edit
                </button>
                <button
                  type="button"
                  className={s.btnDelete}
                  onClick={() => setShowDeleteModal(true)}
                >
                  🗑️ Hapus
                </button>
              </div>
            </div>

            {event.imageUrl && (
              <div className={s.eventImage}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={event.imageUrl} alt={event.name} />
              </div>
            )}
          </>
        ) : (
          <div className={s.editForm}>
            <div className={s.editRow}>
              <div className={s.field}>
                <label className={s.label} htmlFor="edit-name">
                  Nama Event
                </label>
                <input
                  id="edit-name"
                  type="text"
                  className={s.input}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={500}
                />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="edit-date">
                  Tanggal Event
                </label>
                <DatePicker
                  id="edit-date"
                  mode="datetime"
                  value={editDate}
                  onChange={(val) => setEditDate(val)}
                />
              </div>
              <div className={s.field}>
                <label className={s.label} htmlFor="edit-status">
                  Status
                </label>
                <select
                  id="edit-status"
                  className={s.select}
                  value={editStatus}
                  onChange={(e) =>
                    setEditStatus(e.target.value as DoorprizeEventStatus)
                  }
                >
                  <option value="Draft">Draft</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="Archived">Archived</option>
                </select>
              </div>
            </div>
            {/* Image upload */}
            <div className={s.field}>
              <label className={s.label}>Gambar / Banner</label>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCropperFile(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  id="edit-image"
                />
                <label htmlFor="edit-image" style={{ display: "inline-flex", alignItems: "center", gap: "5px", border: "1px solid #d1d5db", borderRadius: "8px", background: "#fff", color: "#374151", fontSize: "13px", fontWeight: 600, padding: "8px 14px", cursor: "pointer" }}>
                  📁 Pilih Gambar
                </label>
                {editImageFile && (
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>{editImageFile.name}</span>
                )}
              </div>
              {editImagePreview && (
                <div style={{ marginTop: "8px", borderRadius: "8px", overflow: "hidden", maxWidth: "200px", border: "1px solid #e5e7eb" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={editImagePreview} alt="Preview" style={{ width: "100%", height: "auto", display: "block" }} />
                </div>
              )}
            </div>
            <div className={s.editActions}>
              <button
                type="button"
                className={s.btnSave}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Menyimpan..." : "💾 Simpan"}
              </button>
              <button
                type="button"
                className={s.btnCancel}
                onClick={cancelEdit}
                disabled={saving}
              >
                Batal
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Summary stats */}
      <div className={s.statsRow}>
        <div className={s.statCard}>
          <div className={`${s.statIcon} ${s.statIconGift}`}>🎁</div>
          <div className={s.statContent}>
            <span className={s.statValue}>{event.giftCount ?? 0}</span>
            <span className={s.statLabel}>Total Hadiah</span>
          </div>
        </div>
        <div className={s.statCard}>
          <div className={`${s.statIcon} ${s.statIconParticipant}`}>👥</div>
          <div className={s.statContent}>
            <span className={s.statValue}>{event.participantCount ?? 0}</span>
            <span className={s.statLabel}>Total Peserta</span>
          </div>
        </div>
        <div className={s.statCard}>
          <div className={`${s.statIcon} ${s.statIconResult}`}>🏆</div>
          <div className={s.statContent}>
            <span className={s.statValue}>{event.resultCount ?? 0}</span>
            <span className={s.statLabel}>Pemenang</span>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className={s.tabNav}>
        <Link
          href={`/admin/doorprize/${eventId}/gifts`}
          prefetch={false}
          className={s.tabLink}
        >
          🎁 Hadiah
        </Link>
        <Link
          href={`/admin/doorprize/${eventId}/participants`}
          prefetch={false}
          className={s.tabLink}
        >
          👥 Peserta
        </Link>
        <Link
          href={`/admin/doorprize/${eventId}/draw`}
          prefetch={false}
          className={s.tabLink}
        >
          🎲 Undian / Draw
        </Link>
        <Link
          href={`/admin/doorprize/${eventId}/results`}
          prefetch={false}
          className={s.tabLink}
        >
          🏆 Data Pemenang
        </Link>
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className={s.modalOverlay} onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h3 className={s.modalTitle}>⚠️ Hapus Event</h3>
            </div>
            <div className={s.modalBody}>
              <p className={s.modalText}>
                Apakah Anda yakin ingin menghapus event{" "}
                <strong>&quot;{event.name}&quot;</strong>?
              </p>
              <div className={s.modalWarning}>
                ⚠️ Tindakan ini tidak dapat dibatalkan. Semua hadiah, peserta,
                dan hasil undian terkait event ini akan ikut terhapus.
              </div>
            </div>
            <div className={s.modalFooter}>
              <button
                type="button"
                className={s.btnCancel}
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className={s.btnConfirmDelete}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "🗑️ Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Cropper Modal */}
      {cropperFile && (
        <ImageCropper
          file={cropperFile}
          aspectRatio={16 / 9}
          onCancel={() => setCropperFile(null)}
          onApply={(croppedFile) => {
            setEditImageFile(croppedFile);
            setEditImagePreview(URL.createObjectURL(croppedFile));
            setCropperFile(null);
          }}
        />
      )}
    </>
  );
}
