/**
 * survey-utils.ts — Pure utility functions for the public survey form.
 * No React, no side-effects. These handle question normalization, pagination,
 * respondent identity, and response building.
 */

import type { PreviewElement } from "@/components/survey/survey-preview-element";
import type {
  PublicQuestion,
  PublicSurveyForm,
} from "@/lib/public-survey";

// ─── Types ──────────────────────────────────────────────────────────

export type PageGroup = {
  pageNumber: number;
  title: string;
  questions: PublicQuestion[];
};

export type ApplicationSelection = {
  id: string;
  name: string;
};

export type RenderedQuestion = {
  element: PreviewElement;
  sourceQuestion: PublicQuestion;
  applicationName?: string;
  baseQuestionId: string;
};

// ─── Question Normalization ─────────────────────────────────────────

function normalizeQuestionType(question: PublicQuestion): PreviewElement["type"] {
  if (question.type === "HeroCover") return "hero";
  if (question.type === "Text") return "text";
  if (question.type === "MultipleChoice") return "choice";
  if (question.type === "Checkbox") return "checkbox";
  if (question.type === "Dropdown") return "dropdown";
  if (question.type === "Rating") return "rating";
  if (question.type === "Date") return "date";
  if (question.type === "Signature") return "signature";
  if (question.type === "MatrixLikert") {
    if (String((question.options || {}).variant || "").toLowerCase() === "matrix") {
      return "matrix";
    }
    return "likert";
  }
  return "text";
}

export function normalizeQuestion(question: PublicQuestion): PreviewElement {
  const options = question.options || {};
  const conditionalRequired = (options.conditionalRequired || {}) as {
    sourceElementId?: unknown;
    threshold?: unknown;
  };
  const type = normalizeQuestionType(question);

  if (type === "rating") {
    const scale = Number(options.ratingScale ?? options.scale ?? 10);
    const clampedScale = Number.isFinite(scale) ? Math.min(10, Math.max(1, Math.round(scale))) : 10;
    return {
      id: question.questionId,
      type,
      title: question.promptText || "",
      subtitle: question.subtitle || "",
      required: Boolean(question.isMandatory),
      options: [String(clampedScale)],
      coverUrl: "",
      dataSource: typeof options.dataSource === "string" ? (options.dataSource as PreviewElement["dataSource"]) : undefined,
      optionLayout: "vertical",
      allowMultipleAnswers: false,
      displayCondition: options.displayCondition === "after_mapped_selection" ? "after_mapped_selection" : "always",
      conditionalRequiredSourceId: typeof conditionalRequired.sourceElementId === "string"
        ? String(conditionalRequired.sourceElementId)
        : undefined,
      conditionalRequiredThreshold: Number.isFinite(Number(conditionalRequired.threshold))
        ? Number(conditionalRequired.threshold)
        : undefined,
    };
  }

  const optionSource = Array.isArray(options.options)
    ? options.options
    : type === "likert"
      ? Array.isArray(options.rows) ? options.rows : []
      : type === "matrix"
        ? Array.isArray(options.columns) ? options.columns : []
        : [];

  const resolvedOptions: string[] = type === "likert"
    ? (() => {
        const rows = optionSource.map((item) => String(item));
        const scale = Number(options.ratingScale ?? options.scale ?? 10);
        const clampedScale = Number.isFinite(scale) && scale >= 1 ? Math.min(10, Math.round(scale)) : 10;
        return [...rows, String(clampedScale)];
      })()
    : optionSource.map((item) => String(item));

  return {
    id: question.questionId,
    type,
    title: question.promptText || "",
    subtitle: question.subtitle || "",
    required: Boolean(question.isMandatory),
    options: resolvedOptions,
    coverUrl: type === "hero" ? String(question.imageUrl || options.heroImageUrl || "") : "",
    dataSource: typeof options.dataSource === "string" ? (options.dataSource as PreviewElement["dataSource"]) : undefined,
    optionLayout: options.layout === "horizontal" ? "horizontal" : "vertical",
    allowMultipleAnswers: Boolean(options.allowMultipleAnswers),
    displayCondition: options.displayCondition === "after_mapped_selection" ? "after_mapped_selection" : "always",
    conditionalRequiredSourceId: typeof conditionalRequired.sourceElementId === "string"
      ? String(conditionalRequired.sourceElementId)
      : undefined,
    conditionalRequiredThreshold: (() => {
      if (type === "likert" && Number.isFinite(Number(options.commentThreshold))) {
        return Number(options.commentThreshold);
      }
      return Number.isFinite(Number(conditionalRequired.threshold))
        ? Number(conditionalRequired.threshold)
        : undefined;
    })(),
    likertEnableComment: type === "likert"
      ? (options.enableComment === false ? false : true)
      : undefined,
  };
}

// ─── Page Grouping ──────────────────────────────────────────────────

