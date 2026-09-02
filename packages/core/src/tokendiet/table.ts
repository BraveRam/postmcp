/**
 * Adaptive JSON Array to GitHub-flavored Markdown Table Converter.
 */

function formatCellValue(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (Array.isArray(val)) {
      return val.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
    }
    // Format small object inline, e.g. { code: "USD", amount: 100 } -> USD 100
    const entries = Object.values(val);
    if (entries.length <= 3 && entries.every((e) => typeof e !== 'object')) {
      return entries.join(' ');
    }
    return JSON.stringify(val);
  }
  const str = String(val).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  return str.length > 80 ? str.slice(0, 77) + '...' : str;
}

export function isHomogeneousObjectArray(arr: any[]): boolean {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.every((item) => item !== null && typeof item === 'object' && !Array.isArray(item));
}

export function arrayToMarkdownTable(arr: any[]): string {
  if (!isHomogeneousObjectArray(arr)) {
    return JSON.stringify(arr, null, 2);
  }

  // Collect all unique keys across the sample (first 10 items)
  const sample = arr.slice(0, 10);
  const columnSet = new Set<string>();
  for (const item of sample) {
    for (const key of Object.keys(item)) {
      columnSet.add(key);
    }
  }

  const columns = Array.from(columnSet);
  if (columns.length === 0) {
    return JSON.stringify(arr, null, 2);
  }

  // Header row
  let md = '| ' + columns.join(' | ') + ' |\n';
  // Separator row
  md += '| ' + columns.map(() => ':---').join(' | ') + ' |\n';

  // Data rows
  for (const item of arr) {
    const row = columns.map((col) => formatCellValue(item[col]));
    md += '| ' + row.join(' | ') + ' |\n';
  }

  return md.trim();
}
