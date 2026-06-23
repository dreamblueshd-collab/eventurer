"use client";

import { getCurrentUser, validateSession } from "@/lib/auth";
import {
  fetchReportSelectionList,
  fetchSurveyReport,
  type GeneratedReport,
  type ReportSelectionItem,
} from "@/lib/reports";
import type { UserRole } from "@/types/auth";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import styles from "./report-detail.module.css";
import {
  fmtScore,
  fmtTarget,
  formatDateTime,
  normalizeRole,
  resolveReportTitle,
  safeLabel,
  toNumber,
} from "./report-detail-utils";

type BuRow = {
  bu: string;
  respondentCount: number;
  score: number | null;
};

type FunctionScoreRow = {
  name: string;
  score: number | null;
};

type CriteriaRow = {
  criteria: string;
  score: number | null;
};

type AppScoreRow = {
  app: string;
  score: number;
};

type FunctionDetailRow = {
  functionName: string;
  detail: string;
  score: number;
  avgScore: number;
  rowSpan: number;
  isFirst: boolean;
  colorClass: string;
};


export default function ReportDetailPage() {
  const params = useParams<{ surveyId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const surveyId = String(params?.surveyId || "");
  const printMode = searchParams.get("print") === "pdf";
  const autoPrint = searchParams.get("autoprint") === "1";

  const [isMounted, setIsMounted] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const normalizedRole = normalizeRole(String(role || ""));
  const isSuperAdmin = normalizedRole === "superadmin";
  const isAdminEvent = normalizedRole === "adminevent";
  const isItLead = normalizedRole === "itlead";
  const isDepartmentHead = normalizedRole === "departmenthead";
  const canAccess = isSuperAdmin || isAdminEvent || isItLead || isDepartmentHead;

  useEffect(() => {
    setIsMounted(true);
    const checkAuth = async () => {
      let user = getCurrentUser();
      if (!user) {
        user = await validateSession();
      }
      setRole(user?.role ?? null);
      setAuthChecked(true);
    };
    checkAuth();
  }, []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [report, setReport] = useState<GeneratedReport | null>(null);
  const [surveyItem, setSurveyItem] = useState<ReportSelectionItem | null>(null);
  const [hasAutoPrinted, setHasAutoPrinted] = useState(false);

  useEffect(() => {
    if (!authChecked || !canAccess) {
      return;
    }

    let active = true;

    const run = async () => {
      if (!surveyId) {
        if (!active) return;
        setReport(null);
        setSurveyItem(null);
        setError("Survey ID tidak valid.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const selectionResult = await fetchReportSelectionList();
        if (!active) return;

        if (selectionResult.success) {
          const currentSurvey = selectionResult.surveys.find((item) => item.surveyId === surveyId) || null;
          setSurveyItem(currentSurvey);
          if (currentSurvey && !currentSurvey.hasGeneratedReport) {
            setReport(null);
            setError("Report belum digenerate untuk event ini.");
            return;
          }
        } else {
          setSurveyItem(null);
        }

        const reportResult = await fetchSurveyReport({
          surveyId,
          includeTakenOut: false,
        });
        if (!active) return;

        if (!reportResult.success || !reportResult.report) {
          setReport(null);
          setError(reportResult.message || "Gagal memuat report.");
          return;
        }

        setReport(reportResult.report);
      } catch {
        if (!active) return;
        setReport(null);
        setSurveyItem(null);
        setError("Terjadi kesalahan saat memuat report.");
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
  }, [canAccess, authChecked, surveyId]);

  useEffect(() => {
    if (!printMode || !autoPrint || hasAutoPrinted || loading || error || !report) {
      return;
    }
    const timer = window.setTimeout(() => {
      window.print();
      setHasAutoPrinted(true);
    }, 350);
    return () => window.clearTimeout(timer);
  }, [autoPrint, error, hasAutoPrinted, loading, printMode, report]);

  useEffect(() => {
    if (!printMode) {
      return;
    }

    const previousTitle = document.title;
    const nextTitle = safeLabel(resolveReportTitle(report?.survey?.title, surveyItem), "Report");
    document.title = `${nextTitle} - Report`;

    return () => {
      document.title = previousTitle;
    };
  }, [printMode, report?.survey?.title, surveyItem]);

  const numericRows = useMemo(() => {
    if (!report) return [] as Array<GeneratedReport["responses"][number] & { score: number }>;
    return report.responses
      .map((row) => {
        const score = toNumber(row.NumericValue);
        return score === null ? null : { ...row, score };
      })
      .filter((row): row is GeneratedReport["responses"][number] & { score: number } => row !== null);
  }, [report]);

  const respondentByBu = useMemo(() => {
    if (!report) return [] as BuRow[];
    const map = new Map<string, { respondents: Set<string>; scores: number[] }>();
    report.responses.forEach((row) => {
      const key = safeLabel(row.BusinessUnitName);
      if (!map.has(key)) map.set(key, { respondents: new Set<string>(), scores: [] });
      const group = map.get(key);
      if (!group) return;
      if (row.ResponseId) group.respondents.add(row.ResponseId);
      const num = toNumber(row.NumericValue);
      if (num !== null) group.scores.push(num);
    });
    return [...map.entries()]
      .map(([bu, group]) => ({
        bu,
        respondentCount: group.respondents.size,
        score: group.scores.length ? group.scores.reduce((sum, n) => sum + n, 0) / group.scores.length : null,
      }))
      .sort((a, b) => b.respondentCount - a.respondentCount);
  }, [report]);

  const targetScore = useMemo(() => {
    if (!report) return null;
    if (typeof report.statistics.averageRating === "number") return report.statistics.averageRating;
    if (!numericRows.length) return null;
    return numericRows.reduce((sum, item) => sum + item.score, 0) / numericRows.length;
  }, [numericRows, report]);

  const yearlyScores = useMemo(() => {
    const bucket = new Map<number, number[]>();
    numericRows.forEach((row) => {
      const date = new Date(row.SubmittedAt || "");
      const year = Number.isNaN(date.getTime()) ? null : date.getFullYear();
      if (!year) return;
      if (!bucket.has(year)) bucket.set(year, []);
      const values = bucket.get(year);
      if (values) values.push(row.score);
    });

    // Get all years from data, fallback to last 3 years if no data
    const dataYears = [...bucket.keys()].sort();
    const currentYear = new Date().getFullYear();
    const displayYears = dataYears.length > 0
      ? dataYears.slice(-3)
      : [currentYear - 2, currentYear - 1, currentYear];

    return displayYears.map((year) => {
      const values = bucket.get(year) || [];
      return { year, score: values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : null };
    });
  }, [numericRows]);

  const functionScores = useMemo(() => {
    const map = new Map<string, number[]>();
    numericRows.forEach((row) => {
      const key = safeLabel(row.FunctionName || row.ApplicationName, "General");
      if (!map.has(key)) map.set(key, []);
      const values = map.get(key);
      if (values) values.push(row.score);
    });
    return [...map.entries()]
      .map(([name, values]) => ({ name, score: values.reduce((sum, n) => sum + n, 0) / values.length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12) as FunctionScoreRow[];
  }, [numericRows]);

  const criteriaScores = useMemo(() => {
    const byKeyword = new Map<string, number[]>();
    numericRows.forEach((row) => {
      const prompt = safeLabel(row.PromptText, "").toLowerCase();
      const score = row.score;
      if (prompt.includes("response")) {
        if (!byKeyword.has("Responses")) byKeyword.set("Responses", []);
        const values = byKeyword.get("Responses");
        if (values) values.push(score);
      }
      if (prompt.includes("resolution")) {
        if (!byKeyword.has("Resolution")) byKeyword.set("Resolution", []);
        const values = byKeyword.get("Resolution");
        if (values) values.push(score);
      }
    });

    const list: CriteriaRow[] = [];
    const responseValues = byKeyword.get("Responses") || [];
    const resolutionValues = byKeyword.get("Resolution") || [];
    list.push({
      criteria: "Responses",
      score: responseValues.length ? responseValues.reduce((sum, n) => sum + n, 0) / responseValues.length : null,
    });
    list.push({
      criteria: "Resolution",
      score: resolutionValues.length ? resolutionValues.reduce((sum, n) => sum + n, 0) / resolutionValues.length : null,
    });
    return list;
  }, [numericRows]);

  const appScores = useMemo(() => {
    const map = new Map<string, number[]>();
    numericRows.forEach((row) => {
      const key = safeLabel(row.ApplicationName, "General");
      if (!map.has(key)) map.set(key, []);
      const values = map.get(key);
      if (values) values.push(row.score);
    });
    return [...map.entries()]
      .map(([app, values]) => ({ app, score: values.reduce((sum, n) => sum + n, 0) / values.length }))
      .sort((a, b) => a.app.localeCompare(b.app)) as AppScoreRow[];
  }, [numericRows]);

  const chartMeta = useMemo(() => {
    if (!appScores.length) {
      return { min: 7.6, max: 9.2, span: 1.6, ticks: [9.2, 9.0, 8.8, 8.6, 8.4, 8.2, 8.0, 7.8, 7.6] };
    }
    const localMin = Math.min(...appScores.map((item) => item.score));
    const localMax = Math.max(...appScores.map((item) => item.score));
    const min = Math.min(7.6, Math.floor((localMin - 0.2) * 10) / 10);
    const max = Math.max(9.2, Math.ceil((localMax + 0.2) * 10) / 10);
    const span = Math.max(0.1, max - min);
    const step = span / 8;
    const ticks = Array.from({ length: 9 }).map((_, index) => Number((max - index * step).toFixed(2)));
    return { min, max, span, ticks };
  }, [appScores]);

  const functionDetailRows = useMemo(() => {
    const grouped = new Map<string, { entries: Array<{ detail: string; score: number }>; avg: number }>();
    const buffer = new Map<string, number[]>();

    numericRows.forEach((row) => {
      const functionName = safeLabel(row.FunctionName || row.ApplicationName, "General");
      const detail = safeLabel(row.PromptText, "Question");
      const score = row.score;
      if (!grouped.has(functionName)) grouped.set(functionName, { entries: [], avg: 0 });
      const block = grouped.get(functionName);
      if (block) block.entries.push({ detail, score });
      if (!buffer.has(functionName)) buffer.set(functionName, []);
      const values = buffer.get(functionName);
      if (values) values.push(score);
    });

    grouped.forEach((value, key) => {
      const values = buffer.get(key) || [];
      value.avg = values.length ? values.reduce((sum, n) => sum + n, 0) / values.length : 0;
    });

    const palette = ["rowToneA", "rowToneB", "rowToneC", "rowToneD"];
    const sorted = [...grouped.entries()].sort((a, b) => b[1].avg - a[1].avg);
    const rows: FunctionDetailRow[] = [];
    sorted.forEach(([functionName, block], index) => {
      const colorClass = palette[index % palette.length];
      block.entries.forEach((entry, entryIndex) => {
        rows.push({
          functionName,
          detail: entry.detail,
          score: entry.score,
          avgScore: block.avg,
          rowSpan: block.entries.length,
          isFirst: entryIndex === 0,
          colorClass,
        });
      });
    });
    return rows;
  }, [numericRows]);

  const topScoreSummary = useMemo(() => {
    if (!appScores.length) return { highestApp: "", highestScore: null, highestBu: "", highestBuScore: null };
    const topApp = [...appScores].sort((a, b) => b.score - a.score)[0];
    const topBu = [...respondentByBu].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    return {
      highestApp: topApp?.app || "",
      highestScore: topApp?.score ?? null,
      highestBu: topBu?.bu || "",
      highestBuScore: topBu?.score ?? null,
    };
  }, [appScores, respondentByBu]);

  const percentChange = useMemo(() => {
    if (yearlyScores.length < 2) return "";
    const first = yearlyScores[0]?.score;
    const last = yearlyScores[yearlyScores.length - 1]?.score;
    if (first === null || first === undefined || first === 0 || last === null || last === undefined) return "";
    const value = ((last - first) / first) * 100;
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  }, [yearlyScores]);

  if (!isMounted || !authChecked) {
    return (
      <section className={`${styles.pageShell} ${printMode ? styles.printMode : ""}`}>
        <div className={styles.pageFrame}>
          <h1 className={styles.titleBanner}>Memuat report...</h1>
        </div>
      </section>
    );
  }

  if (!canAccess) {
    return (
      <section className={styles.pageShell}>
        <h1 className={styles.reportErrorTitle}>Akses Ditolak</h1>
        <p className={styles.reportErrorText}>Role Anda tidak memiliki akses ke halaman report.</p>
      </section>
    );
  }

  return (
    <>
      <section className={styles.pageShell}>
        <div className={styles.pageFrame}>
          <h1 className={styles.titleBanner}>
            {resolveReportTitle(report?.survey?.title, surveyItem)}
          </h1>

          {loading ? <p className={styles.loadingText}>Memuat report detail...</p> : null}
          {error ? <p className={styles.errorText}>{error}</p> : null}

          {!loading && report ? (
            <>
              <div className={styles.topGrid}>
                <section className={styles.panel}>
                  <div className={styles.sectionTitle}>
                    <span>Respondent</span>
                    <span className={styles.targetBadge}>Target: {report.statistics.uniqueRespondents}</span>
                  </div>
                  <div className={styles.innerBlock}>
                    <div className={styles.innerCaption}>Data Respondent</div>
                    <div className={styles.tableWrap}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>No</th>
                            <th>BU</th>
                            <th>Respondent</th>
                            <th>Score</th>
                          </tr>
                        </thead>
                        <tbody>
                          {respondentByBu.length === 0 ? (
                            <tr>
                              <td colSpan={4}>Belum ada data response</td>
                            </tr>
                          ) : (
                            respondentByBu.map((row, index) => (
                              <tr key={`bu-row-${row.bu}-${index}`}>
                                <td>{index + 1}</td>
                                <td>{row.bu}</td>
                                <td>{row.respondentCount}</td>
                                <td>{fmtScore(row.score)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    <p className={styles.footnote}>
                      * The highest respondent came from {topScoreSummary.highestBu || "-"} BU ({respondentByBu[0]?.respondentCount || 0}).
                    </p>
                  </div>
                </section>

                <section className={`${styles.panel} ${styles.panelRight}`}>
                  <div className={styles.sectionTitle}>
                    <span>Target: {fmtTarget(targetScore)}</span>
                    <span className={`${styles.targetBadge} ${styles.scoreBadge}`}>Score</span>
                  </div>
                  <div className={styles.innerBlock}>
                    <div className={styles.metaStrip}>
                      <span>Periode: {safeLabel(surveyItem?.period)}</span>
                      <span>Generated: {formatDateTime(surveyItem?.generatedAt) || "-"}</span>
                      <span>Source: Final Approved Response</span>
                    </div>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th>Score</th>
                          {yearlyScores.map((item) => (
                            <th key={`year-head-${item.year}`}>{item.year}</th>
                          ))}
                          <th>% Change</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>Target</td>
                          {yearlyScores.map((item) => (
                            <td key={`year-val-${item.year}`}>{fmtScore(item.score)}</td>
                          ))}
                          <td>{percentChange}</td>
                        </tr>
                      </tbody>
                    </table>

                    <div className={styles.subGrid}>
                      <div className={styles.tableWrap}>
                        <table className={styles.table}>
                          <thead>
                            <tr>
                              <th>Function</th>
                              <th>Target</th>
                              <th>Score</th>
                            </tr>
                          </thead>
                          <tbody>
                            {functionScores.length === 0 ? (
                              <tr>
                                <td colSpan={3}>Belum ada data</td>
                              </tr>
                            ) : (
                              functionScores.map((item, index) => (
                                <tr key={`function-score-${item.name}-${index}`}>
                                  <td>{item.name}</td>
                                  <td>{fmtTarget(targetScore)}</td>
                                  <td>{fmtScore(item.score)}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>

                      <div className={styles.criteriaWrap}>
                        <div className={styles.tableWrap}>
                          <table className={styles.table}>
                            <thead>
                              <tr>
                                <th>Criteria</th>
                                <th>Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              {criteriaScores.map((item, index) => (
                                <tr key={`criteria-${item.criteria}-${index}`}>
                                  <td>{item.criteria}</td>
                                  <td>{fmtScore(item.score)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className={styles.scoreBox}>
                          Pada hasil akhir CSI, <strong>{topScoreSummary.highestApp || ""}</strong>
                          {topScoreSummary.highestScore !== null ? (
                            <>
                              {" "}meraih skor tertinggi <strong>{fmtScore(topScoreSummary.highestScore)}</strong>
                            </>
                          ) : null}
                          {topScoreSummary.highestApp && topScoreSummary.highestBu ? ", dan " : ""}
                          {topScoreSummary.highestBu ? (
                            <>
                              <strong>{topScoreSummary.highestBu}</strong>
                              {topScoreSummary.highestBuScore !== null ? (
                                <>
                                  {" "}meraih skor tertinggi <strong>{fmtScore(topScoreSummary.highestBuScore)}</strong>
                                </>
                              ) : null}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>

              <section className={styles.fullPanel}>
                <div className={`${styles.sectionTitle} ${styles.sectionTitleCenter}`}>
                  <span>Target: {fmtTarget(targetScore)}</span>
                </div>
                <div className={styles.chartTitle}>Applications Score</div>
                <div className={styles.chartWrap}>
                  <div className={styles.chartFrame}>
                    <div className={styles.chartY}>
                      {chartMeta.ticks.map((tick, index) => (
                        <div key={`tick-${index}`} className={styles.chartYLine} style={{ top: `${(index / 8) * 100}%` }}>
                          {tick.toFixed(2)}
                        </div>
                      ))}
                    </div>
                    <div className={styles.chartArea}>
                      {targetScore !== null ? (
                        <div
                          className={styles.targetLine}
                          style={{ top: `${((chartMeta.max - targetScore) / chartMeta.span) * 100}%` }}
                        />
                      ) : null}
                      <div className={styles.chartBars}>
                        {appScores.length === 0 ? (
                          <p className={styles.noData}>Belum ada data aplikasi.</p>
                        ) : (
                          appScores.map((item, index) => {
                            const height = ((item.score - chartMeta.min) / chartMeta.span) * 260;
                            const isAboveTarget = targetScore === null ? false : item.score >= targetScore;
                            return (
                              <div key={`app-score-${item.app}-${index}`} className={styles.barItem}>
                                <div
                                  className={`${styles.bar} ${isAboveTarget ? styles.barGreen : styles.barYellow}`}
                                  style={{ height: `${Math.max(2, height)}px` }}
                                />
                                <div className={styles.barLabel}>{item.app}</div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                  <div className={styles.legend}>
                    <span><i className={`${styles.legendSwatch} ${styles.legendScore}`} />Score</span>
                    <span><i className={`${styles.legendSwatch} ${styles.legendTarget}`} />Target</span>
                  </div>
                </div>

                <h3 className={styles.functionHeading}>Function Detail &amp; Score</h3>
                <div className={styles.tableWrap}>
                  <table className={styles.tableDetail}>
                    <thead>
                      <tr>
                        <th>Function</th>
                        <th>Detail</th>
                        <th>Score</th>
                        <th>Average</th>
                      </tr>
                    </thead>
                    <tbody>
                      {functionDetailRows.length === 0 ? (
                        <tr>
                          <td colSpan={4}>Belum ada data function detail</td>
                        </tr>
                      ) : (
                        functionDetailRows.map((row, index) => (
                          <tr key={`${row.functionName}-${row.detail}-${index}`} className={styles[row.colorClass]}>
                            {row.isFirst ? <td rowSpan={row.rowSpan} className={styles.cellFunction}>{row.functionName}</td> : null}
                            <td>{row.detail}</td>
                            <td className={styles.centerCell}>{fmtScore(row.score)}</td>
                            {row.isFirst ? <td rowSpan={row.rowSpan} className={styles.centerCell}>{fmtScore(row.avgScore)}</td> : null}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <div className={`${styles.actionRow} ${printMode ? styles.screenOnly : ""}`}>
                  <button type="button" className={styles.actionGhost} onClick={() => router.push("/admin/report")}>
                    Home
                  </button>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </>
  );
}