function getPageGroups(form: PublicSurveyForm | null): PageGroup[] {
  if (!form) return [];
  const pageMap = new Map<number, PublicQuestion[]>();
  form.questions.forEach((question) => {
    const pageNumber = Number(question.pageNumber || 1);
    const list = pageMap.get(pageNumber) || [];
    list.push(question);
    pageMap.set(pageNumber, list);
  });
  return [...pageMap.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([pageNumber, questions]) => ({
      pageNumber,
      title: `Page ${pageNumber}`,
      questions: [...questions].sort((a, b) => Number(a.displayOrder || 0) - Number(b.displayOrder || 0)),
    }));
}

export function getRenderedPageGroups(form: PublicSurveyForm | null): PageGroup[] {
  const groups = getPageGroups(form);
  if (!form) return [];
  if (form.configuration?.multiPage === false) {
    return [{
      pageNumber: 1,
      title: form.title || "Survey Form",
      questions: groups.flatMap((group) => group.questions).filter((q) => q.type !== "HeroCover"),
    }];
  }

  const processedGroups = groups.map((group) => {
    const hasOnlyHeroCover =
      group.questions.length > 0 &&
      group.questions.every((q) => q.type === "HeroCover");

    if (hasOnlyHeroCover) {
      return { ...group, questions: [] };
    }

    return {
      ...group,
      questions: group.questions.filter((q) => q.type !== "HeroCover"),
    };
  });

  return processedGroups.filter((group, index) => {
    if (group.questions.length > 0) return true;
    return index === 0;
  });
}

// ─── Rendered Questions Builder ─────────────────────────────────────

function toContextElementId(baseId: string, appName: string): string {
  const safe = encodeURIComponent(appName.trim().toLowerCase());
  return `${baseId}__app__${safe || "selected"}`;
}

function hasSelectedValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return false;
}

export function getMappedSelectionValues(selector: PreviewElement | null, values: Record<string, unknown>): string[] {
  if (!selector) return [];
  const raw = values[selector.id];
  if (Array.isArray(raw)) {
    return Array.from(new Set(raw.map((item) => String(item || "").trim()).filter(Boolean)));
  }
  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }
  return [];
}

