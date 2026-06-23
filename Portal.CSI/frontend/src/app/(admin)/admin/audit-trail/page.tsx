"use client";

import { Pagination } from "@/components/admin/pagination";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import DatePicker from "@/components/common/date-picker";
import { getCurrentUser } from "@/lib/auth";
import { fetchAuditLogs, type AuditLogItem } from "@/lib/audit";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import baseStyles from "../page-mockup.module.css";
import styles from "./audit-trail.module.css";

const MAX_RANGE_DAYS = 365;

function isRangeExceeded(start: string, end: string): boolean {
  if (!start || !end) return false;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return false;
  return (e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24) > MAX_RANGE_DAYS;
}

function clampEndDate(start: string): string {
  if (!start) return "";
  const s = new Date(start);
  if (Number.isNaN(s.getTime())) return "";
  const max = new Date(s.getTime() + MAX_RANGE_DAYS * 24 * 60 * 60 * 1000);
  return max.toISOString().slice(0, 10);
}

const ACTION_OPTIONS = [
  { value: "all", label: "Semua Action" },
  { value: "Create", label: "Create" },
  { value: "Update", label: "Update" },
  { value: "Delete", label: "Delete" },
  { value: "Access", label: "Access" },
  { value: "Login", label: "Login" },
  { value: "Logout", label: "Logout" },
  { value: "LoginFailed", label: "Login Failed" },
  { value: "Approve", label: "Approve" },
  { value: "Reject", label: "Reject" },
  { value: "Export", label: "Export" },
];

const SEARCH_BY_OPTIONS = [
  { value: "all", label: "Search By" },
  { value: "username", label: "Username" },
  { value: "entityId", label: "Entity ID" },
  { value: "ipAddress", label: "IP Address" },
  { value: "userAgent", label: "User Agent" },
];

type ModalState = { type: "none" } | { type: "detail"; item: AuditLogItem };

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric" }).format(d);
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(d);
}

function formatDateTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).format(d);
}

