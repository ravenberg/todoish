/**
 * RFC 4180 CSV. A cell that starts like a formula gets a leading quote, so a
 * title such as `=HYPERLINK(...)` stays text in a spreadsheet.
 */
export function toCsv(rows: (string | number)[][]) {
  const cell = (value: string | number) => {
    let text = String(value);
    if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

/** Reads what `toCsv` writes, and what spreadsheets export: quotes, commas and newlines in cells. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += char;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  // Undo toCsv's formula guard, and drop blank lines.
  return rows
    .map((r) => r.map((c) => (/^'[=+\-@]/.test(c) ? c.slice(1) : c)))
    .filter((r) => r.some((c) => c.trim() !== ''));
}
