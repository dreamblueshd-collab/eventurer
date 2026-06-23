"use client";

import { getCurrentUser } from "@/lib/auth";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import { fetchFunctionsMaster } from "@/lib/master-data";
import { getEventStatusLabel } from "@/lib/event-status";
import {
  exportSurveyReport,
  fetchReportSelectionList,
  fetchTakeoutComparison,
  generateSurveyReport,
  type ReportSelectionItem,
  type TakeoutComparisonRow,
} from "@/lib/reports";
import type { UserRole } from "@/types/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@/components/admin/pagination";
import baseStyles from "../page-mockup.module.css";
import styles from "./report.module.css";
import {
  formatDate,
  formatNumber,
  mapSelectionStatus,
  normalizeRole,
  toScore,
} from "./report-utils";

type TakeoutTableRow = {
  surveyId: string;
  surveyTitle: string;
  functionName: string;
  respondent: string;
  application: string;
  questionCode: string;
  questionText: string;
  scoreBefore: number | null;
  scoreAfter: number | null;
  isTakeout: boolean;
  reason: string;
};

type ModalState =
  | { type: "none" }
  | { type: "confirm-generate"; survey: ReportSelectionItem }
  | { type: "comment-detail"; row: TakeoutTableRow }
  | { type: "export"; survey: ReportSelectionItem; format: "excel" | "pdf" };

