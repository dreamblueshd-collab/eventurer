"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { fetchSurveyById, updateEventById, updateEventConfiguration, fetchSurveyResponseStatistics, uploadSurveyStyleImage } from "@/lib/surveys";
import { createSurveyUnderEvent } from "@/lib/survey-events";
import { fetchOrgHierarchy, type BusinessUnitOption, type DivisionOption, type DepartmentOption } from "@/lib/org-hierarchy";
import { fetchFunctionsMaster, type FunctionMaster } from "@/lib/master-data";
import { fetchMappedApplicationsByDepartment, fetchMappedApplicationsByFunction } from "@/lib/mappings";
import { canPublishEvent, resolveEventStatus } from "@/lib/event-status";
import { normalizeSurveyImageUpload, type SurveyImageType } from "@/lib/image-upload";
import { useSearchParams, useRouter } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import styles from "./survey-create.module.css";
import { useToast, ToastContainer } from "@/components/common/toast";
import SurveyBuilderEditor from "./survey-builder-editor";
import ImageCropperModal from "./image-cropper-modal";
import SurveyPreviewScreen from "./survey-preview-screen";
import SurveySettingsModals from "./survey-settings-modals";
import SurveyTemplatePicker from "./survey-template-picker";
import {
  BUILDER_TEMPLATES,
  ELEMENTS,
  getTemplatePreviewStyle,
  sanitizeSurveyDescription,
  type BuilderPage,
  type BuilderTemplate,
  type DraftPayload,
  type ElementType,
  type FontPreset,
} from "./builder-definitions";
import {
  ensureUniqueElementIds,
  formatScheduleValue,
  formatScheduleValueWithSeconds,
  getMaxTempElementCounter,
  inferProfileField,
  newElement,
  normalizePagesForState,
  parseScheduleInputDate,
  renumberPages,
  toScheduleInputValue,
  toPages,
} from "./builder-utils";
import {
  applyMasterDataSource,
  buildEventConfigurationPayload,
  buildEventUpdatePayload,
  buildTemplatePages,
  hasMappedSelectorInPage,
  shouldShowVisibilityControl,
} from "./builder-page-helpers";
import { syncQuestionsToServer } from "./survey-sync";

