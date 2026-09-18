export function encodeCsv(rows: unknown[][]): string {
  return rows.map((row) => row.map((value) => {
    let text = value == null ? '' : String(value);
    // Keep public names and phone numbers from being interpreted as formulas.
    if (/^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
    return `"${text.replace(/"/g, '""')}"`;
  }).join(',')).join('\r\n');
}
