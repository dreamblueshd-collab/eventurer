"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Dropdown } from "@/components/common/dropdown";
import { ToastContainer, useToast } from "@/components/common/toast";
import {
  createBusinessUnitMaster,
  downloadBusinessUnitTemplate,
  fetchBusinessUnitsMaster,
  updateBusinessUnitMaster,
  uploadBusinessUnitFile,
  type BusinessUnitMaster,
} from "@/lib/master-data";
import styles from "../page-mockup.module.css";

type FilterStatus = "all" | "active" | "inactive";

function matchesSearch(item: BusinessUnitMaster, searchBy: string, keyword: string): boolean {
  const term = keyword.trim().toLowerCase();
  if (!term) return true;
  if (searchBy === "code") return String(item.Code || "").includes(term);
  if (searchBy === "name") return (item.Name || "").toLowerCase().includes(term);
  return String(item.Code || "").includes(term) || (item.Name || "").toLowerCase().includes(term);
}

export default function MasterBUPage() {
  const [rows, setRows] = useState<BusinessUnitMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [uploadFileName, setUploadFileName] = useState("No file chosen");
  const [uploadLoading, setUploadLoading] = useState(false);

  const [statusFilter, setStatusFilter] = useState<FilterStatus>("all");
  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BusinessUnitMaster | null>(null);
  const [name, setName] = useState("");
  const [active, setActive] = useState("Active");
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string }>({});

  const [confirmTarget, setConfirmTarget] = useState<BusinessUnitMaster | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const { toasts, showToast, removeToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    const result = await fetchBusinessUnitsMaster();
    if (!result.success) {
      setError(result.message);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(result.data);
    setError("");
    setLoading(false);
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <span className={styles.sortIcon}>⇅</span>;
    return sortDirection === "asc" ? <span className={styles.sortIcon}>▲</span> : <span className={styles.sortIcon}>▼</span>;
  };

  const filteredAndSortedRows = useMemo(() => {
    let filtered = rows.filter((item) => {
      if (statusFilter === "active" && !item.IsActive) return false;
      if (statusFilter === "inactive" && item.IsActive) return false;
      return matchesSearch(item, appliedSearchBy, appliedKeyword);
    });

    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aVal: string | number | boolean = "";
        let bVal: string | number | boolean = "";

        switch (sortColumn) {
          case "name":
            aVal = (a.Name || "").toLowerCase();
            bVal = (b.Name || "").toLowerCase();
            break;
          case "status":
            aVal = a.IsActive ? 1 : 0;
            bVal = b.IsActive ? 1 : 0;
            break;
          default:
            return 0;
        }

        if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
        if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [rows, statusFilter, appliedSearchBy, appliedKeyword, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, appliedSearchBy, appliedKeyword]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [sortColumn, sortDirection]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const openCreate = () => {
    setEditing(null);
    setName("");
    setActive("Active");
    setFieldErrors({});
    setShowModal(true);
  };

  const openEdit = (row: BusinessUnitMaster) => {
    setEditing(row);
    setName(row.Name || "");
    setActive(row.IsActive ? "Active" : "Inactive");
    setFieldErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setShowModal(false);
    setEditing(null);
    setFieldErrors({});
  };

  const onSubmit = async () => {
    const normalizedName = name.trim();
    const nextErrors: { name?: string } = {};
    if (!normalizedName) {
      nextErrors.name = "BU Name wajib diisi.";
    } else if (normalizedName.length > 200) {
      nextErrors.name = "BU Name maksimal 200 karakter.";
    }

    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    if (!editing) {
      const result = await createBusinessUnitMaster({ name: normalizedName });
      setSubmitting(false);
      if (!result.success) {
        if ((result.message || "").toLowerCase().includes("already exists")) {
          setFieldErrors({ name: "Nama BU sudah digunakan." });
          return;
        }
        if ((result.message || "").toLowerCase().includes("name is required")) {
          setFieldErrors({ name: "BU Name wajib diisi." });
          return;
        }
        showToast("error", result.message || "Gagal menyimpan business unit.");
        return;
      }
      closeModal();
      await loadData();
      showToast("success", "Business unit berhasil ditambahkan.");
      return;
    }

    const result = await updateBusinessUnitMaster(editing.BusinessUnitId, {
      name: normalizedName,
      isActive: active === "Active",
    });
    setSubmitting(false);

    if (!result.success) {
      if ((result.message || "").toLowerCase().includes("already exists")) {
        setFieldErrors({ name: "Nama BU sudah digunakan." });
        return;
      }
      if ((result.message || "").toLowerCase().includes("name is required")) {
        setFieldErrors({ name: "BU Name wajib diisi." });
        return;
      }
      showToast("error", result.message || "Gagal memperbarui business unit.");
      return;
    }

    closeModal();
    await loadData();
    showToast("success", "Business unit berhasil diperbarui.");
  };

  const onToggleStatus = (row: BusinessUnitMaster) => {
    setConfirmTarget(row);
  };

  const onConfirmToggle = async () => {
    if (!confirmTarget) return;
    setConfirmLoading(true);
    const result = await updateBusinessUnitMaster(confirmTarget.BusinessUnitId, {
      isActive: !confirmTarget.IsActive,
    });
    setConfirmLoading(false);

    if (!result.success) {
      showToast("error", result.message || "Gagal mengubah status business unit.");
      return;
    }

    setConfirmTarget(null);
    await loadData();
    showToast("success", `Business unit berhasil ${confirmTarget.IsActive ? "dinonaktifkan" : "diaktifkan"}.`);
  };

  const onSearch: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
  };

  const onPickUploadFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    setUploadFileName(file?.name || "No file chosen");
  };

  const onDownloadTemplate = () => {
    void (async () => {
      const result = await downloadBusinessUnitTemplate();
      if (!result.success || !result.blob) {
        showToast("error", result.message || "Gagal download template");
        return;
      }
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename || "master-bu-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("success", "Template business unit berhasil didownload.");
    })();
  };

  const onUploadMaster = () => {
    void (async () => {
      const fileInput = document.getElementById("master-bu-file") as HTMLInputElement | null;
      const file = fileInput?.files?.[0];
      if (!file) {
        showToast("error", "Pilih file Excel terlebih dahulu.");
        return;
      }
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
        showToast("error", "Format file harus Excel (.xlsx atau .xls).");
        return;
      }
      setUploadLoading(true);
      const result = await uploadBusinessUnitFile(file);
      setUploadLoading(false);
      if (!result.success) {
        showToast("error", result.message || "Gagal upload file");
        return;
      }
      let message = `Upload berhasil! Imported: ${result.imported ?? 0}, Updated: ${result.updated ?? 0}, Gagal: ${result.failed ?? 0}`;
      if (result.errors && result.errors.length > 0) {
        message += "\n\nErrors:\n";
        result.errors.slice(0, 5).forEach((err) => {
          message += `Row ${err.row}: ${err.errors.join(", ")}\n`;
        });
        if (result.errors.length > 5) {
          message += `... dan ${result.errors.length - 5} error lainnya`;
        }
      }
      showToast("success", message);
      setUploadFileName("No file chosen");
      if (fileInput) fileInput.value = "";
      await loadData();
    })();
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Master BU</h1>
          <div className={styles.subtitle}>Kelola data referensi business unit.</div>
        </div>
        <div className={styles.toolbar}>
          <button className={styles.btnCreate} type="button" onClick={openCreate}>
            ＋ Tambah BU
          </button>
        </div>
      </div>

      <section className={`${styles.sectionCard} ${styles.filterCard}`}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>🔍</div>
          <div>
            <div className={styles.sectionTitle}>Filter & Pencarian</div>
            <div className={styles.sectionSubtitle}>Saring data berdasarkan status dan keyword</div>
          </div>
        </div>
        <form onSubmit={onSearch}>
          <div className={styles.filterToolbar}>
            <div className={`${styles.filterGroup} ${styles.filterGroupMd}`}>
              <label id="mbu-status-label" className={styles.filterLabel} htmlFor="mbu-status-dropdown">Status</label>
              <Dropdown
                id="mbu-status-dropdown"
                className={`${styles.filterSelect} ${styles.fullWidthControl}`}
                options={[
                  { value: "all", label: "Semua" },
                  { value: "active", label: "Active" },
                  { value: "inactive", label: "Inactive" },
                ]}
                value={statusFilter}
                onChange={(value) => setStatusFilter(value as FilterStatus)}
                aria-labelledby="mbu-status-label"
              />
            </div>
            <SearchBar
              options={[
                { value: "all", label: "Semua" },
                { value: "name", label: "Nama" },
              ]}
              selectedValue={searchBy}
              keyword={keyword}
              onSelectedValueChange={setSearchBy}
              onKeywordChange={setKeyword}
              buttonType="submit"
              placeholder="Cari business unit..."
            />
          </div>
        </form>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconGreen}`}>📋</div>
          <div>
            <div className={styles.sectionTitle}>Daftar Business Unit</div>
            <div className={styles.sectionSubtitle}>Kelola data master business unit</div>
          </div>
          <span className={styles.counterBadge}>{filteredAndSortedRows.length} data</span>
        </div>

        {error ? <div className={styles.errorState}>{error}</div> : null}
        {loading ? <div className={styles.loadingState}>Memuat data...</div> : null}

        {!loading && !error ? (
          <>
            <Pagination
              instanceId="top"
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredAndSortedRows.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setCurrentPage}
            />
            <div className={styles.scTableWrap}>
              <table className={styles.scTable}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.colCenter}>No.</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSort("name")}>
                      BU Name {renderSortIcon("name")}
                    </th>
                    <th scope="col" className={`${styles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("status")}>
                      Status {renderSortIcon("status")}
                    </th>
                    <th scope="col" className={styles.colCenter}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <div className={styles.emptyState}>
                          <div className={styles.emptyIcon}>📭</div>
                          <div className={styles.emptyText}>Tidak ada data business unit</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((item, index) => (
                      <tr key={item.BusinessUnitId}>
                        <td className={styles.colCenter}>{(currentPage - 1) * pageSize + index + 1}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.Name}</td>
                        <td className={styles.colCenter}>
                          <span className={`${styles.pillBadge} ${item.IsActive ? styles.pillActive : styles.pillInactive}`}>
                            {item.IsActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className={styles.colCenter}>
                          <div className={styles.actionBtnRow}>
                            <button className={styles.btnEditAction} type="button" onClick={() => openEdit(item)}>
                              ✏️ Edit
                            </button>
                            <button
                              className={item.IsActive ? styles.btnDeactivateAction : styles.btnActivateAction}
                              type="button"
                              onClick={() => onToggleStatus(item)}
                            >
                              {item.IsActive ? "🚫 Deactivate" : "✅ Activate"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              instanceId="bottom"
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredAndSortedRows.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setCurrentPage}
            />
          </>
        ) : null}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconAmber}`}>📤</div>
          <div>
            <div className={styles.sectionTitle}>Upload Data Master</div>
            <div className={styles.sectionSubtitle}>Unggah data master BU dari file Excel</div>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="master-bu-file">Pilih file</label>
          <div className={styles.uploadRow}>
            <div className={styles.filePickerWrap}>
              <input
                id="master-bu-file"
                className={styles.fileInputHidden}
                type="file"
                accept=".xlsx,.xls"
                onChange={onPickUploadFile}
              />
              <label className={styles.fileTrigger} htmlFor="master-bu-file">
                Choose File
              </label>
              <span className={styles.fileText}>{uploadFileName}</span>
              {uploadFileName !== "No file chosen" && (
                <button type="button" className={styles.fileClearBtn} aria-label="Clear file" onClick={() => { setUploadFileName("No file chosen"); const fi = document.getElementById("master-bu-file") as HTMLInputElement | null; if (fi) fi.value = ""; }}>✕</button>
              )}
            </div>
            <button className={styles.btnTemplateAction} type="button" onClick={onDownloadTemplate}>
              📋 Download Template
            </button>
            <button className={styles.btnUploadAction} type="button" onClick={onUploadMaster} disabled={uploadLoading}>
              {uploadLoading ? "Uploading..." : "📥 Upload"}
            </button>
          </div>
        </div>
        <div className={styles.uploadNote}>
          Format file: Excel (.xlsx/.xls). Kolom minimal: BU Name, Status opsional (default Active). BU Code di-generate otomatis.
        </div>
      </section>

      {showModal ? (
        <div className={styles.modalOverlayV2} role="presentation">
          <div className={styles.modalCardV2} role="dialog" aria-modal="true" aria-labelledby="master-bu-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeaderV2}>
              <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>{editing ? '✏️' : '➕'}</div>
              <h2 id="master-bu-modal-title" className={styles.modalTitleV2}>{editing ? "Edit BU" : "Tambah BU"}</h2>
              <button className={styles.modalCloseV2} type="button" onClick={closeModal} aria-label="Tutup modal">✕</button>
            </div>
            <div className={styles.modalBodyV2}>
              <div className={styles.formGroup}>
                <label className={styles.label} htmlFor="master-bu-name-input">BU Name</label>
                <input
                  id="master-bu-name-input"
                  name="buName"
                  className={`${styles.input} ${fieldErrors.name ? styles.inputError : ""}`}
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    if (fieldErrors.name) {
                      setFieldErrors((prev) => ({ ...prev, name: undefined }));
                    }
                  }}
                  placeholder="Masukkan nama business unit"
                  maxLength={200}
                  aria-invalid={Boolean(fieldErrors.name)}
                  aria-describedby={fieldErrors.name ? "master-bu-name-error" : undefined}
                />
                {fieldErrors.name ? <div id="master-bu-name-error" className={styles.fieldError}>{fieldErrors.name}</div> : null}
              </div>
              <div className={styles.formGroup}>
                <label id="mbu-modal-status-label" className={styles.label} htmlFor="mbu-modal-status-dropdown">Status</label>
                <Dropdown
                  id="mbu-modal-status-dropdown"
                  className={styles.select}
                  options={[
                    { value: "Active", label: "Active" },
                    { value: "Inactive", label: "Inactive" },
                  ]}
                  value={active}
                  onChange={setActive}
                  searchable={false}
                  aria-labelledby="mbu-modal-status-label"
                />
              </div>
            </div>
            <div className={styles.modalFooterV2}>
              <button className={styles.modalBtnCancel} type="button" onClick={closeModal}>Batal</button>
              <button className={styles.modalBtnSubmit} type="button" onClick={onSubmit} disabled={submitting}>
                {submitting ? "Menyimpan..." : editing ? "Update" : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(confirmTarget)}
        title={`${confirmTarget?.IsActive ? "Deactivate" : "Activate"} Business Unit`}
        message={`Yakin ingin ${confirmTarget?.IsActive ? "deactivate" : "activate"} ${confirmTarget?.Name || "item"}?`}
        confirmLabel={confirmTarget?.IsActive ? "Deactivate" : "Activate"}
        variant={confirmTarget?.IsActive ? "danger" : "primary"}
        isLoading={confirmLoading}
        onCancel={() => setConfirmTarget(null)}
        onConfirm={onConfirmToggle}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}


