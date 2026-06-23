/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef } from "react";
import React from "react";
import type { BusinessUnitOption, DepartmentOption, DivisionOption } from "@/lib/org-hierarchy";
import type { FunctionMaster } from "@/lib/master-data";
import styles from "@/app/(admin)/admin/event-management/survey-create/survey-preview.module.css";

type ElementType = "hero" | "text" | "choice" | "checkbox" | "dropdown" | "rating" | "likert" | "matrix" | "date" | "signature";
type DataSourceType =
  | "manual"
  | "bu"
  | "division"
  | "department"
  | "function"
  | "app_department"
  | "app_function";

export interface PreviewElement {
  id: string;
  type: ElementType;
  title: string;
  subtitle: string;
  required: boolean;
  options: string[];
  coverUrl: string;
  dataSource?: DataSourceType;
  optionLayout?: "vertical" | "horizontal";
  allowMultipleAnswers?: boolean;
  displayCondition?: "always" | "after_mapped_selection";
  conditionalRequiredSourceId?: string;
  conditionalRequiredThreshold?: number;
  /** Jika false, textbox komentar per statement tidak ditampilkan */
  likertEnableComment?: boolean;
}

function SignaturePad({ value, onChange }: { value?: string; onChange: (value: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const displayWidth = canvas.clientWidth || 640;
    const displayHeight = canvas.clientHeight || 180;
    canvas.width = Math.floor(displayWidth * ratio);
    canvas.height = Math.floor(displayHeight * ratio);
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";

    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, displayWidth, displayHeight);
        ctx.drawImage(img, 0, 0, displayWidth, displayHeight);
      };
      img.src = value;
    }
  }, [value]);

  const getPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onStart = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    drawingRef.current = true;
    canvas.setPointerCapture(event.pointerId);
    const p = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = getPoint(event);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const onEnd = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    onChange(canvas.toDataURL("image/png"));
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);
    onChange("");
  };

  return (
    <div className={styles.signatureWrap}>
      <canvas
        ref={canvasRef}
        className={styles.signatureCanvas}
        onPointerDown={onStart}
        onPointerMove={onMove}
        onPointerUp={onEnd}
        onPointerLeave={onEnd}
      />
      <button type="button" className={styles.inlineButton} onClick={clear}>Clear Signature</button>
    </div>
  );
}

interface Props {
  element: PreviewElement;
  allElements: PreviewElement[];
  values: Record<string, unknown>;
  onSetValue: (id: string, value: unknown) => void;
  onSetValuesBulk: (values: Record<string, unknown>) => void;
  onToggleCheckbox: (id: string, option: string) => void;
  orgData: {
    businessUnits: BusinessUnitOption[];
    divisions: DivisionOption[];
    departments: DepartmentOption[];
    functions: FunctionMaster[];
    mappedApplicationsByDepartment: string[];
    mappedApplicationsByFunction: string[];
  };
}

