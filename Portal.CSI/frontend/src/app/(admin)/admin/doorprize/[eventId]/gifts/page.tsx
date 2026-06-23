"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useToast, ToastContainer } from "@/components/common/toast";
import {
  fetchGifts,
  createGift,
  createGiftWithImage,
  updateGift,
  updateGiftWithImage,
  deleteGift,
  fetchDoorprizeEventById,
} from "@/lib/doorprize-api";
import type { DoorprizeGift, DoorprizeEvent } from "@/types/doorprize";
import ImageCropper from "../../components/ImageCropper";
import baseStyles from "../../../page-mockup.module.css";
import styles from "./gifts.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GiftFormData {
  name: string;
  quota: number;
  giftBy: string;
  drawTime: string;
  displayOrder: number;
}

interface FormErrors {
  name?: string;
  quota?: string;
}

const EMPTY_FORM: GiftFormData = {
  name: "",
  quota: 1,
  giftBy: "",
  drawTime: "",
  displayOrder: 0,
};

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function GiftManagementPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;
  const router = useRouter();
  const { toasts, showToast, removeToast } = useToast();

  // Data state
  const [event, setEvent] = useState<DoorprizeEvent | null>(null);
  const [gifts, setGifts] = useState<DoorprizeGift[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<DoorprizeGift | null>(null);
  const [formData, setFormData] = useState<GiftFormData>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cropper state
  const [cropperFile, setCropperFile] = useState<File | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DoorprizeGift | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Data loading ───────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [eventRes, giftsRes] = await Promise.all([
      fetchDoorprizeEventById(eventId),
      fetchGifts(eventId),
    ]);

    if (!eventRes.success) {
      setError(eventRes.message);
      setLoading(false);
      return;
    }

    setEvent(eventRes.data);

    if (!giftsRes.success) {
      setError(giftsRes.message);
    } else {
      setGifts(giftsRes.data);
    }

    setLoading(false);
  }, [eventId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // ─── Form helpers ───────────────────────────────────────────
  function openCreateModal() {
    setEditingGift(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setImageFile(null);
    setImagePreview(null);
    setModalOpen(true);
  }

  function openEditModal(gift: DoorprizeGift) {
    setEditingGift(gift);
    setFormData({
      name: gift.name,
      quota: gift.quota,
      giftBy: gift.giftBy || "",
      drawTime: gift.drawTime || "",
      displayOrder: gift.displayOrder,
    });
    setFormErrors({});
    setImageFile(null);
    setImagePreview(gift.imageUrl || null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingGift(null);
    setFormData(EMPTY_FORM);
    setFormErrors({});
    setImageFile(null);
    setImagePreview(null);
  }

  function validateForm(): boolean {
    const errors: FormErrors = {};
    if (!formData.name.trim()) {
      errors.name = "Nama hadiah wajib diisi";
    }
    if (!formData.quota || formData.quota < 1 || !Number.isInteger(formData.quota)) {
      errors.quota = "Kuota harus bilangan bulat > 0";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function handleFieldChange(field: keyof GiftFormData, value: string | number) {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (field in formErrors) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Open cropper modal instead of directly setting the file
    setCropperFile(file);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleCropApply(croppedFile: File) {
    setImageFile(croppedFile);
    const url = URL.createObjectURL(croppedFile);
    setImagePreview(url);
    setCropperFile(null);
  }

  function handleCropCancel() {
    setCropperFile(null);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ─── Submit (create / edit) ─────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      if (editingGift) {
        // Update
        let result;
        if (imageFile) {
          const fd = new FormData();
          fd.append("name", formData.name.trim());
          fd.append("quota", String(formData.quota));
          if (formData.giftBy.trim()) fd.append("giftBy", formData.giftBy.trim());
          if (formData.drawTime.trim()) fd.append("drawTime", formData.drawTime.trim());
          fd.append("displayOrder", String(formData.displayOrder));
          fd.append("image", imageFile);
          result = await updateGiftWithImage(editingGift.doorprizeGiftId, fd);
        } else {
          result = await updateGift(editingGift.doorprizeGiftId, {
            name: formData.name.trim(),
            quota: formData.quota,
            giftBy: formData.giftBy.trim() || undefined,
            drawTime: formData.drawTime.trim() || undefined,
            displayOrder: formData.displayOrder,
          });
        }

        if (!result.success) {
          showToast("error", result.message);
          setSubmitting(false);
          return;
        }

        showToast("success", "Hadiah berhasil diperbarui");
      } else {
        // Create
        let result;
        if (imageFile) {
          const fd = new FormData();
          fd.append("name", formData.name.trim());
          fd.append("quota", String(formData.quota));
          if (formData.giftBy.trim()) fd.append("giftBy", formData.giftBy.trim());
          if (formData.drawTime.trim()) fd.append("drawTime", formData.drawTime.trim());
          fd.append("displayOrder", String(formData.displayOrder));
          fd.append("image", imageFile);
          result = await createGiftWithImage(eventId, fd);
        } else {
          result = await createGift(eventId, {
            name: formData.name.trim(),
            quota: formData.quota,
            giftBy: formData.giftBy.trim() || undefined,
            drawTime: formData.drawTime.trim() || undefined,
            displayOrder: formData.displayOrder,
          });
        }

        if (!result.success) {
          showToast("error", result.message);
          setSubmitting(false);
          return;
        }

        showToast("success", "Hadiah berhasil ditambahkan");
      }

      closeModal();
      await loadData();
    } catch {
      showToast("error", "Terjadi kesalahan");
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Delete ─────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await deleteGift(deleteTarget.doorprizeGiftId);

    if (!result.success) {
      showToast("error", result.message);
    } else {
      showToast("success", "Hadiah berhasil dihapus");
      await loadData();
    }

    setDeleting(false);
    setDeleteTarget(null);
  }

  // ─── Render ─────────────────────────────────────────────────
  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Page Header */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Manajemen Hadiah</h1>
          <p className={baseStyles.subtitle}>
            {event ? `Event: ${event.name}` : "Memuat..."}
          </p>
        </div>
        <div className={baseStyles.toolbar}>
          <button
            type="button"
            className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
            onClick={() => router.push(`/admin/doorprize/${eventId}`)}
          >
            ← Kembali
          </button>
          <button
            type="button"
            className={styles.btnCreate}
            onClick={openCreateModal}
          >
            + Tambah Hadiah
          </button>
        </div>
      </div>

      {/* Gift List Section */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionIcon}>🎁</div>
          <div className={styles.sectionTitleWrap}>
            <div className={styles.sectionTitle}>Daftar Hadiah</div>
            <div className={styles.sectionSubtitle}>
              Hadiah yang tersedia untuk undian
            </div>
          </div>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.countBadge}>{gifts.length} hadiah</span>
          </div>
        </div>

        {error && <div className={styles.errorText}>⚠️ {error}</div>}

        {loading ? (
          <div className={styles.loadingBar}>
            <div className={styles.spinner} />
            Memuat data hadiah...
          </div>
        ) : !error && gifts.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>🎁</div>
            <p className={styles.emptyTitle}>Belum ada hadiah</p>
            <p className={styles.emptyDesc}>
              Tambah hadiah untuk memulai undian doorprize.
            </p>
          </div>
        ) : !error ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Hadiah</th>
                  <th>Sponsor</th>
                  <th className={baseStyles.colCenter}>Kuota</th>
                  <th className={baseStyles.colCenter}>Terundi</th>
                  <th className={baseStyles.colCenter}>Sisa</th>
                  <th className={baseStyles.colCenter}>Waktu Undian</th>
                  <th className={baseStyles.colCenter}>Urutan</th>
                  <th className={baseStyles.colCenter}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {gifts.map((gift) => (
                  <tr key={gift.doorprizeGiftId}>
                    <td>
                      <div className={styles.giftNameCell}>
                        {gift.imageUrl && (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={gift.imageUrl}
                            alt={gift.name}
                            className={styles.giftThumb}
                          />
                        )}
                        <span className={styles.giftName}>{gift.name}</span>
                      </div>
                    </td>
                    <td>{gift.giftBy || "-"}</td>
                    <td className={styles.centered}>{gift.quota}</td>
                    <td className={styles.centered}>{gift.resultCount ?? 0}</td>
                    <td className={styles.centered}>
                      <span
                        className={
                          (gift.quotaRemaining ?? gift.quota) > 0
                            ? styles.quotaOk
                            : styles.quotaFull
                        }
                      >
                        {gift.quotaRemaining ?? gift.quota}
                      </span>
                    </td>
                    <td className={styles.centered}>{gift.drawTime || "-"}</td>
                    <td className={styles.centered}>{gift.displayOrder}</td>
                    <td className={styles.centered}>
                      <div className={styles.actionBtnRow}>
                        <button
                          type="button"
                          className={styles.btnEdit}
                          onClick={() => openEditModal(gift)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          className={styles.btnDelete}
                          onClick={() => setDeleteTarget(gift)}
                        >
                          🗑️ Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* ─── Gift Form Modal ─────────────────────────────────── */}
      {modalOpen && (
        <div className={baseStyles.modalOverlay} onClick={closeModal}>
          <div
            className={baseStyles.modalCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={baseStyles.modalHeader}>
              <h2 className={baseStyles.modalTitle}>
                {editingGift ? "Edit Hadiah" : "Tambah Hadiah"}
              </h2>
              <button
                type="button"
                className={baseStyles.modalClose}
                onClick={closeModal}
                aria-label="Tutup"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className={baseStyles.modalBody}>
                {/* Name */}
                <div className={baseStyles.formGroup}>
                  <label className={baseStyles.label} htmlFor="gift-name">
                    Nama Hadiah <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="gift-name"
                    type="text"
                    className={`${baseStyles.input} ${formErrors.name ? styles.inputError : ""}`}
                    value={formData.name}
                    onChange={(e) => handleFieldChange("name", e.target.value)}
                    placeholder="Masukkan nama hadiah"
                    maxLength={500}
                  />
                  {formErrors.name && (
                    <span className={styles.errorMsg}>{formErrors.name}</span>
                  )}
                </div>

                {/* Quota */}
                <div className={baseStyles.formGroup}>
                  <label className={baseStyles.label} htmlFor="gift-quota">
                    Kuota <span className={styles.required}>*</span>
                  </label>
                  <input
                    id="gift-quota"
                    type="number"
                    min={1}
                    step={1}
                    className={`${baseStyles.input} ${formErrors.quota ? styles.inputError : ""}`}
                    value={formData.quota}
                    onChange={(e) =>
                      handleFieldChange("quota", parseInt(e.target.value, 10) || 0)
                    }
                    placeholder="1"
                  />
                  {formErrors.quota && (
                    <span className={styles.errorMsg}>{formErrors.quota}</span>
                  )}
                </div>

                {/* Gift By (sponsor) */}
                <div className={baseStyles.formGroup}>
                  <label className={baseStyles.label} htmlFor="gift-by">
                    Sponsor / Pemberi
                  </label>
                  <input
                    id="gift-by"
                    type="text"
                    className={baseStyles.input}
                    value={formData.giftBy}
                    onChange={(e) => handleFieldChange("giftBy", e.target.value)}
                    placeholder="Nama sponsor (opsional)"
                    maxLength={200}
                  />
                </div>

                {/* Draw Time */}
                <div className={baseStyles.formGroup}>
                  <label className={baseStyles.label} htmlFor="gift-draw-time">
                    Waktu Undian
                  </label>
                  <input
                    id="gift-draw-time"
                    type="text"
                    className={baseStyles.input}
                    value={formData.drawTime}
                    onChange={(e) => handleFieldChange("drawTime", e.target.value)}
                    placeholder="Masukkan sesi atau waktu"
                    maxLength={100}
                  />
                </div>

                {/* Display Order */}
                <div className={baseStyles.formGroup}>
                  <label className={baseStyles.label} htmlFor="gift-order">
                    Urutan Tampil
                  </label>
                  <input
                    id="gift-order"
                    type="number"
                    min={0}
                    step={1}
                    className={baseStyles.input}
                    value={formData.displayOrder}
                    onChange={(e) =>
                      handleFieldChange("displayOrder", parseInt(e.target.value, 10) || 0)
                    }
                  />
                </div>

                {/* Image Upload */}
                <div className={baseStyles.formGroup}>
                  <label className={baseStyles.label}>Gambar Hadiah</label>
                  <div className={styles.uploadArea}>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className={styles.fileInputHidden}
                      onChange={handleImageChange}
                      id="gift-image"
                    />
                    <label htmlFor="gift-image" className={styles.uploadTrigger}>
                      📁 Pilih Gambar
                    </label>
                    {imageFile && (
                      <span className={styles.fileName}>
                        {imageFile.name}
                        <button
                          type="button"
                          className={styles.clearBtn}
                          onClick={clearImage}
                          aria-label="Hapus gambar"
                        >
                          ×
                        </button>
                      </span>
                    )}
                  </div>
                  {imagePreview && (
                    <div className={styles.previewWrap}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className={styles.previewImg}
                      />
                    </div>
                  )}
                  <span className={styles.hint}>
                    Format: JPEG, PNG, WebP. Maks 5 MB.
                  </span>
                </div>
              </div>

              <div className={baseStyles.modalFooter}>
                <button
                  type="button"
                  className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`${baseStyles.btn} ${baseStyles.btnPrimary}`}
                  disabled={submitting}
                >
                  {submitting
                    ? "Menyimpan..."
                    : editingGift
                      ? "Simpan Perubahan"
                      : "Tambah Hadiah"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ────────────────────────── */}
      {deleteTarget && (
        <div
          className={baseStyles.modalOverlay}
          onClick={() => !deleting && setDeleteTarget(null)}
        >
          <div
            className={styles.confirmCard}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.confirmIcon}>⚠️</div>
            <h3 className={styles.confirmTitle}>Hapus Hadiah?</h3>
            <p className={styles.confirmDesc}>
              Hadiah <strong>{deleteTarget.name}</strong> akan dihapus permanen.
              Data yang sudah terundi akan ikut terhapus.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className={`${baseStyles.btn} ${baseStyles.btnDanger}`}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Image Cropper Modal ──────────────────────────────── */}
      {cropperFile && (
        <ImageCropper
          file={cropperFile}
          aspectRatio={1}
          onCancel={handleCropCancel}
          onApply={handleCropApply}
        />
      )}
    </>
  );
}
