"use client";

import {
  sanitizeSurveyDescription,
  type BuilderElement,
  type BuilderPage,
  type BuilderTemplate,
  type DataSourceType,
  type FontPreset,
} from "./builder-definitions";
import {
  buildTempElementId,
  ensureUniqueElementIds,
  parseOptions,
  renumberPages,
  toIsoDateTime,
} from "./builder-utils";

type EventStatus = "Draft" | "Active";

interface MasterDataCatalog {
  businessUnits: Array<{ Name: string }>;
  divisions: Array<{ Name: string }>;
  departments: Array<{ Name: string }>;
  functions: Array<{ Name: string }>;
}

interface EventDraftState {
  surveyTitle: string;
  surveyDesc: string;
  targetRespondents: string;
  targetScore: string;
  scheduleStart: string;
  scheduleEnd: string;
}

interface EventStyleState {
  logo: string;
  bgColor: string;
  bgImage: string;
  font: FontPreset;
  heroTitle: string;
  heroSubtitle: string;
  primaryColor: string;
  secondaryColor: string;
  buttonStyle: "rounded" | "pill" | "square";
  showProgressBar: boolean;
  showPageNumbers: boolean;
  multiPage: boolean;
  heroImagePositionX: number;
  heroImagePositionY: number;
  logoPositionX: number;
  logoPositionY: number;
  backgroundPositionX: number;
  backgroundPositionY: number;
}

export function applyMasterDataSource(
  source: DataSourceType,
  element: BuilderElement,
  masterData: MasterDataCatalog,
): BuilderElement {
  if (source === "bu") {
    return { ...element, dataSource: source, options: masterData.businessUnits.map((item) => item.Name) };
  }
  if (source === "division") {
    return { ...element, dataSource: source, options: masterData.divisions.map((item) => item.Name) };
  }
  if (source === "department") {
    return { ...element, dataSource: source, options: masterData.departments.map((item) => item.Name) };
  }
  if (source === "function") {
    return { ...element, dataSource: source, options: masterData.functions.map((item) => item.Name) };
  }
  if (source === "app_department" || source === "app_function") {
    return { ...element, dataSource: source, options: [] };
  }

  return {
    ...element,
    dataSource: "manual",
    options: element.options.length > 0 ? element.options : ["Option 1"],
  };
}

export function hasMappedSelectorInPage(elements: BuilderElement[]): boolean {
  return elements.some(
    (item) =>
      (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
      (item.dataSource === "app_department" || item.dataSource === "app_function"),
  );
}

export function shouldShowVisibilityControl(elements: BuilderElement[], elementIndex: number): boolean {
  const mappedSelectorIndex = elements.findIndex(
    (item) =>
      (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
      (item.dataSource === "app_department" || item.dataSource === "app_function"),
  );

  if (mappedSelectorIndex === -1 || elementIndex <= mappedSelectorIndex) {
    return false;
  }

  const current = elements[elementIndex];
  return ["rating", "likert", "matrix", "text", "date", "signature", "choice", "checkbox", "dropdown"].includes(current.type);
}

export function buildEventUpdatePayload(state: EventDraftState, status: EventStatus) {
  const parsedTargetRespondents =
    state.targetRespondents.trim() === "" ? undefined : Number(state.targetRespondents);
  const parsedTargetScore =
    state.targetScore.trim() === "" ? undefined : Number(state.targetScore);

  return {
    title: state.surveyTitle || "Untitled Form",
    description: sanitizeSurveyDescription(state.surveyDesc),
    status,
    targetRespondents: Number.isFinite(parsedTargetRespondents) ? parsedTargetRespondents : undefined,
    targetScore: Number.isFinite(parsedTargetScore) ? parsedTargetScore : undefined,
    startDate: toIsoDateTime(state.scheduleStart, "start"),
    endDate: toIsoDateTime(state.scheduleEnd, "end"),
  };
}

export function buildEventConfigurationPayload(state: EventDraftState, style: EventStyleState) {
  // Skip data URLs — images should already be uploaded and stored as server paths
  const safeUrl = (url: string | undefined | null): string | null => {
    if (!url) return null;
    if (url.startsWith("data:")) return null;
    return url;
  };

  return {
    HeroTitle: style.heroTitle || state.surveyTitle || null,
    HeroSubtitle: style.heroSubtitle || sanitizeSurveyDescription(state.surveyDesc) || null,
    LogoUrl: safeUrl(style.logo),
    BackgroundColor: style.bgColor || null,
    BackgroundImageUrl: safeUrl(style.bgImage),
    FontFamily: style.font === "default" ? null : style.font,
    PrimaryColor: style.primaryColor || null,
    SecondaryColor: style.secondaryColor || null,
    ButtonStyle: style.buttonStyle,
    ShowProgressBar: style.showProgressBar,
    ShowPageNumbers: style.showPageNumbers,
    MultiPage: style.multiPage,
    HeroImagePositionX: style.heroImagePositionX,
    HeroImagePositionY: style.heroImagePositionY,
    LogoPositionX: style.logoPositionX,
    LogoPositionY: style.logoPositionY,
    BackgroundPositionX: style.backgroundPositionX,
    BackgroundPositionY: style.backgroundPositionY,
  };
}

export function buildTemplatePages(template: BuilderTemplate, elementCounter: number) {
  let nextCounter = elementCounter;
  const indexedElements: BuilderElement[] = [];

  const nextPages: BuilderPage[] = template.pages.map((page, pageIndex) => {
    const nextElements = page.elements.map((element) => {
      nextCounter += 1;
      const nextElement: BuilderElement = {
        id: buildTempElementId(nextCounter),
        type: element.type,
        title: element.title,
        subtitle: element.subtitle || "",
        required: Boolean(element.required),
        options: Array.isArray(element.options) && element.options.length > 0
          ? [...element.options]
          : parseOptions(undefined, element.type),
        coverUrl: "",
        dataSource: element.dataSource || "manual",
        optionLayout: element.optionLayout || (element.type === "choice" || element.type === "checkbox" ? "vertical" : undefined),
        allowMultipleAnswers: element.type === "choice" ? Boolean(element.allowMultipleAnswers) : undefined,
        displayCondition: element.displayCondition || "always",
        conditionalRequiredSourceId: undefined,
        conditionalRequiredThreshold: element.conditionalRequiredThreshold,
      };

      indexedElements.push(nextElement);
      return nextElement;
    });

    return {
      id: pageIndex + 1,
      title: page.title,
      elements: nextElements,
    };
  });

  template.pages.forEach((page, pageIndex) => {
    page.elements.forEach((element, elementIndex) => {
      if (element.conditionalRequiredSourceIndex == null) {
        return;
      }

      const currentOffset = template.pages
        .slice(0, pageIndex)
        .reduce((sum, item) => sum + item.elements.length, 0);
      const currentAbsolute = currentOffset + elementIndex;
      const sourceAbsolute = currentOffset + element.conditionalRequiredSourceIndex;

      if (sourceAbsolute < 0 || sourceAbsolute >= indexedElements.length) {
        return;
      }
      if (currentAbsolute < 0 || currentAbsolute >= indexedElements.length) {
        return;
      }

      indexedElements[currentAbsolute].conditionalRequiredSourceId = indexedElements[sourceAbsolute].id;
      if (!indexedElements[currentAbsolute].conditionalRequiredThreshold) {
        indexedElements[currentAbsolute].conditionalRequiredThreshold = 7;
      }
    });
  });

  return {
    nextCounter,
    pages: ensureUniqueElementIds(renumberPages(nextPages)),
  };
}
