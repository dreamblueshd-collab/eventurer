"use client";

/* eslint-disable @next/next/no-img-element */

import { useState } from "react";
import type { BusinessUnitOption, DepartmentOption, DivisionOption } from "@/lib/org-hierarchy";
import type { FunctionMaster } from "@/lib/master-data";
import SurveyPreviewElement from "@/components/survey/survey-preview-element";
import type { BuilderElement, BuilderPage } from "./builder-definitions";
import styles from "./survey-preview.module.css";

type PreviewDevice = "desktop" | "mobile";

/** Convert logoPositionX/Y to CSS inline style for logo overlay placement */
function getLogoPlacementInlineStyle(x: number, y: number): React.CSSProperties {
  const style: React.CSSProperties = { position: "absolute", zIndex: 10, background: "rgba(255,255,255,0.92)", borderRadius: "6px", padding: "4px 8px", pointerEvents: "none" };
  if (y <= 25) { style.top = "10px"; } else { style.bottom = "10px"; }
  if (x <= 25) { style.left = "10px"; }
  else if (x >= 75) { style.right = "10px"; }
  else { style.left = "50%"; style.transform = "translateX(-50%)"; }
  return style;
}

interface SurveyPreviewScreenProps {
  allBuilderElements: BuilderElement[];
  bgColor: string;
  bgImage: string;
  font: string;
  logo: string;
  mappedApplicationsByDepartment: string[];
  mappedApplicationsByFunction: string[];
  orgBusinessUnits: BusinessUnitOption[];
  orgDepartments: DepartmentOption[];
  orgDivisions: DivisionOption[];
  orgFunctions: FunctionMaster[];
  pages: BuilderPage[];
  previewDevice: PreviewDevice;
  previewValues: Record<string, unknown>;
  primaryColor: string;
  heroImagePositionX: number;
  heroImagePositionY: number;
  logoPositionX: number;
  logoPositionY: number;
  backgroundPositionX: number;
  backgroundPositionY: number;
  surveyDesc: string;
  surveyTitle: string;
  setPreviewDevice: (device: PreviewDevice) => void;
  setPreviewValue: (id: string, value: unknown) => void;
  setPreviewValuesBulk: (nextValues: Record<string, unknown>) => void;
  setShowPreview: (value: boolean) => void;
  togglePreviewCheckbox: (id: string, option: string) => void;
}

function hasSelectedPreviewValue(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  return false;
}

function getMappedSelectionValues(
  selector: BuilderElement | null,
  values: Record<string, unknown>,
): string[] {
  if (!selector) return [];
  const raw = values[selector.id];

  if (Array.isArray(raw)) {
    return Array.from(
      new Set(raw.map((item) => String(item || "").trim()).filter(Boolean)),
    );
  }

  if (typeof raw === "string" && raw.trim()) {
    return [raw.trim()];
  }

  return [];
}

function toContextElementId(baseId: string, appName: string): string {
  const safe = encodeURIComponent(appName.trim().toLowerCase());
  return `${baseId}__app__${safe || "selected"}`;
}

function isConditionallyRequired(
  element: BuilderElement,
  values: Record<string, unknown>,
): boolean {
  if (!element.conditionalRequiredSourceId) return false;
  const threshold = Math.min(
    10,
    Math.max(1, Math.round(Number(element.conditionalRequiredThreshold || 7))),
  );
  const sourceId = element.conditionalRequiredSourceId;
  const directValue = Number(values[sourceId] || 0);

  let sourceValue = Number.isFinite(directValue) && directValue > 0 ? directValue : 0;
  if (sourceValue <= 0) {
    const rowValues = Object.entries(values)
      .filter(([key]) => key.startsWith(`${sourceId}-`))
      .map(([, value]) => {
        const text = String(value ?? "").trim();
        const parsed = Number(text);
        if (Number.isFinite(parsed)) {
          return parsed;
        }
        return null;
      })
      .filter((value): value is number => value !== null && value > 0);

    if (rowValues.length > 0) {
      sourceValue = rowValues.reduce((sum, current) => sum + current, 0) / rowValues.length;
    }
  }

  if (!Number.isFinite(sourceValue) || sourceValue <= 0) return false;
  return sourceValue < threshold;
}

