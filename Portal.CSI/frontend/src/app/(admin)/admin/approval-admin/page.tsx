"use client";

import { getCurrentUser } from "@/lib/auth";
import {
  approveTakeout,
  approveInitialResponses,
  fetchApprovalRespondents,
  fetchProposedTakeouts,
  rejectTakeout,
  rejectInitialResponses,
  type ApprovalRespondent,
  type ApprovalTakeout,
} from "@/lib/approvals";
import { Dropdown } from "@/components/common/dropdown";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";
import ApprovalAdminDialogs from "./approval-admin-dialogs";
import { formatDateTime, getRespondentAriaLabel, getTakeoutAriaLabel, mapApprovalStatus, toSafeFileStem } from "./approval-admin-utils";

type Tab = "respondents" | "takeout";
type ModalState = { type: "none" } | { type: "detail"; row: ApprovalRespondent };

export default function ApprovalAdminPage() {
  const role: UserRole | null = getCurrentUser()?.role ?? null;
  const canAccess = role === "AdminEvent";

  const [tab, setTab] = useState<Tab>("respondents");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [eventFilterId, setEventFilterId] = useState<string>("all");
  const [surveyFilterId, setSurveyFilterId] = useState<string>("all");
  const [duplicateFilter, setDuplicateFilter] = useState<"all" | "duplicate" | "unique">("all");

  const [surveys, setSurveys] = useState<Array<{ id: number; title: string; eventId: number | null; eventTitle: string | null }>>([]);
  const [respondents, setRespondents] = useState<ApprovalRespondent[]>([]);
  const [takeouts, setTakeouts] = useState<ApprovalTakeout[]>([]);
  const [selectedRespondentIds, setSelectedRespondentIds] = useState<number[]>([]);
  const [selectedTakeoutKeys, setSelectedTakeoutKeys] = useState<number[]>([]);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [takeoutRejectOpen, setTakeoutRejectOpen] = useState(false);
  const [takeoutRejectReason, setTakeoutRejectReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [respondentsPage, setRespondentsPage] = useState(1);
  const [takeoutsPage, setTakeoutsPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumnRespondents, setSortColumnRespondents] = useState<string>("");
  const [sortDirectionRespondents, setSortDirectionRespondents] = useState<"asc" | "desc">("asc");
  const [sortColumnTakeouts, setSortColumnTakeouts] = useState<string>("");
  const [sortDirectionTakeouts, setSortDirectionTakeouts] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const surveyRes = await fetchSurveyOverview();
        if (!active) return;

        if (!surveyRes.success) {
          setError(surveyRes.message || "Gagal memuat survey");
          setSurveys([]);
          setEventFilterId("all");
          setSurveyFilterId("all");
          return;
        }

        const surveyOptions = surveyRes.surveys.map((item) => ({ 
          id: item.SurveyId, 
          title: item.Title,
          eventId: item.EventId ?? null,
          eventTitle: item.EventTitle || null
        }));
        setSurveys(surveyOptions);
        setEventFilterId("all");
        setSurveyFilterId("all");
      } catch {
        if (!active) return;
        setError("Gagal memuat data awal halaman approval.");
        setSurveys([]);
        setEventFilterId("all");
        setSurveyFilterId("all");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    void run();

    return () => {
      active = false;
    };
  }, []);

  const eventDropdownOptions = useMemo(() => {
    const map = new Map<string, string>();
    surveys.forEach((item) => {
      const key = item.eventId !== null ? `id:${item.eventId}` : `title:${item.eventTitle || "Tanpa Event"}`;
      if (!map.has(key)) {
        map.set(key, item.eventTitle || "Tanpa Event");
      }
    });

    return [
      { value: "all", label: "Semua Event" },
      ...Array.from(map.entries()).map(([value, label]) => ({ value, label })),
    ];
  }, [surveys]);

  const filteredSurveysByEvent = useMemo(() => {
    if (eventFilterId === "all") return surveys;
    if (eventFilterId.startsWith("id:")) {
      const eventId = Number(eventFilterId.slice(3));
      return surveys.filter((item) => Number(item.eventId) === eventId);
    }
    const eventTitle = eventFilterId.slice(6);
    return surveys.filter((item) => (item.eventTitle || "Tanpa Event") === eventTitle);
  }, [eventFilterId, surveys]);

  const surveyDropdownOptions = useMemo(
    () => [
      { value: "all", label: "Semua Survey" },
      ...filteredSurveysByEvent.map((item) => ({
        value: String(item.id),
        label: item.eventTitle ? `${item.eventTitle} - ${item.title}` : item.title,
      })),
    ],
    [filteredSurveysByEvent]
  );

  const visibleSurveys = useMemo(() => {
    if (surveyFilterId !== "all") {
      const selected = filteredSurveysByEvent.find((item) => String(item.id) === surveyFilterId);
      return selected ? [selected] : [];
    }
    return filteredSurveysByEvent;
  }, [filteredSurveysByEvent, surveyFilterId]);

  useEffect(() => {
    if (surveyFilterId !== "all" && !filteredSurveysByEvent.some((item) => String(item.id) === surveyFilterId)) {
      setSurveyFilterId("all");
    }
  }, [filteredSurveysByEvent, surveyFilterId]);

  useEffect(() => {
    if (visibleSurveys.length === 0) {
      setRespondents([]);
      setTakeouts([]);
      return;
    }
    const run = async () => {
      setError("");
      setMessage("");
      try {
        const [respondentResList, takeoutResList] = await Promise.all([
          Promise.all(visibleSurveys.map((item) => fetchApprovalRespondents({ surveyId: item.id, duplicateFilter }))),
          Promise.all(visibleSurveys.map((item) => fetchProposedTakeouts({ surveyId: item.id }))),
        ]);

        const respondentError = respondentResList.find((item) => !item.success);
        const takeoutError = takeoutResList.find((item) => !item.success);

        setRespondents(respondentResList.flatMap((item) => (item.success ? item.data : [])));
        setTakeouts(takeoutResList.flatMap((item) => (item.success ? item.data : [])));

        if (respondentError) {
          setError(respondentError.message);
        }
        if (takeoutError) {
          setError((prev) => prev || takeoutError.message);
        }
      } catch {
        setError("Terjadi kesalahan saat memuat data approval.");
        setRespondents([]);
        setTakeouts([]);
      }
    };
    void run();
  }, [visibleSurveys, duplicateFilter]);

  const duplicateCount = useMemo(() => respondents.filter((item) => item.IsDuplicate).length, [respondents]);

  const handleSortRespondents = (column: string) => {
    if (sortColumnRespondents === column) {
      setSortDirectionRespondents(sortDirectionRespondents === "asc" ? "desc" : "asc");
    } else {
      setSortColumnRespondents(column);
      setSortDirectionRespondents("asc");
    }
  };

  const renderSortIconRespondents = (column: string) => {
    if (sortColumnRespondents !== column) return " ⇅";
    return sortDirectionRespondents === "asc" ? " ▲" : " ▼";
  };

  const handleSortTakeouts = (column: string) => {
    if (sortColumnTakeouts === column) {
      setSortDirectionTakeouts(sortDirectionTakeouts === "asc" ? "desc" : "asc");
    } else {
      setSortColumnTakeouts(column);
      setSortDirectionTakeouts("asc");
    }
  };

  const renderSortIconTakeouts = (column: string) => {
    if (sortColumnTakeouts !== column) return " ⇅";
    return sortDirectionTakeouts === "asc" ? " ▲" : " ▼";
  };

  const sortedRespondents = useMemo(() => {
    if (!sortColumnRespondents) return respondents;

    return [...respondents].sort((a, b) => {
      let aVal: string | number | boolean;
      let bVal: string | number | boolean;

      switch (sortColumnRespondents) {
        case "respondent":
          aVal = (a.RespondentName || "").toLowerCase();
          bVal = (b.RespondentName || "").toLowerCase();
          break;
        case "department":
          aVal = (a.DepartmentName || "").toLowerCase();
          bVal = (b.DepartmentName || "").toLowerCase();
          break;
        case "application":
          aVal = (a.ApplicationName || "").toLowerCase();
          bVal = (b.ApplicationName || "").toLowerCase();
          break;
        case "email":
          aVal = (a.RespondentEmail || "").toLowerCase();
          bVal = (b.RespondentEmail || "").toLowerCase();
          break;
        case "submittime":
          aVal = a.SubmittedAt || "";
          bVal = b.SubmittedAt || "";
          break;
        case "status":
          aVal = (a.ResponseApprovalStatus || "").toLowerCase();
          bVal = (b.ResponseApprovalStatus || "").toLowerCase();
          break;
        case "duplicate":
          aVal = a.IsDuplicate ? 1 : 0;
          bVal = b.IsDuplicate ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirectionRespondents === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirectionRespondents === "asc" ? 1 : -1;
      return 0;
    });
  }, [respondents, sortColumnRespondents, sortDirectionRespondents]);

  const sortedTakeouts = useMemo(() => {
    if (!sortColumnTakeouts) return takeouts;

    return [...takeouts].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortColumnTakeouts) {
        case "event":
          aVal = (a.EventTitle || "").toLowerCase();
          bVal = (b.EventTitle || "").toLowerCase();
          break;
        case "survey":
          aVal = (a.SurveyTitle || "").toLowerCase();
          bVal = (b.SurveyTitle || "").toLowerCase();
          break;
        case "respondent":
          aVal = (a.RespondentName || "").toLowerCase();
          bVal = (b.RespondentName || "").toLowerCase();
          break;
        case "department":
          aVal = (a.DepartmentName || "").toLowerCase();
          bVal = (b.DepartmentName || "").toLowerCase();
          break;
        case "application":
          aVal = (a.ApplicationName || "").toLowerCase();
          bVal = (b.ApplicationName || "").toLowerCase();
          break;
        case "score":
          aVal = typeof a.NumericValue === "number" ? a.NumericValue : -999;
          bVal = typeof b.NumericValue === "number" ? b.NumericValue : -999;
          break;
        case "status":
          aVal = (a.TakeoutStatus || "").toLowerCase();
          bVal = (b.TakeoutStatus || "").toLowerCase();
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirectionTakeouts === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirectionTakeouts === "asc" ? 1 : -1;
      return 0;
    });
  }, [takeouts, sortColumnTakeouts, sortDirectionTakeouts]);

  const respondentsTotalPages = Math.max(1, Math.ceil(sortedRespondents.length / pageSize));
  const paginatedRespondents = useMemo(() => {
    const start = (respondentsPage - 1) * pageSize;
    return sortedRespondents.slice(start, start + pageSize);
  }, [sortedRespondents, respondentsPage, pageSize]);

  const takeoutsTotalPages = Math.max(1, Math.ceil(sortedTakeouts.length / pageSize));
  const paginatedTakeouts = useMemo(() => {
    const start = (takeoutsPage - 1) * pageSize;
    return sortedTakeouts.slice(start, start + pageSize);
  }, [sortedTakeouts, takeoutsPage, pageSize]);

  useEffect(() => {
    setRespondentsPage(1);
    setTakeoutsPage(1);
    setSelectedRespondentIds([]);
    setSelectedTakeoutKeys([]);
  }, [eventFilterId, surveyFilterId, duplicateFilter]);

  useEffect(() => {
    setRespondentsPage(1);
    setTakeoutsPage(1);
  }, [pageSize]);

  useEffect(() => {
    setRespondentsPage(1);
  }, [sortColumnRespondents, sortDirectionRespondents]);

  useEffect(() => {
    setTakeoutsPage(1);
  }, [sortColumnTakeouts, sortDirectionTakeouts]);

  useEffect(() => {
    if (respondentsPage > respondentsTotalPages) setRespondentsPage(respondentsTotalPages);
  }, [respondentsPage, respondentsTotalPages]);

  useEffect(() => {
    if (takeoutsPage > takeoutsTotalPages) setTakeoutsPage(takeoutsTotalPages);
  }, [takeoutsPage, takeoutsTotalPages]);

  const selectedTakeoutRows = useMemo(
    () => takeouts.filter((row) => selectedTakeoutKeys.includes(row.QuestionResponseId)),
    [selectedTakeoutKeys, takeouts]
  );
  const duplicateDropdownOptions = useMemo(
    () => [
      { value: "all", label: "Semua" },
      { value: "duplicate", label: "Duplikat" },
      { value: "unique", label: "Unik" },
    ],
    []
  );

  const handleExportRespondents = () => {
    if (respondents.length === 0) {
      setError("Belum ada data responden untuk diexport.");
      return;
    }

    const headers = ["Respondent", "Department", "Application", "Email", "Submit Time", "Duplicate Status"];
    const dataRows = respondents.map((row) => [
      row.RespondentName || "",
      row.DepartmentName || "",
      row.ApplicationName || "",
      row.RespondentEmail || "",
      formatDateTime(row.SubmittedAt),
      row.IsDuplicate ? "Duplicate" : "Unique",
    ]);

    const escapeXml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    const headerCells = headers.map((h) => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(h)}</Data></Cell>`).join("");
    const bodyRows = dataRows.map((r) => `<Row>${r.map((c) => `<Cell><Data ss:Type="String">${escapeXml(c)}</Data></Cell>`).join("")}</Row>`).join("\n");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
<Styles><Style ss:ID="header"><Font ss:Bold="1"/></Style></Styles>
<Worksheet ss:Name="Respondents"><Table>
<Row>${headerCells}</Row>
${bodyRows}
</Table></Worksheet></Workbook>`;

    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const activeSurvey = visibleSurveys.length === 1 ? visibleSurveys[0] : null;
    link.download = `approval-admin-respondents-${toSafeFileStem(activeSurvey?.title, "all-surveys")}.xls`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const reloadRespondents = async () => {
    setError("");
    const respondentResList = await Promise.all(visibleSurveys.map((item) => fetchApprovalRespondents({ surveyId: item.id, duplicateFilter })));
    const respondentError = respondentResList.find((item) => !item.success);
    setRespondents(respondentResList.flatMap((item) => (item.success ? item.data : [])));
    if (respondentError) {
      setError(respondentError.message);
    }
  };

  const reloadTakeouts = async () => {
    setError("");
    const takeoutResList = await Promise.all(visibleSurveys.map((item) => fetchProposedTakeouts({ surveyId: item.id })));
    const takeoutError = takeoutResList.find((item) => !item.success);
    setTakeouts(takeoutResList.flatMap((item) => (item.success ? item.data : [])));
    if (takeoutError) {
      setError(takeoutError.message);
    }
  };

  const handleApproveSelected = async () => {
    if (selectedRespondentIds.length === 0) {
      setError("Pilih minimal satu response untuk di-approve.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await approveInitialResponses({ responseIds: selectedRespondentIds });
      if (!result.success) {
        setError(result.message);
        return;
      }

      setSelectedRespondentIds([]);
      setMessage("Response terpilih berhasil dikirim ke IT Lead.");
      await reloadRespondents();
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectSelected = async () => {
    if (selectedRespondentIds.length === 0) {
      setError("Pilih minimal satu response untuk di-reject.");
      return;
    }
    if (!rejectReason.trim()) {
      setError("Alasan reject wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await rejectInitialResponses({ responseIds: selectedRespondentIds, reason: rejectReason.trim() });
      if (!result.success) {
        setError(result.message);
        return;
      }

      setRejectOpen(false);
      setRejectReason("");
      setSelectedRespondentIds([]);
      setMessage("Response terpilih berhasil di-reject untuk histori.");
      await reloadRespondents();
    } finally {
      setSubmitting(false);
    }
  };

  const handleApproveTakeouts = async () => {
    if (selectedTakeoutRows.length === 0) {
      setError("Pilih minimal satu usulan takeout untuk di-approve.");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.all(
        selectedTakeoutRows.map((row) =>
          approveTakeout({
            responseId: row.ResponseId,
            questionId: row.QuestionId,
          })
        )
      );
      const failed = results.find((item) => !item.success);
      if (failed && !failed.success) {
        setError(failed.message);
        return;
      }

      setSelectedTakeoutKeys([]);
      setMessage("Usulan takeout terpilih berhasil di-approve.");
      await Promise.all([reloadRespondents(), reloadTakeouts()]);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRejectTakeouts = async () => {
    if (selectedTakeoutRows.length === 0) {
      setError("Pilih minimal satu usulan takeout untuk di-reject.");
      return;
    }
    if (!takeoutRejectReason.trim()) {
      setError("Alasan reject takeout wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const results = await Promise.all(
        selectedTakeoutRows.map((row) =>
          rejectTakeout({
            responseId: row.ResponseId,
            questionId: row.QuestionId,
            reason: takeoutRejectReason.trim(),
          })
        )
      );
      const failed = results.find((item) => !item.success);
      if (failed && !failed.success) {
        setError(failed.message);
        return;
      }

      setTakeoutRejectOpen(false);
      setTakeoutRejectReason("");
      setSelectedTakeoutKeys([]);
      setMessage("Usulan takeout terpilih berhasil di-reject.");
      await Promise.all([reloadRespondents(), reloadTakeouts()]);
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel} aria-busy={loading}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Halaman Approval Admin hanya untuk Admin Event.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Approval Admin</h1>
          <div className={baseStyles.subtitle}>Final review untuk data responden dan usulan takeout.</div>
        </div>
      </div>

      <p className={styles.notice}>📝 Review responden duplicate dan monitor usulan takeout sebelum tahap Approval IT Lead.</p>

      <section className={`${baseStyles.sectionCard} ${baseStyles.filterCard}`}>
        <div className={baseStyles.sectionHeader}>
          <div className={`${baseStyles.sectionIcon} ${baseStyles.iconBlue}`}>🔍</div>
          <div>
            <div className={baseStyles.sectionTitle}>Filter Data</div>
            <div className={baseStyles.sectionSubtitle}>Pilih event, survey, dan status duplikat untuk memfilter data</div>
          </div>
        </div>
        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label className={baseStyles.filterLabel}>Event</label>
            <Dropdown
              className={baseStyles.filterControl}
              fullWidth
              options={eventDropdownOptions}
              value={eventFilterId}
              onChange={(value) => {
                setEventFilterId(String(value || "all"));
                setSurveyFilterId("all");
              }}
              aria-label="Filter event"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupLg}`}>
            <label className={baseStyles.filterLabel}>Survey</label>
            <Dropdown
              className={baseStyles.filterControl}
              fullWidth
              options={surveyDropdownOptions}
              value={surveyFilterId}
              onChange={(value) => setSurveyFilterId(String(value || "all"))}
              placeholder="Pilih survey"
              aria-label="Pilih survey"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label className={baseStyles.filterLabel}>Status Duplikat</label>
            <Dropdown
              className={baseStyles.filterControl}
              fullWidth
              options={duplicateDropdownOptions}
              value={duplicateFilter}
              onChange={(value) => setDuplicateFilter(value as "all" | "duplicate" | "unique")}
              aria-label="Filter duplikat"
            />
          </div>
        </div>
      </section>

      <section className={baseStyles.sectionCard}>
        <div className={baseStyles.sectionHeader}>
          <div className={`${baseStyles.sectionIcon} ${baseStyles.iconGreen}`}>📋</div>
          <div>
            <div className={baseStyles.sectionTitle}>Survey Data Review</div>
            <div className={baseStyles.sectionSubtitle}>Review responden dan duplicate check sebelum lanjut ke Approval IT Lead</div>
          </div>
        </div>

        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabButton} ${tab === "respondents" ? styles.tabButtonActive : ""}`} onClick={() => setTab("respondents")}>
            <span className={styles.tabButtonLabel}>📝 Daftar Responden</span>
            <span className={baseStyles.counterBadge}>{sortedRespondents.length}</span>
          </button>
          <button type="button" className={`${styles.tabButton} ${tab === "takeout" ? styles.tabButtonActive : ""}`} onClick={() => setTab("takeout")}>
            <span className={styles.tabButtonLabel}>📤 Propose Takeout</span>
            <span className={baseStyles.counterBadge}>{sortedTakeouts.length}</span>
          </button>
        </div>

        <div className={styles.statusRegion} aria-live="polite">
          {loading ? <p className={baseStyles.loadingState}>Memuat data...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.success}>{message}</p> : null}
        </div>

        {tab === "respondents" ? (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>
                Menampilkan {sortedRespondents.length} responden ({duplicateCount} duplikat)
              </span>
              <div className={styles.actions}>
                <button type="button" className={styles.btnSecondary} onClick={handleExportRespondents} disabled={respondents.length === 0 || submitting}>
                  📥 Export Excel
                </button>
                <button type="button" className={styles.btnPrimary} onClick={() => void handleApproveSelected()} disabled={selectedRespondentIds.length === 0 || submitting}>
                  ✅ Approve
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setRejectOpen(true)} disabled={selectedRespondentIds.length === 0 || submitting}>
                  ❌ Reject
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => setSelectedRespondentIds([])} disabled={selectedRespondentIds.length === 0 || submitting}>
                  ✕ Batal Pilih
                </button>
              </div>
            </div>

            {selectedRespondentIds.length > 0 ? <div className={styles.selectionHint}>📌 Responden terpilih: {selectedRespondentIds.length}</div> : null}

            <Pagination
              instanceId="top"
              currentPage={respondentsPage}
              totalPages={respondentsTotalPages}
              totalItems={sortedRespondents.length}
              itemsPerPage={pageSize}
              onPageChange={setRespondentsPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
            <div className={baseStyles.scTableWrap}>
              <table className={baseStyles.scTable}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 40, textAlign: 'center' }}>
                      <input
                        aria-label="Pilih semua responden"
                        type="checkbox"
                        checked={paginatedRespondents.length > 0 && paginatedRespondents.every((item) => selectedRespondentIds.includes(item.ResponseId))}
                        onChange={() => {
                          const allSelected = paginatedRespondents.every((item) => selectedRespondentIds.includes(item.ResponseId));
                          if (allSelected) {
                            const pageIds = paginatedRespondents.map((item) => item.ResponseId);
                            setSelectedRespondentIds((prev) => prev.filter((id) => !pageIds.includes(id)));
                          } else {
                            const pageIds = paginatedRespondents.map((item) => item.ResponseId);
                            setSelectedRespondentIds((prev) => [...new Set([...prev, ...pageIds])]);
                          }
                        }}
                      />
                    </th>
                    <th scope="col">Event</th>
                    <th scope="col">Survey</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortRespondents('respondent')}>
                      Responden{renderSortIconRespondents('respondent')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortRespondents('department')}>
                      Department{renderSortIconRespondents('department')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortRespondents('application')}>
                      Aplikasi{renderSortIconRespondents('application')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortRespondents('email')}>
                      Email{renderSortIconRespondents('email')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortRespondents('submittime')} style={{ textAlign: 'center' }}>
                      Submit Time{renderSortIconRespondents('submittime')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortRespondents('status')} style={{ width: 100, textAlign: 'center' }}>
                      Status{renderSortIconRespondents('status')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortRespondents('duplicate')} style={{ width: 90, textAlign: 'center' }}>
                      Duplicate{renderSortIconRespondents('duplicate')}
                    </th>
                    <th scope="col" style={{ width: 70, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRespondents.length === 0 ? (
                    <tr>
                      <td colSpan={11}>
                        <div className={baseStyles.emptyState}>
                          <div className={baseStyles.emptyIcon}>📝</div>
                          <div className={baseStyles.emptyText}>Belum ada data responden</div>
                          <div className={baseStyles.emptySubtext}>Pilih survey untuk menampilkan data</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRespondents.map((row) => {
                      const selected = selectedRespondentIds.includes(row.ResponseId);
                      const statusMeta = mapApprovalStatus(row.ResponseApprovalStatus);
                      return (
                        <tr key={row.ResponseId} style={selected ? { background: '#eff6ff' } : undefined}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              aria-label={getRespondentAriaLabel(row)}
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                setSelectedRespondentIds((prev) => {
                                  if (event.target.checked) {
                                    return Array.from(new Set([...prev, row.ResponseId]));
                                  }
                                  return prev.filter((id) => id !== row.ResponseId);
                                })
                              }
                            />
                          </td>
                          <td style={{ fontSize: 12 }}>{row.EventTitle || "-"}</td>
                          <td style={{ fontSize: 12 }}>{row.SurveyTitle || "-"}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.RespondentName || "-"}</td>
                          <td>{row.DepartmentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td style={{ fontSize: 12 }}>{row.RespondentEmail || "-"}</td>
                          <td style={{ fontSize: 12, textAlign: 'center' }}>{formatDateTime(row.SubmittedAt)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`${styles.pill} ${statusMeta.tone}`}>{statusMeta.label}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <span className={`${styles.pill} ${row.IsDuplicate ? styles.pillDuplicate : styles.pillUnique}`}>
                              {row.IsDuplicate ? "Duplicate" : "Unique"}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button type="button" className={styles.link} onClick={() => setModal({ type: "detail", row })}>
                              👁️ View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              instanceId="bottom"
              currentPage={respondentsPage}
              totalPages={respondentsTotalPages}
              totalItems={sortedRespondents.length}
              itemsPerPage={pageSize}
              onPageChange={setRespondentsPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>Menampilkan {sortedTakeouts.length} usulan takeout</span>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => void handleApproveTakeouts()} disabled={selectedTakeoutRows.length === 0 || submitting}>
                  ✅ Approve Takeout
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setTakeoutRejectOpen(true)} disabled={selectedTakeoutRows.length === 0 || submitting}>
                  ❌ Reject Takeout
                </button>
                <button type="button" className={styles.btnGhost} onClick={() => setSelectedTakeoutKeys([])} disabled={selectedTakeoutRows.length === 0 || submitting}>
                  ✕ Batal Pilih
                </button>
              </div>
            </div>

            {selectedTakeoutRows.length > 0 ? <div className={styles.selectionHint}>📌 Takeout terpilih: {selectedTakeoutRows.length}</div> : null}

            <Pagination
              instanceId="top"
              currentPage={takeoutsPage}
              totalPages={takeoutsTotalPages}
              totalItems={sortedTakeouts.length}
              itemsPerPage={pageSize}
              onPageChange={setTakeoutsPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
            <div className={baseStyles.scTableWrap}>
              <table className={baseStyles.scTable}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 40, textAlign: 'center' }}>
                      <input
                        aria-label="Pilih semua usulan takeout"
                        type="checkbox"
                        checked={paginatedTakeouts.length > 0 && paginatedTakeouts.every((row) => selectedTakeoutKeys.includes(row.QuestionResponseId))}
                        onChange={() => {
                          const allSelected = paginatedTakeouts.every((row) => selectedTakeoutKeys.includes(row.QuestionResponseId));
                          if (allSelected) {
                            const pageIds = paginatedTakeouts.map((row) => row.QuestionResponseId);
                            setSelectedTakeoutKeys((prev) => prev.filter((id) => !pageIds.includes(id)));
                          } else {
                            const pageIds = paginatedTakeouts.map((row) => row.QuestionResponseId);
                            setSelectedTakeoutKeys((prev) => [...new Set([...prev, ...pageIds])]);
                          }
                        }}
                      />  
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortTakeouts('event')}>
                      Event{renderSortIconTakeouts('event')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortTakeouts('survey')}>
                      Survey{renderSortIconTakeouts('survey')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortTakeouts('respondent')}>
                      Responden{renderSortIconTakeouts('respondent')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortTakeouts('department')}>
                      Department{renderSortIconTakeouts('department')}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortTakeouts('application')}>
                      Aplikasi{renderSortIconTakeouts('application')}
                    </th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortTakeouts('score')} style={{ width: 60, textAlign: 'center' }}>
                      Score{renderSortIconTakeouts('score')}
                    </th>
                    <th scope="col">Komentar</th>
                    <th scope="col">Alasan Takeout</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortTakeouts('status')} style={{ width: 90, textAlign: 'center' }}>
                      Status{renderSortIconTakeouts('status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTakeouts.length === 0 ? (
                    <tr>
                      <td colSpan={11}>
                        <div className={baseStyles.emptyState}>
                          <div className={baseStyles.emptyIcon}>📤</div>
                          <div className={baseStyles.emptyText}>Belum ada proposed takeout</div>
                          <div className={baseStyles.emptySubtext}>Data takeout akan muncul setelah IT Lead mengusulkan</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedTakeouts.map((row) => (
                      <tr key={row.QuestionResponseId} style={selectedTakeoutKeys.includes(row.QuestionResponseId) ? { background: '#eff6ff' } : undefined}>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            aria-label={getTakeoutAriaLabel(row)}
                            type="checkbox"
                            checked={selectedTakeoutKeys.includes(row.QuestionResponseId)}
                            onChange={(event) =>
                              setSelectedTakeoutKeys((prev) => {
                                if (event.target.checked) {
                                  return Array.from(new Set([...prev, row.QuestionResponseId]));
                                }
                                return prev.filter((id) => id !== row.QuestionResponseId);
                              })
                            }
                          />
                        </td>
                        <td style={{ fontSize: 12 }}>{row.EventTitle || "-"}</td>
                        <td style={{ fontSize: 12 }}>{row.SurveyTitle || "-"}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.RespondentName || "-"}</td>
                        <td>{row.DepartmentName || "-"}</td>
                        <td>{row.ApplicationName || "-"}</td>
                        <td style={{ maxWidth: 200, fontSize: 12 }}>{row.QuestionText || "-"}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: typeof row.NumericValue === 'number' && row.NumericValue >= 4 ? '#15803d' : typeof row.NumericValue === 'number' && row.NumericValue <= 2 ? '#b91c1c' : '#374151' }}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                        <td style={{ maxWidth: 180, fontSize: 12 }}>{row.CommentValue || "-"}</td>
                        <td style={{ maxWidth: 180, fontSize: 12 }}>{row.TakeoutReason || "-"}</td>
                        <td style={{ textAlign: 'center' }}>{row.TakeoutStatus || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              instanceId="bottom"
              currentPage={takeoutsPage}
              totalPages={takeoutsTotalPages}
              totalItems={sortedTakeouts.length}
              itemsPerPage={pageSize}
              onPageChange={setTakeoutsPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </section>

      <ApprovalAdminDialogs
        handleRejectSelected={handleRejectSelected}
        handleRejectTakeouts={handleRejectTakeouts}
        modal={modal}
        rejectOpen={rejectOpen}
        rejectReason={rejectReason}
        selectedRespondentIds={selectedRespondentIds}
        selectedTakeoutRows={selectedTakeoutRows}
        setModal={setModal}
        setRejectOpen={setRejectOpen}
        setRejectReason={setRejectReason}
        setTakeoutRejectOpen={setTakeoutRejectOpen}
        setTakeoutRejectReason={setTakeoutRejectReason}
        takeoutRejectOpen={takeoutRejectOpen}
        takeoutRejectReason={takeoutRejectReason}
      />
    </>
  );
}

