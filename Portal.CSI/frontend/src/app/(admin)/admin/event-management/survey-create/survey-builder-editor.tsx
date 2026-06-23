"use client";

/* eslint-disable @next/next/no-img-element */

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DragEvent } from "react";
import styles from "./survey-builder.module.css";
import { FONT_MAP, ELEMENTS, type BuilderElement, type BuilderPage, type DataSourceType, type ElementType, type FontPreset } from "./builder-definitions";

interface SurveyBuilderEditorProps {
  addElement: (pageId: number, type: ElementType) => void;
  addElementToLastPage: (type: ElementType) => void;
  addPage: () => void;
  applyMasterDataSource: (source: DataSourceType, element: BuilderElement) => BuilderElement;
  bgColor: string;
  bgImage: string;
  brandStyleSummary: string;
  buttonStyle: "rounded" | "pill" | "square";
  dragOverPageId: number | null;
  draggingPageId: number | null;
  eventId: string;
  font: FontPreset;
  hasMappedSelectorInPage: (elements: BuilderElement[]) => boolean;
  heroSubtitle: string;
  heroTitle: string;
  isDirty: boolean;
  isReadOnly: boolean;
  loadingSave: boolean;
  loadingPublish: boolean;
  logo: string;
  moveElementWithinPage: (pageId: number, elementIndex: number, direction: "up" | "down") => void;
  onFile: (file: File | undefined, setter: (value: string) => void, imageType: "hero" | "logo" | "background") => void;
  onPageDragEnd: () => void;
  onPageDragOver: (pageId: number) => (event: DragEvent) => void;
  onPageDragStart: (pageId: number) => (event: DragEvent) => void;
  onPageDrop: (pageId: number) => (event: DragEvent) => void;
  openPreview: () => void;
  openSchedule: () => void;
  openStyle: () => void;
  openTemplatePicker: () => void;
  pages: BuilderPage[];
  primaryColor: string;
  publish: () => Promise<void>;
  removePage: (pageId: number) => void;
  saveDraft: () => Promise<void>;
  scheduleSummary: string;
  secondaryColor: string;
  setPages: React.Dispatch<React.SetStateAction<BuilderPage[]>>;
  setPreviewValues: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  setSurveyDesc: (value: string) => void;
  setSurveyTitle: (value: string) => void;
  setTargetRespondents: (value: string) => void;
  setTargetScore: (value: string) => void;
  shouldShowVisibilityControl: (elements: BuilderElement[], elementIndex: number) => boolean;
  surveyDesc: string;
  surveyTitle: string;
  targetRespondents: string;
  targetScore: string;
}

