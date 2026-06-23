"use client";

import { getCurrentUser } from "@/lib/auth";
import { formatEventPeriodParts, resolveEventStatus } from "@/lib/event-status";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import type { SurveyOverviewItem } from "@/types/survey";
import { useEffect, useMemo, useState } from "react";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import DatePicker from "@/components/common/date-picker";
import { Pagination } from "@/components/admin/pagination";
import {
  clampEndDate,
  isDateRangeExceeded,
  matchesInclusiveDateRange,
  parseLocalDate,
} from "@/lib/date-range";
import baseStyles from "../page-mockup.module.css";
import styles from "./dashboard.module.css";

const MAX_RANGE_DAYS = 365;

function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return String(value);
}

export default function DashboardPage() {
  const [surveys, setSurveys] = useState<SurveyOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentUser] = useState(() => getCurrentUser());
  const [currentRole] = useState<UserRole | null>(() => getCurrentUser()?.role ?? null);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [searchBy, setSearchBy] = useState("all");
  const [keyword, setKeyword] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState("all");
  const [appliedKeyword, setAppliedKeyword] = useState("");

  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const rangeExceeded = isDateRangeExceeded(periodStart, periodEnd, MAX_RANGE_DAYS);
  const maxEndDate = clampEndDate(periodStart, MAX_RANGE_DAYS);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);

      try {
        const result = await fetchSurveyOverview();
        if (!active) return;

        if (!result.success) {
          setError(result.message || "Gagal memuat data survey");
          setSurveys([]);
          return;
        }

        setError("");
        const nonDraftSurveys = result.surveys.filter((survey) => resolveEventStatus(survey) !== "Draft");

        if (currentRole === "AdminEvent" && currentUser?.userId) {
          const userId = Number(currentUser.userId);
          const assignedOnly = nonDraftSurveys.filter((survey) => {
            const assignedIds = Array.isArray(survey.AssignedAdminIds) ? survey.AssignedAdminIds : [];
            return assignedIds.includes(userId);
          });
          setSurveys(assignedOnly);
          return;
        }

        setSurveys(nonDraftSurveys);
      } catch {
        if (!active) return;
        setError("Terjadi kesalahan saat memuat data survey");
        setSurveys([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [currentRole, currentUser]);

  const filteredAndSortedSurveys = useMemo(() => {
    if (rangeExceeded) return [];
    const normalizedKeyword = appliedKeyword.trim().toLowerCase();

    const filtered = surveys.filter((survey) => {
      const effectiveStatus = resolveEventStatus(survey);

      if (!matchesInclusiveDateRange(survey.StartDate, survey.EndDate, periodStart, periodEnd)) return false;

      if (statusFilter !== "all" && effectiveStatus.toLowerCase() !== statusFilter) return false;

      if (!normalizedKeyword) return true;

      if (appliedSearchBy === "event") {
        return (survey.EventTitle || "").toLowerCase().includes(normalizedKeyword);
      }

      if (appliedSearchBy === "survey") {
        return survey.Title.toLowerCase().includes(normalizedKeyword);
      }

      return (survey.EventTitle || "").toLowerCase().includes(normalizedKeyword)
        || survey.Title.toLowerCase().includes(normalizedKeyword);
    });

    if (!sortColumn) return filtered;

    return [...filtered].sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortColumn) {
        case "event":
          aVal = (a.EventTitle || "").toLowerCase();
          bVal = (b.EventTitle || "").toLowerCase();
          break;
        case "survey":
          aVal = a.Title.toLowerCase();
          bVal = b.Title.toLowerCase();
          break;
        case "period":
          aVal = parseLocalDate(a.StartDate, "start")?.getTime() ?? 0;
          bVal = parseLocalDate(b.StartDate, "start")?.getTime() ?? 0;
          break;
        case "status":
          aVal = resolveEventStatus(a).toLowerCase();
          bVal = resolveEventStatus(b).toLowerCase();
          break;
        case "respondent":
          aVal = a.RespondentCount ?? 0;
          bVal = b.RespondentCount ?? 0;
          break;
        case "target":
          aVal = a.TargetRespondents ?? 0;
          bVal = b.TargetRespondents ?? 0;
          break;
        case "score":
          aVal = a.CurrentScore ?? 0;
          bVal = b.CurrentScore ?? 0;
          break;
        case "targetScore":
          aVal = a.TargetScore ?? 0;
          bVal = b.TargetScore ?? 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });
  }, [surveys, periodStart, periodEnd, statusFilter, appliedKeyword, appliedSearchBy, rangeExceeded, sortColumn, sortDirection]);

  const paginatedSurveys = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredAndSortedSurveys.slice(startIndex, endIndex);
  }, [filteredAndSortedSurveys, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredAndSortedSurveys.length / pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [periodStart, periodEnd, statusFilter, appliedSearchBy, appliedKeyword, pageSize, sortColumn, sortDirection, rangeExceeded]);

  useEffect(() => {
    const nextTotalPages = Math.max(totalPages, 1);
    if (currentPage > nextTotalPages) {
      setCurrentPage(nextTotalPages);
    }
  }, [currentPage, totalPages]);

  const lastUpdatedText = useMemo(() => {
    if (filteredAndSortedSurveys.length === 0) return "-";
    const latest = filteredAndSortedSurveys.reduce((prev, current) => {
      const prevDate = new Date(prev.UpdatedAt || prev.CreatedAt || 0).getTime();
      const currentDate = new Date(current.UpdatedAt || current.CreatedAt || 0).getTime();
      return currentDate > prevDate ? current : prev;
    });
    const latestDate = new Date(latest.UpdatedAt || latest.CreatedAt || "1970-01-01T00:00:00.000Z");
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(latestDate);
  }, [filteredAndSortedSurveys]);

  const showReportAction = currentRole === "AdminEvent"
    || currentRole === "ITLead"
    || currentRole === "DepartmentHead";

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedKeyword(keyword);
  };

  const handlePeriodStartChange = (value: string) => {
    setPeriodStart(value);
    if (value && periodEnd && isDateRangeExceeded(value, periodEnd, MAX_RANGE_DAYS)) {
      setPeriodEnd(clampEndDate(value, MAX_RANGE_DAYS));
    }
  };

  const handlePeriodEndChange = (value: string) => {
    if (periodStart && value && isDateRangeExceeded(periodStart, value, MAX_RANGE_DAYS)) {
      setPeriodEnd(clampEndDate(periodStart, MAX_RANGE_DAYS));
    } else {
      setPeriodEnd(value);
    }
  };

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

  return (
    <>
      {/* ── Page Header ── */}
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Dashboard</h1>
          <p className={baseStyles.subtitle}>Ringkasan performa dan status survey event CSI.</p>
        </div>
      </div>

      {/* ── Filter ── */}
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <span className={styles.filterIcon}>🔍</span>
          <span className={styles.filterTitle}>Filter &amp; Pencarian</span>
        </div>
        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupSm}`}>
            <label className={baseStyles.filterLabel} htmlFor="dashPeriodStart">Periode Mulai</label>
            <DatePicker id="dashPeriodStart" value={periodStart} onChange={handlePeriodStartChange} placeholder="Tanggal mulai" />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupSm}`}>
            <label className={baseStyles.filterLabel} htmlFor="dashPeriodEnd">Periode Akhir</label>
            <DatePicker id="dashPeriodEnd" value={periodEnd} onChange={handlePeriodEndChange} max={maxEndDate || undefined} placeholder="Tanggal akhir" />
            {rangeExceeded && (
              <div className={styles.periodWarning}>⚠️ Maksimum rentang 1 tahun</div>
            )}
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="dash-status-label" className={baseStyles.filterLabel} htmlFor="dash-status-dropdown">Status</label>
            <Dropdown id="dash-status-dropdown" className={baseStyles.filterControl} fullWidth options={[{ value: "all", label: "Semua Status" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }]} value={statusFilter} onChange={setStatusFilter} aria-labelledby="dash-status-label" />
          </div>
          <SearchBar options={[{ value: "all", label: "Search By" }, { value: "event", label: "Event Name" }, { value: "survey", label: "Survey/Form Name" }]} selectedValue={searchBy} keyword={keyword} onSelectedValueChange={setSearchBy} onKeywordChange={setKeyword} onButtonClick={onApplySearch} placeholder={searchBy === "event" ? "Cari nama event..." : searchBy === "survey" ? "Cari nama survey/form..." : "Cari event atau survey..."} />
        </div>
      </div>

      {/* ── Event Overview Table ── */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>📋</div>
          <div className={styles.sectionTitleWrap}>
            <div className={styles.sectionTitle}>Event Overview</div>
            <div className={styles.sectionSubtitle}>Detail performa dan status setiap survey event</div>
          </div>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.lastUpdated}>🕐 Update: {lastUpdatedText}</span>
          </div>
        </div>

        {error ? <div className={styles.errorText}>⚠️ {error}</div> : null}

        {loading ? (
          <div className={baseStyles.loadingWrap}>
            <div className={baseStyles.spinner} />
            <span className={baseStyles.loadingText}>Memuat data event...</span>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            {/* ── Pagination (Top) ── */}
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

            <div className={baseStyles.tableWrap}>
            <table className={baseStyles.table}>
              <thead>
                <tr>
                  <th scope="col" className={styles.sortableHeader} onClick={() => handleSort("event")}>Event {renderSortIcon("event")}</th>
                  <th scope="col" className={styles.sortableHeader} onClick={() => handleSort("survey")}>Survey {renderSortIcon("survey")}</th>
                  <th scope="col" className={`${baseStyles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("period")}>Periode {renderSortIcon("period")}</th>
                  <th scope="col" className={`${baseStyles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("status")}>Status {renderSortIcon("status")}</th>
                  <th scope="col" className={`${baseStyles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("respondent")}>Responden {renderSortIcon("respondent")}</th>
                  <th scope="col" className={`${baseStyles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("target")}>Target Responden {renderSortIcon("target")}</th>
                  <th scope="col" className={`${baseStyles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("score")}>Score {renderSortIcon("score")}</th>
                  <th scope="col" className={`${baseStyles.colCenter} ${styles.sortableHeader}`} onClick={() => handleSort("targetScore")}>Target Score {renderSortIcon("targetScore")}</th>
                  {showReportAction ? <th scope="col" className={baseStyles.colCenter}>Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {paginatedSurveys.length === 0 && filteredAndSortedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={showReportAction ? 9 : 8}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📊</div>
                        <p className={styles.emptyTitle}>Tidak ada data survey</p>
                        <p className={styles.emptyDesc}>{rangeExceeded ? "Rentang periode melebihi 1 tahun. Kurangi rentang filter." : "Coba ubah filter untuk melihat data."}</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedSurveys.length === 0 ? (
                  <tr>
                    <td colSpan={showReportAction ? 9 : 8}>
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>📊</div>
                        <p className={styles.emptyTitle}>Tidak ada data pada halaman ini</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginatedSurveys.map((survey) => {
                    const effectiveStatus = resolveEventStatus(survey);

                    return (
                      <tr key={survey.SurveyId}>
                        <td><span className={styles.eventTitle}>{survey.EventTitle || "-"}</span></td>
                        <td><span className={styles.eventTitle}>{survey.Title}</span></td>
                        <td className={baseStyles.colCenter}>
                          {(() => {
                            const parts = formatEventPeriodParts(survey.StartDate, survey.EndDate);
                            if (!parts) return "-";
                            return (
                              <div className={styles.periodStack}>
                                <span className={styles.periodDate}>{parts.start}</span>
                                <span className={styles.periodSep}>→</span>
                                <span className={styles.periodDate}>{parts.end}</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className={baseStyles.colCenter}>
                          <span className={effectiveStatus === "Active" ? styles.badgeActive : styles.badgeClosed}>
                            {effectiveStatus}
                          </span>
                        </td>
                        <td className={baseStyles.colCenter}><span className={styles.respondentCount}>{formatNumber(survey.RespondentCount)}</span></td>
                        <td className={baseStyles.colCenter}><span className={styles.respondentCount}>{formatNumber(survey.TargetRespondents)}</span></td>
                        <td className={baseStyles.colCenter}><span className={styles.scoreCell}>{formatScore(survey.CurrentScore)}</span></td>
                        <td className={baseStyles.colCenter}><span className={styles.scoreCell}>{formatScore(survey.TargetScore)}</span></td>
                        {showReportAction ? (
                          <td className={baseStyles.colCenter}>
                            {survey.HasGeneratedReport ? (
                              <a className={styles.viewReportBtn} href={`/admin/report/${survey.SurveyId}`}>View Report</a>
                            ) : (
                              <span className={styles.metaDash}>—</span>
                            )}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

            {/* ── Pagination (Bottom) ── */}
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
          </>
        ) : null}
      </div>
    </>
  );
}

