"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FontPreset } from "./builder-definitions";
import { detectScheduleInputMode, parseScheduleInputDate, type ScheduleInputMode } from "./builder-utils";
import DatePicker from "@/components/common/date-picker";
import styles from "./survey-modals.module.css";

interface SurveySettingsModalsProps {
  bgColor: string;
  bgImage: string;
  buttonStyle: "rounded" | "pill" | "square";
  font: FontPreset;
  heroSubtitle: string;
  heroImageUrl: string;
  heroTitle: string;
  logo: string;
  multiPage: boolean;
  onFile: (file: File | undefined, setter: (value: string) => void, imageType: "hero" | "logo" | "background") => void;
  primaryColor: string;
  heroImagePositionX: number;
  heroImagePositionY: number;
  logoPositionX: number;
  logoPositionY: number;
  backgroundPositionX: number;
  backgroundPositionY: number;
  requireApproval: boolean;
  scheduleEnd: string;
  scheduleStart: string;
  secondaryColor: string;
  setBgColor: (value: string) => void;
  setBgImage: (value: string) => void;
  setButtonStyle: (value: "rounded" | "pill" | "square") => void;
  setFont: (value: FontPreset) => void;
  setHeroSubtitle: (value: string) => void;
  setHeroTitle: (value: string) => void;
  setLogo: (value: string) => void;
  setMultiPage: (value: boolean) => void;
  setPrimaryColor: (value: string) => void;
  setHeroImagePositionX: (value: number) => void;
  setHeroImagePositionY: (value: number) => void;
  setLogoPositionX: (value: number) => void;
  setLogoPositionY: (value: number) => void;
  setBackgroundPositionX: (value: number) => void;
  setBackgroundPositionY: (value: number) => void;
  setRequireApproval: (value: boolean) => void;
  setScheduleEnd: (value: string) => void;
  setScheduleStart: (value: string) => void;
  setSecondaryColor: (value: string) => void;
  setShowPageNumbers: (value: boolean) => void;
  setShowProgressBar: (value: boolean) => void;
  setShowSchedule: (value: boolean) => void;
  setShowStyle: (value: boolean) => void;
  showPageNumbers: boolean;
  showProgressBar: boolean;
  showSchedule: boolean;
  showStyle: boolean;
  isReadOnly: boolean;
}