function formatJson(value: unknown): string {
  if (value === null || value === undefined) return "";
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function badgeClass(action: string): string {
  const map: Record<string, string> = {
    Create: styles.badgeCreate,
    Update: styles.badgeUpdate,
    Delete: styles.badgeDelete,
    Login: styles.badgeLogin,
    Logout: styles.badgeLogout,
    LoginFailed: styles.badgeLoginFailed,
    Approve: styles.badgeApprove,
    Reject: styles.badgeReject,
    Export: styles.badgeExport,
    Access: styles.badgeAccess,
  };
  return `${styles.badge} ${map[action] ?? styles.badgeDefault}`;
}

function dotClass(action: string): string {
  const map: Record<string, string> = {
    Create: styles.dotCreate,
    Update: styles.dotUpdate,
    Delete: styles.dotDelete,
    Login: styles.dotLogin,
    Logout: styles.dotLogout,
    LoginFailed: styles.dotLoginFailed,
    Approve: styles.dotApprove,
    Reject: styles.dotReject,
    Export: styles.dotExport,
    Access: styles.dotAccess,
  };
  return `${styles.dot} ${map[action] ?? styles.dotDefault}`;
}

function fmtNum(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function AuditTrailPage() {
  const user = getCurrentUser();
  const role: UserRole | null = user?.role ?? null;
  const canAccess = role === "SuperAdmin";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [modal, setModal] = useState<ModalState>({ type: "none" });

  // Filter state
  const [keyword, setKeyword] = useState("");
  const [searchBy, setSearchBy] = useState("all");
  const [entityTypeFilter, setEntityTypeFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const rangeExceeded = isRangeExceeded(startDate, endDate);
  const maxEndDate = clampEndDate(startDate);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value > endDate) {
      setEndDate('');
    } else if (value && endDate && isRangeExceeded(value, endDate)) {
      setEndDate(clampEndDate(value));
    }
  };

  const handleEndDateChange = (value: string) => {
    if (startDate && value && value < startDate) {
      return;
    }
    if (startDate && value && isRangeExceeded(startDate, value)) {
      setEndDate(clampEndDate(startDate));
    } else {
      setEndDate(value);
    }
  };

  const [allEntityTypes, setAllEntityTypes] = useState<string[]>([]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (rows.length === 0) return;
    setAllEntityTypes(prev => {
      const combined = new Set([...prev, ...rows.map(r => String(r.EntityType || '').trim()).filter(Boolean)]);
      return Array.from(combined).sort();
    });
  }, [rows]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const entityTypeOptions = useMemo(() => [
    { value: 'all', label: 'Semua Entity' },
    ...allEntityTypes.map(v => ({ value: v, label: v }))
  ], [allEntityTypes]);

  useEffect(() => {
    if (!canAccess) return;
    let active = true;

    const run = async () => {
      setLoading(true);
      setError("");

      const result = await fetchAuditLogs({
        page,
        pageSize: pageSize,
        keyword: keyword.trim() || undefined,
        searchBy: searchBy as "all" | "username" | "entityId" | "ipAddress" | "userAgent",
        action: actionFilter,
        entityType: entityTypeFilter,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });

      if (!active) return;
      setLoading(false);

      if (!result.success) {
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setError(result.message || "Gagal memuat audit trail");
        return;
      }

      setRows(result.logs);
      setTotal(result.total);
      setTotalPages(Math.max(1, result.totalPages));
    };

    void run();
    return () => { active = false; };
  }, [canAccess, page, pageSize, keyword, searchBy, actionFilter, entityTypeFilter, startDate, endDate]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setPage(1);
  }, [pageSize]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!canAccess) {
    return (
      <section className={baseStyles.panel}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Halaman Audit Trail hanya untuk role SuperAdmin.</p>
      </section>
    );
  }

  return (
    <>
      {/* Page Header */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Audit Trail</h1>
          <p className={baseStyles.subtitle}>Riwayat aktivitas sistem — monitoring perubahan data dan aksi pengguna secara real-time.</p>
        </div>
      </div>

      {/* Filter Panel */}
      <div className={`${styles.sectionCard} ${styles.filterCard}`} style={{ animationDelay: "0.05s" }}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>🔍</div>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Filter &amp; Pencarian</h2>
            <p className={styles.sectionSubtitle}>Atur parameter pencarian log aktivitas</p>
          </div>
        </div>

        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="audit-action-label" className={styles.filterLabel} htmlFor="audit-action-dropdown">Action</label>
            <Dropdown
              id="audit-action-dropdown"
              className={`${styles.filterSelect} ${baseStyles.fullWidthControl}`}
              fullWidth
              options={ACTION_OPTIONS}
              value={actionFilter}
              onChange={setActionFilter}
              aria-labelledby="audit-action-label"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="audit-entity-label" className={styles.filterLabel} htmlFor="audit-entity-dropdown">Entity Type</label>
            <Dropdown
              id="audit-entity-dropdown"
              className={`${styles.filterSelect} ${baseStyles.fullWidthControl}`}
              fullWidth
              options={entityTypeOptions}
              value={entityTypeFilter}
              onChange={setEntityTypeFilter}
              aria-labelledby="audit-entity-label"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label className={styles.filterLabel} htmlFor="auditStart">Tanggal Mulai</label>
            <DatePicker
              id="auditStart"
              value={startDate}
              onChange={handleStartDateChange}
              placeholder="Tanggal mulai"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label className={styles.filterLabel} htmlFor="auditEnd">Tanggal Akhir</label>
            <DatePicker
              id="auditEnd"
              value={endDate}
              onChange={handleEndDateChange}
              min={startDate || undefined}
              max={maxEndDate || undefined}
              placeholder="Tanggal akhir"
            />
            {rangeExceeded && <p className={styles.periodWarning}>⚠️ Maks. rentang 1 tahun</p>}
          </div>
          <SearchBar
            options={SEARCH_BY_OPTIONS}
            selectedValue={searchBy}
            keyword={keyword}
            onSelectedValueChange={setSearchBy}
            onKeywordChange={setKeyword}
            placeholder={
              searchBy === "username" ? "Cari username..."
              : searchBy === "entityId" ? "Cari entity ID..."
              : searchBy === "ipAddress" ? "Cari IP Address..."
              : searchBy === "userAgent" ? "Cari user agent..."
              : "Pilih Search By"
            }
          />
        </div>
      </div>

      {/* Table Panel */}
      <div className={styles.sectionCard} style={{ animationDelay: "0.12s" }}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconGreen}`}>📋</div>
          <div className={styles.sectionTitleWrap}>
            <h2 className={styles.sectionTitle}>Log Aktivitas</h2>
            <p className={styles.sectionSubtitle}>
              {loading ? "Memuat..." : `${fmtNum(total)} entri ditemukan`}
            </p>
          </div>
          {!loading && total > 0 && (
            <span className={styles.counterBadge}>{fmtNum(total)}</span>
          )}
        </div>

        {/* Pagination (Top) */}
        {!loading && !error && rows.length > 0 && (
          <Pagination
            instanceId="top"
            currentPage={page}
            totalPages={totalPages}
            totalItems={total}
            itemsPerPage={pageSize}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col" className={baseStyles.colCenter}>Waktu</th>
                <th scope="col">Pengguna</th>
                <th scope="col" className={baseStyles.colCenter}>Action</th>
                <th scope="col" className={baseStyles.colCenter}>Entity</th>
                <th scope="col" className={baseStyles.colCenter}>IP Address</th>
                <th scope="col">User Agent</th>
                <th scope="col" className={baseStyles.colCenter}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr className={styles.loadingRow}>
                  <td colSpan={7}>Memuat data audit log...</td>
                </tr>
              ) : error ? (
                <tr className={styles.errorRow}>
                  <td colSpan={7}>{error}</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>🔍</div>
                      <div className={styles.emptyText}>Tidak ada data audit log</div>
                      <div className={styles.emptySubtext}>Coba ubah filter atau rentang tanggal</div>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((item) => (
                  <tr key={item.LogId}>
                    <td className={`${styles.cellTime} ${baseStyles.colCenter}`}>
                      <div>{formatDate(item.Timestamp)}</div>
                      <div className={styles.cellTimeSub}>{formatTime(item.Timestamp)}</div>
                    </td>
                    <td>
                      <div className={styles.rowIndicator}>
                        <span className={dotClass(item.Action)} aria-hidden="true" />
                        <span className={styles.cellUser}>{item.Username || "-"}</span>
                      </div>
                    </td>
                    <td className={baseStyles.colCenter}>
                      <span className={badgeClass(item.Action)}>{item.Action}</span>
                    </td>
                    <td className={baseStyles.colCenter}>
                      <div className={styles.cellEntity}>{item.EntityType || "-"}</div>
                      {item.EntityId ? (
                        <div className={styles.cellEntitySub} title={String(item.EntityId)}>
                          {String(item.EntityId).slice(0, 8)}…
                        </div>
                      ) : null}
                    </td>
                    <td className={`${styles.cellIp} ${baseStyles.colCenter}`}>{item.IPAddress || "-"}</td>
                    <td>
                      <div className={styles.cellUa} title={item.UserAgent ?? undefined}>
                        {item.UserAgent || "-"}
                      </div>
                    </td>
                    <td className={baseStyles.colCenter}>
                      <button
                        type="button"
                        className={styles.btnView}
                        aria-label={`Lihat detail log ${item.Action} oleh ${item.Username || "-"}`}
                        onClick={() => setModal({ type: "detail", item })}
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination (Bottom) */}
        <Pagination
          instanceId="bottom"
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          itemsPerPage={pageSize}
          onPageChange={setPage}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* Detail Modal */}
      {modal.type === "detail" ? (
        <div
          className={styles.modalOverlay}
          onClick={() => setModal({ type: "none" })}
          role="presentation"
        >
          <div
            className={styles.modalCard}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auditModalTitle"
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>🔎</div>
                <div>
                  <h3 id="auditModalTitle" className={styles.modalTitle}>
                    Detail Audit Log
                  </h3>
                  <p className={styles.modalSubtitle}>
                    <span className={`${badgeClass(modal.item.Action)} ${styles.modalActionBadge}`}>
                      {modal.item.Action}
                    </span>
                    &nbsp;·&nbsp;{formatDateTime(modal.item.Timestamp)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className={styles.modalClose}
                aria-label="Tutup modal"
                onClick={() => setModal({ type: "none" })}
              >
                ✕
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Identity */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Identitas Log</p>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Log ID</p>
                    <p className={`${styles.detailValue} ${styles.detailValueMono}`}>{modal.item.LogId}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Timestamp</p>
                    <p className={styles.detailValue}>{formatDateTime(modal.item.Timestamp)}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Username</p>
                    <p className={styles.detailValue}>{modal.item.Username || "-"}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Action</p>
                    <p className={styles.detailValue}>{modal.item.Action || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Entity */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Entitas Terdampak</p>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Entity Type</p>
                    <p className={styles.detailValue}>{modal.item.EntityType || "-"}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>Entity ID</p>
                    <p className={`${styles.detailValue} ${styles.detailValueMono}`}>{modal.item.EntityId || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Network */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Informasi Jaringan</p>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>IP Address</p>
                    <p className={`${styles.detailValue} ${styles.detailValueMono}`}>{modal.item.IPAddress || "-"}</p>
                  </div>
                  <div className={styles.detailItem}>
                    <p className={styles.detailLabel}>User Agent</p>
                    <p className={styles.detailValue} style={{ fontSize: 11, wordBreak: "break-all" }}>
                      {modal.item.UserAgent || "-"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Payload */}
              <div className={styles.detailSection}>
                <p className={styles.detailSectionTitle}>Payload Perubahan</p>

                <div className={styles.jsonSection}>
                  <div className={styles.jsonHeader}>
                    <span className={styles.jsonLabel}>
                      <span className={`${styles.jsonLabelDot} ${styles.jsonLabelDotOld}`} />
                      Old Values
                    </span>
                  </div>
                  {modal.item.OldValues ? (
                    <pre className={styles.jsonPre}>{formatJson(modal.item.OldValues)}</pre>
                  ) : (
                    <div className={styles.jsonEmpty}>Tidak ada data sebelumnya</div>
                  )}
                </div>

                <div className={styles.jsonSection}>
                  <div className={styles.jsonHeader}>
                    <span className={styles.jsonLabel}>
                      <span className={`${styles.jsonLabelDot} ${styles.jsonLabelDotNew}`} />
                      New Values
                    </span>
                  </div>
                  {modal.item.NewValues ? (
                    <pre className={styles.jsonPre}>{formatJson(modal.item.NewValues)}</pre>
                  ) : (
                    <div className={styles.jsonEmpty}>Tidak ada data baru</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
