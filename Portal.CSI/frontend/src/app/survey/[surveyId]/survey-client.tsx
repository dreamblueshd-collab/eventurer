"use client";

/* eslint-disable @next/next/no-img-element */

import SurveyPreviewElement from "@/components/survey/survey-preview-element";
import type { FunctionMaster } from "@/lib/master-data";
import type { BusinessUnitOption, DepartmentOption, DivisionOption } from "@/lib/org-hierarchy";
import {
  checkDuplicatePublicResponse,
  fetchPublicApplications,
  fetchPublicMasterData,
  fetchPublicSurveyForm,
  type PublicSurveyForm,
  submitPublicSurveyResponse,
} from "@/lib/public-survey";
import { resolveEventStatus } from "@/lib/event-status";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import styles from "./survey-public.module.css";

/** Convert logoPositionX/Y to CSS inline style for logo overlay placement */
function getLogoPlacementInlineStyle(x: number, y: number): React.CSSProperties {
  const style: React.CSSProperties = { position: "absolute", zIndex: 10, background: "rgba(255,255,255,0.92)", borderRadius: "6px", padding: "4px 8px", pointerEvents: "none" };
  if (y <= 25) { style.top = "10px"; } else { style.bottom = "10px"; }
  if (x <= 25) { style.left = "10px"; }
  else if (x >= 75) { style.right = "10px"; }
  else { style.left = "50%"; style.transform = "translateX(-50%)"; }
  return style;
}
import {
  SurveyAlreadySubmitted,
  SurveyError,
  SurveyLoading,
  SurveyNotFound,
  SurveySuccess,
} from "./survey-form-states";
import {
  buildRenderedQuestionsForPage,
  buildResponseValue,
  getInitialRespondent,
  getRenderedPageGroups,
  hasResponseValue,
  isConditionallyRequired,
  normalizeQuestion,
  type ApplicationSelection,
  type RenderedQuestion,
} from "./survey-utils";

type MasterDataState = {
  businessUnits: BusinessUnitOption[];
  divisions: DivisionOption[];
  departments: DepartmentOption[];
  functions: FunctionMaster[];
};

