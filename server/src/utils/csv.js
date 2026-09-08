function esc(v) {
  const s = v === null || v === undefined ? '' : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build a CSV string from an array of objects using the given column map { header: key }. */
export function toCsv(rows, columns) {
  const header = Object.keys(columns);
  const lines = [header.join(',')];
  for (const row of rows) {
    lines.push(header.map((h) => esc(row[columns[h]])).join(','));
  }
  return lines.join('\n');
}

/**
 * Attach a tamper-evident trace line to an exported CSV so downstream copies can be
 * attributed to the exact admin + export batch. Format:
 *   # <kind> export,<nonce>,uid <userId>,<email>,<ISO timestamp>
 */
export function appendWatermark(csv, { kind, nonce, userId = null, email = '' }) {
  const trace = [
    '# ' + kind + ' export',
    nonce,
    'uid ' + (userId ?? ''),
    email,
    new Date().toISOString(),
  ].join(',');
  return csv + '\n' + trace + '\n';
}

export function csvResponse(res, csv, filename) {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('\uFEFF' + csv); // BOM for Excel
}