export default function SurveyPreviewScreen({
  allBuilderElements,
  bgColor,
  bgImage,
  font,
  logo,
  mappedApplicationsByDepartment,
  mappedApplicationsByFunction,
  orgBusinessUnits,
  orgDepartments,
  orgDivisions,
  orgFunctions,
  pages,
  previewDevice,
  previewValues,
  primaryColor,
  heroImagePositionX: _heroImagePositionX,
  heroImagePositionY: _heroImagePositionY,
  logoPositionX,
  logoPositionY,
  backgroundPositionX: _backgroundPositionX,
  backgroundPositionY: _backgroundPositionY,
  surveyDesc,
  surveyTitle,
  setPreviewDevice,
  setPreviewValue,
  setPreviewValuesBulk,
  setShowPreview,
  togglePreviewCheckbox,
}: SurveyPreviewScreenProps) {
  const [currentPreviewPage, setCurrentPreviewPage] = useState(0);

  // Build rendered pages — sama seperti public survey:
  // page yang hanya HeroCover → welcome page (questions kosong)
  // page lain → filter HeroCover, tampilkan sisanya
  const renderedPages = pages.map((page) => {
    const hasOnlyHero = page.elements.length > 0 && page.elements.every((el) => el.type === "hero");
    if (hasOnlyHero) return { ...page, elements: [] };
    return { ...page, elements: page.elements.filter((el) => el.type !== "hero") };
  }).filter((page, index) => {
    if (page.elements.length > 0) return true;
    return index === 0; // pertahankan welcome page di index 0
  });

  const heroCoverEl = pages.flatMap((p) => p.elements).find((el) => el.type === "hero");
  const heroImageUrl = heroCoverEl?.coverUrl || "";
  const currentPage = renderedPages[currentPreviewPage] || null;
  const totalPages = renderedPages.length;
  const progressPercent = totalPages === 0 ? 0 : ((currentPreviewPage + 1) / totalPages) * 100;
  const isWelcomePage = currentPage !== null && currentPage.elements.length === 0;
  return (
    <div className={styles.previewScreen}>
      <div className={styles.previewTopbar}>
        <div>
          <h2 className={styles.previewTitle}>👁️ Survey Preview</h2>
          <div className={styles.previewSub}>Mode tampilan responden</div>
        </div>
        <div className={styles.previewDeviceTabs} role="tablist" aria-label="Preview device mode">
          <button
            type="button"
            role="tab"
            aria-label="Computer View"
            aria-selected={previewDevice === "desktop"}
            className={`${styles.previewDeviceTab} ${previewDevice === "desktop" ? styles.previewDeviceTabActive : ""}`}
            onClick={() => setPreviewDevice("desktop")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.25 3h15.5A2.25 2.25 0 0 1 22 5.25v10.5A2.25 2.25 0 0 1 19.75 18h-4.25v2.5h1.75a.75.75 0 1 1 0 1.5H6.75a.75.75 0 1 1 0-1.5H8.5V18H4.25A2.25 2.25 0 0 1 2 15.75V5.25A2.25 2.25 0 0 1 4.25 3Zm5.75 17.5h4V18h-4v2.5Z" />
            </svg>
            <span>🖥️ Computer</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-label="Mobile View"
            aria-selected={previewDevice === "mobile"}
            className={`${styles.previewDeviceTab} ${previewDevice === "mobile" ? styles.previewDeviceTabActive : ""}`}
            onClick={() => setPreviewDevice("mobile")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8.25 2h7.5A2.25 2.25 0 0 1 18 4.25v15.5A2.25 2.25 0 0 1 15.75 22h-7.5A2.25 2.25 0 0 1 6 19.75V4.25A2.25 2.25 0 0 1 8.25 2Zm0 1.5a.75.75 0 0 0-.75.75v15.5c0 .414.336.75.75.75h7.5a.75.75 0 0 0 .75-.75V4.25a.75.75 0 0 0-.75-.75h-7.5Z" />
            </svg>
            <span>📱 Mobile</span>
          </button>
        </div>
        <button className={styles.inlineButton} type="button" onClick={() => setShowPreview(false)}>← Kembali ke Builder</button>
      </div>
      <div className={styles.previewViewportWrap}>
        <div
          className={`${styles.previewViewport} ${
            previewDevice === "mobile" ? styles.previewViewportMobile : styles.previewViewportDesktop
          }`}
          style={{
            "--preview-primary": primaryColor || "#7b2b83",
            fontFamily: font || undefined,
          } as React.CSSProperties}
        >
          <div
            className={styles.previewFullBody}
            style={{
              backgroundColor: bgColor || "#f5f5f5",
              ...(bgImage
                ? {
                    backgroundImage: `url(${bgImage})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center center",
                    backgroundRepeat: "no-repeat",
                  }
                : {}),
            }}
          >
            {/* Survey card — mirip public survey */}
            <div className={styles.previewSurveyCard}>
              {/* Hero image */}
              <div className={styles.previewHeroWrap}>
                {heroImageUrl ? (
                  <img src={heroImageUrl} alt="Hero" className={styles.previewHeroImg} />
                ) : (
                  <div className={styles.previewHeroPlaceholderBar} />
                )}
                {logo ? (
                  <div className={styles.previewSurveyBrand} style={getLogoPlacementInlineStyle(logoPositionX, logoPositionY)}>
                    <img src={logo} alt="Logo" className={styles.previewSurveyLogo} />
                  </div>
                ) : null}
              </div>

              {/* Titlebar */}
              <div className={styles.previewTitlebar}>
                {surveyTitle || "Survey Title"}
              </div>

              {/* Subbar */}
              <div className={styles.previewSubbar}>
                {!isWelcomePage && surveyDesc.trim() ? <span className={styles.previewSubbarText}>{surveyDesc}</span> : null}
                <span className={`${styles.previewStatusBadge} ${styles.previewStatusActive}`}>Active</span>
                {totalPages > 1 ? (
                  <span style={{ fontSize: "11px", fontWeight: 600, opacity: 0.7 }}>
                    Page {currentPreviewPage + 1} / {totalPages}
                  </span>
                ) : null}
              </div>

              {/* Body */}
              <div className={styles.previewCardBody}>
                {/* Progress bar */}
                {totalPages > 1 ? (
                  <div className={styles.previewProgressWrap}>
                    <div className={styles.previewProgressTrack}>
                      <div className={styles.previewProgressBar} style={{ width: `${progressPercent}%` }} />
                    </div>
                    <div className={styles.previewProgressMeta}>{Math.round(progressPercent)}% selesai</div>
                  </div>
                ) : null}

                {/* Current page content */}
                {currentPage && !isWelcomePage ? (
                  <div className={styles.previewPage}>
                    <h4>{currentPage.title}</h4>
                    {(() => {
                      const page = currentPage;
                      const mappedSelectorIndex = page.elements.findIndex(
                        (item) =>
                          (item.type === "choice" || item.type === "checkbox" || item.type === "dropdown") &&
                          (item.dataSource === "app_department" || item.dataSource === "app_function"),
                      );
                      const mappedSelector = mappedSelectorIndex >= 0 ? page.elements[mappedSelectorIndex] : null;
                      const selectedMappedApps = getMappedSelectionValues(mappedSelector, previewValues);
                      const beforeSelector = mappedSelectorIndex >= 0
                        ? page.elements.slice(0, mappedSelectorIndex + 1)
                        : page.elements;
                      const afterSelector = mappedSelectorIndex >= 0 ? page.elements.slice(mappedSelectorIndex + 1) : [];
                      const repeatableAfterSelector = afterSelector.filter(
                        (item) => item.displayCondition === "after_mapped_selection",
                      );
                      const alwaysVisibleAfterSelector = afterSelector.filter(
                        (item) => item.displayCondition !== "after_mapped_selection",
                      );

                      return (
                        <>
                          {beforeSelector.map((element, elementIndex) => {
                            const effectiveRequired = element.required || isConditionallyRequired(element, previewValues);
                            const effectiveElement = { ...element, required: effectiveRequired };
                            return (
                              <div key={`pve-base-${page.id}-${element.id}-${elementIndex}`} className={styles.previewQuestion}>
                                {effectiveElement.title.trim()
                                  ? <div className={styles.previewLabel}>{effectiveElement.title}{effectiveElement.required ? <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span> : null}</div>
                                  : null}
                                {effectiveElement.subtitle ? <small>{effectiveElement.subtitle}</small> : null}
                                <SurveyPreviewElement
                                  element={effectiveElement}
                                  allElements={allBuilderElements}
                                  values={previewValues}
                                  onSetValue={setPreviewValue}
                                  onSetValuesBulk={setPreviewValuesBulk}
                                  onToggleCheckbox={togglePreviewCheckbox}
                                  orgData={{
                                    businessUnits: orgBusinessUnits,
                                    divisions: orgDivisions,
                                    departments: orgDepartments,
                                    functions: orgFunctions,
                                    mappedApplicationsByDepartment,
                                    mappedApplicationsByFunction,
                                  }}
                                />
                              </div>
                            );
                          })}

                          {mappedSelector && repeatableAfterSelector.length > 0 && hasSelectedPreviewValue(previewValues[mappedSelector.id]) ? (
                            selectedMappedApps.map((appName) => (
                              <div key={`pve-app-group-${page.id}-${appName}`} className={styles.previewAppGroup}>
                                <div className={styles.previewAppGroupTitle}>{appName}</div>
                                {repeatableAfterSelector.map((element, elementIndex) => {
                                  const contextSourceId = element.conditionalRequiredSourceId
                                    ? toContextElementId(element.conditionalRequiredSourceId, appName)
                                    : undefined;
                                  const contextElement = {
                                    ...element,
                                    id: toContextElementId(element.id, appName),
                                    title: `${element.title || "Question"} (${appName})`,
                                    conditionalRequiredSourceId: contextSourceId,
                                  };
                                  const effectiveRequired = contextElement.required || isConditionallyRequired(contextElement, previewValues);
                                  const effectiveElement = { ...contextElement, required: effectiveRequired };
                                  return (
                                    <div key={`pve-app-${page.id}-${element.id}-${elementIndex}-${appName}`} className={styles.previewQuestion}>
                                      {effectiveElement.title.trim() ? <div className={styles.previewLabel}>{effectiveElement.title}{effectiveElement.required ? <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span> : null}</div> : null}
                                      {effectiveElement.subtitle ? <small>{effectiveElement.subtitle}</small> : null}
                                      <SurveyPreviewElement
                                        element={effectiveElement}
                                        allElements={allBuilderElements}
                                        values={previewValues}
                                        onSetValue={setPreviewValue}
                                        onSetValuesBulk={setPreviewValuesBulk}
                                        onToggleCheckbox={togglePreviewCheckbox}
                                        orgData={{
                                          businessUnits: orgBusinessUnits,
                                          divisions: orgDivisions,
                                          departments: orgDepartments,
                                          functions: orgFunctions,
                                          mappedApplicationsByDepartment,
                                          mappedApplicationsByFunction,
                                        }}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            ))
                          ) : null}

                          {alwaysVisibleAfterSelector.map((element, elementIndex) => {
                            const effectiveRequired = element.required || isConditionallyRequired(element, previewValues);
                            const effectiveElement = { ...element, required: effectiveRequired };
                            return (
                              <div key={`pve-always-${page.id}-${element.id}-${elementIndex}`} className={styles.previewQuestion}>
                                {effectiveElement.title.trim()
                                  ? <div className={styles.previewLabel}>{effectiveElement.title}{effectiveElement.required ? <span style={{ color: "#ef4444", marginLeft: 2 }}>*</span> : null}</div>
                                  : null}
                                {effectiveElement.subtitle ? <small>{effectiveElement.subtitle}</small> : null}
                                <SurveyPreviewElement
                                  element={effectiveElement}
                                  allElements={allBuilderElements}
                                  values={previewValues}
                                  onSetValue={setPreviewValue}
                                  onSetValuesBulk={setPreviewValuesBulk}
                                  onToggleCheckbox={togglePreviewCheckbox}
                                  orgData={{
                                    businessUnits: orgBusinessUnits,
                                    divisions: orgDivisions,
                                    departments: orgDepartments,
                                    functions: orgFunctions,
                                    mappedApplicationsByDepartment,
                                    mappedApplicationsByFunction,
                                  }}
                                />
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                ) : null}

                {/* Nav */}
                <div className={`${styles.previewNav} ${isWelcomePage ? styles.previewNavCenter : ""}`}>
                  {!isWelcomePage ? (
                    <button
                      type="button"
                      className={styles.previewBtnGhost}
                      disabled={currentPreviewPage === 0}
                      onClick={() => setCurrentPreviewPage((prev) => Math.max(0, prev - 1))}
                    >
                      ← Sebelumnya
                    </button>
                  ) : null}
                  {currentPreviewPage === totalPages - 1 ? (
                    <button type="button" className={styles.previewBtn}>📤 Kirim Response</button>
                  ) : (
                    <button
                      type="button"
                      className={styles.previewBtn}
                      onClick={() => setCurrentPreviewPage((prev) => Math.min(totalPages - 1, prev + 1))}
                    >
                      Selanjutnya →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
