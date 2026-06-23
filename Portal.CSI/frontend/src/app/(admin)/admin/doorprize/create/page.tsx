"use client";

import { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast, ToastContainer } from "@/components/common/toast";
import DatePicker from "@/components/common/date-picker";
import {
  createDoorprizeEvent,
  createDoorprizeEventWithImage,
} from "@/lib/doorprize-api";
import type { DoorprizeEventStatus } from "@/types/doorprize";
import ImageCropper from "../components/ImageCropper";
import baseStyles from "../../page-mockup.module.css";
import styles from "./create.module.css";

interface FormErrors {
  name?: string;
  eventDate?: string;
}

export default function DoorprizeCreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parentEventId = searchParams.get("parentEventId");
  const { toasts, showToast, removeToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [status, setStatus] = useState<DoorprizeEventStatus>("Draft");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Cropper state
  const [cropperFile, setCropperFile] = useState<File | null>(null);

  // UI state
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = "Nama event wajib diisi";
    }

    if (!eventDate) {
      newErrors.eventDate = "Tanggal event wajib diisi";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Open cropper modal instead of directly setting the file
    setCropperFile(file);

    // Reset input so the same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (submitting) return;
    if (!validate()) return;

    setSubmitting(true);

    try {
      let result;

      if (imageFile) {
        const formData = new FormData();
        formData.append("name", name.trim());
        formData.append("eventDate", eventDate.includes("T") ? eventDate : eventDate.replace(" ", "T") + ":00");
        formData.append("status", status);
        formData.append("image", imageFile);
        if (parentEventId) formData.append("parentEventId", parentEventId);
        result = await createDoorprizeEventWithImage(formData);
      } else {
        result = await createDoorprizeEvent({
          name: name.trim(),
          eventDate: eventDate.includes("T") ? eventDate : eventDate.replace(" ", "T") + ":00",
          status,
          parentEventId: parentEventId ? Number(parentEventId) : undefined,
        });
      }

      if (!result.success) {
        showToast("error", result.message || "Gagal membuat event doorprize");
        setSubmitting(false);
        return;
      }

      showToast("success", "Event doorprize berhasil dibuat");
      const createdEventId = result.data.doorprizeEventId;
      router.push(`/admin/doorprize/${createdEventId}`);
    } catch {
      showToast("error", "Terjadi kesalahan saat membuat event");
      setSubmitting(false);
    }
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Buat Event Doorprize</h1>
          <p className={baseStyles.subtitle}>
            Lengkapi form di bawah untuk membuat event doorprize baru
          </p>
        </div>
        <div className={baseStyles.toolbar}>
          <button
            type="button"
            className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
            onClick={() => router.push(parentEventId ? `/admin/event-management/${parentEventId}` : "/admin/event-management")}
          >
            ← Kembali
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className={styles.formCard}>
        <div className={styles.formBody}>
          {/* Name */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="dp-name">
              Nama Event <span className={styles.required}>*</span>
            </label>
            <input
              id="dp-name"
              type="text"
              className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder="Masukkan nama event doorprize"
              maxLength={500}
            />
            {errors.name && <span className={styles.errorMsg}>{errors.name}</span>}
          </div>

          {/* Event Date */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="dp-date">
              Tanggal Event <span className={styles.required}>*</span>
            </label>
            <DatePicker
              id="dp-date"
              mode="datetime"
              value={eventDate}
              onChange={(val) => {
                setEventDate(val);
                if (errors.eventDate) setErrors((prev) => ({ ...prev, eventDate: undefined }));
              }}
              placeholder="Pilih tanggal dan waktu event"
              className={errors.eventDate ? styles.inputError : ""}
            />
            {errors.eventDate && <span className={styles.errorMsg}>{errors.eventDate}</span>}
          </div>

          {/* Status */}
          <div className={styles.field}>
            <label className={styles.label} htmlFor="dp-status">
              Status
            </label>
            <select
              id="dp-status"
              className={styles.select}
              value={status}
              onChange={(e) => setStatus(e.target.value as DoorprizeEventStatus)}
            >
              <option value="Draft">Draft</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="Archived">Archived</option>
            </select>
          </div>

          {/* Image Upload */}
          <div className={styles.field}>
            <label className={styles.label}>Gambar / Banner</label>
            <div className={styles.uploadArea}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className={styles.fileInputHidden}
                onChange={handleImageChange}
                id="dp-image"
              />
              <label htmlFor="dp-image" className={styles.uploadTrigger}>
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

        {/* Footer */}
        <div className={styles.formFooter}>
          <button
            type="button"
            className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
            onClick={() => router.push(parentEventId ? `/admin/event-management/${parentEventId}` : "/admin/event-management")}
            disabled={submitting}
          >
            Batal
          </button>
          <button
            type="submit"
            className={`${baseStyles.btn} ${baseStyles.btnPrimary}`}
            disabled={submitting}
          >
            {submitting ? "Menyimpan..." : "Simpan Event"}
          </button>
        </div>
      </form>

      {/* Image Cropper Modal */}
      {cropperFile && (
        <ImageCropper
          file={cropperFile}
          aspectRatio={16 / 9}
          onCancel={handleCropCancel}
          onApply={handleCropApply}
        />
      )}
    </>
  );
}
