export function isCsvContentType(contentType?: string): boolean {
  if (!contentType) return false;
  return contentType.includes('text/csv') || contentType.includes('application/csv');
}

export function csvToMarkdownTable(csvText: string): string {
  const lines = csvText.trim().split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return '';

  const parseRow = (line: string) => {
    // Basic CSV splitting respecting quotes
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cells.push(current.trim());
    return cells;
  };

  const headers = parseRow(lines[0]);
  let md = '| ' + headers.join(' | ') + ' |\n';
  md += '| ' + headers.map(() => ':---').join(' | ') + ' |\n';

  for (let i = 1; i < lines.length; i++) {
    const row = parseRow(lines[i]);
    md += '| ' + row.join(' | ') + ' |\n';
  }

  return md.trim();
}
