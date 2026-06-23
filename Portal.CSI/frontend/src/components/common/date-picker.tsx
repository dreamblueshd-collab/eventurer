"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./date-picker.module.css";

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const DAY_HEADERS = ["Mi", "Se", "Se", "Ra", "Ka", "Ju", "Sa"];

type PickerMode = "date" | "datetime" | "time";

interface DatePickerProps {
  /** Current value: YYYY-MM-DD (date), YYYY-MM-DD HH:mm (datetime), or HH:mm (time) */
  value: string;
  /** Called when user selects a date/time */
  onChange: (value: string) => void;
  /** Picker mode */
  mode?: PickerMode;
  /** Placeholder text */
  placeholder?: string;
  /** Input id attribute */
  id?: string;
  /** Additional className for the wrapper */
  className?: string;
  /** Minimum selectable date (YYYY-MM-DD) */
  min?: string;
  /** Maximum selectable date (YYYY-MM-DD) */
  max?: string;
  /** Disabled state */
  disabled?: boolean;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseDate(str: string): { year: number; month: number; day: number } | null {
  if (!str) return null;
  const datePart = str.split(" ")[0].split("T")[0];
  const parts = datePart.split("-");
  if (parts.length !== 3) return null;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
  return { year, month, day };
}

function parseTime(str: string): { hour: number; minute: number } {
  if (!str) return { hour: 9, minute: 0 };
  const timePart = str.includes(" ") ? str.split(" ")[1] : str.includes("T") ? str.split("T")[1] : str;
  const parts = (timePart || "").split(":");
  const hour = parseInt(parts[0] || "9", 10);
  const minute = parseInt(parts[1] || "0", 10);
  return { hour: isNaN(hour) ? 9 : hour, minute: isNaN(minute) ? 0 : minute };
}

export default function DatePicker({
  value,
  onChange,
  mode = "date",
  placeholder,
  id,
  className,
  min,
  max,
  disabled = false,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const today = useMemo(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, []);

  const selectedDate = useMemo(() => parseDate(value), [value]);
  const selectedTime = useMemo(() => parseTime(value), [value]);

  // Derive view month/year from selected date, with local override when user navigates
  const [viewOverride, setViewOverride] = useState<{ year: number; month: number } | null>(null);
  const viewYear = viewOverride?.year ?? selectedDate?.year ?? today.year;
  const viewMonth = viewOverride?.month ?? selectedDate?.month ?? today.month;

  // Derive time from selected, with local override for spinner interaction
  const [timeOverride, setTimeOverride] = useState<{ hour: number; minute: number } | null>(null);
  const tempHour = timeOverride?.hour ?? selectedTime.hour;
  const tempMinute = timeOverride?.minute ?? selectedTime.minute;

  // Track previous value to reset overrides when value changes externally
  const [trackedValue, setTrackedValue] = useState(value);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (trackedValue !== value) {
      setTrackedValue(value);
      if (viewOverride !== null) setViewOverride(null);
      if (timeOverride !== null) setTimeOverride(null);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  // Position popup relative to viewport (popup uses position: fixed and is
  // portalled to document.body). Clamp to viewport so it never overflows
  // a scrollable parent (e.g. a modal with overflow-y: auto) or goes off-screen.
  const POPUP_WIDTH = 290;
  const POPUP_MAX_HEIGHT = 420;
  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 8;

    // Vertical: prefer below the input; flip above if not enough space below
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;
    const useAbove = spaceBelow < POPUP_MAX_HEIGHT && spaceAbove > spaceBelow;
    const top = useAbove
      ? Math.max(margin, rect.top - POPUP_MAX_HEIGHT - 4)
      : Math.min(viewportHeight - POPUP_MAX_HEIGHT - margin, rect.bottom + 4);

    // Horizontal: align to input left, but clamp so popup stays in viewport
    const desiredLeft = rect.left;
    const maxLeft = viewportWidth - POPUP_WIDTH - margin;
    const left = Math.max(margin, Math.min(desiredLeft, maxLeft));

    setPopupPos({ top, left });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        popupRef.current && !popupRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const daysInMonth = useMemo(() => new Date(viewYear, viewMonth + 1, 0).getDate(), [viewYear, viewMonth]);
  const firstDayOfWeek = useMemo(() => new Date(viewYear, viewMonth, 1).getDay(), [viewYear, viewMonth]);
  const prevMonthDays = useMemo(() => new Date(viewYear, viewMonth, 0).getDate(), [viewYear, viewMonth]);

  const calendarCells = useMemo(() => {
    const cells: Array<{ day: number; month: number; year: number; isCurrentMonth: boolean }> = [];

    // Previous month padding (fill days before the 1st)
    for (let i = 0; i < firstDayOfWeek; i++) {
      const d = prevMonthDays - firstDayOfWeek + 1 + i;
      const m = viewMonth === 0 ? 11 : viewMonth - 1;
      const y = viewMonth === 0 ? viewYear - 1 : viewYear;
      cells.push({ day: d, month: m, year: y, isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, isCurrentMonth: true });
    }

    // Next month padding (fill up to 42 = 6 complete weeks)
    const totalCells = cells.length <= 35 ? 35 : 42;
    const remaining = totalCells - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1;
      const y = viewMonth === 11 ? viewYear + 1 : viewYear;
      cells.push({ day: d, month: m, year: y, isCurrentMonth: false });
    }

    return cells;
  }, [viewYear, viewMonth, daysInMonth, firstDayOfWeek, prevMonthDays]);

  const emitValue = useCallback(
    (year: number, month: number, day: number, hour: number, minute: number) => {
      if (mode === "date") {
        onChange(toDateStr(year, month, day));
      } else if (mode === "datetime") {
        onChange(`${toDateStr(year, month, day)} ${pad(hour)}:${pad(minute)}`);
      } else {
        onChange(`${pad(hour)}:${pad(minute)}`);
      }
    },
    [mode, onChange],
  );

  const selectDate = useCallback(
    (year: number, month: number, day: number) => {
      if (mode === "date") {
        onChange(toDateStr(year, month, day));
        setOpen(false);
      } else if (mode === "datetime") {
        emitValue(year, month, day, tempHour, tempMinute);
      }
    },
    [mode, onChange, emitValue, tempHour, tempMinute],
  );

  const handleTimeChange = useCallback(
    (hour: number, minute: number) => {
      setTimeOverride({ hour, minute });
      if (mode === "time") {
        onChange(`${pad(hour)}:${pad(minute)}`);
      } else if (mode === "datetime" && selectedDate) {
        emitValue(selectedDate.year, selectedDate.month, selectedDate.day, hour, minute);
      }
    },
    [mode, onChange, emitValue, selectedDate],
  );

  const goToPrevMonth = () => {
    if (viewMonth === 0) { setViewOverride({ year: viewYear - 1, month: 11 }); }
    else { setViewOverride({ year: viewYear, month: viewMonth - 1 }); }
  };

  const goToNextMonth = () => {
    if (viewMonth === 11) { setViewOverride({ year: viewYear + 1, month: 0 }); }
    else { setViewOverride({ year: viewYear, month: viewMonth + 1 }); }
  };

  const goToToday = () => {
    setViewOverride({ year: today.year, month: today.month });
    if (mode === "date") {
      onChange(toDateStr(today.year, today.month, today.day));
      setOpen(false);
    } else if (mode === "datetime") {
      emitValue(today.year, today.month, today.day, tempHour, tempMinute);
    }
  };

  const clearValue = () => {
    onChange("");
    setOpen(false);
  };

  const confirmDatetime = () => {
    if (mode === "datetime" && selectedDate) {
      emitValue(selectedDate.year, selectedDate.month, selectedDate.day, tempHour, tempMinute);
    }
    setOpen(false);
  };

  const displayValue = useMemo(() => {
    if (mode === "time") {
      if (!value) return "";
      const t = parseTime(value);
      return `${pad(t.hour)}:${pad(t.minute)}`;
    }
    if (!selectedDate) return "";
    const dateStr = `${pad(selectedDate.day)}/${pad(selectedDate.month + 1)}/${selectedDate.year}`;
    if (mode === "datetime") {
      const t = parseTime(value);
      return `${dateStr} ${pad(t.hour)}:${pad(t.minute)}`;
    }
    return dateStr;
  }, [selectedDate, value, mode]);

  const resolvedPlaceholder = placeholder ?? (
    mode === "time" ? "Pilih waktu" : mode === "datetime" ? "Pilih tanggal & waktu" : "Pilih tanggal"
  );

  const yearOptions = useMemo(() => {
    const start = today.year - 10;
    const end = today.year + 10;
    const years: number[] = [];
    for (let y = start; y <= end; y++) years.push(y);
    return years;
  }, [today.year]);

  const isDateDisabled = useCallback(
    (year: number, month: number, day: number) => {
      const dateStr = toDateStr(year, month, day);
      if (min && dateStr < min) return true;
      if (max && dateStr > max) return true;
      return false;
    },
    [min, max],
  );

  const inputIcon = mode === "time" ? "🕐" : "📅";

  const popupContent = open && (
    <div
      ref={popupRef}
      className={styles.popup}
      style={{ top: popupPos.top, left: popupPos.left }}
      role="dialog"
      aria-label={resolvedPlaceholder}
    >
      {/* Calendar section (hidden for time-only mode) */}
      {mode !== "time" && (
        <>
          <div className={styles.header}>
            <button type="button" className={styles.navBtn} onClick={goToPrevMonth} aria-label="Bulan sebelumnya">
              ◀
            </button>
            <div className={styles.selectors}>
              <select
                className={styles.monthSelect}
                value={viewMonth}
                onChange={(e) => setViewOverride({ year: viewYear, month: Number(e.target.value) })}
                aria-label="Pilih bulan"
              >
                {MONTH_NAMES.map((name, idx) => (
                  <option key={idx} value={idx}>{name}</option>
                ))}
              </select>
              <select
                className={styles.yearSelect}
                value={viewYear}
                onChange={(e) => setViewOverride({ year: Number(e.target.value), month: viewMonth })}
                aria-label="Pilih tahun"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button type="button" className={styles.navBtn} onClick={goToNextMonth} aria-label="Bulan berikutnya">
              ▶
            </button>
          </div>

          <div className={styles.calendarGrid}>
            {DAY_HEADERS.map((d, i) => (
              <div key={i} className={styles.dayHeader}>{d}</div>
            ))}
            {calendarCells.map((cell, i) => {
              const isToday = cell.year === today.year && cell.month === today.month && cell.day === today.day;
              const isSelected = selectedDate && cell.year === selectedDate.year && cell.month === selectedDate.month && cell.day === selectedDate.day;
              const cellDisabled = isDateDisabled(cell.year, cell.month, cell.day);

              let cellClass = styles.dayCell;
              if (!cell.isCurrentMonth) cellClass += ` ${styles.dayCellOtherMonth}`;
              if (isToday && !isSelected) cellClass += ` ${styles.dayCellToday}`;
              if (isSelected) cellClass += ` ${styles.dayCellSelected}`;

              return (
                <button
                  key={i}
                  type="button"
                  className={cellClass}
                  disabled={cellDisabled}
                  onClick={() => selectDate(cell.year, cell.month, cell.day)}
                  aria-label={`${cell.day} ${MONTH_NAMES[cell.month]} ${cell.year}`}
                  aria-pressed={isSelected || undefined}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </>
      )}

      {/* Time spinner */}
      {(mode === "datetime" || mode === "time") && (
        <div className={styles.timeSection}>
          {mode === "datetime" && <div className={styles.timeDivider} />}
          <div className={styles.timeIcon} aria-hidden="true">🕐</div>
          <div className={styles.timeSpinner}>
            <div className={styles.spinnerCol}>
              <button type="button" className={styles.spinnerBtn} onClick={() => handleTimeChange((tempHour + 1) % 24, tempMinute)} aria-label="Tambah jam">▲</button>
              <div className={styles.spinnerValue}>{pad(tempHour)}</div>
              <button type="button" className={styles.spinnerBtn} onClick={() => handleTimeChange((tempHour - 1 + 24) % 24, tempMinute)} aria-label="Kurangi jam">▼</button>
            </div>
            <div className={styles.spinnerSeparator}>:</div>
            <div className={styles.spinnerCol}>
              <button type="button" className={styles.spinnerBtn} onClick={() => handleTimeChange(tempHour, (tempMinute + 5) % 60)} aria-label="Tambah menit">▲</button>
              <div className={styles.spinnerValue}>{pad(tempMinute)}</div>
              <button type="button" className={styles.spinnerBtn} onClick={() => handleTimeChange(tempHour, (tempMinute - 5 + 60) % 60)} aria-label="Kurangi menit">▼</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        {mode !== "time" && (
          <button type="button" className={styles.todayBtn} onClick={goToToday}>Hari Ini</button>
        )}
        {mode === "datetime" && (
          <button type="button" className={styles.confirmBtn} onClick={confirmDatetime}>✓ OK</button>
        )}
        <button type="button" className={styles.clearBtn} onClick={clearValue}>Hapus</button>
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className={`${styles.wrapper} ${className || ""}`}>
      <div className={styles.inputWrapper}>
        <input
          id={id}
          type="text"
          readOnly
          className={styles.input}
          placeholder={resolvedPlaceholder}
          value={displayValue}
          disabled={disabled}
          onClick={() => { if (!disabled) setOpen((o) => !o); }}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setOpen((o) => !o);
            }
          }}
          aria-haspopup="dialog"
        />
        <span className={styles.inputIcon} aria-hidden="true">{inputIcon}</span>
      </div>
      {typeof document !== "undefined" && popupContent && createPortal(popupContent, document.body)}
    </div>
  );
}