export default function ReportSelectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSurveyId = String(searchParams.get("surveyId") || "");

  const currentUser = getCurrentUser();
  const role: UserRole | null = currentUser?.role ?? null;
  const normalizedRole = normalizeRole(String(role || ""));
  const isSuperAdmin = normalizedRole === "superadmin";
  const isAdminEvent = normalizedRole === "adminevent";
  const isItLead = normalizedRole === "itlead";
  const isDepartmentHead = normalizedRole === "departmenthead";
  const canAccess = isSuperAdmin || isAdminEvent || isItLead || isDepartmentHead;
  const canGenerateAndExport = isAdminEvent;

  const [surveys, setSurveys] = useState<ReportSelectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [searchBy, setSearchBy] = useState<string>("all");
  const [surveySearch, setSurveySearch] = useState("");
  const [appliedSearchBy, setAppliedSearchBy] = useState<string>("all");
  const [appliedSurveySearch, setAppliedSurveySearch] = useState("");
  const [eventStatusFilter, setEventStatusFilter] = useState<string>("all");
  const [selectedTakeoutSurvey, setSelectedTakeoutSurvey] = useState<string>(preselectedSurveyId || "all");
  const [selectedFunctionId, setSelectedFunctionId] = useState<string>("all");
  const [functionOptions, setFunctionOptions] = useState<Array<{ value: string; label: string }>>([{ value: "all", label: "All Functions" }]);

  const [takeoutRows, setTakeoutRows] = useState<TakeoutTableRow[]>([]);
  const [takeoutLoading, setTakeoutLoading] = useState(false);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [exporting, setExporting] = useState(false);

  // Pagination state
  const [eventsPage, setEventsPage] = useState(1);
  const [takeoutPage, setTakeoutPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadSurveyList = async (): Promise<ReportSelectionItem[]> => {
    const listResult = await fetchReportSelectionList();
    if (!listResult.success) {
      setError(listResult.message || "Gagal memuat daftar event report");
      setSurveys([]);
      return [];
    }

    setError("");
    setSurveys(listResult.surveys);
    return listResult.surveys;
  };

  useEffect(() => {
    const run = async () => {
      try {
        const shouldLoadFunctionOptions = isSuperAdmin || isAdminEvent;
        const requests: [Promise<ReportSelectionItem[]>, Promise<Awaited<ReturnType<typeof fetchFunctionsMaster>> | null>] = [
          loadSurveyList(),
          shouldLoadFunctionOptions ? fetchFunctionsMaster() : Promise.resolve(null),
        ];
        const [, functionResult] = await Promise.all(requests);

        if (functionResult?.success) {
          const dynamic = functionResult.data
            .filter((item) => item.IsActive !== false)
            .map((item) => ({ value: String(item.FunctionId), label: item.Name }));
          setFunctionOptions([{ value: "all", label: "All Functions" }, ...dynamic]);
        } else {
          setFunctionOptions([{ value: "all", label: "All Functions" }]);
        }
      } catch {
        setError("Terjadi kesalahan saat memuat data report.");
        setSurveys([]);
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [isAdminEvent, isSuperAdmin]);

  const filteredSurveyRows = useMemo(() => {
    const term = appliedSurveySearch.trim().toLowerCase();
    return surveys.filter((item) => {
      if (eventStatusFilter !== "all") {
        const normalizedStatus = mapSelectionStatus(item);
        if (normalizedStatus !== eventStatusFilter) return false;
      }
      if (!term) return true;
      const name = String(item.title || "").toLowerCase();
      const period = String(item.period || "").toLowerCase();
      const respondent = String(item.respondentCount || "").toLowerCase();

      const eventTitle = String(item.eventTitle || "").toLowerCase();
      if (appliedSearchBy === "event") return eventTitle.includes(term);
      if (appliedSearchBy === "survey") return name.includes(term);
      if (appliedSearchBy === "period") return period.includes(term);
      if (appliedSearchBy === "respondent") return respondent.includes(term);
      return eventTitle.includes(term) || name.includes(term) || period.includes(term) || respondent.includes(term);
    });
  }, [appliedSearchBy, appliedSurveySearch, eventStatusFilter, surveys]);

  // Pagination for events table
  const eventsTotalPages = Math.max(1, Math.ceil(filteredSurveyRows.length / pageSize));
  const paginatedSurveyRows = useMemo(() => {
    const start = (eventsPage - 1) * pageSize;
    return filteredSurveyRows.slice(start, start + pageSize);
  }, [filteredSurveyRows, eventsPage, pageSize]);

  // Pagination for takeout table
  const takeoutTotalPages = Math.max(1, Math.ceil(takeoutRows.length / pageSize));
  const paginatedTakeoutRows = useMemo(() => {
    const start = (takeoutPage - 1) * pageSize;
    return takeoutRows.slice(start, start + pageSize);
  }, [takeoutRows, takeoutPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setEventsPage(1);
  }, [appliedSearchBy, appliedSurveySearch, eventStatusFilter]);

  useEffect(() => {
    setTakeoutPage(1);
  }, [selectedTakeoutSurvey, selectedFunctionId]);

  useEffect(() => {
    setEventsPage(1);
    setTakeoutPage(1);
  }, [pageSize]);

  // Adjust page if out of bounds
  useEffect(() => {
    if (eventsPage > eventsTotalPages) setEventsPage(eventsTotalPages);
  }, [eventsPage, eventsTotalPages]);

  useEffect(() => {
    if (takeoutPage > takeoutTotalPages) setTakeoutPage(takeoutTotalPages);
  }, [takeoutPage, takeoutTotalPages]);

  const lastUpdatedText = useMemo(() => {
    const generatedDates = surveys
      .map((item) => item.generatedAt)
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));

    if (generatedDates.length === 0) return "-";

    const latest = generatedDates.reduce((previous, current) =>
      current.getTime() > previous.getTime() ? current : previous
    );

    return formatDate(latest.toISOString());
  }, [surveys]);

  const selectedFunctionLabel = useMemo(
    () => functionOptions.find((item) => item.value === selectedFunctionId)?.label || "-",
    [functionOptions, selectedFunctionId],
  );
  const surveyFilterOptions = useMemo(
    () => [{ value: "all", label: "All Surveys" }, ...surveys.map((item) => ({ value: item.surveyId, label: item.eventTitle ? `${item.eventTitle} - ${item.title}` : item.title }))],
    [surveys]
  );
  const exportFormatOptions = useMemo(
    () => [
      { value: "excel", label: "Excel (.xlsx)" },
      { value: "pdf", label: "PDF (Print View)" },
    ],
    []
  );
  const eventStatusOptions = useMemo(
    () => [
      { value: "all", label: "All Status" },
      { value: "generated", label: "Generated" },
      { value: "active", label: "Active" },
      { value: "draft", label: "Draft" },
      { value: "closed", label: "Closed" },
      { value: "archived", label: "Archived" },
      { value: "other", label: "Other" },
    ],
    []
  );

  const onApplySearch = () => {
    setAppliedSearchBy(searchBy);
    setAppliedSurveySearch(surveySearch);
  };
  const searchByOptions = useMemo(
    () => [
      { value: "all", label: "Search By" },
      { value: "event", label: "Event Name" },
      { value: "survey", label: "Survey/Form Name" },
      { value: "period", label: "Periode" },
      { value: "respondent", label: "Responden" },
    ],
    []
  );

  const loadTakeoutRows = useCallback(async () => {
    setTakeoutLoading(true);
    setError("");
    setMessage("");
    setTakeoutRows([]);

    const surveyTargets = selectedTakeoutSurvey === "all"
      ? surveys
      : surveys.filter((item) => item.surveyId === selectedTakeoutSurvey);

    if (surveyTargets.length === 0) {
      setTakeoutRows([]);
      setTakeoutLoading(false);
      return;
    }

    const functionId = selectedFunctionId === "all" ? undefined : selectedFunctionId;
    const allRows: TakeoutTableRow[] = [];

    try {
      for (const survey of surveyTargets) {
        const result = await fetchTakeoutComparison({ surveyId: survey.surveyId, functionId });
        if (!result.success) {
          setError(result.message || "Gagal memuat comparison takeout");
          return;
        }

        result.comparison.forEach((item: TakeoutComparisonRow, index) => {
          allRows.push({
            surveyId: survey.surveyId,
            surveyTitle: survey.title,
            functionName: selectedFunctionId === "all" ? "-" : selectedFunctionLabel,
            respondent: "-",
            application: "-",
            questionCode: `Q${index + 1}`,
            questionText: item.questionText || "Question",
            scoreBefore: item.avgScoreBefore,
            scoreAfter: item.avgScoreAfter,
            isTakeout: Number(item.takeoutCount || 0) > 0,
            reason: String(item.takeoutReasons || "").trim(),
          });
        });
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data comparison takeout.");
      setTakeoutRows([]);
      return;
    } finally {
      setTakeoutLoading(false);
    }

    setTakeoutRows(allRows);
  }, [selectedFunctionId, selectedFunctionLabel, selectedTakeoutSurvey, surveys]);

  useEffect(() => {
    if (!loading) {
      void loadTakeoutRows();
    }
  }, [loadTakeoutRows, loading]);

  const takeoutStats = useMemo(() => {
    const total = takeoutRows.length;
    const removed = takeoutRows.filter((row) => row.isTakeout).length;
    const beforeValues = takeoutRows.map((row) => row.scoreBefore).filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    const afterValues = takeoutRows.map((row) => row.scoreAfter).filter((value): value is number => typeof value === "number" && !Number.isNaN(value));
    const avgBefore = beforeValues.length > 0 ? beforeValues.reduce((sum, value) => sum + value, 0) / beforeValues.length : null;
    const avgAfter = afterValues.length > 0 ? afterValues.reduce((sum, value) => sum + value, 0) / afterValues.length : null;
    return { total, removed, avgBefore, avgAfter };
  }, [takeoutRows]);

  const runGenerateReport = async (survey: ReportSelectionItem) => {
    setModal({ type: "none" });
    setError("");
    setMessage("");

    const result = await generateSurveyReport({ surveyId: survey.surveyId, includeTakenOut: false });
    if (!result.success) {
      setError(result.message || "Gagal generate report");
      return;
    }
    const refreshed = await loadSurveyList();
    let updated = refreshed.find((item) => item.surveyId === survey.surveyId);
    if (!updated?.hasGeneratedReport) {
      // Retry once after 1.5s — BE may need a moment to persist the flag
      await new Promise((resolve) => setTimeout(resolve, 1500));
      const retried = await loadSurveyList();
      updated = retried.find((item) => item.surveyId === survey.surveyId);
    }
    if (!updated?.hasGeneratedReport) {
      setError("Generate report belum tersimpan penuh di backend. Coba refresh atau regenerate sekali lagi setelah backend aktif terbaru.");
      return;
    }
    setMessage(`Report untuk "${survey.title}" berhasil di-generate.`);
  };

  const runExportReport = async (survey: ReportSelectionItem, format: "excel" | "pdf") => {
    if (format === "pdf") {
      const url = `/admin/report/${encodeURIComponent(survey.surveyId)}?print=pdf&autoprint=1`;
      window.open(url, "_blank", "noopener,noreferrer");
      setModal({ type: "none" });
      setMessage("Mode export PDF dibuka. Simpan hasil print sebagai PDF dari browser.");
      return;
    }

    setExporting(true);
    setError("");
    const result = await exportSurveyReport({
      surveyId: survey.surveyId,
      format,
      includeTakenOut: false,
    });
    setExporting(false);

    if (!result.success || !result.blob || !result.filename) {
      setError(result.message || "Gagal export report");
      return;
    }

    const url = URL.createObjectURL(result.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = result.filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setModal({ type: "none" });
    setMessage(`Export ${format.toUpperCase()} berhasil diproses.`);
  };

  const openReportView = (survey: ReportSelectionItem) => {
    router.push(`/admin/report/${encodeURIComponent(survey.surveyId)}`);
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Role Anda tidak memiliki akses ke halaman report.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Report</h1>
          <div className={baseStyles.subtitle}>{!canGenerateAndExport ? "Lihat laporan hasil survey untuk setiap event." : "Generate, lihat, dan export laporan survey."}</div>
        </div>
      </div>

      {/* ── Daftar Event Section ── */}
      <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconBlue}`}>📋</div>
          <div className={styles.sectionTitleWrap}>
            <div className={styles.sectionTitle}>Daftar Event</div>
            <div className={styles.sectionSubtitle}>Kelola dan generate report untuk setiap event survey</div>
          </div>
          <div className={styles.sectionHeaderRight}>
            <span className={styles.lastUpdated}>🕐 Update: {lastUpdatedText}</span>
          </div>
        </div>

        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="rpt-status-label" className={baseStyles.filterLabel} htmlFor="rpt-status-dropdown">Status</label>
            <Dropdown
              id="rpt-status-dropdown"
              className={baseStyles.filterControl}
              fullWidth
              options={eventStatusOptions}
              value={eventStatusFilter}
              onChange={setEventStatusFilter}
              aria-labelledby="rpt-status-label"
            />
          </div>
          <SearchBar
            options={searchByOptions}
            selectedValue={searchBy}
            keyword={surveySearch}
            onSelectedValueChange={setSearchBy}
            onKeywordChange={setSurveySearch}
            onButtonClick={onApplySearch}
            placeholder={
              searchBy === "event" ? "Cari nama event..." :
              searchBy === "survey" ? "Cari nama survey/form..." :
              searchBy === "period" ? "Cari periode..." :
              searchBy === "respondent" ? "Cari responden..." :
              "Cari event atau survey..."
            }
          />
        </div>

        <div className={styles.statusRegion} aria-live="polite">
          {loading ? <p className={baseStyles.meta}>Memuat event report...</p> : null}
          {error ? <p className={styles.errorText}>⚠️ {error}</p> : null}
          {message ? <p className={styles.successText}>✅ {message}</p> : null}
        </div>

        {/* ── Pagination (Top) ── */}
        {!loading && filteredSurveyRows.length > 0 && (
          <Pagination
            instanceId="top"
            currentPage={eventsPage}
            totalPages={eventsTotalPages}
            totalItems={filteredSurveyRows.length}
            itemsPerPage={pageSize}
            onPageChange={setEventsPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}

        <div className={baseStyles.tableWrap}>
          <table className={`${baseStyles.table} ${styles.reportTable}`}>
            <thead>
              <tr>
                <th scope="col" className={styles.colEvent}>Event</th>
                <th scope="col" className={styles.colSurvey}>Survey</th>
                <th scope="col" className={styles.colPeriod}>Periode</th>
                <th scope="col" className={styles.colStatus}>Status</th>
                <th scope="col" className={styles.colRespondent}>Responden</th>
                <th scope="col" className={styles.colAction}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredSurveyRows.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📊</div>
                      <p className={styles.emptyTitle}>Tidak ada event report</p>
                      <p className={styles.emptyDesc}>Data akan muncul setelah survey dibuat dan mendapat respons.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedSurveyRows.map((item) => {
                  const mappedStatus = mapSelectionStatus(item);
                  const hasResponses = Number(item.respondentCount || 0) > 0;
                  const isGenerated = mappedStatus === "generated";
                  const statusBadge = isGenerated
                    ? <span className={styles.badgeGenerated}>Generated</span>
                    : mappedStatus === "active"
                      ? <span className={styles.badgeActive}>{getEventStatusLabel(item.status)}</span>
                      : mappedStatus === "closed" || mappedStatus === "archived"
                        ? <span className={styles.badgeClosed}>{getEventStatusLabel(item.status)}</span>
                        : <span className={styles.badgeDraft}>{getEventStatusLabel(item.status)}</span>;

                  return (
                    <tr key={item.surveyId} className={styles.reportRow}>
                      <td className={styles.colEvent}>
                        <div className={styles.eventTitle}>{item.eventTitle || "-"}</div>
                      </td>
                      <td className={styles.colSurvey}>
                        <div className={styles.surveyTitle}>{item.title}</div>
                      </td>
                      <td className={styles.colPeriod}>{item.period || "-"}</td>
                      <td className={styles.colStatus}>{statusBadge}</td>
                      <td className={styles.colRespondent}>
                        <span className={styles.respondentCount}>{formatNumber(item.respondentCount)}</span>
                      </td>
                      <td className={styles.actionCell}>
                        <div className={styles.actions}>
                          {!canGenerateAndExport ? (
                            <button
                              type="button"
                              className={styles.buttonSecondaryXs}
                              disabled={!isGenerated}
                              onClick={() => openReportView(item)}
                            >
                              📊 View Report
                            </button>
                          ) : (
                            <>
                              {isGenerated ? (
                                <>
                                  <button
                                    type="button"
                                    className={styles.buttonPrimaryXs}
                                    disabled={!hasResponses}
                                    onClick={() => setModal({ type: "confirm-generate", survey: item })}
                                  >
                                    🔄 Regenerate
                                  </button>
                                  <button
                                    type="button"
                                    className={styles.buttonSecondaryXs}
                                    disabled={!hasResponses}
                                    onClick={() => openReportView(item)}
                                  >
                                    📊 View
                                  </button>
                                </>
                              ) : (
                                <button
                                  type="button"
                                  className={styles.buttonPrimaryXs}
                                  disabled={!hasResponses}
                                  onClick={() => setModal({ type: "confirm-generate", survey: item })}
                                >
                                  ⚙️ Generate
                                </button>
                              )}
                              <button
                                type="button"
                                className={styles.buttonGhostXs}
                                disabled={!isGenerated}
                                onClick={() => setModal({ type: "export", survey: item, format: "excel" })}
                              >
                                📤 Export
                              </button>
                            </>
                          )}
                        </div>
                        {!hasResponses ? <span className={styles.actionHint}>Belum ada response final approved</span> : null}
                        {hasResponses && !isGenerated ? <span className={styles.actionHint}>Generate report terlebih dahulu</span> : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination (Bottom) ── */}
        {!loading && filteredSurveyRows.length > 0 && (
          <Pagination
            instanceId="bottom"
            currentPage={eventsPage}
            totalPages={eventsTotalPages}
            totalItems={filteredSurveyRows.length}
            itemsPerPage={pageSize}
            onPageChange={setEventsPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      {/* ── Takeout Comparison Section ── */}
      {!isSuperAdmin && <div className={styles.sectionCard}>
        <div className={styles.sectionHeader}>
          <div className={`${styles.sectionIcon} ${styles.iconPurple}`}>🔄</div>
          <div className={styles.sectionTitleWrap}>
            <div className={styles.sectionTitle}>Propose Takeout Score Comparison</div>
            <div className={styles.sectionSubtitle}>Perbandingan skor sebelum &amp; sesudah takeout per question detail</div>
          </div>
        </div>

        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupLg}`}>
            <label id="rpt-survey-label" className={baseStyles.filterLabel} htmlFor="rpt-survey-dropdown">Survey</label>
            <Dropdown
              id="rpt-survey-dropdown"
              className={baseStyles.filterControl}
              fullWidth
              options={surveyFilterOptions}
              value={selectedTakeoutSurvey}
              onChange={setSelectedTakeoutSurvey}
              aria-labelledby="rpt-survey-label"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="rpt-function-label" className={baseStyles.filterLabel} htmlFor="rpt-function-dropdown">Function</label>
            <Dropdown
              id="rpt-function-dropdown"
              className={baseStyles.filterControl}
              fullWidth
              options={functionOptions}
              value={selectedFunctionId}
              onChange={setSelectedFunctionId}
              aria-labelledby="rpt-function-label"
            />
          </div>
        </div>

        <div className={styles.statsGrid}>
          <article className={`${styles.statCard} ${styles.statCardBlue}`}>
            <div className={styles.statIcon}>📊</div>
            <p className={styles.statTitle}>Total Rows</p>
            <p className={styles.statValue}>{formatNumber(takeoutStats.total)}</p>
          </article>
          <article className={`${styles.statCard} ${styles.statCardAmber}`}>
            <div className={styles.statIcon}>↗️</div>
            <p className={styles.statTitle}>Takeout Rows</p>
            <p className={styles.statValue}>{formatNumber(takeoutStats.removed)}</p>
          </article>
          <article className={`${styles.statCard} ${styles.statCardGreen}`}>
            <div className={styles.statIcon}>📈</div>
            <p className={styles.statTitle}>Average Before</p>
            <p className={styles.statValue}>{toScore(takeoutStats.avgBefore)}</p>
          </article>
          <article className={`${styles.statCard} ${styles.statCardPurple}`}>
            <div className={styles.statIcon}>📉</div>
            <p className={styles.statTitle}>Average After</p>
            <p className={styles.statValue}>{toScore(takeoutStats.avgAfter)}</p>
          </article>
        </div>

        <p className={styles.tableNote}>Menampilkan <span className={styles.recordCount}>{takeoutRows.length}</span> records</p>
        {takeoutLoading ? <p className={baseStyles.meta}>Memuat comparison takeout...</p> : null}

        {/* ── Pagination (Top) ── */}
        {!takeoutLoading && takeoutRows.length > 0 && (
          <Pagination
            instanceId="top"
            currentPage={takeoutPage}
            totalPages={takeoutTotalPages}
            totalItems={takeoutRows.length}
            itemsPerPage={pageSize}
            onPageChange={setTakeoutPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}

        <div className={baseStyles.tableWrap}>
          <table className={baseStyles.table}>
            <thead>
              <tr>
                <th scope="col">Survey</th>
                <th scope="col">Function</th>
                <th scope="col">Responden</th>
                <th scope="col">Aplikasi</th>
                <th scope="col">Question</th>
                <th scope="col" className={styles.scoreCenter}>Score Before</th>
                <th scope="col" className={styles.scoreCenter}>Takeout</th>
                <th scope="col" className={styles.scoreCenter}>Score After</th>
                <th scope="col">Alasan Takeout</th>
              </tr>
            </thead>
            <tbody>
              {takeoutRows.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>🔍</div>
                      <p className={styles.emptyTitle}>Belum ada data takeout comparison</p>
                      <p className={styles.emptyDesc}>Pilih survey dan function untuk melihat perbandingan.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedTakeoutRows.map((row, index) => (
                  <tr key={`${row.surveyId}-${row.questionCode}-${index}`}>
                    <td>{row.surveyTitle}</td>
                    <td>{row.functionName}</td>
                    <td>{row.respondent}</td>
                    <td>{row.application}</td>
                    <td>
                      <button
                        type="button"
                        className={styles.questionLink}
                        onClick={() => setModal({ type: "comment-detail", row })}
                      >
                        {row.questionCode}
                      </button>
                    </td>
                    <td className={styles.scoreCenter}>{toScore(row.scoreBefore)}</td>
                    <td className={styles.scoreCenter}>
                      {row.isTakeout ? (
                        <span className={styles.tagTakeout}>Takeout</span>
                      ) : (
                        <span className={styles.tagKeep}>Keep</span>
                      )}
                    </td>
                    <td className={styles.scoreCenter}>{toScore(row.scoreAfter)}</td>
                    <td className={!row.reason ? styles.mutedCell : undefined}>{row.reason || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination (Bottom) ── */}
        {!takeoutLoading && takeoutRows.length > 0 && (
          <Pagination
            instanceId="bottom"
            currentPage={takeoutPage}
            totalPages={takeoutTotalPages}
            totalItems={takeoutRows.length}
            itemsPerPage={pageSize}
            onPageChange={setTakeoutPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>}

      {/* ── Modals ── */}
      {modal.type !== "none" ? (
        <div className={styles.modalOverlay} onClick={() => setModal({ type: "none" })}>
          <div className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="report-modal-title" onClick={(event) => event.stopPropagation()}>
            {modal.type === "confirm-generate" ? (
              <>
                <header className={styles.modalHeader}>
                  <div className={styles.modalHeaderLeft}>
                    <div className={`${styles.modalIcon} ${styles.iconBlue}`}>⚙️</div>
                    <h3 id="report-modal-title" className={styles.modalTitle}>Generate Report</h3>
                  </div>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal generate report">✕</button>
                </header>
                <div className={styles.modalBody}>
                  <p className={styles.modalText}>Generate report untuk &quot;{modal.survey.title}&quot; sekarang?</p>
                </div>
                <footer className={styles.modalActions}>
                  <button type="button" className={styles.buttonSecondaryXs} onClick={() => setModal({ type: "none" })}>Cancel</button>
                  <button type="button" className={styles.buttonPrimaryXs} onClick={() => void runGenerateReport(modal.survey)}>Generate</button>
                </footer>
              </>
            ) : null}

            {modal.type === "comment-detail" ? (
              <>
                <header className={styles.modalHeader}>
                  <div className={styles.modalHeaderLeft}>
                    <div className={`${styles.modalIcon} ${styles.iconAmber}`}>💬</div>
                    <h3 id="report-modal-title" className={styles.modalTitle}>Comment Detail {modal.row.questionCode}</h3>
                  </div>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal detail komentar">✕</button>
                </header>
                <div className={styles.modalBody}>
                  <p className={styles.modalText}><strong>Pertanyaan:</strong> {modal.row.questionText}</p>
                  <p className={styles.modalText}><strong>Alasan Takeout:</strong> {modal.row.reason || "-"}</p>
                </div>
                <footer className={styles.modalActions}>
                  <button type="button" className={styles.buttonSecondaryXs} onClick={() => setModal({ type: "none" })}>Close</button>
                </footer>
              </>
            ) : null}

            {modal.type === "export" ? (
              <>
                <header className={styles.modalHeader}>
                  <div className={styles.modalHeaderLeft}>
                    <div className={`${styles.modalIcon} ${styles.iconGreen}`}>📤</div>
                    <h3 id="report-modal-title" className={styles.modalTitle}>Export Report</h3>
                  </div>
                  <button type="button" className={styles.modalClose} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal export report">✕</button>
                </header>
                <div className={styles.modalBody}>
                  <p className={styles.modalText}>Survey: {modal.survey.title}</p>
                  <label className={styles.fieldLabel} htmlFor="exportFormat">Export Format</label>
                  <Dropdown
                    id="exportFormat"
                    className={styles.fieldControl}
                    fullWidth
                    options={exportFormatOptions}
                    value={modal.format}
                    onChange={(value) => setModal({ ...modal, format: value as "excel" | "pdf" })}
                  />
                  <p className={styles.modalHint}>
                    💡 {modal.format === "pdf"
                      ? "PDF dibuka dari tampilan report yang sama, lalu disimpan melalui browser print."
                      : "Excel berisi sheet ringkasan report dan detail data respon."}
                  </p>
                </div>
                <footer className={styles.modalActions}>
                  <button type="button" className={styles.buttonSecondaryXs} onClick={() => setModal({ type: "none" })}>Cancel</button>
                  <button
                    type="button"
                    className={styles.buttonPrimaryXs}
                    onClick={() => void runExportReport(modal.survey, modal.format)}
                    disabled={exporting}
                  >
                    {exporting ? "Exporting..." : "Export"}
                  </button>
                </footer>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
