"use client";

import { getCurrentUser } from "@/lib/auth";
import { Dropdown } from "@/components/common/dropdown";
import {
  approveFinalResponses,
  fetchBestCommentsWithFeedback,
  fetchMyFunctions,
  fetchPendingApprovals,
  proposeTakeout,
  submitBestCommentFeedback,
  type BestCommentWithFeedback,
  type PendingApproval,
} from "@/lib/approvals";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";

import ApprovalItLeadDialogs from "./approval-it-lead-dialogs";
import { getFeedbackAriaLabel, getPendingReviewAriaLabel, mapError, shortText } from "./approval-it-lead-utils";

type Tab = "takeout" | "feedback";

export default function ApprovalItLeadPage() {
  const role: UserRole | null = getCurrentUser()?.role ?? null;
  const canAccess = role === "ITLead";

  const [tab, setTab] = useState<Tab>("takeout");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [surveyId, setSurveyId] = useState<number | "">("");
  const [functionId, setFunctionId] = useState("all");
  const [surveys, setSurveys] = useState<Array<{ id: number; title: string; eventTitle: string | null }>>([]);
  const [myFunctions, setMyFunctions] = useState<Array<{ FunctionId: number; Name: string }>>([]);
  const [pendingRows, setPendingRows] = useState<PendingApproval[]>([]);
  const [feedbackRows, setFeedbackRows] = useState<BestCommentWithFeedback[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [feedbackDraft, setFeedbackDraft] = useState<Record<number, string>>({});
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposeReason, setProposeReason] = useState("");
  const [pendingPage, setPendingPage] = useState(1);
  const [feedbackPage, setFeedbackPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumnPending, setSortColumnPending] = useState<string>("");
  const [sortDirectionPending, setSortDirectionPending] = useState<"asc" | "desc">("asc");
  const [sortColumnFeedback, setSortColumnFeedback] = useState<string>("");
  const [sortDirectionFeedback, setSortDirectionFeedback] = useState<"asc" | "desc">("asc");
  const [submitting, setSubmitting] = useState(false);

  const handleSortPending = (column: string) => {
    if (sortColumnPending === column) {
      setSortDirectionPending(sortDirectionPending === "asc" ? "desc" : "asc");
    } else {
      setSortColumnPending(column);
      setSortDirectionPending("asc");
    }
  };

  const renderSortIconPending = (column: string) => {
    if (sortColumnPending !== column) return " ⇅";
    return sortDirectionPending === "asc" ? " ▲" : " ▼";
  };

  const handleSortFeedback = (column: string) => {
    if (sortColumnFeedback === column) {
      setSortDirectionFeedback(sortDirectionFeedback === "asc" ? "desc" : "asc");
    } else {
      setSortColumnFeedback(column);
      setSortDirectionFeedback("asc");
    }
  };

  const renderSortIconFeedback = (column: string) => {
    if (sortColumnFeedback !== column) return " ⇅";
    return sortDirectionFeedback === "asc" ? " ▲" : " ▼";
  };

  const sortedPending = useMemo(() => {
    if (!sortColumnPending) return pendingRows;

    return [...pendingRows].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortColumnPending) {
        case "event":
          aVal = (a.EventTitle || "").toLowerCase();
          bVal = (b.EventTitle || "").toLowerCase();
          break;
        case "survey":
          aVal = (a.SurveyTitle || "").toLowerCase();
          bVal = (b.SurveyTitle || "").toLowerCase();
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
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirectionPending === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirectionPending === "asc" ? 1 : -1;
      return 0;
    });
  }, [pendingRows, sortColumnPending, sortDirectionPending]);

  const sortedFeedback = useMemo(() => {
    if (!sortColumnFeedback) return feedbackRows;

    return [...feedbackRows].sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      switch (sortColumnFeedback) {
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
        case "application":
          aVal = (a.ApplicationName || "").toLowerCase();
          bVal = (b.ApplicationName || "").toLowerCase();
          break;
        case "score":
          aVal = typeof a.NumericValue === "number" ? a.NumericValue : -999;
          bVal = typeof b.NumericValue === "number" ? b.NumericValue : -999;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirectionFeedback === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirectionFeedback === "asc" ? 1 : -1;
      return 0;
    });
  }, [feedbackRows, sortColumnFeedback, sortDirectionFeedback]);

  const selectedRows = useMemo(
    () => pendingRows.filter((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`)),
    [pendingRows, selectedKeys]
  );
  const surveyDropdownOptions = useMemo(
    () => [
      { value: "all", label: "All Surveys" },
      ...surveys.map((item: { id: number; title: string; eventTitle: string | null }) => ({ 
        value: item.id, 
        label: item.eventTitle ? `${item.eventTitle} - ${item.title}` : item.title 
      }))
    ],
    [surveys]
  );
  const functionDropdownOptions = useMemo(
    () => [
      { value: "all", label: "Semua Function" },
      ...myFunctions
        .slice()
        .sort((a, b) => a.Name.localeCompare(b.Name))
        .map((item) => ({ value: String(item.FunctionId), label: item.Name })),
    ],
    [myFunctions]
  );

  const pendingTotalPages = Math.max(1, Math.ceil(sortedPending.length / pageSize));
  const paginatedPending = useMemo(() => {
    const start = (pendingPage - 1) * pageSize;
    return sortedPending.slice(start, start + pageSize);
  }, [sortedPending, pendingPage, pageSize]);

  const feedbackTotalPages = Math.max(1, Math.ceil(sortedFeedback.length / pageSize));
  const paginatedFeedback = useMemo(() => {
    const start = (feedbackPage - 1) * pageSize;
    return sortedFeedback.slice(start, start + pageSize);
  }, [sortedFeedback, feedbackPage, pageSize]);

  useEffect(() => {
    setPendingPage(1);
    setFeedbackPage(1);
  }, [surveyId, functionId]);

  useEffect(() => {
    setPendingPage(1);
    setFeedbackPage(1);
  }, [pageSize]);

  useEffect(() => {
    setPendingPage(1);
  }, [sortColumnPending, sortDirectionPending]);

  useEffect(() => {
    setFeedbackPage(1);
  }, [sortColumnFeedback, sortDirectionFeedback]);

  useEffect(() => {
    if (pendingPage > pendingTotalPages) setPendingPage(pendingTotalPages);
  }, [pendingPage, pendingTotalPages]);

  useEffect(() => {
    if (feedbackPage > feedbackTotalPages) setFeedbackPage(feedbackTotalPages);
  }, [feedbackPage, feedbackTotalPages]);

  useEffect(() => {
    let active = true;

    const run = async () => {
      try {
        const [surveyRes, functionsRes] = await Promise.all([
          fetchSurveyOverview(),
          fetchMyFunctions(),
        ]);
        if (!active) return;

        if (!surveyRes.success) {
          setError(surveyRes.message || "Gagal memuat survey");
          setSurveys([]);
          setSurveyId("");
          return;
        }

        const surveyOptions = surveyRes.surveys.map((item) => ({
          id: item.SurveyId,
          title: item.Title,
          eventTitle: item.EventTitle || null
        }));
        setSurveys(surveyOptions);
        setSurveyId("");
        if (functionsRes.success) {
          setMyFunctions(functionsRes.data);
        }
      } catch {
        if (!active) return;
        setError("Gagal memuat data awal approval IT Lead.");
        setSurveys([]);
        setSurveyId("");
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

  const loadData = useCallback(async () => {
    setError("");
    setMessage("");
    try {
      const [pendingRes, feedbackRes] = await Promise.all([
        fetchPendingApprovals({ surveyId: surveyId || undefined, functionId: functionId === "all" ? undefined : functionId }),
        fetchBestCommentsWithFeedback({ surveyId: surveyId || undefined, functionId: functionId === "all" ? undefined : functionId }),
      ]);

      if (!pendingRes.success) {
        setError(pendingRes.message);
        setPendingRows([]);
      } else {
        setPendingRows(pendingRes.data);
      }

      if (!feedbackRes.success) {
        setError((prev) => prev || feedbackRes.message);
        setFeedbackRows([]);
      } else {
        setFeedbackRows(feedbackRes.data);
        setFeedbackDraft(prev => {
          const next = { ...prev };
          for (const row of feedbackRes.data) {
            // Hanya set jika key belum ada (preserve user's in-progress draft)
            if (!(row.QuestionResponseId in next)) {
              next[row.QuestionResponseId] = row.FeedbackText || '';
            }
          }
          return next;
        });
      }
    } catch {
      setError("Terjadi kesalahan saat memuat data approval IT Lead.");
      setPendingRows([]);
      setFeedbackRows([]);
    }
  }, [functionId, surveyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApprove = async () => {
    if (selectedRows.length === 0) {
      setError("Pilih minimal satu data untuk di-approve.");
      return;
    }

    setSubmitting(true);
    try {
      const responseIds = Array.from(new Set(selectedRows.map((row) => row.ResponseId)));
      const result = await approveFinalResponses({ responseIds });
      if (!result.success) {
        setError(result.message);
        return;
      }

      setSelectedKeys([]);
      setMessage("Response terpilih berhasil di-approve final oleh IT Lead.");
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleProposeTakeout = async () => {
    if (selectedRows.length === 0) {
      setError("Pilih minimal satu data untuk di-propose takeout.");
      return;
    }
    if (!proposeReason.trim()) {
      setError("Alasan propose takeout wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await Promise.all(
        selectedRows.map((row) =>
          proposeTakeout({
            responseId: row.ResponseId,
            questionId: row.QuestionId,
            reason: proposeReason.trim(),
          })
        )
      );
      const err = mapError(result);
      if (err) {
        setError(err);
        return;
      }
      setProposeOpen(false);
      setProposeReason("");
      setSelectedKeys([]);
      setMessage("Usulan takeout berhasil dikirim ke Admin Event.");
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitFeedback = async (row: BestCommentWithFeedback) => {
    const text = String(feedbackDraft[row.QuestionResponseId] || "").trim();
    if (!text) {
      setError("Feedback tidak boleh kosong.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitBestCommentFeedback({
        questionResponseId: row.QuestionResponseId,
        feedbackText: text,
      });
      if (!result.success) {
        setError(result.message);
        return;
      }
      setMessage("Feedback berhasil disimpan.");
      await loadData();
    } finally {
      setSubmitting(false);
    }
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel} aria-busy={loading}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Halaman Approval IT Lead hanya untuk role IT Lead.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Approval IT Lead</h1>
          <div className={baseStyles.subtitle}>Review score aplikasi dan feedback best comments.</div>
        </div>
      </div>

      <p className={styles.notice}>📝 IT Lead melakukan approval final response atau propose takeout sebelum data masuk ke report.</p>

      <section className={`${baseStyles.sectionCard} ${baseStyles.filterCard}`}>
        <div className={baseStyles.sectionHeader}>
          <div className={`${baseStyles.sectionIcon} ${baseStyles.iconBlue}`}>🔍</div>
          <div>
            <div className={baseStyles.sectionTitle}>Filter Data</div>
            <div className={baseStyles.sectionSubtitle}>Pilih survey dan function untuk memfilter data</div>
          </div>
        </div>
        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupLg}`}>
            <label id="itlead-survey-label" className={baseStyles.filterLabel} htmlFor="itlead-survey-dropdown">Survey</label>
            <Dropdown
              id="itlead-survey-dropdown"
              className={baseStyles.filterControl}
              fullWidth
              options={surveyDropdownOptions}
              value={surveyId}
              onChange={(v) => setSurveyId(v ? Number(v) : "")}
              placeholder="Pilih survey"
              aria-labelledby="itlead-survey-label"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="itlead-function-label" className={baseStyles.filterLabel} htmlFor="itlead-function-dropdown">Function</label>
            <Dropdown
              id="itlead-function-dropdown"
              className={baseStyles.filterControl}
              fullWidth
              options={functionDropdownOptions}
              value={functionId}
              onChange={setFunctionId}
              aria-labelledby="itlead-function-label"
            />
          </div>
        </div>
      </section>

      <section className={baseStyles.sectionCard}>
        <div className={baseStyles.sectionHeader}>
          <div className={`${baseStyles.sectionIcon} ${baseStyles.iconGreen}`}>📋</div>
          <div>
            <div className={baseStyles.sectionTitle}>Data Review IT Lead</div>
            <div className={baseStyles.sectionSubtitle}>Review score aplikasi dan feedback best comments</div>
          </div>
        </div>

        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabButton} ${tab === "takeout" ? styles.tabButtonActive : ""}`} onClick={() => setTab("takeout")}>
            📤 Propose Takeout
            <span className={baseStyles.counterBadge}>{sortedPending.length}</span>
          </button>
          <button type="button" className={`${styles.tabButton} ${tab === "feedback" ? styles.tabButtonActive : ""}`} onClick={() => setTab("feedback")}>
            ⭐ Best Comments Feedback
            <span className={baseStyles.counterBadge}>{sortedFeedback.length}</span>
          </button>
        </div>

        <div className={styles.statusRegion} aria-live="polite">
          {loading ? <p className={baseStyles.loadingState}>Memuat data...</p> : null}
          {error ? <p className={styles.error}>{error}</p> : null}
          {message ? <p className={styles.success}>{message}</p> : null}
        </div>

        {tab === "takeout" ? (
          <>
            <Pagination
              instanceId="top"
              currentPage={pendingPage}
              totalPages={pendingTotalPages}
              totalItems={sortedPending.length}
              itemsPerPage={pageSize}
              onPageChange={setPendingPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
            <div className={styles.toolbar}>
              <span className={styles.meta}>Menampilkan {sortedPending.length} pending review</span>
              <div className={styles.actions}>
                <button type="button" className={styles.btnPrimary} onClick={() => void handleApprove()} disabled={selectedRows.length === 0 || submitting}>
                  ✅ Approve Final
                </button>
                <button type="button" className={styles.btnDanger} onClick={() => setProposeOpen(true)} disabled={selectedRows.length === 0 || submitting}>
                  📤 Propose Takeout
                </button>
              </div>
            </div>

            {selectedRows.length > 0 ? <div className={styles.selectionHint}>📌 Item terpilih: {selectedRows.length}</div> : null}

            <div className={baseStyles.scTableWrap}>
              <table className={baseStyles.scTable}>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: 40, textAlign: 'center' }}>
                      <input
                        aria-label="Pilih semua pending review IT Lead"
                        type="checkbox"
                        checked={paginatedPending.length > 0 && paginatedPending.every((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`))}
                        onChange={() => {
                          const allSelected = paginatedPending.every((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`));
                          if (allSelected) {
                            const pageKeys = paginatedPending.map((row) => `${row.ResponseId}-${row.QuestionId}`);
                            setSelectedKeys((prev) => prev.filter((k) => !pageKeys.includes(k)));
                          } else {
                            const pageKeys = paginatedPending.map((row) => `${row.ResponseId}-${row.QuestionId}`);
                            setSelectedKeys((prev) => [...new Set([...prev, ...pageKeys])]);
                          }
                        }}
                      />
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortPending("event")}>Event{renderSortIconPending("event")}</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortPending("survey")}>Survey{renderSortIconPending("survey")}</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortPending("department")}>Department{renderSortIconPending("department")}</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortPending("application")}>Aplikasi{renderSortIconPending("application")}</th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortPending("score")} style={{ width: 60, textAlign: 'center' }}>Score{renderSortIconPending("score")}</th>
                    <th scope="col">Komentar</th>
                    <th scope="col">Alasan Takeout</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPending.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className={baseStyles.emptyState}>
                          <div className={baseStyles.emptyIcon}>📤</div>
                          <div className={baseStyles.emptyText}>Tidak ada response pending review</div>
                          <div className={baseStyles.emptySubtext}>Semua response sudah diproses</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPending.map((row) => {
                      const key = `${row.ResponseId}-${row.QuestionId}`;
                      const selected = selectedKeys.includes(key);
                      return (
                        <tr key={key} style={selected ? { background: '#eff6ff' } : undefined}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              aria-label={getPendingReviewAriaLabel(row)}
                              type="checkbox"
                              checked={selected}
                              onChange={(event) =>
                                setSelectedKeys((prev) => {
                                  if (event.target.checked) return Array.from(new Set([...prev, key]));
                                  return prev.filter((item) => item !== key);
                                })
                              }
                            />
                          </td>
                          <td style={{ fontSize: 12 }}>{row.EventTitle || "-"}</td>
                          <td style={{ fontSize: 12 }}>{row.SurveyTitle || "-"}</td>
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.DepartmentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td style={{ maxWidth: 200, fontSize: 12 }}>{row.QuestionText || "-"}</td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: typeof row.NumericValue === 'number' && row.NumericValue >= 4 ? '#15803d' : typeof row.NumericValue === 'number' && row.NumericValue <= 2 ? '#b91c1c' : '#374151' }}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                          <td style={{ maxWidth: 180, fontSize: 12 }}>{shortText(row.CommentValue)}</td>
                          <td style={{ maxWidth: 180, fontSize: 12 }}>{shortText(row.TakeoutReason)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              instanceId="bottom"
              currentPage={pendingPage}
              totalPages={pendingTotalPages}
              totalItems={sortedPending.length}
              itemsPerPage={pageSize}
              onPageChange={setPendingPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </>
        ) : (
          <>
            <Pagination
              instanceId="top"
              currentPage={feedbackPage}
              totalPages={feedbackTotalPages}
              totalItems={sortedFeedback.length}
              itemsPerPage={pageSize}
              onPageChange={setFeedbackPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
            <div className={styles.toolbar}>
              <span className={styles.meta}>Menampilkan {sortedFeedback.length} best comments</span>
            </div>
            <div className={baseStyles.scTableWrap}>
              <table className={baseStyles.scTable}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortFeedback("event")}>Event{renderSortIconFeedback("event")}</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortFeedback("survey")}>Survey{renderSortIconFeedback("survey")}</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortFeedback("respondent")}>Responden{renderSortIconFeedback("respondent")}</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortFeedback("application")}>Aplikasi{renderSortIconFeedback("application")}</th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col">Komentar</th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortFeedback("score")} style={{ width: 60, textAlign: 'center' }}>Score{renderSortIconFeedback("score")}</th>
                    <th scope="col" style={{ minWidth: 200 }}>IT Lead Feedback</th>
                    <th scope="col" style={{ width: 90, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedFeedback.length === 0 ? (
                    <tr>
                      <td colSpan={9}>
                        <div className={baseStyles.emptyState}>
                          <div className={baseStyles.emptyIcon}>⭐</div>
                          <div className={baseStyles.emptyText}>Belum ada best comments</div>
                          <div className={baseStyles.emptySubtext}>Data best comments akan muncul setelah admin memilih</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedFeedback.map((row) => (
                      <tr key={row.QuestionResponseId}>
                        <td style={{ fontSize: 12 }}>{row.EventTitle || "-"}</td>
                        <td style={{ fontSize: 12 }}>{row.SurveyTitle || "-"}</td>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.RespondentName || "-"}</td>
                        <td>{row.ApplicationName || "-"}</td>
                        <td style={{ maxWidth: 200, fontSize: 12 }}>{row.QuestionText || "-"}</td>
                        <td style={{ maxWidth: 180, fontSize: 12 }}>{shortText(row.CommentValue)}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: typeof row.NumericValue === 'number' && row.NumericValue >= 4 ? '#15803d' : typeof row.NumericValue === 'number' && row.NumericValue <= 2 ? '#b91c1c' : '#374151' }}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                        <td>
                          <textarea
                            className={styles.textarea}
                            rows={2}
                            aria-label={getFeedbackAriaLabel(row)}
                            value={feedbackDraft[row.QuestionResponseId] || ""}
                            onChange={(event) => setFeedbackDraft((prev) => ({ ...prev, [row.QuestionResponseId]: event.target.value }))}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button type="button" className={styles.btnPrimary} onClick={() => void handleSubmitFeedback(row)} disabled={submitting} style={{ fontSize: 11, padding: '5px 10px' }}>
                            💾 Simpan
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              instanceId="bottom"
              currentPage={feedbackPage}
              totalPages={feedbackTotalPages}
              totalItems={sortedFeedback.length}
              itemsPerPage={pageSize}
              onPageChange={setFeedbackPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </>
        )}
      </section>

      <ApprovalItLeadDialogs
        handleProposeTakeout={handleProposeTakeout}
        proposeOpen={proposeOpen}
        proposeReason={proposeReason}
        selectedRows={selectedRows}
        setProposeOpen={setProposeOpen}
        setProposeReason={setProposeReason}
      />
    </>
  );
}