export function buildRenderedQuestionsForPage(page: PageGroup | null, values: Record<string, unknown>): RenderedQuestion[] {
  if (!page) return [];

  const normalizedElements = page.questions.map(normalizeQuestion);
  const mappedSelectorIndex = normalizedElements.findIndex(
    (item) =>
      (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
      (item.dataSource === "app_department" || item.dataSource === "app_function"),
  );
  const mappedSelector = mappedSelectorIndex >= 0 ? normalizedElements[mappedSelectorIndex] : null;
  const selectedMappedApps = getMappedSelectionValues(mappedSelector, values);
  const beforeSelector = mappedSelectorIndex >= 0 ? normalizedElements.slice(0, mappedSelectorIndex + 1) : normalizedElements;
  const afterSelector = mappedSelectorIndex >= 0 ? normalizedElements.slice(mappedSelectorIndex + 1) : [];
  const repeatableAfterSelector = afterSelector.filter((item) => item.displayCondition === "after_mapped_selection");
  const alwaysVisibleAfterSelector = afterSelector.filter((item) => item.displayCondition !== "after_mapped_selection");
  const questionMap = new Map(page.questions.map((question) => [question.questionId, question]));

  const baseQuestions = [...beforeSelector, ...alwaysVisibleAfterSelector].map((element) => ({
    element,
    sourceQuestion: questionMap.get(element.id) as PublicQuestion,
    baseQuestionId: element.id,
  }));

  if (!mappedSelector || repeatableAfterSelector.length === 0 || !hasSelectedValue(values[mappedSelector.id])) {
    return baseQuestions;
  }

  const repeatedQuestions = selectedMappedApps.flatMap((appName) => {
    return repeatableAfterSelector.map((element) => {
      const resolvedSourceId = element.conditionalRequiredSourceId
        ? toContextElementId(element.conditionalRequiredSourceId, appName)
        : element.type === "text"
          ? (() => {
              const idx = repeatableAfterSelector.indexOf(element);
              for (let i = idx - 1; i >= 0; i--) {
                const prev = repeatableAfterSelector[i];
                if (prev.type === "likert" || prev.type === "rating") {
                  return toContextElementId(prev.id, appName);
                }
              }
              return undefined;
            })()
          : undefined;

      return {
        element: {
          ...element,
          id: toContextElementId(element.id, appName),
          title: element.type === "text"
            ? element.title
            : `${element.title || "Question"} (${appName})`,
          conditionalRequiredSourceId: resolvedSourceId,
          conditionalRequiredThreshold: element.conditionalRequiredThreshold ?? 7,
        },
        sourceQuestion: questionMap.get(element.id) as PublicQuestion,
        applicationName: appName,
        baseQuestionId: element.id,
      };
    });
  });

  return [...baseQuestions, ...repeatedQuestions];
}

// ─── Respondent Identity ────────────────────────────────────────────

function getStorageIdentityKey(surveyId: string): string {
  return `csi.respondent.${surveyId}`;
}

function normalizeEmail(value: string): string {
  const email = value.trim().toLowerCase();
  if (!email) return "";
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

export function getOrCreateRespondentLocalId(surveyId: string): string {
  const storageKey = getStorageIdentityKey(surveyId);
  try {
    const existing = localStorage.getItem(storageKey);
    if (existing && /^[a-z0-9-]{6,64}$/i.test(existing)) {
      return existing.toLowerCase();
    }
  } catch { /* SSR / incognito */ }

  const randomId = (() => {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch { /* fallback */ }
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  })();
  const localId = `respondent-${randomId}`.slice(0, 64);

  try {
    localStorage.setItem(storageKey, localId);
  } catch { /* SSR / incognito */ }

  return localId;
}

export function getInitialRespondent(surveyId: string, searchParams: URLSearchParams) {
  const name = String(searchParams.get("respondentName") || searchParams.get("name") || "").trim().slice(0, 200);
  const email = normalizeEmail(String(searchParams.get("respondentEmail") || searchParams.get("email") || ""));
  getOrCreateRespondentLocalId(surveyId);
  return { name: name || "", email };
}

// ─── Conditional Requirements ───────────────────────────────────────

export function isConditionallyRequired(element: PreviewElement, values: Record<string, unknown>): boolean {
  if (!element.conditionalRequiredSourceId) return false;
  const threshold = Math.max(1, Math.round(Number(element.conditionalRequiredThreshold || 7)));
  const sourceValue = values[element.conditionalRequiredSourceId];
  const numericValue = Number(sourceValue);
  if (Number.isFinite(numericValue) && numericValue > 0 && numericValue < threshold) {
    return true;
  }

  if (typeof sourceValue === "object" && sourceValue && !Array.isArray(sourceValue)) {
    const scores = Object.values(sourceValue as Record<string, unknown>)
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
    if (scores.length > 0) {
      const avg = scores.reduce((sum, item) => sum + item, 0) / scores.length;
      return avg < threshold;
    }
  }

  return false;
}

// ─── Response Value Building ────────────────────────────────────────

export type ResponseValue = {
  textValue?: string | null;
  dateValue?: string | null;
  numericValue?: number | null;
  matrixValues?: Record<string, number> | null;
  commentValue?: string | null;
};

export function buildResponseValue(
  element: PreviewElement,
  values: Record<string, unknown>,
  commentValues: Record<string, string>,
): ResponseValue {
  if (element.type === "text" || element.type === "dropdown" || element.type === "signature") {
    return { textValue: String(values[element.id] || "").trim() || null };
  }

  if (element.type === "choice" || element.type === "checkbox") {
    const value = values[element.id];
    if (Array.isArray(value)) {
      return { textValue: value.join(", ") || null };
    }
    return { textValue: String(value || "").trim() || null };
  }

  if (element.type === "rating") {
    const numericValue = Number(values[element.id] || 0);
    return {
      numericValue: Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null,
      commentValue: commentValues[element.id]?.trim() || null,
    };
  }

  if (element.type === "date") {
    return { dateValue: String(values[element.id] || "").trim() || null };
  }

  if (element.type === "likert") {
    const rawOptions = element.options;
    const lastItem = rawOptions[rawOptions.length - 1];
    const lastAsNum = Number(lastItem);
    const hasScaleAtEnd = rawOptions.length > 0 && Number.isFinite(lastAsNum) && lastAsNum >= 1 && lastAsNum <= 10 && String(Math.round(lastAsNum)) === String(lastItem);
    const rows = hasScaleAtEnd ? rawOptions.slice(0, -1) : rawOptions;

    const matrixValues = Object.fromEntries(
      rows.map((_, rowIdx) => {
        const key = `${element.id}-${rowIdx}`;
        return [rowIdx, Number(values[key] || 0)];
      }).filter(([, value]) => Number.isFinite(value) && value > 0),
    );

    const rowComments: Record<number, string> = {};
    if (element.likertEnableComment !== false) {
      rows.forEach((_, rowIdx) => {
        const commentKey = `${element.id}-comment-${rowIdx}`;
        const comment = String(values[commentKey] || "").trim();
        if (comment) rowComments[rowIdx] = comment;
      });
    }

    return {
      matrixValues: Object.keys(matrixValues).length > 0 ? matrixValues : null,
      commentValue: Object.keys(rowComments).length > 0 ? JSON.stringify(rowComments) : null,
    };
  }

  if (element.type === "matrix") {
    const matrixPrefix = `${element.id}-m-`;
    const rowIndices = [...new Set(
      Object.keys(values)
        .filter((key) => key.startsWith(matrixPrefix))
        .map((key) => parseInt(key.slice(matrixPrefix.length), 10))
        .filter((idx) => Number.isFinite(idx)),
    )];
    const matrixValues = Object.fromEntries(
      rowIndices.map((rowIdx) => {
        const key = `${element.id}-m-${rowIdx}`;
        return [rowIdx, Number(values[key])];
      }).filter(([, value]) => Number.isFinite(value) && value > 0),
    );
    return { matrixValues: Object.keys(matrixValues).length > 0 ? matrixValues : null };
  }

  return { textValue: null };
}

export function hasResponseValue(value: ResponseValue): boolean {
  return Boolean(
    value.textValue ||
    value.dateValue ||
    value.numericValue ||
    (value.matrixValues && Object.keys(value.matrixValues).length > 0) ||
    value.commentValue,
  );
}