export default function SurveyBuilderEditor({
  addElement,
  addElementToLastPage,
  addPage,
  applyMasterDataSource,
  bgColor,
  bgImage,
  dragOverPageId,
  draggingPageId,
  eventId,
  font,
  hasMappedSelectorInPage,
  isDirty,
  isReadOnly,
  loadingPublish,
  loadingSave,
  moveElementWithinPage,
  onFile,
  onPageDragEnd,
  onPageDragOver,
  onPageDragStart,
  onPageDrop,
  openPreview,
  openSchedule,
  openStyle,
  openTemplatePicker,
  pages,
  publish,
  removePage,
  saveDraft,
  scheduleSummary,
  setPages,
  setPreviewValues,
  setTargetRespondents,
  surveyTitle,
  setTargetScore,
  shouldShowVisibilityControl,
  targetRespondents,
  targetScore,
}: SurveyBuilderEditorProps) {
  const router = useRouter();
  const [confirmType, setConfirmType] = useState<"save" | "publish" | "leave" | null>(null);

  const handleSaveDraft = () => setConfirmType("save");
  const handlePublish = () => setConfirmType("publish");
  const handleLeave = () => {
    if (isDirty) {
      setConfirmType("leave");
    } else {
      router.push(`/admin/event-management/${eventId}`);
    }
  };

  const onConfirm = () => {
    const type = confirmType;
    setConfirmType(null);
    if (type === "save") void saveDraft();
    else if (type === "publish") void publish();
    else if (type === "leave") router.push(`/admin/event-management/${eventId}`);
  };
  return (
    <div className={styles.builder}>
      <aside className={styles.builderSidebar}>
        <button
          className={styles.sidebarBackBtn}
          type="button"
          onClick={handleLeave}
          aria-label="Back to Event Detail"
          title="Back to Event Detail"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M10 13L5 8L10 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Event Detail</span>
        </button>

        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Add Elements</div>
          {ELEMENTS.map((item) => (
            <button
              key={item.type}
              className={styles.typeBtn}
              onClick={() => addElementToLastPage(item.type)}
              type="button"
              disabled={isReadOnly}
            >
              <span className={styles.typeIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Templates</div>
          <button className={styles.sideAction} type="button" onClick={openTemplatePicker} disabled={isReadOnly}>Load Template</button>
        </div>

        <div className={styles.sidebarSection}>
          <div className={styles.sidebarTitle}>Actions</div>
          <button className={styles.sideAction} type="button" onClick={openPreview}>Preview</button>
          <button className={styles.sideAction} type="button" onClick={handleSaveDraft} disabled={isReadOnly || loadingSave}>{loadingSave ? "Saving..." : "💾 Save Draft"}</button>
          <button className={styles.sideActionPrimary} type="button" onClick={handlePublish} disabled={isReadOnly || loadingPublish}>{loadingPublish ? "Publishing..." : "🚀 Publish"}</button>
          {isReadOnly ? <div className={styles.readOnlyHint}>Survey Closed - Read Only</div> : null}
        </div>
      </aside>

      <main className={styles.builderMain} style={{ backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : "none", fontFamily: FONT_MAP[font] }}>
        <div className={styles.canvas}>
          <div className={styles.topbar}>
            <div className={styles.topLeft}>
              <div className={styles.topTitle}>Form Builder</div>
              <div className={styles.topSurveyName}>{surveyTitle || 'Untitled Form'}</div>
              <div className={styles.topSub}>{scheduleSummary}</div>
            </div>
            <div className={styles.topCenter}>
              <div className={styles.targetCard}>
                <div className={styles.targetTitle}>Target Survey</div>
                <div className={styles.targetGrid}>
                  <label htmlFor="target-respondents">Target Responden<input id="target-respondents" type="number" placeholder="Masukkan target responden" value={targetRespondents} onChange={(e)=>setTargetRespondents(e.target.value)} disabled={isReadOnly} /></label>
                  <label htmlFor="target-score">Target Score (1-10)<input id="target-score" type="number" min={1} max={10} step="0.1" placeholder="Masukkan target skor" value={targetScore} onChange={(e)=>setTargetScore(e.target.value)} disabled={isReadOnly} /></label>
                </div>
              </div>
            </div>
              <div className={styles.topActions}>
              <button className={styles.inlineButton} type="button" onClick={openSchedule}>Settings</button>
              <button className={styles.inlineButton} type="button" onClick={openStyle}>Style</button>
              </div>
            </div>

          <div className={`${styles.pagesWrap} ${isReadOnly ? styles.readOnlyZone : ""}`}>
            {pages.length === 0 ? <div className={styles.emptyPage}>No pages yet. Use Add Page to get started.</div> : null}

            {pages.map((page) => {
              return (
              <article key={page.id} className={[styles.pageCard, draggingPageId === page.id ? styles.pageCardDragging : "", dragOverPageId === page.id && draggingPageId !== page.id ? styles.pageCardDragOver : ""].join(" ")} onDragOver={onPageDragOver(page.id)} onDrop={onPageDrop(page.id)}>
                <div className={styles.pageHeader}>
                  <div className={styles.pageTitleWrap}>
                    <span className={styles.drag} draggable onDragStart={onPageDragStart(page.id)} onDragEnd={onPageDragEnd} aria-label="Drag page">{"\u2630"}</span>
                    <input
                      id={`page-title-${page.id}`}
                      aria-label="Page title"
                      value={page.title}
                      onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, title: e.target.value } : p))}
                      className={styles.pageTitleInput}
                      placeholder=""
                    />
                  </div>
                  <button className={styles.inlineButton} type="button" onClick={() => removePage(page.id)}>Delete Page</button>
                </div>

                {page.elements.map((el, elIndex) => (
                  <div key={`${el.id}-${elIndex}`} className={styles.elementCard}>
                    <div className={styles.elementType}>{el.type}</div>
                    <input id={`question-title-${el.id}`} aria-label="Question title" className={styles.questionInput} value={el.title} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,title:e.target.value}:item)}:p))} placeholder="Question" />
                    <input id={`question-subtitle-${el.id}`} aria-label="Question subtitle" className={styles.questionSub} value={el.subtitle} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,subtitle:e.target.value}:item)}:p))} placeholder="Subtitle (optional)" />

                    {el.type === "text" ? <div className={styles.builderFieldPreview}><input id={`preview-text-${el.id}`} className={styles.builderFieldInput} type="text" disabled aria-label={`Preview: ${el.title || "Text input"}`} placeholder={el.title || "Text input"} /></div> : null}
                    {el.type === "date" ? <div className={styles.builderFieldPreview}><input id={`preview-date-${el.id}`} className={styles.builderFieldInput} type="date" disabled aria-label={`Preview: ${el.title || "Date input"}`} /></div> : null}
                    {el.type === "signature" ? <div className={styles.builderFieldPreview}><div className={styles.builderSignatureBox}>Klik tombol di bawah untuk menandatangani</div><button type="button" className={styles.inlineButton} disabled>Tanda Tangan</button></div> : null}

                    {el.type === "hero" ? (
                      <div style={{ position: "relative" }}>
                        <label className={styles.coverUpload} htmlFor={`hero-cover-${el.id}`}>
                          {el.coverUrl ? <img src={el.coverUrl} alt="cover" className={styles.coverImg} /> : "Click to upload cover image"}
                          <input id={`hero-cover-${el.id}`} type="file" accept="image/*" onChange={(ev)=>onFile(ev.target.files?.[0], (value)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,coverUrl:value}:item)}:p)), "hero")} />
                        </label>
                        {el.coverUrl ? (
                          <button
                            type="button"
                            className={styles.coverRemoveBtn}
                            aria-label="Remove cover image"
                            onClick={() => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, coverUrl: "" } : item) } : p))}
                          >✕</button>
                        ) : null}
                      </div>
                    ) : null}

                    {(["choice","checkbox","dropdown"] as ElementType[]).includes(el.type) ? (
                      <div className={styles.optionList}>
                        <div className={styles.dataSourcePanel}>
                          <label className={styles.dataSourceLabel} htmlFor={`data-source-${el.id}`}>Data Source:</label>
                          <select
                            id={`data-source-${el.id}`}
                            className={styles.dataSourceSelect}
                            value={el.dataSource || "manual"}
                            onChange={(e) => {
                              const selected = e.target.value as DataSourceType;
                              setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? applyMasterDataSource(selected, item) : item) } : p));
                            }}
                          >
                            <option value="manual">Manual Input</option>
                            <option value="bu">Master: Business Unit</option>
                            <option value="division">Master: Division</option>
                            <option value="department">Master: Department</option>
                            <option value="function">Master: Function</option>
                            <option value="app_department">Mapped: Applications by Department</option>
                            <option value="app_function">Mapped: Applications by Function</option>
                          </select>
                          {el.dataSource && el.dataSource !== "manual" ? <span className={styles.dataSourceBadge}>Using master data</span> : null}
                        </div>

                        {el.options.map((opt, idx) => (
                          <div key={`${el.id}-${idx}`} className={styles.optionRow}>
                            <input id={`option-${el.id}-${idx}`} value={opt} disabled={el.dataSource !== "manual"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.map((ov,oi)=>oi===idx?e.target.value:ov)}:item)}:p))} />
                            <button type="button" className={styles.optionDelete} disabled={el.dataSource !== "manual"} onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.length>1?item.options.filter((_,oi)=>oi!==idx):item.options}:item)}:p))}>{"\u00D7"}</button>
                          </div>
                        ))}

                        {el.dataSource === "manual" ? <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[...item.options,`Option ${item.options.length+1}`]}:item)}:p))}>+ Add option</button> : null}
                        {el.dataSource === "app_department" ? <div className={styles.mappingHint}>Options akan diisi otomatis dari mapping aplikasi berdasarkan Department yang dipilih di preview.</div> : null}
                        {el.dataSource === "app_function" ? <div className={styles.mappingHint}>Options akan diisi otomatis dari mapping aplikasi berdasarkan Function yang dipilih di preview.</div> : null}

                        {(el.type === "choice" || el.type === "checkbox") ? (
                          <div className={styles.settingPanel}>
                            <div className={styles.settingRow}>
                              <label className={styles.settingLabel} htmlFor={`layout-${el.id}`}>Layout</label>
                              <select id={`layout-${el.id}`} className={styles.settingSelect} value={el.optionLayout || "vertical"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,optionLayout:e.target.value as "vertical" | "horizontal"}:item)}:p))}>
                                <option value="vertical">Vertical</option>
                                <option value="horizontal">Horizontal</option>
                              </select>
                            </div>
                            {el.type === "choice" ? (
                              <div className={styles.settingRow}>
                                <span className={styles.settingLabel}>Selection</span>
                                <label className={styles.settingCheckLabel} htmlFor={`multi-answer-${el.id}`}>
                                  <input
                                    id={`multi-answer-${el.id}`}
                                    type="checkbox"
                                    checked={Boolean(el.allowMultipleAnswers)}
                                    onChange={(e) => {
                                      const checked = e.target.checked;
                                      setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,allowMultipleAnswers:checked}:item)}:p));
                                      if (!checked) {
                                        setPreviewValues((prev) => {
                                          const current = prev[el.id];
                                          if (!Array.isArray(current)) return prev;
                                          return { ...prev, [el.id]: current[0] || "" };
                                        });
                                      }
                                    }}
                                  />
                                  Allow multiple answers
                                </label>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {shouldShowVisibilityControl(page.elements, elIndex) && hasMappedSelectorInPage(page.elements) ? (
                      <div className={styles.settingPanel}>
                        <div className={styles.settingRow}>
                          <label className={styles.settingLabel} htmlFor={`visibility-${el.id}`}>Repeat per Aplikasi</label>
                          <select id={`visibility-${el.id}`} className={styles.settingSelect} value={el.displayCondition || "always"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,displayCondition:e.target.value as "always" | "after_mapped_selection"}:item)}:p))}>
                            <option value="always">Tampil sekali (global)</option>
                            <option value="after_mapped_selection">Repeat per aplikasi terpilih</option>
                          </select>
                        </div>
                      </div>
                    ) : null}

                    {el.type === "rating" ? (
                      <div className={styles.optionList}>
                        <div className={styles.optionRow}>
                          <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }} htmlFor={`rating-scale-${el.id}`}>Rating Scale</label>
                          <input id={`rating-scale-${el.id}`} type="number" min={3} max={10} value={el.options[0] || "10"} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[e.target.value || "10"]}:item)}:p))} />
                        </div>
                      </div>
                    ) : null}

                    {(["likert", "matrix"] as ElementType[]).includes(el.type) ? (
                      <div className={styles.optionList}>
                        {el.type === "likert" ? (
                          <>
                            <div className={styles.optionRow}>
                              <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }} htmlFor={`likert-scale-${el.id}`}>Rating Scale</label>
                              <input
                                id={`likert-scale-${el.id}`}
                                type="number" min={1} max={10}
                                value={el.ratingScale ?? 10}
                                onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, ratingScale: Math.min(10, Math.max(1, Number(e.target.value || 10))) } : item) } : p))}
                              />
                            </div>
                            <div className={styles.optionRow}>
                              <span style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }}>
                                Komentar per Statement
                              </span>
                              <label className={styles.settingCheckLabel} style={{ minHeight: "auto" }} htmlFor={`likert-comment-toggle-${el.id}`}>
                                <input
                                  id={`likert-comment-toggle-${el.id}`}
                                  type="checkbox"
                                  checked={el.likertEnableComment !== false}
                                  onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, likertEnableComment: e.target.checked } : item) } : p))}
                                />
                                Tampilkan textbox komentar di bawah setiap statement
                              </label>
                            </div>
                            {el.likertEnableComment !== false ? (
                              <div className={styles.optionRow}>
                                <label style={{ fontSize: "12px", color: "#374151", minWidth: "120px" }} htmlFor={`likert-comment-threshold-${el.id}`}>
                                  Komentar Wajib jika Nilai &lt;
                                </label>
                                <input
                                  id={`likert-comment-threshold-${el.id}`}
                                  type="number" min={1} max={10}
                                  value={el.likertCommentThreshold ?? 7}
                                  onChange={(e) => setPages((prev) => prev.map((p) => p.id === page.id ? { ...p, elements: p.elements.map((item) => item.id === el.id ? { ...item, likertCommentThreshold: Math.min(10, Math.max(1, Number(e.target.value || 7))) } : item) } : p))}
                                />
                                <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: 4 }}>
                                  (1–10, default 7)
                                </span>
                              </div>
                            ) : null}
                          </>
                        ) : null}
                        {el.options.map((opt, idx) => (
                          <div key={`${el.id}-${idx}`} className={styles.optionRow}>
                            <input id={`statement-${el.id}-${idx}`} value={opt} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.map((ov,oi)=>oi===idx?e.target.value:ov)}:item)}:p))} />
                            <button type="button" className={styles.optionDelete} onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:item.options.length>1?item.options.filter((_,oi)=>oi!==idx):item.options}:item)}:p))}>{"\u00D7"}</button>
                          </div>
                        ))}
                        <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,options:[...item.options,el.type==="likert"?`Statement ${item.options.length+1}`:`Column ${item.options.length+1}`]}:item)}:p))}>+ Add {el.type === "likert" ? "statement" : "column"}</button>
                      </div>
                    ) : null}

                    {el.type === "text" ? (
                      <div className={styles.settingPanel}>
                        {(() => {
                          const ratingCandidates = page.elements.filter((item, idx) => idx < elIndex && (item.type === "rating" || item.type === "likert"));
                          const hasCandidates = ratingCandidates.length > 0;
                          const thresholdValue = Math.min(10, Math.max(1, Math.round(Number(el.conditionalRequiredThreshold || 7))));
                          const enabled = Boolean(el.conditionalRequiredSourceId);
                          const selectedSourceId = hasCandidates
                            ? (el.conditionalRequiredSourceId && ratingCandidates.some((item) => item.id === el.conditionalRequiredSourceId)
                              ? el.conditionalRequiredSourceId
                              : ratingCandidates[ratingCandidates.length - 1].id)
                            : "";

                          return (
                            <>
                              <div className={styles.settingRow}>
                                <label className={styles.settingLabel} htmlFor={`comment-rule-${el.id}`}>Comment Rule</label>
                                <label className={styles.settingCheckLabel} htmlFor={`comment-rule-${el.id}`}>
                                  <input id={`comment-rule-${el.id}`} type="checkbox" disabled={!hasCandidates} checked={enabled} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,conditionalRequiredSourceId:e.target.checked ? (selectedSourceId || undefined) : undefined,conditionalRequiredThreshold:e.target.checked ? thresholdValue : undefined}:item)}:p))} />
                                  <span>Wajib isi jika score di bawah threshold</span>
                                </label>
                              </div>
                              {!hasCandidates ? <div className={styles.settingHint}>Tambahkan elemen rating/likert di atas komentar ini agar rule bisa diaktifkan.</div> : null}
                              {enabled && hasCandidates ? (
                                <>
                                  <div className={styles.settingRow}>
                                    <label className={styles.settingLabel} htmlFor={`score-source-${el.id}`}>Score Source</label>
                                    <select id={`score-source-${el.id}`} className={styles.settingSelect} value={el.conditionalRequiredSourceId || selectedSourceId} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,conditionalRequiredSourceId:e.target.value || undefined}:item)}:p))}>
                                      {ratingCandidates.map((item, idx) => (
                                        <option key={`${el.id}-rating-source-${item.id}`} value={item.id}>
                                          {item.title || `${item.type === "likert" ? "Likert" : "Rating"} ${idx + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className={styles.settingRow}>
                                    <label className={styles.settingLabel} htmlFor={`threshold-${el.id}`}>Threshold</label>
                                    <input id={`threshold-${el.id}`} className={styles.settingSelect} type="number" min={1} max={10} value={thresholdValue} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,conditionalRequiredThreshold:Math.min(10, Math.max(1, Number(e.target.value || 7)))}:item)}:p))} />
                                  </div>
                                </>
                              ) : null}
                            </>
                          );
                        })()}
                      </div>
                    ) : null}

                    <div className={styles.elementActions}>
                      <label htmlFor={`required-${el.id}`}><input id={`required-${el.id}`} type="checkbox" checked={el.required} onChange={(e)=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.map((item)=>item.id===el.id?{...item,required:e.target.checked}:item)}:p))} />{" "}Required</label>
                      <div className={styles.elementReorder}>
                        <button type="button" className={styles.inlineButton} disabled={elIndex === 0} onClick={() => moveElementWithinPage(page.id, elIndex, "up")}>Move Up</button>
                        <button type="button" className={styles.inlineButton} disabled={elIndex === page.elements.length - 1} onClick={() => moveElementWithinPage(page.id, elIndex, "down")}>Move Down</button>
                      </div>
                      <button className={styles.inlineButton} type="button" onClick={()=>setPages((prev)=>prev.map((p)=>p.id===page.id?{...p,elements:p.elements.filter((item)=>item.id!==el.id)}:p))}>Delete</button>
                    </div>
                  </div>
                ))}

                <div className={styles.addElement}><select id={`add-element-${page.id}`} defaultValue="" onChange={(e)=>{const value=e.target.value as ElementType; if(!value)return; addElement(page.id,value); e.target.value="";}}><option value="">+ Add Element</option>{ELEMENTS.map((item)=><option key={`${page.id}-${item.type}`} value={item.type}>{item.label}</option>)}</select></div>
              </article>
            )})}

            <button className={styles.addPage} type="button" onClick={addPage}>+ Add Page</button>
          </div>
        </div>
      </main>

      {confirmType ? (
        <div className={styles.confirmOverlay} onClick={() => setConfirmType(null)}>
          <div className={styles.confirmBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.confirmHead}>
              <div className={styles.confirmTitle}>
                {confirmType === "save" ? "💾 Simpan Draft" : null}
                {confirmType === "publish" ? "🚀 Publish Survey" : null}
                {confirmType === "leave" ? "⚠️ Perubahan Belum Disimpan" : null}
              </div>
            </div>
            <div className={styles.confirmBody}>
              <div className={styles.confirmText}>
                {confirmType === "save"
                  ? "Simpan perubahan sebagai draft? Data akan disinkronkan ke server."
                  : null}
                {confirmType === "publish"
                  ? "Publish survey ini? Setelah dipublish, survey akan aktif dan bisa diakses oleh responden sesuai jadwal yang ditentukan."
                  : null}
                {confirmType === "leave"
                  ? "Ada perubahan yang belum disimpan. Jika Anda meninggalkan halaman ini, perubahan tersebut akan hilang. Yakin ingin keluar?"
                  : null}
              </div>
            </div>
            <div className={styles.confirmFooter}>
              <button type="button" className={styles.confirmBtnCancel} onClick={() => setConfirmType(null)}>
                Batal
              </button>
              {confirmType === "leave" ? (
                <button type="button" className={styles.confirmBtnDanger} onClick={onConfirm}>
                  Ya, Keluar
                </button>
              ) : (
                <button type="button" className={styles.confirmBtnPrimary} onClick={onConfirm}>
                  {confirmType === "save" ? "💾 Ya, Simpan" : "🚀 Ya, Publish"}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
