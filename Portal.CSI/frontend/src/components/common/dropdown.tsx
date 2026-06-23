"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./dropdown.module.css";

type DropdownOption = {
  label: string;
  value: string | number;
};

type DropdownProps = {
  id?: string;
  className?: string;
  options: DropdownOption[];
  value: string | number;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  searchable?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

type MenuPos = {
  top: number;
  left: number;
  width: number;
  openAbove: boolean;
};

export function Dropdown({
  id,
  className = "",
  options,
  value,
  onChange,
  disabled = false,
  placeholder = "Select...",
  fullWidth = false,
  searchable = false,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (disabled && isOpen) {
      setIsOpen(false);
      setSearchTerm('');
      setMenuPos(null);
    }
  }, [disabled]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const selectedOption = options.find((opt) => String(opt.value) === String(value));
  const displayText = selectedOption?.label ?? placeholder;

  const filteredOptions = searchable && searchTerm
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchTerm.toLowerCase()))
    : options;

  // Calculate fixed position when menu opens or window resizes/scrolls
  const updatePosition = () => {
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuH = 300;
    const openAbove = spaceBelow < menuH && rect.top > menuH;
    setMenuPos({
      top: openAbove ? rect.top - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      openAbove,
    });
  };

  useEffect(() => {
    if (!isOpen) return;

    updatePosition();

    if (searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }

    const handleOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        wrapperRef.current && !wrapperRef.current.contains(target) &&
        menuRef.current && !menuRef.current.contains(target)
      ) {
        setIsOpen(false);
        setSearchTerm("");
      }
    };

    const handleScroll = () => updatePosition();
    const handleResize = () => updatePosition();

    document.addEventListener("mousedown", handleOutside);
    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("mousedown", handleOutside);
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, searchable]);

  const handleSelect = (optionValue: string | number) => {
    onChange(String(optionValue));
    setIsOpen(false);
    setSearchTerm("");
  };

  const menuContent = isOpen && !disabled && menuPos ? (
    <div
      ref={menuRef}
      className={styles.menu}
      role="listbox"
      style={{
        position: "fixed",
        top: menuPos.openAbove ? undefined : menuPos.top,
        bottom: menuPos.openAbove ? window.innerHeight - menuPos.top : undefined,
        left: menuPos.left,
        width: menuPos.width,
        zIndex: 9999,
      }}
    >
      {searchable && (
        <div className={styles.searchBox}>
          <input
            ref={searchInputRef}
            type="text"
            className={styles.searchInput}
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <div className={styles.optionsList}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={String(option.value) === String(value)}
              className={`${styles.option} ${String(option.value) === String(value) ? styles.optionSelected : ""}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </button>
          ))
        ) : (
          <div className={styles.noResults}>No results found</div>
        )}
      </div>
    </div>
  ) : null;

  return (
    <div
      ref={wrapperRef}
      className={`${styles.wrapper} ${fullWidth ? styles.wrapperFull : ""}`}
    >
      <button
        type="button"
        id={id}
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ""} ${className}`}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        <span className={styles.triggerLabel}>{displayText}</span>
        <svg
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {typeof document !== "undefined" && menuContent && createPortal(menuContent, document.body)}
    </div>
  );
}
