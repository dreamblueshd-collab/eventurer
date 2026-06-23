"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { createUser, downloadUserList, downloadUserTemplateFile, fetchUsersWithFilters, setUserPassword, toggleUserLdap, updateUser, uploadUserFile } from "@/lib/users";
import type { UserListItem } from "@/types/user";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Dropdown } from "@/components/common/dropdown";
import { ToastContainer, useToast } from "@/components/common/toast";
import styles from "../page-mockup.module.css";
import s from "./master-user.module.css";
import MasterUserFormModal, { type MasterUserFormErrors } from "./master-user-form-modal";
import { matchesUserSearch, roleLabel } from "./master-user-utils";

type UploadUserError = { row: number; errors: string[] };

function roleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    SuperAdmin: s.roleSuperAdmin,
    AdminEvent: s.roleAdminEvent,
    ITLead: s.roleITLead,
    DepartmentHead: s.roleDeptHead,
  };
  return `${s.roleBadge} ${map[role] ?? s.roleDefault}`;
}

export default function MasterUserPage() {
  const [users, setUsers] = useState<UserListItem[]>([]);
  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedFileName, setSelectedFileName] = useState("No file chosen");
  const [loading, setLoading] = useState(true);
  const [submittingUser, setSubmittingUser] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [newUsername, setNewUsername] = useState("");
  const [newNpk, setNewNpk] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [newRole, setNewRole] = useState<"SuperAdmin" | "AdminEvent" | "ITLead" | "DepartmentHead">("AdminEvent");
  const [newUseLdap, setNewUseLdap] = useState(true);
  const [newStatus, setNewStatus] = useState("Active");
  const [newPassword, setNewPassword] = useState("");
  const [formErrors, setFormErrors] = useState<MasterUserFormErrors>({});
  const [error, setError] = useState("");
  const [confirmTargetUser, setConfirmTargetUser] = useState<UserListItem | null>(null);
  const [confirmNextIsActive, setConfirmNextIsActive] = useState(false);
  const [confirmSubmitting, setConfirmSubmitting] = useState(false);
  const { toasts, showToast, removeToast } = useToast();

  const loadUsers = useCallback(async (searchText = appliedKeyword) => {
    setLoading(true);
    const result = await fetchUsersWithFilters({
      search: searchText,
      role: roleFilter,
      isActive: statusFilter === "all" ? undefined : statusFilter === "active" ? "true" : "false",
      includeInactive: statusFilter === "all" ? "true" : undefined,
    });
    if (!result.success) {
      setError(result.message || "Gagal memuat data user");
      setUsers([]);
      setLoading(false);
      return;
    }

    setUsers(result.users);
    setError("");
    setLoading(false);
  }, [appliedKeyword, roleFilter, statusFilter]);

  useEffect(() => {
    void loadUsers();
  }, [loadUsers]);

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

  const onSearch: React.FormEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
    void loadUsers(keyword);
  };

  const onUpload = async () => {
    const fileInput = document.getElementById("master-user-file") as HTMLInputElement | null;
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

    const result = await uploadUserFile(file);
    if (!result.success) {
      showToast("error", result.message || "Gagal upload file");
      return;
    }

    let message = `Upload berhasil! Imported: ${result.imported || 0}, Failed: ${result.failed || 0}`;
    if (result.errors && result.errors.length > 0) {
      message += "\n\nErrors:\n";
      result.errors.slice(0, 5).forEach((err: UploadUserError) => {
        message += `Row ${err.row}: ${err.errors.join(", ")}\n`;
      });
      if (result.errors.length > 5) {
        message += `... dan ${result.errors.length - 5} error lainnya`;
      }
    }
    showToast("success", message);
    setSelectedFileName("No file chosen");
    if (fileInput) fileInput.value = "";
    await loadUsers(appliedKeyword);
  };

  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    setSelectedFileName(file?.name || "No file chosen");
  };

  const onDownloadTemplate = () => {
    void (async () => {
      const result = await downloadUserTemplateFile();
      if (!result.success || !result.blob) {
        showToast("error", result.message || "Gagal download template");
        return;
      }

      const url = URL.createObjectURL(result.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename || "master-user-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      showToast("success", "Template user berhasil didownload.");
    })();
  };

  const onDownload = async () => {
    const result = await downloadUserList();
    if (!result.success || !result.blob) {
      showToast("error", result.message || "Gagal download user list");
      return;
    }

    const url = URL.createObjectURL(result.blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = result.filename || "user-list.xlsx";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast("success", "Daftar user berhasil didownload.");
  };

  const displayedAndSortedUsers = useMemo(() => {
    const filtered = users.filter((user) => matchesUserSearch(user, appliedSearchBy, appliedKeyword));
    
    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      let compareResult = 0;
      switch (sortColumn) {
        case "name":
          compareResult = (a.DisplayName || "").localeCompare(b.DisplayName || "");
          break;
        case "email":
          compareResult = (a.Email || "").localeCompare(b.Email || "");
          break;
        case "role":
          compareResult = (a.Role || "").localeCompare(b.Role || "");
          break;
        case "status":
          compareResult = (a.IsActive === b.IsActive) ? 0 : a.IsActive ? -1 : 1;
          break;
        default:
          return 0;
      }
      return sortDirection === "asc" ? compareResult : -compareResult;
    });
  }, [users, appliedSearchBy, appliedKeyword, sortColumn, sortDirection]);

  const totalPages = Math.max(1, Math.ceil(displayedAndSortedUsers.length / pageSize));
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return displayedAndSortedUsers.slice(start, start + pageSize);
  }, [currentPage, displayedAndSortedUsers, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [appliedKeyword, appliedSearchBy, roleFilter, statusFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetUserForm = () => {
    setEditingUser(null);
    setShowCreateModal(false);
    setNewUsername("");
    setNewNpk("");
    setNewDisplayName("");
    setNewEmail("");
    setNewPhoneNumber("");
    setNewRole("AdminEvent");
    setNewUseLdap(true);
    setNewStatus("Active");
    setNewPassword("");
    setFormErrors({});
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setShowCreateModal(true);
    setNewUsername("");
    setNewNpk("");
    setNewDisplayName("");
    setNewEmail("");
    setNewPhoneNumber("");
    setNewRole("AdminEvent");
    setNewUseLdap(true);
    setNewStatus("Active");
    setNewPassword("");
  };

  const openEditModal = (user: UserListItem) => {
    setEditingUser(user);
    setShowCreateModal(true);
    setNewUsername(user.Username || "");
    setNewNpk(user.NPK || "");
    setNewDisplayName(user.DisplayName || "");
    setNewEmail(user.Email || "");
    setNewPhoneNumber(user.PhoneNumber || "");
    setNewRole((user.Role as typeof newRole) || "AdminEvent");
    setNewUseLdap(Boolean(user.UseLDAP));
    setNewStatus(user.IsActive ? "Active" : "Inactive");
    setNewPassword("");
  };

  const onToggleUserStatus = (user: UserListItem) => {
    setConfirmTargetUser(user);
    setConfirmNextIsActive(!user.IsActive);
  };

  const closeStatusConfirm = () => {
    if (confirmSubmitting) return;
    setConfirmTargetUser(null);
  };

  const onConfirmToggleStatus = async () => {
    if (!confirmTargetUser) return;

    setConfirmSubmitting(true);
    const result = await updateUser(confirmTargetUser.UserId, { isActive: confirmNextIsActive });
    setConfirmSubmitting(false);

    if (!result.success) {
      showToast("error", result.message || "Gagal mengubah status user");
      return;
    }

    setConfirmTargetUser(null);
    await loadUsers(appliedKeyword);
    showToast("success", `User berhasil ${confirmNextIsActive ? "diaktifkan" : "dinonaktifkan"}.`);
  };

  const onSubmitUser = async () => {
    const nextErrors: MasterUserFormErrors = {};
    if (!newUsername.trim()) nextErrors.username = "Username wajib diisi.";
    else if (newUsername.trim().length > 50) nextErrors.username = "Username maksimal 50 karakter.";
    if (!newNpk.trim()) nextErrors.npk = "NPK wajib diisi.";
    else if (newNpk.trim().length > 50) nextErrors.npk = "NPK maksimal 50 karakter.";
    if (!newDisplayName.trim()) nextErrors.displayName = "Nama lengkap wajib diisi.";
    else if (newDisplayName.trim().length > 200) nextErrors.displayName = "Nama lengkap maksimal 200 karakter.";
    if (!newEmail.trim()) {
      nextErrors.email = "Email wajib diisi.";
    } else if (newEmail.trim().length > 255) {
      nextErrors.email = "Email maksimal 255 karakter.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail.trim())) {
      nextErrors.email = "Format email tidak valid.";
    }
    if (!newUseLdap && !editingUser && newPassword.trim().length < 8) {
      nextErrors.password = "Password minimal 8 karakter.";
    }
    if (newPhoneNumber.trim() && !/^\d{8,15}$/.test(newPhoneNumber.trim())) {
      nextErrors.phoneNumber = "Nomor telepon harus 8–15 digit angka.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setFormErrors(nextErrors);
      return;
    }
    setFormErrors({});

    setSubmittingUser(true);

    if (!editingUser) {
      const createResult = await createUser({
        username: newUsername.trim(),
        npk: newNpk.trim(),
        displayName: newDisplayName.trim(),
        email: newEmail.trim(),
        phoneNumber: newPhoneNumber.trim() || undefined,
        role: newRole,
        useLDAP: newUseLdap,
        password: newUseLdap ? undefined : newPassword.trim(),
      });
      setSubmittingUser(false);

      if (!createResult.success) {
        showToast("error", createResult.message || "Gagal membuat user");
        return;
      }

      resetUserForm();
      await loadUsers(appliedKeyword);
      showToast("success", `User ${newDisplayName.trim()} berhasil dibuat.`);
      return;
    }

    const updateResult = await updateUser(editingUser.UserId, {
      npk: newNpk.trim(),
      displayName: newDisplayName.trim(),
      email: newEmail.trim(),
      phoneNumber: newPhoneNumber.trim() || undefined,
      role: newRole,
      isActive: newStatus === "Active",
    });

    if (!updateResult.success) {
      setSubmittingUser(false);
      showToast("error", updateResult.message || "Gagal memperbarui user");
      return;
    }

    if (newUseLdap !== editingUser.UseLDAP) {
      const ldapResult = await toggleUserLdap(editingUser.UserId, newUseLdap);
      if (!ldapResult.success) {
        setSubmittingUser(false);
        showToast("error", ldapResult.message || "Gagal memperbarui LDAP user");
        return;
      }
    }

    if (!newUseLdap && newPassword.trim()) {
      const passwordResult = await setUserPassword(editingUser.UserId, newPassword.trim());
      if (!passwordResult.success) {
        setSubmittingUser(false);
        showToast("error", passwordResult.message || "Gagal memperbarui password user");
        return;
      }
    }

    setSubmittingUser(false);
    resetUserForm();
    await loadUsers(appliedKeyword);
    showToast("success", "User berhasil diperbarui.");
  };

  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Master User</h1>
          <div className={styles.subtitle}>Kelola akses pengguna, role, dan mapping organisasi.</div>
        </div>
        <div className={styles.toolbar}>
          <button
            className={s.btnCreate}
            onClick={openCreateModal}
            type="button"
          >
            + Tambah User
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <section className={`${styles.sectionCard} ${styles.filterCard}`}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>🔍</div>
          <div>
            <div className={styles.sectionTitle}>Filter & Pencarian</div>
            <div className={styles.sectionSubtitle}>Cari dan filter data pengguna</div>
          </div>
        </div>
        <form onSubmit={onSearch}>
          <div className={styles.filterToolbar}>
            <div className={`${styles.filterGroup} ${styles.filterGroupMd}`}>
              <label id="mu-role-label" className={styles.filterLabel} htmlFor="mu-role-dropdown">Role</label>
              <Dropdown id="mu-role-dropdown" className={`${styles.filterSelect} ${styles.fullWidthControl}`} options={[{ value: "all", label: "Semua Role" }, { value: "SuperAdmin", label: "Super Admin" }, { value: "AdminEvent", label: "Admin Event" }, { value: "ITLead", label: "IT Lead" }, { value: "DepartmentHead", label: "Dept Head" }]} value={roleFilter} onChange={setRoleFilter} aria-labelledby="mu-role-label" />
            </div>
            <div className={`${styles.filterGroup} ${styles.filterGroupMd}`}>
              <label id="mu-status-label" className={styles.filterLabel} htmlFor="mu-status-dropdown">Status</label>
              <Dropdown id="mu-status-dropdown" className={`${styles.filterSelect} ${styles.fullWidthControl}`} options={[{ value: "all", label: "Semua Status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} value={statusFilter} onChange={setStatusFilter} aria-labelledby="mu-status-label" />
            </div>
            <SearchBar
              options={[{ value: "all", label: "Search By" }, { value: "npk", label: "NPK" }, { value: "username", label: "Username" }, { value: "name", label: "Name" }, { value: "email", label: "Email" }, { value: "role", label: "Role" }]}
              selectedValue={searchBy}
              keyword={keyword}
              onSelectedValueChange={setSearchBy}
              onKeywordChange={setKeyword}
              buttonType="submit"
              placeholder="Cari user..."
              trailingContent={(<button className={s.btnDownload} type="button" onClick={onDownload}>📥 Download</button>)}
            />
          </div>
        </form>
      </section>

      {/* User List Section */}
      <div className={s.sectionCard} style={{ animationDelay: "0.12s" }}>
        <div className={s.sectionHeader}>
          <div className={`${s.sectionIcon} ${s.iconGreen}`}>👥</div>
          <div className={s.sectionTitleWrap}>
            <h2 className={s.sectionTitle}>Daftar User</h2>
            <p className={s.sectionSubtitle}>Pengguna terdaftar dalam sistem</p>
          </div>
          {!loading && displayedAndSortedUsers.length > 0 && (
            <span className={s.counterBadge}>{displayedAndSortedUsers.length}</span>
          )}
        </div>

        {error ? <div className={s.errorState}>{error}</div> : null}
        {loading ? <div className={s.loadingState}>Memuat data user...</div> : null}

        {!loading && !error ? (
          <>
            <Pagination
              instanceId="top"
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={displayedAndSortedUsers.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setCurrentPage}
            />
          <div className={s.tableWrap}>
            <table className={s.table}>
              <thead>
                <tr>
                  <th className={styles.colCenter}>NPK</th>
                  <th className={styles.sortableHeader} onClick={() => handleSort("name")}>
                    Name {renderSortIcon("name")}
                  </th>
                  <th className={styles.sortableHeader} onClick={() => handleSort("email")}>
                    Email {renderSortIcon("email")}
                  </th>
                  <th className={styles.colCenter}>Phone</th>
                  <th className={`${styles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("role")}>
                    Role {renderSortIcon("role")}
                  </th>
                  <th className={`${styles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("status")}>
                    Status {renderSortIcon("status")}
                  </th>
                  <th className={styles.colCenter}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className={s.emptyState}>
                        <div className={s.emptyIcon}>👤</div>
                        <div className={s.emptyText}>Tidak ada data user</div>
                        <div className={s.emptySubtext}>Coba ubah filter atau tambahkan user baru</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedUsers.map((user) => (
                    <tr key={user.UserId}>
                      <td className={`${s.cellMono} ${styles.colCenter}`}>{user.NPK || "-"}</td>
                      <td className={s.cellName}>{user.DisplayName}</td>
                      <td className={s.cellEmail}>{user.Email}</td>
                      <td className={styles.colCenter}>{user.PhoneNumber || "-"}</td>
                      <td className={styles.colCenter}>
                        <span className={roleBadgeClass(user.Role)}>{roleLabel(user.Role)}</span>
                      </td>
                      <td className={styles.colCenter}>
                        <span
                          className={`${s.badge} ${user.IsActive ? s.badgeActive : s.badgeInactive}`}
                        >
                          {user.IsActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className={styles.colCenter}>
                        <div className={s.btnRow}>
                          <button
                            className={s.btnEdit}
                            type="button"
                            onClick={() => openEditModal(user)}
                          >
                            ✏️ Edit
                          </button>
                          <button
                            className={user.IsActive ? s.btnDeactivate : s.btnActivate}
                            type="button"
                            onClick={() => onToggleUserStatus(user)}
                          >
                            {user.IsActive ? "⊘ Deactivate" : "✓ Activate"}
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
              totalItems={displayedAndSortedUsers.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setCurrentPage}
            />
          </>
        ) : null}
      </div>

      {/* Upload Section */}
      <div className={s.sectionCard} style={{ animationDelay: "0.18s" }}>
        <div className={s.sectionHeader}>
          <div className={`${s.sectionIcon} ${s.iconAmber}`}>📤</div>
          <div className={s.sectionTitleWrap}>
            <h2 className={s.sectionTitle}>Upload Data Master</h2>
            <p className={s.sectionSubtitle}>Unggah user admin/IT lead dari file Excel</p>
          </div>
        </div>
        <div className={s.uploadRow}>
          <div className={s.filePickerWrap}>
            <input
              id="master-user-file"
              className={s.fileInputHidden}
              type="file"
              accept=".xlsx,.xls"
              onChange={onPickFile}
            />
            <label className={s.fileTrigger} htmlFor="master-user-file">
              Choose File
            </label>
            <span className={s.fileText}>{selectedFileName}</span>
            {selectedFileName !== "No file chosen" && (
              <button type="button" className={s.fileClearBtn} aria-label="Clear file" onClick={() => { setSelectedFileName("No file chosen"); const fi = document.getElementById("master-user-file") as HTMLInputElement | null; if (fi) fi.value = ""; }}>✕</button>
            )}
          </div>
          <button className={s.btnTemplate} onClick={onDownloadTemplate} type="button">
            📋 Download Template
          </button>
          <button className={s.btnUpload} onClick={onUpload} type="button">
            📥 Upload
          </button>
        </div>
        <div className={s.uploadNote}>
          Silakan klik <strong>Download Template</strong> terlebih dahulu untuk melihat format kolom, contoh pengisian, dan petunjuk lengkap.
          Template sudah berisi sheet <em>Petunjuk</em> dengan penjelasan setiap kolom dan catatan penting.
        </div>
      </div>

      <MasterUserFormModal
        editingUser={editingUser}
        errors={formErrors}
        newDisplayName={newDisplayName}
        newEmail={newEmail}
        newNpk={newNpk}
        newPassword={newPassword}
        newPhoneNumber={newPhoneNumber}
        newRole={newRole}
        newStatus={newStatus}
        newUseLdap={newUseLdap}
        newUsername={newUsername}
        onClose={resetUserForm}
        onSubmit={onSubmitUser}
        setNewDisplayName={(v) => { setNewDisplayName(v); if (formErrors.displayName) setFormErrors((p) => ({ ...p, displayName: undefined })); }}
        setNewEmail={(v) => { setNewEmail(v); if (formErrors.email) setFormErrors((p) => ({ ...p, email: undefined })); }}
        setNewNpk={(v) => { setNewNpk(v); if (formErrors.npk) setFormErrors((p) => ({ ...p, npk: undefined })); }}
        setNewPassword={(v) => { setNewPassword(v); if (formErrors.password) setFormErrors((p) => ({ ...p, password: undefined })); }}
        setNewPhoneNumber={(v) => { setNewPhoneNumber(v); if (formErrors.phoneNumber) setFormErrors((p) => ({ ...p, phoneNumber: undefined })); }}
        setNewRole={setNewRole}
        setNewStatus={setNewStatus}
        setNewUseLdap={setNewUseLdap}
        setNewUsername={(v) => { setNewUsername(v); if (formErrors.username) setFormErrors((p) => ({ ...p, username: undefined })); }}
        showCreateModal={showCreateModal}
        submittingUser={submittingUser}
      />
      <ConfirmDialog
        open={Boolean(confirmTargetUser)}
        title={confirmNextIsActive ? "Activate User" : "Deactivate User"}
        message={
          confirmTargetUser
            ? (confirmNextIsActive
                ? `Aktifkan user ${confirmTargetUser.DisplayName}?`
                : `Nonaktifkan user ${confirmTargetUser.DisplayName}?`)
            : ""
        }
        confirmLabel={confirmNextIsActive ? "Activate" : "Deactivate"}
        variant={confirmNextIsActive ? "primary" : "danger"}
        isLoading={confirmSubmitting}
        onConfirm={() => {
          void onConfirmToggleStatus();
        }}
        onCancel={closeStatusConfirm}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
