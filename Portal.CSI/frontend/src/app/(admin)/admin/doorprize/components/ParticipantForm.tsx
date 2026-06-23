"use client";

import { useState, useRef, useEffect } from "react";
import type { DoorprizeParticipant } from "@/types/doorprize";
import styles from "./components.module.css";

export interface ParticipantFormData {
  name: string;
  employeeCode: string;
  phone: string;
  email: string;
  unit: string;
  isActive: boolean;
  imageFile: File | null;
}

interface ParticipantFormProps {
  /** Pass existing participant data to enter edit mode */
  participant?: DoorprizeParticipant | null;
  /** Called with form data on valid submit */
  onSubmit: (data: ParticipantFormData) => void | Promise<void>;
  /** Called when user cancels / closes the modal */
  onCancel: () => void;
  /** Whether submission is in progress (disables submit button) */
  submitting?: boolean;
}

interface FormErrors {
  name?: string;
  email?: string;
}

export default function ParticipantForm({
  participant,
  onSubmit,
  onCancel,
  submitting = false,
}: ParticipantFormProps) {
  const isEdit = !!participant;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const [name, setName] = useState(participant?.name ?? "");
  const [employeeCode, setEmployeeCode] = useState(
    participant?.employeeCode ?? "",
  );
  const [phone, setPhone] = useState(participant?.phone ?? "");
  const [email, setEmail] = useState(participant?.email ?? "");
  const [unit, setUnit] = useState(participant?.unit ?? "");
  const [isActive, setIsActive] = useState(participant?.isActive ?? true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(
    participant?.imageUrl ?? null,
  );
  const [errors, setErrors] = useState<FormErrors>({});

  // Focus first input on mount
  useEffect(() => {
    const el = document.getElementById("participant-name");
    if (el) el.focus();
  }, []);

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = "Nama peserta wajib diisi";
    }

    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = "Format email tidak valid";
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
      employeeCode: employeeCode.trim(),
      phone: phone.trim(),
      email: email.trim(),
      unit: unit.trim(),
      isActive,
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
        aria-labelledby="participant-form-title"
      >
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.modalIcon}>👤</div>
          <h2 id="participant-form-title" className={styles.modalTitle}>
            {isEdit ? "Edit Peserta" : "Tambah Peserta"}
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
              <label className={styles.label} htmlFor="participant-name">
                Nama <span className={styles.required}>*</span>
              </label>
              <input
                id="participant-name"
                type="text"
                className={`${styles.input} ${errors.name ? styles.inputError : ""}`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name)
                    setErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Nama lengkap peserta"
                maxLength={200}
              />
              {errors.name && (
                <span className={styles.errorMsg}>{errors.name}</span>
              )}
            </div>

            {/* Employee Code + Unit */}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="participant-code">
                  Kode Karyawan
                </label>
                <input
                  id="participant-code"
                  type="text"
                  className={styles.input}
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Masukkan kode peserta"
                  maxLength={50}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="participant-unit">
                  Unit / Departemen
                </label>
                <input
                  id="participant-unit"
                  type="text"
                  className={styles.input}
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  placeholder="Masukkan unit peserta"
                  maxLength={200}
                />
              </div>
            </div>

            {/* Phone + Email */}
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="participant-phone">
                  Telepon
                </label>
                <input
                  id="participant-phone"
                  type="tel"
                  className={styles.input}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                  maxLength={50}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="participant-email">
                  Email
                </label>
                <input
                  id="participant-email"
                  type="email"
                  className={`${styles.input} ${errors.email ? styles.inputError : ""}`}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email)
                      setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="peserta@example.com"
                  maxLength={255}
                />
                {errors.email && (
                  <span className={styles.errorMsg}>{errors.email}</span>
                )}
              </div>
            </div>

            {/* IsActive toggle */}
            <div className={styles.field}>
              <div className={styles.checkRow}>
                <input
                  id="participant-active"
                  type="checkbox"
                  className={styles.checkbox}
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label
                  className={styles.checkLabel}
                  htmlFor="participant-active"
                >
                  Peserta aktif (eligible untuk undian)
                </label>
              </div>
            </div>

            {/* Image */}
            <div className={styles.field}>
              <label className={styles.label}>Foto Peserta</label>
              <div className={styles.uploadArea}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className={styles.fileInputHidden}
                  onChange={handleImageChange}
                  id="participant-image"
                />
                <label
                  htmlFor="participant-image"
                  className={styles.uploadTrigger}
                >
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
                    alt="Preview peserta"
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
                  : "Tambah Peserta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