export default function SurveyClient({ surveyId }: { surveyId: string }) {
  const [form, setForm] = useState<PublicSurveyForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [commentValues, setCommentValues] = useState<Record<string, string>>({});
  const [masterData, setMasterData] = useState<MasterDataState>({
    businessUnits: [],
    divisions: [],
    departments: [],
    functions: [],
  });
  const [mappedApplicationsByDepartment, setMappedApplicationsByDepartment] = useState<string[]>([]);
  const [mappedApplicationsByFunction, setMappedApplicationsByFunction] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // ─── Data Fetching ──────────────────────────────────────────────────

  useEffect(() => {
    try {
      const submittedAt = localStorage.getItem(`csi.submitted.${surveyId}`);
      if (submittedAt) {
        setAlreadySubmitted(true);
        setLoading(false);
        return;
      }
    } catch { /* SSR / incognito */ }

    const run = async () => {
      const [formResult, masterResult] = await Promise.all([
        fetchPublicSurveyForm(surveyId),
        fetchPublicMasterData(),
      ]);
      setLoading(false);

      if (!formResult.success || !formResult.form) {
        setError(formResult.message || "Survey tidak ditemukan atau sudah tidak aktif");
        return;
      }

      setForm(formResult.form);
      if (masterResult.success) {
        setMasterData({
          businessUnits: masterResult.data.businessUnits.map((item) => ({
            BusinessUnitId: Number(item.id || 0),
            Name: item.name,
            IsActive: true,
          })),
          divisions: masterResult.data.divisions.map((item) => ({
            DivisionId: Number(item.id || 0),
            BusinessUnitId: Number(item.parentId || 0),
            Name: item.name,
            IsActive: true,
          })),
          departments: masterResult.data.departments.map((item) => ({
            DepartmentId: Number(item.id || 0),
            DivisionId: Number(item.parentId || 0),
            Name: item.name,
            IsActive: true,
          })),
          functions: masterResult.data.functions.map((item) => ({
            FunctionId: Number(item.id || 0),
            Code: 0,
            Name: item.name,
            IsActive: true,
          })),
        });
      }
    };

    void run();
  }, [surveyId]);

  // ─── Computed ─────────────────────────────────────────────────────────

  const pageGroups = useMemo(() => getRenderedPageGroups(form), [form]);
  const currentPage = pageGroups[currentPageIndex] || null;
  const allElements = useMemo(
    () => pageGroups.flatMap((page) => page.questions.map(normalizeQuestion)),
    [pageGroups],
  );

  // ─── BU Dependency: Auto-fill for non-Corporate ─────────────────────

  useEffect(() => {
    const buElement = allElements.find((item) => item.dataSource === "bu");
    const divisionElement = allElements.find((item) => item.dataSource === "division");
    const departmentElement = allElements.find((item) => item.dataSource === "department");

    if (!buElement || !divisionElement || !departmentElement) return;

    const selectedBuId = String(values[buElement.id] || "");
    if (!selectedBuId) return;

    const selectedBU = masterData.businessUnits.find(bu => String(bu.BusinessUnitId) === selectedBuId);
    if (!selectedBU) return;

    const isCorporateHO = selectedBU.Name.toLowerCase().includes("corporate") &&
                          selectedBU.Name.toLowerCase().includes("ho");

    if (!isCorporateHO) {
      const buDivisions = masterData.divisions.filter(div => Number(div.BusinessUnitId) === Number(selectedBU.BusinessUnitId));
      const divisionIds = buDivisions.map(div => div.DivisionId);
      const hasDepartmentData = masterData.departments.some(dept => divisionIds.includes(dept.DivisionId));

      if (buDivisions.length === 0 || !hasDepartmentData) {
        const currentDivisionValue = values[divisionElement.id];
        const currentDepartmentValue = values[departmentElement.id];
        const fakeId = `auto-${selectedBU.BusinessUnitId}`;

        if (!currentDivisionValue || !currentDepartmentValue) {
          setValues(prev => ({
            ...prev,
            [divisionElement.id]: fakeId,
            [departmentElement.id]: fakeId,
          }));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allElements, masterData.businessUnits, masterData.divisions, masterData.departments, values[allElements.find((item) => item.dataSource === "bu")?.id || ""]]);

  // ─── Application Mapping Fetch ──────────────────────────────────────

  useEffect(() => {
    const departmentElement = allElements.find((item) => item.dataSource === "department");
    const functionElement = allElements.find((item) => item.dataSource === "function");
    const departmentId = departmentElement ? String(values[departmentElement.id] || "") : "";
    const functionId = functionElement ? String(values[functionElement.id] || "") : "";

    const run = async () => {
      if (departmentId && !departmentId.startsWith("auto-")) {
        const result = await fetchPublicApplications(surveyId, { departmentId });
        setMappedApplicationsByDepartment(result.success ? result.applications.map((item) => item.name) : []);
      } else {
        setMappedApplicationsByDepartment([]);
      }

      if (functionId && !functionId.startsWith("auto-")) {
        const result = await fetchPublicApplications(surveyId, { functionId });
        setMappedApplicationsByFunction(result.success ? result.applications.map((item) => item.name) : []);
      } else {
        setMappedApplicationsByFunction([]);
      }
    };

    void run();
  }, [allElements, surveyId, values]);

  // ─── Derived Values ─────────────────────────────────────────────────

  const progressPercent = pageGroups.length === 0 ? 0 : ((currentPageIndex + 1) / pageGroups.length) * 100;
  const effectiveStatus = form ? resolveEventStatus({ Status: form.status, StartDate: form.startDate || "", EndDate: form.endDate || "" }) : "-";
  const showProgress = form?.configuration?.showProgressBar !== false && pageGroups.length > 1;
  const showPageNumbers = form?.configuration?.showPageNumbers !== false && pageGroups.length > 1;

  const heroTitle = form?.configuration?.heroTitle || form?.title || "Survey";
  const heroSubtitle = form?.configuration?.heroSubtitle || form?.description || "";
  const heroCoverQuestion = form?.questions.find((q) => q.type === "HeroCover");
  const heroImageUrl = form?.configuration?.heroImageUrl || heroCoverQuestion?.imageUrl || "";
  const logoUrl = form?.configuration?.logoUrl || "/assets/img/logo.png";
  const logoPosX = form?.configuration?.logoPositionX ?? 50;
  const logoPosY = form?.configuration?.logoPositionY ?? 50;
  const primaryColor = form?.configuration?.primaryColor || "#125ba1";
  const secondaryColor = form?.configuration?.secondaryColor || "#2c8dd8";
  const buttonStyle = form?.configuration?.buttonStyle || "rounded";

  const renderedQuestions = useMemo<RenderedQuestion[]>(
    () => buildRenderedQuestionsForPage(currentPage, values),
    [currentPage, values],
  );
  const allRenderedQuestions = useMemo(
    () => pageGroups.flatMap((page) => buildRenderedQuestionsForPage(page, values)),
    [pageGroups, values],
  );

  const filteredOrgData = useMemo(() => {
    const buElement = allElements.find((item) => item.dataSource === "bu");
    const selectedBuId = buElement ? String(values[buElement.id] || "") : "";

    if (!selectedBuId) return { businessUnits: masterData.businessUnits, divisions: masterData.divisions, departments: masterData.departments, functions: masterData.functions };

    const selectedBU = masterData.businessUnits.find(bu => String(bu.BusinessUnitId) === selectedBuId);
    if (!selectedBU) return { businessUnits: masterData.businessUnits, divisions: masterData.divisions, departments: masterData.departments, functions: masterData.functions };

    const isCorporateHO = selectedBU.Name.toLowerCase().includes("corporate") && selectedBU.Name.toLowerCase().includes("ho");
    const filteredDivisions = masterData.divisions.filter(div => Number(div.BusinessUnitId) === Number(selectedBU.BusinessUnitId));
    const divisionIds = filteredDivisions.map(div => div.DivisionId);
    const filteredDepartments = masterData.departments.filter(dept => divisionIds.includes(dept.DivisionId));

    if (!isCorporateHO && (filteredDivisions.length === 0 || filteredDepartments.length === 0)) {
      const fakeDivision = { DivisionId: `auto-${selectedBU.BusinessUnitId}`, BusinessUnitId: selectedBU.BusinessUnitId, Code: 0, Name: selectedBU.Name, IsActive: true };
      const fakeDepartment = { DepartmentId: `auto-${selectedBU.BusinessUnitId}`, DivisionId: `auto-${selectedBU.BusinessUnitId}`, Code: 0, Name: selectedBU.Name, IsActive: true };
      return {
        businessUnits: masterData.businessUnits,
        divisions: filteredDivisions.length === 0 ? [fakeDivision] : filteredDivisions,
        departments: filteredDepartments.length === 0 ? [fakeDepartment] : filteredDepartments,
        functions: masterData.functions,
      };
    }

    return { businessUnits: masterData.businessUnits, divisions: filteredDivisions, departments: filteredDepartments, functions: masterData.functions };
  }, [allElements, masterData, values]);

  // ─── Handlers ─────────────────────────────────────────────────────────

  const toggleCheckbox = (id: string, option: string) => {
    setValues((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      return { ...prev, [id]: next };
    });
  };

  const validatePage = (
    page: (typeof pageGroups)[number],
    currentValues: Record<string, unknown>,
    currentCommentValues: Record<string, string>,
  ): Record<string, string> => {
    const pageErrors: Record<string, string> = {};
    const pageRenderedQuestions = buildRenderedQuestionsForPage(page, currentValues);
    pageRenderedQuestions.forEach(({ element }) => {
      const required = element.required || isConditionallyRequired(element, currentValues);
      if (!required || element.type === "hero") return;
      const responseValue = buildResponseValue(element, currentValues, currentCommentValues);
      if (!hasResponseValue(responseValue)) {
        pageErrors[element.id] = "Field ini wajib diisi.";
      }

      if (element.type === "likert" && element.likertEnableComment !== false) {
        const rawOptions = element.options;
        const lastItem = rawOptions[rawOptions.length - 1];
        const lastAsNum = Number(lastItem);
        const hasScaleAtEnd = rawOptions.length > 0 && Number.isFinite(lastAsNum) && lastAsNum >= 1 && lastAsNum <= 10 && String(Math.round(lastAsNum)) === String(lastItem);
        const rows = hasScaleAtEnd ? rawOptions.slice(0, -1) : rawOptions;
        const commentThreshold = Math.max(1, Math.round(Number(element.conditionalRequiredThreshold || 7)));

        rows.forEach((_, rowIdx) => {
          const rowKey = `${element.id}-${rowIdx}`;
          const commentKey = `${element.id}-comment-${rowIdx}`;
          const selectedVal = Number(currentValues[rowKey] || 0);
          if (selectedVal > 0 && selectedVal < commentThreshold) {
            const comment = String(currentValues[commentKey] || "").trim();
            if (!comment) {
              pageErrors[commentKey] = `Komentar wajib diisi jika nilai < ${commentThreshold}.`;
            }
          }
        });
      }
    });
    return pageErrors;
  };

  const validateCurrentPage = (): boolean => {
    const nextErrors = validatePage(currentPage!, values, commentValues);
    setValidationErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resolveSelectedApplications = async (): Promise<ApplicationSelection[]> => {
    const appElements = allElements.filter((item) => item.dataSource === "app_department" || item.dataSource === "app_function");
    const selectedNames = appElements.flatMap((element) => {
      const value = values[element.id];
      if (Array.isArray(value)) return value.map((item) => String(item));
      return String(value || "").trim() ? [String(value)] : [];
    });

    const selectedSet = new Set(selectedNames.map((item) => item.trim().toLowerCase()).filter(Boolean));
    if (selectedSet.size === 0) {
      const fallback = await fetchPublicApplications(surveyId);
      return fallback.success ? fallback.applications.slice(0, 1) : [];
    }

    const [allApps, deptApps, fnApps] = await Promise.all([
      fetchPublicApplications(surveyId),
      mappedApplicationsByDepartment.length > 0 ? fetchPublicApplications(surveyId, {
        departmentId: String(values[allElements.find((item) => item.dataSource === "department")?.id || ""] || ""),
      }) : Promise.resolve({ success: true, applications: [] as Array<{ id: string; name: string }> }),
      mappedApplicationsByFunction.length > 0 ? fetchPublicApplications(surveyId, {
        functionId: String(values[allElements.find((item) => item.dataSource === "function")?.id || ""] || ""),
      }) : Promise.resolve({ success: true, applications: [] as Array<{ id: string; name: string }> }),
    ]);
    const candidates = [...allApps.applications, ...deptApps.applications, ...fnApps.applications];
    const unique = new Map<string, ApplicationSelection>();
    candidates.forEach((item) => {
      if (selectedSet.has(item.name.trim().toLowerCase())) {
        unique.set(item.id, { id: item.id, name: item.name });
      }
    });
    return [...unique.values()];
  };

  const buildSubmissionResponses = (applicationName: string) => {
    const mappedSelector = allElements.find((item) => item.dataSource === "app_department" || item.dataSource === "app_function");
    const currentValues: Record<string, unknown> = mappedSelector ? { ...values, [mappedSelector.id]: applicationName } : values;

    return allRenderedQuestions
      .filter((entry) => !entry.applicationName || entry.applicationName === applicationName)
      .filter((entry) => entry.element.type !== "hero")
      .map((entry) => ({
        questionId: entry.baseQuestionId,
        value: buildResponseValue(entry.element, currentValues, commentValues),
      }))
      .filter((item) => hasResponseValue(item.value));
  };

  const handleSubmit = async () => {
    setError("");
    setMessage("");
    if (!form) return;

    // Validate all pages before submitting (not just the current one)
    const allPageErrors: Record<string, string> = {};
    for (const page of pageGroups) {
      const pageErrors = validatePage(page, values, commentValues);
      Object.assign(allPageErrors, pageErrors);
    }
    if (Object.keys(allPageErrors).length > 0) {
      // Navigate to the first page that has an error
      const firstErrorKey = Object.keys(allPageErrors)[0];
      const firstErrorPageIndex = pageGroups.findIndex((page) =>
        buildRenderedQuestionsForPage(page, values).some(({ element }) => element.id === firstErrorKey || `${element.id}-comment-0` === firstErrorKey || firstErrorKey.startsWith(`${element.id}-`))
      );
      if (firstErrorPageIndex !== -1) setCurrentPageIndex(firstErrorPageIndex);
      setValidationErrors(allPageErrors);
      return;
    }

    setSaving(true);
    const respondent = typeof window === "undefined"
      ? { name: "Bapak/Ibu Responden", email: "" }
      : getInitialRespondent(surveyId, new URLSearchParams(window.location.search));
    const selectedApplications = await resolveSelectedApplications();
    if (selectedApplications.length === 0) {
      setSaving(false);
      setError("Pilih minimal satu aplikasi sebelum submit survey.");
      return;
    }

    if (respondent.email) {
      const duplicateResult = await checkDuplicatePublicResponse({
        surveyId: form.surveyId,
        email: respondent.email,
        applicationIds: selectedApplications.map((item) => item.id),
      });
      if (!duplicateResult.success) {
        setSaving(false);
        setError(duplicateResult.message || "Gagal memeriksa duplikasi response.");
        return;
      }
      if (duplicateResult.isDuplicate) {
        setSaving(false);
        setError(duplicateResult.message || "Anda sudah mengirim response untuk aplikasi ini.");
        return;
      }
    }

    for (const application of selectedApplications) {
      // Filter out auto-generated org IDs (e.g. "auto-1")
      const rawBuId = String(values[allElements.find((item) => item.dataSource === "bu")?.id || ""] || "");
      const rawDivId = String(values[allElements.find((item) => item.dataSource === "division")?.id || ""] || "");
      const rawDeptId = String(values[allElements.find((item) => item.dataSource === "department")?.id || ""] || "");

      const result = await submitPublicSurveyResponse({
        surveyId: form.surveyId,
        respondent: {
          name: respondent.name,
          email: respondent.email,
          businessUnitId: /^\d+$/.test(rawBuId) ? rawBuId : null,
          divisionId: /^\d+$/.test(rawDivId) ? rawDivId : null,
          departmentId: /^\d+$/.test(rawDeptId) ? rawDeptId : null,
        },
        selectedApplicationIds: [application.id],
        responses: buildSubmissionResponses(application.name),
      });

      if (!result.success) {
        // Server-side duplicate detection — treat as already submitted
        if (
          result.message?.toLowerCase().includes('sudah') ||
          result.message?.toLowerCase().includes('duplicate') ||
          (result as Record<string, unknown>).duplicate === true
        ) {
          try { localStorage.setItem(`csi.submitted.${surveyId}`, '1'); } catch { /* ignore */ }
          setSubmitted(true);
          setSaving(false);
          return;
        }
        setSaving(false);
        setError(result.message || `Gagal mengirim response survey untuk aplikasi ${application.name}.`);
        return;
      }
    }

    setSaving(false);
    setMessage("Response berhasil dikirim. Terima kasih atas partisipasi Anda.");
    setSubmitted(true);
    setCurrentPageIndex(0);
    setValidationErrors({});

    try { localStorage.setItem(`csi.submitted.${surveyId}`, Date.now().toString()); } catch { /* ignore */ }
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ─── Terminal States ──────────────────────────────────────────────────

  if (loading) return <SurveyLoading />;
  if (alreadySubmitted) return <SurveyAlreadySubmitted />;
  if (error && !form) return <SurveyError message={error} />;
  if (!form || !currentPage) return <SurveyNotFound />;

  const pageStyle = {
    "--survey-primary": primaryColor,
    "--survey-secondary": secondaryColor,
    backgroundColor: form.configuration?.backgroundColor || undefined,
    backgroundImage: form.configuration?.backgroundImageUrl ? `url(${form.configuration.backgroundImageUrl})` : undefined,
    backgroundSize: form.configuration?.backgroundImageUrl ? "cover" : undefined,
    backgroundPosition: form.configuration?.backgroundImageUrl ? "center center" : undefined,
  } as CSSProperties;

  const btnClass = (base: string) =>
    `${base} ${buttonStyle === "pill" ? styles.btnPill : buttonStyle === "square" ? styles.btnSquare : ""}`.trim();

  const currentPageSubtitle = currentPage.title !== `Page ${currentPageIndex + 1}` ? currentPage.title : "";

  if (submitted) {
    return (
      <SurveySuccess
        hero={{ heroImageUrl, heroTitle, heroSubtitle, primaryColor, fontFamily: form.configuration?.fontFamily || undefined, pageStyle }}
        message={message}
      />
    );
  }

  // ─── Main Form Render ─────────────────────────────────────────────────

  return (
    <section className={styles.page} style={pageStyle}>
      <div className={styles.shell}>
        <div className={styles.card} style={{ fontFamily: form.configuration?.fontFamily || undefined }}>

            <div className={styles.heroWrap}>
            {heroImageUrl ? (
              <img src={heroImageUrl} alt="Survey header" className={styles.heroImage} />
            ) : (
              <div className={styles.heroImagePlaceholder} />
            )}
            <div className={styles.brandBadge} style={getLogoPlacementInlineStyle(logoPosX, logoPosY)}>
              <img src={logoUrl} alt="Survey logo" className={styles.brandBadgeLogo} />
            </div>
          </div>

          <div className={styles.titlebar}>{heroTitle}</div>

          <div className={styles.subbar}>
            {renderedQuestions.length > 0 && currentPageSubtitle ? <span>{currentPageSubtitle}</span> : null}
            {renderedQuestions.length > 0 && !currentPageSubtitle && heroSubtitle ? <span>{heroSubtitle}</span> : null}
            <span className={`${styles.subbarStatus} ${effectiveStatus === "Active" ? styles.statusActive : styles.statusClosed}`}>
              {effectiveStatus}
            </span>
            {showPageNumbers ? (
              <span className={styles.subbarPage}>
                Page {currentPageIndex + 1} / {pageGroups.length}
              </span>
            ) : null}
          </div>

          <div className={styles.body}>
            {error ? <div className={styles.alertError}>{error}</div> : null}
            {message ? <div className={styles.alertSuccess}>{message}</div> : null}

            {showProgress ? (
              <div className={styles.progressWrap}>
                <div className={styles.progressTrack}>
                  <div className={styles.progressBar} style={{ width: `${progressPercent}%` }} />
                </div>
                <div className={styles.progressMeta}>{Math.round(progressPercent)}% selesai</div>
              </div>
            ) : null}

            <div key={`page-${currentPageIndex}`} className={styles.questionList}>
              {renderedQuestions.length === 0 ? (
                <div className={styles.welcomeBody} />
              ) : (
                renderedQuestions.map(({ element, sourceQuestion, applicationName }) => {
                  const effectiveRequired = element.required || isConditionallyRequired(element, values);
                  const effectiveElement = { ...element, required: effectiveRequired };
                  const ratingThreshold = Number((sourceQuestion.options || {}).commentRequiredBelowRating || 0);
                  const ratingValue = Number(values[element.id] || 0);
                  const showRatingComment = effectiveElement.type === "rating" && ratingThreshold > 0 && ratingValue > 0 && ratingValue < ratingThreshold;

                  return (
                    <div key={element.id} className={styles.question}>
                      {applicationName ? <div className={styles.appGroupLabel}>{applicationName}</div> : null}
                      {effectiveElement.type !== "hero" && effectiveElement.title.trim() ? (
                        <label className={styles.questionLabel}>
                          {effectiveElement.title}
                          {effectiveElement.required ? <span style={{ color: "#cc0033", marginLeft: 2 }}>*</span> : null}
                        </label>
                      ) : null}
                      {effectiveElement.type !== "hero" && effectiveElement.subtitle ? (
                        <span className={styles.questionHelp}>{effectiveElement.subtitle}</span>
                      ) : null}
                      <SurveyPreviewElement
                        element={effectiveElement}
                        allElements={allElements}
                        values={values}
                        onSetValue={(id, value) => setValues((prev) => ({ ...prev, [id]: value }))}
                        onSetValuesBulk={(nextValues) => setValues((prev) => ({ ...prev, ...nextValues }))}
                        onToggleCheckbox={toggleCheckbox}
                        orgData={{
                          businessUnits: filteredOrgData.businessUnits,
                          divisions: filteredOrgData.divisions,
                          departments: filteredOrgData.departments,
                          functions: filteredOrgData.functions,
                          mappedApplicationsByDepartment,
                          mappedApplicationsByFunction,
                        }}
                      />
                      {showRatingComment ? (
                        <div className={styles.ratingCommentBox}>
                          <label className={styles.ratingCommentLabel}>
                            Komentar (wajib untuk nilai &lt; {ratingThreshold}):
                          </label>
                          <textarea
                            className={styles.ratingCommentTextarea}
                            value={commentValues[element.id] || ""}
                            onChange={(e) => setCommentValues((prev) => ({ ...prev, [element.id]: e.target.value }))}
                            placeholder="Jelaskan kendala atau saran perbaikan..."
                            rows={2}
                          />
                        </div>
                      ) : null}
                      {validationErrors[element.id] ? (
                        <div className={styles.fieldError}>{validationErrors[element.id]}</div>
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>

            <div className={styles.nav}>
              {currentPageIndex > 0 ? (
                <button
                  type="button"
                  className={btnClass(styles.btnGhost)}
                  onClick={() => { setCurrentPageIndex((p) => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                >
                  ← Sebelumnya
                </button>
              ) : <span />}
              {currentPageIndex < pageGroups.length - 1 ? (
                <button
                  type="button"
                  className={btnClass(styles.btn)}
                  onClick={() => { if (validateCurrentPage()) { setCurrentPageIndex((p) => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); } }}
                >
                  Selanjutnya →
                </button>
              ) : (
                <button
                  type="button"
                  className={btnClass(styles.btn)}
                  disabled={saving}
                  onClick={handleSubmit}
                >
                  {saving ? "Mengirim..." : "Kirim Response"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
