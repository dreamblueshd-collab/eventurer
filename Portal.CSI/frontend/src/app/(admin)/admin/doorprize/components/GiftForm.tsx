"use client";

import { useState, useRef, useEffect } from "react";
import type { DoorprizeGift } from "@/types/doorprize";
import styles from "./components.module.css";

export interface GiftFormData {
  name: string;
  quota: number;
  giftBy: string;
  drawTime: string;
  displayOrder: number;
  imageFile: File | null;
}

interface GiftFormProps {
  /** Pass existing gift data to enter edit mode */
  gift?: DoorprizeGift | null;
  /** Called with form data on valid submit */
  onSubmit: (data: GiftFormData) => void | Promise<void>;
  /** Called when user cancels / closes the modal */
  onCancel: () => void;
  /** Whether submission is in progress (disables submit button) */
  submitting?: boolean;
}

interface FormErrors {
  name?: string;
  quota?: string;
}

export default function GiftForm({
  gift,
  onSubmit,
  onCancel,
  submitting = false,
}: GiftFormProps) {
  const isEdit = !!gift;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState(gift?.name ?? "");
  const [quota, setQuota] = useState(String(gift?.quota ?? 1));
  const [giftBy, setGiftBy] = useState(gift?.giftBy ?? "");
  const [drawTime, setDrawTime] = useState(gift?.drawTime ?? "");
  const [displayOrder, setDisplayOrder] = useState(
    String(gift?.displayOrder ?? 0),
  );
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    gift?.imageUrl ?? null,
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // Focus first input on mount
  useEffect(() => {
    const el = document.getElementById("gift-name");
    if (el) el.focus();
  }, []);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = "Nama hadiah wajib diisi";
    }

    const quotaNum = Number(quota);
    if (!quota || isNaN(quotaNum) || quotaNum < 1 || !Number.isInteger(quotaNum)) {
      newErrors.quota = "Kuota harus bilangan bulat > 0";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function clearImage() {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    onSubmit({
      name: name.trim(),
      quota: Number(quota),
      giftBy: giftBy.trim(),
      drawTime: drawTime.trim(),
      displayOrder: Number(displayOrder) || 0,
      imageFile,
    });
  }

  return (
    <div
      className={styles.modalOverlay}
      onClick={onCancel}
      role="presentation"
    >
      <div
        className={styles.modalCard}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gift-form-title"
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalIcon}>🎁</div>
          <h2 id="gift-form-title" className={styles.modalTitle}>
            {isEdit ? "Edit Hadiah" : "Tambah Hadiah"}
          </h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onCancel}
            aria-label="Tutup"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            {/* Name */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="gift-name">
                Nama Hadiah <span className={styles.required}>*</span>
              </label>
              <input
                id="gift-name"
                type="text"
                className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name)
                    setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Masukkan nama hadiah"
                maxLength={500}
              />
              {errors.name && (
                <span className={styles.errorMsg}>{errors.name}</span>
              )}
            </div>

            {/* Quota + Display Order */}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="gift-quota">
                  Kuota <span className={styles.required}>*</span>
                </label>
                <input
                  id="gift-quota"
                  type="number"
                  min={1}
                  step={1}
                  className={`${styles.input} ${errors.quota ? styles.inputError : ""}`}
                  value={quota}
                  onChange={(e) => {
                    setQuota(e.target.value);
                    if (errors.quota)
                      setErrors((prev) => ({ ...prev, quota: undefined }));
                  }}
                  placeholder="1"
                />
                {errors.quota && (
                  <span className={styles.errorMsg}>{errors.quota}</span>
                )}
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="gift-order">
                  Urutan Tampil
                </label>
                <input
                  id="gift-order"
                  type="number"
                  min={0}
                  step={1}
                  className={styles.input}
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>

            {/* Gift By */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="gift-by">
                Sponsor / Pemberi
              </label>
              <input
                id="gift-by"
                type="text"
                className={styles.input}
                value={giftBy}
                onChange={(e) => setGiftBy(e.target.value)}
                placeholder="Masukkan nama sponsor"
                maxLength={200}
              />
            </div>

            {/* Draw Time */}
            <div className={styles.field}>
              <label className={styles.label} htmlFor="gift-draw-time">
                Waktu Draw
              </label>
              <input
                id="gift-draw-time"
                type="text"
                className={styles.input}
                value={drawTime}
                onChange={(e) => setDrawTime(e.target.value)}
                placeholder="Masukkan sesi atau waktu"
                maxLength={100}
              />
            </div>

            {/* Image */}
            <div className={styles.field}>
              <label className={styles.label}>Gambar Hadiah</label>
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
                    alt="Preview hadiah"
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
          <div className={styles.modalFooter}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onCancel}
              disabled={submitting}
            >
              Batal
            </button>
            <button
              type="submit"
              className={styles.btnSubmit}
              disabled={submitting}
            >
              {submitting
                ? "Menyimpan..."
                : isEdit
                  ? "Simpan Perubahan"
                  : "Tambah Hadiah"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
