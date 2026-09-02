import { parse } from 'csv-parse/sync';

export function isCsvContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.includes('text/csv') || contentType.includes('application/csv');
}

export function csvToMarkdownTable(csvText: string): string {
  const trimmed = csvText.trim();
  if (!trimmed) return '';

  let records: string[][];
  try {
    records = parse(trimmed, {
      skip_empty_lines: true,
      relax_column_count: true,
      trim: true,
    });
  } catch {
    return trimmed;
  }

  if (!records || records.length === 0) return '';

  const headers = records[0];
  let md = '| ' + headers.map((h) => h.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
  md += '| ' + headers.map(() => ':---').join(' | ') + ' |\n';

  for (let i = 1; i < records.length; i++) {
    const row = records[i];
    const paddedRow = headers.map((_, colIdx) => (row[colIdx] !== undefined ? String(row[colIdx]).replace(/\|/g, '\\|') : ''));
    md += '| ' + paddedRow.join(' | ') + ' |\n';
  }

  return md.trim();
}