type ScheduleBoundary = "start" | "end";

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateForInput(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function extractDateValue(value: string, boundary: ScheduleBoundary): string {
  if (!value) return "";
  if (!value.includes("T")) return value;
  const parsed = parseScheduleInputDate(value, boundary);
  return parsed ? formatDateForInput(parsed) : value.slice(0, 10);
}

function extractTimeValue(value: string, boundary: ScheduleBoundary): string {
  const parsed = parseScheduleInputDate(value, boundary);
  if (!parsed) {
    return boundary === "start" ? "09:00" : "17:00";
  }
  return `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`;
}

function composeScheduleValue(
  mode: ScheduleInputMode,
  dateValue: string,
  timeValue: string,
): string {
  if (!dateValue) return "";
  if (mode === "date") return dateValue;
  return `${dateValue}T${timeValue}`;
}

export default function SurveySettingsModals({
  bgColor,
  bgImage,
  buttonStyle,
  font,
  heroSubtitle,
  heroImageUrl: _heroImageUrl,
  heroTitle,
  logo,
  multiPage,
  onFile,
  primaryColor,
  heroImagePositionX: _heroImagePositionX,
  heroImagePositionY: _heroImagePositionY,
  logoPositionX: _logoPositionX,
  logoPositionY: _logoPositionY,
  backgroundPositionX: _backgroundPositionX,
  backgroundPositionY: _backgroundPositionY,
  requireApproval,
  scheduleEnd,
  scheduleStart,
  secondaryColor,
  setBgColor,
  setBgImage,
  setButtonStyle,
  setFont,
  setHeroSubtitle,
  setHeroTitle,
  setLogo,
  setMultiPage,
  setPrimaryColor,
  setHeroImagePositionX: _setHeroImagePositionX,
  setHeroImagePositionY: _setHeroImagePositionY,
  setLogoPositionX: _setLogoPositionX,
  setLogoPositionY: _setLogoPositionY,
  setBackgroundPositionX: _setBackgroundPositionX,
  setBackgroundPositionY: _setBackgroundPositionY,
  setRequireApproval,
  setScheduleEnd,
  setScheduleStart,
  setSecondaryColor,
  setShowPageNumbers,
  setShowProgressBar,
  setShowSchedule,
  setShowStyle,
  showPageNumbers,
  showProgressBar,
  showSchedule,
  showStyle,
  isReadOnly,
}: SurveySettingsModalsProps) {
  const [scheduleMode, setScheduleMode] = useState<ScheduleInputMode>(
    detectScheduleInputMode(scheduleStart, scheduleEnd),
  );

  // Snapshot style values when Style Settings modal opens — revert on cancel
  const styleSnapshotRef = useRef<{
    logo: string; bgImage: string; bgColor: string; primaryColor: string;
    secondaryColor: string; heroTitle: string; heroSubtitle: string;
    font: FontPreset; buttonStyle: "rounded" | "pill" | "square";
    showProgressBar: boolean; showPageNumbers: boolean; multiPage: boolean;
  } | null>(null);

  useEffect(() => {
    if (showStyle) {
      styleSnapshotRef.current = {
        logo, bgImage, bgColor, primaryColor, secondaryColor,
        heroTitle, heroSubtitle, font, buttonStyle,
        showProgressBar, showPageNumbers, multiPage,
      };
    }
  }, [showStyle]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleStyleCancel = () => {
    const snap = styleSnapshotRef.current;
    if (snap) {
      setLogo(snap.logo);
      setBgImage(snap.bgImage);
      setBgColor(snap.bgColor);
      setPrimaryColor(snap.primaryColor);
      setSecondaryColor(snap.secondaryColor);
      setHeroTitle(snap.heroTitle);
      setHeroSubtitle(snap.heroSubtitle);
      setFont(snap.font);
      setButtonStyle(snap.buttonStyle);
      setShowProgressBar(snap.showProgressBar);
      setShowPageNumbers(snap.showPageNumbers);
      setMultiPage(snap.multiPage);
    }
    setShowStyle(false);
  };

  useEffect(() => {
    setScheduleMode(detectScheduleInputMode(scheduleStart, scheduleEnd));
  }, [scheduleEnd, scheduleStart]);

  const todayText = useMemo(() => formatDateForInput(new Date()), []);

  const handleModeChange = (nextMode: ScheduleInputMode) => {
    if (nextMode === scheduleMode) return;

    const startDate = extractDateValue(scheduleStart, "start") || todayText;
    const endDate = extractDateValue(scheduleEnd, "end") || startDate;
    const startTime = extractTimeValue(scheduleStart, "start");
    const endTime = extractTimeValue(scheduleEnd, "end");

    setScheduleMode(nextMode);
    setScheduleStart(composeScheduleValue(nextMode, startDate, startTime));
    setScheduleEnd(composeScheduleValue(nextMode, endDate, endTime));
  };

  const handleDateChange = (boundary: ScheduleBoundary, nextDate: string) => {
    const currentValue = boundary === "start" ? scheduleStart : scheduleEnd;
    const nextTime = extractTimeValue(currentValue, boundary);
    const nextValue = composeScheduleValue(scheduleMode, nextDate, nextTime);
    if (boundary === "start") {
      setScheduleStart(nextValue);
      return;
    }
    setScheduleEnd(nextValue);
  };

  const handleTimeChange = (boundary: ScheduleBoundary, nextTime: string) => {
    const currentValue = boundary === "start" ? scheduleStart : scheduleEnd;
    const nextDate = extractDateValue(currentValue, boundary) || todayText;
    const nextValue = composeScheduleValue("datetime", nextDate, nextTime);
    if (boundary === "start") {
      setScheduleStart(nextValue);
      return;
    }
    setScheduleEnd(nextValue);
  };

  return (
    <>
      {showSchedule ? (
        <div className={styles.overlay}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>📅 Schedule Settings</h2>
              <button className={styles.modalClose} type="button" onClick={() => setShowSchedule(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={`${styles.modalBody} ${isReadOnly ? styles.modalBodyDisabled : ""}`}>
              <div className={styles.scheduleModeBar}>
                <button
                  className={scheduleMode === "date" ? styles.scheduleModeChipActive : styles.scheduleModeChip}
                  type="button"
                  onClick={() => handleModeChange("date")}
                >
                  📆 Date Only
                </button>
                <button
                  className={scheduleMode === "datetime" ? styles.scheduleModeChipActive : styles.scheduleModeChip}
                  type="button"
                  onClick={() => handleModeChange("datetime")}
                >
                  🕐 Date + Time
                </button>
                <span className={styles.scheduleTimezone}>WIB / GMT+7</span>
              </div>

              <div className={styles.scheduleGrid}>
                <div className={styles.scheduleCard}>
                  <div className={styles.scheduleCardTitle}>🟢 Start</div>
                  <label htmlFor="schedule-start-date">
                    Start Date
                  </label>
                  <DatePicker
                    id="schedule-start-date"
                    mode={scheduleMode === "datetime" ? "datetime" : "date"}
                    value={scheduleMode === "datetime"
                      ? `${extractDateValue(scheduleStart, "start")} ${extractTimeValue(scheduleStart, "start")}`
                      : extractDateValue(scheduleStart, "start")
                    }
                    onChange={(val) => {
                      if (scheduleMode === "datetime") {
                        const parts = val.split(" ");
                        handleDateChange("start", parts[0] || "");
                        if (parts[1]) handleTimeChange("start", parts[1]);
                      } else {
                        handleDateChange("start", val);
                      }
                    }}
                    placeholder={scheduleMode === "datetime" ? "Pilih tanggal & waktu" : "Pilih tanggal mulai"}
                  />
                  {scheduleMode !== "datetime" && (
                    <div className={styles.scheduleNote}>Tanpa jam: mulai dihitung pukul 00:00 WIB.</div>
                  )}
                </div>

                <div className={styles.scheduleCard}>
                  <div className={styles.scheduleCardTitle}>🔴 End</div>
                  <label htmlFor="schedule-end-date">
                    End Date
                  </label>
                  <DatePicker
                    id="schedule-end-date"
                    mode={scheduleMode === "datetime" ? "datetime" : "date"}
                    value={scheduleMode === "datetime"
                      ? `${extractDateValue(scheduleEnd, "end")} ${extractTimeValue(scheduleEnd, "end")}`
                      : extractDateValue(scheduleEnd, "end")
                    }
                    onChange={(val) => {
                      if (scheduleMode === "datetime") {
                        const parts = val.split(" ");
                        handleDateChange("end", parts[0] || "");
                        if (parts[1]) handleTimeChange("end", parts[1]);
                      } else {
                        handleDateChange("end", val);
                      }
                    }}
                    placeholder={scheduleMode === "datetime" ? "Pilih tanggal & waktu" : "Pilih tanggal akhir"}
                  />
                  {scheduleMode !== "datetime" && (
                    <div className={styles.scheduleNote}>Tanpa jam: berakhir pukul 23:59 WIB.</div>
                  )}
                </div>
              </div>

              <div className={styles.approvalToggle}>
                <label className={styles.approvalToggleLabel} htmlFor="require-approval">
                  <span className={styles.approvalSwitch}>
                    <input
                      id="require-approval"
                      type="checkbox"
                      className={styles.approvalSwitchInput}
                      checked={requireApproval}
                      onChange={(e) => setRequireApproval(e.target.checked)}
                    />
                    <span className={styles.approvalSwitchTrack} />
                  </span>
                  <span className={styles.approvalLabelText}>
                    <span className={styles.approvalTitle}>Workflow Approval</span>
                    <span className={styles.approvalHint}>Aktifkan jika response memerlukan approval sebelum dihitung</span>
                  </span>
                </label>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnSecondary} type="button" onClick={() => setShowSchedule(false)}>
                Batal
              </button>
              <button className={styles.modalBtnPrimary} type="button" onClick={() => setShowSchedule(false)} disabled={isReadOnly}>
                💾 Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showStyle ? (
        <div className={styles.overlay}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>🎨 Style Settings</h2>
              <button className={styles.modalClose} type="button" onClick={() => setShowStyle(false)} aria-label="Close">
                ✕
              </button>
            </div>
            <div className={`${styles.modalBody} ${isReadOnly ? styles.modalBodyDisabled : ""}`}>
              <div className={styles.styleGroup}>
                <div className={styles.styleGroupTitle}>📝 Hero Section</div>
                <label htmlFor="style-hero-title">
                  Hero Title
                  <input id="style-hero-title" value={heroTitle} onChange={(e) => setHeroTitle(e.target.value)} placeholder="Survey hero title" />
                </label>
                <label htmlFor="style-hero-subtitle">
                  Hero Subtitle
                  <input id="style-hero-subtitle" value={heroSubtitle} onChange={(e) => setHeroSubtitle(e.target.value)} placeholder="Survey hero subtitle" />
                </label>
              </div>

              <div className={styles.styleGroup}>
                <div className={styles.styleGroupTitle}>🖼️ Branding</div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Your Logo</span>
                  <div className={styles.styleFilePicker}>
                    <input id="style-logo-upload" className={styles.styleFileHidden} type="file" accept="image/*" onChange={(e) => { onFile(e.target.files?.[0], setLogo, "logo"); }} />
                    <label htmlFor="style-logo-upload" className={styles.styleFileTrigger}>Choose File</label>
                    <span className={styles.styleFileText}>{logo ? logo.split('/').pop() : 'No file chosen'}</span>
                    {logo ? <button type="button" className={styles.styleFileRemove} onClick={() => setLogo("")} aria-label="Remove logo">✕</button> : null}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6, display: 'block' }}>Background Image</span>
                  <div className={styles.styleFilePicker}>
                    <input id="style-bg-image-upload" className={styles.styleFileHidden} type="file" accept="image/*" onChange={(e) => { onFile(e.target.files?.[0], setBgImage, "background"); }} />
                    <label htmlFor="style-bg-image-upload" className={styles.styleFileTrigger}>Choose File</label>
                    <span className={styles.styleFileText}>{bgImage ? bgImage.split('/').pop() : 'No file chosen'}</span>
                    {bgImage ? <button type="button" className={styles.styleFileRemove} onClick={() => setBgImage("")} aria-label="Remove background">✕</button> : null}
                  </div>
                </div>
              </div>

              <div className={styles.styleGroup}>
                <div className={styles.styleGroupTitle}>🎨 Colors</div>
                <div className={styles.styleGroupGrid}>
                  <label htmlFor="style-bg-color">
                    Background Color
                    <div className={styles.colorRow}>
                      <input id="style-bg-color" type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} />
                      <span>{bgColor}</span>
                    </div>
                  </label>
                  <label htmlFor="style-primary-color">
                    Primary Color
                    <div className={styles.colorRow}>
                      <input id="style-primary-color" type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                      <span>{primaryColor}</span>
                    </div>
                  </label>
                  <label htmlFor="style-secondary-color">
                    Secondary Color
                    <div className={styles.colorRow}>
                      <input id="style-secondary-color" type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} />
                      <span>{secondaryColor}</span>
                    </div>
                  </label>
                </div>
              </div>

              <div className={styles.styleGroup}>
                <div className={styles.styleGroupTitle}>⚙️ Appearance</div>
                <div className={styles.styleGroupGrid}>
                  <label htmlFor="style-font">
                    Font
                    <select id="style-font" value={font} onChange={(e) => setFont(e.target.value as FontPreset)}>
                      <option value="default">Default</option>
                      <option value="georgia">Georgia</option>
                      <option value="trebuchet">Trebuchet MS</option>
                      <option value="verdana">Verdana</option>
                      <option value="tahoma">Tahoma</option>
                      <option value="courier">Courier New</option>
                    </select>
                  </label>
                  <label htmlFor="style-button-style">
                    Button Style
                    <select id="style-button-style" value={buttonStyle} onChange={(e) => setButtonStyle(e.target.value as "rounded" | "pill" | "square")}>
                      <option value="rounded">Rounded</option>
                      <option value="pill">Pill</option>
                      <option value="square">Square</option>
                    </select>
                  </label>
                  <label htmlFor="style-progress-bar">
                    Show Progress Bar
                    <select id="style-progress-bar" value={showProgressBar ? "yes" : "no"} onChange={(e) => setShowProgressBar(e.target.value === "yes")}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label htmlFor="style-page-numbers">
                    Show Page Numbers
                    <select id="style-page-numbers" value={showPageNumbers ? "yes" : "no"} onChange={(e) => setShowPageNumbers(e.target.value === "yes")}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                  <label htmlFor="style-multi-page">
                    Multi Page
                    <select id="style-multi-page" value={multiPage ? "yes" : "no"} onChange={(e) => setMultiPage(e.target.value === "yes")}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.modalBtnSecondary} type="button" onClick={handleStyleCancel}>
                Batal
              </button>
              <button className={styles.modalBtnPrimary} type="button" onClick={() => setShowStyle(false)} disabled={isReadOnly}>
                💾 Simpan
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
