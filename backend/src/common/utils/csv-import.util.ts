import { BadRequestException } from '@nestjs/common';
import { parseCsv } from './csv.util.js';

export interface ParsedCsv {
  rows: string[][];
  col(name: string): number;
}

export function parseImportCsv(text: string): ParsedCsv {
  const table = parseCsv(text);
  if (table.length === 0) throw new BadRequestException('CSV file is empty');
  const [header, ...rows] = table;
  const normalized = header.map((h) => h.trim().toLowerCase());
  return {
    rows: rows.filter((r) => r.some((c) => c.trim() !== '')),
    col: (name: string) => normalized.indexOf(name.toLowerCase()),
  };
}

export function parseStatus(raw: string | undefined, rowNum: number, errors: string[]): 'ACTIVE' | 'INACTIVE' {
  const v = (raw ?? '').trim().toUpperCase();
  if (!v) return 'ACTIVE';
  if (v !== 'ACTIVE' && v !== 'INACTIVE') {
    errors.push(`Row ${rowNum}: status must be ACTIVE or INACTIVE`);
    return 'ACTIVE';
  }
  return v;
}
