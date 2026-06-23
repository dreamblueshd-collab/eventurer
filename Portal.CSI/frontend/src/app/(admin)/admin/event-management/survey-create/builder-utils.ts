import type { SurveyQuestion } from "@/types/survey";
import type {
  BuilderElement,
  BuilderPage,
  DataSourceType,
  ElementType,
  ProfileFieldType,
} from "./builder-definitions";

export type ScheduleInputMode = "date" | "datetime";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDatePortion(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatDateTimePortion(date: Date): string {
  return `${formatDatePortion(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isEndOfDay(date: Date): boolean {
  return date.getHours() === 23 && date.getMinutes() === 59;
}

function isStartOfDay(date: Date): boolean {
  return date.getHours() === 0 && date.getMinutes() === 0;
}

export function toDateTimeInput(value?: string | null): string {
  if (!value) return "";
  const normalized = String(value).trim().replace(" ", "T").replace(/Z$/i, "");
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return "";
  const [, year, month, day, hour, minute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function parseServerLocalDateTime(value?: string | null): Date | null {
  if (!value) return null;
  const normalized = String(value).trim().replace(" ", "T").replace(/Z$/i, "");
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d+))?$/,
  );
  if (!match) return null;
  const [, year, month, day, hour, minute = "0", second = "0", fraction = "0"] = match;
  const milliseconds = Number(String(fraction).slice(0, 3).padEnd(3, "0"));
  const parsed = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    milliseconds,
  );
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function toScheduleInputValue(
  value?: string | null,
  boundary: "start" | "end" = "start",
): string {
  const parsed = parseServerLocalDateTime(value);
  if (!parsed) return "";
  if ((boundary === "start" && isStartOfDay(parsed)) || (boundary === "end" && isEndOfDay(parsed))) {
    return formatDatePortion(parsed);
  }
  return formatDateTimePortion(parsed);
}

export function parseScheduleInputDate(
  value?: string | null,
  boundary: "start" | "end" = "start",
): Date | null {
  if (!value) return null;
  const normalized = String(value).trim();
  const dateOnly = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      boundary === "start" ? 0 : 23,
      boundary === "start" ? 0 : 59,
      boundary === "start" ? 0 : 59,
      0,
    );
  }
  return parseServerLocalDateTime(normalized);
}

export function detectScheduleInputMode(
  startValue?: string | null,
  endValue?: string | null,
): ScheduleInputMode {
  if ((startValue && !String(startValue).includes("T")) || (endValue && !String(endValue).includes("T"))) {
    return "date";
  }

  const start = parseScheduleInputDate(startValue, "start");
  const end = parseScheduleInputDate(endValue, "end");
  if (start && end && isStartOfDay(start) && isEndOfDay(end)) {
    return "date";
  }

  return "datetime";
}

export function toIsoDateTime(
  value?: string,
  boundary: "start" | "end" = "start",
): string | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim();
  const dateOnly = normalized.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) {
    return `${dateOnly[1]}T${boundary === "start" ? "00:00:00" : "23:59:59"}`;
  }
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return undefined;
  const [, date, hour, minute] = match;
  return `${date}T${hour}:${minute}:00`;
}

export function formatScheduleValue(value?: string | null): string {
  if (!value) return "-";
  const isDateOnly = !String(value).includes("T");
  const parsed = parseScheduleInputDate(value, isDateOnly ? "start" : "start");
  if (!parsed || Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(
    "id-ID",
    isDateOnly
      ? {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      : {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        },
  ).format(parsed);
}

export function formatScheduleValueWithSeconds(value?: string | Date, now: Date = new Date()): string {
  if (!value) return "-";
  const parsed = value instanceof Date ? value : (parseServerLocalDateTime(value) || now);
  if (Number.isNaN(parsed.getTime())) {
    return value instanceof Date ? value.toLocaleString("id-ID") : value;
  }
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || undefined,
  }).format(parsed);
}

function mapType(value: string): ElementType {
  if (value === "HeroCover") return "hero";
  if (value === "MultipleChoice") return "choice";
  if (value === "Checkbox") return "checkbox";
  if (value === "Dropdown") return "dropdown";
  if (value === "Rating") return "rating";
  if (value === "MatrixLikert") return "likert";
  if (value === "Date") return "date";
  if (value === "Signature") return "signature";
  return "text";
}

export function mapTypeWithOptions(value: string, options: unknown): ElementType {
  if (value !== "MatrixLikert") {
    return mapType(value);
  }

  if (options && typeof options === "object") {
    const variant = String((options as { variant?: unknown }).variant || "").toLowerCase();
    if (variant === "matrix") return "matrix";
  }

  return "likert";
}

export function toApiType(value: ElementType): string {
  if (value === "hero") return "HeroCover";
  if (value === "choice") return "MultipleChoice";
  if (value === "checkbox") return "Checkbox";
  if (value === "dropdown") return "Dropdown";
  if (value === "rating") return "Rating";
  if (value === "likert" || value === "matrix") return "MatrixLikert";
  if (value === "date") return "Date";
  if (value === "signature") return "Signature";
  return "Text";
}

export function extractQuestionId(builderId: string): string | null {
  if (!builderId.startsWith("q-")) return null;
  return builderId.slice(2);
}

export function normalizeUploadedMediaUrl(url?: string | null): string {
  let raw = String(url || "").trim();
  if (!raw) return "";

  raw = raw.replace(/\\/g, "/");

  if (raw.startsWith("data:")) {
    return raw;
  }

  const uploadPathMatch = raw.match(/\/uploads\/(surveys|questions|options)\/[^?#]+/i);
  if (uploadPathMatch?.[0]) {
    const uploadPath = uploadPathMatch[0].replace(/\/{2,}/g, "/");
    if (/^https?:\/\//i.test(raw)) {
      const originMatch = raw.match(/^(https?:\/\/[^/]+)/i);
      if (originMatch?.[1]) {
        return `${originMatch[1]}${uploadPath}`;
      }
    }
    return uploadPath;
  }

  if (/^https?:\/\/[^/]+\/(surveys|questions|options)\//i.test(raw)) {
    return raw.replace(/^(https?:\/\/[^/]+)\/(surveys|questions|options)\//i, "$1/uploads/$2/");
  }

  if (/^\/(surveys|questions|options)\//i.test(raw)) {
    return raw.replace(/^\/(surveys|questions|options)\//i, "/uploads/$1/");
  }

  if (/^(surveys|questions|options)\//i.test(raw)) {
    return `/uploads/${raw}`;
  }

  if (/^uploads\/(surveys|questions|options)\//i.test(raw)) {
    return `/${raw}`;
  }

  if (/^[^/\\]+\.(png|jpe?g|webp|gif|svg)$/i.test(raw)) {
    return `/uploads/questions/${raw}`;
  }

  return raw;
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob | null> {
  if (!dataUrl.startsWith("data:")) return null;
  try {
    const response = await fetch(dataUrl);
    if (!response.ok) return null;
    return await response.blob();
  } catch {
    return null;
  }
}

export function parseOptions(raw: unknown, elementType: ElementType): string[] {
  if (Array.isArray(raw)) return raw.map((v) => String(v));

  if (raw && typeof raw === "object") {
    const data = raw as {
      options?: unknown[];
      rows?: unknown[];
      columns?: unknown[];
      ratingScale?: unknown;
    };

    if (elementType === "matrix" && Array.isArray(data.columns)) {
      return data.columns.map((v) => String(v));
    }

    if (elementType === "likert" && Array.isArray(data.rows)) {
      return data.rows.map((v) => String(v));
    }

    if (Array.isArray(data.options)) return data.options.map((v) => String(v));
    if (elementType === "rating" && typeof data.ratingScale !== "undefined") {
      return [String(data.ratingScale)];
    }
    if (elementType === "likert" && typeof data.ratingScale !== "undefined") {
      // ratingScale untuk likert disimpan terpisah, rows tetap di data.rows
      return Array.isArray(data.rows) ? data.rows.map((v) => String(v)) : [];
    }
  }

  if (elementType === "rating") return ["10"];
  if (elementType === "likert") return ["Statement 1", "Statement 2"];
  if (elementType === "matrix") return ["Column 1", "Column 2", "Column 3"];
  return ["Option 1"];
}

export function parseDataSource(raw: unknown): DataSourceType {
  if (!raw || typeof raw !== "object") return "manual";
  const value = String((raw as { dataSource?: unknown }).dataSource || "manual");
  if (
    value === "bu" ||
    value === "division" ||
    value === "department" ||
    value === "function" ||
    value === "app_department" ||
    value === "app_function"
  ) {
    return value;
  }
  return "manual";
}

export function parseOptionLayout(raw: unknown, elementType: ElementType): "vertical" | "horizontal" {
  if (elementType !== "choice" && elementType !== "checkbox") return "vertical";
  if (!raw || typeof raw !== "object") return "vertical";
  const value = String((raw as { layout?: unknown }).layout || "vertical").toLowerCase();
  return value === "horizontal" ? "horizontal" : "vertical";
}

export function parseAllowMultipleAnswers(raw: unknown, elementType: ElementType): boolean {
  if (elementType !== "choice") return false;
  if (!raw || typeof raw !== "object") return false;
  return Boolean((raw as { allowMultipleAnswers?: unknown }).allowMultipleAnswers);
}

export function parseDisplayCondition(raw: unknown): "always" | "after_mapped_selection" {
  if (!raw || typeof raw !== "object") return "always";
  const value = String((raw as { displayCondition?: unknown }).displayCondition || "always");
  return value === "after_mapped_selection" ? "after_mapped_selection" : "always";
}

export function parseConditionalRequiredSourceId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = (raw as { conditionalRequired?: { sourceElementId?: unknown } }).conditionalRequired;
  const sourceId = String(value?.sourceElementId || "").trim();
  return sourceId || undefined;
}

export function parseConditionalRequiredThreshold(raw: unknown): number | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = (raw as { conditionalRequired?: { threshold?: unknown } }).conditionalRequired;
  const parsed = Number(value?.threshold);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.min(10, Math.max(1, Math.round(parsed)));
}

export function inferProfileField(element: BuilderElement): ProfileFieldType {
  if (element.dataSource === "bu") return "bu";
  if (element.dataSource === "division") return "division";
  if (element.dataSource === "department") return "department";
  if (element.dataSource === "function") return "function";

  const title = (element.title || "").trim().toLowerCase();
  if (title.includes("business unit") || title === "bu") return "bu";
  if (title.includes("division") || title.includes("divisi") || title === "div") return "division";
  if (title.includes("department") || title.includes("departemen") || title.includes("dept")) return "department";
  if (title.includes("function")) return "function";
  return null;
}

export function toPages(questions?: SurveyQuestion[]): BuilderPage[] {
  if (!questions || questions.length === 0) return [];
  const map = new Map<number, BuilderElement[]>();
  questions.forEach((q, idx) => {
    const resolvedType = mapTypeWithOptions(q.Type, q.Options);
    const page = q.PageNumber || 1;
    if (!map.has(page)) map.set(page, []);
    map.get(page)?.push({
      id: q.QuestionId ? `q-${q.QuestionId}` : `q-${idx + 1}`,
      type: resolvedType,
      title: q.PromptText || "",
      subtitle: q.Subtitle || "",
      required: Boolean(q.IsMandatory),
      options: parseOptions(q.Options, resolvedType),
      coverUrl: resolvedType === "hero" ? normalizeUploadedMediaUrl(q.ImageUrl) : "",
      ratingScale: (() => {
        if (resolvedType === "likert" && q.Options && typeof q.Options === "object") {
          const scale = Number((q.Options as Record<string, unknown>).ratingScale);
          return Number.isFinite(scale) && scale >= 1 ? Math.min(10, Math.round(scale)) : 10;
        }
        return undefined;
      })(),
      dataSource: parseDataSource(q.Options),
      optionLayout: parseOptionLayout(q.Options, resolvedType),
      allowMultipleAnswers: parseAllowMultipleAnswers(q.Options, resolvedType),
      displayCondition: parseDisplayCondition(q.Options),
      conditionalRequiredSourceId: parseConditionalRequiredSourceId(q.Options),
      conditionalRequiredThreshold: parseConditionalRequiredThreshold(q.Options),
      likertCommentThreshold: (() => {
        if (resolvedType !== "likert" || !q.Options || typeof q.Options !== "object") return undefined;
        const val = Number((q.Options as Record<string, unknown>).commentThreshold);
        return Number.isFinite(val) && val >= 1 ? Math.min(10, Math.round(val)) : 7;
      })(),
      likertEnableComment: (() => {
        if (resolvedType !== "likert" || !q.Options || typeof q.Options !== "object") return undefined;
        const val = (q.Options as Record<string, unknown>).enableComment;
        // default true jika tidak ada field
        return val === false ? false : true;
      })(),
    });
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([id, elements]) => {
      // Page yang hanya berisi HeroCover → title dikosongkan
      const isHeroCoverOnly = elements.length > 0 && elements.every((el) => el.type === "hero");
      return {
        id,
        title: isHeroCoverOnly ? "" : (id === 1 ? "Welcome" : `Page ${id}`),
        elements,
      };
    });
}

export function buildTempElementId(counter: number): string {
  return `new-${counter}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getMaxTempElementCounter(pages: BuilderPage[]): number {
  let max = 0;
  pages.forEach((page) => {
    page.elements.forEach((element) => {
      const match = element.id.match(/^new-(\d+)/);
      if (match) {
        const value = Number(match[1]);
        if (!Number.isNaN(value)) {
          max = Math.max(max, value);
        }
      }
    });
  });
  return max;
}

export function ensureUniqueElementIds(pages: BuilderPage[]): BuilderPage[] {
  const seen = new Set<string>();
  let duplicateCounter = 0;

  return pages.map((page) => ({
    ...page,
    elements: page.elements.map((element) => {
      if (!seen.has(element.id)) {
        seen.add(element.id);
        return element;
      }

      duplicateCounter += 1;
      const nextId = buildTempElementId(100000 + duplicateCounter);
      seen.add(nextId);
      return { ...element, id: nextId };
    }),
  }));
}

export function normalizePagesForState(pages: BuilderPage[]): { pages: BuilderPage[]; changed: boolean } {
  let changed = false;

  const normalized = pages.map((page) => {
    const seen = new Set<string>();
    let duplicateCounter = 0;

    const elements = page.elements.map((element) => {
      if (!seen.has(element.id)) {
        seen.add(element.id);
        return element;
      }

      duplicateCounter += 1;
      changed = true;
      const nextId = buildTempElementId(200000 + duplicateCounter);
      seen.add(nextId);
      return { ...element, id: nextId };
    });

    return { ...page, elements };
  });

  return { pages: normalized, changed };
}

export function newElement(type: ElementType, tempId: string): BuilderElement {
  const defaultOptions =
    type === "rating"
      ? ["10"]
      : type === "likert"
        ? ["Statement 1", "Statement 2"]
        : type === "matrix"
          ? ["Column 1", "Column 2", "Column 3"]
          : ["Option 1"];

  return {
    id: tempId,
    type,
    title: type === "hero" ? "Hero title" : "Question",
    subtitle: "",
    required: false,
    options: defaultOptions,
    coverUrl: "",
    ratingScale: type === "likert" ? 10 : undefined,
    dataSource: "manual",
    optionLayout: type === "choice" || type === "checkbox" ? "vertical" : undefined,
    allowMultipleAnswers: type === "choice" ? false : undefined,
    displayCondition: "always",
    conditionalRequiredSourceId: undefined,
    conditionalRequiredThreshold: undefined,
  };
}

export function getCorpTemplatePages(): BuilderPage[] {
  return [
    {
      id: 1,
      title: "Welcome",
      elements: [
        {
          id: "tpl-hero-1",
          type: "hero",
          title: "Corporate IT & BPM Survey 2026",
          subtitle: "",
          required: false,
          options: [],
          coverUrl: "",
        },
      ],
    },
    {
      id: 2,
      title: "Profil Responden",
      elements: [
        {
          id: "tpl-dropdown-1",
          type: "dropdown",
          title: "Business Unit",
          subtitle: "",
          required: true,
          options: ["Corporate", "Main Dealer", "Logistics"],
          coverUrl: "",
        },
      ],
    },
  ];
}

function isAutoTitle(title: string, id: number): boolean {
  return title === `Page ${id}`;
}

export function renumberPages(pages: BuilderPage[]): BuilderPage[] {
  return pages.map((page, index) => {
    const nextId = index + 1;
    return {
      ...page,
      id: nextId,
      title: isAutoTitle(page.title, page.id) ? `Page ${nextId}` : page.title,
    };
  });
}
