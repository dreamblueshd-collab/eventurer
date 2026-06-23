"use client";

import { useEffect, useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import { ToastContainer, useToast } from "@/components/common/toast";
import {
  createDepartmentApplicationMapping,
  deleteDepartmentApplicationMapping,
  fetchDepartmentApplicationMappingsHierarchical,
  downloadMappingTemplate,
  bulkImportMappings,
  type DepartmentApplicationMappingHierarchy,
} from "@/lib/mappings";
import {
  fetchApplicationsMaster,
  fetchBusinessUnitsMaster,
  fetchDepartmentsMaster,
  fetchDivisionsMaster,
  type ApplicationMaster,
  type BusinessUnitMaster,
  type DepartmentMaster,
  type DivisionMaster,
} from "@/lib/master-data";
import { Pagination } from "@/components/admin/pagination";
import styles from "../mapping-pages.module.css";
import baseStyles from "../page-mockup.module.css";

type RowItem = {
  key: number;
  businessUnitId: number;
  businessUnitName: string;
  divisionId: number;
  divisionName: string;
  departmentId: number;
  departmentName: string;
  applications: Array<{
    mappingId: number;
    applicationId: number;
    applicationName: string;
  }>;
};

type DeleteTarget =
  | { type: "row"; row: RowItem }
  | { type: "app"; row: RowItem; mappingId: number; appName: string };

type EditTarget = {
  row: RowItem;
};

function flattenRows(data: DepartmentApplicationMappingHierarchy[]): RowItem[] {
  const rows: RowItem[] = [];
  data.forEach((bu) => {
    bu.divisions.forEach((div) => {
      div.departments.forEach((dept) => {
        rows.push({
          key: dept.departmentId,
          businessUnitId: bu.businessUnitId,
          businessUnitName: bu.businessUnitName,
          divisionId: div.divisionId,
          divisionName: div.divisionName,
          departmentId: dept.departmentId,
          departmentName: dept.departmentName,
          applications: (dept.applications || []).map((app) => ({
            mappingId: app.mappingId,
            applicationId: app.applicationId,
            applicationName: app.applicationName,
          })),
        });
      });
    });
  });
  return rows;
}

export default function DeptAplikasiPage() {
  const [rows, setRows] = useState<RowItem[]>([]);
  const [businessUnits, setBusinessUnits] = useState<BusinessUnitMaster[]>([]);
  const [divisions, setDivisions] = useState<DivisionMaster[]>([]);
  const [departments, setDepartments] = useState<DepartmentMaster[]>([]);
  const [applications, setApplications] = useState<ApplicationMaster[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [uploadFileName, setUploadFileName] = useState("No file chosen");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [selectedBu, setSelectedBu] = useState("");
  const [selectedDivision, setSelectedDivision] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("");
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
    const [mappingRes, buRes, divRes, deptRes, appRes] = await Promise.all([
      fetchDepartmentApplicationMappingsHierarchical(),
      fetchBusinessUnitsMaster(),
      fetchDivisionsMaster(),
      fetchDepartmentsMaster(),
      fetchApplicationsMaster(),
    ]);

    if (!mappingRes.success) {
      setError(mappingRes.message || "Gagal memuat mapping dept-aplikasi");
      setRows([]);
    } else {
      setRows(flattenRows(mappingRes.mappings));
      setError("");
    }

    setBusinessUnits(buRes.success ? buRes.data.filter((item) => item.IsActive) : []);
    setDivisions(divRes.success ? divRes.data.filter((item) => item.IsActive) : []);
    setDepartments(deptRes.success ? deptRes.data.filter((item) => item.IsActive) : []);
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
      if (!term) return true;

      if (appliedSearchBy === "businessUnit") {
        return row.businessUnitName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "division") {
        return row.divisionName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "department") {
        return row.departmentName.toLowerCase().includes(term);
      }
      if (appliedSearchBy === "application") {
        return row.applications.some((app) => app.applicationName.toLowerCase().includes(term));
      }

      const haystacks = [
        row.businessUnitName,
        row.divisionName,
        row.departmentName,
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
        case "businessUnit":
          aVal = a.businessUnitName.toLowerCase();
          bVal = b.businessUnitName.toLowerCase();
          break;
        case "division":
          aVal = a.divisionName.toLowerCase();
          bVal = b.divisionName.toLowerCase();
          break;
        case "department":
          aVal = a.departmentName.toLowerCase();
          bVal = b.departmentName.toLowerCase();
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

  const divisionOptions = useMemo(
    () => {
      if (!selectedBu) return [];
      return divisions
        .filter((item) => Number(item.BusinessUnitId) === Number(selectedBu))
        .map((item) => ({ value: item.DivisionId, label: item.Name }));
    },
    [divisions, selectedBu],
  );

  const departmentOptions = useMemo(
    () => {
      if (!selectedBu || !selectedDivision) return [];
      return departments
        .filter((item) => Number(item.DivisionId) === Number(selectedDivision))
        .map((item) => ({ value: item.DepartmentId, label: item.Name }));
    },
    [departments, selectedBu, selectedDivision],
  );

  const resetForm = () => {
    setSelectedBu("");
    setSelectedDivision("");
    setSelectedDepartment("");
    setSelectedAppIds([]);
    setEditTarget(null);
  };

  const onOpenAdd = () => {
    resetForm();
    setShowModal(true);
  };

  const onOpenEdit = (row: RowItem) => {
    setEditTarget({ row });
    setSelectedBu(String(row.businessUnitId));
    setSelectedDivision(String(row.divisionId));
    setSelectedDepartment(String(row.departmentId));
    setSelectedAppIds(row.applications.map((item) => item.applicationId));
    setError("");
    setShowModal(true);
  };

  const onSave = async () => {
    if (!selectedDepartment || selectedAppIds.length === 0) {
      showToast("error", "Department dan minimal 1 aplikasi wajib dipilih.");
      return;
    }
    setSubmitting(true);
    if (!editTarget) {
      const result = await createDepartmentApplicationMapping({
        departmentId: Number(selectedDepartment),
        applicationIds: selectedAppIds,
      });
      setSubmitting(false);
      if (!result.success) {
        showToast("error", result.message || "Gagal menyimpan mapping.");
        return;
      }
      setShowModal(false);
      resetForm();
      setError("");
      await load();
      showToast("success", "Mapping department-aplikasi berhasil ditambahkan.");
      return;
    }

    const currentIds = new Set(editTarget.row.applications.map((item) => item.applicationId));
    const nextIds = new Set(selectedAppIds);
    const removeMappings = editTarget.row.applications
      .filter((item) => !nextIds.has(item.applicationId))
      .map((item) => item.mappingId);
    const addAppIds = selectedAppIds.filter((id) => !currentIds.has(id));

    for (const mappingId of removeMappings) {
      const removeResult = await deleteDepartmentApplicationMapping(mappingId);
      if (!removeResult.success) {
        setSubmitting(false);
        showToast("error", removeResult.message || "Gagal memperbarui mapping.");
        return;
      }
    }

    if (addAppIds.length > 0) {
      const addResult = await createDepartmentApplicationMapping({
        departmentId: Number(selectedDepartment),
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
    resetForm();
    setError("");
    await load();
    showToast("success", "Mapping department-aplikasi berhasil diperbarui.");
  };

  const toggleAppSelection = (applicationId: number) => {
    setSelectedAppIds((prev) =>
      prev.includes(applicationId) ? prev.filter((id) => id !== applicationId) : [...prev, applicationId],
    );
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    if (deleteTarget.type === "app") {
      const result = await deleteDepartmentApplicationMapping(deleteTarget.mappingId);
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
      const result = await deleteDepartmentApplicationMapping(app.mappingId);
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
    showToast("success", "Semua mapping aplikasi pada department berhasil dihapus.");
  };

  const onPickUploadFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0] ?? null;
    setUploadFileName(file?.name || "No file chosen");
    setUploadFile(file);
  };

  const onDownloadTemplate = async () => {
    const result = await downloadMappingTemplate("application-department");
    if (!result.success || !result.blob) {
      showToast("error", "Gagal mengunduh template. Coba lagi.");
      return;
    }
    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "template-mapping-dept-aplikasi.xlsx";
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("success", "Template mapping department-aplikasi berhasil didownload.");
  };

  const onUploadMapping = async () => {
    if (!uploadFile) {
      showToast("error", "Pilih file terlebih dahulu.");
      return;
    }
    setUploading(true);

    const result = await bulkImportMappings(uploadFile, "application-department");
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
    const input = document.getElementById("dept-aplikasi-file") as HTMLInputElement | null;
    if (input) input.value = "";
    await load();
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Mapping Department - Aplikasi</h1>
          <p className={styles.subtitle}>Pastikan setiap department memiliki subset aplikasi yang relevan.</p>
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
              { value: "businessUnit", label: "Business Unit" },
              { value: "division", label: "Division" },
              { value: "department", label: "Department" },
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
            <div className={styles.sectionTitle}>Data Mapping Department - Aplikasi</div>
            <div className={styles.sectionSubtitle}>Kelola relasi department dengan aplikasi</div>
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
                  <th scope="col" className={baseStyles.sortableHeader} onClick={() => handleSort("businessUnit")}>
                    Business Unit{renderSortIcon("businessUnit")}
                  </th>
                  <th scope="col" className={baseStyles.sortableHeader} onClick={() => handleSort("division")}>
                    Division{renderSortIcon("division")}
                  </th>
                  <th scope="col" className={baseStyles.sortableHeader} onClick={() => handleSort("department")}>
                    Department{renderSortIcon("department")}
                  </th>
                  <th scope="col">Applications</th>
                  <th scope="col" className={baseStyles.colCenter}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className={styles.empty}>
                      Tidak ada mapping department-aplikasi
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row, index) => (
                    <tr key={row.key}>
                      <td className={baseStyles.colCenter}>{(currentPage - 1) * pageSize + index + 1}</td>
                      <td>{row.businessUnitName}</td>
                      <td>{row.divisionName}</td>
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.departmentName}</td>
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
          <label className={styles.label} htmlFor="dept-aplikasi-file">Pilih file Excel</label>
          <div className={styles.uploadRow}>
            <div className={styles.filePickerWrap}>
              <input
                id="dept-aplikasi-file"
                className={styles.fileInputHidden}
                type="file"
                accept=".xlsx,.xls"
                onChange={onPickUploadFile}
                aria-describedby="dept-aplikasi-upload-note"
              />
              <label className={styles.fileTrigger} htmlFor="dept-aplikasi-file">
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
        <p id="dept-aplikasi-upload-note" className={styles.uploadNote}>
          Format: Excel (.xlsx) dengan kolom <strong>BU Name</strong>, <strong>Division Name</strong>, <strong>Department Name</strong>, dan <strong>Application Name</strong>.
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
            resetForm();
          }}
        >
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="dept-app-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>{editTarget ? '✏️' : '➕'}</div>
              <h2 id="dept-app-modal-title" className={styles.modalTitle}>{editTarget ? "Edit Mapping" : "Tambah Mapping"}</h2>
              <button
                className={styles.modalClose}
                type="button"
                aria-label="Close"
                onClick={() => {
                  if (submitting) return;
                  setShowModal(false);
                  resetForm();
                }}
              >
                ✕
              </button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label id="dept-app-modal-label-bu" className={styles.label} htmlFor="dept-app-modal-bu">Business Unit</label>
                <Dropdown
                  id="dept-app-modal-bu"
                  className={styles.input}
                  options={businessUnits.map((item) => ({ value: item.BusinessUnitId, label: item.Name }))}
                  value={selectedBu}
                  onChange={(value) => {
                    setSelectedBu(value);
                    setSelectedDivision("");
                    setSelectedDepartment("");
                  }}
                  placeholder="Pilih Business Unit"
                  searchable={true}
                  aria-labelledby="dept-app-modal-label-bu"
                />
              </div>
              <div className={styles.formGroup}>
                <label id="dept-app-modal-label-division" className={styles.label} htmlFor="dept-app-modal-division">Division</label>
                <Dropdown
                  id="dept-app-modal-division"
                  className={styles.input}
                  options={divisionOptions}
                  value={selectedDivision}
                  onChange={(value) => {
                    setSelectedDivision(value);
                    setSelectedDepartment("");
                  }}
                  placeholder="Pilih Division"
                  searchable={true}
                  aria-labelledby="dept-app-modal-label-division"
                />
              </div>
              <div className={styles.formGroup}>
                <label id="dept-app-modal-label-department" className={styles.label} htmlFor="dept-app-modal-department">Department</label>
                <Dropdown
                  id="dept-app-modal-department"
                  className={styles.input}
                  options={departmentOptions}
                  value={selectedDepartment}
                  onChange={setSelectedDepartment}
                  placeholder="Pilih Department"
                  searchable={true}
                  aria-labelledby="dept-app-modal-label-department"
                />
              </div>
              <div className={styles.formGroup}>
                <span id="dept-app-modal-label-apps" className={styles.label}>Applications</span>
                <div className={styles.checkboxGrid} role="group" aria-labelledby="dept-app-modal-label-apps">
                  {applications.length === 0 ? <div className={styles.meta}>Tidak ada aplikasi aktif</div> : null}
                  {applications.map((app) => (
                    <label key={app.ApplicationId} className={styles.checkboxItem}>
                      <input
                        id={`deptAppSelect-${app.ApplicationId}`}
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
                  resetForm();
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
            ? `Hapus aplikasi ${deleteTarget.appName} dari mapping ${deleteTarget.row.departmentName}?`
            : "Hapus semua mapping aplikasi pada department ini?"
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
