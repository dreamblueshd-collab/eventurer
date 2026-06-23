"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import { ToastContainer, useToast } from "@/components/common/toast";
import {
  createFunctionApplicationMapping,
  deleteFunctionApplicationMapping,
  fetchFunctionApplicationMappingsDetailed,
  downloadMappingTemplate,
  bulkImportMappings,
  type FunctionApplicationMappingItem,
} from "@/lib/mappings";
import { fetchApplicationsMaster, fetchFunctionsMaster, type ApplicationMaster, type FunctionMaster } from "@/lib/master-data";
import { Pagination } from "@/components/admin/pagination";
import styles from "../mapping-pages.module.css";
import baseStyles from "../page-mockup.module.css";

type DeleteTarget =
  | { type: "row"; row: FunctionApplicationMappingItem }
  | { type: "app"; row: FunctionApplicationMappingItem; mappingId: number; appName: string };

type EditTarget = {
  row: FunctionApplicationMappingItem;
};

export default function FunctionAplikasiPage() {
  const [rows, setRows] = useState<FunctionApplicationMappingItem[]>([]);
  const [functions, setFunctions] = useState<FunctionMaster[]>([]);
  const [applications, setApplications] = useState<ApplicationMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadFileName, setUploadFileName] = useState("No file chosen");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedFunctionId, setSelectedFunctionId] = useState("");
  const [selectedAppIds, setSelectedAppIds] = useState<number[]>([]);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<string>("");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const { toasts, showToast, removeToast } = useToast();

  const load = async () => {
    setLoading(true);
    const [mappingRes, functionRes, appRes] = await Promise.all([
      fetchFunctionApplicationMappingsDetailed(),
      fetchFunctionsMaster(),
      fetchApplicationsMaster(),
    ]);

    if (!mappingRes.success) {
      setError(mappingRes.message || "Gagal memuat mapping function-aplikasi");
      setRows([]);
    } else {
      setRows(mappingRes.mappings);
      setError("");
    }

    setFunctions(functionRes.success ? functionRes.data.filter((item) => item.IsActive) : []);
    setApplications(appRes.success ? appRes.data.filter((item) => item.IsActive) : []);
    setLoading(false);
  };

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { void load(); }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSort = (column: string) => {
    setCurrentPage(1);
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return " ⇅";
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const filteredAndSortedRows = useMemo(() => {
    const term = appliedKeyword.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const itLeadName = row.itLeadName || "";
      if (!term) return true;

      if (appliedSearchBy === "head") {
        return itLeadName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "function") {
        return row.functionName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "application") {
        return row.applications.some((app) => app.applicationName.toLowerCase().includes(term));
      }

      const haystacks = [
        itLeadName,
        row.functionName,
        ...row.applications.map((app) => app.applicationName),
      ];
      if (!haystacks.some((value) => String(value || "").toLowerCase().includes(term))) return false;
      return true;
    });

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal: string;
      let bVal: string;

      switch (sortColumn) {
        case "itlead":
          aVal = (a.itLeadName || "").toLowerCase();
          bVal = (b.itLeadName || "").toLowerCase();
          break;
        case "function":
          aVal = a.functionName.toLowerCase();
          bVal = b.functionName.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [rows, appliedKeyword, appliedSearchBy, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedRows.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return filteredAndSortedRows.slice(start, start + pageSize);
  }, [filteredAndSortedRows, safeCurrentPage, pageSize]);

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
    setCurrentPage(1);
  };

  const toggleAppSelection = (applicationId: number) => {
    setSelectedAppIds((prev) =>
      prev.includes(applicationId) ? prev.filter((id) => id !== applicationId) : [...prev, applicationId],
    );
  };

  const onSave = async () => {
    if (!selectedFunctionId || selectedAppIds.length === 0) {
      showToast("error", "Function dan minimal 1 aplikasi wajib dipilih.");
      return;
    }
    setSubmitting(true);
    if (!editTarget) {
      const result = await createFunctionApplicationMapping({
        functionId: Number(selectedFunctionId),
        applicationIds: selectedAppIds,
      });
      setSubmitting(false);
      if (!result.success) {
        showToast("error", result.message || "Gagal menyimpan mapping.");
        return;
      }
      setShowModal(false);
      setSelectedFunctionId("");
      setSelectedAppIds([]);
      setEditTarget(null);
      setError("");
      await load();
      showToast("success", "Mapping function-aplikasi berhasil ditambahkan.");
      return;
    }

    const currentIds = new Set(editTarget.row.applications.map((item) => item.applicationId));
    const nextIds = new Set(selectedAppIds);
    const removeMappings = editTarget.row.applications
      .filter((item) => !nextIds.has(item.applicationId))
      .map((item) => item.mappingId);
    const addAppIds = selectedAppIds.filter((id) => !currentIds.has(id));

    for (const mappingId of removeMappings) {
      const removeResult = await deleteFunctionApplicationMapping(mappingId);
      if (!removeResult.success) {
        setSubmitting(false);
        showToast("error", removeResult.message || "Gagal memperbarui mapping.");
        return;
      }
    }

    if (addAppIds.length > 0) {
      const addResult = await createFunctionApplicationMapping({
        functionId: Number(selectedFunctionId),
        applicationIds: addAppIds,
      });
      if (!addResult.success) {
        setSubmitting(false);
        showToast("error", addResult.message || "Gagal memperbarui mapping.");
        return;
      }
    }

    setSubmitting(false);
    setShowModal(false);
    setSelectedFunctionId("");
    setSelectedAppIds([]);
    setEditTarget(null);
    setError("");
    await load();
    showToast("success", "Mapping function-aplikasi berhasil diperbarui.");
  };

  const onOpenAdd = () => {
    setSelectedFunctionId("");
    setSelectedAppIds([]);
    setEditTarget(null);
    setError("");
    setShowModal(true);
  };

  const onOpenEdit = (row: FunctionApplicationMappingItem) => {
    setEditTarget({ row });
    setSelectedFunctionId(String(row.functionId));
    setSelectedAppIds(row.applications.map((item) => item.applicationId));
    setError("");
    setShowModal(true);
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    if (deleteTarget.type === "app") {
      const result = await deleteFunctionApplicationMapping(deleteTarget.mappingId);
      setDeleteLoading(false);
      if (!result.success) {
        showToast("error", result.message || "Gagal menghapus aplikasi.");
        return;
      }
      setDeleteTarget(null);
      setError("");
      await load();
      showToast("success", `Aplikasi ${deleteTarget.appName} berhasil dihapus dari mapping.`);
      return;
    }

    for (const app of deleteTarget.row.applications) {
      const result = await deleteFunctionApplicationMapping(app.mappingId);
      if (!result.success) {
        setDeleteLoading(false);
        showToast("error", result.message || "Gagal menghapus mapping.");
        return;
      }
    }
    setDeleteLoading(false);
    setDeleteTarget(null);
    setError("");
    await load();
    showToast("success", "Semua mapping aplikasi pada function berhasil dihapus.");
  };

  const onPickUploadFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null;
    setUploadFileName(file?.name || "No file chosen");
    setUploadFile(file);
  };

  const onDownloadTemplate = async () => {
    const result = await downloadMappingTemplate("function-application");
    if (!result.success || !result.blob) {
      showToast("error", "Gagal mengunduh template. Coba lagi.");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-mapping-function-aplikasi.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("success", "Template mapping function-aplikasi berhasil didownload.");
  };

  const onUploadMapping = async () => {
    if (!uploadFile) {
      showToast("error", "Pilih file terlebih dahulu.");
      return;
    }
    setUploading(true);

    const result = await bulkImportMappings(uploadFile, "function-application");
    setUploading(false);

    if (!result.success) {
      let errorMsg = result.message || "Upload gagal.";
      if (result.errors && result.errors.length > 0) {
        errorMsg += "\n\nErrors:\n";
        result.errors.slice(0, 5).forEach((err) => {
          errorMsg += `Baris ${err.row}: ${err.errors.join(", ")}\n`;
        });
        if (result.errors.length > 5) {
          errorMsg += `... dan ${result.errors.length - 5} error lainnya`;
        }
      }
      showToast("error", errorMsg);
      return;
    }

    let message = `Upload berhasil! Imported: ${result.imported ?? 0}, Dilewati: ${result.skipped ?? 0}, Gagal: ${result.failed ?? 0}`;
    if (result.errors && result.errors.length > 0) {
      message += "\n\nErrors:\n";
      result.errors.slice(0, 3).forEach((err) => {
        message += `Baris ${err.row}: ${err.errors.join(", ")}\n`;
      });
      if (result.errors.length > 3) {
        message += `... dan ${result.errors.length - 3} error lainnya`;
      }
    }
    showToast("success", message);
    setUploadFileName("No file chosen");
    setUploadFile(null);
    // Reset file input
    const input = document.getElementById("function-aplikasi-file") as HTMLInputElement | null;
    if (input) input.value = "";
    await load();
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Mapping Function - Aplikasi</h1>
          <p className={styles.subtitle}>Atur subset aplikasi per function untuk event aktif.</p>
        </div>
        <div className={styles.toolbar}>
          <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={onOpenAdd}>
            ＋ Tambah Manual
          </button>
        </div>
      </div>

      <section className={`${styles.sectionCard} ${styles.filterCard}`}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>🔍</div>
          <div>
            <div className={styles.sectionTitle}>Filter Data</div>
            <div className={styles.sectionSubtitle}>Saring data berdasarkan status dan keyword</div>
          </div>
          <span className={styles.counterBadge}>{filteredAndSortedRows.length} data</span>
        </div>
        <div className={baseStyles.filterToolbar}>
          <SearchBar
            options={[
              { value: "all", label: "Search By" },
              { value: "head", label: "IT Lead" },
              { value: "function", label: "Function" },
              { value: "application", label: "Application" },
            ]}
            selectedValue={searchBy}
            keyword={keyword}
            onSelectedValueChange={setSearchBy}
            onKeywordChange={setKeyword}
            onButtonClick={onApplySearch}
            placeholder="Cari mapping..."
          />
        </div>
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconGreen}`}>📋</div>
          <div>
            <div className={styles.sectionTitle}>Data Mapping Function - Aplikasi</div>
            <div className={styles.sectionSubtitle}>Kelola relasi function dengan aplikasi</div>
          </div>
        </div>
        {error ? <div className={styles.error}>{error}</div> : null}
        {loading ? <div className={styles.meta}>Memuat data...</div> : null}
        {!loading && !error ? (
          <>
          <Pagination
            instanceId="top"
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filteredAndSortedRows.length}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col" className={baseStyles.colCenter}>No</th>
                  <th scope="col" className={styles.sortableHeader} onClick={() => handleSort("itlead")}>
                    IT Lead{renderSortIcon("itlead")}
                  </th>
                  <th scope="col" className={styles.sortableHeader} onClick={() => handleSort("function")}>
                    Function{renderSortIcon("function")}
                  </th>
                  <th scope="col">Applications</th>
                  <th scope="col" className={baseStyles.colCenter}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className={styles.empty}>
                      Tidak ada mapping function-aplikasi
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, index) => (
                    <tr key={row.functionId}>
                      <td className={baseStyles.colCenter}>{(currentPage - 1) * pageSize + index + 1}</td>
                      <td>{row.itLeadName || "-"}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.functionName}</td>
                      <td>
                        <div className={styles.tags}>
                          {row.applications.map((app) => (
                            <span key={app.mappingId} className={styles.tag}>
                              {app.applicationName}
                              <button
                                className={styles.tagRemove}
                                type="button"
                                onClick={() =>
                                  setDeleteTarget({
                                    type: "app",
                                    row,
                                    mappingId: app.mappingId,
                                    appName: app.applicationName,
                                  })
                                }
                              >
                                x
                              </button>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className={baseStyles.colCenter}>
                        <div className={styles.btnRow}>
                          <button className={styles.btnEditAction} type="button" onClick={() => onOpenEdit(row)}>
                            ✏️ Edit
                          </button>
                          <button className={styles.btnDeleteAction} type="button" onClick={() => setDeleteTarget({ type: "row", row })}>
                            🗑️ Delete
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
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            totalItems={filteredAndSortedRows.length}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
          />
          </>
        ) : null}
      </section>

      <section className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconAmber}`}>📤</div>
          <div>
            <div className={styles.sectionTitle}>Upload Data Mapping</div>
            <div className={styles.sectionSubtitle}>Upload file Excel untuk import data mapping secara massal</div>
          </div>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label} htmlFor="function-aplikasi-file">Pilih file Excel</label>
          <div className={styles.uploadRow}>
            <div className={styles.filePickerWrap}>
              <input
                id="function-aplikasi-file"
                className={styles.fileInputHidden}
                type="file"
                accept=".xlsx,.xls"
                onChange={onPickUploadFile}
                aria-describedby="function-aplikasi-upload-note"
              />
              <label className={styles.fileTrigger} htmlFor="function-aplikasi-file">
                Choose File
              </label>
              <span className={styles.fileText}>{uploadFileName}</span>
            </div>
            <button
              className={styles.btnTemplateAction}
              type="button"
              onClick={() => void onDownloadTemplate()}
            >
              📋 Download Template
            </button>
            <button
              className={styles.btnUploadAction}
              type="button"
              onClick={() => void onUploadMapping()}
              disabled={uploading || !uploadFile}
              aria-busy={uploading}
            >
              {uploading ? "Mengupload..." : "📥 Upload"}
            </button>
          </div>
        </div>
        <p id="function-aplikasi-upload-note" className={styles.uploadNote}>
          Format: Excel (.xlsx) dengan kolom <strong>Function Name</strong> dan <strong>Application Name</strong>.
          Download template untuk contoh format yang benar.
        </p>
      </section>

      {showModal ? (
        <div
          className={styles.modalOverlay}
          role="presentation"
          onClick={() => {
            if (submitting) return;
            setShowModal(false);
            setSelectedFunctionId("");
            setSelectedAppIds([]);
            setEditTarget(null);
          }}
        >
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="func-app-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>{editTarget ? '✏️' : '➕'}</div>
              <h2 id="func-app-modal-title" className={styles.modalTitle}>{editTarget ? "Edit Mapping" : "Tambah Mapping"}</h2>
              <button
                className={styles.modalClose}
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (submitting) return;
                  setShowModal(false);
                  setSelectedFunctionId("");
                  setSelectedAppIds([]);
                  setEditTarget(null);
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label id="func-app-modal-label-function" className={styles.label} htmlFor="func-app-modal-function">Function</label>
                <Dropdown
                  id="func-app-modal-function"
                  className={styles.input}
                  options={functions.map((item) => ({ value: item.FunctionId, label: item.Name }))}
                  value={selectedFunctionId}
                  onChange={setSelectedFunctionId}
                  placeholder="Pilih Function"
                  searchable={true}
                  aria-labelledby="func-app-modal-label-function"
                />
              </div>
              <div className={styles.formGroup}>
                <span id="func-app-modal-label-apps" className={styles.label}>Applications</span>
                <div className={styles.checkboxGrid} role="group" aria-labelledby="func-app-modal-label-apps">
                  {applications.length === 0 ? <div className={styles.meta}>Tidak ada aplikasi aktif</div> : null}
                  {applications.map((app) => (
                    <label key={app.ApplicationId} className={styles.checkboxItem}>
                      <input
                        id={`functionAppSelect-${app.ApplicationId}`}
                        name="selectedAppIds"
                        type="checkbox"
                        value={String(app.ApplicationId)}
                        checked={selectedAppIds.includes(app.ApplicationId)}
                        onChange={() => toggleAppSelection(app.ApplicationId)}
                      />
                      <span>{app.Name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button
                className={styles.btn}
                type="button"
                onClick={() => {
                  if (submitting) return;
                  setShowModal(false);
                  setSelectedFunctionId("");
                  setSelectedAppIds([]);
                  setEditTarget(null);
                }}
              >
                Cancel
              </button>
              <button className={`${styles.btn} ${styles.btnPrimary}`} type="button" onClick={() => void onSave()} disabled={submitting}>
                {submitting ? "Saving..." : editTarget ? "Update" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Hapus Mapping"
        message={
          deleteTarget?.type === "app"
            ? `Hapus aplikasi ${deleteTarget.appName} dari mapping ${deleteTarget.row.functionName}?`
            : "Hapus semua mapping aplikasi pada function ini?"
        }
        confirmLabel="Hapus"
        cancelLabel="Batal"
        variant="danger"
        isLoading={deleteLoading}
        onConfirm={() => void onConfirmDelete()}
        onCancel={() => !deleteLoading && setDeleteTarget(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
