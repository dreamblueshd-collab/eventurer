import { useState, type MouseEvent } from "react";
import s from "./pagination.module.css";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (pageSize: number) => void;
  className?: string;
  instanceId?: string;
};

function buildPageItems(currentPage: number, totalPages: number): Array<number | "dots"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: Array<number | "dots"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) items.push("dots");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < totalPages - 1) items.push("dots");

  items.push(totalPages);
  return items;
}

function ChevronLeft() {
  return (
    <svg className={s.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg className={s.chevron} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  className,
  instanceId,
}: PaginationProps) {
  const [jumpToPageValue, setJumpToPageValue] = useState<string>("");
  const uid = instanceId ?? "default";

  const items = buildPageItems(currentPage, totalPages);

  const handleClick = (event: MouseEvent<HTMLButtonElement>, page: number) => {
    event.preventDefault();
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  const handlePageSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = parseInt(event.target.value, 10);
    if (onPageSizeChange) {
      onPageSizeChange(newPageSize);
    }
  };

  const handleJumpToPage = () => {
    const pageNumber = parseInt(jumpToPageValue, 10);
    if (!isNaN(pageNumber) && pageNumber >= 1 && pageNumber <= totalPages) {
      onPageChange(pageNumber);
      setJumpToPageValue("");
    }
  };

  return (
    <div className={`${s.wrap} ${className ?? ""}`}>
      <div className={s.leftSection}>
        {onPageSizeChange && pageSize && (
          <div className={s.pageSizeControl}>
            <label htmlFor={`pageSize-${uid}`}>Tampilkan:</label>
            <select
              id={`pageSize-${uid}`}
              className={s.pageSizeSelect}
              value={pageSize}
              onChange={handlePageSizeChange}
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
            <span>per halaman</span>
          </div>
        )}
      </div>
      <div className={s.controls}>
        <button
          type="button"
          className={`${s.btn} ${s.btnNav}`}
          onClick={(event) => handleClick(event, 1)}
          disabled={currentPage === 1}
          aria-label="Halaman pertama"
        >
          <span>First</span>
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.btnNav}`}
          onClick={(event) => handleClick(event, currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Halaman sebelumnya"
        >
          <ChevronLeft />
          <span>Prev</span>
        </button>
        {items.map((item, index) =>
          item === "dots" ? (
            <span key={`dots-${index}`} className={s.dots}>···</span>
          ) : (
            <button
              key={item}
              type="button"
              className={`${s.btn} ${item === currentPage ? s.btnActive : ""}`}
              onClick={(event) => handleClick(event, item)}
              aria-current={item === currentPage ? "page" : undefined}
            >
              {item}
            </button>
          )
        )}
        <button
          type="button"
          className={`${s.btn} ${s.btnNav}`}
          onClick={(event) => handleClick(event, currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Halaman berikutnya"
        >
          <span>Next</span>
          <ChevronRight />
        </button>
        <button
          type="button"
          className={`${s.btn} ${s.btnNav}`}
          onClick={(event) => handleClick(event, totalPages)}
          disabled={currentPage === totalPages}
          aria-label="Halaman terakhir"
        >
          <span>Last</span>
        </button>
        <div className={s.jumpToPage}>
          <label htmlFor={`jumpToPage-${uid}`}>Halaman:</label>
          <input
            type="number"
            id={`jumpToPage-${uid}`}
            className={s.jumpToPageInput}
            min="1"
            max={totalPages}
            value={jumpToPageValue}
            onChange={(e) => setJumpToPageValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleJumpToPage();
              }
            }}
            placeholder="No."
          />
          <button
            type="button"
            className={`${s.btn} ${s.jumpToPageButton}`}
            onClick={handleJumpToPage}
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
