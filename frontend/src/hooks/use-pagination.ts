"use client";

import { useState } from "react";

export const PAGE_SIZE = 10;

export function usePagination<T>(rows: T[], resetKey: string, pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (resetKey !== prevResetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return { page: currentPage, setPage, pageCount, paged, totalItems: rows.length, pageSize };
}
