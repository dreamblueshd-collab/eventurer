"use client";

import { getCurrentUser } from "@/lib/auth";
import { getEventStatusLabel, resolveEventStatus } from "@/lib/event-status";
import { createEventDraft, deleteEventById, fetchEventsOverview, updateEventById } from "@/lib/surveys";
import { fetchEventDetail } from "@/lib/survey-events";
import { searchAdminEventUsers, type AdminEventUser } from "@/lib/users";
import type { UserRole } from "@/types/auth";
import type { SurveyOverviewItem } from "@/types/survey";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import { useToast, ToastContainer } from "@/components/common/toast";
import { Pagination } from "@/components/admin/pagination";
import styles from "../page-mockup.module.css";
import s from "./event-management.module.css";
import CreateEventModal, { type CreateEventFormErrors } from "./create-event-modal";
import {
  formatLastEdited,
  matchesStatusFilter,
  sanitizeSurveyDescription,
} from "./event-management-utils";

export default function EventManagementPage() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [eventType, setEventType] = useState<"survey" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [adminEventInput, setAdminEventInput] = useState("");
  const [selectedAdminEvents, setSelectedAdminEvents] = useState<AdminEventUser[]>([]);
  const [adminEventSuggestions, setAdminEventSuggestions] = useState<AdminEventUser[]>([]);
  const [showAdminSuggestion, setShowAdminSuggestion] = useState(false);
  const [draftDescription, setDraftDescription] = useState("");
  const [createEventErrors, setCreateEventErrors] = useState<CreateEventFormErrors>({});

  const [statusFilter, setStatusFilter] = useState("all");

  const [surveys, setSurveys] = useState<SurveyOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<SurveyOverviewItem | null>(null);
  const [editingSurveyId, setEditingSurveyId] = useState<number | null>(null);

  const [currentUser] = useState(() => getCurrentUser());
  const [currentRole] = useState<UserRole | null>(() => currentUser?.role ?? null);

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [pageSize, setPageSize] = useState(25);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortColumn, setSortColumn] = useState<string | null>("updatedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const { toasts, showToast, removeToast } = useToast();

  const activeAdminQuery = useMemo(() => adminEventInput.trim(), [adminEventInput]);

  const loadEvents = useCallback(async () => {
    setLoading(true);

    try {
      const roleBasedFilter = currentRole === "AdminEvent" && currentUser?.userId
        ? { assignedAdminId: String(currentUser.userId) }
        : undefined;

      // Both SuperAdmin and AdminEvent see parent events
      const result = await fetchEventsOverview(roleBasedFilter);

      if (!result.success) {
        setError(result.message || "Gagal memuat data");
        setSurveys([]);
        return;
      }

      setError("");
      setSurveys(result.events);
    } catch {
      setError("Terjadi kesalahan saat memuat data");
      setSurveys([]);
    } finally {
      setLoading(false);
    }
  }, [currentRole, currentUser]);
  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (!showCreateModal) return;
    const query = activeAdminQuery;
    if (query.length < 2) {
      setAdminEventSuggestions([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const result = await searchAdminEventUsers(query);
      if (!result.success) {
        setAdminEventSuggestions([]);
        return;
      }
      setAdminEventSuggestions(result.users);
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [activeAdminQuery, showCreateModal]);

  const filteredAndSortedSurveys = useMemo(() => {
    const normalizedKeyword = appliedKeyword.trim().toLowerCase();

    const filtered = surveys
      .filter((survey) => {
        const effectiveStatus = resolveEventStatus(survey);

        if (!matchesStatusFilter(effectiveStatus, statusFilter)) return false;

        if (!normalizedKeyword) return true;

        if (appliedSearchBy === "event") {
          return survey.Title.toLowerCase().includes(normalizedKeyword);
        }

        if (appliedSearchBy === "admin") {
          return (survey.AssignedAdminName || "").toLowerCase().includes(normalizedKeyword);
        }

        return (
          survey.Title.toLowerCase().includes(normalizedKeyword) ||
          (survey.AssignedAdminName || "").toLowerCase().includes(normalizedKeyword)
        );
      });

    if (!sortColumn) return [...filtered].sort((a, b) => {
      const aDate = new Date(a.UpdatedAt || a.CreatedAt || 0).getTime();
      const bDate = new Date(b.UpdatedAt || b.CreatedAt || 0).getTime();
      return bDate - aDate;
    });

    return [...filtered].sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortColumn) {
        case "event":
          aVal = (a.Title || "").toLowerCase();
          bVal = (b.Title || "").toLowerCase();
          break;
        case "subevent":
          aVal = a.SurveyCount ?? 0;
          bVal = b.SurveyCount ?? 0;
          break;
        case "admin":
          aVal = (a.AssignedAdminName || "").toLowerCase();
          bVal = (b.AssignedAdminName || "").toLowerCase();
          break;
        case "status":
          aVal = resolveEventStatus(a).toLowerCase();
          bVal = resolveEventStatus(b).toLowerCase();
          break;
        case "updatedAt":
          aVal = new Date(a.UpdatedAt || a.CreatedAt || 0).getTime();
          bVal = new Date(b.UpdatedAt || b.CreatedAt || 0).getTime();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [
    surveys,
    statusFilter,
    appliedSearchBy,
    appliedKeyword,
    sortColumn,
    sortDirection,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredAndSortedSurveys.length / pageSize));
  const paginatedSurveys = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedSurveys.slice(start, start + pageSize);
  }, [filteredAndSortedSurveys, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, appliedKeyword, appliedSearchBy]);

  const closeModal = () => {
    setShowCreateModal(false);
    setEventType(null);
    setEditingSurveyId(null);
    setDraftName("");
    setAdminEventInput("");
    setSelectedAdminEvents([]);
    setAdminEventSuggestions([]);
    setShowAdminSuggestion(false);
    setDraftDescription("");
    setCreateEventErrors({});
  };

  const applyAdminSelection = (user: AdminEventUser) => {
    setSelectedAdminEvents((previous) => {
      if (previous.some((item) => item.UserId === user.UserId)) {
        return previous;
      }
      return [...previous, user];
    });
    setAdminEventInput("");
    setShowAdminSuggestion(false);
    setAdminEventSuggestions([]);
  };

  const removeAdminSelection = (userId: number) => {
    setSelectedAdminEvents((previous) => previous.filter((item) => item.UserId !== userId));
  };

  const handleCreateDraft = async () => {
    const nextErrors: CreateEventFormErrors = {};
    if (!draftName.trim()) nextErrors.draftName = "Nama event wajib diisi.";
    if (!isParentEventEditMode && selectedAdminEvents.length === 0) nextErrors.selectedAdminEvents = "Minimal satu Admin Event harus dipilih.";
    if (Object.keys(nextErrors).length > 0) {
      setCreateEventErrors(nextErrors);
      return;
    }
    setCreateEventErrors({});

    setSubmitting(true);
    const requestPayload = isParentEventEditMode
      ? {
          title: draftName.trim(),
        }
      : {
          title: draftName.trim(),
          description: sanitizeSurveyDescription(draftDescription),
          assignedAdminId: selectedAdminEvents[0]?.UserId,
          assignedAdminIds: selectedAdminEvents.map((user) => user.UserId),
          status: "Draft",
        };
    const createResult = editingSurveyId
      ? await updateEventById(editingSurveyId, requestPayload, true)
      : await createEventDraft(requestPayload);
    setSubmitting(false);

    if (!createResult.success) {
      showToast("error", createResult.message || (editingSurveyId ? "Gagal mengubah event" : "Gagal membuat event"));
      return;
    }

    closeModal();
    await loadEvents();
    showToast("success", editingSurveyId ? "Event berhasil diperbarui" : "Draft event berhasil dibuat");
  };

  const handleEditDraft = async (surveyId: number) => {
    setSubmitting(true);
    // SuperAdmin edits parent events, so we need to fetch from /events endpoint
    // to get the correct parent event data, not child survey data
    const result = await fetchEventDetail(String(surveyId));
    setSubmitting(false);

    if (!result.success || !result.event) {
      showToast("error", result.message || "Detail event tidak dapat dimuat.");
      return;
    }

    setEditingSurveyId(surveyId);
    setEventType("survey");
    setDraftName(result.event.Title || "");
    setDraftDescription(result.event.Description || "");
    const assignedAdminIds = result.event.AssignedAdminIds || (result.event.AssignedAdminId ? [result.event.AssignedAdminId] : []);
    const assignedAdminNames = result.event.AssignedAdminNames || (result.event.AssignedAdminName ? [result.event.AssignedAdminName] : []);
    const assignedAdminUsernames = result.event.AssignedAdminUsernames || [];
    setSelectedAdminEvents(
      assignedAdminIds.map((userId, index) => ({
        UserId: userId,
        DisplayName: String(assignedAdminNames[index] || assignedAdminNames[0] || assignedAdminUsernames[index] || assignedAdminUsernames[0] || `Admin Event ${index + 1}`),
        Username: String(assignedAdminUsernames[index] || assignedAdminUsernames[0] || ""),
        Email: "",
        Role: "AdminEvent",
        IsActive: true,
      })),
    );
    setAdminEventInput("");
    setAdminEventSuggestions([]);
    setShowAdminSuggestion(false);
    setShowCreateModal(true);
  };

  const handleDeleteDraft = async () => {
    if (!deleteTarget) return;

    setSubmitting(true);
    const result = await deleteEventById(deleteTarget.SurveyId);
    setSubmitting(false);

    if (!result.success) {
      showToast("error", result.message || "Gagal menghapus event.");
      return;
    }

    setDeleteTarget(null);
    await loadEvents();
    showToast("success", "Draft event berhasil dihapus.");
  };


  const canCreateEvent = currentRole === "SuperAdmin";
  const isSuperAdmin = currentRole === "SuperAdmin";
  const isParentEventEditMode = isSuperAdmin && editingSurveyId !== null;
  const showActionColumn = currentRole === "AdminEvent" || isSuperAdmin;

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
      return;
    }
    setSortColumn(column);
    setSortDirection(column === "updatedAt" ? "desc" : "asc");
  };

  const renderSortIcon = (column: string) => {
    if (sortColumn !== column) return <span className={s.sortIcon}>⇅</span>;
    return sortDirection === "asc" ? <span className={s.sortIcon}>▲</span> : <span className={s.sortIcon}>▼</span>;
  };

  const statusBadgeClass = (status: string) => {
    if (status === "Active") return s.badgeActive;
    if (status === "Draft") return s.badgeDraft;
    if (status === "In Design") return s.badgeDesign;
    if (status === "Closed") return s.badgeClosed;
    return s.badgeDraft;
  };

  return (
    <>
      {/* ── Page Header ── */}
      <div className={styles.pageHead}>
        <div>
          <h1 className={styles.title}>Event Management</h1>
          <p className={styles.subtitle}>Kelola event survey CSI — buat draft, desain, dan operasikan.</p>
        </div>
        {canCreateEvent ? (
          <div className={styles.toolbar}>
            <button
              className={s.btnCreate}
              onClick={() => {
                // SuperAdmin langsung set eventType, AdminEvent tetap pilih type
                if (currentRole === "SuperAdmin") {
                  setEventType("survey");
                }
                setShowCreateModal(true);
              }}
              type="button"
            >
              + Create Event
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Filter ── */}
      <div className={s.filterCard}>
        <div className={s.filterHeader}>
          <span className={s.filterIcon}>🔍</span>
          <span className={s.filterTitle}>Filter &amp; Pencarian</span>
        </div>
        <div className={styles.filterToolbar}>
          <div className={`${styles.filterGroup} ${styles.filterGroupMd}`}>
            <label id="evt-status-label" className={styles.filterLabel} htmlFor="evt-status-dropdown">Status</label>
            <Dropdown id="evt-status-dropdown" className={styles.filterControl} options={[{ value: "all", label: "Semua Status" }, { value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }]} value={statusFilter} onChange={setStatusFilter} aria-labelledby="evt-status-label" />
          </div>
          <SearchBar options={[{ value: "all", label: "Search By" }, { value: "event", label: "Event Name" }, { value: "admin", label: "Admin Event" }]} selectedValue={searchBy} keyword={keyword} onSelectedValueChange={setSearchBy} onKeywordChange={setKeyword} onButtonClick={onApplySearch} placeholder="Cari event..." />
        </div>
      </div>

      {/* ── Event Table ── */}
      <div className={s.sectionCard} style={{ animationDelay: "0.10s" }}>
        <div className={s.sectionHeader}>
          <div className={`${s.sectionIcon} ${s.iconBlue}`}>📋</div>
          <div className={s.sectionTitleWrap}>
            <div className={s.sectionTitle}>Daftar Event</div>
            <div className={s.sectionSubtitle}>Semua event survey yang terdaftar</div>
          </div>
          <div className={s.sectionHeaderRight}>
            <span className={s.countBadge}>{filteredAndSortedSurveys.length} event</span>
          </div>
        </div>

        {error ? <div className={s.errorText}>⚠️ {error}</div> : null}

        {loading ? (
          <div className={s.loadingBar}>
            <div className={styles.spinner} />
            Memuat data event...
          </div>
        ) : null}

        {/* ── Pagination (Top) ── */}
        {!loading && !error ? (
          <Pagination
            instanceId="top"
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredAndSortedSurveys.length}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        ) : null}

        {!loading && !error ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  {isSuperAdmin ? (
                    <>
                      <th scope="col" onClick={() => handleSort("event")}>Event{renderSortIcon("event")}</th>
                      <th scope="col" className={s.colCenter} onClick={() => handleSort("subevent")}>Total Sub Event{renderSortIcon("subevent")}</th>
                      <th scope="col" onClick={() => handleSort("admin")}>Admin Event{renderSortIcon("admin")}</th>
                      <th scope="col" className={s.colCenter} onClick={() => handleSort("status")}>Status{renderSortIcon("status")}</th>
                      <th scope="col" className={s.colCenter} onClick={() => handleSort("updatedAt")}>Last Edited{renderSortIcon("updatedAt")}</th>
                      {showActionColumn ? <th scope="col" className={s.colCenter}>Aksi</th> : null}
                    </>
                  ) : (
                    <>
                      <th scope="col" onClick={() => handleSort("event")}>Event{renderSortIcon("event")}</th>
                      <th scope="col" className={s.colCenter} onClick={() => handleSort("subevent")}>Total Sub Event{renderSortIcon("subevent")}</th>
                      <th scope="col" className={s.colCenter} onClick={() => handleSort("status")}>Status{renderSortIcon("status")}</th>
                      <th scope="col" className={s.colCenter} onClick={() => handleSort("updatedAt")}>Last Edited{renderSortIcon("updatedAt")}</th>
                      {showActionColumn ? <th scope="col" className={s.colCenter}>Aksi</th> : null}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={isSuperAdmin ? (showActionColumn ? 6 : 5) : (showActionColumn ? 5 : 4)}>
                      <div className={s.emptyState}>
                        <div className={s.emptyIcon}>📋</div>
                        <p className={s.emptyTitle}>Tidak ada data event</p>
                        <p className={s.emptyDesc}>Coba ubah filter atau buat event baru.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSurveys.map((row) => {
                    const effectiveStatus = resolveEventStatus(row);
                    const canContinueDesignAction =
                      effectiveStatus === "Draft" || effectiveStatus === "In Design" || effectiveStatus === "Active";
                    const canViewDesignAction = effectiveStatus === "Closed";

                    return (
                      <tr key={row.SurveyId}>
                        {isSuperAdmin ? (
                          <>
                            <td><span className={s.eventTitle}>{row.Title}</span></td>
                            <td className={s.colCenter}><span className={s.surveyCount}>{row.SurveyCount || 0} sub event</span></td>
                            <td><span className={s.adminName}>{row.AssignedAdminName || "-"}</span></td>
                            <td className={s.colCenter}>
                              <span className={statusBadgeClass(effectiveStatus)}>
                                {getEventStatusLabel(effectiveStatus)}
                              </span>
                            </td>
                            <td className={s.colCenter}><span className={s.lastEdited}>{formatLastEdited(row.UpdatedAt, row.CreatedAt)}</span></td>
                            {showActionColumn ? (
                              <td className={s.colCenter}>
                                <div className={s.actionGroup}>
                                  <Link href={`/admin/event-management/${row.SurveyId}`} className={`${s.btnAction} ${s.btnDesign}`}>
                                    👁️ View Event
                                  </Link>
                                  <button type="button" className={`${s.btnAction} ${s.btnEdit}`} onClick={() => void handleEditDraft(row.SurveyId)}>
                                    ✏️ Edit
                                  </button>
                                  <button type="button" className={`${s.btnAction} ${s.btnDelete}`} onClick={() => setDeleteTarget(row)}>
                                    🗑️ Delete
                                  </button>
                                </div>
                              </td>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <td><span className={s.eventTitle}>{row.Title}</span></td>
                            <td className={s.colCenter}><span className={s.surveyCount}>{row.SurveyCount || 0} sub event</span></td>
                            <td className={s.colCenter}>
                              <span className={statusBadgeClass(effectiveStatus)}>
                                {getEventStatusLabel(effectiveStatus)}
                              </span>
                            </td>
                            <td className={s.colCenter}><span className={s.lastEdited}>{formatLastEdited(row.UpdatedAt, row.CreatedAt)}</span></td>
                            {showActionColumn ? (
                              <td className={s.colCenter}>
                                {canContinueDesignAction || canViewDesignAction ? (
                                  <div className={s.actionGroup}>
                                    <Link href={`/admin/event-management/${row.SurveyId}`} className={`${s.btnAction} ${s.btnDesign}`}>
                                      👁️ Lihat Event
                                    </Link>
                                  </div>
                                ) : (
                                  <span className={s.noAction}>—</span>
                                )}
                              </td>
                            ) : null}
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {/* ── Pagination (Bottom) ── */}
        {!loading && !error ? (
          <Pagination
            instanceId="bottom"
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredAndSortedSurveys.length}
            itemsPerPage={pageSize}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </div>

      {/* ── Create/Edit Modal ── */}
      <CreateEventModal
        adminEventInput={adminEventInput}
        adminEventSuggestions={adminEventSuggestions}
        applyAdminSelection={(user) => { applyAdminSelection(user); if (createEventErrors.selectedAdminEvents) setCreateEventErrors((p) => ({ ...p, selectedAdminEvents: undefined })); }}
        closeModal={closeModal}
        draftDescription={draftDescription}
        draftName={draftName}
        errors={createEventErrors}
        eventType={eventType}
        handleCreateDraft={handleCreateDraft}
        removeAdminSelection={removeAdminSelection}
        selectedAdminEvents={selectedAdminEvents}
        setAdminEventInput={setAdminEventInput}
        setDraftDescription={setDraftDescription}
        setDraftName={(v) => { setDraftName(v); if (createEventErrors.draftName) setCreateEventErrors((p) => ({ ...p, draftName: undefined })); }}
        setEventType={setEventType}
        setShowAdminSuggestion={setShowAdminSuggestion}
        showAdminSuggestion={showAdminSuggestion}
        showCreateModal={showCreateModal}
        submitting={submitting}
        submitLabel={editingSurveyId ? "Save" : "Create"}
        title={editingSurveyId ? (isSuperAdmin ? "Edit Parent Event" : "Edit Survey Event") : undefined}
        isSuperAdmin={isSuperAdmin}
        isParentEventEditMode={isParentEventEditMode}
      />

      {/* ── Delete Confirmation Modal ── */}
      {deleteTarget ? (
        <div className={s.modalOverlay} onClick={() => setDeleteTarget(null)} role="presentation">
          <div className={s.modalCard} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="delete-event-modal-title">
            <div className={s.modalHeader}>
              <div className={s.modalHeaderLeft}>
                <div className={`${s.modalIcon} ${s.iconRed}`}>🗑️</div>
                <h2 id="delete-event-modal-title" className={s.modalTitle}>Delete Draft Event</h2>
              </div>
              <button className={s.modalClose} onClick={() => setDeleteTarget(null)} type="button" aria-label="Tutup modal">✕</button>
            </div>
            <div className={s.modalBody}>
              <p className={s.modalText}>
                Hapus draft <strong>&quot;{deleteTarget.Title}&quot;</strong>? Tindakan ini tidak bisa dibatalkan.
              </p>
            </div>
            <div className={s.modalFooter}>
              <button className={s.modalBtnSecondary} onClick={() => setDeleteTarget(null)} type="button">Cancel</button>
              <button className={s.modalBtnDanger} onClick={() => void handleDeleteDraft()} disabled={submitting} type="button">
                {submitting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Feedback Modal ── */}

      {/* ── Toast Notifications ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}
