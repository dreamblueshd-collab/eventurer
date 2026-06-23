"use client";

import { getCurrentUser } from "@/lib/auth";
import { SearchBar } from "@/components/admin/search-bar";
import { Dropdown } from "@/components/common/dropdown";
import {
  fetchBestCommentsWithFeedback,
  fetchCommentsForSelection,
  markBestComment,
  unmarkBestComment,
  type ApprovalComment,
  type BestCommentWithFeedback,
} from "@/lib/approvals";
import { fetchFunctionsMaster } from "@/lib/master-data";
import { fetchSurveyOverview } from "@/lib/surveys";
import type { UserRole } from "@/types/auth";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pagination } from "@/components/admin/pagination";
import { useToast, ToastContainer } from "@/components/common/toast";
import baseStyles from "../page-mockup.module.css";
import styles from "../approval.module.css";

type Tab = "comments" | "best-comments";
type ModalState =
  | { type: "none" }
  | { type: "detail"; row: { question: string; comment: string } };

function shortText(value?: string | null, max = 72): string {
  const text = String(value || "").trim();
  if (!text) return "-";
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

function getCommentSelectionAriaLabel(row: ApprovalComment): string {
  const question = String(row.QuestionText || "").trim();
  const application = String(row.ApplicationName || "").trim();
  if (question && application) return `Pilih komentar ${question} - ${application}`;
  if (question) return `Pilih komentar ${question}`;
  if (application) return `Pilih komentar ${application}`;
  return "Pilih komentar";
}

export default function BestCommentsPage() {
  const role: UserRole | null = getCurrentUser()?.role ?? null;
  const canAccess = role === "AdminEvent" || role === "DepartmentHead";
  const canEdit = role === "AdminEvent";

  const [tab, setTab] = useState<Tab>("comments");
  const [loading, setLoading] = useState(true);
  const [surveyId, setSurveyId] = useState<number | "all">("all");
  const [functionId, setFunctionId] = useState<number | "all">("all");
  const [surveys, setSurveys] = useState<Array<{ id: number; title: string; eventTitle: string | null }>>([]);
  const [functions, setFunctions] = useState<Array<{ id: number; name: string }>>([]);
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [bestRows, setBestRows] = useState<BestCommentWithFeedback[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [modal, setModal] = useState<ModalState>({ type: "none" });
  const [searchBy, setSearchBy] = useState<"all" | "event" | "respondent" | "application" | "question" | "comment">("all");
  const [keyword, setKeyword] = useState("");
  const [commentsPage, setCommentsPage] = useState(1);
  const [bestPage, setBestPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortColumnComments, setSortColumnComments] = useState<string>("");
  const [sortDirectionComments, setSortDirectionComments] = useState<"asc" | "desc">("asc");
  const [sortColumnBest, setSortColumnBest] = useState<string>("");
  const [sortDirectionBest, setSortDirectionBest] = useState<"asc" | "desc">("asc");

  const { toasts, showToast, removeToast } = useToast();

  const handleSortComments = (column: string) => {
    if (sortColumnComments === column) {
      setSortDirectionComments(sortDirectionComments === "asc" ? "desc" : "asc");
    } else {
      setSortColumnComments(column);
      setSortDirectionComments("asc");
    }
  };

  const renderSortIconComments = (column: string) => {
    if (sortColumnComments !== column) return " ⇅";
    return sortDirectionComments === "asc" ? " ▲" : " ▼";
  };

  const handleSortBest = (column: string) => {
    if (sortColumnBest === column) {
      setSortDirectionBest(sortDirectionBest === "asc" ? "desc" : "asc");
    } else {
      setSortColumnBest(column);
      setSortDirectionBest("asc");
    }
  };

  const renderSortIconBest = (column: string) => {
    if (sortColumnBest !== column) return " ⇅";
    return sortDirectionBest === "asc" ? " ▲" : " ▼";
  };

  useEffect(() => {
    const run = async () => {
      try {
        const [surveyRes, functionRes] = await Promise.all([fetchSurveyOverview(), fetchFunctionsMaster()]);
        if (!surveyRes.success) {
          setLoading(false);
          showToast("error", surveyRes.message || "Gagal memuat survey");
          return;
        }
        setSurveys(surveyRes.surveys.map((item) => ({ id: item.SurveyId, title: item.Title, eventTitle: item.EventTitle || null })));
        if (functionRes.success) {
          setFunctions(functionRes.data.filter((item) => item.IsActive !== false).map((item) => ({ id: item.FunctionId, name: item.Name })));
        }
      } catch {
        showToast("error", "Gagal memuat data awal best comments.");
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [showToast]);

  const loadData = useCallback(async () => {
    const selectedSurvey = surveyId === "all" ? undefined : surveyId;
    const selectedFunction = functionId === "all" ? undefined : functionId;
    try {
      const [commentRes, bestRes] = await Promise.all([
        fetchCommentsForSelection({ surveyId: selectedSurvey, functionId: selectedFunction }),
        fetchBestCommentsWithFeedback({ surveyId: selectedSurvey, functionId: selectedFunction }),
      ]);

      if (!commentRes.success) {
        showToast("error", commentRes.message);
        setComments([]);
      } else {
        setComments(commentRes.data);
      }

      if (!bestRes.success) {
        showToast("error", bestRes.message);
        setBestRows([]);
      } else {
        setBestRows(bestRes.data);
      }
    } catch {
      showToast("error", "Terjadi kesalahan saat memuat data best comments.");
      setComments([]);
      setBestRows([]);
    }
  }, [surveyId, functionId, showToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedRows = useMemo(
    () => comments.filter((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`)),
    [comments, selectedKeys]
  );
  const selectedRowsToSave = useMemo(
    () => selectedRows.filter((row) => !row.IsBestComment),
    [selectedRows]
  );
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredComments = useMemo(() => {
    if (!normalizedKeyword) return comments;
    return comments.filter((row) => {
      const respondent = String(row.RespondentName || "").toLowerCase();
      const application = String(row.ApplicationName || "").toLowerCase();
      const question = String(row.QuestionText || "").toLowerCase();
      const comment = String(row.CommentValue || "").toLowerCase();

      if (searchBy === "respondent") return respondent.includes(normalizedKeyword);
      if (searchBy === "application") return application.includes(normalizedKeyword);
      if (searchBy === "question") return question.includes(normalizedKeyword);
      if (searchBy === "comment") return comment.includes(normalizedKeyword);
      return respondent.includes(normalizedKeyword)
        || application.includes(normalizedKeyword)
        || question.includes(normalizedKeyword)
        || comment.includes(normalizedKeyword);
    });
  }, [comments, normalizedKeyword, searchBy]);

  const sortedComments = useMemo(() => {
    if (!sortColumnComments) return filteredComments;
    const sorted = [...filteredComments];
    sorted.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortColumnComments) {
        case "respondent":
          aVal = String(a.RespondentName || "").toLowerCase();
          bVal = String(b.RespondentName || "").toLowerCase();
          break;
        case "application":
          aVal = String(a.ApplicationName || "").toLowerCase();
          bVal = String(b.ApplicationName || "").toLowerCase();
          break;
        case "score":
          aVal = typeof a.NumericValue === "number" ? a.NumericValue : -Infinity;
          bVal = typeof b.NumericValue === "number" ? b.NumericValue : -Infinity;
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirectionComments === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirectionComments === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredComments, sortColumnComments, sortDirectionComments]);

  const filteredBestRows = useMemo(() => {
    if (!normalizedKeyword) return bestRows;
    return bestRows.filter((row) => {
      const respondent = String(row.RespondentName || "").toLowerCase();
      const application = String(row.ApplicationName || "").toLowerCase();
      const question = String(row.QuestionText || "").toLowerCase();
      const comment = String(row.CommentValue || "").toLowerCase();
      const survey = String(row.SurveyTitle || "").toLowerCase();
      const eventTitle = String(row.EventTitle || "").toLowerCase();
      const fn = String(row.FunctionName || "").toLowerCase();
      const lead = String(row.ITLeadName || "").toLowerCase();
      const feedback = String(row.FeedbackText || "").toLowerCase();

      if (searchBy === "event") return eventTitle.includes(normalizedKeyword) || survey.includes(normalizedKeyword);
      if (searchBy === "respondent") return respondent.includes(normalizedKeyword);
      if (searchBy === "application") return application.includes(normalizedKeyword);
      if (searchBy === "question") return question.includes(normalizedKeyword);
      if (searchBy === "comment") return comment.includes(normalizedKeyword);
      return respondent.includes(normalizedKeyword)
        || application.includes(normalizedKeyword)
        || question.includes(normalizedKeyword)
        || comment.includes(normalizedKeyword)
        || survey.includes(normalizedKeyword)
        || eventTitle.includes(normalizedKeyword)
        || fn.includes(normalizedKeyword)
        || lead.includes(normalizedKeyword)
        || feedback.includes(normalizedKeyword);
    });
  }, [bestRows, normalizedKeyword, searchBy]);

  const sortedBest = useMemo(() => {
    if (!sortColumnBest) return filteredBestRows;
    const sorted = [...filteredBestRows];
    sorted.sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sortColumnBest) {
        case "respondent":
          aVal = String(a.RespondentName || "").toLowerCase();
          bVal = String(b.RespondentName || "").toLowerCase();
          break;
        case "application":
          aVal = String(a.ApplicationName || "").toLowerCase();
          bVal = String(b.ApplicationName || "").toLowerCase();
          break;
        case "score":
          aVal = typeof a.NumericValue === "number" ? a.NumericValue : -Infinity;
          bVal = typeof b.NumericValue === "number" ? b.NumericValue : -Infinity;
          break;
        case "function":
          aVal = String(a.FunctionName || "").toLowerCase();
          bVal = String(b.FunctionName || "").toLowerCase();
          break;
        case "itlead":
          aVal = String(a.ITLeadName || "").toLowerCase();
          bVal = String(b.ITLeadName || "").toLowerCase();
          break;
        default:
          return 0;
      }
      if (aVal < bVal) return sortDirectionBest === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirectionBest === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [filteredBestRows, sortColumnBest, sortDirectionBest]);

  const commentsTotalPages = Math.max(1, Math.ceil(sortedComments.length / pageSize));
  const paginatedComments = useMemo(() => {
    const start = (commentsPage - 1) * pageSize;
    return sortedComments.slice(start, start + pageSize);
  }, [sortedComments, commentsPage, pageSize]);

  const bestTotalPages = Math.max(1, Math.ceil(sortedBest.length / pageSize));
  const paginatedBestRows = useMemo(() => {
    const start = (bestPage - 1) * pageSize;
    return sortedBest.slice(start, start + pageSize);
  }, [sortedBest, bestPage, pageSize]);

  useEffect(() => {
    setCommentsPage(1);
    setBestPage(1);
  }, [normalizedKeyword, searchBy, surveyId, functionId]);

  useEffect(() => {
    setCommentsPage(1);
    setBestPage(1);
  }, [pageSize]);

  useEffect(() => {
    setCommentsPage(1);
  }, [sortColumnComments, sortDirectionComments]);

  useEffect(() => {
    setBestPage(1);
  }, [sortColumnBest, sortDirectionBest]);

  useEffect(() => {
    if (commentsPage > commentsTotalPages) setCommentsPage(commentsTotalPages);
  }, [commentsPage, commentsTotalPages]);

  useEffect(() => {
    if (bestPage > bestTotalPages) setBestPage(bestTotalPages);
  }, [bestPage, bestTotalPages]);

  const surveyDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Surveys" }, ...surveys.map((item) => ({ value: item.id, label: item.eventTitle ? `${item.eventTitle} - ${item.title}` : item.title }))],
    [surveys]
  );
  const functionDropdownOptions = useMemo(
    () => [{ value: "all", label: "All Functions" }, ...functions.map((item) => ({ value: item.id, label: item.name }))],
    [functions]
  );

  const saveBestComments = async () => {
    if (selectedRowsToSave.length === 0) {
      showToast("error", "Tidak ada komentar baru yang bisa disimpan.");
      return;
    }
    const responses = await Promise.all(
      selectedRowsToSave.map((row) =>
        markBestComment({
          responseId: row.ResponseId,
          questionId: row.QuestionId,
        })
      )
    );
    const firstFailed = responses.find((item) => !item.success);
    if (firstFailed && !firstFailed.success) {
      showToast("error", firstFailed.message);
      return;
    }
    showToast("success", "Best comments berhasil disimpan.");
    setSelectedKeys([]);
    await loadData();
  };

  const removeBestComment = async (row: ApprovalComment) => {
    const result = await unmarkBestComment({
      responseId: row.ResponseId,
      questionId: row.QuestionId,
    });
    if (!result.success) {
      showToast("error", result.message);
      return;
    }
    showToast("success", "Best comment berhasil dihapus.");
    await loadData();
  };

  if (!canAccess) {
    return (
      <section className={baseStyles.panel}>
        <h1 className={baseStyles.title}>Akses Ditolak</h1>
        <p className={baseStyles.subtitle}>Role Anda tidak memiliki akses ke halaman Best Comments.</p>
      </section>
    );
  }

  return (
    <>
      <div className={baseStyles.pageHead}>
        <div>
          <h1 className={baseStyles.title}>Best Comments Management</h1>
          <div className={baseStyles.subtitle}>
            {canEdit ? "Kelola komentar terbaik dari responden survey." : "Lihat komentar terbaik survey (readonly)."}
          </div>
        </div>
      </div>

      <section className={`${baseStyles.sectionCard} ${baseStyles.filterCard}`} aria-busy={loading}>
        <div className={baseStyles.sectionHeader}>
          <div className={`${baseStyles.sectionIcon} ${baseStyles.iconBlue}`}>🔍</div>
          <div>
            <div className={baseStyles.sectionTitle}>Filter & Pencarian</div>
            <div className={baseStyles.sectionSubtitle}>Saring berdasarkan survey, function, dan keyword</div>
          </div>
        </div>
        <div className={baseStyles.filterToolbar}>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="bc-survey-label" className={baseStyles.filterLabel} htmlFor="bc-survey-dropdown">Survey</label>
            <Dropdown
              id="bc-survey-dropdown"
              className={`${baseStyles.filterSelect} ${baseStyles.fullWidthControl}`}
              fullWidth
              options={surveyDropdownOptions}
              value={surveyId}
              onChange={(value) => setSurveyId(value === "all" ? "all" : Number(value))}
              aria-labelledby="bc-survey-label"
            />
          </div>
          <div className={`${baseStyles.filterGroup} ${baseStyles.filterGroupMd}`}>
            <label id="bc-function-label" className={baseStyles.filterLabel} htmlFor="bc-function-dropdown">Function</label>
            <Dropdown
              id="bc-function-dropdown"
              className={`${baseStyles.filterSelect} ${baseStyles.fullWidthControl}`}
              fullWidth
              options={functionDropdownOptions}
              value={functionId}
              onChange={(value) => setFunctionId(value === "all" ? "all" : Number(value))}
              aria-labelledby="bc-function-label"
            />
          </div>
          <SearchBar
            options={[
              { value: "all", label: "Search By" },
              { value: "event", label: "Event/Survey" },
              { value: "respondent", label: "Responden" },
              { value: "application", label: "Aplikasi" },
              { value: "question", label: "Pertanyaan" },
              { value: "comment", label: "Komentar" },
            ]}
            selectedValue={searchBy}
            keyword={keyword}
            onSelectedValueChange={(value) => setSearchBy(value as "all" | "event" | "respondent" | "application" | "question" | "comment")}
            onKeywordChange={setKeyword}
            placeholder="Cari event, responden, aplikasi, pertanyaan, atau komentar..."
          />
        </div>
      </section>

      <section className={baseStyles.sectionCard}>
        <div className={baseStyles.sectionHeader}>
          <div className={`${baseStyles.sectionIcon} ${baseStyles.iconPurple}`}>💬</div>
          <div>
            <div className={baseStyles.sectionTitle}>Komentar</div>
            <div className={baseStyles.sectionSubtitle}>Kelola dan pilih komentar terbaik dari responden</div>
          </div>
        </div>

        <div className={styles.tabs}>
          <button type="button" className={`${styles.tabButton} ${tab === "comments" ? styles.tabButtonActive : ""}`} onClick={() => setTab("comments")}>
            💬 View Comments
            <span className={baseStyles.counterBadge}>{sortedComments.length}</span>
          </button>
          <button type="button" className={`${styles.tabButton} ${tab === "best-comments" ? styles.tabButtonActive : ""}`} onClick={() => setTab("best-comments")}>
            ⭐ View Best Comments
            <span className={baseStyles.counterBadge}>{sortedBest.length}</span>
          </button>
        </div>

        {loading ? (
          <div className={styles.statusRegion} aria-live="polite">
            <p className={baseStyles.loadingState}>Memuat data...</p>
          </div>
        ) : null}

        {tab === "comments" ? (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>Menampilkan {sortedComments.length} komentar</span>
              {canEdit ? (
                <div className={styles.actions}>
                  <button type="button" className={styles.btnPrimary} onClick={() => void saveBestComments()} disabled={selectedRowsToSave.length === 0}>
                    ⭐ Simpan Best Comments
                  </button>
                  <button type="button" className={styles.btnSecondary} onClick={() => setSelectedKeys([])} disabled={selectedKeys.length === 0}>
                    ✕ Batal Pilih
                  </button>
                </div>
              ) : null}
            </div>

            {canEdit && selectedRows.length > 0 ? <div className={styles.selectionHint}>📌 Komentar terpilih: {selectedRows.length}</div> : null}
            {!canEdit ? <div className={styles.readonlyHint}>ℹ️ Role Department Head hanya dapat melihat best comments dan feedback yang sudah dipilih.</div> : null}

            {/* ── Pagination (Top) ── */}
            <Pagination
              instanceId="top"
              currentPage={commentsPage}
              totalPages={commentsTotalPages}
              totalItems={sortedComments.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setCommentsPage}
            />

            <div className={baseStyles.scTableWrap}>
              <table className={baseStyles.scTable}>
                <thead>
                  <tr>
                    {canEdit ? (
                      <th scope="col" style={{ width: 40, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            paginatedComments.some((row) => !row.IsBestComment)
                            && paginatedComments.filter((row) => !row.IsBestComment).every((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`))
                          }
                          aria-label="Pilih semua komentar"
                          onChange={() => {
                            const selectableRows = paginatedComments.filter((row) => !row.IsBestComment);
                            const allSelected = selectableRows.every((row) => selectedKeys.includes(`${row.ResponseId}-${row.QuestionId}`));
                            if (allSelected) {
                              const pageKeys = selectableRows.map((row) => `${row.ResponseId}-${row.QuestionId}`);
                              setSelectedKeys((prev) => prev.filter((k) => !pageKeys.includes(k)));
                            } else {
                              const pageKeys = selectableRows.map((row) => `${row.ResponseId}-${row.QuestionId}`);
                              setSelectedKeys((prev) => [...new Set([...prev, ...pageKeys])]);
                            }
                          }}
                        />
                      </th>
                    ) : null}
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortComments("respondent")}>
                      Responden{renderSortIconComments("respondent")}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortComments("application")}>
                      Aplikasi{renderSortIconComments("application")}
                    </th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col">Komentar</th>
                    <th scope="col" className={styles.sortableHeader} style={{ width: 70, textAlign: 'center' }} onClick={() => handleSortComments("score")}>
                      Score{renderSortIconComments("score")}
                    </th>
                    {canEdit ? <th scope="col" style={{ width: 90, textAlign: 'center' }}>Action</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {paginatedComments.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 7 : 5}>
                        <div className={baseStyles.emptyState}>
                          <div className={baseStyles.emptyIcon}>💬</div>
                          <div className={baseStyles.emptyText}>Belum ada komentar</div>
                          <div className={baseStyles.emptySubtext}>Data komentar akan muncul setelah filter diterapkan</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedComments.map((row) => {
                      const key = `${row.ResponseId}-${row.QuestionId}`;
                      const selected = selectedKeys.includes(key);
                      return (
                        <tr key={row.QuestionResponseId} style={selected ? { background: '#eff6ff' } : undefined}>
                          {canEdit ? (
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={selected}
                                aria-label={getCommentSelectionAriaLabel(row)}
                                disabled={row.IsBestComment}
                                onChange={(event) =>
                                  setSelectedKeys((prev) => {
                                    if (event.target.checked) return Array.from(new Set([...prev, key]));
                                    return prev.filter((item) => item !== key);
                                  })
                                }
                              />
                            </td>
                          ) : null}
                          <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.RespondentName || "-"}</td>
                          <td>{row.ApplicationName || "-"}</td>
                          <td style={{ maxWidth: 220, fontSize: 12 }}>{row.QuestionText || "-"}</td>
                          <td>
                            <button
                              type="button"
                              className={styles.link}
                              onClick={() =>
                                setModal({
                                  type: "detail",
                                  row: { question: row.QuestionText || "-", comment: row.CommentValue || "-" },
                                })
                              }
                            >
                              {shortText(row.CommentValue)}
                            </button>
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: typeof row.NumericValue === 'number' && row.NumericValue >= 4 ? '#15803d' : typeof row.NumericValue === 'number' && row.NumericValue <= 2 ? '#b91c1c' : '#374151' }}>{typeof row.NumericValue === "number" ? row.NumericValue : "-"}</td>
                          {canEdit ? (
                            <td style={{ textAlign: 'center' }}>
                              {row.IsBestComment ? (
                                <button type="button" className={styles.btnDanger} onClick={() => void removeBestComment(row)} style={{ fontSize: 11, padding: '5px 10px' }}>
                                  🚫 Unmark
                                </button>
                              ) : (
                                <span className={styles.meta}>-</span>
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
              currentPage={commentsPage}
              totalPages={commentsTotalPages}
              totalItems={sortedComments.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setCommentsPage}
            />
          </>
        ) : (
          <>
            <div className={styles.toolbar}>
              <span className={styles.meta}>Menampilkan {sortedBest.length} best comments</span>
            </div>

            {/* ── Pagination (Top) ── */}
            <Pagination
              instanceId="top"
              currentPage={bestPage}
              totalPages={bestTotalPages}
              totalItems={sortedBest.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setBestPage}
            />

            <div className={baseStyles.scTableWrap}>
              <table className={baseStyles.scTable}>
                <thead>
                  <tr>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortBest("respondent")}>
                      Responden{renderSortIconBest("respondent")}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortBest("application")}>
                      Aplikasi{renderSortIconBest("application")}
                    </th>
                    <th scope="col">Pertanyaan</th>
                    <th scope="col">Komentar</th>
                    <th scope="col" className={styles.sortableHeader} style={{ width: 70, textAlign: 'center' }} onClick={() => handleSortBest("score")}>
                      Score{renderSortIconBest("score")}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortBest("function")}>
                      Function{renderSortIconBest("function")}
                    </th>
                    <th scope="col" className={styles.sortableHeader} onClick={() => handleSortBest("itlead")}>
                      IT Lead{renderSortIconBest("itlead")}
                    </th>
                    <th scope="col">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBestRows.length === 0 ? (
                    <tr>
                      <td colSpan={8}>
                        <div className={baseStyles.emptyState}>
                          <div className={baseStyles.emptyIcon}>⭐</div>
                          <div className={baseStyles.emptyText}>Belum ada best comments</div>
                          <div className={baseStyles.emptySubtext}>Pilih komentar terbaik dari tab View Comments</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedBestRows.map((row, index) => (
                      <tr key={`${row.QuestionResponseId}-${index}`}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{row.RespondentName || "-"}</td>
                        <td>{row.ApplicationName || "-"}</td>
                        <td style={{ maxWidth: 220, fontSize: 12 }}>{row.QuestionText || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className={styles.link}
                            onClick={() =>
                              setModal({
                                type: "detail",
                                row: { question: row.QuestionText || "-", comment: row.CommentValue || "-" },
                              })
                            }
                          >
                            {shortText(row.CommentValue)}
                          </button>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: typeof row.NumericValue === 'number' && row.NumericValue >= 4 ? '#15803d' : typeof row.NumericValue === 'number' && row.NumericValue <= 2 ? '#b91c1c' : '#374151' }}>
                          {typeof row.NumericValue === "number" ? row.NumericValue : "-"}
                        </td>
                        <td>{row.FunctionName || "-"}</td>
                        <td>{row.ITLeadName || "-"}</td>
                        <td style={{ maxWidth: 320, fontSize: 12, lineHeight: 1.5 }}>{row.FeedbackText || "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Pagination (Bottom) ── */}
            <Pagination
              instanceId="bottom"
              currentPage={bestPage}
              totalPages={bestTotalPages}
              totalItems={sortedBest.length}
              itemsPerPage={pageSize}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              onPageChange={setBestPage}
            />
          </>
        )}
      </section>

      {modal.type !== "none" ? (
        <div className={baseStyles.modalOverlayV2} role="presentation" onClick={() => setModal({ type: "none" })}>
          <div className={baseStyles.modalCardV2} role="dialog" aria-modal="true" aria-labelledby="best-comments-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className={baseStyles.modalHeaderV2}>
              <div className={`${baseStyles.sectionIcon} ${baseStyles.iconPurple}`}>💬</div>
              <h2 id="best-comments-modal-title" className={baseStyles.modalTitleV2}>Detail Komentar</h2>
              <button type="button" className={baseStyles.modalCloseV2} onClick={() => setModal({ type: "none" })} aria-label="Tutup modal detail komentar">
                ✕
              </button>
            </div>
            <div className={baseStyles.modalBodyV2}>
              <div className={baseStyles.formGroup}>
                <label className={baseStyles.label}>Pertanyaan</label>
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0f172a', lineHeight: 1.6 }}>{modal.row.question}</div>
              </div>
              <div className={baseStyles.formGroup}>
                <label className={baseStyles.label}>Jawaban Responden</label>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#0f172a', lineHeight: 1.6 }}>{modal.row.comment}</div>
              </div>
            </div>
            <div className={baseStyles.modalFooterV2}>
              <button type="button" className={baseStyles.modalBtnCancel} onClick={() => setModal({ type: "none" })}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Toast Notifications ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  );
}