export default function SurveyCreatePage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const surveyId = searchParams.get("surveyId") || "";
  const paramEventId = searchParams.get("eventId") || "";
  const draftKey = useMemo(() => `survey_draft_${surveyId}`, [surveyId]);
  const currentUser = getCurrentUser();
  const currentUserId = Number(currentUser?.userId || 0);
  const currentRole = currentUser?.role;

  // SuperAdmin tidak boleh mengakses halaman ini
  useEffect(() => {
    if (currentRole === "SuperAdmin") {
      window.location.href = "/admin/event-management";
    }
  }, [currentRole]);

  const { toasts, showToast, removeToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [hasSubmittedResponses, setHasSubmittedResponses] = useState(false);
  const [isClosedReadOnly, setIsClosedReadOnly] = useState(false);
  const [eventId, setEventId] = useState("");
  const [isNewSurvey, setIsNewSurvey] = useState(false);

  // Dirty tracking — set true on any user edit, reset after save/publish
  const [isDirty, setIsDirty] = useState(false);
  const loadedRef = useRef(false);

  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDesc, setSurveyDesc] = useState("");
  const [targetRespondents, setTargetRespondents] = useState("");
  const [targetScore, setTargetScore] = useState("");
  const [scheduleStart, setScheduleStart] = useState("");
  const [scheduleEnd, setScheduleEnd] = useState("");

  const [pages, setPages] = useState<BuilderPage[]>([]);
  const [elementCounter, setElementCounter] = useState(0);
  const [draggingPageId, setDraggingPageId] = useState<number | null>(null);
  const [dragOverPageId, setDragOverPageId] = useState<number | null>(null);

  const [logo, setLogo] = useState("");
  const [bgColor, setBgColor] = useState("#f5f5f5");
  const [bgImage, setBgImage] = useState("");
  const [font, setFont] = useState<FontPreset>("default");
  const [heroTitle, setHeroTitle] = useState("");
  const [heroSubtitle, setHeroSubtitle] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#125ba1");
  const [secondaryColor, setSecondaryColor] = useState("#2c8dd8");
  const [heroImagePositionX, setHeroImagePositionX] = useState(50);
  const [heroImagePositionY, setHeroImagePositionY] = useState(50);
  const [logoPositionX, setLogoPositionX] = useState(50);
  const [logoPositionY, setLogoPositionY] = useState(50);
  const [backgroundPositionX, setBackgroundPositionX] = useState(50);
  const [backgroundPositionY, setBackgroundPositionY] = useState(50);
  const [buttonStyle, setButtonStyle] = useState<"rounded" | "pill" | "square">("rounded");
  const [showProgressBar, setShowProgressBar] = useState(true);
  const [showPageNumbers, setShowPageNumbers] = useState(true);
  const [multiPage, setMultiPage] = useState(true);
  const [requireApproval, setRequireApproval] = useState(false);

  const [showSchedule, setShowSchedule] = useState(false);
  const [showStyle, setShowStyle] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [templateCategory, setTemplateCategory] = useState<"all" | BuilderTemplate["category"]>("all");
  const [templateSearch, setTemplateSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewValues, setPreviewValues] = useState<Record<string, unknown>>({});
  const [cropperState, setCropperState] = useState<{
    file: File;
    imageType: SurveyImageType;
    setter: (value: string) => void;
  } | null>(null);

  const [orgBusinessUnits, setOrgBusinessUnits] = useState<BusinessUnitOption[]>([]);
  const [orgDivisions, setOrgDivisions] = useState<DivisionOption[]>([]);
  const [orgDepartments, setOrgDepartments] = useState<DepartmentOption[]>([]);
  const [orgFunctions, setOrgFunctions] = useState<FunctionMaster[]>([]);
  const [mappedApplicationsByDepartment, setMappedApplicationsByDepartment] = useState<string[]>([]);
  const [mappedApplicationsByFunction, setMappedApplicationsByFunction] = useState<string[]>([]);

  const blockReadOnlyAction = (): boolean => {
    if (!isClosedReadOnly) return false;
    showToast("error", "Survey status Closed: halaman ini read-only. Preview tetap dapat digunakan.");
    return true;
  };

  const onPageDragStart = (pageId: number) => (event: DragEvent) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(pageId));
    setDraggingPageId(pageId);
  };

  const onPageDragEnd = () => {
    setDraggingPageId(null);
    setDragOverPageId(null);
  };

  const onPageDragOver = (pageId: number) => (event: DragEvent) => {
    event.preventDefault();
    if (pageId !== dragOverPageId) {
      setDragOverPageId(pageId);
    }
  };

  const onPageDrop = (pageId: number) => (event: DragEvent) => {
    event.preventDefault();
    const sourceIdRaw = event.dataTransfer.getData("text/plain");
    const sourceId = sourceIdRaw ? Number(sourceIdRaw) : draggingPageId;
    if (!sourceId || sourceId === pageId) {
      setDragOverPageId(null);
      return;
    }

    setPages((prev) => {
      const sourceIndex = prev.findIndex((p) => p.id === sourceId);
      const targetIndex = prev.findIndex((p) => p.id === pageId);
      if (sourceIndex < 0 || targetIndex < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, moved);
      return renumberPages(next);
    });

    setDraggingPageId(null);
    setDragOverPageId(null);
  };

  useEffect(() => {
    const run = async () => {
      // Mode: create new survey under event (no surveyId yet)
      if (!surveyId && paramEventId) {
        setEventId(paramEventId);
        setIsNewSurvey(true);
        setSurveyTitle("");
        setSurveyDesc("");
        setLoading(false);
        setShowTemplatePicker(true);
        return;
      }

      if (!surveyId) {
        setError("surveyId atau eventId harus ada");
        setLoading(false);
        return;
      }

      const result = await fetchSurveyById(surveyId);
      setLoading(false);
      if (!result.success || !result.survey) {
        setError(result.message || "Gagal memuat survey");
        return;
      }

      const detail = result.survey;
      setEventId(detail.EventId ? String(detail.EventId) : surveyId);
      setSurveyTitle(detail.Title || "");
      setSurveyDesc(sanitizeSurveyDescription(detail.Description || ""));
      setTargetRespondents(detail.TargetRespondents != null ? String(detail.TargetRespondents) : "");
      setTargetScore(detail.TargetScore != null ? String(detail.TargetScore) : "");
      setScheduleStart(toScheduleInputValue(detail.StartDate, "start"));
      setScheduleEnd(toScheduleInputValue(detail.EndDate, "end"));
      setBgColor(detail.configuration?.BackgroundColor || "#f5f5f5");
      setBgImage(detail.configuration?.BackgroundImageUrl || "");
      setLogo(detail.configuration?.LogoUrl || "");
      setHeroTitle(detail.configuration?.HeroTitle || detail.Title || "");
      setHeroSubtitle(detail.configuration?.HeroSubtitle || sanitizeSurveyDescription(detail.Description || ""));
      setPrimaryColor(detail.configuration?.PrimaryColor || "#125ba1");
      setSecondaryColor(detail.configuration?.SecondaryColor || "#2c8dd8");
      setHeroImagePositionX(detail.configuration?.HeroImagePositionX ?? 50);
      setHeroImagePositionY(detail.configuration?.HeroImagePositionY ?? 50);
      setLogoPositionX(detail.configuration?.LogoPositionX ?? 50);
      setLogoPositionY(detail.configuration?.LogoPositionY ?? 50);
      setBackgroundPositionX(detail.configuration?.BackgroundPositionX ?? 50);
      setBackgroundPositionY(detail.configuration?.BackgroundPositionY ?? 50);
      setButtonStyle(
        detail.configuration?.ButtonStyle === "pill" || detail.configuration?.ButtonStyle === "square"
          ? detail.configuration.ButtonStyle
          : "rounded",
      );
      setShowProgressBar(detail.configuration?.ShowProgressBar !== false);
      setShowPageNumbers(detail.configuration?.ShowPageNumbers !== false);
      setMultiPage(detail.configuration?.MultiPage !== false);
      setRequireApproval(detail.RequireApproval === true);
      setIsClosedReadOnly(resolveEventStatus(detail) === "Closed");
      const stats = await fetchSurveyResponseStatistics(surveyId);
      setHasSubmittedResponses(stats.success && stats.totalResponses > 0);

      const isValidDraftPages = (pages: unknown): boolean => {
        return Array.isArray(pages) && pages.every(p =>
          p && typeof p === 'object' &&
          'id' in p && 'elements' in p &&
          Array.isArray((p as { elements: unknown }).elements)
        );
      };

      const local = localStorage.getItem(draftKey);
      if (local) {
        try {
          const draft = JSON.parse(local) as DraftPayload;
          if (!draft || !isValidDraftPages(draft.pages)) {
            localStorage.removeItem(draftKey);
            // skip — use server data
          } else {
          const serverUpdatedAt = new Date(detail.UpdatedAt || detail.CreatedAt || 0).getTime();
          const localSavedAt = new Date(draft.savedAt || 0).getTime();
          const localIsSynced = (() => {
            const savedAt = String(draft.savedAt || "").trim();
            const syncedAt = String(draft.syncedAt || "").trim();
            if (savedAt && syncedAt) return savedAt === syncedAt;

            const savedMs = new Date(savedAt || 0).getTime();
            const syncedMs = new Date(syncedAt || 0).getTime();
            if (!Number.isFinite(savedMs) || savedMs <= 0) return false;
            if (!Number.isFinite(syncedMs) || syncedMs <= 0) return false;
            return Math.abs(savedMs - syncedMs) <= 1000;
          })();
          const shouldUseLocalBackup =
            !localIsSynced &&
            Number.isFinite(localSavedAt) &&
            localSavedAt > 0 &&
            (!Number.isFinite(serverUpdatedAt) || localSavedAt > serverUpdatedAt);

          if (shouldUseLocalBackup) {
            setSurveyTitle(draft.surveyTitle || detail.Title || "");
            setSurveyDesc(sanitizeSurveyDescription(draft.surveyDesc || detail.Description || ""));
            setTargetRespondents(draft.targetRespondents || "");
            setTargetScore(draft.targetScore || "");
            setScheduleStart(toScheduleInputValue(detail.StartDate, "start"));
            setScheduleEnd(toScheduleInputValue(detail.EndDate, "end"));
            const draftPages = ensureUniqueElementIds(Array.isArray(draft.pages) ? draft.pages : []);
            setPages(draftPages);
            setElementCounter(getMaxTempElementCounter(draftPages));
            setLogo(draft.style?.logo || detail.configuration?.LogoUrl || "");
            setBgColor(draft.style?.backgroundColor || detail.configuration?.BackgroundColor || "#f5f5f5");
            setBgImage(draft.style?.backgroundImage || detail.configuration?.BackgroundImageUrl || "");
            setFont(draft.style?.font || "default");
            setHeroTitle(draft.style?.heroTitle || detail.configuration?.HeroTitle || detail.Title || "");
            setHeroSubtitle(draft.style?.heroSubtitle || detail.configuration?.HeroSubtitle || sanitizeSurveyDescription(detail.Description || ""));
            setPrimaryColor(draft.style?.primaryColor || detail.configuration?.PrimaryColor || "#125ba1");
            setSecondaryColor(draft.style?.secondaryColor || detail.configuration?.SecondaryColor || "#2c8dd8");
            setHeroImagePositionX(draft.style?.heroImagePositionX ?? detail.configuration?.HeroImagePositionX ?? 50);
            setHeroImagePositionY(draft.style?.heroImagePositionY ?? detail.configuration?.HeroImagePositionY ?? 50);
            setLogoPositionX(draft.style?.logoPositionX ?? detail.configuration?.LogoPositionX ?? 50);
            setLogoPositionY(draft.style?.logoPositionY ?? detail.configuration?.LogoPositionY ?? 50);
            setBackgroundPositionX(draft.style?.backgroundPositionX ?? detail.configuration?.BackgroundPositionX ?? 50);
            setBackgroundPositionY(draft.style?.backgroundPositionY ?? detail.configuration?.BackgroundPositionY ?? 50);
            setButtonStyle(
              draft.style?.buttonStyle === "pill" || draft.style?.buttonStyle === "square"
                ? draft.style.buttonStyle
                : detail.configuration?.ButtonStyle === "pill" || detail.configuration?.ButtonStyle === "square"
                  ? detail.configuration.ButtonStyle
                  : "rounded",
            );
            setShowProgressBar(draft.style?.showProgressBar ?? detail.configuration?.ShowProgressBar !== false);
            setShowPageNumbers(draft.style?.showPageNumbers ?? detail.configuration?.ShowPageNumbers !== false);
            setMultiPage(draft.style?.multiPage ?? detail.configuration?.MultiPage !== false);
            showToast("success", "Memuat backup draft lokal yang lebih baru dari server. Jadwal event tetap mengikuti data server.");
            loadedRef.current = true;
            return;
          }
          }
        } catch {
          // ignore
        }
      }

      const fromDb = toPages(detail.questions);
      const normalizedPages = ensureUniqueElementIds(fromDb);

      // Sync hero element coverUrl with configuration HeroImageUrl (source of truth for public survey)
      const configHeroUrl = detail.configuration?.HeroImageUrl || "";
      if (configHeroUrl) {
        for (const page of normalizedPages) {
          for (const el of page.elements) {
            if (el.type === "hero" && el.coverUrl !== configHeroUrl) {
              el.coverUrl = configHeroUrl;
            }
          }
        }
      }

      setPages(normalizedPages);
      setElementCounter(getMaxTempElementCounter(normalizedPages));
      loadedRef.current = true;
    };

    void run();
  }, [draftKey, surveyId, paramEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const run = async () => {
      const [orgResult, functionResult] = await Promise.all([
        fetchOrgHierarchy(),
        fetchFunctionsMaster(),
      ]);

      if (orgResult.success) {
        setOrgBusinessUnits(orgResult.businessUnits);
        setOrgDivisions(orgResult.divisions);
        setOrgDepartments(orgResult.departments);
      }

      if (functionResult.success) {
        setOrgFunctions(functionResult.data.filter((item) => item.IsActive !== false));
      }
    };

    void run();
  }, []);

  useEffect(() => {
    const normalized = normalizePagesForState(pages);
    if (normalized.changed) {
      setPages(normalized.pages);
    }
  }, [pages]);

  const scheduleSummary = useMemo(() => {
    if (!scheduleStart || !scheduleEnd) return "Period not set";
    return `Period: ${formatScheduleValue(scheduleStart)} - ${formatScheduleValue(scheduleEnd)}`;
  }, [scheduleEnd, scheduleStart]);

  const styleSummary = useMemo(
    () => `Logo: ${logo ? "On" : "Off"} | Primary: ${primaryColor} | Button: ${buttonStyle} | Multi-page: ${multiPage ? "On" : "Off"}`,
    [buttonStyle, logo, multiPage, primaryColor],
  );

  const allBuilderElements = useMemo(() => pages.flatMap((page) => page.elements), [pages]);
  const heroImageUrl = useMemo(
    () => allBuilderElements.find((element) => element.type === "hero")?.coverUrl || "",
    [allBuilderElements],
  );
  const profileFieldIds = useMemo(() => {
    const bu = allBuilderElements.find((item) => inferProfileField(item) === "bu");
    const division = allBuilderElements.find((item) => inferProfileField(item) === "division");
    const department = allBuilderElements.find((item) => inferProfileField(item) === "department");
    const func = allBuilderElements.find((item) => inferProfileField(item) === "function");

    return {
      buId: bu?.id || "",
      divisionId: division?.id || "",
      departmentId: department?.id || "",
      functionId: func?.id || "",
    };
  }, [allBuilderElements]);

  const selectedDepartmentId = profileFieldIds.departmentId
    ? String(previewValues[profileFieldIds.departmentId] || "")
    : "";
  const selectedFunctionId = profileFieldIds.functionId
    ? String(previewValues[profileFieldIds.functionId] || "")
    : "";

  // Mark dirty on user edits (skip during initial load)

  // Browser beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Track dirty state via key editable fields
  const dirtySignature = `${surveyTitle}|${surveyDesc}|${targetRespondents}|${targetScore}|${scheduleStart}|${scheduleEnd}|${pages.length}|${JSON.stringify(pages.map(p => p.elements.length))}|${logo}|${bgColor}|${bgImage}|${font}|${heroTitle}|${heroSubtitle}|${primaryColor}|${secondaryColor}|${heroImagePositionX}|${heroImagePositionY}|${logoPositionX}|${logoPositionY}|${backgroundPositionX}|${backgroundPositionY}|${buttonStyle}|${multiPage}|${requireApproval}`;
  const prevSignatureRef = useRef<string | null>(null);
  useEffect(() => {
    if (!loadedRef.current) return;
    if (prevSignatureRef.current === null) {
      prevSignatureRef.current = dirtySignature;
      return;
    }
    if (prevSignatureRef.current !== dirtySignature) {
      setIsDirty(true);
    }
  }, [dirtySignature]);

  useEffect(() => {
    const run = async () => {
      if (!selectedDepartmentId) {
        setMappedApplicationsByDepartment([]);
        return;
      }

      const mapped = await fetchMappedApplicationsByDepartment(Number(selectedDepartmentId));
      if (!mapped.success) {
        setMappedApplicationsByDepartment([]);
        return;
      }

      setMappedApplicationsByDepartment(
        mapped.applications.map((item) => item.ApplicationName).filter(Boolean),
      );
    };

    void run();
  }, [selectedDepartmentId]);

  useEffect(() => {
    const run = async () => {
      if (!selectedFunctionId) {
        setMappedApplicationsByFunction([]);
        return;
      }

      const mapped = await fetchMappedApplicationsByFunction(Number(selectedFunctionId));
      if (!mapped.success) {
        setMappedApplicationsByFunction([]);
        return;
      }

      setMappedApplicationsByFunction(
        mapped.applications.map((item) => item.ApplicationName).filter(Boolean),
      );
    };

    void run();
  }, [selectedFunctionId]);

  const addPage = () => {
    if (blockReadOnlyAction()) return;
    setPages((prev) => {
      const nextId = prev.length + 1;
      return [...prev, { id: nextId, title: nextId === 1 ? "Welcome" : `Page ${nextId}`, elements: [] }];
    });
  };

  const addElement = (pageId: number, type: ElementType) => {
    if (blockReadOnlyAction()) return;
    const nextCounter = elementCounter + 1;
    const tempId = `temp-${nextCounter}`;

    setElementCounter(nextCounter);
    setPages((prevPages) =>
      prevPages.map((page) => {
        if (page.id !== pageId) return page;
        const el = newElement(type, tempId);
        // Auto-set displayCondition if element is placed after an app-selector
        if (type !== "hero" && hasMappedSelectorInPage(page.elements)) {
          el.displayCondition = "after_mapped_selection";
        }
        return { ...page, elements: [...page.elements, el] };
      }),
    );
  };

  const addElementToLastPage = (type: ElementType) => {
    if (blockReadOnlyAction()) return;
    const nextCounter = elementCounter + 1;
    const tempId = `temp-${nextCounter}`;

    setElementCounter(nextCounter);
    setPages((prevPages) => {
      if (prevPages.length === 0) {
        return [{ id: 1, title: "Welcome", elements: [newElement(type, tempId)] }];
      }

      const targetPageId = prevPages[prevPages.length - 1].id;
      return prevPages.map((page) => {
        if (page.id !== targetPageId) return page;
        const el = newElement(type, tempId);
        // Auto-set displayCondition if element is placed after an app-selector
        if (type !== "hero" && hasMappedSelectorInPage(page.elements)) {
          el.displayCondition = "after_mapped_selection";
        }
        return { ...page, elements: [...page.elements, el] };
      });
    });
  };

  const removePage = (pageId: number) => {
    if (blockReadOnlyAction()) return;
    setPages((prev) => renumberPages(prev.filter((page) => page.id !== pageId)));
  };

  const moveElementWithinPage = (pageId: number, elementIndex: number, direction: "up" | "down") => {
    if (blockReadOnlyAction()) return;
    setPages((prev) =>
      prev.map((page) => {
        if (page.id !== pageId) return page;
        const targetIndex = direction === "up" ? elementIndex - 1 : elementIndex + 1;
        if (targetIndex < 0 || targetIndex >= page.elements.length) return page;

        const nextElements = [...page.elements];
        const [moved] = nextElements.splice(elementIndex, 1);
        nextElements.splice(targetIndex, 0, moved);
        return { ...page, elements: nextElements };
      }),
    );
  };

  const validateEventSchedule = (): boolean => {
    const start = parseScheduleInputDate(scheduleStart, "start");
    const end = parseScheduleInputDate(scheduleEnd, "end");
    if (start && end && start.getTime() > end.getTime()) {
      setError("Tanggal dan jam akhir harus sama atau setelah tanggal dan jam mulai");
      return false;
    }

    return true;
  };

  const doSyncQuestions = (targetSurveyId: string) =>
    syncQuestionsToServer(targetSurveyId, pages, currentUserId, hasSubmittedResponses, {
      setError: (msg: string) => showToast("error", msg),
      setMessage: (msg: string) => showToast("success", msg),
      setPages,
    });

  const ensureSurveyExists = async (): Promise<string | null> => {
    if (!isNewSurvey) return surveyId;
    
    // Create new survey under event
    const createResult = await createSurveyUnderEvent(eventId, {
      title: surveyTitle || "Untitled Form",
      description: surveyDesc,
    });
    
    if (!createResult.success || !createResult.surveyId) {
      showToast("error", createResult.message || "Gagal membuat survey");
      return null;
    }
    
    const newSurveyId = String(createResult.surveyId);
    
    // Update state - URL will be updated after successful save
    setIsNewSurvey(false);
    
    return newSurveyId;
  };

  const saveDraft = async () => {
    if (blockReadOnlyAction()) return;
    setSaving(true);
    setError("");
    if (!validateEventSchedule()) {
      setSaving(false);
      return;
    }

    // Ensure survey exists (create if isNewSurvey)
    const activeSurveyId = await ensureSurveyExists();
    if (!activeSurveyId) {
      setSaving(false);
      return;
    }

    const payload: DraftPayload = {
      surveyTitle,
      surveyDesc: sanitizeSurveyDescription(surveyDesc),
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
      pages,
      savedAt: new Date().toISOString(),
      style: {
        logo,
        backgroundColor: bgColor,
        backgroundImage: bgImage,
        font,
        heroTitle,
        heroSubtitle,
        primaryColor,
        secondaryColor,
        heroImagePositionX,
        heroImagePositionY,
        logoPositionX,
        logoPositionY,
        backgroundPositionX,
        backgroundPositionY,
        buttonStyle,
        showProgressBar,
        showPageNumbers,
        multiPage,
      },
    };

    const localDraftKey = `survey_draft_${activeSurveyId}`;
    localStorage.setItem(localDraftKey, JSON.stringify(payload));

    const synced = await doSyncQuestions(activeSurveyId);
    if (!synced) {
      setSaving(false);
      return;
    }

    // Auto-enable multiPage if there are multiple pages
    const hasMultiplePages = pages.length > 1;
    const effectiveMultiPage = hasMultiplePages ? true : multiPage;

    const eventState = {
      surveyTitle,
      surveyDesc,
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
    };
    const styleState = {
      logo,
      bgColor,
      bgImage,
      font,
      heroTitle,
      heroSubtitle,
      primaryColor,
      secondaryColor,
      heroImagePositionX,
      heroImagePositionY,
      logoPositionX,
      logoPositionY,
      backgroundPositionX,
      backgroundPositionY,
      buttonStyle,
      showProgressBar,
      showPageNumbers,
      multiPage: effectiveMultiPage,
    };
    const updatePayload = buildEventUpdatePayload(eventState, "Draft");

    const update = await updateEventById(activeSurveyId, { ...updatePayload, requireApproval });
    setSaving(false);

    if (!update.success) {
      showToast("error", update.message || "Draft lokal tersimpan, sinkron server gagal");
      return;
    }

    const configUpdate = await updateEventConfiguration(
      activeSurveyId,
      buildEventConfigurationPayload(eventState, styleState),
    );
    if (!configUpdate.success) {
      showToast("success", "Draft tersimpan, tetapi style belum tersimpan ke server.");
      return;
    }

    const verifyDraft = await fetchSurveyById(activeSurveyId);
    if (!verifyDraft.success || !verifyDraft.survey) {
      showToast("error", "Draft tersimpan, tetapi verifikasi status gagal.");
      return;
    }
    const latestStatus = verifyDraft.survey.Status || "";
    if (latestStatus !== "Draft") {
      showToast("error", `Status belum berubah ke Draft (status saat ini: ${latestStatus || "-"})`);
      return;
    }

    try {
      localStorage.setItem(localDraftKey, JSON.stringify({ ...payload, syncedAt: payload.savedAt }));
    } catch {
      // ignore
    }
    setIsDirty(false);
    prevSignatureRef.current = dirtySignature;

    // Update URL if this was a new survey
    if (activeSurveyId !== surveyId) {
      router.replace(`/admin/event-management/survey-create?surveyId=${activeSurveyId}`);
    }

    showToast("success", "Draft tersimpan");
  };

  const publish = async () => {
    if (blockReadOnlyAction()) return;
    setError("");
    if (!validateEventSchedule()) {
      return;
    }

    setPublishing(true);

    // Ensure survey exists (create if isNewSurvey)
    const activeSurveyId = await ensureSurveyExists();
    if (!activeSurveyId) {
      setPublishing(false);
      return;
    }

    // Auto-enable multiPage if there are multiple pages
    const hasMultiplePages = pages.length > 1;
    const effectiveMultiPage = hasMultiplePages ? true : multiPage;

    const eventState = {
      surveyTitle,
      surveyDesc,
      targetRespondents,
      targetScore,
      scheduleStart,
      scheduleEnd,
    };
    const styleState = {
      logo,
      bgColor,
      bgImage,
      font,
      heroTitle,
      heroSubtitle,
      primaryColor,
      secondaryColor,
      heroImagePositionX,
      heroImagePositionY,
      logoPositionX,
      logoPositionY,
      backgroundPositionX,
      backgroundPositionY,
      buttonStyle,
      showProgressBar,
      showPageNumbers,
      multiPage: effectiveMultiPage,
    };
    const updatePayload = buildEventUpdatePayload(eventState, "Active");

    if (!canPublishEvent(updatePayload.endDate)) {
      setPublishing(false);
      showToast("error", `Publish diblok karena End Date sudah lewat. End Date: ${formatScheduleValueWithSeconds(updatePayload.endDate)}. Waktu sekarang: ${formatScheduleValueWithSeconds(new Date())}.`);
      return;
    }

    const hasQuestion = pages.some((page) => page.elements.length > 0);
    if (!hasQuestion) {
      setPublishing(false);
      setError("Minimal ada 1 pertanyaan sebelum publish");
      return;
    }

    const synced = await doSyncQuestions(activeSurveyId);
    if (!synced) {
      setPublishing(false);
      return;
    }

    if (!canPublishEvent(updatePayload.endDate)) {
      setPublishing(false);
      showToast("error", `Publish dibatalkan karena End Date terlewati saat proses sinkronisasi. End Date: ${formatScheduleValueWithSeconds(updatePayload.endDate)}. Waktu sekarang: ${formatScheduleValueWithSeconds(new Date())}.`);
      return;
    }

    const update = await updateEventById(activeSurveyId, { ...updatePayload, requireApproval });
    setPublishing(false);

    if (!update.success) {
      showToast("error", update.message || "Gagal publish");
      return;
    }

    const configUpdate = await updateEventConfiguration(
      activeSurveyId,
      buildEventConfigurationPayload(eventState, styleState),
    );
    if (!configUpdate.success) {
      showToast("error", configUpdate.message || "Publish berhasil, namun style belum tersimpan.");
      return;
    }

    const verifyActive = await fetchSurveyById(activeSurveyId);
    if (!verifyActive.success || !verifyActive.survey) {
      showToast("error", "Publish berhasil, tetapi verifikasi status gagal.");
      return;
    }
    const latestStatus = resolveEventStatus(verifyActive.survey);
    if (latestStatus !== "Active") {
      showToast("error", `Publish tersimpan, tetapi status efektif sekarang ${latestStatus || "-"}. Period event: ${formatScheduleValue(verifyActive.survey.StartDate)} - ${formatScheduleValue(verifyActive.survey.EndDate)}.`);
      return;
    }

    setIsDirty(false);
    router.push(`/admin/event-management/${activeSurveyId}/operations`);
  };

  const uploadProcessedFile = async (file: File, setter: (value: string) => void, imageType: SurveyImageType) => {
    if (blockReadOnlyAction()) return;
    const normalized = await normalizeSurveyImageUpload(file, imageType);
    if (!normalized.ok) {
      showToast("error", normalized.message);
      return;
    }
    const safeFile = normalized.file;
    if (!surveyId) {
      // Fallback to data URL if no surveyId yet (shouldn't happen normally)
      const reader = new FileReader();
      reader.onload = () => setter(String(reader.result || ""));
      reader.readAsDataURL(safeFile);
      return;
    }
    const result = await uploadSurveyStyleImage(surveyId, imageType, safeFile);
    if (result.success && result.imageUrl) {
      setter(result.imageUrl);
    } else {
      showToast("error", result.message || "Gagal upload gambar");
    }
  };

  const onFile = async (file: File | undefined, setter: (value: string) => void, imageType: SurveyImageType) => {
    if (blockReadOnlyAction()) return;
    if (!file) return;
    setError("");
    setCropperState({ file, imageType, setter });
  };

  const setPreviewValue = (id: string, value: unknown) => {
    setPreviewValues((prev) => ({ ...prev, [id]: value }));
  };

  const setPreviewValuesBulk = (nextValues: Record<string, unknown>) => {
    setPreviewValues((prev) => ({ ...prev, ...nextValues }));
  };

  const togglePreviewCheckbox = (id: string, option: string) => {
    setPreviewValues((prev) => {
      const current = Array.isArray(prev[id]) ? (prev[id] as string[]) : [];
      const next = current.includes(option) ? current.filter((item) => item !== option) : [...current, option];
      return { ...prev, [id]: next };
    });
  };

  const hasBuilderContent = useMemo(
    () => pages.some((page) => page.elements.length > 0),
    [pages],
  );

  const filteredTemplates = useMemo(() => {
    const term = templateSearch.trim().toLowerCase();
    return BUILDER_TEMPLATES.filter((item) => {
      if (templateCategory !== "all" && item.category !== templateCategory) return false;
      if (!term) return true;
      return `${item.name} ${item.description}`.toLowerCase().includes(term);
    });
  }, [templateCategory, templateSearch]);

  const elementIconMap = useMemo(
    () =>
      ELEMENTS.reduce<Record<ElementType, string>>((acc, item) => {
        acc[item.type] = item.icon;
        return acc;
      }, {} as Record<ElementType, string>),
    [],
  );

  const selectedTemplate = useMemo(
    () => BUILDER_TEMPLATES.find((item) => item.id === selectedTemplateId) || null,
    [selectedTemplateId],
  );

  const applyTemplate = (template: BuilderTemplate) => {
    const builtTemplate = buildTemplatePages(template, elementCounter);
    setPages(builtTemplate.pages);
    setElementCounter(builtTemplate.nextCounter);
    setShowTemplatePicker(false);
    setShowTemplateConfirm(false);
    setSelectedTemplateId("");
    setTemplateSearch("");
    setTemplateCategory("all");
    showToast("success", `Template "${template.name}" berhasil diterapkan. Klik Save Draft untuk menyimpan ke server.`);
  };

  const onSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
  };

  const onApplySelectedTemplate = () => {
    if (!selectedTemplate) return;
    if (hasBuilderContent) {
      setShowTemplateConfirm(true);
      return;
    }
    applyTemplate(selectedTemplate);
  };

  if (loading) return <section className={styles.loading}>Memuat form builder...</section>;

  return (
    <section className={styles.wrapper}>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {error ? <div className={styles.alertError}>{error}</div> : null}
      {isClosedReadOnly ? <div className={styles.alertError}>Survey Closed - Read Only. Anda tetap dapat melakukan Preview, namun perubahan tidak dapat disimpan.</div> : null}

      {showPreview ? (
        <SurveyPreviewScreen
          allBuilderElements={allBuilderElements}
          bgColor={bgColor}
          bgImage={bgImage}
          font={font}
          logo={logo}
          mappedApplicationsByDepartment={mappedApplicationsByDepartment}
          mappedApplicationsByFunction={mappedApplicationsByFunction}
          orgBusinessUnits={orgBusinessUnits}
          orgDepartments={orgDepartments}
          orgDivisions={orgDivisions}
          orgFunctions={orgFunctions}
          pages={pages}
          previewDevice={previewDevice}
            previewValues={previewValues}
            primaryColor={primaryColor}
            heroImagePositionX={heroImagePositionX}
            heroImagePositionY={heroImagePositionY}
            logoPositionX={logoPositionX}
            logoPositionY={logoPositionY}
            backgroundPositionX={backgroundPositionX}
            backgroundPositionY={backgroundPositionY}
            setPreviewDevice={setPreviewDevice}
          setPreviewValue={setPreviewValue}
          setPreviewValuesBulk={setPreviewValuesBulk}
          setShowPreview={setShowPreview}
          surveyDesc={surveyDesc}
          surveyTitle={surveyTitle}
          togglePreviewCheckbox={togglePreviewCheckbox}
        />
      ) : (
        <SurveyBuilderEditor
          addElement={addElement}
          addElementToLastPage={addElementToLastPage}
          addPage={addPage}
          applyMasterDataSource={(source, element) =>
            applyMasterDataSource(source, element, {
              businessUnits: orgBusinessUnits,
              divisions: orgDivisions,
              departments: orgDepartments,
              functions: orgFunctions,
            })
          }
          bgColor={bgColor}
          bgImage={bgImage}
          brandStyleSummary={styleSummary}
          buttonStyle={buttonStyle}
          dragOverPageId={dragOverPageId}
          draggingPageId={draggingPageId}
          eventId={eventId}
          font={font}
          hasMappedSelectorInPage={hasMappedSelectorInPage}
          heroSubtitle={heroSubtitle}
          heroTitle={heroTitle}
          isDirty={isDirty}
          loadingPublish={publishing}
          loadingSave={saving}
          isReadOnly={isClosedReadOnly}
          logo={logo}
          moveElementWithinPage={moveElementWithinPage}
          onFile={onFile}
          onPageDragEnd={onPageDragEnd}
          onPageDragOver={onPageDragOver}
          onPageDragStart={onPageDragStart}
          onPageDrop={onPageDrop}
          openPreview={() => setShowPreview(true)}
          openSchedule={() => setShowSchedule(true)}
          openStyle={() => setShowStyle(true)}
          openTemplatePicker={() => setShowTemplatePicker(true)}
          pages={pages}
          primaryColor={primaryColor}
          publish={publish}
          removePage={removePage}
          saveDraft={saveDraft}
          scheduleSummary={scheduleSummary}
          secondaryColor={secondaryColor}
          setPages={setPages}
          setPreviewValues={setPreviewValues}
          setSurveyDesc={setSurveyDesc}
          setSurveyTitle={setSurveyTitle}
          setTargetRespondents={setTargetRespondents}
          setTargetScore={setTargetScore}
          shouldShowVisibilityControl={shouldShowVisibilityControl}
          surveyDesc={surveyDesc}
          surveyTitle={surveyTitle}
          targetRespondents={targetRespondents}
          targetScore={targetScore}
        />
      )}
        <SurveySettingsModals
        bgColor={bgColor}
        bgImage={bgImage}
        buttonStyle={buttonStyle}
        font={font}
        heroSubtitle={heroSubtitle}
        heroImageUrl={heroImageUrl}
        heroTitle={heroTitle}
        logo={logo}
        multiPage={multiPage}
        onFile={onFile}
        primaryColor={primaryColor}
        requireApproval={requireApproval}
        scheduleEnd={scheduleEnd}
        scheduleStart={scheduleStart}
          secondaryColor={secondaryColor}
          heroImagePositionX={heroImagePositionX}
          heroImagePositionY={heroImagePositionY}
          logoPositionX={logoPositionX}
          logoPositionY={logoPositionY}
          backgroundPositionX={backgroundPositionX}
          backgroundPositionY={backgroundPositionY}
          setBgColor={setBgColor}
          setBgImage={setBgImage}
        setButtonStyle={setButtonStyle}
        setFont={setFont}
        setHeroSubtitle={setHeroSubtitle}
        setHeroTitle={setHeroTitle}
        setLogo={setLogo}
        setMultiPage={setMultiPage}
        setPrimaryColor={setPrimaryColor}
        setRequireApproval={setRequireApproval}
        setScheduleEnd={setScheduleEnd}
        setScheduleStart={setScheduleStart}
          setSecondaryColor={setSecondaryColor}
          setHeroImagePositionX={setHeroImagePositionX}
          setHeroImagePositionY={setHeroImagePositionY}
          setLogoPositionX={setLogoPositionX}
          setLogoPositionY={setLogoPositionY}
          setBackgroundPositionX={setBackgroundPositionX}
          setBackgroundPositionY={setBackgroundPositionY}
        setShowPageNumbers={setShowPageNumbers}
        setShowProgressBar={setShowProgressBar}
        setShowSchedule={setShowSchedule}
        setShowStyle={setShowStyle}
          showPageNumbers={showPageNumbers}
          showProgressBar={showProgressBar}
          showSchedule={showSchedule}
          showStyle={showStyle}
          isReadOnly={isClosedReadOnly}
        />

      {showTemplatePicker ? (
        <SurveyTemplatePicker
          elementIconMap={elementIconMap}
          filteredTemplates={filteredTemplates}
          getTemplatePreviewStyle={getTemplatePreviewStyle}
          onApplySelectedTemplate={onApplySelectedTemplate}
          onClose={() => { setShowTemplatePicker(false); setShowTemplateConfirm(false); }}
          onConfirmReplace={() => {
            if (!selectedTemplate) return;
            applyTemplate(selectedTemplate);
          }}
          onSelectBlank={() => { setShowTemplatePicker(false); setShowTemplateConfirm(false); }}
          onSelectTemplate={onSelectTemplate}
          selectedTemplate={selectedTemplate}
          selectedTemplateId={selectedTemplateId}
          setShowTemplateConfirm={setShowTemplateConfirm}
          setTemplateCategory={setTemplateCategory}
          setTemplateSearch={setTemplateSearch}
          showBlankOption={isNewSurvey}
          showTemplateConfirm={showTemplateConfirm}
          templateCategory={templateCategory}
          templateSearch={templateSearch}
        />
      ) : null}

      {cropperState ? (
        <ImageCropperModal
          file={cropperState.file}
          imageType={cropperState.imageType}
          onCancel={() => setCropperState(null)}
          onApply={async (croppedFile) => {
            await uploadProcessedFile(croppedFile, cropperState.setter, cropperState.imageType);
            setCropperState(null);
          }}
          onPlacementChange={(x, y) => { setLogoPositionX(x); setLogoPositionY(y); }}
          placementX={logoPositionX}
          placementY={logoPositionY}
        />
      ) : null}

    </section>
  );
}
