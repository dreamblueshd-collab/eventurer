"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import styles from "./search-bar.module.css";

type SearchOption = {
  label: string;
  value: string;
};

type SearchBarProps = {
  /** @deprecated pass className via the new API — kept for backward compat, ignored */
  rowClassName?: string;
  /** @deprecated ignored */
  selectClassName?: string;
  /** @deprecated ignored */
  inputClassName?: string;
  /** @deprecated ignored */
  buttonClassName?: string;
  options: SearchOption[];
  selectedValue: string;
  keyword: string;
  onSelectedValueChange: (value: string) => void;
  onKeywordChange: (value: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  buttonType?: "button" | "submit";
  onButtonClick?: () => void;
  trailingContent?: ReactNode;
  fallbackLabel?: string;
};

export function SearchBar({
  options,
  selectedValue,
  keyword,
  onSelectedValueChange,
  onKeywordChange,
  placeholder = "Cari...",
  buttonLabel = "Cari",
  buttonType = "button",
  onButtonClick,
  trailingContent,
  fallbackLabel = "Search By",
}: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputId = useId();

  const selectedOption = options.find((opt) => opt.value === selectedValue) ?? options[0];
  const triggerLabel = selectedOption?.label ?? fallbackLabel;

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isOpen]);

  const handleSelect = (value: string) => {
    onSelectedValueChange(value);
    setIsOpen(false);
  };

  return (
    <div className={`${styles.root} search-bar-root`} ref={wrapperRef}>
      {/* Category selector */}
      <div className={styles.selectWrap}>
        <button
          type="button"
          className={styles.selectTrigger}
          onClick={() => setIsOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          {triggerLabel}
          <svg
            className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {isOpen ? (
          <div className={styles.selectMenu} role="listbox">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === selectedValue}
                className={`${styles.selectOption} ${option.value === selectedValue ? styles.selectOptionActive : ""}`}
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* Text input */}
      <input
        id={inputId}
        className={styles.input}
        type="search"
        placeholder={placeholder}
        value={keyword}
        onChange={(e) => onKeywordChange(e.target.value)}
        aria-label={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter" && onButtonClick) onButtonClick();
        }}
      />

      {/* Search button */}
      <button
        className={styles.button}
        type={buttonType}
        onClick={onButtonClick}
      >
        {buttonLabel}
      </button>

      {/* Trailing slot (e.g. Download button) */}
      {trailingContent ? (
        <div className={styles.trailing}>{trailingContent}</div>
      ) : null}
    </div>
  );
}
