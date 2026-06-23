"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useToast, ToastContainer } from "@/components/common/toast";
import ImageCropper from "../../components/ImageCropper";
import {
  fetchParticipants,
  createParticipant,
  createParticipantWithImage,
  updateParticipant,
  updateParticipantWithImage,
  deleteParticipant,
} from "@/lib/doorprize-api";
import type { DoorprizeParticipant } from "@/types/doorprize";
import { Pagination } from "@/components/admin/pagination";
import baseStyles from "../../../page-mockup.module.css";
import s from "./participants.module.css";

interface ParticipantFormData {
  name: string;
  employeeCode: string;
  phone: string;
  email: string;
  unit: string;
  isActive: boolean;
  image: File | null;
}

const emptyForm: ParticipantFormData = {
  name: "",
  employeeCode: "",
  phone: "",
  email: "",
  unit: "",
  isActive: true,
  image: null,
};

export default function ParticipantsPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { toasts, showToast, removeToast } = useToast();

  // Data state
  const [participants, setParticipants] = useState<DoorprizeParticipant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<DoorprizeParticipant | null>(null);
  const [formData, setFormData] = useState<ParticipantFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<{ name?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<DoorprizeParticipant | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Toggle active state
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Image cropper state
  const participantFileRef = useRef<HTMLInputElement>(null);
  const [cropperFile, setCropperFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // ─── Load participants ───
  const loadParticipants = useCallback(async () => {
    setLoading(true);
    setError("");

    const params: { page?: number; limit?: number; search?: string; isActive?: boolean } = {
      page,
      limit: pageSize,
    };

    if (appliedSearch.trim()) {
      params.search = appliedSearch.trim();
    }
    if (activeFilter !== "all") {
      params.isActive = activeFilter === "active";
    }

    const result = await fetchParticipants(eventId, params);

    if (!result.success) {
      setError(result.message);
      setParticipants([]);
      setTotal(0);
    } else {
      setParticipants(result.data.participants);
      setTotal(result.data.total);
    }

    setLoading(false);
  }, [eventId, page, pageSize, appliedSearch, activeFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadParticipants();
  }, [loadParticipants]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ─── Search handlers ───
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setPage(1);
      setAppliedSearch(search);
    }
  };

  const handleSearchBlur = () => {
    if (search !== appliedSearch) {
      setPage(1);
      setAppliedSearch(search);
    }
  };

  // ─── Modal handlers ───
  function openCreateModal() {
    setEditingParticipant(null);
    setFormData(emptyForm);
    setFormErrors({});
    setShowModal(true);
  }

  function openEditModal(p: DoorprizeParticipant) {
    setEditingParticipant(p);
    setFormData({
      name: p.name,
      employeeCode: p.employeeCode || "",
      phone: p.phone || "",
      email: p.email || "",
      unit: p.unit || "",
      isActive: p.isActive,
      image: null,
    });
    setFormErrors({});
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingParticipant(null);
    setFormData(emptyForm);
    setFormErrors({});
  }

  function validateForm(): boolean {
    const errors: { name?: string } = {};
    if (!formData.name.trim()) {
      errors.name = "Nama peserta wajib diisi";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);

    try {
      if (editingParticipant) {
        // Update
        let result;
        if (formData.image) {
          const fd = new FormData();
          fd.append("name", formData.name.trim());
          if (formData.employeeCode) fd.append("employeeCode", formData.employeeCode.trim());
          if (formData.phone) fd.append("phone", formData.phone.trim());
          if (formData.email) fd.append("email", formData.email.trim());
          if (formData.unit) fd.append("unit", formData.unit.trim());
          fd.append("isActive", String(formData.isActive));
          fd.append("image", formData.image);
          result = await updateParticipantWithImage(editingParticipant.doorprizeParticipantId, fd);
        } else {
          result = await updateParticipant(editingParticipant.doorprizeParticipantId, {
            name: formData.name.trim(),
            employeeCode: formData.employeeCode.trim() || undefined,
            phone: formData.phone.trim() || undefined,
            email: formData.email.trim() || undefined,
            unit: formData.unit.trim() || undefined,
            isActive: formData.isActive,
          });
        }

        if (!result.success) {
          showToast("error", result.message);
        } else {
          showToast("success", "Peserta berhasil diperbarui");
          closeModal();
          void loadParticipants();
        }
      } else {
        // Create
        let result;
        if (formData.image) {
          const fd = new FormData();
          fd.append("name", formData.name.trim());
          if (formData.employeeCode) fd.append("employeeCode", formData.employeeCode.trim());
          if (formData.phone) fd.append("phone", formData.phone.trim());
          if (formData.email) fd.append("email", formData.email.trim());
          if (formData.unit) fd.append("unit", formData.unit.trim());
          fd.append("isActive", String(formData.isActive));
          fd.append("image", formData.image);
          result = await createParticipantWithImage(eventId, fd);
        } else {
          result = await createParticipant(eventId, {
            name: formData.name.trim(),
            employeeCode: formData.employeeCode.trim() || undefined,
            phone: formData.phone.trim() || undefined,
            email: formData.email.trim() || undefined,
            unit: formData.unit.trim() || undefined,
            isActive: formData.isActive,
          });
        }

        if (!result.success) {
          showToast("error", result.message);
        } else {
          showToast("success", "Peserta berhasil ditambahkan");
          closeModal();
          void loadParticipants();
        }
      }
    } catch {
      showToast("error", "Terjadi kesalahan");
    }

    setSubmitting(false);
  }

  // ─── Delete handler ───
  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const result = await deleteParticipant(deleteTarget.doorprizeParticipantId);
    if (!result.success) {
      showToast("error", result.message);
    } else {
      showToast("success", "Peserta berhasil dihapus");
      void loadParticipants();
    }

    setDeleting(false);
    setDeleteTarget(null);
  }

  // ─── Toggle isActive ───
  async function handleToggleActive(p: DoorprizeParticipant) {
    setTogglingId(p.doorprizeParticipantId);

    const result = await updateParticipant(p.doorprizeParticipantId, {
      isActive: !p.isActive,
    });

    if (!result.success) {
      showToast("error", result.message);
    } else {
      showToast("success", `Peserta ${!p.isActive ? "diaktifkan" : "dinonaktifkan"}`);
      void loadParticipants();
    }

    setTogglingId(null);
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Page Header ── */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Peserta Doorprize</h1>
          <p className={baseStyles.subtitle}>Kelola daftar peserta untuk event doorprize ini</p>
        </div>
        <div className={baseStyles.toolbar}>
          <Link
            href={`/admin/doorprize/${eventId}`}
            prefetch={false}
            className={`${baseStyles.btn} ${baseStyles.btnSecondary}`}
          >
            ← Kembali
          </Link>
          <Link
            href={`/admin/doorprize/${eventId}/participants/import`}
            prefetch={false}
            className={s.btnImport}
          >
            📥 Import Excel
          </Link>
          <button type="button" className={s.btnCreate} onClick={openCreateModal}>
            + Tambah Peserta
          </button>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className={s.filterCard}>
        <div className={s.filterHeader}>
          <span className={s.filterIcon}>🔍</span>
          <span className={s.filterTitle}>Filter &amp; Pencarian</span>
        </div>
        <div className={s.filterRow}>
          <div className={`${s.filterGroup} ${s.filterGroupSm}`}>
            <label className={s.filterLabel} htmlFor="pt-active-filter">
              Status
            </label>
            <select
              id="pt-active-filter"
              className={s.filterSelect}
              value={activeFilter}
              onChange={(e) => {
                setPage(1);
                setActiveFilter(e.target.value);
              }}
            >
              <option value="all">Semua</option>
              <option value="active">Aktif</option>
              <option value="inactive">Tidak Aktif</option>
            </select>
          </div>
          <div className={`${s.filterGroup} ${s.searchGroup}`}>
            <label className={s.filterLabel} htmlFor="pt-search">
              Cari Peserta
            </label>
            <input
              id="pt-search"
              type="text"
              className={s.searchInput}
              placeholder="Cari nama, kode, atau unit..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={handleSearchBlur}
            />
          </div>
        </div>
      </div>

      {/* ── Participant Table ── */}
      <div className={s.sectionCard} style={{ animationDelay: "0.10s" }}>
        <div className={s.sectionHeader}>
          <div className={s.sectionIcon}>👥</div>
          <div className={s.sectionTitleWrap}>
            <div className={s.sectionTitle}>Daftar Peserta</div>
            <div className={s.sectionSubtitle}>Semua peserta yang terdaftar dalam event ini</div>
          </div>
          <div className={s.sectionHeaderRight}>
            <span className={s.countBadge}>{total} peserta</span>
          </div>
        </div>

        {error && <div className={s.errorText}>⚠️ {error}</div>}

        {loading ? (
          <div className={s.loadingBar}>
            <div className={s.spinner} />
            Memuat data peserta...
          </div>
        ) : !error && participants.length === 0 ? (
          <div className={s.emptyState}>
            <div className={s.emptyIcon}>👥</div>
            <p className={s.emptyTitle}>Belum ada peserta</p>
            <p className={s.emptyDesc}>Tambahkan peserta atau import dari file Excel.</p>
          </div>
        ) : !error ? (
          <>
            {/* ── Pagination (Top) ── */}
            <Pagination
              instanceId="top"
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={pageSize}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />

            <div className={s.tableWrap}>
              <table className={s.table}>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th className={baseStyles.colCenter}>Kode Karyawan</th>
                    <th>Unit</th>
                    <th className={baseStyles.colCenter}>Telepon</th>
                    <th className={baseStyles.colCenter}>Status</th>
                    <th className={baseStyles.colCenter}>Pemenang</th>
                    <th className={baseStyles.colCenter}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((p) => (
                    <tr key={p.doorprizeParticipantId}>
                      <td className={s.cellName}>{p.name}</td>
                      <td className={baseStyles.colCenter}>{p.employeeCode || <span className={s.textMuted}>-</span>}</td>
                      <td>{p.unit || <span className={s.textMuted}>-</span>}</td>
                      <td className={baseStyles.colCenter}>{p.phone || <span className={s.textMuted}>-</span>}</td>
                      <td className={baseStyles.colCenter}>
                        <button
                          type="button"
                          className={`${s.toggleBtn} ${p.isActive ? s.toggleOn : s.toggleOff}`}
                          onClick={() => handleToggleActive(p)}
                          disabled={togglingId === p.doorprizeParticipantId}
                          title={p.isActive ? "Nonaktifkan" : "Aktifkan"}
                        >
                          <span className={s.toggleThumb} />
                        </button>
                      </td>
                      <td className={baseStyles.colCenter}>
                        {p.hasWon ? (
                          <span className={s.wonBadge}>🏆 Menang</span>
                        ) : (
                          <span className={s.textMuted}>-</span>
                        )}
                      </td>
                      <td className={baseStyles.colCenter}>
                        <div className={s.actionBtnRow}>
                          <button
                            type="button"
                            className={s.btnEdit}
                            onClick={() => openEditModal(p)}
                            title="Edit"
                          >
                            ✏️ Edit
                          </button>
                          <button
                            type="button"
                            className={s.btnDelete}
                            onClick={() => setDeleteTarget(p)}
                            title="Hapus"
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

            {/* ── Pagination (Bottom) ── */}
            <Pagination
              instanceId="bottom"
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              itemsPerPage={pageSize}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </>
        ) : null}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className={s.modalOverlay} onClick={closeModal}>
          <div className={s.modalCard} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>
                {editingParticipant ? "Edit Peserta" : "Tambah Peserta"}
              </h2>
              <button type="button" className={s.modalClose} onClick={closeModal}>
                ×
              </button>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className={s.modalBody}>
                {/* Name */}
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="pf-name">
                    Nama <span className={s.required}>*</span>
                  </label>
                  <input
                    id="pf-name"
                    type="text"
                    className={`${s.fieldInput} ${formErrors.name ? s.inputError : ""}`}
                    value={formData.name}
                    onChange={(e) => {
                      setFormData((prev) => ({ ...prev, name: e.target.value }));
                      if (formErrors.name) setFormErrors({});
                    }}
                    placeholder="Nama lengkap peserta"
                    maxLength={200}
                  />
                  {formErrors.name && <span className={s.errorMsg}>{formErrors.name}</span>}
                </div>

                {/* Employee Code */}
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="pf-code">
                    Kode Karyawan
                  </label>
                  <input
                    id="pf-code"
                    type="text"
                    className={s.fieldInput}
                    value={formData.employeeCode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, employeeCode: e.target.value }))}
                    placeholder="Opsional"
                    maxLength={50}
                  />
                </div>

                {/* Phone */}
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="pf-phone">
                    Telepon
                  </label>
                  <input
                    id="pf-phone"
                    type="text"
                    className={s.fieldInput}
                    value={formData.phone}
                    onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Opsional"
                    maxLength={50}
                  />
                </div>

                {/* Email */}
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="pf-email">
                    Email
                  </label>
                  <input
                    id="pf-email"
                    type="email"
                    className={s.fieldInput}
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="Opsional"
                    maxLength={255}
                  />
                </div>

                {/* Unit */}
                <div className={s.field}>
                  <label className={s.fieldLabel} htmlFor="pf-unit">
                    Unit
                  </label>
                  <input
                    id="pf-unit"
                    type="text"
                    className={s.fieldInput}
                    value={formData.unit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="Opsional"
                    maxLength={200}
                  />
                </div>

                {/* IsActive */}
                <div className={s.field}>
                  <label className={s.fieldLabel}>Status Aktif</label>
                  <div className={s.checkboxRow}>
                    <input
                      id="pf-active"
                      type="checkbox"
                      checked={formData.isActive}
                      onChange={(e) => setFormData((prev) => ({ ...prev, isActive: e.target.checked }))}
                    />
                    <label htmlFor="pf-active" className={s.checkboxLabel}>
                      Peserta aktif (eligible untuk draw)
                    </label>
                  </div>
                </div>

                {/* Image */}
                <div className={s.field}>
                  <label className={s.fieldLabel}>Foto</label>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                    <input
                      ref={participantFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: "none" }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setCropperFile(file);
                        if (participantFileRef.current) participantFileRef.current.value = "";
                      }}
                      id="pf-image"
                    />
                    <label htmlFor="pf-image" style={{ display: "inline-flex", alignItems: "center", gap: "5px", border: "1px solid #d1d5db", borderRadius: "8px", background: "#fff", color: "#374151", fontSize: "13px", fontWeight: 600, padding: "8px 14px", cursor: "pointer" }}>
                      📁 Pilih Gambar
                    </label>
                    {formData.image && (
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>{formData.image.name}</span>
                    )}
                  </div>
                  {imagePreview && (
                    <div style={{ marginTop: "8px", borderRadius: "50%", overflow: "hidden", width: "80px", height: "80px", border: "2px solid #e5e7eb" }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={imagePreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </div>
                  )}
                  <span className={s.hint}>Format: JPEG, PNG, WebP. Maks 5 MB.</span>
                </div>
              </div>

              <div className={s.modalFooter}>
                <button
                  type="button"
                  className={s.btnCancel}
                  onClick={closeModal}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button type="submit" className={s.btnSubmit} disabled={submitting}>
                  {submitting ? "Menyimpan..." : editingParticipant ? "Simpan Perubahan" : "Tambah Peserta"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget && (
        <div className={s.modalOverlay} onClick={() => setDeleteTarget(null)}>
          <div className={s.modalCardSm} onClick={(e) => e.stopPropagation()}>
            <div className={s.modalHeader}>
              <h2 className={s.modalTitle}>Konfirmasi Hapus</h2>
              <button type="button" className={s.modalClose} onClick={() => setDeleteTarget(null)}>
                ×
              </button>
            </div>
            <div className={s.modalBody}>
              <p className={s.confirmText}>
                Apakah Anda yakin ingin menghapus peserta <strong>{deleteTarget.name}</strong>?
                Tindakan ini tidak dapat dibatalkan.
              </p>
            </div>
            <div className={s.modalFooter}>
              <button
                type="button"
                className={s.btnCancel}
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Batal
              </button>
              <button
                type="button"
                className={s.btnDanger}
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? "Menghapus..." : "Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Image Cropper Modal ── */}
      {cropperFile && (
        <ImageCropper
          file={cropperFile}
          aspectRatio={1}
          onCancel={() => setCropperFile(null)}
          onApply={(croppedFile) => {
            setFormData((prev) => ({ ...prev, image: croppedFile }));
            setImagePreview(URL.createObjectURL(croppedFile));
            setCropperFile(null);
          }}
        />
      )}
    </>
  );
}