function inferProfileField(element: PreviewElement): "bu" | "division" | "department" | "function" | null {
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

function getUniqueOptions(options: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  options.forEach((raw) => {
    const normalized = String(raw ?? "").trim();
    if (!normalized) return;

    const key = normalized.toLowerCase();
    if (seen.has(key)) return;

    seen.add(key);
    unique.push(normalized);
  });

  return unique;
}

type DropdownOptionEntry = {
  value: string | number;
  label: string;
};

function sameId(left: string | number, right: string | number): boolean {
  return String(left).trim() === String(right).trim();
}

export default function SurveyPreviewElement({ element, allElements, values, onSetValue, onSetValuesBulk, onToggleCheckbox, orgData }: Props) {
  const buElement = useMemo(() => allElements.find((item) => inferProfileField(item) === "bu"), [allElements]);
  const divisionElement = useMemo(() => allElements.find((item) => inferProfileField(item) === "division"), [allElements]);
  const departmentElement = useMemo(() => allElements.find((item) => inferProfileField(item) === "department"), [allElements]);
  const functionElement = useMemo(() => allElements.find((item) => inferProfileField(item) === "function"), [allElements]);

  const selectedBusinessUnitId = buElement ? String(values[buElement.id] || "") : "";
  const selectedDivisionId = divisionElement ? String(values[divisionElement.id] || "") : "";

  const profileOptionEntries = useMemo<DropdownOptionEntry[]>(() => {
    if (element.type !== "dropdown") return [];
    const field = inferProfileField(element);

    if (field === "bu") {
      return orgData.businessUnits.map((item) => ({
        value: item.BusinessUnitId,
        label: item.Name,
      }));
    }

    if (field === "division") {
      const hasBuSelector = Boolean(buElement);
      const divisionPool = hasBuSelector
        ? (selectedBusinessUnitId
            ? orgData.divisions.filter((item) => sameId(item.BusinessUnitId, selectedBusinessUnitId))
            : [])
        : orgData.divisions;

      return divisionPool.map((item) => ({
        value: item.DivisionId,
        label: item.Name,
      }));
    }

    if (field === "department") {
      const hasBuSelector = Boolean(buElement);
      const hasDivisionSelector = Boolean(divisionElement);

      let departmentPool = orgData.departments;

      if (hasBuSelector) {
        if (!selectedBusinessUnitId) return [];
        const buDivisionIds = orgData.divisions
          .filter((item) => sameId(item.BusinessUnitId, selectedBusinessUnitId))
          .map((item) => item.DivisionId);
        departmentPool = departmentPool.filter((item) => buDivisionIds.includes(item.DivisionId));
      }

      if (hasDivisionSelector && selectedDivisionId) {
        departmentPool = departmentPool.filter((item) => sameId(item.DivisionId, selectedDivisionId));
      }

      const duplicateCounter = departmentPool.reduce<Record<string, number>>((acc, item) => {
        const key = item.Name.toLowerCase();
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});

      return departmentPool.map((item) => {
        const divisionName = orgData.divisions.find((div) => div.DivisionId === item.DivisionId)?.Name || "";
        const isDuplicateName = duplicateCounter[item.Name.toLowerCase()] > 1;
        return {
          value: item.DepartmentId,
          label: isDuplicateName ? `${item.Name} (${divisionName})` : item.Name,
        };
      });
    }

    if (field === "function") {
      return orgData.functions.map((item) => ({
        value: item.FunctionId,
        label: item.Name,
      }));
    }

    return [];
  }, [
    buElement,
    divisionElement,
    element,
    orgData.businessUnits,
    orgData.departments,
    orgData.divisions,
    orgData.functions,
    selectedBusinessUnitId,
    selectedDivisionId,
  ]);

  const optionSet = useMemo(() => {
    const supportsOptionDataSource =
      element.type === "dropdown" || element.type === "choice" || element.type === "checkbox";
    if (!supportsOptionDataSource) return element.options;

    const field = inferProfileField(element);
    if (field && element.type === "dropdown") return element.options;

    if (element.dataSource === "app_department") {
      return orgData.mappedApplicationsByDepartment.length > 0
        ? orgData.mappedApplicationsByDepartment
        : element.options;
    }

    if (element.dataSource === "app_function") {
      return orgData.mappedApplicationsByFunction.length > 0
        ? orgData.mappedApplicationsByFunction
        : element.options;
    }

    return element.options;
  }, [
    element,
    orgData.mappedApplicationsByDepartment,
    orgData.mappedApplicationsByFunction,
  ]);
  const uniqueOptionSet = useMemo(() => getUniqueOptions(optionSet), [optionSet]);

  const mappedEmptyMessage = useMemo(() => {
    if (element.dataSource === "app_department") {
      return "Belum ada aplikasi dari mapping Department. Pilih Department yang memiliki mapping.";
    }
    if (element.dataSource === "app_function") {
      return "Belum ada aplikasi dari mapping Function. Pilih Function yang memiliki mapping.";
    }
    return "";
  }, [element.dataSource]);

  if (element.type === "hero") {
    return (
      <div className={styles.previewHero}>
        {element.coverUrl ? <img src={element.coverUrl} alt="hero" className={styles.previewHeroImage} /> : <div className={styles.previewHeroPlaceholder}>Hero image</div>}
        {element.title.trim() ? <div className={styles.previewHeroTitle}>{element.title}</div> : null}
        {element.subtitle ? <div className={styles.previewHeroSubtitle}>{element.subtitle}</div> : null}
      </div>
    );
  }

  if (element.type === "text") {
    return <input className={styles.previewInput} required={element.required} placeholder={element.title || "Text input"} value={String(values[element.id] || "")} onChange={(e) => onSetValue(element.id, e.target.value)} />;
  }

  if (element.type === "choice") {
    if (uniqueOptionSet.length === 0 && mappedEmptyMessage) {
      return <div className={styles.previewHint}>{mappedEmptyMessage}</div>;
    }
    const selected = Array.isArray(values[element.id]) ? (values[element.id] as string[]) : [];
    const allowMultipleAnswers = Boolean(element.allowMultipleAnswers);
    return (
      <div className={`${styles.previewOptions} ${element.optionLayout === "horizontal" ? styles.previewOptionsHorizontal : styles.previewOptionsVertical}`}>
        {uniqueOptionSet.map((option, idx) => (
          <label key={`${element.id}-${option}-${idx}`} className={styles.previewOptionItem}>
            <input
              type={allowMultipleAnswers ? "checkbox" : "radio"}
              name={allowMultipleAnswers ? `${element.id}-${idx}` : element.id}
              checked={allowMultipleAnswers ? selected.includes(option) : values[element.id] === option}
              onChange={() => (allowMultipleAnswers ? onToggleCheckbox(element.id, option) : onSetValue(element.id, option))}
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (element.type === "checkbox") {
    if (uniqueOptionSet.length === 0 && mappedEmptyMessage) {
      return <div className={styles.previewHint}>{mappedEmptyMessage}</div>;
    }
    const selected = Array.isArray(values[element.id]) ? (values[element.id] as string[]) : [];
    return (
      <div className={`${styles.previewOptions} ${element.optionLayout === "horizontal" ? styles.previewOptionsHorizontal : styles.previewOptionsVertical}`}>
        {uniqueOptionSet.map((option, idx) => (
          <label key={`${element.id}-${option}-${idx}`} className={styles.previewOptionItem}>
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggleCheckbox(element.id, option)} />
            <span>{option}</span>
          </label>
        ))}
      </div>
    );
  }

  if (element.type === "dropdown") {
    const field = inferProfileField(element);
    const dropdownEntries: DropdownOptionEntry[] = field
      ? profileOptionEntries
      : uniqueOptionSet.map((option) => ({ value: option, label: option }));

    if (dropdownEntries.length === 0 && mappedEmptyMessage) {
      return <div className={styles.previewHint}>{mappedEmptyMessage}</div>;
    }
    return (
      <select
        className={styles.previewSelect}
        value={String(values[element.id] || "")}
        onChange={(e) => {
          const value = e.target.value;
          onSetValue(element.id, value);

          if (field === "bu" && divisionElement && departmentElement) {
            if (!value) {
              onSetValuesBulk({
                [divisionElement.id]: "",
                [departmentElement.id]: "",
              });
              return;
            }

            const selectedBu = orgData.businessUnits.find((item) => sameId(item.BusinessUnitId, value));
            const buName = (selectedBu?.Name || "").trim().toLowerCase();
            const isCorporateHo = buName === "corporate ho";

            if (!isCorporateHo) {
              const divisionsInBu = orgData.divisions.filter((item) => sameId(item.BusinessUnitId, value));

              if (divisionsInBu.length === 0) {
                // BU belum punya divisi — reset agar user bisa pilih manual
                onSetValuesBulk({
                  [divisionElement.id]: "",
                  [departmentElement.id]: "",
                });
                return;
              }

              // Cari divisi yang namanya sama dengan BU (untuk BU yang punya divisi tunggal dengan nama sama)
              const autoDivision =
                divisionsInBu.find((item) => item.Name.trim().toLowerCase() === buName) ||
                divisionsInBu[0];

              const departmentsInDivision = autoDivision
                ? orgData.departments.filter((item) => item.DivisionId === autoDivision.DivisionId)
                : [];

              // Cari department yang namanya sama dengan BU, atau ambil yang pertama
              const autoDepartment =
                departmentsInDivision.find((item) => item.Name.trim().toLowerCase() === buName) ||
                departmentsInDivision[0];

              onSetValuesBulk({
                [divisionElement.id]: autoDivision?.DivisionId ?? "",
                [departmentElement.id]: autoDepartment?.DepartmentId ?? "",
              });
            } else {
              // Corporate HO — biarkan user pilih divisi dan department manual
              onSetValuesBulk({
                [divisionElement.id]: "",
                [departmentElement.id]: "",
              });
            }
          }
          if (field === "division" && departmentElement) {
            onSetValue(departmentElement.id, "");
          }
          if (field === "department" && functionElement) {
            onSetValue(functionElement.id, "");
          }
        }}
      >
        <option value="">-- Select --</option>
        {dropdownEntries.map((entry, idx) => (
          <option key={`${element.id}-${entry.value}-${idx}`} value={entry.value}>
            {entry.label}
          </option>
        ))}
      </select>
    );
  }

  if (element.type === "date") {
    return <input className={styles.previewInput} type="date" value={String(values[element.id] || "")} onChange={(e) => onSetValue(element.id, e.target.value)} />;
  }

  if (element.type === "rating") {
    const parsedScale = Number(element.options[0]);
    const max = Number.isFinite(parsedScale) && parsedScale >= 1 ? Math.min(10, Math.max(1, Math.round(parsedScale))) : 10;
    const current = Number(values[element.id] || 0);
    return (
      <div className={styles.previewRatingRow}>
        {Array.from({ length: max }, (_, idx) => idx + 1).map((n) => (
          <button key={`${element.id}-${n}`} type="button" className={`${styles.previewRateButton} ${current === n ? styles.previewRateButtonActive : ""}`} onClick={() => onSetValue(element.id, n)}>{n}</button>
        ))}
      </div>
    );
  }

  if (element.type === "likert") {
    const rawOptions = element.options;
    const lastItem = rawOptions[rawOptions.length - 1];
    const lastAsNum = Number(lastItem);
    const hasScaleAtEnd = rawOptions.length > 0 && Number.isFinite(lastAsNum) && lastAsNum >= 1 && lastAsNum <= 10 && String(Math.round(lastAsNum)) === String(lastItem);
    const scale = hasScaleAtEnd ? Math.round(lastAsNum) : 10;
    const rows = hasScaleAtEnd ? rawOptions.slice(0, -1) : rawOptions;
    const effectiveRows = rows.length > 0 ? rows : ["Statement 1", "Statement 2"];
    const cols = Array.from({ length: scale }, (_, idx) => String(idx + 1));

    // Threshold untuk komentar wajib — baca dari element.conditionalRequiredThreshold atau default 7
    const commentThreshold = Math.max(1, Math.round(Number(element.conditionalRequiredThreshold || 7)));
    // Apakah komentar per statement diaktifkan (default true)
    const enableComment = element.likertEnableComment !== false;

    return (
      <div className={styles.previewMatrixWrap}>
        <table className={styles.previewMatrixTable}>
          <thead>
            <tr>
              <th className={styles.matrixStatementTh}>Statement</th>
              {cols.map((c) => <th key={`${element.id}-c-${c}`}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {effectiveRows.map((row, rowIdx) => {
              const rowKey = `${element.id}-${rowIdx}`;
              const commentKey = `${element.id}-comment-${rowIdx}`;
              const selectedVal = Number(values[rowKey] || 0);
              const hasScore = selectedVal > 0;
              const commentRequired = hasScore && selectedVal < commentThreshold;

              return (
                <React.Fragment key={`${element.id}-frag-${rowIdx}`}>
                  <tr>
                    <td className={styles.matrixRowLabel}>{row}</td>
                    {cols.map((col) => (
                      <td key={`${element.id}-${rowIdx}-${col}`}>
                        <input
                          type="radio"
                          name={rowKey}
                          checked={values[rowKey] === col}
                          onChange={() => onSetValue(rowKey, col)}
                          className={styles.matrixRadio}
                        />
                      </td>
                    ))}
                  </tr>
                  {/* Textbox komentar per row — hanya jika enableComment aktif dan nilai sudah dipilih */}
                  {enableComment && hasScore ? (
                    <tr>
                      <td colSpan={cols.length + 1} className={styles.matrixCommentCell}>
                        <div className={styles.matrixCommentWrap}>
                          <div className={styles.matrixCommentLabelRow}>
                            <span className={styles.matrixCommentLabel}>Alasan / Komentar</span>
                            {commentRequired ? (
                              <span className={styles.matrixBadgeRequired}>
                                Wajib (nilai &lt; {commentThreshold})
                              </span>
                            ) : (
                              <span className={styles.matrixBadgeOptional}>
                                Opsional
                              </span>
                            )}
                          </div>
                          <input
                            className={`${styles.previewInput}${commentRequired && !values[commentKey] ? ` ${styles.matrixInputError}` : ""}`}
                            type="text"
                            placeholder={commentRequired ? "Wajib diisi — jelaskan kendala atau saran perbaikan" : "Tambahkan komentar (opsional)"}
                            value={String(values[commentKey] || "")}
                            onChange={(e) => onSetValue(commentKey, e.target.value)}
                          />
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (element.type === "matrix") {
    const cols = element.options.length > 0 ? element.options : ["Column 1", "Column 2", "Column 3"];
    const rows = ["Row 1", "Row 2", "Row 3", "Row 4"];
    return (
      <div className={styles.previewMatrixWrap}>
        <table className={styles.previewMatrixTable}>
          <thead><tr><th>Item</th>{cols.map((col, idx) => <th key={`${element.id}-m-c-${idx}`}>{col}</th>)}</tr></thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={`${element.id}-m-r-${rowIdx}`}>
                <td>{row}</td>
                {cols.map((_, colIdx) => {
                  const key = `${element.id}-m-${rowIdx}`;
                  const value = String(colIdx);
                  return <td key={`${element.id}-${rowIdx}-${colIdx}`}><input type="radio" name={key} checked={values[key] === value} onChange={() => onSetValue(key, value)} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (element.type === "signature") {
    return <SignaturePad value={typeof values[element.id] === "string" ? (values[element.id] as string) : ""} onChange={(value) => onSetValue(element.id, value)} />;
  }

  return null;
}
